# 🥭 Mango

App de finanzas personales: importa resúmenes bancarios, categoriza los movimientos automáticamente y muestra dashboards de gastos e ingresos. Es multi-usuario, con login de Google.

## Funcionalidades

- **Login con Google**: cada usuario ve solo sus datos.
- **Importación de resúmenes**, con vista previa editable antes de guardar:

  | Banco | Tipo | Formatos |
  |---|---|---|
  | Mercado Pago | Movimientos de cuenta | CSV |
  | Santander | Tarjetas de crédito (con selección de tarjetas) | CSV, XLSX |
  | Galicia | Caja de ahorro | CSV, XLSX |
  | Galicia | Tarjeta Visa / Mastercard | PDF, TXT |

- **Consumos en dólares**: se convierten a pesos con la cotización del dólar oficial (venta) que se obtiene de [dolarapi.com](https://dolarapi.com), o de [Bluelytics](https://bluelytics.com.ar) si la primera falla. El valor se puede editar en cada import.
- **Categorización automática** por palabras clave. Hay keywords por defecto y cada usuario las puede personalizar.
- **Historial de imports con rollback**: cada import es una operación que se puede deshacer completa.
- **Dashboard** (Inicio) con balance, gastos por categoría, evolución mensual y búsqueda de movimientos.
- **Carga manual** de movimientos y **migración** desde Excel.

## Stack

- **Monorepo** con npm workspaces: `backend/` y `frontend/`.
- **Backend**: Node.js + Express + Mongoose (ES Modules), sesiones con `express-session` + `connect-mongo` y autenticación con Passport (Google OAuth).
- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts + React Router.
- **Base de datos**: MongoDB Atlas.

## Puesta en marcha

### Requisitos

- Node.js 20 o superior
- Una base MongoDB (Atlas o local)
- Credenciales OAuth de Google ([Google Cloud Console](https://console.cloud.google.com/apis/credentials)), con `http://localhost:5000/api/auth/google/callback` como redirect URI autorizada

### Instalación

```bash
npm install
```

Instala las dependencias de los dos workspaces desde la raíz.

### Variables de entorno

Copiá `backend/.env.example` a `backend/.env` y completá los valores:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend (default `5000`) |
| `MONGODB_URI` | Connection string de MongoDB |
| `MONGODB_DATABASE` | Nombre de la base (default `Mango`) |
| `NODE_ENV` | `development` o `production` |
| `FRONTEND_URL` | URL del frontend, para CORS y redirects de OAuth |
| `SESSION_SECRET` | Secreto para firmar las sesiones |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de Google |
| `GOOGLE_CALLBACK_URL` | Callback de OAuth (`http://localhost:5000/api/auth/google/callback` en local) |

### Desarrollo

```bash
npm run dev
```

Levanta el backend en http://localhost:5000 y el frontend en http://localhost:5173. Vite redirige `/api` al backend.

### Producción

```bash
npm run build
npm start
```

El build del frontend queda en `frontend/dist` y el backend lo sirve junto con la API.

## Scripts (raíz)

| Script | Qué hace |
|---|---|
| `npm run dev` | Backend (nodemon) y frontend (Vite) en paralelo |
| `npm run dev:backend` / `npm run dev:frontend` | Cada uno por separado |
| `npm run build` | Build de producción del frontend |
| `npm start` | Backend en modo producción |

## Estructura

```
mango/
├── backend/
│   ├── config/
│   │   └── categorias_keywords.yaml   # Keywords default de categorías
│   └── src/
│       ├── config/        # Conexión a MongoDB y Passport
│       ├── controllers/
│       ├── middleware/    # requireAuth y manejo de errores
│       ├── models/        # Transaction, Operation, User
│       ├── parsers/       # Un parser por banco (extienden BaseParser)
│       ├── routes/
│       ├── services/      # Cotización del dólar
│       ├── utils/         # Filtros multi-usuario e inferencia de categorías
│       └── server.js
└── frontend/
    └── src/
        ├── components/
        ├── contexts/
        ├── hooks/
        ├── pages/         # Inicio, Datos, Migracion, Login
        └── services/      # Cliente axios y servicios por recurso
```

## API

Todas las rutas, salvo las de `/api/auth`, requieren una sesión iniciada.

| Prefijo | Para qué |
|---|---|
| `/api/auth` | Login con Google, usuario actual y logout |
| `/api/transactions` | CRUD de movimientos y borrado masivo |
| `/api/stats` | Totales, gastos por categoría, resumen mensual y años disponibles |
| `/api/upload` | Vista previa e importación de resúmenes, historial y rollback |
| `/api/operations` | Operaciones de import y rollback |
| `/api/categories` | Categorías y keywords del usuario |
| `/api/migrate` | Migración desde Excel |
| `/api/dolar` | Cotización del dólar usada por defecto en los imports |

## Modelo de datos

- `fecha` es un string con formato `DD/MM/YYYY` y `mes` es el nombre del mes en español.
- `importe` está siempre en ARS y es positivo. El signo lo da `tipo` (`Gasto` o `Ingreso`). `monto_original` y `moneda` (`ARS` o `USD`) guardan el valor original.
- La base se comparte con la versión anterior en Python, así que cualquier cambio de formato necesita un plan de migración.

## Troubleshooting

- **No conecta a MongoDB**: revisá `MONGODB_URI` y que tu IP esté habilitada en Atlas.
- **El login de Google falla**: confirmá que `GOOGLE_CALLBACK_URL` coincida con la redirect URI configurada en Google Cloud.
- **El frontend no llega a la API (errores de proxy en Vite)**: el backend tiene que estar escuchando en el puerto 5000.

## Licencia

[MIT](LICENSE)
