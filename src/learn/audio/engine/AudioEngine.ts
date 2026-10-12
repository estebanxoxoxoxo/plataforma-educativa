import { channelGroup, loopStems, moodGroup, resolveFadeTime, resolveMoodTargets, validateManifest } from './manifest'
import { makeTanhCurve, toneToCutoffHz, volumeToGain } from './mapping'
import { equalPowerFade, MIN_FADE, rampParam } from './ramps'
import type {
  AudioManifest,
  ChannelLive,
  EngineSnapshot,
  ResolvedTarget,
} from './types'

interface ChannelStrip {
  filter: BiquadFilterNode
  gain: GainNode
  analyser: AnalyserNode
}

interface FxVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

const LOOP_START_HEADROOM = 0.05 // s: lets all sources start on the same render quantum
const TRANSPORT_FADE = 0.15 // s: loop-bus fade on start/stop

const IDLE: EngineSnapshot = {
  status: 'idle',
  currentMoods: {},
  runningStems: [],
  currentStem: null,
  contextState: null,
  error: null,
}

/**
 * Adaptive game-audio engine on raw Web Audio. Framework-agnostic: no React
 * imports here. Loop channels are stems of one piece (identical buffer
 * length, started at one shared timestamp → sample-locked forever); moods
 * ramp per-channel volume (GainNode) and tone (lowpass BiquadFilterNode).
 *
 * dispose() releases everything but the engine can be load()ed again — this
 * is what makes the React hook StrictMode-safe without recreating instances.
 * Async work is guarded by a generation counter: dispose()/load() bump it,
 * and anything awaited under an older generation discards its result.
 */
export class AudioEngine {
  private readonly externalCtx: AudioContext | null
  private ctx: AudioContext | null = null
  private manifest: AudioManifest | null = null
  private fetched = new Map<string, ArrayBuffer>()
  private buffers = new Map<string, AudioBuffer>()
  private strips = new Map<string, ChannelStrip>()
  private masterGain: GainNode | null = null
  private fadeBus: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private softClip: WaveShaperNode | null = null
  private masterAnalyser: AnalyserNode | null = null
  // Un bus + un set de fuentes POR STEM (tema). El bus es el handle del crossfade (0..1);
  // las fuentes de un stem arrancan en un t0 propio → sus capas quedan sample-locked entre sí.
  private stemBuses = new Map<string, GainNode>()
  private stemSources = new Map<string, AudioBufferSourceNode[]>()
  private runningStems = new Set<string>()
  private currentStem: string | null = null
  private voices = new Set<FxVoice>()
  private targets = new Map<string, ResolvedTarget>()
  private listeners = new Set<() => void>()
  private initPromise: Promise<void> | null = null
  private loadAbort: AbortController | null = null
  private fadeStopTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private snapshot: EngineSnapshot = IDLE

  constructor(opts?: { context?: AudioContext }) {
    this.externalCtx = opts?.context ?? null
  }

  // ------------------------------------------------------------ lifecycle

  /** Validate + fetch all files. Needs no AudioContext, so safe on mount. */
  async load(manifest: AudioManifest): Promise<void> {
    const { status } = this.snapshot
    if (status !== 'idle' && status !== 'disposed' && status !== 'error') return
    const gen = ++this.generation

    const result = validateManifest(manifest)
    if (!result.ok) {
      this.fail(`invalid manifest:\n${result.errors.join('\n')}`)
      return
    }
    this.manifest = manifest
    this.update({ ...IDLE, status: 'loading' })
    // Cancel any prior in-flight load (e.g. the StrictMode double-mount) so we
    // don't pile up concurrent multi-MB fetches and drop connections.
    this.loadAbort?.abort()
    const abort = (this.loadAbort = new AbortController())
    try {
      const base = manifest.baseUrl ?? ''
      const entries = await Promise.all(
        manifest.channels.map(async (ch) => {
          const url = base + ch.file
          const res = await fetch(url, { signal: abort.signal })
          if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`)
          return [ch.id, await res.arrayBuffer()] as const
        }),
      )
      if (gen !== this.generation) return // superseded by dispose()/reload
      this.fetched = new Map(entries)
      this.update({ status: 'ready' })
    } catch (err) {
      // a superseded/aborted load is expected — only surface real failures
      if (gen !== this.generation || abort.signal.aborted) return
      this.fail(err instanceof Error ? err.message : String(err))
    }
  }

  /**
   * MUST be called from a user-gesture handler: creates/resumes the
   * AudioContext synchronously (before any await — iOS requirement), then
   * decodes and builds the graph.
   */
  init(): Promise<void> {
    const { status } = this.snapshot
    if (status !== 'ready' && status !== 'running') return Promise.resolve()
    if (!this.ctx) {
      this.ctx = this.externalCtx ?? new AudioContext()
      this.ctx.onstatechange = () => {
        this.update({ contextState: this.ctx?.state ?? null })
      }
    }
    void this.ctx.resume() // synchronous call inside the gesture stack
    this.initPromise ??= this.buildGraph(this.generation)
    return this.initPromise
  }

  private async buildGraph(gen: number): Promise<void> {
    const ctx = this.ctx
    const manifest = this.manifest
    if (!ctx || !manifest) return
    try {
      this.masterGain = ctx.createGain()
      this.masterGain.gain.value = volumeToGain(0.9) // headroom over −6 dBFS stems
      // Brickwall-ish limiter on the master bus so stacked FX over a full music
      // mix never clip — standard for game audio. masterGain → limiter → out.
      this.limiter = ctx.createDynamicsCompressor()
      this.limiter.threshold.value = -3
      this.limiter.knee.value = 3
      this.limiter.ratio.value = 20
      this.limiter.attack.value = 0.002
      this.limiter.release.value = 0.08
      // Final brickwall: tanh soft-clip guarantees |out| < 1 even on the FX
      // transients that leak past the limiter's 2ms attack (Web Audio has no
      // lookahead). 4x oversampling keeps the nonlinearity from aliasing.
      this.softClip = ctx.createWaveShaper()
      this.softClip.curve = makeTanhCurve(1.1)
      this.softClip.oversample = '4x'
      // Dedicated fade bus for fadeOutAll, kept separate from the user master
      // volume so a global fade never disturbs (or gets stuck overwriting) it.
      // masterGain → fadeBus → limiter → softClip → out.
      this.fadeBus = ctx.createGain()
      this.fadeBus.gain.value = 1
      this.masterGain.connect(this.fadeBus)
      this.fadeBus.connect(this.limiter)
      this.limiter.connect(this.softClip)
      this.softClip.connect(ctx.destination)
      this.masterAnalyser = this.makeAnalyser(ctx)
      this.softClip.connect(this.masterAnalyser) // meter shows true output (post brickwall)

      // Un bus por stem (tema); arranca en silencio, startStem/crossfadeTo lo funden.
      for (const stem of loopStems(manifest)) {
        const bus = ctx.createGain()
        bus.gain.value = 0
        bus.connect(this.masterGain)
        this.stemBuses.set(stem, bus)
      }

      // decodeAudioData detaches its input, so decode from copies — keeps the
      // fetched bytes reusable after a dispose()/load() cycle.
      const decoded = await Promise.all(
        manifest.channels.map(async (ch) => {
          const bytes = this.fetched.get(ch.id)
          if (!bytes) throw new Error(`no fetched data for channel "${ch.id}"`)
          return [ch.id, await ctx.decodeAudioData(bytes.slice(0))] as const
        }),
      )
      if (gen !== this.generation) return
      this.buffers = new Map(decoded)

      // Sample-lock POR STEM: dentro de un tema, sus capas synced comparten un largo exacto
      // (arrancan en un t0 propio); temas distintos pueden diferir. Los sync:false loopean solos.
      for (const stem of loopStems(manifest)) {
        const lengths = new Set(
          manifest.channels
            .filter((ch) => ch.mode === 'loop' && ch.sync !== false && channelGroup(ch) === stem)
            .map((ch) => this.buffers.get(ch.id)!.length),
        )
        if (lengths.size > 1)
          throw new Error(
            `stem "${stem}": las capas synced deben compartir un largo de buffer exacto para quedar sample-locked, hay: ${[...lengths].join(', ')}`,
          )
      }

      for (const ch of manifest.channels) {
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.Q.value = Math.SQRT1_2 // Butterworth: no resonant bump
        filter.frequency.value = toneToCutoffHz(1, ctx.sampleRate)
        const gain = ctx.createGain()
        const analyser = this.makeAnalyser(ctx)
        filter.connect(gain)
        gain.connect(ch.mode === 'loop' ? this.stemBuses.get(channelGroup(ch))! : this.masterGain)
        gain.connect(analyser)
        this.strips.set(ch.id, { filter, gain, analyser })
        this.targets.set(ch.id, { volume: 1, tone: 1 })
      }

      for (const moodId of Object.values(manifest.defaultMoods ?? {}))
        this.applyMood(moodId, { instant: true })
      this.update({ status: 'running', contextState: ctx.state })
    } catch (err) {
      if (gen !== this.generation) return
      this.fail(err instanceof Error ? err.message : String(err))
    }
  }

  /** Re-resume after e.g. a Safari tab suspension. Needs a user gesture. */
  resume(): void {
    void this.ctx?.resume()
  }

  /** Idempotent. The engine stays subscribable and can be load()ed again. */
  async dispose(): Promise<void> {
    this.generation++
    this.initPromise = null
    this.loadAbort?.abort() // cancel any in-flight fetches
    this.cancelFadeStop()
    for (const sources of this.stemSources.values()) {
      for (const src of sources) {
        try {
          src.stop()
        } catch {
          /* never started */
        }
      }
    }
    this.stemSources.clear()
    this.stemBuses.clear()
    this.runningStems.clear()
    this.currentStem = null
    for (const voice of this.voices) {
      try {
        voice.source.stop()
      } catch {
        /* already ended */
      }
    }
    this.voices.clear()
    this.strips.clear()
    this.buffers.clear()
    this.fetched.clear()
    this.targets.clear()
    this.masterGain = null
    this.fadeBus = null
    this.limiter = null
    this.softClip = null
    this.masterAnalyser = null
    this.manifest = null
    const ctx = this.ctx
    this.ctx = null
    this.update({ ...IDLE, status: 'disposed' })
    if (ctx && !this.externalCtx && ctx.state !== 'closed') {
      ctx.onstatechange = null
      await ctx.close()
    }
  }

  // ------------------------------------------------------- transport (por stem)

  /** Arranca un stem (tema): crea sus capas en un t0 propio (sample-locked entre sí) y funde su bus. */
  startStem(stemId: string, opts?: { fadeTime?: number }): void {
    const ctx = this.ctx
    const bus = this.stemBuses.get(stemId)
    if (!ctx || this.snapshot.status !== 'running' || !bus || this.runningStems.has(stemId)) return
    this.cancelFadeStop()
    const now = ctx.currentTime
    this.unduckFadeBus(now)
    this.spawnStemSources(stemId)
    bus.gain.cancelScheduledValues(now)
    bus.gain.setValueAtTime(0, now)
    rampParam(bus.gain, 1, opts?.fadeTime ?? TRANSPORT_FADE, now)
    this.runningStems.add(stemId)
    this.emitStems()
  }

  /** Frena un stem: funde su bus a 0 y detiene sus capas tras el fade. */
  stopStem(stemId: string, opts?: { fadeTime?: number }): void {
    const ctx = this.ctx
    const bus = this.stemBuses.get(stemId)
    if (!ctx || !bus || !this.runningStems.has(stemId)) return
    const now = ctx.currentTime
    const fade = opts?.fadeTime ?? TRANSPORT_FADE
    rampParam(bus.gain, 0, fade, now)
    this.stopStemSources(stemId, now + Math.max(fade, MIN_FADE) + 0.05)
    this.runningStems.delete(stemId)
    if (this.currentStem === stemId) this.currentStem = null
    this.emitStems()
  }

  /**
   * Cambia el "slot de tema" a `stemId`: lo funde con curva equal-power mientras saca el tema
   * anterior del slot. Los stems arrancados con startStem (capas independientes, p.ej. ambiente)
   * NO se tocan. Idempotente si ya es el tema actual.
   */
  crossfadeTo(stemId: string, opts?: { fadeTime?: number }): void {
    const ctx = this.ctx
    const bus = this.stemBuses.get(stemId)
    if (!ctx || this.snapshot.status !== 'running' || !bus) return
    if (this.currentStem === stemId && this.runningStems.has(stemId)) return
    this.cancelFadeStop()
    const now = ctx.currentTime
    this.unduckFadeBus(now)
    const fade = opts?.fadeTime ?? this.manifest?.fadeTime ?? TRANSPORT_FADE
    const prev = this.currentStem
    // entra el nuevo (curva equal-power desde 0)
    if (!this.runningStems.has(stemId)) this.spawnStemSources(stemId)
    equalPowerFade(bus.gain, 'in', fade, now)
    this.runningStems.add(stemId)
    // sale el anterior (solo el del slot)
    if (prev && prev !== stemId && this.runningStems.has(prev)) {
      const prevBus = this.stemBuses.get(prev)
      if (prevBus) equalPowerFade(prevBus.gain, 'out', fade, now)
      this.stopStemSources(prev, now + fade + 0.05)
      this.runningStems.delete(prev)
    }
    this.currentStem = stemId
    this.emitStems()
  }

  /** Compat: arranca todos los stems (cada uno en su t0). Preferí startStem/crossfadeTo. */
  startLoops(): void {
    if (!this.manifest) return
    for (const stem of loopStems(this.manifest)) this.startStem(stem)
  }

  /** Compat: frena todos los stems que estén sonando. */
  stopLoops(fadeTime = TRANSPORT_FADE): void {
    for (const stem of [...this.runningStems]) this.stopStem(stem, { fadeTime })
  }

  private spawnStemSources(stemId: string): void {
    const ctx = this.ctx
    const manifest = this.manifest
    if (!ctx || !manifest) return
    const t0 = ctx.currentTime + LOOP_START_HEADROOM
    const sources: AudioBufferSourceNode[] = []
    for (const ch of manifest.channels) {
      if (ch.mode !== 'loop' || channelGroup(ch) !== stemId) continue
      const source = ctx.createBufferSource()
      source.buffer = this.buffers.get(ch.id)!
      source.loop = true
      source.connect(this.strips.get(ch.id)!.filter)
      source.start(t0) // un t0 compartido por stem → sus capas quedan sample-locked
      sources.push(source)
    }
    this.stemSources.set(stemId, sources)
  }

  private stopStemSources(stemId: string, stopAt: number): void {
    const sources = this.stemSources.get(stemId)
    if (!sources) return
    for (const src of sources) {
      try {
        src.stop(stopAt)
      } catch {
        /* not started */
      }
    }
    this.stemSources.delete(stemId)
  }

  private unduckFadeBus(now: number): void {
    // un fadeOutAll pudo dejar el fade bus en 0 — restaurarlo para que lo nuevo sea audible
    if (!this.fadeBus) return
    this.fadeBus.gain.cancelScheduledValues(now)
    this.fadeBus.gain.setValueAtTime(1, now)
  }

  private emitStems(): void {
    this.update({ runningStems: [...this.runningStems], currentStem: this.currentStem })
  }

  // ------------------------------------------------------------ moods & FX

  /** Set the current mood of the group the mood belongs to (independent of other groups). */
  setMood(moodId: string, opts?: { fadeTime?: number }): void {
    if (this.snapshot.status !== 'running' || !this.manifest) return
    const mood = this.manifest.moods.find((m) => m.id === moodId)
    if (!mood) return
    const group = moodGroup(mood)
    if (this.snapshot.currentMoods[group] === moodId && opts?.fadeTime === undefined) return
    this.applyMood(moodId, { fadeTime: opts?.fadeTime })
  }

  private applyMood(moodId: string, opts: { fadeTime?: number; instant?: boolean }): void {
    const ctx = this.ctx
    const manifest = this.manifest
    if (!ctx || !manifest) return
    const mood = manifest.moods.find((m) => m.id === moodId)
    if (!mood) return
    const fade = opts.fadeTime ?? resolveFadeTime(manifest, mood)
    const now = ctx.currentTime
    // resolveMoodTargets returns only this mood's GROUP channels, so other
    // groups (e.g. the ambience bed) are left untouched.
    const targets = resolveMoodTargets(manifest, moodId)
    for (const [channelId, target] of targets) {
      const strip = this.strips.get(channelId)
      if (!strip) continue
      const gainValue = volumeToGain(target.volume)
      const cutoff = toneToCutoffHz(target.tone, ctx.sampleRate)
      if (opts.instant) {
        strip.gain.gain.setValueAtTime(gainValue, now)
        strip.filter.frequency.setValueAtTime(cutoff, now)
      } else {
        rampParam(strip.gain.gain, gainValue, fade, now)
        rampParam(strip.filter.frequency, cutoff, fade, now)
      }
      this.targets.set(channelId, target) // merge: only this group's channels change
    }
    this.update({ currentMoods: { ...this.snapshot.currentMoods, [moodGroup(mood)]: moodId } })
  }

  triggerFx(channelId: string, opts?: { volume?: number }): void {
    const ctx = this.ctx
    if (!ctx || this.snapshot.status !== 'running') return
    const strip = this.strips.get(channelId)
    const buffer = this.buffers.get(channelId)
    if (!strip || !buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = volumeToGain(opts?.volume ?? 1)
    source.connect(gain)
    gain.connect(strip.filter)

    const voice: FxVoice = { source, gain }
    this.voices.add(voice) // polyphonic: each trigger is an independent voice
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      this.voices.delete(voice)
    }
    source.start()
  }

  setMasterVolume(volume: number, fadeTime = 0.05): void {
    const ctx = this.ctx
    if (!ctx || !this.masterGain) return
    rampParam(this.masterGain.gain, volumeToGain(volume), fadeTime, ctx.currentTime)
  }

  /**
   * Fade everything out (music, ambience and ringing FX) over `fadeTime`, then
   * hard-stop all sources. The master gain is restored afterwards so the next
   * startLoops()/triggerFx() is audible again; the active moods are kept.
   */
  fadeOutAll(fadeTime = 1.5): void {
    const ctx = this.ctx
    if (!ctx || !this.fadeBus || this.snapshot.status !== 'running') return
    this.cancelFadeStop()
    // Fade the dedicated fade bus (not the user master volume), then stop
    // sources and reset the buses so the next startLoops() is clean.
    rampParam(this.fadeBus.gain, 0, fadeTime, ctx.currentTime)
    this.fadeStopTimer = setTimeout(
      () => {
        this.fadeStopTimer = null
        this.hardStopSources()
        this.resetBuses()
        this.runningStems.clear()
        this.currentStem = null
        this.emitStems()
      },
      Math.max(0.03, fadeTime) * 1000 + 60,
    )
  }

  /** Return the stem/fade buses to their ready-to-start state (silent stems, full fade bus). */
  private resetBuses(): void {
    const ctx = this.ctx
    if (!ctx) return
    for (const bus of this.stemBuses.values()) {
      bus.gain.cancelScheduledValues(ctx.currentTime)
      bus.gain.setValueAtTime(0, ctx.currentTime)
    }
    if (this.fadeBus) {
      this.fadeBus.gain.cancelScheduledValues(ctx.currentTime)
      this.fadeBus.gain.setValueAtTime(1, ctx.currentTime)
    }
  }

  private cancelFadeStop(): void {
    if (this.fadeStopTimer !== null) {
      clearTimeout(this.fadeStopTimer)
      this.fadeStopTimer = null
    }
  }

  private hardStopSources(): void {
    for (const sources of this.stemSources.values()) {
      for (const src of sources) {
        try {
          src.stop()
        } catch {
          /* not started */
        }
      }
    }
    this.stemSources.clear()
    for (const voice of this.voices) {
      try {
        voice.source.stop()
      } catch {
        /* already ended */
      }
    }
    this.voices.clear()
  }

  // ------------------------------------------------------------ reads

  /** Live per-frame values for UI readouts; not part of the snapshot. */
  getChannelLive(channelId: string): ChannelLive | null {
    const strip = this.strips.get(channelId)
    const target = this.targets.get(channelId)
    if (!strip || !target) return null
    return {
      gain: strip.gain.gain.value,
      cutoffHz: strip.filter.frequency.value,
      targetVolume: target.volume,
      targetTone: target.tone,
    }
  }

  /** Live gain (0..1) del bus de crossfade de un stem, o null. Para mixers/debug/verificación. */
  getStemGain(stemId: string): number | null {
    return this.stemBuses.get(stemId)?.gain.value ?? null
  }

  /** Per-channel analyser, or the master tap via id 'master'. */
  getAnalyser(channelId: string): AnalyserNode | null {
    if (channelId === 'master') return this.masterAnalyser
    return this.strips.get(channelId)?.analyser ?? null
  }

  // ------------------------------------------------- snapshot (useSyncExternalStore)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): EngineSnapshot => this.snapshot

  private update(patch: Partial<EngineSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    const changed = (Object.keys(next) as (keyof EngineSnapshot)[]).some(
      (k) => next[k] !== this.snapshot[k],
    )
    if (!changed) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  private fail(message: string): void {
    this.update({ status: 'error', error: message })
  }

  private makeAnalyser(ctx: AudioContext): AnalyserNode {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.6
    return analyser
  }
}
