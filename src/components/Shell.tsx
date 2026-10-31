import { useState, type ReactNode } from 'react'
import Ico, { type IconName } from './Ico.tsx'
import type { Route } from '../types.ts'

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

export function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <div><span className="brand-bracket">[</span> grounded <span className="brand-bracket">]</span></div>
    </div>
  )
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
      <Brand />
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

/** Phone only: brand and the Settings button above the page */
export function PhoneTop({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="phone-top">
      <Brand />
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

/** Page title row: the serif title, a short line next to it, and tools on the right */
export function PageHead({ title, sub, onBack, children }: { title: string; sub?: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <div className="page-head">
      {onBack && <button className="back-btn" aria-label="Back" onClick={onBack}><Ico name="back" size={22} /></button>}
      <h1 className="page-title">{title}</h1>
      {sub && <span className="page-sub">{sub}</span>}
      {children && <div className="page-tools">{children}</div>}
    </div>
  )
}
