import { env, OPERATOR_TIMEZONE } from '../../config/env'
import { UI_TEXT } from '../../data/oracle'
import { defect, expect, test } from '../../fixtures/test'
import { LoginPage } from '../../pages/LoginPage'

/**
 * Login y sesión por la UI · partición de equivalencia + transición de estados.
 * Estados: anónimo → (login) → autenticado → (logout) → anónimo.
 * Estos tests arrancan SIN sesión (anulan el storageState del proyecto).
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login · UI', { tag: '@regression' }, () => {
  test('CP-01 · credenciales válidas → entra al Despacho con el nombre del operador', async ({ page, loginPage, dashboard, shell }) => {
    await loginPage.goto()
    await loginPage.login(env.credentials.email, env.credentials.password)

    await expect(dashboard.heading).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(env.credentials.name, { exact: true })).toBeVisible()
    await expect(shell.logout).toBeVisible()
  })

  test('CP-02 · contraseña incorrecta → mensaje de error y sigue en /login', async ({ page, loginPage }) => {
    await loginPage.goto()
    await loginPage.login(env.credentials.email, 'incorrecta')

    await expect(loginPage.error).toHaveText(UI_TEXT.loginInvalid)
    await expect(page).toHaveURL(/\/login$/)
    await expect(loginPage.submit).toBeEnabled()
  })

  test('CP-03 · campos vacíos → validación en el cliente, sin llamar a la API', async ({ page, loginPage }) => {
    await loginPage.goto()
    let loginCalls = 0
    page.on('request', (req) => {
      if (req.url().includes('/auth/login')) loginCalls++
    })

    await loginPage.submit.click()
    await expect(loginPage.error).toHaveText(UI_TEXT.loginRequired)

    // Solo espacios en el email también es "vacío" (se recorta).
    await loginPage.login('   ', env.credentials.password)
    await expect(loginPage.error).toHaveText(UI_TEXT.loginRequired)
    expect(loginCalls).toBe(0)
  })

  test('CP-07 · ruta protegida sin sesión → redirige a /login', async ({ page, loginPage }) => {
    for (const path of ['/', '/medidores', '/medidores/M-109', '/anomalias', '/anomalias/M-109']) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/login$/)
      await expect(loginPage.heading).toBeVisible()
    }
  })

  /**
   * Intermitente (~40 % de las veces en los 3 motores): tras el login a veces se queda en el
   * Despacho en vez de volver a la ruta pedida. Para que el test sea determinístico se repite
   * el escenario 10 veces en contextos nuevos y se exige que TODAS vuelvan a la ruta pedida.
   */
  test.fail(
    'DEF-11 · CP-07 · tras entrar, siempre vuelve a la ruta protegida que se pidió (10 intentos)',
    defect('DEF-11', 'El login a veces ignora la ruta de retorno'),
    async ({ browser }, testInfo) => {
      test.setTimeout(180_000) // 10 logins completos; un timeout no debe confundirse con el defecto
      const target = '/anomalias/M-109'
      const landed: string[] = []
      for (let attempt = 1; attempt <= 10; attempt++) {
        const ctx = await browser.newContext({ baseURL: env.baseUrl, timezoneId: OPERATOR_TIMEZONE, locale: 'es-CO' })
        const page = await ctx.newPage()
        const login = new LoginPage(page)
        await page.goto(target)
        await expect(login.heading).toBeVisible()
        await login.login(env.credentials.email, env.credentials.password)
        await expect(page).not.toHaveURL(/\/login$/)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        landed.push(new URL(page.url()).pathname)
        await ctx.close()
      }
      await testInfo.attach('DEF-11-rutas-tras-login', { body: JSON.stringify(landed, null, 2), contentType: 'application/json' })
      const misses = landed.filter((p) => p !== target).length
      expect(misses, `aterrizó fuera de ${target} en ${misses}/10 intentos: ${landed.join(', ')}`).toBe(0)
    },
  )

  test('CP-08 · cerrar sesión borra la sesión y las rutas vuelven a pedir login', async ({ page, loginPage, dashboard, shell }) => {
    await loginPage.goto()
    await loginPage.login(env.credentials.email, env.credentials.password)
    await expect(dashboard.heading).toBeVisible()
    // Se espera a que el Despacho termine de cargar para no hacer clic con el layout en movimiento.
    await expect(dashboard.kpis).toBeVisible()

    await shell.logout.click()
    await expect(loginPage.heading).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('energyai')))).toEqual([])

    await page.goto('/medidores')
    await expect(page).toHaveURL(/\/login$/)
  })
})
