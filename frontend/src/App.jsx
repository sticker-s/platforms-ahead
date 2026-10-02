import { useState, useEffect } from 'react'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'

// Simple in-memory auth state (persisted to sessionStorage)
function getStoredUser() {
  try {
    const raw = sessionStorage.getItem('pa_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(getStoredUser)
  const [page, setPage] = useState('home') // 'home' | 'game'

  function handleLogin(userData) {
    setUser(userData)
    sessionStorage.setItem('pa_user', JSON.stringify(userData))
    setPage('home')
  }

  function handleLogout() {
    setUser(null)
    sessionStorage.removeItem('pa_user')
    setPage('home')
  }

  function goToGame() { setPage('game') }
  function goToHome() { setPage('home') }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />
  }

  if (page === 'game') {
    return <GamePage user={user} onBack={goToHome} />
  }

  return <HomePage user={user} onLogout={handleLogout} onPlay={goToGame} />
}
