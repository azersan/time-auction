import { useEffect, useRef, useCallback } from 'react'
import type { RoundPhase } from '@shared/types'

interface Props {
  onBidStart: () => void
  onBidEnd: () => void
  isHolding: boolean
  roundPhase: RoundPhase
  disabled: boolean
}

export default function BidButton({
  onBidStart,
  onBidEnd,
  isHolding,
  roundPhase,
  disabled,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isHoldingRef = useRef(false)

  const startHold = useCallback(() => {
    if (disabled || isHoldingRef.current) return
    isHoldingRef.current = true
    onBidStart()
  }, [disabled, onBidStart])

  const endHold = useCallback(() => {
    if (!isHoldingRef.current) return
    isHoldingRef.current = false
    onBidEnd()
  }, [onBidEnd])

  // Sync ref with prop
  useEffect(() => {
    isHoldingRef.current = isHolding
  }, [isHolding])

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startHold()
  }, [startHold])

  const handleMouseUp = useCallback(() => {
    endHold()
  }, [endHold])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    startHold()
  }, [startHold])

  const handleTouchEnd = useCallback(() => {
    endHold()
  }, [endHold])

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        startHold()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        endHold()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [startHold, endHold, handleMouseUp, handleTouchEnd])

  // Determine button state based on phase
  const getButtonStyle = () => {
    if (disabled) {
      return 'bg-gray-700 text-gray-500 cursor-not-allowed'
    }

    if (!isHolding) {
      return 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'
    }

    // Holding
    switch (roundPhase) {
      case 'waiting_for_holds':
        return 'bg-yellow-600 text-white scale-95'
      case 'grace_period':
        return 'bg-green-600 text-white scale-95'
      case 'bidding':
        return 'bg-red-600 text-white scale-95'
      default:
        return 'bg-indigo-600 text-white scale-95'
    }
  }

  const getButtonGlow = () => {
    if (!isHolding) return undefined

    switch (roundPhase) {
      case 'waiting_for_holds':
        return '0 0 30px rgba(234, 179, 8, 0.5)'
      case 'grace_period':
        return '0 0 30px rgba(34, 197, 94, 0.5)'
      case 'bidding':
        return '0 0 30px rgba(239, 68, 68, 0.5)'
      default:
        return undefined
    }
  }

  const getButtonText = () => {
    if (disabled) return 'Wait...'

    if (!isHolding) {
      return roundPhase === 'waiting_for_holds' ? 'HOLD TO JOIN' : 'HOLD'
    }

    switch (roundPhase) {
      case 'waiting_for_holds':
        return 'WAITING...'
      case 'grace_period':
        return 'SAFE'
      case 'bidding':
        return 'BIDDING'
      default:
        return 'HOLDING'
    }
  }

  const getHelpText = () => {
    if (disabled) return 'Waiting for round to start...'

    if (!isHolding) {
      return 'Hold the button or press Space/Enter'
    }

    switch (roundPhase) {
      case 'waiting_for_holds':
        return 'Keep holding until everyone is ready'
      case 'grace_period':
        return 'Release now to opt out (no time lost)'
      case 'bidding':
        return 'Release to lock in your bid!'
      default:
        return ''
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        disabled={disabled}
        className={`
          relative w-48 h-48 rounded-full font-bold text-xl
          transition-all duration-150 select-none
          ${getButtonStyle()}
        `}
        style={{ boxShadow: getButtonGlow() }}
      >
        <span className="relative z-10">{getButtonText()}</span>
      </button>

      <p className="mt-4 text-gray-400 text-sm text-center">
        {getHelpText()}
      </p>
    </div>
  )
}
