"use client";

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import Link from 'next/link'

// Define the Word type
interface Word {
  id: number
  name: string
  speech: string
  meaning: string
  level: string
  example_sentence: string
  created_at: string
  source: string
}

// Add this to your existing interfaces
interface LogEntry {
  id: number
  created_at: string
  words_id: number
  result: number
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { signOut } = useAuth()

  useEffect(() => {
    const fetchWords = async () => {
      try {
        const { data, error } = await supabase
          .from('words-v1')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        setWords(data || [])
      } catch (err) {
        console.error('Error fetching words:', err)
        setError(err instanceof Error ? err.message : 'An error occurred while fetching words')
      } finally {
        setLoading(false)
      }
    }

    void fetchWords()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen p-8">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
      </div>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-black">Word Dashboard</h1>
          <div className="flex gap-4">
            <Link
              href="/quiz"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Take Quiz
            </Link>
            <Link
              href="/add"
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Add Word
            </Link>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-600 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Word List */}
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Word</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speech</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meaning</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Example</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {words.map((word) => (
                    <tr key={word.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{word.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{word.speech}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${word.level === 'C2' ? 'bg-purple-100 text-purple-800' :
                            word.level === 'C1' ? 'bg-blue-100 text-blue-800' :
                            word.level === 'B2' ? 'bg-green-100 text-green-800' :
                            word.level === 'B1' ? 'bg-yellow-100 text-yellow-800' :
                            word.level === 'A2' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'}`}
                        >
                          {word.level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{word.meaning}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{word.example_sentence}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(word.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{word.source}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
