import { GameRoom } from './durable-objects/GameRoom'
import type { CreateTableRequest, CreateTableResponse, TableInfo } from '../../shared/types'
import {
  TABLE_ID_LENGTH,
  TABLE_ID_CHARS,
  MIN_TABLE_NAME_LENGTH,
  MAX_TABLE_NAME_LENGTH,
  MIN_STARTING_TIME_SECONDS,
  MAX_STARTING_TIME_SECONDS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_GRACE_PERIOD_SECONDS,
  MAX_GRACE_PERIOD_SECONDS,
} from '../../shared/constants'

export { GameRoom }

export interface Env {
  GAME_ROOM: DurableObjectNamespace
}

function generateTableId(): string {
  let id = ''
  for (let i = 0; i < TABLE_ID_LENGTH; i++) {
    id += TABLE_ID_CHARS[Math.floor(Math.random() * TABLE_ID_CHARS.length)]
  }
  return id
}

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    // WebSocket upgrade for game connections
    if (url.pathname.startsWith('/ws/')) {
      const tableId = url.pathname.split('/')[2]
      if (!tableId) {
        return new Response('Missing table ID', { status: 400 })
      }

      const id = env.GAME_ROOM.idFromName(tableId)
      const room = env.GAME_ROOM.get(id)
      return room.fetch(request)
    }

    // REST API routes
    if (url.pathname === '/api/tables' && request.method === 'POST') {
      try {
        const body = await request.json() as CreateTableRequest

        // Validate input
        if (!body.name || body.name.length < MIN_TABLE_NAME_LENGTH || body.name.length > MAX_TABLE_NAME_LENGTH) {
          return Response.json({ error: 'Invalid table name' }, { status: 400, headers: corsHeaders() })
        }
        if (body.startingTimeSeconds < MIN_STARTING_TIME_SECONDS || body.startingTimeSeconds > MAX_STARTING_TIME_SECONDS) {
          return Response.json({ error: 'Invalid starting time' }, { status: 400, headers: corsHeaders() })
        }
        if (body.numRounds < MIN_ROUNDS || body.numRounds > MAX_ROUNDS) {
          return Response.json({ error: 'Invalid number of rounds' }, { status: 400, headers: corsHeaders() })
        }
        if (body.maxPlayers < MIN_PLAYERS || body.maxPlayers > MAX_PLAYERS) {
          return Response.json({ error: 'Invalid max players' }, { status: 400, headers: corsHeaders() })
        }
        if (body.gracePeriodSeconds < MIN_GRACE_PERIOD_SECONDS || body.gracePeriodSeconds > MAX_GRACE_PERIOD_SECONDS) {
          return Response.json({ error: 'Invalid grace period' }, { status: 400, headers: corsHeaders() })
        }

        const tableId = generateTableId()
        const hostToken = generateToken()
        const passwordHash = body.password ? await hashPassword(body.password) : null

        // Create the Durable Object and initialize it
        const id = env.GAME_ROOM.idFromName(tableId)
        const room = env.GAME_ROOM.get(id)

        const initResponse = await room.fetch(new Request('http://internal/init', {
          method: 'POST',
          body: JSON.stringify({
            tableId,
            hostToken,
            passwordHash,
            settings: {
              tableName: body.name,
              startingTimeMs: body.startingTimeSeconds * 1000,
              numRounds: body.numRounds,
              maxPlayers: body.maxPlayers,
              gracePeriodMs: body.gracePeriodSeconds * 1000,
              hasPassword: !!body.password,
            },
          }),
        }))

        if (!initResponse.ok) {
          return Response.json({ error: 'Failed to create table' }, { status: 500, headers: corsHeaders() })
        }

        const response: CreateTableResponse = {
          tableId,
          hostToken,
          joinUrl: `${url.origin}/game/${tableId}`,
        }

        return Response.json(response, { headers: corsHeaders() })
      } catch (err) {
        console.error('Error creating table:', err)
        return Response.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders() })
      }
    }

    // Get table info
    if (url.pathname.startsWith('/api/tables/') && request.method === 'GET') {
      const tableId = url.pathname.split('/')[3]
      if (!tableId) {
        return Response.json({ error: 'Missing table ID' }, { status: 400, headers: corsHeaders() })
      }

      const id = env.GAME_ROOM.idFromName(tableId)
      const room = env.GAME_ROOM.get(id)

      const infoResponse = await room.fetch(new Request('http://internal/info'))
      if (!infoResponse.ok) {
        return Response.json({ error: 'Table not found' }, { status: 404, headers: corsHeaders() })
      }

      const info = await infoResponse.json() as TableInfo
      return Response.json(info, { headers: corsHeaders() })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() })
  },
}
