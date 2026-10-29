const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  // Shots
  getShots:      ()            => req('GET',    '/shots'),
  createShot:    (shot)        => req('POST',   '/shots', shot),
  updateShot:    (id, s)       => req('PUT',    `/shots/${id}`, s),
  deleteShot:    (id)          => req('DELETE', `/shots/${id}`),
  favoriteShot:  (id, val)     => req('PATCH',  `/shots/${id}/favorite`, { favorited: val }),

  // Brews
  getBrews:      ()            => req('GET',    '/brews'),
  createBrew:    (brew)        => req('POST',   '/brews', brew),
  updateBrew:    (id, b)       => req('PUT',    `/brews/${id}`, b),
  deleteBrew:    (id)          => req('DELETE', `/brews/${id}`),
  favoriteBrew:  (id, val)     => req('PATCH',  `/brews/${id}/favorite`, { favorited: val }),

  // Beans
  getBeans:         ()       => req('GET',    '/beans'),
  getArchivedBeans: ()       => req('GET',    '/beans/archived'),
  createBean:       (bean)   => req('POST',   '/beans', bean),
  updateBean:       (id, b)  => req('PUT',    `/beans/${id}`, b),
  deleteBean:       (id)     => req('DELETE', `/beans/${id}`),

  // Gear
  getGear:       ()       => req('GET',    '/gear'),
  createGear:    (g)      => req('POST',   '/gear', g),
  updateGear:    (id, g)  => req('PUT',    `/gear/${id}`, g),
  deleteGear:    (id)     => req('DELETE', `/gear/${id}`),

  // Recipes
  getRecipes:    ()       => req('GET',    '/recipes'),
  createRecipe:  (r)      => req('POST',   '/recipes', r),
  updateRecipe:  (id, r)  => req('PUT',    `/recipes/${id}`, r),
  deleteRecipe:  (id)     => req('DELETE', `/recipes/${id}`),

  // Tips
  getTips:    ()        => req('GET',    '/tips'),
  createTip:  (t)       => req('POST',   '/tips', t),
  updateTip:  (id, t)   => req('PUT',    `/tips/${id}`, t),
  deleteTip:  (id)      => req('DELETE', `/tips/${id}`),

  // Settings (partial update — only the keys sent are changed)
  getSettings:    ()        => req('GET', '/settings'),
  updateSettings: (partial) => req('PUT', '/settings', partial),
}
