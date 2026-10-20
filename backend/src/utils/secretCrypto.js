import crypto from 'crypto';

// Cifrado de secretos de terceros (tokens de Mercado Pago, contraseñas de PDF) con AES-256-GCM.
// La clave sale de SECRETS_KEY: 32 bytes en base64. Para generar una:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Formato guardado: 'v1.<iv>.<tag>.<cifrado>' (base64url). El AAD ata el cifrado a su dueño y nombre:
// un valor copiado a otro usuario u otro nombre no se puede descifrar.

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';

export const claveDesdeEntorno = (env = process.env) => {
  const raw = env.SECRETS_KEY;
  if (!raw) return null;
  const clave = Buffer.from(raw, 'base64');
  if (clave.length !== 32) throw new Error('SECRETS_KEY tiene que ser de 32 bytes en base64');
  return clave;
};

export const cifrar = (texto, clave, aad) => {
  if (typeof texto !== 'string' || !texto) throw new Error('No hay nada para cifrar');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, cifrado].map(p => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
};

export const descifrar = (payload, clave, aad) => {
  const partes = typeof payload === 'string' ? payload.split('.') : [];
  if (partes.length !== 4 || partes[0] !== VERSION) throw new Error('Formato de secreto desconocido');
  const [, iv, tag, cifrado] = partes.map(p => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv(ALGORITMO, clave, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
  } catch {
    // Clave distinta (SECRETS_KEY cambió) o dato alterado
    throw new Error('No se pudo descifrar el secreto');
  }
};

// Últimos caracteres para reconocer un token en la UI sin mostrarlo. Solo si es largo: en una contraseña corta revelaría demasiado.
export const pistaDe = (texto) => (texto.length >= 16 ? `…${texto.slice(-4)}` : null);

export const aadDe = (userId, nombre) => `${userId}:${nombre}`;
