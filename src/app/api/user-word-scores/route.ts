import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET endpoint to retrieve user word scores
export async function GET(request: NextRequest) {
  try {
    // Get the user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    
    // Get word_id from query params
    const searchParams = request.nextUrl.searchParams
    const wordId = searchParams.get('word_id')
    const wordIds = searchParams.get('word_ids')
    
    // If word_id is provided, get score for a single word
    if (wordId) {
      const { data, error } = await supabase
        .from('user_word_scores')
        .select('score')
        .eq('UID', userId)
        .eq('word_id', wordId)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ score: data?.score || 1 })
    }
    
    // If word_ids is provided, get scores for multiple words
    if (wordIds) {
      const wordIdArray = wordIds.split(',').map(id => parseInt(id, 10))
      
      const { data, error } = await supabase
        .from('user_word_scores')
        .select('word_id, score')
        .eq('UID', userId)
        .in('word_id', wordIdArray)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      // Create a map of word_id to score
      const scoreMap: Record<string, number> = {}
      data?.forEach(item => {
        scoreMap[item.word_id] = item.score
      })
      
      // Set default score of 1 for any words not found
      wordIdArray.forEach(id => {
        if (scoreMap[id] === undefined) {
          scoreMap[id] = 1
        }
      })
      
      return NextResponse.json({ scores: scoreMap })
    }
    
    // If no specific word_id or word_ids, get all scores for the user
    const { data, error } = await supabase
      .from('user_word_scores')
      .select('word_id, score')
      .eq('UID', userId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ scores: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
}

// POST endpoint to update a user's word score
export async function POST(request: NextRequest) {
  try {
    // Get the user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    
    // Parse the request body
    const body = await request.json()
    const { word_id, result } = body
    
    if (!word_id) {
      return NextResponse.json({ error: 'word_id is required' }, { status: 400 })
    }
    
    // Get the current score
    const { data: currentScoreData, error: scoreError } = await supabase
      .from('user_word_scores')
      .select('score')
      .eq('UID', userId)
      .eq('word_id', word_id)
      .single()
    
    let currentScore = 1 // Default score
    
    if (scoreError && scoreError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      return NextResponse.json({ error: scoreError.message }, { status: 500 })
    } else if (!scoreError) {
      currentScore = currentScoreData.score
    }
    
    // Calculate new score based on quiz result
    // If result is provided, increase score if correct (1), decrease if wrong (0)
    // If result is not provided, just use the score from the request body
    let newScore = currentScore
    if (result !== undefined) {
      newScore = result === 1 ? currentScore + 1 : Math.max(1, currentScore - 1)
    } else if (body.score !== undefined) {
      newScore = body.score
    }
    
    // Upsert the score
    const { error: upsertError } = await supabase
      .from('user_word_scores')
      .upsert({
        UID: userId,
        word_id,
        score: newScore,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'UID,word_id'
      })
    
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, score: newScore })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
} 