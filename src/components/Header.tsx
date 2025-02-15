'use client'

import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { signOut } = useAuth()

  return (
    <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
      <h1 className="text-3xl font-bold text-black">The Oxford 5000</h1>
      <button
        onClick={signOut}
        className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-600 hover:text-white transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
} 