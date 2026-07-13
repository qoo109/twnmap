(() => {
  "use strict";
  const original = window.ELECTION_DATA;
  let working = structuredClone(original);
  let pendingImport = null;

  const $ = (selector) => document.querySelector(selector);
  const els = {
    themeButton: $("#themeButton"),
    dataFile: $("#dataFile"),
    fileName: $("#fileName"),
    applyImport: $("#applyImport"),
    resetWorkingData: $("#resetWorkingData"),
    downloadJson: $("#downloadJson"),
    downloadJs: $("#downloadJs"),
    downloadTemplate: $("#downloadTemplate"),
    downloadHistoryTemplate: $("#downloadHistoryTemplate"),
    currentOfficeholderCount: $("#currentOfficeholderCount"),
    currentCandidateCount: $("#currentCandidateCount"),
    currentHistoryCount: $("#currentHistoryCount"),
    currentOfficialHistoryCount: $("#currentOfficialHistoryCount"),
    currentIdentityReviewCount: $("#currentIdentityReviewCount"),
    currentOfficialCount: $("#currentOfficialCount"),
    currentPendingCount: $("#currentPendingCount"),
    currentVersion: $("#currentVersion"),
    validationState: $("#validationState"),
    validationOutput: $("#validationOutput"),
    previewBody: $("#previewBody"),
    manualRepoInput: $("#manualRepoInput"), manualBranchInput: $("#manualBranchInput"), manualTokenInput: $("#manualTokenInput"),
    manualHistoryScope: $("#manualHistoryScope"), manualHistoryYears: $("#manualHistoryYears"), manualRememberToken: $("#manualRememberToken"),
    manualDispatchButton: $("#manualDispatchButton"), manualOpenActionsButton: $("#manualOpenActionsButton"), manualReloadButton: $("#manualReloadButton"), manualSyncStatus: $("#manualSyncStatus"),
    quickFullSyncButton: $("#quickFullSyncButton"), quickFullSyncStatus: $("#quickFullSyncStatus"),
    adminHealthState: $("#adminHealthState"), adminHealthGrid: $("#adminHealthGrid"), adminHealthNote: $("#adminHealthNote"),
    wizardOverallState: $("#wizardOverallState"), wizardTestButton: $("#wizardTestButton"), wizardCurrentButton: $("#wizardCurrentButton"), wizardHistoryButton: $("#wizardHistoryButton"), wizardVerifyButton: $("#wizardVerifyButton"),
    wizardStep1Status: $("#wizardStep1Status"), wizardStep2Status: $("#wizardStep2Status"), wizardStep3Status: $("#wizardStep3Status"), wizardStep4Status: $("#wizardStep4Status"), wizardResult: $("#wizardResult"),
    changeGuardState: $("#changeGuardState"), changeSummary: $("#changeSummary"), changeDetails: $("#changeDetails"), changeGeneratedAt: $("#changeGeneratedAt"),
  };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += char;
    }
    row.push(field.replace(/\r$/, ""));
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function splitList(value) {
    return String(value || "").split(/[|；;]/).map((item) => item.trim()).filter(Boolean);
  }

  function csvToData(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, ""));
    if (rows.length < 2) throw new Error("CSV 沒有資料列。");
    const headers = rows[0].map((value) => value.trim());
    const required = ["name", "countyId", "district", "electionType", "partyId", "sourceUrl"];
    for (const field of required) if (!headers.includes(field)) throw new Error(`CSV 缺少欄位：${field}`);
    const index = Object.fromEntries(headers.map((header, i) => [header, i]));
    const imported = rows.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row, rowIndex) => {
      const get = (key) => String(row[index[key]] ?? "").trim();
      const name = get("name");
      const district = get("district");
      const id = get("id") || `manual-${crypto.randomUUID()}`;
      return {
        id,
        demo: get("demo").toLowerCase() === "true",
        official: get("official").toLowerCase() === "true",
        name,
        number: Number(get("number")) || null,
        countyId: get("countyId"),
        district,
        electionType: get("electionType"),
        partyId: get("partyId"),
        incumbent: get("incumbent").toLowerCase() === "true",
        age: Number(get("age")) || null,
        photo: get("photoUrl") ? { url: get("photoUrl"), sourceUrl: get("photoSourceUrl") || get("sourceUrl"), sourceLabel: get("photoSourceLabel") || "照片來源", credit: get("photoCredit"), license: get("photoLicense"), official: get("photoOfficial").toLowerCase() === "true", verifiedAt: get("photoVerifiedAt") || null } : undefined,
        education: splitList(get("education")),
        experience: splitList(get("experience")),
        policies: splitList(get("policies")),
        judicial: {
          status: get("judicialStatus") || "pending",
          label: get("judicialLabel") || "待人工查核",
          summary: get("judicialSummary") || "尚未完成司法資料人工覆核。",
          final: get("judicialFinal") === "true" ? true : get("judicialFinal") === "false" ? false : null,
          cases: [],
        },
        sources: [{ label: get("sourceLabel") || "人工匯入來源", url: get("sourceUrl"), date: get("sourceDate") || new Date().toISOString().slice(0, 10) }],
        verifiedAt: get("verifiedAt") || null,
        manualRow: rowIndex + 2,
      };
    });
    const next = structuredClone(working);
    const byId = new Map(next.candidates.map((candidate) => [candidate.id, candidate]));
    imported.forEach((candidate) => byId.set(candidate.id, candidate));
    next.candidates = [...byId.values()];
    next.meta.version = `${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}-manual`;
    next.meta.lastGeneratedAt = new Date().toISOString();
    return next;
  }



  function csvToHistoryData(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, ""));
    if (rows.length < 2) throw new Error("歷屆 CSV 沒有資料列。");
    const headers = rows[0].map((value) => value.trim());
    const required = ["year", "name", "countyId", "district", "electionType", "partyId", "votes", "voteRate", "elected"];
    for (const field of required) if (!headers.includes(field)) throw new Error(`歷屆 CSV 缺少欄位：${field}`);
    const index = Object.fromEntries(headers.map((header, i) => [header, i]));
    const get = (row, key) => String(row[index[key]] ?? "").trim();
    const imported = rows.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row, rowIndex) => {
      const year = Number(get(row, "year"));
      const name = get(row, "name");
      const countyId = get(row, "countyId");
      const district = get(row, "district");
      const electionType = get(row, "electionType");
      const partyId = get(row, "partyId");
      const id = get(row, "id") || `history-${year}-${countyId}-${district}-${name}`.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
      return {
        id,
        demo: get(row, "demo").toLowerCase() === "true",
        personKey: get(row, "personKey") || id,
        name,
        year,
        electionType,
        roleId: get(row, "roleId") || "",
        countyId,
        district,
        partyId,
        votes: Number(get(row, "votes")) || 0,
        voteRate: Number(get(row, "voteRate")) || null,
        rank: Number(get(row, "rank")) || null,
        elected: ["true", "1", "是", "當選", "*"] .includes(get(row, "elected").toLowerCase()),
        incumbent: ["true", "1", "是"] .includes(get(row, "incumbent").toLowerCase()),
        sourceType: "manual-history-import",
        sources: [{ label: get(row, "sourceLabel") || "人工匯入歷屆結果", url: get(row, "sourceUrl") || "", date: get(row, "sourceDate") || new Date().toISOString().slice(0, 10) }],
        manualRow: rowIndex + 2,
      };
    });
    const next = structuredClone(working);
    next.history = next.history || { years: [], results: [] };
    const byId = new Map((next.history.results || []).map((record) => [record.id, record]));
    imported.forEach((record) => byId.set(record.id, record));
    next.history.results = [...byId.values()];
    const yearSet = new Set([...(next.history.years || []).map((item) => Number(item.year)), ...imported.map((item) => Number(item.year))]);
    next.history.years = [...yearSet].filter(Boolean).sort((a, b) => b - a).map((year) => {
      const existing = (next.history.years || []).find((item) => Number(item.year) === year);
      return existing || { year, label: `${year} 歷屆選舉`, status: "manual-import" };
    });
    next.meta.version = `${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}-manual-history`;
    next.meta.lastGeneratedAt = new Date().toISOString();
    return rebuildHistoryIndexes(next);
  }

  function rebuildHistoryIndexes(data) {
    const party = new Map((data.parties || []).map((item) => [item.id, item.shortName || item.name]));
    const county = new Map((data.counties || []).map((item) => [item.id, item.name]));
    const results = data.history?.results || [];
    const people = new Map();
    for (const record of results) {
      const key = record.personKey || `${record.name}-${record.countyId || ""}`;
      if (!people.has(key)) people.set(key, []);
      people.get(key).push(record);
    }
    data.personHistory = [...people.entries()].map(([personKey, records]) => ({
      personKey,
      name: records[0]?.name || personKey,
      latestYear: Math.max(...records.map((r) => Number(r.year) || 0)),
      recordCount: records.length,
      records: records.slice().sort((a, b) => Number(b.year || 0) - Number(a.year || 0)),
      partyTransitions: records.slice().sort((a, b) => Number(a.year || 0) - Number(b.year || 0)).reduce((list, record) => {
        if (!list.length || list[list.length - 1].partyId !== record.partyId) list.push({ year: record.year, partyId: record.partyId, partyName: party.get(record.partyId) || record.partyId, basis: "參選推薦政黨" });
        return list;
      }, []),
    }));
    const years = [...new Set(results.map((r) => Number(r.year)))].filter(Boolean).sort((a, b) => b - a);
    const partyIds = [...new Set(results.map((r) => r.partyId))].filter(Boolean);
    data.partyHistory = partyIds.map((partyId) => ({ partyId, partyName: party.get(partyId) || partyId, years: years.map((year) => {
      const subset = results.filter((r) => r.partyId === partyId && Number(r.year) === year);
      const elected = subset.filter((r) => r.elected);
      return { year, candidates: subset.length, elected: elected.length, voteTotal: subset.reduce((sum, r) => sum + (Number(r.votes) || 0), 0) };
    }).filter((row) => row.candidates) }));
    const districts = new Map();
    for (const record of results) {
      const key = `${record.countyId || "unknown"}|${record.district || "未提供選區"}`;
      if (!districts.has(key)) districts.set(key, []);
      districts.get(key).push(record);
    }
    data.districtHistory = [...districts.entries()].map(([key, records]) => { const [countyId, district] = key.split("|"); return { countyId, countyName: county.get(countyId) || countyId, district, records: records.slice().sort((a,b) => Number(b.year || 0) - Number(a.year || 0)) }; });
    return data;
  }

  function validate(data) {
    const errors = [];
    const warnings = [];
    if (!data || !Array.isArray(data.candidates) || !Array.isArray(data.counties) || !Array.isArray(data.parties)) return { errors: ["不是有效的選舉資料格式。"], warnings };
    const countyIds = new Set(data.counties.map((item) => item.id));
    const partyIds = new Set(data.parties.map((item) => item.id));
    const ids = new Set();
    const statuses = new Set(["pending", "verified-none", "public-record"]);
    for (const candidate of data.candidates) {
      for (const key of ["id", "name", "countyId", "district", "electionType", "partyId", "judicial", "sources"]) {
        if (candidate[key] === undefined || candidate[key] === null || candidate[key] === "") errors.push(`${candidate.name || candidate.id || "未知人物"}：缺少 ${key}`);
      }
      if (ids.has(candidate.id)) errors.push(`重複 ID：${candidate.id}`);
      ids.add(candidate.id);
      if (!countyIds.has(candidate.countyId)) errors.push(`${candidate.name}：countyId「${candidate.countyId}」不存在`);
      if (!partyIds.has(candidate.partyId)) errors.push(`${candidate.name}：partyId「${candidate.partyId}」不存在`);
      if (!statuses.has(candidate.judicial?.status)) errors.push(`${candidate.name}：司法狀態不合法`);
      if (!candidate.sources?.some((source) => /^https?:\/\//.test(source.url || ""))) warnings.push(`${candidate.name}：沒有可開啟的來源網址`);
      if (candidate.judicial?.status === "public-record" && !candidate.demo) {
        if (!candidate.verifiedAt) errors.push(`${candidate.name}：公開裁判資料缺少 verifiedAt`);
        for (const item of candidate.judicial.cases || []) {
          for (const key of ["court", "caseNumber", "date", "result"]) if (!item[key]) errors.push(`${candidate.name}：案件缺少 ${key}`);
          if (typeof item.final !== "boolean") errors.push(`${candidate.name}：案件 final 必須為 true 或 false`);
        }
      }
    }
    for (const record of data.history?.results || []) {
      if (!record.id || !record.name || !record.year) errors.push(`歷屆資料：缺少 id/name/year（${record.id || record.name || "未知"}）`);
      if (record.countyId && !countyIds.has(record.countyId)) errors.push(`${record.name} ${record.year}：countyId「${record.countyId}」不存在`);
      if (record.partyId && !partyIds.has(record.partyId)) errors.push(`${record.name} ${record.year}：partyId「${record.partyId}」不存在`);
      if (record.votes != null && Number.isNaN(Number(record.votes))) errors.push(`${record.name} ${record.year}：votes 必須是數字`);
      if (record.voteRate != null && Number.isNaN(Number(record.voteRate))) errors.push(`${record.name} ${record.year}：voteRate 必須是數字`);
    }
    return { errors, warnings };
  }

  function renderSummary() {
    els.currentOfficeholderCount.textContent = working.officeholders?.length || 0;
    els.currentCandidateCount.textContent = working.candidates.length;
    if (els.currentHistoryCount) els.currentHistoryCount.textContent = working.history?.results?.length || 0;
    if (els.currentOfficialHistoryCount) els.currentOfficialHistoryCount.textContent = working.history?.coverage?.officialRecordCount || 0;
    if (els.currentIdentityReviewCount) els.currentIdentityReviewCount.textContent = working.history?.coverage?.identityReviewCount || 0;
    els.currentOfficialCount.textContent = working.candidates.filter((candidate) => candidate.official && !candidate.demo).length;
    els.currentPendingCount.textContent = working.candidates.filter((candidate) => candidate.judicial?.status === "pending").length;
    els.currentVersion.textContent = working.meta?.version || "—";
  }

  function renderPreview() {
    const county = new Map(working.counties.map((item) => [item.id, item.name]));
    const party = new Map(working.parties.map((item) => [item.id, item.shortName || item.name]));
    els.previewBody.innerHTML = [...working.candidates.slice(0, 70), ...(working.history?.results || []).slice(0, 30).map((record) => ({ ...record, judicial: { status: "歷屆" }, electionType: record.electionType || "歷屆選舉", countyId: record.countyId, district: `${record.year || ""} ${record.district || ""}`, partyId: record.partyId, official: true, demo: record.demo, historyRecord: true }))].map((candidate) => `<tr>
      <td><strong>${escapeHtml(candidate.name)}</strong></td>
      <td>${escapeHtml(county.get(candidate.countyId) || candidate.countyId)}<br><small>${escapeHtml(candidate.district)}</small></td>
      <td>${escapeHtml(party.get(candidate.partyId) || candidate.partyId)}</td>
      <td>${candidate.official && !candidate.demo ? "官方" : candidate.demo ? "展示" : "人工"}</td>
      <td>${escapeHtml(candidate.judicial?.status || "未提供")}</td>
    </tr>`).join("");
  }

  function renderValidation(result, title = "目前資料") {
    const valid = result.errors.length === 0;
    els.validationState.textContent = valid ? "驗證通過" : `發現 ${result.errors.length} 個錯誤`;
    els.validationState.className = `validation-state ${valid ? "valid" : "invalid"}`;
    els.validationOutput.innerHTML = `<strong>${escapeHtml(title)}</strong>
      ${result.errors.length ? `<p>必須修正：</p><ul>${result.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>必要欄位與對照關係均通過。</p>"}
      ${result.warnings.length ? `<p>提醒：</p><ul>${result.warnings.slice(0, 30).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}`;
    return valid;
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  async function pollManualSync(config, startedAt, report = setManualSyncStatus) {
    const startMs = Date.parse(startedAt);
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(config.branch)}&per_page=5`;
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      const payload = await githubJson(url, config);
      const run = (payload?.workflow_runs || []).find((item) => Date.parse(item.created_at) >= startMs - 30000) || payload?.workflow_runs?.[0];
      if (!run) { report(`已送出，等待 GitHub 建立工作…（${attempt}/60）`, "progress"); continue; }
      if (run.status !== "completed") { report(`${run.status === "queued" ? "排隊中" : "執行中"}：${run.name || "Daily official data sync"}`, "progress"); continue; }
      if (run.conclusion === "success") { report("同步完成。GitHub Pages 可能再需要 1–3 分鐘部署，之後重新整理公開網站即可看到新資料。", "ok"); return { ok: true, run }; }
      report(`同步結束，但結果為 ${run.conclusion || "unknown"}。請開啟 Actions 查看紀錄。`, "error");
      return { ok: false, run };
    }
    report("同步仍在執行或排隊，請開啟 Actions 查看進度。", "warn");
    return { ok: false, timeout: true };
  }
  async function triggerManualSync() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name) { setManualSyncStatus("請填入 repository，例如 qoo109/taiwan-political-map。", "warn"); return; }
    if (!config.token) { setManualSyncStatus("請填入 GitHub Token。", "warn"); return; }
    saveManualSyncConfig(config);
    els.manualDispatchButton.disabled = true;
    const startedAt = new Date().toISOString();
    try {
      setManualSyncStatus("正在送出更新請求…", "progress");
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, config, {
        method: "POST",
        body: JSON.stringify({ ref: config.branch, inputs: { reason: "admin-manual-refresh", history_scope: config.historyScope, history_years: config.historyYears } }),
      });
      setManualSyncStatus("已觸發 GitHub Actions，等待執行結果…", "progress");
      await pollManualSync(config, startedAt);
    } catch (error) {
      setManualSyncStatus(`更新失敗：${error.message || error}`, "error");
    } finally {
      els.manualDispatchButton.disabled = false;
    }
  }
  function setQuickFullSyncStatus(message, tone = "") {
    if (!els.quickFullSyncStatus) return;
    els.quickFullSyncStatus.textContent = message;
    els.quickFullSyncStatus.dataset.tone = tone;
  }
  async function triggerQuickFullSync() {
    const base = manualSyncConfig();
    const config = { ...base, historyScope: "core", historyYears: "all" };
    if (!config.owner || !config.name) {
      setQuickFullSyncStatus("請先在下方填入 repository，例如 qoo109/taiwan-political-map。", "warn");
      els.manualRepoInput?.focus();
      document.querySelector(".admin-sync-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!config.token) {
      setQuickFullSyncStatus("請先在下方填入 GitHub Token。", "warn");
      els.manualTokenInput?.focus();
      document.querySelector(".admin-sync-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    saveManualSyncConfig(config);
    els.manualHistoryScope.value = "core";
    els.manualHistoryYears.value = "all";
    els.quickFullSyncButton.disabled = true;
    const startedAt = new Date().toISOString();
    try {
      setQuickFullSyncStatus("正在送出完整官方更新：現任、候選人、核心歷屆、頭貼、異動報告與資料分片…", "progress");
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, config, {
        method: "POST",
        body: JSON.stringify({ ref: config.branch, inputs: { reason: "admin-one-click-full-refresh", history_scope: "core", history_years: "all" } }),
      });
      const result = await pollManualSync(config, startedAt, setQuickFullSyncStatus);
      if (result?.ok) localStorage.setItem("last-one-click-full-sync", new Date().toISOString());
    } catch (error) {
      setQuickFullSyncStatus(`完整更新失敗：${error.message || error}`, "error");
    } finally {
      els.quickFullSyncButton.disabled = false;
    }
  }

  function openActionsPage() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name) { setManualSyncStatus("請先填入 repository。", "warn"); return; }
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
    if (els.wizardOverallState) {
      els.wizardOverallState.textContent = message;
      els.wizardOverallState.className = `validation-state ${state}`;
    }
  }
  async function testWizardAccess() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name || !config.token) {
      setWizardStep(1, "error", "請先填妥下方 repository 與 Token");
      els.wizardResult.textContent = "第一次同步精靈會使用『立即更新官方資料』區塊中的 GitHub 設定。";
      return;
    }
    saveManualSyncConfig(config);
    els.wizardTestButton.disabled = true;
    setWizardStep(1, "progress", "正在檢查 repository、分支與 workflow…");
    updateWizardOverall("檢查中", "warn");
    try {
      const repo = await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}`, config);
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}`, config);
      const branch = await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/branches/${encodeURIComponent(config.branch)}`, config);
      setWizardStep(1, "ok", `可用：${repo.full_name} · ${branch.name}`);
      els.wizardCurrentButton.disabled = false;
      els.wizardResult.textContent = "權限檢查通過。下一步會執行現任與正式候選人同步。";
      updateWizardOverall("步驟 1 完成", "ok");
      localStorage.setItem("first-sync-step", "1");
    } catch (error) {
      setWizardStep(1, "error", `檢查失敗：${error.message || error}`);
      els.wizardResult.textContent = "請確認 repository、分支、Token 的 Actions: write 與 Contents: read/write 權限。";
      updateWizardOverall("需要修正", "invalid");
    } finally {
      els.wizardTestButton.disabled = false;
    }
  }
  async function dispatchWizardScope(scope, step) {
    const config = { ...manualSyncConfig(), historyScope: scope };
    if (!config.owner || !config.name || !config.token) return testWizardAccess();
    const button = step === 2 ? els.wizardCurrentButton : els.wizardHistoryButton;
    button.disabled = true;
    const startedAt = new Date().toISOString();
    setWizardStep(step, "progress", "已送出，等待 GitHub Actions…");
    updateWizardOverall(`正在執行步驟 ${step}`, "warn");
    try {
      await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, config, {
        method: "POST",
        body: JSON.stringify({ ref: config.branch, inputs: { reason: `first-sync-step-${step}`, history_scope: scope, history_years: config.historyYears } }),
      });
      const result = await pollManualSync(config, startedAt);
      if (!result?.ok) throw new Error(result?.run?.conclusion || "工作流程未成功完成");
      setWizardStep(step, "ok", step === 2 ? "現任／候選人同步成功" : "核心歷屆同步成功");
      if (step === 2) {
        els.wizardHistoryButton.disabled = false;
        els.wizardVerifyButton.disabled = false;
      } else els.wizardVerifyButton.disabled = false;
      localStorage.setItem("first-sync-step", String(step));
      updateWizardOverall(`步驟 ${step} 完成`, "ok");
      els.wizardResult.textContent = step === 2 ? "現任同步完成。可繼續匯入核心歷屆，或先驗證公開資料。" : "核心歷屆同步完成。等待 Pages 部署後執行最後驗證。";
    } catch (error) {
      setWizardStep(step, "error", `失敗：${error.message || error}`);
      updateWizardOverall("同步失敗", "invalid");
      button.disabled = false;
    }
  }
  async function readPublishedData(config) {
    const payload = await githubJson(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}/contents/data/election-data.json?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`, config);
    if (!payload?.content) throw new Error("repository 中找不到 data/election-data.json");
    const text = decodeURIComponent(escape(atob(String(payload.content).replace(/\s/g, ""))));
    return JSON.parse(text);
  }
  async function verifyWizardPublication() {
    const config = manualSyncConfig();
    if (!config.owner || !config.name || !config.token) return testWizardAccess();
    els.wizardVerifyButton.disabled = true;
    setWizardStep(4, "progress", "正在讀取 repository 最新公開資料…");
    try {
      const published = await readPublishedData(config);
      const officeholders = published.officeholders?.length || 0;
      const candidates = (published.candidates || []).filter((item) => item.official && !item.demo).length;
      const history = published.history?.coverage?.officialRecordCount || 0;
      const synced = published.officeholderSync?.lastSuccessAt || published.sync?.lastSuccessAt;
      if (officeholders <= 2 && !synced) throw new Error("仍只有種子資料，可能尚未完成首次同步或尚未提交");
      setWizardStep(4, "ok", `已發布：現任 ${officeholders}、候選人 ${candidates}、官方歷屆 ${history}`);
      updateWizardOverall("第一次同步完成", "ok");
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
    if (!els.wizardTestButton) return;
    const step = Number(localStorage.getItem("first-sync-step") || 0);
    if (step >= 1) { setWizardStep(1, "ok", "上次權限檢查通過，可重新檢查"); els.wizardCurrentButton.disabled = false; }
    if (step >= 2) { setWizardStep(2, "ok", "上次現任同步已完成"); els.wizardHistoryButton.disabled = false; els.wizardVerifyButton.disabled = false; }
    if (step >= 3) { setWizardStep(3, "ok", "上次核心歷屆同步已完成"); }
    if (step >= 4) { setWizardStep(4, "ok", "上次公開資料驗證通過"); updateWizardOverall("已完成", "ok"); }
    els.wizardTestButton.addEventListener("click", testWizardAccess);
    els.wizardCurrentButton.addEventListener("click", () => dispatchWizardScope("none", 2));
    els.wizardHistoryButton.addEventListener("click", () => dispatchWizardScope("core", 3));
    els.wizardVerifyButton.addEventListener("click", verifyWizardPublication);
  }
  function renderChangeDashboard() {
    if (!els.changeSummary) return;
    const report = working.changeLog;
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
    els.changeDetails.innerHTML = `<article><h4>移除紀錄</h4>${list(removed, "本次沒有移除人物。")}</article><article><h4>職務／政黨等欄位變更</h4>${list(changed, "本次沒有主要欄位變更。")}</article>`;
    const suspicious = Boolean(report.guard?.requiresReview);
    els.changeGuardState.textContent = suspicious ? "需要人工確認" : "安全門檻通過";
    els.changeGuardState.className = `validation-state ${suspicious ? "invalid" : "ok"}`;
    els.changeGeneratedAt.textContent = `${report.generatedAt ? new Date(report.generatedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未標示時間"} · ${report.guard?.reason || ""}`;
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
    els.quickFullSyncButton?.addEventListener("click", triggerQuickFullSync);
    els.manualOpenActionsButton.addEventListener("click", openActionsPage);
    els.manualReloadButton.addEventListener("click", () => location.reload());
  }

  els.dataFile.addEventListener("change", async () => {
    const file = els.dataFile.files[0];
    pendingImport = null;
    els.applyImport.disabled = true;
    if (!file) return;
    els.fileName.textContent = file.name;
    try {
      const text = await file.text();
      if (/\.csv$/i.test(file.name)) {
        const headerLine = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";
        pendingImport = /(^|,)year(,|$)/.test(headerLine) && /(^|,)votes(,|$)/.test(headerLine) ? csvToHistoryData(text) : csvToData(text);
      }
      else if (/\.js$/i.test(file.name)) {
        const match = text.match(/window\.ELECTION_DATA\s*=\s*([\s\S]*);\s*$/);
        if (!match) throw new Error("無法從 JS 找到 window.ELECTION_DATA。 ");
        pendingImport = JSON.parse(match[1]);
      } else pendingImport = JSON.parse(text);
      const result = validate(pendingImport);
      els.applyImport.disabled = result.errors.length > 0;
      renderValidation(result, `待匯入：${file.name}`);
    } catch (error) {
      renderValidation({ errors: [error.message], warnings: [] }, file.name);
    }
  });

  els.applyImport.addEventListener("click", () => {
    if (!pendingImport) return;
    const result = validate(pendingImport);
    if (!renderValidation(result, "已套用的工作資料")) return;
    working = structuredClone(pendingImport);
    renderSummary(); renderPreview(); renderChangeDashboard();
  });

  els.resetWorkingData.addEventListener("click", () => {
    working = structuredClone(original); pendingImport = null; els.dataFile.value = ""; els.fileName.textContent = "尚未選擇檔案"; els.applyImport.disabled = true;
    renderSummary(); renderPreview(); renderValidation(validate(working), "目前網站資料"); renderChangeDashboard();
  });

  els.downloadJson.addEventListener("click", () => {
    if (!renderValidation(validate(working), "準備下載")) return;
    download("election-data.json", `${JSON.stringify(working, null, 2)}\n`, "application/json;charset=utf-8");
  });
  els.downloadJs.addEventListener("click", () => {
    if (!renderValidation(validate(working), "準備下載")) return;
    download("candidates.js", `/* Auto-generated from data/election-data.json. */\nwindow.ELECTION_DATA = ${JSON.stringify(working, null, 2)};\n`, "text/javascript;charset=utf-8");
  });
  els.downloadHistoryTemplate?.addEventListener("click", () => {
    const header = "id,personKey,year,name,countyId,district,electionType,roleId,partyId,votes,voteRate,rank,elected,incumbent,demo,sourceLabel,sourceUrl,sourceDate\n";
    const example = "history-example,person-example,2022,候選人姓名,taipei,臺北市第 1 選區,直轄市議員,municipal-councilor,dpp,12345,12.3,1,true,false,false,中選會選舉資料庫,https://example.gov.tw,2026-07-12\n";
    download("history-import-template.csv", `\uFEFF${header}${example}`, "text/csv;charset=utf-8");
  });

  els.downloadTemplate.addEventListener("click", () => {
    const header = "id,name,number,countyId,district,electionType,partyId,official,demo,incumbent,age,photoUrl,photoSourceUrl,photoSourceLabel,photoCredit,photoLicense,photoOfficial,photoVerifiedAt,education,experience,policies,judicialStatus,judicialLabel,judicialSummary,judicialFinal,sourceLabel,sourceUrl,sourceDate,verifiedAt\n";
    const example = 'manual-example,候選人姓名,1,taipei,臺北市,直轄市長,kmt,false,false,false,50,https://example.gov.tw/photo.jpg,https://example.gov.tw/profile,官方人物照片,提供機關,請依來源填寫,true,2026-07-12,"學歷一|學歷二","經歷一|經歷二","交通|住宅",pending,待人工查核,尚未完成司法資料人工覆核,,官方或候選人來源,https://example.gov.tw,2026-07-12,\n';
    download("candidate-import-template.csv", `\uFEFF${header}${example}`, "text/csv;charset=utf-8");
  });

  function adminAgeDays(value) { const time = value ? new Date(value).getTime() : NaN; return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86400000) : Infinity; }
  function renderAdminHealth() {
    if (!els.adminHealthGrid) return;
    const os = working.officeholderSync || {}; const cs = working.sync || {}; const hs = working.historySync || working.history?.coverage || {};
    const reports = [
      { name: "總統府", count: (working.officeholders || []).filter((x) => ["president","vice-president"].includes(x.roleId)).length, time: os.lastSuccessAt || "2026-07-12", state: os.coverage?.presidency || "seeded" },
      { name: "立法院", count: os.legislatorCount || 0, time: os.lastSuccessAt, state: os.coverage?.legislature || "waiting" },
      { name: "內政部地方公職", count: os.localOfficeholderCount || 0, time: os.lastSuccessAt, state: os.coverage?.local || "waiting" },
      { name: "中選會候選人", count: cs.officialCandidateCount || 0, time: cs.lastSuccessAt, state: cs.status || "not-run" },
      { name: "中選會歷屆", count: hs.officialRecordCount || 0, time: hs.finishedAt || hs.lastOfficialSyncAt, state: hs.status || "waiting" },
      { name: "官方頭貼", count: [...(working.officeholders || []), ...(working.candidates || [])].filter((x) => x.photo?.official).length, time: working.photoSync?.lastSuccessAt, state: working.photoSync?.status || "waiting" },
    ];
    const okay = reports.filter((r) => r.count > 0 && adminAgeDays(r.time) <= 8).length;
    els.adminHealthState.textContent = okay >= 4 ? "正常" : okay >= 2 ? "部分待同步" : "等待首次同步";
    els.adminHealthState.className = `validation-state ${okay >= 4 ? "ok" : okay >= 2 ? "warn" : ""}`;
    els.adminHealthGrid.innerHTML = reports.map((r) => `<article><span>${escapeHtml(r.name)}</span><strong>${Number(r.count).toLocaleString("zh-Hant")}</strong><small>${escapeHtml(r.time ? new Date(r.time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚無成功紀錄")}</small><em>${escapeHtml(String(r.state))}</em></article>`).join("");
    const preserved = (os.sources || []).filter((r) => String(r.status).includes("preserved")).length;
    els.adminHealthNote.textContent = preserved ? `有 ${preserved} 個來源本次沿用上一版資料，請查看 GitHub Actions 紀錄。` : "未偵測到沿用上一版的來源；仍建議定期檢查同步紀錄。";
  }

  const saved = localStorage.getItem("election-map-theme");
  if (saved === "dark") document.documentElement.dataset.theme = "dark";
  function updateTheme() { const light = document.documentElement.dataset.theme !== "dark"; els.themeButton.textContent = light ? "☾" : "☼"; }
  els.themeButton.addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("election-map-theme", next); updateTheme(); });
  updateTheme(); setupManualSync(); setupFirstSyncWizard(); renderSummary(); renderPreview(); renderValidation(validate(working), "目前網站資料"); renderAdminHealth(); renderChangeDashboard();
})();
