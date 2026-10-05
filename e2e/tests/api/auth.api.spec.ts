import { createHmac } from 'node:crypto'
import type { ApiErrorBody, TokenResponse } from '../../api/types'
import { env } from '../../config/env'
import { LOGIN_CASES } from '../../data/login-cases'
import { expect, test } from '../../fixtures/test'

const LOGIN_PATH = '/api/v1/auth/login'

/** Formato único de errores (backend/README · "Los errores responden siempre con el mismo formato"). */
function expectErrorFormat(body: ApiErrorBody, status: number, path: string): void {
  expect(body.status_code).toBe(status)
  expect(typeof body.message).toBe('string')
  expect(body.message.length).toBeGreaterThan(0)
  expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date')
  expect(body.path).toBe(path)
}

const b64url = (value: object | string) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/** JWT HS256 firmado con un secreto arbitrario (para probar firmas ajenas). */
function signJwt(payload: object, secret: string, alg = 'HS256'): string {
  const head = `${b64url({ alg, typ: 'JWT' })}.${b64url(payload)}`
  if (alg === 'none') return `${head}.`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

test.describe('Auth · login (partición de equivalencia)', { tag: '@regression' }, () => {
  for (const c of LOGIN_CASES) {
    test(`CP-04/05 · ${c.id} · ${c.clase} → ${c.expectedStatus}`, async ({ anonymousApi }) => {
      const res = await anonymousApi.login(c.body)
      expect(res.status()).toBe(c.expectedStatus)
      const body = await res.json()

      if (c.expectedStatus === 200) {
        const token = body as TokenResponse
        expect(token.token_type).toBe('Bearer')
        expect(token.expires_in).toBeGreaterThan(0)
        expect(token.user).toEqual({ email: env.credentials.email, name: env.credentials.name })
        return
      }
      expectErrorFormat(body as ApiErrorBody, c.expectedStatus, LOGIN_PATH)
      if (c.expectedText) {
        const all = [body.message, ...(body.errors ?? [])].join(' | ')
        expect(all).toContain(c.expectedText)
      }
    })
  }

  test('CP-05 · JSON malformado → 400 con el formato de error', async ({ anonymousApi }) => {
    const res = await anonymousApi.loginRaw('{"email":')
    expect(res.status()).toBe(400)
    expectErrorFormat(await res.json(), 400, LOGIN_PATH)
  })

  test('CP-05 · cuerpo vacío → 400 y lista los dos campos obligatorios', async ({ anonymousApi }) => {
    const res = await anonymousApi.loginRaw('')
    expect(res.status()).toBe(400)
    const body = (await res.json()) as ApiErrorBody
    expectErrorFormat(body, 400, LOGIN_PATH)
    expect(body.errors).toEqual(expect.arrayContaining(['email es obligatorio', 'password es obligatorio']))
  })
})

test.describe('Auth · token (tabla de decisión: header × token → acceso)', { tag: '@regression' }, () => {
  test('CP-06 · token válido → /auth/me devuelve el usuario del token', async ({ api }) => {
    const res = await api.me()
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ email: env.credentials.email, name: env.credentials.name })
  })

  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: env.credentials.email, name: env.credentials.name, iss: 'energyai-api', iat: now, exp: now + 3600 }

  const invalid: { caso: string; headers: Record<string, string> }[] = [
    { caso: 'sin header Authorization', headers: {} },
    { caso: 'esquema distinto (Basic)', headers: { Authorization: 'Basic YWRtaW46YWRtaW4xMjM=' } },
    { caso: '"Bearer" sin token', headers: { Authorization: 'Bearer ' } },
    { caso: 'token que no es JWT', headers: { Authorization: 'Bearer abc.def' } },
    { caso: 'firmado con otro secreto', headers: { Authorization: `Bearer ${signJwt(claims, 'otro-secreto')}` } },
    { caso: 'alg "none" (sin firma)', headers: { Authorization: `Bearer ${signJwt(claims, '', 'none')}` } },
    {
      caso: 'vencido',
      headers: { Authorization: `Bearer ${signJwt({ ...claims, iat: now - 7200, exp: now - 3600 }, 'dev-secret-change-me')}` },
    },
  ]

  for (const { caso, headers } of invalid) {
    test(`CP-06 · ${caso} → 401`, async ({ anonymousApi }) => {
      const res = await anonymousApi.raw('GET', '/api/v1/auth/me', headers)
      expect(res.status()).toBe(401)
      expectErrorFormat(await res.json(), 401, '/api/v1/auth/me')
    })
  }

  test('CP-06 · token con la firma alterada → 401', async ({ api, apiToken, anonymousApi }) => {
    // Cambia un carácter en medio de la firma (el último solo lleva bits de relleno en base64url).
    const [head, payload, sig] = apiToken.split('.')
    const i = 10
    const tamperedSig = `${sig.slice(0, i)}${sig[i] === 'a' ? 'b' : 'a'}${sig.slice(i + 1)}`
    const tampered = `${head}.${payload}.${tamperedSig}`
    expect((await api.me()).status()).toBe(200)
    const res = await anonymousApi.withToken(tampered).me()
    expect(res.status()).toBe(401)
  })

  const protectedRoutes: [string, string][] = [
    ['GET', '/api/v1/meter/getParams'],
    ['POST', '/api/v1/meter/getAll'],
    ['GET', '/api/v1/meter/getById/M-109'],
    ['GET', '/api/v1/anomaly/getAll'],
    ['GET', '/api/v1/dashboard/getSummary'],
    ['POST', '/api/v1/ai/analyze'],
    ['GET', '/api/v1/ai/analysis/latest'],
  ]
  for (const [method, path] of protectedRoutes) {
    test(`CP-06 · ${method} ${path} sin token → 401`, async ({ anonymousApi }) => {
      const res = await anonymousApi.raw(method, path)
      expect(res.status()).toBe(401)
    })
  }
})
