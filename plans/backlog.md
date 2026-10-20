# Backlog de Mango

Objetivo general: eliminar lo que queda manual. Hoy los movimientos se cargan solos desde los resúmenes, pero todavía hay que generar cada resumen en el homebanking, subirlo de a uno, limpiar transferencias internas y rescates, recategorizar lo que cae en "Otros" y actualizar a mano el valor de cada inversión.

**Cómo se usa este archivo**
- Cada épica es un frente; cada ticket es una entrega chica que se valida en la app (`npm run dev`) y se commitea en la rama actual. Es un proyecto personal: sin PR por ticket.
- Se toman los tickets en orden, respetando el "depende de". Al terminar uno se cambia su estado acá en el mismo commit.
- Estados: `pendiente` · `en curso` · `hecho` · `bloqueado (motivo)`.
- Tamaño estimado: **S** (un rato) · **M** (una sesión) · **L** (más de una sesión: conviene partirlo).

**Orden de épicas**: ING → REV → PLAT (lo que haga falta) → MP → VAL. PLAT no es una épica en sí: sus tickets se toman cuando otro los necesita.

---

## Épica ING — Ingesta automática de resúmenes
Diseño completo: [ingesta-resumenes.md](ingesta-resumenes.md).
De "entrar a cada homebanking y subir de a uno" a "los resúmenes llegan solos a una bandeja y confirmo".

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| ING-01 | **Relevamiento por banco.** Para Visa y Master Galicia, Santander Visa/Amex, cajas de ahorro de Galicia y Santander y MP: ¿se puede activar el envío del resumen por mail? ¿viene adjunto (PDF/XLSX) o es solo un aviso con link? ¿con contraseña? ¿qué remitente y qué asunto? ¿qué día cierra? Lo hace el usuario en cada homebanking y guarda un mail de ejemplo de cada uno. Resultado: una tabla en `ingesta-resumenes.md`. **Galicia relevado**: Mastercard con PDF adjunto; Visa con link a eresumen.com.ar que genera el PDF (otro formato, ING-13); caja de ahorro solo aviso. Falta Santander. | — | S | en curso |
| ING-02 | **Extraer el servicio de importación.** Sacar de `routes/upload.js` el dispatch por banco y el guardado (`Operation` + `Transaction`) a `services/statementImportService.js`. Comportamiento idéntico: comparar la salida de `/preview` con los fixtures de `docs/` antes y después. | — | M | hecho |
| ING-03 | **Detección automática de banco, tipo y tarjeta.** `detectarDocumento(buffer, filename)` por firmas de contenido; cada parser expone `detectar()`. Con confianza baja, cae al flujo manual. Tests con fixtures sintéticos. Ya integrado en Datos: al elegir el archivo se completan banco, tipo y tarjetas. | ING-02 | M | hecho |
| ING-04 | **Deduplicación de transacciones.** Huella `fecha+importe+moneda+detalle normalizado+origen` comparada contando repeticiones; los duplicados salen marcados en el preview (también en Migración). Hash del archivo para no procesar dos veces lo mismo. Hecho: la huella mantiene la cuota (Galicia repite la fecha de compra en cada cuota), compara USD por monto en dólares y saca la marca K. | ING-02 | M | hecho |
| ING-05 | **Bandeja de documentos.** Modelo `IngestDocument`, sección "Bandeja" con badge en el menú, drop de varios archivos a la vez, detección y preview automáticos, revisar con el editor existente, importar, descartar e "importar todos los listos". **Este ticket solo ya ahorra la mayor parte del trabajo del mes.** Hecho: sección Bandeja con badge, varios archivos a la vez, revisión con cotización editable, importar/descartar/deshacer e importar todos los listos. Pendiente menor: borrar el contenido de los documentos importados después de N días. | ING-03, ING-04 | L | hecho |
| ING-06 | **Tokens de integración + webhook de ingesta.** Crear y revocar tokens en la UI (se guarda el hash), middleware `requireApiToken` con scope `/api/ingest/*`, `POST /api/ingest/documents` idempotente y `POST /api/ingest/avisos`. | ING-05 | M | pendiente |
| ING-07 | **Google Apps Script para Gmail.** Script que cada hora busca el label `Mango/Resumenes`, manda los adjuntos al webhook, manda los avisos sin adjunto y marca `Mango/Procesado` o `Mango/Error`. Para Visa Galicia sigue el link "Conocer resumen" y baja el PDF de eresumen.com.ar (verificar primero que `UrlFetchApp` llegue al PDF sin login ni JS). Instructivo de instalación y de los filtros de Gmail por banco (según ING-01). | ING-06, ING-01 | M | pendiente |
| ING-08 | **Avisos sin adjunto.** Documento `pendiente_descarga` con link al homebanking de esa fuente; se cierra solo cuando llega el archivo que coincide (banco + tipo + período). Primero ver si el link "Conocer resumen" de Visa Galicia descarga el PDF directo: si es así, el script lo baja solo. | ING-07 | S | pendiente |
| ING-09 | **Calendario de cierres y faltantes.** Por fuente: día de cierre y cómo llega. Un job diario marca los resúmenes esperados que no llegaron, y la bandeja funciona como checklist del mes. | ING-05, PLAT-01 | M | pendiente |
| ING-10 | **Importación automática opt-in.** Por fuente: si la detección es confiable, no hay duplicados dudosos y todo está categorizado, se importa solo, con aviso y rollback desde la bandeja. | ING-05, REV-02 | M | pendiente |
| ING-13 | **Parser Visa Galicia formato eresumen.** Soportar el PDF que genera eresumen.com.ar: fechas `DD.MM.YY`, comprobante antes del detalle, "Cuota NN/MM", montos negativos con `-` al final y consumos en moneda extranjera (BRL/USD) con su columna en dólares. Tiene que dar las mismas transacciones que el PDF del homebanking del mismo mes. Tests con un fixture sintético con ese layout (nunca el resumen real). | ING-02 | M | hecho |
| ING-12 | **Control de totales.** Leer del cuerpo del mail, o del PDF, el total y el pago mínimo del resumen, y mostrar en la revisión "importado $X vs. resumen $Y" con la diferencia. Investigar qué incluye esa diferencia (impuestos, cargos, cuotas) y si conviene importarlos como gastos. | ING-07 | S | pendiente |
| ING-11 | **Spike: avisos de consumo por mail.** Si algún banco manda un mail por cada compra, evaluar cargarlas como transacciones provisionales y conciliarlas cuando llega el resumen. | ING-07, ING-04 | S | pendiente |

---

## Épica REV — Menos correcciones después de importar
Que Mango muestre solo lo dudoso y aprenda de cada corrección.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| REV-01 | **"Movimiento interno".** Una categoría o flag para transferencias entre cuentas propias, rescates y suscripciones de FCI, y pago de la tarjeta desde la caja de ahorro: no cuentan como gasto ni ingreso (como hoy `Inversión`). Definir si es una categoría nueva o reutiliza `Inversión`/`Transferencia`. | — | S | pendiente |
| REV-02 | **Reglas con condiciones y acciones.** Reemplazar el substring→categoría por reglas: condiciones (detalle contiene o regex, origen, tipo, rango de monto) → acciones (categoría, marcar interno, ignorar). Se aplican al importar, después de las keywords actuales. Migrar las keywords actuales a reglas sin perder nada. | REV-01 | M | pendiente |
| REV-03 | **Aprender de las correcciones.** Al cambiar la categoría de una transacción: "¿Aplicar a las futuras parecidas?" crea una regla y "¿y a las N ya cargadas?" las actualiza (con confirmación y opción de deshacer). | REV-02 | M | pendiente |
| REV-04 | **Detectar transferencias entre cuentas propias.** Emparejar un egreso en una cuenta con un ingreso del mismo monto en otra, con ±2 días de diferencia; sugerirlas como movimiento interno en la revisión. | REV-01, ING-04 | M | pendiente |
| REV-05 | **Revisión enfocada.** En la bandeja o el editor, el filtro por defecto muestra solo lo dudoso: "Otros", comercios nuevos, duplicados posibles, internos sugeridos y montos fuera de lo normal para esa categoría. | ING-05, REV-04 | M | pendiente |
| REV-06 | **Sugerencias con IA para lo que queda.** Para lo que no cubrió ninguna regla, mandar el detalle y el monto a Claude Haiku con ejemplos del historial y sugerir una categoría con su confianza. Se confirma con un clic, y confirmar puede crear una regla (REV-03). Esto manda los detalles de los movimientos a la API de Anthropic, así que tiene que ser opt-in. | REV-03 | M | pendiente |

---

## Épica PLAT — Plataforma (se toma a demanda)

| ID | Ticket | Lo necesita | Tam. | Estado |
|---|---|---|---|---|
| PLAT-01 | **Scheduler de jobs.** Jobs diarios en el backend deployado (node-cron o el scheduler del hosting), con lock en Mongo para no correr dos veces y una colección de corridas (cuándo, resultado, error) visible en la UI. | ING-09, MP-03, VAL-03 | M | pendiente |
| PLAT-02 | **Notificaciones.** Un centro de avisos in-app (resúmenes nuevos, faltantes, errores de sync, valuaciones actualizadas) y opcionalmente un mail semanal con el resumen. | ING-09 | M | pendiente |
| PLAT-03 | **Secretos cifrados.** Guardar tokens de terceros (MP) y contraseñas de PDF cifrados con una clave del entorno (AES-GCM), nunca en texto plano. | MP-02 | S | pendiente |

---

## Épica MP — Mercado Pago por API
MP tiene API oficial: los movimientos pueden llegar solos sin descargar nada.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| MP-01 | **Spike de la API.** Qué endpoint da los movimientos de la cuenta personal (búsqueda de pagos o reportes de dinero en cuenta), con qué token (access token de desarrollador propio) y qué campos trae comparado con el CSV que parsea hoy `MercadoPagoParser`. | — | S | pendiente |
| MP-02 | **Conectar la cuenta.** Guardar el token cifrado y probar la conexión desde la UI. | MP-01, PLAT-03 | S | pendiente |
| MP-03 | **Sync diaria.** Un job que trae los movimientos nuevos, los mapea al mismo formato que el parser actual y los deja en la bandeja (o los importa con ING-10), con deduplicación. | MP-02, PLAT-01, ING-04, ING-05 | M | pendiente |
| MP-04 | **Saldo de MP en Inversiones.** El saldo remunerado de MP como activo "Cuenta remunerada" con valuación diaria automática. | MP-03, VAL-01 | S | pendiente |

---

## Épica VAL — Valuación automática de inversiones
No hace falta integrarse con cada broker: alcanza con saber la cantidad que tenés y el precio, que es público.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| VAL-01 | **Cantidad y fuente de precio por activo.** Campos opcionales en el activo: unidades (derivadas de los movimientos que las traen, como las cuotapartes de Fima, o cargadas a mano) y fuente de precio (`cafci`, `ticker`, `coingecko`, `tasa_fija`, `manual`). | — | M | pendiente |
| VAL-02 | **FCIs con la CAFCI.** Mapear cada FCI a su fondo y clase en la API pública de la CAFCI y traer el valor de la cuotaparte del día. El importador de Fima ya guarda las cuotapartes de cada operación. | VAL-01 | M | pendiente |
| VAL-03 | **Job diario de valuación.** Para cada activo con fuente automática, crea una `Valuacion` (marcada como automática) = unidades × precio. No pisa las valuaciones manuales del mismo día. | VAL-01, PLAT-01 | M | pendiente |
| VAL-04 | **ETFs, CEDEARs y acciones por ticker.** Elegir la fuente de precios (pública, con delay está bien) y valuar cantidad × precio. | VAL-03 | M | pendiente |
| VAL-05 | **Cripto.** Precio de BTC y otras desde CoinGecko o Binance. | VAL-03 | S | pendiente |
| VAL-06 | **Rendimiento a tasa fija.** Para USDT en Nexo y similares: devengar el interés con la tasa anual cargada, sin API. | VAL-03 | S | pendiente |

---

## Ideas sueltas (sin épica todavía)
- **Consumos en moneda extranjera mal importados antes del 20/10/2026**: el parser de Visa Galicia guardaba los consumos en reales (y otras monedas que no fueran USD) como pesos con el monto en dólares (por ejemplo, US$ 21,33 → $21,33). Ya está corregido para los imports nuevos (ING-13). Para los ya cargados haría falta una corrección puntual, con preview y confirmación del usuario: no se toca la DB sin que lo pida.
- **Conciliación mensual**: para cada mes, comparar cuánto cambió el patrimonio contra ingresos − gastos + ganancia de inversiones, y mostrar lo "sin explicar" (lo que se pasó anotar). Requiere tener todas las cuentas y el efectivo cargados como activos.
- **Préstamos en la moneda del deudor**: hoy el saldo se lleva en USD; un préstamo en pesos devuelto en pesos deja un residuo. Llevar el saldo en la moneda original y mostrar aparte la pérdida contra el dólar.
- **Comparativa mensual por año**: con "Todos los años", el gráfico mensual de Inicio junta el mismo mes de distintos años.
- **Warnings de índices duplicados en Mongoose** (`googleId`, `email`, `operation_id`, etc.): limpieza menor de los modelos.
