import { useEffect, useRef, useCallback, useState } from 'react'
import type { ClientMessage, ServerMessage } from '@shared/types'
import { WS_BASE_URL } from '@/lib/config'

interface UseWebSocketOptions {
  onMessage?: (message: ServerMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket(tableId: string | null, options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(() => {
    if (!tableId) return

    const wsUrl = `${WS_BASE_URL}/ws/${tableId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      options.onConnect?.()
    }

    ws.onclose = () => {
      setIsConnected(false)
      options.onDisconnect?.()

      // Attempt to reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 2000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage
        options.onMessage?.(message)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
  }, [tableId, options])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    sendMessage,
    disconnect,
  }
}
