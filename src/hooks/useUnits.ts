import type { Units } from '../types.ts'

export interface UnitHelpers {
  m:  (g: number | string) => string   // grams → display mass
  mU: () => string
  t:  (c: number | string) => string   // °C → display temperature
  tU: () => string
}

export function useUnits(units: Units): UnitHelpers {
  return {
    m:  (g) => units.mass === 'g' ? parseFloat(String(g)).toFixed(1) : (Number(g) / 28.3495).toFixed(2),
    mU: ()  => units.mass === 'g' ? 'g' : 'oz',
    t:  (c) => units.temp === 'C' ? parseFloat(String(c)).toFixed(1) : (Number(c) * 9 / 5 + 32).toFixed(1),
    tU: ()  => units.temp === 'C' ? '°C' : '°F',
  }
}
