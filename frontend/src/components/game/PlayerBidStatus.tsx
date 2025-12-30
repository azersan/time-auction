import type { Player, PlayerBidStatus as BidStatus } from '@shared/types'

interface Props {
  players: Player[]
  playerBids: BidStatus[]
  currentPlayerId: string | null
}

export default function PlayerBidStatus({ players, playerBids, currentPlayerId }: Props) {
  const getBidStatus = (playerId: string): BidStatus | undefined => {
    return playerBids.find(b => b.playerId === playerId)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Players</h3>
      <div className="space-y-2">
        {players.map((player) => {
          const bidStatus = getBidStatus(player.id)
          const isCurrentPlayer = player.id === currentPlayerId

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isCurrentPlayer
                  ? 'bg-indigo-900/30 border border-indigo-700/50'
                  : 'bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full ${
                  bidStatus?.isBidding
                    ? 'bg-yellow-500 animate-pulse'
                    : bidStatus?.hasReleasedThisRound
                      ? 'bg-gray-500'
                      : 'bg-green-500'
                }`} />

                <span className={`font-medium ${isCurrentPlayer ? 'text-indigo-300' : 'text-white'}`}>
                  {player.displayName}
                  {isCurrentPlayer && ' (You)'}
                </span>

                {player.isHost && (
                  <span className="text-xs bg-yellow-600/50 text-yellow-300 px-1.5 py-0.5 rounded">
                    Host
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                {/* Points */}
                <div className="text-center">
                  <div className="text-gray-500 text-xs">Points</div>
                  <div className="text-white font-mono">{player.victoryPoints}</div>
                </div>

                {/* Time Bank */}
                <div className="text-center">
                  <div className="text-gray-500 text-xs">Bank</div>
                  <div className="text-white font-mono">{formatTimeShort(player.timeRemainingMs)}</div>
                </div>

                {/* Current bid status */}
                <div className="w-20 text-right">
                  {bidStatus?.isBidding ? (
                    <span className="text-yellow-400">Bidding...</span>
                  ) : bidStatus?.hasReleasedThisRound ? (
                    <span className="text-gray-500">Released</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTimeShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
