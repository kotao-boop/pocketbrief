# Devpost submission draft — PocketBrief

**Platform:** Web (Chrome)
**Tagline:** Wall of text in. Clean brief out.

## What it does

PocketBrief turns anything you paste — an article, meeting notes, an email
thread, a contract — or a photo of a document or whiteboard into a clean,
structured brief: a title, a summary, the points that matter, and tags.
Long documents get a *deep brief*: executive summary, key points, action
items, the people and organizations mentioned, and a glossary of technical
terms.

The interesting part is where the AI runs. PocketBrief is built on
**Firebase AI Logic hybrid inference**:

- **Short texts and photos** are briefed through a model configured with
  `InferenceMode.PREFER_ON_DEVICE`. In Chrome on desktop, Gemini Nano answers
  locally — the text never leaves the device, it works offline, and it costs
  nothing. When no on-device model is available, Firebase AI Logic falls
  back to cloud Gemini automatically (fallback model pinned explicitly via
  `inCloudParams`, `gemini-3.5-flash-lite` by default), so the feature works
  for everyone.
- **Long documents** are routed to a model configured with
  `InferenceMode.PREFER_IN_CLOUD` and an explicit cloud model
  (`gemini-3-flash-preview` by default). Long-context reasoning is what the cloud
  is for.
- The character threshold that decides between the two routes is a
  **Remote Config** parameter (`cloud_threshold_chars`, default 1500), and
  both cloud model names are too (`cloud_model`, `quick_cloud_model`) —
  all tunable without a redeploy.

The UI makes the hybrid story visible: a live badge shows which route each
brief took, the header shows Gemini Nano's real availability
(`LanguageModel.availability()`), and every brief shows its latency — so the
speed and privacy difference between on-device and cloud is something you
can *see*, not just read about.

## How Firebase is used

- **Firebase AI Logic** (`firebase/ai`, `GoogleAIBackend`) — all inference,
  imported and called at runtime in `src/ai.js`, including
  `initializeDeviceModel()` on the Brief button click (Chrome requires a
  user gesture before the on-device model can start) and multimodal
  text+image requests for photos.
- **App Check** — enforced for AI Logic; reCAPTCHA v3 in production, debug
  provider on localhost.
- **Firestore + anonymous Authentication** — every brief is saved to the
  signed-in user's private history (`firestore.rules` restrict each brief
  to its owner).
- **Remote Config** — routing threshold and cloud model.
- **Firebase Hosting** — the web app itself.

## Why it matters

Everyone drowns in text they don't have time to read — and most AI tools
send all of it to a cloud server, including the short, sensitive stuff
(meeting notes, internal threads) that never needed to leave the laptop.
PocketBrief's rule is simple: *use the smallest model in the closest place
that can do the job well.* On-device for the everyday 90%, cloud for the
documents that genuinely need it. That's cheaper, faster, private by
default — and it's exactly the architecture hybrid inference exists for.

## Testing instructions

1. Open the hosted app in Chrome 139+ on desktop.
2. For on-device inference, enable
   `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and
   restart Chrome; the header pill turns green ("On-device ready") once
   Gemini Nano is downloaded. Without it, everything still works through
   the cloud fallback.
3. Paste any short text (or use *Try a sample*) and click **Brief it** —
   the badge shows the on-device route. Paste a long document (sample
   button toggles) and the app routes to a cloud deep brief instead.
4. The Photo tab briefs a JPEG/PNG of a document or whiteboard and shows
   the text it found.

## Built during the submission period

Everything: concept, routing design, UI, prompts, Firestore history,
Remote Config routing, App Check wiring. New project, MIT licensed.

## Still TODO before submitting (as of Nov 23)

- [ ] Create the Firebase project + paste real `firebaseConfig` (blocker —
      needs the entrant's Google account in the Firebase console)
- [ ] Deploy to Firebase Hosting; safelist the App Check debug token or
      register the reCAPTCHA v3 site key
- [ ] Record the ≤3 min demo video (English), upload to YouTube (public)
- [ ] Push this repo to a public GitHub repo (license visible in About)
- [ ] Fill the Devpost form with the text above + video + repo + live URL
