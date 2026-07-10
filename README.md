# DSA Tracker

Track solved questions, generate revision schedules, and sync daily plans to Google Calendar.

## Getting started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

## Environment variables

Create a `.env.local` file with the values below:

```bash
DATABASE_URL=postgresql://user:password@host:5432/db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# Optional for server-side admin operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/callback
```

## Database schema

Apply the schema in `src/db/schema.sql` to your PostgreSQL database before adding data.

If you already applied the schema, add the auth user column:

```sql
alter table users add column if not exists auth_user_id uuid;
create unique index if not exists users_auth_user_id_idx on users(auth_user_id);
```

## Supabase Auth setup

In Supabase Auth settings, enable Google provider and add redirect URLs:
- http://localhost:3000
- http://localhost:3000/

## Google Calendar setup

Create a Google Cloud project, enable the Google Calendar API, and create OAuth credentials.
Add this redirect URL to the Google OAuth client:
- http://localhost:3000/api/google/callback

## Project status

Current build includes:
- Dashboard layout
- Mock revision queue
- Revision schedule utilities
- Database schema placeholder

Upcoming:
- Google Calendar sync
- LeetCode import
- AI summaries
