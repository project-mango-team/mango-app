# Diseño: ingesta automática de resúmenes (épica ING)

Objetivo: dejar de entrar todos los meses a cada homebanking a generar y cargar los resúmenes uno por uno. Backlog y orden de tickets en [backlog.md](backlog.md).

## Situación actual (oct 2026)

- A principio de mes, cuando cierran las cuentas, el usuario entra a cada homebanking, genera el resumen de cada tarjeta y cuenta, y lo sube a Mango **de a uno**. En cada upload elige el banco, el tipo y las tarjetas y revisa el preview.
- Hoy ningún banco le manda el resumen por mail, pero se puede configurar (falta relevar qué manda cada uno).
- Los PDF de los bancos no tienen contraseña.
- Mango está deployada 24/7, así que puede recibir webhooks y correr jobs.
- La lógica de parseo vive inline en `backend/src/routes/upload.js` (`/preview` y `/` repiten el dispatch por banco). No hay deduplicación de transacciones entre imports.

## Relevamiento por banco (ING-01, en curso)

Lo que manda hoy cada fuente, según los mails que ya le llegaban al usuario (20/10/2026):

| Fuente | Remitente | Asunto | ¿Adjunto? | Datos en el cuerpo | Estado |
|---|---|---|---|---|---|
| Galicia Mastercard | `e-resumen@bancogalicia.com.ar` | "Resumen de Tarjeta MasterCard" | **Sí, PDF** sin contraseña | Vencimiento, total en pesos, total en dólares, pago mínimo | ✅ El `GaliciaParser` actual (`tarjeta`) lo lee tal cual |
| Galicia Visa | `e-resumen@mensajesgalicia.com.ar` | "Resumen de Cuenta VISA" | **No, pero el link sirve**: "Conocer resumen" lleva a `eresumen.com.ar`, que genera el PDF | Vencimiento, saldo en pesos, saldo en dólares, pago mínimo | ⚠️ El PDF de eresumen tiene **otro formato** que el del homebanking (mismos movimientos): el parser actual no lo lee (ING-13). Configurar "Recibir por mail" en Galicia no agrega el adjunto |
| Galicia caja de ahorro | (a confirmar) | "Ya está listo el resumen de tu cuenta" | **No**, ni link: indica descargarlo desde la App u Online Banking | — | Solo aviso → flujo ING-08 (pendiente en la bandeja + subir el XLSX) |
| Santander (tarjetas y cuenta) | — | — | — | — | Falta relevar |
| Mercado Pago | — | — | — | — | Va por API (épica MP) |

Consecuencias para el diseño:
- **Mastercard Galicia queda automática de punta a punta** con ING-06 + ING-07: el adjunto llega, se detecta y se parsea.
- **Visa Galicia puede quedar automática siguiendo el link**: el script toma la URL de "Conocer resumen", la abre y baja el PDF de `eresumen.com.ar`. Falta confirmar (ING-07) que funcione sin sesión iniciada y que `UrlFetchApp` llegue al PDF sin ejecutar JavaScript; si la página arma el PDF con JS, queda como aviso. El link es una credencial: nunca se loguea ni se guarda completo.
- **La caja de ahorro de Galicia va por aviso (ING-08)**: el mail no trae ni adjunto ni link. Queda "pendiente" en la bandeja y el XLSX se sube a mano (detectado solo por ING-03).
- **Los totales del cuerpo del mail sirven de control (ING-12).** En el Mastercard de ejemplo, el parser suma $131.077 en 2 consumos y el mail dice "Total en pesos: 132.649,92". La diferencia ($1.572,92) probablemente sean impuestos o cargos que el parser no toma como consumos; falta verificarlo. Mostrar esa comparación en la revisión ayuda a ver si se perdió algo.

## Idea central

Separar **cómo llega un archivo** de **cómo se procesa**:

```
 Fuentes                         Mango
 ───────                         ─────
 Drag & drop (varios archivos) ─┐
 Mail con adjunto (Apps Script) ─┼─▶ IngestDocument ─▶ Detección ─▶ Parseo ─▶ Dedup ─▶ Bandeja ─▶ Import
 Mail sin adjunto (solo aviso) ─┘     (archivo +         (banco,       (parsers   (contra     (revisar/   (Operation +
                                       metadata)          tipo,         actuales)  lo ya       confirmar)  Transactions,
                                                          tarjetas)                cargado)                rollback igual)
```

Todo termina en el mismo lugar: una **Bandeja** con los documentos pendientes de revisar. Las fuentes nuevas solo crean documentos en la bandeja. Eso permite:

1. **Entregar valor antes de tener el mail resuelto.** Con el drag & drop múltiple y la detección automática, el trabajo del mes pasa de "subir de a uno eligiendo opciones" a "arrastrar todo junto y confirmar".
2. **Sumar fuentes sin tocar el procesamiento** (mail, y en el futuro la API de Mercado Pago).

## Componentes

### 1. Servicio de importación (refactor, ING-02)
`backend/src/services/statementImportService.js`
- `parsearDocumento({ buffer, filename, banco, tipo, opciones, user })` → transacciones. Es el dispatch que hoy está duplicado en `upload.js`.
- `guardarImportacion({ req|user, transacciones, metadata })` → crea la `Operation` y las `Transaction` con `operation_id` (mismo contrato de hoy, el rollback sigue funcionando).
- `upload.js` pasa a usar el servicio. Comportamiento idéntico: se verifica subiendo los fixtures de `docs/` antes y después y comparando la salida.

### 2. Detección automática (ING-03)
`detectarDocumento(buffer, filename)` → `{ banco, tipo, formato, tarjetas?, periodo?, confianza }`
- Firmas por contenido, no por nombre de archivo: textos característicos del PDF o XLSX de cada banco (encabezados, CUIT del banco, "Resumen de cuenta Visa", columnas del extracto). Cada parser expone un `static detectar(texto|filas)`.
- Si la confianza es baja, el documento queda en la bandeja como "No reconocido" para elegir banco y tipo a mano (el flujo de hoy).
- En Santander, las tarjetas se detectan con `detect-cards`, que ya existe, y por defecto quedan todas seleccionadas.
- Cotización USD de las tarjetas: la misma de hoy (`DolarService.getCotizacion()`), editable en la revisión.

### 3. Deduplicación (ING-04)
- Huella por transacción: `fecha + importe (centavos) + moneda + detalle normalizado (mayúsculas, sin espacios dobles ni números de cuota) + origen`.
- En el preview, cada transacción que ya existe para el usuario sale marcada como "ya cargada" y destildada. Se compara contando repeticiones, igual que en el importador de Fima (dos cafés iguales el mismo día no se colapsan en uno).
- A nivel archivo: `sha256` del contenido. Subir dos veces el mismo archivo devuelve el documento existente.

### 4. Bandeja de documentos (ING-05)

**Modelo `IngestDocument`** (user-scoped como todo):
| campo | |
|---|---|
| `user_id` | indexado, multi-tenancy |
| `fuente` | `upload` \| `email` \| `email_aviso` \| `api` |
| `filename`, `mime`, `size`, `sha256` | único por usuario (`{user_id, sha256}`) |
| `contenido` | Binary (los PDF/XLSX pesan menos de 1 MB, entra en un documento de Mongo; si alguno crece, GridFS) |
| `email` | `{ message_id, from, subject, received_at }` si vino por mail; único `{user_id, message_id, filename}` |
| `deteccion` | `{ banco, tipo, tarjetas, periodo, confianza }` |
| `estado` | `recibido` → `listo` (preview armado) → `importado` \| `descartado` \| `error` \| `pendiente_descarga` (aviso sin adjunto) |
| `preview` | resumen: cantidad, duplicados, total de gastos e ingresos (las transacciones se re-parsean al abrir, no se guardan dos veces) |
| `operation_id` | si se importó, link a la operación (rollback desde la bandeja) |
| `error`, `created_at`, `updated_at` | |

El contenido se borra a los N días de importado (configurable): Mango no es un archivo de resúmenes.

**UI**:
- Nueva sección **Bandeja**, con un badge en el menú con la cantidad de documentos `listo`.
- Una zona de drop que acepta varios archivos a la vez. Cada archivo pasa a ser una fila con banco, tipo, período, cantidad de transacciones, duplicados y estado.
- "Revisar" abre el editor de transacciones que ya existe (el de Migración), con los duplicados marcados. "Importar" guarda. "Descartar" lo saca de la bandeja.
- "Importar todos los listos" sirve para los meses tranquilos.
- Migración queda para cargas manuales y para el historial y rollback.

### 5. Entrada por mail (ING-06, ING-07)

**Opción elegida: Google Apps Script en la cuenta de Gmail del usuario → webhook de Mango.**

```
Gmail ──(filtro: from banco → label "Mango/Resumenes")──▶ Apps Script (trigger cada 1 h)
   └─ por cada hilo con el label y sin "Mango/Procesado":
        ├─ adjuntos PDF/XLSX/CSV ─▶ POST /api/ingest/documents (Bearer token)
        ├─ sin adjuntos          ─▶ POST /api/ingest/avisos   (from, subject, fecha)
        └─ label "Mango/Procesado" (o "Mango/Error" + motivo)
```

Por qué Apps Script y no Gmail API desde el backend:
- Corre con la cuenta del usuario, sin pantalla de consentimiento ni verificación de Google. `gmail.readonly` es un scope restringido, y una app en modo Testing pierde el refresh token cada 7 días.
- Mango no guarda credenciales de Gmail; solo recibe lo que el script le manda.
- Los filtros y labels de Gmail le dejan al usuario el control de qué mails ve el script.
- La contra es que hay que instalarlo a mano una vez (pegar el script, poner el token, autorizar). Va con un instructivo paso a paso en `docs-ingesta/` o en la UI.

Alternativa descartada por ahora: reenviar los mails a una dirección de Mango (Cloudflare Email Workers, Mailgun inbound). Agrega infraestructura y DNS.

**Autenticación del webhook — API tokens personales (ING-06)**:
- El usuario genera un token en Mango (Configuración → "Tokens de integración"). Se muestra una sola vez y se guarda solo su hash (`sha256`) con un nombre, la fecha de creación y el último uso.
- `requireApiToken` middleware: `Authorization: Bearer mango_xxx` → busca el hash → `req.user`. Así las rutas de ingesta siguen usando `buildUserQuery(req)` sin cambios.
- Scope del token: solo `/api/ingest/*`. No sirve para leer datos.
- Rate limit simple por token y tamaño máximo de 10 MB por archivo (igual que el upload).

**Endpoints**:
```
POST /api/ingest/documents   multipart: file + metadata(json: message_id, from, subject, received_at)
                             → 201 {documento} | 200 {documento existente} (idempotente por message_id+filename o sha256)
POST /api/ingest/avisos      json: {message_id, from, subject, received_at} → crea IngestDocument estado pendiente_descarga
```
Al recibir un documento, el backend lo detecta y lo parsea en el momento (son pocos y chicos; no hace falta una cola) y lo deja `listo` o en `error`.

### 6. Avisos y recordatorios (ING-08, ING-09)
- **Aviso sin adjunto** (el banco solo manda "tu resumen está disponible"): queda en la bandeja como "Pendiente de descargar · Visa Galicia · octubre", con un link al homebanking guardado por fuente. Cuando se sube el archivo que coincide (mismo banco, tipo y período), el aviso se cierra solo.
- **Calendario de cierres**: por fuente (Visa Galicia, Master Galicia, Santander Visa/Amex, cajas Galicia y Santander, MP) se configura qué día del mes cierra y cómo llega (mail con adjunto, aviso o descarga manual). Un job diario (PLAT-01) marca como faltantes los que deberían haber llegado y no llegaron. Así la bandeja también es un checklist del mes.

### 7. Importación automática (ING-10, opcional)
Opt-in por fuente: si el documento se detecta con confianza alta, no tiene duplicados dudosos y todas las transacciones tienen categoría (o pasan por las reglas de la épica REV), se importa solo y queda en la bandeja como "Importado automáticamente" con un botón para deshacer (rollback). Viene después de la épica REV, para que importar solo no signifique importar mal categorizado.

## Seguridad y multi-tenancy
- Todo se filtra por `user_id`: `IngestDocument` usa `buildUserQuery` y `addUserToData`, y las rutas de UI usan `requireAuth`. Las rutas de ingesta usan `requireApiToken`, que setea `req.user`.
- Los tokens se guardan hasheados, se pueden revocar y tienen scope solo de ingesta.
- Se valida el tipo de archivo (PDF/XLSX/CSV/TXT por magic bytes, no por extensión) y el tamaño.
- Los documentos de `docs/` se siguen usando solo como fixtures locales y nunca se commitean.

## Riesgos y preguntas abiertas
| | Mitigación |
|---|---|
| No sabemos qué banco manda el resumen adjunto y cuál solo un link | ING-01 (relevamiento) antes del Apps Script. La bandeja y el drag & drop rinden igual. |
| Los PDF por mail pueden venir con contraseña aunque los del homebanking no | Si pasa, guardar la contraseña por fuente cifrada (PLAT-03) y pasársela a pdf-parse. |
| El formato del PDF cambia y el parser o la detección fallan | El documento queda en `error` con el motivo y se puede reintentar después de arreglar el parser. Nunca se pierde el archivo. |
| Duplicados entre fuentes (por ejemplo, avisos de consumo y después el resumen) | La deduplicación por huella de ING-04. Los avisos de consumo quedan fuera de esta épica (ING-11, spike). |
| Apps Script deja de correr (cuota, permisos revocados) | El calendario de cierres (ING-09) avisa que faltan resúmenes aunque el script esté caído. |

## Cómo se valida cada ticket
- Tests con Vitest para lo puro: detección por firmas, huella de dedup, idempotencia y autenticación por token. Los fixtures son extractos sintéticos con el formato de cada banco, nunca datos reales.
- Prueba manual con `npm run dev` y el usuario invitado: subir los archivos de `docs/` por la bandeja y comparar con el flujo actual de Migración.
- El Apps Script se prueba primero contra el entorno local con ngrok o similar, y después contra el deploy.
