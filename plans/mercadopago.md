# Mercado Pago por API · spike (MP-01)

Resultado del spike de la épica MP de [backlog.md](backlog.md): cómo traer los movimientos de la cuenta de Mercado Pago del usuario sin bajar el CSV a mano, y cómo encajarlos en la Bandeja.

## Qué hay hoy

El usuario baja de Mercado Pago el reporte de su cuenta en CSV y lo sube (Migración o Bandeja). `MercadoPagoParser` lee:

```
INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE
<saldo inicial>;<créditos>;<débitos>;<saldo final>

RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
DD-MM-YYYY;<texto>;<id de 13 dígitos>;<monto con signo, formato 1.234,56>;<saldo>
```

De cada fila usa solo tres cosas: `RELEASE_DATE` → `fecha`, `TRANSACTION_TYPE` → `detalle` (y la categoría por keywords) y `TRANSACTION_NET_AMOUNT` → `importe` (el signo da `Gasto`/`Ingreso`). `REFERENCE_ID` y `PARTIAL_BALANCE` se descartan; todo es ARS con `origen: 'Mercado Pago'`.

Los textos de `TRANSACTION_TYPE` en un mes real son de pocas familias: `Rendimientos`, `Pago con QR <comercio>`, `Transferencia recibida <nombre>`, `Transferencia enviada <nombre>` (más pagos de servicios, tarjeta, etc., según el mes). **El nombre de la contraparte es lo que más sirve para categorizar** y es lo que la API menos garantiza (ver abajo).

## Autenticación

Mercado Pago no tiene "token personal" aparte: todo access token sale de una **aplicación** creada en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app). Dos caminos:

| | Access token de producción de una app propia | OAuth (authorization code) |
|---|---|---|
| Cómo se obtiene | El usuario crea una app en su cuenta, activa las credenciales de producción (pide rubro y un sitio web; sirve `https://projectmango.app`) y copia el `APP_USR-...` | Mango tiene una app; cada usuario autoriza con un redirect a `/api/mp/callback` |
| Vida del token | No vence mientras no se renueven las credenciales | 180 días; se renueva con `refresh_token` (pide el scope `offline_access`) y el refresh token rota en cada renovación |
| Trabajo en Mango | Un campo para pegar el token (MP-02) | Endpoints de OAuth, `state` anti-CSRF, guardar y rotar el refresh token, job de renovación |
| Para quién | Cada usuario con su propia app | Cualquier usuario, sin crear nada |

**Recomendación: token de producción de una app propia.** Mango hoy lo usa una persona (más el invitado de dev); OAuth agrega bastante superficie por un beneficio que no necesitamos. El token se guarda cifrado (PLAT-03) y nunca se loguea. Si algún día hay más usuarios reales, se agrega OAuth sin cambiar el resto (el cliente solo recibe un access token).

El token da acceso total a la cuenta (también a cobrar y a devolver pagos). Mango solo lo usa para **leer**: reportes y búsqueda de pagos. Mercado Pago no ofrece tokens de solo lectura.

## Endpoints candidatos

Base: `https://api.mercadopago.com`, header `Authorization: Bearer <token>`.

### 1. Reporte de liberaciones ("Dinero liberado") — `/v1/account/release_report`

Es el equivalente por API del CSV que se sube hoy: lista los movimientos que cambiaron el **saldo disponible**, con el saldo después de cada uno.

- `POST /v1/account/release_report/config` (y `GET`/`PUT`): columnas, separador, zona horaria (`display_timezone`, default GMT-04), idioma de encabezados, prefijo del archivo, frecuencia.
- `POST /v1/account/release_report` con `{ begin_date, end_date }` (ISO UTC): genera el reporte **asincrónico** (202; 203 = reintentar con las fechas que indica).
- `GET /v1/account/release_report/list`: reportes generados (`id`, `begin_date`, `end_date`, `status`, `file_name`...).
- `GET /v1/account/release_report/:file_name`: baja el CSV.
- `POST`/`DELETE /v1/account/release_report/schedule`: generación programada (diaria/semanal/mensual) y aviso por webhook.
- Límite: **60 días por reporte**.

Columnas útiles: `DATE` (liberación), `SOURCE_ID` (id de la operación), `RECORD_TYPE` (`initial_available_balance`, `release`, `available_balance`, `total`...), `DESCRIPTION` (`payment`, `payout`, `refund`, `asset_management_gain`, `tax_withholding`, `credit_payment`...), `NET_CREDIT_AMOUNT`, `NET_DEBIT_AMOUNT`, `BALANCE_AMOUNT`, `CURRENCY`, `PAYMENT_METHOD`, `TRANSACTION_DATE`. [Glosario](https://www.mercadopago.com.br/developers/en/docs/reports/released-money/report-fields).

Lo que falta: **`DESCRIPTION` es un código** (`payment`), no "Pago con QR Comercio X". No trae el nombre de la contraparte.

### 2. Reporte de dinero en cuenta ("todas las transacciones") — `/v1/account/settlement_report`

Mismos endpoints (`/config`, `/list`, `/:file_name`, `/schedule`). Está pensado para vendedores: cobros, devoluciones, contracargos, retiros (`TRANSACTION_TYPE` = `SETTLEMENT`, `REFUND`, `WITHDRAWAL`...), con monto bruto y comisiones. **No sirve como fuente principal** para una cuenta personal: no muestra rendimientos ni, según la documentación, pagos hechos por el titular.

### 3. Búsqueda de pagos — `GET /v1/payments/search`

- Filtros: `sort`, `criteria`, `range` (`date_created`, `date_approved`, `money_release_date`...), `begin_date`/`end_date` (también `NOW-30DAYS`), `collector.id`, `payer.id`, `status`, `limit`/`offset`.
- Devuelve objetos de pago completos: `id`, fechas, `status`, `transaction_amount`, `currency_id`, `description`, `payment_method_id`, `payment_type_id`, `operation_type`, `payer`, `collector_id`, `transaction_details.net_received_amount`...
- Límites: solo **los últimos 12 meses** y rango menor a 365 días; rechaza el mismo request repetido dentro del minuto (error 2001). No hay rate limit publicado.
- `GET /v1/payments/:id` da el detalle de un pago puntual (sirve para enriquecer una fila del reporte por su `SOURCE_ID`).

Lo que no está claro en la documentación: la búsqueda está documentada para lo que **cobra** la cuenta (collector). Si con `payer.id=<mi id>` también devuelve lo que la cuenta **pagó** (QR, servicios), y si las transferencias por CVU aparecen como pagos, hay que verificarlo con la cuenta real.

## Mapeo a transacciones de Mango

| Mango | CSV actual | Reporte de liberaciones (API) |
|---|---|---|
| `fecha` (DD/MM/YYYY) | `RELEASE_DATE` (DD-MM-YYYY) | `DATE` (ISO; la config pide `display_timezone: GMT-03`) → DD/MM/YYYY |
| `importe` (positivo) | `|TRANSACTION_NET_AMOUNT|` | `NET_CREDIT_AMOUNT` o `NET_DEBIT_AMOUNT` |
| `tipo` | signo del monto | crédito → `Ingreso`, débito → `Gasto` |
| `detalle` | `TRANSACTION_TYPE` | texto armado desde `DESCRIPTION` (+ contraparte del pago si se enriquece) |
| `moneda` / `monto_original` | ARS | `CURRENCY` (ARS; el reporte es en moneda local) |
| `origen` | `Mercado Pago` | `Mercado Pago` |
| (descartado) | `REFERENCE_ID` | `SOURCE_ID` |

Filas a ignorar del reporte: las de saldo (`RECORD_TYPE` `initial_available_balance`, `available_balance`, `total`, `subtotal`) y las de monto cero.

Textos para `DESCRIPTION` (los que conocemos; el resto queda con el código, así se ve y se agrega):

| Código | Detalle en Mango |
|---|---|
| `asset_management_gain` | `Rendimientos` (igual que el CSV, así cae en la misma categoría y deduplica) |
| `asset_management_loss` | `Rendimientos negativos` |
| `payment` (crédito) | `Pago recibido` |
| `payment` (débito) | `Pago` |
| `payout` | `Transferencia enviada` |
| `refund` | `Devolución` |
| `credit_payment` | `Cuota de préstamo Mercado Pago` |
| `tax_*` | `Impuesto` / `Retención` |

## Cómo entra a la Bandeja

La sync **no inventa un camino nuevo**: arma un CSV con exactamente el formato que lee `MercadoPagoParser` (encabezado de saldos más filas `RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE`) y lo pasa a `recibirDocumento(req, { buffer, filename, fuente: 'api' })`. Desde ahí todo es lo que ya existe: detección (`MercadoPagoParser.detectar`), preview, revisión con el editor, duplicados de ING-04, importar, deshacer con `operation_id`. El nombre del archivo indica el período (`mercadopago-api-2026-10-01-a-2026-10-19.csv`) y el hash evita meter dos veces el mismo período.

Ventajas: cero cambios en parser, Bandeja e importación; el día que Mercado Pago cambie algo, el arreglo queda en el cliente y el mapeo.

### Duplicados con lo que ya se subió a mano

La huella de ING-04 es `fecha + tipo + moneda + importe + detalle normalizado + origen`. Una fila que vino del CSV como `Transferencia recibida Juan Pérez` y la misma por API como `Pago recibido` **no** se reconocen como iguales. Mitigaciones, en orden:

1. **Fecha de corte**: la primera sync arranca el día siguiente al último movimiento de Mercado Pago ya importado (máxima `fecha` con `origen: 'Mercado Pago'`). Así API y CSV no se superponen. Es lo que recomiendo para MP-03.
2. `Rendimientos` mapea al mismo texto que el CSV, así que esos (la mayoría de las filas) sí deduplican aunque haya superposición.
3. Si el probe muestra que `GET /v1/payments/:id` trae el nombre de la contraparte, enriquecer el detalle a `Pago con QR <comercio>` / `Transferencia recibida <nombre>` y deduplica igual que el CSV.

## Riesgos y dudas abiertas

1. **¿El reporte de liberaciones de una cuenta personal trae los pagos y transferencias enviadas?** La documentación está escrita para vendedores. El formato del CSV que baja el usuario (fecha de liberación, monto neto, saldo parcial) apunta a que es el mismo reporte, pero hay que confirmarlo con la cuenta real.
2. **Descripción pobre**: sin contraparte la categorización por keywords empeora ("Pago" en vez de "Pago con QR Verdulería"). Depende de lo que traiga `/v1/payments/:id`.
3. **Activar credenciales de producción** pide datos de "negocio" (rubro y sitio web). Para una cuenta personal debería alcanzar con `https://projectmango.app`, pero no está garantizado.
4. **Generación asincrónica**: el reporte tarda minutos. La sync diaria pide el reporte y lo baja en la corrida siguiente (o espera con reintentos acotados).
5. **USD**: la cuenta de MP en Argentina opera en pesos; si aparece `CURRENCY` distinto de ARS, el mapeo lo marca y lo deja sin importar.

## Próximo paso: probe con la cuenta real (lo hace el usuario)

Para cerrar las dudas 1 y 2 hace falta mirar la cuenta real. **Mango no crea la app ni carga el token**: lo hace el usuario.

1. Entrar a [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) con la cuenta de Mercado Pago → **Crear aplicación** (nombre "Mango", tipo de solución "Pagos online"/integración propia, sin plataforma de e-commerce).
2. En la app, **Credenciales de producción** → activarlas (rubro y sitio web `https://projectmango.app`) → copiar el **Access Token** (`APP_USR-...`).
3. Correr el probe desde `backend/`, pasando el token solo en esa terminal (no queda en ningún archivo):

   ```powershell
   $env:MP_ACCESS_TOKEN = "APP_USR-..."; node src/scripts/mpProbe.js; Remove-Item Env:MP_ACCESS_TOKEN
   ```

El probe (`backend/src/scripts/mpProbe.js`) es de solo lectura y **no imprime nombres, montos ni ids**: solo cuenta. Dice qué códigos de `DESCRIPTION`/`RECORD_TYPE` aparecen en los últimos 30 días del reporte de liberaciones (pidiendo uno si no hay), cuántos pagos devuelve la búsqueda como cobrador y como pagador, y qué campos vienen con datos en el detalle de un pago (`description`, `payer.first_name`, `collector`, `point_of_interaction`...). Con eso se confirma el mapeo y se decide si vale la pena enriquecer.

Si no hay ningún reporte generado, `node src/scripts/mpProbe.js --pedir-reporte` crea la configuración del reporte (encabezados en inglés, GMT-03, las columnas de arriba) y pide uno de los últimos 30 días. Es la única escritura sobre la cuenta, y solo afecta a la configuración de reportes. Volver a correr el probe sin el flag unos minutos después.

## Recomendación

- **Fuente**: reporte de liberaciones (`/v1/account/release_report`), en ventanas de hasta 60 días. Es el único endpoint que cubre todo lo que mueve el saldo (incluidos rendimientos) y trae saldo corrido para controlar totales (ING-12).
- **Enriquecimiento opcional**: `GET /v1/payments/:id` por `SOURCE_ID` para el detalle, si el probe muestra que trae la contraparte.
- **Auth**: access token de producción de una app propia del usuario, cifrado con PLAT-03 (MP-02). OAuth solo si Mango suma usuarios.
- **Ingreso**: CSV sintético en el formato de `MercadoPagoParser` → `recibirDocumento` con `fuente: 'api'` → Bandeja, con fecha de corte para no superponerse con lo subido a mano (MP-03).
- **Orden de trabajo**: cliente (`services/mercadoPagoClient.js`) y mapeo (`utils/mercadoPagoMapping.js`) con tests de Vitest y datos sintéticos ya, porque no dependen de PLAT. MP-02 espera a PLAT-03 y MP-03 a PLAT-01.

## Fuentes

- [Reporte de liberaciones por API](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-payments/additional-content/reports/released-money/api) y [glosario de campos](https://www.mercadopago.com.br/developers/en/docs/reports/released-money/report-fields)
- [Reporte de dinero en cuenta por API](https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/resources/reports/account-money/api.md)
- [Búsqueda de pagos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/search-payments/get)
- [Credenciales](https://www.mercadopago.com.ar/developers/es/docs/credentials) y [renovación de tokens OAuth](https://www.mercadopago.cl/developers/en/docs/security/oauth/renewal)
