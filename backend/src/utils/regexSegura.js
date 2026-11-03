// Chequeo estático de las expresiones regulares que escribe el usuario en las reglas de categorización.
// Una regex como (a+)+$ tarda un tiempo exponencial en fallar y, como Node evalúa en el hilo principal,
// frena todo el backend (ReDoS). No hay una librería segura instalada (re2), así que se aceptan solo
// patrones que no pueden explotar:
//   · sin referencias hacia atrás ni lookaround;
//   · ningún grupo que se repita (*, +, {n,m}) puede contener a su vez una repetición o una alternancia;
//   · como mucho 3 repeticiones sin tope (*, +, {n,}), que acotan el peor caso a un polinomio chico.
// Junto con el tope de largo del texto evaluado (MAX_TEXTO_REGEX) el tiempo queda acotado.
// Es conservador: puede rechazar algún patrón legítimo, y el mensaje sugiere cómo escribirlo.

export const MAX_TEXTO_REGEX = 300;
const MAX_REPETICIONES_SIN_TOPE = 3;
const TOPE_GRANDE = 20;

/**
 * Cuantificador que arranca en `i` ({n}, {n,}, {n,m}, *, +, ?), con un `?` perezoso opcional.
 * @returns {{ min: number, max: number, largo: number } | null} null si en `i` no hay un cuantificador
 */
const cuantificadorEn = (patron, i) => {
  const c = patron[i];
  let min; let max; let largo;
  if (c === '*') { min = 0; max = Infinity; largo = 1; }
  else if (c === '+') { min = 1; max = Infinity; largo = 1; }
  else if (c === '?') { min = 0; max = 1; largo = 1; }
  else if (c === '{') {
    const m = /^\{(\d+)(?:,(\d*))?\}/.exec(patron.slice(i));
    if (!m) return null; // una llave suelta es un carácter literal
    min = Number(m[1]);
    max = m[2] === undefined ? min : (m[2] === '' ? Infinity : Number(m[2]));
    largo = m[0].length;
  } else return null;
  if (patron[i + largo] === '?') largo++;
  return { min, max, largo };
};

// Cualquier cuantificador variable (incluido ?) cuenta como repetición: (a?){30}a{30} también explota
const repite = (q) => q.max > 1 || q.max !== q.min;
const sinTope = (q) => q.max === Infinity || q.max > TOPE_GRANDE;

/**
 * @param {string} patron - expresión regular que ya compila
 * @returns {{ segura: boolean, motivo?: string }}
 */
export const analizarRegex = (patron) => {
  const texto = String(patron);
  const pila = [{ repeticion: false, alternancia: false }];
  let sinTopeTotal = 0;
  let i = 0;

  // Un átomo (carácter, escape, clase) seguido de su cuantificador
  const cerrarAtomo = (fin) => {
    const q = cuantificadorEn(texto, fin);
    if (!q) return fin;
    if (repite(q)) pila.at(-1).repeticion = true;
    if (sinTope(q)) sinTopeTotal++;
    return fin + q.largo;
  };

  while (i < texto.length) {
    const c = texto[i];
    if (c === '\\') {
      const sig = texto[i + 1] ?? '';
      if (/[1-9]/.test(sig) || sig === 'k') return { segura: false, motivo: 'no se permiten referencias hacia atrás' };
      i = cerrarAtomo(i + 2);
    } else if (c === '[') {
      let j = i + 1;
      if (texto[j] === '^') j++;
      while (j < texto.length && texto[j] !== ']') j += texto[j] === '\\' ? 2 : 1;
      i = cerrarAtomo(j + 1);
    } else if (c === '(') {
      if (/^\(\?<?[=!]/.test(texto.slice(i))) return { segura: false, motivo: 'no se permiten lookahead ni lookbehind' };
      pila.push({ repeticion: false, alternancia: false });
      i += texto.startsWith('(?:', i) ? 3 : 1;
    } else if (c === ')') {
      if (pila.length < 2) return { segura: false, motivo: 'los paréntesis no cierran' };
      const grupo = pila.pop();
      const q = cuantificadorEn(texto, i + 1);
      const padre = pila.at(-1);
      if (q && repite(q)) {
        if (grupo.repeticion) return { segura: false, motivo: 'un grupo repetido no puede contener otra repetición, por ejemplo (a+)+' };
        if (grupo.alternancia) return { segura: false, motivo: 'un grupo repetido no puede contener alternativas con |, por ejemplo (a|b)+' };
        padre.repeticion = true;
        if (sinTope(q)) sinTopeTotal++;
      }
      padre.repeticion ||= grupo.repeticion;
      padre.alternancia ||= grupo.alternancia;
      i += 1 + (q ? q.largo : 0);
    } else if (c === '|') {
      pila.at(-1).alternancia = true;
      i++;
    } else {
      i = cerrarAtomo(i + 1);
    }
  }

  if (pila.length !== 1) return { segura: false, motivo: 'los paréntesis no cierran' };
  if (sinTopeTotal > MAX_REPETICIONES_SIN_TOPE) {
    return { segura: false, motivo: `tiene demasiadas repeticiones sin tope (* o +): hasta ${MAX_REPETICIONES_SIN_TOPE}` };
  }
  return { segura: true };
};

export const esRegexSegura = (patron) => analizarRegex(patron).segura;
