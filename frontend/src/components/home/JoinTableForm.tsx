import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TABLE_ID_LENGTH } from '@shared/constants'

interface Props {
  onBack: () => void
}

export default function JoinTableForm({ onBack }: Props) {
  const navigate = useNavigate()
  const [tableCode, setTableCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const code = tableCode.toUpperCase().trim()
    if (code.length !== TABLE_ID_LENGTH) {
      setError(`Table code must be ${TABLE_ID_LENGTH} characters`)
      return
    }

    navigate(`/game/${code}`)
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

        <h2 className="text-3xl font-bold text-white mb-6">Join Table</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Table Code
            </label>
            <input
              type="text"
              value={tableCode}
              onChange={(e) => setTableCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-indigo-500"
              placeholder="ABC123"
              maxLength={TABLE_ID_LENGTH}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
          >
            Join Table
          </button>
        </form>

        <p className="mt-6 text-gray-500 text-sm text-center">
          Enter the 6-character code shared by the host
        </p>
      </div>
    </div>
  )
}
