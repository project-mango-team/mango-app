import { describe, it, expect } from 'vitest';
import { parseOperacionesFima, marcarDuplicados, emparejarExistentes } from './investmentImport.js';

// Datos inventados con el mismo formato que la app de Fima
const TEXTO = [
  '2026/05/20', '', 'Cuenta Fima', '', 'Retirar', '', 'Realizada', '', '120,50', '', '$80,123456', '', '$9.654,87',
  '', '',
  '2026/05/19', '', 'Cuenta Fima', '', 'Agregar', '', 'Realizada', '', '1.250,00', '', '$80,000000', '', '$100.000,00',
  '', '',
  '2026/02/03', '', 'Cuenta Fima', '', 'Retirar', '', 'En proceso', '', '$25.000,00',
  '', '',
  '2026/02/01', '', 'Cuenta Fima', '', 'Agregar', '', 'Anulada', '', '$1.000,50',
  ''
].join('\r\n');

describe('parseOperacionesFima', () => {
  it('lee realizadas, en proceso y anuladas', () => {
    const { operaciones, errores } = parseOperacionesFima(TEXTO);
    expect(errores).toEqual([]);
    expect(operaciones).toEqual([
      { fecha: '2026-05-20', tipo: 'Retiro', monto: 9654.87, estado: 'Realizada', cuotapartes: 120.5, valor_cuota: 80.123456 },
      { fecha: '2026-05-19', tipo: 'Aporte', monto: 100000, estado: 'Realizada', cuotapartes: 1250, valor_cuota: 80 },
      { fecha: '2026-02-03', tipo: 'Retiro', monto: 25000, estado: 'En proceso' },
      { fecha: '2026-02-01', tipo: 'Aporte', monto: 1000.5, estado: 'Anulada' }
    ]);
  });

  it('informa bloques que no entiende sin cortar el resto', () => {
    const { operaciones, errores } = parseOperacionesFima('2026/01/01\nCuenta Fima\nAgregar\nRealizada\n\n2026/01/02\nCuenta Fima\nRetirar\nRealizada\n$500,00');
    expect(operaciones).toHaveLength(1);
    expect(errores).toEqual(['No se pudo leer la operación del 2026-01-01']);
  });

  it('texto vacío o sin operaciones', () => {
    expect(parseOperacionesFima('')).toEqual({ operaciones: [], errores: [] });
    expect(parseOperacionesFima('hola\nchau')).toEqual({ operaciones: [], errores: [] });
  });
});

describe('marcarDuplicados', () => {
  it('marca las que ya están cargadas, respetando cantidades', () => {
    const ops = [
      { fecha: '2026-02-14', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-14', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-15', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-14', tipo: 'Aporte', monto: 27500 }
    ];
    const existentes = [{ fecha: new Date('2026-02-14T00:00:00Z'), tipo: 'Retiro', monto: 27500 }];
    expect(marcarDuplicados(ops, existentes)).toEqual([true, false, false, false]);
  });
});

describe('emparejarExistentes', () => {
  it('devuelve el movimiento existente de cada operación, sin repetirlo', () => {
    const a = { _id: 'a', fecha: new Date('2026-02-14T00:00:00Z'), tipo: 'Retiro', monto: 27500 };
    const b = { _id: 'b', fecha: new Date('2026-02-14T00:00:00Z'), tipo: 'Retiro', monto: 27500, unidades: 10 };
    const ops = [
      { fecha: '2026-02-14', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-14', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-14', tipo: 'Retiro', monto: 27500 },
      { fecha: '2026-02-14', tipo: 'Aporte', monto: 27500 }
    ];
    expect(emparejarExistentes(ops, [a, b])).toEqual([a, b, null, null]);
  });
});
