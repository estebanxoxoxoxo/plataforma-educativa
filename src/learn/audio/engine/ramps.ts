/** Floor on fade durations: instantaneous biquad/gain jumps click or "zing". */
export const MIN_FADE = 0.03

/** The subset of AudioParam we automate — duck-typed so tests can fake it. */
export interface RampableParam {
  value: number
  cancelScheduledValues(time: number): void
  setValueAtTime(value: number, time: number): RampableParam | void
  setTargetAtTime(value: number, time: number, timeConstant: number): RampableParam | void
}

/**
 * Click-free retargeting of an AudioParam:
 *  1. cancel any in-flight automation,
 *  2. pin the param to its current value (no jump),
 *  3. exponential approach via setTargetAtTime (handles target 0 natively,
 *     unlike exponentialRampToValueAtTime),
 *  4. snap to the exact target at now + fadeTime — with τ = fadeTime/4 the
 *     approach has covered ~98.2% of the delta, so the step is inaudible and
 *     afterwards param.value === target exactly (deterministic readouts).
 */
export function rampParam(param: RampableParam, target: number, fadeTime: number, now: number): void {
  const fade = Math.max(MIN_FADE, fadeTime)
  const current = param.value
  param.cancelScheduledValues(now)
  param.setValueAtTime(current, now)
  param.setTargetAtTime(target, now, fade / 4)
  param.setValueAtTime(target, now + fade)
}

const EQ_POWER_STEPS = 64

/**
 * Crossfade EQUAL-POWER de un gain: 'in' rampa 0→1 como sin, 'out' rampa 1→0 como cos. Como
 * sin²+cos²=1, dos params cruzados juntos mantienen potencia sumada constante → sin el bache
 * de ~3 dB al medio que darían dos rampParam exponenciales. Snap al extremo exacto en now+fade.
 * (Opera sobre un AudioParam real —el bus del stem— porque usa setValueCurveAtTime.)
 */
export function equalPowerFade(param: AudioParam, dir: 'in' | 'out', fadeTime: number, now: number): void {
  const fade = Math.max(MIN_FADE, fadeTime)
  const curve = new Float32Array(EQ_POWER_STEPS)
  for (let i = 0; i < EQ_POWER_STEPS; i++) {
    const t = i / (EQ_POWER_STEPS - 1)
    curve[i] = dir === 'in' ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2)
  }
  param.cancelScheduledValues(now)
  param.setValueCurveAtTime(curve, now, fade)
  // PORTE INNERITH (W3, bug latente del POC que aparece al montar el SceneDirector): si el reloj del AudioContext avanzó
  // entre que el llamador leyó `now` y esta programación (crossfadeTo crea las fuentes en el medio), el navegador corre el
  // inicio de la curva a currentTime y el asentado en now+fade cae ADENTRO de la curva → NotSupportedError sin atrapar
  // (escenas que cambian rápido). En ese caso se omite el asentado: la curva ya termina en su extremo (±float).
  try {
    param.setValueAtTime(dir === 'in' ? 1 : 0, now + fade) // asienta exacto (el fin de curva es float-aprox)
  } catch {
    /* la curva arrancó más tarde que `now`: su propio final asienta el valor */
  }
}
