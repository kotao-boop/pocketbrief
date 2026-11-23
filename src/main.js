import { initFirebase, rcNumber, saveBrief, subscribeBriefs } from "./firebase.js";
import { isConfigured } from "./config.js";
import { initDeviceModel, onDeviceStatus, quickBrief, deepBrief, imageBrief } from "./ai.js";

const $ = (id) => document.getElementById(id);
const els = {
  banner: $("setupBanner"),
  deviceDot: document.querySelector("#deviceStatus .dot"),
  deviceText: $("deviceStatusText"),
  tabText: $("tabText"),
  tabImage: $("tabImage"),
  paneText: $("paneText"),
  paneImage: $("paneImage"),
  inputText: $("inputText"),
  charCount: $("charCount"),
  sampleBtn: $("sampleBtn"),
  inputImage: $("inputImage"),
  imagePreview: $("imagePreview"),
  dropLabel: $("dropLabel"),
  routeSelect: $("routeSelect"),
  routeHint: $("routeHint"),
  briefBtn: $("briefBtn"),
  progress: $("progress"),
  progressBar: $("progressBar"),
  progressText: $("progressText"),
  errorBox: $("errorBox"),
  emptyState: $("emptyState"),
  resultCard: $("resultCard"),
  routeBadge: $("routeBadge"),
  latency: $("latency"),
  resultTitle: $("resultTitle"),
  resultSummary: $("resultSummary"),
  resultBullets: $("resultBullets"),
  deepSections: $("deepSections"),
  resultKeyPoints: $("resultKeyPoints"),
  actionWrap: $("actionWrap"),
  resultActions: $("resultActions"),
  glossaryWrap: $("glossaryWrap"),
  resultGlossary: $("resultGlossary"),
  extractedWrap: $("extractedWrap"),
  resultExtracted: $("resultExtracted"),
  resultTags: $("resultTags"),
  historyWrap: $("historyWrap"),
  historyList: $("historyList"),
};

let mode = "text";
let imagePayload = null; // { base64, mimeType }

const SAMPLE_SHORT = `Team sync — Nov 21. Marketing reported that the new landing page lifted signups by 18% week over week, mostly from mobile. Engineering flagged that the checkout API p95 latency rose to 900ms after Tuesday's deploy and Priya is investigating a possible N+1 query. Finance reminded everyone that Q4 vendor invoices must be submitted by Dec 5. Next sync is on Nov 28; the holiday schedule will be announced by HR on Monday.`;

const SAMPLE_LONG = `The Harborview Community Solar Cooperative held its annual general meeting on Saturday, November 15, with 214 members in attendance, a quorum under the cooperative's bylaws. Chair Elena Ruiz opened the meeting by summarizing the year: the cooperative's three rooftop arrays generated 1.84 GWh of electricity, roughly 12 percent above forecast, and member dividends will rise to 4.1 cents per kilowatt-hour credited in 2026. Treasurer David Okafor presented the audited financial statements. Revenue reached $486,000, operating costs were $291,000, and the cooperative added $88,000 to its battery replacement reserve, which now stands at $402,000 against a projected 2031 replacement cost of $610,000. Several members questioned whether the reserve target should be raised given recent increases in lithium battery prices; the board agreed to commission an independent review of the replacement cost estimate, to be delivered before the March board meeting. Operations manager Grace Liu reported that the Elm Street array suffered two inverter failures during the August heatwave, causing an estimated 9,400 kWh of lost generation. The board approved a $36,000 budget to install redundant inverters at Elm Street and to add temperature monitoring across all sites. A motion to expand into the adjacent Northgate warehouse roof passed with 78 percent of votes; the expansion would add approximately 220 kW of capacity at an estimated cost of $310,000, financed through a combination of the cooperative's expansion fund and a state green-energy grant application due January 30. If the grant is approved, construction would begin in May. The membership also voted to amend the bylaws to allow proxy voting by secure electronic means starting in 2027. Elections were held for two expiring board seats: Elena Ruiz was re-elected, and community member Marcus Webb, a retired electrical engineer, was elected to his first term. The board reminded members that the December maintenance window will take the Harborview array offline from December 12 to 14, and that members should expect a small reduction in credited generation for that month. The meeting closed with a presentation from the local high school robotics team, whose rooftop weather station, hosted on the Harborview array, won a regional science prize. The next general meeting is scheduled for November 2027, and the board will publish minutes and the audited statements on the member portal within two weeks. Members with questions about dividends were directed to contact the treasurer's office before December 20. Additional discussion covered the cooperative's insurance renewal: premiums rose 14 percent this year, driven by hail risk assessments, and the board is evaluating parametric insurance products as an alternative for 2027. The safety officer reported zero lost-time incidents for the third consecutive year and announced a new training schedule for volunteer maintenance crews beginning in February.`;

// ── boot ────────────────────────────────────────────────────────────────────

const { configured } = initFirebase();
if (!configured) els.banner.hidden = false;

refreshDeviceStatus();
setInterval(refreshDeviceStatus, 30_000);

async function refreshDeviceStatus() {
  const status = await onDeviceStatus();
  const map = {
    available: ["dot-ok", "On-device ready · Gemini Nano"],
    downloadable: ["dot-warn", "On-device model downloadable"],
    downloading: ["dot-warn", "On-device model downloading…"],
    unavailable: ["dot-off", "On-device unavailable · cloud fallback"],
    unsupported: ["dot-off", "On-device unsupported here · cloud fallback"],
    unknown: ["dot-unknown", "On-device status unknown"],
  };
  const [cls, label] = map[status] ?? map.unknown;
  els.deviceDot.className = `dot ${cls}`;
  els.deviceText.textContent = label;
}

// ── input handling ──────────────────────────────────────────────────────────

els.tabText.onclick = () => setMode("text");
els.tabImage.onclick = () => setMode("image");
function setMode(m) {
  mode = m;
  els.tabText.classList.toggle("active", m === "text");
  els.tabImage.classList.toggle("active", m === "image");
  els.paneText.hidden = m !== "text";
  els.paneImage.hidden = m !== "image";
  updateRouteHint();
}

els.inputText.addEventListener("input", () => {
  els.charCount.textContent = `${els.inputText.value.length} characters`;
  updateRouteHint();
});

els.sampleBtn.onclick = () => {
  const long = els.inputText.value.length > 100;
  els.inputText.value = long ? SAMPLE_SHORT : SAMPLE_LONG;
  els.inputText.dispatchEvent(new Event("input"));
};

els.inputImage.addEventListener("change", async () => {
  const file = els.inputImage.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  imagePayload = { base64: btoa(binary), mimeType: file.type };
  els.imagePreview.src = URL.createObjectURL(file);
  els.imagePreview.hidden = false;
  els.dropLabel.textContent = file.name;
});

function plannedRoute() {
  const choice = els.routeSelect.value;
  if (mode === "image") return "device";
  if (choice === "device") return "device";
  if (choice === "cloud") return "cloud";
  return els.inputText.value.length > rcNumber("cloud_threshold_chars") ? "cloud" : "device";
}

function updateRouteHint() {
  const threshold = rcNumber("cloud_threshold_chars");
  els.routeHint.textContent =
    mode === "image"
      ? "Photos are briefed with the hybrid model (on-device first)."
      : plannedRoute() === "cloud"
        ? `Long document → deep brief in the cloud (threshold ${threshold} chars, set by Remote Config).`
        : `Short text → quick brief, on-device first (threshold ${threshold} chars).`;
}
els.routeSelect.addEventListener("change", updateRouteHint);
updateRouteHint();

// ── run a brief ─────────────────────────────────────────────────────────────

els.briefBtn.onclick = async () => {
  hideError();
  if (!configured) {
    showError("This deployment is not connected to a Firebase project yet — see src/config.js for the one-time setup.");
    return;
  }
  // Chrome requires a user gesture before the on-device model can start.
  initDeviceModel((v) => {
    els.progress.hidden = false;
    els.progressBar.style.width = `${Math.round(v * 100)}%`;
    els.progressText.textContent = `Downloading on-device model… ${Math.round(v * 100)}%`;
  });

  els.briefBtn.disabled = true;
  els.briefBtn.textContent = "Briefing…";
  try {
    let result;
    let sourceChars = 0;
    if (mode === "image") {
      if (!imagePayload) throw new Error("Choose a JPEG or PNG photo first.");
      result = await imageBrief(imagePayload.base64, imagePayload.mimeType);
    } else {
      const text = els.inputText.value.trim();
      if (!text) throw new Error("Paste some text first.");
      sourceChars = text.length;
      result = plannedRoute() === "cloud" ? await deepBrief(text) : await quickBrief(text);
    }
    renderResult(result, sourceChars);
    saveBrief({
      kind: result.kind,
      title: result.data.title ?? "",
      summary: result.data.summary ?? result.data.executiveSummary ?? "",
      sourceChars,
    }).catch((e) => console.warn("Saving brief failed:", e));
  } catch (e) {
    console.error(e);
    showError(`Briefing failed: ${e.message ?? e}`);
  } finally {
    els.progress.hidden = true;
    els.briefBtn.disabled = false;
    els.briefBtn.textContent = "Brief it";
  }
};

function renderResult(result, sourceChars) {
  const d = result.data;
  els.emptyState.hidden = true;
  els.resultCard.hidden = false;
  const deviceReady = els.deviceDot.classList.contains("dot-ok");
  els.routeBadge.textContent =
    result.kind === "deep"
      ? "☁ Cloud deep brief · Gemini"
      : deviceReady
        ? "⚡ On-device · Gemini Nano (hybrid)"
        : "☁ Cloud via hybrid fallback · Gemini";
  els.routeBadge.className = `badge ${result.kind === "deep" ? "badge-cloud" : "badge-device"}`;
  els.latency.textContent = `${result.latencyMs} ms${sourceChars ? ` · ${sourceChars} chars in` : ""}`;
  els.resultTitle.textContent = d.title ?? "Untitled brief";
  els.resultSummary.textContent = d.summary ?? d.executiveSummary ?? "";
  fillList(els.resultBullets, d.bullets ?? []);

  const isDeep = result.kind === "deep";
  els.deepSections.hidden = !isDeep;
  if (isDeep) {
    fillList(els.resultKeyPoints, d.keyPoints ?? []);
    els.actionWrap.hidden = !(d.actionItems?.length > 0);
    fillList(els.resultActions, d.actionItems ?? []);
    els.glossaryWrap.hidden = !(d.glossary?.length > 0);
    els.resultGlossary.innerHTML = "";
    for (const g of d.glossary ?? []) {
      const dt = document.createElement("dt");
      dt.textContent = g.term;
      const dd = document.createElement("dd");
      dd.textContent = g.definition;
      els.resultGlossary.append(dt, dd);
    }
  }
  els.extractedWrap.hidden = !(d.extractedText?.length > 0);
  if (d.extractedText) els.resultExtracted.textContent = d.extractedText;
  els.resultTags.innerHTML = "";
  for (const t of d.tags ?? []) {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = `#${t}`;
    els.resultTags.append(s);
  }
}

function fillList(ul, items) {
  ul.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.append(li);
  }
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.hidden = false;
}
function hideError() {
  els.errorBox.hidden = true;
}

// ── history (Firestore) ─────────────────────────────────────────────────────

if (configured) {
  subscribeBriefs((briefs) => {
    els.historyWrap.hidden = briefs.length === 0;
    els.historyList.innerHTML = "";
    for (const b of briefs) {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = b.title || "Untitled brief";
      const meta = document.createElement("span");
      meta.className = "muted";
      meta.textContent = ` — ${b.kind} brief`;
      li.append(title, meta);
      els.historyList.append(li);
    }
  });
}
