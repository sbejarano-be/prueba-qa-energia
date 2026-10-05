import type { APIRequestContext, APIResponse } from '@playwright/test'
import { env } from '../config/env'
import type { MeterListRequest, TokenResponse } from './types'

const V1 = '/api/v1'

/**
 * Cliente de la API de EnergIA sobre el `request` de Playwright.
 * Devuelve el APIResponse crudo: cada test decide qué validar (status, headers, body).
 * Usa URLs absolutas para funcionar igual desde los proyectos de API y de navegador.
 */
export class EnergiaApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string | null = null,
    readonly baseUrl: string = env.apiUrl,
  ) {}

  /** Login con las credenciales del operador; devuelve el JWT. */
  static async token(request: APIRequestContext, baseUrl: string = env.apiUrl): Promise<string> {
    const res = await request.post(`${baseUrl}${V1}/auth/login`, {
      data: { email: env.credentials.email, password: env.credentials.password },
    })
    if (!res.ok()) throw new Error(`Login fallido contra ${baseUrl}: ${res.status()} ${await res.text()}`)
    return ((await res.json()) as TokenResponse).access_token
  }

  /** Mismo cliente con otro token (o sin token) para pruebas de autorización. */
  withToken(token: string | null): EnergiaApi {
    return new EnergiaApi(this.request, token, this.baseUrl)
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra }
  }

  health(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}/health`)
  }

  /** `body` es `unknown` a propósito: las pruebas negativas mandan cuerpos inválidos. */
  login(body: unknown): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${V1}/auth/login`, { data: body as object })
  }

  /** Login con el cuerpo como texto plano (JSON malformado, vacío...). */
  loginRaw(rawBody: string): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${V1}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      // Con data '' Playwright envía el string JSON '""'; un cuerpo vacío real va sin data.
      ...(rawBody === '' ? {} : { data: Buffer.from(rawBody) }),
    })
  }

  me(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/auth/me`, { headers: this.headers() })
  }

  meterParams(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/meter/getParams`, { headers: this.headers() })
  }

  meters(body?: MeterListRequest | Record<string, unknown>): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${V1}/meter/getAll`, {
      headers: this.headers(),
      ...(body === undefined ? {} : { data: body }),
    })
  }

  meter(id: string): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/meter/getById/${encodeURIComponent(id)}`, { headers: this.headers() })
  }

  anomalies(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/anomaly/getAll`, { headers: this.headers() })
  }

  dashboard(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/dashboard/getSummary`, { headers: this.headers() })
  }

  analyze(): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${V1}/ai/analyze`, { headers: this.headers() })
  }

  analysis(id: string): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/ai/analysis/${encodeURIComponent(id)}`, { headers: this.headers() })
  }

  latestAnalysis(): Promise<APIResponse> {
    return this.request.get(`${this.baseUrl}${V1}/ai/analysis/latest`, { headers: this.headers() })
  }

  /** Petición libre (método o ruta arbitrarios) para pruebas negativas. */
  raw(method: string, path: string, headers?: Record<string, string>): Promise<APIResponse> {
    return this.request.fetch(`${this.baseUrl}${path}`, { method, headers: this.headers(headers) })
  }
}
