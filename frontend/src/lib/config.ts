// In development, Vite proxies /api to the local worker
// In production, we need to call the worker directly
export const API_BASE_URL = import.meta.env.PROD
  ? 'https://time-auction.anthony-azersky.workers.dev'
  : ''

export const WS_BASE_URL = import.meta.env.PROD
  ? 'wss://time-auction.anthony-azersky.workers.dev'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
