import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Note: Use server-side environment variable
})

export async function POST(req: NextRequest) {
  try {
    const { word } = await req.json()

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'No content generated' }, { status: 500 })
    }

    try {
      const parsedData = JSON.parse(content.trim())
      
      // Validate the response structure
      if (!parsedData.speech || !parsedData.meaning || !parsedData.example_sentence || !parsedData.level) {
        return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 })
      }

      return NextResponse.json(parsedData)
    } catch (error) {
      console.error('JSON Parse Error:', content)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
}

// Add OPTIONS method to handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
} 