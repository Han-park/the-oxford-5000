'use client'

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect, useCallback, useRef } from 'react'
// import { useAuth } from '../../contexts/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'
import Header from '../../components/Header'

// Define the Word type
interface Word {
  id: number
  name: string
  speech: string
  meaning: string
  level: string
  example_sentence: string
  score: number
}

// Add this to your existing interfaces
interface LogEntry {
  id: number
  created_at: string
  words_id: number
  result: number
}

// Add this interface for today's logs
interface TodayLogEntry {
  id: number
  created_at: string
  words_id: number
  result: number
  word: Word
  attempts: number
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function QuizPage() {
  const [currentWord, setCurrentWord] = useState<Word | null>(null)
  const [userInput, setUserInput] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [randomSentence, setRandomSentence] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [revealedHints, setRevealedHints] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<LogEntry[]>([])
  const [hasLogged, setHasLogged] = useState(false)
  const [dailyCorrectCount, setDailyCorrectCount] = useState(0)
  const [dailyGoal] = useState(10) // Daily goal of 10 correct answers
  const [showReview, setShowReview] = useState(false)
  const [todayLogs, setTodayLogs] = useState<TodayLogEntry[]>([])
  
  // Add a ref for the input field
  const inputRef = useRef<HTMLInputElement>(null)

  // Function to get a random sentence from example_sentence
  const getRandomSentence = useCallback((exampleSentence: string) => {
    if (!exampleSentence) return ''
    
    // Split by period, filter out empty strings, and trim
    const sentences = exampleSentence
      .split('.')
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + '.')
    
    if (sentences.length === 0) return exampleSentence
    
    // Get a random sentence
    const randomIndex = Math.floor(Math.random() * sentences.length)
    return sentences[randomIndex]
  }, [])

  // Fetch history for a word
  const fetchHistory = useCallback(async (wordId: number) => {
    try {
      const { data, error } = await supabase
        .from('log')
        .select('*')
        .eq('words_id', wordId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }, [])

  // Fetch daily correct count
  const fetchDailyCorrectCount = useCallback(async () => {
    try {
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0]
      
      // Query logs for today with result = 1 (correct)
      const { data, error, count } = await supabase
        .from('log')
        .select('*', { count: 'exact' })
        .eq('result', 1)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)

      if (error) throw error
      setDailyCorrectCount(count || 0)
    } catch (error) {
      console.error('Error fetching daily correct count:', error)
    }
  }, [])

  // Fetch a random word from Supabase with weighted probability based on score
  const fetchRandomWord = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('words-v1')
        .select('*')

      if (error) {
        console.error('Error fetching words:', error)
        setError(error instanceof Error ? error.message : 'An unknown error occurred')
        return
      }

      if (!data || data.length === 0) {
        console.error('No words found in database')
        setError('No words found in database')
        return
      }

      // Calculate total score for weighted probability
      const totalScore = data.reduce((sum, word) => sum + (word.score || 1), 0)
      
      // Generate a random number between 0 and totalScore
      let random = Math.random() * totalScore
      let selectedWord = data[0]
      
      // Select a word based on weighted probability
      for (const word of data) {
        random -= (word.score || 1)
        if (random <= 0) {
          selectedWord = word
          break
        }
      }

      setCurrentWord(selectedWord)
      setRandomSentence(getRandomSentence(selectedWord.example_sentence))
      setUserInput('')
      setShowResult(false)
      setShowAnswer(false)
      setRevealedHints([])
      setHasLogged(false)  // Reset the logging flag for the new word
      
      // Fetch history for the new word
      await fetchHistory(selectedWord.id)

      // Focus the input field after a short delay to ensure the DOM is updated
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } catch (error) {
      console.error('Error:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unknown error occurred')
      }
    } finally {
      setLoading(false)
    }
  }, [getRandomSentence, fetchHistory])

  const updateWordScore = async (wordId: number, currentScore: number, isCorrect: boolean) => {
    const newScore = isCorrect ? currentScore * 2 : currentScore * 3
    
    const { error } = await supabase
      .from('words-v1')
      .update({ score: newScore })
      .eq('id', wordId)

    if (error) {
      console.error('Error updating word score:', error)
    }
  }

  const checkAnswer = async (input: string) => {
    const correct = input.toLowerCase() === currentWord?.name.toLowerCase()
    setIsCorrect(correct)
    setShowResult(true)

    // Only log the result if we haven't logged for this word yet
    if (!hasLogged && currentWord) {
      // Update the word's score
      await updateWordScore(currentWord.id, currentWord.score || 1, correct)

      const { error } = await supabase
        .from('log')
        .insert({
          words_id: currentWord.id,
          result: correct ? 1 : 0
        })

      if (error) {
        console.error('Error logging result:', error)
      } else {
        setHasLogged(true)  // Mark that we've logged for this word
        // Update the history immediately after logging
        await fetchHistory(currentWord.id)
        
        // If answer was correct, update daily correct count
        if (correct) {
          setDailyCorrectCount(prev => prev + 1)
        }
      }
    }
  }

  const handleNextWord = () => {
    fetchRandomWord()
  }

  const handleTryAgain = () => {
    setShowResult(false)
    setUserInput('')
    // Focus the input field
    inputRef.current?.focus()
  }

  const showLetterHint = () => {
    if (!currentWord || showResult) return
    
    // Find indices of letters that haven't been revealed yet
    const unrevealed = Array.from({ length: currentWord.name.length })
      .map((_, i) => i)
      .filter(i => !revealedHints.includes(i))
    
    if (unrevealed.length === 0) return
    
    // Reveal 1-2 new letters
    const numToReveal = Math.min(Math.ceil(currentWord.name.length / 4), unrevealed.length)
    const newHints = []
    
    for (let i = 0; i < numToReveal; i++) {
      const randomIndex = Math.floor(Math.random() * unrevealed.length)
      newHints.push(unrevealed[randomIndex])
      unrevealed.splice(randomIndex, 1)
    }
    
    setRevealedHints([...revealedHints, ...newHints])
    // Focus the input field after showing hint
    inputRef.current?.focus()
  }

  const handleSkipWord = async () => {
    // Log the skipped word as incorrect and update score
    if (!hasLogged && currentWord) {
      // Update the word's score (treat skip as incorrect)
      await updateWordScore(currentWord.id, currentWord.score || 1, false)

      const { error } = await supabase
        .from('log')
        .insert({
          words_id: currentWord.id,
          result: 0  // Mark as incorrect
        })

      if (error) {
        console.error('Error logging result:', error)
      } else {
        setHasLogged(true)
        await fetchHistory(currentWord.id)
      }
    }
    // Move to next word
    fetchRandomWord()
  }

  // Update this function to format the date in local timezone
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Add a function to fetch today's quiz logs
  const fetchTodayLogs = useCallback(async () => {
    try {
      setLoading(true)
      
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0]
      
      // Query logs for today
      const { data: logData, error: logError } = await supabase
        .from('log')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false })

      if (logError) throw logError

      if (!logData || logData.length === 0) {
        setTodayLogs([])
        setLoading(false)
        return
      }

      // Get unique word IDs from today's logs
      const wordIds = [...new Set(logData.map(log => log.words_id))]
      
      // Fetch word details for these IDs
      const { data: wordsData, error: wordsError } = await supabase
        .from('words-v1')
        .select('*')
        .in('id', wordIds)

      if (wordsError) throw wordsError

      // Create a map of word IDs to word objects
      const wordMap = (wordsData || []).reduce((acc: {[key: number]: Word}, word) => {
        acc[word.id] = word
        return acc
      }, {})

      // Count attempts for each word
      const attemptCounts: {[key: number]: number} = {}
      logData.forEach(log => {
        if (!attemptCounts[log.words_id]) {
          attemptCounts[log.words_id] = 0
        }
        attemptCounts[log.words_id]++
      })

      // Create the final logs with word details
      // Group by word ID and take the most recent result for each word
      const wordResults: {[key: number]: TodayLogEntry} = {}
      
      logData.forEach(log => {
        // If we haven't seen this word yet or this is a more recent entry
        if (!wordResults[log.words_id] || new Date(log.created_at) > new Date(wordResults[log.words_id].created_at)) {
          wordResults[log.words_id] = {
            ...log,
            word: wordMap[log.words_id],
            attempts: attemptCounts[log.words_id]
          }
        }
      })

      setTodayLogs(Object.values(wordResults))
    } catch (error) {
      console.error('Error fetching today\'s logs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Modify the useEffect to include fetchTodayLogs when showing review
  useEffect(() => {
    if (showReview) {
      void fetchTodayLogs()
    } else {
      void fetchRandomWord()
      void fetchDailyCorrectCount()
    }
  }, [fetchRandomWord, fetchDailyCorrectCount, fetchTodayLogs, showReview])

  // Add a function to toggle the review mode
  const toggleReview = () => {
    setShowReview(!showReview)
  }

  // Handle key press events for the entire quiz section
  const handleKeyPress = (e: React.KeyboardEvent) => {
    // If Enter is pressed and result is shown or answer is shown, go to next word
    if (e.key === 'Enter' && (showResult || showAnswer)) {
      handleNextWord()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toLowerCase()
    setUserInput(input)

    if (input.length === currentWord?.name.length) {
      checkAnswer(input)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        {/* Header */}
        <Header />

        <div className="max-w-2xl mx-auto">
          {/* Daily Progress Bar */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-black">Daily Progress</h3>
              <div className="flex items-center gap-4">
                <span className="text-black font-medium">{dailyCorrectCount} / {dailyGoal} correct answers</span>
                <button
                  onClick={toggleReview}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                >
                  {showReview ? 'Back to Quiz' : 'Review Today'}
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-green-500 h-4 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${Math.min(100, (dailyCorrectCount / dailyGoal) * 100)}%` }}
              ></div>
            </div>
            {dailyCorrectCount >= dailyGoal && (
              <p className="text-green-600 font-medium mt-2">
                🎉 Congratulations! You've reached your daily goal!
              </p>
            )}
          </div>

          {showReview ? (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-4 text-black">Today's Review</h2>
              
              {todayLogs.length > 0 ? (
                <div className="space-y-4">
                  {todayLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-black">{log.word?.name}</h3>
                          <p className="text-gray-600">{log.word?.speech} • Level {log.word?.level}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          log.result === 1 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.result === 1 ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-black"><span className="font-medium">Meaning:</span> {log.word?.meaning}</p>
                        <p className="text-black mt-1"><span className="font-medium">Example:</span> <span className="italic">{log.word?.example_sentence}</span></p>
                      </div>
                      
                      <div className="mt-2 flex justify-between items-center text-sm">
                        <span className="text-gray-500">
                          {formatDate(log.created_at)}
                        </span>
                        <span className="text-blue-600">
                          {log.attempts} {log.attempts === 1 ? 'attempt' : 'attempts'} today
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No quiz activity today. Start taking quizzes!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6" onKeyDown={handleKeyPress}>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-black">Word Quiz</h2>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-black">Part of Speech: {currentWord?.speech}</p>
                    <p className="font-semibold text-black">Level: {currentWord?.level}</p>
                    <p className="mt-2 text-black">Meaning: {currentWord?.meaning}</p>
                    <p className="mt-2 italic text-black">Example: {randomSentence?.replace(currentWord?.name || '', '_'.repeat(currentWord?.name?.length || 0))}</p>
                  </div>

                  {/* Letter boxes */}
                  <div className="flex justify-center gap-2 my-6 text-black">
                    {Array.from({length: currentWord?.name?.length || 0}).map((_, index) => (
                      <div
                        key={index}
                        className={`
                          w-12 h-12 border-2 flex items-center justify-center text-xl font-bold
                          ${showResult && isCorrect ? 'border-green-500 bg-green-100 text-black' : ''}
                          ${showResult && !isCorrect ? 'border-red-500 bg-red-100 text-black' : ''}
                          ${!showResult ? 'border-gray-300 text-black' : ''}
                        `}
                      >
                        {revealedHints.includes(index) ? currentWord?.name[index] : (userInput[index] || '')}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded text-black"
                      placeholder="Type your answer..."
                      maxLength={currentWord?.name.length}
                      disabled={showResult && isCorrect}
                      autoFocus
                    />
                  </div>

                  {/* Hint, Show Answer, and Skip buttons */}
                  <div className="flex gap-2 justify-center mt-4">
                    <button
                      onClick={showLetterHint}
                      className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-600 hover:text-white"
                      disabled={showResult && isCorrect}
                    >
                      Show Hint
                    </button>
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="px-4 py-2 bg-gray-200 text-gray-600 rounded hover:bg-gray-600 hover:text-white"
                      disabled={showResult && isCorrect}
                    >
                      Show Answer
                    </button>
                    <button
                      onClick={handleSkipWord}
                      className="px-4 py-2 bg-yellow-200 text-yellow-700 rounded hover:bg-yellow-300"
                      disabled={showResult && isCorrect}
                    >
                      Skip Word
                    </button>
                  </div>

                  {/* Show result */}
                  {showResult && (
                    <div className={`mt-6 p-4 rounded ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                      <p className={`text-lg font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {isCorrect ? 'Correct!' : 'Incorrect!'}
                      </p>
                      {!isCorrect && (
                        <p className="mt-2 text-black">
                          The correct answer is: <span className="font-bold">{currentWord?.name}</span>
                        </p>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={handleNextWord}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Next Word
                        </button>
                        {!isCorrect && (
                          <button
                            onClick={handleTryAgain}
                            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            Try Again
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Press Enter to continue to the next word</p>
                    </div>
                  )}

                  {/* Show answer */}
                  {showAnswer && !showResult && (
                    <div className="mt-6 p-4 bg-blue-100 rounded">
                      <p className="text-black">
                        The answer is: <span className="font-bold">{currentWord?.name}</span>
                      </p>
                      <button
                        onClick={handleNextWord}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Next Word
                      </button>
                      <p className="text-sm text-gray-500 mt-2">Press Enter to continue to the next word</p>
                    </div>
                  )}
                </div>
              </div>

              {/* History Section */}
              <div className="bg-white p-6 rounded-lg shadow-md mt-8">
                <h3 className="text-xl font-bold mb-4 text-black">Attempt History</h3>
                {history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                      <thead>
                        <tr className="bg-gray-100 text-black">
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-left">Result</th>
                        </tr>
                      </thead>
                      <tbody className="text-black">
                        {history.map((entry, index) => (
                          <tr key={entry.id} className="border-t">
                            <td className="px-4 py-2">{index + 1}</td>
                            <td className="px-4 py-2">{formatDate(entry.created_at)}</td>
                            <td className="px-4 py-2">
                              <span className={entry.result === 1 ? 'text-green-600' : 'text-red-600'}>
                                {entry.result === 1 ? 'Correct' : 'Incorrect'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No history available for this word.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}