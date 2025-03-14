'use client'

import { useAuth } from '../../contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TestPage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [dbStatus, setDbStatus] = useState<string>('Checking...')
  const [profilesTable, setProfilesTable] = useState<string>('Checking...')
  const [error, setError] = useState<string | null>(null)
  const [creatingTable, setCreatingTable] = useState(false)
  const [runningMigration, setRunningMigration] = useState(false)
  const [runningLogMigration, setRunningLogMigration] = useState(false)

  const checkDatabase = async () => {
    try {
      // Check if we can connect to Supabase
      const { error } = await supabase.from('words-v1').select('id').limit(1)
      
      if (error) {
        setDbStatus(`Error: ${error.message}`)
      } else {
        setDbStatus('Connected successfully')
      }
      
      // Check if profiles table exists
      const { error: profileError } = await supabase.from('profiles').select('id').limit(1)
      
      if (profileError) {
        if (profileError.message.includes('does not exist')) {
          setProfilesTable('Table does not exist')
        } else {
          setProfilesTable(`Error: ${profileError.message}`)
        }
      } else {
        setProfilesTable('Table exists')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    checkDatabase()
  }, [])

  const createProfile = async () => {
    if (!user) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          display_name: 'Test User',
          updated_at: new Date().toISOString()
        })
      
      if (error) {
        setError(error.message)
      } else {
        await refreshProfile()
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const createProfilesTable = async () => {
    setCreatingTable(true)
    setError(null)
    
    try {
      const sql = `
        -- Create a table for public profiles
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
          display_name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Set up Row Level Security (RLS)
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

        -- Create policies
        DO $$
        BEGIN
          -- Allow users to view their own profile
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
          ) THEN
            CREATE POLICY "Users can view their own profile" ON public.profiles
              FOR SELECT USING (auth.uid() = id);
          END IF;

          -- Allow users to update their own profile
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
          ) THEN
            CREATE POLICY "Users can update their own profile" ON public.profiles
              FOR UPDATE USING (auth.uid() = id);
          END IF;

          -- Allow users to insert their own profile
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile'
          ) THEN
            CREATE POLICY "Users can insert their own profile" ON public.profiles
              FOR INSERT WITH CHECK (auth.uid() = id);
          END IF;
        END
        $$;

        -- Create a function to handle new user creation
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.profiles (id)
          VALUES (NEW.id)
          ON CONFLICT (id) DO NOTHING;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Create a trigger to call the function when a new user is created
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `
      
      const response = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create profiles table')
      }
      
      // Refresh the database status
      await checkDatabase()
      
      // If the user exists but profile doesn't, create it
      if (user && !profile) {
        await createProfile()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreatingTable(false)
    }
  }

  const runUserIdMigration = async () => {
    setRunningMigration(true)
    setError(null)
    
    try {
      const response = await fetch('/api/run-migration')
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run migration')
      }
      
      alert('Migration completed successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRunningMigration(false)
    }
  }

  const runLogTableMigration = async () => {
    setRunningLogMigration(true)
    setError(null)
    
    try {
      const response = await fetch('/api/migrate-log-table')
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run log table migration')
      }
      
      alert('Log table migration completed successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRunningLogMigration(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Authentication Test Page</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Authentication Status</h2>
          <p>Loading: {loading ? 'Yes' : 'No'}</p>
          <p>User: {user ? 'Authenticated' : 'Not authenticated'}</p>
          <p>User ID: {user?.id || 'N/A'}</p>
          <p>Email: {user?.email || 'N/A'}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Profile Status</h2>
          <p>Profile: {profile ? 'Exists' : 'Does not exist'}</p>
          <p>Display Name: {profile?.display_name || 'Not set'}</p>
          
          {user && !profile && (
            <button
              onClick={createProfile}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Profile
            </button>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Database Status</h2>
          <p>Connection: {dbStatus}</p>
          <p>Profiles Table: {profilesTable}</p>
          
          {profilesTable === 'Table does not exist' && (
            <button
              onClick={createProfilesTable}
              disabled={creatingTable}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {creatingTable ? 'Creating...' : 'Create Profiles Table'}
            </button>
          )}
          
          <button
            onClick={checkDatabase}
            className="mt-4 ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Refresh Status
          </button>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold">User ID for Words</h3>
            <p className="text-gray-600">Add user_id column to words-v1 table and set up RLS policies</p>
            
            <button
              onClick={runUserIdMigration}
              disabled={runningMigration}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {runningMigration ? 'Running Migration...' : 'Run Migration'}
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-semibold">User-specific Calendar</h3>
            <p className="text-gray-600">Add UID column to log table to make calendar user-specific</p>
            
            <button
              onClick={runLogTableMigration}
              disabled={runningLogMigration}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {runningLogMigration ? 'Running Migration...' : 'Run Log Table Migration'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
            <p>Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  )
} 