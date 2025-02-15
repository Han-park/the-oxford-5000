'use client'

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
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
  const { signOut } = useAuth()

  // Function to get a random sentence from example_sentence
  const getRandomSentence = useCallback((sentences: string) => {
    const sentenceArray = sentences.split('. ')
    const randomIndex = Math.floor(Math.random() * sentenceArray.length)
    return sentenceArray[randomIndex].trim()
  }, [])

  // Add this function to fetch history
  const fetchHistory = useCallback(async (wordId: number) => {
    const { data, error } = await supabase
      .from('log')
      .select('*')
      .eq('words_id', wordId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching history:', error)
      return
    }

    setHistory(data || [])
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
    const newScore = isCorrect ? currentScore + 1 : currentScore + 5
    
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
      }
    }
  }

  const handleNextWord = () => {
    fetchRandomWord()
  }

  const handleTryAgain = () => {
    setShowResult(false)
    setUserInput('')
  }

  const showLetterHint = () => {
    if (!currentWord) return;
    
    // Calculate how many letters to reveal (1/3 of the word length)
    const numLettersToReveal = Math.ceil(currentWord.name.length / 3);
    
    // Get available indices that haven't been revealed yet
    const availableIndices = Array.from({ length: currentWord.name.length }, (_, i) => i)
      .filter(index => !revealedHints.includes(index));
    
    // If we've already revealed all possible hints, return
    if (availableIndices.length === 0) return;
    
    // Randomly select indices to reveal
    const newHints = [];
    for (let i = 0; i < Math.min(numLettersToReveal, availableIndices.length); i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      newHints.push(availableIndices[randomIndex]);
      availableIndices.splice(randomIndex, 1);
    }
    
    setRevealedHints([...revealedHints, ...newHints]);
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

  useEffect(() => {
    void fetchRandomWord()
  }, [fetchRandomWord])

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
          <div className="space-y-6">
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
              </div>
            </div>

            {showResult && (
              <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className="text-center font-bold text-black">
                  {isCorrect ? 'Correct! 🎉' : 'Try again!'}
                </p>
                {showAnswer && !isCorrect && (
                  <p className="text-center mt-2 text-black">The answer is: {currentWord?.name}</p>
                )}
                {(isCorrect || showAnswer) ? (
                  <button
                    onClick={handleNextWord}
                    className="mt-4 w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Next Word
                  </button>
                ) : (
                  <button
                    onClick={handleTryAgain}
                    className="mt-4 w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}

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
                            <span 
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${entry.result === 1 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {entry.result === 1 ? 'Correct' : 'Wrong'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">There is no history</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}