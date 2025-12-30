import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from '@/contexts/GameContext'
import HomePage from '@/components/home/HomePage'
import LobbyPage from '@/components/lobby/LobbyPage'
import GamePage from '@/components/game/GamePage'

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <div className="min-h-screen bg-gray-900">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:tableId" element={<LobbyPage />} />
            <Route path="/game/:tableId/play" element={<GamePage />} />
          </Routes>
        </div>
      </GameProvider>
    </BrowserRouter>
  )
}

export default App
