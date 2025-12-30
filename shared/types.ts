// ===== Game Configuration =====

export interface TableSettings {
  tableName: string;
  startingTimeMs: number;      // Default: 600000 (10 min)
  numRounds: number;           // Default: 10
  maxPlayers: number;          // Default: 8
  gracePeriodMs: number;       // Default: 5000 (5s)
  hasPassword: boolean;
}

export interface CreateTableRequest {
  name: string;
  password?: string;
  startingTimeSeconds: number;
  numRounds: number;
  maxPlayers: number;
  gracePeriodSeconds: number;
}

export interface CreateTableResponse {
  tableId: string;
  hostToken: string;
  joinUrl: string;
}

export interface TableInfo {
  tableId: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: TableStatus;
  hasPassword: boolean;
}

// ===== Player =====

export interface Player {
  id: string;
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  timeRemainingMs: number;
  victoryPoints: number;
  lastWinRound: number | null;
}

export interface PlayerBidStatus {
  playerId: string;
  isBidding: boolean;
  currentBidMs: number;
  hasReleasedThisRound: boolean;
}

// ===== Game State =====

export type TableStatus = 'lobby' | 'playing' | 'finished';

export type RoundPhase =
  | 'pre_round'      // Countdown before round starts
  | 'grace_period'   // Can release without penalty
  | 'bidding'        // Past grace period, bids count
  | 'resolution';    // Showing results

export interface GameState {
  status: TableStatus;
  currentRound: number;
  totalRounds: number;
  roundPhase: RoundPhase;
  phaseStartTime: number;      // Server timestamp
  phaseEndTime: number | null; // For countdowns
  players: Player[];
  playerBids: PlayerBidStatus[];
}

// ===== Round Results =====

export interface PlayerRoundResult {
  playerId: string;
  displayName: string;
  bidMs: number;
  participated: boolean;
}

export interface RoundResult {
  roundNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  winningBidMs: number;
  wasTie: boolean;
  playerResults: PlayerRoundResult[];
}

// ===== Final Results =====

export interface FinalStanding {
  rank: number;
  playerId: string;
  displayName: string;
  victoryPoints: number;
  timeRemainingMs: number;
  lastWinRound: number | null;
}

// ===== WebSocket Messages =====

// Client -> Server
export type ClientMessage =
  | { type: 'join'; playerName: string; password?: string; reconnectToken?: string }
  | { type: 'ready'; isReady: boolean }
  | { type: 'startGame' }
  | { type: 'bidStart'; clientTimestamp: number }
  | { type: 'bidEnd'; clientTimestamp: number }
  | { type: 'kick'; playerId: string }
  | { type: 'ping' }
  | { type: 'leave' };

// Server -> Client
export type ServerMessage =
  | { type: 'welcome'; playerId: string; reconnectToken: string; serverTime: number }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'lobbyState'; settings: TableSettings; players: Player[]; hostId: string }
  | { type: 'playerJoined'; player: Player }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReady'; playerId: string; isReady: boolean }
  | { type: 'playerKicked'; playerId: string }
  | { type: 'gameStarting'; countdown: number }
  | { type: 'gameState'; state: GameState }
  | { type: 'roundStart'; round: number; totalRounds: number; startsAt: number }
  | { type: 'roundActive'; gracePeriodEndsAt: number }
  | { type: 'graceExpired' }
  | { type: 'bidUpdate'; playerId: string; isBidding: boolean; currentBidMs: number }
  | { type: 'roundEnd'; results: RoundResult; nextRoundIn: number }
  | { type: 'gameEnd'; standings: FinalStanding[] }
  | { type: 'playerDisconnected'; playerId: string; reconnectDeadline: number }
  | { type: 'playerReconnected'; playerId: string }
  | { type: 'pong'; serverTime: number };

export type ErrorCode =
  | 'TABLE_NOT_FOUND'
  | 'TABLE_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'INVALID_PASSWORD'
  | 'NAME_TAKEN'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'PLAYERS_NOT_READY'
  | 'INVALID_ACTION'
  | 'RATE_LIMITED';
