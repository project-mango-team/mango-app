// Canal por el que entró una carga (DAT-02), para la columna "Origen" del historial.
// Las operaciones nuevas lo traen guardado; las viejas se deducen al leer, sin escribir en la base.

export const CANALES = ['manual', 'archivo', 'bandeja', 'mail', 'api', 'migracion'];

const CANAL_DE_FUENTE = { upload: 'bandeja', email: 'mail', email_aviso: 'mail', api: 'api' };

export const canalDeFuente = (fuente) => CANAL_DE_FUENTE[fuente] || 'bandeja';

/**
 * @param {Object} op - Operation (o su lean)
 * @param {Object|null} ingestDoc - IngestDocument cuyo operation_id es el de la operación, si hay
 * @returns {{ canal: string, automatica: boolean, ingest_document_id: string|null }}
 */
export const canalDeOperacion = (op, ingestDoc = null) => {
  const documento = ingestDoc?._id ? String(ingestDoc._id) : (op.ingest_document_id ? String(op.ingest_document_id) : null);
  if (op.canal) return { canal: op.canal, automatica: Boolean(op.automatica), ingest_document_id: documento };
  if (op.type === 'migration') return { canal: 'migracion', automatica: false, ingest_document_id: null };
  if (op.metadata?.tipo === 'manual') return { canal: 'manual', automatica: false, ingest_document_id: null };
  if (ingestDoc) {
    return { canal: canalDeFuente(ingestDoc.fuente), automatica: Boolean(ingestDoc.auto_importado), ingest_document_id: documento };
  }
  return { canal: 'archivo', automatica: false, ingest_document_id: null };
};
