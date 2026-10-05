import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { env, OPERATOR_TIMEZONE, STORAGE_STATE } from './config/env'

const isCI = !!process.env.CI

/** Varias columnas de las tablas solo aparecen desde el breakpoint xl (1280 px). */
const viewport = { width: 1440, height: 900 }

const browsers = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'firefox', device: devices['Desktop Firefox'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
]

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  // Un reintento local absorbe caídas puntuales del navegador bajo carga (3 motores + 3 servidores);
  // Playwright marca esos casos como "flaky" en el reporte, no los oculta.
  retries: isCI ? 2 : 1,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: env.baseUrl,
    // Los operadores están en Colombia: el navegador corre en su zona horaria y su locale.
    timezoneId: OPERATOR_TIMEZONE,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // 1. Login por la UI una sola vez; los proyectos de navegador reutilizan el storageState.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport },
    },
    // 2. API: sin navegador, contra el backend directamente.
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: { baseURL: env.apiUrl },
    },
    // 3. UI en tres motores con la sesión ya iniciada.
    ...browsers.map(({ name, device }) => ({
      name,
      testMatch: /.*\.ui\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...device, viewport, storageState: STORAGE_STATE },
    })),
  ],

  // Levanta la app en modo desarrollo (README.md · "En desarrollo"). Con BASE_URL definido
  // se asume que ya está corriendo (por ejemplo con docker compose) y no se levanta nada.
  webServer: env.startLocalServers
    ? [
        {
          name: 'backend',
          command: 'go run ./cmd/api',
          cwd: path.resolve(__dirname, '../backend'),
          url: `${env.apiUrl}/health`,
          env: { PORT: '8080' },
          reuseExistingServer: !isCI,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'ignore',
        },
        {
          // Segunda instancia con un dataset sintético para probar los umbrales del motor
          // (valores límite) sin tocar los datos reales.
          name: 'backend-boundary',
          command: 'go run ./cmd/api',
          cwd: path.resolve(__dirname, '../backend'),
          url: `${env.boundaryApiUrl}/health`,
          env: { PORT: '8081', DATA_DIR: path.resolve(__dirname, 'data/boundary') },
          reuseExistingServer: !isCI,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'ignore',
        },
        {
          name: 'frontend',
          command: 'npx --yes pnpm@10 --dir ../frontend dev --port 5173 --strictPort',
          url: env.baseUrl,
          reuseExistingServer: !isCI,
          timeout: 180_000,
          stdout: 'ignore',
          stderr: 'ignore',
        },
      ]
    : undefined,
})
