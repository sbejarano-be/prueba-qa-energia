# 01 · Plan de pruebas · EnergIA

**Build bajo prueba:** commit `15765d9` (rama `main`) · **Fecha:** 2026-10-02 · **Entorno:** Windows 11, Go 1.26.5, Node 22.22, app en modo desarrollo (backend `:8080`, frontend Vite `:5173`); navegadores Chromium 153, Firefox 155 y WebKit 26.6 con zona horaria `America/Bogota` y locale `es-CO`.

## Resumen ejecutivo

**Recomendación: no liberar este build a producción.**

El motor de anomalías es sólido. Reproduce exactamente los 4 resultados del README: tipo, severidad, confianza, prioridad y cifras de M-109. También cumple sus umbrales en casi todos los valores límite. Los problemas están en **cómo se le presenta al operador**. Tres defectos de prioridad alta afectan directamente la decisión que el producto debe ayudar a tomar ("¿qué reviso primero y por qué?"):

1. **DEF-01:** el falso positivo **M-106 aparece como "Alerta"**. El README dice que no debe escalarse. El conteo del Despacho (8/2/2 en vez de 9/1/2) y el filtro por estado heredan el error. El producto contradice su propia recomendación de "No escalar".
2. **DEF-02:** **todas las horas de planta se muestran desplazadas −5 h** en Colombia, que es justo donde están los usuarios. La pantalla de investigación de M-109 dice "Detectada 12/09 09:00" junto a un texto del motor que dice "desde 12/09 14:00". Un operador que vaya a sitio buscará el evento a la hora equivocada.
3. **DEF-03:** **M-111 y M-112 no se pueden alcanzar** desde la paginación del Libro de medidores. M-112 es la anomalía crítica número 2.

Los tres son de bajo esfuerzo de corrección (una rama, `getUTC*` y `Math.ceil`) y ya tienen un test automatizado que pasará en cuanto se corrijan. **Con DEF-01, DEF-02 y DEF-03 corregidos y la suite en verde, la recomendación cambia a liberar con riesgos conocidos.**

**Riesgos que quedan abiertos:**

| Riesgo | Defecto | Impacto |
|---|---|---|
| El login a veces descarta la ruta de retorno | DEF-11, ~40 % de las veces | Fricción al abrir enlaces directos |
| La búsqueda por medidor distingue mayúsculas | DEF-04 | — |
| Robustez de la API ante entradas inválidas | DEF-05, DEF-09 | 500 con página negativa, 404 en vez de 405 |
| Severidad en el límite exacto de 50 % / 20 % | DEF-07 | No ocurre con los datos actuales |
| Una hora faltante en datos reales dispara "calidad de datos" con un texto vacío | DEF-08 | Muy probable con medidores reales: los datos llegan con huecos |
| La fórmula de confianza se muestra sin paréntesis | DEF-10 | Contradice el principio de "evidencia sobre afirmación" |

**Sin cobertura en esta entrega:** la redacción con OpenAI (no hay key), el rendimiento y la seguridad en profundidad.

## Alcance

**Dentro del alcance:**

| Área | Qué se prueba | Por qué |
|---|---|---|
| Motor de anomalías (vía API) | Tipo, severidad, confianza, prioridad y evidencia de las 4 anomalías; tabla de estado de alerta; umbrales con valores límite | Es el núcleo del producto: si clasifica mal, todo lo demás sobra |
| API REST | Login y JWT, `meter/getAll` (filtros, orden, paginación), `getById`, `anomaly/getAll`, `dashboard/getSummary`, Run AI Analysis, formato de errores | Contrato documentado en el README y Swagger; es la capa más barata de automatizar |
| UI | Login y sesión; Despacho (órdenes y KPIs); Libro de medidores (filtros en URL, orden, paginación); detalle; Anomalías IA; investigación; Run AI Analysis | Es lo que ve el operador; la documentación define qué debe mostrar |
| Consistencia entre capas | UI = API = documentación en cifras, estados, horas y conteos | El enunciado lo pide explícitamente; los defectos más graves aparecen aquí |
| Código (caja blanca) | `meter` (estado, filtros, paginación), `frontend/lib/format.ts` + `Pagination.tsx`, `analysis/classify` + `quality`; tests existentes | Son los módulos de mayor riesgo según el análisis de abajo |

**Fuera del alcance:**

| Qué | Motivo |
|---|---|
| Redacción con OpenAI (`narrated_by=openai:*`) | No hay key; el narrador por defecto (`engine`) sí se prueba |
| Rendimiento y carga | 12 medidores en memoria; no hay requisito de rendimiento |
| Seguridad en profundidad | Se cubre la autenticación funcional (JWT inválido, vencido, `alg: none`); no pentesting |
| Regresión visual de gráficas | El contenido de las gráficas (Recharts) se valida de forma indirecta con sus datos |
| Despliegue Docker | El daemon no estaba disponible; la suite soporta Docker con `BASE_URL` (ver `e2e/README.md`) |
| Accesibilidad completa (WCAG) | Solo observaciones; los locators por rol ya validan la semántica básica |

## Análisis de riesgos (priorizado)

La prioridad es impacto × probabilidad. El impacto se mide en qué tanto afecta la decisión del operador.

| # | Riesgo | Impacto | Prob. | Prioridad | Cómo se mitiga |
|---|---|---|---|---|---|
| R1 | El estado o la clasificación que ve el operador no coinciden con lo que dice el motor | Alto | Media | **Crítica** | Tablas de decisión en API y UI (CP-15, CP-16, CP-18, CP-22) |
| R2 | Fechas y horas de planta mal mostradas (zona horaria) | Alto | Alta (usuarios en UTC−5) | **Crítica** | UI con `timezoneId: America/Bogota` (CP-23) |
| R3 | Medidores inalcanzables o mal filtrados en el libro | Alto | Media | **Alta** | Partición de equivalencia y valores límite en API y UI (CP-09 a CP-13, CP-19 a CP-21) |
| R4 | Acceso sin autenticación o sesión inconsistente | Alto | Baja | **Alta** | CP-01 a CP-08, todas las rutas protegidas sin token |
| R5 | Umbrales del motor mal implementados en los bordes | Medio | Media | **Media** | Dataset sintético de valores límite (BVA-01 a BVA-08) |
| R6 | Run AI Analysis no termina o cambia resultados | Medio | Baja | **Media** | Transición de estados de los 7 pasos; determinismo (CP-25) |
| R7 | Robustez de la API ante entradas inválidas | Bajo | Media | **Baja** | Pruebas negativas (CP-05, CP-10, DEF-05, DEF-09) |

## Tipos de prueba y capa

| Tipo | Capa | Herramienta | Técnicas |
|---|---|---|---|
| Humo | API + UI | Playwright (`@smoke`) | Camino feliz mínimo (ver `02-smoke.md`) |
| Funcional caja negra | API | Playwright `request` | Partición de equivalencia, valores límite, tablas de decisión, pruebas negativas |
| Funcional caja negra | UI | Playwright, 3 navegadores | Transición de estados (sesión, análisis), partición de equivalencia (filtros), E2E de negocio |
| Consistencia entre capas | UI ↔ API ↔ documentación | Playwright | Oráculo documental (`e2e/data/oracle.ts`) + comparación de la UI con la API |
| Valores límite del motor | API (segunda instancia) | Playwright + dataset sintético | Valores límite de umbrales documentados (50 %, 20 %, 6 h, 3 h) |
| Caja blanca | Unitario | Revisión de código + `go test` / `vitest` existentes | Cobertura de ramas, condiciones de borde, calidad de los oráculos de los tests |
| Exploratoria | UI | Manual, guiada por riesgos | Sesiones cortas sobre R1–R3 |

## Criterios de entrada y salida

**Entrada:**
1. La app levanta según el README (backend `/health` = 200 y frontend responde).
2. La suite de humo (`npm run test:smoke`) está 100 % en verde: login, datos cargados y motor ejecutado.
3. La documentación (README, backend/README, frontend/README, PRODUCT.md, Swagger) está disponible como oráculo.

**Salida:**
1. Los 25 casos de caja negra y los 8 de humo se ejecutaron, con su resultado registrado.
2. Cada defecto está reportado con pasos, evidencia, severidad y prioridad, y tiene un test automatizado que lo reproduce (`test.fail()`).
3. La suite automatizada está en verde en los 3 navegadores: solo fallan los defectos conocidos, marcados como esperados.
4. No quedan defectos críticos abiertos **para liberar**. Hoy este criterio **no se cumple** (DEF-01, DEF-02 y DEF-03).

## Resultado de la ejecución

| Suite | Tests | Resultado |
|---|---|---|
| Playwright · API (`api`) | 98 | 87 pasan · 11 fallan como se espera (defectos) |
| Playwright · UI (`chromium` / `firefox` / `webkit`) | 37 × 3 = 111 | 28 × 3 pasan · 9 × 3 fallan como se espera (defectos) |
| Playwright · login reutilizable (`setup`) | 1 | Pasa |
| **Total suite e2e** | **210** | **210 en verde** (172 pasan + 38 fallos esperados por defecto), 5,2 min, 0 flaky en la corrida final. En corridas previas bajo carga hubo 2 incidentes aislados de navegador en CP-08 (24 de 24 aislado; ver e2e/README.md · Reintentos) |
| Existentes · backend `go test ./...` | 96 | 96 pasan · cobertura 84,2 % (`-coverpkg`) |
| Existentes · frontend `pnpm test` / lint / typecheck | 11 | 11 pasan · lint y typecheck limpios |

**Defectos encontrados:** 11 en total. Por severidad: 3 alta (DEF-01, DEF-02, DEF-08), 5 media y 3 baja. Por prioridad, 3 son altas (DEF-01, DEF-02, DEF-03) y bloquean la liberación. El detalle está en `05-defectos.md`.

## Supuestos

| ID | Supuesto | Por qué |
|---|---|---|
| S-01 | El "oráculo" es la documentación: si el código y el README difieren, el defecto es del código | Así lo define `PRUEBA_QA.md` §1.3 |
| S-02 | Las horas del dataset son hora de planta y deben verse tal cual, en cualquier zona del navegador | frontend/README y PRODUCT.md |
| S-03 | El email del login no distingue mayúsculas; la contraseña sí | Práctica estándar (RFC 5321 en la práctica); el README no lo dice |
| S-04 | "Supera 50 %" significa estrictamente mayor que 50 % | Lectura literal del README §8 |
| S-05 | `page` y `size` explícitos menores que 1 son inválidos (400), aunque omitirlos aplique los valores por defecto | Swagger: `minimum: 1` |
| S-06 | Un método HTTP no soportado sobre una ruta existente debe responder 405 | RFC 9110; el README no lo especifica, por eso es de severidad baja |
