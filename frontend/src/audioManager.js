// Audio Manager for Platforms Ahead
// Uses fm_fun.flac for Phase 1 (< 600m), the_big_fight.mp3 for Phase 2 (600-1499m),
// and Zander Noriega WAV for Phase 3 (>= 1500m)
import fmFunTrack from './audio/fm_fun.flac'
import bigFightTrack from './audio/the_big_fight.mp3'
import intensityTrack from './audio/Zander Noriega - Fight Them Until We Cant.wav'

class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('music_muted') === 'true'
    this.currentTrackNum = 0 // 0: none, 1: < 600m, 2: 600-1499m, 3: >= 1500m
    this.audio1 = null
    this.audio2 = null
    this.audio3 = null
    this.listeners = new Set()

    this.initAudio()
  }

  initAudio() {
    if (typeof window === 'undefined') return

    // Track 1 (< 600m): fm_fun.flac
    this.audio1 = new Audio(fmFunTrack || '/audio/fm_fun.flac')
    this.audio1.loop = true
    this.audio1.volume = 0.45

    // Track 2 (600-1499m): the_big_fight.mp3
    this.audio2 = new Audio(bigFightTrack || '/audio/the_big_fight.mp3')
    this.audio2.loop = true
    this.audio2.volume = 0.45

    // Track 3 (>= 1500m): Zander Noriega - intense track
    this.audio3 = new Audio(intensityTrack || '/audio/Zander Noriega - Fight Them Until We Cant.wav')
    this.audio3.loop = true
    this.audio3.volume = 0.5
  }

  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  notify() {
    this.listeners.forEach(cb => cb(this.muted))
  }

  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem('music_muted', this.muted)
    if (this.muted) {
      this.pauseAll()
    } else {
      if (this.currentTrackNum > 0) {
        this.playTrack(this.currentTrackNum)
      } else {
        this.playTrack(1)
      }
    }
    this.notify()
    return this.muted
  }

  isMuted() {
    return this.muted
  }

  updateHeight(heightMeters) {
    let targetTrack = 1
    if (heightMeters >= 1500) targetTrack = 3
    else if (heightMeters >= 600) targetTrack = 2
    if (this.currentTrackNum !== targetTrack) {
      this.playTrack(targetTrack)
    }
  }

  playTrack(trackNum) {
    this.currentTrackNum = trackNum
    if (this.muted) return

    const trackMap = { 1: this.audio1, 2: this.audio2, 3: this.audio3 }
    const active = trackMap[trackNum]
    Object.entries(trackMap).forEach(([num, audio]) => {
      if (Number(num) !== trackNum && audio) audio.pause()
    })

    if (active) {
      active.currentTime = 0
      active.play().catch(err => {
        console.log('Audio play error:', err)
      })
    }
  }

  pauseAll() {
    if (this.audio1) this.audio1.pause()
    if (this.audio2) this.audio2.pause()
    if (this.audio3) this.audio3.pause()
  }

  resumeCurrent() {
    if (this.muted) return
    const trackMap = { 1: this.audio1, 2: this.audio2, 3: this.audio3 }
    const active = trackMap[this.currentTrackNum] || this.audio1
    if (active) active.play().catch(() => {})
  }
}

export const audioManager = new AudioManager()
if (typeof window !== 'undefined') {
  window.__audioManager = audioManager
}
