import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import Ico, { type IconName } from './Ico.tsx'
import { beanLabel } from '../data/beans.ts'
import type { Bean, Route } from '../types.ts'

interface NavEntry { id: Route; label: string; icon: IconName }

const WORKSPACE: NavEntry[] = [
  { id: 'home',   label: 'Home',    icon: 'home' },
  { id: 'dialin', label: 'Dial-in', icon: 'timer' },
]
const LIBRARY: NavEntry[] = [
  { id: 'shot-history', label: 'Shots',   icon: 'history' },
  { id: 'brew-history', label: 'Brews',   icon: 'dripper' },
  { id: 'beans',        label: 'Beans',   icon: 'beans' },
  { id: 'recipes',      label: 'Recipes', icon: 'book' },
  { id: 'gear',         label: 'Gear',    icon: 'machine' },
  { id: 'stats',        label: 'Stats',   icon: 'chart' },
]
const BAGS: NavEntry[] = [
  { id: 'stock',          label: 'Stock',         icon: 'box' },
  { id: 'archived-beans', label: 'Finished bags', icon: 'archive' },
  { id: 'tips',           label: 'Tips',          icon: 'note' },
]

/** Page names, also used for the browser tab title */
export const ROUTE_LABELS: Record<Route, string> = Object.fromEntries(
  [...WORKSPACE, ...LIBRARY, ...BAGS].map(e => [e.id, e.label])
) as Record<Route, string>

const BRAND_SIZE = 26

export function BrandMark({ size = BRAND_SIZE }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="3" />
      <circle cx="30" cy="30" r="5" fill="currentColor" />
      <circle cx="70" cy="28" r="4" fill="currentColor" />
      <circle cx="22" cy="60" r="4.5" fill="currentColor" />
      <circle cx="55" cy="50" r="3.5" fill="currentColor" />
      <circle cx="78" cy="68" r="4" fill="currentColor" />
      <circle cx="45" cy="78" r="3.5" fill="currentColor" />
    </svg>
  )
}

/** A link to Home that keeps the hash routing (cmd/ctrl-click still opens a new tab) */
function homeClick(onHome: () => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); onHome() }
}

/** The logo and name; with onHome it's a link to Home (sidebar, phone), without it just the mark (loading screens) */
export function Brand({ onHome }: { onHome?: () => void }) {
  const inner = <><BrandMark /><div><span className="brand-bracket">[</span> grounded <span className="brand-bracket">]</span></div></>
  if (!onHome) return <div className="brand">{inner}</div>
  return <a href="#/home" className="brand" title="Home" onClick={homeClick(onHome)}>{inner}</a>
}

interface NavLinkProps {
  entry:    NavEntry
  route:    Route
  setRoute: (route: Route) => void
  count?:   number
}

function NavLink({ entry, route, setRoute, count }: NavLinkProps) {
  return (
    <a href={`#/${entry.id}`} className={`nav-item${route === entry.id ? ' active' : ''}`}
      onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); setRoute(entry.id) }}>
      <Ico name={entry.icon} size={17} className="ico" />
      <span>{entry.label}</span>
      {count != null && <span className="count">{count}</span>}
    </a>
  )
}

interface SidebarProps {
  route:          Route
  setRoute:       (route: Route) => void
  counts:         Partial<Record<Route, number>>
  onPull:         () => void
  onOpenSettings: () => void
}

export function Sidebar({ route, setRoute, counts, onPull, onOpenSettings }: SidebarProps) {
  const link = (e: NavEntry) => <NavLink key={e.id} entry={e} route={route} setRoute={setRoute} count={counts[e.id]} />
  return (
    <aside className="side">
      <Brand onHome={() => setRoute('home')} />
      <button className="primary-btn pull-btn" onClick={onPull}><Ico name="plus" size={16} /> Pull a shot</button>
      {WORKSPACE.map(link)}
      <div className="nav-group">Library</div>
      {LIBRARY.map(link)}
      <div className="nav-group">Bags</div>
      {BAGS.map(link)}
      <div className="side-foot">
        <button className="nav-item" onClick={onOpenSettings}>
          <Ico name="sliders" size={16} className="ico" /> Settings
          <span className="version">v{__APP_VERSION__}</span>
        </button>
      </div>
    </aside>
  )
}

// ── Extraction: an icon rail instead of the sidebar ─────────────────────
interface RailEntry { id: Route; label: string; icon: IconName; also?: Route[] }

const RAIL: RailEntry[] = [
  { id: 'home',         label: 'Home',    icon: 'home' },
  { id: 'dialin',       label: 'Dial-in', icon: 'timer' },
  { id: 'shot-history', label: 'History', icon: 'history', also: ['brew-history'] },
  { id: 'beans',        label: 'Beans',   icon: 'beans',   also: ['archived-beans'] },
  { id: 'recipes',      label: 'Recipes', icon: 'book' },
  { id: 'stats',        label: 'Stats',   icon: 'chart' },
]
const RAIL_MORE: NavEntry[] = [
  { id: 'gear',  label: 'Gear',  icon: 'machine' },
  { id: 'stock', label: 'Stock', icon: 'box' },
  { id: 'tips',  label: 'Tips',  icon: 'note' },
]
const RAIL_ICON = 22

interface RailProps {
  route:          Route
  setRoute:       (route: Route) => void
  onPull:         () => void
  onOpenSettings: () => void
}

export function Rail({ route, setRoute, onPull, onOpenSettings }: RailProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (r: Route) => { setMoreOpen(false); setRoute(r) }
  const inMore = RAIL_MORE.some(e => e.id === route)
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])
  return (
    <aside className="rail">
      <a href="#/home" className="rail-logo" title={`Home (Grounded v${__APP_VERSION__})`} onClick={homeClick(() => go('home'))}>g</a>
      <button className="rail-pull" aria-label="Pull a shot" title="Pull a shot" onClick={onPull}><Ico name="plus" size={24} /></button>
      {RAIL.map(e => (
        <a key={e.id} href={`#/${e.id}`} className={`rail-item${route === e.id || e.also?.includes(route) ? ' on' : ''}`}
          onClick={ev => { if (ev.metaKey || ev.ctrlKey) return; ev.preventDefault(); go(e.id) }}>
          <Ico name={e.icon} size={RAIL_ICON} />{e.label}
        </a>
      ))}
      <button className={`rail-item${inMore || moreOpen ? ' on' : ''}`} onClick={() => setMoreOpen(o => !o)}>
        <Ico name="more" size={RAIL_ICON} />More
      </button>
      {moreOpen && (
        <div className="rail-flyout-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="rail-flyout" onClick={e => e.stopPropagation()}>
            {RAIL_MORE.map(e => <NavLink key={e.id} entry={e} route={route} setRoute={go} />)}
          </div>
        </div>
      )}
      <button className="rail-item rail-foot" onClick={onOpenSettings}><Ico name="sliders" size={RAIL_ICON} />Settings</button>
    </aside>
  )
}

/** Phone only: brand and the Settings button above the page */
export function PhoneTop({ onHome, onOpenSettings }: { onHome: () => void; onOpenSettings: () => void }) {
  return (
    <div className="phone-top">
      <Brand onHome={onHome} />
      <a href="#/home" className="phone-logo" aria-label="Home" onClick={homeClick(onHome)}>g</a>
      <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}><Ico name="sliders" size={18} /></button>
    </div>
  )
}

const HISTORY_ROUTES = new Set<Route>(['shot-history', 'brew-history'])
const ON_TABS = new Set<Route>(['shot-history', 'beans'])
const MORE_ROUTES: NavEntry[] = [...LIBRARY.filter(e => !ON_TABS.has(e.id)), ...BAGS]

/** Phone only: Home, History, Pull, Beans and More along the bottom */
export function TabBar({ route, setRoute, onOpenSettings }: { route: Route; setRoute: (route: Route) => void; onOpenSettings: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (r: Route) => { setMoreOpen(false); setRoute(r) }
  const inMore = !HISTORY_ROUTES.has(route) && MORE_ROUTES.some(e => e.id === route)
  const tab = (r: Route, label: string, icon: IconName, on: boolean) => (
    <a href={`#/${r}`} className={`tab${on ? ' on' : ''}`} onClick={e => { e.preventDefault(); go(r) }}>
      <Ico name={icon} size={22} />{label}
    </a>
  )
  return (
    <>
      <nav className="tabbar">
        {tab('home', 'Home', 'home', route === 'home')}
        {tab('shot-history', 'History', 'history', HISTORY_ROUTES.has(route))}
        <a href="#/dialin" className="tab" onClick={e => { e.preventDefault(); go('dialin') }}>
          <span className="fab"><Ico name="plus" size={22} /></span>Pull
        </a>
        {tab('beans', 'Beans', 'beans', route === 'beans')}
        <button className={`tab${inMore || moreOpen ? ' on' : ''}`} onClick={() => setMoreOpen(o => !o)}>
          <Ico name="more" size={22} />More
        </button>
      </nav>
      {moreOpen && (
        <div className="more-sheet" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            {MORE_ROUTES.map(e => <NavLink key={e.id} entry={e} route={route} setRoute={go} />)}
            <button className="nav-item" onClick={() => { setMoreOpen(false); onOpenSettings() }}>
              <Ico name="sliders" size={17} className="ico" /> Settings
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** "Change bag" with the bag picker laid invisibly over it, so one click opens the list (Dial-in, both designs) */
export function BagPicker({ beans, bean, onPick, className = '' }: { beans: Bean[]; bean: Bean | undefined; onPick: (id: string) => void; className?: string }) {
  return (
    <label className={`bag-picker ${className}`}>
      Change bag
      <select value={bean?.id ?? ''} aria-label="Bag" onChange={e => onPick(e.target.value)}>
        {beans.map(b => <option key={b.id} value={b.id}>{beanLabel(b, beans)}</option>)}
      </select>
    </label>
  )
}

/** Page title row: the serif title, a short line next to it, and tools on the right */
export function PageHead({ title, sub, onBack, children }: { title: string; sub?: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <div className="page-head">
      {onBack && <button className="back-btn" aria-label="Back" onClick={onBack}><Ico name="back" size={22} /></button>}
      {/* Extraction drops the full stop after the title */}
      <h1 className="page-title">{title.endsWith('.') ? <>{title.slice(0, -1)}<span className="title-dot">.</span></> : title}</h1>
      {sub && <span className="page-sub">{sub}</span>}
      {children && <div className="page-tools">{children}</div>}
    </div>
  )
}
