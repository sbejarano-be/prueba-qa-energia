# 03 · Casos de prueba de caja negra (UI y API)

Los casos se diseñaron **solo a partir de la documentación**, que es el oráculo: README.md, backend/README.md, frontend/README.md, frontend/PRODUCT.md y Swagger. Cada caso indica la técnica que aplica y la fuente del resultado esperado. Todos están automatizados (columna **Test**, en `e2e/tests/`).

**Precondición común:**
- App levantada con el dataset original.
- Operador `admin@energia.local` autenticado, salvo indicación contraria.
- Navegador con zona horaria `America/Bogota` y locale `es-CO`.

**Ejecución:** 2026-10-02 · commit `15765d9` · Chromium 153 / Firefox 155 / WebKit 26.6.

**Estados:**
- ✅ Pasa
- ❌ Falla, con defecto reportado en `05-defectos.md`
- ⚠️ Pasa con observación

**Técnicas:**
- **PE:** partición de equivalencia.
- **VL:** valores límite.
- **TD:** tabla de decisión.
- **TE:** transición de estados.
- **NEG:** prueba negativa.
- **CC:** consistencia entre capas.

## Resumen

| Área | Casos | ✅ | ❌ | Defectos |
|---|---|---|---|---|
| Login y sesión | CP-01 … CP-08 | 7 | 1 | DEF-11 |
| Medidores (API) | CP-09 … CP-14 | 3 | 3 | DEF-01, DEF-04, DEF-05 |
| Motor y dashboard (API) | CP-15 … CP-18 | 1 | 3 | DEF-01, DEF-10 |
| Libro de medidores (UI) | CP-19 … CP-21 | 0 | 3 | DEF-03, DEF-04, DEF-06 |
| Consistencia entre capas (UI) | CP-22 … CP-24 | 1 | 2 | DEF-01, DEF-02 |
| Run AI Analysis | CP-25 | 1 | 0 | — |
| **Total** | **25** | **13** | **12** | 9 defectos distintos (DEF-09 como observación en CP-05) + 2 del motor por valores límite (ver al final) |

Un caso "❌" puede tener varias verificaciones correctas y una sola fallida. El detalle está en "Resultado obtenido".

---

## Login y sesión

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-01 | Login con credenciales válidas · PE (clase válida), TE anónimo → autenticado | Sin sesión, abrir `/login`, escribir `admin@energia.local` / `admin123` y pulsar **Entrar** | Va al Despacho (`/`), muestra el nombre "Operador" y el botón **Cerrar sesión** (README · credenciales) | Igual al esperado en los 3 navegadores | ✅ | `ui/login.ui.spec.ts` |
| CP-02 | Contraseña incorrecta · PE (clase inválida) | Email válido, contraseña `incorrecta` | Alerta "Email o contraseña incorrectos…"; sigue en `/login`; el botón se rehabilita | Igual al esperado | ✅ | `ui/login.ui.spec.ts` |
| CP-03 | Campos vacíos o solo espacios · PE (inválida), validación en el cliente | 1) Enviar vacío. 2) Email `"   "` y contraseña válida | Alerta "Escribe tu email y tu contraseña."; **ninguna** petición a `/auth/login` | Igual al esperado; 0 peticiones | ✅ | `ui/login.ui.spec.ts` |
| CP-04 | Login API: clases de equivalencia · PE | `POST /auth/login` con: V1 válido · V2 email en MAYÚSCULAS · V3 email con espacios · I1 contraseña errónea · I2 email inexistente · I3 contraseña en MAYÚSCULAS | V1–V3 → 200 + token + `user`; I1–I3 → 401 "Email o contraseña incorrectos" con el **mismo** mensaje para I1 e I2, sin revelar si el usuario existe (README · Login; supuesto S-03) | Igual al esperado | ✅ | `api/auth.api.spec.ts` |
| CP-05 | Login API: cuerpos inválidos · NEG | `{}` · solo email · `{"email":"   ","password":""}` · campo extra `role` · JSON malformado `{"email":` · cuerpo vacío | 400 con el formato de error único (`status_code`, `message`, `timestamp`, `path`); `errors` lista `email es obligatorio` y `password es obligatorio` (README · formato de errores) | 400 con el formato correcto. ⚠️ Con un tipo incorrecto (`"email":1`) el `message` expone el parser de Go y falta `errors` (DEF-09) | ⚠️ | `api/auth.api.spec.ts`, `defects/defects.api.spec.ts` |
| CP-06 | Autorización con JWT · TD (header × token → acceso) | `GET /auth/me` con: sin header · `Basic …` · `Bearer ` vacío · no JWT · firmado con otro secreto · `alg: none` · vencido · firma alterada; y las 7 rutas protegidas sin token | Token válido → 200 con el usuario del token. Todos los demás → 401 con el formato de error (README · "Todas las demás rutas lo exigen") | Igual al esperado (15 combinaciones) | ✅ | `api/auth.api.spec.ts` |
| CP-07 | Ruta protegida sin sesión → login → retorno · TE | Sin sesión, abrir `/`, `/medidores`, `/medidores/M-109`, `/anomalias`, `/anomalias/M-109`; luego entrar desde `/anomalias/M-109` (10 intentos, contexto nuevo en cada uno) | Cada ruta redirige a `/login`; tras entrar vuelve **siempre** a la ruta pedida | La redirección a `/login` es correcta. El retorno **falla de forma intermitente**: en ~40 % de los intentos termina en el Despacho (5 de 12 en una muestra, en los 3 motores) | ❌ DEF-11 | `ui/login.ui.spec.ts` |
| CP-08 | Cerrar sesión · TE autenticado → anónimo | Entrar, pulsar **Cerrar sesión** y abrir `/medidores` | Vuelve a `/login`; no queda token en el almacenamiento; las rutas vuelven a pedir login | Igual al esperado | ✅ | `ui/login.ui.spec.ts` |

## Medidores (API)

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-09 | Tamaño de página · VL | `POST /meter/getAll` sin body; `size` = 1, 2, 12, 100 (máx.), 101 (máx.+1), −1 | Sin body: página 1 de 10, por `meter_id`. `size` de 1 a 100 → 200 con `min(size,12)` filas y `count 12`. 101 y −1 → 400 "Filtros inválidos" con `pagination.size…` (README; Swagger `size` 1..100) | Igual al esperado. Observación: `size: 0` se acepta en silencio y aplica 10 (Swagger dice `minimum: 1`; supuesto S-05) | ✅ | `api/meters.api.spec.ts` |
| CP-10 | Número de página · VL + NEG | `page` = 1, 2 (última, parcial), 3 (fuera de rango), 3 con `size` 4 (última exacta); recorrer todo con `size` 5; `page` = −1 y −100 | 1 → 10 filas; 2 → M-111 y M-112; 3 → `[]` con `count 12`; recorrido sin repetidos. **−1 y −100 → 400** (Swagger `page minimum: 1`) | Rango válido correcto. **`page: -1` → 500 "Error interno del servidor"** | ❌ DEF-05 | `api/meters.api.spec.ts`, `defects/defects.api.spec.ts` |
| CP-11 | Filtro por estado · PE | `status` = CRITICAL · NORMAL · ALERT · `ROJO` · CRITICAL + `meter_id` "112"; y `getParams` | CRITICAL → M-109, M-112 · **NORMAL → 9 medidores · ALERT → solo M-104** (tabla de estado del README) · `ROJO` → 400 con "filter.status debe ser NORMAL, ALERT o CRITICAL" · la combinación → M-112 | CRITICAL, `ROJO`, la combinación y `getParams` correctos. **NORMAL → 8 y ALERT → [M-104, M-106]** | ❌ DEF-01 | `api/meters.api.spec.ts`, `defects/defects.api.spec.ts` |
| CP-12 | Búsqueda por `meter_id` · PE + VL | `109` · `M-109` · `M-1` · `M-11` · `ZZZ` · `m-109` · 50 caracteres · 51 caracteres | `109`/`M-109` → [M-109]; `M-1` → 12; `M-11` → 3; `ZZZ` → 200 `[]`; **`m-109` → [M-109]** ("sin importar mayúsculas", README y Swagger); 50 → 200; 51 → 400 | Todo correcto salvo **`m-109` → `count: 0`** | ❌ DEF-04 | `api/meters.api.spec.ts`, `defects/defects.api.spec.ts` |
| CP-13 | Ordenamiento · PE (`sort_by` × `sort_order`) | `severity` DESC; `consumption` y `variation` ASC/DESC; `meter_id` DESC; `sort_by: "precio"` + `sort_order: "ARRIBA"` | Severity DESC: M-109, M-112, M-104, M-106 y luego los sin anomalía; listas numéricas monótonas; M-109 primero por consumo y por variación; `meter_id` DESC invierte el orden; los inválidos → 400 con un error por campo | Igual al esperado | ✅ | `api/meters.api.spec.ts` |
| CP-14 | Detalle de medidor · CC (API ↔ README) + NEG | `GET /meter/getById/M-109`; los 12 medidores contra la lista; `M-999` | M-109: 2.207,6 kWh · baseline 1.052,15 · +109,8 % · CRITICAL · REAL_ANOMALY (README); 336 lecturas horarias y 14 diarias; consumo = suma de las últimas 24 h = último día; lista = detalle; M-999 → 404 | Igual al esperado | ✅ | `api/meters.api.spec.ts` |

## Motor de anomalías y dashboard (API)

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-15 | Clasificación y priorización · TD (tipo → severidad, confianza, prioridad, acción) | `GET /anomaly/getAll` | 1 M-109 REAL/HIGH/0,95 · 2 M-112 DATA_QUALITY/HIGH/0,95 · 3 M-104 EXPLAINABLE/MEDIUM/0,86 · 4 M-106 FALSE_POSITIVE/LOW/0,86 (`anomaly:false`); orden por severidad ↓, luego \|kWh\| ↓, luego confianza ↓; M-109: 58 h, +110,5 %, ~2.825 kWh, desde 12/09 14:00, acción "Investigar en sitio…"; cada tipo de evento explica la dirección que dice la tabla de eventos; M-112: 0 kWh y ≥ 12 h sospechosas (README §6–§10) | Igual al esperado | ✅ | `api/anomalies.api.spec.ts` |
| CP-16 | Estado de alerta · TD (4 reglas) | Lista de los 12 medidores: R1 sin anomalía → NORMAL · R2 FALSE_POSITIVE → NORMAL · R3 HIGH → CRITICAL · R4 otra → ALERT | Los 12 cumplen su regla (backend/README · "Estado de alerta") | R1 (8 medidores), R3 (M-109, M-112) y R4 (M-104) correctos. **R2: M-106 → ALERT** | ❌ DEF-01 | `api/anomalies.api.spec.ts`, `defects/defects.api.spec.ts` |
| CP-17 | Confianza · TD + CC (API ↔ fórmula ↔ UI) | Para cada anomalía: `checks`, pesos, fórmula; en la UI, la cuenta mostrada en "Evidencia y confianza" de M-104 | 4 señales con pesos que suman 1; confianza = (0,5 + 0,45 × puntaje) × 0,9 si depende de un evento; rango [0,5; 0,95] (README §9); **la cuenta mostrada cuadra con el valor** | API correcta para las 4 anomalías. **La UI muestra "0,5 + 0,45 × 1,000 × 0,9 = 0,86"**, que evaluada da 0,905 | ❌ DEF-10 | `api/anomalies.api.spec.ts`, `defects/defects.ui.spec.ts` |
| CP-18 | Dashboard · CC (dashboard ↔ lista ↔ anomalías ↔ README ↔ UI) | `GET /dashboard/getSummary` y los KPIs del Despacho | 12 medidores · 4 anomalías (1 por tipo) · 2 requieren atención · rango 01/09–14/09 · Confianza IA = promedio · consumo = suma de los 12; los conteos coinciden con el filtro por estado; la UI muestra los mismos números; **9 normales · 1 alerta · 2 críticas** (tabla de estado) | Todo consistente entre capas, pero **`status_counts` = 8 / 2 / 2** y la UI dice "8 normales · 2 alerta · 2 críticas" | ❌ DEF-01 | `api/dashboard.api.spec.ts`, `ui/cross-layer.ui.spec.ts`, `defects/*` |

## Libro de medidores (UI)

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-19 | Filtros, búsqueda y orden con estado en la URL · PE + TE + CC | 1) `/medidores`: cifras = API. 2) Filtro **Críticas** + orden **Consumo** de mayor a menor y recargar. 3) Buscar `ZZZ` y pulsar **Quitar filtros**. 4) Orden por **Severidad**. 5) Clic en M-104. 6) Buscar `m-109` | 1) 10 filas con consumo, baseline y variación = API en formato es-CO. 2) URL `estado=CRITICAL&orden=consumption&dir=DESC`; las filas en el orden de la API; el estado sobrevive a la recarga ("Los filtros viven en la URL", frontend/README). 3) Estado vacío y luego lista restablecida. 4) M-109, M-112, M-104, M-106 primero. 5) Detalle de M-104 con sello "Alerta". 6) **M-109** | Pasos 1 a 5 correctos en los 3 navegadores. **Paso 6: "Ningún medidor coincide con los filtros"** | ❌ DEF-04 | `ui/meters-ledger.ui.spec.ts`, `defects/defects.ui.spec.ts` |
| CP-20 | Paginación en la UI · VL (12 medidores, 10 por página) | Página 1 → **Siguiente**; y `?pagina=2` directo | Página 1: "1–10 de 12", **Anterior** deshabilitado y **Siguiente habilitado**; página 2: M-111 y M-112, "11–12 de 12" | `?pagina=2` es correcto. **En la página 1, "Siguiente" está deshabilitado**: M-111 y M-112 no se alcanzan navegando | ❌ DEF-03 | `ui/meters-ledger.ui.spec.ts`, `defects/defects.ui.spec.ts` |
| CP-21 | Página fuera de rango · VL + NEG | `/medidores?pagina=5` | La API responde `[]` con `count 12`; la UI debe mostrar el estado vacío o ajustarse a la última página, nunca un rango imposible | La API está bien. **La UI muestra una tabla vacía con "41–12 de 12 medidores"** | ❌ DEF-06 | `defects/defects.ui.spec.ts` |

## Consistencia entre capas (UI ↔ API ↔ documentación)

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-22 | Detalle de medidor = API = tabla de estado · CC + TD | Abrir `/medidores/{id}` para M-109, M-112, M-104, M-106 y M-101 | Consumo, baseline y variación = API (±½ dígito, es-CO); sello de estado según la tabla (Crítica, Crítica, Alerta, **Normal**, Normal); severidad; "Orden n · Tipo · Acción"; M-101 sin orden | Correcto para M-109, M-112, M-104 y M-101. **M-106 muestra el sello "Alerta"** | ❌ DEF-01 | `ui/cross-layer.ui.spec.ts`, `defects/defects.ui.spec.ts` |
| CP-23 | Hora de planta en la zona del operador · CC | Navegador en `America/Bogota`: investigación de M-109 ("Detectada", "Duración · Desde", eventos) y columna "Última lectura" del libro | La hora se muestra **tal como viene**: 12/09 14:00 (igual al texto del motor "desde 12/09 14:00") y última lectura 14/09 23:00 (frontend/README:75, PRODUCT.md) | **"Detectada 12/09 09:00", "Desde 12/09 09:00", evento a las 09:00, "Última lectura 14/09 18:00"**: todo desplazado −5 h y contradiciendo el texto de la misma pantalla | ❌ DEF-02 | `defects/defects.ui.spec.ts` |
| CP-24 | Anomalías IA = API = tabla de decisión · CC + TD | `/anomalias`; abrir M-106 y M-112; `/anomalias/M-101`; ruta inexistente | Tabla: "4 anomalías detectadas · 2 requieren atención prioritaria"; filas con prioridad, tipo, severidad, confianza y acción en el orden del README; M-106 "No escalar"; M-112 "Validar medidor" con sus horas sospechosas; M-101 "No hay orden"; ruta inexistente → página 404 con salida al Despacho | Igual al esperado en los 3 navegadores | ✅ | `ui/anomalies.ui.spec.ts` |

## Run AI Analysis

| ID | Título · Técnica | Pasos · Datos | Resultado esperado (fuente) | Resultado obtenido | Estado | Test |
|---|---|---|---|---|---|---|
| CP-25 | Corrida del análisis · TE (corrida RUNNING → COMPLETED; paso PENDING → RUNNING → DONE) | API: `POST /ai/analyze`, polling de `GET /ai/analysis/{id}`, `latest`, `AN-9999`, comparar las anomalías antes y después. UI: pulsar **Run AI Analysis**, esperar, **Ver órdenes** y cerrar la hoja | 202 (o 200 si ya hay una en curso) con `AN-xxxx` y los 7 pasos en orden (Lecturas … Recomendación); termina COMPLETED con los 7 en DONE y resumen 4 · 2; `AN-9999` → 404; el resultado del motor no cambia (determinístico). UI: los 7 pasos llegan a "Hecho", sello "4 anomalías · 2 prioritarias" y **Ver órdenes** lleva a `/anomalias` (backend/README · Run AI Analysis) | Igual al esperado | ✅ | `api/analysis.api.spec.ts`, `ui/analysis.ui.spec.ts` |

---

## Flujo E2E de negocio (E2E-01)

`ui/business-flow.ui.spec.ts`. Es el recorrido del evaluador descrito en PRODUCT.md:

1. Login sin sesión previa.
2. Despacho: la orden de prioridad máxima es M-109, "Anomalía real" y "Crítica".
3. Medidores, filtro **Críticas**: solo M-109 y M-112.
4. Buscar `109`: solo M-109.
5. Detalle de M-109: 2.207,6 kWh, baseline 1.052,2 kWh y +109,8 %, iguales en la API, el README y la UI. Sello "Crítica" y "Orden 1 · Anomalía real · Investigar".
6. Investigación: "Prioridad 1 de 4", acción "Investigar en sitio…", confianza `0,95 (Alta)` y el texto del motor igual al de la API.

**Resultado: ✅ en los 3 navegadores.**

## Valores límite del motor (dataset sintético)

El dataset real no toca ningún umbral, así que no sirve para probar sus bordes. Se construyó un dataset sintético a partir de los umbrales **documentados** en backend/README §3, §4 y §8 (`e2e/data/boundary`, generado por script):

- Consumo constante de 10 kWh.
- Una sola variable alterada por medidor.

Lo sirve una segunda instancia del backend (`DATA_DIR`). Es caja negra: el motor se trata como una función de entrada (CSV) y salida (API).

| ID | Medidor · dato de entrada | Esperado (README) | Obtenido | Estado |
|---|---|---|---|---|
| BVA-01 | B-101 · todo constante (control) | Sin anomalía, NORMAL | Igual | ✅ |
| BVA-02 | B-103 · **+50,1 %** las últimas 6 h, activo | REAL_ANOMALY **HIGH** ("supera 50 % y activa") | HIGH | ✅ |
| BVA-06 | B-102 · **+50,0 %** exacto, activo | REAL_ANOMALY **MEDIUM** (50 % no "supera" 50 %) | **HIGH** | ❌ DEF-07 |
| BVA-07 | B-104 · **+20,0 %** exacto, activo | REAL_ANOMALY **LOW** (20 % no "supera" 20 %) | **MEDIUM** | ❌ DEF-07 |
| BVA-03 | B-105 · +100 % durante **5 h** | Sin cambio sostenido (se exigen 6 h o más) | Sin anomalía | ✅ |
| BVA-04 | B-106 · voltaje +10 % durante **2 h** | Sin calidad de datos (se exigen 3 h o más sospechosas) | Sin anomalía | ✅ |
| BVA-05 | B-107 · voltaje +10 % durante **3 h** | DATA_QUALITY **MEDIUM** (≥ 3 h y < 12 h) | DATA_QUALITY MEDIUM, 3 h | ✅ |
| BVA-08 | B-108 · **1 hora faltante** | Sin anomalía (1 hora sospechosa < 3) | **DATA_QUALITY MEDIUM** con el texto "0 h … desde 01/01 00:00 … 0,0 V" | ❌ DEF-08 |

Test: `api/engine-boundaries.api.spec.ts`.
