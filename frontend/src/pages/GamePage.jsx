import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import styles from './GamePage.module.css'

export default function GamePage({ user, onBack }) {
  const containerRef = useRef(null)
  const gameStartedRef = useRef(false)
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [lastScore, setLastScore] = useState(null)

  // Expose a callback that the game script can call on game-over
  useEffect(() => {
    // The game calls window.__onGameOver(height, platforms) on death
    window.__onGameOver = async (height, platforms) => {
      if (height <= 0) return
      setLastScore({ height, platforms })
      try {
        await api.submitScore(user.id, height, platforms)
        setScoreSubmitted(true)
      } catch (err) {
        setSubmitError('Score could not be saved: ' + err.message)
      }
    }

    return () => {
      delete window.__onGameOver
    }
  }, [user.id])

  useEffect(() => {
    if (gameStartedRef.current) return
    gameStartedRef.current = true

    // Dynamically load the game script
    const script = document.createElement('script')
    script.src = '/game.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup: remove script and stop animation
      document.body.removeChild(script)
      // Signal game to stop (game checks this flag)
      window.__gameStopped = true
      // Clean up globals set by game
      delete window.__gameStopped
    }
  }, [])

  return (
    <div className={styles.page}>
      {/* Back button */}
      <button id="back-to-home" className={styles.backBtn} onClick={onBack}>
        ← HOME
      </button>

      {/* Score toast */}
      {scoreSubmitted && lastScore && (
        <div className={styles.scoreToast} id="score-toast">
          ✓ Score saved! &nbsp;<strong>{lastScore.height}m</strong>
        </div>
      )}
      {submitError && (
        <div className={styles.scoreError} id="score-error">
          ⚠ {submitError}
        </div>
      )}

      {/* Game wrapper — the game.js script will look for #game-wrapper and #gameCanvas */}
      <div id="game-wrapper" className={styles.gameWrapper} ref={containerRef}>
        <canvas id="gameCanvas"></canvas>

        {/* HUD */}
        <div id="hud" className={styles.hud}>
          <div className={styles.hudPanel}>
            <div className={styles.hudLabel}>Platforms</div>
            <div className={styles.hudValue} id="hud-platforms">0</div>
          </div>
          <div className={styles.hudPanel}>
            <div className={styles.hudLabel}>Height</div>
            <div className={styles.hudValue} id="hud-height">0m</div>
          </div>
          <div className={styles.hudPanel}>
            <div className={styles.hudLabel}>Best</div>
            <div className={styles.hudValue} id="hud-best">0</div>
          </div>
        </div>

        {/* Legend */}
        <div id="legend" className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: '#5dce9e' }} />Normal
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: 'rgba(140,220,255,0.7)' }} />Glass — breaks
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: '#f0933a' }} />Moving
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: '#d63031' }} />Danger ☠
          </div>
        </div>

        {/* Controls hint */}
        <div id="controls-hint" className={styles.controlsHint}>
          <kbd className={styles.kbd}>A</kbd> / <kbd className={styles.kbd}>D</kbd> move<br />
          <kbd className={styles.kbd}>W</kbd> / <kbd className={styles.kbd}>Space</kbd> jump<br />
          <kbd className={styles.kbd}>W</kbd> × 2 double jump<br />
          <kbd className={styles.kbd}>E</kbd> attack
        </div>

        {/* Start overlay */}
        <div id="overlay" className={styles.overlay}>
          <h1 className={`${styles.overlayTitle} font-orbitron`}>PLATFORMS</h1>
          <div className={styles.overlaySub}>A H E A D</div>
          <div className={styles.overlayInstructions}>
            <span className={styles.iKey}>A / D &nbsp;←→</span> — Move &nbsp;|&nbsp; <span className={styles.iKey}>W / Space / ↑</span> — Jump<br />
            <span className={styles.iAtk}>E</span> — Attack creatures &nbsp;|&nbsp; <span className={styles.iKey}>W × 2</span> — Double jump<br />
            Land on platforms to climb higher &amp; higher.<br />
            <span className={styles.iGlass}>Glass</span> platforms shatter after landing.<br />
            Avoid <span className={styles.iDmg}>red creatures</span> — or swing to kill them!
          </div>
          <div className={styles.playerInfo}>
            Playing as: <strong>{user.username}</strong>
          </div>
          <button id="start-btn" className={`btn-primary ${styles.startBtn}`}>START CLIMBING</button>
        </div>
      </div>
    </div>
  )
}
