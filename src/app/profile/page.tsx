'use client'

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import Header from '../../components/Header'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  
  // Display name state
  const [displayName, setDisplayName] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  
  // Password update state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Set display name from profile when it loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
    }
  }, [profile])

  // Update display name
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    try {
      setUpdatingProfile(true)
      setProfileMessage(null)
      setProfileError(null)
      
      // Check if profiles table exists, if not it will be created automatically
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          display_name: displayName,
          updated_at: new Date().toISOString()
        })
      
      if (upsertError) {
        setProfileError(upsertError.message)
        return
      }
      
      // Also update the user metadata in auth.users
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      })
      
      if (updateError) {
        setProfileError(updateError.message)
        return
      }
      
      // Refresh the profile in the context
      await refreshProfile()
      
      setProfileMessage('Profile updated successfully')
    } catch (error) {
      setProfileError('An unexpected error occurred')
      console.error(error)
    } finally {
      setUpdatingProfile(false)
    }
  }

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // Validate passwords
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    
    try {
      setUpdatingPassword(true)
      setPasswordMessage(null)
      setPasswordError(null)
      
      // First verify the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      })
      
      if (signInError) {
        setPasswordError('Current password is incorrect')
        return
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (updateError) {
        setPasswordError(updateError.message)
        return
      }
      
      setPasswordMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError('An unexpected error occurred')
      console.error(error)
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8 bg-gray-50">
        {/* Header */}
        <Header />
        
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile Settings</h1>
          
          <div className="space-y-8">
            {/* Profile Information */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Profile Information</h2>
              
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-500 bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>
                
                <div>
                  <label htmlFor="display-name" className="block text-sm font-medium mb-1 text-gray-700">
                    Display Name
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                    placeholder="Enter your display name"
                  />
                </div>
                
                {profileError && (
                  <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
                    {profileError}
                  </div>
                )}
                
                {profileMessage && (
                  <div className="bg-green-100 text-green-700 p-3 rounded text-sm">
                    {profileMessage}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-blue-300"
                >
                  {updatingProfile ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            </div>
            
            {/* Password Update */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Update Password</h2>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium mb-1 text-gray-700">
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  />
                </div>
                
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-1 text-gray-700">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 8 characters long
                  </p>
                </div>
                
                <div>
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium mb-1 text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  />
                </div>
                
                {passwordError && (
                  <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
                    {passwordError}
                  </div>
                )}
                
                {passwordMessage && (
                  <div className="bg-green-100 text-green-700 p-3 rounded text-sm">
                    {passwordMessage}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-blue-300"
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 