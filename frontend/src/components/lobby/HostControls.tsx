import type { Player } from '@shared/types'

interface Props {
  players: Player[]
  currentPlayerId: string | null
  canStart: boolean
  onStartGame: () => void
  onKickPlayer: (playerId: string) => void
}

export default function HostControls({
  players,
  currentPlayerId,
  canStart,
  onStartGame,
  onKickPlayer,
}: Props) {
  const otherPlayers = players.filter(p => p.id !== currentPlayerId)

  return (
    <div className="mt-8 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Host Controls</h3>

      <button
        onClick={onStartGame}
        disabled={!canStart}
        className={`w-full py-3 px-6 font-semibold rounded-lg transition-colors mb-4 ${
          canStart
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {canStart ? 'Start Game' : 'Waiting for all players to be ready...'}
      </button>

      {otherPlayers.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-2">Kick player:</p>
          <div className="flex flex-wrap gap-2">
            {otherPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => onKickPlayer(player.id)}
                className="px-3 py-1 bg-red-900/50 hover:bg-red-800/50 border border-red-700 text-red-300 text-sm rounded transition-colors"
              >
                Kick {player.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
