# Plan · la Bandeja pasa a ser parte de Datos (épica DAT, para elegir antes de implementar)

Resumen del diseño del `architect`. Nada de esto está implementado.

**Navegación (recomendado: rutas anidadas).** `/datos` es el layout con pestañas Bandeja | Cargar | Historial | Migración y redirige a `/datos/bandeja`. `/bandeja` → `/datos/bandeja` y `/migracion` → `/datos/migracion`, redirecciones permanentes (cubren favoritos y avisos guardados). Menú lateral: se van Bandeja y Migración; "Datos" lleva el badge de pendientes. `Layout.isActive` pasa a `pathname === path || startsWith(path + '/')`. Alternativas descartadas: `?tab=` y pestañas en estado local (sin deep links).

**Historial unificado.** `Operation.origen` ya es la cuenta, así que el canal va en campos nuevos sin `default` (para no etiquetar mal lo viejo): `canal` (manual | archivo | bandeja | mail | api | migracion), `automatica`, `ingest_document_id`. Se rellenan al crear (`guardarImportacion`, `upload.js`, `migrate.js`, `ingestService.importarDocumento`). Las operaciones viejas se deducen al leer con una función pura `canalDeOperacion(op, ingestDoc)` (sin escribir en la base); `GET /api/operations` enriquece con una consulta a `IngestDocument` filtrada por usuario. Limitación: una operación vieja de la Bandeja ya revertida se ve como "Archivo". La columna "Origen" actual pasa a llamarse "Cuenta".

**Componentes.** `Datos.jsx` queda como layout; su contenido va a `components/datos/CargarTab.jsx` (sin historial ni rollback); `Bandeja.jsx` → `BandejaTab.jsx`; `Migracion.jsx` → `MigracionTab.jsx`; nuevos `HistorialTab`, `HistorialCargasTable`, `OrigenCarga`, `hooks/useHistorialCargas.js`. Backend: `services/operationService.js` con `revertirOperacion` (borra transacciones → `restaurarContrapartes` → `rolled_back` → `reabrirPorRollback` en try/catch). La API `/api/bandeja` no se renombra.

**Links y avisos.** `LINK_BANDEJA = '/datos/bandeja'` en `utils/notificaciones.js`, `jobs/faltantesResumenes.js` y `utils/mercadoPagoSync.js` (+ asserts de tests). Las notificaciones guardadas no se migran: las cubre la redirección. El Apps Script no tiene URLs del frontend; solo cambia el texto del README. Textos "la Bandeja (en Datos)" en `TokensIntegracion.jsx` y `CuentaMercadoPago.jsx`.

**Riesgos.** Deep links viejos (redirecciones); revertir desde el historial deja el documento `importado` (DAT-01 primero; es el bug de `routes/operations.js` que ya figura en el checklist); reparseo que falla tras borrar (try/catch); fuga entre usuarios (`buildUserQuery` también en la consulta a `IngestDocument`).

**Tickets** (orden DAT-01 → 02 → 03 → 04 → 06 → 05):
| ID | Ticket | Dep. | Tam. |
|---|---|---|---|
| DAT-01 | `revertirOperacion` usado por `operations.js` y `upload.js`; `bandejaService.deshacer` → `/operations/:id/rollback` | — | S |
| DAT-02 | Campos `canal`/`automatica`/`ingest_document_id`, `canalDeOperacion` + tests, `GET /operations` enriquecido | — | M |
| DAT-03 | Datos como layout con pestañas y rutas anidadas, redirecciones, menú y badge; mover Bandeja/Migración/Cargar a tabs; `HistorialTab` con la tabla actual | DAT-01 | M |
| DAT-04 | Columna Origen, Cuenta, filtro, aviso "volvió a la Bandeja" al revertir | DAT-02, 03 | S |
| DAT-05 | Achicar `CargarTab` (hook + `FormularioResumen`, sacar código inalcanzable) | DAT-03 | M |
| DAT-06 | `LINK_BANDEJA`, textos, README del script, docs | DAT-03 | S |

Idea suelta, no recomendada ahora: dejar Cargar solo para carga manual (riesgo: perder el flujo de Santander con tarjetas a mano).
