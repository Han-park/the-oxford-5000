#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

async function runMigration() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or key is missing in environment variables')
      process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read the SQL file
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../src/supabase/migrations/20240601_create_user_word_scores.sql'),
      'utf8'
    )

    console.log('Running migration to create user_word_scores table...')

    // Execute the SQL directly using the REST API
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql })

    if (error) {
      console.error('Error executing migration SQL:', error)
      
      // If exec_sql doesn't exist, we need to create the function manually
      if (error.message.includes('Could not find the function')) {
        console.log('Creating exec_sql function...')
        
        // Create the exec_sql function
        const createExecSqlFn = `
          CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
        
        // Use a direct query to create the function
        const { error: fnError } = await supabase.from('_exec_sql_temp').select('*').limit(1).then(
          () => ({ error: null }),
          async () => {
            // Table doesn't exist, create it temporarily
            await supabase.rpc('exec_direct_sql', { sql: createExecSqlFn })
            return { error: null }
          }
        )
        
        if (fnError) {
          console.error('Error creating exec_sql function:', fnError)
          
          // Last resort: provide manual instructions
          console.log('\nPlease run the following SQL in your Supabase SQL editor:')
          console.log(migrationSql)
          process.exit(1)
        }
        
        // Try running the migration again
        console.log('Retrying migration...')
        const { error: retryError } = await supabase.rpc('exec_sql', { sql: migrationSql })
        
        if (retryError) {
          console.error('Error on retry:', retryError)
          console.log('\nPlease run the following SQL in your Supabase SQL editor:')
          console.log(migrationSql)
          process.exit(1)
        }
      } else {
        console.log('\nPlease run the following SQL in your Supabase SQL editor:')
        console.log(migrationSql)
        process.exit(1)
      }
    }

    console.log('Migration completed successfully!')
    
    // Verify the function was created
    console.log('Verifying create_user_word_scores_table function...')
    const { error: verifyError } = await supabase.rpc('create_user_word_scores_table')
    
    if (verifyError) {
      console.error('Error verifying function:', verifyError)
      console.log('You may need to run the migration SQL manually in the Supabase SQL editor')
    } else {
      console.log('Function verified successfully!')
    }
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration() 