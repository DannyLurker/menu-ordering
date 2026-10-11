// Web Audio API chime synthesis for kitchen order notifications (spec 0010, AC-9).
// Audio unlocks on first user interaction to comply with browser autoplay policies.

let audioContext: AudioContext | null = null;

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

export function playOrderChime(): void {
  if (typeof window === "undefined") return;
  if (!audioContext) {
    unlockAudio();
  }
  if (!audioContext || audioContext.state !== "running") return;

  try {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    // Pleasant two-tone hotel service chime: 587.33Hz (D5) glides to 880Hz (A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.85);
  } catch {
    // Ignore audio playback failures gracefully
  }
}
