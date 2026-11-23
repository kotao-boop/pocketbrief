import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { getApp, rcString } from "./firebase.js";

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid inference with Firebase AI Logic.
//
// PocketBrief routes work by size and by task:
//   • Quick briefs (short text, images) run through a model configured with
//     InferenceMode.PREFER_ON_DEVICE — Gemini Nano in Chrome answers locally
//     when it is available (private, offline-capable, $0), and Firebase AI
//     Logic transparently falls back to a cloud Gemini model when it is not.
//   • Deep briefs (long documents) run through InferenceMode.PREFER_IN_CLOUD
//     with an explicit cloud model: long-context reasoning is what the cloud
//     is for, and the document is leaving the device anyway once it is pasted
//     for a deep analysis.
// The routing threshold itself is a Remote Config parameter
// (cloud_threshold_chars), so it can be tuned without redeploying.
// ─────────────────────────────────────────────────────────────────────────────

let ai = null;
let deviceModelInit = null;

function getAi() {
  if (!ai) ai = getAI(getApp(), { backend: new GoogleAIBackend() });
  return ai;
}

function quickModel() {
  // inCloudParams pins the cloud fallback model explicitly: the SDK's
  // implicit default (gemini-2.5-flash-lite) is no longer available to new
  // users, so relying on it breaks the fallback path.
  return getGenerativeModel(getAi(), {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: { model: rcString("quick_cloud_model") },
  });
}

function deepModel() {
  return getGenerativeModel(getAi(), {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: { model: rcString("cloud_model") },
  });
}

// Must be called on a user gesture (button click) before the first prompt —
// Chrome requires user activation to start the on-device model download.
export function initDeviceModel(onProgress) {
  if (!deviceModelInit) {
    deviceModelInit = quickModel()
      .initializeDeviceModel((v) => onProgress?.(v))
      .catch((e) => {
        console.warn("On-device model init failed (cloud fallback still works):", e);
      });
  }
  return deviceModelInit;
}

// Is Chrome's built-in Gemini Nano actually usable right now?
export async function onDeviceStatus() {
  try {
    if (typeof LanguageModel === "undefined") return "unsupported";
    return await LanguageModel.availability();
  } catch {
    return "unknown";
  }
}

function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const QUICK_PROMPT = (text) => `You are a briefing assistant. Read the text and return ONLY a JSON object with this exact shape:
{"title": string (max 8 words), "summary": string (max 60 words), "bullets": [exactly 3 short strings], "tags": [up to 4 short strings]}
No markdown, no commentary outside the JSON.

TEXT:
${text}`;

const DEEP_PROMPT = (text) => `You are an analyst producing a deep brief. Read the document and return ONLY a JSON object with this exact shape:
{"title": string (max 10 words),
 "executiveSummary": string (120-180 words),
 "keyPoints": [5-8 short strings],
 "actionItems": [strings, may be empty if none],
 "entities": [names of people, organizations, products mentioned],
 "glossary": [{"term": string, "definition": string}] for up to 5 technical terms,
 "tags": [up to 5 short strings]}
No markdown, no commentary outside the JSON.

DOCUMENT:
${text}`;

const IMAGE_PROMPT = `Look at this image (a photo of a document, whiteboard, slide, or scene). Return ONLY a JSON object with this exact shape:
{"title": string (max 8 words), "summary": string (max 60 words), "bullets": [exactly 3 short strings], "tags": [up to 4 short strings], "extractedText": string (any readable text in the image, or "" if none)}
No markdown, no commentary outside the JSON.`;

export async function quickBrief(text) {
  const started = performance.now();
  const result = await quickModel().generateContent(QUICK_PROMPT(text));
  return {
    kind: "quick",
    data: parseJson(result.response.text()),
    latencyMs: Math.round(performance.now() - started),
  };
}

export async function deepBrief(text) {
  const started = performance.now();
  const result = await deepModel().generateContent(DEEP_PROMPT(text));
  return {
    kind: "deep",
    data: parseJson(result.response.text()),
    latencyMs: Math.round(performance.now() - started),
  };
}

export async function imageBrief(base64Data, mimeType) {
  const started = performance.now();
  const result = await quickModel().generateContent([
    { text: IMAGE_PROMPT },
    { inlineData: { data: base64Data, mimeType } },
  ]);
  return {
    kind: "image",
    data: parseJson(result.response.text()),
    latencyMs: Math.round(performance.now() - started),
  };
}
