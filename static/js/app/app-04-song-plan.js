/* Verbum SPA part 4/9: app-04-song-plan.js
 * Mass song plan, hymn layout/preview, practice share
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 10496-13999
 */
    function setupPracticeShareTitleMarquee(card) {
      if (!card || !card.closest("#practice-share-sections-modal")) return;
      const wrap = card.querySelector(".mass-song-plan-card__title-wrap");
      const titleEl = card.querySelector(".mass-song-plan-card__title");
      if (!wrap || !titleEl) return;

      clearPracticeShareTitleMarquee(card);
      if (titleEl.classList.contains("is-empty")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!card.isConnected) return;
          const viewW = wrap.clientWidth;
          if (viewW < 24) return;
          // Natural width needs unconstrained title for accurate overflow measure
          card.classList.add("is-title-marquee");
          const textW = Math.ceil(titleEl.scrollWidth);
          const overflow = textW - viewW;
          if (overflow <= 6) {
            card.classList.remove("is-title-marquee");
            titleEl.style.transition = "none";
            titleEl.style.transform = "translateX(0)";
            return;
          }
          const scrollMs = Math.max(2800, Math.round((overflow / PS_TITLE_SCROLL_PX_PER_SEC) * 1000));
          const startTimer = window.setTimeout(() => {
            titleEl.style.transition = "transform " + scrollMs + "ms linear";
            titleEl.style.transform = "translateX(-" + overflow + "px)";
          }, PS_TITLE_HOLD_MS);
          const loopTimer = window.setTimeout(() => {
            titleEl.style.transition = "none";
            titleEl.style.transform = "translateX(0)";
            setupPracticeShareTitleMarquee(card);
          }, PS_TITLE_HOLD_MS + scrollMs + PS_TITLE_HOLD_END_MS);
          card._psTitleTimers = [startTimer, loopTimer];
        });
      });
    }

    function syncUiCardPopoverOverflow(panel, open) {
      const card = panel && panel.closest(".ui-overlay .ui-card");
      if (!card) return;
      if (open) {
        card.classList.add("ui-card--popover-open");
        return;
      }
      const stillOpen = card.querySelector(".vb-select__panel:not([hidden]), .vb-dropdown-panel:not([hidden])");
      if (!stillOpen) card.classList.remove("ui-card--popover-open");
    }

    function openVbDropdownPanel(panel) {
      if (!panel) return;
      panel.hidden = false;
      panel.classList.add("is-open");
      syncUiCardPopoverOverflow(panel, true);
    }

    function closeVbDropdownPanel(panel) {
      if (!panel) return;
      panel.classList.remove("is-open");
      panel.hidden = true;
      markSongPlanResultsOpen(panel, false);
      syncUiCardPopoverOverflow(panel, false);
      if (isHeaderSheetPanel(panel)) syncHeaderSheetBackdrop({ allowPointer: true });
    }

    var HEADER_SHEET_PANEL_IDS = new Set([
      "notif-panel",
      "account-menu-panel",
      "liturgical-indicator-panel",
      "live-radio-panel",
      "create-menu-panel",
    ]);

    function isMobileHeaderSheet() {
      return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    }

    function isHeaderSheetPanel(panel) {
      if (!panel || !panel.id) return false;
      if (isMobileChromeLayout() && panel.id !== "live-radio-panel" && panel.id !== "create-menu-panel") return false;
      return HEADER_SHEET_PANEL_IDS.has(panel.id);
    }

    function suppressHeaderDismissBriefly(ms) {
      const delay = typeof ms === "number" ? ms : 650;
      window.__verbumHeaderDismissGuard = true;
      window.clearTimeout(window.__verbumHeaderDismissGuardTimer);
      window.__verbumHeaderDismissGuardTimer = window.setTimeout(() => {
        window.__verbumHeaderDismissGuard = false;
        const backdrop = $("header-sheet-backdrop");
        if (backdrop && !backdrop.hidden) {
          backdrop.style.pointerEvents = "auto";
        }
      }, delay);
    }

    function hasOpenHeaderSheet() {
      if (isMobileChromeLayout()) {
        const radio = $("live-radio-panel");
        const create = $("create-menu-panel");
        return !!((radio && !radio.hidden) || (create && !create.hidden));
      }
      return !!document.querySelector(
        "#notif-panel:not([hidden]), #account-menu-panel:not([hidden]), " +
        "#liturgical-indicator-panel:not([hidden]), #live-radio-panel:not([hidden])"
      );
    }

    function syncHeaderSheetBackdrop(opts) {
      const backdrop = $("header-sheet-backdrop");
      if (!backdrop) return;
      const allowPointer = !(opts && opts.allowPointer === false);
      if (!isMobileHeaderSheet()) {
        backdrop.hidden = true;
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.style.pointerEvents = "none";
        document.body.classList.remove("header-sheet-open");
        return;
      }
      const showing = hasOpenHeaderSheet();
      backdrop.hidden = !showing;
      backdrop.setAttribute("aria-hidden", showing ? "false" : "true");
      backdrop.style.pointerEvents = showing && allowPointer ? "auto" : "none";
      document.body.classList.toggle("header-sheet-open", showing);
    }

    function bindMobileHeaderSheetTrigger(btn, onClick) {
      if (!btn || typeof onClick !== "function") return;
      btn.addEventListener("pointerdown", (e) => {
        if (!isMobileHeaderSheet()) return;
        if (e.pointerType === "touch") e.preventDefault();
      }, { passive: false });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      });
    }

    function openHeaderSheetPanel(panel, btn) {
      if (!panel) return;
      if (isMobileHeaderSheet() && isHeaderSheetPanel(panel)) {
        suppressHeaderDismissBriefly();
      }
      panel.hidden = false;
      requestAnimationFrame(() => {
        panel.classList.add("is-open");
        syncUiCardPopoverOverflow(panel, true);
      });
      if (btn) btn.setAttribute("aria-expanded", "true");
      if (isMobileHeaderSheet() && isHeaderSheetPanel(panel)) {
        syncHeaderSheetBackdrop({ allowPointer: false });
        window.setTimeout(() => syncHeaderSheetBackdrop({ allowPointer: true }), 650);
      } else {
        syncHeaderSheetBackdrop({ allowPointer: true });
      }
    }

    function closeHeaderSheetPanel(panel, btn) {
      if (!panel) return;
      panel.classList.remove("is-open");
      panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      syncUiCardPopoverOverflow(panel, false);
      syncHeaderSheetBackdrop({ allowPointer: true });
    }

    function toggleHeaderSheetPanel(panel, btn, exceptPanelId) {
      if (!panel) return;
      if (panel.hidden) {
        if (typeof closeHeaderMenus === "function") closeHeaderMenus(exceptPanelId || panel.id);
        openHeaderSheetPanel(panel, btn);
      } else {
        closeHeaderSheetPanel(panel, btn);
      }
    }

    function isInsideHeaderDropdownUI(target) {
      if (!target || !target.closest) return false;
      return !!target.closest(
        ".account-menu-wrap, .liturgical-indicator-wrap, .live-radio-wrap, .notif-wrap, " +
        "#notif-panel, #account-menu-panel, #liturgical-indicator-panel, #live-radio-panel"
      );
    }

    function setVbDropdownOpen(panel, btn, open) {
      if (!panel) return;
      if (open && isMobileHeaderSheet() && isHeaderSheetPanel(panel)) {
        openHeaderSheetPanel(panel, btn);
        return;
      }
      if (!open && isMobileHeaderSheet() && isHeaderSheetPanel(panel)) {
        closeHeaderSheetPanel(panel, btn);
        return;
      }
      if (open) {
        panel.hidden = false;
        requestAnimationFrame(() => {
          panel.classList.add("is-open");
          syncUiCardPopoverOverflow(panel, true);
        });
        if (btn) btn.setAttribute("aria-expanded", "true");
      } else {
        panel.classList.remove("is-open");
        panel.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
        syncUiCardPopoverOverflow(panel, false);
      }
    }

    function songPlanResultsBoxes(key) {
      return [
        $("mass-song-res-" + key),
        $("ps-song-res-" + key),
      ].filter(Boolean);
    }

    function markSongPlanResultsOpen(box, open) {
      const card = box && box.closest(".mass-song-plan-card");
      if (card) card.classList.toggle("is-results-open", !!open);
    }

    function renderMassSongResults(key, list, query, preferredBox) {
      const boxes = preferredBox ? [preferredBox] : songPlanResultsBoxes(key);
      if (!boxes.length) return;
      const q = String(query || "").trim();
      let html = "";
      if (!list.length) {
        html = "<div class=\"vb-dropdown-empty mass-song-no-matches\">";
        if (q) {
          html += "<p><strong>No matches</strong> in your library.</p>";
          html += "<p class=\"mass-song-no-matches__hint\">Add this song in Song Composer, then return here to pick it.</p>";
          html += "<button type=\"button\" class=\"mass-song-add-composer-btn\" data-mass-add-composer=\"" + escapeHtml(key) + "\" data-mass-add-query=\"" + escapeHtml(q) + "\">Add in Song Composer</button>";
          html += "<p class=\"mass-song-no-matches__hint\" style=\"margin-top:6px;\">Or press Enter to add and search Google for lyrics.</p>";
        } else {
          html += "<p>No matches. Clear the search or set Language to All.</p>";
        }
        html += "</div>";
      } else {
        html = "<ul class=\"vb-dropdown-list\">" + list.map((row) => {
          const noLyrics = !row.has_lyrics;
          const rowCls = "vb-dropdown-item mass-song-result-row" + (noLyrics ? " mass-song-result-row--no-lyrics" : "");
          const lyricsBadge = noLyrics
            ? "<span class=\"vb-dropdown-item__hint mass-song-lyrics-badge\" aria-label=\"No lyrics saved\">No lyrics</span>"
            : "";
          const meta = escapeHtml(row.section || "library") +
              (row.author ? " · " + escapeHtml(row.author) : "") +
              (row.language ? " · " + escapeHtml(row.language) : "") +
            (row.source === "web" ? " · web hint" : "");
          return (
            "<li><button type=\"button\" class=\"" + rowCls + "\" role=\"option\" data-pick-slot=\"" + escapeHtml(key) + "\" data-pick-id=\"" + escapeHtml(row.id) + "\">" +
              "<span class=\"vb-dropdown-item__label\"><strong>" + escapeHtml(row.title) + "</strong>" +
              "<span class=\"mass-song-result-meta\">" + meta + "</span></span>" +
              lyricsBadge +
            "</button></li>"
          );
        }).join("") + "</ul>";
      }
      boxes.forEach((box) => {
        box.innerHTML = html;
        openVbDropdownPanel(box);
        markSongPlanResultsOpen(box, true);
      });
    }

    function closeMassSongResultPanels(exceptKey) {
      document.querySelectorAll(".mass-song-results").forEach((box) => {
        const key = box.dataset.slotKey || String(box.id || "")
          .replace(/^mass-song-res-/, "")
          .replace(/^ps-song-res-/, "");
        if (exceptKey && key === exceptKey) return;
        closeVbDropdownPanel(box);
        markSongPlanResultsOpen(box, false);
      });
      const stillOpen = document.querySelector("#practice-share-song-plan .mass-song-results:not([hidden])");
      if (!stillOpen) clearPracticeShareDropdownPad();
    }

    var massSongLyricsCache = new Map();
    var HYMN_TYPO_STORAGE_KEY = "churchMediaHymnTypography";
    var HYMN_LAYOUT_STORAGE_KEY = "churchMediaHymnLyricsLayout";
    var HYMN_BODY_ALIGN_STORAGE_KEY = "churchMediaHymnBodyAlign";
    var HYMN_SECTION_LABELS_STORAGE_KEY = "churchMediaHymnSectionLabels";
    var COLLECTION_CURRENCY_STORAGE_KEY = "churchMediaCollectionCurrency";

    var COLLECTION_CURRENCIES = {
      PHP: { symbol: "₱", prefix: true, spaceAfterSymbol: false, decimals: 0 },
      KRW: { symbol: "₩", prefix: true, spaceAfterSymbol: false, decimals: 0 },
      MYR: { symbol: "RM", prefix: true, spaceAfterSymbol: true, decimals: 0 },
    };

    function readCollectionCurrencyCode() {
      const sel = $("flow-collection-currency");
      const code = sel && sel.value ? sel.value.toUpperCase() : "PHP";
      return COLLECTION_CURRENCIES[code] ? code : "PHP";
    }

    function parseCollectionDigits(text) {
      return String(text || "").replace(/\D/g, "");
    }

    function formatCollectionAmount(digits, currencyCode) {
      const cfg = COLLECTION_CURRENCIES[currencyCode] || COLLECTION_CURRENCIES.PHP;
      const raw = String(digits || "").replace(/\D/g, "");
      if (!raw) return "";
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return "";
      const num = n.toLocaleString("en-US", {
        minimumFractionDigits: cfg.decimals,
        maximumFractionDigits: cfg.decimals,
      });
      const gap = cfg.spaceAfterSymbol ? " " : "";
      if (cfg.prefix) return cfg.symbol + gap + num;
      return num + gap + cfg.symbol;
    }

    function syncCollectionAmountDisplay() {
      const inp = $("flow-collection-amount");
      if (!inp) return "";
      const digits = inp.dataset.rawDigits || parseCollectionDigits(inp.value);
      inp.dataset.rawDigits = digits;
      const formatted = formatCollectionAmount(digits, readCollectionCurrencyCode());
      inp.value = formatted;
      return formatted;
    }

    function getFormattedCollectionAmount() {
      return syncCollectionAmountDisplay();
    }

    function initCollectionCurrencyUi() {
      const sel = $("flow-collection-currency");
      const inp = $("flow-collection-amount");
      if (!sel || !inp) return;
      let saved = "PHP";
      try {
        saved = localStorage.getItem(COLLECTION_CURRENCY_STORAGE_KEY) || "PHP";
      } catch (_e) { /* ignore */ }
      if (COLLECTION_CURRENCIES[saved]) sel.value = saved;
      sel.addEventListener("change", () => {
        try {
          localStorage.setItem(COLLECTION_CURRENCY_STORAGE_KEY, readCollectionCurrencyCode());
        } catch (_e) { /* ignore */ }
        syncCollectionAmountDisplay();
      });
      inp.addEventListener("input", () => {
        const digits = parseCollectionDigits(inp.value);
        inp.dataset.rawDigits = digits;
        syncCollectionAmountDisplay();
      });
      inp.addEventListener("blur", () => {
        syncCollectionAmountDisplay();
      });
    }

    function readHymnLyricsLayout() {
      const picked = document.querySelector('input[name="flow-hymn-layout"]:checked');
      if (picked && picked.value === "dual") return "dual";
      if (picked && picked.value === "single") return "single";
      const saved = localStorage.getItem(HYMN_LAYOUT_STORAGE_KEY);
      if (saved === "single" || saved === "dual") return saved;
      return "dual";
    }

    function normalizeHymnBodyAlign(value) {
      const v = String(value || "").trim().toLowerCase();
      if (v === "middle") return "center";
      if (v === "left" || v === "center" || v === "right" || v === "justify") return v;
      return "center";
    }

    function readHymnBodyAlign() {
      const picked = document.querySelector('input[name="flow-hymn-body-align"]:checked');
      if (picked) return normalizeHymnBodyAlign(picked.value);
      try {
        return normalizeHymnBodyAlign(localStorage.getItem(HYMN_BODY_ALIGN_STORAGE_KEY));
      } catch (_e) {
        return "center";
      }
    }

    function applyHymnBodyAlignToTypography(align) {
      const bodyAlign = normalizeHymnBodyAlign(align);
      Object.keys(hymnTypographyBySection).forEach((sec) => {
        const block = hymnTypographyBySection[sec];
        if (!block || typeof block !== "object") return;
        block.body_align = bodyAlign;
        if (block.slides && typeof block.slides === "object") {
          Object.keys(block.slides).forEach((key) => {
            if (block.slides[key] && typeof block.slides[key] === "object") {
              block.slides[key].body_align = bodyAlign;
            }
          });
        }
      });
      if (typeof saveHymnTypographyStore === "function") saveHymnTypographyStore();
    }

    function applyHymnBodyAlign(value) {
      const align = normalizeHymnBodyAlign(value);
      try {
        localStorage.setItem(HYMN_BODY_ALIGN_STORAGE_KEY, align);
      } catch (_e) { /* ignore */ }
      document.querySelectorAll('input[name="flow-hymn-body-align"]').forEach((el) => {
        el.checked = el.value === align;
      });
      applyHymnBodyAlignToTypography(align);
      if (songPreviewState && typeof refreshSongPreviewPanel === "function") {
        refreshSongPreviewPanel();
      }
      if (typeof window.scheduleMassBuilderDraftAutoSave === "function") {
        window.scheduleMassBuilderDraftAutoSave();
      }
    }

    function initHymnBodyAlignUi() {
      let saved = "center";
      try {
        saved = normalizeHymnBodyAlign(localStorage.getItem(HYMN_BODY_ALIGN_STORAGE_KEY));
      } catch (_e) {
        saved = "center";
      }
      applyHymnBodyAlign(saved);
      document.querySelectorAll('input[name="flow-hymn-body-align"]').forEach((el) => {
        el.addEventListener("change", () => {
          const v = document.querySelector('input[name="flow-hymn-body-align"]:checked');
          if (v) applyHymnBodyAlign(v.value);
        });
      });
    }

    function readHymnSectionLabels() {
      const el = $("flow-hymn-section-labels");
      if (el) return !!el.checked;
      try {
        return localStorage.getItem(HYMN_SECTION_LABELS_STORAGE_KEY) === "1";
      } catch (_e) {
        return false;
      }
    }

    function applyHymnSectionLabels(on) {
      const enabled = !!on;
      try {
        localStorage.setItem(HYMN_SECTION_LABELS_STORAGE_KEY, enabled ? "1" : "0");
      } catch (_e) { /* ignore */ }
      const el = $("flow-hymn-section-labels");
      if (el) el.checked = enabled;
    }

    function initHymnSectionLabelsToggle() {
      const el = $("flow-hymn-section-labels");
      if (!el || el.dataset.bound) return;
      el.dataset.bound = "1";
      try {
        el.checked = localStorage.getItem(HYMN_SECTION_LABELS_STORAGE_KEY) === "1";
      } catch (_e) {
        el.checked = false;
      }
      el.addEventListener("change", () => {
        applyHymnSectionLabels(el.checked);
        if (songPreviewState && typeof refreshSongPreviewPanel === "function") {
          refreshSongPreviewPanel();
        }
      });
    }

    function loadHymnSongLayoutDefaults() {
      try {
        hymnSongLayoutDefaults = JSON.parse(localStorage.getItem(HYMN_SONG_LAYOUT_KEY) || "{}") || {};
      } catch (_e) {
        hymnSongLayoutDefaults = {};
      }
    }

    function saveHymnSongLayoutDefaults() {
      try {
        localStorage.setItem(HYMN_SONG_LAYOUT_KEY, JSON.stringify(hymnSongLayoutDefaults));
      } catch (_e) { /* ignore */ }
    }

    function songLayoutDefaultFor(section, songId) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      if (!sec || !id) return null;
      const def = hymnSongLayoutDefaults[sec + "|" + id];
      return def === "dual" || def === "single" ? def : null;
    }

    function setSongLayoutDefault(section, songId, value) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      if (!sec || !id) return;
      hymnSongLayoutDefaults[sec + "|" + id] = value === "dual" ? "dual" : "single";
      saveHymnSongLayoutDefaults();
    }

    function clearSongLayoutDefault(section, songId) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      if (!sec || !id) return;
      delete hymnSongLayoutDefaults[sec + "|" + id];
      saveHymnSongLayoutDefaults();
    }

    function getSongLayout(section, songId) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      const ov = sec && id && hymnLayoutOverrides[sec] ? hymnLayoutOverrides[sec][id] : null;
      if (ov === "dual" || ov === "single") return ov;
      const def = songLayoutDefaultFor(section, songId);
      if (def) return def;
      return readHymnLyricsLayout();
    }

    function setSongLayoutOverride(section, songId, value) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      if (!sec || !id) return;
      const layout = value === "dual" ? "dual" : "single";
      if (!hymnLayoutOverrides[sec]) hymnLayoutOverrides[sec] = {};
      hymnLayoutOverrides[sec][id] = layout;
    }

    function applyHymnLyricsLayout(value) {
      const layout = value === "dual" ? "dual" : "single";
      try {
        localStorage.setItem(HYMN_LAYOUT_STORAGE_KEY, layout);
      } catch (_e) { /* ignore */ }
      document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
        el.checked = el.value === layout;
      });
      if (songPreviewState) refreshSongPreviewPanel();
    }

    function initHymnLyricsLayoutUi() {
      const saved = localStorage.getItem(HYMN_LAYOUT_STORAGE_KEY);
      if (saved === "dual" || saved === "single") {
        applyHymnLyricsLayout(saved);
      }
      document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
        el.addEventListener("change", () => {
          const v = document.querySelector('input[name="flow-hymn-layout"]:checked');
          if (v) applyHymnLyricsLayout(v.value);
        });
      });
    }
    var SLOT_TO_HYMN_SECTION = {
      entrance: "entrance",
      offertory: "offertory",
      communion_1: "communion",
      communion_2: "communion",
      communion_3: "communion",
      communion_4: "communion",
      communion_5: "communion",
      recessional: "recessional",
    };
    var hymnTypographyBySection = {};
    var hymnLyricOverrides = {};
    var HYMN_LYRIC_OV_KEY = "churchMediaHymnLyricOverrides";
    var HYMN_SLIDE_PLAN_KEY = "churchMediaHymnSlidePlan";
    var HYMN_SONG_LAYOUT_KEY = "churchMediaHymnSongLayoutDefaults";
    var hymnSlidePlans = {};
    var hymnLayoutOverrides = {};
    var hymnSongLayoutDefaults = {};
    var songPreviewState = null;
    var windowLastMassGenerateBody = null;
    var hymnSlidePreviewDirty = false;
    var hymnPreviewBaselineSignature = "";

    function resetHymnSlidePlansSession() {
      hymnSlidePlans = {};
      hymnLyricOverrides = {};
      hymnLayoutOverrides = {};
      hymnSlidePreviewDirty = false;
      hymnPreviewBaselineSignature = "";
      try {
        localStorage.removeItem(HYMN_SLIDE_PLAN_KEY);
        localStorage.removeItem(HYMN_LYRIC_OV_KEY);
      } catch (_e) { /* ignore */ }
    }

    function markHymnSlidePreviewDirty() {
      hymnSlidePreviewDirty = true;
    }

    function hymnPreviewPayloadSignature() {
      return JSON.stringify({
        plans: hymnSlidePlans,
        overrides: buildHymnLyricOverridesPayload(),
        layouts: hymnLayoutOverrides,
      });
    }

    function hymnPreviewHasPendingChanges() {
      if (hymnSlidePreviewDirty) return true;
      const sig = hymnPreviewPayloadSignature();
      return !!(hymnPreviewBaselineSignature && sig !== hymnPreviewBaselineSignature);
    }

    function commitHymnPreviewBaseline() {
      hymnSlidePreviewDirty = false;
      hymnPreviewBaselineSignature = hymnPreviewPayloadSignature();
    }

    function loadHymnLyricOverridesStore() {
      try {
        hymnLyricOverrides = JSON.parse(localStorage.getItem(HYMN_LYRIC_OV_KEY) || "{}") || {};
      } catch (_e) {
        hymnLyricOverrides = {};
      }
    }
    resetHymnSlidePlansSession();

    function hymnSlidePlanKey(section, songId) {
      return (section || "").toLowerCase() + "|" + String(songId || "").trim();
    }

    function defaultHymnSlidePlan(chunkCount) {
      return {
        order: Array.from({ length: chunkCount }, (_, i) => i),
        disabled: [],
        chunks: [],
      };
    }

    function normalizeHymnSlidePlan(plan, chunks) {
      const n = chunks.length;
      const base = plan && typeof plan === "object" ? plan : {};
      let order = Array.isArray(base.order) ? base.order.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x)) : [];
      order = order.filter((i) => i >= 0 && i < n);
      const seen = new Set();
      order = order.filter((i) => {
        if (seen.has(i)) return false;
        seen.add(i);
        return true;
      });
      for (let i = 0; i < n; i++) {
        if (!seen.has(i)) order.push(i);
      }
      const disabled = Array.isArray(base.disabled)
        ? base.disabled.map((x) => parseInt(x, 10)).filter((i) => !Number.isNaN(i) && i >= 0 && i < n)
        : [];
      return {
        order: order,
        disabled: Array.from(new Set(disabled)),
        chunks: chunks.slice(),
      };
    }

    function getHymnSlidePlan(section, songId, chunks) {
      const key = hymnSlidePlanKey(section, songId);
      const stored = hymnSlidePlans[key];
      const plan = normalizeHymnSlidePlan(stored, chunks);
      hymnSlidePlans[key] = plan;
      return plan;
    }

    function slidePlanIsCustom(plan, chunkCount) {
      if (!plan || chunkCount < 1) return false;
      if (plan.disabled && plan.disabled.length) return true;
      const def = Array.from({ length: chunkCount }, (_, i) => i);
      const order = plan.order || def;
      if (order.length !== chunkCount) return true;
      return order.some((v, i) => v !== def[i]);
    }

    function isChunkDisabled(plan, chunkIdx) {
      return (plan.disabled || []).indexOf(chunkIdx) >= 0;
    }

    function slideChunkSummary(chunk, chunkIndex) {
      const lines = chunk.split("\n").map((ln) => ln.trim()).filter(Boolean);
      const head = lines[0] || ("Block " + (chunkIndex + 1));
      return head.length > 52 ? head.slice(0, 49) + "…" : head;
    }

    function buildLyricsFromSlidePlan(chunks, plan) {
      const source = (plan && plan.chunks && plan.chunks.length === chunks.length) ? plan.chunks : chunks;
      const order = (plan && plan.order) || source.map((_, i) => i);
      const disabled = new Set(plan && plan.disabled ? plan.disabled : []);
      const parts = [];
      order.forEach((idx) => {
        if (disabled.has(idx)) return;
        const text = (source[idx] || "").trim();
        if (text) parts.push(text);
      });
      return parts.join("\n\n");
    }

    function countEnabledSlides(plan, chunkCount) {
      const disabled = new Set(plan && plan.disabled ? plan.disabled : []);
      const order = (plan && plan.order) || Array.from({ length: chunkCount }, (_, i) => i);
      return order.filter((idx) => !disabled.has(idx)).length;
    }

    function countDualPreviewSlides(plan, chunks) {
      const items = enabledChunkItems(chunks, plan);
      return pairChunksForDualPreview(items).length;
    }

    function pairChunksForDualPreview(items) {
      const slides = [];
      let i = 0;
      const n = items.length;
      while (i < n) {
        if (countBlockLines(items[i].chunk) > HYMN_DUAL_SOLO_PARAGRAPH_THRESHOLD) {
          slides.push([items[i]]);
          i += 1;
          continue;
        }
        if (
          i + 1 < n
          && countBlockLines(items[i + 1].chunk) <= HYMN_DUAL_SOLO_PARAGRAPH_THRESHOLD
        ) {
          slides.push([items[i], items[i + 1]]);
          i += 2;
        } else {
          slides.push([items[i]]);
          i += 1;
        }
      }
      return slides;
    }

    function enabledChunkItems(chunks, plan) {
      const order = (plan && plan.order) || chunks.map((_, i) => i);
      const disabled = new Set(plan && plan.disabled ? plan.disabled : []);
      return order
        .filter((idx) => !disabled.has(idx))
        .map((idx) => ({
          chunkIdx: idx,
          chunk: chunks[idx] || "",
          kind: inferHymnChunkBlockKind(chunks[idx] || ""),
        }));
    }

    function renderSongSlideLayoutToggle(layout) {
      const current = layout === "dual" ? "dual" : "single";
      const isDefault = songPreviewState
        ? !!songLayoutDefaultFor(songPreviewState.section, songPreviewState.songId)
        : false;
      return (
        "<div class=\"song-slide-plan__layout\" role=\"radiogroup\" aria-label=\"Verses per slide\">" +
          "<span class=\"song-slide-plan__layout-label\">Layout</span>" +
          "<label><input type=\"radio\" name=\"song-preview-hymn-layout\" value=\"single\"" + (current === "single" ? " checked" : "") + " /> 1 / slide</label>" +
          "<label><input type=\"radio\" name=\"song-preview-hymn-layout\" value=\"dual\"" + (current === "dual" ? " checked" : "") + " /> 2 / slide</label>" +
          "<label class=\"song-slide-plan__layout-default\" title=\"Remember this layout as the default for this song\"><input type=\"checkbox\" id=\"song-preview-hymn-layout-default\"" + (isDefault ? " checked" : "") + " /> Set as default for this song</label>" +
        "</div>"
      );
    }

    function shouldApplySlidePlanOverride(libraryLyrics, merged, plan, chunkCount) {
      const mergedTrim = (merged || "").trim();
      if (!mergedTrim) return false;
      if (slidePlanIsCustom(plan, chunkCount)) return true;
      return lyricsOverrideIsUsable(libraryLyrics, merged);
    }

    function syncSlidePlanToOverrides() {
      if (!songPreviewState) return;
      refreshPreviewChunksFromLibrary();
      const { section, songId, chunks, plan } = songPreviewState;
      if (!section || !songId || !chunks || !plan) return;
      const library = (songPreviewState.libraryLyrics || "").trim();
      plan.chunks = chunks.slice();
      hymnSlidePlans[hymnSlidePlanKey(section, songId)] = plan;
      const merged = buildLyricsFromSlidePlan(chunks, plan);
      if (!merged) return;
      if (!library || shouldApplySlidePlanOverride(library, merged, plan, chunks.length)) {
        setHymnLyricOverride(section, songId, merged);
      }
    }

    function saveHymnLyricOverridesStore() {
      try {
        localStorage.setItem(HYMN_LYRIC_OV_KEY, JSON.stringify(hymnLyricOverrides));
      } catch (_e) { /* ignore */ }
    }

    function setHymnLyricOverride(section, songId, lyricsText) {
      const sec = (section || "").toLowerCase();
      const id = String(songId || "").trim();
      if (!sec || !id) return;
      if (!hymnLyricOverrides[sec]) hymnLyricOverrides[sec] = {};
      hymnLyricOverrides[sec][id] = lyricsText;
      saveHymnLyricOverridesStore();
    }

    /** Reject flattened/partial preview overrides (keep library verse blocks). */
    function lyricsOverrideIsUsable(libraryLyrics, override) {
      const lib = (libraryLyrics || "").trim();
      const ov = (override || "").trim();
      if (!lib || !ov) return true;
      const libSecs = parseLyricsSectionsForPreview(lib);
      const ovSecs = parseLyricsSectionsForPreview(ov);
      if (libSecs.length >= 2 && ovSecs.length < libSecs.length) return false;
      const libLines = lib.split(/\n/).map((s) => s.trim()).filter(Boolean);
      const ovLines = ov.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (ovLines.length < libLines.length) return false;
      const libMax = libLines.reduce((m, ln) => Math.max(m, ln.length), 0);
      const ovMax = ovLines.reduce((m, ln) => Math.max(m, ln.length), 0);
      if (libSecs.length >= 2 && ovMax > Math.max(libMax * 2, 72)) return false;
      return true;
    }

    async function ensureLyricsCachedForSelectedSongs() {
      const songs = selectedSongsForGenerate();
      const tasks = [];
      Object.keys(songs).forEach((slot) => {
        const id = songs[slot];
        if (!id) return;
        const sec = SLOT_TO_HYMN_SECTION[slot] || slot;
        const cacheKey = sec + "|" + id;
        if (massSongLyricsCache.has(cacheKey)) return;
        tasks.push(
          fetch("/api/catalog/songs/" + encodeURIComponent(sec) + "/" + encodeURIComponent(id))
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              const lyrics = data && data.song && data.song.lyrics ? String(data.song.lyrics) : "";
              if (lyrics.trim()) massSongLyricsCache.set(cacheKey, lyrics);
            })
            .catch(() => {})
        );
      });
      if (tasks.length) await Promise.all(tasks);
    }

    function buildHymnLyricOverridesPayload() {
      const out = {};
      Object.keys(hymnSlidePlans).forEach((key) => {
        const plan = hymnSlidePlans[key];
        const pipe = key.indexOf("|");
        if (pipe < 0) return;
        const sec = key.slice(0, pipe);
        const id = key.slice(pipe + 1);
        const lib = (massSongLyricsCache.get(sec + "|" + id) || "").trim();
        const chunks = lib
          ? chunkLyricsForPreview(lib, 6)
          : (plan && plan.chunks ? plan.chunks.slice() : []);
        if (!chunks.length) return;
        const normalized = normalizeHymnSlidePlan(plan, chunks);
        if (!slidePlanIsCustom(normalized, chunks.length)) return;
        const merged = buildLyricsFromSlidePlan(chunks, normalized);
        if (!merged) return;
        if (!shouldApplySlidePlanOverride(lib || chunks.join("\n\n"), merged, normalized, chunks.length)) return;
        if (!out[sec]) out[sec] = {};
        out[sec][id] = merged;
      });
      Object.keys(hymnLyricOverrides).forEach((sec) => {
        const block = hymnLyricOverrides[sec] || {};
        const filtered = {};
        Object.keys(block).forEach((id) => {
          if (out[sec] && out[sec][id]) return;
          const ov = block[id];
          const cacheKey = sec + "|" + id;
          const lib = massSongLyricsCache.get(cacheKey) || "";
          if (!lyricsOverrideIsUsable(lib, ov)) return;
          filtered[id] = ov;
        });
        if (Object.keys(filtered).length) {
          if (!out[sec]) out[sec] = {};
          Object.assign(out[sec], filtered);
        }
      });
      return out;
    }

    function buildHymnLayoutOverridesPayload() {
      const globalLayout = readHymnLyricsLayout();
      const out = {};
      const addEntry = (section, id, value) => {
        const sec = (section || "").toLowerCase();
        const sid = String(id || "").trim();
        if (!sec || !sid) return;
        const layout = value === "dual" ? "dual" : "single";
        if (layout === globalLayout) return;
        if (!out[sec]) out[sec] = {};
        out[sec][sid] = layout;
      };
      Object.keys(hymnSongLayoutDefaults).forEach((key) => {
        const pipe = key.indexOf("|");
        if (pipe < 0) return;
        addEntry(key.slice(0, pipe), key.slice(pipe + 1), hymnSongLayoutDefaults[key]);
      });
      Object.keys(hymnLayoutOverrides).forEach((sec) => {
        const block = hymnLayoutOverrides[sec] || {};
        Object.keys(block).forEach((id) => addEntry(sec, id, block[id]));
      });
      return out;
    }

    function loadHymnTypographyStore() {
      try {
        hymnTypographyBySection = JSON.parse(localStorage.getItem(HYMN_TYPO_STORAGE_KEY) || "{}") || {};
      } catch (_e) {
        hymnTypographyBySection = {};
      }
    }
    loadHymnTypographyStore();
    loadHymnSongLayoutDefaults();

    function saveHymnTypographyStore() {
      try {
        localStorage.setItem(HYMN_TYPO_STORAGE_KEY, JSON.stringify(hymnTypographyBySection));
      } catch (_e) { /* ignore */ }
    }

    function normalizeHymnBodyPt(pt) {
      const n = Number(pt);
      if (!Number.isFinite(n) || n <= 56) return 75;
      return Math.min(96, n);
    }

    function defaultHymnTypo() {
      return {
        body_pt: 75,
        title_pt: 38.5,
        title_align: "center",
        body_align: readHymnBodyAlign(),
      };
    }

    function ensureSectionTypoStore(section) {
      const sec = (section || "default").toLowerCase();
      if (!hymnTypographyBySection[sec]) {
        hymnTypographyBySection[sec] = Object.assign(defaultHymnTypo(), { slides: {} });
      }
      const block = hymnTypographyBySection[sec];
      if (!block.slides || typeof block.slides !== "object") block.slides = {};
      return block;
    }

    function getHymnTypoForSection(section) {
      const block = ensureSectionTypoStore(section);
      const base = defaultHymnTypo();
      return {
        body_pt: normalizeHymnBodyPt(block.body_pt || base.body_pt),
        title_pt: Number(block.title_pt) || base.title_pt,
        title_align: block.title_align || base.title_align,
        body_align: normalizeHymnBodyAlign(block.body_align || base.body_align),
      };
    }

    function getHymnTypoForSlide(section, slideIndex) {
      const block = ensureSectionTypoStore(section);
      const base = getHymnTypoForSection(section);
      const key = String(slideIndex);
      const raw = block.slides[key];
      if (!raw) return Object.assign({}, base);
      return {
        body_pt: normalizeHymnBodyPt(raw.body_pt || base.body_pt),
        title_pt: Number(raw.title_pt) || base.title_pt,
        title_align: raw.title_align || base.title_align,
        body_align: normalizeHymnBodyAlign(raw.body_align || base.body_align),
      };
    }

    function setHymnTypoForSlide(section, slideIndex, typo) {
      const block = ensureSectionTypoStore(section);
      block.slides[String(slideIndex)] = {
        body_pt: typo.body_pt,
        title_pt: typo.title_pt,
        title_align: typo.title_align,
        body_align: normalizeHymnBodyAlign(typo.body_align),
      };
      if (slideIndex === 0) {
        block.title_pt = typo.title_pt;
        block.title_align = typo.title_align;
        block.body_pt = typo.body_pt;
        block.body_align = normalizeHymnBodyAlign(typo.body_align);
      }
    }

    function buildHymnTypographyPayload() {
      const globalAlign = readHymnBodyAlign();
      const out = {};
      Object.keys(hymnTypographyBySection).forEach((k) => {
        const block = hymnTypographyBySection[k];
        if (!block || typeof block !== "object") return;
        out[k] = {
          body_pt: normalizeHymnBodyPt(block.body_pt),
          title_pt: block.title_pt,
          title_align: block.title_align,
          body_align: globalAlign,
          slides: overlayAlignOnSlides(block.slides || {}),
        };
      });
      if (!out.default) out.default = Object.assign(defaultHymnTypo(), { slides: {}, body_align: globalAlign });
      return out;
    }

    function overlayAlignOnSlides(slides) {
      const globalAlign = readHymnBodyAlign();
      const next = {};
      Object.keys(slides || {}).forEach((key) => {
        const raw = slides[key];
        if (!raw || typeof raw !== "object") return;
        next[key] = Object.assign({}, raw, { body_align: globalAlign });
      });
      return next;
    }

    var HYMN_PPT_SLIDE_W_PT = 1440;
    var HYMN_PREVIEW_LINE_PITCH = 1.2;
    var HYMN_PREVIEW_LINE_RELAX = 1.22;

    function hymnPreviewCssLineHeight(pptLineSpacing) {
      const base = Number(pptLineSpacing);
      const spacing = Number.isFinite(base) && base > 0 ? base : 0.7;
      return spacing * HYMN_PREVIEW_LINE_PITCH * HYMN_PREVIEW_LINE_RELAX;
    }

    async function fetchHymnSlidePreviewSpec(meta, section, chunks, plan, layout) {
      return postJSON("/api/hymn-slide-preview", {
        hymn_title: (meta && meta.title) || "Hymn",
        section: section || "default",
        layout: layout || "single",
        hymn_typography: buildHymnTypographyPayload(),
        show_section_labels: readHymnSectionLabels(),
        chunks: chunks.map((text) => ({
          text: text || "",
          block_kind: inferHymnChunkBlockKind(text),
        })),
        plan: {
          order: (plan && plan.order) || chunks.map((_, i) => i),
          disabled: (plan && plan.disabled) || [],
        },
      });
    }

    function hymnPreviewPxFromPt(slide, pt, slideWidthPt) {
      const w = slide.clientWidth || slide.getBoundingClientRect().width || 320;
      const base = slideWidthPt || HYMN_PPT_SLIDE_W_PT;
      return (Number(pt) * w) / base;
    }

    function scaleHymnPreviewSlide(slide) {
      const w = slide.clientWidth || slide.getBoundingClientRect().width || 0;
      if (w < 8) return;
      const slideWidthPt = parseFloat(slide.dataset.slideWidthPt) || HYMN_PPT_SLIDE_W_PT;
      const titlePt = parseFloat(slide.dataset.titlePt);
      const lineSpacing = hymnPreviewCssLineHeight(slide.dataset.lineSpacing);
      slide.style.setProperty("--hymn-line-spacing", lineSpacing.toFixed(3));
      if (titlePt) {
        slide.style.setProperty(
          "--hymn-title-size",
          hymnPreviewPxFromPt(slide, titlePt, slideWidthPt) + "px"
        );
      }
      slide.querySelectorAll(".hymn-lines[data-body-pt]").forEach((linesEl) => {
        const bodyPt = parseFloat(linesEl.dataset.bodyPt) || 75;
        linesEl.style.setProperty(
          "--hymn-body-size",
          hymnPreviewPxFromPt(slide, bodyPt, slideWidthPt) + "px"
        );
        const labelPt = parseFloat(linesEl.dataset.labelPt);
        if (labelPt) {
          linesEl.style.setProperty(
            "--hymn-label-size",
            hymnPreviewPxFromPt(slide, labelPt, slideWidthPt) + "px"
          );
        }
      });
    }

    function scaleHymnPreviewSlides(root) {
      const scope = root && root.querySelectorAll ? root : document;
      scope.querySelectorAll(".slide-preview.hymn-slide[data-hymn-slide=\"1\"]").forEach(scaleHymnPreviewSlide);
    }

    var hymnPreviewScaleQueued = false;
    var hymnPreviewScaleObserver = null;

    function scheduleHymnPreviewScale(root) {
      if (hymnPreviewScaleQueued) return;
      hymnPreviewScaleQueued = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          hymnPreviewScaleQueued = false;
          scaleHymnPreviewSlides(root || $("song-ppt-slides-scroll"));
        });
      });
    }

    function bindHymnPreviewScale() {
      const scroller = $("song-ppt-slides-scroll");
      if (!scroller) return;
      scheduleHymnPreviewScale(scroller);
      setTimeout(() => scheduleHymnPreviewScale(scroller), 480);
      if (hymnPreviewScaleObserver) hymnPreviewScaleObserver.disconnect();
      hymnPreviewScaleObserver = new ResizeObserver(() => scheduleHymnPreviewScale(scroller));
      hymnPreviewScaleObserver.observe(scroller);
      scroller.querySelectorAll(".slide-preview.hymn-slide").forEach((slide) => {
        hymnPreviewScaleObserver.observe(slide);
      });
    }

    function inferHymnChunkBlockKind(chunk) {
      const lines = (chunk || "").split("\n").map((ln) => ln.trim()).filter(Boolean);
      if (!lines.length) return "verse";
      const head = lines[0];
      if (/^\[?\s*(pre[- ]?chorus)(\s|\]|$|:)/i.test(head)) return "pre-chorus";
      if (/^\[?\s*refrain(\s|\]|$|:)/i.test(head) || /^refrain\s*:/i.test(head)) return "refrain";
      if (/^\[?\s*chorus(\s|\]|$|:)/i.test(head) || /^chorus\s*:/i.test(head)) return "chorus";
      if (/^\[?\s*(outro|ending|finale)(\s|\]|$|:)/i.test(head)) return "outro";
      return "verse";
    }

    async function flushMassSongSlidePlansForGenerate() {
      if (songPreviewState) syncSlidePlanToOverrides();
      await ensureLyricsCachedForSelectedSongs();
      const songs = selectedSongsForGenerate();
      Object.keys(songs).forEach((slot) => {
        const id = songs[slot];
        if (!id) return;
        const sec = (SLOT_TO_HYMN_SECTION[slot] || slot).toLowerCase();
        const lib = (massSongLyricsCache.get(sec + "|" + id) || "").trim();
        if (!lib) return;
        const chunks = chunkLyricsForPreview(lib, 6);
        const key = hymnSlidePlanKey(sec, id);
        const plan = normalizeHymnSlidePlan(hymnSlidePlans[key], chunks);
        hymnSlidePlans[key] = plan;
        if (slidePlanIsCustom(plan, chunks.length)) {
          const merged = buildLyricsFromSlidePlan(chunks, plan);
          if (merged && shouldApplySlidePlanOverride(lib, merged, plan, chunks.length)) {
            setHymnLyricOverride(sec, id, merged);
          }
        }
      });
    }

    async function confirmHymnPreviewChangesBeforeGenerate() {
      await flushMassSongSlidePlansForGenerate();
      if (!hymnPreviewHasPendingChanges()) return true;
      const msg =
        "Song slide preview has changes (slide order or slides turned off). " +
        "These will be applied to the PowerPoint you are about to generate.";
      notify(msg, "warn");
      return window.confirm(msg + "\n\nContinue generating?");
    }

    function alignSelectOptions(val) {
      return ["left", "center", "right"].map((a) => (
        "<option value=\"" + a + "\"" + (a === val ? " selected" : "") + ">" + a + "</option>"
      )).join("");
    }

    function renderSongSlidePlanEditor(plan, chunks, layout) {
      const enabled = countEnabledSlides(plan, chunks.length);
      const layoutMode = layout === "dual" ? "dual" : "single";
      const previewSlides = layoutMode === "dual" ? countDualPreviewSlides(plan, chunks) : enabled;
      const countLabel = layoutMode === "dual"
        ? previewSlides + " preview slides · " + enabled + " blocks in deck"
        : enabled + " of " + chunks.length + " in deck";
      const rows = plan.order.map((chunkIdx, pos) => {
        const off = isChunkDisabled(plan, chunkIdx);
        const label = slideChunkSummary(chunks[chunkIdx] || "", chunkIdx);
        return (
          "<li class=\"song-slide-plan__item" + (off ? " is-off" : "") + "\" data-plan-pos=\"" + pos + "\" data-chunk-idx=\"" + chunkIdx + "\" role=\"listitem\">" +
            "<span class=\"song-slide-plan__num\" aria-hidden=\"true\">" + (pos + 1) + "</span>" +
            "<button type=\"button\" class=\"song-slide-plan__summary song-slide-plan-jump\" data-plan-pos=\"" + pos + "\" title=\"Show in preview\">" +
              "<span class=\"song-slide-plan__summary-label\">Slide " + (pos + 1) + "</span>" +
              "<span class=\"song-slide-plan__summary-text\">" + escapeHtml(label) + "</span>" +
            "</button>" +
            "<button type=\"button\" class=\"song-slide-plan__toggle\" data-chunk-idx=\"" + chunkIdx + "\" aria-pressed=\"" + (!off) + "\" title=\"" + (off ? "Include in deck" : "Omit from deck") + "\">" + (off ? "Off" : "In deck") + "</button>" +
            "<div class=\"song-slide-plan__moves\">" +
              "<button type=\"button\" class=\"song-slide-plan-up\" data-plan-pos=\"" + pos + "\" title=\"Move up\"" + (pos === 0 ? " disabled" : "") + " aria-label=\"Move slide up\">↑</button>" +
              "<button type=\"button\" class=\"song-slide-plan-down\" data-plan-pos=\"" + pos + "\" title=\"Move down\"" + (pos >= plan.order.length - 1 ? " disabled" : "") + " aria-label=\"Move slide down\">↓</button>" +
            "</div>" +
          "</li>"
        );
      }).join("");
      return (
        "<div class=\"song-slide-plan\" id=\"song-slide-plan\">" +
          "<div class=\"song-slide-plan__head\">" +
            "<span class=\"song-slide-plan__head-title\">Slide organizer</span>" +
            "<span class=\"song-slide-plan__head-hint\">Reorder with arrows. Toggle off blocks you do not need.</span>" +
            renderSongSlideLayoutToggle(layoutMode) +
            "<span id=\"song-slide-plan-count\">" + countLabel + "</span>" +
          "</div>" +
          "<ul class=\"song-slide-plan__list\" role=\"list\">" + rows + "</ul>" +
        "</div>"
      );
    }

    function refreshPreviewChunksFromLibrary() {
      if (!songPreviewState) return;
      const library = (songPreviewState.libraryLyrics || songPreviewState.lyricsText || "").trim();
      if (!library) return;
      const chunks = chunkLyricsForPreview(library, 6);
      const plan = normalizeHymnSlidePlan(songPreviewState.plan, chunks);
      songPreviewState.libraryLyrics = library;
      songPreviewState.lyricsText = library;
      songPreviewState.chunks = chunks;
      songPreviewState.plan = plan;
      hymnSlidePlans[hymnSlidePlanKey(songPreviewState.section, songPreviewState.songId)] = plan;
    }

    async function refreshSongPreviewPanel() {
      if (!songPreviewState) return;
      const body = $("song-preview-body");
      if (!body) return;
      refreshPreviewChunksFromLibrary();
      const { meta, section, songId, chunks, plan } = songPreviewState;
      const layout = getSongLayout(section, songId);
      body.innerHTML = "<p class=\"muted\">Updating slide preview…</p>";
      try {
        const spec = await fetchHymnSlidePreviewSpec(meta, section, chunks, plan, layout);
        songPreviewState.previewSpec = spec;
        body.innerHTML = renderSongPreviewViewer(null, meta, section, songId, chunks, plan, spec);
        bindSongSlidePlanEditor(section);
        bindSongPreviewLayoutToggle();
        bindSongPreviewSlideScroll();
        bindHymnPreviewScale();
      } catch (err) {
        body.innerHTML = "<p class=\"status error\">" + escapeHtml(err.message || "Preview failed") + "</p>";
      }
    }

    function previewSlideIndexForChunk(chunkIdx, chunks, plan, layout) {
      if (layout !== "dual") {
        const order = (plan && plan.order) || chunks.map((_, i) => i);
        const pos = order.indexOf(chunkIdx);
        return pos >= 0 ? pos : 0;
      }
      const groups = pairChunksForDualPreview(enabledChunkItems(chunks, plan));
      for (let si = 0; si < groups.length; si++) {
        if (groups[si].some((item) => item.chunkIdx === chunkIdx)) return si;
      }
      return 0;
    }

    function bindSongPreviewLayoutToggle() {
      const defaultCb = $("song-preview-hymn-layout-default");
      const applyLayoutChoice = (value) => {
        if (!songPreviewState) return;
        setSongLayoutOverride(songPreviewState.section, songPreviewState.songId, value);
        if (defaultCb && defaultCb.checked) {
          setSongLayoutDefault(songPreviewState.section, songPreviewState.songId, value);
        }
        markHymnSlidePreviewDirty();
        refreshSongPreviewPanel();
      };
      document.querySelectorAll('input[name="song-preview-hymn-layout"]').forEach((el) => {
        el.addEventListener("change", () => {
          const v = document.querySelector('input[name="song-preview-hymn-layout"]:checked');
          if (v) applyLayoutChoice(v.value);
        });
      });
      if (defaultCb) {
        defaultCb.addEventListener("change", () => {
          if (!songPreviewState) return;
          const v = document.querySelector('input[name="song-preview-hymn-layout"]:checked');
          const value = v ? v.value : getSongLayout(songPreviewState.section, songPreviewState.songId);
          if (defaultCb.checked) {
            setSongLayoutOverride(songPreviewState.section, songPreviewState.songId, value);
            setSongLayoutDefault(songPreviewState.section, songPreviewState.songId, value);
          } else {
            clearSongLayoutDefault(songPreviewState.section, songPreviewState.songId);
          }
          markHymnSlidePreviewDirty();
        });
      }
    }

    function bindSongSlidePlanEditor(section) {
      const planEl = $("song-slide-plan");
      if (!planEl || !songPreviewState) return;
      const plan = songPreviewState.plan;
      const chunks = songPreviewState.chunks;

      const movePlan = (pos, delta) => {
        const next = pos + delta;
        if (next < 0 || next >= plan.order.length) return;
        const o = plan.order.slice();
        const tmp = o[pos];
        o[pos] = o[next];
        o[next] = tmp;
        plan.order = o;
        markHymnSlidePreviewDirty();
        refreshSongPreviewPanel();
        syncSlidePlanToOverrides();
      };

      planEl.querySelectorAll(".song-slide-plan-up").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePlan(parseInt(btn.dataset.planPos, 10) || 0, -1);
        });
      });
      planEl.querySelectorAll(".song-slide-plan-down").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePlan(parseInt(btn.dataset.planPos, 10) || 0, 1);
        });
      });
      const toggleSlideInDeck = (chunkIdx) => {
        const disabled = new Set(songPreviewState.plan.disabled || []);
        if (disabled.has(chunkIdx)) {
          disabled.delete(chunkIdx);
        } else {
          disabled.add(chunkIdx);
          if (countEnabledSlides({ order: songPreviewState.plan.order, disabled: Array.from(disabled) }, chunks.length) < 1) {
            return;
          }
        }
        songPreviewState.plan.disabled = Array.from(disabled);
        markHymnSlidePreviewDirty();
        refreshSongPreviewPanel();
        syncSlidePlanToOverrides();
      };

      planEl.querySelectorAll(".song-slide-plan__toggle").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSlideInDeck(parseInt(btn.dataset.chunkIdx, 10));
        });
      });

      const scrollToPlanSlide = (pos) => {
        const scroller = $("song-ppt-slides-scroll");
        if (!scroller) return;
        const layout = getSongLayout(songPreviewState.section, songPreviewState.songId);
        const chunkIdx = parseInt(plan.order[pos], 10);
        const slideIndex = previewSlideIndexForChunk(chunkIdx, chunks, plan, layout);
        const wrap = scroller.querySelector(".hymn-slide-wrap[data-slide-index=\"" + slideIndex + "\"]");
        if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };

      planEl.querySelectorAll(".song-slide-plan-jump").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          scrollToPlanSlide(parseInt(btn.dataset.planPos, 10) || 0);
        });
      });

      planEl.querySelectorAll(".song-slide-plan__item").forEach((item) => {
        item.addEventListener("click", (e) => {
          if (e.target.closest(".song-slide-plan__toggle, .song-slide-plan-up, .song-slide-plan-down, .song-slide-plan-jump")) return;
          scrollToPlanSlide(parseInt(item.dataset.planPos, 10) || 0);
        });
      });
    }

    async function saveSongPreviewToPptx(section) {
      const statusEl = $("song-preview-save-status");
      syncSlidePlanToOverrides();
      if (!windowLastMassGenerateBody) {
        if (statusEl) {
          statusEl.textContent = "Generate the Mass package first, then Save will update the .pptx.";
          statusEl.className = "status error";
        }
        return;
      }
      if (statusEl) {
        statusEl.textContent = "Updating PowerPoint…";
        statusEl.className = "status";
      }
      const body = Object.assign({}, windowLastMassGenerateBody, {
        hymn_typography: buildHymnTypographyPayload(),
        hymn_lyric_overrides: buildHymnLyricOverridesPayload(),
      });
      const videoReplacements = buildVideoReplacementsPayload();
      if (videoReplacements) body.video_replacements = videoReplacements;
      else delete body.video_replacements;
      try {
        const data = await postJSON("/api/regenerate-pptx", body);
        if (statusEl) {
          statusEl.textContent = "Saved — " + (data.slide_count || "?") + " slides in PowerPoint.";
          statusEl.className = "status ok";
        }
        if (data.pptx_url) {
          const dl = $("dl-pptx");
          if (dl) {
            dl.href = data.pptx_url;
            dl.style.display = "";
          }
        }
        notify("PowerPoint updated with slide plan.", "ok");
        commitHymnPreviewBaseline();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Save failed.";
          statusEl.className = "status error";
        }
      }
    }

    var MASS_SONG_PLAN_DRAG_SVG =
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\">" +
        "<circle cx=\"9\" cy=\"7\" r=\"1.25\"/><circle cx=\"15\" cy=\"7\" r=\"1.25\"/>" +
        "<circle cx=\"9\" cy=\"12\" r=\"1.25\"/><circle cx=\"15\" cy=\"12\" r=\"1.25\"/>" +
        "<circle cx=\"9\" cy=\"17\" r=\"1.25\"/><circle cx=\"15\" cy=\"17\" r=\"1.25\"/>" +
      "</svg>";
    var MASS_SONG_PLAN_TRASH_SVG =
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">" +
        "<path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/>" +
      "</svg>";

    function massSongPreviewButtonHtml(slotKey) {
      return (
        "<button type=\"button\" class=\"mass-song-audio-btn\" data-mass-song-audio=\"" +
          escapeHtml(slotKey) + "\" aria-label=\"Play audio preview\" title=\"Play audio preview\" disabled>▶</button>"
      );
    }

    function massSongClearButtonHtml(slotKey) {
      return (
        "<button type=\"button\" class=\"mass-song-plan-card__clear-x mass-song-clear\" data-mass-song-clear=\"" +
          escapeHtml(slotKey) + "\" hidden aria-label=\"Clear song\" title=\"Clear song\">×</button>"
      );
    }

    function massSongTitleWrapHtml(slotKey) {
      return (
        "<div class=\"mass-song-plan-card__title-wrap\">" +
          "<span class=\"mass-song-plan-card__title-picked\">" +
            "<strong class=\"mass-song-plan-card__title is-empty\" id=\"mass-song-picked-" + escapeHtml(slotKey) + "\">Choose a song</strong>" +
            massSongClearButtonHtml(slotKey) +
          "</span>" +
        "</div>"
      );
    }

    function updateMassSongAddButton() {
      const atMax = lyricSongSlots.length >= MASS_SONG_PLAN_MAX_SECTIONS;
      ["mass-song-add-custom", "practice-share-add-section"].forEach((id) => {
        const addBtn = $(id);
        if (addBtn) addBtn.hidden = atMax;
      });
    }

    function massSongSlotPartHtml(slot) {
      if (slot.custom) {
        return (
          "<input type=\"text\" class=\"mass-song-plan-card__part-input\" data-custom-label=\"" + escapeHtml(slot.key) + "\" " +
            "value=\"" + escapeHtml(slot.label || "") + "\" maxlength=\"80\" " +
            "placeholder=\"Section name\" aria-label=\"Section name\" />"
        );
      }
      return "<span class=\"mass-song-plan-card__part\">" + escapeHtml(massSongSlotShortLabel(slot.key, slot.label)) + "</span>";
    }

    function massSongDeleteSectionButtonHtml(slot) {
      const name = (slot.label || "").trim() || "section";
      return (
        "<button type=\"button\" class=\"mass-song-plan-card__btn mass-song-plan-card__btn--delete mass-song-delete-section\" " +
          "data-mass-song-delete=\"" + escapeHtml(slot.key) + "\" aria-label=\"Delete " + escapeHtml(name) + " section\" " +
          "title=\"Delete section\">" + MASS_SONG_PLAN_TRASH_SVG + "</button>"
      );
    }

    var _LYRIC_STRUCTURE_HEADER_RE = /^\[?\s*(pre[- ]?chorus|post[- ]?chorus|refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp|outro|ending|finale)(\s*[\w\d]*)?\]?\s*[:.)-]?\s*$/i;

    /** Match backend ``ensure_lyric_section_breaks`` — blank line before Verse/Chorus labels. */
    function ensureLyricSectionBreaks(raw) {
      const text = (raw || "").trim();
      if (!text) return "";
      const out = [];
      text.split("\n").forEach((line) => {
        const stripped = line.trim();
        if (stripped && out.length && out[out.length - 1] !== "" && _LYRIC_STRUCTURE_HEADER_RE.test(stripped)) {
          out.push("");
        }
        out.push(line);
      });
      return out.join("\n").trim();
    }

    /** Match ``powerpoint._chunk_lyrics_display`` — section blocks, then max lines per slide. */
    function parseLyricsSectionsForPreview(raw) {
      const parts = ensureLyricSectionBreaks(raw).split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return [];
      const headerRe = /^\[?\s*(pre[- ]?chorus|post[- ]?chorus|verse|chorus|refrain|stanza|bridge|response|coda|intro|vamp|outro|ending|finale)(\s*[\w\d]*)?\]?\s*[:.)-]?\s*$/i;
      const inlineRe = /^(pre[- ]?chorus|post[- ]?chorus|refrain|verse|chorus|bridge|response|stanza|coda|intro|vamp|outro|ending|finale)\s*:\s*(.*)$/i;
      const sections = [];
      parts.forEach((chunk) => {
        const lines = chunk.split(/\n/).map((ln) => ln.trim()).filter(Boolean);
        if (!lines.length) return;
        const first = lines[0];
        let bodyLines;
        if (headerRe.test(first)) {
          bodyLines = lines.slice(1);
        } else {
          const inline = inlineRe.exec(first);
          if (inline) {
            const rest = (inline[2] || "").trim();
            bodyLines = (rest ? [rest] : []).concat(lines.slice(1));
          } else {
            bodyLines = lines;
          }
        }
        const body = bodyLines.join("\n").trim();
        if (body) sections.push(body);
      });
      return sections.length ? sections : [(raw || "").trim()];
    }

    function chunkLyricsForPreview(text, maxLines) {
      const max = maxLines || 6;
      const t = ensureLyricSectionBreaks((text || "").trim());
      if (!t) return [];
      const sections = parseLyricsSectionsForPreview(t);
      const blocks = [];
      sections.forEach((section) => {
        const lines = section.split(/\n/).filter((ln) => ln.trim());
        if (!lines.length) {
          blocks.push(section);
          return;
        }
        if (lines.length > HYMN_DUAL_SOLO_PARAGRAPH_THRESHOLD) {
          blocks.push(section);
          return;
        }
        if (lines.length <= max) {
          blocks.push(section);
          return;
        }
        for (let i = 0; i < lines.length; i += max) {
          blocks.push(lines.slice(i, i + max).join("\n"));
        }
      });
      return blocks.length ? blocks : [t];
    }

    function hymnBodySizeClass(chunk) {
      const lines = chunk.split("\n").filter((ln) => ln.trim());
      const longest = lines.reduce((m, ln) => Math.max(m, ln.trim().length), 0);
      if (lines.length >= 3 || longest >= 40) return " lines-long";
      if (lines.length >= 2 || longest >= 28) return " lines-many";
      return "";
    }

    function formatHymnBracketedLine(line) {
      const upper = (line || "").toUpperCase();
      const re = /\([^)]*\)/g;
      let last = 0;
      let match;
      let html = "";
      while ((match = re.exec(upper)) !== null) {
        if (match.index > last) {
          html += escapeHtml(upper.slice(last, match.index));
        }
        html += '<span class="hymn-paren">' + escapeHtml(match[0]) + "</span>";
        last = match.index + match[0].length;
      }
      if (last < upper.length) {
        html += escapeHtml(upper.slice(last));
      }
      return html || escapeHtml(upper);
    }

    function formatHymnLinesHtml(lines) {
      if (!lines || !lines.length) return "";
      return lines.map((ln) => formatHymnBracketedLine(ln)).join("<br>");
    }

    function formatHymnBodyHtml(chunk) {
      const lines = chunk.split("\n").map((ln) => ln.trim()).filter(Boolean);
      if (!lines.length) return formatHymnBracketedLine((chunk || "").trim());
      return formatHymnLinesHtml(lines);
    }

    function updateMassSongPreviewButton(slotKey) {
      document.querySelectorAll(".mass-song-audio-btn[data-mass-song-audio=\"" + slotKey + "\"]").forEach((btn) => {
        const hasAudio = !!massSlotAudioSnippetRef(slotKey);
        const playing = massSectionAudioPlayingSlot === slotKey;
        btn.disabled = !hasAudio;
        btn.classList.toggle("is-ready", hasAudio);
        btn.classList.toggle("is-playing", playing);
        btn.textContent = playing ? "❚❚" : "▶";
        btn.title = playing
          ? "Stop audio clip"
          : (hasAudio ? "Play 5–10s chorus preview" : "Link an audio clip via the song title first");
        btn.setAttribute("aria-label", playing ? "Stop audio clip" : "Play audio clip");
        btn.setAttribute("aria-disabled", hasAudio ? "false" : "true");
      });
    }

    function openMassSlotAudioLinkFromTitle(slotKey) {
      const key = String(slotKey || "").trim();
      if (!key) return;
      if (!(selectedLyricsSongs && selectedLyricsSongs[key])) {
        if (typeof notify === "function") notify("Choose a song first.", "warn");
        return;
      }
      openMassMediaPickModal("audio", key, { fromTitle: true });
    }

    function resolveMassSongSection(slotKey, row) {
      if (row && row.section) return row.section;
      const slot = lyricSongSlots.find((s) => s.key === slotKey);
      return slot ? slot.section : "entrance";
    }

    function buildHymnSlideHtmlFromSpec(slideSpec, meta, displayPos, spec) {
      const disabled = !!slideSpec.disabled;
      const wrapCls = disabled ? " hymn-slide-wrap--off" : "";
      const chunkIdxAttr = (slideSpec.chunk_indices || []).join(",");
      const layout = slideSpec.layout === "dual" ? "dual" : "single";
      const slideCls = layout === "dual"
        ? " hymn-slide--dual"
          + (slideSpec.show_title ? " hymn-slide--dual-first" : "")
          + (slideSpec.dual_single ? " hymn-slide--dual-single" : "")
        : "";
      const titleHtml = slideSpec.show_title
        ? "<h4 class=\"hymn-title-text\">" + escapeHtml((meta && meta.title) || spec.hymn_title || "Hymn") + "</h4>"
        : "";
      const blocksHtml = (slideSpec.blocks || []).map((block, bi) => {
        const chorusCls = (block.block_kind === "chorus" || block.is_chorus) ? " hymn-lines--chorus" : "";
        const secondCls = block.italic && bi === 1 ? " hymn-lines--dual-second" : "";
        const posCls = layout === "dual" ? (bi === 0 ? " hymn-body-dual-top" : " hymn-body-dual-bottom") : "";
        const bodyCls = layout === "dual" ? "hymn-body hymn-body-dual-block" + posCls : "hymn-body";
        const align = (block.body_align || "center").toLowerCase();
        const label = (block.section_label || "").trim();
        const labelHtml = label
          ? "<span class=\"hymn-section-label\">" + escapeHtml(label.toLowerCase()) + "</span>"
          : "";
        const labelPtAttr = block.label_pt ? " data-label-pt=\"" + block.label_pt + "\"" : "";
        return (
          "<div class=\"" + bodyCls + "\">" +
            "<div class=\"hymn-lines" + chorusCls + secondCls + "\" data-body-pt=\"" + block.body_pt + "\"" + labelPtAttr + " " +
              "style=\"--hymn-body-align:" + escapeHtml(align) + ";\">" +
              labelHtml +
              formatHymnLinesHtml(block.lines) +
            "</div>" +
          "</div>"
        );
      }).join("");
      const titleAlign = (slideSpec.title_align || "center").toLowerCase();
      return (
        "<div class=\"hymn-slide-wrap" + wrapCls + "\" data-slide-index=\"" + displayPos + "\" data-chunk-idx=\"" + chunkIdxAttr + "\">" +
          "<span class=\"song-preview-slide-label\">Slide " + (displayPos + 1) + "</span>" +
          "<div class=\"slide-preview hymn-slide" + slideCls + "\" data-hymn-slide=\"1\" " +
            "data-slide-width-pt=\"" + spec.slide_width_pt + "\" " +
            "data-title-pt=\"" + slideSpec.title_pt + "\" " +
            "data-line-spacing=\"" + spec.line_spacing + "\" " +
            "style=\"--hymn-title-align:" + escapeHtml(titleAlign) + ";\">" +
            titleHtml +
            blocksHtml +
          "</div>" +
        "</div>"
      );
    }

    function renderSongPreviewViewerFromSpec(spec, meta, section, songId, chunks, plan) {
      if (!spec || !spec.slides || !spec.slides.length) {
        return "<p class=\"muted\">No lyrics to preview.</p>";
      }
      const slidePlan = plan || getHymnSlidePlan(section, songId, chunks);
      const layout = getSongLayout(section, songId);
      const slideHtml = spec.slides.map((slideSpec, pos) => (
        buildHymnSlideHtmlFromSpec(slideSpec, meta, pos, spec)
      )).join("");
      const enabled = countEnabledSlides(slidePlan, chunks.length);
      const previewCount = layout === "dual" ? countDualPreviewSlides(slidePlan, chunks) : enabled;
      const countLabel = layout === "dual"
        ? previewCount + " slides · " + enabled + " blocks"
        : enabled + " of " + chunks.length + " slides in deck";
      return (
        "<div class=\"song-ppt-viewer\">" +
          "<aside class=\"song-ppt-organizer\" aria-label=\"Slide organizer\">" +
            renderSongSlidePlanEditor(slidePlan, chunks, layout) +
          "</aside>" +
          "<div class=\"song-ppt-main\">" +
            "<div class=\"song-ppt-toolbar\">" +
              "<span>Slide preview</span>" +
              "<span id=\"song-ppt-slide-count\">" + escapeHtml(countLabel) + "</span>" +
            "</div>" +
            "<div class=\"song-ppt-stage\">" +
              "<div class=\"song-ppt-slides\" id=\"song-ppt-slides-scroll\">" + slideHtml + "</div>" +
            "</div>" +
            "<div class=\"song-preview-save-row\">" +
              "<button type=\"button\" class=\"uiverse-btn uiverse-btn--orange\" id=\"btn-save-hymn-typo\"><div class=\"button-outer\"><div class=\"button-inner\"><span>Apply to PowerPoint</span></div></div></button>" +
              "<span class=\"muted\" id=\"song-preview-save-status\"></span>" +
            "</div>" +
            "<p class=\"muted\" style=\"font-size:0.78rem;margin:0;\">Preview uses the same lyric fit as PowerPoint, scaled to this panel. Changes apply when you generate or click Apply.</p>" +
          "</div>" +
        "</div>"
      );
    }

    function renderSongPreviewViewer(lyricsText, meta, section, songId, chunks, plan, spec) {
      if (spec) {
        return renderSongPreviewViewerFromSpec(spec, meta, section, songId, chunks, plan);
      }
      return "<p class=\"muted\">Loading slide preview…</p>";
    }

    function bindSongPreviewSlideScroll() {
      const scroller = $("song-ppt-slides-scroll");
      const countEl = $("song-ppt-slide-count");
      const planEl = $("song-slide-plan");
      if (!scroller) return;
      const wraps = scroller.querySelectorAll(".hymn-slide-wrap");
      const total = wraps.length;
      const syncCount = () => {
        let best = 0;
        let bestDist = Infinity;
        const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
        wraps.forEach((wrap, i) => {
          const dist = Math.abs(wrap.offsetTop - mid);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        if (countEl) {
          countEl.textContent = total < 2
            ? (total ? "1 slide" : "0 slides")
            : "Slide " + (best + 1) + " of " + total;
        }
        if (planEl) {
          const activeWrap = wraps[best];
          const layout = songPreviewState
            ? getSongLayout(songPreviewState.section, songPreviewState.songId)
            : readHymnLyricsLayout();
          if (layout === "dual" && activeWrap) {
            const activeChunks = String(activeWrap.dataset.chunkIdx || "")
              .split(",")
              .map((s) => parseInt(s, 10))
              .filter((n) => !Number.isNaN(n));
            planEl.querySelectorAll(".song-slide-plan__item").forEach((li) => {
              const chunkIdx = parseInt(li.dataset.chunkIdx, 10);
              li.classList.toggle("is-active", activeChunks.indexOf(chunkIdx) >= 0);
            });
          } else {
          planEl.querySelectorAll(".song-slide-plan__item").forEach((li, i) => {
            li.classList.toggle("is-active", i === best);
          });
          }
        }
      };
      scroller.addEventListener("scroll", syncCount, { passive: true });
      syncCount();
    }

    function closeSongPreviewPanel() {
      if (songPreviewState) {
        syncSlidePlanToOverrides();
        if (slidePlanIsCustom(songPreviewState.plan, songPreviewState.chunks.length)) {
          markHymnSlidePreviewDirty();
        }
      }
      const panel = $("song-preview-panel");
      if (!panel || !panel.classList.contains("visible")) return;
      if (panel.classList.contains("closing")) return;
      const sheet = panel.querySelector(".song-preview-panel__sheet");
      panel.classList.add("closing");
      panel.classList.remove("visible");
      const finish = () => {
        panel.classList.remove("closing");
        panel.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (sheet) sheet.removeEventListener("transitionend", onEnd);
      };
      const onEnd = (e) => {
        if (e.target !== sheet || e.propertyName !== "transform") return;
        finish();
      };
      if (sheet) sheet.addEventListener("transitionend", onEnd);
      setTimeout(finish, 420);
    }

    function openSongPreviewPanel() {
      const panel = $("song-preview-panel");
      if (!panel) return;
      panel.classList.remove("closing");
      panel.classList.add("visible");
      panel.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    async function openMassSongPreview(slotKey) {
      void slotKey;
      return;
      const id = selectedLyricsSongs[slotKey] || "";
      let row = massPlanAllSongs.find((s) => String(s.id) === String(id));
      if (!row) {
        rebuildMassPlanSongPool();
        row = massPlanAllSongs.find((s) => String(s.id) === String(id));
      }
      if (!id || !row || !row.has_lyrics) return;

      const slotDef = lyricSongSlots.find((s) => s.key === slotKey);
      const section = resolveMassSongSection(slotKey, row);
      const cacheKey = section + "|" + id;
      const titleEl = $("song-preview-title");
      const subEl = $("song-preview-sub");
      const body = $("song-preview-body");
      if (titleEl) titleEl.textContent = row.title || "Song preview";
      if (subEl) {
        subEl.textContent = "Organize slides on the left, preview on the right. Tap a slide row to jump in the preview.";
      }
      if (body) body.innerHTML = "<p class=\"muted\">Loading lyrics preview…</p>";
      openSongPreviewPanel();

      let libraryLyrics = massSongLyricsCache.get(cacheKey);
      if (!libraryLyrics) {
        try {
          const data = await fetchSongDetail(section, id);
          libraryLyrics = (data.song && data.song.lyrics) ? String(data.song.lyrics) : "";
          massSongLyricsCache.set(cacheKey, libraryLyrics);
        } catch (err) {
          if (body) body.innerHTML = "<p class=\"status error\">" + escapeHtml(err.message || "Load failed") + "</p>";
          return;
        }
      }
      if (!(libraryLyrics || "").trim()) {
        if (body) body.innerHTML = "<p class=\"muted\">Lyrics unavailable for this song.</p>";
        return;
      }
      const meta = {
        title: row.title,
      };
      const libraryTrimmed = libraryLyrics.trim();
      const chunks = chunkLyricsForPreview(libraryTrimmed, 6);
      const plan = getHymnSlidePlan(section, id, chunks);
      songPreviewState = {
        slotKey,
        section,
        songId: id,
        libraryLyrics: libraryTrimmed,
        lyricsText: libraryTrimmed,
        meta,
        chunks,
        plan,
      };
      syncSlidePlanToOverrides();
      if (body) {
        await refreshSongPreviewPanel();
      }
    }

    function formatMassSummaryDate(iso) {
      if (!iso) return "—";
      const d = new Date(iso + "T12:00:00");
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }

    function massSongLangLabel(code) {
      const map = { all: "All languages", English: "English", Tagalog: "Tagalog", Latin: "Latin", mix: "Mix" };
      return map[code] || code || "All languages";
    }

    function massSongSlotShortLabel(key, label) {
      const map = {
        entrance: "Entrance",
        offertory: "Offertory",
        communion_1: "Communion 1",
        communion_2: "Communion 2",
        communion_3: "Communion 3",
        communion_4: "Communion 4",
        communion_5: "Communion 5",
        recessional: "Recessional",
        meditation: "Meditation",
      };
      const custom = (label || "").trim();
      return map[key] || custom || "section";
    }

    function buildMassSongPlanCardsHtml(idPrefix, opts) {
      opts = opts || {};
      const prefix = idPrefix || "mass-song";
      const allowDeleteAll = !!opts.allowDeleteAll;
      const slots = Array.isArray(opts.slots) ? opts.slots : lyricSongSlots;
      return slots.map((slot, index) => (
        "<article class=\"mass-song-plan-card mass-song-slot" + (slot.custom ? " mass-song-slot--custom" : "") + "\" data-slot-key=\"" + escapeHtml(slot.key) + "\">" +
          "<div class=\"mass-song-plan-card__row\">" +
            "<span class=\"mass-song-plan-card__drag\" aria-hidden=\"true\">" + MASS_SONG_PLAN_DRAG_SVG + "</span>" +
            "<span class=\"mass-song-plan-card__num\" aria-hidden=\"true\">" + (index + 1) + "</span>" +
            "<div class=\"mass-song-plan-card__core\">" +
              "<div class=\"mass-song-plan-card__top\">" +
                massSongSlotPartHtml(slot) +
                "<div class=\"mass-song-plan-card__title-wrap\">" +
                  "<span class=\"mass-song-plan-card__title-picked\">" +
                    "<strong class=\"mass-song-plan-card__title is-empty\" id=\"" + prefix + "-picked-" + escapeHtml(slot.key) + "\">Choose a song</strong>" +
                    massSongClearButtonHtml(slot.key) +
                  "</span>" +
                "</div>" +
                "<span class=\"mass-song-plan-card__badge\" id=\"" + prefix + "-badge-" + escapeHtml(slot.key) + "\" hidden>Selected</span>" +
                "<span class=\"mass-song-plan-card__meta\" id=\"" + prefix + "-status-" + escapeHtml(slot.key) + "\"></span>" +
                "<div class=\"mass-song-plan-card__actions\">" +
                  massSongPreviewButtonHtml(slot.key) +
                  ((allowDeleteAll || slot.custom) ? massSongDeleteSectionButtonHtml(slot) : "") +
                "</div>" +
              "</div>" +
              "<div class=\"mass-song-plan-row__search mass-song-pick\">" +
                "<input type=\"search\" id=\"" + prefix + "-q-" + escapeHtml(slot.key) + "\" class=\"mass-song-search-input\" maxlength=\"120\" autocomplete=\"off\" placeholder=\"Search " + escapeHtml(massSongSlotShortLabel(slot.key, slot.label).toLowerCase()) + "…\" aria-label=\"Search " + escapeHtml((slot.label || "").trim() || "section") + "\" />" +
                "<div class=\"mass-song-alert-host\" id=\"" + prefix + "-alert-" + escapeHtml(slot.key) + "\"></div>" +
                "<div class=\"vb-dropdown-panel mass-song-results\" id=\"" + prefix + "-res-" + escapeHtml(slot.key) + "\" data-slot-key=\"" + escapeHtml(slot.key) + "\" role=\"listbox\" hidden></div>" +
              "</div>" +
              massSongMediaRowHtml(slot.key) +
            "</div>" +
          "</div>" +
        "</article>"
      )).join("");
    }

    function practiceShareVisibleSlots() {
      return lyricSongSlots.filter((slot) => !practiceShareExcludedSlots.has(slot.key));
    }

    function setMassCommunionCount(next, opts) {
      const options = opts || {};
      const n = clampMassCommunionCount(next);
      const prev = clampMassCommunionCount(massCommunionCount);
      if (n === prev && !options.force) {
        syncCommunionCountUi();
        return;
      }
      const plan = $("mass-song-plan");
      const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const animate = !options.quiet && !reduced && plan;
      const finish = (enterFrom) => {
        applyCommunionCountToSlots(n);
        if (typeof renderMassSongPlan === "function") renderMassSongPlan();
        syncCommunionCountUi();
        if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
        if (animate && n > enterFrom) {
          window.requestAnimationFrame(() => {
            const root = $("mass-song-plan");
            if (!root) return;
            for (let i = enterFrom + 1; i <= n; i += 1) {
              const el = root.querySelector(".mass-song-plan-card[data-slot-key=\"" + communionSlotKey(i) + "\"]");
              if (!el) continue;
              el.classList.add("is-communion-enter");
              el.style.animationDelay = ((i - enterFrom - 1) * 45) + "ms";
              el.addEventListener("animationend", () => {
                el.classList.remove("is-communion-enter");
                el.style.animationDelay = "";
              }, { once: true });
            }
          });
        }
      };
      if (animate && n < prev) {
        const leaving = [];
        for (let i = n + 1; i <= prev; i += 1) {
          const el = plan.querySelector(".mass-song-plan-card[data-slot-key=\"" + communionSlotKey(i) + "\"]");
          if (el) leaving.push(el);
        }
        if (leaving.length) {
          leaving.forEach((el, i) => {
            el.classList.add("is-communion-leave");
            el.style.animationDelay = (i * 40) + "ms";
          });
          window.setTimeout(() => finish(n), 160 + leaving.length * 40);
          return;
        }
      }
      finish(prev);
    }

    function bindMassCommunionCountUi() {
      const wrap = $("mass-communion-count");
      if (!wrap || wrap.dataset.bound === "1") return;
      wrap.dataset.bound = "1";
      wrap.querySelectorAll("[data-communion-count]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const n = parseInt(btn.getAttribute("data-communion-count"), 10);
          if (n === 1 || n === 2) setMassCommunionCount(n);
        });
      });
      const input = $("mass-communion-custom");
      if (!input) return;
      const commit = () => {
        const raw = String(input.value || "").trim();
        if (!raw) {
          input.value = String(massCommunionCount);
          return;
        }
        setMassCommunionCount(raw);
        input.value = String(massCommunionCount);
      };
      input.addEventListener("input", () => {
        const raw = String(input.value || "").trim();
        if (!raw) return;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) return;
        if (n > MASS_COMMUNION_MAX) input.value = String(MASS_COMMUNION_MAX);
        window.clearTimeout(massCommunionCountTimer);
        massCommunionCountTimer = window.setTimeout(() => {
          const next = clampMassCommunionCount(input.value);
          setMassCommunionCount(next);
          input.value = String(massCommunionCount);
        }, 280);
      });
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          input.blur();
        }
        if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
          e.preventDefault();
        }
      });
      syncCommunionCountUi();
    }

    function renderMassSongPlan() {
      const plan = $("mass-song-plan");
      if (plan) {
        rebuildMassPlanSongPool();
        plan.innerHTML = buildMassSongPlanCardsHtml("mass-song");
        lyricSongSlots.forEach((slot) => {
          updateMassSlotChip(slot.key);
          updateMassSongPreviewButton(slot.key);
        });
      }
      updateMassSongAddButton();
      renderMassSummarySidebar();
      renderFlowSongCount();
      if ($("practice-share-sections-modal") && $("practice-share-sections-modal").classList.contains("is-open")) {
        renderPracticeShareSongPlan({ skipMassSync: true });
      }
      if (typeof syncMassDefaultPins === "function") syncMassDefaultPins($("mass-song-plan"));
    }

    function renderPracticeShareSongPlan(opts) {
      opts = opts || {};
      const plan = $("practice-share-song-plan");
      if (!plan) return 0;
      rebuildMassPlanSongPool();
      const slots = practiceShareVisibleSlots();
      plan.innerHTML = buildMassSongPlanCardsHtml("ps-song", {
        allowDeleteAll: true,
        slots: slots,
      });
      slots.forEach((slot) => {
        updateMassSlotChip(slot.key);
      });
      updateMassSongAddButton();
      if (!opts.skipMassSync && $("mass-song-plan")) {
        const massPlan = $("mass-song-plan");
        if (massPlan && !massPlan.contains(document.activeElement)) {
          massPlan.innerHTML = buildMassSongPlanCardsHtml("mass-song");
          lyricSongSlots.forEach((slot) => {
            updateMassSlotChip(slot.key);
            updateMassSongPreviewButton(slot.key);
          });
        }
      }
      const available = slots.filter((slot) => !!(selectedLyricsSongs[slot.key] || "").trim()).length;
      syncPracticeShareContinueEnabled();
      return available;
    }

    function syncPracticeShareContinueEnabled() {
      const continueBtn = $("practice-share-sections-continue");
      if (!continueBtn) return;
      const modal = $("practice-share-sections-modal");
      if (!modal || !modal.classList.contains("is-open")) return;
      const available = practiceShareVisibleSlots()
        .filter((slot) => !!(selectedLyricsSongs[slot.key] || "").trim()).length;
      continueBtn.disabled = available === 0;
    }

    function practiceShareScrollHost() {
      const card = document.querySelector("#practice-share-sections-modal .practice-share-card--plan");
      return card ? card.querySelector(".ui-card__content") : null;
    }

    function scrollPracticeShareSectionIntoView(slotKey, opts) {
      opts = opts || {};
      const plan = $("practice-share-song-plan");
      const host = practiceShareScrollHost();
      if (!plan || !host) return;
      const card = plan.querySelector('.mass-song-plan-card[data-slot-key="' + slotKey + '"]');
      if (!card) return;

      const mobile = !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
      const hostRect = host.getBoundingClientRect();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior = opts.instant || reduceMotion ? "auto" : "smooth";

      // Mobile: results are in-flow. Pin the section card title at the top of the
      // sheet so the title stays visible, with search + first results below it.
      if (mobile) {
        plan.style.paddingBottom = "12px";
        const titleRow = card.querySelector(".mass-song-plan-card__top") || card;
        const titleTop = titleRow.getBoundingClientRect().top - hostRect.top + host.scrollTop;
        const maxTop = Math.max(0, host.scrollHeight - host.clientHeight);
        const nextTop = Math.max(0, Math.min(titleTop - 8, maxTop));
        if (Math.abs(nextTop - host.scrollTop) >= 2) {
          host.scrollTo({ top: nextTop, behavior: behavior });
        }
        return;
      }

      const dropdownRoom = opts.dropdownRoom != null ? opts.dropdownRoom : 260;
      plan.style.paddingBottom = dropdownRoom + "px";
      const cardRect = card.getBoundingClientRect();
      const cardTopInHost = cardRect.top - hostRect.top + host.scrollTop;
      const neededBottom = cardTopInHost + card.offsetHeight + dropdownRoom;
      const viewBottom = host.scrollTop + host.clientHeight;
      const viewTop = host.scrollTop;
      let nextTop = host.scrollTop;
      if (neededBottom > viewBottom) {
        nextTop = neededBottom - host.clientHeight + 12;
      } else if (cardTopInHost < viewTop + 8) {
        nextTop = Math.max(0, cardTopInHost - 12);
      }
      nextTop = Math.max(0, Math.min(nextTop, Math.max(0, host.scrollHeight - host.clientHeight)));
      if (Math.abs(nextTop - host.scrollTop) >= 2) {
        host.scrollTo({ top: nextTop, behavior: behavior });
      }
    }

    function clearPracticeShareDropdownPad() {
      const plan = $("practice-share-song-plan");
      if (plan) plan.style.paddingBottom = "";
    }

    function focusPracticeShareSectionSearch(slotKey) {
      const inp = $("ps-song-q-" + slotKey);
      if (!inp) return;
      scrollPracticeShareSectionIntoView(slotKey, { dropdownRoom: 260 });
      window.requestAnimationFrame(() => {
        inp.focus({ preventScroll: true });
        scrollPracticeShareSectionIntoView(slotKey, { dropdownRoom: 260 });
      });
    }

    function focusNextPracticeShareSection(afterKey) {
      const slots = practiceShareVisibleSlots();
      const idx = slots.findIndex((s) => s.key === afterKey);
      const next = slots.slice(idx + 1).find((s) => !(selectedLyricsSongs[s.key] || "").trim()) || slots[idx + 1];
      if (!next) return;
      focusPracticeShareSectionSearch(next.key);
    }

    var practiceShareLastUrl = "";
    var practiceShareLastLeadUrl = "";
    var practiceShareLastToken = "";
    var practiceShareLastPin = "";
    var practiceShareLastLeaderPin = "";
    var practiceShareLastMassDate = "";
    var practiceShareSlotFilter = null;
    var practiceShareExcludedSlots = new Set();
    var practiceShareHistoryCache = [];
    var practiceShareHistoryCountdownTimer = null;
    var PRACTICE_PIN_LS_PREFIX = "lf-practice-pin:";
    var PRACTICE_LEADER_PIN_LS_PREFIX = "lf-practice-leader-pin:";

    function practicePinStorageKey(token) {
      return PRACTICE_PIN_LS_PREFIX + String(token || "").trim();
    }

    function practiceLeaderPinStorageKey(token) {
      return PRACTICE_LEADER_PIN_LS_PREFIX + String(token || "").trim();
    }

    function readStoredPracticePin(token) {
      const tok = String(token || "").trim();
      if (!tok) return "";
      try {
        const pin = String(localStorage.getItem(practicePinStorageKey(tok)) || "").replace(/\D/g, "");
        return pin.length === 6 ? pin : "";
      } catch (_e) {
        return "";
      }
    }

    function writeStoredPracticePin(token, pin) {
      const tok = String(token || "").trim();
      const clean = String(pin || "").replace(/\D/g, "");
      if (!tok || clean.length !== 6) return;
      try {
        localStorage.setItem(practicePinStorageKey(tok), clean);
      } catch (_e) { /* ignore quota */ }
    }

    function readStoredPracticeLeaderPin(token) {
      const tok = String(token || "").trim();
      if (!tok) return "";
      try {
        const pin = String(localStorage.getItem(practiceLeaderPinStorageKey(tok)) || "").replace(/\D/g, "");
        return pin.length === 6 ? pin : "";
      } catch (_e) {
        return "";
      }
    }

    function writeStoredPracticeLeaderPin(token, pin) {
      const tok = String(token || "").trim();
      const clean = String(pin || "").replace(/\D/g, "");
      if (!tok || clean.length !== 6) return;
      try {
        localStorage.setItem(practiceLeaderPinStorageKey(tok), clean);
      } catch (_e) { /* ignore quota */ }
    }

    function formatPracticeCountdown(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s left";
      return String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s left";
    }

    function formatPracticeMassDate(iso) {
      const raw = String(iso || "").trim();
      if (!raw) return "";
      try {
        const d = new Date(raw + "T12:00:00");
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      } catch (_e) {
        return raw;
      }
    }

    function mountPinOtp(container, opts) {
      opts = opts || {};
      if (!container) return { getValue: () => "", clear: () => {}, focus: () => {}, destroy: () => {} };
      const trap = container.querySelector(".pin-otp__trap");
      const boxes = Array.from(container.querySelectorAll("[data-pin-box]"));
      const limit = boxes.length || 6;
      if (!trap) return { getValue: () => "", clear: () => {}, focus: () => {}, destroy: () => {} };
      let revealIndex = -1;
      let revealTimer = null;
      let lastLen = 0;

      const getValue = () => (trap.value || "").replace(/\D/g, "").slice(0, limit);

      const trySubmit = () => {
        if (getValue().length === limit && typeof opts.onSubmit === "function") {
          opts.onSubmit(getValue());
        }
      };

      const clearRevealTimer = () => {
        if (revealTimer) {
          clearTimeout(revealTimer);
          revealTimer = null;
        }
      };

      const scheduleMask = (index) => {
        clearRevealTimer();
        revealIndex = index;
        revealTimer = setTimeout(() => {
          revealIndex = -1;
          revealTimer = null;
          sync();
        }, 700);
      };

      const sync = () => {
        const val = getValue();
        if (trap.value !== val) trap.value = val;
        const lastFilled = val.length - 1;
        boxes.forEach((box, i) => {
          const filled = i < val.length;
          if (!filled) box.textContent = "";
          else if (i === revealIndex) box.textContent = val.charAt(i);
          else box.textContent = "\u2022";
          box.classList.toggle("is-filled", filled);
          box.classList.toggle("is-active", filled && i === lastFilled);
        });
        lastLen = val.length;
      };

      const appendDigit = (digit) => {
        const prev = getValue();
        if (prev.length >= limit) return;
        const val = (prev + digit).slice(0, limit);
        trap.value = val;
        scheduleMask(val.length - 1);
        sync();
      };

      trap.addEventListener("input", () => {
        const val = getValue();
        if (trap.value !== val) trap.value = val;
        if (val.length > lastLen) scheduleMask(val.length - 1);
        else if (val.length < lastLen) {
          clearRevealTimer();
          revealIndex = -1;
        }
        sync();
      });
      trap.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          trySubmit();
        }
      });
      trap.addEventListener("paste", (ev) => {
        ev.preventDefault();
        const text = (ev.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, limit);
        trap.value = text;
        if (text.length) scheduleMask(text.length - 1);
        else {
          clearRevealTimer();
          revealIndex = -1;
        }
        sync();
      });
      container.addEventListener("click", () => trap.focus());

      const onDocKey = (ev) => {
        if (!container.isConnected) {
          document.removeEventListener("keydown", onDocKey, true);
          return;
        }
        const modal = document.getElementById("practice-share-modal");
        if (modal && modal.getAttribute("aria-hidden") === "true") return;
        const t = ev.target;
        if (t && t !== trap && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
        if (/^\d$/.test(ev.key)) {
          ev.preventDefault();
          trap.focus();
          appendDigit(ev.key);
        } else if (ev.key === "Backspace") {
          const val = (trap.value || "").replace(/\D/g, "");
          if (document.activeElement !== trap || val.length) {
            ev.preventDefault();
            trap.focus();
            clearRevealTimer();
            revealIndex = -1;
            trap.value = val.slice(0, -1);
            sync();
          }
        } else if (ev.key === "Enter") {
          if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
          if (getValue().length === limit) {
            ev.preventDefault();
            trySubmit();
          }
        }
      };
      document.addEventListener("keydown", onDocKey, true);

      sync();
      requestAnimationFrame(() => focusPinTrap(trap));

      return {
        getValue,
        clear: () => {
          clearRevealTimer();
          revealIndex = -1;
          trap.value = "";
          sync();
          focusPinTrap(trap);
        },
        focus: () => focusPinTrap(trap),
        destroy: () => {
          clearRevealTimer();
          document.removeEventListener("keydown", onDocKey, true);
        },
        cells: boxes,
      };
    }

    function focusPinTrap(trap) {
      if (!trap || !trap.isConnected) return;
      const run = () => {
        if (!trap.isConnected) return;
        try {
          // readonly flip helps iOS open the soft keyboard on programmatic focus
          trap.readOnly = true;
          trap.focus({ preventScroll: false });
          trap.readOnly = false;
          trap.focus({ preventScroll: false });
        } catch (_err) {
          try { trap.focus(); } catch (_e2) { /* ignore */ }
        }
        try {
          trap.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
        } catch (_e3) { /* ignore */ }
      };
      run();
      requestAnimationFrame(run);
      setTimeout(run, 50);
      setTimeout(run, 200);
      setTimeout(run, 450);
    }

    var practiceSharePinOtp = null;
    var practiceShareOpenedFromHistory = false;

    function getPracticeSharePin() {
      return practiceSharePinOtp ? practiceSharePinOtp.getValue() : "";
    }

    function clearPracticeSharePin() {
      practiceSharePinOtp?.clear();
      practiceShareLastPin = "";
      practiceShareLastLeaderPin = "";
    }

    function setPracticeShareFooterMode(mode) {
      const footer = $("practice-share-footer");
      if (!footer) return;
      footer.classList.toggle("practice-share-footer--result", mode === "result");
      footer.classList.toggle("practice-share-footer--loading", mode === "loading");
      // Keep PIN sheet top-aligned only while entering the PIN (keyboard room)
      if (mode === "result" || mode === "loading") {
        document.body.classList.remove("practice-share-pin-top");
      } else if (isMobileChromeLayout() && $("practice-share-modal")?.classList.contains("is-open")) {
        document.body.classList.add("practice-share-pin-top");
      }
    }

    var practiceShareNavHideTimer = null;
    var PRACTICE_SHARE_NAV_HIDE_MS = 3200;
    var practiceShareNavGesture = null;

    function isPracticeShareSheetOpen() {
      const sections = $("practice-share-sections-modal");
      const pin = $("practice-share-modal");
      const history = $("practice-share-history-modal");
      const expired = $("practice-share-expired-modal");
      return !!(
        (sections && sections.classList.contains("is-open")) ||
        (pin && pin.classList.contains("is-open")) ||
        (history && history.classList.contains("is-open")) ||
        (expired && expired.classList.contains("is-open"))
      );
    }

    function clearPracticeShareNavHideTimer() {
      if (practiceShareNavHideTimer) {
        clearTimeout(practiceShareNavHideTimer);
        practiceShareNavHideTimer = null;
      }
      document.body.classList.remove("bottom-nav-autohide");
    }

    function collapsePracticeShareBottomNav() {
      if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
      clearPracticeShareNavHideTimer();
      document.body.classList.add("bottom-nav-collapsed");
      const peek = $("app-bottom-nav-peek");
      if (peek) {
        peek.hidden = false;
        peek.setAttribute("aria-expanded", "false");
        peek.setAttribute("aria-label", "Show navigation");
      }
      const gesture = $("app-bottom-nav-gesture");
      if (gesture) gesture.hidden = false;
    }

    function schedulePracticeShareNavAutoHide() {
      clearPracticeShareNavHideTimer();
      if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
      if (document.body.classList.contains("bottom-nav-collapsed")) return;
      // Restart CSS countdown bar
      void document.body.offsetWidth;
      document.body.classList.add("bottom-nav-autohide");
      practiceShareNavHideTimer = setTimeout(() => {
        practiceShareNavHideTimer = null;
        collapsePracticeShareBottomNav();
      }, PRACTICE_SHARE_NAV_HIDE_MS);
    }

    function syncPracticeShareBottomNavChrome() {
      const peek = $("app-bottom-nav-peek");
      const gesture = $("app-bottom-nav-gesture");
      clearPracticeShareNavHideTimer();
      if (!isMobileChromeLayout()) {
        document.body.classList.remove("bottom-nav-sheet-open", "bottom-nav-collapsed");
        if (peek) peek.hidden = true;
        if (gesture) gesture.hidden = true;
        return;
      }
      const open = isPracticeShareSheetOpen();
      document.body.classList.toggle("bottom-nav-sheet-open", open);
      if (open) {
        document.body.classList.add("bottom-nav-collapsed");
        if (peek) {
          peek.hidden = false;
          peek.setAttribute("aria-expanded", "false");
          peek.setAttribute("aria-label", "Show navigation");
        }
        if (gesture) gesture.hidden = false;
      } else {
        document.body.classList.remove("bottom-nav-collapsed");
        if (peek) peek.hidden = true;
        if (gesture) gesture.hidden = true;
      }
    }

    function expandPracticeShareBottomNav() {
      if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
      document.body.classList.remove("bottom-nav-collapsed");
      const peek = $("app-bottom-nav-peek");
      if (peek) {
        peek.hidden = true;
        peek.setAttribute("aria-expanded", "true");
      }
      const gesture = $("app-bottom-nav-gesture");
      if (gesture) gesture.hidden = true;
      schedulePracticeShareNavAutoHide();
    }

    function initPracticeShareBottomNavGestures() {
      if (practiceShareNavGesture) return;
      const zone = $("app-bottom-nav-gesture");
      const nav = $("app-bottom-nav");
      let startY = 0;
      let startX = 0;
      let tracking = false;

      function touchPoint(e) {
        if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0];
        if (e.touches && e.touches[0]) return e.touches[0];
        return e;
      }

      function onStart(e) {
        if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
        const t = touchPoint(e);
        startY = t.clientY;
        startX = t.clientX;
        tracking = true;
      }

      function onEnd(e) {
        if (!tracking) return;
        tracking = false;
        if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
        const t = touchPoint(e);
        const dy = t.clientY - startY;
        const dx = Math.abs(t.clientX - startX);
        if (dx > 56) return;
        const collapsed = document.body.classList.contains("bottom-nav-collapsed");
        if (collapsed && dy < -28) {
          expandPracticeShareBottomNav();
        } else if (!collapsed && dy > 28) {
          collapsePracticeShareBottomNav();
        }
      }

      if (zone) {
        zone.addEventListener("touchstart", onStart, { passive: true });
        zone.addEventListener("touchend", onEnd, { passive: true });
        zone.addEventListener("touchcancel", () => { tracking = false; }, { passive: true });
      }
      if (nav) {
        nav.addEventListener("touchstart", (e) => {
          if (!document.body.classList.contains("bottom-nav-sheet-open")) return;
          onStart(e);
          if (!document.body.classList.contains("bottom-nav-collapsed")) {
            schedulePracticeShareNavAutoHide();
          }
        }, { passive: true });
        nav.addEventListener("touchend", onEnd, { passive: true });
        nav.addEventListener("touchcancel", () => { tracking = false; }, { passive: true });
      }
      practiceShareNavGesture = true;
    }

    function closePracticeShareModal() {
      setUiOverlayOpen($("practice-share-modal"), false);
      document.body.classList.remove("practice-share-pin-top");
      syncPracticeShareBottomNavChrome();
    }

    function closePracticeShareSectionsModal(opts) {
      opts = opts || {};
      closeMassSongResultPanels();
      clearPracticeShareDropdownPad();
      const card = document.querySelector("#practice-share-sections-modal .ui-card");
      if (card) card.classList.remove("ui-card--popover-open");
      setUiOverlayOpen($("practice-share-sections-modal"), false);
      if (!opts.skipNavSync) syncPracticeShareBottomNavChrome();
    }

    function practiceSharePinMode() {
      return "pin";
    }

    function syncPracticeSharePinUi() {
      /* Choir PIN step removed — lyrics are open via the link. */
    }

    function stopPracticeShareHistoryCountdown() {
      if (practiceShareHistoryCountdownTimer) {
        clearInterval(practiceShareHistoryCountdownTimer);
        practiceShareHistoryCountdownTimer = null;
      }
    }

    function tickPracticeShareHistoryCountdowns() {
      const nodes = document.querySelectorAll("[data-practice-countdown]");
      if (!nodes.length) {
        stopPracticeShareHistoryCountdown();
        return;
      }
      nodes.forEach((el) => {
        const expiresAt = el.getAttribute("data-expires-at") || "";
        const end = expiresAt ? new Date(expiresAt).getTime() : 0;
        const remaining = end ? Math.max(0, Math.floor((end - Date.now()) / 1000)) : 0;
        el.textContent = remaining > 0 ? formatPracticeCountdown(remaining) : "Expired";
        if (remaining <= 0) {
          const btn = el.closest(".practice-share-history-item");
          if (btn && !btn.classList.contains("is-expired")) {
            btn.classList.add("is-expired");
            const badge = btn.querySelector(".practice-share-history-item__badge");
            if (badge) badge.textContent = "Expired";
          }
        }
      });
    }

    function startPracticeShareHistoryCountdown() {
      stopPracticeShareHistoryCountdown();
      tickPracticeShareHistoryCountdowns();
      practiceShareHistoryCountdownTimer = setInterval(tickPracticeShareHistoryCountdowns, 1000);
    }

    function resetPracticeShareModal() {
      stopPracticeShareLoadingAnim();
      const setup = $("practice-share-setup");
      const loading = $("practice-share-loading");
      const result = $("practice-share-result");
      const status = $("practice-share-status");
      const generateBtn = $("practice-share-generate");
      const cancelBtn = $("practice-share-cancel");
      const backBtn = $("practice-share-back");
      if (setup) setup.hidden = false;
      if (loading) loading.hidden = true;
      if (result) result.hidden = true;
      if (status) { status.hidden = true; status.textContent = ""; status.className = "status error"; }
      if (generateBtn) { generateBtn.hidden = false; generateBtn.disabled = false; generateBtn.textContent = "Generate"; }
      if (cancelBtn) cancelBtn.textContent = "Cancel";
      if (backBtn) backBtn.hidden = true;
      practiceShareOpenedFromHistory = false;
      setPracticeShareFooterMode("");
      syncPracticeSharePinUi();
      clearPracticeSharePin();
      const url = $("practice-share-url");
      if (url) url.value = "";
      practiceShareLastUrl = "";
      practiceShareLastLeadUrl = "";
      practiceShareLastToken = "";
      practiceShareLastMassDate = "";
      const leadBtn = $("practice-share-lets-practice");
      if (leadBtn) leadBtn.hidden = true;
      const qr = $("practice-share-qr");
      const qrFallback = $("practice-share-qr-fallback");
      if (qr) { qr.hidden = true; qr.removeAttribute("src"); }
      if (qrFallback) qrFallback.hidden = true;
      const sub = $("practice-share-sub");
      if (sub) sub.textContent = "Anyone with the link can read these lyrics — no account needed.";
    }

    function closePracticeShareHistoryModal() {
      stopPracticeShareHistoryCountdown();
      const loading = $("practice-share-history-loading");
      const list = $("practice-share-history-list");
      const footer = $("practice-share-history-footer");
      if (loading) loading.hidden = true;
      if (list) list.hidden = false;
      if (footer) {
        footer.hidden = false;
        footer.classList.remove("practice-share-history-footer--loading");
      }
      const cancelBtn = $("practice-share-history-cancel");
      const newBtn = $("practice-share-history-new");
      if (cancelBtn) cancelBtn.hidden = false;
      if (newBtn) newBtn.hidden = false;
      setUiOverlayOpen($("practice-share-history-modal"), false);
      syncPracticeShareBottomNavChrome();
    }

    function closePracticeShareExpiredModal(opts) {
      opts = opts || {};
      setUiOverlayOpen($("practice-share-expired-modal"), false);
      if (!opts.skipNavSync) syncPracticeShareBottomNavChrome();
      if (opts.reopenHistory) {
        setUiOverlayOpen($("practice-share-history-modal"), true);
        startPracticeShareHistoryCountdown();
        syncPracticeShareBottomNavChrome();
      }
    }

    function renderPracticeShareHistoryList(shares) {
      const host = $("practice-share-history-list");
      if (!host) return;
      practiceShareHistoryCache = Array.isArray(shares) ? shares.slice() : [];
      const active = practiceShareHistoryCache.filter((s) => s && s.status === "active");
      const expired = practiceShareHistoryCache.filter((s) => s && s.status !== "active");

      if (!active.length && !expired.length) {
        host.innerHTML = '<p class="practice-share-history-empty">No practice shares yet. Create one to freeze lyrics for your choir.</p>';
        stopPracticeShareHistoryCountdown();
        return;
      }

      function itemHtml(share, isActive) {
        const token = String(share.token || "");
        const countdown = isActive
          ? ('<p class="practice-share-history-item__countdown" data-practice-countdown data-expires-at="' +
              String(share.expires_at || "").replace(/"/g, "&quot;") + '">' +
              formatPracticeCountdown(share.seconds_remaining) + "</p>")
          : "";
        const expireBtn = isActive
          ? '<button type="button" class="secondary practice-share-history-item__expire" data-practice-expire="' +
            token.replace(/"/g, "&quot;") + '">Expire now</button>'
          : "";
        return (
          '<li class="practice-share-history-row">' +
          '<button type="button" class="practice-share-history-item' + (isActive ? "" : " is-expired") +
          '" data-practice-token="' + token.replace(/"/g, "&quot;") + '" data-practice-status="' + (isActive ? "active" : "expired") + '">' +
          '<div class="practice-share-history-item__top">' +
          '<p class="practice-share-history-item__title"></p>' +
          '<span class="practice-share-history-item__badge">' + (isActive ? "Active" : "Expired") + "</span>" +
          "</div>" +
          '<p class="practice-share-history-item__meta"></p>' +
          countdown +
          "</button>" +
          (expireBtn ? ('<div class="practice-share-history-item__actions">' + expireBtn + "</div>") : "") +
          "</li>"
        );
      }

      let html = "";
      if (active.length) {
        html += '<section class="practice-share-history-section"><h4 class="practice-share-history-section__title">Active</h4><ul class="practice-share-history-items">';
        active.forEach((s) => { html += itemHtml(s, true); });
        html += "</ul></section>";
      }
      if (expired.length) {
        html += '<section class="practice-share-history-section"><h4 class="practice-share-history-section__title">Expired</h4><ul class="practice-share-history-items">';
        expired.forEach((s) => { html += itemHtml(s, false); });
        html += "</ul></section>";
      }
      host.innerHTML = html;

      // Set text via textContent to avoid HTML injection from titles
      Array.from(host.querySelectorAll(".practice-share-history-item")).forEach((btn) => {
        const token = btn.getAttribute("data-practice-token") || "";
        const share = practiceShareHistoryCache.find((s) => String(s.token || "") === token);
        if (!share) return;
        const titleEl = btn.querySelector(".practice-share-history-item__title");
        const metaEl = btn.querySelector(".practice-share-history-item__meta");
        if (titleEl) titleEl.textContent = String(share.mass_title || "").trim() || ("Mass · " + formatPracticeMassDate(share.mass_date));
        if (metaEl) {
          const dateLabel = formatPracticeMassDate(share.mass_date);
          const songCount = Number(share.song_count || 0);
          metaEl.textContent = [dateLabel, songCount ? (songCount + " song" + (songCount === 1 ? "" : "s")) : ""].filter(Boolean).join(" · ");
        }
      });

      if (active.length) startPracticeShareHistoryCountdown();
      else stopPracticeShareHistoryCountdown();
    }

    async function fetchRecentPracticeShares() {
      if (window.VerbumAuth && window.VerbumAuth.waitUntilReady) {
        await window.VerbumAuth.waitUntilReady();
      }
      const headers = Object.assign({}, practiceDeviceHeaders());
      if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
      }
      const res = await fetch("/api/practice/shares/recent", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || res.statusText || "Could not load shares.");
      }
      return Array.isArray(data.shares) ? data.shares : [];
    }

    async function openPracticeShareHistoryModal() {
      if (!isFeatureEnabled("choir_practice_shares")) {
        notify(FEATURE_OFF_HINT, "info");
        return;
      }
      const status = $("practice-share-history-status");
      const list = $("practice-share-history-list");
      const loading = $("practice-share-history-loading");
      const footer = $("practice-share-history-footer");
      const cancelBtn = $("practice-share-history-cancel");
      const newBtn = $("practice-share-history-new");
      if (status) { status.hidden = true; status.textContent = ""; }
      if (list) { list.hidden = true; list.innerHTML = ""; }
      if (loading) loading.hidden = false;
      if (footer) {
        footer.hidden = true;
        footer.classList.add("practice-share-history-footer--loading");
      }
      if (cancelBtn) cancelBtn.hidden = true;
      if (newBtn) newBtn.hidden = true;
      setUiOverlayOpen($("practice-share-history-modal"), true);
      syncPracticeShareBottomNavChrome();
      try {
        const shares = await fetchRecentPracticeShares();
        if (loading) loading.hidden = true;
        if (list) list.hidden = false;
        renderPracticeShareHistoryList(shares);
        if (footer) {
          footer.hidden = false;
          footer.classList.remove("practice-share-history-footer--loading");
        }
        if (cancelBtn) cancelBtn.hidden = false;
        if (newBtn) newBtn.hidden = false;
      } catch (err) {
        if (loading) loading.hidden = true;
        if (list) { list.hidden = false; list.innerHTML = ""; }
        if (status) {
          status.textContent = err.message || "Could not load practice shares.";
          status.hidden = false;
        }
        if (footer) {
          footer.hidden = false;
          footer.classList.remove("practice-share-history-footer--loading");
        }
        if (cancelBtn) cancelBtn.hidden = false;
        if (newBtn) newBtn.hidden = false;
      }
    }

    function openActivePracticeShareFromHistory(share) {
      if (!share || !share.token) return;
      closePracticeShareHistoryModal();
      const pin = readStoredPracticePin(share.token);
      const leaderPin = readStoredPracticeLeaderPin(share.token);
      resetPracticeShareModal();
      practiceShareOpenedFromHistory = true;
      setUiOverlayOpen($("practice-share-modal"), true);
      syncPracticeShareBottomNavChrome();
      showPracticeShareResult({
        ...share,
        pin: pin,
        leader_pin: leaderPin,
        restored: true,
        mass_date: share.mass_date || "",
      });
    }

    async function expirePracticeShareFromHistory(token) {
      const tok = String(token || "").trim();
      if (!tok) return;
      if (!window.confirm("Expire this practice link now? Choir members will no longer be able to open it.")) {
        return;
      }
      const status = $("practice-share-history-status");
      try {
        await postJSON("/api/practice/" + encodeURIComponent(tok) + "/revoke", {});
        const shares = await fetchRecentPracticeShares();
        renderPracticeShareHistoryList(shares);
        notify("Practice link expired.", "ok");
      } catch (err) {
        if (status) {
          status.textContent = err.message || "Could not expire share.";
          status.hidden = false;
        }
      }
    }

    function openExpiredPracticeShareDetail(share) {
      if (!share) return;
      stopPracticeShareHistoryCountdown();
      setUiOverlayOpen($("practice-share-history-modal"), false);
      const sub = $("practice-share-expired-sub");
      const list = $("practice-share-expired-songs");
      const dateLabel = formatPracticeMassDate(share.mass_date);
      const title = String(share.mass_title || "").trim();
      if (sub) {
        sub.textContent = [title, dateLabel].filter(Boolean).join(" · ") || "This practice link has expired.";
      }
      if (list) {
        list.innerHTML = "";
        const songs = Array.isArray(share.songs) ? share.songs : [];
        if (!songs.length) {
          const li = document.createElement("li");
          li.textContent = "No song titles saved for this share.";
          list.appendChild(li);
        } else {
          songs.forEach((song) => {
            const li = document.createElement("li");
            const slot = document.createElement("span");
            slot.className = "practice-share-expired-songs__slot";
            slot.textContent = String(song.slot_label || song.section || "Song").trim() || "Song";
            const titleEl = document.createElement("span");
            titleEl.className = "practice-share-expired-songs__title";
            titleEl.textContent = String(song.title || "Song").trim() || "Song";
            li.appendChild(slot);
            li.appendChild(titleEl);
            list.appendChild(li);
          });
        }
      }
      setUiOverlayOpen($("practice-share-expired-modal"), true);
      syncPracticeShareBottomNavChrome();
    }

    function onPracticeShareHistoryClick(e) {
      const expireBtn = e.target && e.target.closest ? e.target.closest("[data-practice-expire]") : null;
      if (expireBtn) {
        e.preventDefault();
        e.stopPropagation();
        void expirePracticeShareFromHistory(expireBtn.getAttribute("data-practice-expire") || "");
        return;
      }
      const btn = e.target && e.target.closest ? e.target.closest(".practice-share-history-item") : null;
      if (!btn) return;
      const token = btn.getAttribute("data-practice-token") || "";
      const share = practiceShareHistoryCache.find((s) => String(s.token || "") === token);
      if (!share) return;
      const expiresMs = share.expires_at ? new Date(share.expires_at).getTime() : 0;
      const stillActive = share.status === "active" && expiresMs > Date.now();
      if (stillActive) openActivePracticeShareFromHistory(share);
      else openExpiredPracticeShareDetail({ ...share, status: "expired" });
    }

    function backToPracticeShareHistory() {
      closePracticeShareModal();
      closePracticeShareExpiredModal({ skipNavSync: true });
      void openPracticeShareHistoryModal();
    }

    function ensurePracticeShareMassDate(preferredDate) {
      const dateEl = $("mass-date");
      if (!dateEl) return "";
      const preferred = String(preferredDate || "").trim();
      const current = (dateEl.value || "").trim();
      if (preferred && current !== preferred) {
        dateEl.value = preferred;
        dateEl.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
      }
      return (dateEl.value || "").trim() || preferred || upcomingSundayISO();
    }

    async function hydratePracticeShareSelections(targetDate) {
      const date = String(targetDate || upcomingSundayISO()).trim();
      ensurePracticeShareMassDate(date);
      const draft = readMassBuilderDraft();
      const draftDate = (draft && (draft.previewDate || (draft.fields && draft.fields["mass-date"]))) || "";
      if (draft && draft.selectedLyricsSongs && String(draftDate) === date) {
        HOME_SONG_SLOTS.forEach((slot) => {
          const id = draft.selectedLyricsSongs[slot.key];
          if (id) selectedLyricsSongs[slot.key] = id;
        });
      }
      let hasAny = HOME_SONG_SLOTS.some((slot) => !!(selectedLyricsSongs[slot.key] || "").trim());
      if (!hasAny) {
        try {
          const data = await fetchPreview(date, { readingsOnly: false });
          if (data && data.default_song_selections) {
            HOME_SONG_SLOTS.forEach((slot) => {
              const id = data.default_song_selections[slot.key];
              if (id) selectedLyricsSongs[slot.key] = id;
            });
          }
        } catch (_e) { /* optional */ }
      }
      await loadSongCatalog();
      rebuildMassPlanSongPool();
      return date;
    }

    function openPracticeShareModal(opts) {
      if (!isFeatureEnabled("choir_practice_shares")) {
        notify(FEATURE_OFF_HINT, "info");
        return;
      }
      opts = opts || {};
      const dateEl = $("mass-date");
      let date = dateEl ? (dateEl.value || "").trim() : "";
      if (!date && opts.allowHomeDate) {
        date = ensurePracticeShareMassDate(upcomingSundayISO());
      }
      if (!date) {
        window.alert("Choose a Mass date first, then pick your songs.");
        return;
      }
      if (!opts.keepSlotFilter) practiceShareSlotFilter = null;
      resetPracticeShareModal();
      practiceShareLastMassDate = date;
      setUiOverlayOpen($("practice-share-modal"), true);
      if (isMobileChromeLayout()) {
        document.body.classList.add("practice-share-pin-top");
      }
      const sub = $("practice-share-sub");
      if (sub) {
        const n = practiceShareSlotFilter ? practiceShareSlotFilter.size : 0;
        sub.textContent = n
          ? ("Share " + n + " section" + (n === 1 ? "" : "s") + " for " + date + ". Generate a link anyone can open.")
          : ("Share lyrics for " + date + ". Anyone with the link can open them — no PIN.");
      }
      requestAnimationFrame(() => {
        /* no PIN field to focus */
      });
      syncPracticeShareBottomNavChrome();
    }

    function renderPracticeShareSectionsList() {
      return renderPracticeShareSongPlan();
    }

    async function openPracticeShareSectionsModal(opts) {
      if (!isFeatureEnabled("choir_practice_shares")) {
        notify(FEATURE_OFF_HINT, "info");
        return;
      }
      opts = opts || {};
      const status = $("practice-share-sections-status");
      const continueBtn = $("practice-share-sections-continue");
      if (status) { status.hidden = true; status.textContent = ""; }
      if (continueBtn) continueBtn.disabled = true;
      practiceShareExcludedSlots = new Set();
      const targetDate = (opts.date && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.date).trim()))
        ? String(opts.date).trim()
        : upcomingSundayISO();
      const date = await hydratePracticeShareSelections(targetDate);
      const available = renderPracticeShareSongPlan();
      const sub = $("practice-share-sections-sub");
      if (sub) {
        sub.textContent = available
          ? ("Pick or change songs for " + date + ", then share an open practice link.")
          : "Search and pick songs for each section, then share.";
      }
      if (continueBtn) continueBtn.disabled = available === 0;
      closeMassSongResultPanels();
      clearPracticeShareDropdownPad();
      setUiOverlayOpen($("practice-share-sections-modal"), true);
      syncPracticeShareBottomNavChrome();
      syncPracticeShareContinueEnabled();
    }

    function continuePracticeShareFromSections() {
      const status = $("practice-share-sections-status");
      const selectedKeys = practiceShareVisibleSlots()
        .filter((slot) => !!(selectedLyricsSongs[slot.key] || "").trim())
        .map((slot) => slot.key);
      if (!selectedKeys.length) {
        if (status) {
          status.textContent = "Pick at least one song before sharing.";
          status.hidden = false;
        }
        syncPracticeShareContinueEnabled();
        return;
      }
      practiceShareSlotFilter = new Set(selectedKeys);
      closeMassSongResultPanels();
      closePracticeShareSectionsModal({ skipNavSync: true });
      openPracticeShareModal({ keepSlotFilter: true, allowHomeDate: true });
    }

    async function collectPracticeShareSongs() {
      rebuildMassPlanSongPool();
      const songs = [];
      for (const slot of lyricSongSlots) {
        if (practiceShareSlotFilter && !practiceShareSlotFilter.has(slot.key)) continue;
        const id = selectedLyricsSongs[slot.key] || "";
        if (!id) continue;
        let row = massPlanAllSongs.find((s) => String(s.id) === String(id));
        if (!row && songCatalogData) {
          const sec = typeof catalogSectionForSlot === "function" ? catalogSectionForSlot(slot.key) : (slot.section || slot.key);
          const catalogRow = ((songCatalogData[sec] || []).find((s) => String(s.id) === String(id))) || null;
          if (catalogRow) {
            row = {
              id: String(catalogRow.id),
              title: catalogRow.title || "Song",
              author: catalogRow.author || "",
              language: catalogRow.language || "",
              section: sec,
              audio_media: catalogRow.audio_media || null,
            };
          }
        }
        if (!row) continue;
        const section = resolveMassSongSection(slot.key, row);
        const cacheKey = section + "|" + id;
        // Prefer cached lyrics; server fills gaps and always applies parish lyric overrides.
        const lyrics = (massSongLyricsCache.get(cacheKey) || "").trim();
        const payload = {
          slot_key: slot.key,
          slot_label: massSongSlotShortLabel(slot.key, slot.label),
          section: section,
          hymn_id: id,
          title: row.title || "Song",
          author: row.author || "",
          language: row.language || "",
          lyrics: lyrics,
        };
        const slotAudio = typeof getMassSectionMedia === "function" ? getMassSectionMedia("audio", slot.key) : null;
        const ytRef = (typeof isYouTubeMediaRef === "function" && isYouTubeMediaRef(slotAudio))
          ? slotAudio
          : ((typeof isYouTubeMediaRef === "function" && isYouTubeMediaRef(row.audio_media)) ? row.audio_media : null);
        const ytId = ytRef && typeof youtubeIdFromMediaRef === "function" ? youtubeIdFromMediaRef(ytRef) : "";
        if (ytId) {
          payload.youtube_id = ytId;
          payload.youtube_url = (typeof youtubeWatchUrl === "function")
            ? youtubeWatchUrl(ytId)
            : ("https://www.youtube.com/watch?v=" + ytId);
        }
        songs.push(payload);
      }
      return songs;
    }

    function renderPracticeShareQr(data, url) {
      const img = $("practice-share-qr");
      const fallback = $("practice-share-qr-fallback");
      if (!img) return;
      if (fallback) fallback.hidden = true;
      img.hidden = true;
      img.removeAttribute("src");

      function showFallback() {
        img.hidden = true;
        if (fallback) fallback.hidden = false;
      }

      function showImg(src) {
        if (!src) {
          showFallback();
          return;
        }
        img.onload = function () {
          img.hidden = false;
          if (fallback) fallback.hidden = true;
        };
        img.onerror = function () {
          if (data && data.qr_url && src !== data.qr_url && !String(src).startsWith("data:")) {
            showImg(data.qr_url + "?t=" + Date.now());
            return;
          }
          showFallback();
        };
        img.src = src;
      }

      if (data && data.qr_data_url) {
        showImg(data.qr_data_url);
        return;
      }
      if (data && data.qr_url) {
        showImg(data.qr_url + "?t=" + Date.now());
        return;
      }
      showFallback();
    }

    var practiceShareLoadingTimer = null;

    function stopPracticeShareLoadingAnim() {
      if (practiceShareLoadingTimer) {
        clearInterval(practiceShareLoadingTimer);
        practiceShareLoadingTimer = null;
      }
    }

    function startPracticeShareLoadingAnim() {
      stopPracticeShareLoadingAnim();
      const msgEl = $("practice-share-loading-msg");
      const msgs = [
        "Freezing lyrics and building your QR…",
        "Generating your leader password…",
        "Almost ready to share…",
      ];
      let i = 0;
      if (msgEl) msgEl.textContent = msgs[0];
      practiceShareLoadingTimer = setInterval(() => {
        i = (i + 1) % msgs.length;
        if (msgEl) msgEl.textContent = msgs[i];
      }, 1600);
    }

    function showPracticeShareResult(data) {
      stopPracticeShareLoadingAnim();
      const setup = $("practice-share-setup");
      const loading = $("practice-share-loading");
      const result = $("practice-share-result");
      const status = $("practice-share-status");
      const generateBtn = $("practice-share-generate");
      const cancelBtn = $("practice-share-cancel");
      const backBtn = $("practice-share-back");
      if (setup) setup.hidden = true;
      if (loading) loading.hidden = true;
      if (status) status.hidden = true;
      if (generateBtn) generateBtn.hidden = true;
      if (result) result.hidden = false;
      if (cancelBtn) cancelBtn.textContent = "Close";
      if (backBtn) backBtn.hidden = !(data && (data.restored || practiceShareOpenedFromHistory));
      practiceShareOpenedFromHistory = !!(data && (data.restored || practiceShareOpenedFromHistory));
      setPracticeShareFooterMode("result");
      const url = String(data.url || "");
      practiceShareLastUrl = url;
      practiceShareLastLeadUrl = String(data.lead_url || "").trim();
      practiceShareLastToken = String(data.token || "").trim();
      practiceShareLastMassDate = String(data.mass_date || practiceShareLastMassDate || "").trim();
      const pin = String(data.pin || "").replace(/\D/g, "");
      practiceShareLastPin = pin.length === 6 ? pin : (readStoredPracticePin(practiceShareLastToken) || "");
      if (practiceShareLastToken && practiceShareLastPin) {
        writeStoredPracticePin(practiceShareLastToken, practiceShareLastPin);
      }
      const leaderPin = String(data.leader_pin || "").replace(/\D/g, "");
      practiceShareLastLeaderPin = leaderPin.length === 6
        ? leaderPin
        : (readStoredPracticeLeaderPin(practiceShareLastToken) || "");
      if (practiceShareLastToken && practiceShareLastLeaderPin) {
        writeStoredPracticeLeaderPin(practiceShareLastToken, practiceShareLastLeaderPin);
      }

      const urlInput = $("practice-share-url");
      if (urlInput) urlInput.value = url;
      renderPracticeShareQr(data, url);
      const leadBtn = $("practice-share-lets-practice");
      if (leadBtn) leadBtn.hidden = !practiceShareLastLeadUrl;

      const choirPinEl = $("practice-share-choir-pin-value");
      if (choirPinEl) {
        choirPinEl.textContent = practiceShareLastPin
          ? practiceShareLastPin.split("").join(" ")
          : "————";
      }
      const leaderPinEl = $("practice-share-leader-pin-value");
      const leaderPinBlock = $("practice-share-leader-pin-display");
      const leaderPinMissing = $("practice-share-leader-pin-missing");
      if (practiceShareLastLeaderPin) {
        if (leaderPinEl) leaderPinEl.textContent = practiceShareLastLeaderPin.split("").join(" ");
        if (leaderPinBlock) leaderPinBlock.hidden = false;
        if (leaderPinMissing) leaderPinMissing.hidden = true;
      } else {
        if (leaderPinBlock) leaderPinBlock.hidden = true;
        if (leaderPinMissing) leaderPinMissing.hidden = false;
      }

      const meta = $("practice-share-meta");
      if (meta) {
        const exp = data.expires_at
          ? new Date(data.expires_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          : "";
        const mailNote = data.leader_pin_emailed
          ? " · leader password emailed to you"
          : (practiceShareLastLeaderPin ? " · leader password below" : "");
        meta.textContent = (data.song_count || 0) + " song(s)" + (exp ? (" · expires " + exp) : "") + mailNote;
      }
      const sub = $("practice-share-sub");
      if (sub) {
        sub.textContent = data.restored
          ? "Your active practice link. Share the link or QR with your choir; keep the leader password for yourself."
          : "Share the link or QR with your choir. The leader password is for you only — also sent to your email.";
      }
      if (data.leader_pin_emailed) {
        notify("Leader password emailed to your account.", "ok");
      } else if (practiceShareLastLeaderPin && data.leader_pin_email_error && !data.restored) {
        notify("Could not email leader password — copy it from this card.", "warn");
      }
    }

    function openPracticeShareLead() {
      const url = practiceShareLastLeadUrl;
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    async function createPracticeShareLink() {
      const status = $("practice-share-status");
      const loading = $("practice-share-loading");
      const generateBtn = $("practice-share-generate");
      const setup = $("practice-share-setup");
      const date = ($("mass-date") && $("mass-date").value || "").trim();
      if (!date) {
        if (status) {
          status.textContent = "Choose a Mass date first.";
          status.hidden = false;
        }
        return;
      }
      if (setup) setup.hidden = true;
      if (loading) loading.hidden = false;
      if (generateBtn) generateBtn.disabled = true;
      setPracticeShareFooterMode("loading");
      if (status) status.hidden = true;
      startPracticeShareLoadingAnim();
      try {
        const songs = await collectPracticeShareSongs();
        if (!songs.length) {
          throw new Error("Pick at least one song with lyrics in your plan.");
        }
        const preview = previewForMassSummary();
        const parishName = ($("settings-church-name") && $("settings-church-name").value || "").trim();
        const celebrant = ($("celebrant") && $("celebrant").value || "").trim();
        const data = await postJSON("/api/practice/share", {
          mass_date: date,
          mass_title: (preview && preview.title) ? String(preview.title) : "",
          parish_name: parishName,
          celebrant: celebrant,
          songs: songs,
          ttl_days: 0,
        });
        if (!data.ok) throw new Error(data.error || data.detail || "Could not create link.");
        showPracticeShareResult({ ...data, leader_pin: data.leader_pin, mass_date: date });
      } catch (err) {
        stopPracticeShareLoadingAnim();
        if (loading) loading.hidden = true;
        if (setup) setup.hidden = false;
        if (generateBtn) generateBtn.disabled = false;
        setPracticeShareFooterMode("");
        if (status) {
          status.textContent = err.message || "Could not create practice link.";
          status.hidden = false;
        }
      }
    }

    async function copyPracticeShareLink() {
      const url = practiceShareLastUrl || ($("practice-share-url") && $("practice-share-url").value) || "";
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        const btn = $("practice-share-copy");
        if (btn) {
          const prev = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = prev; }, 1600);
        }
      } catch (_err) {
        const input = $("practice-share-url");
        if (input) { input.focus(); input.select(); }
      }
    }

    function startNewPracticeShareFromHistory() {
      closePracticeShareHistoryModal();
      openPracticeShareSectionsModal();
    }

    function initPracticeShareUi() {
      [
        ["btn-practice-share", () => openPracticeShareHistoryModal()],
        ["btn-practice-share-mobile", () => openPracticeShareHistoryModal()],
        ["btn-practice-share-toolbar", () => openPracticeShareHistoryModal()],
        ["btn-practice-share-wizard", () => openPracticeShareHistoryModal()],
        ["btn-home-practice-share", () => openPracticeShareHistoryModal()],
        ["practice-share-history-backdrop", closePracticeShareHistoryModal],
        ["practice-share-history-close", closePracticeShareHistoryModal],
        ["practice-share-history-cancel", closePracticeShareHistoryModal],
        ["practice-share-history-new", startNewPracticeShareFromHistory],
        ["practice-share-expired-backdrop", () => closePracticeShareExpiredModal({ reopenHistory: true })],
        ["practice-share-expired-close", () => closePracticeShareExpiredModal({ reopenHistory: true })],
        ["practice-share-expired-back", () => closePracticeShareExpiredModal({ reopenHistory: true })],
        ["practice-share-back", backToPracticeShareHistory],
        ["practice-share-sections-backdrop", closePracticeShareSectionsModal],
        ["practice-share-sections-close", closePracticeShareSectionsModal],
        ["practice-share-sections-cancel", closePracticeShareSectionsModal],
        ["practice-share-sections-continue", continuePracticeShareFromSections],
        ["practice-share-backdrop", closePracticeShareModal],
        ["practice-share-close", closePracticeShareModal],
        ["practice-share-cancel", closePracticeShareModal],
        ["app-bottom-nav-peek", expandPracticeShareBottomNav],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      initPracticeShareBottomNavGestures();
      const historyList = $("practice-share-history-list");
      if (historyList) historyList.addEventListener("click", onPracticeShareHistoryClick);
      $("practice-share-generate") && $("practice-share-generate").addEventListener("click", () => {
        createPracticeShareLink();
      });
      /* Choir PIN OTP removed — open practice links use leader password only. */
      $("practice-share-copy") && $("practice-share-copy").addEventListener("click", () => {
        copyPracticeShareLink();
      });
      $("practice-share-copy-leader-pin") && $("practice-share-copy-leader-pin").addEventListener("click", async () => {
        if (!practiceShareLastLeaderPin) {
          notify("Leader password is not available on this device.", "warn");
          return;
        }
        try {
          await navigator.clipboard.writeText(practiceShareLastLeaderPin);
          notify("Leader password copied.", "ok");
        } catch (_e) {
          notify("Could not copy leader password.", "error");
        }
      });
      $("practice-share-lets-practice") && $("practice-share-lets-practice").addEventListener("click", () => {
        openPracticeShareLead();
      });
    }

    function previewForMassSummary() {
      const date = $("mass-date") && $("mass-date").value;
      if (!date) return null;
      if (flowPreviewData && flowPreviewData.ok && flowPreviewData.__previewDate === date) {
        return flowPreviewData;
      }
      if (window.__homePreview && window.__homePreview.ok && date === upcomingSundayISO()) {
        return window.__homePreview;
      }
      return null;
    }

    var GOSPEL_MOOD_TIPS = {
      triumphant: "Joyful and triumphant — resurrection light and hope.",
      solemn: "Solemn and reflective — repentance and preparation.",
      mercy: "Gentle and compassionate — mercy and healing warmth.",
      journey: "Forward-moving — call to follow Christ and serve.",
      reverent: "Reverent and worshipful — sacred Sunday storytelling.",
    };
    var MOOD_PICK_SECTIONS = [
      { key: "entrance", label: "Entrance", slotKey: "entrance", count: 1 },
      { key: "offertory", label: "Offertory", slotKey: "offertory", count: 1 },
      { key: "communion", label: "Communion", slotKeys: communionSlotKeys(massCommunionCount), count: clampMassCommunionCount(massCommunionCount) },
      { key: "recessional", label: "Recessional", slotKey: "recessional", count: 1 },
    ];
    var massMoodPickSelections = [];
    var massMoodPickExcludeIds = new Set();
    var GOSPEL_MOOD_RELATED = {
      triumphant: ["reverent"],
      solemn: ["reverent", "mercy"],
      mercy: ["solemn", "reverent"],
      journey: ["reverent", "mercy"],
      reverent: ["solemn", "journey"],
    };

    function inferGospelMoodKey(preview) {
      if (!preview || !preview.ok) return null;
      const seasonKey = String(preview.season || "").toLowerCase().replace(/\s+/g, "_");
      const blob = [
        preview.title,
        preview.gospel_reference,
        (preview.gospel_text || "").slice(0, 600),
        (preview.gospel_quote || "").slice(0, 400),
        seasonKey.replace(/_/g, " "),
      ].join(" ").toLowerCase();

      if (/\b(resurrection|risen|empty tomb|easter|alleluia|ascension|pentecost)\b/.test(blob) || ["easter", "pentecost"].includes(seasonKey)) {
        return "triumphant";
      }
      if (["lent", "advent"].includes(seasonKey) || /\b(repent|fast|desert|temptation|passion|cross|suffer)\b/.test(blob)) {
        return "solemn";
      }
      if (/\b(heal|blind|lame|paralytic|mercy|forgiv|compassion|bless|comfort|weep|touch)\b/.test(blob)) {
        return "mercy";
      }
      if (/\b(disciples|apostles|journey|road|follow|sent |mission|boat|sea|walk|teach)\b/.test(blob)) {
        return "journey";
      }
      return "reverent";
    }

    function inferGospelMoodTip(preview) {
      const key = inferGospelMoodKey(preview);
      return key ? GOSPEL_MOOD_TIPS[key] : null;
    }

    var COMPOSER_MOOD_KEYWORDS = {
      triumphant: ["alleluia", "hallelujah", "risen", "resurrection", "easter", "glory", "joyful", "joy to", "crown him", "triumph", "victory", "praise to the lord", "sing a new song"],
      solemn: ["repent", "passion", "cross", "forty days", "lent", "advent", "emmanuel", "prepare the way", "remember me", "save your people", "wait for the lord", "my song is love unknown"],
      mercy: ["mercy", "heal", "comfort", "forgiv", "compassion", "welcome", "afraid", "bread", "table", "hold your people", "tender", "bless"],
      journey: ["here i am", "send me", "follow", "go tell", "city of god", "many parts", "disciples", "mission", "road", "pilgrim", "lead me"],
      reverent: ["holy", "adore", "worship", "praise", "sanctus", "blessed", "lord of", "almighty"],
    };
    var COMPOSER_MOOD_ORDER = ["triumphant", "solemn", "mercy", "journey", "reverent"];

    function inferGospelMoodsFromText(title, author, lyrics) {
      const blob = [
        (title || "").toLowerCase(),
        (author || "").toLowerCase(),
        (lyrics || "").slice(0, 800).toLowerCase(),
      ].join(" ");
      const matched = [];
      COMPOSER_MOOD_ORDER.forEach((mood) => {
        const keywords = COMPOSER_MOOD_KEYWORDS[mood] || [];
        if (keywords.some((k) => blob.includes(k))) matched.push(mood);
      });
      return matched.length ? matched : ["reverent"];
    }

    function songGospelMoods(row) {
      if (!row) return ["reverent"];
      if (Array.isArray(row.gospel_moods) && row.gospel_moods.length) return row.gospel_moods;
      return inferGospelMoodsFromText(row.title, row.author, row.lyrics || row.id || "");
    }

    function moodMatchScore(songMoods, moodKey) {
      if (songMoods.includes(moodKey)) return 3;
      const related = GOSPEL_MOOD_RELATED[moodKey] || [];
      if (related.some((m) => songMoods.includes(m))) return 2;
      return 1;
    }

    function shuffleArray(items) {
      const arr = items.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    }

