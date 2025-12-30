import { useNavigate } from 'react-router-dom'
import type { FinalStanding } from '@shared/types'

interface Props {
  standings: FinalStanding[]
  currentPlayerId: string | null
}

export default function FinalResults({ standings, currentPlayerId }: Props) {
  const navigate = useNavigate()

  const getMedal = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold text-white text-center mb-2">Game Over!</h1>
        <p className="text-gray-400 text-center mb-8">Final Standings</p>

        <div className="space-y-3 mb-8">
          {standings.map((standing) => {
            const isCurrentPlayer = standing.playerId === currentPlayerId
            const isWinner = standing.rank === 1

            return (
              <div
                key={standing.playerId}
                className={`flex items-center p-4 rounded-lg ${
                  isWinner
                    ? 'bg-yellow-900/30 border-2 border-yellow-600'
                    : isCurrentPlayer
                      ? 'bg-indigo-900/30 border border-indigo-700'
                      : 'bg-gray-800'
                }`}
              >
                <div className="w-12 text-2xl text-center">
                  {getMedal(standing.rank) || `#${standing.rank}`}
                </div>

                <div className="flex-1 ml-3">
                  <div className={`font-semibold ${isCurrentPlayer ? 'text-indigo-300' : 'text-white'}`}>
                    {standing.displayName}
                    {isCurrentPlayer && ' (You)'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Last win: {standing.lastWinRound ? `Round ${standing.lastWinRound}` : 'None'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    {standing.victoryPoints} pts
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatTime(standing.timeRemainingMs)} left
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            New Game
          </button>
          <button
            onClick={() => {
              const text = standings
                .map(s => `${s.rank}. ${s.displayName}: ${s.victoryPoints} pts`)
                .join('\n')
              navigator.clipboard.writeText(`Time Auction Results:\n${text}`)
            }}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
          >
            Share Results
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
