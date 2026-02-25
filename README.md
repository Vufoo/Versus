# Versus

Plan 1v1s in any sport with friends or random matchups nearby. Earn Victory Points (VP) from ranked wins and climb the leaderboard. Like Strava, but for organizing and playing head-to-head matches.

## Features (planned)

- **Plan matches** — Schedule 1v1s (pickleball, basketball, tennis, bowling, boxing, badminton, ping pong, etc.) with friends
- **Find match** — See who’s nearby and start a ranked or casual match on the spot
- **Ranked & casual** — Ranked matches affect VP/ELO; casual matches don’t
- **VP & rankings** — Victory Points and per-sport ranking
- **Location** — Location sharing for “find match” and meetups

## Tech stack

- **App**: React Native (Expo) — one codebase for **iOS** and **Android**
- **Backend**: Supabase (auth, database, realtime)
- **Location**: expo-location

## Setup

1. **Clone and install**
   ```bash
   cd Versus
   npm install
   ```

2. **Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env`
   - Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`

3. **Run**
   ```bash
   npm start
   ```
   Then press `i` for iOS simulator or `a` for Android emulator.

## Project structure

```
Versus/
├── App.tsx                 # Entry, navigation container, theme
├── app.config.js           # Expo config + env (Supabase)
├── src/
│   ├── constants/theme.ts   # Burnt orange + cream theme
│   ├── lib/supabase.ts     # Supabase client
│   ├── hooks/useLocation.ts # Location permission & coords
│   ├── navigation/
│   │   └── TabNavigator.tsx # Bottom tabs: Home, Plan, Find, Profile
│   └── screens/
│       ├── HomeScreen.tsx
│       ├── PlanMatchScreen.tsx
│       ├── FindMatchScreen.tsx
│       └── ProfileScreen.tsx
├── .env.example
└── README.md
```

## Theme

- **Primary**: Burnt orange (`#CC5500`)
- **Background / surface**: Cream / off-white (`#FDF6ED`, `#FFF8F0`)

## Next steps

When you’re ready to continue:

- Supabase: tables for users, sports, matches, VP/ELO, locations
- Auth: sign up / sign in (Supabase Auth)
- Plan match: sport picker, date/time, opponent, ranked vs casual
- Find match: list nearby users, start match flow, location updates
- Profile: VP display, match history, settings, location toggle

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm start`    | Start Expo dev server    |
| `npm run ios`  | Run on iOS simulator     |
| `npm run android` | Run on Android emulator |
