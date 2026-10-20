# Handoff · estado al 20/10/2026

Documento para retomar en una sesión nueva. El plan vive en [backlog.md](backlog.md) (épicas y tickets con estado) y el diseño de la épica actual en [ingesta-resumenes.md](ingesta-resumenes.md). Este archivo cuenta lo que no está ahí: dónde quedamos, qué sigue y lo que se aprendió en el camino.

## Dónde quedamos

**Épica ING (ingesta automática de resúmenes)** — la base está completa y en uso real:
- ✅ ING-02 servicio de importación · ING-03 detección automática · ING-04 duplicados · ING-05 Bandeja · ING-06 tokens + webhook · ING-07 script de Gmail · ING-13 parser Visa eresumen.
- 🟡 ING-01 relevamiento: Galicia está relevado (Mastercard trae el PDF adjunto; Visa trae un link a eresumen.com.ar que baja el PDF sin login; la caja de ahorro solo manda un aviso). **Falta Santander.**
- ⬜ Pendientes de la épica: ING-08 (avisos sin adjunto: link al homebanking y cerrar el aviso al subir el archivo), ING-12 (control de totales contra el total del mail/resumen), ING-09 (calendario de cierres, necesita PLAT-01), ING-10 (importación automática, necesita REV-02), ING-11 (spike de avisos de consumo).

**Script de Gmail instalado** en la cuenta del usuario, apuntando a https://projectmango.app. Corre todos los días a las 9 y procesa mails con la etiqueta `Mango/Resumenes` desde `MANGO_DESDE`. Lo probó con los resúmenes de octubre: entraron el Mastercard (adjunto) y el Visa (bajado del link). El Mastercard de octubre quedó **descartado** en la Bandeja; el Visa se importó.

**Otras cosas hechas en la misma tanda** (ya en `main` y deployadas por el usuario):
- Épica de Inversiones completa (Portfolio, Rendimientos con Modified Dietz, Préstamos, importador de Fima, euro equivalente al blue). Diseño en [inversiones.md](inversiones.md).
- Toggle ARS/USD en Inicio: convierte cada transacción con el blue de su fecha al leer; no guarda nada.
- Corrección de datos (pedida por el usuario): los 5 consumos en reales del Visa de septiembre, que el bug viejo había guardado en ARS, se reemplazaron por los correctos en USD.

## Qué sigue (recomendado)

1. **ING-08** y **ING-12**: completan la experiencia mensual de la Bandeja.
2. **Épica REV**, empezando por REV-01 (movimiento interno) → REV-02 (reglas) → REV-03 (aprender de correcciones). Es la otra mitad del tiempo que le lleva cada mes al usuario. Ejemplo concreto: "LSH BARRA HOTEL" cae en Comida por la keyword "BARRA".
3. ING-01 Santander, cuando el usuario mire esos mails.

## Lo que hay que saber para trabajar

**Entorno y datos**
- `npm run dev` usa la base **`Mango_dev`** (lo fija `backend/nodemon.json`). Producción usa `Mango` en el mismo cluster de Atlas. Hasta el 20/10 dev compartía `Mango`.
- Un script corrido con `node -r dotenv/config` **sin nodemon** apunta a `Mango`, es decir, a los datos reales del usuario. Solo para lo que el usuario pida; antes de escribir, ensayo en modo lectura y respaldo.
- Login sin Google en dev: botón "Entrar como invitado (solo dev)" o `POST /api/auth/dev-login` (usuario `guest@mango.local`). Solo existe con nodemon, `NODE_ENV` distinto de production y conexión desde localhost.
- Para probar contra la API desde Node: `fetch(.../api/auth/dev-login)` y reusar la cookie `connect.sid` de la respuesta.
- No leer `backend/.env`. Los resúmenes reales están en `D:\Descargas\Docs\Finanzas\Gastos\Resumenes\` (y `docs/`): usarlos solo como fixtures locales; los tests usan datos sintéticos.

**Validación**
- `npm test` (Vitest, en backend): 92 tests. Los del script de Gmail cargan el `.gs` real en un contexto `vm` con Gmail y `UrlFetchApp` simulados.
- Regresión de parsers: comparar la salida de `/upload/preview` para todos los resúmenes reales antes y después del cambio (lo hicimos en ING-02, ING-03 e ING-13; hasta ahora iguales salvo cambios esperados).
- El usuario revisa la UI y que funcione; mandarle capturas o el texto de la página. El panel del navegador puede estar oculto: entonces usar `get_page_text`, porque `screenshot` falla y Recharts no dibuja.

**Trampas que ya nos pasaron**
- **Barras invertidas en scripts inline**: dentro de `node - <<'EOF'` con template literals, `\d` se pierde (y `\b` se convierte en un carácter de retroceso). Para regex, editar con la herramienta Edit o escribir el archivo con Write.
- **`String.replace` con `$'`** en el reemplazo (por ejemplo `'US$'`) inserta el resto del string. Usar `split/join` o Edit.
- Los archivos tienen finales de línea mixtos (CRLF/LF): al editar por script, normalizar a `\n` y restaurar.
- Multer decodifica los nombres de archivo como Latin-1: usar `nombreArchivo(file)` (`backend/src/utils/uploadFilename.js`).
- Galicia repite la fecha de compra en cada cuota: la huella de duplicados **mantiene** el "Cuota NN/MM".

**Convenciones del usuario** (ver también `CLAUDE.md` y la memoria)
- Proyecto personal: commits directos en `main`, sin rama ni PR por ticket. Al cerrar un ticket se marca `hecho` en `backlog.md` en el mismo commit.
- Textos de la UI y mensajes en español rioplatense. `Inicio.jsx` y `Datos.jsx` son grandes: extraer componentes y hooks en vez de sumarles código.
- Seguridad: los tokens de integración solo suben documentos (el webhook responde solo `_id` y `estado`) y nunca se loguean links ni tokens.

## Archivos clave de la épica ING
- Backend: `services/statementImportService.js` (parseo, detección, duplicados, guardado), `services/ingestService.js` (Bandeja), `models/IngestDocument.js`, `models/ApiToken.js`, `middleware/apiToken.js`, `controllers/{bandeja,ingest,token}Controller.js`, `utils/transactionDedup.js`, `parsers/*` (cada uno con `static detectar`).
- Frontend: `pages/Bandeja.jsx` + `components/bandeja/*`, `hooks/useBandeja*.js`, `pages/Configuracion.jsx` (tokens), `components/TransactionEditor.jsx` (filas duplicadas), `hooks/useDeteccionResumen.js` (Datos).
- Integración: `integrations/gmail-apps-script/` (`Mango.gs` + README de instalación).
