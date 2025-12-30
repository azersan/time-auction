import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { Player, TableSettings, GameState, RoundResult, FinalStanding } from '@shared/types'

interface GameContextState {
  // Connection
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  playerId: string | null
  reconnectToken: string | null
  serverTimeOffset: number

  // Table info
  tableId: string | null
  settings: TableSettings | null
  hostId: string | null
  isHost: boolean

  // Lobby
  players: Player[]

  // Game
  gameState: GameState | null
  roundResults: RoundResult[]
  finalStandings: FinalStanding[] | null
}

type GameAction =
  | { type: 'SET_CONNECTION_STATE'; state: GameContextState['connectionState'] }
  | { type: 'SET_PLAYER_INFO'; playerId: string; reconnectToken: string; serverTime: number }
  | { type: 'SET_TABLE_ID'; tableId: string }
  | { type: 'SET_LOBBY_STATE'; settings: TableSettings; players: Player[]; hostId: string }
  | { type: 'UPDATE_PLAYERS'; players: Player[] }
  | { type: 'SET_GAME_STATE'; state: GameState }
  | { type: 'ADD_ROUND_RESULT'; result: RoundResult }
  | { type: 'SET_FINAL_STANDINGS'; standings: FinalStanding[] }
  | { type: 'RESET' }

const initialState: GameContextState = {
  connectionState: 'disconnected',
  playerId: null,
  reconnectToken: null,
  serverTimeOffset: 0,
  tableId: null,
  settings: null,
  hostId: null,
  isHost: false,
  players: [],
  gameState: null,
  roundResults: [],
  finalStandings: null,
}

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.state }

    case 'SET_PLAYER_INFO':
      return {
        ...state,
        playerId: action.playerId,
        reconnectToken: action.reconnectToken,
        serverTimeOffset: action.serverTime - Date.now(),
      }

    case 'SET_TABLE_ID':
      return { ...state, tableId: action.tableId }

    case 'SET_LOBBY_STATE':
      return {
        ...state,
        settings: action.settings,
        players: action.players,
        hostId: action.hostId,
        isHost: action.hostId === state.playerId,
      }

    case 'UPDATE_PLAYERS':
      return {
        ...state,
        players: action.players,
        isHost: state.hostId === state.playerId,
      }

    case 'SET_GAME_STATE':
      return { ...state, gameState: action.state }

    case 'ADD_ROUND_RESULT':
      return { ...state, roundResults: [...state.roundResults, action.result] }

    case 'SET_FINAL_STANDINGS':
      return { ...state, finalStandings: action.standings }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

interface GameContextValue {
  state: GameContextState
  dispatch: React.Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
