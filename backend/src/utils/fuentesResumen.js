// Fuentes de resúmenes (banco + producto) y cómo se emparejan los avisos sin archivo (ING-08)
// con el archivo que el usuario sube después.

const HOMEBANKING = {
  galicia: 'https://onlinebanking.bancogalicia.com.ar/',
  santander: 'https://www.santander.com.ar/',
  mercadopago: 'https://www.mercadopago.com.ar/activities'
};

export const FUENTES = {
  galicia_caja_ahorro: { banco: 'galicia', nombre: 'Galicia · caja de ahorro' },
  galicia_visa: { banco: 'galicia', nombre: 'Visa Galicia' },
  galicia_mastercard: { banco: 'galicia', nombre: 'Mastercard Galicia' },
  santander_visa: { banco: 'santander', nombre: 'Visa Santander' },
  santander_amex: { banco: 'santander', nombre: 'Amex Santander' },
  mercadopago_cuenta: { banco: 'mercadopago', nombre: 'Mercado Pago' }
};

// Un aviso se cierra con un archivo cuyo cierre caiga entre 20 días antes y 15 días después del mail
// (el banco avisa a los pocos días del cierre; el extracto de la cuenta puede bajarse con unos días de más)
const DIAS_ANTES_DEL_MAIL = 20;
const DIAS_DESPUES_DEL_MAIL = 15;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Fuente de un archivo detectado (galicia_visa, santander_amex...), o null
 */
export const fuenteDeDeteccion = (deteccion) => {
  if (!deteccion?.tipo || !deteccion?.producto) return null;
  const clave = `${deteccion.tipo}_${deteccion.producto}`;
  return FUENTES[clave] ? clave : null;
};

/**
 * Banco y fuente de un aviso por el remitente y el asunto del mail.
 * La fuente queda en null si el mail no dice de qué producto es.
 * @returns {{ banco: string|null, fuente: string|null }}
 */
export const fuenteDeAviso = ({ from = '', subject = '' } = {}) => {
  const texto = `${from} ${subject}`.toLowerCase();
  const banco = ['galicia', 'santander', 'mercadopago'].find(b => texto.includes(b))
    || (texto.includes('mercado pago') ? 'mercadopago' : null);
  if (!banco) return { banco: null, fuente: null };

  const asunto = subject.toLowerCase();
  const producto = /visa/.test(asunto) ? 'visa'
    : /master/.test(asunto) ? 'mastercard'
      : /amex|american express/.test(asunto) ? 'amex'
        : banco === 'mercadopago' ? 'cuenta'
          : /cuenta|caja de ahorro/.test(asunto) ? 'caja_ahorro'
            : null;
  const clave = producto && `${banco}_${producto}`;
  return { banco, fuente: FUENTES[clave] ? clave : null };
};

/**
 * Link al homebanking del banco del aviso, o null
 */
export const homebankingDe = (banco) => HOMEBANKING[banco] || null;

/**
 * Fecha (YYYY-MM-DD) que ubica al resumen en el tiempo: el cierre de la tarjeta o el fin del período
 */
export const fechaDelResumen = (deteccion) => deteccion?.cierre || deteccion?.periodo?.hasta || null;

/**
 * Días entre el cierre del resumen y el mail del aviso (positivo: el mail llegó después), o null
 */
const diasHastaElMail = (aviso, deteccion) => {
  const fecha = fechaDelResumen(deteccion);
  const recibido = aviso?.email?.received_at ? new Date(aviso.email.received_at) : null;
  if (!fecha || !recibido || isNaN(recibido)) return null;
  const cierre = new Date(`${fecha}T00:00:00Z`);
  if (isNaN(cierre)) return null;
  return (recibido - cierre) / MS_DIA;
};

/**
 * ¿El archivo detectado es el que anunciaba el aviso? Misma fuente (banco + tipo) y mismo período.
 */
export const avisoCoincide = (aviso, deteccion) => {
  const { fuente } = fuenteDeAviso(aviso?.email);
  if (!fuente || fuente !== fuenteDeDeteccion(deteccion)) return false;
  const dias = diasHastaElMail(aviso, deteccion);
  return dias !== null && dias >= -DIAS_DESPUES_DEL_MAIL && dias <= DIAS_ANTES_DEL_MAIL;
};

/**
 * El aviso que cierra este archivo: entre los que coinciden, el de mail más cercano al cierre
 */
export const elegirAviso = (avisos, deteccion) => avisos
  .filter(a => avisoCoincide(a, deteccion))
  .sort((a, b) => Math.abs(diasHastaElMail(a, deteccion)) - Math.abs(diasHastaElMail(b, deteccion)))[0] || null;
