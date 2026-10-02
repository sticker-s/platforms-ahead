const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  signup: (username, password) =>
    apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),

  login: (username, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getLeaderboard: (limit = 20) =>
    apiFetch(`/scores/leaderboard?limit=${limit}`),

  submitScore: (userId, height, platforms) =>
    apiFetch('/scores', { method: 'POST', body: JSON.stringify({ userId, height, platforms }) }),

  getUserScores: (userId) =>
    apiFetch(`/scores/user/${userId}`),
}
