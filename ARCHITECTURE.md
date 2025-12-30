# Time Auction - Architecture Documentation

## Overview

Time Auction is built on Cloudflare's edge infrastructure, using Durable Objects for real-time game state management and WebSocket communication.

## System Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│                 │     │         Cloudflare Edge              │
│   Browser       │     │                                      │
│   (React App)   │────▶│  ┌─────────────┐  ┌──────────────┐  │
│                 │     │  │   Worker    │──│  GameRoom DO │  │
│                 │◀────│  │   (Router)  │  │  (Per Table) │  │
│                 │     │  └─────────────┘  └──────────────┘  │
└─────────────────┘     │         │                 │         │
        ▲               │         ▼                 ▼         │
        │               │  ┌─────────────────────────────┐    │
        │               │  │     SQLite (Per DO)         │    │
        │               │  │   - Table settings          │    │
        │               │  │   - Player data             │    │
        │               │  │   - Round history           │    │
        │               │  └─────────────────────────────┘    │
        │               └──────────────────────────────────────┘
        │
        │ WebSocket (real-time game events)
        │ HTTP (table creation, info)
```

## Durable Objects

### GameRoom

One `GameRoom` Durable Object instance exists per game table. It handles:

- **WebSocket Management**: Accepts connections, tracks sessions, handles disconnects
- **Game State**: Lobby, rounds, bidding, scoring
- **Timing**: Server-authoritative timing for fair play
- **Persistence**: Automatically stores state to SQLite

#### State Structure

```typescript
interface TableState {
  tableId: string
  hostToken: string
  passwordHash: string | null
  settings: TableSettings
  status: 'lobby' | 'playing' | 'finished'
  hostId: string | null
  currentRound: number
  roundPhase: 'pre_round' | 'grace_period' | 'bidding' | 'resolution'
  phaseStartTime: number
  roundHistory: RoundResult[]
}

interface PlayerSession {
  id: string
  displayName: string
  reconnectToken: string
  isHost: boolean
  isReady: boolean
  isConnected: boolean
  timeRemainingMs: number
  victoryPoints: number
  lastWinRound: number | null
  bidStartTime: number | null
  bidEndTime: number | null
  currentBidMs: number
  hasReleasedThisRound: boolean
}
```

### Round State Machine

```
                    ┌─────────────┐
                    │   LOBBY     │
                    └──────┬──────┘
                           │ startGame
                           ▼
               ┌───────────────────────┐
               │      PRE_ROUND        │
               │   (3s countdown)      │
               └───────────┬───────────┘
                           │ alarm
                           ▼
               ┌───────────────────────┐
               │     GRACE_PERIOD      │
               │   (5s safe release)   │
               └───────────┬───────────┘
                           │ alarm
                           ▼
               ┌───────────────────────┐
               │       BIDDING         │
               │  (until all release)  │
               └───────────┬───────────┘
                           │ all released
                           ▼
               ┌───────────────────────┐
               │     RESOLUTION        │
               │   (5s show results)   │
               └───────────┬───────────┘
                           │ alarm
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │   PRE_ROUND     │      │    FINISHED     │
    │  (next round)   │      │  (game over)    │
    └─────────────────┘      └─────────────────┘
```

## WebSocket Protocol

### Message Types

#### Client → Server

| Type | Description | Payload |
|------|-------------|---------|
| `join` | Join table | `{ playerName, password?, reconnectToken? }` |
| `ready` | Toggle ready | `{ isReady }` |
| `startGame` | Start game (host) | `{}` |
| `bidStart` | Start bidding | `{ clientTimestamp }` |
| `bidEnd` | Stop bidding | `{ clientTimestamp }` |
| `kick` | Kick player (host) | `{ playerId }` |
| `ping` | Keepalive | `{}` |
| `leave` | Leave table | `{}` |

#### Server → Client

| Type | Description |
|------|-------------|
| `welcome` | Connection accepted |
| `error` | Error occurred |
| `lobbyState` | Full lobby state |
| `playerJoined` | Player joined |
| `playerLeft` | Player left |
| `playerReady` | Ready status changed |
| `playerKicked` | Player was kicked |
| `gameStarting` | Game starting countdown |
| `gameState` | Full game state |
| `roundStart` | Round starting |
| `roundActive` | Round active, bidding allowed |
| `graceExpired` | Grace period ended |
| `bidUpdate` | Player bid status changed |
| `roundEnd` | Round results |
| `gameEnd` | Final standings |
| `playerDisconnected` | Player disconnected |
| `playerReconnected` | Player reconnected |
| `pong` | Keepalive response |

## Timing & Fairness

### Server Authority

All timing calculations happen on the server to prevent cheating:

1. Client sends `bidStart` with their local timestamp
2. Server records its own timestamp
3. Latency is estimated as `min(|serverTime - clientTime|, 200ms)`
4. Bid duration is calculated server-side

### Grace Period

The 5-second grace period allows players to:
- Release without penalty
- Observe others' initial moves
- Make strategic decisions

### Tie Handling

Bids within 100ms of each other are considered a tie:
- No victory point awarded
- All participants still lose their bid time
- Prevents network advantage

## Frontend Architecture

### Component Hierarchy

```
App
├── GameProvider (Context)
│   ├── HomePage
│   │   ├── CreateTableForm
│   │   └── JoinTableForm
│   ├── LobbyPage
│   │   ├── PlayerList
│   │   ├── HostControls
│   │   └── ShareLink
│   └── GamePage
│       ├── BidButton
│       ├── PlayerBidStatus
│       ├── RoundResults (modal)
│       └── FinalResults
```

### State Management

Game state is managed via React Context + useReducer:

```typescript
interface GameContextState {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  playerId: string | null
  reconnectToken: string | null
  serverTimeOffset: number
  tableId: string | null
  settings: TableSettings | null
  hostId: string | null
  isHost: boolean
  players: Player[]
  gameState: GameState | null
  roundResults: RoundResult[]
  finalStandings: FinalStanding[] | null
}
```

### WebSocket Hook

The `useWebSocket` hook handles:
- Connection establishment
- Auto-reconnection with exponential backoff
- Message routing to callbacks
- Connection state tracking

## Security Considerations

| Threat | Mitigation |
|--------|------------|
| Bid timing manipulation | Server-authoritative timing |
| Multiple connections | New connection kicks old |
| Password brute force | SHA-256 hashing |
| Table ID guessing | 6-char alphanumeric (1B+ combinations) |
| Message flooding | Could add rate limiting |

## Scalability

### Current Limits

- **Players per table**: Configurable, 2-20
- **Concurrent tables**: Unlimited (each is separate DO)
- **Message size**: ~1KB typical

### Cloudflare Limits

- **DO requests**: 1000/second per DO
- **WebSocket messages**: Unlimited with Hibernation API
- **Storage**: 1GB per DO

## Data Flow Examples

### Creating a Table

```
Client                    Worker                    GameRoom DO
   │                        │                            │
   │─POST /api/tables─────▶│                            │
   │                        │──POST /init──────────────▶│
   │                        │                            │ Store settings
   │                        │◀─────────OK───────────────│
   │◀─{tableId, hostToken}──│                            │
```

### Joining and Bidding

```
Client                    Worker                    GameRoom DO
   │                        │                            │
   │─WebSocket upgrade────▶│                            │
   │                        │──Forward────────────────▶│
   │◀──────────────────────────────────Connection─────▶│
   │                        │                            │
   │─join{name}───────────────────────────────────────▶│
   │◀─welcome{playerId}────────────────────────────────│
   │◀─lobbyState{...}──────────────────────────────────│
   │                        │                            │
   │─bidStart{timestamp}──────────────────────────────▶│
   │◀─bidUpdate{...}───────────────────────────────────│
   │                        │                            │
   │─bidEnd{timestamp}────────────────────────────────▶│
   │◀─bidUpdate{...}───────────────────────────────────│
   │◀─roundEnd{results}────────────────────────────────│
```

## File Reference

### Backend (worker/)

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry, HTTP routes, CORS |
| `src/durable-objects/GameRoom.ts` | Main game logic DO |
| `wrangler.toml` | Cloudflare configuration |

### Frontend (frontend/)

| File | Purpose |
|------|---------|
| `src/App.tsx` | Router setup |
| `src/contexts/GameContext.tsx` | Global state |
| `src/hooks/useWebSocket.ts` | WS connection |
| `src/components/home/` | Create/Join flows |
| `src/components/lobby/` | Lobby UI |
| `src/components/game/` | Game UI |
| `src/components/results/` | Final results |

### Shared (shared/)

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces |
| `constants.ts` | Game constants |
| `index.ts` | Re-exports |
