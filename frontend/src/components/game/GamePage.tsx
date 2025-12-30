import { useEffect, useState, useCallback } from 'react'
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
  const [isBidding, setIsBidding] = useState(false)
  const [currentBidMs, setCurrentBidMs] = useState(0)
  const [graceExpired, setGraceExpired] = useState(false)
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('pre_round')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [hasReconnected, setHasReconnected] = useState(false)

  const { sendMessage, isConnected } = useWebSocket(tableId ?? null, {
    onMessage: (msg) => {
      if (msg.type === 'welcome') {
        dispatch({ type: 'SET_PLAYER_INFO', playerId: msg.playerId, reconnectToken: msg.reconnectToken, serverTime: msg.serverTime })
      } else if (msg.type === 'gameState') {
        dispatch({ type: 'SET_GAME_STATE', state: msg.state })
        setRoundPhase(msg.state.roundPhase)
        // Update players from game state
        dispatch({ type: 'UPDATE_PLAYERS', players: msg.state.players })
      } else if (msg.type === 'lobbyState') {
        dispatch({ type: 'SET_LOBBY_STATE', settings: msg.settings, players: msg.players, hostId: msg.hostId })
      } else if (msg.type === 'roundStart') {
        setShowRoundResults(false)
        setCurrentRoundResult(null)
        setIsBidding(false)
        setCurrentBidMs(0)
        setGraceExpired(false)
        setRoundPhase('pre_round')
        setCountdown(3)
      } else if (msg.type === 'roundActive') {
        setRoundPhase('grace_period')
        setCountdown(null)
      } else if (msg.type === 'graceExpired') {
        setGraceExpired(true)
        setRoundPhase('bidding')
      } else if (msg.type === 'roundEnd') {
        setCurrentRoundResult(msg.results)
        dispatch({ type: 'ADD_ROUND_RESULT', result: msg.results })
        setShowRoundResults(true)
        setIsBidding(false)
        setRoundPhase('resolution')
      } else if (msg.type === 'gameEnd') {
        dispatch({ type: 'SET_FINAL_STANDINGS', standings: msg.standings })
      } else if (msg.type === 'bidUpdate') {
        // Update game state with new bid info
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

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  const handleBidStart = useCallback(() => {
    setIsBidding(true)
    sendMessage({ type: 'bidStart', clientTimestamp: Date.now() })
  }, [sendMessage])

  const handleBidEnd = useCallback(() => {
    setIsBidding(false)
    sendMessage({ type: 'bidEnd', clientTimestamp: Date.now() })
  }, [sendMessage])

  // Update bid timer
  useEffect(() => {
    if (!isBidding) {
      setCurrentBidMs(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      setCurrentBidMs(Date.now() - startTime)
    }, 50)

    return () => clearInterval(interval)
  }, [isBidding])

  const currentPlayer = state.players.find(p => p.id === state.playerId)
  const gracePeriodMs = state.settings?.gracePeriodMs ?? 5000
  const canBid = roundPhase === 'grace_period' || roundPhase === 'bidding'

  if (state.finalStandings) {
    return <FinalResults standings={state.finalStandings} currentPlayerId={state.playerId} />
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

          <BidButton
            onBidStart={handleBidStart}
            onBidEnd={handleBidEnd}
            isBidding={isBidding}
            currentBidMs={currentBidMs}
            gracePeriodMs={gracePeriodMs}
            graceExpired={graceExpired}
            disabled={!canBid}
          />

          {isBidding && (
            <div className="text-center mt-4">
              <div className="text-sm text-gray-400">Current Bid</div>
              <div className="text-2xl font-mono text-white">{formatTime(currentBidMs)}</div>
              {!graceExpired && (
                <div className="text-green-400 text-sm mt-1">
                  Grace period - release now to cancel!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player status */}
        <PlayerBidStatus
          players={state.players}
          playerBids={state.gameState?.playerBids ?? []}
          currentPlayerId={state.playerId}
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
