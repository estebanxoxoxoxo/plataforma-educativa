import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import type { BurstKind, FxMood, FxTone, PopOptions, VisualSink } from './types'
import '../learn-engine.css'

/* Implementación concreta del VisualSink, app-native (Tailwind + inline, sin CSS del
   lab). Fondo reactivo a mood (tintes claros acordes al tema) + flash + shake (WAAPI)
   + partículas (canvas) + textos flotantes. Expone el sink por ref.
   PORTE INNERITH (W2): lógica, intensidades, duraciones y reduced-motion IDÉNTICOS al POC; solo las
   clases Tailwind pasan a clases lrn- (learn-engine.css, traducción literal de lo que computaba
   Tailwind v4) y el color del flotante 'good' usa el token de Innerith. */

// --- partículas (canvas). A nivel de módulo: Math.random / performance.now / rAF OK. ---
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; color: string; rot: number; vr: number; rect: boolean
}
const SPARK_COLORS = ['#4cc38a', '#f59e0b', '#3b82f6']
const CONFETTI_COLORS = ['#4cc38a', '#f59e0b', '#3b82f6', '#ec4899', '#a855f7']
const GRAVITY = 900

class ParticleField {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private particles: Particle[] = []
  private raf: number | null = null
  private last = 0
  private cssW = 0
  private cssH = 0
  readonly reduced: boolean

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }

  setSize(cssW: number, cssH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.cssW = cssW
    this.cssH = cssH
    this.canvas.width = Math.max(1, Math.round(cssW * dpr))
    this.canvas.height = Math.max(1, Math.round(cssH * dpr))
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  burst(nx: number, ny: number, kind: BurstKind, intensity: number): void {
    if (this.reduced || !this.ctx) return
    const cx = nx * this.cssW
    const cy = ny * this.cssH
    const confetti = kind === 'confetti'
    const count = Math.round((confetti ? 26 : 14) * intensity)
    const palette = confetti ? CONFETTI_COLORS : SPARK_COLORS
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const speed = (confetti ? 120 : 90) + Math.random() * (confetti ? 260 : 180) * intensity
      const maxLife = (confetti ? 0.9 : 0.5) + Math.random() * 0.5
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - (confetti ? 120 : 60),
        life: maxLife, maxLife,
        size: (confetti ? 5 : 3) + Math.random() * 4,
        color: palette[Math.floor(Math.random() * palette.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        rect: confetti,
      })
    }
    this.start()
  }

  private start(): void {
    if (this.raf != null) return
    this.last = performance.now()
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000)
      this.last = t
      this.tick(dt)
      this.raf = this.particles.length > 0 ? requestAnimationFrame(step) : null
    }
    this.raf = requestAnimationFrame(step)
  }

  private tick(dt: number): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.clearRect(0, 0, this.cssW, this.cssH)
    const alive: Particle[] = []
    for (const p of this.particles) {
      p.vy += GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.life -= dt
      if (p.life <= 0 || p.y > this.cssH + 40) continue
      alive.push(p)
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.fillStyle = p.color
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.rect) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6)
      else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    this.particles = alive
  }

  dispose(): void {
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.particles = []
  }
}

// --- componente ---

const MOODS: FxMood[] = ['play', 'tense', 'win', 'lose']
const MOOD_BG: Record<FxMood, string> = {
  play: 'radial-gradient(120% 90% at 30% 8%, #eef4fb 0%, var(--bg) 60%)',
  tense: 'radial-gradient(120% 90% at 50% 0%, #fdecdd 0%, var(--bg) 58%)',
  win: 'radial-gradient(120% 95% at 50% 12%, #e6f6ec 0%, var(--bg) 60%)',
  lose: 'radial-gradient(120% 90% at 50% 20%, #eef0f3 0%, var(--bg) 60%)',
}
const FLASH_COLOR: Record<FxTone, string> = {
  good: 'rgba(76, 195, 138, 0.26)',
  bad: 'rgba(224, 85, 85, 0.30)',
  win: 'rgba(245, 200, 70, 0.40)',
}
const POP_COLOR: Record<'good' | 'bad', string> = { good: 'var(--blue-d)', bad: '#dc2626' }

let popSeq = 0
function nextPopId(): number {
  popSeq += 1
  return popSeq
}

interface Pop { id: number; text: string; x: number; y: number; tone: 'good' | 'bad' }

export const VisualStage = forwardRef<VisualSink, { children: ReactNode; className?: string }>(
  function VisualStage({ children, className }, ref) {
    const [mood, setMood] = useState<FxMood>('play')
    const [pops, setPops] = useState<Pop[]>([])
    const rootRef = useRef<HTMLDivElement>(null)
    const flashRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fieldRef = useRef<ParticleField | null>(null)
    const reducedRef = useRef(false)

    useEffect(() => {
      reducedRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      const canvas = canvasRef.current
      const root = rootRef.current
      if (!canvas || !root) return
      const field = new ParticleField(canvas)
      fieldRef.current = field
      const resize = () => {
        const r = root.getBoundingClientRect()
        field.setSize(r.width, r.height)
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(root)
      return () => {
        ro.disconnect()
        field.dispose()
        fieldRef.current = null
      }
    }, [])

    useImperativeHandle(
      ref,
      (): VisualSink => ({
        setBackground: (m) => setMood(m),
        burst: (opts) =>
          fieldRef.current?.burst(opts?.x ?? 0.5, opts?.y ?? 0.5, opts?.kind ?? 'spark', opts?.intensity ?? 1),
        flash: (tone) => {
          const el = flashRef.current
          if (!el) return
          el.style.background = FLASH_COLOR[tone]
          el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], {
            duration: reducedRef.current ? 120 : 420,
            easing: 'ease-out',
          })
        },
        shake: (intensity = 1) => {
          const el = rootRef.current
          if (!el || reducedRef.current) return
          const d = 6 * intensity
          el.animate(
            [
              { transform: 'translateX(0)' },
              { transform: `translateX(${-d}px)` },
              { transform: `translateX(${d}px)` },
              { transform: `translateX(${-d * 0.6}px)` },
              { transform: 'translateX(0)' },
            ],
            { duration: 320, easing: 'ease-in-out' },
          )
        },
        pop: ({ text, x = 0.5, y = 0.42, tone = 'good' }: PopOptions) => {
          const id = nextPopId()
          setPops((prev) => [...prev, { id, text, x, y, tone }])
          window.setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 900)
        },
      }),
      [],
    )

    return (
      <div ref={rootRef} className={`lrn-stage ${className ?? ''}`}>
        <div className="lrn-stage-moods" aria-hidden="true">
          {MOODS.map((m) => (
            <div
              key={m}
              className="lrn-stage-mood"
              style={{ background: MOOD_BG[m], opacity: mood === m ? 1 : 0 }}
            />
          ))}
        </div>
        <canvas ref={canvasRef} className="lrn-stage-canvas" aria-hidden="true" />
        <div ref={flashRef} className="lrn-stage-flash" aria-hidden="true" />
        {pops.map((p) => (
          <div
            key={p.id}
            ref={(el) => {
              el?.animate(
                [
                  { opacity: 0, transform: 'translate(-50%, -30%) scale(0.6)' },
                  { opacity: 1, transform: 'translate(-50%, -55%) scale(1.15)', offset: 0.25 },
                  { opacity: 0, transform: 'translate(-50%, -120%) scale(1)' },
                ],
                { duration: 900, easing: 'ease-out' },
              )
            }}
            className="lrn-stage-pop"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, color: POP_COLOR[p.tone], textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
            {p.text}
          </div>
        ))}
        <div className="lrn-stage-body">{children}</div>
      </div>
    )
  },
)
