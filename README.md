# Time Auction

A real-time multiplayer auction game inspired by The Devil's Plan Season 2. Players compete across multiple rounds, bidding time from their personal bank to win victory points.

## How to Play

1. **Create a Table**: One player creates a game table with customizable settings
2. **Share the Link**: Other players join using the 6-character table code
3. **Ready Up**: All players mark themselves as ready in the lobby
4. **Bid Time**: Each round, hold the bid button to bid time from your bank
5. **Win Points**: The player who holds longest wins 1 victory point
6. **Watch Your Bank**: ALL participants lose their bid amount (not just the winner!)
7. **Victory**: Most points wins. Ties broken by remaining time, then most recent win.

### The Grace Period

Each round has a 5-second grace period at the start. During this time, you can release the button without losing any time. Use this to gauge other players' strategies!

## Project Structure

```
time-auction/
├── frontend/          # React + Vite + Tailwind frontend
├── worker/            # Cloudflare Worker + Durable Objects backend
├── shared/            # Shared TypeScript types and constants
├── README.md          # This file
└── ARCHITECTURE.md    # Technical documentation
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account (for deployment)

### Local Development

1. **Install dependencies:**

```bash
# Frontend
cd frontend
npm install

# Worker
cd ../worker
npm install
```

2. **Start the worker (backend):**

```bash
cd worker
npm run dev
```

This starts the Cloudflare Worker locally on port 8787.

3. **Start the frontend:**

```bash
cd frontend
npm run dev
```

This starts Vite on port 5173 with proxy to the worker.

4. **Open the app:**

Navigate to `http://localhost:5173`

## Deployment

### Deploy to Cloudflare

1. **Deploy the Worker:**

```bash
cd worker
npx wrangler login  # First time only
npm run deploy
```

2. **Deploy the Frontend:**

```bash
cd frontend
npm run build
npx wrangler pages deploy dist
```

Or connect your repository to Cloudflare Pages for automatic deployments.

### Environment Configuration

The worker requires a Durable Object binding. This is configured in `worker/wrangler.toml`:

```toml
[durable_objects]
bindings = [
  { name = "GAME_ROOM", class_name = "GameRoom" }
]
```

## Game Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Starting Time | 600s (10 min) | 60-3600s | Time each player starts with |
| Rounds | 10 | 1-50 | Number of rounds per game |
| Max Players | 8 | 2-20 | Maximum players per table |
| Grace Period | 5s | 3-10s | Safe release window each round |
| Password | None | 0-50 chars | Optional table password |

## Victory Conditions

Players are ranked by (in order):
1. **Victory Points** - Most points wins
2. **Remaining Time** - If tied on points, most time remaining wins
3. **Most Recent Win** - If still tied, whoever won a round most recently wins

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Cloudflare Workers, Durable Objects
- **Real-time**: WebSockets via Durable Objects Hibernation API
- **State**: In-memory with SQLite persistence (Durable Objects)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type checks: `npm run typecheck` (in both frontend and worker)
5. Submit a pull request

## License

MIT
