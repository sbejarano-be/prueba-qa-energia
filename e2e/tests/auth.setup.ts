import { env, STORAGE_STATE } from '../config/env'
import { expect, test as setup } from '../fixtures/test'

/**
 * Login por la UI una sola vez. El JWT queda en localStorage (energyai.token) y
 * Playwright lo guarda en .auth/operator.json; los proyectos de navegador arrancan
 * ya autenticados con ese storageState.
 */
setup('autenticar al operador', async ({ page, loginPage, dashboard }) => {
  await loginPage.goto()
  await loginPage.login(env.credentials.email, env.credentials.password)

  await expect(dashboard.heading).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('energyai.token'))).toBeTruthy()

  await page.context().storageState({ path: STORAGE_STATE })
})
