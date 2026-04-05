# Versus

**The competitive sports tracking app for serious rec players.**

Schedule matches, log scores, rank up, and build your competitive history — across 9 sports. Available on **iOS** and **Web**.

## Features

- **Match feed** — Social feed of match posts with live score entry, photos, likes, and comments
- **Ranked matches** — 1v1 and 2v2 ranked play with VP and per-sport leaderboards
- **Casual, local & practice** — Log any type of session; practice sessions track time spent
- **Live match tracking** — Start, pause, resume, and finish matches in real time with a game timer and per-game scores
- **VP & rank tiers** — Per-sport Victory Points; rank progression from Beginner → Bronze → Silver → Gold → Platinum → Diamond → Pro
- **Plan & schedule** — Set a sport, time, location, and invite opponents ahead of time
- **Player profiles** — Follow/unfollow, view match history, and per-sport stats
- **Direct messages** — In-app DM conversations between players
- **Push notifications** — Match invites, likes, comments, and follow requests
- **Auth** — Email/password, Apple Sign-In, and Google Sign-In
- **Dark mode** — Full light/dark theme support across iOS and web
- **Onboarding** — Sport selection and username setup for new users
- **Web app** — Full marketing landing page and auth flow at the web URL

## Sports

Tennis · Pickleball · Badminton · Ping Pong · Racquetball · Squash · Basketball · Golf · Volleyball

2v2 supported for: Tennis, Ping Pong, Basketball, Volleyball

## Tech Stack

- **App**: React Native + Expo (SDK 54, RN 0.81.5) — iOS & Web
- **Language**: TypeScript throughout
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Navigation**: React Navigation (bottom tabs + native stack)
- **Maps**: React Native Maps
- **Push**: Expo Notifications + Expo Push Service
- **Build**: EAS Build

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in your environment
   - Apply the schema: `supabase/schema.sql`

3. **Run**
   ```bash
   npm start
   ```
   Press `i` for iOS simulator or `w` for web.

## Project Structure

```
Versus/
├── App.tsx                      # Entry point, auth routing, navigation container
├── supabase/schema.sql          # Full database schema
├── src/
│   ├── constants/
│   │   ├── theme.ts             # Colors, spacing, typography tokens
│   │   └── sports.ts            # Sport list, scoring rules, 2v2 config
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client + auth helpers
│   │   └── pushNotifications.ts # Push token registration & handlers
│   ├── i18n/                    # Language context and translations
│   ├── theme/ThemeProvider.tsx  # Light/dark theme context
│   ├── navigation/              # Tab and stack navigators
│   ├── screens/
│   │   ├── LandingScreen.tsx    # Web marketing front page
│   │   ├── LoginScreen.tsx      # Auth — log in (email, Google, Apple)
│   │   ├── SignupScreen.tsx     # Auth — sign up (email, Google, Apple)
│   │   ├── OnboardingScreen.tsx # New user setup
│   │   ├── HomeScreen.tsx       # Match feed + live match controls
│   │   ├── PlanMatchScreen.tsx  # Schedule a new match
│   │   ├── VersusScreen.tsx     # Per-sport rank dashboard
│   │   ├── MapScreen.tsx        # Nearby matches map
│   │   ├── ProfileScreen.tsx    # User profile and stats
│   │   ├── MessagesScreen.tsx   # DM inbox
│   │   ├── ChatScreen.tsx       # Individual DM conversation
│   │   ├── SearchScreen.tsx     # Find and follow players
│   │   ├── UserProfileScreen.tsx# Other users' profiles
│   │   └── SettingsScreen.tsx   # Account and app settings
│   └── components/
│       ├── NewMatchModal.tsx     # Create a new match
│       ├── EditMatchModal.tsx    # Edit an in-progress or completed match
│       ├── LocationPickerModal.tsx
│       ├── MapPreview.tsx
│       └── UserSearch.tsx
```

## Theme

- **Light** (iOS): Dark blue primary (`#1E3A8A`), cream background (`#FDF6ED`)
- **Dark** (web + dark mode): Blue primary (`#2563EB`), near-black background (`#090806`)

## Match Lifecycle

`planned → pending → confirmed → in_progress → paused → completed / canceled`

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run ios` | Run on iOS simulator |
| `npx expo start --web` | Run in browser |
| `eas build --platform ios` | Production iOS build |
