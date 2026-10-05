import { expect, type Locator, type Page } from '@playwright/test'

/** /login · formulario de acceso. */
export class LoginPage {
  readonly heading: Locator
  readonly email: Locator
  readonly password: Locator
  readonly submit: Locator
  readonly error: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Iniciar sesión' })
    this.email = page.getByLabel('Email')
    this.password = page.getByLabel('Contraseña')
    this.submit = page.getByRole('button', { name: 'Entrar' })
    this.error = page.getByRole('alert')
  }

  async goto(): Promise<void> {
    await this.page.goto('/login')
    await expect(this.heading).toBeVisible()
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }
}
