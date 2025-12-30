import type { Player } from '@shared/types'

interface Props {
  players: Player[]
  currentPlayerId: string | null
  hostId: string | null
}

export default function PlayerList({ players, currentPlayerId, hostId }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 mb-3">
        Players ({players.length})
      </h3>
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between p-3 rounded-lg ${
            player.id === currentPlayerId
              ? 'bg-indigo-900/50 border border-indigo-700'
              : 'bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                player.isConnected ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            <span className="text-white font-medium">
              {player.displayName}
              {player.id === currentPlayerId && ' (You)'}
            </span>
            {player.id === hostId && (
              <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {player.isReady ? (
              <span className="text-green-400 text-sm">Ready</span>
            ) : (
              <span className="text-gray-500 text-sm">Not Ready</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
