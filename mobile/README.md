# Sahaba Quest Mobile

An Expo and React Native app for Android and iOS. It uses the existing Sahaba Quest Supabase project and implements email sign in and sign up, a player dashboard, quiz play, progress, and profile screens.

## Configure

1. Run `npm run sync:env` to copy the website's public Supabase URL, publishable key, and Turnstile site key from the repository's root `.env.local` into the ignored `mobile/.env` file. The script only writes those three explicitly allowed values; it does not copy the Supabase service role key or Turnstile secret.
2. If the root `.env.local` is unavailable, copy `.env.example` to `.env` and fill in those same three public values.
3. Set `EXPO_PUBLIC_TURNSTILE_HOST` to a hostname registered on the Turnstile widget. The default is `https://sahabaquest.com.ng`.

The Turnstile widget runs in an embedded WebView, following Cloudflare's native-app guidance. The widget hostname must be on its Cloudflare allowlist. Supabase continues to validate the returned CAPTCHA token during sign in and sign up.

## Run on a device or simulator

```sh
npm install
npm start
```

Then scan the Expo Go QR code, or run `npm run android` / `npm run ios` with the matching native simulator configured. For production distribution, configure an Expo EAS project and signing credentials, then build separately for Android and iOS.

## Main app routes

- `src/app/sign-in.tsx` and `src/app/sign-up.tsx`: Supabase email auth with Turnstile CAPTCHA.
- `src/app/(tabs)/index.tsx`: player dashboard.
- `src/app/(tabs)/quiz.tsx`: timed quiz using the existing `get_next_quiz_question` and `submit_quiz_answer` RPCs.
- `src/app/(tabs)/progress.tsx` and `profile.tsx`: player progress and account details.

The mobile app only uses the Supabase publishable key. Database access remains governed by the existing Supabase Auth and Row Level Security policies.
