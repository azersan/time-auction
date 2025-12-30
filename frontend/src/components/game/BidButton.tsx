import { useEffect, useRef, useCallback } from 'react'

interface Props {
  onBidStart: () => void
  onBidEnd: () => void
  isBidding: boolean
  currentBidMs: number
  gracePeriodMs: number
  graceExpired: boolean
  disabled: boolean
}

export default function BidButton({
  onBidStart,
  onBidEnd,
  isBidding,
  currentBidMs,
  gracePeriodMs,
  graceExpired,
  disabled,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isHoldingRef = useRef(false)

  const startBid = useCallback(() => {
    if (disabled || isHoldingRef.current) return
    isHoldingRef.current = true
    onBidStart()
  }, [disabled, onBidStart])

  const endBid = useCallback(() => {
    if (!isHoldingRef.current) return
    isHoldingRef.current = false
    onBidEnd()
  }, [onBidEnd])

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startBid()
  }, [startBid])

  const handleMouseUp = useCallback(() => {
    endBid()
  }, [endBid])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    startBid()
  }, [startBid])

  const handleTouchEnd = useCallback(() => {
    endBid()
  }, [endBid])

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        startBid()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        endBid()
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
  }, [startBid, endBid, handleMouseUp, handleTouchEnd])

  // Calculate progress for visual feedback
  const progress = Math.min(currentBidMs / gracePeriodMs, 1)
  const inGracePeriod = !graceExpired && isBidding

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
          ${disabled
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : isBidding
              ? inGracePeriod
                ? 'bg-green-600 text-white scale-95'
                : 'bg-red-600 text-white scale-95'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'
          }
        `}
        style={{
          boxShadow: isBidding
            ? inGracePeriod
              ? '0 0 30px rgba(34, 197, 94, 0.5)'
              : '0 0 30px rgba(239, 68, 68, 0.5)'
            : undefined,
        }}
      >
        {/* Progress ring for grace period */}
        {isBidding && inGracePeriod && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray={`${progress * 289} 289`}
              strokeLinecap="round"
            />
          </svg>
        )}

        <span className="relative z-10">
          {disabled
            ? 'Wait...'
            : isBidding
              ? inGracePeriod
                ? 'SAFE'
                : 'BIDDING'
              : 'HOLD TO BID'
          }
        </span>
      </button>

      <p className="mt-4 text-gray-400 text-sm text-center">
        {disabled
          ? 'Waiting for round to start...'
          : isBidding
            ? inGracePeriod
              ? 'Release now to cancel bid!'
              : 'Bidding in progress - release to submit'
            : 'Hold the button or press Space/Enter'
        }
      </p>
    </div>
  )
}
