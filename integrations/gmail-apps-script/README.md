# Mango · resúmenes desde Gmail

Script de Google Apps Script que corre en tu cuenta de Gmail y manda a la **Bandeja** de Mango los resúmenes que te llegan por mail. No hay que mantener ningún servidor: Google lo ejecuta cada hora.

Qué hace con cada mail que tenga la etiqueta `Mango/Resumenes`:

| El mail trae... | Qué pasa |
|---|---|
| Un PDF, XLSX, CSV o TXT adjunto (ej. Mastercard Galicia) | Lo sube a la Bandeja, que lo detecta y lo deja listo para importar |
| Un botón "Conocer resumen" (ej. Visa Galicia) | Abre el link, baja el PDF de eresumen.com.ar y lo sube |
| Solo un aviso, sin archivo (ej. caja de ahorro Galicia) | Lo registra en la Bandeja como "Falta el archivo" |

Después etiqueta el hilo `Mango/Procesado`, o `Mango/Error` si algo falló, así no se procesa dos veces. Aunque lo procese de nuevo, Mango no duplica nada.

## Instalación (una sola vez, ~10 minutos)

### 1. Crear un token en Mango
Mango → menú de tu usuario (abajo a la izquierda) → **Configuración** → *Tokens de integración* → nombre "Script de Gmail" → **Crear token** → copialo. Se muestra una sola vez.

El token solo sirve para subir resúmenes a la Bandeja: no permite leer tus datos. Si se filtra, revocalo desde la misma pantalla.

### 2. Etiquetar los mails de resúmenes en Gmail
En Gmail, creá un filtro (lupa → *Mostrar opciones de búsqueda*):

- **De:** `e-resumen@bancogalicia.com.ar OR e-resumen@mensajesgalicia.com.ar`
- **Crear filtro** → ✅ *Aplicar la etiqueta* → *Nueva etiqueta* → `Mango/Resumenes` (es decir, la etiqueta `Resumenes` anidada en `Mango`).
- Opcional: ✅ *Aplicar también a las conversaciones que coinciden*. Si lo tildás, se procesan también los resúmenes viejos. La Bandeja marca lo que ya estaba cargado, así que no duplica, pero vas a tener que descartarlos.

Cuando sepas el remitente de otros bancos (Santander, el aviso de la caja de ahorro), agregalo al mismo filtro.

### 3. Crear el script
1. Entrá a [script.google.com](https://script.google.com) con la misma cuenta de Gmail → **Nuevo proyecto**.
2. Ponele de nombre "Mango resúmenes".
3. Borrá el contenido de `Código.gs` y pegá todo el contenido de [`Mango.gs`](Mango.gs). Guardá.
4. **Configuración del proyecto** (engranaje) → *Propiedades del script* → agregá:
   - `MANGO_URL` = la dirección de tu Mango, sin barra al final (ej. `https://mi-mango.com`)
   - `MANGO_TOKEN` = el token del paso 1

### 4. Activarlo
1. Volvé al editor, elegí la función **`configurar`** en el selector de arriba y tocá **Ejecutar**.
2. Google te pide permisos: leer y etiquetar tu Gmail, conectarse a servicios externos (Mango y eresumen.com.ar) y ejecutarse de forma programada.
   Va a aparecer *"Google no verificó esta app"*: es normal porque el script es tuyo. Tocá **Configuración avanzada → Ir a Mango resúmenes (no seguro) → Permitir**.
3. En el registro tiene que aparecer `Conexión con Mango OK` y `Listo: cada hora se van a mandar...`.

Listo. Para probarlo sin esperar, ejecutá **`procesarResumenes`** y mirá la Bandeja de Mango.

## Si algo no anda

- **Ver qué pasó:** en script.google.com → *Ejecuciones* (ícono de lista) aparece cada corrida con su registro.
- **Hilo con la etiqueta `Mango/Error`:** el registro dice el asunto y el motivo. Corregí el problema, sacale la etiqueta `Mango/Error` al hilo y se vuelve a intentar en la próxima corrida.
- **"Mango respondió 401":** el token es incorrecto o está revocado. Creá uno nuevo y actualizá `MANGO_TOKEN`.
- **Visa llega como "Falta el archivo" y el registro dice "el link no devolvió un PDF":** eresumen.com.ar cambió y ahora arma el PDF en el navegador. Avisá para adaptar el script. Mientras tanto, bajalo del link y soltalo en la Bandeja.
- **Pausarlo:** en *Activadores* (ícono de reloj) borrá el de `procesarResumenes`. Para reactivarlo, ejecutá `configurar` de nuevo.

## Privacidad
- El script corre en tu cuenta de Google; Mango nunca ve tu Gmail, solo lo que el script le manda.
- Solo lee los hilos con la etiqueta `Mango/Resumenes`.
- El link de "Conocer resumen" funciona como una llave a tu resumen: el script lo usa solo para bajar el PDF y nunca lo escribe en el registro.

## Actualizar el script
Cuando cambie `Mango.gs` en el repo, volvé a pegarlo entero en el editor y guardá. Las propiedades y el activador se mantienen.
