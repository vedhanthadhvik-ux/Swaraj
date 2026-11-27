# Swaraj

Swaraj is a citizen-driven public-interest news and conversation app. This repository contains a Next.js web MVP with Firebase Authentication, Firestore, Storage, and a server-side Gemini claim-analysis endpoint.

## Run locally

1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/), add a Web app, and copy its configuration into the `NEXT_PUBLIC_FIREBASE_*` values. Enable Google sign-in in **Authentication → Sign-in method** and create a Firestore database and Storage bucket.
4. Add a Gemini API key to `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/app/apikey). This key is server-only; never prefix it with `NEXT_PUBLIC_`.
5. Deploy the rules in `firestore.rules` and `storage.rules` using the Firebase console or Firebase CLI.
6. Run `npm run dev`, then open http://localhost:3000.

Without Firebase configuration, the feed and composer run in local demo mode. Posts, reactions, and comments are not shared or saved when using demo mode. Gemini claim analysis needs `GEMINI_API_KEY` configured on the server.

## What is included

- Responsive social news feed with topic filters and search
- Google sign-in, Firestore-backed public stories, Storage image uploads, likes, and demo-mode comments
- Gemini-assisted claim exploration through a server route (API key never reaches the browser)
- Source links and clear uncertainty / AI limitation disclosures
- Firestore and Storage security rules

## Verification limitations

The Gemini endpoint does **not** browse the web, open submitted links, or independently establish whether a political claim is true. It analyzes only the claim and text supplied by the user, and returns a cautious preliminary assessment with suggested checks. The interface explicitly labels the output as AI-assisted, not a fact-check or proof. Readers should inspect primary documents and independent reporting themselves.

Before production, add rate limiting and abuse protection to the verification endpoint, moderation workflows, report handling, and stronger user/role policies. Review the Firebase rules and privacy requirements for your deployment.
