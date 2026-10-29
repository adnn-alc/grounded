import Ico, { type IconName } from './Ico.tsx'
import type { Bean, Brew, Gear, Recipe, Route, Shot } from '../types.ts'

interface SidebarProps {
  route:         Route
  setRoute:      (route: Route) => void
  shots:         Shot[]
  brews?:        Brew[]
  beans:         Bean[]
  archivedBeans: Bean[]
  recipes:       Recipe[]
  gear:          Gear[]
}

export function Sidebar({ route, setRoute, shots, brews = [], beans, archivedBeans, recipes, gear }: SidebarProps) {
  const counts: Partial<Record<Route, number>> = {
    'shot-history': shots.length,
    'brew-history': brews.length,
    beans: beans.length,
    'archived-beans': archivedBeans.length,
    recipes: recipes.length,
    gear: gear.length,
  }

  const NavItem = ({ id, label, icon, accent }: { id: Route; label: string; icon: IconName; accent?: boolean }) => (
    <a href={`#/${id}`} className={`nav-item${route === id ? ' active' : ''}`} onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); setRoute(id) }}>
      <Ico name={icon} className="ico" />
      <span>{label}</span>
      {accent && <span className="nav-accent-dot" />}
      {!accent && counts[id] != null && <span className="count">{counts[id]}</span>}
    </a>
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <svg className="brand-mark" width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="50" cy="50" r="49.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="30" cy="30" r="4.5" fill="currentColor" />
          <circle cx="70" cy="28" r="3.8" fill="currentColor" />
          <circle cx="22" cy="60" r="4.2" fill="currentColor" />
          <circle cx="55" cy="50" r="3.0" fill="currentColor" />
          <circle cx="78" cy="68" r="3.6" fill="currentColor" />
          <circle cx="45" cy="78" r="3.2" fill="currentColor" />
          <circle cx="62" cy="18" r="2.2" fill="currentColor" />
          <circle cx="38" cy="45" r="2.4" fill="currentColor" />
          <circle cx="48" cy="62" r="1.8" fill="currentColor" />
          <circle cx="68" cy="80" r="2.0" fill="currentColor" />
        </svg>
        <div>
          <div className="brand-name"><span className="brand-bracket">[</span> grounded <span className="brand-bracket">]</span></div>
          <div className="brand-tag">v{__APP_VERSION__} · self-hosted</div>
        </div>
      </div>

      <div className="nav-section-label">Workspace</div>
      <NavItem id="home"    label="Home"         icon="home" />
      <NavItem id="dialin"  label="Dial-in"      icon="timer" accent />

      <div className="nav-section-label">Library</div>
      <NavItem id="shot-history" label="Shot history" icon="history" />
      <NavItem id="brew-history" label="Brew history" icon="history" />
      <NavItem id="beans"        label="Beans"        icon="beans" />
      <NavItem id="recipes" label="Recipes"      icon="book" />
      <NavItem id="gear"    label="Gear"         icon="gear" />
      <NavItem id="stats"   label="Stats"        icon="chart" />

      <div className="nav-section-label">Supply</div>
      <NavItem id="stock"         label="Inventory"     icon="box" />
      <NavItem id="archived-beans" label="Bean archive" icon="mountain" />

      <div className="nav-section-label">Notes</div>
      <NavItem id="tips" label="Tips" icon="book" />

      <div className="sidebar-foot">
        <div className="status-dot" />
        <div>
          <div style={{ color: 'var(--text-2)' }}>Local database</div>
          <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>local · no sync</div>
        </div>
      </div>
    </aside>
  )
}

interface TopbarProps {
  route:           Route
  onNewShot:       () => void
  onOpenSettings?: () => void
}

export function Topbar({ route, onNewShot, onOpenSettings }: TopbarProps) {
  const crumbs: Record<Route, string[]> = {
    home:             ['Grounded'],
    dialin:           ['Workspace', 'Dial-in'],
    'shot-history':   ['Library', 'Shot history'],
    'brew-history':   ['Library', 'Brew history'],
    beans:            ['Library', 'Beans'],
    recipes:          ['Library', 'Recipes'],
    gear:             ['Library', 'Gear'],
    stats:            ['Workspace', 'Stats'],
    stock:            ['Supply', 'Inventory'],
    'archived-beans': ['Supply', 'Bean archive'],
    tips:             ['Notes', 'Tips'],
  }
  const c = crumbs[route] || ['Grounded']

  return (
    <header className="topbar">
      <div className="crumb">
        {c.map((x, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === c.length - 1 ? 'cur' : ''}>{x}</span>
          </span>
        ))}
      </div>

      {onOpenSettings && (
        <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onOpenSettings} title="Settings">
          <Ico name="gear" size={15} />
        </button>
      )}

      <button className="primary-btn" onClick={onNewShot}>
        <Ico name="plus" size={13} /> New shot
      </button>
    </header>
  )
}
