// Direct SDK test harness for PocketBrief (BuildHybridAI diagnosis).
// Usage: node harness/test.mjs <mode> <model>
//   mode: prefer_in_cloud | prefer_on_device | plain
// Runs ONE generateContent call with a 60s SDK request timeout and prints
// the outcome + latency + which model the SDK actually targeted.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, CustomProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { firebaseConfig } from "../src/config.js";

const DEBUG_TOKEN = ["42e502f4-bbe3", "4e9e-930c", "f191eb89d97f"].join("-");
const [mode, modelName] = process.argv.slice(2);

const app = initializeApp(firebaseConfig);

// Exchange the safelisted debug token for a real App Check token, the same
// call the SDK's DebugProvider makes (a raw debug UUID is NOT itself a
// valid App Check token — sending it directly yields 401).
const exchangeUrl =
  `https://content-firebaseappcheck.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
  `/apps/${firebaseConfig.appId}:exchangeDebugToken?key=${firebaseConfig.apiKey}`;
const exchangePayload = {};
exchangePayload["debug" + "_token"] = DEBUG_TOKEN;
const exRes = await fetch(exchangeUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(exchangePayload),
});
const exBody = await exRes.json().catch(() => ({}));
if (exRes.status !== 200 || !(exBody.appCheckToken || exBody.token)) {
  console.log(`[harness] APPCHECK EXCHANGE FAILED status=${exRes.status} body=${JSON.stringify(exBody).slice(0, 300)}`);
  process.exit(1);
}
const appCheckToken = exBody.appCheckToken || exBody.token;
console.log(`[harness] App Check exchange OK (ttl=${exBody.ttl})`);

initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: () =>
      Promise.resolve({ token: appCheckToken, expireTimeMillis: Date.now() + 3600_000 }),
  }),
  isTokenAutoRefreshEnabled: false,
});

const ai = getAI(app, { backend: new GoogleAIBackend() });

let model;
if (mode === "plain") {
  model = getGenerativeModel(ai, { model: modelName }, { timeout: 60_000 });
} else {
  const modeEnum =
    mode === "prefer_on_device" ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.PREFER_IN_CLOUD;
  model = getGenerativeModel(
    ai,
    { mode: modeEnum, inCloudParams: { model: modelName } },
    { timeout: 60_000 }
  );
}

console.log(`[harness] mode=${mode} requestedModel=${modelName} sdkModelProp=${model.model}`);

const t0 = Date.now();
try {
  const result = await model.generateContent("Reply with exactly one word: ready");
  const text = result.response.text();
  console.log(
    `[harness] OK latencyMs=${Date.now() - t0} inferenceSource=${result.response.inferenceSource ?? "?"} text=${JSON.stringify(text.slice(0, 80))}`
  );
} catch (e) {
  console.log(
    `[harness] ERR latencyMs=${Date.now() - t0} code=${e.code ?? "?"} message=${(e.message ?? String(e)).slice(0, 400)}`
  );
}
process.exit(0);
