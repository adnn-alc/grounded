import type {
  Shot, ShotInput, Brew, BrewInput, Bean, BeanInput, Gear, GearInput,
  Recipe, RecipeInput, Tip, TipInput, Settings, OkResponse, ClearSampleDataResponse,
} from '../types.ts'

const BASE = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error("can't reach the Grounded server")
  }
  if (!res.ok) {
    // The API answers errors as { error: "…" }
    const detail = await res.json().then((b: { error?: string }) => b.error).catch(() => undefined)
    throw new Error(detail || `the server answered ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Shots
  getShots:      ()                         => req<Shot[]>('GET',    '/shots'),
  createShot:    (shot: ShotInput)          => req<Shot>('POST',     '/shots', shot),
  updateShot:    (id: string, s: ShotInput) => req<Shot>('PUT',      `/shots/${id}`, s),
  deleteShot:    (id: string)               => req<OkResponse>('DELETE', `/shots/${id}`),
  favoriteShot:  (id: string, val: boolean) => req<Shot>('PATCH',    `/shots/${id}/favorite`, { favorited: val }),

  // Brews
  getBrews:      ()                         => req<Brew[]>('GET',    '/brews'),
  createBrew:    (brew: BrewInput)          => req<Brew>('POST',     '/brews', brew),
  updateBrew:    (id: string, b: BrewInput) => req<Brew>('PUT',      `/brews/${id}`, b),
  deleteBrew:    (id: string)               => req<OkResponse>('DELETE', `/brews/${id}`),
  favoriteBrew:  (id: string, val: boolean) => req<Brew>('PATCH',    `/brews/${id}/favorite`, { favorited: val }),

  // Beans
  getBeans:         ()                         => req<Bean[]>('GET',    '/beans'),
  getArchivedBeans: ()                         => req<Bean[]>('GET',    '/beans/archived'),
  createBean:       (bean: BeanInput)          => req<Bean>('POST',     '/beans', bean),
  updateBean:       (id: string, b: BeanInput) => req<Bean>('PUT',      `/beans/${id}`, b),
  deleteBean:       (id: string)               => req<OkResponse>('DELETE', `/beans/${id}`),

  // Gear
  getGear:       ()                         => req<Gear[]>('GET',    '/gear'),
  createGear:    (g: GearInput)             => req<Gear>('POST',     '/gear', g),
  updateGear:    (id: string, g: GearInput) => req<Gear>('PUT',      `/gear/${id}`, g),
  deleteGear:    (id: string)               => req<OkResponse>('DELETE', `/gear/${id}`),

  // Recipes
  getRecipes:    ()                           => req<Recipe[]>('GET',    '/recipes'),
  createRecipe:  (r: RecipeInput)             => req<Recipe>('POST',     '/recipes', r),
  updateRecipe:  (id: string, r: RecipeInput) => req<Recipe>('PUT',      `/recipes/${id}`, r),
  deleteRecipe:  (id: string)                 => req<OkResponse>('DELETE', `/recipes/${id}`),

  // Tips
  getTips:    ()                        => req<Tip[]>('GET',    '/tips'),
  createTip:  (t: TipInput)             => req<Tip>('POST',     '/tips', t),
  updateTip:  (id: string, t: TipInput) => req<Tip>('PUT',      `/tips/${id}`, t),
  deleteTip:  (id: string)              => req<OkResponse>('DELETE', `/tips/${id}`),

  // Settings (partial update — only the keys sent are changed)
  getSettings:    ()                  => req<Settings>('GET', '/settings'),
  updateSettings: (partial: Settings) => req<Settings>('PUT', '/settings', partial),

  // Sample data a new install starts with
  clearSampleData: () => req<ClearSampleDataResponse>('POST', '/sample-data/clear'),
}
