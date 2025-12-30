import { useEffect, useRef, useCallback, useState } from 'react'
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
  const [toggleMode, setToggleMode] = useState(true) // Default to toggle mode

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

  // Handle click for toggle mode
  const handleClick = useCallback(() => {
    if (!toggleMode || disabled) return
    if (isHolding) {
      endHold()
    } else {
      startHold()
    }
  }, [toggleMode, disabled, isHolding, startHold, endHold])

  // Mouse events (hold mode only)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (toggleMode) return
    startHold()
  }, [toggleMode, startHold])

  const handleMouseUp = useCallback(() => {
    if (toggleMode) return
    endHold()
  }, [toggleMode, endHold])

  // Touch events (hold mode only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (toggleMode) return
    startHold()
  }, [toggleMode, startHold])

  const handleTouchEnd = useCallback(() => {
    if (toggleMode) return
    endHold()
  }, [toggleMode, endHold])

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (toggleMode) {
          // In toggle mode, key acts like a click
          if (isHolding) {
            endHold()
          } else if (!disabled) {
            startHold()
          }
        } else {
          startHold()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (!toggleMode) {
          endHold()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    if (!toggleMode) {
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [toggleMode, isHolding, disabled, startHold, endHold, handleMouseUp, handleTouchEnd])

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
      if (roundPhase === 'waiting_for_holds') {
        return toggleMode ? 'TAP TO JOIN' : 'HOLD TO JOIN'
      }
      return toggleMode ? 'TAP' : 'HOLD'
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

    const action = toggleMode ? 'Tap' : 'Hold'

    if (!isHolding) {
      return `${action} the button or press Space/Enter`
    }

    switch (roundPhase) {
      case 'waiting_for_holds':
        return toggleMode ? 'Tap again to leave, or wait for everyone' : 'Keep holding until everyone is ready'
      case 'grace_period':
        return toggleMode ? 'Tap to opt out (no time lost)' : 'Release to opt out (no time lost)'
      case 'bidding':
        return toggleMode ? 'Tap to lock in your bid!' : 'Release to lock in your bid!'
      default:
        return ''
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Mode toggle */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className={toggleMode ? 'text-gray-500' : 'text-white'}>Hold</span>
        <button
          onClick={() => setToggleMode(!toggleMode)}
          className="relative w-12 h-6 bg-gray-700 rounded-full transition-colors"
          aria-label="Toggle input mode"
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-indigo-500 rounded-full transition-all ${
              toggleMode ? 'left-7' : 'left-1'
            }`}
          />
        </button>
        <span className={toggleMode ? 'text-white' : 'text-gray-500'}>Toggle</span>
      </div>

      <button
        ref={buttonRef}
        onClick={handleClick}
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
