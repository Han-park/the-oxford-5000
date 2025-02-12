"use client";

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

// Define the Word type
interface Word {
  id: number
  name: string
  speech: string
  meaning: string
  level: string
  example_sentence: string
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

export default function WordQuiz() {
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

  // Function to get a random sentence from example_sentence
  const getRandomSentence = (sentences: string) => {
    const sentenceArray = sentences.split('. ')
    const randomIndex = Math.floor(Math.random() * sentenceArray.length)
    return sentenceArray[randomIndex].trim()
  }

  // Add this function to fetch history
  const fetchHistory = async (wordId: number) => {
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
  }

  // Fetch a random word from Supabase
  const fetchRandomWord = async () => {
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

      const randomIndex = Math.floor(Math.random() * data.length)
      const randomWord = data[randomIndex]

      setCurrentWord(randomWord)
      setRandomSentence(getRandomSentence(randomWord.example_sentence))
      setUserInput('')
      setShowResult(false)
      setShowAnswer(false)
      setRevealedHints([])
      
      // Fetch history for the new word
      const wordId = randomWord.id;
      await fetchHistory(wordId)
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
  }

  useEffect(() => {
    fetchRandomWord()
  }, [])

  // Log currentWord whenever it changes
  useEffect(() => {
    console.log('Current Word:', currentWord)
  }, [currentWord])

  // Log the length of history whenever it changes
  useEffect(() => {
    console.log('History length:', history.length);
  }, [history])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toLowerCase()
    setUserInput(input)

    if (input.length === currentWord?.name.length) {
      checkAnswer(input)
    }
  }

  const checkAnswer = async (input: string) => {
    const correct = input.toLowerCase() === currentWord?.name.toLowerCase()
    setIsCorrect(correct)
    setShowResult(true)

    // Log the result to Supabase
    if (currentWord) {
      const { error } = await supabase
        .from('log')
        .insert({
          words_id: currentWord.id,
          result: correct ? 1 : 0
        })

      if (error) {
        console.error('Error logging result:', error)
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
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use local timezone
    })
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto text-black">
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
            <div className="flex justify-center gap-2 my-6">
              {Array.from({length: currentWord?.name?.length || 0}).map((_, index) => (
                <div
                  key={index}
                  className={`
                    w-12 h-12 border-2 flex items-center justify-center text-xl font-bold
                    ${showResult && isCorrect ? 'border-green-500 bg-green-100' : ''}
                    ${showResult && !isCorrect ? 'border-red-500 bg-red-100' : ''}
                    ${!showResult ? 'border-gray-300' : ''}
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
                className="w-full p-2 border rounded"
                placeholder="Type your answer..."
                maxLength={currentWord?.name.length}
                disabled={showResult && isCorrect}
                autoFocus
              />
            </div>

            {/* Hint and Show Answer buttons */}
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
            </div>
          </div>
        </div>

        {showResult && (
          <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
            <p className="text-center font-bold">
              {isCorrect ? 'Correct! 🎉' : 'Try again!'}
            </p>
            {showAnswer && !isCorrect && (
              <p className="text-center mt-2">The answer is: {currentWord?.name}</p>
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
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Result</th>
                  </tr>
                </thead>
                <tbody>
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
  )
}
