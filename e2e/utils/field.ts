import type { Locator, Page } from '@playwright/test'

/**
 * Casilla "etiqueta + valor" de la app (componente Field). La etiqueta es un <span>
 * sin asociación programática con el valor (no hay <label>, <dt>/<dd> ni aria-labelledby),
 * así que getByLabel no aplica. Se ancla en el texto visible exacto de la etiqueta y se
 * sube a su contenedor. Hallazgo de accesibilidad/testabilidad documentado en qa/04.
 */
export function fieldByLabel(scope: Page | Locator, label: string): Locator {
  return scope.getByText(label, { exact: true }).locator('xpath=..')
}
