import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Get a user's score for a specific word
 */
export async function getUserWordScore(userId: string, wordId: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('user_word_scores')
      .select('score')
      .eq('UID', userId)
      .eq('word_id', wordId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return 1 // Default score
      }
      console.error('Error fetching user word score:', error)
      throw error
    }
    
    return data?.score || 1
  } catch (error) {
    console.error('Error in getUserWordScore:', error)
    return 1 // Default to 1 on error
  }
}

/**
 * Get scores for multiple words for a user
 */
export async function getUserWordScores(userId: string, wordIds: number[]): Promise<Record<number, number>> {
  try {
    if (!wordIds.length) return {}
    
    const { data, error } = await supabase
      .from('user_word_scores')
      .select('word_id, score')
      .eq('UID', userId)
      .in('word_id', wordIds)
    
    if (error) {
      console.error('Error fetching user word scores:', error)
      throw error
    }
    
    // Create a map of word_id to score
    const scoreMap: Record<number, number> = {}
    data?.forEach(item => {
      scoreMap[item.word_id] = item.score
    })
    
    // Set default score of 1 for any words not found
    wordIds.forEach(id => {
      if (scoreMap[id] === undefined) {
        scoreMap[id] = 1
      }
    })
    
    return scoreMap
  } catch (error) {
    console.error('Error in getUserWordScores:', error)
    // Return default scores on error
    return wordIds.reduce((acc, id) => {
      acc[id] = 1
      return acc
    }, {} as Record<number, number>)
  }
}

/**
 * Update a user's score for a specific word
 */
export async function updateUserWordScore(userId: string, wordId: number, result: number): Promise<number> {
  try {
    // First get the current score
    const currentScore = await getUserWordScore(userId, wordId)
    
    // Calculate new score based on quiz result
    // Increase score if correct, decrease if wrong (minimum 1)
    const newScore = result === 1 ? currentScore + 1 : Math.max(1, currentScore - 1)
    
    // Upsert the score
    const { error } = await supabase
      .from('user_word_scores')
      .upsert({
        UID: userId,
        word_id: wordId,
        score: newScore,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'UID,word_id'
      })
    
    if (error) {
      console.error('Error updating user word score:', error)
      throw error
    }
    
    return newScore
  } catch (error) {
    console.error('Error in updateUserWordScore:', error)
    return 1 // Default to 1 on error
  }
}

/**
 * Initialize scores for a user for multiple words
 * Useful when a user first starts using the app
 */
export async function initializeUserWordScores(userId: string, wordIds: number[]): Promise<void> {
  try {
    if (!wordIds.length) return
    
    // Create records to upsert
    const records = wordIds.map(wordId => ({
      UID: userId,
      word_id: wordId,
      score: 1, // Default score
      updated_at: new Date().toISOString()
    }))
    
    // Batch upsert in chunks of 100 to avoid request size limits
    const chunkSize = 100
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize)
      
      const { error } = await supabase
        .from('user_word_scores')
        .upsert(chunk, {
          onConflict: 'UID,word_id'
        })
      
      if (error) {
        console.error('Error initializing user word scores:', error)
        throw error
      }
    }
  } catch (error) {
    console.error('Error in initializeUserWordScores:', error)
  }
} 