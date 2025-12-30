import type { RoundResult } from '@shared/types'

interface Props {
  result: RoundResult
  onClose: () => void
}

export default function RoundResults({ result, onClose }: Props) {
  const sortedResults = [...result.playerResults].sort((a, b) => b.bidMs - a.bidMs)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-4">
          Round {result.roundNumber} Results
        </h2>

        {result.winnerId ? (
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-xl text-white font-semibold">{result.winnerName}</div>
            <div className="text-green-400">+1 Point</div>
            <div className="text-gray-400 text-sm mt-1">
              Winning bid: {formatTime(result.winningBidMs)}
            </div>
          </div>
        ) : (
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🤝</div>
            <div className="text-xl text-gray-400">
              {result.wasTie ? 'Tie - No Winner' : 'No Bids'}
            </div>
          </div>
        )}

        <div className="space-y-2 mb-6">
          <h3 className="text-sm font-medium text-gray-400">All Bids</h3>
          {sortedResults.map((playerResult) => (
            <div
              key={playerResult.playerId}
              className={`flex items-center justify-between p-2 rounded ${
                playerResult.playerId === result.winnerId
                  ? 'bg-green-900/30 border border-green-700/50'
                  : 'bg-gray-700/50'
              }`}
            >
              <span className="text-white">{playerResult.displayName}</span>
              <span className={playerResult.participated ? 'text-red-400' : 'text-gray-500'}>
                {playerResult.participated ? `-${formatTime(playerResult.bidMs)}` : 'Did not bid'}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
        >
          Continue
        </button>
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
