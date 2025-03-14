import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Check if the UID column already exists in the log table
    const { error: checkError } = await supabaseAdmin.rpc('check_column_exists', {
      table_name: 'log',
      column_name: 'UID'
    })

    // If the function doesn't exist, create it first
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('Creating check_column_exists function...')
      
      const createFunctionSql = `
        CREATE OR REPLACE FUNCTION check_column_exists(table_name text, column_name text)
        RETURNS boolean AS $$
        DECLARE
          column_exists boolean;
        BEGIN
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = $1
            AND column_name = $2
          ) INTO column_exists;
          
          RETURN column_exists;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
      
      const { error: createFnError } = await supabaseAdmin.rpc('exec_sql', { sql: createFunctionSql })
      
      if (createFnError && createFnError.message.includes('does not exist')) {
        // Create the exec_sql function if it doesn't exist
        const createExecSqlFn = `
          CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
        
        // Execute the SQL directly
        await supabaseAdmin.rpc('exec_direct_sql', { sql: createExecSqlFn })
        
        // Try creating the check_column_exists function again
        await supabaseAdmin.rpc('exec_sql', { sql: createFunctionSql })
      } else if (createFnError) {
        throw createFnError
      }
    }
    
    // Check if the column exists now
    const { data: columnExists, error: columnCheckError } = await supabaseAdmin.rpc('check_column_exists', {
      table_name: 'log',
      column_name: 'UID'
    })
    
    if (columnCheckError) {
      throw columnCheckError
    }
    
    // If the column already exists, return success
    if (columnExists) {
      return NextResponse.json({ 
        success: true, 
        message: 'UID column already exists in log table' 
      })
    }
    
    // Add the UID column to the log table
    const migrationSql = `
      -- Add UID column to log table
      ALTER TABLE public.log 
      ADD COLUMN IF NOT EXISTS "UID" UUID REFERENCES auth.users(id);
      
      -- Create an index on the UID column for better performance
      CREATE INDEX IF NOT EXISTS idx_log_uid ON public.log("UID");
      
      -- Set up Row Level Security (RLS) for the log table
      ALTER TABLE public.log ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for the log table
      DO $$
      BEGIN
        -- Allow users to view their own logs
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'log' AND policyname = 'Users can view their own logs'
        ) THEN
          CREATE POLICY "Users can view their own logs" ON public.log
            FOR SELECT USING ("UID" = auth.uid() OR "UID" IS NULL);
        END IF;
        
        -- Allow users to insert their own logs
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'log' AND policyname = 'Users can insert their own logs'
        ) THEN
          CREATE POLICY "Users can insert their own logs" ON public.log
            FOR INSERT WITH CHECK ("UID" = auth.uid() OR "UID" IS NULL);
        END IF;
      END
      $$;
    `
    
    // Execute the migration SQL
    const { error: migrationError } = await supabaseAdmin.rpc('exec_sql', { sql: migrationSql })
    
    if (migrationError) {
      throw migrationError
    }
    
    // Migration successful
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully added UID column to log table and set up RLS policies' 
    })
  } catch (error) {
    console.error('Error migrating log table:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      message: 'Failed to migrate log table. Please check server logs.'
    }, { status: 500 })
  }
} 