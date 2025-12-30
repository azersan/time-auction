import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useGame } from '@/contexts/GameContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import BidButton from './BidButton'
import PlayerBidStatus from './PlayerBidStatus'
import RoundResults from './RoundResults'
import FinalResults from '../results/FinalResults'
import type { RoundResult } from '@shared/types'

export default function GamePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const { state, dispatch } = useGame()
  const [showRoundResults, setShowRoundResults] = useState(false)
  const [currentRoundResult, setCurrentRoundResult] = useState<RoundResult | null>(null)
  const [isBidding, setIsBidding] = useState(false)
  const [currentBidMs, setCurrentBidMs] = useState(0)
  const [graceExpired, setGraceExpired] = useState(false)

  const { sendMessage } = useWebSocket(tableId ?? null, {
    onMessage: (msg) => {
      if (msg.type === 'gameState') {
        dispatch({ type: 'SET_GAME_STATE', state: msg.state })
      } else if (msg.type === 'roundStart') {
        setShowRoundResults(false)
        setCurrentRoundResult(null)
        setIsBidding(false)
        setCurrentBidMs(0)
        setGraceExpired(false)
      } else if (msg.type === 'graceExpired') {
        setGraceExpired(true)
      } else if (msg.type === 'roundEnd') {
        setCurrentRoundResult(msg.results)
        dispatch({ type: 'ADD_ROUND_RESULT', result: msg.results })
        setShowRoundResults(true)
        setIsBidding(false)
      } else if (msg.type === 'gameEnd') {
        dispatch({ type: 'SET_FINAL_STANDINGS', standings: msg.standings })
      }
    },
  })

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
            Round {state.gameState?.currentRound ?? 1} of {state.gameState?.totalRounds ?? 10}
          </div>
        </div>

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
            disabled={state.gameState?.roundPhase !== 'grace_period' && state.gameState?.roundPhase !== 'bidding'}
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
