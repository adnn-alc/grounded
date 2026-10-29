// Generates src/data/worldMap.ts — pre-projected Natural Earth country paths.
// Usage: npm i --prefix /tmp/mapdeps d3-geo@3 topojson-client@3 world-atlas@2
//        node scripts/build-world-map.mjs /tmp/mapdeps src/data/worldMap.ts 110m
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const [depsDir, outFile, res = '110m'] = process.argv.slice(2)
const require = createRequire(path.join(depsDir, 'package.json'))
const d3 = await import(require.resolve('d3-geo'))
const topojson = await import(require.resolve('topojson-client'))
const topo = JSON.parse(fs.readFileSync(require.resolve(`world-atlas/countries-${res}.json`)))

const W = 1000
const LAT_TOP = 84, LAT_BOTTOM = -56

const all = topojson.feature(topo, topo.objects.countries).features
const countries = all.filter(f => f.properties.name !== 'Antarctica')

const projection = d3.geoNaturalEarth1().fitWidth(W, { type: 'Sphere' })
const yTop = projection([0, LAT_TOP])[1]
const yBot = projection([0, LAT_BOTTOM])[1]
const [tx, ty] = projection.translate()
projection.translate([tx, ty - yTop])
const H = Math.round(yBot - yTop)

const geoPath = d3.geoPath(projection).digits(1)
const r1 = (v) => Math.round(v * 10) / 10

// Label anchor: centroid of the largest polygon (so France ≠ French Guiana, USA ≠ Alaska)
function anchor(f) {
  const g = f.geometry
  if (g.type !== 'MultiPolygon') return geoPath.centroid(f).map(r1)
  let best = null, bestArea = -1
  for (const coords of g.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords }
    const a = geoPath.area(poly)
    if (a > bestArea) { bestArea = a; best = poly }
  }
  return geoPath.centroid(best).map(r1)
}

const out = countries
  .map(f => ({ name: f.properties.name, d: geoPath(f), c: anchor(f) }))
  .filter(c => c.d)
  .sort((a, b) => a.name.localeCompare(b.name))

const graticule = geoPath(d3.geoGraticule().step([20, 20])())
const sphere = geoPath({ type: 'Sphere' })

// sanity check: our runtime projection formula must match d3
function ne1(lng, lat) {
  const l = lng * Math.PI / 180, p = lat * Math.PI / 180
  const p2 = p * p, p4 = p2 * p2
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
  const [ttx, tty] = projection.translate(), k = projection.scale()
  return [ttx + k * x, tty - k * y]
}
for (const pt of [[40, 9], [-47, -15], [-80, 8.5], [120, -2]]) {
  const a = projection(pt), b = ne1(...pt)
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.01) throw new Error(`projection mismatch at ${pt}`)
}

const [ftx, fty] = projection.translate()
const src = `// GENERATED FILE — do not edit by hand.
// Natural Earth ${res} country outlines (public domain, via world-atlas@2),
// pre-projected with d3 geoNaturalEarth1 into a ${W}×${H} viewBox (${LAT_TOP}°N → ${-LAT_BOTTOM}°S).
export const MAP_W = ${W}
export const MAP_H = ${H}
export const PROJ = { k: ${projection.scale()}, tx: ${ftx}, ty: ${fty} }
export const SPHERE = ${JSON.stringify(sphere)}
export const GRATICULE = ${JSON.stringify(graticule)}
export const COUNTRIES: { name: string; c: [number, number]; d: string }[] = [
${out.map(c => `  { name: ${JSON.stringify(c.name)}, c: ${JSON.stringify(c.c)}, d: ${JSON.stringify(c.d)} },`).join('\n')}
]
`
fs.writeFileSync(outFile, src)
console.log(`${out.length} countries, ${W}×${H}, ${(src.length / 1024).toFixed(0)} KB → ${outFile}`)
