# Versus

Plan and track head-to-head sports matches with friends. Earn Victory Points (VP) from ranked wins, climb per-sport leaderboards, and connect with nearby players. Like Strava, but for competitive matchups.

## Features

- **Match feed** — Live home feed showing match posts with scores, photos, likes, and comments
- **Plan matches** — Schedule 1v1 or 2v2 matches with friends for 15+ sports
- **Live match tracking** — Start, pause, resume, and complete matches with a live game timer and per-game scores
- **Ranked & casual** — Ranked matches affect VP and rank tier; casual/local/practice modes available
- **VP & rankings** — Per-sport Victory Points, rank tiers (Beginner → Bronze → Silver → Gold → Platinum → Diamond → Pro), and leaderboards
- **Map** — Find and view nearby planned matches on a map
- **Profiles** — Follow/unfollow, view match history, per-sport stats, and activity streaks
- **Direct messages** — DM conversations between users
- **Push notifications** — Match invites, likes, comments, and follow notifications
- **Auth** — Email, Apple Sign-In, and Google Sign-In
- **Dark mode** — Full light/dark theme support
- **Onboarding** — Username and sport preference setup for new users

## Sports

Tennis, Pickleball, Badminton, Ping Pong, Racquetball, Squash, Basketball, Golf, Volleyball, Bowling, Boxing, Wrestling, Pool, Spikeball, Track

2v2 supported for: Tennis, Ping Pong, Basketball, Volleyball

## Tech Stack

- **App**: React Native + Expo (SDK 54) — iOS & Android
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Navigation**: React Navigation (bottom tabs + native stack)
- **Maps**: React Native Maps
- **Push**: Expo Notifications
- **Build**: EAS Build

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env`
   - Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Apply the schema: `npx supabase db push`

3. **Run**
   ```bash
   npm start
   ```
   Press `i` for iOS simulator or `a` for Android emulator.

## Project Structure

```
Versus/
├── App.tsx                      # Entry point, auth, navigation container
├── supabase/schema.sql          # Full DB schema
├── src/
│   ├── constants/
│   │   ├── theme.ts             # Colors, spacing, typography tokens
│   │   └── sports.ts            # Sport definitions and 2v2 config
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── pushNotifications.ts # Push token registration & handlers
│   ├── i18n/                    # Internationalization / language context
│   ├── theme/ThemeProvider.tsx  # Light/dark theme context
│   ├── navigation/              # Tab and stack navigators
│   ├── screens/                 # HomeScreen, PlanMatchScreen, VersusScreen,
│   │                            # MapScreen, ProfileScreen, MessagesScreen,
│   │                            # ChatScreen, SearchScreen, SettingsScreen, etc.
│   └── components/              # NewMatchModal, EditMatchModal,
│                                # LocationPickerModal, MapPreview, UserSearch
```

## Theme

- **Light**: Dark blue primary (`#1E3A8A`), cream background (`#FDF6ED`)
- **Dark**: Blue primary (`#2563EB`), dark background (`#090806`)

## Scripts

| Command              | Description               |
|----------------------|---------------------------|
| `npm start`          | Start Expo dev server     |
| `npm run ios`        | Run on iOS simulator      |
| `npm run android`    | Run on Android emulator   |
| `npx supabase db push` | Apply DB migrations     |
