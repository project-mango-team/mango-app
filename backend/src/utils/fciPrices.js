// Precios de FCI del reporte diario de la CAFCI (publicado por argentinadatos.com).
// Funciones puras: no tocan la red.

/**
 * Texto sin tildes, en minúsculas y con espacios simples, para comparar nombres de fondos
 */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Valor de UNA cuotaparte. La CAFCI publica el valor cada 1.000 cuotapartes (vcp).
 * @param {{ vcp: number }} fila
 * @returns {number|null}
 */
export const precioCuotaparte = (fila) => {
  const vcp = Number(fila?.vcp);
  // Redondeo a 9 decimales para sacar el ruido de la división (vcp trae hasta 3 o 6 decimales)
  return Number.isFinite(vcp) && vcp > 0 ? Math.round(vcp * 1e6) / 1e9 : null;
};

/**
 * Pasa una fila del reporte al formato de Mango
 * @returns {{ nombre: string, categoria: string, horizonte?: string, fecha: string, precio: number|null }}
 */
export const filaAFondo = (fila, categoria) => ({
  nombre: fila.fondo,
  categoria,
  horizonte: fila.horizonte,
  fecha: fila.fecha,
  precio: precioCuotaparte(fila)
});

/**
 * Busca fondos cuyo nombre contenga todas las palabras de la consulta (sin importar tildes ni mayúsculas)
 * @param {Array<{ nombre: string }>} fondos
 * @param {string} consulta
 * @param {number} [limite]
 */
export const buscarFondos = (fondos, consulta, limite = 20) => {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return [];
  return fondos
    .filter(f => f.precio !== null)
    .filter(f => {
      const nombre = normalizar(f.nombre);
      return palabras.every(p => nombre.includes(p));
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite);
};

/**
 * Fondo con ese nombre exacto (sin importar tildes, mayúsculas ni espacios) o null
 */
export const encontrarFondo = (fondos, nombre) => {
  const buscado = normalizar(nombre);
  return fondos.find(f => normalizar(f.nombre) === buscado && f.precio !== null) || null;
};
