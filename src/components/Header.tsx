'use client'

import { useAuth } from '../contexts/AuthContext'
import Link from 'next/link'

export default function Header() {
  const { user, profile, signOut } = useAuth()

  return (
    <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
      <h1 className="text-3xl font-bold text-black">Oxford 5000</h1>
      
      <div className="flex items-center gap-4">
        {profile && (
          <Link href="/profile" className="text-gray-700 hover:text-gray-900">
            <span className="font-medium">{profile.display_name || 'Profile'}</span>
          </Link>
        )}
        <button
          onClick={signOut}
          className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-600 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
} 