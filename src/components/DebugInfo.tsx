'use client'

import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export default function DebugInfo() {
  const { user, profile, loading } = useAuth()
  const [showDebug, setShowDebug] = useState(false)

  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        className="fixed bottom-20 right-4 bg-gray-800 text-white p-2 rounded-full opacity-50 hover:opacity-100"
      >
        Debug
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-300 max-w-md z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Information</h3>
        <button 
          onClick={() => setShowDebug(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
      
      <div className="text-xs space-y-2 overflow-auto max-h-60">
        <div>
          <p className="font-semibold">Auth State:</p>
          <p>Loading: {loading ? 'true' : 'false'}</p>
          <p>User: {user ? 'Authenticated' : 'Not authenticated'}</p>
          <p>Profile: {profile ? 'Exists' : 'Does not exist'}</p>
        </div>
        
        {user && (
          <div>
            <p className="font-semibold">User Info:</p>
            <p>ID: {user.id}</p>
            <p>Email: {user.email}</p>
            <p>Created: {new Date(user.created_at).toLocaleString()}</p>
          </div>
        )}
        
        {profile && (
          <div>
            <p className="font-semibold">Profile Info:</p>
            <p>Display Name: {profile.display_name || 'Not set'}</p>
          </div>
        )}
      </div>
    </div>
  )
} 