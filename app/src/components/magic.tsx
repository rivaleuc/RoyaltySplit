import * as React from 'react'
import { motion, useInView, useMotionValue, useSpring, type Transition } from 'framer-motion'
import { cn } from '../lib/utils'

/* --------------------------- BorderBeam (offset-path) ---------------------- */
export function BorderBeam({
  className,
  size = 56,
  duration = 6,
  delay = 0,
  colorFrom = '#818cf8',
  colorTo = '#fbbf24',
  borderWidth = 1.5,
  reverse = false,
  transition,
}: {
  className?: string
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
  reverse?: boolean
  transition?: Transition
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--bw)*1px)_solid_transparent] [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ ['--bw' as any]: borderWidth }}
    >
      <motion.div
        className={cn(
          'absolute aspect-square bg-gradient-to-l from-[var(--cf)] via-[var(--ct)] to-transparent',
          className,
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ['--cf' as any]: colorFrom,
          ['--ct' as any]: colorTo,
        }}
        initial={{ offsetDistance: reverse ? '100%' : '0%' }}
        animate={{ offsetDistance: reverse ? ['100%', '0%'] : ['0%', '100%'] }}
        transition={transition ?? { repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  )
}

/* ------------------------------- NumberTicker ------------------------------ */
export function NumberTicker({
  value,
  className,
  decimalPlaces = 0,
}: {
  value: number
  className?: string
  decimalPlaces?: number
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 60, stiffness: 120 })
  const inView = useInView(ref, { once: true, margin: '-30px' })

  React.useEffect(() => {
    if (inView) mv.set(value)
  }, [inView, value, mv])

  React.useEffect(
    () =>
      spring.on('change', (latest) => {
        if (ref.current)
          ref.current.textContent = Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
      }),
    [spring, decimalPlaces],
  )

  return <span ref={ref} className={className}>0</span>
}

/* --------------------------------- Meteors --------------------------------- */
export function Meteors({ number = 20 }: { number?: number }) {
  const [styles, setStyles] = React.useState<React.CSSProperties[]>([])
  React.useEffect(() => {
    setStyles(
      Array.from({ length: number }, () => ({
        top: '-5%',
        left: `${Math.floor(Math.random() * 100)}%`,
        animationDelay: `${Math.random() * 1 + 0.2}s`,
        animationDuration: `${Math.floor(Math.random() * 8 + 4)}s`,
      })),
    )
  }, [number])
  return (
    <>
      {styles.map((style, i) => (
        <span
          key={i}
          style={style}
          className="pointer-events-none absolute h-0.5 w-0.5 rotate-[215deg] animate-[meteor_linear_infinite] rounded-full bg-slate-200 shadow-[0_0_0_1px_#ffffff15] before:absolute before:top-1/2 before:h-px before:w-[60px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-slate-400 before:to-transparent before:content-['']"
        />
      ))}
    </>
  )
}

/* --------------------------------- Marquee --------------------------------- */
export function Marquee({
  children,
  reverse = false,
  pauseOnHover = false,
  className,
  repeat = 4,
}: {
  children: React.ReactNode
  reverse?: boolean
  pauseOnHover?: boolean
  className?: string
  repeat?: number
}) {
  return (
    <div className={cn('group flex overflow-hidden [--duration:34s] [--gap:1rem] [gap:var(--gap)]', className)}>
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 items-center justify-around [gap:var(--gap)] animate-[marquee_var(--duration)_linear_infinite]',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------- AuroraText -------------------------------- */
export function AuroraText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-[linear-gradient(135deg,#818cf8_0%,#a78bfa_25%,#fbbf24_50%,#818cf8_75%,#a78bfa_100%)] bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-x_6s_linear_infinite]',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------- ShinyText --------------------------------- */
export function ShinyText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent [--shiny-w:120px] animate-[shiny_4s_ease-in-out_infinite]',
        'bg-[linear-gradient(110deg,#8b94a7,45%,#fff,55%,#8b94a7)] bg-[length:250%_100%]',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------- MagicCard (cursor spotlight) -------------------- */
export function MagicCard({
  children,
  className,
  glow = '#818cf8',
}: {
  children: React.ReactNode
  className?: string
  glow?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ x: -200, y: -200 })
  const [hover, setHover] = React.useState(false)
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-sm', className)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background: `radial-gradient(340px circle at ${pos.x}px ${pos.y}px, ${glow}1f, transparent 65%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
