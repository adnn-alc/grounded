// Fonts are bundled with the app (via @fontsource) — no requests to Google or any CDN.
// Browsers only download a font file once something on the page actually uses it,
// so offering several choices doesn't slow down the default setup.
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import '@fontsource-variable/ibm-plex-sans'

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

const SANS_FALLBACK  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const MONO_FALLBACK  = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SERIF_FALLBACK = 'Georgia, serif'

// Three font roles, each mapped to a CSS variable in global.css
export const FONT_ROLES = [
  { role: 'sans',  label: 'Text',             desc: 'Body text, buttons and forms.' },
  { role: 'mono',  label: 'Numbers & labels', desc: 'Doses, times, stats and small caps labels.' },
  { role: 'serif', label: 'Headings',         desc: 'Page titles and big italic numbers.' },
]

export const FONT_OPTIONS = {
  sans: [
    { id: 'inter',         name: 'Inter',         stack: `'Inter Variable', ${SANS_FALLBACK}` },
    { id: 'geist',         name: 'Geist',         stack: `'Geist Variable', ${SANS_FALLBACK}` },
    { id: 'dm-sans',       name: 'DM Sans',       stack: `'DM Sans Variable', ${SANS_FALLBACK}` },
    { id: 'manrope',       name: 'Manrope',       stack: `'Manrope Variable', ${SANS_FALLBACK}` },
    { id: 'ibm-plex-sans', name: 'IBM Plex Sans', stack: `'IBM Plex Sans Variable', ${SANS_FALLBACK}` },
    { id: 'system',        name: 'System',        stack: `system-ui, ${SANS_FALLBACK}` },
  ],
  mono: [
    { id: 'jetbrains-mono', name: 'JetBrains Mono', stack: `'JetBrains Mono Variable', ${MONO_FALLBACK}` },
    { id: 'geist-mono',     name: 'Geist Mono',     stack: `'Geist Mono Variable', ${MONO_FALLBACK}` },
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

export const DEFAULT_FONTS = { sans: 'inter', mono: 'jetbrains-mono', serif: 'instrument-serif' }

export const fontStack = (role, id) =>
  (FONT_OPTIONS[role].find(f => f.id === id) || FONT_OPTIONS[role].find(f => f.id === DEFAULT_FONTS[role])).stack

// Applies theme + fonts to <html>. Also cached in localStorage so the next page
// load paints with the right look before the settings arrive from the API.
export function applyAppearance(theme, fonts) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  for (const { role } of FONT_ROLES) root.style.setProperty(`--font-${role}`, fontStack(role, fonts[role]))
  try {
    localStorage.setItem('grounded-theme', theme)
    localStorage.setItem('grounded-fonts', JSON.stringify(fonts))
  } catch {}
}

export function applyCachedAppearance() {
  let theme = 'moody', fonts = DEFAULT_FONTS
  try {
    theme = localStorage.getItem('grounded-theme') || theme
    fonts = { ...DEFAULT_FONTS, ...JSON.parse(localStorage.getItem('grounded-fonts')) }
  } catch {}
  applyAppearance(theme, fonts)
}
