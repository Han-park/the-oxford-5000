import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Step 1: Create the user_word_scores table if it doesn't exist
    const { error: tableError } = await supabaseAdmin
      .from('user_word_scores')
      .select('id')
      .limit(1)
      .single()

    // If the table doesn't exist, create it
    if (tableError && tableError.message.includes('does not exist')) {
      console.log('Creating user_word_scores table...')
      
      // Create the table using REST API
      const { error: createError } = await supabaseAdmin.rpc('create_user_word_scores_table')
      
      if (createError) {
        console.error('Error creating table:', createError)
        return NextResponse.json({ 
          success: false, 
          error: createError.message,
          message: 'Failed to create user_word_scores table. Please check server logs.'
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'user_word_scores table created successfully' 
      })
    } else if (tableError) {
      // Some other error occurred
      console.error('Error checking table existence:', tableError)
      return NextResponse.json({ 
        success: false, 
        error: tableError.message 
      }, { status: 500 })
    }
    
    // Table already exists
    return NextResponse.json({ 
      success: true, 
      message: 'user_word_scores table already exists' 
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Please create the table manually using the SQL in the documentation'
      },
      { status: 500 }
    )
  }
} 