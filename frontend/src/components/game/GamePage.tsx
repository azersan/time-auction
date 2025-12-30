import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useGame } from '@/contexts/GameContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import BidButton from './BidButton'
import PlayerBidStatus from './PlayerBidStatus'
import RoundResults from './RoundResults'
import FinalResults from '../results/FinalResults'
import type { RoundResult, RoundPhase } from '@shared/types'

function getStoredSession(tableId: string) {
  try {
    const stored = sessionStorage.getItem(`session_${tableId}`)
    if (stored) {
      return JSON.parse(stored) as { playerName: string; reconnectToken: string }
    }
  } catch {}
  return null
}

export default function GamePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const { state, dispatch } = useGame()
  const [showRoundResults, setShowRoundResults] = useState(false)
  const [currentRoundResult, setCurrentRoundResult] = useState<RoundResult | null>(null)
  const [isHolding, setIsHolding] = useState(false)
  const [currentBidMs, setCurrentBidMs] = useState(0)
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('pre_round')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null)
  const [hasReconnected, setHasReconnected] = useState(false)
  const [playersHolding, setPlayersHolding] = useState<Set<string>>(new Set())
  const holdStartTimeRef = useRef<number | null>(null)

  const { sendMessage, isConnected } = useWebSocket(tableId ?? null, {
    onMessage: (msg) => {
      if (msg.type === 'welcome') {
        dispatch({ type: 'SET_PLAYER_INFO', playerId: msg.playerId, reconnectToken: msg.reconnectToken, serverTime: msg.serverTime })
      } else if (msg.type === 'gameState') {
        dispatch({ type: 'SET_GAME_STATE', state: msg.state })
        setRoundPhase(msg.state.roundPhase)
        dispatch({ type: 'UPDATE_PLAYERS', players: msg.state.players })
      } else if (msg.type === 'lobbyState') {
        dispatch({ type: 'SET_LOBBY_STATE', settings: msg.settings, players: msg.players, hostId: msg.hostId })
      } else if (msg.type === 'roundStart') {
        setShowRoundResults(false)
        setCurrentRoundResult(null)
        setIsHolding(false)
        setCurrentBidMs(0)
        setRoundPhase('pre_round')
        setCountdown(3)
        setGraceCountdown(null)
        setPlayersHolding(new Set())
        holdStartTimeRef.current = null
      } else if (msg.type === 'allPlayersHolding') {
        // All players are holding, grace period started
        setRoundPhase('grace_period')
        setCountdown(null)
        // Start grace period countdown
        const graceDuration = msg.gracePeriodEndsAt - Date.now()
        setGraceCountdown(Math.ceil(graceDuration / 1000))
      } else if (msg.type === 'graceExpired') {
        setRoundPhase('bidding')
        setGraceCountdown(null)
        // Now time starts counting for real
        if (isHolding) {
          holdStartTimeRef.current = Date.now()
        }
      } else if (msg.type === 'playerHoldingUpdate') {
        setPlayersHolding(prev => {
          const next = new Set(prev)
          if (msg.isHolding) {
            next.add(msg.playerId)
          } else {
            next.delete(msg.playerId)
          }
          return next
        })
      } else if (msg.type === 'bidUpdate') {
        // Player released their bid
        setPlayersHolding(prev => {
          const next = new Set(prev)
          next.delete(msg.playerId)
          return next
        })
      } else if (msg.type === 'roundEnd') {
        setCurrentRoundResult(msg.results)
        dispatch({ type: 'ADD_ROUND_RESULT', result: msg.results })
        setShowRoundResults(true)
        setIsHolding(false)
        setRoundPhase('resolution')
        holdStartTimeRef.current = null
      } else if (msg.type === 'gameEnd') {
        dispatch({ type: 'SET_FINAL_STANDINGS', standings: msg.standings })
      }
    },
  })

  // Auto-reconnect with stored session
  useEffect(() => {
    if (isConnected && tableId && !hasReconnected) {
      const storedSession = getStoredSession(tableId)
      if (storedSession) {
        setHasReconnected(true)
        sendMessage({
          type: 'join',
          playerName: storedSession.playerName,
          reconnectToken: storedSession.reconnectToken,
        })
      }
    }
  }, [isConnected, tableId, hasReconnected, sendMessage])

  // Pre-round countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  // Grace period countdown timer
  useEffect(() => {
    if (graceCountdown === null || graceCountdown <= 0) return

    const timer = setTimeout(() => {
      setGraceCountdown(graceCountdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [graceCountdown])

  const handleHoldStart = useCallback(() => {
    setIsHolding(true)
    sendMessage({ type: 'bidStart', clientTimestamp: Date.now() })
  }, [sendMessage])

  const handleHoldEnd = useCallback(() => {
    setIsHolding(false)
    holdStartTimeRef.current = null
    sendMessage({ type: 'bidEnd', clientTimestamp: Date.now() })
  }, [sendMessage])

  // Update bid timer (only counts during bidding phase)
  useEffect(() => {
    if (!isHolding || roundPhase !== 'bidding') {
      if (roundPhase !== 'bidding') {
        setCurrentBidMs(0)
      }
      return
    }

    // Start tracking from when bidding phase began
    if (!holdStartTimeRef.current) {
      holdStartTimeRef.current = Date.now()
    }

    const interval = setInterval(() => {
      if (holdStartTimeRef.current) {
        setCurrentBidMs(Date.now() - holdStartTimeRef.current)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [isHolding, roundPhase])

  const currentPlayer = state.players.find(p => p.id === state.playerId)
  const canHold = roundPhase === 'waiting_for_holds' || roundPhase === 'grace_period' || roundPhase === 'bidding'
  const hasReleased = roundPhase === 'bidding' && !isHolding && playersHolding.size < state.players.filter(p => p.isConnected).length

  if (state.finalStandings) {
    return <FinalResults standings={state.finalStandings} currentPlayerId={state.playerId} />
  }

  // Determine phase status message
  const getPhaseMessage = () => {
    switch (roundPhase) {
      case 'pre_round':
        return 'Get ready...'
      case 'waiting_for_holds':
        return `Hold your button to participate (${playersHolding.size}/${state.players.filter(p => p.isConnected).length} holding)`
      case 'grace_period':
        return graceCountdown !== null ? `Grace period: ${graceCountdown}s - release to opt out` : 'Grace period...'
      case 'bidding':
        return 'BIDDING! Release to lock in your bid'
      case 'resolution':
        return 'Round complete'
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Time Auction</h1>
          <div className="text-gray-400">
            Round {state.gameState?.currentRound ?? 1} of {state.gameState?.totalRounds ?? state.settings?.numRounds ?? 10}
          </div>
        </div>

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-8xl font-bold text-white mb-4">{countdown}</div>
              <div className="text-2xl text-gray-300">Get ready!</div>
            </div>
          </div>
        )}

        {/* Main game area */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-gray-400 text-sm mb-1">Your Time Bank</div>
            <div className="text-4xl font-mono font-bold text-white">
              {formatTime(currentPlayer?.timeRemainingMs ?? 0)}
            </div>
          </div>

          {/* Phase status */}
          <div className={`text-center mb-4 text-lg font-semibold ${
            roundPhase === 'bidding' ? 'text-red-400' :
            roundPhase === 'grace_period' ? 'text-green-400' :
            roundPhase === 'waiting_for_holds' ? 'text-yellow-400' :
            'text-gray-400'
          }`}>
            {getPhaseMessage()}
          </div>

          <BidButton
            onBidStart={handleHoldStart}
            onBidEnd={handleHoldEnd}
            isHolding={isHolding}
            roundPhase={roundPhase}
            disabled={!canHold || hasReleased}
          />

          {isHolding && roundPhase === 'bidding' && (
            <div className="text-center mt-4">
              <div className="text-sm text-gray-400">Current Bid</div>
              <div className="text-2xl font-mono text-red-400">{formatTime(currentBidMs)}</div>
            </div>
          )}

          {hasReleased && (
            <div className="text-center mt-4 text-gray-400">
              You've submitted your bid. Waiting for others...
            </div>
          )}
        </div>

        {/* Player status */}
        <PlayerBidStatus
          players={state.players}
          playerBids={state.gameState?.playerBids ?? []}
          currentPlayerId={state.playerId}
          playersHolding={playersHolding}
        />

        {/* Round results modal */}
        {showRoundResults && currentRoundResult && (
          <RoundResults
            result={currentRoundResult}
            onClose={() => setShowRoundResults(false)}
          />
        )}
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}
