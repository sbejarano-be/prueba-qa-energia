# 04 · Pruebas de caja blanca

Revisión del código (`backend/internal/**`, `frontend/src/**`) **después** del diseño de caja negra. Se usó para:

- confirmar la causa raíz de los defectos encontrados como caja negra;
- buscar riesgos en ramas y condiciones que la caja negra no alcanza;
- evaluar si los tests existentes merecen confianza.

## 1. Módulos revisados y por qué

Se eligieron según el análisis de riesgos de `01-plan-de-pruebas.md`:

| # | Módulo | Riesgo que cubre | Hallazgos |
|---|---|---|---|
| M1 | `backend/internal/meter` (`enums.go`, `service.go`, `dto.go`) + `internal/httpx/paging.go` | R1 estado que ve el operador · R3 filtros y paginación | DEF-01, DEF-04, DEF-05 |
| M2 | `frontend/src/lib/format.ts` + `features/meters/components/Pagination.tsx` + `hooks/useMeterFilters.ts` | R2 horas de planta · R3 paginación | DEF-02, DEF-03, DEF-06 |
| M3 | `backend/internal/analysis/classify` (`classify.go`, `confidence.go`) + `analysis/quality/quality.go` | R5 umbrales del motor | DEF-07, DEF-08 |
| M4 | `frontend/src/features/auth` (`useLoginForm.ts`) + `app/routes/LoginRoute.tsx` | R4 sesión | DEF-11 |

### M1 · Estado, filtros y paginación de medidores (backend)

**`StatusOf` (`meter/enums.go:28-37`):**

```go
switch {
case a == nil:                      return StatusNormal   // rama 1
case a.Severity == model.SeverityHigh: return StatusCritical // rama 2
default:                            return StatusAlert    // rama 3
}
```

- La especificación (README y el comentario de la línea 25) tiene **4 reglas** y el código **3 ramas**: falta "FALSE_POSITIVE → NORMAL".
- Es el ejemplo típico de un defecto **por omisión**. La cobertura de líneas y ramas de esta función es **100 %**, porque no hay una línea que cubrir: falta la rama entera.
- Solo una tabla de decisión derivada de la especificación lo detecta (CP-16). → **DEF-01**

**`GetAll` (`meter/service.go:53-69`):**
- El filtro `meter_id` usa `strings.Contains(sm.MeterID, search)` (línea 59), que distingue mayúsculas.
- La normalización (`dto.go:44-49`) recorta espacios y pone `status` en mayúsculas, pero **no normaliza `meter_id`**.
- En cambio `GetByID` sí usa `ToUpper`. Hay dos políticas distintas para el mismo dato. → **DEF-04**

**`Pagination.Normalize` (`httpx/paging.go:23-36`) y `Paginate` (`:47-56`):**

| Condición | `page` | `size` |
|---|---|---|
| `== 0` | → 1 (valor por defecto) | → 10 (valor por defecto) |
| `< 1` | **no se valida** | se valida (400) |
| `> máximo` | no aplica (la página fuera de rango devuelve `[]`, correcto) | 100 (400) |

- Con `page < 0`, `start = min((page-1)*size, len)` queda negativo y `items[start:end]` entra en *panic*. El middleware `Recover` lo convierte en 500. → **DEF-05**
- Con `page` enorme, `(page-1)*size` puede desbordar `int` y volver a ser negativo, con el mismo *panic*.

### M2 · Formato de hora de planta y paginación (frontend)

**`format.ts`:** de las cuatro funciones de fecha, tres separan bien "hora de planta" (partes UTC) de "hora real" (zona del navegador). `formatPlantTime` es la excepción:

| Función | Usa | Correcto |
|---|---|---|
| `formatPlantTime` (`:55-58`) | `getDate`/`getHours` (**local**) | ❌ debía usar `getUTC*`, como dice su comentario (`:51-52`) → **DEF-02** |
| `formatPlantDate` (`:61-64`) | `getUTCDate`/`getUTCMonth` | ✅ |
| `formatPlantDay` (`:67-70`) | `getUTC*` | ✅ |
| `formatClockTime` (`:75-78`) | local, a propósito: es hora real de una corrida | ✅ |

`formatPlantTime` se usa en 8 lugares: libro, detalle, Despacho, Anomalías IA, investigación, eventos, comparación y tooltip de la gráfica. Por eso el defecto aparece en casi todas las pantallas.

Demostración ejecutando el módulo real (`evidencias/DEF-02-formatPlantTime-por-zona.txt`):

```
TZ=UTC             formatPlantTime = 12/09 14:00 (esperado 12/09 14:00)
TZ=America/Bogota  formatPlantTime = 12/09 09:00 (esperado 12/09 14:00)
TZ=Asia/Tokyo      formatPlantTime = 12/09 23:00 (esperado 12/09 14:00)
```

**`Pagination.tsx:13`:** `pages = Math.max(1, Math.floor(count / size))`.

| count / size | `floor` (código) | `ceil` (correcto) | Efecto |
|---|---|---|---|
| 12 / 10 | 1 | 2 | "Siguiente" deshabilitado: M-111 y M-112 inalcanzables → **DEF-03** |
| 20 / 10 | 2 | 2 | Sin efecto (por eso pasa desapercibido con totales múltiplos de 10) |
| 9 / 10 | `max(1, 0)` = 1 | 1 | Sin efecto |

Además, `from = (page-1)*size+1` no se acota y `useMeterFilters.ts:30` acepta cualquier `pagina > 0`. Con `?pagina=5` se ve "41–12 de 12". → **DEF-06**

### M3 · Umbrales del motor

**`realSeverity` (`classify/classify.go:219-229`):** `p >= 50 && Ongoing` → HIGH; `p >= 20` → MEDIUM. El README dice "supera", que es `>`.

| Clase de `p` | Activo | Esperado (README) | Código |
|---|---|---|---|
| p > 50 | sí | HIGH | HIGH ✅ |
| **p = 50** | sí | MEDIUM | **HIGH** ❌ |
| p > 50 | no | MEDIUM | MEDIUM ✅ |
| 20 < p ≤ 50 | — | MEDIUM | MEDIUM ✅ |
| **p = 20** | — | LOW | **MEDIUM** ❌ |
| p < 20 | — | LOW | LOW ✅ |

→ **DEF-07**, confirmado por caja negra con el dataset sintético (BVA-06 y BVA-07).

**`quality.Report.HasIssue` (`quality/quality.go:37`):** `FlaggedHours >= 3 || MissingHours > 0 || DuplicateReadings > 0`.
- El README cuenta las horas faltantes o duplicadas como "horas sospechosas" sujetas al mínimo de 3. El código las trata como disparador inmediato.
- Además no las suma a `FlaggedHours` ni fija `FirstFlagged` (`:65-71`). Por eso la explicación sale con "0 h", "01/01 00:00" (fecha cero de Go) y "0,0 V". → **DEF-08**

Otros riesgos de M3 (no se reportan como defecto porque no son observables con los datos ni con la documentación actuales):

| Riesgo | Dónde |
|---|---|
| La confianza no se acota a [0,5; 0,95] tras ×0,9; el mínimo teórico sería 0,45, aunque con los pesos actuales el mínimo real es ≈0,67 | `confidence.go:17` |
| `relatedEvents` usa la ventana `[inicio−24 h, fin]` en lugar de `[inicio−24 h, inicio+6 h]`: un evento que explica un cambio corto puede no aparecer en la evidencia | `events.go:43-51` |
| Solo se clasifica el cambio más grande: uno real menor puede quedar oculto tras uno explicado mayor | `changes.go:118` |
| Valores `NaN`/`Inf` en el CSV no se detectan como "imposibles" | `quality.go:88-93` |

### M4 · Retorno tras el login

- `useLoginForm.ts:31` navega a `from` después de `await login()`.
- `LoginRoute.tsx:13` hace `<Navigate to="/">` en cuanto el estado pasa a `authenticated`.
- Son dos navegaciones en carrera. Como las rutas son *lazy*, gana una u otra según el tiempo de carga. → **DEF-11** (intermitente, ~40 %)

---

## 2. Tests existentes: qué cubren, qué no y cuánto confiar en ellos

### Ejecución (2026-10-02)

| Suite | Comando | Resultado |
|---|---|---|
| Backend | `go test -cover ./...` | **96 tests, todos en verde** |
| Backend (cobertura real) | `go test -coverpkg=./internal/... ./internal/...` | **84,2 %** de sentencias |
| Frontend | `pnpm test` (Vitest) | **11 tests, todos en verde** (3 archivos) |
| Frontend | `pnpm lint` · `pnpm typecheck` | Sin errores |

> Nota: `go test -cover` por paquete muestra `classify` con **6,9 %** porque sus tests están en el paquete `analysis` (integración). Con `-coverpkg` la cobertura real de `classify` es alta, pero `realSeverity` llega solo al **60 %**: nunca se prueba un caso no activo ni un borde.

### Qué cubren

| Área | Cubierto | Calidad |
|---|---|---|
| Motor con datos reales (`analysis_test.go`, `changes_test.go`, `quality_test.go`) | Las 4 anomalías con tipo, severidad y orden; cambios con inicio, dirección y duración exactos; calidad de datos solo en M-112 | **Buena**: integración contra los CSV reales y determinística |
| Estadística (`stats_test.go`) | Mediana, MAD, z robusto, porcentaje de cambio | Buena (unitarios puros) |
| Eventos (`events_test.go`) | Parada programada no explica un aumento; UNKNOWN no explica nada; ventana +6 h y +7 h | Buena, pero sin el borde −24 h |
| Auth (`auth/service_test.go`) | Login, contraseña errónea, token vencido, otro secreto | Solo en el servicio, no en el handler |
| API de punta a punta (`server_test.go`) | Rutas protegidas → 401, dashboard | **Fija un defecto** (ver abajo) |
| Medidores (`meter/service_test.go`) | Filtros, orden, paginación, `getById` | Faltan clases de equivalencia (falso positivo, minúsculas, página negativa) |
| Frontend (`format.test.ts`, `marks.test.tsx`, `useMeterFilters.test.ts`) | Formato es-CO, sellos de estado, parseo de la URL | **Oculta un defecto** (ver abajo) |

### Qué no cubren (y por qué importa)

| Hueco | Consecuencia |
|---|---|
| `StatusOf` sin caso FALSE_POSITIVE | DEF-01 llegó al build |
| `TestGetAllFilters` usa "109" y "M-11", nunca minúsculas | DEF-04 llegó al build |
| `Normalize` nunca prueba `page` ≤ 0 | DEF-05 llegó al build |
| `realSeverity`: ningún test de los bordes 50 % y 20 % ni de "no activo" | DEF-07 llegó al build |
| `HasIssue`: no prueba 1 y 2 horas faltantes ni el mínimo de 3 | DEF-08 llegó al build |
| `Pagination.tsx`, `api-client` (401), `AuthProvider`, `LoginRoute`, polling del análisis: **sin ningún test** | DEF-03, DEF-06 y DEF-11 llegaron al build |
| Las 3 rutas `/ai/*` no están en el test de rutas protegidas | Riesgo (hoy funciona) |
| Confianza: `analysis_test.go` acepta cualquier valor en [0,7; 0,95] | No detectaría que M-104 pase de 0,86 a 0,74 |

### ¿Confío en ellos?

**En parte.** Los tests del **motor** dan confianza real **para el dataset actual**:
- Son de integración contra los CSV reales.
- Fijan resultados exactos (inicio, duración, tipo, orden).
- La caja negra lo confirmó: todas las cifras del README coinciden.

**No dan confianza** para:
- los bordes de los umbrales;
- las reglas de presentación (estado, hora, paginación).

Hay tres problemas de fondo:

1. **Un test que fija un defecto.** `server_test.go:131`:
   ```go
   if counts["normal"] != float64(8) || counts["alert"] != float64(2) || counts["critical"] != float64(2) {
   ```
   La documentación implica 9 / 1 / 2. El test se escribió con la salida del sistema como oráculo, no con la especificación. Si alguien corrige DEF-01, **este test se pondrá rojo** y es probable que se "arregle" el código de vuelta. Hay que corregirlo junto con el defecto.

2. **Un entorno de test que oculta un defecto.** `vite.config.ts:33` fuerza `TZ: 'UTC'` "para que las fechas se evalúen igual en cualquier máquina". Justo en UTC la hora local y la UTC coinciden, así que `format.test.ts:15-19` pasa aunque `formatPlantTime` esté mal. El test es correcto; el entorno lo vuelve ciego.

3. **Cobertura alta ≠ corrección.** `StatusOf` y `Normalize` tienen 100 % de cobertura y aun así tienen defectos (DEF-01 y DEF-05): falta una rama y falta una validación. Lo que faltan son **casos derivados de la especificación**: tablas de decisión y valores límite.

---

## 3. Tests unitarios propuestos

Cubren cada defecto y riesgo encontrado. **No se agregaron al repositorio**, para respetar el alcance acordado ("solo Playwright + TypeScript" en esta entrega). Sí se **verificaron** en una copia aislada del código (fuera del repo):
- todos compilan;
- **fallan exactamente donde están los defectos**;
- pasan en los casos que hoy funcionan.

Así, una vez corregido el código, quedan como regresión.

| Test propuesto | Resultado hoy (copia aislada) |
|---|---|
| `TestStatusOfDecisionTable` | ❌ solo `R2 falso positivo`: `StatusOf = ALERT, esperaba NORMAL`; R1, R3 y R4 ✅ |
| `TestGetAllMeterIDCaseInsensitive` | ❌ `búsqueda "m-109" → [], esperaba [M-109]` |
| `TestNormalizeRejectsNonPositivePage` | ❌ `page=-1` y `page=-100` se aceptan |
| `TestRealSeverityBoundaries` | ❌ solo los bordes: 50,00 % → HIGH (esperaba MEDIUM); 20,00 % → MEDIUM (esperaba LOW); los otros 4 ✅ |
| `TestHasIssueMissingHoursThreshold` | ❌ `MissingHours` = 1 y 2 → `HasIssue = true`; con 3 ✅ |
| `formatPlantTime` en 3 zonas | ❌ Bogotá `12/09 09:00`, Tokio `12/09 23:00`; UTC ✅ |
| `Pagination` | ❌ count 12 / página 1 y count 21 / página 2 con "Siguiente" deshabilitado, y el rango `41–12`; los otros 2 casos ✅ |

### Go

```go
// backend/internal/meter/service_test.go · DEF-01: completa la tabla de decisión de StatusOf.
func TestStatusOfDecisionTable(t *testing.T) {
	tests := []struct {
		name string
		a    *model.Anomaly
		want Status
	}{
		{"R1 sin anomalía", nil, StatusNormal},
		{"R2 falso positivo", &model.Anomaly{Anomaly: false, Type: model.TypeFalsePositive, Severity: model.SeverityLow}, StatusNormal},
		{"R3 severidad alta", &model.Anomaly{Anomaly: true, Type: model.TypeReal, Severity: model.SeverityHigh}, StatusCritical},
		{"R4 explicable media", &model.Anomaly{Anomaly: true, Type: model.TypeExplainable, Severity: model.SeverityMedium}, StatusAlert},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := StatusOf(tt.a); got != tt.want {
				t.Errorf("StatusOf = %s, esperaba %s", got, tt.want)
			}
		})
	}
}

// backend/internal/server/server_test.go · corregir el oráculo de TestDashboardSummary (hoy fija DEF-01).
//   esperado: normal 9 · alert 1 · critical 2

// backend/internal/meter/service_test.go · DEF-04: clase de equivalencia "minúsculas".
// Usa los helpers existentes de service_test.go (newTestService, getAll).
func TestGetAllMeterIDCaseInsensitive(t *testing.T) {
	svc := newTestService(t)
	big := httpx.Pagination{Size: httpx.MaxPageSize}
	for _, q := range []string{"m-109", "M-109", "109"} {
		got := getAll(t, svc, PagedRequest{Pagination: big, Filter: Filter{MeterID: q}})
		if !slices.Equal(got, []string{"M-109"}) {
			t.Errorf("búsqueda %q → %v, esperaba [M-109]", q, got)
		}
	}
}

// backend/internal/httpx/paging_test.go (archivo nuevo, package httpx) · DEF-05: valores límite de page.
func TestNormalizeRejectsNonPositivePage(t *testing.T) {
	for _, page := range []int{-1, -100} {
		p := Pagination{Page: page, Size: 10}
		if errs := p.Normalize(); len(errs) == 0 {
			t.Errorf("page=%d debería ser inválida", page)
		}
	}
}

// backend/internal/analysis/classify/classify_test.go (archivo nuevo, package classify) · DEF-07: bordes de severidad (README §8: "supera").
func TestRealSeverityBoundaries(t *testing.T) {
	tests := []struct {
		pct     float64
		ongoing bool
		want    model.Severity
	}{
		{50.01, true, model.SeverityHigh},
		{50.00, true, model.SeverityMedium}, // no supera 50
		{80.00, false, model.SeverityMedium}, // supera 50 pero ya no está activo
		{20.01, true, model.SeverityMedium},
		{20.00, true, model.SeverityLow}, // no supera 20
		{-60.0, true, model.SeverityHigh}, // caída: se usa el valor absoluto
	}
	for _, tt := range tests {
		got := realSeverity(changes.Change{ChangePct: tt.pct, Ongoing: tt.ongoing})
		if got != tt.want {
			t.Errorf("realSeverity(%.2f%%, activo=%v) = %s, esperaba %s", tt.pct, tt.ongoing, got, tt.want)
		}
	}
}

// backend/internal/analysis/quality/quality_test.go · DEF-08: el mínimo de 3 horas sospechosas aplica a las faltantes.
func TestHasIssueMissingHoursThreshold(t *testing.T) {
	for _, tt := range []struct {
		missing int
		want    bool
	}{{1, false}, {2, false}, {3, true}} {
		if got := (Report{MissingHours: tt.missing}).HasIssue(); got != tt.want {
			t.Errorf("MissingHours=%d → HasIssue=%v, esperaba %v", tt.missing, got, tt.want)
		}
	}
}
```

### TypeScript (Vitest)

```ts
// frontend/src/lib/format.test.ts · DEF-02: la hora de planta no depende de la zona del proceso.
// Cambiar process.env.TZ en tiempo de ejecución funciona en Node aunque vite.config.ts fije TZ=UTC.
// Recomendado además: no fijar UTC en vite.config.ts (o fijar una zona ≠ UTC), para que el entorno no oculte estos defectos.
describe.each(['UTC', 'America/Bogota', 'Asia/Tokyo'])('formatPlantTime en %s', (tz) => {
  const original = process.env.TZ
  beforeAll(() => { process.env.TZ = tz })
  afterAll(() => { process.env.TZ = original })

  it('muestra la hora tal como viene', () => {
    expect(formatPlantTime('2026-09-12T14:00:00Z')).toBe('12/09 14:00')
    expect(formatPlantTime('2026-09-11T00:00:00Z')).toBe('11/09 00:00') // no cambia de día
  })
})

// frontend/src/features/meters/components/Pagination.test.tsx · DEF-03 y DEF-06.
describe('Pagination', () => {
  it.each([
    { count: 12, page: 1, next: true }, // 12 / 10 → 2 páginas (hoy falla)
    { count: 12, page: 2, next: false },
    { count: 20, page: 2, next: false },
    { count: 21, page: 2, next: true },
  ])('count $count, página $page → Siguiente habilitado: $next', ({ count, page, next }) => {
    render(<Pagination page={page} size={10} count={count} onPage={() => {}} />)
    const button = screen.getByRole('button', { name: /Siguiente/ })
    if (next) expect(button).toBeEnabled()
    else expect(button).toBeDisabled()
  })

  it('nunca muestra un rango con "desde" mayor que "hasta"', () => {
    render(<Pagination page={5} size={10} count={12} onPage={() => {}} />)
    expect(screen.queryByText(/41–12/)).toBeNull()
  })
})
```

## 4. Cómo se detectarían automáticamente de ahora en adelante

1. **En el pipeline:**
   - `go test ./...` y `pnpm test` (con los tests anteriores).
   - Vitest **en al menos una zona ≠ UTC**.
   - La suite de Playwright de `e2e/` con `timezoneId: 'America/Bogota'`, ya incluida en `.github/workflows/e2e.yml`.
2. **Oráculos desde la especificación, no desde la salida:** las tablas de decisión del README (estado, severidad, tipo de evento) como tests parametrizados. `server_test.go:131` es el ejemplo de lo que hay que evitar.
3. **Valores límite del motor con datos sintéticos:** el generador `e2e/scripts/generate-boundary-data.mjs` sirve también para tests de integración en Go (`DATA_DIR` de prueba).
4. **Defectos conocidos como tests vivos:** los `test.fail()` de `e2e/tests/defects` se ponen rojos en cuanto el defecto se corrige. Eso obliga a convertirlos en regresión.
