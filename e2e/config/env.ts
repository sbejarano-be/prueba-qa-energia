/**
 * Configuración del entorno bajo prueba. Todo sale de variables de entorno con
 * un valor por defecto que funciona en local (modo desarrollo).
 *
 *   BASE_URL           Frontend. Por defecto Vite (http://localhost:5173). Docker: http://localhost:3000
 *   API_URL            Backend.  Por defecto http://localhost:8080 (también expuesto en Docker)
 *   BOUNDARY_API_URL   Segunda instancia del backend con el dataset sintético de valores límite
 *   E2E_EMAIL / E2E_PASSWORD   Credenciales del operador (las del enunciado por defecto)
 */
export const env = {
  baseUrl: process.env.BASE_URL ?? 'http://localhost:5173',
  apiUrl: process.env.API_URL ?? 'http://localhost:8080',
  boundaryApiUrl: process.env.BOUNDARY_API_URL ?? 'http://localhost:8081',
  /** Si se define BASE_URL, se asume que la app ya está levantada (Docker, servidor remoto). */
  startLocalServers: !process.env.BASE_URL,
  credentials: {
    email: process.env.E2E_EMAIL ?? 'admin@energia.local',
    password: process.env.E2E_PASSWORD ?? 'admin123',
    name: process.env.E2E_NAME ?? 'Operador',
  },
} as const

/** Ruta del estado de sesión reutilizable (localStorage con el JWT). */
export const STORAGE_STATE = '.auth/operator.json'

/** Zona horaria de los usuarios del producto (PRUEBA_QA.md §1.4). */
export const OPERATOR_TIMEZONE = 'America/Bogota'
