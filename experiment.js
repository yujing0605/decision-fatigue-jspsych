/* =========================
   jsPsych v8 (ESM) imports
   ========================= */
import { initJsPsych } from "https://cdn.jsdelivr.net/npm/jspsych@8/+esm";

import htmlKeyboardResponse from "https://cdn.jsdelivr.net/npm/@jspsych/plugin-html-keyboard-response@2/+esm";
import htmlButtonResponse from "https://cdn.jsdelivr.net/npm/@jspsych/plugin-html-button-response@2/+esm";
import surveyLikert from "https://cdn.jsdelivr.net/npm/@jspsych/plugin-survey-likert@2/+esm";
import surveyText from "https://cdn.jsdelivr.net/npm/@jspsych/plugin-survey-text@2/+esm";

/* =========================
   0) Configuration
   ========================= */

// ✅ 你提供的 Apps Script Web App URL
const UPLOAD_URL =
    "https://script.google.com/macros/s/AKfycbxgylEH6RCyEXgAC5y4KQFOQfxBBZCKoNuLOpsAA3LgWbKrYMNeFrK05tHg_f1pD1U0/exec";

const STUDY_META = {
  study_name: "Decision Fatigue in Trade-offs",
  version: "v8_demo_v1",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
};

const ALLOW_MOBILE = true;

/* =========================
   1) Helpers
   ========================= */
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

function safeParseResponses(responses) {
  // 有的版本是 JSON 字串，有的可能直接是物件
  if (!responses) return {};
  if (typeof responses === "string") {
    try {
      return JSON.parse(responses);
    } catch {
      return {};
    }
  }
  if (typeof responses === "object") return responses;
  return {};
}

async function uploadData(payload) {
  if (!UPLOAD_URL) return { ok: false, reason: "UPLOAD_URL missing" };

  // Apps Script Web App 常見 CORS 限制：
  // 用 no-cors 可以「送出去」，但拿不到 response body（這是正常的）
  try {
    await fetch(UPLOAD_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { ok: true, note: "sent (no-cors)" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================
   2) jsPsych init
   ========================= */
const PARTICIPANT_ID = uuidv4();
const STARTED_AT_ISO = new Date().toISOString();

const jsPsych = initJsPsych({
  display_element: "jspsych-target",
  on_finish: async () => {
    const allData = jsPsych.data.get().values();

    const payload = {
      meta: STUDY_META,
      participant_id: PARTICIPANT_ID,
      started_at_iso: STARTED_AT_ISO,
      ended_at_iso: new Date().toISOString(),
      client: {
        user_agent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        mobile: isMobile(),
        screen: { w: screen.width, h: screen.height },
      },
      data: allData,
    };

    const result = await uploadData(payload);

    // 本機下載備份
    const csv = jsPsych.data.get().csv();
    const fname = `jspsych_${STUDY_META.study_name.replace(/\s+/g, "_")}_${PARTICIPANT_ID}.csv`;
    downloadCsv(fname, csv);

    const msg = result.ok
      ? "✅ 已送出資料（同時也已下載一份到你的電腦作備份）。"
      : "⚠️ 送出資料失敗（但已下載備份檔）。請通知研究人員並提供下載的檔案。";

    jsPsych.getDisplayElement().innerHTML = `
      <div class="box">
        <h2>完成！</h2>
        <p class="small">${msg}</p>
        <p class="small muted">Participant ID: <b>${PARTICIPANT_ID}</b></p>
        <p class="small muted">你可以關閉此頁面。謝謝你的參與。</p>
      </div>
    `;
  },
});

// global props
jsPsych.data.addProperties({
  participant_id: PARTICIPANT_ID,
  started_at_iso: STARTED_AT_ISO,
  ...STUDY_META,
});

/* =========================
   3) Timeline
   ========================= */
const timeline = [];

// 3.1 device gate
if (!ALLOW_MOBILE) {
  timeline.push({
    type: htmlButtonResponse,
    stimulus: `
      <h2>裝置檢查</h2>
      <p class="small">本研究需要使用電腦與鍵盤作答（為了反應時間測量）。</p>
      <p class="small">請改用電腦重新開啟連結。</p>
    `,
    choices: ["我知道了"],
    on_start: () => {
      if (!isMobile()) jsPsych.finishTrial(); // skip if not mobile
    },
  });
}

// 3.2 consent
timeline.push({
  type: htmlButtonResponse,
  stimulus: `
    <h2>研究同意書</h2>
    <div class="small">
      <p>你將完成一個關於「需要取捨的選擇」之研究。全程約 15–25 分鐘。</p>
      <ul class="tight">
        <li>你可以隨時停止參與，不會有任何不利影響。</li>
        <li>研究蒐集你的作答與反應時間（毫秒），不蒐集可直接識別的個資。</li>
        <li>若你感到不適，可立即退出。</li>
      </ul>
      <p class="muted">聯絡方式：請填入你的研究室/IRB資訊。</p>
    </div>
  `,
  choices: ["我同意參與", "我不同意"],
  on_finish: (data) => {
    data.trial_tag = "consent";
    if (data.response === 1) jsPsych.endExperiment("你已選擇不同意參與。");
  },
});

// 3.3 demographics
timeline.push({
  type: surveyText,
  preamble: `<h3>基本資料（非必填）</h3><p class="small muted">若不想填可留空。</p>`,
  questions: [
    { prompt: "年齡：", name: "age", required: false },
    { prompt: "性別：", name: "gender", required: false },
    { prompt: "每週打工時數（大約）：", name: "work_hours", required: false },
  ],
  on_finish: (data) => (data.trial_tag = "demographics"),
});

// 3.4 VCP scale
const likert7 = ["1 非常不同意", "2", "3", "4", "5", "6", "7 非常同意"];

const vcpItems = [
  "當兩個選項各有優缺點時，我常覺得很難決定。",
  "面對需要取捨的選擇，我常覺得內心拉扯。",
  "我常擔心自己選錯，導致決定變得很痛苦。",
  "即使做完決定，我也常覺得不踏實。",
  "當選項涉及「時間 vs 金錢」的取捨時，我會特別糾結。",
  "我常覺得兩個重要目標無法兼顧。",
  "我做選擇時，常覺得每個選項都會失去某些重要東西。",
  "我偏好能一次滿足多種需求的選項，否則會不舒服。",
  "做重大決定後，我常反覆回想「如果選另一個會不會更好」。",
  "當我需要在效率與舒適之間取捨時，我會很難下決定。",
  "我常為了避免後悔而拖延做決定。",
  "我覺得做選擇會消耗很多心理能量。",
];

timeline.push({
  type: surveyLikert,
  preamble: `
    <h3>量表：價值衝突傾向</h3>
    <p class="small">以下題目描述你在做選擇時的感受。請以 1–7 分作答：1=非常不同意，7=非常同意。請依你「通常」的情況回答。</p>
  `,
  questions: vcpItems.map((t, idx) => ({
    prompt: t,
    labels: likert7,
    required: true,
    name: `vcp_${String(idx + 1).padStart(2, "0")}`,
  })),
  on_finish: (data) => {
    data.trial_tag = "vcp";

    const resp = safeParseResponses(data.responses);
    const vals = Object.keys(resp).map((k) => Number(resp[k]) + 1); // 0..6 -> 1..7
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

    jsPsych.data.addProperties({ vcp_mean: mean });
    const group = mean >= 4.5 ? "high_conflict" : "low_conflict";
    jsPsych.data.addProperties({ vcp_group: group });
  },
});

// 3.5 task instructions
timeline.push({
  type: htmlButtonResponse,
  stimulus: `
    <h3>決策任務說明</h3>
    <div class="small">
      <p>接下來你會看到一系列「打工方案」情境，每題有兩個方案（A/B）。</p>
      <ul class="tight">
        <li>請想像你下學期真的要在兩個方案中選一個。</li>
        <li>看到題目後，請用鍵盤選擇：<span class="kbd">F</span> = 選 A；<span class="kbd">J</span> = 選 B</li>
        <li>請盡量在 <b>20 秒內</b>做出選擇。</li>
        <li>每題選完後會問你「確定程度」與「想換的程度」。</li>
      </ul>
      <p class="muted">按下「開始」進入任務。</p>
    </div>
  `,
  choices: ["開始"],
  on_finish: (data) => (data.trial_tag = "task_instructions"),
});

/* 3.6 decision trials */
const tradeoffs = [
  { id: "T01", A: "時薪 $220；每週 12 小時；單程通勤 60 分鐘；彈性低（固定班）", B: "時薪 $170；每週 12 小時；單程通勤 5 分鐘；彈性高（可換班）" },
  { id: "T02", A: "時薪 $210；每週 16 小時；單程通勤 45 分鐘；彈性中", B: "時薪 $180；每週 14 小時；單程通勤 10 分鐘；彈性中" },
  { id: "T03", A: "時薪 $240；每週 10 小時；單程通勤 50 分鐘；彈性低", B: "時薪 $190；每週 10 小時；單程通勤 0 分鐘（宿舍樓下）；彈性中" },
  { id: "T04", A: "時薪 $200；每週 20 小時；單程通勤 30 分鐘；彈性高", B: "時薪 $230；每週 18 小時；單程通勤 70 分鐘；彈性低" },
  { id: "T05", A: "時薪 $185；每週 18 小時；單程通勤 15 分鐘；彈性高", B: "時薪 $215；每週 18 小時；單程通勤 55 分鐘；彈性中" },
  { id: "T06", A: "時薪 $260；每週 8 小時；單程通勤 80 分鐘；彈性低", B: "時薪 $205；每週 8 小時；單程通勤 20 分鐘；彈性高" },
  { id: "T07", A: "時薪 $195；每週 14 小時；單程通勤 25 分鐘；彈性中", B: "時薪 $225；每週 14 小時；單程通勤 60 分鐘；彈性中" },
  { id: "T08", A: "時薪 $170；每週 22 小時；單程通勤 5 分鐘；彈性低", B: "時薪 $210；每週 18 小時；單程通勤 40 分鐘；彈性高" },
  { id: "T09", A: "時薪 $230；每週 12 小時；單程通勤 35 分鐘；彈性低", B: "時薪 $200；每週 12 小時；單程通勤 10 分鐘；彈性低" },
  { id: "T10", A: "時薪 $190；每週 16 小時；單程通勤 0 分鐘；彈性中", B: "時薪 $240；每週 16 小時；單程通勤 75 分鐘；彈性中" },
  { id: "T11", A: "時薪 $205；每週 10 小時；單程通勤 30 分鐘；彈性高", B: "時薪 $225；每週 10 小時；單程通勤 55 分鐘；彈性高" },
  { id: "T12", A: "時薪 $215；每週 14 小時；單程通勤 20 分鐘；彈性低", B: "時薪 $185；每週 14 小時；單程通勤 0 分鐘；彈性低" },
  { id: "T13", A: "時薪 $250；每週 12 小時；單程通勤 70 分鐘；彈性中", B: "時薪 $200；每週 12 小時；單程通勤 15 分鐘；彈性中" },
  { id: "T14", A: "時薪 $180；每週 20 小時；單程通勤 10 分鐘；彈性高", B: "時薪 $220；每週 16 小時；單程通勤 45 分鐘；彈性低" },
  { id: "T15", A: "時薪 $235；每週 9 小時；單程通勤 60 分鐘；彈性低", B: "時薪 $195；每週 9 小時；單程通勤 5 分鐘；彈性低" },
  { id: "T16", A: "時薪 $210；每週 18 小時；單程通勤 40 分鐘；彈性中", B: "時薪 $200；每週 18 小時；單程通勤 20 分鐘；彈性中" },
  { id: "T17", A: "時薪 $200；每週 12 小時；單程通勤 25 分鐘；彈性高", B: "時薪 $230；每週 12 小時；單程通勤 50 分鐘；彈性低" },
  { id: "T18", A: "時薪 $175；每週 16 小時；單程通勤 0 分鐘；彈性高", B: "時薪 $215；每週 16 小時；單程通勤 35 分鐘；彈性高" },
  { id: "T19", A: "時薪 $225；每週 20 小時；單程通勤 60 分鐘；彈性低", B: "時薪 $205；每週 20 小時；單程通勤 15 分鐘；彈性低" },
  { id: "T20", A: "時薪 $240；每週 14 小時；單程通勤 45 分鐘；彈性中", B: "時薪 $210；每週 14 小時；單程通勤 15 分鐘；彈性中" },
  { id: "T21", A: "時薪 $260；每週 6 小時；單程通勤 90 分鐘；彈性低", B: "時薪 $205；每週 6 小時；單程通勤 10 分鐘；彈性低" },
  { id: "T22", A: "時薪 $195；每週 18 小時；單程通勤 20 分鐘；彈性高", B: "時薪 $225；每週 18 小時；單程通勤 55 分鐘；彈性高" },
  { id: "T23", A: "時薪 $205；每週 22 小時；單程通勤 30 分鐘；彈性低", B: "時薪 $230；每週 20 小時；單程通勤 60 分鐘；彈性中" },
  { id: "T24", A: "時薪 $215；每週 12 小時；單程通勤 35 分鐘；彈性中", B: "時薪 $185；每週 12 小時；單程通勤 5 分鐘；彈性中" },
];

function decisionStim(trial) {
  return `
    <h3>${trial.id} 打工方案選擇</h3>
    <div class="small muted">按 <span class="kbd">F</span> 選 A；按 <span class="kbd">J</span> 選 B（限時 20 秒）</div>
    <div class="grid2">
      <div class="choice-card">
        <b>方案 A</b><br/>
        <div class="small">${trial.A}</div>
        <div class="muted small">按 F 選 A</div>
      </div>
      <div class="choice-card">
        <b>方案 B</b><br/>
        <div class="small">${trial.B}</div>
        <div class="muted small">按 J 選 B</div>
      </div>
    </div>
  `;
}

const shuffledTradeoffs = jsPsych.randomization.shuffle(tradeoffs);

shuffledTradeoffs.forEach((t) => {
  timeline.push({
    type: htmlKeyboardResponse,
    stimulus: decisionStim(t),
    choices: ["f", "j"],
    trial_duration: 20000,
    data: {
      trial_tag: "decision_choice",
      item_id: t.id,
      optionA: t.A,
      optionB: t.B,
    },
    on_finish: (data) => {
      data.choice_key = data.response; // 'f' or 'j' or null
      data.choice =
        data.response === "f" ? "A" : data.response === "j" ? "B" : "NA_timeout";
    },
  });

  timeline.push({
    type: surveyLikert,
    preamble: `<h3>${t.id} 你剛才的決策</h3>`,
    questions: [
      { prompt: "你對剛才的選擇有多確定？", labels: likert7, required: true, name: `${t.id}_sure` },
      { prompt: "如果可以立刻改選，你有多想改？", labels: likert7, required: true, name: `${t.id}_switch` },
    ],
    data: { trial_tag: "decision_post", item_id: t.id },
    on_finish: (data) => {
      const r = safeParseResponses(data.responses);
      data.sure_1to7 = Number(r[`${t.id}_sure`]) + 1;
      data.switch_1to7 = Number(r[`${t.id}_switch`]) + 1;
    },
  });
});

// 3.7 post-task fatigue
timeline.push({
  type: surveyLikert,
  preamble: `<h3>任務後感受</h3><p class="small muted">請依你此刻狀態作答（1–7）。</p>`,
  questions: [
    { prompt: "我現在覺得精神能量被用掉很多。", labels: likert7, required: true, name: "fatigue_01" },
    { prompt: "我現在覺得心累／腦袋疲乏。", labels: likert7, required: true, name: "fatigue_02" },
    { prompt: "我現在很難再集中注意力。", labels: likert7, required: true, name: "fatigue_03" },
    { prompt: "我現在很想停止做需要權衡的選擇。", labels: likert7, required: true, name: "fatigue_04" },
  ],
  data: { trial_tag: "post_fatigue" },
  on_finish: (data) => {
    const r = safeParseResponses(data.responses);
    const keys = ["fatigue_01", "fatigue_02", "fatigue_03", "fatigue_04"];
    const vals = keys.map((k) => Number(r[k]) + 1);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

    jsPsych.data.addProperties({ fatigue_mean: mean });
    data.fatigue_mean = mean;
  },
});

// 3.8 persistence instructions
timeline.push({
  type: htmlButtonResponse,
  stimulus: `
    <h3>最後一個小任務：字母重組</h3>
    <div class="small">
      <p>你會看到一些英文字母，請你嘗試重組成一個英文單字。</p>
      <ul class="tight">
        <li>每題你可以輸入答案，或按「放棄此題」跳下一題。</li>
        <li>請盡力嘗試，但若你覺得想放棄也可以。</li>
      </ul>
      <p class="muted">按「開始」進入任務。</p>
    </div>
  `,
  choices: ["開始"],
  data: { trial_tag: "persist_instructions" },
});

const anagrams = [
  { id: "A01", letters: "TARPE", solvable: true, answer: "TAPER" },
  { id: "A02", letters: "LATEP", solvable: true, answer: "PLATE" },
  { id: "A03", letters: "SLEPA", solvable: true, answer: "PLEAS" },
  { id: "A04", letters: "TRANE", solvable: true, answer: "ANTER" },
  { id: "A05", letters: "QZPTN", solvable: false, answer: null },
  { id: "A06", letters: "XJMRK", solvable: false, answer: null },
  { id: "A07", letters: "VQWLP", solvable: false, answer: null },
  { id: "A08", letters: "ZKQTX", solvable: false, answer: null },
];

jsPsych.randomization.shuffle(anagrams).forEach((a) => {
  timeline.push({
    type: surveyText,
    preamble: `
      <h3>字母重組（${a.id}）</h3>
      <div class="small">請用下列字母組成一個英文單字：</div>
      <div style="font-size:2rem; letter-spacing:0.15em; margin: 10px 0;"><b>${a.letters}</b></div>
      <div class="small muted">你可以輸入答案後按下一頁，或按下方「放棄此題」。</div>
      <button id="giveup" style="margin-top:14px; padding:8px 14px; border-radius:10px; border:1px solid #aaa; background:#f7f7f7; cursor:pointer;">
        放棄此題
      </button>
    `,
    questions: [{ prompt: "你的答案：", name: "anagram_answer", required: false }],
    data: { trial_tag: "persist_trial", anagram_id: a.id, letters: a.letters, solvable: a.solvable },
    on_load: () => {
      const start = performance.now();
      const btn = document.getElementById("giveup");
      btn.addEventListener("click", () => {
        const elapsed = Math.round(performance.now() - start);
        jsPsych.data.write({
          trial_tag: "persist_giveup",
          anagram_id: a.id,
          letters: a.letters,
          solvable: a.solvable,
          gave_up: true,
          elapsed_ms: elapsed,
        });
        jsPsych.finishTrial({ gave_up: true, elapsed_ms: elapsed });
      });
    },
    on_finish: (data) => {
      const resp = safeParseResponses(data.responses);
      const ans = String(resp.anagram_answer || "").trim().toUpperCase();
      data.answer = ans;

      if (a.solvable && a.answer) data.correct = ans === a.answer.toUpperCase();
      else data.correct = null;

      data.gave_up = Boolean(data.gave_up);
    },
  });
});

// summary
timeline.push({
  type: htmlButtonResponse,
  stimulus: `<h3>資料處理中…</h3><p class="small muted">請按「下一頁」完成。</p>`,
  choices: ["下一頁"],
  data: { trial_tag: "pre_finish" },
  on_finish: () => {
    const giveups = jsPsych.data.get().filter({ trial_tag: "persist_giveup" }).values();
    const giveup_ms = giveups.reduce((s, d) => s + (d.elapsed_ms || 0), 0);

    const persistTrials = jsPsych.data.get().filter({ trial_tag: "persist_trial" }).values();
    let total_ms = null;
    if (persistTrials.length >= 2) {
      const first = persistTrials[0].time_elapsed;
      const last = persistTrials[persistTrials.length - 1].time_elapsed;
      if (typeof first === "number" && typeof last === "number") total_ms = last - first;
    }

    jsPsych.data.addProperties({
      persist_giveup_ms: giveup_ms,
      persist_total_ms_est: total_ms,
    });
  },
});

// run
jsPsych.run(timeline);
