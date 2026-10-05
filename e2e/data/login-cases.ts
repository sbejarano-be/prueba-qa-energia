import { env } from '../config/env'

const { email, password } = env.credentials

/**
 * Partición de equivalencia del login (API). Una fila por clase.
 * V = clase válida, I = clase inválida. Fuente: backend/README.md · "Login" y formato de errores.
 */
export interface LoginCase {
  id: string
  clase: string
  body: unknown
  expectedStatus: number
  /** Texto que debe aparecer en `message` o en `errors`. */
  expectedText?: string
}

export const LOGIN_CASES: readonly LoginCase[] = [
  { id: 'V1', clase: 'Credenciales válidas', body: { email, password }, expectedStatus: 200 },
  {
    id: 'V2',
    clase: 'Email en mayúsculas (el email no distingue mayúsculas · supuesto S-03)',
    body: { email: email.toUpperCase(), password },
    expectedStatus: 200,
  },
  { id: 'V3', clase: 'Email con espacios alrededor', body: { email: `  ${email}  `, password }, expectedStatus: 200 },
  {
    id: 'I1',
    clase: 'Contraseña incorrecta',
    body: { email, password: 'incorrecta' },
    expectedStatus: 401,
    expectedText: 'Email o contraseña incorrectos',
  },
  {
    id: 'I2',
    clase: 'Email no registrado (mismo mensaje: no revela si el usuario existe)',
    body: { email: 'nadie@energia.local', password },
    expectedStatus: 401,
    expectedText: 'Email o contraseña incorrectos',
  },
  {
    id: 'I3',
    clase: 'Contraseña con otra capitalización (la contraseña sí distingue mayúsculas)',
    body: { email, password: password.toUpperCase() },
    expectedStatus: 401,
  },
  { id: 'I4', clase: 'Objeto vacío', body: {}, expectedStatus: 400, expectedText: 'email es obligatorio' },
  { id: 'I5', clase: 'Falta la contraseña', body: { email }, expectedStatus: 400, expectedText: 'password es obligatorio' },
  { id: 'I6', clase: 'Campos vacíos / solo espacios', body: { email: '   ', password: '' }, expectedStatus: 400 },
  { id: 'I7', clase: 'Campo no documentado', body: { email, password, role: 'admin' }, expectedStatus: 400 },
]
