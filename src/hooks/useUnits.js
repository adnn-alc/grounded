export function useUnits(units) {
  return {
    m:  (g) => units.mass === 'g' ? parseFloat(g).toFixed(1) : (g / 28.3495).toFixed(2),
    mU: ()  => units.mass === 'g' ? 'g' : 'oz',
    t:  (c) => units.temp === 'C' ? parseFloat(c).toFixed(1) : (c * 9 / 5 + 32).toFixed(1),
    tU: ()  => units.temp === 'C' ? '°C' : '°F',
  }
}

export const flavColor = (k) =>
  ({ acidity: 'var(--sour)', sweetness: 'var(--sweet)', body: 'var(--crema)', bitterness: 'var(--bitter)', balance: 'var(--good)', aftertaste: 'var(--crema-2)' })[k] || 'var(--crema)'
