// Fonts are bundled with the app (via @fontsource) — no requests to Google or any CDN.
// Browsers only download a font file once something on the page actually uses it,
// so offering several choices doesn't slow down the default setup.
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/instrument-sans'

import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/fira-code'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/playfair-display'
import '@fontsource-variable/playfair-display/wght-italic.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import '@fontsource-variable/source-serif-4'
import '@fontsource-variable/source-serif-4/wght-italic.css'

import type { Design, FontRole, Fonts, Settings } from '../types.ts'

export interface FontOption {
  id:    string
  name:  string
  stack: string   // CSS font-family value
}

const SANS_FALLBACK  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const MONO_FALLBACK  = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SERIF_FALLBACK = 'Georgia, serif'

// Three font roles, each mapped to a CSS variable in global.css (listed in the order Settings shows them)
export const FONT_ROLES: { role: FontRole; label: string; desc: string }[] = [
  { role: 'serif', label: 'Headings', desc: 'Page titles, bean names' },
  { role: 'sans',  label: 'Text',     desc: 'Body, buttons, forms' },
  { role: 'mono',  label: 'Numbers',  desc: 'Doses, times, ratings' },
]

export const FONT_OPTIONS: Record<FontRole, FontOption[]> = {
  sans: [
    { id: 'geist',         name: 'Geist',         stack: `'Geist Variable', ${SANS_FALLBACK}` },
    { id: 'inter',         name: 'Inter',         stack: `'Inter Variable', ${SANS_FALLBACK}` },
    { id: 'dm-sans',       name: 'DM Sans',       stack: `'DM Sans Variable', ${SANS_FALLBACK}` },
    { id: 'manrope',       name: 'Manrope',       stack: `'Manrope Variable', ${SANS_FALLBACK}` },
    { id: 'ibm-plex-sans', name: 'IBM Plex Sans', stack: `'IBM Plex Sans Variable', ${SANS_FALLBACK}` },
    { id: 'instrument-sans', name: 'Instrument Sans', stack: `'Instrument Sans Variable', ${SANS_FALLBACK}` },
    { id: 'system',        name: 'System',        stack: `system-ui, ${SANS_FALLBACK}` },
  ],
  mono: [
    { id: 'geist-mono',     name: 'Geist Mono',     stack: `'Geist Mono Variable', ${MONO_FALLBACK}` },
    { id: 'jetbrains-mono', name: 'JetBrains Mono', stack: `'JetBrains Mono Variable', ${MONO_FALLBACK}` },
    { id: 'fira-code',      name: 'Fira Code',      stack: `'Fira Code Variable', ${MONO_FALLBACK}` },
    { id: 'ibm-plex-mono',  name: 'IBM Plex Mono',  stack: `'IBM Plex Mono', ${MONO_FALLBACK}` },
    { id: 'system',         name: 'System',         stack: MONO_FALLBACK },
  ],
  serif: [
    { id: 'instrument-serif', name: 'Instrument Serif', stack: `'Instrument Serif', ${SERIF_FALLBACK}` },
    { id: 'fraunces',         name: 'Fraunces',         stack: `'Fraunces Variable', ${SERIF_FALLBACK}` },
    { id: 'playfair-display', name: 'Playfair Display', stack: `'Playfair Display Variable', ${SERIF_FALLBACK}` },
    { id: 'dm-serif-display', name: 'DM Serif Display', stack: `'DM Serif Display', ${SERIF_FALLBACK}` },
    { id: 'source-serif-4',   name: 'Source Serif 4',   stack: `'Source Serif 4 Variable', ${SERIF_FALLBACK}` },
    { id: 'system',           name: 'System',           stack: SERIF_FALLBACK },
  ],
}

export const DEFAULT_FONTS: Fonts = { sans: 'geist', mono: 'geist-mono', serif: 'instrument-serif' }

export const fontStack = (role: FontRole, id: string): string =>
  (FONT_OPTIONS[role].find(f => f.id === id) || FONT_OPTIONS[role].find(f => f.id === DEFAULT_FONTS[role])!).stack

// ── Designs ──────────────────────────────────────────────────────────
export const DESIGNS: { id: Design; name: string; desc: string }[] = [
  { id: 'refined',    name: 'Refined',    desc: 'Sidebar, serif titles, mono numbers' },
  { id: 'extraction', name: 'Extraction', desc: 'Icon rail, big numbers, time dial' },
]

// Extraction has two font roles: one face for numbers and headings, one for text
export const EXTRACTION_FONT_IDS: Record<'serif' | 'sans', string[]> = {
  serif: ['fraunces', 'dm-serif-display', 'playfair-display', 'instrument-serif'],
  sans:  ['instrument-sans', 'geist', 'dm-sans', 'inter'],
}
const EXTRACTION_FONTS = { serif: 'fraunces', sans: 'instrument-sans' }
export const EXTRACTION_THEME_IDS = ['roast', 'mocha', 'latte', 'crema']

/** What <html> gets: the design, its theme and a font id per role */
export interface Look { design: Design; theme: string; fonts: Fonts }

/** The look the settings ask for, with defaults; each design keeps its own theme and fonts */
export function lookFrom(settings: Settings): Look {
  if (settings.design !== 'extraction') {
    return { design: 'refined', theme: settings.theme || 'moody', fonts: { ...DEFAULT_FONTS, ...settings.fonts } }
  }
  const x = settings.extraction ?? {}
  const theme = x.theme && EXTRACTION_THEME_IDS.includes(x.theme) ? x.theme : EXTRACTION_THEME_IDS[0]!
  const serif = x.fonts?.serif || EXTRACTION_FONTS.serif
  // Numbers use the headings face, so mono is the serif here
  return { design: 'extraction', theme, fonts: { sans: x.fonts?.sans || EXTRACTION_FONTS.sans, serif, mono: serif } }
}

const stackFor = (look: Look, role: FontRole): string =>
  look.design === 'extraction' && role === 'mono' ? fontStack('serif', look.fonts.mono) : fontStack(role, look.fonts[role])

// Applies the design, theme and fonts to <html>. Also cached in localStorage so the
// next page load paints with the right look before the settings arrive from the API.
export function applyAppearance(look: Look) {
  const root = document.documentElement
  root.setAttribute('data-design', look.design)
  root.setAttribute('data-theme', look.theme)
  FONT_ROLES.forEach(({ role }) => root.style.setProperty(`--font-${role}`, stackFor(look, role)))
  try { localStorage.setItem('grounded-look', JSON.stringify(look)) } catch {}
}

export function applyCachedAppearance() {
  let look: Look = { design: 'refined', theme: 'moody', fonts: DEFAULT_FONTS }
  try {
    const cached = JSON.parse(localStorage.getItem('grounded-look') ?? 'null') as Partial<Look> | null
    if (cached) look = { ...look, ...cached, fonts: { ...DEFAULT_FONTS, ...cached.fonts } }
    else {
      // Saved by versions before designs: theme and fonts only
      look.theme = localStorage.getItem('grounded-theme') || look.theme
      look.fonts = { ...DEFAULT_FONTS, ...JSON.parse(localStorage.getItem('grounded-fonts') ?? 'null') }
    }
  } catch {}
  applyAppearance(look)
}
