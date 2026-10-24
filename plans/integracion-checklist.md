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
