"use client";

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
// import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import Header from '../components/Header'
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'

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
  score?: number
}

interface QuizResult {
  id: number
  words_id: number
  result: number
  created_at: string
}

interface DailyStats {
  correct: number
  wrong: number
  added: number
}

interface CalendarData {
  [date: string]: DailyStats
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [words, setWords] = useState<Word[]>([])
  const [quizResults, setQuizResults] = useState<{ [key: number]: QuizResult[] }>({})
  const [calendarData, setCalendarData] = useState<CalendarData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedWords, setExpandedWords] = useState<number[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalWords, setTotalWords] = useState(0)
  const wordsPerPage = 50

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch total word count
        const { count, error: countError } = await supabase
          .from('words-v1')
          .select('*', { count: 'exact', head: true })

        if (countError) throw countError
        setTotalWords(count || 0)

        // Fetch paginated words
        const from = (currentPage - 1) * wordsPerPage
        const to = from + wordsPerPage - 1

        const { data: wordsData, error: wordsError } = await supabase
          .from('words-v1')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to)

        if (wordsError) throw wordsError
        setWords(wordsData || [])

        // Fetch quiz results
        const { data: logData, error: logError } = await supabase
          .from('log')
          .select('*')
          .order('created_at', { ascending: true })

        if (logError) throw logError

        // Group results by word_id for the quiz results display
        const resultsByWord = (logData || []).reduce((acc: { [key: number]: QuizResult[] }, result) => {
          if (!acc[result.words_id]) {
            acc[result.words_id] = []
          }
          acc[result.words_id].push(result)
          return acc
        }, {})

        setQuizResults(resultsByWord)

        // Process calendar data
        const calendar: CalendarData = {}
        
        // Initialize current month's dates
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        
        for (let d = firstDay; d <= lastDay; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          calendar[dateStr] = { correct: 0, wrong: 0, added: 0 }
        }

        // Process quiz results for calendar
        logData?.forEach(log => {
          const date = new Date(log.created_at).toISOString().split('T')[0]
          if (calendar[date]) {
            if (log.result === 1) {
              calendar[date].correct++
            } else {
              calendar[date].wrong++
            }
          }
        })

        // Process added words for calendar
        wordsData?.forEach(word => {
          const date = new Date(word.created_at).toISOString().split('T')[0]
          if (calendar[date]) {
            calendar[date].added++
          }
        })

        setCalendarData(calendar)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [currentPage, currentDate, wordsPerPage])

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

  const toggleWordExpansion = (wordId: number) => {
    setExpandedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    )
  }

  const renderQuizResults = (wordId: number) => {
    const results = quizResults[wordId] || []
    const lastFiveResults = results.slice(-5)
    
    return (
      <div className="flex gap-1 items-center">
        {lastFiveResults.map((result, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full ${
              result.result === 1 ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
        ))}
        {[...Array(5 - lastFiveResults.length)].map((_, index) => (
          <div
            key={`empty-${index}`}
            className="w-3 h-3 rounded-full border border-gray-300"
          />
        ))}
      </div>
    )
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate)
      if (direction === 'prev') {
        newDate.setMonth(prevDate.getMonth() - 1)
      } else {
        newDate.setMonth(prevDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const renderCalendar = () => {
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()
    
    // Get first day of the month
    const firstDay = new Date(currentYear, currentMonth, 1)
    const startingDay = firstDay.getDay()
    
    // Get last day of the month
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const totalDays = lastDay.getDate()
    
    // Create array of week arrays
    const weeks: (number | null)[][] = []
    let currentWeek: (number | null)[] = Array(startingDay).fill(null)
    
    for (let day = 1; day <= totalDays; day++) {
      currentWeek.push(day)
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }
    
    // Fill in the last week if necessary
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-bold text-black">
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
          {weeks.flat().map((day, index) => {
            if (day === null) {
              return <div key={index} className="h-24 bg-gray-50 rounded" />
            }

            const date = new Date(currentYear, currentMonth, day)
            const dateStr = date.toISOString().split('T')[0]
            const stats = calendarData[dateStr] || { correct: 0, wrong: 0, added: 0 }
            const hasActivity = stats.correct > 0 || stats.wrong > 0 || stats.added > 0
            const isHighAchievement = stats.correct > 9

            return (
              <div
                key={index}
                className={`h-24 p-2 rounded border ${
                  isHighAchievement 
                    ? 'border-blue-400 bg-blue-200 hover:bg-blue-300' 
                    : hasActivity 
                      ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' 
                      : 'border-gray-200 hover:bg-gray-50'
                } transition-colors`}
              >
                <div className={`text-sm font-medium ${
                  isHighAchievement ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {day}
                </div>
                {hasActivity && (
                  <div className="mt-1 space-y-1 text-xs">
                    {stats.correct > 0 && (
                      <div className={`${
                        isHighAchievement ? 'text-blue-800' : 'text-green-600'
                      } font-medium`}>
                        ✓ {stats.correct}
                      </div>
                    )}
                    {stats.wrong > 0 && (
                      <div className="text-red-600">✗ {stats.wrong}</div>
                    )}
                    {stats.added > 0 && (
                      <div className={`${
                        isHighAchievement ? 'text-blue-800' : 'text-blue-600'
                      }`}>
                        + {stats.added}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalWords / wordsPerPage)

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
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
        <Header />

        {/* Calendar */}
        <div className="max-w-7xl mx-auto mb-8 bg-white rounded-lg shadow-md p-6">
          {renderCalendar()}
        </div>

        {/* Word List */}
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="text-sm text-gray-700">
                Showing words {((currentPage - 1) * wordsPerPage) + 1} to {Math.min(currentPage * wordsPerPage, totalWords)} of {totalWords}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange('prev')}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-full ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handlePageChange('next')}
                  disabled={currentPage >= totalPages}
                  className={`p-2 rounded-full ${currentPage >= totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Word List Content */}
            <div className="divide-y divide-gray-200">
              {words.map((word) => (
                <div key={word.id}>
                  <div 
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleWordExpansion(word.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <h3 className="text-lg font-medium text-gray-900 w-32">{word.name}</h3>
                        <span className="text-sm text-gray-600 w-20">{word.speech}</span>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-16 justify-center
                          ${word.level === 'C2' ? 'bg-purple-100 text-purple-800' :
                            word.level === 'C1' ? 'bg-blue-100 text-blue-800' :
                            word.level === 'B2' ? 'bg-green-100 text-green-800' :
                            word.level === 'B1' ? 'bg-yellow-100 text-yellow-800' :
                            word.level === 'A2' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'}`}
                        >
                          {word.level}
                        </span>
                        <div className="flex-1 ml-4">
                          {renderQuizResults(word.id)}
                        </div>
                      </div>
                      {expandedWords.includes(word.id) ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    
                    {expandedWords.includes(word.id) && (
                      <div className="mt-4 pl-32 space-y-2">
                        <div>
                          <p className="text-sm text-gray-600">Meaning:</p>
                          <p className="text-gray-900">{word.meaning}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Example:</p>
                          <p className="text-gray-900 italic">{word.example_sentence}</p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <div className="text-gray-500">
                            <span>Added: {formatDate(word.created_at)}</span>
                            <span className="ml-4">Source: {word.source}</span>
                          </div>
                          <div className="text-blue-600 font-medium">
                            Score: {word.score || 1}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange('prev')}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-full ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handlePageChange('next')}
                  disabled={currentPage >= totalPages}
                  className={`p-2 rounded-full ${currentPage >= totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
