import IngestDocument from '../models/IngestDocument.js';
import { CATEGORIA_INTERNO } from '../models/User.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { esPagoTarjetaGalicia, emparejarPagosConResumenes } from '../utils/pagoTarjetaGalicia.js';

/**
 * PUL-08: marca los pagos de la tarjeta Galicia de una importación de caja de ahorro.
 * - Con el resumen de esa tarjeta ya importado (mismo total): categoría Movimiento interno y `pago_tarjeta.estado: 'cubierto'`
 *   con a qué resumen corresponde.
 * - Sin el resumen: `pago_tarjeta.estado: 'pendiente'` y la categoría no se toca.
 * Solo consulta la base si hay algún pago de tarjeta; todo filtrado por usuario. Los datos de `pago_tarjeta` son solo
 * para mostrar en la revisión: no se guardan en la transacción.
 */
export const marcarPagosTarjeta = async (req, transactions) => {
  if (!transactions.some(t => t?.tipo === 'Gasto' && t.origen === 'Banco Galicia' && esPagoTarjetaGalicia(t.detalle))) return transactions;

  const docs = await IngestDocument.find(buildUserQuery(req, {
    estado: 'importado',
    operation_id: { $nin: [null, ''] },
    'deteccion.tipo': 'galicia',
    'deteccion.tipoResumen': 'tarjeta'
  })).select('filename operation_id deteccion.producto deteccion.cierre deteccion.totales.total').lean();

  const resumenes = docs
    .map(d => ({
      ingest_document_id: String(d._id),
      operation_id: d.operation_id,
      filename: d.filename,
      producto: d.deteccion?.producto ?? null,
      cierre: d.deteccion?.cierre ?? null,
      total: Number(d.deteccion?.totales?.total?.ars)
    }))
    .filter(r => r.total > 0);

  const pares = emparejarPagosConResumenes(transactions, resumenes);
  return transactions.map((t, i) => {
    const par = pares[i];
    if (!par) return t;
    if (par.estado === 'pendiente') return { ...t, pago_tarjeta: par };
    // Solo se neutraliza si todavía no tiene una categoría propia (Otros): lo que decidió una regla se respeta
    const categoria = !t.categoria || t.categoria === 'Otros' ? CATEGORIA_INTERNO : t.categoria;
    return { ...t, categoria, pago_tarjeta: par };
  });
};
