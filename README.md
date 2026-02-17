# 🥭 Mango - Financial Management Application

Aplicación web full-stack para gestión de finanzas personales con análisis de gastos e ingresos.

## 🚀 Stack Tecnológico

### Backend
- **Node.js** + **Express** - API REST
- **MongoDB** + **Mongoose** - Base de datos
- **ES Modules** - Sintaxis moderna

### Frontend
- **React 18** - UI Library
- **Vite** - Build tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Recharts** - Gráficos (próximamente)

## 📦 Instalación

### Prerequisitos
- Node.js 20.x o superior
- npm o yarn
- MongoDB Atlas (o MongoDB local)

### Paso 1: Clonar el repositorio
```bash
cd d:\projects\mango
```

### Paso 2: Instalar dependencias

#### Opción A: Instalar todo de una vez (recomendado)
```bash
npm run install:all
```

#### Opción B: Instalar manualmente
```bash
# Raíz
npm install

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Paso 3: Configurar variables de entorno

Crea un archivo `.env` en la carpeta `backend/` con:

```env
PORT=5000
MONGODB_URI=mongodb+srv://tu-usuario:tu-password@cluster.mongodb.net/
MONGODB_DATABASE=Mango
NODE_ENV=development
```

> **Nota**: Copia `.env.example` como base

## 🏃 Ejecutar el proyecto

### Opción 1: Ambos servidores simultáneamente (recomendado)
```bash
npm run dev
```

Esto inicia:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

### Opción 2: Servidores separados

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 📁 Estructura del Proyecto

```
mango/
├── backend/                 # API Node.js + Express
│   ├── src/
│   │   ├── config/         # Configuración DB
│   │   ├── controllers/    # Lógica de negocio
│   │   ├── models/         # Modelos Mongoose
│   │   ├── routes/         # Rutas de la API
│   │   ├── middleware/     # Middleware (errors, etc)
│   │   └── server.js       # Entry point
│   ├── .env                # Variables de entorno
│   └── package.json
│
├── frontend/               # App React + Vite
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Páginas principales
│   │   ├── services/      # API clients
│   │   ├── App.jsx        # Root component
│   │   └── main.jsx       # Entry point
│   └── package.json
│
├── python/                # Versión legacy Streamlit
└── package.json          # Root package con scripts
```

## 🔌 API Endpoints

### Transacciones
- `GET /api/transactions` - Listar todas las transacciones
- `GET /api/transactions/:id` - Obtener una transacción
- `POST /api/transactions` - Crear transacciones (bulk)
- `PUT /api/transactions/:id` - Actualizar transacción
- `DELETE /api/transactions/:id` - Eliminar transacción
- `POST /api/transactions/bulk-delete` - Eliminar múltiples

### Estadísticas
- `GET /api/stats` - Estadísticas generales
- `GET /api/stats/categorias` - Gastos por categoría
- `GET /api/stats/monthly` - Resumen mensual
- `GET /api/stats/years` - Años disponibles

### Upload
- `POST /api/upload` - Subir archivo para parsear

## 🎨 Características

✅ **Implementadas:**
- API REST completa con CRUD de transacciones
- Dashboard con métricas principales (balance, gastos, ingresos)
- Navegación entre páginas (Inicio, Datos, Migración)
- Conexión a MongoDB Atlas
- UI moderna con Tailwind CSS
- Proxy de Vite para desarrollo

🚧 **En desarrollo:**
- Parsers de Mercado Pago y Santander
- Gráficos interactivos (Recharts)
- Tabla de transacciones con filtros
- Sistema de categorización automática
- Migración masiva de Excel
- Exportación a CSV

## 🛠️ Scripts Disponibles

### Root
- `npm run dev` - Corre backend y frontend
- `npm run install:all` - Instala todas las dependencias

### Backend
- `npm run dev` - Desarrollo con nodemon
- `npm start` - Producción

### Frontend
- `npm run dev` - Desarrollo con Vite
- `npm run build` - Build para producción
- `npm run preview` - Preview del build

## 🔄 Migración desde Python/Streamlit

Este proyecto reemplaza la versión anterior en Python (carpeta `python/`). Los datos en MongoDB son compatibles con ambas versiones.

### ¿Por qué Node + React?
- Mayor control sobre la UI
- Mejor experiencia de desarrollo
- Más flexible para features complejas
- Mejor performance y SEO
- Ecosistema más amplio de librerías

## 🤝 Próximos Pasos

1. Migrar parsers de Python a Node.js
2. Implementar gráficos con Recharts
3. Sistema de autenticación
4. Modo multi-usuario
5. App móvil con React Native
6. Notificaciones y alertas
7. Export/Import de datos

## 📝 Notas

- El backend usa **ES Modules** (`type: "module"`)
- Las fechas se guardan como strings (formato DD/MM/YYYY)
- El color primary de la app es `#db681d` (naranja/mango)
- La base de datos es la misma que usaba la versión Python

## 🐛 Troubleshooting

**Error de conexión a MongoDB:**
- Verifica que el `.env` esté configurado correctamente
- Chequea que tu IP esté en la whitelist de MongoDB Atlas
- Confirma que las credenciales sean correctas

**El frontend no encuentra el backend:**
- Asegúrate de que el backend esté corriendo en el puerto 5000
- Verifica la configuración del proxy en `vite.config.js`

**Dependencias faltantes:**
- Ejecuta `npm run install:all` desde la raíz

---

**Hecho con 🥭 por Mango Team**
