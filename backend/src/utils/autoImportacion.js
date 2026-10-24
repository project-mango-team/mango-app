// Importación automática opt-in (ING-10): decide si un documento listo puede importarse sin revisión.
// Es deliberadamente estricta: ante cualquier duda, el documento queda en la bandeja para revisar.

const SIN_CATEGORIA = 'Otros';
// Diferencia tolerada contra el total del resumen, en pesos / dólares (redondeos)
const TOLERANCIA_CONTROL = 1;

/**
 * @param {Object} params
 * @param {Object} params.deteccion - resultado de detectarDocumento
 * @param {Array} params.transacciones - ya con duplicados, reglas e internos sugeridos
 * @param {Object|null} params.control - compararTotales (null si el resumen no trae totales)
 * @param {Object|null} params.archivoYaImportado
 * @returns {{ ok: boolean, motivos: string[] }} motivos: por qué NO se importa solo
 */
export const evaluarAutoImportacion = ({ deteccion, transacciones = [], control = null, archivoYaImportado = null }) => {
  const motivos = [];
  if (!deteccion?.soportado || deteccion.confianza !== 'alta') motivos.push('La detección del resumen no es de confianza alta');
  if (archivoYaImportado) motivos.push('Este archivo ya se había importado');

  const duplicadas = transacciones.filter(t => t.duplicado).length;
  if (duplicadas > 0) motivos.push(`Hay ${duplicadas} transacciones que ya estaban cargadas`);

  const aImportar = transacciones.filter(t => !t.duplicado && !t.ignorada);
  if (aImportar.length === 0) motivos.push('No hay transacciones nuevas');

  const sinCategoria = aImportar.filter(t => !t.categoria || t.categoria === SIN_CATEGORIA).length;
  if (sinCategoria > 0) motivos.push(`${sinCategoria} transacciones sin categoría`);

  const internos = aImportar.filter(t => t.interno_sugerido).length;
  if (internos > 0) motivos.push(`${internos} posibles movimientos internos para confirmar`);

  // Las tarjetas traen el total del resumen: si no se pudo leer, el parseo puede estar incompleto
  const esTarjeta = ['visa', 'mastercard', 'amex'].includes(deteccion?.producto);
  if (esTarjeta && !control) motivos.push('No se pudo leer el total del resumen para compararlo');

  const sinExplicar = [control?.ars?.sin_explicar, control?.usd?.sin_explicar].filter(n => Number.isFinite(n));
  if (sinExplicar.some(n => Math.abs(n) > TOLERANCIA_CONTROL)) motivos.push('El total importado no coincide con el del resumen');

  return { ok: motivos.length === 0, motivos };
};
