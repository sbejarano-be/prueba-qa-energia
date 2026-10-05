# 05 · Reporte de defectos

## Entorno común

| Campo | Valor |
|---|---|
| Build | Repo `prueba-qa`, rama `main`, commit `15765d9` |
| SO | Windows 11 Home 10.0.26200 |
| Backend | Go 1.26.5 · `go run ./cmd/api` · `http://localhost:8080` · dataset original (`backend/data`) · sin `OPENAI_API_KEY` (narrador `engine`) |
| Frontend | Vite (modo dev) · `http://localhost:5173` · proxy `/api` → `:8080` |
| Navegadores | Chromium 153.0 · Firefox 155.0 · WebKit 26.6 (Playwright 1.63.0) |
| Zona horaria del navegador | `America/Bogota` (UTC−5), la de los operadores (PRUEBA_QA.md §1.4) · locale `es-CO` |
| Usuario | `admin@energia.local` / `admin123` |

Los ejemplos `curl` asumen un token en `$TOKEN`:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@energia.local","password":"admin123"}' | jq -r .access_token)
```

**Criterio de severidad y prioridad:**
- **Severidad:** impacto en el usuario o el negocio si ocurre.
- **Prioridad:** urgencia de corregirlo para este release. Depende de la severidad, la frecuencia, la visibilidad y si hay alternativa.

Cada defecto tiene un test de Playwright con `test.fail()` que hoy falla y pasará al corregirse (tag `@defect`).

## Resumen

| ID | Título | Capa | Severidad | Prioridad | Reproducibilidad |
|---|---|---|---|---|---|
| [DEF-01](#def-01) | El falso positivo M-106 se muestra como "Alerta" (debería ser Normal) | API + UI | **Alta** | **Alta** | Siempre |
| [DEF-02](#def-02) | Las horas de planta se muestran convertidas a la zona del navegador (−5 h en Colombia) | UI | **Alta** | **Alta** | Siempre (fuera de UTC) |
| [DEF-03](#def-03) | Paginación: "Siguiente" deshabilitado con 12 medidores; M-111 y M-112 no se alcanzan | UI | Media | **Alta** | Siempre |
| [DEF-04](#def-04) | La búsqueda por medidor distingue mayúsculas ("m-109" no encuentra nada) | API + UI | Media | Media | Siempre |
| [DEF-05](#def-05) | `pagination.page` negativo provoca un error 500 | API | Media | Baja | Siempre |
| [DEF-06](#def-06) | Una página fuera de rango muestra un rango imposible ("41–12 de 12") | UI | Baja | Baja | Siempre |
| [DEF-07](#def-07) | La severidad de una anomalía real usa `>=` en los umbrales que el README define como "supera" | Motor | Media | Baja | Siempre (en el borde exacto) |
| [DEF-08](#def-08) | Una sola hora faltante marca el medidor como "Calidad de datos" con una explicación vacía | Motor | **Alta** | Media | Siempre (con datos con huecos) |
| [DEF-09](#def-09) | Errores HTTP: 404 en vez de 405 y mensajes que exponen el parser de Go | API | Baja | Baja | Siempre |
| [DEF-10](#def-10) | La cuenta de la confianza se muestra sin paréntesis y no cuadra | UI | Baja | Media | Siempre (anomalías con evento) |
| [DEF-11](#def-11) | Tras el login, a veces no vuelve a la ruta protegida que se pidió | UI | Media | Media | Intermitente (~40 %) |

---

<a id="def-01"></a>
## DEF-01 · El falso positivo M-106 se muestra como "Alerta" (debería ser Normal)

**Severidad: Alta · Prioridad: Alta.**
- Se rompe la regla de negocio central del producto: un falso positivo no se escala.
- El operador ve un sello "Alerta" en M-106 mientras la orden dice "No escalar".
- El KPI de la planta queda mal, y el filtro "Alertas" y "Normales" devuelve medidores equivocados.

**Pasos (UI):**
1. Entrar y abrir **Medidores**.
2. Ver la fila M-106 y pulsar el filtro **Alertas**.
3. Abrir `/medidores/M-106`.
4. Volver al **Despacho** y ver el KPI "Medidores".

**Pasos (API):**
```bash
curl -s -X POST http://localhost:8080/api/v1/meter/getAll -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"filter":{"meter_id":"M-106"}}'
curl -s http://localhost:8080/api/v1/dashboard/getSummary -H "Authorization: Bearer $TOKEN" | jq .status_counts
```

**Resultado esperado:**
- M-106 en estado **NORMAL** / "Normal".
- El filtro "Alertas" devuelve solo M-104.
- "Normales" devuelve 9 medidores.
- El KPI dice **"9 normales · 1 alerta · 2 críticas"**.

Fuente: backend/README.md, tabla "Estado de alerta de un medidor": *"Sin anomalía, o `FALSE_POSITIVE` → `NORMAL`"*. También el README raíz (M-106: "Falso positivo… No escalar") y PRODUCT.md ("M-106 false positive (LOW, do not escalate)").

**Resultado obtenido:**
- `"status":"ALERT"` para M-106 (`anomaly_type: FALSE_POSITIVE`, `severity: LOW`).
- Sello **"Alerta"** en el libro y en el detalle.
- Filtro ALERT → `[M-104, M-106]`; NORMAL → 8 medidores.
- `status_counts = {normal: 8, alert: 2, critical: 2}`.
- KPI "8 normales · 2 alerta · 2 críticas".

**Evidencia:** `evidencias/DEF-01-M-106-status.txt`, `DEF-01-dashboard-status-counts.txt`, `DEF-01-detalle-M-106-alerta.png`, `DEF-01-kpi-medidores.png` y `DEF-03-paginacion-siguiente-deshabilitado.png` (fila M-106 con "Alerta").

**Causa raíz:** `backend/internal/meter/enums.go:28-37`.
- `StatusOf` solo distingue `a == nil` → NORMAL, `Severity == HIGH` → CRITICAL y el resto → ALERT.
- **Falta la rama `a.Type == FALSE_POSITIVE` (o `!a.Anomaly`) → NORMAL**, aunque el comentario de la función (línea 25) la describe.
- El dashboard reutiliza `StatusOf`, por eso hereda el error.

**Por qué no lo detectaron los tests existentes:**
- `TestStatusOf` (`meter/service_test.go:31-49`) no tiene un caso de falso positivo.
- `TestDashboardSummary` (`server/server_test.go:131`) **asevera el valor incorrecto** `normal 8, alert 2`. Es un test que fija el defecto (ver 04-caja-blanca.md).

**Detección automática:**
- `defects.api.spec.ts`: DEF-01 ×3.
- `defects.ui.spec.ts`: DEF-01 ×2.
- Test unitario propuesto `TestStatusOf/falso_positivo` (04-caja-blanca.md).

---

<a id="def-02"></a>
## DEF-02 · Las horas de planta se muestran convertidas a la zona del navegador (−5 h en Colombia)

**Severidad: Alta · Prioridad: Alta.**
- Afecta a **todos** los operadores, que están en Colombia.
- El sistema muestra horas incorrectas en la investigación, los eventos y las lecturas, y se contradice en la misma pantalla.
- Un operador que vaya a sitio a "identificar qué equipo empezó a consumir más desde…" buscará 5 horas antes de lo real.

**Pasos:**
1. Con el sistema operativo o navegador en zona `America/Bogota`, entrar y abrir `/anomalias/M-109`.
2. Comparar "Detectada …" (cabecera), "Duración · Desde …" y el evento relacionado con el texto "Qué encontró la IA".
3. Abrir **Medidores** y ver la columna "Última lectura".

**Resultado esperado:**
- Las horas del dataset son **hora de planta y se muestran tal como vienen, sin convertir a la zona del navegador** (frontend/README.md:75; PRODUCT.md "Show them exactly as received; never convert them to the browser's time zone").
- M-109: **"Detectada 12/09 14:00"**, que coincide con el motor ("desde 12/09 14:00") y con el README.
- Última lectura **14/09 23:00** (fin del dataset).

**Resultado obtenido:**
- "Detectada **12/09 09:00**".
- "Desde **12/09 09:00** · sigue activo".
- Evento "Evento sin causa conocida · **12/09 09:00**".
- En la misma pantalla, el motor dice "desde 12/09 14:00".
- Libro: "Última lectura **14/09 18:00**" en los 12 medidores.
- M-104 (evento 11/09 00:00) se ve como **10/09 19:00**: cambia hasta el día.

**Evidencia:**
- `evidencias/DEF-02-hora-de-planta-M-109.png`
- `evidencias/DEF-02-ultima-lectura-libro.png`
- `evidencias/DEF-02-formatPlantTime-por-zona.txt`: la misma función da 14:00 en UTC, 09:00 en Bogotá y 23:00 en Tokio.

**Causa raíz:** `frontend/src/lib/format.ts:55-58`.
- `formatPlantTime` usa `getDate()`, `getMonth()`, `getHours()` y `getMinutes()`, que son **hora local**, en vez de `getUTC*`.
- La API marca la hora de planta con `Z` (`backend/internal/data/csv.go`), así que el navegador la convierte.
- El comentario de las líneas 51-52 dice justo lo contrario ("Se leen las partes UTC").
- `formatPlantDate` y `formatPlantDay` sí usan `getUTC*`, por eso los ejes de las gráficas salen bien.

**Por qué no lo detectó el test existente:**
- `format.test.ts:15-19` valida `formatPlantTime('2026-09-12T14:00:00Z') === '12/09 14:00'`.
- Vitest corre con `env: { TZ: 'UTC' }` (`frontend/vite.config.ts:33`). En UTC la hora local y la UTC coinciden, así que el test pasa aunque la función esté mal.

**Detección automática:**
- `defects.ui.spec.ts`: DEF-02 ×2, con todos los navegadores en `timezoneId: 'America/Bogota'`.
- Propuesta: correr los unitarios de formato en varias zonas horarias (04-caja-blanca.md).

---

<a id="def-03"></a>
## DEF-03 · Paginación: "Siguiente" deshabilitado con 12 medidores; M-111 y M-112 no se alcanzan

**Severidad: Media · Prioridad: Alta.**

**Por qué difieren:**
- La severidad es media porque hay alternativas: buscar el medidor, filtrar por estado o escribir `?pagina=2` en la URL. M-112 también aparece en el Despacho y en Anomalías IA.
- La prioridad es alta por cuatro razones:
  - Es visible en la pantalla principal de gestión.
  - Oculta justo la segunda anomalía crítica (M-112).
  - Afecta a cualquier lista cuyo total no sea múltiplo de 10.
  - La corrección es de una línea.

**Pasos:**
1. Abrir **Medidores** (sin filtros).
2. Ver el pie de la tabla.
3. Intentar ir a la página siguiente.

**Resultado esperado:**
- "1–10 de 12 medidores" con **Siguiente habilitado**.
- Siguiente → página 2 con M-111 y M-112, "11–12 de 12".
- Fuente: la propia documentación del componente (`Pagination.tsx:11` "'11–12 de 12' con anterior / siguiente") y `count: 12` de la API.

**Resultado obtenido:** "1–10 de 12 medidores" con **Anterior y Siguiente deshabilitados**. M-111 y M-112 no se pueden alcanzar con la paginación.

**Evidencia:** `evidencias/DEF-03-paginacion-siguiente-deshabilitado.png`

**Causa raíz:** `frontend/src/features/meters/components/Pagination.tsx:13`.
- `pages = Math.max(1, Math.floor(count / size))`: con 12 / 10, `floor` da 1 página.
- Debe ser `Math.ceil(count / size)`.

**Detección automática:**
- `defects.ui.spec.ts`: DEF-03.
- Unitario propuesto de `Pagination` con `count` 12, 20 y 21 (04-caja-blanca.md). Hoy ningún test cubre ese componente.

---

<a id="def-04"></a>
## DEF-04 · La búsqueda por medidor distingue mayúsculas ("m-109" no encuentra nada)

**Severidad: Media · Prioridad: Media.**
- Es una funcionalidad documentada que no funciona como se describe.
- La alternativa es obvia (escribir en mayúsculas), pero el estado vacío "Ningún medidor coincide" induce a pensar que el medidor no existe.
- Además es inconsistente: `/medidores/m-109` (detalle) sí funciona.

**Pasos (UI):**
1. Abrir **Medidores**.
2. Escribir `m-109` en "Medidor" y pulsar **Buscar medidor**.

**Pasos (API):**
```bash
curl -s -X POST http://localhost:8080/api/v1/meter/getAll -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"filter":{"meter_id":"m-109"}}'
```

**Resultado esperado:** M-109.
- backend/README.md: *"`meter_id`: Búsqueda parcial, sin importar mayúsculas (`109` encuentra `M-109`)"*.
- Swagger (`Filter.meter_id`): *"Coincidencia parcial y sin importar mayúsculas"*.

**Resultado obtenido:**
- API: `{"page":1,"size":10,"count":0,"rows":[]}`.
- UI: "Ningún medidor coincide con los filtros · No hay medidores que contengan "m-109"".

**Evidencia:** `evidencias/DEF-04-busqueda-minusculas.txt`, `evidencias/DEF-04-busqueda-minusculas.png`

**Causa raíz:** `backend/internal/meter/service.go:59`.
- `strings.Contains(sm.MeterID, search)` compara sin normalizar.
- La normalización del filtro (`meter/dto.go:44`) solo hace `TrimSpace`, mientras que `getById` sí hace `ToUpper`.
- Corrección: `strings.Contains(strings.ToUpper(sm.MeterID), strings.ToUpper(search))`, o normalizar en `dto.go`.

**Detección automática:**
- `defects.api.spec.ts` y `defects.ui.spec.ts`: DEF-04.
- Los tests existentes (`TestGetAllFilters`) solo usan "109" y "M-11". Falta la clase de equivalencia "minúsculas".

---

<a id="def-05"></a>
## DEF-05 · `pagination.page` negativo provoca un error 500

**Severidad: Media · Prioridad: Baja.**
- Severidad media porque es un *panic* no controlado del servidor (recuperado por el middleware) ante una entrada del cliente, y la API es pública y está documentada en Swagger.
- Prioridad baja porque la UI nunca envía páginas negativas (valida `pagina > 0`) y no hay caída del proceso.

**Pasos:**
```bash
curl -s -X POST http://localhost:8080/api/v1/meter/getAll -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"pagination":{"page":-1,"size":10}}'
```

**Resultado esperado:**
```json
400 {"status_code":400,"message":"Filtros inválidos","errors":["pagination.page debe ser mayor o igual a 1"],…}
```
Fuente: Swagger `Pagination.page: minimum 1`; el README dice que los errores de validación responden 400 con `errors` por campo, igual que `size` fuera de rango.

**Resultado obtenido:** `500 {"status_code":500,"message":"Error interno del servidor",…}`. Lo mismo con `page: -100`.

**Observación relacionada:** `page: 0` y `size: 0` explícitos se aceptan en silencio y se reemplazan por los valores por defecto (1 y 10), aunque Swagger declara `minimum: 1` (supuesto S-05).

**Evidencia:** `evidencias/DEF-05-pagina-negativa-1.txt`, `evidencias/DEF-05-pagina-negativa-100.txt`

**Causa raíz:**
- `backend/internal/httpx/paging.go:23-36`: `Normalize` valida `size` pero **no valida `page`**.
- En `Paginate` (línea 48), `start = min((page-1)*size, len)` queda negativo y el slice `items[start:end]` (línea 54) entra en *panic*.
- `Recover` lo convierte en 500.

**Detección automática:**
- `defects.api.spec.ts`: DEF-05 ×2.
- Unitario propuesto `TestNormalizeRejectsNegativePage` (04-caja-blanca.md).

---

<a id="def-06"></a>
## DEF-06 · Una página fuera de rango muestra un rango imposible ("41–12 de 12")

**Severidad: Baja · Prioridad: Baja.**
- Solo ocurre con una URL editada a mano o un enlace viejo.
- No pierde datos, pero muestra información incoherente y no ofrece cómo volver.

**Pasos:** abrir `/medidores?pagina=5`.

**Resultado esperado:**
- La API responde bien (`rows: []`, `count: 12`).
- La UI debería ajustarse a la última página válida o mostrar el estado vacío con una salida.
- Nunca debería mostrar un rango con "desde" > "hasta".

**Resultado obtenido:** tabla vacía (sin el estado vacío) y el texto **"41–12 de 12 medidores"**.

**Evidencia:** `evidencias/DEF-06-pagina-fuera-de-rango.png`

**Causa raíz:**
- `frontend/src/features/meters/hooks/useMeterFilters.ts:30` acepta cualquier entero positivo, sin límite superior.
- `Pagination.tsx:14-15` calcula `from = (page-1)*size+1` sin acotarlo.
- `MetersRoute` solo muestra el estado vacío si `count === 0`.

**Detección automática:** `defects.ui.spec.ts`: DEF-06.

---

<a id="def-07"></a>
## DEF-07 · La severidad de una anomalía real usa `>=` en los umbrales que el README define como "supera"

**Severidad: Media · Prioridad: Baja.**
- Es una regla de negocio del motor implementada distinto de como está documentada, y cambia la severidad, y con ella el estado CRITICAL o ALERT y la prioridad.
- Prioridad baja: solo ocurre en el valor exacto del umbral (+50,0 % o +20,0 %), que con datos reales continuos es poco probable, y no afecta al dataset actual.

**Pasos (caja negra, por valores límite):**
1. Generar el dataset sintético (`cd e2e && npm run generate:boundary-data`).
2. Levantar una instancia con él:
   ```bash
   cd backend && PORT=8081 DATA_DIR=../e2e/data/boundary go run ./cmd/api
   ```
3. Consultar `GET :8081/api/v1/anomaly/getAll`.

**Datos:**
- B-102: consumo constante de 10 kWh y luego **15 kWh las últimas 6 h** (exactamente **+50,0 %**, activo).
- B-104: **12 kWh** (exactamente **+20,0 %**).
- Control B-103: **+50,1 %**.

**Resultado esperado:** backend/README.md §8: *"`REAL_ANOMALY`: **HIGH** si la variación **supera** 50 % y sigue activa; **MEDIUM** si **supera** 20 %; si no, **LOW**"*.
- B-102 (50,0 %) → **MEDIUM**.
- B-104 (20,0 %) → **LOW**.
- B-103 (50,1 %) → HIGH.

**Resultado obtenido:** B-102 → **HIGH**; B-104 → **MEDIUM**. B-103 → HIGH, que es correcto.

**Evidencia:** `evidencias/DEF-07-umbral-50-B-102.txt`

**Causa raíz:** `backend/internal/analysis/classify/classify.go:222` (`p >= 50 && c.Ongoing`) y `:224` (`p >= 20`). Debe ser `>`. Además, los umbrales 50, 20 y 12 son literales y no constantes, aunque el README dice que "todos son constantes al inicio de cada archivo".

**Detección automática:**
- `api/engine-boundaries.api.spec.ts`: BVA-06 y BVA-07.
- Unitario propuesto `TestRealSeverityBoundaries`. Hoy `realSeverity` no tiene ningún test (60 % de cobertura).

---

<a id="def-08"></a>
## DEF-08 · Una sola hora faltante marca el medidor como "Calidad de datos" con una explicación vacía

**Severidad: Alta · Prioridad: Media.**
- Severidad alta porque con datos reales de medidores (cortes de comunicación) **una sola hora perdida** dispara una orden de "Validar el medidor" y cambia el estado a "Alerta". El texto de la explicación sale vacío o absurdo.
- Prioridad media porque no ocurre con el dataset de la demo (sin huecos), pero es muy probable en producción.

**Pasos:**
1. Mismo entorno que DEF-07.
2. Medidor **B-108**: consumo constante con **una única hora faltante** (2026-09-10 05:00).

**Resultado esperado:** backend/README.md §4: se marca una hora como sospechosa si "faltan horas o hay lecturas duplicadas", y *"Con **3 horas sospechosas o más**, el medidor tiene un problema de calidad de datos"*. Con 1 hora faltante: **sin anomalía, NORMAL**.

**Resultado obtenido:**
- `DATA_QUALITY` / `MEDIUM`, estado `ALERT`, confianza 0,64.
- La explicación dice: *"El consumo se mantiene estable, pero hay **0 h** con lecturas eléctricas incoherentes desde **01/01 00:00**: voltaje entre **0,0 y 0,0 V** (normal 0,0 V) y factor de potencia hasta 0,00."*

**Evidencia:** `evidencias/DEF-08-hora-faltante-B-108-estado.txt`, `evidencias/DEF-08-hora-faltante-anomalias.txt`

**Causa raíz:** `backend/internal/analysis/quality/quality.go`.
- `HasIssue` (línea 37) devuelve verdadero con `MissingHours > 0 || DuplicateReadings > 0`, sin exigir el mínimo de 3.
- Las horas faltantes y duplicadas **no suman** a `FlaggedHours` ni fijan `FirstFlagged` (líneas 65-71), de ahí "0 h" y la fecha cero `0001-01-01` ("01/01 00:00").

**Detección automática:**
- `api/engine-boundaries.api.spec.ts`: BVA-08.
- Unitario propuesto `TestHasIssueMissingHoursBelowThreshold`.

---

<a id="def-09"></a>
## DEF-09 · Errores HTTP: 404 en vez de 405 y mensajes que exponen el parser de Go

**Severidad: Baja · Prioridad: Baja.** Es un problema de contrato y robustez de la API que no afecta a la UI.

**Pasos:**
```bash
curl -s -i http://localhost:8080/api/v1/meter/getAll -H "Authorization: Bearer $TOKEN"      # GET sobre una ruta POST
curl -s -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":1,"password":"x"}'
```

**Resultado esperado:**
- Método no soportado → **405 Method Not Allowed** con header `Allow: POST` (RFC 9110; supuesto S-06).
- Body con un tipo incorrecto → 400 con el formato único del README (`message` legible y `errors` por campo), sin detalles internos.

**Resultado obtenido:**
- `404 "Ruta no encontrada"` para una ruta que sí existe.
- `400 "body inválido: json: cannot unmarshal number into Go struct field LoginRequest.email of type string"`, sin `errors`. Expone tipos internos.

**Evidencia:** `evidencias/DEF-09-metodo-incorrecto.txt`, `evidencias/DEF-09-error-decode.txt`

**Causa raíz:**
- `backend/internal/server/server.go:69`: `mux.HandleFunc("/", httpx.NotFound)` captura cualquier método, así que el `ServeMux` nunca responde 405.
- `backend/internal/httpx/request.go:26`: el error del decoder se envuelve tal cual.
- `httpx/response.go:16`: `errors` es `omitempty`.

**Detección automática:** `defects.api.spec.ts`: DEF-09 ×2.

---

<a id="def-10"></a>
## DEF-10 · La cuenta de la confianza se muestra sin paréntesis y no cuadra

**Severidad: Baja · Prioridad: Media.**
- Severidad baja porque es un texto: el valor de confianza (0,86) es correcto.
- Prioridad media porque el producto se vende por *"Evidence over assertion: every conclusion shows its numbers"* (PRODUCT.md). Una cuenta que no da el resultado mostrado resta credibilidad justo ante el evaluador técnico.

**Pasos:**
1. Abrir `/anomalias/M-104` (o M-106).
2. Ir a "Evidencia y confianza".

**Resultado esperado:**
- La cuenta mostrada da el valor mostrado: **"(0,5 + 0,45 × 1,000) × 0,9 = 0,86"**.
- Fuente: backend/README §9, que primero escala (`0,5 + 0,45 × puntaje`) y luego aplica ×0,9 "cuando la conclusión depende de un evento".

**Resultado obtenido:** **"0,5 + 0,45 × 1,000 × 0,9 = 0,86"**. Con la precedencia normal da 0,5 + 0,405 = **0,905**, no 0,86.

**Evidencia:** `evidencias/DEF-10-formula-confianza-M-104.png`

**Causa raíz:** `frontend/src/features/anomalies/components/EvidenceChecks.tsx:51-52`. Al concatenar `' × 0,9'` faltan los paréntesis alrededor de `0,5 + 0,45 × S`.

**Detección automática:** `defects.ui.spec.ts`: DEF-10. Evalúa aritméticamente la cuenta mostrada.

---

<a id="def-11"></a>
## DEF-11 · Tras el login, a veces no vuelve a la ruta protegida que se pidió

**Severidad: Media · Prioridad: Media.**
- Rompe los enlaces directos: un operador que recibe el enlace de una investigación y no tiene sesión termina en el Despacho. Pierde el contexto y tiene que buscar la orden.
- Es intermitente y tiene alternativa (volver a navegar).

**Pasos:**
1. Sin sesión, abrir `http://localhost:5173/anomalias/M-109`. Redirige a `/login`, correctamente.
2. Entrar con credenciales válidas.
3. Repetir varias veces en ventanas nuevas.

**Resultado esperado:**
- Siempre vuelve a `/anomalias/M-109`.
- Fuente: la app recuerda la ruta de origen al redirigir al login (`RequireAuth` envía `state.from`); además es el comportamiento estándar de una ruta protegida.

**Resultado obtenido:**
- En ~40 % de los intentos termina en **`/` (Despacho)**.
- Muestra: 5 de 12 corridas, con fallos en Chromium, Firefox y WebKit.
- El test automatizado hace 10 logins seguidos para que la detección sea determinística.

**Evidencia:** adjunto `DEF-11-rutas-tras-login` en el reporte HTML de Playwright (lista de rutas de aterrizaje por intento).

**Causa raíz probable:** una carrera entre dos navegaciones.
- `useLoginForm.ts:31` hace `navigate(from)` después de `await login()`.
- En paralelo, el cambio de estado a `authenticated` re-renderiza `LoginRoute`, que tiene `if (status === 'authenticated') return <Navigate to="/" replace />` (`LoginRoute.tsx:13`).
- Gana la que se confirme primero. La ruta de destino es *lazy*, lo que da tiempo a que gane el `<Navigate to="/">`.
- Corrección: que `LoginRoute` redirija a `location.state?.from ?? '/'`, o una sola navegación.

**Detección automática:** `ui/login.ui.spec.ts`: DEF-11 (10 intentos en contextos nuevos).

---

## Observaciones menores (no reportadas como defecto)

| Observación | Dónde | Por qué no es defecto (o es menor) |
|---|---|---|
| El esquema `bearer` en minúsculas responde 401 | `auth/middleware.go:19` | RFC 7235 lo define insensible a mayúsculas, pero el README especifica `Bearer` |
| El login no valida el formato del email (`abc` → 401, no 400) | `auth/dto.go` | Responde de forma segura; solo es un mensaje menos preciso |
| Swagger no marca `severity`, `priority`, `anomaly_type`, `finished_at` ni `summary` como *nullable* | `backend/docs` | Un cliente generado desde el contrato fallaría con medidores normales |
| El botón atrás del navegador no deshace los filtros (`replace: true`) | `useMeterFilters.ts:83` | Contradice el comentario del propio hook; es UX |
| El texto del motor usa `-79,8%` (sin espacio, guion ASCII) y la UI `−79,8 %` | `classify/format.go`, `lib/format.ts` | Inconsistencia tipográfica |
| La explicación de B-107 dice "factor de potencia hasta 0,95" aunque el FP no cambió | `classify.go:78` | Texto engañoso cuando solo falla el voltaje |
| Las casillas etiqueta-valor (`Field`) son `<span>` sin asociación programática | `components/ui/Field.tsx` | Accesibilidad (WCAG 1.3.1) y testabilidad: no se pueden ubicar con `getByLabel` |
