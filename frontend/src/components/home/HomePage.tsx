import { useState } from 'react'
import CreateTableForm from './CreateTableForm'
import JoinTableForm from './JoinTableForm'

type View = 'home' | 'create' | 'join'

export default function HomePage() {
  const [view, setView] = useState<View>('home')

  if (view === 'create') {
    return <CreateTableForm onBack={() => setView('home')} />
  }

  if (view === 'join') {
    return <JoinTableForm onBack={() => setView('home')} />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4">Time Auction</h1>
        <p className="text-gray-400 text-lg max-w-md">
          A real-time multiplayer auction game. Bid your time wisely to win!
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => setView('create')}
          className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
        >
          Create Table
        </button>
        <button
          onClick={() => setView('join')}
          className="w-full py-4 px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
        >
          Join with Code
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-sm">
        Inspired by The Devil's Plan Season 2
      </p>
    </div>
  )
}
