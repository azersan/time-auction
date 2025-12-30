import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '@/contexts/GameContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import PlayerList from './PlayerList'
import HostControls from './HostControls'

export default function LobbyPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = useGame()
  const [playerName, setPlayerName] = useState('')
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const { sendMessage, isConnected } = useWebSocket(tableId ?? null, {
    onMessage: (msg) => {
      if (msg.type === 'welcome') {
        dispatch({ type: 'SET_PLAYER_INFO', playerId: msg.playerId, reconnectToken: msg.reconnectToken, serverTime: msg.serverTime })
        setHasJoined(true)
      } else if (msg.type === 'lobbyState') {
        dispatch({ type: 'SET_LOBBY_STATE', settings: msg.settings, players: msg.players, hostId: msg.hostId })
      } else if (msg.type === 'playerJoined') {
        dispatch({ type: 'PLAYER_JOINED', player: msg.player })
      } else if (msg.type === 'playerLeft') {
        dispatch({ type: 'PLAYER_LEFT', playerId: msg.playerId })
      } else if (msg.type === 'playerReady') {
        dispatch({ type: 'PLAYER_READY', playerId: msg.playerId, isReady: msg.isReady })
      } else if (msg.type === 'gameStarting') {
        // Redirect to game page
        navigate(`/game/${tableId}/play`)
      } else if (msg.type === 'error') {
        if (msg.code === 'INVALID_PASSWORD') {
          setNeedsPassword(true)
          setJoinError('Invalid password')
        } else {
          setJoinError(msg.message)
        }
      }
    },
    onConnect: () => {
      dispatch({ type: 'SET_CONNECTION_STATE', state: 'connected' })
    },
    onDisconnect: () => {
      dispatch({ type: 'SET_CONNECTION_STATE', state: 'disconnected' })
    },
  })

  useEffect(() => {
    if (tableId) {
      dispatch({ type: 'SET_TABLE_ID', tableId })
    }
  }, [tableId, dispatch])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)

    if (!playerName.trim()) {
      setJoinError('Please enter your name')
      return
    }

    sendMessage({
      type: 'join',
      playerName: playerName.trim(),
      password: password || undefined,
    })
  }

  const handleReady = () => {
    const currentPlayer = state.players.find(p => p.id === state.playerId)
    if (currentPlayer) {
      sendMessage({ type: 'ready', isReady: !currentPlayer.isReady })
    }
  }

  const handleStartGame = () => {
    sendMessage({ type: 'startGame' })
  }

  const handleKickPlayer = (playerId: string) => {
    sendMessage({ type: 'kick', playerId })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-white mb-2">Join Game</h2>
          <p className="text-gray-400 mb-6">Table: {tableId}</p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="Enter your display name"
                maxLength={20}
                autoFocus
                required
              />
            </div>

            {needsPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Enter table password"
                />
              </div>
            )}

            {joinError && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={!isConnected}
              className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isConnected ? 'Join Game' : 'Connecting...'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const currentPlayer = state.players.find(p => p.id === state.playerId)
  const allReady = state.players.length >= 2 && state.players.every(p => p.isReady)

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{state.settings?.tableName}</h1>
            <p className="text-gray-400">Waiting for players...</p>
          </div>
          <button
            onClick={copyLink}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Copy Link
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Game Settings</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Starting Time: <span className="text-white">{state.settings ? Math.floor(state.settings.startingTimeMs / 1000) : 0}s</span></div>
            <div>Rounds: <span className="text-white">{state.settings?.numRounds}</span></div>
            <div>Max Players: <span className="text-white">{state.settings?.maxPlayers}</span></div>
            <div>Grace Period: <span className="text-white">{state.settings ? state.settings.gracePeriodMs / 1000 : 0}s</span></div>
          </div>
        </div>

        <PlayerList
          players={state.players}
          currentPlayerId={state.playerId}
          hostId={state.hostId}
        />

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleReady}
            className={`flex-1 py-3 px-6 font-semibold rounded-lg transition-colors ${
              currentPlayer?.isReady
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {currentPlayer?.isReady ? 'Ready!' : 'Click when Ready'}
          </button>
        </div>

        {state.isHost && (
          <HostControls
            players={state.players}
            currentPlayerId={state.playerId}
            canStart={allReady}
            onStartGame={handleStartGame}
            onKickPlayer={handleKickPlayer}
          />
        )}
      </div>
    </div>
  )
}
