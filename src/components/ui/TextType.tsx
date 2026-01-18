import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'

import './TextType.css'

type VariableSpeed = { min: number; max: number }

type TextTypeProps<T extends keyof JSX.IntrinsicElements = 'div'> = Omit<JSX.IntrinsicElements[T], 'ref'> & {
  text: string | string[]
  as?: T
  typingSpeed?: number
  initialDelay?: number
  pauseDuration?: number
  deletingSpeed?: number
  loop?: boolean
  className?: string
  showCursor?: boolean
  hideCursorWhileTyping?: boolean
  cursorCharacter?: string
  cursorClassName?: string
  cursorBlinkDuration?: number
  textColors?: string[]
  variableSpeed?: VariableSpeed
  onSentenceComplete?: (sentence: string, index: number) => void
  startOnVisible?: boolean
  reverseMode?: boolean
}

export default function TextType<T extends keyof JSX.IntrinsicElements = 'div'>({
  text,
  as,
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}: TextTypeProps<T>) {
  const Component = (as ?? 'div') as T

  const [displayedText, setDisplayedText] = useState('')
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(!startOnVisible)

  const cursorRef = useRef<HTMLSpanElement | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text])

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed
    const min = Number(variableSpeed.min)
    const max = Number(variableSpeed.max)
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return typingSpeed
    return Math.random() * (max - min) + min
  }, [variableSpeed, typingSpeed])

  const getCurrentTextColor = () => {
    if (!textColors.length) return undefined
    return textColors[currentTextIndex % textColors.length]
  }

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return

    const el = containerRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true)
            break
          }
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnVisible])

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return

    gsap.set(cursorRef.current, { opacity: 1 })
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
    })

    return () => {
      tween.kill()
    }
  }, [showCursor, cursorBlinkDuration])

  useEffect(() => {
    if (!isVisible) return

    let timeoutId: number | undefined

    const currentText = String(textArray[currentTextIndex] ?? '')
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText

    const schedule = (fn: () => void, ms: number) => {
      timeoutId = window.setTimeout(fn, ms)
    }

    const execute = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false)

          if (currentTextIndex === textArray.length - 1 && !loop) return

          if (onSentenceComplete) {
            onSentenceComplete(textArray[currentTextIndex] ?? '', currentTextIndex)
          }

          setCurrentTextIndex((prev) => (prev + 1) % textArray.length)
          setCurrentCharIndex(0)
          schedule(() => {}, pauseDuration)
        } else {
          schedule(() => {
            setDisplayedText((prev) => prev.slice(0, -1))
          }, deletingSpeed)
        }
      } else {
        if (currentCharIndex < processedText.length) {
          schedule(
            () => {
              setDisplayedText((prev) => prev + processedText[currentCharIndex])
              setCurrentCharIndex((prev) => prev + 1)
            },
            variableSpeed ? getRandomSpeed() : typingSpeed,
          )
        } else if (textArray.length >= 1) {
          if (!loop && currentTextIndex === textArray.length - 1) return
          schedule(() => setIsDeleting(true), pauseDuration)
        }
      }
    }

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      schedule(execute, initialDelay)
    } else {
      execute()
    }

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
    getRandomSpeed,
  ])

  const shouldHideCursor =
    hideCursorWhileTyping && (currentCharIndex < String(textArray[currentTextIndex] ?? '').length || isDeleting)

  return createElement(
    Component,
    {
      ref: (node: any) => {
        containerRef.current = node
      },
      className: ['text-type', className].filter(Boolean).join(' '),
      ...props,
    },
    <span className="text-type__content" style={{ color: getCurrentTextColor() ?? 'inherit' }}>
      {displayedText}
    </span>,
    showCursor && (
      <span
        ref={cursorRef}
        className={['text-type__cursor', cursorClassName, shouldHideCursor ? 'text-type__cursor--hidden' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {cursorCharacter}
      </span>
    ),
  )
}
