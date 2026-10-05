# 02 · Pruebas de humo (smoke)

**Objetivo:** el conjunto mínimo de verificaciones que dicen "este build se puede probar". Si una falla, no tiene sentido seguir con la regresión.

**Criterio de selección:** cada caso cubre un eslabón distinto de la cadena de valor, sin repetir ninguno:

```
Arranque → Autenticación → Autorización → Datos → Motor → UI integrada → Navegación → Detalle
```

Ninguno valida reglas de negocio finas: eso es regresión.

**Ejecución:** `cd e2e && npm run test:smoke`, con el tag `@smoke`. Se corre en el proyecto `api` y en los 3 navegadores. **Resultado (2026-10-02, commit `15765d9`): 15 de 15 en verde en 48 s** (5 de API + 3 de UI × 3 navegadores + el login de `setup`).

| ID | Caso | Capa | Por qué está en el humo | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| SMK-01 | El backend responde `/health` | API | Sin servidor no hay nada que probar; separa "la app no levantó" de "la app falla" | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | ✅ Pasa |
| SMK-02 | El login del operador devuelve un JWT | API | Todas las rutas de `/api/v1` dependen del token; si falla el login, falla todo | 200, `token_type: Bearer`, JWT de 3 partes, `user.email` correcto | Igual al esperado | ✅ Pasa |
| SMK-03 | Una ruta protegida sin token → 401 | API | Confirma que la protección está activa; si no, el resto de pruebas de autorización no tienen sentido | 401 | 401 | ✅ Pasa |
| SMK-04 | Los 12 medidores del dataset están cargados | API | Valida que los CSV se leyeron (`DATA_DIR` correcto) | `count = 12`, ids M-101 a M-112 | 12, ids correctos | ✅ Pasa |
| SMK-05 | El motor detectó 4 anomalías con M-109 en prioridad 1 | API | El motor corre una vez al arrancar; si no corrió o el dataset cambió, todo el producto es inválido | 4 anomalías, la primera M-109 / prioridad 1 / `REAL_ANOMALY` | Igual al esperado | ✅ Pasa |
| SMK-06 | Con sesión, el Despacho muestra la orden de prioridad 1 (M-109) | UI | Integración front ↔ proxy ↔ API: sesión válida, dashboard y órdenes renderizadas | Orden "M-109 · Prioridad máxima · Anomalía real" visible | Visible en los 3 navegadores | ✅ Pasa |
| SMK-07 | La navegación lleva a Medidores y Anomalías IA | UI | Las pantallas se cargan con lazy loading; un chunk roto deja una sección inservible | Cada pantalla muestra su h1 y sus datos; el enlace activo tiene `aria-current="page"` | Igual en los 3 navegadores | ✅ Pasa |
| SMK-08 | El detalle de M-109 carga con su orden | UI | `getById` es el endpoint más pesado (336 lecturas + gráficas); valida el detalle de punta a punta | h1 "M-109", encabezado "Orden 1 · …" y enlace "Abrir investigación" | Igual en los 3 navegadores | ✅ Pasa |

**Fuera del humo, a propósito:**
- Run AI Analysis: modifica el estado del servidor y tarda más.
- Filtros, orden y paginación: son reglas de negocio.
- Cualquier caso negativo: prueba robustez, no si el build se puede probar.

Todos están en la regresión (`03-casos-caja-negra.md`).

**Veredicto del humo:** el build **se puede probar**. Se cumplen los criterios de entrada de `01-plan-de-pruebas.md`.
