// ─────────────────────────────────────────────────────────────────────────────
// Firebase project configuration — project "pocketbrief-a202c", created in
// the Firebase console under the entrant's Google account (2022ktst@gmail.com).
// AI Logic is enabled with the Gemini Developer API provider; App Check was
// set up by the AI Logic wizard.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyDlLw6fXMI815TmqZCNRo38fc5NCMeVwqY",
  authDomain: "pocketbrief-a202c.firebaseapp.com",
  projectId: "pocketbrief-a202c",
  storageBucket: "pocketbrief-a202c.firebasestorage.app",
  messagingSenderId: "779044517395",
  appId: "1:779044517395:web:a7c232b7b9c8fbc0a0b1e6",
};

// reCAPTCHA Enterprise site key for App Check in production — registered in
// the Firebase console as the Fraud Defense provider for this web app
// (domains: pocketbrief-a202c.web.app, pocketbrief-a202c.firebaseapp.com).
// On localhost the App Check debug provider is used instead (debug tokens
// are accepted in submissions for this hackathon).
export const appCheckSiteKey = "6LfnZi4uAAAAAIcslO8AEHv0JkiEhKPH-qKIFzRN";

export const isConfigured = !firebaseConfig.apiKey.startsWith("REPLACE_");
