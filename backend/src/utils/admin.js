// Administradores de la instancia: los mails de ADMIN_EMAILS (separados por coma).
// Fuera de producción todos los usuarios lo son, para poder probar con el login de invitado.
export const esAdmin = (email, env = process.env) => {
  if (env.NODE_ENV !== 'production') return true;
  if (!email) return false;
  const admins = (env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
};
