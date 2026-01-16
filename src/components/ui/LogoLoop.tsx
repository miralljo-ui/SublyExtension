import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import './LogoLoop.css'

type LogoImage = {
  src: string
  srcSet?: string
  sizes?: string
  width?: number
  height?: number
  alt?: string
  title?: string
  href?: string
  ariaLabel?: string
  scale?: number
}

type LogoNode = {
  node: ReactNode
  title?: string
  href?: string
  ariaLabel?: string
  scale?: number
}

export type LogoItem = LogoImage | LogoNode

const ANIMATION_CONFIG = {
  SMOOTH_TAU: 0.25,
  MIN_COPIES: 2,
  COPY_HEADROOM: 2,
}

const toCssLength = (value: number | string | undefined) => (typeof value === 'number' ? `${value}px` : value ?? undefined)

type ResizeObserverLike = {
  observe: (el: Element) => void
  disconnect: () => void
}

const useResizeObserver = (callback: () => void, elements: Array<RefObject<HTMLElement | null>>, dependencies: unknown[]) => {
  useEffect(() => {
    if (!(window as any).ResizeObserver) {
      const handleResize = () => callback()
      window.addEventListener('resize', handleResize)
      callback()
      return () => window.removeEventListener('resize', handleResize)
    }

    const observers: Array<ResizeObserverLike | null> = elements.map((ref) => {
      if (!ref.current) return null
      const observer: ResizeObserverLike = new (window as any).ResizeObserver(callback)
      observer.observe(ref.current)
      return observer
    })

    callback()

    return () => {
      observers.forEach((observer) => observer?.disconnect())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}

const useImageLoader = (seqRef: RefObject<HTMLElement | null>, onLoad: () => void, dependencies: unknown[]) => {
  useEffect(() => {
    const images = (seqRef.current?.querySelectorAll('img') as unknown as HTMLImageElement[]) ?? []

    if (!images || images.length === 0) {
      onLoad()
      return
    }

    let remainingImages = images.length
    const handleImageLoad = () => {
      remainingImages -= 1
      if (remainingImages === 0) onLoad()
    }

    images.forEach((img) => {
      const htmlImg = img
      if (htmlImg.complete) {
        handleImageLoad()
      } else {
        htmlImg.addEventListener('load', handleImageLoad, { once: true })
        htmlImg.addEventListener('error', handleImageLoad, { once: true })
      }
    })

    return () => {
      images.forEach((img) => {
        img.removeEventListener('load', handleImageLoad)
        img.removeEventListener('error', handleImageLoad)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}

const useAnimationLoop = (
  trackRef: RefObject<HTMLDivElement | null>,
  targetVelocity: number,
  seqWidth: number,
  isHovered: boolean,
  pauseOnHover: boolean,
) => {
  const rafRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)
  const offsetRef = useRef(0)
  const velocityRef = useRef(0)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    if (seqWidth > 0) {
      offsetRef.current = ((offsetRef.current % seqWidth) + seqWidth) % seqWidth
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }

    const animate = (timestamp: number) => {
      if (!inView) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp
      }

      const deltaTime = Math.max(0, timestamp - lastTimestampRef.current) / 1000
      lastTimestampRef.current = timestamp

      const target = pauseOnHover && isHovered ? 0 : targetVelocity
      const easingFactor = 1 - Math.exp(-deltaTime / ANIMATION_CONFIG.SMOOTH_TAU)
      velocityRef.current += (target - velocityRef.current) * easingFactor

      if (seqWidth > 0) {
        let nextOffset = offsetRef.current + velocityRef.current * deltaTime
        nextOffset = ((nextOffset % seqWidth) + seqWidth) % seqWidth
        offsetRef.current = nextOffset

        const translateX = -offsetRef.current
        track.style.transform = `translate3d(${translateX}px, 0, 0)`
      } else {
        track.style.transform = 'translate3d(0, 0, 0)'
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimestampRef.current = null
    }
  }, [targetVelocity, seqWidth, isHovered, pauseOnHover, trackRef, inView])

  useEffect(() => {
    const root = trackRef.current?.parentElement?.parentElement
    if (!root || !(window as any).IntersectionObserver) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === root) setInView(e.isIntersecting)
        }
      },
      { root: null, threshold: 0 },
    )

    io.observe(root)
    return () => io.disconnect()
  }, [trackRef])
}

export const LogoLoop = memo(
  ({
    logos,
    speed = 120,
    direction = 'left',
    width = '100%',
    logoHeight = 28,
    gap = 32,
    pauseOnHover = true,
    fadeOut = false,
    fadeOutColor,
    scaleOnHover = false,
    ariaLabel = 'Partner logos',
    className,
    style,
  }: {
    logos: LogoItem[]
    speed?: number
    direction?: 'left' | 'right'
    width?: number | string
    logoHeight?: number
    gap?: number
    pauseOnHover?: boolean
    fadeOut?: boolean
    fadeOutColor?: string
    scaleOnHover?: boolean
    ariaLabel?: string
    className?: string
    style?: CSSProperties
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const trackRef = useRef<HTMLDivElement | null>(null)
    const seqRef = useRef<HTMLUListElement | null>(null)

    const [seqWidth, setSeqWidth] = useState(0)
    const [copyCount, setCopyCount] = useState(ANIMATION_CONFIG.MIN_COPIES)
    const [isHovered, setIsHovered] = useState(false)
    const [broken, setBroken] = useState<Record<number, boolean>>({})

    const targetVelocity = useMemo(() => {
      const magnitude = Math.abs(speed)
      const directionMultiplier = direction === 'left' ? 1 : -1
      const speedMultiplier = speed < 0 ? -1 : 1
      return magnitude * directionMultiplier * speedMultiplier
    }, [speed, direction])

    const updateDimensions = useCallback(() => {
      const containerWidth = containerRef.current?.clientWidth ?? 0
      const sequenceWidth = (seqRef.current?.scrollWidth ?? 0) || (seqRef.current?.getBoundingClientRect?.()?.width ?? 0)

      if (sequenceWidth > 0 && containerWidth > 0) {
        const seqW = Math.ceil(sequenceWidth)
        setSeqWidth(seqW)
        let copiesNeeded = Math.ceil(containerWidth / seqW) + ANIMATION_CONFIG.COPY_HEADROOM
        copiesNeeded = Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded)
        setCopyCount(copiesNeeded)

        requestAnimationFrame(() => {
          const trackW = trackRef.current?.scrollWidth ?? 0
          if (trackW > 0 && trackW < containerWidth * 2) {
            const extra = Math.ceil((containerWidth * 2 - trackW) / seqW)
            if (extra > 0) setCopyCount((prev) => prev + extra)
          }
        })
      }
    }, [])

    useResizeObserver(updateDimensions, [containerRef as any, seqRef as any], [logos, gap, logoHeight])
    useImageLoader(seqRef as any, updateDimensions, [logos, gap, logoHeight])
    useAnimationLoop(trackRef, targetVelocity, seqWidth, isHovered, pauseOnHover)

    const cssVariables = useMemo(
      () => ({
        ['--logoloop-gap' as any]: `${gap}px`,
        ['--logoloop-logoHeight' as any]: `${logoHeight}px`,
        ...(fadeOutColor ? ({ ['--logoloop-fadeColor' as any]: fadeOutColor } as any) : {}),
      }),
      [gap, logoHeight, fadeOutColor],
    )

    const rootClassName = useMemo(
      () => ['logoloop', fadeOut && 'logoloop--fade', scaleOnHover && 'logoloop--scale-hover', className].filter(Boolean).join(' '),
      [fadeOut, scaleOnHover, className],
    )

    const handleMouseEnter = useCallback(() => {
      if (pauseOnHover) setIsHovered(true)
    }, [pauseOnHover])

    const handleMouseLeave = useCallback(() => {
      if (pauseOnHover) setIsHovered(false)
    }, [pauseOnHover])

    const renderLogoItem = useCallback(
      (item: LogoItem, key: string, itemIndex: number, useFallback?: boolean, eager?: boolean) => {
        const isNodeItem = (item as any).node !== undefined
        const scale = Number((item as any).scale ?? 1) || 1
        const scaleStyle = scale !== 1 ? ({ transform: `scale(${scale})`, transformOrigin: 'center' } as const) : undefined

        const content = isNodeItem ? (
          <span className="logoloop__node" style={scaleStyle} aria-hidden={!!(item as any).href && !(item as any).ariaLabel}>
            {(item as LogoNode).node}
          </span>
        ) : useFallback || broken[itemIndex] ? (
          <span className="logoloop__node" style={scaleStyle} aria-hidden>
            {(item as LogoImage).alt || (item as LogoImage).title || 'Logo'}
          </span>
        ) : (
          <img
            src={(item as LogoImage).src}
            srcSet={(item as LogoImage).srcSet}
            sizes={(item as LogoImage).sizes}
            width={(item as LogoImage).width}
            height={(item as LogoImage).height}
            alt={(item as LogoImage).alt ?? ''}
            title={(item as LogoImage).title}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            style={scaleStyle}
            onError={() => setBroken((prev) => ({ ...prev, [itemIndex]: true }))}
          />
        )

        const itemAriaLabel = isNodeItem
          ? (item as LogoNode).ariaLabel ?? (item as LogoNode).title
          : (item as LogoImage).alt ?? (item as LogoImage).title

        const href = (item as any).href
        const itemContent = href ? (
          <a className="logoloop__link" href={href} aria-label={itemAriaLabel || 'logo link'} target="_blank" rel="noreferrer noopener">
            {content}
          </a>
        ) : (
          content
        )

        return (
          <li className="logoloop__item" key={key} role="listitem">
            {itemContent}
          </li>
        )
      },
      [broken],
    )

    const logoLists = useMemo(
      () =>
        Array.from({ length: copyCount }, (_, copyIndex) => (
          <ul
            className="logoloop__list"
            key={`copy-${copyIndex}`}
            role="list"
            aria-hidden={copyIndex > 0}
            ref={copyIndex === 0 ? (seqRef as any) : undefined}
          >
            {logos.map((item, itemIndex) =>
              renderLogoItem(item, `${copyIndex}-${itemIndex}`, itemIndex, copyIndex > 0 ? broken[itemIndex] : false, copyIndex === 0),
            )}
          </ul>
        )),
      [broken, copyCount, logos, renderLogoItem],
    )

    const containerStyle = useMemo(
      () => ({
        width: toCssLength(width) ?? '100%',
        ...(cssVariables as any),
        ...style,
      }),
      [width, cssVariables, style],
    )

    return (
      <div
        ref={containerRef}
        className={rootClassName}
        style={containerStyle}
        role="region"
        aria-label={ariaLabel}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="logoloop__track" ref={trackRef}>
          {logoLists}
        </div>
        <div style={{ height: 1 }} />
      </div>
    )
  },
)

LogoLoop.displayName = 'LogoLoop'

export default LogoLoop
