This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Setting Up User-Specific Word Scores

This application uses a `user_word_scores` table to store user-specific scores for words. To set up this table:

### Option 1: Using the API (Recommended)

1. Start the development server
2. Visit `/api/create-user-word-scores-table` in your browser
3. If successful, you'll see a JSON response confirming the table was created

### Option 2: Using the Migration Script

1. Make sure your `.env.local` file contains the Supabase credentials
2. Run the migration script:

```bash
node scripts/run-user-word-scores-migration.js
```

### Option 3: Manual Setup

If the above methods don't work, you can manually set up the table:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `src/supabase/manual_setup.sql`
4. Run the SQL script

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
