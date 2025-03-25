'use client'

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Header from '../../components/Header'
import { updateUserWordScore } from '../../utils/userWordScores'

// Define the Word type
interface Word {
  id: number
  name: string
  speech: string
  meaning: string
  level: string
  example_sentence: string
  score?: number // Keep this for backward compatibility
  user_score?: number // Add this for user-specific scores
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
  const { user } = useAuth()
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
      const query = supabase
        .from('log')
        .select('*')
        .eq('words_id', wordId)
        .order('created_at', { ascending: false })
        .limit(10)
        
      // Add user filter if user ID is available
      if (user?.id) {
        query.eq('UID', user.id)
      }
      
      const { data, error } = await query

      if (error) throw error
      setHistory(data || [])
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }, [user?.id])

  // Fetch daily correct count
  const fetchDailyCorrectCount = useCallback(async () => {
    try {
      // Skip if user ID isn't available
      if (!user?.id) {
        console.log('No user found, skipping daily count fetch');
        return;
      }
      
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0]
      
      // Query logs for today with result = 1 (correct)
      const query = supabase
        .from('log')
        .select('*', { count: 'exact' })
        .eq('result', 1)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        
      // Add user filter if user ID is available
      if (user?.id) {
        query.eq('UID', user.id)
      }
      
      const { error, count } = await query

      if (error) {
        console.error('Error fetching daily correct count:', error);
        // Don't set global error for this less critical function
        return;
      }
      
      setDailyCorrectCount(count || 0)
    } catch (error) {
      console.error('Error fetching daily correct count:', error)
      // Don't set global error for this less critical function
    }
  }, [user?.id])

  // Fetch a random word from Supabase with weighted probability based on score
  const fetchRandomWord = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if user exists before attempting to fetch data
      if (!user?.id) {
        console.log('No user found, skipping word fetch');
        setLoading(false);
        return;
      }
      
      // Only fetch words that are either from Oxford or added by the current user
      const { data, error } = await supabase
        .from('words-v1')
        .select('*')
        .or(`source.eq.oxford,and(source.eq.custom,UID.eq.${user.id})`)

      if (error) {
        console.error('Error fetching words:', error)
        setError(error instanceof Error ? error.message : 'An unknown error occurred')
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        console.error('No words found in database')
        setError('No words found in database')
        setLoading(false)
        return
      }

      // Get word IDs
      const wordIds = data.map(word => word.id)
      
      // Get user-specific scores for these words
      const { data: userScoresData, error: userScoresError } = await supabase
        .from('user_word_scores')
        .select('word_id, score')
        .eq('UID', user.id)
        .in('word_id', wordIds)
      
      // Check if we need to initialize scores for any words
      if (!userScoresError && userScoresData) {
        const scoredWordIds = userScoresData.map(score => score.word_id)
        const uninitialized = wordIds.filter(id => !scoredWordIds.includes(id))
        
        if (uninitialized.length > 0) {
          console.log(`Initializing scores for ${uninitialized.length} words...`)
          
          // Create records to upsert
          const records = uninitialized.map(wordId => ({
            UID: user.id,
            word_id: wordId,
            score: 1, // Default score
            updated_at: new Date().toISOString()
          }))
          
          // Batch upsert in chunks of 100 to avoid request size limits
          const chunkSize = 100
          for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize)
            
            const { error: upsertError } = await supabase
              .from('user_word_scores')
              .upsert(chunk, {
                onConflict: 'UID,word_id'
              })
            
            if (upsertError) {
              console.error('Error initializing user word scores:', upsertError)
              break
            }
          }
        }
      }
      
      // Create a map of word_id to score for quick lookup
      const userScoresMap: Record<number, number> = {}
      if (!userScoresError && userScoresData) {
        userScoresData.forEach(score => {
          userScoresMap[score.word_id] = score.score
        })
      }
      
      // Combine the words with their user-specific scores
      const wordsWithScores = data.map(word => ({
        ...word,
        user_score: userScoresMap[word.id] || 1 // Use user score if available, default to 1
      }))

      // Calculate total score for weighted probability
      const totalScore = wordsWithScores.reduce((sum, word) => sum + (word.user_score || 1), 0)
      
      // Generate a random number between 0 and totalScore
      let random = Math.random() * totalScore
      let selectedWord = wordsWithScores[0]
      
      // Select a word based on weighted probability
      for (const word of wordsWithScores) {
        random -= (word.user_score || 1)
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
  }, [getRandomSentence, fetchHistory, user?.id])

  const updateWordScore = async (wordId: number, isCorrect: boolean) => {
    if (!user?.id || !wordId) return;
    
    try {
      // Update user-specific score
      await updateUserWordScore(user.id, wordId, isCorrect ? 1 : 0);
      
      // Update the current word's score in state
      if (currentWord && currentWord.id === wordId) {
        const currentScore = currentWord.user_score || 1;
        const newScore = isCorrect ? currentScore + 1 : Math.max(1, currentScore - 1);
        setCurrentWord({
          ...currentWord,
          user_score: newScore
        });
      }
    } catch (error) {
      console.error('Error updating word score:', error);
    }
  }

  const checkAnswer = async (input: string) => {
    const correct = input.toLowerCase() === currentWord?.name.toLowerCase()
    setIsCorrect(correct)
    setShowResult(true)

    // Only log the result if we haven't logged for this word yet
    if (!hasLogged && currentWord) {
      // Update the word's score
      await updateWordScore(currentWord.id, correct)

      const { error } = await supabase
        .from('log')
        .insert({
          words_id: currentWord.id,
          result: correct ? 1 : 0,
          UID: user?.id
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
      await updateWordScore(currentWord.id, false)

      const { error } = await supabase
        .from('log')
        .insert({
          words_id: currentWord.id,
          result: 0,  // Mark as incorrect
          UID: user?.id
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
      
      // Check if user exists before attempting to fetch data
      if (!user?.id) {
        console.log('No user found, skipping today logs fetch');
        setLoading(false);
        return;
      }
      
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0]
      
      // Query logs for today - filter by user ID if available
      const logQuery = supabase
        .from('log')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });
        
      // Add user filter if user ID is available
      if (user?.id) {
        logQuery.eq('UID', user.id);
      }
      
      const { data: logData, error: logError } = await logQuery;

      if (logError) {
        console.error("Error fetching logs:", logError);
        setError(logError.message || "Failed to fetch today's logs");
        setLoading(false);
        return;
      }

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

      if (wordsError) {
        console.error("Error fetching words:", wordsError);
        setError(wordsError.message || "Failed to fetch word details");
        setLoading(false);
        return;
      }

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
      console.error("Error fetching today's logs:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Modify the useEffect to include fetchTodayLogs when showing review
  useEffect(() => {
    // Only proceed if we're not in a loading state from AuthContext
    const loadData = async () => {
      if (showReview) {
        await fetchTodayLogs();
      } else {
        await fetchRandomWord();
        await fetchDailyCorrectCount();
      }
    };
    
    // Don't run data fetching if user isn't available yet
    if (!user?.id) {
      // Set a reasonable timeout to prevent endless loading if auth fails
      const timer = setTimeout(() => {
        if (loading) {
          setLoading(false);
          setError("Please sign in to access the quiz.");
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    loadData();
  }, [fetchRandomWord, fetchDailyCorrectCount, fetchTodayLogs, showReview, user?.id]);

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

  if (loading) return (
    <div className="min-h-screen p-8">
      <Header />
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-32"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading your quiz, please wait...</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen p-8">
      <Header />
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-red-500 font-medium text-lg mb-2">{error}</p>
          {error.includes("sign in") && (
            <button 
              onClick={() => window.location.href = '/signin'} 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Go to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
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
              🎉 Congratulations! You{"'"}ve reached your daily goal!
            </p>
          )}
        </div>

        {showReview ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-black">Today{"'"}s Review</h2>
            
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
                        {log.attempts} {log.attempts === 1 ? "attempt" : "attempts"} today
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
  )
}