let audio: AudioContext | undefined

export function prepareTimerSound(): void {
  if (typeof AudioContext === 'undefined') return

  try {
    audio ??= new AudioContext()
    if (audio.state !== 'running') void audio.resume().catch(() => undefined)
  } catch {
    // Visual timer cues still work in browsers that limit audio playback.
  }
}

export function signalTimerEnd(sound: boolean, vibration: boolean): void {
  if (vibration) navigator.vibrate?.(120)
  if (!sound || audio?.state !== 'running') return

  const oscillator = audio.createOscillator()
  const volume = audio.createGain()
  const start = audio.currentTime
  oscillator.type = 'sine'
  oscillator.frequency.value = 660
  volume.gain.setValueAtTime(0.001, start)
  volume.gain.exponentialRampToValueAtTime(0.16, start + 0.025)
  volume.gain.exponentialRampToValueAtTime(0.001, start + 0.24)
  oscillator.connect(volume).connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.25)
  oscillator.onended = () => {
    oscillator.disconnect()
    volume.disconnect()
  }
}
