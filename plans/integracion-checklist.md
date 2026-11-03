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
1. **Posible ReDoS** en `backend/src/utils/categoryRules.js` (`compilarRegex`, viene de REV-02): el usuario guarda una regex y se compila/evalúa en el proceso del backend. El único límite es `MAX_REGEX = 200` caracteres, que no frena patrones como `(a+)+$`. Una regex así bloquea el event loop en cada importación. *Arreglo propuesto (no aplicado)*: rechazar al validar patrones con cuantificadores anidados o alternancias repetidas, o evaluar con un motor sin backtracking (`re2`), o correr las reglas en un worker con timeout; además limitar el largo del detalle evaluado.
2. **`routes/operations.js` no llama a `reabrirPorRollback`** en `POST /:operationId/rollback` (sí lo hace `routes/upload.js:333`). Revertir una carga desde Datos deja el documento de la Bandeja como importado y no se puede volver a importar. *Arreglo propuesto*: agregar `await reabrirPorRollback(req, operation.operation_id)` después de `restaurarContrapartes`.
3. ING-01 sigue en curso (falta relevar Santander).
4. Warnings de Mongoose por índices duplicados (`email`, `googleId`, `operation_id`, `batch_id`, `migration_id`): ya existían, no rompen nada.

## ING-12 / REV-07 (arreglos del uso real)
- [ ] Abrir en la Bandeja el Mastercard real de octubre: ya no debe decir "Sin explicar" cuando Importado = Total del resumen.
- [ ] Revisar un import con un detalle en "Otros" (ej. COMBUSTIBLE): "Asociar a una categoría…" crea la regla y pasa a esa categoría las demás filas parecidas del mismo import. Probarlo también en el editor de Datos → Cargar.

## DAT (la Bandeja dentro de Datos)
Verificado en dev: pestañas, redirecciones, historial con Origen y Cuenta, revertir una carga de la Bandeja desde el Historial (el documento vuelve a pendiente y el badge sube), Cargar con Santander/Galicia (selects) y carga manual, sin scroll horizontal en 375 px.
- [ ] `/bandeja` y `/migracion` redirigen a `/datos/bandeja` y `/datos/migracion`; un aviso viejo (guardado con link `/bandeja`) lleva a la Bandeja.
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
