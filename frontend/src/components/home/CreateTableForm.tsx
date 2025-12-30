import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '@/lib/config'
import {
  DEFAULT_STARTING_TIME_MS,
  DEFAULT_NUM_ROUNDS,
  DEFAULT_MAX_PLAYERS,
  DEFAULT_GRACE_PERIOD_MS,
  MIN_STARTING_TIME_SECONDS,
  MAX_STARTING_TIME_SECONDS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_GRACE_PERIOD_SECONDS,
  MAX_GRACE_PERIOD_SECONDS,
} from '@shared/constants'

interface Props {
  onBack: () => void
}

export default function CreateTableForm({ onBack }: Props) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: 'Time Auction',
    password: '',
    startingTimeSeconds: DEFAULT_STARTING_TIME_MS / 1000,
    numRounds: DEFAULT_NUM_ROUNDS,
    maxPlayers: DEFAULT_MAX_PLAYERS,
    gracePeriodSeconds: DEFAULT_GRACE_PERIOD_MS / 1000,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          password: formData.password || undefined,
          startingTimeSeconds: formData.startingTimeSeconds,
          numRounds: formData.numRounds,
          maxPlayers: formData.maxPlayers,
          gracePeriodSeconds: formData.gracePeriodSeconds,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create table')
      }

      const data = await response.json()
      // Store host token in sessionStorage
      sessionStorage.setItem(`host_${data.tableId}`, data.hostToken)
      navigate(`/game/${data.tableId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          <span>&larr;</span> Back
        </button>

        <h2 className="text-3xl font-bold text-white mb-6">Create Table</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Table Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password (optional)
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              placeholder="Leave empty for no password"
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Starting Time (seconds)
              </label>
              <input
                type="number"
                value={formData.startingTimeSeconds}
                onChange={(e) => setFormData({ ...formData, startingTimeSeconds: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                min={MIN_STARTING_TIME_SECONDS}
                max={MAX_STARTING_TIME_SECONDS}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Rounds
              </label>
              <input
                type="number"
                value={formData.numRounds}
                onChange={(e) => setFormData({ ...formData, numRounds: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Players
              </label>
              <input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                min={MIN_PLAYERS}
                max={MAX_PLAYERS}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Grace Period (seconds)
              </label>
              <input
                type="number"
                value={formData.gracePeriodSeconds}
                onChange={(e) => setFormData({ ...formData, gracePeriodSeconds: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                min={MIN_GRACE_PERIOD_SECONDS}
                max={MAX_GRACE_PERIOD_SECONDS}
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Table'}
          </button>
        </form>
      </div>
    </div>
  )
}
