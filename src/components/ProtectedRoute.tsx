'use client'

import { createClient } from '@supabase/supabase-js'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile, loading } = useAuth()
  const router = useRouter()

  // Ensure user is authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  // Ensure profile exists
  useEffect(() => {
    const createProfileIfNeeded = async () => {
      if (user && !profile) {
        try {
          // Try to create a profile if it doesn't exist
          const { error } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              updated_at: new Date().toISOString()
            })
          
          if (error) {
            console.error('Error creating profile:', error)
          } else {
            // Refresh the profile
            await refreshProfile()
          }
        } catch (error) {
          console.error('Error creating profile:', error)
        }
      }
    }

    createProfileIfNeeded()
  }, [user, profile, refreshProfile])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return user ? <>{children}</> : null
} 