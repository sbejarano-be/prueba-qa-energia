import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { APIResponse, Page, TestInfo } from '@playwright/test'

/**
 * Evidencia de los defectos. Siempre se adjunta al reporte HTML; si se define
 * EVIDENCE_DIR (por ejemplo ../qa/evidencias) también se guarda allí con un nombre fijo,
 * para regenerar las evidencias de qa/05-defectos.md con un comando.
 */
const evidenceDir = process.env.EVIDENCE_DIR ? resolve(process.env.EVIDENCE_DIR) : null

function persist(name: string, body: Buffer | string): void {
  if (!evidenceDir) return
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, name), body)
}

/** Captura de pantalla de la página completa. `name` sin extensión, p. ej. "DEF-02-investigacion-M-109". */
export async function screenshotEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const body = await page.screenshot({ fullPage: true })
  await testInfo.attach(name, { body, contentType: 'image/png' })
  // Una sola copia por defecto: la del primer proyecto que la genere (normalmente chromium).
  if (testInfo.project.name === 'chromium') persist(`${name}.png`, body)
}

/** Request/response de la API en texto plano (equivalente a `curl -i`). */
export async function apiEvidence(
  testInfo: TestInfo,
  name: string,
  request: { method: string; url: string; body?: unknown; anonymous?: boolean },
  response: APIResponse,
): Promise<void> {
  const headers = Object.entries(response.headers())
    .filter(([k]) => ['content-type', 'allow'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
  const text = [
    `> ${request.method} ${request.url}`,
    ...(request.anonymous ? [] : ['> Authorization: Bearer <token del operador>']),
    ...(request.body === undefined ? [] : ['> Content-Type: application/json', `> ${JSON.stringify(request.body)}`]),
    '',
    `< HTTP ${response.status()} ${response.statusText()}`,
    ...headers.map((h) => `< ${h}`),
    `< ${await response.text()}`,
    '',
  ].join('\n')
  await testInfo.attach(name, { body: text, contentType: 'text/plain' })
  persist(`${name}.txt`, text)
}
