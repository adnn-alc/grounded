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

/** Whole grams for amounts that are never weighed to a tenth (what's left in a bag, pours); ounces keep their decimals */
export const wholeMass = (U: UnitHelpers, g: number): string => U.mU() === 'g' ? String(Math.round(g)) : U.m(g)

/** Extraction drops a trailing zero: '18.0' shows as 18, '48.5' stays */
export const shortNum = (n: string): string => Number.isFinite(Number(n)) ? String(Number(n)) : n
