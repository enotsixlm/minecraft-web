/** 简易 WebAudio 合成音效 */

export class AudioBus {
  constructor() {
    this.ctx = null
    this.enabled = true
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  tone(freq, dur, type = 'square', gain = 0.04, slide = 0) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx) return
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  play(name) {
    switch (name) {
      case 'hoe':
        this.tone(90, 0.08, 'sawtooth', 0.05, -30)
        break
      case 'water':
        this.tone(520, 0.06, 'sine', 0.03, 80)
        this.tone(780, 0.1, 'sine', 0.02, -40)
        break
      case 'plant':
        this.tone(330, 0.07, 'triangle', 0.04, 120)
        break
      case 'harvest':
        this.tone(440, 0.08, 'square', 0.035, 0)
        this.tone(660, 0.12, 'square', 0.03, 0)
        break
      case 'coin':
        this.tone(880, 0.06, 'square', 0.03)
        this.tone(1175, 0.1, 'square', 0.025)
        break
      case 'ui':
        this.tone(520, 0.04, 'triangle', 0.03)
        break
      case 'error':
        this.tone(140, 0.12, 'sawtooth', 0.04, -40)
        break
      case 'day':
        this.tone(392, 0.15, 'triangle', 0.035)
        this.tone(523, 0.2, 'triangle', 0.03)
        break
      default:
        break
    }
  }
}
