# EnergIA · Suite E2E y de API (Playwright + TypeScript)

Pruebas automatizadas de la Parte F de [PRUEBA_QA.md](../PRUEBA_QA.md):

- Un flujo E2E de negocio.
- Pruebas funcionales de UI y de API.
- Valores límite del motor de anomalías.
- Un test por cada defecto encontrado, marcado con `test.fail()`.

La estrategia, los casos y los defectos están en [`../qa/`](../qa/README.md).

## Cómo correrla

Requisitos: **Node 20.19+**, **Go 1.26+** (el backend se levanta con `go run`) y conexión a internet la primera vez (descarga de navegadores y de pnpm).

```bash
cd e2e
npm run setup   # una sola vez: dependencias, navegadores y dependencias del frontend
npm test        # levanta la app y corre toda la suite
```

`npm test` es el único comando que hace falta. El `webServer` de Playwright levanta todo solo y lo apaga al terminar:

| Servicio | URL | Para qué |
|---|---|---|
| Backend (`go run ./cmd/api`) | http://localhost:8080 | API bajo prueba con el dataset real |
| Backend de valores límite | http://localhost:8081 | Misma API con el dataset sintético de [`data/boundary`](data/boundary/README.md) |
| Frontend (Vite, `pnpm dev`) | http://localhost:5173 | UI bajo prueba |

Si ya tienes la app corriendo en esos puertos, la suite la reutiliza (fuera de CI).

### Contra Docker u otro entorno

```bash
docker compose up -d --build                                          # desde la raíz del repo
BASE_URL=http://localhost:3000 API_URL=http://localhost:8080 npm test  # no levanta nada
```

Con `BASE_URL` definido la suite no levanta servidores. Las pruebas de valores límite se saltan si no hay backend en `BOUNDARY_API_URL`.

En PowerShell las variables se definen antes del comando:

```powershell
$env:BASE_URL = 'http://localhost:3000'; npm test
```

### Otros scripts

| Script | Qué corre |
|---|---|
| `npm run test:smoke` | Solo la suite de humo (`@smoke`): 5 pruebas de API y 3 de UI por navegador |
| `npm run test:api` | Solo el proyecto `api`, sin navegador |
| `npm run test:ui` | Solo la UI en chromium |
| `npm run test:defects` | Solo los tests que evidencian defectos (`@defect`) |
| `npm run report` | Abre el último reporte HTML (trazas, videos y capturas de los fallos) |
| `npm run typecheck` | `tsc --noEmit` de toda la suite |
| `npm run generate:boundary-data` | Regenera el dataset sintético de valores límite |

Para regenerar las evidencias de [`qa/05-defectos.md`](../qa/05-defectos.md) (capturas y request/response):

```bash
EVIDENCE_DIR=../qa/evidencias npx playwright test --grep @defect --project=api --project=chromium
```

## Cómo leer el resultado

Hoy, con el build entregado, la suite termina **toda en verde**. Los defectos conocidos están marcados con `test.fail()`:

- Hoy fallan como se espera y Playwright los cuenta como correctos.
- Cuando el defecto se corrija, el test "pasará inesperadamente" y la suite se pondrá roja. Ahí se quita el `test.fail()` y el test queda como prueba de regresión.

Cada uno lleva el tag `@defect` y una anotación `issue` con su ID (`DEF-xx`), visible en el reporte HTML.

| Proyecto | Qué corre | Tests |
|---|---|---|
| `setup` | Login por la UI, una vez; guarda `.auth/operator.json` | 1 |
| `api` | `*.api.spec.ts` con el `request` de Playwright | 98 |
| `chromium` · `firefox` · `webkit` | `*.ui.spec.ts` con la sesión ya iniciada | 37 × 3 |

## Estructura

```
e2e/
├── playwright.config.ts      proyectos, webServer, timezoneId America/Bogota, locale es-CO, trazas/video en fallo
├── config/env.ts             URLs y credenciales (variables de entorno con valores por defecto)
├── fixtures/test.ts          test.extend: page objects, cliente de API autenticado (token por worker), helper `defect()`
├── api/                      cliente tipado de la API (energia-api.ts) y contrato (types.ts)
├── pages/                    Page Objects: Login, AppShell, Dashboard, Meters, MeterDetail, Anomalies, Investigation, AnalysisSheet
├── data/                     oráculo (valores del README), casos de partición de equivalencia y valores límite, dataset sintético
├── utils/                    lectura de tablas por roles ARIA, formato es-CO independiente, aserciones de cifras, evidencias
├── scripts/                  generador del dataset de valores límite
└── tests/
    ├── auth.setup.ts         login reutilizable (storageState)
    ├── smoke/                SMK-01..08
    ├── api/                  auth, medidores, anomalías (tablas de decisión), dashboard, análisis, valores límite del motor
    ├── ui/                   login, flujo E2E de negocio, libro de medidores, anomalías, análisis, consistencia entre capas
    └── defects/              DEF-xx de API y de UI (test.fail)
```

## Decisiones de diseño

- **Locators accesibles.** Se usan `getByRole`, `getByLabel` y `getByText`, y no hay ningún selector CSS de clases ni de `data-testid` (la app no tiene). La excepción documentada es `utils/field.ts`: las casillas "etiqueta + valor" de la app son `<span>` sin asociación programática, así que se ancla en el texto exacto de la etiqueta. Es un hallazgo de accesibilidad ([qa/04](../qa/04-caja-blanca.md)).
- **Cero esperas fijas.** No hay ningún `waitForTimeout`. Todo usa `expect` web-first, y `expect.poll` donde la UI conserva datos anteriores (`keepPreviousData`) o donde el backend hace polling.
- **Login reutilizable.** El proyecto `setup` hace login por la UI y guarda el `storageState`. Los specs de login y el flujo E2E arrancan sin sesión a propósito.
- **Oráculo independiente.** Los valores esperados salen de la documentación (`data/oracle.ts`) y el formato es-CO está escrito a mano (`utils/format.ts`), no con el `Intl` del navegador. Las cifras de la UI se comparan con la API con tolerancia de medio dígito (`utils/assertions.ts`), así que el modo de redondeo no genera falsos positivos.
- **Zona horaria de los operadores.** Todos los navegadores corren con `timezoneId: 'America/Bogota'`, que es lo que hace visible DEF-02.
- **Datos de valores límite aislados.** Los umbrales del motor (50 %, 20 %, 6 h, 3 h) no aparecen en el dataset real. Se prueban con un dataset sintético servido por una segunda instancia del backend, sin tocar los datos ni el código de la app.
- **Estado compartido.** Run AI Analysis modifica el historial de corridas del servidor. Esas pruebas no asumen IDs fijos y aceptan 200 o 202 cuando ya hay una corrida en curso.
- **Reintentos.** Hay 1 reintento local y 2 en CI. Con la suite completa en una laptop de 8 núcleos (4 workers, 3 motores y 3 servidores) se vieron dos incidentes puntuales en CP-08, con síntomas distintos:
  - Firefox: "Target page, context or browser has been closed" al crear el contexto.
  - WebKit: el botón nunca quedó "estable" para el clic.

  Aislado, CP-08 pasó 24 de 24 en los 3 navegadores. Un test que pasa al reintentar sale como **flaky** en el reporte, a la vista. Los defectos intermitentes reales (DEF-11) no dependen de reintentos: el test repite el escenario adentro. Si la máquina es más modesta, usa `npx playwright test --workers=2`.

## CI

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) instala Go, Node y pnpm, levanta la app con el mismo `webServer` y corre la suite en los 3 navegadores. El reporte HTML queda como artefacto del run.

## Problemas conocidos del entorno

- **Windows Smart App Control** puede bloquear el ejecutable temporal de `go run` (ver `backend/README.md`). Si el backend no arranca, levántalo a mano (`cd backend && go run ./cmd/api`) y la suite lo reutiliza.
- **Puertos ocupados (8080, 8081, 5173):** la suite reutiliza lo que esté escuchando. Si es otra app, libera el puerto o usa `BASE_URL` y `API_URL`.
