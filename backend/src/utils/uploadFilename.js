/**
 * Nombre original de un archivo subido con multer.
 * Multer (busboy) interpreta el nombre como Latin-1, así que "Último" llega como "Ãltimo":
 * se lo vuelve a leer como UTF-8 si eso da un texto válido.
 * @param {{ originalname?: string }} file
 */
export const nombreArchivo = (file) => {
  const original = file?.originalname || '';
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  return utf8.includes('�') ? original : utf8;
};
