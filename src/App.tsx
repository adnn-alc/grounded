import { useState, useEffect, useRef, type ReactElement } from 'react'
import { Sidebar, PhoneTop, TabBar, Brand, ROUTE_LABELS } from './components/Shell.tsx'
import Settings from './components/Settings.tsx'
import { Toaster } from './components/Toast.tsx'
import Home from './pages/Home.tsx'
import Dialin from './pages/Dialin.tsx'
import { ShotHistory } from './pages/ShotHistory.tsx'
import { BrewHistory } from './pages/BrewHistory.tsx'
import { Beans } from './pages/Beans.tsx'
import { ArchivedBeans } from './pages/ArchivedBeans.tsx'
import { RecipesPage } from './pages/Recipes.tsx'
import { GearPage } from './pages/Gear.tsx'
import { Stats } from './pages/Stats.tsx'
import { Stock } from './pages/Stock.tsx'
import { TipsPage } from './pages/Tips.tsx'
import { useData } from './hooks/useData.ts'
import { DEFAULT_WATER_RECIPES } from './data/waterRecipes.ts'
import { DEFAULT_FONTS, applyAppearance } from './data/fonts.ts'
import type { Bean, Brew, BrewInput, DialinPreset, DialinStart, Fonts, Route, Shot, ShotInput, Units } from './types.ts'

function LoadingScreen() {
  return (
    <div className="splash">
      <Brand />
      <div className="micro">Loading…</div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="splash">
      <Brand />
      <div style={{ color: 'var(--bad)' }}>Couldn't reach the Grounded server.</div>
      <div className="micro mono">{message}</div>
      <button className="ghost-btn" onClick={onRetry}>Try again</button>
    </div>
  )
}

const VALID_ROUTES = new Set<string>(['home', 'dialin', 'shot-history', 'brew-history', 'beans', 'archived-beans', 'recipes', 'gear', 'stats', 'stock', 'tips'])

function routeFromHash(): Route {
  const hash = window.location.hash.slice(2) // strip '#/'
  return VALID_ROUTES.has(hash) ? hash as Route : 'home'
}

const DEFAULT_UNITS: Units = { mass: 'g', temp: 'C' }

export default function App() {
  const [route, setRoute] = useState(routeFromHash)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openShotId, setOpenShotId] = useState<string | null>(null)
  const [openBrewId, setOpenBrewId] = useState<string | null>(null)
  const [dialinPreset, setDialinPreset] = useState<DialinPreset | null>(null)
  const [dialinStart, setDialinStart] = useState<DialinStart | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const [footer, setFooter] = useState<HTMLDivElement | null>(null)
  // The page before this one, for Dial-in's back button
  const shownRoute = useRef<Route>(route)
  const prevRoute = useRef<Route>('home')

  const goTo = (route: Route, id?: string) => {
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
    updateSettings, clearSampleData, previewBackup, restoreBackup,
  } = useData()

  // Preferences live in the database (shared by every browser), with defaults
  const theme          = settings.theme || 'moody'
  const fonts: Fonts    = { ...DEFAULT_FONTS, ...settings.fonts }
  const units: Units    = { ...DEFAULT_UNITS, ...settings.units }
  const waterRecipes   = settings.waterRecipes?.length ? settings.waterRecipes : DEFAULT_WATER_RECIPES
  const dialinDefaults = settings.dialinDefaults || {}
  const brewModes      = settings.brewModes || []

  useEffect(() => {
    if (!loading) applyAppearance(theme, fonts)
  }, [loading, theme, fonts.sans, fonts.mono, fonts.serif]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.location.hash = '/' + route
    document.title = route === 'home' ? 'Grounded' : `${ROUTE_LABELS[route]} · Grounded`
    if (shownRoute.current !== route) {
      prevRoute.current = shownRoute.current
      shownRoute.current = route
    }
    // A new page starts at the top: the window scrolls on a phone, the content pane on a wider screen
    window.scrollTo(0, 0)
    contentRef.current?.scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} onRetry={reload} />

  const handleSaveShot = async (shot: ShotInput) => {
    await saveShot(shot)
    setRoute('shot-history')
  }

  const handleSaveBrew = async (brew: BrewInput) => {
    await saveBrew(brew)
    setRoute('brew-history')
  }

  const onReplicateShot = (shot: Shot) => {
    setDialinPreset({ type: 'espresso', ...shot })
    setRoute('dialin')
  }

  const onReplicateBrew = (brew: Brew) => {
    setDialinPreset({ type: 'filter', ...brew })
    setRoute('dialin')
  }

  const startDialin = (start: DialinStart) => {
    setDialinStart(start)
    setRoute('dialin')
  }
  const dialInBean = (bean: Bean) => startDialin({ mode: 'espresso', beanId: bean.id })

  const counts: Partial<Record<Route, number>> = {
    'shot-history': shots.length,
    'brew-history': brews.length,
    beans: beans.length,
    recipes: recipes.length,
    gear: gear.length,
    'archived-beans': archivedBeans.length,
  }
  const openSettings = () => setSettingsOpen(true)

  const pages: Record<Route, ReactElement> = {
    home:          <Home        shots={shots} brews={brews} beans={beans} units={units} goTo={goTo}
                     onRepull={onReplicateShot} onStartDialin={startDialin}
                     showSampleBanner={settings.sampleData === 'present'}
                     onRemoveSampleData={clearSampleData}
                     onKeepSampleData={() => updateSettings({ sampleData: 'dismissed' })} />,
    dialin:        <Dialin      shots={shots} beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} dialinDefaults={dialinDefaults} brewModes={brewModes} onSaveShot={handleSaveShot} onSaveBrew={handleSaveBrew} onUpdateBean={updateBean} preset={dialinPreset} onPresetConsumed={() => setDialinPreset(null)}
                     start={dialinStart} onStartConsumed={() => setDialinStart(null)} brews={brews} onBack={() => setRoute(prevRoute.current)} footer={footer} />,
    'shot-history': <ShotHistory shots={shots} brewCount={brews.length} goTo={goTo} beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} brewModes={brewModes} onDelete={deleteShot} onUpdateShot={updateShot} initialSelectedId={openShotId} onReplicate={onReplicateShot} onFavorite={favoriteShot} />,
    'brew-history': <BrewHistory brews={brews} shotCount={shots.length} goTo={goTo} beans={beans} units={units} waterRecipes={waterRecipes} onDeleteBrew={deleteBrew} onUpdateBrew={updateBrew} initialSelectedId={openBrewId} onReplicate={onReplicateBrew} onFavorite={favoriteBrew} />,
    beans:   <Beans   beans={beans} gear={gear} units={units} archivedCount={archivedBeans.length} goTo={goTo} onDialIn={dialInBean} onSaveBean={saveBean} onUpdateBean={updateBean} onArchiveBean={archiveBean} />,
    'archived-beans': <ArchivedBeans beans={archivedBeans} openCount={beans.length} units={units} goTo={goTo} onUnarchive={unarchiveBean} onDelete={deleteBean} />,
    recipes: <RecipesPage recipes={recipes} units={units} onSaveRecipe={saveRecipe} onUpdateRecipe={updateRecipe} onDeleteRecipe={deleteRecipe} />,
    gear:    <GearPage gear={gear} onSaveGear={saveGear} onUpdateGear={updateGear} onDeleteGear={deleteGear} />,
    stats:   <Stats   shots={shots} brews={brews} beans={[...beans, ...archivedBeans]} gear={gear} units={units} />,
    stock:   <Stock   beans={beans} shots={shots} units={units} onUpdateBean={updateBean} />,
    tips:    <TipsPage tips={tips} onSaveTip={saveTip} onUpdateTip={updateTip} onDeleteTip={deleteTip} />,
  }

  // On a phone, Dial-in has its own save bar instead of the tab bar
  return (
    <div className={`app${route === 'dialin' ? ' no-tabs' : ''}`}>
      <Sidebar route={route} setRoute={setRoute} counts={counts}
        onPull={() => startDialin({ mode: 'espresso' })} onOpenSettings={openSettings} />
      <div className="main">
        <PhoneTop onOpenSettings={openSettings} />
        <main className="content scroll" ref={contentRef}>
          {pages[route]}
        </main>
        <div className="page-foot" ref={setFooter} />
      </div>
      <TabBar route={route} setRoute={setRoute} onOpenSettings={openSettings} />
      <Settings
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        theme={theme} setTheme={t => updateSettings({ theme: t })}
        fonts={fonts} setFonts={f => updateSettings({ fonts: f })}
        units={units} setUnits={u => updateSettings({ units: u })}
        waterRecipes={waterRecipes} setWaterRecipes={w => updateSettings({ waterRecipes: w })}
        dialinDefaults={dialinDefaults} setDialinDefaults={d => updateSettings({ dialinDefaults: d })}
        brewModes={brewModes} setBrewModes={m => updateSettings({ brewModes: m })}
        onPreviewBackup={previewBackup} onRestoreBackup={restoreBackup}
      />
      <Toaster />
    </div>
  )
}
