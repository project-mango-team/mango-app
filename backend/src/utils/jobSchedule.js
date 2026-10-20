// Lógica pura del scheduler de jobs: en qué "slot" (día) estamos y si un job ya debería haber corrido.
// Las horas de los jobs se expresan en hora de Argentina, independientemente del huso del servidor.

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const validarHora = (hora) => HORA_RE.test(hora);

// Fecha y hora local de `now` en la zona dada: { fecha: 'YYYY-MM-DD', minutos: minutos desde las 00:00 }
export const fechaLocal = (now, zona = ZONA_HORARIA) => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute)
  };
};

// Slot diario de un job que corre a `hora` ('HH:MM'): el día local y si ya pasó la hora.
// Si el proceso estuvo caído a la hora programada, el job queda vencido y corre apenas vuelve (catch-up).
export const slotDiario = (now, hora, zona = ZONA_HORARIA) => {
  if (!validarHora(hora)) throw new Error(`Hora inválida: ${hora}`);
  const [h, m] = hora.split(':').map(Number);
  const { fecha, minutos } = fechaLocal(now, zona);
  return { slot: fecha, vencido: minutos >= h * 60 + m };
};

export const slotManual = (now) => `manual-${now.toISOString()}`;

export const POLITICA_DEFAULT = {
  maxIntentos: 3,
  reintentoMs: 30 * 60 * 1000, // espera entre reintentos de una corrida con error
  timeoutMs: 60 * 60 * 1000 // una corrida "corriendo" más vieja que esto se considera muerta (el proceso se cayó)
};

// Filtro de Mongo para retomar una corrida existente del mismo slot:
// con error y le quedan intentos, o colgada en "corriendo" más allá del timeout.
export const filtroReclamable = (job, slot, now, politica = POLITICA_DEFAULT) => ({
  job,
  slot,
  $or: [
    {
      estado: 'error',
      intentos: { $lt: politica.maxIntentos },
      terminado_at: { $lte: new Date(now.getTime() - politica.reintentoMs) }
    },
    {
      estado: 'corriendo',
      iniciado_at: { $lte: new Date(now.getTime() - politica.timeoutMs) }
    }
  ]
});

// El resultado de un job se guarda para verlo en la UI: se limita a un objeto chico serializable.
export const resumirResultado = (resultado, maxLargo = 2000) => {
  if (resultado === undefined || resultado === null) return null;
  const valor = typeof resultado === 'object' ? resultado : { valor: resultado };
  let json;
  try {
    json = JSON.stringify(valor);
  } catch {
    return { valor: 'resultado no serializable' };
  }
  if (json.length <= maxLargo) return JSON.parse(json);
  return { truncado: json.slice(0, maxLargo) };
};

export const mensajeDeError = (error, maxLargo = 1000) => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.length > maxLargo ? `${msg.slice(0, maxLargo)}…` : msg;
};
