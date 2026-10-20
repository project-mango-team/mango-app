import crypto from 'crypto';

// Tokens personales de integración: "mango_" + 32 bytes aleatorios en base64url
const PREFIJO = 'mango_';

export const generarToken = () => `${PREFIJO}${crypto.randomBytes(32).toString('base64url')}`;

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Lo que se muestra en la lista: "mango_AbCd…"
export const prefijoVisible = (token) => `${String(token).slice(0, PREFIJO.length + 4)}…`;

/**
 * Extrae el token de un header "Authorization: Bearer mango_..."
 * @returns {string|null}
 */
export const tokenDesdeHeader = (header) => {
  const match = String(header ?? '').match(/^Bearer\s+(mango_[A-Za-z0-9_-]{20,})\s*$/);
  return match ? match[1] : null;
};

/**
 * Limitador simple en memoria: como mucho `max` pedidos por clave cada `ventanaMs`.
 * Alcanza para un solo proceso (Mango corre en una instancia).
 */
export const crearLimitador = ({ max, ventanaMs, ahora = () => Date.now() }) => {
  const pedidos = new Map();
  return (clave) => {
    const t = ahora();
    const recientes = (pedidos.get(clave) || []).filter(x => t - x < ventanaMs);
    if (recientes.length >= max) {
      pedidos.set(clave, recientes);
      return false;
    }
    recientes.push(t);
    pedidos.set(clave, recientes);
    return true;
  };
};
