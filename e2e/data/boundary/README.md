# Dataset sintético de valores límite

Generado por `scripts/generate-boundary-data.mjs` (no editar a mano). Lo sirve una segunda
instancia del backend (`DATA_DIR`, puerto 8081) para probar los umbrales documentados del motor.

| Medidor | Caso |
|---|---|
| B-101 | Control: todo constante |
| B-102 | Exactamente +50,0 % las últimas 6 h (activo) |
| B-103 | +50,1 % las últimas 6 h (activo) |
| B-104 | Exactamente +20,0 % las últimas 6 h (activo) |
| B-105 | +100 % solo 5 h seguidas (no es cambio sostenido) |
| B-106 | Voltaje +10 % durante 2 h |
| B-107 | Voltaje +10 % durante 3 h |
| B-108 | Una hora faltante (2026-09-10 05:00) |
