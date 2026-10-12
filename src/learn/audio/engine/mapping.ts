/** Lowest cutoff: heavily muffled but bass still audible. */
export const MIN_CUTOFF_HZ = 200
/** Nominal fully-open cutoff at 44.1 kHz. */
export const MAX_CUTOFF_HZ = 20000

/**
 * tone 0..1 → lowpass cutoff in Hz, logarithmic (perceptually linear in
 * octaves): 0 → 200 Hz, 0.5 → 2 kHz, 1 → fully open. The max is clamped to
 * 0.45 × sampleRate so the biquad stays stable on any device rate.
 */
export function toneToCutoffHz(tone: number, sampleRate = 44100): number {
  const t = Math.min(1, Math.max(0, tone))
  const fMax = Math.min(MAX_CUTOFF_HZ, sampleRate * 0.45)
  return MIN_CUTOFF_HZ * (fMax / MIN_CUTOFF_HZ) ** t
}

/**
 * Perceptual volume 0..1 → linear gain. Square law: mid-slider sounds like
 * "half as loud" instead of "slightly quieter".
 */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, volume))
  return v * v
}

/**
 * WaveShaper curve for a tanh soft-clipper. Maps input [-1,1] through
 * tanh(drive·x); inputs beyond ±1 clamp to tanh(±drive) < 1, so the output is
 * always bounded — a final brickwall against transient overs. Higher drive =
 * harder knee. Returns a Float32Array suitable for `WaveShaperNode.curve`.
 */
export function makeTanhCurve(drive = 1.1, samples = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = Math.tanh(drive * x)
  }
  return curve
}
