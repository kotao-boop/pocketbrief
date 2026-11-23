# PocketBrief — Hybrid AI Reading Digest

**Wall of text in. Clean brief out.**

**Live demo:** https://pocketbrief-a202c.web.app

PocketBrief turns anything you paste — an article, meeting notes, an email
thread, a photo of a whiteboard — into a clean, structured brief. What makes
it different is *where* the AI runs:

- **Short texts and photos** are briefed **on-device** by Gemini Nano in
  Chrome: private, offline-capable, and free.
- **Long documents** are handed to **cloud Gemini** for a deep brief with an
  executive summary, key points, action items, entities and a glossary.

Both paths go through **Firebase AI Logic hybrid inference** — one SDK that
runs the prompt on-device when a local model is available and falls back to
the cloud when it isn't. The character threshold that routes between a quick
brief and a deep brief is a **Remote Config** parameter, so it can be tuned
without redeploying. Briefs are saved per user in **Firestore** (anonymous
**Authentication**), and the Gemini API behind the app is protected by
**App Check**.

Built for the
[#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)
hackathon (Web/Chrome platform).

## How the hybrid routing works

| Input                                   | Model configuration (`firebase/ai`)              | Why |
| --------------------------------------- | ------------------------------------------------ | --- |
| Short text (≤ threshold)                | `InferenceMode.PREFER_ON_DEVICE`                 | Fast, private, free; cloud fallback keeps it working everywhere |
| Photo (JPEG/PNG)                        | `InferenceMode.PREFER_ON_DEVICE` (multimodal)    | The picture never has to leave the device |
| Long document (> threshold)             | `InferenceMode.PREFER_IN_CLOUD` + explicit model | Long-context reasoning is what the cloud is for |

The UI shows the route taken, the on-device model's live availability
(`LanguageModel.availability()`), and the latency of every brief.

## Tech

- Firebase AI Logic (JS SDK v12.5+) with `GoogleAIBackend` (Gemini Developer API)
- Firestore + anonymous Authentication for per-user brief history
- Remote Config for the routing threshold and cloud model name
- App Check (reCAPTCHA v3 in production; debug provider on localhost —
  debug tokens are accepted for this hackathon)
- Vite, vanilla JS/CSS. Hosted on Firebase Hosting.

## Run it locally

1. Create a Firebase project and enable AI Logic
   (Firebase console → **AI Services → AI Logic → Get started** → choose the
   **Gemini Developer API** provider). This enforces App Check automatically.
2. Paste your web app's `firebaseConfig` into `src/config.js` (and replace
   `REPLACE_WITH_PROJECT_ID` in `.firebaserc`).
3. On localhost, the App Check debug token printed in the browser console
   must be safelisted once under **Security → App Check → Apps → Manage
   debug tokens**.
4. For on-device inference, use Chrome 139+ on desktop and enable
   `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, then
   restart Chrome. (Without it, everything still works — via cloud fallback.)

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production build into dist/
```

## Deploy

```bash
npm run build
npx firebase deploy --only hosting,firestore:rules
```

## Project layout

- `src/ai.js` — Firebase AI Logic hybrid models, prompts, routing
- `src/firebase.js` — app init, App Check, Auth, Firestore, Remote Config
- `src/main.js` / `src/styles.css` / `index.html` — UI
- `src/config.js` — your Firebase project config goes here
- `firestore.rules` — briefs are readable/writable only by their owner
- `docs/DEVPOST.md` — submission description and testing instructions

## License

MIT — see [LICENSE](LICENSE).
