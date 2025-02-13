'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import OpenAI from 'openai'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, you should use API routes
})

interface WordData {
  name: string
  speech: string
  meaning: string
  example_sentence: string
  level: string
  source: string
}

// Modify the checkWordExists function to remove spaces
const checkWordExists = async (word: string) => {
  // Remove all spaces from the word
  const cleanWord = word.replace(/\s+/g, '')
  
  const { data, error } = await supabase
    .from('words-v1')
    .select('name')
    .eq('name', cleanWord)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
    throw error
  }

  return !!data
}

export default function AddPage() {
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedData, setGeneratedData] = useState<WordData | null>(null)

  const generateWordData = async (word: string) => {
    try {
      setLoading(true)
      setError(null)

      const prompt = `Generate information for the word "${word}" with the following requirements:
      - Part of speech (noun, verb, adjective, etc.)
      - Clear and concise definition
      - Three example sentences using the word. Use "____" to indicate the word in the sentence.
      - Difficulty level (A1, A2, B1, B2, C1, C2)
      
      Respond ONLY with a JSON object in this exact format, with no additional text or markdown:
      {
        "speech": "your_response",
        "meaning": "your_response",
        "example_sentence": "First sentence. Second sentence. Third sentence.",
        "level": "your_response"
      }`

      const completion = await openai.chat.completions.create({
        messages: [{ 
          role: "user" as const,
          content: prompt 
        }],
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" } // Add this to ensure JSON response
      })

      const content = completion.choices[0].message.content
      if (!content) throw new Error('No content generated')

      try {
        const parsedData = JSON.parse(content.trim())
        
        // Validate the response structure
        if (!parsedData.speech || !parsedData.meaning || !parsedData.example_sentence || !parsedData.level) {
          throw new Error('Invalid response format from AI')
        }

        setGeneratedData({
          name: word,
          ...parsedData,
          source: 'custom'
        })
      } catch (error) {
        console.error('JSON Parse Error:', content)
        throw new Error('Failed to parse AI response')
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Modify the handleSubmit function to handle spaces properly
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!word.trim()) return

    try {
      setLoading(true)
      setError(null)

      // Remove all spaces and convert to lowercase
      const cleanWord = word.trim().toLowerCase().replace(/\s+/g, '')
      
      // Check if word already exists
      const exists = await checkWordExists(cleanWord)
      
      if (exists) {
        setError(`The word "${cleanWord}" already exists in the database.`)
        return
      }

      // If word doesn't exist, proceed with generation using the clean word
      await generateWordData(cleanWord)
    } catch (err) {
      console.error('Error checking word existence:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Also update the input field to clean the word as it's typed
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow spaces in the input but store the cleaned version
    setWord(e.target.value)
  }

  const handleAdd = async () => {
    if (!generatedData) return

    try {
      setLoading(true)
      
      // Log the data before insertion
      console.log('Attempting to insert data:', {
        name: generatedData.name,
        speech: generatedData.speech,
        meaning: generatedData.meaning,
        example_sentence: generatedData.example_sentence,
        level: generatedData.level,
        source: generatedData.source
      })

      const { data, error } = await supabase
        .from('words-v1')
        .insert([{
          ...generatedData,
          source: 'custom'
        }])
        .select()

      if (error) {
        console.error('Supabase insertion error:', error)
        throw error
      }

      // Log successful insertion
      console.log('Successfully inserted data:', data)

      // Reset form
      setWord('')
      setGeneratedData(null)
      alert('Word added successfully!')
    } catch (err) {
      console.error('Error during insertion:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setWord('')
    setGeneratedData(null)
    setError(null)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-black mb-4">Add New Word</h1>
        
        {/* Word Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={word}
              onChange={handleInputChange}
              placeholder="Enter a word (spaces will be ignored)"
              className="flex-1 p-2 border rounded text-black"
              disabled={loading || !!generatedData}
            />
            <button
              type="submit"
              disabled={loading || !word || !!generatedData}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Generated Data Preview */}
        {generatedData && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-black">Preview</h2>
            <div className="space-y-4">
              <div className="text-black">
                <p className="font-semibold">Word: {generatedData.name}</p>
                <p>Part of Speech: {generatedData.speech}</p>
                <p>Level: {generatedData.level}</p>
                <p>Meaning: {generatedData.meaning}</p>
                <p>Example Sentences:</p>
                <ul className="list-disc pl-5">
                  {generatedData.example_sentence.split('.').map((sentence, index) => (
                    sentence.trim() && (
                      <li key={index} className="mt-1">
                        {sentence.trim()}.
                      </li>
                    )
                  ))}
                </ul>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                >
                  {loading ? 'Adding...' : 'Add Word'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
} 