import type { Bean } from '../types.ts'

/** Bean name for pickers; adds the roast date when two open bags share a name */
export function beanLabel(bean: Bean, beans: readonly Bean[]): string {
  const twin = beans.some(b => b.id !== bean.id && b.name === bean.name)
  return twin && bean.roast_date ? `${bean.name} · roasted ${bean.roast_date}` : bean.name
}
