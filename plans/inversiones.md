# Feature: Inversiones

Reemplazar el Excel `Savings.xlsx` por una sección **Inversiones** en Mango con tres tabs: **Portfolio**, **Rendimientos** y **Préstamos**. Todo se carga a mano en v1.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Moneda de rendimiento | USD por defecto, con un toggle para verlo en ARS |
| Carga de valor | Solo el monto total, sin cantidad × precio |
| Monedas | ARS / USD / EUR. USDT y USDC cuentan como USD. Las cripto se valúan a mano en USD |
| Dólar | Blue, promedio entre compra y venta. Se guarda en cada movimiento y se puede editar |
| Valuaciones | Pantalla "Actualizar todo" (bulk) y también carga individual por activo |
| Carga inicial | A mano desde la UI, sin importador del Excel |
| Liquidez | Por tipo de activo: cada tipo tiene un flag `liquido` |
| Tipos | Lista base y la posibilidad de agregar tipos propios. La plataforma es texto libre con autocompletado |
| Préstamos | Sección aparte. Suman al patrimonio, pero no al rendimiento ni a la liquidez. Admiten devoluciones parciales y tienen historial de saldados |
| Relación con gastos | Independiente. Se agrega la categoría `Inversión`, que se excluye del dashboard de gastos |

## Modelo conceptual

El Excel guarda una foto. Acá se guardan **movimientos**, para que la ganancia de un activo ya vendido no se pierda.

- **Aporte**: compraste o depositaste. Entra plata al activo.
- **Retiro**: vendiste, rescataste o cobraste un dividendo. Sale plata del activo.
- **Valuación**: el valor total del activo a una fecha. No es un flujo de plata.

```
valor_actual   = última valuación + aportes posteriores − retiros posteriores
                 (sin valuaciones: Σ aportes − Σ retiros, ej. efectivo)
ganancia_usd   = valor_actual_usd + Σ retiros_usd − Σ aportes_usd
rendimiento_%  = ganancia_usd / Σ aportes_usd
```

- Cada flujo se convierte con la **cotización de su fecha**. El valor actual se convierte con la cotización de **hoy**. Así un FCI en pesos que rindió en ARS pero perdió contra el dólar muestra la ganancia real en USD, igual que en el Excel.
- El toggle a ARS hace la misma cuenta con los montos en pesos.
- Un activo con valor actual 0 queda como **cerrado**. Sale del Portfolio pero sigue en Rendimientos con su ganancia realizada. La acción "Cerrar activo" carga un retiro por el total.

## Modelo de datos

Las colecciones nuevas no se comparten con `mango-py`, así que **`fecha` es un `Date`** y no un string `DD/MM/YYYY`.

**`InvestmentAsset`**
- `user_id` (indexado), `nombre`, `tipo` (string), `moneda` (`ARS|USD|EUR`), `renta` (`Fija|Variable|N/A`), `plataforma`, `notas`, `created_at`
- `cerrado` se calcula. No se guarda.

**`InvestmentMovement`**
- `user_id`, `asset_id` (indexados), `fecha: Date`, `tipo` (`Aporte|Retiro|Valuacion`), `monto` (en la moneda del activo, siempre positivo)
- `cotizacion_usd` (ARS por USD, blue promedio de esa fecha), `cotizacion_eur` (solo si la moneda es EUR)
- `monto_usd`, `monto_ars` se calculan al guardar
- Índice `{ user_id, asset_id, fecha }`

**`LoanMovement`** (modelo plano por deudor, como el Excel)
- `user_id`, `deudor`, `concepto`, `fecha: Date`, `tipo` (`Prestamo|Devolucion`), `monto_usd` (puede ser negativo para ajustes, como el "descuento" del Excel)
- `monto_ars` y `cotizacion_usd` son opcionales. Sirven para cargar en pesos y convertir.
- Saldo por deudor = Σ préstamos − Σ devoluciones. Un deudor con saldo 0 pasa a "Saldados" y conserva su historial.

**`User.investmentTypes`**: `[{ nombre, liquido }]` con los tipos propios. Los tipos base van en `backend/src/config/investmentTypes.js`:

| Tipo | Líquido |
|---|---|
| Efectivo, Cuenta remunerada, FCI, Cripto | sí |
| Plazo fijo, ETF, Acciones, Bonos | no |

## Cotizaciones

- Se extiende `DolarService` con `getBlue(fecha?)`. Para hoy usa `dolarapi.com/v1/dolares/blue`. Para fechas pasadas usa `api.argentinadatos.com/v1/cotizaciones/dolares/blue/YYYY/MM/DD`. En los dos casos devuelve `(compra+venta)/2`. Ambos endpoints están probados y responden.
- `getEuro()` devuelve un euro equivalente al blue: `blue × (euro oficial / dólar oficial)`. Usar el euro oficial directo con el dólar blue haría que los cambios en la brecha parezcan ganancia.
- Para la serie de Rendimientos, `getHistorial()` trae el historial diario completo en una sola llamada (argentinadatos) y lo cachea 6 h.
- Si la API falla, el form pide la cotización a mano. Sin fallback hardcodeado.
- El `getCotizacion()` oficial de las tarjetas queda como está.

## API (todo con `requireAuth` y queries filtradas por `user_id`)

```
GET/POST/PUT/DELETE  /api/investments/assets[/:id]
GET/POST/PUT/DELETE  /api/investments/assets/:id/movements[/:movId]
POST                 /api/investments/valuations        (bulk: [{asset_id, monto}], fecha única)
GET                  /api/investments/portfolio         (activos abiertos, valor actual, totales, liquidez)
GET                  /api/investments/performance       (por activo, incluye cerrados, + serie mensual)
GET/POST/PUT/DELETE  /api/loans[/:id]
GET                  /api/loans/summary                 (saldo por deudor, pendientes/saldados)
GET                  /api/dolar/blue?fecha=YYYY-MM-DD
```

- Rutas → controllers (`investmentController.js`, `loanController.js`).
- Los cálculos (valor actual, ganancia, serie temporal) van como **funciones puras** en `utils/investmentCalc.js`, con tests en Vitest.
- Se agrega a `userQuery.js` un helper genérico `addUserToData` para los inserts nuevos.
- Al borrar un activo se borran sus movimientos, con confirmación previa.

## Frontend

- Nueva ruta `/inversiones` con `pages/Inversiones.jsx` chico: solo tabs y layout. Los componentes van en `components/investments/`, los hooks en `hooks/` y los servicios en `services/investmentService.js` y `services/loanService.js`.
- **Portfolio**:
  - Cards con el total (USD/ARS), la liquidez, el total invertido y la ganancia no realizada.
  - Pie por activo, con switch a "por tipo".
  - Tabla igual al Excel: activo, tipo, plataforma, aportado, valor actual, ganancia, %.
  - Botones "Nuevo activo" y "Actualizar valores".
- **Detalle de activo** (modal o drawer): datos, lista de movimientos (alta/edición/borrado) y un minigráfico del valor.
- **Actualizar valores**: tabla con todos los activos abiertos, el último valor como placeholder y una sola fecha arriba. Guarda una valuación por cada fila modificada.
- **Rendimientos**:
  - Ganancia total histórica, separada en realizada (cerrados) y no realizada.
  - Tabla por activo con los cerrados incluidos.
  - Gráfico de líneas mensual con el valor del portfolio contra el capital aportado acumulado. La distancia entre las dos líneas es la ganancia.
  - Filtro por rango de fechas.
- **Préstamos**: total pendiente, una card por deudor con su saldo, el historial al expandir, una sección "Saldados" colapsada y botones "Prestar" / "Registrar devolución".
- **Gastos**: se agrega la categoría `Inversión` y se excluye de los totales de gasto en `Inicio`.

## Fases (cada una es un PR chico y validado con `npm run dev`)

1. **Backend base**: modelos, `DolarService.getBlue/getEuro`, CRUD de activos y movimientos, `investmentCalc` con tests en Vitest.
2. **Portfolio**: ruta y menú, alta de activos, movimientos, valuación individual y bulk, pie y tabla.
3. **Rendimientos**: endpoint de performance, serie temporal y vista.
4. **Préstamos**: modelo, API y vista.
5. **Integración con gastos**: categoría `Inversión` excluida del dashboard.

## Fuera de alcance (v2)

- Integraciones con Nexo, Bull Market, etc.
- Cantidad × precio y cotización automática de cripto.
- Rendimiento anualizado (TIR/XIRR) y comparación contra la inflación o el dólar.
- Interés en préstamos.
