# Integración de épicas · checklist de prueba manual

Rama `integracion` = `main` (edee0be) + `epica/plat` → `val` → `rev` → `mp` → `ing`. Nada de esto está en `main` todavía.
Verificado por la sesión de integración: `npm test` (37 archivos, 344 tests) y `npm run build` pasan; con `npm run dev` sobre `Mango_dev` cargan sin errores de consola ni de backend Inicio, Datos, Bandeja (con calendario de cierres), Inversiones, Avisos y Configuración (tarjeta de Mercado Pago, tokens, credenciales, tareas programadas, sugerencias con IA) y el modal de reglas. El scheduler arranca con 4 jobs: limpieza-corridas, mercadopago-sync, valuacion-diaria, faltantes-resumenes.
Para probar: `npm run dev` (usa `Mango_dev`), entrar como invitado.

## Antes de mergear a main
- [ ] Variables nuevas en producción: `SECRETS_KEY` (32 bytes en base64, obligatoria para guardar el token de MP y contraseñas de PDF), `ADMIN_EMAILS` (si no, nadie ve las tareas programadas), `ANTHROPIC_API_KEY` (opcional, solo REV-06), `SCHEDULER_ENABLED`.
- [ ] Si hay más de una réplica, el scheduler corre una sola vez por el índice único de `JobRun`.

## PLAT (scheduler, avisos, secretos)
- [ ] Configuración → Tareas programadas: aparecen los 4 jobs, "Correr ahora" funciona y queda en el historial.
- [ ] Avisos: el menú muestra el badge, "Marcar todos como leídos" lo apaga.
- [ ] Credenciales guardadas: guardar y borrar una contraseña de PDF; no se puede volver a ver el valor.

## VAL (valuación automática)
- [ ] Nuevo activo con fuente FCI, ticker (`.BA`), cripto y tasa fija: "Actualizar valores" trae precio.
- [ ] Tenencia por unidades: un Aporte suma, un Retiro resta, una Valuación fija la tenencia.
- [ ] Editar a mano una valuación automática la vuelve manual (no la pisa el job de las 07:00).

## REV (revisión mensual)
- [ ] Movimiento interno: no cuenta como gasto ni ingreso en Inicio; revertir una carga devuelve la categoría original de la contraparte.
- [ ] Inicio → Reglas de categorización: crear, ordenar, pausar, editar y eliminar; probar "contiene", regex y la acción "No importar".
- [ ] Corregir la categoría de una transacción ofrece aprender una regla (REV-03).
- [ ] Bandeja/Datos: la transacción ignorada no entra ni cuenta en los totales.
- [ ] Sugerencias con IA (Configuración): sin `ANTHROPIC_API_KEY` queda deshabilitada; con clave, sugiere categorías (REV-06).

## MP (Mercado Pago por API) — NUNCA probado con una cuenta real
- [ ] Crear la app en Mercado Pago, correr el probe `backend/src/scripts/mpProbe.js` con el token y confirmar que el reporte de una cuenta personal trae pagos y transferencias.
- [ ] Configuración → Mercado Pago: pegar el Access Token (`APP_USR-…`), "Conectar" lo prueba antes de guardar; desconectar lo borra.
- [ ] "Sincronizar" y el job de las 06:30: los movimientos llegan a la Bandeja, sin duplicar si se corre dos veces; aviso `mercadopago_sync` en Avisos.
- [ ] MP-04: el saldo aparece en Inversiones como valuación automática; revisar que no se duplique con la carga manual.

## ING (ingesta automática)
- [ ] Bandeja: subir varios resúmenes juntos, revisar, importar, descartar y deshacer.
- [ ] Calendario de cierres: configurar día de cierre por fuente; el job `faltantes-resumenes` avisa de los que no llegaron (ING-09) y el aviso se cierra cuando llega el archivo (ING-08).
- [ ] Control de totales (ING-12): un resumen cuyo total no cierra no se importa solo.
- [ ] Importación automática opt-in (ING-10): activarla en una fuente con datos reales y verificar que respeta duplicados, categorías pendientes y totales.
- [ ] Avisos de consumo (ING-11): ver lo que quedó decidido (descartado, los bancos avisan por push).
- [ ] Gmail Apps Script sigue andando contra el webhook (tokens sin cambios).

## Riesgos conocidos
1. **ReDoS en regex de usuario (resuelto, a verificar)**: `utils/regexSegura.js` rechaza al guardar la regla las regex peligrosas (grupos repetidos con repeticiones o alternativas dentro, referencias hacia atrás, lookaround, más de 3 repeticiones sin tope); las ya guardadas que no pasan el chequeo no se evalúan y el texto evaluado se corta a 300 caracteres. Es conservador: una regex legítima puede rechazarse (se sugiere partirla en varias reglas). Probar en Reglas de categorización que `^PAGO TARJETA` se guarda y `(a+)+$` se rechaza con un mensaje claro.
2. **`routes/operations.js` no llama a `reabrirPorRollback`** en `POST /:operationId/rollback` (sí lo hace `routes/upload.js:333`). Revertir una carga desde Datos deja el documento de la Bandeja como importado y no se puede volver a importar. *Arreglo propuesto*: agregar `await reabrirPorRollback(req, operation.operation_id)` después de `restaurarContrapartes`.
3. ING-01 sigue en curso (falta relevar Santander).
4. Warnings de Mongoose por índices duplicados (`email`, `googleId`, `operation_id`, `batch_id`, `migration_id`): ya existían, no rompen nada.

## ING-12 / REV-07 (arreglos del uso real)
- [ ] Abrir en la Bandeja el Mastercard real de octubre: ya no debe decir "Sin explicar" cuando Importado = Total del resumen.
- [ ] Revisar un import con un detalle en "Otros" (ej. COMBUSTIBLE): "Asociar a una categoría…" crea la regla y pasa a esa categoría las demás filas parecidas del mismo import. Probarlo también en el editor de Datos → Cargar.

## DAT (la Bandeja dentro de Datos)
Verificado en dev: pestañas, redirecciones, historial con Origen y Cuenta, revertir una carga de la Bandeja desde el Historial (el documento vuelve a pendiente y el badge sube), Cargar con Santander/Galicia (selects) y carga manual, sin scroll horizontal en 375 px.
- [ ] `/bandeja`, `/datos/bandeja` y `/datos/historial` redirigen a `/datos/cargar` (el historial, con `#historial`); `/migracion` a `/datos/migracion`. Un aviso viejo (link `/datos/bandeja`) lleva a Cargar (UX-05).
- [ ] El menú lateral muestra Inicio, Avisos, Datos (con el badge de pendientes), Inversiones; "Datos" queda marcado en cualquier pestaña.
- [ ] Historial: columna Origen (Bandeja, Mail, Mercado Pago (API), Archivo, Carga manual, Migración Excel, más "automático") y Cuenta; filtro por origen. Las cargas viejas de la Bandeja ya revertidas se ven como "Archivo" (limitación conocida).
- [ ] Cargar un resumen real de Santander con tarjetas a mano en Datos → Cargar (detección, tarjetas, valor del dólar) y guardarlo; verlo en el Historial y revertirlo.
- [ ] Migración desde Excel: elegir el archivo, ver el preview y migrar (se restauraron los handlers de archivo tras un recorte).
- [ ] Revertir una carga de Mail o de Mercado Pago (API) desde el Historial: el documento vuelve a la Bandeja.
- [ ] Riesgo resuelto: el rollback de `routes/operations.js` ahora reabre el documento de la Bandeja (`revertirOperacion`).

## MP · tarjeta de crédito (MP-05 a MP-16, en curso)
- [ ] MP-05: relevar el mail y el PDF del resumen de la tarjeta (ver la fila en `plans/backlog.md`). Desbloquea MP-08 a MP-10.
- [ ] MP-06: correr el probe con tu token (`node src/scripts/mpProbe.js`, mismo comando que en MP-01) y pasar la sección "Tarjeta de crédito": dice si la API trae los consumos o hay que usar el PDF. No imprime montos ni nombres.
- MP-07 está hecho (`utils/pagoTarjeta.js`) pero todavía no se usa en ningún flujo: nada cambia hasta MP-11, que no se mergea antes de MP-09.

## INV (movimientos de Fima desde el extracto de la caja de ahorro)
Verificado en dev (`Mango_dev`, contra la API con un extracto sintético): crear la regla "Cargar en una inversión" (y rechazar un activo inexistente o ajeno), vista previa con "aporte de $50.000 / retiro de $20.000", guardado que crea los 2 movimientos con origen `extracto`, segundo guardado que los detecta como ya cargados, "Valuar ahora" que avisa que faltan cuotapartes (409) y revertir la carga que borra los movimientos. La interfaz (casilla en la revisión y la acción en el formulario de reglas) compila pero no la manejé con clics.
- [ ] INV-01: contestar las 4 preguntas de "Fima en el extracto" en `plans/inversiones.md` mirando un extracto real.
- [ ] Crear en Reglas una regla "detalle contiene FIMA → Cargar en una inversión" (el selector aparece cuando ya tenés al menos una inversión) y subir un extracto real: en la revisión debe aparecer "Cargar en Inversiones · aporte de $X en <activo>".
- [ ] Un aporte que ya cargaste a mano en Inversiones (hasta 3 días de diferencia, mismo monto) debe aparecer como "Ya cargado el DD/MM" y no duplicarse.
- [ ] Importador de Fima (Inversiones → importar): completar las cuotapartes de un movimiento creado desde el extracto (empareja con ±3 días).
- [ ] Revertir la carga desde Datos → Historial: los movimientos sin cuotapartes desaparecen; los que ya tenían cuotapartes quedan en Inversiones como manuales.
- [ ] Activo con precio automático (CAFCI): con un aporte del extracto sin cuotapartes, "Valuar ahora" avisa y el job diario lo salta (`faltan_unidades`).
- Importación automática (ING-10): si la fuente la tiene activa y hay una regla de inversión, el movimiento se crea sin revisión. Frena solo si la inversión no se puede cargar (moneda distinta, activo borrado).
- Conocido: `GaliciaParser.parseCuenta` fija la moneda en ARS; una caja en USD saldría mal (preexistente, no se tocó). Borrar transacciones sueltas o usar `DELETE /api/migrate/:id` no revierte los movimientos del extracto (la UI usa el historial).

## INV-11 · Buscar en extractos ya cargados
Verificado en dev (API sobre `Mango_dev`): sin regla del activo no ofrece nada; con la regla ofrece las transacciones Inversión pendientes, carga solo las elegidas que siguen siendo válidas (ignora ids inventados), un activo ajeno da 404 y los movimientos quedan con origen `extracto` y `transaction_id`, sin `operation_id`. El modal compila pero no lo manejé con clics.
- [ ] Inversiones → detalle de un activo → "Buscar en extractos ya cargados": con una regla "Cargar en una inversión" para ese activo, listar los aportes/rescates viejos del extracto, tildar y cargar.
- [ ] Los ya cargados a mano (±3 días, mismo monto) salen como "ya cargado el DD/MM" y no se tildan.
- Ojo: estos movimientos no tienen operación, así que revertir la carga del extracto desde el Historial **no** los borra; se borran desde el detalle del activo. Quedan sin cuotapartes (completarlas con el importador de Fima antes de valuar solo).

## Antes de deployar a producción (validación final)
**Variables de entorno nuevas en el hosting**
| Variable | Qué hace | Obligatoria |
|---|---|---|
| `SECRETS_KEY` | Clave AES-256-GCM (32 bytes en base64) para el token de Mercado Pago. Tiene que ser propia: la de `nodemon.json` es pública y se rechaza fuera de desarrollo. Si se pierde o se cambia, los secretos guardados no se pueden leer. | Sí, si vas a conectar Mercado Pago (sin ella el server arranca y esa función da error 500) |
| `ADMIN_EMAILS` | Mails (separados por coma) que ven y corren las Tareas programadas. Vacía = nadie. | Sí, si querés ver las tareas |
| `NODE_ENV=production` | Gobierna admin, la clave de dev, las cookies seguras y servir el frontend. Fuera de `development`/`test` todos los chequeos son estrictos. | Sí (ya hacía falta) |
| `ANTHROPIC_API_KEY` | Sugerencias de categoría con IA (REV-06). Manda detalles de movimientos a Anthropic. | No (sin ella la opción queda deshabilitada) |
| `SCHEDULER_ENABLED=false` | Apaga el scheduler. Poner `false` en cualquier proceso local que apunte a la base real. | No |
Ya existentes y necesarias: `MONGODB_URI`, `SESSION_SECRET` (el fallback del código es público), `FRONTEND_URL`, `GOOGLE_*`.

**Tareas programadas que empiezan a correr** (hora de Argentina; una por día; reintentan 3 veces cada 30 min)
| Job | Hora | Qué hace sobre datos reales |
|---|---|---|
| `limpieza-corridas` | 04:00 | Borra el historial de corridas de más de 90 días (solo su propia colección). |
| `mercadopago-sync` | 06:30 | Solo para usuarios con token de MP guardado: deja el reporte en la Bandeja y actualiza el activo "Cuenta remunerada · Mercado Pago". Sin tokens no hace nada. |
| `faltantes-resumenes` | 10:00 | Crea avisos de los resúmenes esperados que no llegaron (solo usuarios con calendario configurado). |
| `valuacion-diaria` | 19:00 | Valúa los activos con precio automático (CAFCI, ticker, cripto, tasa fija); los activos viejos no tienen fuente y quedan fuera. No pisa valuaciones manuales. |
Ninguno modifica `transactions`. Colecciones nuevas (las crea Mongoose al arrancar): `categoryrules`, `fuenteconfigs`, `jobruns`, `notifications`, `secrets`; el único índice nuevo en una colección existente es `InvestmentMovement.operation_id` (no único). Confirmar que mango-py no use esos nombres.

**Riesgos conocidos que quedan (decisión tuya)**
- Mercado Pago: la sync reutiliza un activo ya existente de tipo "Cuenta remunerada" en plataforma "Mercado Pago" y le agrega aportes/retiros automáticos sin deduplicar contra los manuales. Si ya tenés uno cargado a mano, conviene renombrarlo o no conectar MP todavía.
- Importación automática (ING-10) activada: un documento que entra por el token de ingesta se importa sin revisión si todo cierra (opt-in por fuente).
- Al probar el token real de MP en dev, usá un `SECRETS_KEY` propio en `.env`: la de `nodemon.json` es pública y `Mango_dev` está en el mismo cluster.
- "Movimiento interno" se guarda como categoría en `transactions` y se agrega a las categorías del usuario: un lector viejo (mango-py) lo contaría como gasto o ingreso.
- Sugerencias con IA sin tope de pedidos por usuario (opt-in; el costo corre por tu clave).
