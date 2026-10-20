import { describe, it, expect, vi, beforeEach } from 'vitest';

const usuario = { iaSugerencias: true, categories: ['Comida', 'Transporte', 'Otros'] };
const lean = (valor) => ({ select: () => ({ lean: async () => valor }) });

vi.mock('../models/User.js', async (importOriginal) => ({
  ...(await importOriginal()),
  default: { findById: () => lean(usuario), updateOne: vi.fn() }
}));
vi.mock('../models/Transaction.js', () => ({ default: { find: () => lean([{ detalle: 'YPF 123456', categoria: 'Transporte' }]) } }));

const { sugerirCategorias, MODELO } = await import('./aiSuggestionService.js');

const req = { user: { _id: 'u1' } };
const clienteQueResponde = (respuesta) => {
  const create = vi.fn(async () => respuesta);
  return { create, client: { messages: { create } } };
};

describe('sugerirCategorias', () => {
  beforeEach(() => {
    usuario.iaSugerencias = true;
  });

  it('pide a Haiku con el esquema de categorías y devuelve las sugerencias válidas', async () => {
    const { create, client } = clienteQueResponde({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ sugerencias: [{ id: 0, categoria: 'Transporte', confianza: 0.9 }] }) }]
    });
    const r = await sugerirCategorias(req, [{ id: 0, detalle: 'SHELL 4455', importe: 100, tipo: 'Gasto', origen: 'MP', email: 'no@va' }], { client });
    expect(r).toEqual([{ id: 0, categoria: 'Transporte', confianza: 0.9 }]);

    const pedido = create.mock.calls[0][0];
    expect(pedido.model).toBe(MODELO);
    expect(pedido.output_config.format.schema.properties.sugerencias.items.properties.categoria.enum).toEqual(['Comida', 'Transporte']);
    const mensaje = JSON.parse(pedido.messages[0].content);
    expect(mensaje.movimientos).toEqual([{ id: 0, detalle: 'SHELL 4455', importe: 100, tipo: 'Gasto', origen: 'MP' }]);
    expect(mensaje.ejemplos).toEqual([{ detalle: 'YPF', categoria: 'Transporte' }]);
  });

  it('sin opt-in no llama a la API', async () => {
    usuario.iaSugerencias = false;
    const { create, client } = clienteQueResponde({});
    await expect(sugerirCategorias(req, [{ id: 0, detalle: 'x' }], { client })).rejects.toThrow('desactivadas');
    expect(create).not.toHaveBeenCalled();
  });

  it('una negativa o una respuesta cortada son errores claros', async () => {
    for (const stop_reason of ['refusal', 'max_tokens']) {
      const { client } = clienteQueResponde({ stop_reason, content: [] });
      await expect(sugerirCategorias(req, [{ id: 0, detalle: 'x' }], { client })).rejects.toThrow();
    }
  });
});
