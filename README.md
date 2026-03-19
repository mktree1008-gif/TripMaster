# TripMaster

TripMaster is a mobile-first travel web app that covers the full flow from planning to journaling.

## Implemented scope

- Next.js App Router + TypeScript scaffold
- Supabase-based architecture (Auth, Postgres tables, RLS migration)
- Tabs:
  - Flight, Hotel, Places, Restaurants, Record, Diary, Profile, Settings
  - Information, Plan, Transportation, Tips, Entertainment, Event
  - Tripstargram (diary-based auto post + manual post feed)
- Auth:
  - Nickname + password (Sign in + Create account UI)
  - Google / Apple OAuth entry points
- Sharing:
  - Trip invite link/code
  - Viewer/Editor role split
  - Trip-level packing edit toggle (`OFF`: editor only, `ON`: invited members can edit)
- Comments:
  - Diary / Record / Music target comments with emoji reaction
- Diary:
  - Text + photo/video + voice recording
  - Weather emoji + Open-Meteo auto weather fetch
  - AI music generation job endpoint with provider adapter (Suno-compatible)
- Translation:
  - Language selector (EN, KO, ZH, JA, FR, DE)
  - Auto-translate shared text (Diary/Record/Comments/Tips)
- Planning:
  - 5-question customization + mood/purpose/companions/people count/style/budget
  - Budget meter (battery-like usage indicator)
  - Return flight time-aware itinerary output
- Profile & Settings:
  - Profile image upload + AI-generated profile image URL
  - Basic info update (name, phone, locale)
  - 문의하기 / 서비스 개선요청
- Extra discovery:
  - Destination info (overview/history/society/economy)
  - Entertainment (movie/book recommendations)
  - Event feed (Ticketmaster live if key exists, otherwise fallback list)

## Environment

Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUNO_API_URL=
SUNO_API_KEY=
TICKETMASTER_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database migration

Apply:

- `supabase/migrations/0001_initial.sql`
- `supabase/migrations/0002_tripstargram.sql`
- `supabase/migrations/0003_trip_packing_permission.sql`

This migration defines core tables and RLS policies for users/trips/members/invites/content/comments/music/support/tips.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- If `NEXT_PUBLIC_SUPABASE_URL` is still `https://example.supabase.co` (or unset), create/save/auth APIs will fail.
- For Google/Apple OAuth, add your deployed URL to Supabase Auth settings:
  - `Site URL`: `https://tripmaster-webapp.vercel.app`
  - `Redirect URLs`: `https://tripmaster-webapp.vercel.app`
- Event endpoint:
  - uses Ticketmaster Discovery API when `TICKETMASTER_API_KEY` is present
  - otherwise serves curated fallback events
- Music endpoint:
  - uses provider adapter (`lib/music/provider.ts`)
  - if `SUNO_API_URL`/`SUNO_API_KEY` are missing, returns safe fallback preview URL
