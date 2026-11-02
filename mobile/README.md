# Sahaba Quest Mobile

An Expo and React Native app for Android and iOS. It connects to the existing Sahaba Quest Supabase project and Next.js APIs; its screens are native React Native rather than website WebViews.

## Configure and run

1. Run `npm run sync:env` to copy the website's public Supabase URL, publishable key, and Turnstile site key from the repository root `.env.local` into ignored `mobile/.env`. The script does not copy server secrets.
2. If root `.env.local` is unavailable, copy `.env.example` to `.env`, add the public Supabase and Turnstile values, and set `EXPO_PUBLIC_API_BASE_URL` to the API origin. It defaults to production.
3. Set `EXPO_PUBLIC_TURNSTILE_HOST` to a hostname registered with the Turnstile widget. The widget runs in a WebView and Supabase validates the response token.
4. Run `npm install` and `npm start`; then open in Expo Go or use `npm run android` / `npm run ios` with a configured simulator. EAS and platform signing are needed for store builds.

The application uses the Supabase publishable key only. Supabase Auth, student tokens, and family-member tokens are stored with Expo SecureStore. Existing APIs/RPCs and existing authorization/RLS rules remain the backend source of truth.

## Implemented native screens

- Entry and identity: `index.tsx`, `account-access.tsx`, `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, and `launch-loader.tsx` (parent company text: Deen Skyline Limited; official Sahaba Quest logo asset is reused).
- Individual player: tabs for home, quiz, challenges, leaderboard, progress, and profile; plus `daily-quest.tsx`, `challenge/[id].tsx`, and `pricing.tsx`.
- Public learning library: `sahaba.tsx` and `sahaba-article/[slug].tsx` use published Sahabah articles exposed under existing RLS.
- Family account: `family-access.tsx`, `family-owner-home.tsx`, `family-ranking.tsx`, `family-challenges.tsx`, `family-challenge/[id].tsx`, `family-member-sign-in.tsx`, `family-member-home.tsx`, `family-member-leaderboard.tsx`, `family-member-quest.tsx`, `family-member-challenges.tsx`, and `family-member-challenge/[id].tsx`.
- School: `schools.tsx`, `schools/register.tsx`, `school-admin-sign-in.tsx`, `school-admin-home.tsx`, `school-management.tsx`, `school-learning.tsx`, `school-insights.tsx`, `school-settings.tsx`, `school-subscription.tsx`, `student-sign-in.tsx`, `student-home.tsx`, `student-quest.tsx`, and `schools/student-activity/[id].tsx`.
- Sponsored competitions: `sponsored.tsx`, `sponsored-competition/[id].tsx`, `sponsored-competition-play/[id].tsx`, and `sponsored-leaderboard/[id].tsx` use the existing competition tables and RPCs. Access follows the website's active Individual Plus eligibility and WhatsApp consent flow.
- Platform admin (partial): `admin-home.tsx`, `admin-competitions.tsx`, `admin-competition-new.tsx`, and `admin-competition/[id].tsx` provide administrator-gated overview, competition listing, draft creation, and publication toggle.

## Feature parity matrix

| Website feature area | Mobile integration | Remaining work |
| --- | --- | --- |
| Individual signup, sign in, CAPTCHA, session | Supabase Auth, Turnstile, SecureStore; native email/recovery callback and password update | Deep-link allowlist and confirmation/recovery need validation in Supabase and on Android/iOS devices. |
| Individual home, quiz, progress, Daily Quest | Existing profile/progress queries and RPCs; root Daily Quest route is available | Question history, richer result history, achievements, and full account settings still need parity review. |
| Individual challenges and leaderboard | Existing challenge RPCs; all-time and monthly leaderboard periods | Challenge history/result detail and device validation. |
| Individual plans and payments | Live plans, existing Flutterwave initialization API and hosted checkout | Device callback/return and post-payment refresh need device validation. Activation remains server verified. |
| Family owner/member identity, quests, challenges and rankings | Owner Supabase Auth; member PIN/session RPCs; separate owner/member quest and challenge flows; member and family leaderboards | Device validation and remaining owner analytics/member-management parity. |
| Public Sahaba library | Published article query and actual article likes/comments; share actions | Verify engagement RLS and share behavior on devices. |
| School registration and administrator | Existing registration, Auth, dashboard APIs; CSV and XLS/XLSX file import; shareable one-time credentials; reports with CSV export | Confirmation link still points to the website. Activity authoring/editing, print/export credentials, and some class controls remain. |
| School student identity and learning | Separate Student ID/PIN session; dashboard, timed quiz, assigned activities and Daily Quest route | Device validation and assigned activity result review. |
| School insights, settings and plans | Existing reports, class filter, activity/session data, CSV export, settings and subscription APIs | Device checkout verification; additional report dimensions may remain. |
| Sponsored competitions | Native listing, details, access/consent, timed play, answer submission, and competition leaderboard using current Supabase tables/RPCs | Admin question, announcement, and results-management screens remain. |
| Platform admin | Active admin role detection/routing, competition overview/list, draft creation, publication toggle | Full article administration and competition question, announcement, and results tools remain native parity gaps. |
| Notifications | No mobile integration | No push delivery endpoint/service or device-registration workflow was found in the existing backend; requires backend/product support. |

## Architecture and change boundaries

The web application remains the source of truth for business rules. Individual and school administrator sessions use Supabase Auth. Family members use the website's separate PIN-verification/session RPCs. School students use the existing Student ID/PIN REST login and opaque bearer session; they are not treated as Supabase Auth users. Flutterwave secrets and payment verification remain server-side. The mobile app does not add database tables/functions or change web/API behavior.

The repository does not include deployed database function bodies or the live production schema, so the mobile app only calls the RPCs already used by the website. No files outside `mobile/` have been changed in this implementation.

## Known limitations

- Native auth callback routes are implemented, but the Supabase redirect allowlist and confirmation/recovery journeys still require real-device validation.
- The existing student batch-import API is reused for parsed CSV/XLS/XLSX files. Returned one-time credentials can be shared using the platform share sheet.
- Remaining parity includes full platform article administration, competition question/announcement/results administration, some school authoring and class management, richer individual history/settings, and push notifications (no backend push workflow was found).
- Verification performed: `npm run typecheck` and `npx expo export --platform android` are run for this implementation. Export bundles the Android JavaScript app; it is not an installable APK/AAB.
- Not yet verified: Android/iOS simulator or device builds, real account journeys, payments, email callback, sponsored competition, and end-to-end learning workflows. The current state is not production-ready until those are validated.
- Android APK/AAB delivery still requires an Android build environment or EAS Build. iOS delivery requires macOS/Xcode or EAS Build and the owner's Apple signing credentials.
