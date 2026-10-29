import { useState, useEffect } from 'react'
import { Sidebar, Topbar } from './components/Shell.jsx'
import Settings from './components/Settings.jsx'
import Home from './pages/Home.jsx'
import Dialin from './pages/Dialin.jsx'
import { ShotHistory, BrewHistory, Beans, ArchivedBeans, RecipesPage, GearPage, Stats, Stock, TipsPage } from './pages/pages.jsx'
import { useData } from './hooks/useData.js'
import { DEFAULT_WATER_RECIPES } from './data/waterRecipes.js'
import { DEFAULT_FONTS, applyAppearance } from './data/fonts.js'

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--crema)', letterSpacing: '-0.03em' }}><span style={{ opacity: 0.4 }}>[</span> grounded <span style={{ opacity: 0.4 }}>]</span></div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading…</div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bitter)' }}>Failed to connect to API</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>{message}</div>
      <button className="ghost-btn" onClick={onRetry}>Retry</button>
    </div>
  )
}

const VALID_ROUTES = new Set(['home', 'dialin', 'shot-history', 'brew-history', 'beans', 'archived-beans', 'recipes', 'gear', 'stats', 'stock', 'tips'])

function routeFromHash() {
  const hash = window.location.hash.slice(2) // strip '#/'
  return VALID_ROUTES.has(hash) ? hash : 'home'
}

const DEFAULT_UNITS = { mass: 'g', temp: 'C' }

export default function App() {
  const [route, setRoute] = useState(routeFromHash)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openShotId, setOpenShotId] = useState(null)
  const [openBrewId, setOpenBrewId] = useState(null)
  const [dialinPreset, setDialinPreset] = useState(null)

  const goTo = (route, id) => {
    setRoute(route)
    if (route === 'shot-history') setOpenShotId(id || null)
    if (route === 'brew-history') setOpenBrewId(id || null)
  }

  const {
    shots, brews, beans, archivedBeans, gear, recipes, tips, settings,
    loading, error, reload,
    saveShot, updateShot, deleteShot, favoriteShot,
    saveBrew, updateBrew, deleteBrew, favoriteBrew,
    saveBean, updateBean, deleteBean, archiveBean, unarchiveBean,
    saveGear, updateGear, deleteGear,
    saveRecipe, updateRecipe, deleteRecipe,
    saveTip, updateTip, deleteTip,
    updateSettings,
  } = useData()

  // Preferences live in the database (shared by every browser), with defaults
  const theme          = settings.theme || 'moody'
  const fonts          = { ...DEFAULT_FONTS, ...settings.fonts }
  const units          = { ...DEFAULT_UNITS, ...settings.units }
  const waterRecipes   = settings.waterRecipes?.length ? settings.waterRecipes : DEFAULT_WATER_RECIPES
  const dialinDefaults = settings.dialinDefaults || {}

  useEffect(() => {
    if (!loading) applyAppearance(theme, fonts)
  }, [loading, theme, fonts.sans, fonts.mono, fonts.serif]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.location.hash = '/' + route
  }, [route])

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} onRetry={reload} />

  const handleSaveShot = async (shot) => {
    await saveShot(shot)
    setRoute('shot-history')
  }

  const handleSaveBrew = async (brew) => {
    await saveBrew(brew)
    setRoute('brew-history')
  }

  const onReplicateShot = (shot) => {
    setDialinPreset({ type: 'espresso', ...shot })
    setRoute('dialin')
  }

  const onReplicateBrew = (brew) => {
    setDialinPreset({ type: 'filter', ...brew })
    setRoute('dialin')
  }

  const pages = {
    home:          <Home        shots={shots} brews={brews} beans={beans} units={units} goTo={goTo} />,
    dialin:        <Dialin      shots={shots} beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} dialinDefaults={dialinDefaults} onSaveShot={handleSaveShot} onSaveBrew={handleSaveBrew} onUpdateBean={updateBean} preset={dialinPreset} onPresetConsumed={() => setDialinPreset(null)} />,
    'shot-history': <ShotHistory shots={shots} beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} onDelete={deleteShot} onUpdateShot={updateShot} initialSelectedId={openShotId} onReplicate={onReplicateShot} onFavorite={favoriteShot} />,
    'brew-history': <BrewHistory brews={brews} beans={beans} units={units} waterRecipes={waterRecipes} onDeleteBrew={deleteBrew} onUpdateBrew={updateBrew} initialSelectedId={openBrewId} onReplicate={onReplicateBrew} onFavorite={favoriteBrew} />,
    beans:   <Beans   beans={beans} gear={gear} units={units} onSaveBean={saveBean} onUpdateBean={updateBean} onArchiveBean={archiveBean} />,
    'archived-beans': <ArchivedBeans beans={archivedBeans} units={units} onUnarchive={unarchiveBean} onDelete={deleteBean} />,
    recipes: <RecipesPage recipes={recipes} units={units} onSaveRecipe={saveRecipe} onUpdateRecipe={updateRecipe} onDeleteRecipe={deleteRecipe} />,
    gear:    <GearPage gear={gear} onSaveGear={saveGear} onUpdateGear={updateGear} onDeleteGear={deleteGear} />,
    stats:   <Stats   shots={shots} brews={brews} beans={[...beans, ...archivedBeans]} gear={gear} units={units} />,
    stock:   <Stock   beans={beans} units={units} onUpdateBean={updateBean} />,
    tips:    <TipsPage tips={tips} onSaveTip={saveTip} onUpdateTip={updateTip} onDeleteTip={deleteTip} />,
  }

  return (
    <div className="app">
      <Sidebar
        route={route} setRoute={setRoute}
        shots={shots} brews={brews} beans={beans} archivedBeans={archivedBeans}
        recipes={recipes} gear={gear}
      />
      <div className="main">
        <Topbar
          route={route}
          onNewShot={() => setRoute('dialin')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="content scroll">
          {pages[route]}
        </main>
      </div>
      <Settings
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        theme={theme} setTheme={t => updateSettings({ theme: t })}
        fonts={fonts} setFonts={f => updateSettings({ fonts: f })}
        units={units} setUnits={u => updateSettings({ units: u })}
        waterRecipes={waterRecipes} setWaterRecipes={w => updateSettings({ waterRecipes: w })}
        dialinDefaults={dialinDefaults} setDialinDefaults={d => updateSettings({ dialinDefaults: d })}
      />
    </div>
  )
}
