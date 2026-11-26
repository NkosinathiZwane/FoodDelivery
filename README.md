HazyEats

Everything Hazyview, in one black bag. Multi-store food and grocery delivery platform connecting Hazyview restaurants and Shabalala local vendors with a single R20 delivery fee.

Setup Steps

1. Create the Supabase project
   Sign in to Supabase and create a new free-tier project in a region close to your users.

2. Run the SQL schema
   Open the SQL Editor in your Supabase dashboard, paste the entire contents of supabase/schema.sql, and run it once. This creates all tables, triggers, row-level security policies, Storage bucket policies, Realtime publications, and RPC functions.

3. Copy the API keys
   In Supabase Project Settings -> API, copy the Project URL and anon public key into a local .env file using .env.example as a template (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). For local seeding only, also set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. Never expose the service-role key in browser code or hosting public env vars.

4. Enable the Google auth provider
   In Supabase Authentication -> Providers -> Google, enable Google OAuth and add your Client ID and Client Secret from Google Cloud Console. Add your local dev URL (http://localhost:3000) and production Netlify or Vercel URL under Authentication -> URL Configuration -> Redirect URLs.

5. Turn off email confirmation for presentations
   In Supabase Authentication -> Providers -> Email, disable Confirm email if you want new accounts to sign in immediately during live presentations without waiting for verification links.

6. Run the seed script
   Install dependencies with npm install, then run npm run seed to create the private accounts listed in SEED_ACCOUNTS.md, seed all 16 stores and menus, and populate 30 historical completed orders.

7. Run locally and deploy
   Start local development with npm run dev. Build the production static bundle with npm run build and deploy the dist folder directly to Netlify (using netlify.toml) or Vercel (using vercel.json) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY configured in your host environment settings.
