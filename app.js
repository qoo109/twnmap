(() => {
  "use strict";

  const data = window.ELECTION_DATA;
  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>資料載入失敗，請確認 data/candidates.js 與 index.html 位於同一個專案資料夾。</p>";
    return;
  }

  const personDetailCache = new Map();
  const dataManifest = window.DATA_MANIFEST || data.dataManifest || null;
  const officialCandidateItems = (Array.isArray(data.candidates) ? data.candidates : []).filter((item) => item?.official && !item?.demo);
  const publicHistoryItems = (Array.isArray(data.history?.results) ? data.history.results : []).filter((item) => !item?.demo && item?.sourceType !== "demo");
  const availableHistoryYears = [...new Set(publicHistoryItems.map((item) => Number(item.year)).filter(Boolean))].sort((a, b) => b - a);
  const hasOfficialCandidates = officialCandidateItems.length > 0;
  const hasPublicHistory = publicHistoryItems.length > 0;
  const electionYear = String(data.meta?.electionDate || "").slice(0, 4) || "候選";
  const urlParams = new URLSearchParams(location.search);
  let pendingTownKey = urlParams.get("town") || "";
  const urlView = ["officeholders", "candidates", "history"].includes(urlParams.get("view")) ? urlParams.get("view") : "";
  const requestedDefaultView = urlView || data.meta?.defaultView || "officeholders";
  const resolvedDefaultView = requestedDefaultView === "candidates" && !hasOfficialCandidates ? "officeholders" : requestedDefaultView;
  const storedLegendPreference = "true";
  const storedFilterPreference = localStorage.getItem("political-map-filters-collapsed");
  const storedSummaryPreference = localStorage.getItem("political-map-summary-collapsed");
  const storedResultsPreference = localStorage.getItem("election-report-results-collapsed");
  const storedSortPreference = localStorage.getItem("election-report-officeholder-sort");

  const state = {
    view: resolvedDefaultView,
    county: urlParams.get("county") || "all",
    party: urlParams.get("party") || "all",
    role: urlParams.get("role") || "all",
    year: urlParams.get("year") || (availableHistoryYears.length ? String(availableHistoryYears[0]) : ""),
    historyType: urlParams.get("type") || "all",
    query: urlParams.get("q") || "",
    town: null,
    mapMode: "party-strength",
    sort: ["role", "county", "name"].includes(storedSortPreference) ? storedSortPreference : "role",
    compare: new Set(),
    partyGroupLimits: Object.create(null),
    resultsCollapsed: storedResultsPreference === "true",
    person: urlParams.get("person") || "",
    legendCollapsed: storedLegendPreference === null ? window.matchMedia("(max-width: 680px)").matches : storedLegendPreference === "true",
    filtersCollapsed: storedFilterPreference === null ? window.matchMedia("(max-width: 900px)").matches : storedFilterPreference === "true",
    summaryCollapsed: storedSummaryPreference === null ? window.matchMedia("(max-width: 680px)").matches : storedSummaryPreference === "true",
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const els = {
    headerSyncChip: $("#headerSyncChip"), themeButton: $("#themeButton"), sourceButton: $("#sourceButton"), shareButton: $("#shareButton"),
    appShell: $(".app-shell"), controlPanel: $("#controlPanel"), filterToggleButton: $("#filterToggleButton"), mobileFilterClose: $("#mobileFilterClose"), filterScrim: $("#filterScrim"), activeFilterBar: $("#activeFilterBar"), activeFilterList: $("#activeFilterList"), clearActiveFilters: $("#clearActiveFilters"),
    filterEyebrow: $("#filterEyebrow"), filterTitle: $("#filterTitle"), searchInput: $("#searchInput"),
    roleSelect: $("#roleSelect"), yearSelect: $("#yearSelect"), historyTypeSelect: $("#historyTypeSelect"), countySelect: $("#countySelect"),
    partySelect: $("#partySelect"), resetFilters: $("#resetFilters"),
    officeholderFilters: $("#officeholderFilters"), historyFilters: $("#historyFilters"),
    filterNote: $("#filterNote"), roleShortcuts: $("#roleShortcuts"), mapEyebrow: $("#mapEyebrow"),
    mapTitle: $("#mapTitle"), mapSubtitle: $("#mapSubtitle"), mapModeSwitch: $("#mapModeSwitch"), mapCountyJump: $("#mapCountyJump"), mapTownJump: $("#mapTownJump"), resetMapLocation: $("#resetMapLocation"),
    mapInsightArea: $("#mapInsightArea"), mapInsightVolume: $("#mapInsightVolume"), mapInsightLeaderCard: $("#mapInsightLeaderCard"), mapInsightLeaderLabel: $("#mapInsightLeaderLabel"), mapInsightLeader: $("#mapInsightLeader"), mapInsightLeaderShare: $("#mapInsightLeaderShare"), mapInsightGapLabel: $("#mapInsightGapLabel"), mapInsightGap: $("#mapInsightGap"), mapInsightGapDetail: $("#mapInsightGapDetail"),
    mapHomeButton: $("#mapHomeButton"), mapCrumbCounty: $("#mapCrumbCounty"), mapCrumbTown: $("#mapCrumbTown"),
    mapTownSeparator: $("#mapTownSeparator"), leafletMap: $("#leafletMap"), mapLoading: $("#mapLoading"),
    mapFallback: $("#mapFallback"), mapLegend: $("#mapLegend"), mapGuideChip: $("#mapGuideChip"), areaSummary: $("#areaSummary"), summaryCollapseButton: $("#summaryCollapseButton"), selectedAreaLevel: $("#selectedAreaLevel"),
    selectedCountyName: $("#selectedCountyName"), selectedCountyDescription: $("#selectedCountyDescription"),
    selectedTownName: $("#selectedTownName"), summaryMetric1Label: $("#summaryMetric1Label"),
    summaryMetric2Label: $("#summaryMetric2Label"), summaryMetric3Label: $("#summaryMetric3Label"),
    summaryMetric1: $("#summaryMetric1"), summaryMetric2: $("#summaryMetric2"), summaryMetric3: $("#summaryMetric3"),
    partyBreakdown: $("#partyBreakdown"), areaCoverageBadge: $("#areaCoverageBadge"), showAllButton: $("#showAllButton"), overviewMode: $("#overviewMode"),
    overviewCount: $("#overviewCount"), overviewLocalCount: $("#overviewLocalCount"),
    overviewLegislatorCount: $("#overviewLegislatorCount"), overviewSync: $("#overviewSync"),
    resultsEyebrow: $("#resultsEyebrow"), resultsTitle: $("#resultsTitle"), resultsSummary: $("#resultsSummary"),
    resultsSearchInput: $("#resultsSearchInput"), resultsSortControl: $("#resultsSortControl"), resultsSortSelect: $("#resultsSortSelect"), groupingNote: $("#groupingNote"), togglePartyGroupsButton: $("#togglePartyGroupsButton"), toggleResultsButton: $("#toggleResultsButton"), resultsBody: $("#resultsBody"),
    compareButton: $("#compareButton"), peopleGrid: $("#peopleGrid"),
    emptyState: $("#emptyState"), emptyStateText: $("#emptyStateText"), coveragePresidency: $("#coveragePresidency"),
    coverageLegislature: $("#coverageLegislature"), coverageLocal: $("#coverageLocal"), coverageCandidates: $("#coverageCandidates"),
    syncDetail: $("#syncDetail"), personDialog: $("#personDialog"), personDialogContent: $("#personDialogContent"),
    sourceDialog: $("#sourceDialog"), sourceList: $("#sourceList"), compareDialog: $("#compareDialog"),
    compareContent: $("#compareContent"),
    historyLabSection: $("#historyLabSection"), personHistoryPreview: $("#personHistoryPreview"), partyHistoryPreview: $("#partyHistoryPreview"), districtHistoryPreview: $("#districtHistoryPreview"),
    historyOfficialRecords: $("#historyOfficialRecords"), historyOfficialPeople: $("#historyOfficialPeople"), historyCoverageYears: $("#historyCoverageYears"), historyIdentityReview: $("#historyIdentityReview"), historyCoverageNote: $("#historyCoverageNote"),
    candidateViewButton: $("#candidateViewButton"), candidateYearLabel: $("#candidateYearLabel"),
    availabilityNotice: $("#availabilityNotice"), availabilityTitle: $("#availabilityTitle"), availabilityText: $("#availabilityText"), availabilitySyncButton: $("#availabilitySyncButton"), toast: $("#toast"),
    dataHealthPanel: $("#dataHealthPanel"), dataHealthTitle: $("#dataHealthTitle"), dataHealthText: $("#dataHealthText"), dataHealthScore: $("#dataHealthScore"), dataHealthSources: $("#dataHealthSources"),
    syncStatusDialog: $("#syncStatusDialog"), syncStatusDialogContent: $("#syncStatusDialogContent"), syncDialogRefreshButton: $("#syncDialogRefreshButton"),
    newDataBanner: $("#newDataBanner"), reloadNewDataButton: $("#reloadNewDataButton"), dismissNewDataButton: $("#dismissNewDataButton"),
  };

  const countyById = new Map((data.counties || []).map((item) => [item.id, item]));
  const partyById = new Map((data.parties || []).map((item) => [item.id, item]));
  const roleById = new Map((data.roles || []).map((item) => [item.id, item]));
  const COUNTY_CODE_TO_ID = {
    "63000": "taipei", "64000": "kaohsiung", "65000": "new-taipei", "66000": "taichung",
    "67000": "tainan", "68000": "taoyuan", "10002": "yilan", "10004": "hsinchu-county",
    "10005": "miaoli", "10007": "changhua", "10008": "nantou", "10009": "yunlin",
    "10010": "chiayi-county", "10013": "pingtung", "10014": "taitung", "10015": "hualien",
    "10016": "penghu", "10017": "keelung", "10018": "hsinchu-city", "10020": "chiayi-city",
    "09020": "kinmen", "09007": "lienchiang"
  };
  const aliases = {
    taipei: ["taipei", "taipeicity"], "new-taipei": ["newtaipei", "newtaipeicity"], keelung: ["keelung", "keelungcity"],
    taoyuan: ["taoyuan", "taoyuancity"], "hsinchu-city": ["hsinchu", "hsinchucity"], "hsinchu-county": ["hsinchucounty"],
    miaoli: ["miaoli", "miaolicounty"], taichung: ["taichung", "taichungcity"], changhua: ["changhua", "changhuacounty"],
    nantou: ["nantou", "nantoucounty"], yunlin: ["yunlin", "yunlincounty"], "chiayi-city": ["chiayi", "chiayicity"],
    "chiayi-county": ["chiayicounty"], tainan: ["tainan", "tainancity"], kaohsiung: ["kaohsiung", "kaohsiungcity"],
    pingtung: ["pingtung", "pingtungcounty"], yilan: ["yilan", "yilancounty"], hualien: ["hualien", "hualiencounty"],
    taitung: ["taitung", "taitungcounty"], penghu: ["penghu", "penghucounty"], kinmen: ["kinmen", "kinmencounty"],
    lienchiang: ["lienchiang", "lienchiangcounty", "matsu"]
  };

  let mapInstance = null;
  let countyLayer = null;
  let townLayer = null;
  let countyGeoJSON = null;
  let townGeoJSON = null;
  let nationalBounds = null;
  const countyLeafletLayers = new Map();
  const townLeafletLayers = new Map();
  const townFeatureByKey = new Map();

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function safeArray(value) { return Array.isArray(value) ? value : value ? [value] : []; }
  function displayPersonName(value) {
    const raw = String(value || "").trim();
    if (!raw) return "未命名";
    const photoLabelMatch = raw.match(/委員照片\s+(?:無徽章|.+?徽章)\s+(.+)$/u);
    return photoLabelMatch?.[1]?.trim() || raw;
  }
  function personInitials(name) {
    const clean = displayPersonName(name).replace(/[\s　·・．.]/g, "");
    return [...clean].slice(-2).join("") || "?";
  }
  function safePhotoUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), location.href);
      if (["http:", "https:", "file:"].includes(url.protocol) || String(value).startsWith("assets/")) return String(value);
    } catch { if (String(value).startsWith("assets/")) return String(value); }
    return "";
  }
  function photoInfo(item) {
    const photo = item?.photo || {};
    const url = safePhotoUrl(photo.localUrl || photo.url || item?.photoUrl);
    return {
      url, official: Boolean(photo.official || item?.officialPhoto),
      sourceUrl: photo.sourceUrl || safeArray(item?.sources)[0]?.url || "",
      sourceLabel: photo.sourceLabel || photo.credit || "照片來源待補",
      credit: photo.credit || "", license: photo.license || "", verifiedAt: photo.verifiedAt || "",
    };
  }
  function avatarHtml(item, className = "person-avatar") {
    const info = photoInfo(item);
    const name = displayPersonName(item?.name);
    const fallback = `<span class="avatar-fallback"${info.url ? " hidden" : ""}>${escapeHtml(personInitials(name))}</span>`;
    const image = info.url ? `<img src="${escapeHtml(info.url)}" alt="${escapeHtml(name)}的官方頭貼" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : "";
    return `<div class="${escapeHtml(className)}" style="--party-color:${escapeHtml(party(item).color)}">${image}${fallback}${info.official ? '<b class="photo-official-badge" title="官方照片">官</b>' : ''}</div>`;
  }
  function formatDate(value) {
    if (!value) return "尚無紀錄";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { els.toast.hidden = true; }, 2600);
  }
  function validateInitialState() {
    if (state.county !== "all" && !countyById.has(state.county)) state.county = "all";
    if (state.party !== "all" && !partyById.has(state.party)) state.party = "all";
    if (state.role !== "all" && !roleById.has(state.role)) state.role = "all";
    if (state.year && !availableHistoryYears.includes(Number(state.year))) state.year = availableHistoryYears.length ? String(availableHistoryYears[0]) : "";
    if (state.view === "history" && !hasPublicHistory) state.year = "";
  }
  function currentUrl() {
    const url = new URL(location.href);
    const params = new URLSearchParams();
    params.set("view", state.view);
    if (state.county !== "all") params.set("county", state.county);
    if (state.party !== "all") params.set("party", state.party);
    if (state.view === "officeholders" && state.role !== "all") params.set("role", state.role);
    if (state.view === "history" && state.year) params.set("year", state.year);
    if (state.view === "history" && state.historyType !== "all") params.set("type", state.historyType);
    if (state.county !== "all" && state.town?.name) params.set("town", state.town.code || state.town.name);
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.person) params.set("person", state.person);
    url.search = params.toString();
    return url;
  }
  function syncUrl() {
    try { history.replaceState(null, "", currentUrl()); } catch { /* file:// and embedded previews can restrict history */ }
  }
  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      return copied;
    }
  }
  async function shareCurrentView() {
    syncUrl();
    const url = currentUrl().href;
    const shareData = { title: document.title, text: `${viewLabel()}｜${state.county === "all" ? "全台灣" : countyById.get(state.county)?.name || "台灣"}`, url };
    if (navigator.share && location.protocol !== "file:") {
      try { await navigator.share(shareData); return; } catch (error) { if (error?.name === "AbortError") return; }
    }
    const copied = await copyText(url);
    showToast(copied ? (location.protocol === "file:" ? "已複製本機網址；部署上線後才可供其他人開啟" : "已複製目前畫面的分享網址") : "無法自動複製，請從網址列複製");
  }
  function applyLayoutState() {
    const mobileFilters = window.matchMedia("(max-width: 900px)").matches;
    els.appShell?.classList.toggle("filters-collapsed", state.filtersCollapsed);
    els.controlPanel?.setAttribute("aria-hidden", String(state.filtersCollapsed));
    if (els.controlPanel) els.controlPanel.inert = state.filtersCollapsed;
    if (els.filterScrim) els.filterScrim.hidden = state.filtersCollapsed || !mobileFilters;
    document.body.classList.toggle("mobile-filters-open", mobileFilters && !state.filtersCollapsed);
    if (els.filterToggleButton) {
      els.filterToggleButton.textContent = state.filtersCollapsed ? (mobileFilters ? "開啟篩選" : "展開篩選") : (mobileFilters ? "關閉篩選" : "收合篩選");
      els.filterToggleButton.setAttribute("aria-expanded", String(!state.filtersCollapsed));
    }
    els.areaSummary?.classList.toggle("is-collapsed", state.summaryCollapsed);
    if (els.summaryCollapseButton) {
      els.summaryCollapseButton.textContent = state.summaryCollapsed ? "+" : "−";
      els.summaryCollapseButton.setAttribute("aria-expanded", String(!state.summaryCollapsed));
      els.summaryCollapseButton.setAttribute("aria-label", state.summaryCollapsed ? "展開地區資訊" : "收合地區資訊");
    }
    setTimeout(() => mapInstance?.invalidateSize(), 180);
  }
  function toggleFilters() {
    state.filtersCollapsed = !state.filtersCollapsed;
    localStorage.setItem("political-map-filters-collapsed", String(state.filtersCollapsed));
    applyLayoutState();
  }
  function toggleSummary() {
    state.summaryCollapsed = !state.summaryCollapsed;
    localStorage.setItem("political-map-summary-collapsed", String(state.summaryCollapsed));
    applyLayoutState();
  }
  function activeFilterEntries() {
    const entries = [];
    if (state.query.trim()) entries.push({ key: "query", label: `搜尋：${state.query.trim()}` });
    if (state.county !== "all") entries.push({ key: "county", label: countyById.get(state.county)?.name || state.county });
    if (state.town?.name) entries.push({ key: "town", label: state.town.name });
    if (state.party !== "all") entries.push({ key: "party", label: partyById.get(state.party)?.shortName || state.party });
    if (state.view === "officeholders" && state.role !== "all") entries.push({ key: "role", label: roleById.get(state.role)?.name || state.role });
    if (state.view === "history" && state.year && state.year !== String(availableHistoryYears[0] || "")) entries.push({ key: "year", label: `${state.year} 年` });
    if (state.view === "history" && state.historyType !== "all") entries.push({ key: "historyType", label: roleById.get(state.historyType)?.name || state.historyType });
    return entries;
  }
  function renderActiveFilters() {
    if (!els.activeFilterBar || !els.activeFilterList) return;
    const entries = activeFilterEntries();
    els.activeFilterBar.hidden = !entries.length;
    els.activeFilterList.innerHTML = entries.map((entry) => `<button type="button" class="active-filter-chip" data-clear-filter="${escapeHtml(entry.key)}"><span>${escapeHtml(entry.label)}</span><b aria-hidden="true">×</b></button>`).join("");
  }
  function clearSingleFilter(key) {
    if (key === "query") { state.query = ""; els.searchInput.value = ""; if (els.resultsSearchInput) els.resultsSearchInput.value = ""; }
    if (key === "county") { state.county = "all"; state.town = null; els.countySelect.value = "all"; focusMapOnCounty("all"); }
    if (key === "town") { state.town = null; if (state.county !== "all") focusMapOnCounty(state.county); }
    if (key === "party") { state.party = "all"; els.partySelect.value = "all"; }
    if (key === "role") { state.role = "all"; els.roleSelect.value = "all"; }
    if (key === "historyType") { state.historyType = "all"; if (els.historyTypeSelect) els.historyTypeSelect.value = "all"; }
    if (key === "year") { state.year = availableHistoryYears.length ? String(availableHistoryYears[0]) : ""; els.yearSelect.value = state.year; }
    renderAll();
  }
  function normalizeCountyName(value) {
    return String(value || "").trim().replaceAll("台", "臺").replace(/\s+/g, "").replace(/(City|County)$/i, "").toLocaleLowerCase("zh-Hant");
  }
  function countyIdFromProperties(properties = {}) {
    const code = String(properties.COUNTYCODE || properties.countycode || properties.code || "").padStart(5, "0");
    if (COUNTY_CODE_TO_ID[code]) return COUNTY_CODE_TO_ID[code];
    for (const value of Object.values(properties).filter((v) => typeof v === "string")) {
      const normalized = normalizeCountyName(value);
      const match = (data.counties || []).find((county) => normalized === normalizeCountyName(county.name) || (aliases[county.id] || []).includes(normalized));
      if (match) return match.id;
    }
    return null;
  }
  function party(item) { return partyById.get(item?.partyId) || { id: "other", name: "未分類", shortName: "未分類", color: "#7b8497" }; }
  function role(item) { return roleById.get(item?.roleId) || { id: item?.roleId || "other", name: item?.role || item?.electionType || "未分類", group: "其他", mapWeight: 1 }; }
  function currentItems() {
    if (state.view === "officeholders") return safeArray(data.officeholders).map((item) => ({ ...item, kind: "officeholder" }));
    if (state.view === "candidates") return officialCandidateItems.map((item) => ({ ...item, kind: "candidate", role: item.electionType, roleId: `candidate-${item.electionType || "other"}` }));
    return publicHistoryItems.filter((item) => state.year && String(item.year) === state.year).map((item) => ({ ...item, kind: "history" }));
  }
  function itemSearchText(item) {
    return [item.name, item.role, item.electionType, item.district, item.organization, item.countyName, party(item).name, ...safeArray(item.policies), ...safeArray(item.experience)].join(" ").toLocaleLowerCase("zh-Hant");
  }
  function filteredItems({ ignoreCounty = false, ignoreParty = false } = {}) {
    const query = state.query.trim().toLocaleLowerCase("zh-Hant");
    let items = currentItems().filter((item) => {
      if (!ignoreCounty && state.county !== "all" && item.countyId !== state.county) return false;
      if (!ignoreParty && state.party !== "all" && item.partyId !== state.party) return false;
      if (state.view === "officeholders" && state.role !== "all" && item.roleId !== state.role) return false;
      if (state.view === "history" && state.historyType !== "all" && item.roleId !== state.historyType) return false;
      if (state.town?.name) {
        const location = `${item.district || ""} ${item.organization || ""} ${item.town || ""}`;
        if (!location.includes(state.town.name)) return false;
      }
      return !query || itemSearchText(item).includes(query);
    });
    const priority = new Map((data.roles || []).map((r, index) => [r.id, index]));
    const itemCountyName = (item) => countyById.get(item.countyId)?.name || item.countyName || item.district || "";
    const itemName = (item) => displayPersonName(item.name);
    items.sort((a, b) => {
      if (state.view === "officeholders") {
        if (state.sort === "name") return itemName(a).localeCompare(itemName(b), "zh-Hant") || itemCountyName(a).localeCompare(itemCountyName(b), "zh-Hant");
        if (state.sort === "county") {
          return itemCountyName(a).localeCompare(itemCountyName(b), "zh-Hant")
            || (priority.get(a.roleId) ?? 999) - (priority.get(b.roleId) ?? 999)
            || itemName(a).localeCompare(itemName(b), "zh-Hant");
        }
        return (priority.get(a.roleId) ?? 999) - (priority.get(b.roleId) ?? 999)
          || itemCountyName(a).localeCompare(itemCountyName(b), "zh-Hant")
          || itemName(a).localeCompare(itemName(b), "zh-Hant");
      }
      return (priority.get(a.roleId) ?? 999) - (priority.get(b.roleId) ?? 999)
        || party(a).name.localeCompare(party(b).name, "zh-Hant")
        || String(a.name).localeCompare(String(b.name), "zh-Hant");
    });
    return items;
  }

  function officeholderSortLabel() {
    return { role: "職位優先", county: "縣市優先", name: "姓名排序" }[state.sort] || "職位優先";
  }

  function setupTheme() {
    if (localStorage.getItem("political-map-theme") === "dark") document.documentElement.dataset.theme = "dark";
    updateThemeIcon();
    els.themeButton.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("political-map-theme", next);
      updateThemeIcon();
      refreshMapStyles();
    });
  }
  function updateThemeIcon() {
    const light = document.documentElement.dataset.theme !== "dark";
    els.themeButton.textContent = light ? "☾" : "☼";
    els.themeButton.setAttribute("aria-label", light ? "切換深色模式" : "切換淺色模式");
  }

  function setupSelects() {
    (data.counties || []).forEach((county) => {
      const option = `<option value="${escapeHtml(county.id)}">${escapeHtml(county.name)}</option>`;
      els.countySelect.insertAdjacentHTML("beforeend", option);
      els.mapCountyJump?.insertAdjacentHTML("beforeend", option);
    });
    (data.parties || []).forEach((p) => els.partySelect.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(p.id)}">${escapeHtml(p.shortName)}</option>`));
    const groups = new Map();
    (data.roles || []).forEach((r) => { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); });
    for (const [group, roles] of groups) {
      const optgroup = document.createElement("optgroup"); optgroup.label = group;
      roles.forEach((r) => { const opt = document.createElement("option"); opt.value = r.id; opt.textContent = r.name; optgroup.appendChild(opt); });
      els.roleSelect.appendChild(optgroup);
    }
    els.yearSelect.innerHTML = "";
    if (availableHistoryYears.length) {
      const yearMeta = new Map(safeArray(data.history?.years).map((item) => [Number(item.year), item]));
      availableHistoryYears.forEach((year) => {
        const meta = yearMeta.get(year);
        els.yearSelect.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(year)}">${escapeHtml(meta?.label || `${year} 選舉`)}</option>`);
      });
      els.yearSelect.disabled = false;
    } else {
      els.yearSelect.insertAdjacentHTML("beforeend", `<option value="">尚未匯入官方年份</option>`);
      els.yearSelect.disabled = true;
    }
    const historyRoleIds = [...new Set(publicHistoryItems.map((item) => item.roleId).filter(Boolean))];
    historyRoleIds.sort((a, b) => (roleById.get(a)?.name || a).localeCompare(roleById.get(b)?.name || b, "zh-Hant"));
    historyRoleIds.forEach((id) => els.historyTypeSelect?.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(id)}">${escapeHtml(roleById.get(id)?.name || id)}</option>`));
    els.yearSelect.value = state.year;
    if (els.candidateYearLabel) els.candidateYearLabel.textContent = electionYear;
    if (els.candidateViewButton) {
      els.candidateViewButton.hidden = !hasOfficialCandidates;
      els.candidateViewButton.dataset.unavailable = hasOfficialCandidates ? "false" : "true";
      els.candidateViewButton.setAttribute("aria-hidden", hasOfficialCandidates ? "false" : "true");
    }
    els.countySelect.value = countyById.has(state.county) ? state.county : "all";
    if (els.mapCountyJump) els.mapCountyJump.value = countyById.has(state.county) ? state.county : "all";
    els.partySelect.value = partyById.has(state.party) ? state.party : "all";
    els.roleSelect.value = roleById.has(state.role) ? state.role : "all";
    els.searchInput.value = state.query;
    if (els.resultsSearchInput) els.resultsSearchInput.value = state.query;
    if (els.resultsSortSelect) els.resultsSortSelect.value = state.sort;
    if (els.historyTypeSelect) els.historyTypeSelect.value = state.historyType;
  }

  function renderRoleShortcuts() {
    if (state.view !== "officeholders") { els.roleShortcuts.innerHTML = ""; return; }
    const ids = ["legislator", "municipal-mayor", "county-mayor", "municipal-councilor", "county-councilor", "township-mayor", "village-chief"];
    els.roleShortcuts.innerHTML = ids.map((id) => {
      const r = roleById.get(id); if (!r) return "";
      return `<button type="button" class="${state.role === id ? "active" : ""}" data-role-shortcut="${escapeHtml(id)}">${escapeHtml(r.name)}</button>`;
    }).join("");
    $$('[data-role-shortcut]').forEach((button) => button.addEventListener("click", () => {
      state.role = state.role === button.dataset.roleShortcut ? "all" : button.dataset.roleShortcut;
      els.roleSelect.value = state.role;
      renderAll();
    }));
  }

  const viewMeta = {
    officeholders: {
      filterEyebrow: "CURRENT OFFICIALS", filterTitle: "現任公職篩選", mapEyebrow: "CURRENT POLITICAL LANDSCAPE", mapTitle: "現任政治版圖",
      mapSubtitle: "以政黨代表色呈現地方勢力；顏色深淺依該黨在當地的現任人員占比，絕對人數可切換「人數密度」查看。", resultsEyebrow: "OFFICEHOLDERS", resultsTitle: "現任公職人員",
      note: "<strong>現任名單判定方式</strong><p>中央職務依總統府與立法院；地方民選公職依內政部現任資料，每天檢查一次異動。</p>"
    },
    candidates: {
      filterEyebrow: `${electionYear} CANDIDATES`, filterTitle: "候選人篩選", mapEyebrow: `${electionYear} LOCAL ELECTION`, mapTitle: `${electionYear} 候選人地圖`,
      mapSubtitle: "正式候選人資料出現後才會自動取代展示資料；不以新聞推測名單。", resultsEyebrow: "CANDIDATES", resultsTitle: "候選人資料",
      note: "<strong>官方候選人資料原則</strong><p>只顯示中選會或地方選委會正式公告並可回到原始來源核對的資料；尚未公告時不預先建立名單。</p>"
    },
    history: {
      filterEyebrow: "ELECTION HISTORY", filterTitle: "歷屆結果篩選", mapEyebrow: "HISTORICAL RESULTS", mapTitle: "歷屆選舉結果",
      mapSubtitle: "依年度查看當選席次、候選人得票與政黨版圖；地圖以當選席次占比著色，人物卡保留實際得票率。", resultsEyebrow: "RESULTS", resultsTitle: "歷屆選舉資料",
      note: "<strong>歷史資料原則</strong><p>選舉結果保留年度、選舉類型、得票數、得票率、當選狀態與原始來源。</p>"
    }
  };

  function setView(view, preserveFilters = false) {
    if (view === "candidates" && !hasOfficialCandidates) view = "officeholders";
    state.view = view;
    if (!preserveFilters) {
      state.compare.clear(); state.town = null; state.role = "all"; state.party = "all"; state.historyType = "all"; state.query = "";
      els.searchInput.value = ""; if (els.resultsSearchInput) els.resultsSearchInput.value = ""; els.partySelect.value = "all"; els.roleSelect.value = "all"; if (els.historyTypeSelect) els.historyTypeSelect.value = "all";
    } else {
      els.searchInput.value = state.query; if (els.resultsSearchInput) els.resultsSearchInput.value = state.query; els.partySelect.value = state.party; els.roleSelect.value = state.role; if (els.historyTypeSelect) els.historyTypeSelect.value = state.historyType;
    }
    $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    els.officeholderFilters.hidden = view !== "officeholders";
    els.historyFilters.hidden = view !== "history";
    const meta = viewMeta[view];
    Object.entries({ filterEyebrow: meta.filterEyebrow, filterTitle: meta.filterTitle, mapEyebrow: meta.mapEyebrow, mapTitle: meta.mapTitle, mapSubtitle: meta.mapSubtitle, resultsEyebrow: meta.resultsEyebrow, resultsTitle: meta.resultsTitle }).forEach(([key, value]) => els[key].textContent = value);
    els.filterNote.innerHTML = meta.note;
    if (els.resultsSortControl) els.resultsSortControl.hidden = view !== "officeholders";
    if (els.togglePartyGroupsButton) els.togglePartyGroupsButton.hidden = view !== "officeholders";
    if (els.groupingNote) els.groupingNote.textContent = view === "officeholders" ? `依政黨分組 · ${officeholderSortLabel()}` : "依官方資料排序";
    if (els.toggleResultsButton) els.toggleResultsButton.textContent = state.resultsCollapsed ? "展開名單" : (view === "officeholders" ? "收合現任公職" : "收合資料");
    state.mapMode = view === "candidates" ? "count" : "party-strength";
    $$('[data-map-mode]').forEach((button) => button.classList.toggle("active", button.dataset.mapMode === state.mapMode));
    renderAvailabilityNotice();
    renderRoleShortcuts(); focusMapOnCounty(state.county); renderAll();
  }

  function mapPalette() {
    const style = getComputedStyle(document.documentElement);
    return {
      noData: style.getPropertyValue("--panel-2").trim() || "#e7e9ef",
      low: style.getPropertyValue("--map-density").trim() || "#4f7faf",
      high: style.getPropertyValue("--accent").trim() || "#f3c84b",
      text: style.getPropertyValue("--text").trim() || "#111a4a",
      neutral: style.getPropertyValue("--color-steel").trim() || "#7c7f88",
    };
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function hexToRgb(hex) {
    const clean = String(hex || "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return { r: Number.parseInt(clean.slice(0, 2), 16), g: Number.parseInt(clean.slice(2, 4), 16), b: Number.parseInt(clean.slice(4, 6), 16) };
  }
  function mixHex(from, to, weight) {
    const a = hexToRgb(from); const b = hexToRgb(to); const w = clamp(Number(weight) || 0, 0, 1);
    if (!a || !b) return to || from;
    const value = [a.r, a.g, a.b].map((channel, index) => {
      const target = [b.r, b.g, b.b][index];
      return Math.round(channel + (target - channel) * w).toString(16).padStart(2, "0");
    }).join("");
    return `#${value}`;
  }
  const MAP_PARTY_COLORS = {
    dpp: "#31945A",
    kmt: "#3E63A8",
    tpp: "#2AA7AD",
    npp: "#D6A11A",
    tsp: "#B65D45",
    pfp: "#E87A2A",
    npsu: "#B84D79",
    tsu: "#A9875E",
    "new-party": "#D6AD13",
    green: "#6E9F35",
    sdp: "#D94B91",
    ind: "#6B7280",
    other: "#A8AFBA",
  };
  function mapPartyColor(partyId) {
    return MAP_PARTY_COLORS[partyId] || partyById.get(partyId)?.color || mapPalette().neutral;
  }
  const PARTY_SHARE_BANDS = [
    { label: "≤50", sample: .50, intensity: .42 },
    { label: "51–55", sample: .53, intensity: .53 },
    { label: "56–60", sample: .58, intensity: .64 },
    { label: "61–65", sample: .63, intensity: .75 },
    { label: "66–70", sample: .68, intensity: .86 },
    { label: ">70", sample: .75, intensity: .96 },
  ];
  function shareStrength(share) {
    const value = Number(share) || 0;
    if (value > .70) return .96;
    if (value > .65) return .86;
    if (value > .60) return .75;
    if (value > .55) return .64;
    if (value > .50) return .53;
    return .42;
  }
  function mapItems() {
    return currentItems().filter((item) => {
      if (state.view === "history" && item.elected !== true) return false;
      if (state.view === "officeholders" && state.role !== "all" && item.roleId !== state.role) return false;
      if (state.party !== "all" && item.partyId !== state.party) return false;
      return item.countyId;
    });
  }
  function emptyStat() { return { count: 0, parties: {}, mayorParty: null }; }
  function addItemToStat(stat, item, mayorRoles = []) {
    stat.count += 1;
    stat.parties[item.partyId] = (stat.parties[item.partyId] || 0) + 1;
    if (mayorRoles.includes(item.roleId)) stat.mayorParty = item.partyId;
  }
  function countyStats() {
    const stats = Object.fromEntries((data.counties || []).map((c) => [c.id, emptyStat()]));
    mapItems().forEach((item) => {
      if (!stats[item.countyId]) return;
      addItemToStat(stats[item.countyId], item, ["municipal-mayor", "county-mayor"]);
    });
    return stats;
  }
  function sortedParties(stat) { return Object.entries(stat?.parties || {}).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); }
  function dominantParty(stat) {
    const ranked = sortedParties(stat);
    if (!ranked.length) return null;
    return ranked[1]?.[1] === ranked[0][1] ? null : ranked[0][0];
  }
  function dominantInfo(stat, allStats) {
    const ranked = sortedParties(stat);
    if (!ranked.length) return { partyId: null, tiedPartyIds: [], count: 0, share: 0, strength: 0, tie: false };
    const count = ranked[0][1];
    const tiedPartyIds = ranked.filter(([, partyCount]) => partyCount === count).map(([partyId]) => partyId);
    const tie = tiedPartyIds.length > 1;
    const share = stat.count ? count / stat.count : 0;
    const strength = shareStrength(share);
    return { partyId: tie ? null : ranked[0][0], tiedPartyIds, count, share, strength, tie };
  }
  function mapDatasetStatus() {
    if (state.view === "officeholders") {
      const sync = data.officeholderSync || {};
      const localCoverage = String(sync.coverage?.local || "").toLowerCase();
      const readyCoverage = ["active", "complete", "completed", "synced", "success", "ready"];
      return sync.lastSuccessAt || Number(sync.localOfficeholderCount || 0) > 0 || readyCoverage.includes(localCoverage) ? "ready" : "unsynced";
    }
    if (state.view === "candidates") return hasOfficialCandidates ? "ready" : "unsynced";
    if (state.view === "history") return hasPublicHistory ? "ready" : "unsynced";
    return "ready";
  }
  function mapPatternDefs() {
    const namespace = "http://www.w3.org/2000/svg";
    let svg = document.getElementById("party-map-pattern-library");
    if (!svg) {
      svg = document.createElementNS(namespace, "svg");
      svg.id = "party-map-pattern-library";
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      svg.style.position = "absolute";
      svg.style.width = "0";
      svg.style.height = "0";
      svg.style.overflow = "hidden";
      const defs = document.createElementNS(namespace, "defs");
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }
    return svg.querySelector("defs");
  }
  function tiePatternFill(partyIds, strength) {
    const palette = mapPalette();
    const ids = safeArray(partyIds).filter(Boolean).sort();
    if (ids.length < 2) return mixHex(palette.noData, palette.neutral, .62);
    const level = Math.round(clamp(strength, .28, .96) * 10);
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const patternId = `party-tie-${ids.join("-").replace(/[^a-z0-9-]/gi, "")}-${level}-${theme}`;
    const defs = mapPatternDefs();
    if (!defs.querySelector(`#${patternId}`)) {
      const namespace = "http://www.w3.org/2000/svg";
      const pattern = document.createElementNS(namespace, "pattern");
      pattern.id = patternId;
      pattern.setAttribute("patternUnits", "userSpaceOnUse");
      pattern.setAttribute("width", "14");
      pattern.setAttribute("height", "14");
      pattern.setAttribute("patternTransform", "rotate(45)");
      const band = 14 / ids.length;
      ids.forEach((partyId, index) => {
        const rect = document.createElementNS(namespace, "rect");
        const base = mapPartyColor(partyId);
        rect.setAttribute("x", String(index * band));
        rect.setAttribute("y", "0");
        rect.setAttribute("width", String(band + .3));
        rect.setAttribute("height", "14");
        rect.setAttribute("fill", mixHex(palette.noData, base, clamp(strength, .42, .92)));
        pattern.appendChild(rect);
      });
      defs.appendChild(pattern);
    }
    return `url(#${patternId})`;
  }
  function densityFill(stat, allStats) {
    if (!stat?.count) return mapPalette().noData;
    const maxCount = Math.max(1, ...Object.values(allStats || {}).map((candidate) => candidate.count || 0));
    const intensity = clamp(.25 + .70 * Math.sqrt(stat.count / maxCount), .25, .95);
    return mixHex(mapPalette().noData, mapPalette().low, intensity);
  }
  function statVisual(stat, allStats) {
    const palette = mapPalette();
    const datasetStatus = mapDatasetStatus();
    if (datasetStatus === "unsynced") {
      return { status: "unsynced", fillColor: "#ffffff", fillOpacity: document.documentElement.dataset.theme === "dark" ? .12 : .78, strokeColor: document.documentElement.dataset.theme === "dark" ? "#ffffff" : "#a9acb6", dashArray: "6 5" };
    }
    if (!stat?.count) {
      return { status: "insufficient", fillColor: document.documentElement.dataset.theme === "dark" ? "#263943" : "#e3e4e8", fillOpacity: .78, strokeColor: "rgba(126,139,160,.68)", dashArray: null };
    }
    if (state.mapMode === "count") return { status: "ready", fillColor: densityFill(stat, allStats), fillOpacity: .84, strokeColor: "rgba(126,139,160,.68)", dashArray: null };
    if (state.mapMode === "mayor-party") {
      if (!stat.mayorParty) return { status: "insufficient", fillColor: document.documentElement.dataset.theme === "dark" ? "#263943" : "#e3e4e8", fillOpacity: .78, strokeColor: "rgba(126,139,160,.68)", dashArray: null };
      return { status: "ready", fillColor: mapPartyColor(stat.mayorParty), fillOpacity: .88, strokeColor: "rgba(255,255,255,.78)", dashArray: null };
    }
    const info = dominantInfo(stat, allStats);
    if (info.tie) return { status: "tie", fillColor: tiePatternFill(info.tiedPartyIds, info.strength), fillOpacity: .96, strokeColor: "rgba(126,139,160,.78)", dashArray: null };
    const base = mapPartyColor(info.partyId);
    return { status: "ready", fillColor: mixHex(palette.noData, base, info.strength), fillOpacity: .9, strokeColor: "rgba(255,255,255,.76)", dashArray: null };
  }
  function countyStyle(feature) {
    const id = countyIdFromProperties(feature.properties); const selected = state.county === id; const dimmed = state.county !== "all" && !selected;
    const stats = countyStats(); const visual = statVisual(stats[id], stats);
    return { color: selected ? mapPalette().text : visual.strokeColor, weight: selected ? 2.8 : 1.15, dashArray: visual.dashArray, fillColor: visual.fillColor, fillOpacity: dimmed ? .13 : selected ? Math.max(.92, visual.fillOpacity) : visual.fillOpacity, opacity: dimmed ? .22 : .94 };
  }
  function itemLocationText(item) { return `${item.town || ""} ${item.district || ""} ${item.organization || ""}`.replaceAll("台", "臺"); }
  let currentTownStats = {};
  function calculateTownStats(countyId) {
    const output = {};
    if (!townGeoJSON || !countyId || countyId === "all") return output;
    const countyFeature = countyGeoJSON?.features?.find((feature) => countyIdFromProperties(feature.properties) === countyId);
    const code = String(countyFeature?.properties?.COUNTYCODE || "");
    const name = countyFeature?.properties?.COUNTYNAME;
    const features = townGeoJSON.features.filter((feature) => String(feature.properties?.COUNTYCODE || "") === code || feature.properties?.COUNTYNAME === name);
    features.forEach((feature) => { output[feature.properties.TOWNCODE || feature.properties.TOWNNAME] = emptyStat(); });
    const items = mapItems().filter((item) => item.countyId === countyId);
    features.forEach((feature) => {
      const townName = String(feature.properties.TOWNNAME || "").replaceAll("台", "臺");
      const key = feature.properties.TOWNCODE || feature.properties.TOWNNAME;
      items.filter((item) => townName && itemLocationText(item).includes(townName)).forEach((item) => addItemToStat(output[key], item, ["township-mayor", "indigenous-district-mayor"]));
    });
    return output;
  }
  function townStat(feature) { return currentTownStats[feature?.properties?.TOWNCODE || feature?.properties?.TOWNNAME] || emptyStat(); }
  function townStyle(feature) {
    const stat = townStat(feature); const visual = statVisual(stat, currentTownStats);
    return { color: visual.status === "unsynced" ? visual.strokeColor : "rgba(255,255,255,.82)", weight: 1, dashArray: visual.dashArray, fillColor: visual.fillColor, fillOpacity: visual.fillOpacity, opacity: .9 };
  }
  function legendTitle() {
    if (state.mapMode === "count") return state.view === "history" ? "當選席次密度" : state.view === "candidates" ? "正式候選人數密度" : "現任人數密度";
    if (state.mapMode === "mayor-party") return "首長黨籍";
    if (state.view === "history") return "當選席次占比（%）";
    if (state.view === "candidates") return "正式候選人政黨占比（%）";
    return "政黨勢力占比（%）";
  }
  function legendPartyIds() {
    if (state.party !== "all" && partyById.has(state.party)) return [state.party];
    const totals = {};
    mapItems().forEach((item) => { totals[item.partyId] = (totals[item.partyId] || 0) + 1; });
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const fallback = ["dpp", "kmt", "tpp", "ind"].filter((id) => partyById.has(id));
    return [...new Set([...(ranked.length ? ranked : fallback), ...fallback])].slice(0, 4);
  }
  function legendSpecialStates() {
    const dppColor = mapPartyColor("dpp");
    const kmtColor = mapPartyColor("kmt");
    return `<div class="legend-special-grid" aria-label="特殊狀態圖例">
      <span><i class="legend-tie" style="--tie-a:${escapeHtml(dppColor)};--tie-b:${escapeHtml(kmtColor)}"></i><b>並列第一</b><small>依並列政黨色等寬斜線</small></span>
      <span><i class="legend-insufficient"></i><b>資料不足</b><small>淡灰色</small></span>
      <span><i class="legend-unsynced"></i><b>尚未同步</b><small>白底虛線</small></span>
    </div>`;
  }
  function renderMapLegend() {
    if (!els.mapLegend) return;
    els.mapLegend.hidden = true;
    els.mapLegend.innerHTML = "";
  }
  function refreshMapStyles() {
    currentTownStats = calculateTownStats(state.county);
    renderMapLegend();
    if (countyLayer) countyLayer.setStyle(countyStyle);
    if (townLayer) townLayer.setStyle(townStyle);
  }
  function mapRecordLabel(count) {
    if (state.view === "history") return `${count} 筆當選紀錄`;
    if (state.view === "candidates") return `${count} 位正式候選人`;
    return `${count} 位現任人員`;
  }
  function mapCountNoun() { return state.view === "history" ? "席" : "人"; }
  function statPartyDetails(stat) {
    return sortedParties(stat).slice(0, 4).map(([id, count]) => {
      const p = partyById.get(id) || party({ partyId: id });
      const pct = stat.count ? Math.round((count / stat.count) * 100) : 0;
      return `${escapeHtml(p.shortName)} ${count}（${pct}%）`;
    }).join("<br>");
  }
  function mapTooltip(feature) {
    const id = countyIdFromProperties(feature.properties); const county = countyById.get(id); const stats = countyStats(); const stat = stats[id] || emptyStat();
    const visual = statVisual(stat, stats); const info = dominantInfo(stat, stats); const winner = partyById.get(info.partyId);
    const tiedNames = info.tiedPartyIds.map((partyId) => partyById.get(partyId)?.shortName || partyId).join("、");
    const headline = visual.status === "unsynced" ? "尚未同步官方地方名單" : visual.status === "insufficient" ? "資料不足" : info.tie ? `${tiedNames}並列，各 ${info.count} ${mapCountNoun()}` : winner ? `${winner.shortName}最多（${Math.round(info.share * 100)}%）` : "尚無政黨資料";
    return `<strong>${escapeHtml(county?.name || "未命名縣市")}</strong><br><span>${escapeHtml(mapRecordLabel(stat.count))} · ${escapeHtml(headline)}</span>${stat.count ? `<small class="tooltip-party-list">${statPartyDetails(stat)}</small>` : ""}`;
  }
  function townTooltip(feature) {
    const townName = feature.properties.TOWNNAME || feature.properties.name || "行政區";
    const stat = townStat(feature); const visual = statVisual(stat, currentTownStats); const info = dominantInfo(stat, currentTownStats); const winner = partyById.get(info.partyId);
    const tiedNames = info.tiedPartyIds.map((partyId) => partyById.get(partyId)?.shortName || partyId).join("、");
    const headline = visual.status === "unsynced" ? "尚未同步官方地方名單" : visual.status === "insufficient" ? "資料不足" : info.tie ? `${tiedNames}並列，各 ${info.count} ${mapCountNoun()}` : winner ? `${winner.shortName}最多（${Math.round(info.share * 100)}%）` : "尚無細分資料";
    return `<strong>${escapeHtml(townName)}</strong><br><span>${escapeHtml(mapRecordLabel(stat.count))} · ${escapeHtml(headline)}</span>${stat.count ? `<small class="tooltip-party-list">${statPartyDetails(stat)}</small>` : ""}`;
  }
  function showMapFallback(message) {
    els.mapLoading.hidden = true; els.mapFallback.hidden = false;
    els.mapFallback.innerHTML = `<strong>行政區圖資無法載入</strong><p>${escapeHtml(message || "仍可用縣市按鈕查看資料。")}</p><div class="map-fallback-grid">${(data.counties || []).map((c) => `<button type="button" data-fallback-county="${escapeHtml(c.id)}">${escapeHtml(c.name)}</button>`).join("")}</div>`;
    $$('[data-fallback-county]').forEach((button) => button.addEventListener("click", () => setCounty(button.dataset.fallbackCounty)));
  }
  function updateMapBreadcrumb() {
    els.mapCrumbCounty.textContent = state.county === "all" ? "縣市" : countyById.get(state.county)?.name || "縣市";
    els.mapCrumbTown.hidden = !state.town; els.mapTownSeparator.hidden = !state.town; els.mapCrumbTown.textContent = state.town?.name || "";
    if (els.mapCountyJump) els.mapCountyJump.value = state.county;
    if (els.mapTownJump) els.mapTownJump.value = state.town ? String(state.town.code || state.town.name) : "";
    updateMapGuide();
  }
  function currentAreaName() {
    if (state.town?.name) return `${countyById.get(state.county)?.name || "所選縣市"} · ${state.town.name}`;
    return state.county === "all" ? "全台灣" : countyById.get(state.county)?.name || "所選地區";
  }
  function updateMapGuide(hoverLabel = "") {
    if (!els.mapGuideChip) return;
    if (hoverLabel) {
      els.mapGuideChip.textContent = hoverLabel;
      els.mapGuideChip.classList.add("is-hovering");
      return;
    }
    els.mapGuideChip.classList.remove("is-hovering");
    const countyName = state.county === "all" ? "" : countyById.get(state.county)?.name || "";
    if (state.town?.name) els.mapGuideChip.textContent = `目前：${countyName} › ${state.town.name}`;
    else if (countyName) els.mapGuideChip.textContent = `目前：${countyName} · 點選行政區查看明細`;
    else els.mapGuideChip.textContent = "滑過查看縣市 · 點選進入鄉鎮市區";
  }
  function townFeatureKey(feature) {
    return String(feature?.properties?.TOWNCODE || feature?.properties?.TOWNNAME || feature?.properties?.name || "");
  }
  function populateMapTownJump(countyId, features = []) {
    townFeatureByKey.clear();
    if (!els.mapTownJump) return;
    if (countyId === "all" || !features.length) {
      els.mapTownJump.innerHTML = '<option value="">請先選擇縣市</option>';
      els.mapTownJump.disabled = true;
      return;
    }
    const sorted = features.slice().sort((a, b) => String(a.properties?.TOWNNAME || "").localeCompare(String(b.properties?.TOWNNAME || ""), "zh-Hant"));
    sorted.forEach((feature) => townFeatureByKey.set(townFeatureKey(feature), feature));
    els.mapTownJump.innerHTML = `<option value="">全部鄉鎮市區</option>${sorted.map((feature) => `<option value="${escapeHtml(townFeatureKey(feature))}">${escapeHtml(feature.properties?.TOWNNAME || feature.properties?.name || "行政區")}</option>`).join("")}`;
    els.mapTownJump.disabled = false;
  }
  function selectTownFeature(feature, layer, animate = true) {
    if (!feature) return;
    const townName = feature.properties?.TOWNNAME || feature.properties?.name || "行政區";
    state.town = { code: townFeatureKey(feature), name: townName };
    pendingTownKey = "";
    updateMapBreadcrumb();
    updateAreaSummary();
    renderResults();
    if (layer && mapInstance) mapInstance.fitBounds(layer.getBounds(), { padding: [34, 34], maxZoom: 10, animate });
  }
  function showTownLayer(countyId) {
    if (!mapInstance || !townGeoJSON) return;
    if (townLayer) { mapInstance.removeLayer(townLayer); townLayer = null; }
    townLeafletLayers.clear();
    const countyFeature = countyGeoJSON.features.find((feature) => countyIdFromProperties(feature.properties) === countyId); if (!countyFeature) { populateMapTownJump("all"); return; }
    const code = String(countyFeature.properties.COUNTYCODE || ""); const name = countyFeature.properties.COUNTYNAME;
    const towns = townGeoJSON.features.filter((feature) => String(feature.properties?.COUNTYCODE || "") === code || feature.properties?.COUNTYNAME === name);
    populateMapTownJump(countyId, towns);
    if (!towns.length) return;
    townLayer = L.geoJSON({ type: "FeatureCollection", features: towns }, { style: townStyle, onEachFeature(feature, layer) {
      const townName = feature.properties.TOWNNAME || feature.properties.name || "行政區";
      townLeafletLayers.set(townFeatureKey(feature), layer);
      layer.bindTooltip(() => townTooltip(feature), { sticky: true });
      layer.on({ mouseover() { layer.setStyle({ fillOpacity: .42, weight: 1.8 }); updateMapGuide(`${countyById.get(countyId)?.name || "所選縣市"} › ${townName}`); }, mouseout() { townLayer.resetStyle(layer); updateMapGuide(); }, click(event) {
        L.DomEvent.stopPropagation(event); selectTownFeature(feature, layer);
      }});
    }}).addTo(mapInstance); townLayer.bringToFront();
    if (pendingTownKey) {
      const requested = townFeatureByKey.get(pendingTownKey) || towns.find((feature) => String(feature.properties?.TOWNNAME || "") === pendingTownKey);
      pendingTownKey = "";
      if (requested) selectTownFeature(requested, townLeafletLayers.get(townFeatureKey(requested)), false);
    }
  }
  function focusMapOnCounty(countyId) {
    if (!mapInstance || !countyLayer) return; state.town = null; updateMapBreadcrumb(); refreshMapStyles();
    if (countyId === "all") { if (townLayer) { mapInstance.removeLayer(townLayer); townLayer = null; } townLeafletLayers.clear(); populateMapTownJump("all"); if (nationalBounds) mapInstance.fitBounds(nationalBounds, { padding: [24, 24], animate: true }); return; }
    const layer = countyLeafletLayers.get(countyId); if (layer) { mapInstance.fitBounds(layer.getBounds(), { padding: [38, 38], maxZoom: 8.6, animate: true }); showTownLayer(countyId); }
  }
  function initMap() {
    renderMapLegend();
    try {
      if (!window.L || !window.topojson || !window.TAIWAN_TOPOLOGY) throw new Error("本機地圖程式庫或行政區圖資遺失");
      const topology = window.TAIWAN_TOPOLOGY;
      countyGeoJSON = topojson.feature(topology, topology.objects.counties); townGeoJSON = topojson.feature(topology, topology.objects.towns);
      mapInstance = L.map(els.leafletMap, { zoomControl: true, attributionControl: true, minZoom: 5, maxZoom: 11, zoomSnap: .25, wheelPxPerZoomLevel: 90 });
      mapInstance.attributionControl.setPrefix(false); mapInstance.attributionControl.addAttribution("行政區界線：內政部／Taiwan Atlas");
      countyLayer = L.geoJSON(countyGeoJSON, { style: countyStyle, onEachFeature(feature, layer) {
        const id = countyIdFromProperties(feature.properties); if (id) countyLeafletLayers.set(id, layer);
        layer.bindTooltip(() => mapTooltip(feature), { sticky: true });
        layer.on({ mouseover() { layer.setStyle({ weight: 2.2, fillOpacity: .9 }); layer.bringToFront(); updateMapGuide(countyById.get(id)?.name || "縣市"); }, mouseout() { countyLayer.resetStyle(layer); if (townLayer) townLayer.bringToFront(); updateMapGuide(); }, click() { if (id) setCounty(id); } });
      }}).addTo(mapInstance);
      nationalBounds = countyLayer.getBounds(); mapInstance.fitBounds(nationalBounds, { padding: [24, 24] });
      mapInstance.on("click", () => { if (state.town) { state.town = null; updateMapBreadcrumb(); updateAreaSummary(); renderResults(); if (state.county !== "all") focusMapOnCounty(state.county); } });
      setTimeout(() => mapInstance.invalidateSize(), 80); els.mapLoading.hidden = true;
    } catch (error) { showMapFallback(error.message); }
  }

  function viewLabel() { return { officeholders: "現任政治版圖", candidates: `${electionYear} 正式候選人`, history: "歷屆選舉結果" }[state.view]; }
  function renderAvailabilityNotice() {
    if (!els.availabilityNotice) return;
    const historyUnavailable = state.view === "history" && !hasPublicHistory;
    const candidateUnavailable = state.view === "candidates" && !hasOfficialCandidates;
    els.availabilityNotice.hidden = !(historyUnavailable || candidateUnavailable);
    if (historyUnavailable) {
      els.availabilityTitle.textContent = "尚未匯入官方歷屆資料";
      els.availabilityText.textContent = "為避免誤會，未匯入的年份與展示人物都不會出現在公開介面。完成中選會歷屆同步後，年份會自動出現。";
    } else if (candidateUnavailable) {
      els.availabilityTitle.textContent = "正式候選人名單尚未匯入";
      els.availabilityText.textContent = "候選人分頁會在官方名單成功同步後自動開放，不使用新聞推測或展示名單。";
    }
  }
  function updateAreaSummary() {
    const items = filteredItems({ ignoreCounty: true }).filter((item) => state.county === "all" || item.countyId === state.county);
    const county = state.county === "all" ? null : countyById.get(state.county);
    els.selectedAreaLevel.textContent = state.town ? "SELECTED TOWN" : state.county === "all" ? "SELECTED AREA" : "SELECTED COUNTY";
    els.selectedCountyName.textContent = county?.name || "全台灣";
    els.selectedCountyDescription.textContent = county?.description || (state.view === "officeholders" ? "點選縣市後，查看當地現任民選公職與政黨分布。" : "點選縣市後，地圖會放大並顯示鄉鎮市區。");
    els.selectedTownName.hidden = !state.town; els.selectedTownName.textContent = state.town ? `目前行政區：${state.town.name}` : "";
    const parties = new Set(items.map((i) => i.partyId).filter(Boolean)); const roles = new Set(items.map((i) => i.roleId || i.electionType).filter(Boolean));
    els.summaryMetric1Label.textContent = state.view === "history" ? "結果筆數" : state.view === "candidates" ? "候選人" : "現任人員";
    els.summaryMetric2Label.textContent = "政黨"; els.summaryMetric3Label.textContent = state.view === "history" ? "年度" : "職位類型";
    const hasAreaData = items.length > 0;
    els.areaSummary?.classList.toggle("has-no-data", !hasAreaData);
    els.summaryMetric1.textContent = hasAreaData ? String(items.length) : "—"; els.summaryMetric2.textContent = hasAreaData ? String(parties.size) : "—"; els.summaryMetric3.textContent = hasAreaData ? (state.view === "history" ? (state.year || "—") : String(roles.size)) : "—";
    const counts = {}; items.forEach((item) => counts[item.partyId] = (counts[item.partyId] || 0) + 1);
    const totalPartyCount = Math.max(1, Object.values(counts).reduce((sum, value) => sum + value, 0));
    renderMapInsights(items, counts, totalPartyCount);
    els.partyBreakdown.innerHTML = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([id, count]) => {
      const p = partyById.get(id) || party({partyId:id}); const percent = Math.round((count / totalPartyCount) * 100);
      return `<div class="party-row" style="--party-color:${escapeHtml(mapPartyColor(id))}"><i></i><span>${escapeHtml(p.shortName)}<small>${percent}%</small></span><strong>${count}</strong><b class="party-row-bar"><em style="width:${percent}%"></em></b></div>`;
    }).join("") || `<p style="color:var(--muted);font-size:.75rem">此篩選目前尚無地方資料；第一次每日同步後會自動補入。</p>`;
    renderAreaCoverage(hasAreaData);
  }

  function renderMapInsights(items, counts, totalPartyCount) {
    if (!els.mapInsightArea) return;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    const top = ranked[0]; const second = ranked[1];
    const label = state.view === "history" ? "當選最多" : state.view === "candidates" ? "候選最多" : "現任最多";
    els.mapInsightArea.textContent = currentAreaName();
    els.mapInsightVolume.textContent = mapRecordLabel(items.length);
    els.mapInsightLeaderLabel.textContent = label;
    els.mapInsightGapLabel.textContent = "領先差距";
    if (!top) {
      els.mapInsightLeader.textContent = "—";
      els.mapInsightLeaderShare.textContent = "此區域尚無資料";
      els.mapInsightGap.textContent = "—";
      els.mapInsightGapDetail.textContent = "等待官方資料";
      els.mapInsightLeaderCard?.style.removeProperty("--leader-color");
      return;
    }
    const tiedIds = ranked.filter(([, count]) => count === top[1]).map(([id]) => id);
    const tied = tiedIds.length > 1;
    const leaderNames = tiedIds.map((id) => partyById.get(id)?.shortName || party({ partyId: id }).shortName).join("、");
    const leaderShare = Math.round((top[1] / totalPartyCount) * 100);
    els.mapInsightLeader.textContent = tied ? `${leaderNames}並列` : partyById.get(top[0])?.shortName || party({ partyId: top[0] }).shortName;
    els.mapInsightLeaderShare.textContent = `${top[1].toLocaleString("zh-Hant")} ${mapCountNoun()} · ${leaderShare}%`;
    els.mapInsightLeaderCard?.style.setProperty("--leader-color", tied ? mapPalette().neutral : mapPartyColor(top[0]));
    if (tied) {
      els.mapInsightGap.textContent = "並列";
      els.mapInsightGapDetail.textContent = `${leaderNames}同為最多`;
    } else if (second) {
      const gap = top[1] - second[1];
      const gapPoints = Math.round((gap / totalPartyCount) * 100);
      els.mapInsightGap.textContent = `${gap.toLocaleString("zh-Hant")} ${mapCountNoun()}`;
      els.mapInsightGapDetail.textContent = `領先 ${partyById.get(second[0])?.shortName || party({ partyId: second[0] }).shortName} ${gapPoints} 個百分點`;
    } else {
      els.mapInsightGap.textContent = "—";
      els.mapInsightGapDetail.textContent = "目前只有一個政黨資料";
    }
  }

  function renderAreaCoverage(hasAreaData) {
    if (!els.areaCoverageBadge) return;
    const os = data.officeholderSync || {};
    const hs = data.historySync || data.history?.coverage || {};
    let stateName = "waiting";
    let title = "資料覆蓋尚未完成";
    let detail = "等待官方來源首次同步";
    if (state.view === "officeholders") {
      const localReady = String(os.coverage?.local || "").startsWith("active") || Number(os.localOfficeholderCount || 0) > 0;
      const centralReady = os.coverage?.legislature === "active" || Number(os.legislatorCount || 0) > 0;
      if (state.county === "all" && centralReady && localReady) { stateName = "ok"; title = "中央與地方資料已同步"; detail = `最後成功：${formatDate(os.lastSuccessAt)}`; }
      else if (state.county !== "all" && localReady && hasAreaData) { stateName = "ok"; title = "此縣市已有官方現任資料"; detail = `最後成功：${formatDate(os.lastSuccessAt)}`; }
      else if (centralReady || localReady) { stateName = "partial"; title = "目前為部分官方資料"; detail = localReady ? "部分地區或職位尚無可辨識資料" : "目前主要為中央民選公職資料"; }
    } else if (state.view === "history") {
      if (Number(hs.officialRecordCount || 0) > 0 && hasAreaData) { stateName = "ok"; title = "中選會歷屆資料已匯入"; detail = `${Number(hs.officialRecordCount).toLocaleString("zh-Hant")} 筆官方紀錄`; }
      else { title = "此篩選尚無歷屆紀錄"; detail = "只顯示已成功匯入的官方年份與選舉類型"; }
    } else if (hasOfficialCandidates) {
      stateName = hasAreaData ? "ok" : "partial"; title = hasAreaData ? "正式候選人資料已公告" : "此地區尚無正式候選人資料"; detail = data.sync?.lastSuccessAt ? `最後成功：${formatDate(data.sync.lastSuccessAt)}` : "等待官方公告";
    }
    els.areaCoverageBadge.className = `area-coverage-badge ${stateName}`;
    els.areaCoverageBadge.innerHTML = `<i></i><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  function personCardHtml(item) {
    const p = party(item);
    const r = role(item);
    const itemSources = safeArray(item.sources);
    const sourceDate = item.sourceUpdatedAt || item.officialUpdatedAt || item.verifiedAt || itemSources[0]?.date || "未標示";
    const trustLabel = itemSources.length ? "官方來源" : "來源待補";
    const subtitle = item.kind === "candidate"
      ? `${item.district || "選區待補"} · ${item.electionType || "選舉類型待補"}`
      : item.kind === "history"
        ? `${item.district || ""} · ${item.year || state.year}`
        : `${item.organization || item.district || "機關待補"}`;
    const facts = item.kind === "candidate"
      ? [["號次", item.number ?? "待公告"], ["現任", item.incumbent ? "是" : "否／未提供"], ["來源", itemSources.length ? `${itemSources.length} 個官方來源` : "來源待補"]]
      : item.kind === "history"
        ? [["得票", item.votes ?? "—"], ["得票率", item.voteRate != null ? `${item.voteRate}%` : "—"], ["結果", item.elected ? "當選" : "未當選"]]
        : [["地區", item.district || "全國"], ["就任", item.termStart || "未提供"], ["更新", sourceDate]];
    return `<article class="person-card" style="--party-color:${escapeHtml(p.color)}">
      <div class="card-top"><span class="role-badge">${escapeHtml(r.name)}</span><span class="party-badge">${escapeHtml(p.shortName)}</span></div>
      <div class="person-identity">${avatarHtml(item)}<div><h3>${escapeHtml(displayPersonName(item.name))}</h3><p class="person-subtitle">${escapeHtml(subtitle)}</p></div></div>
      <div class="trust-row"><span class="trust-badge ${itemSources.length ? "verified" : "pending"}">${escapeHtml(trustLabel)}</span><span>${itemSources.length ? `${itemSources.length} 個來源` : "等待查核"}</span>${photoInfo(item).url ? `<span class="trust-badge verified">${photoInfo(item).official ? "官方頭貼" : "頭貼已提供"}</span>` : `<span class="trust-badge pending">無頭貼</span>`}</div>
      <div class="person-facts">${facts.map(([k,v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join("")}</div>
      <div class="card-footer"><button class="detail-button" type="button" data-open-person="${escapeHtml(item.id)}">查看資料</button><button class="compare-toggle ${state.compare.has(item.id) ? "selected" : ""}" type="button" data-compare-person="${escapeHtml(item.id)}" aria-label="加入比較">${state.compare.has(item.id) ? "✓" : "+"}</button></div>
    </article>`;
  }

  function bindResultCardEvents() {
    $$('[data-open-person]').forEach((button) => button.addEventListener("click", () => openPerson(button.dataset.openPerson)));
    $$('[data-compare-person]').forEach((button) => button.addEventListener("click", () => toggleCompare(button.dataset.comparePerson)));
    $$('.party-person-group').forEach((group) => group.addEventListener("toggle", updatePartyGroupControls));
    $$('[data-load-party]').forEach((button) => button.addEventListener("click", () => {
      const partyId = button.dataset.loadParty;
      state.partyGroupLimits[partyId] = Number(state.partyGroupLimits[partyId] || 12) + 24;
      renderResults();
      document.querySelector(`[data-party-group="${CSS.escape(partyId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function updatePartyGroupControls() {
    if (!els.togglePartyGroupsButton) return;
    const groups = $$('.party-person-group');
    const available = state.view === "officeholders" && !state.resultsCollapsed && groups.length > 0;
    els.togglePartyGroupsButton.hidden = !available;
    if (!available) return;
    const allOpen = groups.every((group) => group.open);
    els.togglePartyGroupsButton.textContent = allOpen ? "全部收合" : "全部展開";
    els.togglePartyGroupsButton.setAttribute("aria-label", allOpen ? "收合全部政黨群組" : "展開全部政黨群組");
  }

  function toggleAllPartyGroups() {
    const groups = $$('.party-person-group');
    if (!groups.length) return;
    const shouldOpen = groups.some((group) => !group.open);
    groups.forEach((group) => { group.open = shouldOpen; });
    updatePartyGroupControls();
  }

  function officeholderGroupsHtml(items) {
    const grouped = new Map();
    items.forEach((item) => {
      const key = item.partyId || "other";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return [...grouped.entries()]
      .sort((a, b) => {
        if (a[0] === "ind" && b[0] !== "ind") return 1;
        if (b[0] === "ind" && a[0] !== "ind") return -1;
        return b[1].length - a[1].length || String(partyById.get(a[0])?.name || a[0]).localeCompare(String(partyById.get(b[0])?.name || b[0]), "zh-Hant");
      })
      .map(([partyId, records], groupIndex) => {
        const p = partyById.get(partyId) || party(records[0]);
        const limit = Number(state.partyGroupLimits[partyId] || 12);
        const visible = records.slice(0, limit);
        const remaining = Math.max(0, records.length - visible.length);
        const openGroup = state.party !== "all" || groupIndex < 3;
        return `<details class="party-person-group" data-party-group="${escapeHtml(partyId)}"${openGroup ? " open" : ""} style="--party-color:${escapeHtml(p.color)}">
          <summary><span class="party-group-title"><i></i><strong>${escapeHtml(p.name)}</strong><small>${records.length.toLocaleString("zh-Hant")} 人</small></span><span class="party-group-action">展開／收合</span></summary>
          <div class="people-grid">${visible.map(personCardHtml).join("")}</div>
          ${remaining ? `<button class="party-load-more" type="button" data-load-party="${escapeHtml(partyId)}">再顯示 ${Math.min(24, remaining)} 人（尚有 ${remaining.toLocaleString("zh-Hant")} 人）</button>` : ""}
        </details>`;
      }).join("");
  }

  function renderResults() {
    const items = filteredItems();
    els.peopleGrid.innerHTML = "";
    els.emptyState.hidden = items.length > 0;
    els.emptyStateText.textContent = state.view === "officeholders" && safeArray(data.officeholders).length <= 2
      ? "目前只有總統府種子資料；請上傳 GitHub 並執行第一次每日同步，系統會匯入立法院與內政部現任名單。"
      : state.view === "history" && !hasPublicHistory
        ? "尚未匯入官方歷屆資料；未公告或未匯入的年份不會預先顯示。"
        : state.view === "history"
          ? "此年度或篩選條件目前沒有資料。"
          : "請調整搜尋或篩選條件。";
    els.resultsSummary.textContent = `${currentAreaName()} · 共 ${items.length.toLocaleString("zh-Hant")} 筆${state.query ? ` · 搜尋「${state.query}」` : ""}`;

    if (state.view === "officeholders") {
      els.peopleGrid.innerHTML = officeholderGroupsHtml(items);
    } else {
      const visible = items.slice(0, 240);
      els.peopleGrid.innerHTML = `<div class="people-grid">${visible.map(personCardHtml).join("")}</div>${items.length > visible.length ? `<p class="results-limit-note">目前先顯示前 ${visible.length} 筆；可使用姓名、政黨、縣市或選舉類型縮小範圍。</p>` : ""}`;
    }

    bindResultCardEvents();
    updatePartyGroupControls();
    if (els.resultsBody) els.resultsBody.hidden = state.resultsCollapsed;
    updateCompareButton(); updateOverview(); updateAreaSummary(); renderHistoryLab(); renderActiveFilters(); refreshMapStyles(); syncUrl();
  }


  function normalizedName(value) { return String(value || "").replace(/[\s　·・．.]/g, "").trim(); }
  function historyRecordsFor(item) {
    const directKey = item.personKey || item.id;
    const byKey = safeArray(data.personHistory).find((person) => person.personKey === directKey || person.personKey === item.id);
    const records = byKey?.records?.length ? byKey.records.filter((record) => !record?.demo && record?.sourceType !== "demo") : publicHistoryItems.filter((record) => {
      if (record.personKey && (record.personKey === item.id || record.personKey === directKey)) return true;
      return normalizedName(record.name) && normalizedName(record.name) === normalizedName(item.name);
    });
    return records.slice().sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  }
  function historyRecordHtml(record) {
    const p = party(record); const r = role(record);
    const outcome = record.elected ? "當選" : "未當選";
    const votes = record.votes != null ? Number(record.votes).toLocaleString("zh-Hant") : "—";
    const rate = record.voteRate != null ? `${record.voteRate}%` : "—";
    return `<div class="timeline-item" style="--party-color:${escapeHtml(p.color)}"><span class="timeline-dot"></span><div><strong>${escapeHtml(record.year || "—")} · ${escapeHtml(r.name || record.electionType || "選舉")}</strong><p>${escapeHtml(p.shortName)} · ${escapeHtml(record.district || countyById.get(record.countyId)?.name || "未提供地區")} · ${escapeHtml(outcome)}</p><small>${escapeHtml(votes)} 票 · ${escapeHtml(rate)}${record.rank ? ` · 第 ${escapeHtml(record.rank)} 名` : ""}</small></div></div>`;
  }
  function renderHistoryLab() {
    if (!els.historyLabSection) return;
    const allRecords = publicHistoryItems;
    const coverage = data.history?.coverage || {};
    if (els.historyOfficialRecords) els.historyOfficialRecords.textContent = coverage.officialRecordCount ? `${Number(coverage.officialRecordCount).toLocaleString("zh-Hant")} 筆` : "等待匯入";
    if (els.historyOfficialPeople) els.historyOfficialPeople.textContent = coverage.officialPersonCount ? `${Number(coverage.officialPersonCount).toLocaleString("zh-Hant")} 人` : "—";
    if (els.historyCoverageYears) els.historyCoverageYears.textContent = safeArray(coverage.yearsImported).length ? safeArray(coverage.yearsImported).join("、") : "—";
    if (els.historyIdentityReview) els.historyIdentityReview.textContent = coverage.identityReviewCount != null ? `${coverage.identityReviewCount} 組` : "—";
    if (els.historyCoverageNote) els.historyCoverageNote.textContent = coverage.lastOfficialSyncAt ? `最近官方歷屆同步：${formatDate(coverage.lastOfficialSyncAt)}；範圍 ${coverage.scope || "core"}，已連結現任人物 ${coverage.linkedCurrentCount || 0} 組。` : "可透過手動更新選擇「核心歷屆資料」，或等待每週日 03:20 自動同步。";
    const visibleRecords = state.view === "history" ? filteredItems({ ignoreCounty: false, ignoreParty: false }) : allRecords.filter((record) => {
      if (state.county !== "all" && record.countyId !== state.county) return false;
      if (state.party !== "all" && record.partyId !== state.party) return false;
      return true;
    });
    const people = safeArray(data.personHistory).map((person) => ({ ...person, records: safeArray(person.records).filter((record) => !record?.demo && record?.sourceType !== "demo") })).filter((person) => person.records.length && (!state.query || itemSearchText({ ...person, name: person.name, partyId: person.records?.[0]?.partyId }).includes(state.query)));
    els.personHistoryPreview.innerHTML = people.length ? people.slice(0, 4).map((person) => `<article class="mini-history-card"><div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.records?.length || 0)} 筆歷屆紀錄</span></div>${safeArray(person.records).slice(0, 3).map(historyRecordHtml).join("")}</article>`).join("") : `<p class="muted-note">尚未建立人物歷屆紀錄；可由中選會歷屆結果或管理頁 CSV 匯入。</p>`;
    const partyRows = hasPublicHistory ? safeArray(data.partyHistory).filter((row) => state.party === "all" || row.partyId === state.party).slice(0, 8) : [];
    els.partyHistoryPreview.innerHTML = partyRows.length ? partyRows.map((row) => {
      const p = partyById.get(row.partyId) || { shortName: row.partyName || row.partyId, color: "#7c7f88" };
      const latest = safeArray(row.years)[0] || {};
      const max = Math.max(1, ...safeArray(row.years).map((y) => Number(y.elected || 0)));
      return `<article class="party-history-card" style="--party-color:${escapeHtml(p.color)}"><div><strong>${escapeHtml(p.shortName)}</strong><span>最近 ${escapeHtml(latest.year || "—")} · ${escapeHtml(latest.elected || 0)} 席</span></div><div class="spark-bars">${safeArray(row.years).slice(0, 5).map((year) => `<span title="${escapeHtml(year.year)}：${escapeHtml(year.elected || 0)} 席" style="height:${Math.max(8, Math.round((Number(year.elected || 0) / max) * 42))}px"></span>`).join("")}</div></article>`;
    }).join("") : `<p class="muted-note">尚未有政黨歷年席次資料。</p>`;
    const districts = hasPublicHistory ? safeArray(data.districtHistory).filter((district) => state.county === "all" || district.countyId === state.county).slice(0, 6) : [];
    els.districtHistoryPreview.innerHTML = districts.length ? districts.map((district) => `<article class="district-history-card"><strong>${escapeHtml(district.countyName || "")} ${escapeHtml(district.district || "")}</strong><p>${escapeHtml(safeArray(district.records).length)} 筆歷屆候選人紀錄</p><div>${safeArray(district.records).slice(0, 3).map((record) => `<span style="--party-color:${escapeHtml(party(record).color)}">${escapeHtml(record.year)} ${escapeHtml(record.name)}｜${escapeHtml(party(record).shortName)}</span>`).join("")}</div></article>`).join("") : `<p class="muted-note">選取縣市後，可在這裡看到該地歷屆選區紀錄。</p>`;
    els.historyLabSection.hidden = !allRecords.length && state.view !== "history";
    renderAvailabilityNotice();
  }

  function getItemById(id) { return currentItems().find((item) => item.id === id); }
  async function loadPersonDetail(id, fallback) {
    if (!id || location.protocol === "file:" || !dataManifest?.peopleBase) return fallback;
    if (personDetailCache.has(id)) return personDetailCache.get(id);
    try {
      const response = await fetch(`data/${dataManifest.peopleBase}${encodeURIComponent(id)}.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status}`);
      const payload = await response.json();
      const person = payload.person || fallback;
      personDetailCache.set(id, person);
      return person;
    } catch {
      return fallback;
    }
  }
  function inferIssueRepo() {
    if (!location.hostname.endsWith("github.io")) return "";
    const owner = location.hostname.replace(/\.github\.io$/, "");
    const repo = location.pathname.split("/").filter(Boolean)[0];
    return owner && repo ? `${owner}/${repo}` : "";
  }
  async function reportPersonIssue(item) {
    const repo = inferIssueRepo();
    const title = `[資料更正] ${item.name || "政治人物"}`;
    const body = `人物：${item.name || "—"}\n人物 ID：${item.id || "—"}\n職務／選區：${item.role || item.electionType || "—"}｜${item.district || item.organization || "—"}\n頁面：${location.href}\n\n問題類型：\n問題說明：\n可查證官方來源：`;
    if (repo) {
      window.open(`https://github.com/${repo}/issues/new?template=data-correction.yml&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
      return;
    }
    try { await navigator.clipboard.writeText(`${title}\n\n${body}`); showToast("回報內容已複製；部署到 GitHub Pages 後可直接開啟 Issue"); }
    catch { showToast("請複製目前網址並至管理者提供的回報管道說明"); }
  }
  async function openPerson(id) {
    const fallback = getItemById(id); if (!fallback) return;
    const item = await loadPersonDetail(id, fallback);
    state.person = id; syncUrl(); const p = party(item); const r = role(item); const sources = safeArray(item.sources); const sourceUpdated = item.sourceUpdatedAt || item.officialUpdatedAt || item.verifiedAt || sources[0]?.date || "未標示";
    const personHistory = historyRecordsFor(item);
    const historyTimeline = `<div class="modal-section"><h3>歷屆紀錄</h3>${personHistory.length ? `<div class="person-timeline">${personHistory.map(historyRecordHtml).join("")}</div>` : `<p class="modal-subtitle">尚未匯入此人的歷屆選舉紀錄。</p>`}<p class="modal-hint">注意：此處顯示的是「參選推薦政黨」與選舉結果，不必然等同實際黨籍。</p></div>`;
    const photo = photoInfo(item);
    const partyTrail = [...new Map(personHistory.map((record) => [record.year, record])).values()].map((record) => `<div class="party-trail-item" style="--party-color:${escapeHtml(party(record).color)}"><i></i><span>${escapeHtml(record.year || "—")}</span><strong>${escapeHtml(party(record).shortName)}</strong><small>參選推薦</small></div>`).join("");
    els.personDialogContent.innerHTML = `<div class="person-modal-header">${avatarHtml(item, "person-modal-avatar")}<div><span class="role-badge">${escapeHtml(r.name)}</span><h2 class="modal-title">${escapeHtml(displayPersonName(item.name))}</h2><p class="modal-subtitle">${escapeHtml(p.name)} · ${escapeHtml(item.district || item.organization || "全國")}</p></div></div>
      <div class="modal-section"><h3>任職／參選資料</h3><div class="detail-list">
        <div class="detail-item"><span>資料類型</span><strong>${escapeHtml(item.kind === "officeholder" ? "現任民選公職" : item.kind === "candidate" ? "候選人" : "歷屆選舉結果")}</strong></div>
        <div class="detail-item"><span>職位</span><strong>${escapeHtml(r.name)}</strong></div>
        <div class="detail-item"><span>機關／選區</span><strong>${escapeHtml(item.organization || item.district || "未提供")}</strong></div>
        <div class="detail-item"><span>任期／年度</span><strong>${escapeHtml(item.termStart || item.year || "未提供")}</strong></div>
        <div class="detail-item"><span>資料狀態</span><strong>${escapeHtml(sources.length ? `官方來源 ${sources.length} 個` : "來源待補")}</strong></div>
        <div class="detail-item"><span>最後更新</span><strong>${escapeHtml(sourceUpdated)}</strong></div>
      </div></div>
      ${item.education || item.experience ? `<div class="modal-section"><h3>公開簡歷</h3><div class="detail-list"><div class="detail-item"><span>學歷</span><strong>${safeArray(item.education).map(escapeHtml).join("<br>") || "未提供"}</strong></div><div class="detail-item"><span>經歷</span><strong>${safeArray(item.experience).map(escapeHtml).join("<br>") || "未提供"}</strong></div></div></div>` : ""}
      <div class="modal-section"><h3>人物識別與政黨軌跡</h3><div class="detail-list"><div class="detail-item"><span>人物識別</span><strong>${escapeHtml(item.identityStatus === "verified-official" || item.personKey ? "已建立人物索引" : "待建立人物索引")}</strong></div><div class="detail-item"><span>目前政黨</span><strong>${escapeHtml(p.name)}</strong></div></div>${partyTrail ? `<div class="party-trail">${partyTrail}</div><p class="modal-hint">歷屆欄位代表當次參選推薦政黨，不直接等同當時正式黨籍。</p>` : `<p class="modal-subtitle">尚未匯入可比對的歷屆政黨紀錄。</p>`}</div>
      <div class="modal-section"><h3>頭貼來源</h3>${photo.url ? `<a class="source-link" href="${escapeHtml(photo.sourceUrl || photo.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(photo.sourceLabel)} ↗</a><p class="modal-hint">${escapeHtml([photo.credit, photo.license, photo.verifiedAt ? `查核 ${photo.verifiedAt}` : ""].filter(Boolean).join(" · "))}</p>` : `<p class="modal-subtitle">目前沒有可確認來源的頭貼，介面以姓名縮寫替代。</p>`}</div>
      ${historyTimeline}
      <div class="modal-section"><h3>官方來源</h3>${sources.length ? sources.map((source) => `<a class="source-link" href="${escapeHtml(source.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label || "官方來源")} ${source.date ? `· ${escapeHtml(source.date)}` : ""} ↗</a>`).join("") : `<p class="modal-subtitle">尚未提供來源。</p>`}</div>
      <div class="modal-section report-section"><div><h3>發現資料有誤？</h3><p class="modal-subtitle">回報只會進入待審核，不會直接改動公開資料。</p></div><button class="secondary-button" id="reportPersonButton" type="button">回報資料錯誤</button></div>`;
    els.personDialogContent.querySelector("#reportPersonButton")?.addEventListener("click", () => reportPersonIssue(item));
    els.personDialog.showModal();
  }
  function toggleCompare(id) {
    if (state.compare.has(id)) state.compare.delete(id); else { if (state.compare.size >= 3) { alert("最多比較 3 位人物。"); return; } state.compare.add(id); }
    renderResults();
  }
  function updateCompareButton() { els.compareButton.textContent = `比較已選人物（${state.compare.size}）`; els.compareButton.disabled = state.compare.size < 2; }
  function openCompare() {
    const items = currentItems().filter((item) => state.compare.has(item.id)); if (items.length < 2) return;
    const row = (label, fn) => `<tr><th>${escapeHtml(label)}</th>${items.map((i) => `<td>${fn(i)}</td>`).join("")}</tr>`;
    els.compareContent.innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>項目</th>${items.map((i) => `<th><div class="compare-person-head">${avatarHtml(i, "compare-avatar")}<span>${escapeHtml(displayPersonName(i.name))}</span></div></th>`).join("")}</tr></thead><tbody>
      ${row("職位", (i) => escapeHtml(role(i).name))}${row("政黨", (i) => escapeHtml(party(i).name))}${row("地區／選區", (i) => escapeHtml(i.district || "全國"))}${row("機關", (i) => escapeHtml(i.organization || "—"))}${row("資料來源", (i) => safeArray(i.sources).map((s) => escapeHtml(s.label)).join("<br>") || "—")}
    </tbody></table></div>`; els.compareDialog.showModal();
  }

  function updateOverview() {
    const allOfficeholders = safeArray(data.officeholders); const visible = filteredItems(); const local = allOfficeholders.filter((i) => i.countyId).length; const legislators = allOfficeholders.filter((i) => i.roleId === "legislator").length;
    els.overviewMode.textContent = viewLabel(); els.overviewCount.textContent = `${visible.length} 筆`; els.overviewLocalCount.textContent = String(local); els.overviewLegislatorCount.textContent = String(legislators);
    const sync = data.officeholderSync?.lastSuccessAt || data.sync?.lastSuccessAt; els.overviewSync.textContent = sync ? formatDate(sync) : "尚未完成首次同步";
  }
  function healthAgeDays(value) {
    if (!value) return Infinity;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86400000) : Infinity;
  }
  function renderDataHealth() {
    if (!els.dataHealthPanel) return;
    const os = data.officeholderSync || {}; const cs = data.sync || {}; const hs = data.historySync || data.history?.coverage || {};
    const rows = [
      { label: "總統府", status: os.coverage?.presidency === "active" || os.coverage?.presidency === "seeded", time: os.lastSuccessAt || "2026-07-12T00:00:00+08:00", detail: "總統、副總統與官方玉照" },
      { label: "立法院", status: os.coverage?.legislature === "active", time: os.lastSuccessAt, detail: os.legislatorCount ? `${os.legislatorCount} 位現任立委` : "等待首次同步" },
      { label: "內政部", status: String(os.coverage?.local || "").startsWith("active"), time: os.lastSuccessAt, detail: os.localOfficeholderCount ? `${os.localOfficeholderCount} 位地方公職` : "等待首次同步" },
      { label: "中選會候選人", status: Number(cs.officialCandidateCount || 0) > 0, time: cs.lastSuccessAt, detail: cs.officialCandidateCount ? `${cs.officialCandidateCount} 位正式候選人` : "尚未公告／尚未同步" },
      { label: "中選會歷屆", status: Number(hs.officialRecordCount || 0) > 0, time: hs.finishedAt || hs.lastOfficialSyncAt, detail: hs.officialRecordCount ? `${Number(hs.officialRecordCount).toLocaleString("zh-Hant")} 筆紀錄` : "等待首次匯入" },
    ];
    const scored = rows.map((row) => ({ ...row, age: healthAgeDays(row.time), healthy: row.status && healthAgeDays(row.time) <= 8 }));
    const healthyCount = scored.filter((row) => row.healthy).length;
    const score = Math.round((healthyCount / scored.length) * 100);
    const hasFirstSync = Boolean(os.lastSuccessAt || cs.lastSuccessAt || Number(hs.officialRecordCount || 0));
    els.dataHealthScore.textContent = hasFirstSync ? `${score}%` : "待啟用";
    els.dataHealthScore.dataset.state = score >= 80 ? "ok" : score >= 40 ? "warn" : "waiting";
    els.dataHealthTitle.textContent = !hasFirstSync ? "等待第一次完整同步" : score >= 80 ? "資料來源運作正常" : score >= 40 ? "部分來源需要注意" : "多個來源尚未同步";
    els.dataHealthText.textContent = !hasFirstSync ? "目前保留官方種子資料；部署 GitHub Actions 後會建立完整健康狀態。" : `共有 ${healthyCount}/${scored.length} 個來源在預期更新期間內。`;
    els.dataHealthSources.innerHTML = scored.map((row) => `<article class="health-source ${row.healthy ? "ok" : row.status ? "stale" : "waiting"}"><i></i><div><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.detail)}</span></div><small>${row.time ? escapeHtml(formatDate(row.time)) : "尚無紀錄"}</small></article>`).join("");
  }

  function renderSyncStatus() {
    const os = data.officeholderSync || {}; const cs = data.sync || {}; const complete = os.lastSuccessAt || os.status === "active";
    els.headerSyncChip.classList.toggle("ok", Boolean(complete)); els.headerSyncChip.querySelector("span").textContent = complete ? `已同步 ${os.officeholderCount || safeArray(data.officeholders).length} 人` : "等待首次現任名單同步";
    els.coveragePresidency.textContent = os.coverage?.presidency === "seeded" ? "已內建" : "已同步";
    els.coverageLegislature.textContent = os.legislatorCount ? `${os.legislatorCount} 人` : "等待同步";
    els.coverageLocal.textContent = os.localOfficeholderCount ? `${os.localOfficeholderCount} 人` : "等待同步";
    els.coverageCandidates.textContent = cs.officialCandidateCount ? `${cs.officialCandidateCount} 人` : "等待正式公告";
    const hs = data.history?.coverage || {};
    els.syncDetail.innerHTML = `<strong>現任公職：</strong>${escapeHtml(os.message || "尚未執行。")}<br><strong>候選人：</strong>${escapeHtml(cs.message || "尚未執行。")}<br><strong>歷屆資料：</strong>${hs.officialRecordCount ? `中選會官方 ${Number(hs.officialRecordCount).toLocaleString("zh-Hant")} 筆，涵蓋 ${safeArray(hs.yearsImported).join("、")}` : "尚未完成官方歷屆匯入。"}<br><strong>排程：</strong>每天台灣時間 03:00 更新現任與候選人；每週日 03:20 更新核心歷屆資料。`;
  }

  function syncStatusRows() {
    const os = data.officeholderSync || {}; const cs = data.sync || {}; const hs = data.historySync || data.history?.coverage || {};
    return [
      { label: "總統府", count: safeArray(data.officeholders).filter((item) => ["president", "vice-president"].includes(item.roleId)).length, status: os.coverage?.presidency || "waiting", time: os.lastSuccessAt },
      { label: "立法院", count: Number(os.legislatorCount || 0), status: os.coverage?.legislature || "waiting", time: os.lastSuccessAt },
      { label: "內政部地方公職", count: Number(os.localOfficeholderCount || 0), status: os.coverage?.local || "waiting", time: os.lastSuccessAt },
      { label: "正式候選人", count: Number(cs.officialCandidateCount || 0), status: cs.status || "waiting", time: cs.lastSuccessAt },
      { label: "中選會歷屆", count: Number(hs.officialRecordCount || 0), status: hs.status || (Number(hs.officialRecordCount || 0) ? "active" : "waiting"), time: hs.finishedAt || hs.lastOfficialSyncAt },
    ];
  }

  function renderSyncStatusDialog() {
    if (!els.syncStatusDialogContent) return;
    const rows = syncStatusRows();
    els.syncStatusDialogContent.innerHTML = rows.map((row) => {
      const ready = row.count > 0 || String(row.status).startsWith("active") || row.status === "seeded";
      return `<article class="sync-dialog-row ${ready ? "ok" : "waiting"}"><i></i><div><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.status || "尚無狀態")}</span></div><b>${Number(row.count || 0).toLocaleString("zh-Hant")}</b><small>${row.time ? escapeHtml(formatDate(row.time)) : "尚無成功紀錄"}</small></article>`;
    }).join("");
  }

  function openSyncStatusDialog() {
    renderSyncStatusDialog();
    els.syncStatusDialog?.showModal();
  }

  const initialManifestVersion = dataManifest?.generatedAt || data.meta?.generatedAt || data.officeholderSync?.lastSuccessAt || data.sync?.lastSuccessAt || "";
  async function checkForNewPublishedData({ announce = false } = {}) {
    if (location.protocol === "file:") { if (announce) showToast("本機檔案不會自動取得 GitHub 最新資料"); return false; }
    try {
      const response = await fetch(`data/manifest.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const manifest = await response.json();
      const latest = manifest?.generatedAt || "";
      if (latest && initialManifestVersion && latest !== initialManifestVersion) {
        if (els.newDataBanner) els.newDataBanner.hidden = false;
        return true;
      }
      if (announce) showToast("目前已是最新發布資料");
      return false;
    } catch {
      if (announce) showToast("暫時無法檢查最新資料");
      return false;
    }
  }

  function startFreshnessPolling() {
    if (location.protocol === "file:") return;
    setTimeout(() => checkForNewPublishedData(), 15000);
    setInterval(() => checkForNewPublishedData(), 90000);
  }

  function renderSources() {
    els.sourceList.innerHTML = safeArray(data.sources).map((source) => `<article class="source-item"><div class="source-item-header"><h3>${escapeHtml(source.name)}</h3><small>${escapeHtml(source.type)}</small></div><p>${escapeHtml(source.usage)}</p><p><strong>注意：</strong>${escapeHtml(source.note)}</p><a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">開啟官方來源 ↗</a></article>`).join("");
  }
  function setCounty(id) { pendingTownKey = ""; state.county = id; state.town = null; if (id !== "all") { state.summaryCollapsed = false; localStorage.setItem("political-map-summary-collapsed", "false"); applyLayoutState(); } els.countySelect.value = id; if (els.mapCountyJump) els.mapCountyJump.value = id; updateMapBreadcrumb(); focusMapOnCounty(id); renderResults(); }
  function resetFilters() {
    pendingTownKey = ""; state.county = "all"; state.party = "all"; state.role = "all"; state.historyType = "all"; state.query = ""; state.town = null; state.compare.clear();
    els.countySelect.value = "all"; els.partySelect.value = "all"; els.roleSelect.value = "all"; if (els.historyTypeSelect) els.historyTypeSelect.value = "all"; els.searchInput.value = ""; if (els.resultsSearchInput) els.resultsSearchInput.value = ""; state.partyGroupLimits = Object.create(null); renderRoleShortcuts(); focusMapOnCounty("all"); renderResults();
  }
  function renderAll() { renderRoleShortcuts(); renderResults(); updateMapBreadcrumb(); renderActiveFilters(); syncUrl(); }

  function setupEvents() {
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    const updateSearch = (value, source) => {
      state.query = value;
      state.partyGroupLimits = Object.create(null);
      if (source !== els.searchInput) els.searchInput.value = value;
      if (els.resultsSearchInput && source !== els.resultsSearchInput) els.resultsSearchInput.value = value;
      renderResults();
    };
    els.searchInput.addEventListener("input", (event) => updateSearch(event.target.value, els.searchInput));
    els.resultsSearchInput?.addEventListener("input", (event) => updateSearch(event.target.value, els.resultsSearchInput));
    els.resultsSortSelect?.addEventListener("change", (event) => {
      state.sort = event.target.value;
      localStorage.setItem("election-report-officeholder-sort", state.sort);
      if (els.groupingNote) els.groupingNote.textContent = `依政黨分組 · ${officeholderSortLabel()}`;
      renderResults();
    });
    els.roleSelect.addEventListener("change", (event) => { state.role = event.target.value; renderRoleShortcuts(); renderResults(); });
    els.yearSelect.addEventListener("change", (event) => { state.year = event.target.value; renderResults(); });
    els.historyTypeSelect?.addEventListener("change", (event) => { state.historyType = event.target.value; renderResults(); });
    els.countySelect.addEventListener("change", (event) => setCounty(event.target.value));
    els.mapCountyJump?.addEventListener("change", (event) => setCounty(event.target.value));
    els.mapTownJump?.addEventListener("change", (event) => {
      const key = event.target.value;
      if (!key) { pendingTownKey = ""; focusMapOnCounty(state.county); renderResults(); return; }
      const feature = townFeatureByKey.get(key);
      if (feature) selectTownFeature(feature, townLeafletLayers.get(key));
    });
    els.resetMapLocation?.addEventListener("click", () => setCounty("all"));
    els.partySelect.addEventListener("change", (event) => { state.party = event.target.value; renderResults(); });
    els.togglePartyGroupsButton?.addEventListener("click", toggleAllPartyGroups);
    els.toggleResultsButton?.addEventListener("click", () => {
      state.resultsCollapsed = !state.resultsCollapsed;
      localStorage.setItem("election-report-results-collapsed", String(state.resultsCollapsed));
      els.resultsBody.hidden = state.resultsCollapsed;
      els.toggleResultsButton.setAttribute("aria-expanded", String(!state.resultsCollapsed));
      els.toggleResultsButton.textContent = state.resultsCollapsed ? "展開名單" : (state.view === "officeholders" ? "收合現任公職" : "收合資料");
      updatePartyGroupControls();
      if (!state.resultsCollapsed) els.resultsBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    els.resetFilters.addEventListener("click", resetFilters); els.mapHomeButton.addEventListener("click", () => setCounty("all")); els.showAllButton.addEventListener("click", () => setCounty("all"));
    $$('[data-map-mode]').forEach((button) => button.addEventListener("click", () => { state.mapMode = button.dataset.mapMode; $$('[data-map-mode]').forEach((item) => item.classList.toggle("active", item === button)); refreshMapStyles(); }));
    els.sourceButton.addEventListener("click", () => els.sourceDialog.showModal()); els.compareButton.addEventListener("click", openCompare);
    els.headerSyncChip?.addEventListener("click", openSyncStatusDialog);
    els.syncDialogRefreshButton?.addEventListener("click", async () => { renderSyncStatusDialog(); await checkForNewPublishedData({ announce: true }); });
    els.reloadNewDataButton?.addEventListener("click", () => location.reload());
    els.dismissNewDataButton?.addEventListener("click", () => { if (els.newDataBanner) els.newDataBanner.hidden = true; });
    els.shareButton?.addEventListener("click", shareCurrentView);
    els.filterToggleButton?.addEventListener("click", toggleFilters);
    els.mobileFilterClose?.addEventListener("click", () => { if (!state.filtersCollapsed) toggleFilters(); });
    els.filterScrim?.addEventListener("click", () => { if (!state.filtersCollapsed) toggleFilters(); });
    els.summaryCollapseButton?.addEventListener("click", toggleSummary);
    els.clearActiveFilters?.addEventListener("click", resetFilters);
    els.activeFilterList?.addEventListener("click", (event) => { const button = event.target.closest("[data-clear-filter]"); if (button) clearSingleFilter(button.dataset.clearFilter); });
    els.availabilitySyncButton?.addEventListener("click", () => document.querySelector(".data-status-section")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close()));
    $$('dialog').forEach((dialog) => dialog.addEventListener("click", (event) => { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }));
    els.personDialog?.addEventListener("close", () => { state.person = ""; syncUrl(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) { event.preventDefault(); if (state.filtersCollapsed) toggleFilters(); els.searchInput.focus(); }
      if (event.key === "Escape" && window.matchMedia("(max-width: 900px)").matches && !state.filtersCollapsed) { toggleFilters(); return; }
      if (event.key === "Escape" && state.town) { state.town = null; updateMapBreadcrumb(); renderResults(); }
    });
    window.matchMedia("(max-width: 900px)").addEventListener?.("change", applyLayoutState);
  }

  validateInitialState(); setupTheme(); setupSelects(); renderSyncStatus(); renderDataHealth(); renderSyncStatusDialog(); renderSources(); setupEvents(); applyLayoutState();
  if (els.resultsBody) els.resultsBody.hidden = state.resultsCollapsed;
  if (els.toggleResultsButton) { els.toggleResultsButton.setAttribute("aria-expanded", String(!state.resultsCollapsed)); els.toggleResultsButton.textContent = state.resultsCollapsed ? "展開名單" : "收合現任公職"; }
  initMap(); setView(state.view, true); startFreshnessPolling();
  if (state.person) setTimeout(() => openPerson(state.person), 120);
})();
