# Restore Health Services Admin Web

This Next.js application is a live web console for the Restore Health Services admin backend. It uses the same Firebase project, Firestore collections, and authenticated Cloud Functions admin endpoints as the Flutter admin panel. It does not use demo records.

## Start locally

1. Copy `.env.example` to `.env.local` and set the Firebase Web API key for the `rhs-app-583c4` project. The API key is public Firebase app configuration; never put provider secrets or service-account keys here.
2. From this folder, run `npm install` if dependencies are not installed.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Sign in using an active Firebase admin account. The matching `admins/{uid}` Firestore document must exist and must not have `active: false`.

The local `.env.local` is ignored by Git. `FIREBASE_PROJECT_ID` and `RHS_API_BASE_URL` can be changed for another configured environment.

## Connected data and actions

The console reads live `companies`, `orders`, `users`, `admins`, `settlements`, `products`, `credit_ledger`, `webhook_logs`, `audit_logs`, and `Practo_Bookings` collections. It also reads `/admin/health` and `/admin/practo-consultations` from the Cloud Functions API. Firestore-backed data refreshes every 20 seconds and when the browser tab becomes active.

Admin actions use authenticated Cloud Functions requests for wallet credits, order status changes, provider setup/catalog sync, and Practo status checks. Firestore writes use the signed-in admin's ID token and the existing Firestore security rules for operational actions such as settlements, retries, audit events, and admin role updates. Provider credentials are sent to the backend and are never read back into the browser.

The admin login is handled server-side. Firebase ID and refresh tokens are stored in HTTP-only cookies; the password is not stored. The panel does not request or display client passwords.
