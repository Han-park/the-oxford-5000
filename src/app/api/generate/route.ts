import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Note: Use server-side environment variable
})

export async function POST(req: NextRequest) {
  try {
    // Log that we've received a request
    console.log('API route called with request:', req.url)
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables')
      return NextResponse.json({ error: 'API key configuration error' }, { status: 500 })
    }

    const { word } = await req.json()

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    console.log(`Generating data for word: ${word}`)

    const prompt = `Generate information for the word "${word}" with the following requirements:
    - Part of speech (noun, verb, adjective, etc.)
    - Clear and concise definition without using the word in the definition.
    - Three example sentences using the word. Use "____" to indicate the word in the sentence.
    - Difficulty level (A1, A2, B1, B2, C1, C2)
    
    Respond ONLY with a JSON object in this exact format, with no additional text or markdown:
    {
      "speech": "your_response",
      "meaning": "your_response",
      "example_sentence": "First sentence. Second sentence. Third sentence.",
      "level": "your_response"
    }`

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ 
          role: "user",
          content: prompt 
        }],
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })

      const content = completion.choices[0].message.content
      if (!content) {
        console.error('No content generated from OpenAI')
        return NextResponse.json({ error: 'No content generated' }, { status: 500 })
      }

      console.log('Successfully received response from OpenAI')

      try {
        const parsedData = JSON.parse(content.trim())
        
        // Validate the response structure
        if (!parsedData.speech || !parsedData.meaning || !parsedData.example_sentence || !parsedData.level) {
          console.error('Invalid response format from AI:', parsedData)
          return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 })
        }

        return NextResponse.json(parsedData)
      } catch (parseError) {
        console.error('JSON Parse Error:', content, parseError)
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }
    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError)
      return NextResponse.json({ 
        error: 'Error communicating with OpenAI API', 
        details: openaiError instanceof Error ? openaiError.message : 'Unknown error'
      }, { status: 503 })
    }
  } catch (error) {
    console.error('General API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
}

// Add OPTIONS method to handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
} 