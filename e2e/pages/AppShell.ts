import type { Locator, Page } from '@playwright/test'

type Section = 'Despacho' | 'Medidores' | 'Anomalías IA'

/** Barra superior común a todas las pantallas con sesión. */
export class AppShell {
  readonly nav: Locator
  readonly runAnalysis: Locator
  readonly logout: Locator
  readonly main: Locator

  constructor(private readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Principal' })
    // El nombre accesible incluye una pista sr-only; basta con que contenga el texto visible.
    this.runAnalysis = page.getByRole('button', { name: /Run AI Analysis|Analizando/ })
    this.logout = page.getByRole('button', { name: 'Cerrar sesión' })
    this.main = page.getByRole('main')
  }

  navLink(section: Section): Locator {
    return this.nav.getByRole('link', { name: section, exact: true })
  }

  async goTo(section: Section): Promise<void> {
    await this.navLink(section).click()
  }

  /** Título h1 de la pantalla actual. */
  pageTitle(): Locator {
    return this.page.getByRole('heading', { level: 1 })
  }
}
