import { describe, it, expect } from 'vitest';
import { esAdmin } from './admin.js';

describe('esAdmin', () => {
  it('fuera de producción todos son admin', () => {
    expect(esAdmin('a@b.com', { NODE_ENV: 'development' })).toBe(true);
  });

  it('en producción solo los de ADMIN_EMAILS, sin importar mayúsculas ni espacios', () => {
    const env = { NODE_ENV: 'production', ADMIN_EMAILS: ' Uno@Mail.com , dos@mail.com' };
    expect(esAdmin('uno@mail.com', env)).toBe(true);
    expect(esAdmin('DOS@mail.com', env)).toBe(true);
    expect(esAdmin('tres@mail.com', env)).toBe(false);
    expect(esAdmin(undefined, env)).toBe(false);
  });

  it('en producción sin ADMIN_EMAILS no hay admins', () => {
    expect(esAdmin('uno@mail.com', { NODE_ENV: 'production' })).toBe(false);
  });
});
