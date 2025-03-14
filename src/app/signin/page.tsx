'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AuthMethod = 'password' | 'magic_link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [message, setMessage] = useState<string | null>(null)
  const [isResetPassword, setIsResetPassword] = useState(false)
  const router = useRouter()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        router.push('/quiz')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/quiz`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setMessage('Check your email for the magic link')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/signin`,
      })

      if (error) {
        setError(error.message)
        return
      }

      setMessage('Password reset instructions sent to your email')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (isResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-3xl font-bold text-center mb-6 text-gray-900">Reset Password</h2>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded text-sm mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 text-green-700 p-3 rounded text-sm mb-4">
              {message}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label htmlFor="email-reset" className="block text-sm font-medium mb-1 text-gray-700">
                Email
              </label>
              <input
                id="email-reset"
                name="email"
                type="email"
                required
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {loading ? 'Sending...' : 'Send Reset Instructions'}
            </button>
          </form>

          <button
            onClick={() => setIsResetPassword(false)}
            className="mt-4 w-full text-center text-blue-600 hover:text-blue-800"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-900">Sign In</h2>
        
        {/* Auth Method Tabs */}
        <div className="flex mb-6 border rounded-md overflow-hidden">
          <button
            className={`flex-1 py-3 text-center ${
              authMethod === 'password'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
            onClick={() => setAuthMethod('password')}
          >
            Password
          </button>
          <button
            className={`flex-1 py-3 text-center ${
              authMethod === 'magic_link'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
            onClick={() => setAuthMethod('magic_link')}
          >
            Magic Link
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded text-sm mb-4">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded text-sm mb-4">
            {message}
          </div>
        )}

        {authMethod === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsResetPassword(true)}
                    className="text-blue-600 text-sm hover:text-blue-800"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLinkLogin} className="space-y-6">
            <div>
              <label htmlFor="email-magic" className="block text-sm font-medium mb-1 text-gray-700">
                Email
              </label>
              <input
                id="email-magic"
                name="email"
                type="email"
                required
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:text-blue-800 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
} 