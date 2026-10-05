# Entrega · Prueba técnica QA · EnergIA

> **Video de la entrega** 
https://drive.google.com/file/d/1IKtFs4fv0RcsrgSd_sSBG-XAHq1Z3VOM/view?usp=sharing

## Veredicto

**No liberar este build.** El motor de anomalías funciona como documenta el README. Pero hay tres defectos de prioridad alta que engañan al operador:

- el falso positivo M-106 aparece como "Alerta" (DEF-01);
- todas las horas de planta se ven 5 h antes en Colombia (DEF-02);
- dos medidores, entre ellos el crítico M-112, no se alcanzan con la paginación (DEF-03).

El resumen ejecutivo completo y los riesgos abiertos están en [01-plan-de-pruebas.md](01-plan-de-pruebas.md#resumen-ejecutivo).

## Contenido

| Archivo | Parte del enunciado | Qué hay |
|---|---|---|
| [01-plan-de-pruebas.md](01-plan-de-pruebas.md) | A · Estrategia y plan · **Resumen ejecutivo** | Alcance, riesgos priorizados, tipos de prueba por capa, criterios de entrada y salida, resultados, supuestos |
| [02-smoke.md](02-smoke.md) | B · Humo | 8 casos, por qué está cada uno y su resultado (15 de 15 en verde) |
| [03-casos-caja-negra.md](03-casos-caja-negra.md) | C · Caja negra (UI y API) | 25 casos con su técnica (PE, VL, TD, TE, NEG, CC), el flujo E2E y 8 valores límite del motor |
| [04-caja-blanca.md](04-caja-blanca.md) | D · Caja blanca | 4 módulos revisados, análisis de los tests existentes (incluido uno que fija un defecto y un entorno que oculta otro) y 7 tests unitarios propuestos y verificados |
| [05-defectos.md](05-defectos.md) | E · Defectos | 11 defectos con severidad y prioridad, pasos, `curl`, evidencia, causa raíz (archivo y línea) y detección automática |
| [evidencias/](evidencias/) | E · Evidencia | Capturas (`.png`) y request/response (`.txt`) generadas por los tests de Playwright |
| [../e2e/](../e2e/README.md) | F · Automatización | Playwright + TypeScript: 210 tests en API y 3 navegadores, Page Objects, fixtures, `storageState`, `timezoneId` y CI |
| [../.github/workflows/e2e.yml](../.github/workflows/e2e.yml) | F · Opcional | Workflow que levanta la app y corre la suite, con el reporte HTML como artefacto |

## Cómo reproducir todo

```bash
cd e2e
npm run setup        # una vez
npm test             # levanta la app (backend, backend de valores límite y frontend) y corre las 210 pruebas
npm run report       # reporte HTML con trazas, videos y adjuntos de evidencia
```

Para regenerar `qa/evidencias/`:

```bash
EVIDENCE_DIR=../qa/evidencias npx playwright test --grep @defect --project=api --project=chromium
```

## Decisiones tomadas (lo que el enunciado no fijaba)

- **Docker no estaba disponible** (daemon apagado). La app se probó en modo desarrollo, como describe el README (`go run` + Vite), levantada por el `webServer` de Playwright. La suite también corre contra Docker con `BASE_URL`.
- **Oráculo = documentación.** Si el código y la documentación difieren, se reporta como defecto del código. Los supuestos de interpretación (S-01 a S-06) están en el plan.
- **Valores límite del motor con datos sintéticos.** Se probaron con un dataset generado a partir de los umbrales del README, servido por una segunda instancia del backend. No se modificó ni el código ni los datos de la app.
- **No se modificó el código de la aplicación.** Los tests unitarios faltantes se proponen en `04-caja-blanca.md`. Se verificaron en una copia aislada, fuera del repo.

## Uso de IA

Se usó **Claude Code** (Anthropic) como asistente durante toda la prueba. Ninguna conclusión se tomó solo por lo que dijo la IA. Todas se verificaron con ejecución real: cada defecto se reprodujo con la app corriendo y tiene evidencia generada por un test automatizado.

| Para qué | Cómo se controló |
|---|---|
| Leer y resumir la documentación y el código (mapa de pantallas, roles ARIA, endpoints y reglas del motor) | Se contrastó cada afirmación con el archivo y la línea citados, y con la app corriendo |
| Proponer defectos candidatos en la revisión de caja blanca | Solo se reportó lo que se reprodujo como caja negra (UI, `curl` o dataset sintético). Un candidato sin evidencia quedó como "observación" o se descartó |
| Generar el esqueleto del proyecto de Playwright, los Page Objects y los specs | Se ejecutó la suite completa en los 3 navegadores. Los fallos de la propia prueba (locators ambiguos, redondeo del oráculo, lectura de la tabla antes de tiempo) se corrigieron hasta separar con claridad los fallos de la prueba de los defectos de la app |
| Redactar los documentos de `qa/` | Las cifras y resultados salen de las corridas reales (conteos, cobertura, salidas de `curl`) |

**Un ejemplo de por qué hace falta verificar:** la primera versión del test del login con retorno pasaba o fallaba al azar. En vez de marcarlo como inestable, se repitió 12 veces en los 3 navegadores. Así se confirmó un defecto intermitente real (DEF-11, ~40 %), y el test se rediseñó para detectarlo de forma determinística (10 intentos por corrida).
