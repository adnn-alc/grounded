import { useState, type CSSProperties, type ReactNode } from 'react'
import { MAP_W as W, MAP_H as H, PROJ, SPHERE, GRATICULE, COUNTRIES } from '../data/worldMap.ts'
import type { Bean } from '../types.ts'

type Point = [x: number, y: number]

/** One origin country on the map, aggregated over all bags from it */
interface Origin {
  name:       string     // Natural Earth name (map key)
  label:      string     // display name
  region:     string
  bagsActive: number
  bagsTotal:  number
  regions:    string[]   // growing regions, from "Country · Region"
  beans:      string[]   // active bean names
  pos:        Point      // marker position in the viewBox
}

// ── Projection (Natural Earth I — must match scripts/build-world-map.mjs) ──
function project(lng: number, lat: number): Point {
  const l = lng * Math.PI / 180, p = lat * Math.PI / 180
  const p2 = p * p, p4 = p2 * p2
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
  return [PROJ.tx + PROJ.k * x, PROJ.ty - PROJ.k * y]
}

const BY_NAME = Object.fromEntries(COUNTRIES.map(c => [c.name, c]))

// Map names are Natural Earth abbreviations; show friendlier ones
const DISPLAY: Record<string, string> = {
  'Dominican Rep.': 'Dominican Republic', 'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic', 'United States of America': 'USA',
}

// Common spellings / growing regions found on coffee bags → map name
const ALIASES: Record<string, string> = {
  'brasil': 'Brazil', 'dominican republic': 'Dominican Rep.', 'drc': 'Dem. Rep. Congo',
  'dr congo': 'Dem. Rep. Congo', 'democratic republic of the congo': 'Dem. Rep. Congo',
  'ivory coast': "Côte d'Ivoire", 'cote d\'ivoire': "Côte d'Ivoire", 'east timor': 'Timor-Leste',
  'timor': 'Timor-Leste', 'png': 'Papua New Guinea', 'burma': 'Myanmar', 'lao': 'Laos',
  'usa': 'United States of America', 'united states': 'United States of America',
  'sumatra': 'Indonesia', 'java': 'Indonesia', 'sulawesi': 'Indonesia', 'bali': 'Indonesia',
  'flores': 'Indonesia', 'yunnan': 'China', 'hawaii': 'Hawaii', 'kona': 'Hawaii',
}

// Origins with no outline at this scale — marker only
const POINT_ONLY: Record<string, Point> = { 'Hawaii': [-155.6, 19.6] }

// Put markers in the coffee-growing area rather than the geographic center
const COFFEE_ANCHORS: Record<string, Point> = {
  'Brazil': [-45, -19], 'Mexico': [-93, 16.5], 'India': [76, 13], 'China': [100.5, 23.5],
  'Yemen': [44, 15], 'Vietnam': [108, 12.5],
}

const REGION: Record<string, string> = {
  'Ethiopia': 'East Africa', 'Kenya': 'East Africa', 'Rwanda': 'East Africa', 'Burundi': 'East Africa',
  'Tanzania': 'East Africa', 'Uganda': 'East Africa', 'Dem. Rep. Congo': 'East Africa', 'Malawi': 'East Africa',
  'Zambia': 'East Africa', 'Zimbabwe': 'East Africa',
  'Colombia': 'S. America', 'Brazil': 'S. America', 'Peru': 'S. America', 'Bolivia': 'S. America',
  'Ecuador': 'S. America', 'Venezuela': 'S. America',
  'Panama': 'C. America', 'Costa Rica': 'C. America', 'Guatemala': 'C. America', 'El Salvador': 'C. America',
  'Honduras': 'C. America', 'Nicaragua': 'C. America', 'Mexico': 'C. America', 'Jamaica': 'C. America',
  'Haiti': 'C. America', 'Dominican Rep.': 'C. America', 'Cuba': 'C. America', 'Puerto Rico': 'C. America',
  'Indonesia': 'Asia-Pacific', 'Vietnam': 'Asia-Pacific', 'India': 'Asia-Pacific', 'Papua New Guinea': 'Asia-Pacific',
  'Philippines': 'Asia-Pacific', 'Laos': 'Asia-Pacific', 'Myanmar': 'Asia-Pacific', 'Thailand': 'Asia-Pacific',
  'China': 'Asia-Pacific', 'Timor-Leste': 'Asia-Pacific', 'Hawaii': 'Asia-Pacific',
  'Yemen': 'Middle East',
}

const LOOKUP: Record<string, string> = {}
COUNTRIES.forEach(c => { LOOKUP[c.name.toLowerCase()] = c.name })
Object.entries(DISPLAY).forEach(([k, v]) => { LOOKUP[v.toLowerCase()] = k })
Object.entries(ALIASES).forEach(([k, v]) => { LOOKUP[k] = v })

/** "Ethiopia · Guji" → ['Ethiopia'];  "Brazil & Mexico" → ['Brazil', 'Mexico'];  "Random" → [] */
function originCountries(origin: string): string[] {
  const head = (origin || '').split('·')[0].trim().toLowerCase()
  if (!head) return []
  if (LOOKUP[head]) return [LOOKUP[head]]
  const found = head.split(/\s*(?:&|,|\/|\+|\band\b)\s*/).map(t => LOOKUP[t.trim()]).filter(Boolean)
  return [...new Set(found)]
}

function buildOrigins(beans: Bean[]) {
  const map: Record<string, Omit<Origin, 'regions' | 'pos'> & { regions: Set<string> }> = {}
  const unmapped = new Set<string>()
  let mappedBags = 0
  beans.forEach(b => {
    if (!b.origin?.trim()) return
    const countries = originCountries(b.origin)
    if (!countries.length) { unmapped.add(b.origin.trim()); return }
    mappedBags++
    const sub = countries.length === 1 && b.origin.includes('·') ? b.origin.split('·')[1].trim() : ''
    countries.forEach(name => {
      const o = map[name] ||= {
        name, label: DISPLAY[name] || name, region: REGION[name] || 'Other',
        bagsActive: 0, bagsTotal: 0, regions: new Set(), beans: [],
      }
      o.bagsTotal++
      if (!b.archived) { o.bagsActive++; o.beans.push(b.name) }
      if (sub) o.regions.add(sub)
    })
  })
  const origins = Object.values(map).map((o): Origin => {
    const ll = COFFEE_ANCHORS[o.name] || POINT_ONLY[o.name]
    return { ...o, regions: [...o.regions], pos: ll ? project(...ll) : BY_NAME[o.name].c }
  })
  return { origins, unmapped: [...unmapped], mappedBags }
}

// [dx, dy, anchor] in viewBox units — keeps the crowded East Africa / Central America labels apart
const LABEL_OFFSETS: Record<string, [dx: number, dy: number, anchor: 'start' | 'end']> = {
  'Ethiopia': [10, -4, 'start'], 'Kenya': [11, 4, 'start'], 'Uganda': [-9, -3, 'end'],
  'Rwanda': [-9, -2, 'end'], 'Burundi': [-9, 7, 'end'], 'Tanzania': [10, 8, 'start'],
  'Dem. Rep. Congo': [-10, 3, 'end'], 'Yemen': [-8, -6, 'end'],
  'Colombia': [10, -2, 'start'], 'Ecuador': [-9, 3, 'end'], 'Peru': [-9, 4, 'end'],
  'Brazil': [10, 4, 'start'], 'Bolivia': [10, 4, 'start'],
  'Panama': [8, 8, 'start'], 'Costa Rica': [-9, 6, 'end'], 'Nicaragua': [9, 2, 'start'],
  'Honduras': [9, -4, 'start'], 'El Salvador': [-8, 7, 'end'], 'Guatemala': [-9, -2, 'end'],
  'Mexico': [-9, -3, 'end'], 'Jamaica': [8, -4, 'start'], 'Dominican Rep.': [8, -4, 'start'],
}

const fillFor = (o: { bagsActive: number } | undefined) => !o ? 'var(--surface)'
  : o.bagsActive > 0 ? 'color-mix(in oklch, var(--crema) 58%, var(--surface))'
  : 'color-mix(in oklch, var(--crema) 24%, var(--surface))'

const MONO = 'var(--font-mono)'
const SERIF = 'var(--font-serif)'
const SANS = 'var(--font-sans)'

// ── Sub-components ────────────────────────────────────────────────────────────

const [, Y_CANCER] = project(0, 23.4)
const [, Y_CAPRICORN] = project(0, -23.4)
const [, Y_EQUATOR] = project(0, 0)

// Band + lines sit under the countries
function CoffeeBelt() {
  return (
    <g style={{ pointerEvents: 'none' }} clipPath="url(#cm-sphere)">
      <rect x={0} y={Y_CANCER} width={W} height={Y_CAPRICORN - Y_CANCER} style={{ fill: 'var(--crema)' }} opacity="0.045" />
      <g style={{ stroke: 'var(--crema)' }} strokeWidth="0.6" strokeDasharray="2 4" opacity="0.45">
        <line x1={0} y1={Y_CANCER} x2={W} y2={Y_CANCER} />
        <line x1={0} y1={Y_CAPRICORN} x2={W} y2={Y_CAPRICORN} />
      </g>
      <line x1={0} y1={Y_EQUATOR} x2={W} y2={Y_EQUATOR} style={{ stroke: 'var(--border-strong)' }} strokeWidth="0.6" strokeDasharray="1 3" opacity="0.6" />
    </g>
  )
}

// Labels sit over open ocean, drawn above the countries
function BeltLabels() {
  const label: CSSProperties = { fontFamily: SANS, fontSize: '8px', pointerEvents: 'none' }
  return (
    <g>
      <text x={project(180, 23.4)[0] - 14} y={Y_CANCER - 4} textAnchor="end" style={{ ...label, fill: 'var(--crema)' }} opacity="0.7">Tropic of Cancer, 23.4°N</text>
      <text x={project(-180, -23.4)[0] + 14} y={Y_CAPRICORN + 10} style={{ ...label, fill: 'var(--crema)' }} opacity="0.7">Tropic of Capricorn, 23.4°S</text>
      <text x={project(-180, 0)[0] + 10} y={Y_EQUATOR - 4} style={{ ...label, fill: 'var(--text-4)' }}>Equator</text>
    </g>
  )
}

function HoverCard({ origin }: { origin: Origin }) {
  const [x, y] = origin.pos
  const leftPct = (x / W) * 100
  return (
    <div style={{
      position: 'absolute',
      left: `calc(${leftPct}% + 16px)`,
      top: `calc(${(y / H) * 100}% - 20px)`,
      transform: leftPct > 66 ? 'translateX(calc(-100% - 32px))' : 'none',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      minWidth: 210,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <div className="map-card-k">{origin.region}</div>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, lineHeight: 1.1, marginTop: 2, color: 'var(--text)' }}>{origin.label}</div>
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 14px' }}>
        <Tag>Open</Tag>
        <Val color={origin.bagsActive > 0 ? 'var(--crema)' : 'var(--text-3)'}>{origin.bagsActive} bags</Val>
        <Tag>All time</Tag>
        <Val>{origin.bagsTotal} bags</Val>
        {origin.regions.length > 0 && (<><Tag>Regions</Tag><Val>{origin.regions.join(', ')}</Val></>)}
      </div>
      {origin.beans.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          <div className="map-card-k">On the shelf</div>
          {origin.beans.map(b => (
            <div key={b} style={{ fontSize: 13, fontFamily: SERIF, fontStyle: 'italic', lineHeight: 1.3, color: 'var(--text)' }}>{b}</div>
          ))}
        </>
      )}
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="map-card-k">{children}</span>
}
function Val({ children, color }: { children: ReactNode; color?: string }) {
  return <span style={{ fontFamily: MONO, fontSize: 12, color: color || 'var(--text)' }}>{children}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoffeeMap({ beans = [], showRegionStrip = true }: { beans?: Bean[]; showRegionStrip?: boolean }) {
  const [hovered, setHovered] = useState<Origin | null>(null)
  const { origins, unmapped, mappedBags } = buildOrigins(beans)
  const byName = Object.fromEntries(origins.map(o => [o.name, o]))

  const regions = Object.entries(origins.reduce<Record<string, { countries: number; active: number; total: number }>>((acc, o) => {
    const r = acc[o.region] ||= { countries: 0, active: 0, total: 0 }
    r.countries++; r.active += o.bagsActive; r.total += o.bagsTotal
    return acc
  }, {})).sort((a, b) => b[1].total - a[1].total)

  // draw active last so its markers/labels sit on top
  const markers = [...origins].sort((a, b) => Number(a.bagsActive > 0) - Number(b.bagsActive > 0))
  const hover = (o: Origin) => () => setHovered(o)
  const unhover = () => setHovered(null)

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <defs>
            <clipPath id="cm-sphere"><path d={SPHERE} /></clipPath>
            <radialGradient id="cm-glow">
              <stop offset="0%" style={{ stopColor: 'var(--crema)', stopOpacity: 0.55 }} />
              <stop offset="100%" style={{ stopColor: 'var(--crema)', stopOpacity: 0 }} />
            </radialGradient>
            <filter id="cm-txt-halo" x="-20%" y="-40%" width="140%" height="180%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="thick" />
              <feFlood style={{ floodColor: 'var(--bg)', floodOpacity: 0.85 }} />
              <feComposite in2="thick" operator="in" result="halo" />
              <feMerge><feMergeNode in="halo" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ocean + graticule */}
          <path d={SPHERE} style={{ fill: 'var(--bg)' }} />
          <path d={GRATICULE} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth="0.4" opacity="0.45" />

          <CoffeeBelt />

          {/* countries */}
          <g strokeLinejoin="round">
            {COUNTRIES.map(c => {
              const o = byName[c.name]
              const isHovered = hovered && hovered.name === c.name
              return (
                <path key={c.name} d={c.d}
                  style={{
                    fill: fillFor(o),
                    stroke: isHovered ? 'var(--crema)' : o ? 'color-mix(in oklch, var(--crema) 45%, var(--border))' : 'var(--border)',
                    cursor: o ? 'pointer' : 'default',
                    transition: 'fill 0.2s',
                  }}
                  strokeWidth={isHovered ? 1.1 : 0.45}
                  onMouseEnter={o ? hover(o) : undefined}
                  onMouseLeave={o ? unhover : undefined}>
                  {!o && <title>{DISPLAY[c.name] || c.name}</title>}
                </path>
              )
            })}
          </g>
          {/* re-draw hovered outline on top so neighbors don't cover it */}
          {hovered && BY_NAME[hovered.name] && (
            <path d={BY_NAME[hovered.name].d} fill="none" style={{ stroke: 'var(--crema)', pointerEvents: 'none' }} strokeWidth="1.1" />
          )}

          <path d={SPHERE} fill="none" style={{ stroke: 'var(--border-strong)' }} strokeWidth="0.8" opacity="0.7" />
          <BeltLabels />

          {/* markers + labels */}
          {markers.map(o => {
            const [x, y] = o.pos
            const active = o.bagsActive > 0
            const isHovered = hovered?.name === o.name
            const r = active ? 2.6 + Math.min(o.bagsActive, 4) * 0.5 : 1.8
            const [dx, dy, anchor] = LABEL_OFFSETS[o.name] || [8, -4, 'start']
            return (
              <g key={o.name} style={{ cursor: 'pointer' }} onMouseEnter={hover(o)} onMouseLeave={unhover}>
                <circle cx={x} cy={y} r={10} fill="transparent" />
                {active && (
                  <circle cx={x} cy={y} r={r + 4} fill="url(#cm-glow)" style={{ pointerEvents: 'none' }}>
                    <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="2.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r={r}
                  style={{ fill: active ? 'var(--crema)' : 'var(--bg)', stroke: active ? 'var(--bg)' : 'var(--crema-2)' }}
                  strokeWidth={active ? 1 : 0.9} />
                {(active || isHovered) && (
                  <text x={x + dx} y={y + dy} textAnchor={anchor} filter="url(#cm-txt-halo)"
                    style={{ fill: active ? 'var(--crema-2)' : 'var(--text-2)', fontFamily: SERIF, fontStyle: 'italic', fontSize: isHovered ? 12.5 : 11, pointerEvents: 'none' }}>
                    {o.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* top-right stat */}
          <g transform={`translate(${W - 150}, 18)`} style={{ pointerEvents: 'none' }}>
            <text y="8" style={{ fill: 'var(--text-3)', fontFamily: SANS, fontSize: '9px' }}>Origins</text>
            <text y="36" style={{ fill: 'var(--text)', fontFamily: MONO, fontSize: 28, letterSpacing: '-0.03em' }}>
              {origins.length}<tspan style={{ fontSize: 12, fill: 'var(--text-3)' }}> countries</tspan>
            </text>
            <text y="50" style={{ fill: 'var(--text-3)', fontFamily: SANS, fontSize: '9px' }}>{mappedBags} bags in all</text>
          </g>

          {/* legend */}
          <g transform={`translate(14, ${H - 58})`} style={{ pointerEvents: 'none' }}>
            <rect width="118" height="46" rx="5" style={{ fill: 'var(--bg-2)', stroke: 'var(--border)' }} opacity="0.94" />
            <rect x="10" y="10" width="14" height="9" rx="2" style={{ fill: fillFor({ bagsActive: 1 }), stroke: 'var(--crema-2)' }} strokeWidth="0.5" />
            <circle cx="17" cy="14.5" r="2.2" style={{ fill: 'var(--crema)' }} />
            <text x="32" y="18" style={{ fill: 'var(--text)', fontFamily: SANS, fontSize: '9px' }}>Open bags</text>
            <rect x="10" y="27" width="14" height="9" rx="2" style={{ fill: fillFor({ bagsActive: 0 }), stroke: 'var(--crema-2)' }} strokeWidth="0.5" />
            <circle cx="17" cy="31.5" r="1.6" style={{ fill: 'var(--bg)', stroke: 'var(--crema-2)' }} strokeWidth="0.8" />
            <text x="32" y="35" style={{ fill: 'var(--text-2)', fontFamily: SANS, fontSize: '9px' }}>Tried before</text>
          </g>
        </svg>

        {hovered && <HoverCard origin={hovered} />}
      </div>

      {showRegionStrip && regions.length > 0 && (
        <div className="map-regions">
          {regions.map(([name, r]) => (
            <div key={name} className="map-region">
              <div className="mr-name">{name}</div>
              <div className="mr-num"><b className={r.active > 0 ? 'on' : ''}>{r.total}</b> {r.total === 1 ? 'bag' : 'bags'} from {r.countries} {r.countries === 1 ? 'country' : 'countries'}</div>
              {r.active > 0 && <div className="mr-active">{r.active} open now</div>}
            </div>
          ))}
        </div>
      )}

      {unmapped.length > 0 && (
        <div className="map-unmapped">Not on the map, because the origin isn't a country: {unmapped.join(', ')}</div>
      )}
    </div>
  )
}
