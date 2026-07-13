(() => {
  "use strict";
  const data = window.ELECTION_DATA || {};
  const $ = (selector) => document.querySelector(selector);
  const els = {
    themeButton: $("#themeButton"),
    currentOfficeholderCount: $("#currentOfficeholderCount"),
    currentCandidateCount: $("#currentCandidateCount"),
    currentHistoryCount: $("#currentHistoryCount"),
    currentOfficialHistoryCount: $("#currentOfficialHistoryCount"),
    currentIdentityReviewCount: $("#currentIdentityReviewCount"),
    currentSourceCount: $("#currentSourceCount"),
    currentVersion: $("#currentVersion"),
    manualRepoInput: $("#manualRepoInput"), manualBranchInput: $("#manualBranchInput"), manualTokenInput: $("#manualTokenInput"),
    manualHistoryScope: $("#manualHistoryScope"), manualHistoryYears: $("#manualHistoryYears"), manualRememberToken: $("#manualRememberToken"),
    manualDispatchButton: $("#manualDispatchButton"), manualOpenActionsButton: $("#manualOpenActionsButton"), manualReloadButton: $("#manualReloadButton"), manualSyncStatus: $("#manualSyncStatus"),
    adminHealthState: $("#adminHealthState"), adminHealthGrid: $("#adminHealthGrid"), adminHealthNote: $("#adminHealthNote"),
    wizardOverallState: $("#wizardOverallState"), wizardTestButton: $("#wizardTestButton"), wizardCurrentButton: $("#wizardCurrentButton"), wizardHistoryButton: $("#wizardHistoryButton"), wizardVerifyButton: $("#wizardVerifyButton"),
    wizardStep1Status: $("#wizardStep1Status"), wizardStep2Status: $("#wizardStep2Status"), wizardStep3Status: $("#wizardStep3Status"), wizardStep4Status: $("#wizardStep4Status"), wizardResult: $("#wizardResult"),
    changeGuardState: $("#changeGuardState"), changeSummary: $("#changeSummary"), changeDetails: $("#changeDetails"), changeGeneratedAt: $("#changeGeneratedAt"),
  };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function renderSummary() {
    const officialCandidates = (data.candidates || []).filter((item) => item.official && !item.demo);
    els.currentOfficeholderCount.textContent = (data.officeholders || []).length.toLocaleString("zh-Hant");
    els.currentCandidateCount.textContent = officialCandidates.length.toLocaleString("zh-Hant");
    els.currentHistoryCount.textContent = (data.history?.results || []).length.toLocaleString("zh-Hant");
    els.currentOfficialHistoryCount.textContent = Number(data.history?.coverage?.officialRecordCount || 0).toLocaleString("zh-Hant");
    els.currentIdentityReviewCount.textContent = Number(data.history?.coverage?.identityReviewCount || data.historyIdentityReview?.length || 0).toLocaleString("zh-Hant");
    els.currentSourceCount.textContent = (data.sources || []).filter((source) => /^https?:\/\//.test(source.url || "")).length.toLocaleString("zh-Hant");
    els.currentVersion.textContent = data.meta?.version || "—";
  }

  function inferGitHubRepo() {
    const saved = localStorage.getItem("manual-sync-repo");
    if (saved) return saved;
    if ((location.hostname || "").endsWith("github.io")) {
      const owner = location.hostname.replace(/\.github\.io$/, "");
      const repo = location.pathname.split("/").filter(Boolean)[0];
      if (owner && repo) return `${owner}/${repo}`;
    }
    return "";
  }

  function setManualSyncStatus(message, tone = "") {
    els.manualSyncStatus.textContent = message;
    els.manualSyncStatus.dataset.tone = tone;
  }

  function manualSyncConfig() {
    const repo = (els.manualRepoInput.value || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
    const [owner, name] = repo.split("/");
    return {
      repo, owner, name,
      branch: (els.manualBranchInput.value || "main").trim() || "main",
      token: (els.manualTokenInput.value || "").trim(),
      historyScope: els.manualHistoryScope.value || "none",
      historyYears: (els.manualHistoryYears.value || "2014,2018,2020,2022,2024").trim(),
      workflow: "daily-sync.yml",
    };
  }

  function saveManualSyncConfig(config) {
    if (config.repo) localStorage.setItem("manual-sync-repo", config.repo);
    localStorage.setItem("manual-sync-branch", config.branch);
    localStorage.setItem("manual-sync-history-scope", config.historyScope);
    localStorage.setItem("manual-sync-history-years", config.historyYears);
    if (els.manualRememberToken.checked && config.token) localStorage.setItem("manual-sync-token", config.token);
    else localStorage.removeItem("manual-sync-token");
  }

  async function githubJson(url, config, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${config.token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    if (response.status === 204) return null;
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new Error(payload?.message || text || `GitHub API ${response.status}`);
    return payload;
  }

  async function pollManualSync(config, startedAt) {
    const startMs = Date.parse(startedAt);
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(config.branch)}&per_page=5`;
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      const payload = await githubJson(url, config);
      const run = (payload?.workflow_runs || []).find((item) => Date.parse(item.created_at) >= startMs - 30000) || payload?.workflow_runs?.[0];
      if (!run) { setManualSyncStatus(`已送出，等待 GitHub 建立工作…（${attempt}/60）`, "progress"); continue; }
      if (run.status !== "completed") { setManualSyncStatus(`${run.status === "queued" ? "排隊中" : "執行中"}：${run.name || "Official data sync"}`, "progress"); continue; }
      if (run.conclusion === "success") { setManualSyncStatus("官方同步完成。GitHub Pages 通常再需要 1–3 分鐘部署。", "ok"); return { ok: true, run }; }
      setManualSyncStatus(`同步結束，但結果為 ${run.conclusion || "unknown"}。請開啟 Actions 查看紀錄。`, "error");
      return { ok: false, run };
    }
    setManualSyncStatus("同步仍在執行或排隊，請開啟 Actions 查看進度。", "warn");
    return { ok: false, timeout: true };
  }

  async function triggerManualSync() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name) return setManualSyncStatus("請填入 repository，例如 qoo109/taiwan-political-map。", "warn");
    if (!config.token) return setManualSyncStatus("請填入 GitHub Token。", "warn");
    saveManualSyncConfig(config);
    els.manualDispatchButton.disabled = true;
    const startedAt = new Date().toISOString();
    try {
      setManualSyncStatus("正在送出官方更新請求…", "progress");
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, config, {
        method: "POST",
        body: JSON.stringify({ ref: config.branch, inputs: { reason: "admin-official-refresh", history_scope: config.historyScope, history_years: config.historyYears } }),
      });
      setManualSyncStatus("已觸發 GitHub Actions，等待執行結果…", "progress");
      await pollManualSync(config, startedAt);
    } catch (error) {
      setManualSyncStatus(`更新失敗：${error.message || error}`, "error");
    } finally {
      els.manualDispatchButton.disabled = false;
    }
  }

  function openActionsPage() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name) return setManualSyncStatus("請先填入 repository。", "warn");
    saveManualSyncConfig(config);
    window.open(`https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}`, "_blank", "noopener,noreferrer");
  }

  function setWizardStep(step, state, message) {
    const card = document.querySelector(`[data-wizard-step="${step}"]`);
    if (card) card.dataset.state = state || "";
    const target = els[`wizardStep${step}Status`];
    if (target) target.textContent = message;
  }

  function updateWizardOverall(message, state = "") {
    els.wizardOverallState.textContent = message;
    els.wizardOverallState.className = `validation-state ${state}`;
  }

  async function testWizardAccess() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name || !config.token) {
      setWizardStep(1, "error", "請先填妥 repository 與 Token");
      updateWizardOverall("設定不完整", "invalid");
      return;
    }
    saveManualSyncConfig(config);
    els.wizardTestButton.disabled = true;
    setWizardStep(1, "progress", "正在檢查 repository 與 workflow…");
    try {
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}`, config);
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}`, config);
      setWizardStep(1, "ok", "權限與工作流程可用");
      els.wizardCurrentButton.disabled = false;
      localStorage.setItem("first-sync-step", "1");
      updateWizardOverall("步驟 1 完成", "ok");
      els.wizardResult.textContent = "GitHub 權限已確認。下一步可同步官方現任資料。";
    } catch (error) {
      setWizardStep(1, "error", `檢查失敗：${error.message || error}`);
      updateWizardOverall("檢查失敗", "invalid");
    } finally {
      els.wizardTestButton.disabled = false;
    }
  }

  async function dispatchWizardScope(scope, step) {
    const base = manualSyncConfig();
    const config = { ...base, historyScope: scope };
    if (!config.owner || !config.name || !config.token) return testWizardAccess();
    const button = step === 2 ? els.wizardCurrentButton : els.wizardHistoryButton;
    button.disabled = true;
    const startedAt = new Date().toISOString();
    setWizardStep(step, "progress", "已送出，等待 GitHub Actions…");
    updateWizardOverall(`正在執行步驟 ${step}`, "warn");
    try {
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, config, {
        method: "POST",
        body: JSON.stringify({ ref: config.branch, inputs: { reason: `first-official-sync-step-${step}`, history_scope: scope, history_years: config.historyYears } }),
      });
      const result = await pollManualSync(config, startedAt);
      if (!result?.ok) throw new Error(result?.run?.conclusion || "工作流程未成功完成");
      setWizardStep(step, "ok", step === 2 ? "官方現任／候選人同步成功" : "官方核心歷屆同步成功");
      if (step === 2) els.wizardHistoryButton.disabled = false;
      els.wizardVerifyButton.disabled = false;
      localStorage.setItem("first-sync-step", String(step));
      updateWizardOverall(`步驟 ${step} 完成`, "ok");
      els.wizardResult.textContent = step === 2 ? "官方現任同步完成。可繼續匯入核心歷屆，或先驗證發布資料。" : "官方核心歷屆同步完成。等待 Pages 部署後執行最後驗證。";
    } catch (error) {
      setWizardStep(step, "error", `失敗：${error.message || error}`);
      updateWizardOverall("同步失敗", "invalid");
      button.disabled = false;
    }
  }

  async function readPublishedData(config) {
    const payload = await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/contents/data/election-data.json?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`, config);
    if (!payload?.content) throw new Error("repository 中找不到 data/election-data.json");
    const binary = atob(String(payload.content).replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function verifyWizardPublication() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name || !config.token) return testWizardAccess();
    els.wizardVerifyButton.disabled = true;
    setWizardStep(4, "progress", "正在讀取 repository 最新官方資料…");
    try {
      const published = await readPublishedData(config);
      const officeholders = published.officeholders?.length || 0;
      const candidates = (published.candidates || []).filter((item) => item.official && !item.demo).length;
      const history = published.history?.coverage?.officialRecordCount || 0;
      const synced = published.officeholderSync?.lastSuccessAt || published.sync?.lastSuccessAt;
      if (officeholders <= 2 && !synced) throw new Error("仍只有種子資料，可能尚未完成首次同步或尚未提交");
      setWizardStep(4, "ok", `已發布：現任 ${officeholders}、候選人 ${candidates}、官方歷屆 ${history}`);
      updateWizardOverall("第一次官方同步完成", "ok");
      els.wizardResult.textContent = `版本 ${published.meta?.version || "—"}；最後同步 ${synced ? new Date(synced).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未標示"}。`;
      localStorage.setItem("first-sync-step", "4");
    } catch (error) {
      setWizardStep(4, "error", `驗證失敗：${error.message || error}`);
      updateWizardOverall("等待發布", "warn");
      els.wizardResult.textContent = "GitHub Pages 或資料 commit 可能仍在部署，通常再等 1–3 分鐘後重試。";
    } finally {
      els.wizardVerifyButton.disabled = false;
    }
  }

  function setupFirstSyncWizard() {
    const step = Number(localStorage.getItem("first-sync-step") || 0);
    if (step >= 1) { setWizardStep(1, "ok", "上次權限檢查通過，可重新檢查"); els.wizardCurrentButton.disabled = false; }
    if (step >= 2) { setWizardStep(2, "ok", "上次官方現任同步已完成"); els.wizardHistoryButton.disabled = false; els.wizardVerifyButton.disabled = false; }
    if (step >= 3) setWizardStep(3, "ok", "上次官方核心歷屆同步已完成");
    if (step >= 4) { setWizardStep(4, "ok", "上次發布資料驗證通過"); updateWizardOverall("已完成", "ok"); }
    els.wizardTestButton.addEventListener("click", testWizardAccess);
    els.wizardCurrentButton.addEventListener("click", () => dispatchWizardScope("none", 2));
    els.wizardHistoryButton.addEventListener("click", () => dispatchWizardScope("core", 3));
    els.wizardVerifyButton.addEventListener("click", verifyWizardPublication);
  }

  function renderChangeDashboard() {
    const report = data.changeLog;
    if (!report?.summary) {
      els.changeSummary.innerHTML = ["新增", "移除", "欄位變更", "照片更新", "歷屆增減"].map((label) => `<article><span>${label}</span><strong>—</strong></article>`).join("");
      els.changeDetails.innerHTML = "";
      return;
    }
    const summary = report.summary;
    const cards = [["新增", summary.added], ["移除", summary.removed], ["欄位變更", summary.changed], ["照片更新", summary.photoUpdated], ["歷屆增減", summary.historyDelta > 0 ? `+${summary.historyDelta}` : summary.historyDelta]];
    els.changeSummary.innerHTML = cards.map(([label, value]) => `<article><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
    const list = (items, empty) => items?.length ? `<ul>${items.slice(0, 12).map((item) => `<li>${escapeHtml(item.name || item.id)}${item.fields ? `：${item.fields.map(escapeHtml).join("、")}` : ""}</li>`).join("")}</ul>` : `<p class="admin-health-note">${empty}</p>`;
    const removed = [...(report.officeholders?.removed || []), ...(report.candidates?.removed || [])];
    const changed = [...(report.officeholders?.changed || []), ...(report.candidates?.changed || [])];
    els.changeDetails.innerHTML = `<article><h4>移除紀錄</h4>${list(removed, "本次沒有移除人物。")}</article><article><h4>官方欄位變更</h4>${list(changed, "本次沒有主要欄位變更。")}</article>`;
    const suspicious = Boolean(report.guard?.requiresReview);
    els.changeGuardState.textContent = suspicious ? "需要確認官方來源" : "安全門檻通過";
    els.changeGuardState.className = `validation-state ${suspicious ? "invalid" : "ok"}`;
    els.changeGeneratedAt.textContent = `${report.generatedAt ? new Date(report.generatedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未標示時間"} · ${report.guard?.reason || ""}`;
  }

  function adminAgeDays(value) {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86400000) : Infinity;
  }

  function renderAdminHealth() {
    const os = data.officeholderSync || {}; const cs = data.sync || {}; const hs = data.historySync || data.history?.coverage || {};
    const reports = [
      { name: "總統府", count: (data.officeholders || []).filter((x) => ["president", "vice-president"].includes(x.roleId)).length, time: os.lastSuccessAt || "2026-07-12", state: os.coverage?.presidency || "seeded" },
      { name: "立法院", count: os.legislatorCount || 0, time: os.lastSuccessAt, state: os.coverage?.legislature || "waiting" },
      { name: "內政部地方公職", count: os.localOfficeholderCount || 0, time: os.lastSuccessAt, state: os.coverage?.local || "waiting" },
      { name: "中選會候選人", count: cs.officialCandidateCount || 0, time: cs.lastSuccessAt, state: cs.status || "not-run" },
      { name: "中選會歷屆", count: hs.officialRecordCount || 0, time: hs.finishedAt || hs.lastOfficialSyncAt, state: hs.status || "waiting" },
      { name: "官方頭貼", count: [...(data.officeholders || []), ...(data.candidates || [])].filter((x) => x.photo?.official).length, time: data.photoSync?.lastSuccessAt, state: data.photoSync?.status || "waiting" },
    ];
    const okay = reports.filter((r) => r.count > 0 && adminAgeDays(r.time) <= 8).length;
    els.adminHealthState.textContent = okay >= 4 ? "正常" : okay >= 2 ? "部分待同步" : "等待首次同步";
    els.adminHealthState.className = `validation-state ${okay >= 4 ? "ok" : okay >= 2 ? "warn" : ""}`;
    els.adminHealthGrid.innerHTML = reports.map((r) => `<article><span>${escapeHtml(r.name)}</span><strong>${Number(r.count).toLocaleString("zh-Hant")}</strong><small>${escapeHtml(r.time ? new Date(r.time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚無成功紀錄")}</small><em>${escapeHtml(String(r.state))}</em></article>`).join("");
    const preserved = (os.sources || []).filter((r) => String(r.status).includes("preserved")).length;
    els.adminHealthNote.textContent = preserved ? `有 ${preserved} 個來源本次沿用上一版官方資料，請查看 GitHub Actions 紀錄。` : "未偵測到沿用上一版的來源；網站不會以人工資料補足缺漏。";
  }

  function setupManualSync() {
    els.manualRepoInput.value = inferGitHubRepo();
    els.manualBranchInput.value = localStorage.getItem("manual-sync-branch") || "main";
    els.manualHistoryScope.value = localStorage.getItem("manual-sync-history-scope") || "none";
    els.manualHistoryYears.value = localStorage.getItem("manual-sync-history-years") || "2014,2018,2020,2022,2024";
    const token = localStorage.getItem("manual-sync-token") || "";
    els.manualTokenInput.value = token;
    els.manualRememberToken.checked = Boolean(token);
    els.manualDispatchButton.addEventListener("click", triggerManualSync);
    els.manualOpenActionsButton.addEventListener("click", openActionsPage);
    els.manualReloadButton.addEventListener("click", () => location.reload());
  }

  const savedTheme = localStorage.getItem("election-map-theme");
  if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
  function updateTheme() { els.themeButton.textContent = document.documentElement.dataset.theme !== "dark" ? "☾" : "☼"; }
  els.themeButton.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("election-map-theme", next);
    updateTheme();
  });

  updateTheme();
  renderSummary();
  setupManualSync();
  setupFirstSyncWizard();
  renderAdminHealth();
  renderChangeDashboard();
})();
