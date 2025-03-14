// This script is for running the SQL migration manually
// You can run it with: node scripts/run-migration.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env' })

async function runMigration() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or key is missing in environment variables')
      process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read the SQL file
    const procedureSql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20240314_create_profiles_procedure.sql'),
      'utf8'
    )

    // Execute the SQL to create the stored procedure
    const { error: procedureError } = await supabase.rpc('create_profiles_table')

    if (procedureError) {
      console.error('Error creating stored procedure:', procedureError)
      
      // Try to execute the SQL directly
      console.log('Trying to execute SQL directly...')
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql: procedureSql })
      
      if (sqlError) {
        console.error('Error executing SQL directly:', sqlError)
        process.exit(1)
      }
    }

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration() 