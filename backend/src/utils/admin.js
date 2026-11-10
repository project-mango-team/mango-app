// Administradores de la instancia: los mails de ADMIN_EMAILS (separados por coma).
// En desarrollo y tests (o sin NODE_ENV) todos los usuarios lo son, para poder probar con el login de invitado;
// en cualquier otro entorno (production, staging...) solo los de ADMIN_EMAILS.
export const esAdmin = (email, env = process.env) => {
  if (!env.NODE_ENV || ['development', 'test'].includes(env.NODE_ENV)) return true;
  if (!email) return false;
  const admins = (env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
};
