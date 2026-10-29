import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.ts'
import type {
  Shot, ShotInput, Brew, BrewInput, Bean, BeanInput, Gear, GearInput,
  Recipe, RecipeInput, Tip, TipInput, Settings, StockLevel,
} from '../types.ts'

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

  // ── Shot mutations ──────────────────────────────────────────────
  const adjustBeanRemaining = async (beanName: string, delta: number) => {
    const bean = beans.find(b => b.name === beanName)
    if (!bean || !delta) return
    const newRemaining = Math.min(bean.weight || Infinity, Math.max(0, (bean.remaining || 0) + delta))
    const pct = bean.weight > 0 ? newRemaining / bean.weight : 1
    const stock: StockLevel = pct > 0.25 ? 'good' : pct > 0.1 ? 'low' : 'critical'
    const updated = await api.updateBean(bean.id, { ...bean, remaining: newRemaining, stock })
    setBeans(prev => prev.map(b => b.id === bean.id ? updated : b))
  }

  const saveShot = async (shot: ShotInput) => {
    const saved = await api.createShot(shot)
    setShots(prev => [saved, ...prev])
    await adjustBeanRemaining(shot.bean, -shot.dose)
    return saved
  }

  const updateShot = async (id: string, data: ShotInput) => {
    const updated = await api.updateShot(id, data)
    setShots(prev => prev.map(s => s.id === id ? updated : s))
    return updated
  }

  const deleteShot = async (id: string) => {
    const shot = shots.find(s => s.id === id)
    await api.deleteShot(id)
    setShots(prev => prev.filter(s => s.id !== id))
    if (shot?.bean && shot?.dose) await adjustBeanRemaining(shot.bean, shot.dose)
  }

  const favoriteShot = async (id: string, val: boolean) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, favorited: val } : s))
    const updated = await api.favoriteShot(id, val)
    setShots(prev => prev.map(s => s.id === id ? updated : s))
    return updated
  }

  // ── Brew mutations ──────────────────────────────────────────────
  const saveBrew = async (brew: BrewInput) => {
    const saved = await api.createBrew(brew)
    setBrews(prev => [saved, ...prev])
    await adjustBeanRemaining(brew.bean, -brew.dose)
    return saved
  }

  const updateBrew = async (id: string, data: BrewInput) => {
    const updated = await api.updateBrew(id, data)
    setBrews(prev => prev.map(b => b.id === id ? updated : b))
    return updated
  }

  const deleteBrew = async (id: string) => {
    const brew = brews.find(b => b.id === id)
    await api.deleteBrew(id)
    setBrews(prev => prev.filter(b => b.id !== id))
    if (brew?.bean && brew?.dose) await adjustBeanRemaining(brew.bean, brew.dose)
  }

  const favoriteBrew = async (id: string, val: boolean) => {
    setBrews(prev => prev.map(b => b.id === id ? { ...b, favorited: val } : b))
    const updated = await api.favoriteBrew(id, val)
    setBrews(prev => prev.map(b => b.id === id ? updated : b))
    return updated
  }

  // ── Bean mutations ──────────────────────────────────────────────
  const saveBean = async (bean: BeanInput) => {
    const saved = await api.createBean(bean)
    setBeans(prev => [saved, ...prev])
    return saved
  }

  const updateBean = async (id: string, data: BeanInput) => {
    const updated = await api.updateBean(id, data)
    setBeans(prev => prev.map(b => b.id === id ? updated : b))
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
      console.error('Saving settings failed', e)
      try { setSettings(await api.getSettings()) } catch {}
    }
  }

  return {
    // Data
    shots, brews, beans, archivedBeans, gear, recipes, tips, settings,
    loading, error,
    reload: load,

    // Mutations
    saveShot, updateShot, deleteShot, favoriteShot,
    saveBrew, updateBrew, deleteBrew, favoriteBrew,
    saveBean, updateBean, deleteBean, archiveBean, unarchiveBean,
    saveGear, updateGear, deleteGear,
    saveRecipe, updateRecipe, deleteRecipe,
    saveTip, updateTip, deleteTip,
    updateSettings,
  }
}

export type DataApi = ReturnType<typeof useData>
