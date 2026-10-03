# GuardKids — Production

GuardKids has been migrated from local/demo state to a real Supabase-backed web application. The parent portal and child companion share the same backend, authentication, device pairing, realtime commands, location telemetry, private media storage, and WebRTC signaling. No Gemini/AI service is required.

## 1. Backend Supabase

Create or use a Supabase project, then run `supabase/schema.sql` in the SQL Editor. The schema creates the production tables, RLS policies, private Storage bucket, realtime publication entries, and the parent profile trigger.

Enable these Auth providers in Supabase:

- Email/password for parent accounts.
- Anonymous Sign-Ins for the child companion pairing flow.

Deploy the pairing Edge Function from `supabase/functions/pair-child/`.

```bash
supabase functions deploy pair-child
```

Configure the server-side Supabase secret required by the function (`SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`) and its publishable key. `SUPABASE_URL` is provided by the Supabase runtime. Never put server secrets in frontend `VITE_*` variables.

## 2. Frontend environment

Copy `.env.example` to `.env.local` and fill in:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_CHILD_APP_URL=https://YOUR_DOMAIN/?mode=child
VITE_TURN_URLS=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

## 3. Run

```bash
npm install
npm run dev
```

Parent portal: `/`

Child companion: `/?mode=child`

The parent creates a device profile and receives a one-time pairing code/QR. The child companion signs in anonymously, enters the code, and becomes the paired device agent.

## 4. Production build

```bash
npm run lint
npm run build
```

## 5. Real browser capabilities

The child companion uses actual browser APIs: Geolocation, Battery Status where supported, Network Information where supported, Media Capture, Display Capture, Vibration, and WebRTC. Camera and screen-sharing sessions are consent-gated by the child device/browser.

A browser/PWA cannot act like a native Android device-management app: it cannot inspect all installed Android apps, read system-wide usage statistics, silently record the camera, or force native OS screen-lock/app-blocking outside the browser. Those capabilities require a native companion with the corresponding Android permissions/APIs. The production web code therefore does not fake those values; unsupported capabilities remain empty or permission-gated.

### WebRTC production note
For parent/child video sessions across restrictive NATs, configure a TURN server with `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL`. STUN-only connectivity is not guaranteed on every network.
