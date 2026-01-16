import React, { Children, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import './Stepper.css'

export type StepperRenderStepIndicatorArgs = {
  step: number
  currentStep: number
  onStepClick: (clicked: number) => void
}

export type StepperProps = {
  children: React.ReactNode
  initialStep?: number
  onStepChange?: (step: number) => void
  onFinalStepCompleted?: () => void
  className?: string
  stepCircleContainerClassName?: string
  stepContainerClassName?: string
  contentClassName?: string
  footerClassName?: string
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  backButtonText?: string
  nextButtonText?: string
  disableStepIndicators?: boolean
  renderStepIndicator?: (args: StepperRenderStepIndicatorArgs) => React.ReactNode

  // Modal layout
  isOpen?: boolean
  onRequestClose?: () => void
  useModalLayout?: boolean
  overlayClassName?: string
  modalContainerClassName?: string
  modalTitle?: string
  modalDescription?: string
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  className = '',
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  isOpen = true,
  onRequestClose,
  useModalLayout = false,
  overlayClassName = '',
  modalContainerClassName = '',
  modalTitle = '',
  modalDescription = '',
  ...rest
}: StepperProps & React.HTMLAttributes<HTMLDivElement>) {
  if (!isOpen) return null

  useEffect(() => {
    if (!useModalLayout) return
    if (typeof document === 'undefined') return

    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [useModalLayout])

  const [currentStep, setCurrentStep] = useState(initialStep)
  const [direction, setDirection] = useState(0)
  const stepsArray = Children.toArray(children)
  const totalSteps = stepsArray.length
  const isCompleted = currentStep > totalSteps
  const isLastStep = currentStep === totalSteps

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep)
    if (newStep > totalSteps) {
      onFinalStepCompleted()
    } else {
      onStepChange(newStep)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1)
      updateStep(currentStep - 1)
    }
  }

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1)
      updateStep(currentStep + 1)
    }
  }

  const handleComplete = () => {
    setDirection(1)
    updateStep(totalSteps + 1)
  }

  const rootClassName = ['outer-container', className].filter(Boolean).join(' ')
  const hasModalHeader = (modalTitle || modalDescription) && useModalLayout

  const content = (
    <div className={rootClassName} {...rest}>
      {hasModalHeader && (
        <div className="stepper-modal-header">
          {modalTitle && <h3 className="stepper-modal-title">{modalTitle}</h3>}
          {modalDescription && <p className="stepper-modal-description">{modalDescription}</p>}
        </div>
      )}

      <div className={`step-circle-container ${stepCircleContainerClassName}`.trim()}>
        <div className={`step-indicator-row ${stepContainerClassName}`.trim()}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1
            const isNotLastStep = index < totalSteps - 1
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: (clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1)
                      updateStep(clicked)
                    },
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={(clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1)
                      updateStep(clicked)
                    }}
                  />
                )}

                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            )
          })}
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={`step-content-default ${contentClassName}`.trim()}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div className={`footer-container ${footerClassName}`.trim()}>
            <div className={`footer-nav ${currentStep !== 1 ? 'spread' : 'end'}`.trim()}>
              {currentStep !== 1 && (
                <button onClick={handleBack} className={`back-button ${currentStep === 1 ? 'inactive' : ''}`.trim()} {...backButtonProps}>
                  {backButtonText}
                </button>
              )}

              <button onClick={isLastStep ? handleComplete : handleNext} className="next-button" {...nextButtonProps}>
                {isLastStep ? 'Complete' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (!useModalLayout) return content

  const overlayClasses = ['stepper-overlay', overlayClassName].filter(Boolean).join(' ')
  const containerClasses = ['stepper-modal-container', modalContainerClassName].filter(Boolean).join(' ')
  const handleRequestClose = typeof onRequestClose === 'function' ? onRequestClose : undefined

  return (
    <div className={overlayClasses}>
      <div className={containerClasses}>
        {handleRequestClose && (
          <button type="button" className="stepper-close" onClick={handleRequestClose} aria-label="Cerrar">
            ×
          </button>
        )}
        {content}
      </div>
      {handleRequestClose && (
        <button type="button" className="stepper-overlay-dismiss" onClick={handleRequestClose} aria-label="Cerrar" />
      )}
    </div>
  )
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className,
}: {
  isCompleted: boolean
  currentStep: number
  direction: number
  children: React.ReactNode
  className?: string
}) {
  const [parentHeight, setParentHeight] = useState(0)

  return (
    <motion.div
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={(h) => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SlideTransition({
  children,
  direction,
  onHeightReady,
}: {
  children: React.ReactNode
  direction: number
  onHeightReady: (height: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (containerRef.current) onHeightReady(containerRef.current.offsetHeight)
  }, [children, onHeightReady])

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  )
}

const stepVariants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? '-100%' : '100%',
    opacity: 0,
  }),
  center: {
    x: '0%',
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? '50%' : '-50%',
    opacity: 0,
  }),
}

export function Step({ children }: { children: React.ReactNode }) {
  return <div className="step-default">{children}</div>
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators,
}: {
  step: number
  currentStep: number
  onClickStep: (step: number) => void
  disableStepIndicators: boolean
}) {
  const status: 'active' | 'inactive' | 'complete' = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete'

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) onClickStep(step)
  }

  return (
    <motion.div onClick={handleClick} className="step-indicator" animate={status} initial={false}>
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: '#222', color: '#a3a3a3' },
          active: { scale: 1, backgroundColor: '#5227FF', color: '#5227FF' },
          complete: { scale: 1, backgroundColor: '#5227FF', color: '#3b82f6' },
        }}
        transition={{ duration: 0.3 }}
        className="step-indicator-inner"
      >
        {status === 'complete' ? <CheckIcon className="check-icon" /> : status === 'active' ? <div className="active-dot" /> : <span className="step-number">{step}</span>}
      </motion.div>
    </motion.div>
  )
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  const lineVariants = {
    incomplete: { width: 0, backgroundColor: 'rgba(82, 39, 255, 0)' },
    complete: { width: '100%', backgroundColor: '#5227FF' },
  }

  return (
    <div className="step-connector">
      <motion.div
        className="step-connector-inner"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}
