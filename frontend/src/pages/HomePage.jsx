import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { audioManager } from '../audioManager'
import styles from './HomePage.module.css'

const MEDAL = ['🥇', '🥈', '🥉']

function LeaderboardRow({ rank, entry, isCurrentUser }) {
  return (
    <div className={`${styles.row} ${isCurrentUser ? styles.rowHighlight : ''} fade-in-up`}
         style={{ animationDelay: `${rank * 0.04}s` }}>
      <div className={styles.rank}>
        {rank <= 3 ? <span className={styles.medal}>{MEDAL[rank - 1]}</span> : <span className={styles.rankNum}>#{rank}</span>}
      </div>
      <div className={styles.username}>
        {entry.username}
        {isCurrentUser && <span className={styles.youBadge}>YOU</span>}
      </div>
      <div className={styles.score}>
        <span className={styles.scoreVal}>{entry.bestHeight}<span className={styles.scoreUnit}>m</span></span>
      </div>
      <div className={styles.games}>{entry.gamesPlayed} <span className={styles.gamesLabel}>games</span></div>
    </div>
  )
}

export default function HomePage({ user, onLogout, onPlay }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userBest, setUserBest] = useState(null)
  const [isMuted, setIsMuted] = useState(audioManager.isMuted())

  useEffect(() => {
    return audioManager.subscribe(muted => setIsMuted(muted))
  }, [])

  const handleToggleMute = () => {
    audioManager.toggleMute()
  }

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { leaderboard: lb } = await api.getLeaderboard(20)
      setLeaderboard(lb)

      // Find user's personal best in the leaderboard
      const myEntry = lb.find(e => e.userId === user.id)
      if (myEntry) {
        setUserBest(myEntry.bestHeight)
      } else {
        // Fetch from their personal scores if not in top 20
        try {
          const { scores } = await api.getUserScores(user.id)
          if (scores.length > 0) setUserBest(scores[0].height)
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError('Could not load leaderboard. Is the server running?')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  // Find user rank
  const userRank = leaderboard.findIndex(e => e.userId === user.id) + 1

  return (
    <div className={styles.page}>
      {/* Ambient glow orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={`${styles.logoText} font-orbitron gradient-text`}>PLATFORMS AHEAD</h1>
          <span className={styles.headerSub}>VERTICAL PLATFORMER</span>
        </div>
        <div className={styles.headerRight}>
          <button id="music-toggle-btn" className={styles.audioBtn} onClick={handleToggleMute}>
            {isMuted ? '🔇 MUSIC OFF' : '🔊 MUSIC ON'}
          </button>
          <div className={styles.userBadge}>
            <div className={styles.userAvatar}>{user.username[0].toUpperCase()}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.username}</div>
              {userBest !== null && (
                <div className={styles.userBest}>Best: {userBest}m</div>
              )}
              {userRank > 0 && (
                <div className={styles.userRank}>Rank #{userRank}</div>
              )}
            </div>
          </div>
          <button id="logout-btn" className={styles.logoutBtn} onClick={onLogout}>
            LOGOUT
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero / Play section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h2 className={`${styles.heroTitle} font-orbitron`}>READY TO CLIMB?</h2>
            <p className={styles.heroDesc}>
              Ascend the platforms, dodge creatures, and beat your best height.<br />
              Your score auto-saves to the <span className={styles.accentText}>global leaderboard</span>.
            </p>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <kbd className={styles.key}>A</kbd><kbd className={styles.key}>D</kbd>
                <span className={styles.controlLabel}>Move</span>
              </div>
              <div className={styles.controlGroup}>
                <kbd className={styles.key}>W</kbd><kbd className={styles.key}>Space</kbd>
                <span className={styles.controlLabel}>Jump</span>
              </div>
              <div className={styles.controlGroup}>
                <kbd className={styles.key}>W</kbd><kbd className={styles.keyX2}>×2</kbd>
                <span className={styles.controlLabel}>Double Jump</span>
              </div>
              <div className={styles.controlGroup}>
                <kbd className={`${styles.key} ${styles.keyAtk}`}>E</kbd>
                <span className={styles.controlLabel}>Attack</span>
              </div>
            </div>

            <button id="play-btn" className={`btn-primary ${styles.playBtn}`} onClick={onPlay}>
              ▶ &nbsp; START CLIMBING
            </button>
          </div>

          {/* Decorative platform previews */}
          <div className={styles.heroDecor}>
            <div className={styles.floatPlatform} style={{ '--delay': '0s', '--color': '#5dce9e', '--shadow': '#5dce9e' }} />
            <div className={styles.floatPlatform} style={{ '--delay': '0.4s', '--color': 'rgba(140,220,255,0.7)', '--shadow': '#8cdcff' }} />
            <div className={styles.floatPlatform} style={{ '--delay': '0.8s', '--color': '#f0933a', '--shadow': '#f0933a' }} />
            <div className={styles.floatPlatform} style={{ '--delay': '1.2s', '--color': '#d63031', '--shadow': '#ff4040' }} />
          </div>
        </section>

        {/* Leaderboard */}
        <section className={`${styles.leaderboardSection} glass-panel`}>
          <div className={styles.lbHeader}>
            <h2 className={`${styles.lbTitle} font-orbitron`}>
              🏆 Global Leaderboard
            </h2>
            <button
              id="refresh-lb-btn"
              className={styles.refreshBtn}
              onClick={fetchLeaderboard}
              disabled={loading}
              title="Refresh"
            >
              {loading ? <span className="spinner" /> : '↻'}
            </button>
          </div>

          {error && (
            <div className={styles.lbError}>{error}</div>
          )}

          {!error && leaderboard.length === 0 && !loading && (
            <div className={styles.lbEmpty}>
              <div className={styles.lbEmptyIcon}>🚀</div>
              <p>No scores yet — be the first to play!</p>
            </div>
          )}

          {leaderboard.length > 0 && (
            <>
              {/* Column headers */}
              <div className={styles.rowHeader}>
                <div className={styles.rank}>Rank</div>
                <div className={styles.username}>Player</div>
                <div className={styles.score}>Best Height</div>
                <div className={styles.games}>Games</div>
              </div>

              <div className={styles.rowList}>
                {leaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.userId}
                    rank={i + 1}
                    entry={entry}
                    isCurrentUser={entry.userId === user.id}
                  />
                ))}
              </div>
            </>
          )}

          {loading && leaderboard.length === 0 && (
            <div className={styles.lbLoading}>
              <span className="spinner" />
              <span>Loading scores…</span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
