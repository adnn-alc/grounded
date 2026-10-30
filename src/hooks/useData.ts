import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.ts'
import { showError, markShown } from '../components/Toast.tsx'
import type {
  Shot, ShotInput, Brew, BrewInput, Bean, BeanInput, Gear, GearInput,
  Recipe, RecipeInput, Tip, TipInput, Settings, Backup, ImportMode, ImportResult,
} from '../types.ts'

/** Shows a toast when a mutation fails, then rethrows so the caller stops (e.g. keeps its form open) */
function reportErrors<A extends unknown[], R>(label: string, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    try {
      return await fn(...args)
    } catch (e) {
      showError(`${label}: ${(e as Error).message}`)
      throw markShown(e)
    }
  }
}

// Older versions kept these preferences in this browser's localStorage.
// Returns the ones the database doesn't have yet, so they can be moved over once.
function legacySettings(current: Settings): Settings {
  const out: Settings = {}
  try {
    const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') } catch { return null } }
    const theme = localStorage.getItem('grounded-theme')
    if (!current.theme && theme) out.theme = theme
    const water = read('grounded-water-recipes')
    if (!current.waterRecipes && Array.isArray(water) && water.length) out.waterRecipes = water
    const defs = read('grounded-dialin-defaults')
    if (!current.dialinDefaults && defs && typeof defs === 'object') out.dialinDefaults = defs
  } catch {}
  return out
}

function clearLegacySettings() {
  try {
    for (const k of ['grounded-water-recipes', 'grounded-dialin-defaults']) localStorage.removeItem(k)
  } catch {}
}

/**
 * Central data hook. Loads shots, beans, gear, recipes, tips and settings
 * from the SQLite API on mount and exposes mutation helpers that keep
 * local state in sync without a full refetch.
 */
export function useData() {
  const [shots,         setShots]         = useState<Shot[]>([])
  const [brews,         setBrews]         = useState<Brew[]>([])
  const [beans,         setBeans]         = useState<Bean[]>([])
  const [archivedBeans, setArchivedBeans] = useState<Bean[]>([])
  const [gear,          setGear]          = useState<Gear[]>([])
  const [recipes,       setRecipes]       = useState<Recipe[]>([])
  const [tips,          setTips]          = useState<Tip[]>([])
  const [settings,      setSettings]      = useState<Settings>({})
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, bw, b, ab, g, r, ti, st] = await Promise.all([
        api.getShots(),
        api.getBrews(),
        api.getBeans(),
        api.getArchivedBeans(),
        api.getGear(),
        api.getRecipes(),
        api.getTips(),
        api.getSettings(),
      ])
      let loadedSettings = st
      const legacy = legacySettings(st)
      if (Object.keys(legacy).length) {
        loadedSettings = await api.updateSettings(legacy)
        clearLegacySettings()
      }
      setShots(s)
      setBrews(bw)
      setBeans(b)
      setArchivedBeans(ab)
      setGear(g)
      setRecipes(r)
      setTips(ti)
      setSettings(loadedSettings)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // The server adjusts a bean's remaining stock when a shot or brew is saved,
  // edited or deleted, so reload the beans afterwards to show the new amounts
  const refreshBeans = async () => {
    const [b, ab] = await Promise.all([api.getBeans(), api.getArchivedBeans()])
    setBeans(b)
    setArchivedBeans(ab)
  }

  // ── Shot mutations ──────────────────────────────────────────────
  const saveShot = async (shot: ShotInput) => {
    const saved = await api.createShot(shot)
    setShots(prev => [saved, ...prev])
    await refreshBeans()
    return saved
  }

  const updateShot = async (id: string, data: ShotInput) => {
    const updated = await api.updateShot(id, data)
    setShots(prev => prev.map(s => s.id === id ? updated : s))
    await refreshBeans()
    return updated
  }

  const deleteShot = async (id: string) => {
    await api.deleteShot(id)
    setShots(prev => prev.filter(s => s.id !== id))
    await refreshBeans()
  }

  const favoriteShot = async (id: string, val: boolean) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, favorited: val } : s))
    try {
      const updated = await api.favoriteShot(id, val)
      setShots(prev => prev.map(s => s.id === id ? updated : s))
      return updated
    } catch (e) {
      setShots(prev => prev.map(s => s.id === id ? { ...s, favorited: !val } : s))
      throw e
    }
  }

  // ── Brew mutations ──────────────────────────────────────────────
  const saveBrew = async (brew: BrewInput) => {
    const saved = await api.createBrew(brew)
    setBrews(prev => [saved, ...prev])
    await refreshBeans()
    return saved
  }

  const updateBrew = async (id: string, data: BrewInput) => {
    const updated = await api.updateBrew(id, data)
    setBrews(prev => prev.map(b => b.id === id ? updated : b))
    await refreshBeans()
    return updated
  }

  const deleteBrew = async (id: string) => {
    await api.deleteBrew(id)
    setBrews(prev => prev.filter(b => b.id !== id))
    await refreshBeans()
  }

  const favoriteBrew = async (id: string, val: boolean) => {
    setBrews(prev => prev.map(b => b.id === id ? { ...b, favorited: val } : b))
    try {
      const updated = await api.favoriteBrew(id, val)
      setBrews(prev => prev.map(b => b.id === id ? updated : b))
      return updated
    } catch (e) {
      setBrews(prev => prev.map(b => b.id === id ? { ...b, favorited: !val } : b))
      throw e
    }
  }

  // ── Bean mutations ──────────────────────────────────────────────
  const saveBean = async (bean: BeanInput) => {
    const saved = await api.createBean(bean)
    setBeans(prev => [saved, ...prev])
    return saved
  }

  const updateBean = async (id: string, data: BeanInput) => {
    const before = beans.find(b => b.id === id)
    const updated = await api.updateBean(id, data)
    setBeans(prev => prev.map(b => b.id === id ? updated : b))
    // A rename also renames the bean on its shots and brews (done by the server)
    if (before && (before.name !== updated.name || before.roaster !== updated.roaster)) {
      const [s, bw] = await Promise.all([api.getShots(), api.getBrews()])
      setShots(s)
      setBrews(bw)
    }
    return updated
  }

  const archiveBean = async (id: string) => {
    const bean = beans.find(b => b.id === id)
    const updated = await api.updateBean(id, { ...bean!, archived: true })
    setBeans(prev => prev.filter(b => b.id !== id))
    setArchivedBeans(prev => [updated, ...prev])
    return updated
  }

  const unarchiveBean = async (id: string) => {
    const bean = archivedBeans.find(b => b.id === id)
    const updated = await api.updateBean(id, { ...bean!, archived: false, archived_at: null })
    setArchivedBeans(prev => prev.filter(b => b.id !== id))
    setBeans(prev => [updated, ...prev])
    return updated
  }

  const deleteBean = async (id: string) => {
    await api.deleteBean(id)
    setBeans(prev => prev.filter(b => b.id !== id))
    setArchivedBeans(prev => prev.filter(b => b.id !== id))
  }

  // ── Gear mutations ──────────────────────────────────────────────
  const saveGear = async (g: GearInput) => {
    const saved = await api.createGear(g)
    setGear(prev => [...prev, saved])
    return saved
  }

  const updateGear = async (id: string, g: GearInput) => {
    const updated = await api.updateGear(id, g)
    setGear(prev => prev.map(item => {
      if (item.id === id) return updated
      if (g.status === 'Primary' && item.kind === g.kind && item.status === 'Primary') return { ...item, status: 'Active' }
      return item
    }))
    return updated
  }

  const deleteGear = async (id: string) => {
    await api.deleteGear(id)
    setGear(prev => prev.filter(g => g.id !== id))
  }

  // ── Recipe mutations ────────────────────────────────────────────
  const saveRecipe = async (recipe: RecipeInput) => {
    const saved = await api.createRecipe(recipe)
    setRecipes(prev => [...prev, saved])
    return saved
  }

  const updateRecipe = async (id: string, recipe: RecipeInput) => {
    const updated = await api.updateRecipe(id, recipe)
    setRecipes(prev => prev.map(r => r.id === id ? updated : r))
    return updated
  }

  const deleteRecipe = async (id: string) => {
    await api.deleteRecipe(id)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  // ── Tips mutations ──────────────────────────────────────────────
  const saveTip = async (tip: TipInput) => {
    const saved = await api.createTip(tip)
    setTips(prev => [...prev, saved])
    return saved
  }

  const updateTip = async (id: string, data: TipInput) => {
    const updated = await api.updateTip(id, data)
    setTips(prev => prev.map(t => t.id === id ? updated : t))
    return updated
  }

  const deleteTip = async (id: string) => {
    await api.deleteTip(id)
    setTips(prev => prev.filter(t => t.id !== id))
  }

  // ── Settings ────────────────────────────────────────────────────
  // Optimistic: the UI updates immediately; on failure, reload what the server has
  const updateSettings = async (partial: Settings) => {
    setSettings(prev => ({ ...prev, ...partial }))
    try {
      await api.updateSettings(partial)
    } catch (e) {
      showError(`Couldn't save settings: ${(e as Error).message}`)
      try { setSettings(await api.getSettings()) } catch {}
    }
  }

  // Reloads everything quietly, without the full-page loading screen
  const refreshAll = async () => {
    const [s, bw, b, ab, g, r, ti, st] = await Promise.all([
      api.getShots(), api.getBrews(), api.getBeans(), api.getArchivedBeans(),
      api.getGear(), api.getRecipes(), api.getTips(), api.getSettings(),
    ])
    setShots(s)
    setBrews(bw)
    setBeans(b)
    setArchivedBeans(ab)
    setGear(g)
    setRecipes(r)
    setTips(ti)
    setSettings(st)
  }

  // ── Sample data ─────────────────────────────────────────────────
  // Removes the sample beans/shots/brews/gear on a new install
  const clearSampleData = async () => {
    await api.clearSampleData()
    await refreshAll()
  }

  // ── Backups ─────────────────────────────────────────────────────
  // The preview is a dry run: the server reports what would change without changing it
  const previewBackup = (backup: Backup, mode: ImportMode): Promise<ImportResult> =>
    api.importBackup({ backup, mode, dryRun: true })

  const restoreBackup = async (backup: Backup, mode: ImportMode): Promise<ImportResult> => {
    const result = await api.importBackup({ backup, mode })
    await refreshAll()
    return result
  }

  return {
    // Data
    shots, brews, beans, archivedBeans, gear, recipes, tips, settings,
    loading, error,
    reload: load,

    // Mutations (a failure shows an error toast, then rejects)
    saveShot:      reportErrors("Couldn't save the shot", saveShot),
    updateShot:    reportErrors("Couldn't save the shot", updateShot),
    deleteShot:    reportErrors("Couldn't delete the shot", deleteShot),
    favoriteShot:  reportErrors("Couldn't update the favourite", favoriteShot),
    saveBrew:      reportErrors("Couldn't save the brew", saveBrew),
    updateBrew:    reportErrors("Couldn't save the brew", updateBrew),
    deleteBrew:    reportErrors("Couldn't delete the brew", deleteBrew),
    favoriteBrew:  reportErrors("Couldn't update the favourite", favoriteBrew),
    saveBean:      reportErrors("Couldn't save the bean", saveBean),
    updateBean:    reportErrors("Couldn't save the bean", updateBean),
    deleteBean:    reportErrors("Couldn't delete the bean", deleteBean),
    archiveBean:   reportErrors("Couldn't archive the bean", archiveBean),
    unarchiveBean: reportErrors("Couldn't restore the bean", unarchiveBean),
    saveGear:      reportErrors("Couldn't save the gear", saveGear),
    updateGear:    reportErrors("Couldn't save the gear", updateGear),
    deleteGear:    reportErrors("Couldn't delete the gear", deleteGear),
    saveRecipe:    reportErrors("Couldn't save the recipe", saveRecipe),
    updateRecipe:  reportErrors("Couldn't save the recipe", updateRecipe),
    deleteRecipe:  reportErrors("Couldn't delete the recipe", deleteRecipe),
    saveTip:       reportErrors("Couldn't save the note", saveTip),
    updateTip:     reportErrors("Couldn't save the note", updateTip),
    deleteTip:     reportErrors("Couldn't delete the note", deleteTip),
    updateSettings,
    clearSampleData: reportErrors("Couldn't remove the sample data", clearSampleData),
    previewBackup:   reportErrors("Couldn't read the backup", previewBackup),
    restoreBackup:   reportErrors("Couldn't restore the backup", restoreBackup),
  }
}

export type DataApi = ReturnType<typeof useData>
