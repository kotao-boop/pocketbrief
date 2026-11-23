import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getRemoteConfig, fetchAndActivate, getNumber, getString } from "firebase/remote-config";
import { firebaseConfig, appCheckSiteKey, isConfigured } from "./config.js";

let app = null;
let auth = null;
let db = null;
let remoteConfig = null;
let currentUser = null;

// In-app defaults so the app behaves sensibly before/without a Remote Config
// fetch. These are the same parameters the Firebase console can override:
//   cloud_threshold_chars — documents longer than this are routed to a deep
//                           cloud brief instead of a quick hybrid brief.
//   cloud_model           — Gemini model used for deep in-cloud inference.
//   quick_cloud_model     — Gemini model used when a quick (hybrid) brief
//                           falls back to the cloud.
export const rcDefaults = {
  cloud_threshold_chars: 1500,
  cloud_model: "gemini-3-flash-preview",
  quick_cloud_model: "gemini-3.5-flash-lite",
};

export function initFirebase() {
  if (!isConfigured) return { configured: false };
  app = initializeApp(firebaseConfig);

  // App Check protects the Gemini API behind Firebase AI Logic and is
  // enforced automatically by the AI Logic setup workflow. In production we
  // use Fraud Defense (reCAPTCHA Enterprise), registered in the console for
  // this web app; on localhost we use the debug provider (the debug token
  // printed in the console must be safelisted once in the Firebase console —
  // debug tokens are accepted for this hackathon's submissions).
  try {
    if (appCheckSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("debug-placeholder"),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (e) {
    console.warn("App Check init skipped:", e);
  }

  auth = getAuth(app);
  db = getFirestore(app);

  remoteConfig = getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = 60_000;
  remoteConfig.defaultConfig = { ...rcDefaults };
  fetchAndActivate(remoteConfig).catch((e) => console.warn("Remote Config fetch failed:", e));

  signInAnonymously(auth).catch((e) => console.warn("Anonymous sign-in failed:", e));
  onAuthStateChanged(auth, (u) => {
    currentUser = u;
    document.dispatchEvent(new CustomEvent("pocketbrief-auth", { detail: { uid: u?.uid ?? null } }));
  });

  return { configured: true, app };
}

export function getApp() {
  return app;
}

export function rcNumber(key) {
  if (!remoteConfig) return rcDefaults[key];
  try {
    return getNumber(remoteConfig, key);
  } catch {
    return rcDefaults[key];
  }
}

export function rcString(key) {
  if (!remoteConfig) return rcDefaults[key];
  try {
    return getString(remoteConfig, key);
  } catch {
    return rcDefaults[key];
  }
}

// ── Firestore: save + live-list the signed-in (anonymous) user's briefs ─────

export async function saveBrief(brief) {
  if (!db || !currentUser) return null;
  const ref = await addDoc(collection(db, "briefs"), {
    uid: currentUser.uid,
    createdAt: serverTimestamp(),
    ...brief,
  });
  return ref.id;
}

export function subscribeBriefs(onBriefs) {
  if (!db) return () => {};
  const unsubAuth = onAuthStateChanged(auth, (u) => {
    if (!u) return;
    const q = query(collection(db, "briefs"), orderBy("createdAt", "desc"), limit(20));
    onSnapshot(q, (snap) => {
      const mine = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.uid === u.uid);
      onBriefs(mine);
    });
  });
  return unsubAuth;
}
