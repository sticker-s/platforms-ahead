// Audio Manager for Platforms Ahead
// Uses fm_fun.flac for Phase 1 (< 600m) and the_big_fight.mp3 for Phase 2 (>= 600m)
import fmFunTrack from './audio/fm_fun.flac'
import bigFightTrack from './audio/the_big_fight.mp3'

class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('music_muted') === 'true'
    this.currentTrackNum = 0 // 0: none, 1: under 600m (fm_fun), 2: over 600m (the_big_fight)
    this.audio1 = null
    this.audio2 = null
    this.listeners = new Set()

    this.initAudio()
  }

  initAudio() {
    if (typeof window === 'undefined') return

    // Track 1 (< 600m): fm_fun.flac
    this.audio1 = new Audio(fmFunTrack || '/audio/fm_fun.flac')
    this.audio1.loop = true
    this.audio1.volume = 0.45

    // Track 2 (>= 600m): the_big_fight.mp3
    this.audio2 = new Audio(bigFightTrack || '/audio/the_big_fight.mp3')
    this.audio2.loop = true
    this.audio2.volume = 0.45
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
    const targetTrack = heightMeters >= 600 ? 2 : 1
    if (this.currentTrackNum !== targetTrack) {
      this.playTrack(targetTrack)
    }
  }

  playTrack(trackNum) {
    this.currentTrackNum = trackNum
    if (this.muted) return

    const active = trackNum === 1 ? this.audio1 : this.audio2
    const inactive = trackNum === 1 ? this.audio2 : this.audio1

    if (inactive) inactive.pause()

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
  }

  resumeCurrent() {
    if (this.muted) return
    const active = this.currentTrackNum === 2 ? this.audio2 : this.audio1
    if (active) active.play().catch(() => {})
  }
}

export const audioManager = new AudioManager()
if (typeof window !== 'undefined') {
  window.__audioManager = audioManager
}
