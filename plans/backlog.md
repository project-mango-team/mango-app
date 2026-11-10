# Backlog de Mango

Objetivo general: eliminar lo que queda manual. Hoy los movimientos se cargan solos desde los resúmenes, pero todavía hay que generar cada resumen en el homebanking, subirlo de a uno, limpiar transferencias internas y rescates, recategorizar lo que cae en "Otros" y actualizar a mano el valor de cada inversión.

**Cómo se usa este archivo**
- Cada épica es un frente; cada ticket es una entrega chica que se valida en la app (`npm run dev`) y se commitea en la rama actual. Es un proyecto personal: sin PR por ticket.
- Se toman los tickets en orden, respetando el "depende de". Al terminar uno se cambia su estado acá en el mismo commit.
- Estados: `pendiente` · `en curso` · `hecho` · `bloqueado (motivo)` · `descartado (motivo)`.
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
| ING-06 | **Tokens de integración + webhook de ingesta.** Crear y revocar tokens en la UI (se guarda el hash), middleware `requireApiToken` con scope `/api/ingest/*`, `POST /api/ingest/documents` idempotente y `POST /api/ingest/avisos`. Hecho: tokens en Configuración (menú del usuario), 60 pedidos/min por token. | ING-05 | M | hecho |
| ING-07 | **Google Apps Script para Gmail.** Script que cada hora busca el label `Mango/Resumenes`, manda los adjuntos al webhook, manda los avisos sin adjunto y marca `Mango/Procesado` o `Mango/Error`. Para Visa Galicia sigue el link "Conocer resumen" y baja el PDF de eresumen.com.ar (verificar primero que `UrlFetchApp` llegue al PDF sin login ni JS). Instructivo de instalación y de los filtros de Gmail por banco (según ING-01). Hecho: `integrations/gmail-apps-script/` (script + README), probado contra Mango local con Gmail simulado. Falta que el usuario lo instale y confirmar en Gmail real que el link de eresumen baja el PDF. | ING-06, ING-01 | M | hecho |
| ING-08 | **Avisos sin adjunto.** Documento `pendiente_descarga` con link al homebanking de esa fuente; se cierra solo cuando llega el archivo que coincide (banco + tipo + período). Primero ver si el link "Conocer resumen" de Visa Galicia descarga el PDF directo: si es así, el script lo baja solo. | ING-07 | S | hecho |
| ING-09 | **Calendario de cierres y faltantes.** Por fuente: día de cierre y cómo llega. Un job diario marca los resúmenes esperados que no llegaron, y la bandeja funciona como checklist del mes. Hecho: modelo `FuenteConfig` (día de cierre, cómo llega, activa) por fuente, `GET/PUT/DELETE /api/calendario`, panel "Calendario de cierres" en la Bandeja (estados recibido / avisado / esperando / faltante, 5 días de gracia) y job `faltantes-resumenes` (10:00) que avisa por notificación con clave fuente+cierre. | ING-05, PLAT-01 | M | hecho |
| ING-10 | **Importación automática opt-in.** Por fuente: si la detección es confiable, no hay duplicados dudosos y todo está categorizado, se importa solo, con aviso y rollback desde la bandeja. Hecho: interruptor por fuente en el panel de la Bandeja (`FuenteConfig.auto_importar`); solo aplica a lo que llega por mail/API, no a lo subido a mano. Se importa solo si la detección es de confianza alta, no hay duplicados, no queda nada en "Otros", no hay internos sugeridos pendientes, el archivo no se importó antes y el control de totales cierra (`utils/autoImportacion.js`). Si no pasa, queda `listo` con los motivos a la vista. Avisa por notificación; "Deshacer" funciona igual y el documento vuelve a revisión manual. | ING-05, REV-02 | M | hecho |
| ING-13 | **Parser Visa Galicia formato eresumen.** Soportar el PDF que genera eresumen.com.ar: fechas `DD.MM.YY`, comprobante antes del detalle, "Cuota NN/MM", montos negativos con `-` al final y consumos en moneda extranjera (BRL/USD) con su columna en dólares. Tiene que dar las mismas transacciones que el PDF del homebanking del mismo mes. Tests con un fixture sintético con ese layout (nunca el resumen real). | ING-02 | M | hecho |
| ING-12 | **Control de totales.** Leer del cuerpo del mail, o del PDF, el total y el pago mínimo del resumen, y mostrar en la revisión "importado $X vs. resumen $Y" con la diferencia. Investigar qué incluye esa diferencia (impuestos, cargos, cuotas) y si conviene importarlos como gastos. Hecho: `utils/totalesResumen.js` lee del PDF (homebanking y eresumen) el total en pesos y dólares, el pago mínimo, el saldo anterior, los pagos y los impuestos; la Bandeja y la revisión muestran la diferencia desglosada. El cuerpo del mail no hace falta (los dos PDF traen todo). En los resúmenes reales la diferencia es 100% impuestos (ver `ingesta-resumenes.md`); importarlos queda para ING-14. | ING-07 | S | hecho |
| ING-14 | **Impuestos de la tarjeta como transacciones.** Importar sellos, IIBB e IVA RG 4240 como gastos de categoría Impuestos, y la percepción RG 5617 junto con su devolución (`DEV.IMP.`, como ingreso), para que el control de ING-12 cierre en $0. Hoy el parser importa la percepción pero saltea la devolución. Tests sintéticos con los dos layouts. Hecho: categoría `Impuestos` (default y agregada una vez a los usuarios existentes); los impuestos sin fecha del consolidado de Mastercard van con la fecha de cierre. Con los resúmenes reales el control cierra en $0; los ya importados no cambian (al volver a subirlos, los impuestos salen como nuevos y la percepción como ya cargada). | ING-12 | S | hecho |
| ING-15 | **Parser PDF consolidado caja de ahorro Galicia.** Soportar el PDF "Resumen de Caja de Ahorro en Pesos" (resumen de extractos consolidados): movimientos con fecha `DD/MM/AA`, descripción de una o dos líneas, líneas de detalle y línea de montos (`<crédito> <saldo>` o `-<débito> <saldo>`). Misma salida que el extracto Excel (`parseCuenta`: origen `Banco Galicia`, ARS, detalle con todo el texto del movimiento como el Excel), así que el mismo movimiento subido por Excel y por PDF se deduplica (ING-04). La caja en dólares se rechaza con motivo claro. Control de totales (ING-12) para cuentas: créditos, débitos y saldo final del PDF contra lo importado y conciliación saldo inicial + créditos − débitos = saldo final. Entra por Bandeja (fuente `galicia_caja_ahorro`) y por Cargar (Galicia → Caja de ahorro). Tests con fixture sintético. Hecho: contra un PDF real de 34 movimientos el control cierra en $0. | ING-04, ING-12 | M | hecho |
| ING-11 | **Spike: avisos de consumo por mail.** Si algún banco manda un mail por cada compra, evaluar cargarlas como transacciones provisionales y conciliarlas cuando llega el resumen. | ING-07, ING-04 | S | descartado (los bancos avisan los consumos por push en el celular, no por mail) |

---

## Épica REV — Menos correcciones después de importar
Que Mango muestre solo lo dudoso y aprenda de cada corrección.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| REV-01 | **"Movimiento interno".** Una categoría o flag para transferencias entre cuentas propias, rescates y suscripciones de FCI, y pago de la tarjeta desde la caja de ahorro: no cuentan como gasto ni ingreso (como hoy `Inversión`). Definir si es una categoría nueva o reutiliza `Inversión`/`Transferencia`. → Categoría nueva `Movimiento interno` (FCI sigue en `Inversión`); Inicio la muestra aparte. | — | S | hecho |
| REV-02 | **Reglas con condiciones y acciones.** Reemplazar el substring→categoría por reglas: condiciones (detalle contiene o regex, origen, tipo, rango de monto) → acciones (categoría, marcar interno, ignorar). Se aplican al importar, después de las keywords actuales. Migrar las keywords actuales a reglas sin perder nada. → `CategoryRule` (`utils/categoryRules.js`); las keywords se migran solas una vez (una regla por categoría, mismo orden) y `categoryKeywords` queda para la versión Python. Editor en Inicio (⚙ de Categorías). | REV-01 | M | hecho |
| REV-03 | **Aprender de las correcciones.** Al cambiar la categoría de una transacción: "¿Aplicar a las futuras parecidas?" crea una regla y "¿y a las N ya cargadas?" las actualiza (con confirmación y opción de deshacer). → Al guardar un cambio de categoría en Inicio se ofrece la regla (texto sugerido sin números ni cuotas, mismo origen y tipo) y después las ya cargadas, con deshacer. | REV-02 | M | hecho |
| REV-04 | **Detectar transferencias entre cuentas propias.** Emparejar un egreso en una cuenta con un ingreso del mismo monto en otra, con ±2 días de diferencia; sugerirlas como movimiento interno en la revisión. → `utils/internalTransfers.js`; el editor de la revisión avisa y ofrece "Marcar interno"; al guardar, la contraparte ya cargada también pasa a interno (y el rollback la restaura). | REV-01, ING-04 | M | hecho |
| REV-05 | **Revisión enfocada.** En la bandeja o el editor, el filtro por defecto muestra solo lo dudoso: "Otros", comercios nuevos, duplicados posibles, internos sugeridos y montos fuera de lo normal para esa categoría. → `utils/reviewFocus.js`: el editor arranca en "Para revisar" con el motivo de cada fila y un OK para darla por vista; monto alto = más del doble del p90 de la categoría (con 5+ gastos). La Bandeja muestra "N para revisar". | ING-05, REV-04 | M | hecho |
| REV-06 | **Sugerencias con IA para lo que queda.** Para lo que no cubrió ninguna regla, mandar el detalle y el monto a Claude Haiku con ejemplos del historial y sugerir una categoría con su confianza. Se confirma con un clic, y confirmar puede crear una regla (REV-03). Esto manda los detalles de los movimientos a la API de Anthropic, así que tiene que ser opt-in. → Opt-in en Configuración ("Sugerencias con IA") y requiere `ANTHROPIC_API_KEY` en el servidor; modelo `claude-haiku-5-5` con salida estructurada; en el editor, "Sugerir categorías con IA" para las filas Otros, con "Usar" y "Usar y crear regla". | REV-03 | M | hecho |

---

## Épica PLAT — Plataforma (se toma a demanda)

| ID | Ticket | Lo necesita | Tam. | Estado |
|---|---|---|---|---|
| PLAT-01 | **Scheduler de jobs.** Jobs diarios en el backend deployado (node-cron o el scheduler del hosting), con lock en Mongo para no correr dos veces y una colección de corridas (cuándo, resultado, error) visible en la UI. | ING-09, MP-03, VAL-03 | M | hecho |
| PLAT-02 | **Notificaciones.** Un centro de avisos in-app (resúmenes nuevos, faltantes, errores de sync, valuaciones actualizadas) y opcionalmente un mail semanal con el resumen. | ING-09 | M | hecho (sin el mail semanal) |
| PLAT-03 | **Secretos cifrados.** Guardar tokens de terceros (MP) y contraseñas de PDF cifrados con una clave del entorno (AES-GCM), nunca en texto plano. | MP-02 | S | hecho |

---

## Épica MP — Mercado Pago por API
MP tiene API oficial: los movimientos pueden llegar solos sin descargar nada.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| MP-01 | **Spike de la API.** Qué endpoint da los movimientos de la cuenta personal (búsqueda de pagos o reportes de dinero en cuenta), con qué token (access token de desarrollador propio) y qué campos trae comparado con el CSV que parsea hoy `MercadoPagoParser`. Hecho: reporte de liberaciones con access token de una app propia, mapeo al CSV del parser para entrar por la Bandeja y probe de solo lectura; detalle en [mercadopago.md](mercadopago.md). | — | S | hecho |
| MP-02 | **Conectar la cuenta.** Guardar el token cifrado y probar la conexión desde la UI. Hecho: tarjeta "Mercado Pago" en Configuración con los pasos para sacar el token; se prueba contra MP antes de guardarlo (secreto `mercadopago`), con probar, cambiar y desconectar. | MP-01, PLAT-03 | S | hecho |
| MP-03 | **Sync diaria.** Un job que trae los movimientos nuevos, los mapea al mismo formato que el parser actual y los deja en la bandeja (o los importa con ING-10), con deduplicación. Hecho: job `mercadopago-sync` a las 6:30 y botón "Traer movimientos ahora"; arranca después del último movimiento de MP ya cargado, pide el reporte si no hay y avisa en /avisos. Falta confirmarlo con la cuenta real (probe de MP-01). | MP-02, PLAT-01, ING-04, ING-05 | M | hecho |
| MP-04 | **Saldo de MP en Inversiones.** El saldo remunerado de MP como activo "Cuenta remunerada" con valuación diaria automática. Hecho: la sync de MP toma el saldo del reporte al cierre del período y lo guarda como valuación automática (`guardarValuacionAutomatica`) del activo "Cuenta remunerada" de plataforma Mercado Pago, que crea la primera vez; nunca pisa una valuación manual del día y si falla no frena la sync. Lo que entra o sale de la cuenta (sin rendimientos) se registra como aportes y retiros automáticos, así la ganancia son solo los rendimientos. Cuenta vacía sin activo no lo crea. | MP-03, VAL-01 | S | hecho |
| MP-05 | **Relevar la tarjeta (lo hace el usuario).** Remitente, asunto y adjunto o link del mail del resumen de la tarjeta; si el PDF se baja de la app (Tarjeta de crédito → Resúmenes) y cuántos meses atrás; día de cierre y vencimiento; texto del pago manual en el CSV; si las compras QR con la tarjeta aparecen también en la cuenta; cómo muestra los USD. Los PDF quedan solo en `docs/` local, nunca commiteados. | — | S | pendiente |
| MP-06 | **Probe de la tarjeta.** `mpProbe.js` suma la sección "Tarjeta de crédito": cuántos pagos del resumen hay en el reporte de la cuenta, los pagos hechos con tarjeta y qué campos trae la API. No imprime datos. El usuario lo corre con su token para confirmar si la API trae los consumos de la tarjeta o hay que ir por el PDF. | MP-02 | S | hecho (falta que lo corra el usuario) |
| MP-07 | **Reconocer el pago de la tarjeta.** `utils/pagoTarjeta.js` (`esPagoTarjetaMP`, `pagosDeTarjeta`): regex anclada a "Pago [automático] Tarjeta de crédito", sin tocar el `detalle` (huella de duplicados ING-04). Solo reconoce; no cambia nada. | — | S | hecho |
| MP-08 | **Parser del resumen de la tarjeta + totales.** `origen: 'Mercado Pago Tarjeta'`, `tipo: 'mercadopago'` + `tipoResumen: 'tarjeta'`, fuente `mercadopago_tarjeta` en `fuentesResumen.js` y `extraerTotalesTarjetaMP` con la misma forma que `extraerTotalesTarjeta`. | MP-05 | M | bloqueado (necesita el PDF real) |
| MP-09 | **Cableado en el backend.** Detección, Bandeja, calendario de cierres y control de totales para la fuente nueva. | MP-08 | M | bloqueado (MP-08) |
| MP-10 | **Frontend de la tarjeta.** Opción en Cargar y etiquetas en Bandeja/Historial. Toca `CargarTab`: va después de DAT-05. | MP-09, DAT-05 | S | bloqueado (MP-09) |
| MP-11 | **Pago de la tarjeta como movimiento interno.** El parser de la cuenta fija `Movimiento interno` en los pagos reconocidos y REV-04 `esCandidata` los excluye. **No mergear antes de MP-09**: sin los consumos cargados, el pago neutro esconde el gasto. | MP-07, MP-09 | S | bloqueado (MP-09) |
| MP-12 | **Pago de la tarjeta en la sync por API.** Mapear el pago en el reporte de la API de la misma forma. | MP-06, MP-11 | S | pendiente |
| MP-13 | **Corrección guiada del histórico (opcional).** Si la app no deja bajar los resúmenes de todos los meses: asistente para pasar los pagos viejos a interno de a uno. | MP-11 | M | pendiente |
| MP-14 | **Gmail, Apps Script y calendario.** Que el mail del resumen de la tarjeta entre por el script y figure en el calendario de cierres. | MP-09 | S | bloqueado (MP-09) |
| MP-15 | **PDF con contraseña (condicional).** Si el resumen de la tarjeta viene protegido, usar los secretos cifrados (PLAT-03). | MP-08 | S | pendiente (solo si hace falta) |
| MP-16 | **Duplicado cuenta↔tarjeta por QR (condicional).** Si las compras QR con la tarjeta aparecen en la cuenta y en el resumen, evitar contarlas dos veces. | MP-08 | M | pendiente (solo si MP-05 lo confirma) |

---

**Tarjeta de crédito de MP (MP-05 a MP-16).** El pago de la tarjeta cae en la cuenta como gasto "Otros". El plan es importar el resumen de la tarjeta (cada consumo en su categoría) y dejar el pago de la cuenta como Movimiento interno. Orden: MP-05/06 → 07 → 08 → 09 → 10 → 11 → 14 → 12 → 13. Regla de oro: no neutralizar un pago si no están cargados los consumos de ese resumen.

---

## Épica VAL — Valuación automática de inversiones
No hace falta integrarse con cada broker: alcanza con saber la cantidad que tenés y el precio, que es público.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| VAL-01 | **Cantidad y fuente de precio por activo.** Campos opcionales en el activo: unidades (derivadas de los movimientos que las traen, como las cuotapartes de Fima, o cargadas a mano) y fuente de precio (`cafci`, `ticker`, `coingecko`, `tasa_fija`, `manual`). | — | M | hecho |
| VAL-02 | **FCIs con la CAFCI.** Mapear cada FCI a su fondo y clase en la API pública de la CAFCI y traer el valor de la cuotaparte del día. El importador de Fima ya guarda las cuotapartes de cada operación. | VAL-01 | M | hecho |
| VAL-03 | **Job diario de valuación.** Para cada activo con fuente automática, crea una `Valuacion` (marcada como automática) = unidades × precio. No pisa las valuaciones manuales del mismo día. | VAL-01, PLAT-01 | M | hecho |
| VAL-04 | **ETFs, CEDEARs y acciones por ticker.** Elegir la fuente de precios (pública, con delay está bien) y valuar cantidad × precio. | VAL-03 | M | hecho |
| VAL-05 | **Cripto.** Precio de BTC y otras desde CoinGecko o Binance. | VAL-03 | S | hecho |
| VAL-06 | **Rendimiento a tasa fija.** Para USDT en Nexo y similares: devengar el interés con la tasa anual cargada, sin API. | VAL-03 | S | hecho |

---

## Épica DAT — La Bandeja dentro de Datos
Diseño: [bandeja-en-datos.md](bandeja-en-datos.md). La Bandeja deja de ser una sección aparte: pasa a ser una pestaña de Datos y lo importado por ahí se ve en el mismo historial de cargas.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| DAT-01 | **`revertirOperacion` compartido.** `services/operationService.js` (borra, restaura contrapartes, marca revertida y reabre el documento de la Bandeja) usado por `routes/operations.js` y `routes/upload.js`; `bandejaService.deshacer` usa `/operations/:id/rollback`. → Arregla que revertir desde Datos dejara el documento como importado. | — | S | hecho |
| DAT-02 | **Canal de la carga.** Campos `canal`/`automatica`/`ingest_document_id` en `Operation` (sin default), `canalDeOperacion` para deducir las viejas al leer, `GET /operations` enriquecido. | — | M | hecho |
| DAT-03 | **Datos con pestañas.** Rutas anidadas Bandeja \| Cargar \| Historial \| Migración, redirecciones de `/bandeja` y `/migracion`, menú y badge. | DAT-01 | M | hecho |
| DAT-04 | **Origen y Cuenta en el historial.** Columna Origen con chip, "Cuenta", filtro y aviso "volvió a la Bandeja" al revertir. | DAT-02, DAT-03 | S | hecho |
| DAT-06 | **Links y textos.** `LINK_BANDEJA = '/datos/bandeja'` en avisos y jobs, textos de Configuración, README del script y docs. | DAT-03 | S | hecho |
| DAT-05 | **Achicar `CargarTab`.** Hook + `FormularioResumen`, sacar código inalcanzable. | DAT-03 | M | hecho |

---

## Épica INV — Movimientos de Fima desde el extracto de la caja de ahorro
Los aportes y rescates a Fima caen en el extracto de la caja de ahorro de Galicia como gastos e ingresos "Inversión" (neutros). La idea es que, al importar el extracto, Mango cree solo el aporte o retiro en Inversiones, sin duplicar lo que ya se cargó. Decisiones: sin categoría nueva (la transacción queda `Inversión`); el opt-in es una regla de categorización (REV-02) con acción nueva `inversion` {activo_id}; la transacción crea un `InvestmentMovement` (Gasto → Aporte, Ingreso → Retiro; la moneda tiene que coincidir con la del activo) con `origen: 'extracto'`, `operation_id` y `transaction_id`; no se agregan campos a `transactions` (la base la comparte mango-py); dedupe contra lo ya cargado por tipo, monto al centavo y ±3 días; el rollback borra los movimientos sin cuotapartes y desvincula los que ya las tienen.

| ID | Ticket | Depende de | Tam. | Estado |
|---|---|---|---|---|
| INV-01 | **Relevar el detalle de Fima en el extracto (lo hace el usuario).** Ver la sección "Fima en el extracto" de [inversiones.md](inversiones.md): ¿el detalle trae el nombre del fondo?, ¿el mismo día que la app de Fima?, ¿el monto al centavo?, ¿hay caja en USD? | — | S | pendiente |
| INV-02 | **Modelo y reversión.** `InvestmentMovement` con `origen`, `operation_id` y `transaction_id`; `revertirMovimientosDeOperacion` dentro de `revertirOperacion`. | — | S | hecho |
| INV-03 | **Lógica pura y acción de regla.** `utils/investmentFromStatement.js`, `emparejarConTolerancia` y la acción `inversion` en CategoryRule / `validarRegla` / `aplicarReglas` / `ruleService`. | INV-02 | M | hecho |
| INV-09 | **Valuación segura.** Un Aporte del extracto sin cuotapartes en un activo con precio por unidad no se valúa solo: `valuarActivos` lo salta y cuenta `faltan_unidades`; "Valuar ahora" da un error claro. | INV-02 | S | hecho |
| INV-08 | **Importador Fima con tolerancia.** Empareja con ±3 días y completa las cuotapartes de los movimientos que creó el extracto. | INV-03 | S | hecho |
| INV-04 | **Sugerencia en la vista previa.** `investmentLinkService.marcarInversionesSugeridas`; las cotizaciones pasan a `investmentQuoteService`. | INV-03 | M | hecho |
| INV-05 | **Creación al guardar.** En `guardarImportacion`, best effort, con `_id` explícito y antes de vincular contrapartes; `aviso_inversiones` en la respuesta. | INV-04 | M | hecho |
| INV-06 | **Revisión.** `InversionSugerida.jsx`: casilla "Cargar en Inversiones", "ya cargado el DD/MM" y error en ámbar. | INV-05 | M | hecho |
| INV-07 | **Regla desde la UI.** Acción "Cargar en una inversión" en `ReglaForm` y `reglaTexto`. | INV-03 | S | hecho |
| INV-12 | **Integración.** REV-04 `esCandidata` excluye lo de inversión, `reviewFocus` y la importación automática (ING-10). | INV-05 | S | hecho |
| INV-10 | **Opcional**, fuera de esta tanda (ver el plan del architect). | — | — | pendiente |
| INV-11 | **Backfill del histórico.** Botón "Buscar en extractos ya cargados" en el detalle del activo: toma las transacciones Inversión ya cargadas que matchean las reglas del activo, deduplica con ±3 días y las carga con origen extracto y transaction_id (sin operation_id), con vista previa. | INV-05 | M | hecho |
| INV-13 | **Autoasociar el fondo de Fima del extracto con el activo.** El detalle de RESCATE/SUSCRIPCION FIMA del extracto trae el nombre del fondo (ver [inversiones.md](inversiones.md), "Fima en el extracto"). Idea: al importar, comparar ese nombre (normalizado, sin clase ni mayúsculas; viene truncado a ~20 caracteres) con el nombre o `fci_nombre` de los activos Fima del usuario y, si hay un único candidato, proponer la regla de inversión (acción `inversion`) en la revisión con un clic, sin configurarla a mano. Si hay varios o ninguno, no se propone nada. No crea activos ni reglas solo: el usuario confirma. A analizar y planear antes de implementar. | INV-07, ING-15 | M | pendiente |

---

## Ideas sueltas (sin épica todavía)
- **Consumos en moneda extranjera mal importados antes del 20/10/2026**: el parser de Visa Galicia guardaba los consumos en reales (y otras monedas que no fueran USD) como pesos con el monto en dólares (por ejemplo, US$ 21,33 → $21,33). Ya está corregido para los imports nuevos (ING-13). Para los ya cargados haría falta una corrección puntual, con preview y confirmación del usuario: no se toca la DB sin que lo pida.
- **Conciliación mensual**: para cada mes, comparar cuánto cambió el patrimonio contra ingresos − gastos + ganancia de inversiones, y mostrar lo "sin explicar" (lo que se pasó anotar). Requiere tener todas las cuentas y el efectivo cargados como activos.
- **Préstamos en la moneda del deudor**: hoy el saldo se lleva en USD; un préstamo en pesos devuelto en pesos deja un residuo. Llevar el saldo en la moneda original y mostrar aparte la pérdida contra el dólar.
- **Comparativa mensual por año**: con "Todos los años", el gráfico mensual de Inicio junta el mismo mes de distintos años.
- **Warnings de índices duplicados en Mongoose** (`googleId`, `email`, `operation_id`, etc.): limpieza menor de los modelos.
