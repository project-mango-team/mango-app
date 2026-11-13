import IngestDocument from '../models/IngestDocument.js';
import { CATEGORIA_INTERNO } from '../models/User.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { emparejarPagosConResumenes, reconocerPagoGalicia, reconocerPagoMP } from '../utils/pagoTarjetaGalicia.js';

// Cada cuenta se empareja con los resúmenes de su propio banco: caja de ahorro de Galicia ↔ tarjetas Visa/Mastercard
// Galicia, cuenta de Mercado Pago ↔ tarjeta de Mercado Pago (MP-11)
const GRUPOS = [
  { tipo: 'galicia', banco: 'Galicia', reconocer: reconocerPagoGalicia },
  { tipo: 'mercadopago', banco: 'Mercado Pago', reconocer: reconocerPagoMP }
];

/**
 * PUL-08: marca los pagos de la tarjeta Galicia de una importación de caja de ahorro.
 * - Con el resumen de esa tarjeta ya importado (mismo total): categoría Movimiento interno y `pago_tarjeta.estado: 'cubierto'`
 *   con a qué resumen corresponde.
 * - Sin el resumen: `pago_tarjeta.estado: 'pendiente'` y la categoría no se toca.
 * Solo consulta la base si hay algún pago de tarjeta; todo filtrado por usuario. Los datos de `pago_tarjeta` son solo
 * para mostrar en la revisión: no se guardan en la transacción.
 */
export const marcarPagosTarjeta = async (req, transactions) => {
  const activos = GRUPOS.filter(g => transactions.some(t => g.reconocer(t)));
  if (!activos.length) return transactions;

  const docs = await IngestDocument.find(buildUserQuery(req, {
    estado: 'importado',
    operation_id: { $nin: [null, ''] },
    'deteccion.tipo': { $in: activos.map(g => g.tipo) },
    'deteccion.tipoResumen': 'tarjeta'
  })).select('filename operation_id deteccion.tipo deteccion.producto deteccion.cierre deteccion.totales.total').lean();

  const resumenes = docs
    .map(d => ({
      tipo: d.deteccion?.tipo,
      ingest_document_id: String(d._id),
      operation_id: d.operation_id,
      filename: d.filename,
      producto: d.deteccion?.producto ?? null,
      cierre: d.deteccion?.cierre ?? null,
      total: Number(d.deteccion?.totales?.total?.ars)
    }))
    .filter(r => r.total > 0);

  // Una pasada por banco: cada uno empareja solo con sus resúmenes
  const paresPorGrupo = activos.map(g => ({
    g,
    pares: emparejarPagosConResumenes(transactions, resumenes.filter(r => r.tipo === g.tipo), { reconocer: g.reconocer })
  }));
  return transactions.map((t, i) => {
    const hallado = paresPorGrupo.find(({ pares }) => pares[i]);
    const par = hallado?.pares[i];
    if (!par) return t;
    if (par.estado === 'cubierto') par.resumen = { ...par.resumen, banco: hallado.g.banco };
    if (par.estado === 'pendiente') return { ...t, pago_tarjeta: par };
    // Solo se neutraliza si todavía no tiene una categoría propia (Otros): lo que decidió una regla se respeta
    const categoria = !t.categoria || t.categoria === 'Otros' ? CATEGORIA_INTERNO : t.categoria;
    return { ...t, categoria, pago_tarjeta: par };
  });
};
