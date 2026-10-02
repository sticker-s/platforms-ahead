import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import styles from './AuthPage.module.css'

// Starfield canvas background
function StarCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.025,
    }))

    let frame = 0
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++
      for (const s of stars) {
        s.phase += s.speed
        const alpha = 0.1 + 0.7 * (0.5 + 0.5 * Math.sin(s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvasRef} className={styles.starCanvas} />
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m) {
    setMode(m)
    setError('')
    setSuccess('')
    setUsername('')
    setPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await api.signup(username.trim(), password)
        setSuccess('Account created! Logging you in…')
        // Auto-login after signup
        const data = await api.login(username.trim(), password)
        onLogin(data.user)
      } else {
        const data = await api.login(username.trim(), password)
        onLogin(data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <StarCanvas />

      <div className={styles.container}>
        {/* Glowing orbs */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />

        {/* Logo */}
        <div className={styles.logo}>
          <h1 className={`${styles.logoTitle} font-orbitron gradient-text`}>PLATFORMS</h1>
          <div className={styles.logoSub}>A &nbsp; H &nbsp; E &nbsp; A &nbsp; D</div>
        </div>

        {/* Card */}
        <div className={`${styles.card} glass-panel fade-in-up`}>
          {/* Tab switcher */}
          <div className={styles.tabs}>
            <button
              id="tab-login"
              className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
              onClick={() => switchMode('login')}
            >
              Log In
            </button>
            <button
              id="tab-signup"
              className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
            <div className={`${styles.tabIndicator} ${mode === 'signup' ? styles.tabIndicatorRight : ''}`} />
          </div>

          <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                className="input-field"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="input-field"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && <div className={styles.errorMsg}>⚠ {error}</div>}
            {success && <div className={styles.successMsg}>✓ {success}</div>}

            <button
              id="auth-submit"
              type="submit"
              className="btn-primary"
              disabled={loading || !username || !password}
            >
              {loading
                ? <span className="spinner" />
                : mode === 'login' ? 'ENTER THE ARENA' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <p className={styles.switchHint}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className={styles.switchBtn}
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
