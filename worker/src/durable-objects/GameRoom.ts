import type {
  TableSettings,
  Player,
  GameState,
  PlayerBidStatus,
  RoundResult,
  FinalStanding,
  ClientMessage,
  ServerMessage,
  ErrorCode,
} from '../../../shared/types'
import {
  TIE_THRESHOLD_MS,
  PRE_ROUND_COUNTDOWN_MS,
  ROUND_RESULTS_DISPLAY_MS,
  RECONNECT_WINDOW_MS,
  MAX_LATENCY_COMPENSATION_MS,
} from '../../../shared/constants'

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

export class GameRoom implements DurableObject {
  private state: DurableObjectState
  private players: Map<string, PlayerSession> = new Map()
  private tableState: TableState | null = null
  private initialized = false

  constructor(state: DurableObjectState) {
    this.state = state
  }

  // Get player session from WebSocket using attachment (survives hibernation)
  private getSessionFromWs(ws: WebSocket): PlayerSession | null {
    const attachment = ws.deserializeAttachment() as { playerId: string } | null
    if (!attachment?.playerId) return null
    return this.players.get(attachment.playerId) ?? null
  }

  // Set player ID on WebSocket attachment
  private setWsPlayerId(ws: WebSocket, playerId: string): void {
    ws.serializeAttachment({ playerId })
  }

  private async loadState(): Promise<void> {
    if (this.initialized) return

    const stored = await this.state.storage.get<TableState>('tableState')
    if (stored) {
      this.tableState = stored
    }

    const storedPlayers = await this.state.storage.get<PlayerSession[]>('players')
    if (storedPlayers) {
      for (const p of storedPlayers) {
        p.isConnected = false
        this.players.set(p.id, p)
      }
    }

    this.initialized = true
  }

  private async saveState(): Promise<void> {
    if (this.tableState) {
      await this.state.storage.put('tableState', this.tableState)
    }
    await this.state.storage.put('players', Array.from(this.players.values()))
  }

  async fetch(request: Request): Promise<Response> {
    await this.loadState()

    const url = new URL(request.url)

    // Internal init endpoint
    if (url.pathname === '/init' && request.method === 'POST') {
      const data = await request.json() as {
        tableId: string
        hostToken: string
        passwordHash: string | null
        settings: TableSettings
      }

      this.tableState = {
        tableId: data.tableId,
        hostToken: data.hostToken,
        passwordHash: data.passwordHash,
        settings: data.settings,
        status: 'lobby',
        hostId: null,
        currentRound: 0,
        roundPhase: 'pre_round',
        phaseStartTime: Date.now(),
        roundHistory: [],
      }

      await this.saveState()
      return new Response('OK')
    }

    // Internal info endpoint
    if (url.pathname === '/info' && request.method === 'GET') {
      if (!this.tableState) {
        return new Response('Not found', { status: 404 })
      }

      return Response.json({
        tableId: this.tableState.tableId,
        name: this.tableState.settings.tableName,
        playerCount: this.players.size,
        maxPlayers: this.tableState.settings.maxPlayers,
        status: this.tableState.status,
        hasPassword: this.tableState.settings.hasPassword,
      })
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      // Accept without tags initially - we'll tag after join
      this.state.acceptWebSocket(server)

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.loadState()

    if (!this.tableState) {
      this.sendError(ws, 'TABLE_NOT_FOUND', 'Table does not exist')
      return
    }

    try {
      const msg = JSON.parse(message as string) as ClientMessage
      await this.handleMessage(ws, msg)
    } catch (err) {
      console.error('Error handling message:', err)
      this.sendError(ws, 'INVALID_ACTION', 'Invalid message')
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.loadState()

    const session = this.getSessionFromWs(ws)
    if (session) {
      session.isConnected = false

      // Broadcast disconnection
      this.broadcast({
        type: 'playerDisconnected',
        playerId: session.id,
        reconnectDeadline: Date.now() + RECONNECT_WINDOW_MS,
      })

      // Schedule cleanup after reconnect window
      await this.state.storage.setAlarm(Date.now() + RECONNECT_WINDOW_MS)
      await this.saveState()
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  async alarm(): Promise<void> {
    await this.loadState()

    if (!this.tableState) return

    // Handle round phase transitions
    if (this.tableState.status === 'playing') {
      const now = Date.now()

      if (this.tableState.roundPhase === 'pre_round') {
        // Pre-round countdown finished, start grace period
        this.tableState.roundPhase = 'grace_period'
        this.tableState.phaseStartTime = now

        this.broadcast({
          type: 'roundActive',
          gracePeriodEndsAt: now + this.tableState.settings.gracePeriodMs,
        })

        // Schedule grace period end
        await this.state.storage.setAlarm(now + this.tableState.settings.gracePeriodMs)
      } else if (this.tableState.roundPhase === 'grace_period') {
        // Grace period ended
        this.tableState.roundPhase = 'bidding'

        this.broadcast({ type: 'graceExpired' })

        // Check if all players have released
        this.checkRoundEnd()
      } else if (this.tableState.roundPhase === 'resolution') {
        // Resolution phase finished, start next round or end game
        if (this.tableState.currentRound >= this.tableState.settings.numRounds) {
          await this.endGame()
        } else {
          await this.startNextRound()
        }
      }

      await this.saveState()
    }

    // Clean up disconnected players after reconnect window
    for (const [playerId, player] of this.players) {
      if (!player.isConnected && this.tableState.status === 'lobby') {
        this.players.delete(playerId)
        this.broadcast({ type: 'playerLeft', playerId })
      }
    }

    // Assign new host if needed
    if (!this.tableState.hostId || !this.players.has(this.tableState.hostId)) {
      const firstPlayer = Array.from(this.players.values()).find(p => p.isConnected)
      if (firstPlayer) {
        this.tableState.hostId = firstPlayer.id
        firstPlayer.isHost = true
        this.broadcastLobbyState()
      }
    }

    await this.saveState()
  }

  private async handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'join':
        await this.handleJoin(ws, msg.playerName, msg.password, msg.reconnectToken)
        break
      case 'ready':
        await this.handleReady(ws, msg.isReady)
        break
      case 'startGame':
        await this.handleStartGame(ws)
        break
      case 'bidStart':
        await this.handleBidStart(ws, msg.clientTimestamp)
        break
      case 'bidEnd':
        await this.handleBidEnd(ws, msg.clientTimestamp)
        break
      case 'kick':
        await this.handleKick(ws, msg.playerId)
        break
      case 'ping':
        this.send(ws, { type: 'pong', serverTime: Date.now() })
        break
      case 'leave':
        await this.handleLeave(ws)
        break
    }
  }

  private async handleJoin(
    ws: WebSocket,
    playerName: string,
    password?: string,
    reconnectToken?: string
  ): Promise<void> {
    if (!this.tableState) return

    // Check password
    if (this.tableState.passwordHash) {
      if (!password) {
        this.sendError(ws, 'INVALID_PASSWORD', 'Password required')
        return
      }
      const hash = await this.hashPassword(password)
      if (hash !== this.tableState.passwordHash) {
        this.sendError(ws, 'INVALID_PASSWORD', 'Invalid password')
        return
      }
    }

    // Check for reconnection
    if (reconnectToken) {
      for (const [playerId, player] of this.players) {
        if (player.reconnectToken === reconnectToken) {
          player.isConnected = true
          this.setWsPlayerId(ws, player.id)

          this.send(ws, {
            type: 'welcome',
            playerId: player.id,
            reconnectToken: player.reconnectToken,
            serverTime: Date.now(),
          })

          this.broadcast({ type: 'playerReconnected', playerId })
          this.sendCurrentState(ws)
          await this.saveState()
          return
        }
      }
    }

    // Check if game already started
    if (this.tableState.status !== 'lobby') {
      this.sendError(ws, 'GAME_ALREADY_STARTED', 'Game has already started')
      return
    }

    // Check if table is full
    if (this.players.size >= this.tableState.settings.maxPlayers) {
      this.sendError(ws, 'TABLE_FULL', 'Table is full')
      return
    }

    // Check if name is taken
    for (const player of this.players.values()) {
      if (player.displayName.toLowerCase() === playerName.toLowerCase()) {
        this.sendError(ws, 'NAME_TAKEN', 'Name is already taken')
        return
      }
    }

    // Create new player
    const playerId = crypto.randomUUID()
    const newReconnectToken = this.generateToken()
    const isHost = this.players.size === 0

    const session: PlayerSession = {
      id: playerId,
      displayName: playerName,
      reconnectToken: newReconnectToken,
      isHost,
      isReady: false,
      isConnected: true,
      timeRemainingMs: this.tableState.settings.startingTimeMs,
      victoryPoints: 0,
      lastWinRound: null,
      bidStartTime: null,
      bidEndTime: null,
      currentBidMs: 0,
      hasReleasedThisRound: false,
    }

    this.players.set(playerId, session)
    this.setWsPlayerId(ws, playerId)

    if (isHost) {
      this.tableState.hostId = playerId
    }

    this.send(ws, {
      type: 'welcome',
      playerId,
      reconnectToken: newReconnectToken,
      serverTime: Date.now(),
    })

    this.broadcastLobbyState()
    this.broadcast({
      type: 'playerJoined',
      player: this.toPlayerInfo(session),
    }, ws)

    await this.saveState()
  }

  private async handleReady(ws: WebSocket, isReady: boolean): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session || this.tableState?.status !== 'lobby') return

    session.isReady = isReady
    this.broadcast({
      type: 'playerReady',
      playerId: session.id,
      isReady,
    })

    await this.saveState()
  }

  private async handleStartGame(ws: WebSocket): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session || !this.tableState) return

    if (!session.isHost) {
      this.sendError(ws, 'NOT_HOST', 'Only the host can start the game')
      return
    }

    if (this.players.size < 2) {
      this.sendError(ws, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players')
      return
    }

    const allReady = Array.from(this.players.values()).every(p => p.isReady)
    if (!allReady) {
      this.sendError(ws, 'PLAYERS_NOT_READY', 'All players must be ready')
      return
    }

    this.tableState.status = 'playing'
    this.tableState.currentRound = 1

    this.broadcast({ type: 'gameStarting', countdown: 3 })

    // Start first round after countdown
    await this.state.storage.setAlarm(Date.now() + PRE_ROUND_COUNTDOWN_MS)
    this.tableState.roundPhase = 'pre_round'
    this.tableState.phaseStartTime = Date.now()

    // Initialize round state for all players
    for (const player of this.players.values()) {
      player.bidStartTime = null
      player.bidEndTime = null
      player.currentBidMs = 0
      player.hasReleasedThisRound = false
    }

    this.broadcast({
      type: 'roundStart',
      round: 1,
      totalRounds: this.tableState.settings.numRounds,
      startsAt: Date.now() + PRE_ROUND_COUNTDOWN_MS,
    })

    await this.saveState()
  }

  private async handleBidStart(ws: WebSocket, clientTimestamp: number): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session || !this.tableState) return

    if (this.tableState.status !== 'playing') return
    if (this.tableState.roundPhase !== 'grace_period' && this.tableState.roundPhase !== 'bidding') return
    if (session.bidStartTime !== null) return // Already bidding

    const serverTime = Date.now()
    const latency = Math.min(Math.abs(serverTime - clientTimestamp), MAX_LATENCY_COMPENSATION_MS)
    session.bidStartTime = serverTime - latency

    this.broadcast({
      type: 'bidUpdate',
      playerId: session.id,
      isBidding: true,
      currentBidMs: 0,
    })

    await this.saveState()
  }

  private async handleBidEnd(ws: WebSocket, clientTimestamp: number): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session || !this.tableState) return

    if (session.bidStartTime === null) return // Not bidding

    const serverTime = Date.now()
    const latency = Math.min(Math.abs(serverTime - clientTimestamp), MAX_LATENCY_COMPENSATION_MS)
    session.bidEndTime = serverTime - latency

    // Calculate bid duration
    const bidDuration = session.bidEndTime - session.bidStartTime

    // Check if bid was during grace period (no penalty)
    const graceEnded = this.tableState.roundPhase === 'bidding'
    if (!graceEnded) {
      session.currentBidMs = 0
    } else {
      // Only count time after grace period
      const graceEndTime = this.tableState.phaseStartTime
      const effectiveStart = Math.max(session.bidStartTime, graceEndTime)
      session.currentBidMs = Math.max(0, session.bidEndTime - effectiveStart)
    }

    session.hasReleasedThisRound = true

    this.broadcast({
      type: 'bidUpdate',
      playerId: session.id,
      isBidding: false,
      currentBidMs: session.currentBidMs,
    })

    // Reset bid state
    session.bidStartTime = null
    session.bidEndTime = null

    // Check if round should end
    this.checkRoundEnd()

    await this.saveState()
  }

  private checkRoundEnd(): void {
    if (!this.tableState || this.tableState.roundPhase !== 'bidding') return

    // Round ends when all connected players have released
    const allReleased = Array.from(this.players.values())
      .filter(p => p.isConnected)
      .every(p => p.hasReleasedThisRound || p.bidStartTime === null)

    if (allReleased) {
      this.endRound()
    }
  }

  private async endRound(): Promise<void> {
    if (!this.tableState) return

    this.tableState.roundPhase = 'resolution'
    this.tableState.phaseStartTime = Date.now()

    // Calculate results
    const bids: { playerId: string; displayName: string; bidMs: number; participated: boolean }[] = []
    let maxBid = 0
    let winnerId: string | null = null
    let winnerName: string | null = null
    let tieCount = 0

    for (const player of this.players.values()) {
      const bidMs = player.currentBidMs
      bids.push({
        playerId: player.id,
        displayName: player.displayName,
        bidMs,
        participated: bidMs > 0,
      })

      if (bidMs > 0) {
        // Deduct bid from time bank
        player.timeRemainingMs = Math.max(0, player.timeRemainingMs - bidMs)

        if (bidMs > maxBid + TIE_THRESHOLD_MS) {
          maxBid = bidMs
          winnerId = player.id
          winnerName = player.displayName
          tieCount = 1
        } else if (Math.abs(bidMs - maxBid) <= TIE_THRESHOLD_MS && bidMs >= maxBid) {
          tieCount++
          if (bidMs > maxBid) {
            maxBid = bidMs
            winnerId = player.id
            winnerName = player.displayName
          }
        }
      }
    }

    // Handle tie - no winner
    const wasTie = tieCount > 1
    if (wasTie) {
      winnerId = null
      winnerName = null
    }

    // Award victory point to winner
    if (winnerId) {
      const winner = this.players.get(winnerId)
      if (winner) {
        winner.victoryPoints++
        winner.lastWinRound = this.tableState.currentRound
      }
    }

    const roundResult: RoundResult = {
      roundNumber: this.tableState.currentRound,
      winnerId,
      winnerName,
      winningBidMs: maxBid,
      wasTie,
      playerResults: bids,
    }

    this.tableState.roundHistory.push(roundResult)

    this.broadcast({
      type: 'roundEnd',
      results: roundResult,
      nextRoundIn: ROUND_RESULTS_DISPLAY_MS,
    })

    // Schedule next round or game end
    await this.state.storage.setAlarm(Date.now() + ROUND_RESULTS_DISPLAY_MS)

    await this.saveState()
  }

  private async startNextRound(): Promise<void> {
    if (!this.tableState) return

    this.tableState.currentRound++
    this.tableState.roundPhase = 'pre_round'
    this.tableState.phaseStartTime = Date.now()

    // Reset player round state
    for (const player of this.players.values()) {
      player.bidStartTime = null
      player.bidEndTime = null
      player.currentBidMs = 0
      player.hasReleasedThisRound = false
    }

    this.broadcast({
      type: 'roundStart',
      round: this.tableState.currentRound,
      totalRounds: this.tableState.settings.numRounds,
      startsAt: Date.now() + PRE_ROUND_COUNTDOWN_MS,
    })

    // Schedule grace period start
    await this.state.storage.setAlarm(Date.now() + PRE_ROUND_COUNTDOWN_MS)

    await this.saveState()
  }

  private async endGame(): Promise<void> {
    if (!this.tableState) return

    this.tableState.status = 'finished'

    // Calculate final standings
    const standings: FinalStanding[] = Array.from(this.players.values())
      .map(p => ({
        rank: 0,
        playerId: p.id,
        displayName: p.displayName,
        victoryPoints: p.victoryPoints,
        timeRemainingMs: p.timeRemainingMs,
        lastWinRound: p.lastWinRound,
      }))
      .sort((a, b) => {
        // Sort by: points (desc) -> time remaining (desc) -> last win round (desc)
        if (b.victoryPoints !== a.victoryPoints) {
          return b.victoryPoints - a.victoryPoints
        }
        if (b.timeRemainingMs !== a.timeRemainingMs) {
          return b.timeRemainingMs - a.timeRemainingMs
        }
        return (b.lastWinRound ?? 0) - (a.lastWinRound ?? 0)
      })

    // Assign ranks
    standings.forEach((s, i) => {
      s.rank = i + 1
    })

    this.broadcast({ type: 'gameEnd', standings })

    await this.saveState()
  }

  private async handleKick(ws: WebSocket, playerId: string): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session || !this.tableState) return

    if (!session.isHost) {
      this.sendError(ws, 'NOT_HOST', 'Only the host can kick players')
      return
    }

    if (playerId === session.id) {
      this.sendError(ws, 'INVALID_ACTION', 'Cannot kick yourself')
      return
    }

    const playerToKick = this.players.get(playerId)
    if (!playerToKick) return

    // Find and close their WebSocket
    for (const otherWs of this.state.getWebSockets()) {
      const otherSession = this.getSessionFromWs(otherWs)
      if (otherSession?.id === playerId) {
        this.send(otherWs, { type: 'playerKicked', playerId })
        otherWs.close()
        break
      }
    }

    this.players.delete(playerId)
    this.broadcast({ type: 'playerLeft', playerId })

    await this.saveState()
  }

  private async handleLeave(ws: WebSocket): Promise<void> {
    const session = this.getSessionFromWs(ws)
    if (!session) return

    session.isConnected = false

    if (this.tableState?.status === 'lobby') {
      this.players.delete(session.id)
      this.broadcast({ type: 'playerLeft', playerId: session.id })
    }

    ws.close()
    await this.saveState()
  }

  private sendCurrentState(ws: WebSocket): void {
    if (!this.tableState) return

    if (this.tableState.status === 'lobby') {
      this.sendLobbyState(ws)
    } else {
      this.send(ws, {
        type: 'gameState',
        state: this.getGameState(),
      })
    }
  }

  private getGameState(): GameState {
    if (!this.tableState) {
      throw new Error('No table state')
    }

    return {
      status: this.tableState.status,
      currentRound: this.tableState.currentRound,
      totalRounds: this.tableState.settings.numRounds,
      roundPhase: this.tableState.roundPhase,
      phaseStartTime: this.tableState.phaseStartTime,
      phaseEndTime: null,
      players: Array.from(this.players.values()).map(p => this.toPlayerInfo(p)),
      playerBids: Array.from(this.players.values()).map(p => ({
        playerId: p.id,
        isBidding: p.bidStartTime !== null,
        currentBidMs: p.currentBidMs,
        hasReleasedThisRound: p.hasReleasedThisRound,
      })),
    }
  }

  private sendLobbyState(ws: WebSocket): void {
    if (!this.tableState) return

    this.send(ws, {
      type: 'lobbyState',
      settings: this.tableState.settings,
      players: Array.from(this.players.values()).map(p => this.toPlayerInfo(p)),
      hostId: this.tableState.hostId ?? '',
    })
  }

  private broadcastLobbyState(): void {
    if (!this.tableState) return

    this.broadcast({
      type: 'lobbyState',
      settings: this.tableState.settings,
      players: Array.from(this.players.values()).map(p => this.toPlayerInfo(p)),
      hostId: this.tableState.hostId ?? '',
    })
  }

  private toPlayerInfo(session: PlayerSession): Player {
    return {
      id: session.id,
      displayName: session.displayName,
      isHost: session.isHost,
      isReady: session.isReady,
      isConnected: session.isConnected,
      timeRemainingMs: session.timeRemainingMs,
      victoryPoints: session.victoryPoints,
      lastWinRound: session.lastWinRound,
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  private sendError(ws: WebSocket, code: ErrorCode, message: string): void {
    this.send(ws, { type: 'error', code, message })
  }

  private broadcast(message: ServerMessage, exclude?: WebSocket): void {
    // Use getWebSockets() to survive hibernation
    const webSockets = this.state.getWebSockets()
    for (const ws of webSockets) {
      if (ws !== exclude) {
        this.send(ws, message)
      }
    }
  }

  private generateToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  }
}
