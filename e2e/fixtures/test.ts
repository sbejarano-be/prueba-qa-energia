import { test as base, expect } from '@playwright/test'
import { EnergiaApi } from '../api/energia-api'
import { env } from '../config/env'
import { AnalysisSheet } from '../pages/AnalysisSheet'
import { AnomaliesPage } from '../pages/AnomaliesPage'
import { AppShell } from '../pages/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { InvestigationPage } from '../pages/InvestigationPage'
import { LoginPage } from '../pages/LoginPage'
import { MeterDetailPage } from '../pages/MeterDetailPage'
import { MetersPage } from '../pages/MetersPage'

interface Pages {
  loginPage: LoginPage
  shell: AppShell
  dashboard: DashboardPage
  metersPage: MetersPage
  meterDetail: MeterDetailPage
  anomaliesPage: AnomaliesPage
  investigation: InvestigationPage
  analysisSheet: AnalysisSheet
}

interface ApiFixtures {
  /** Cliente autenticado contra el backend bajo prueba. */
  api: EnergiaApi
  /** Cliente sin token (pruebas de autorización y del login). */
  anonymousApi: EnergiaApi
}

interface WorkerFixtures {
  /** JWT del operador, obtenido una vez por worker con el login de la API. */
  apiToken: string
}

export const test = base.extend<Pages & ApiFixtures, WorkerFixtures>({
  apiToken: [
    async ({ playwright }, use) => {
      const ctx = await playwright.request.newContext()
      await use(await EnergiaApi.token(ctx, env.apiUrl))
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],

  api: async ({ request, apiToken }, use) => {
    await use(new EnergiaApi(request, apiToken, env.apiUrl))
  },
  anonymousApi: async ({ request }, use) => {
    await use(new EnergiaApi(request, null, env.apiUrl))
  },

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shell: async ({ page }, use) => use(new AppShell(page)),
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  metersPage: async ({ page }, use) => use(new MetersPage(page)),
  meterDetail: async ({ page }, use) => use(new MeterDetailPage(page)),
  anomaliesPage: async ({ page }, use) => use(new AnomaliesPage(page)),
  investigation: async ({ page }, use) => use(new InvestigationPage(page)),
  analysisSheet: async ({ page }, use) => use(new AnalysisSheet(page)),
})

export { expect }

/** Anotación estándar de los tests que evidencian un defecto (ver qa/05-defectos.md). */
export const defect = (id: string, summary: string) => ({
  tag: '@defect',
  annotation: { type: 'issue', description: `${id} · ${summary} · qa/05-defectos.md` },
})
