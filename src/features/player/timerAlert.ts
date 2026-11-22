let audio: AudioContext | undefined;

export async function prepareTimerSound(): Promise<AudioContext | null> {
  if (typeof AudioContext === 'undefined') return null;

  try {
    if (!audio || audio.state === 'closed') audio = new AudioContext();
    if (audio.state !== 'running') await audio.resume();
    return audio.state === 'running' ? audio : null;
  } catch {
    return null;
  }
}

function playChime(context: AudioContext) {
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const start = context.currentTime + index * 0.22;
    const end = start + 0.2;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(volume).connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      volume.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end);
  });
}

export async function signalTimerEnd(sound: boolean, vibration: boolean, signal?: AbortSignal) {
  const result = { sound: false, vibration: false };
  if (signal?.aborted || document.visibilityState !== 'visible') return result;

  try {
    if (vibration) result.vibration = navigator.vibrate?.([150, 90, 150]) ?? false;
  } catch {
    // Haptics depend on the browser and the device.
  }
  if (!sound) return result;

  let timeout: number | undefined;
  try {
    const context = await Promise.race([
      prepareTimerSound(),
      new Promise<null>((resolve) => { timeout = window.setTimeout(() => resolve(null), 2000); }),
    ]);
    if (context && !signal?.aborted && document.visibilityState === 'visible') {
      playChime(context);
      result.sound = true;
    }
  } catch {
    // The visible deadline feedback still works if audio is unavailable.
  } finally {
    window.clearTimeout(timeout);
  }
  return result;
}
