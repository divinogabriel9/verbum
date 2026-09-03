/* Verbum SPA part 5/9: app-05-community.js
 * Mood picks, community, celebrants, parish submit, SA start
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 14000-17548
 */
    function appendSectionSongSelections(selections, sec, songs) {
      if (sec.slotKeys) {
        sec.slotKeys.forEach((slotKey, i) => {
          const row = songs[i];
          if (!row) return;
          selections.push({
            section: sec.key,
            slotKey,
            id: row.id,
            title: row.title || "",
            label: sec.label + (sec.count > 1 ? " " + (i + 1) : ""),
          });
        });
        return;
      }
      const row = songs[0];
      if (!row) return;
      selections.push({
        section: sec.key,
        slotKey: sec.slotKey,
        id: row.id,
        title: row.title || "",
        label: sec.label,
      });
    }

    function pickMoodSongsForSection(section, moodKey, count, excludeIds) {
      const rows = (songCatalogData && songCatalogData[section]) || [];
      if (!rows.length) return [];
      const exclude = excludeIds || new Set();
      const scored = rows.map((row) => {
        const moods = songGospelMoods(row);
        const match = moodMatchScore(moods, moodKey);
        const lyrics = row.has_lyrics ? 1 : 0;
        const lang = songMatchesPlanLangFilter(row, massSongPlanLanguage) ? 1 : 0;
        // Random jitter — never break ties by catalog index (first-song trap).
        const jitter = Math.random() * 0.5;
        return { row, match, score: match * 100 + lyrics * 10 + lang * 5 + jitter };
      }).filter((item) => {
        const id = String(item.row.id || "");
        return id && !exclude.has(id);
      });
      if (!scored.length) return [];
      scored.sort((a, b) => b.score - a.score);
      const bestMatch = scored[0].match;
      const minMatch = bestMatch >= 2 ? 2 : 1;
      const preferred = scored.filter((item) => item.match >= minMatch);
      const topMatch = preferred[0].match;
      const tier = preferred.filter((item) => item.match === topMatch);
      const picked = [];
      shuffleArray(tier).forEach((item) => {
        const id = String(item.row.id || "");
        if (!id || exclude.has(id)) return;
        picked.push(item.row);
        exclude.add(id);
      });
      if (picked.length < count) {
        preferred.forEach((item) => {
          if (picked.length >= count) return;
          const id = String(item.row.id || "");
          if (!id || exclude.has(id)) return;
          picked.push(item.row);
          exclude.add(id);
        });
      }
      if (picked.length < count) {
        scored.forEach((item) => {
          if (picked.length >= count) return;
          const id = String(item.row.id || "");
          if (!id || exclude.has(id)) return;
          picked.push(item.row);
          exclude.add(id);
        });
      }
      return picked.slice(0, count);
    }

    function pickRandomSongsForSection(section, count, excludeIds) {
      const rows = (songCatalogData && songCatalogData[section]) || [];
      if (!rows.length) return [];
      const exclude = excludeIds || new Set();
      const pool = rows.filter((row) => {
        const id = String(row.id || "");
        return id && !exclude.has(id);
      });
      const picked = [];
      shuffleArray(pool).forEach((row) => {
        const id = String(row.id || "");
        if (!id || exclude.has(id)) return;
        picked.push(row);
        exclude.add(id);
      });
      return picked.slice(0, count);
    }

    function buildMassMoodPickSelections(moodKey, rotateExclude) {
      const exclude = new Set(rotateExclude || []);
      const selections = [];
      MOOD_PICK_SECTIONS.forEach((sec) => {
        const songs = pickMoodSongsForSection(sec.key, moodKey, sec.count || 1, exclude);
        appendSectionSongSelections(selections, sec, songs);
      });
      return selections;
    }

    function buildRandomCatalogSelections(rotateExclude) {
      const exclude = new Set(rotateExclude || []);
      const selections = [];
      MOOD_PICK_SECTIONS.forEach((sec) => {
        const songs = pickRandomSongsForSection(sec.key, sec.count || 1, exclude);
        appendSectionSongSelections(selections, sec, songs);
      });
      return selections;
    }

    function renderMassMoodPickList(selections) {
      const listEl = $("mass-summary-mood-picks");
      if (!listEl) return;
      if (!selections.length) {
        listEl.innerHTML = "";
        return;
      }
      listEl.innerHTML = selections.map((pick) => (
        "<li class=\"mass-summary-mood-pick\">" +
          "<span class=\"mass-summary-mood-pick__cat\">" + escapeHtml(pick.label) + "</span>" +
          "<span class=\"mass-summary-mood-pick__song\">" + escapeHtml(pick.title || "—") + "</span>" +
        "</li>"
      )).join("");
    }

    function computeMassMoodPickRefresh() {
      const preview = previewForMassSummary();
      const moodKey = preview ? inferGospelMoodKey(preview) : null;
      if (!moodKey || !songCatalogData) return null;
      massMoodPickSelections.forEach((p) => massMoodPickExcludeIds.add(String(p.id || "")));
      let next = buildMassMoodPickSelections(moodKey, massMoodPickExcludeIds).map((p) => Object.assign({ moodKey }, p));
      if (!next.length) {
        massMoodPickExcludeIds = new Set();
        next = buildMassMoodPickSelections(moodKey, massMoodPickExcludeIds).map((p) => Object.assign({ moodKey }, p));
      }
      massMoodPickSelections = next;
      return massMoodPickSelections;
    }

    async function refreshMassMoodPicks() {
      const wrapEl = $("mass-summary-recs");
      const listEl = $("mass-summary-mood-picks");
      const refreshBtn = $("mass-summary-recs-refresh");
      const addBtn = $("mass-summary-recs-add");
      if (!listEl) return;
      const preview = previewForMassSummary();
      const moodKey = preview ? inferGospelMoodKey(preview) : null;
      if (!moodKey || !songCatalogData) return;
      await runEmilRefresh({
        container: wrapEl,
        trigger: refreshBtn,
        contentEl: listEl,
        skeletonHtml: massMoodPickSkeletonHtml(massMoodPickSelections.length || 5),
        task: async () => computeMassMoodPickRefresh(),
        reveal: (selections) => {
          if (!selections || !selections.length) {
            listEl.innerHTML = "";
            if (addBtn) addBtn.disabled = true;
            return;
          }
          renderMassMoodPickList(selections);
          if (addBtn) addBtn.disabled = false;
        },
        staggerSelector: ".mass-summary-mood-pick",
      });
    }

    function updateMassSummaryMoodPicks() {
      const wrapEl = $("mass-summary-recs");
      const listEl = $("mass-summary-mood-picks");
      const addBtn = $("mass-summary-recs-add");
      if (!listEl) return;
      const preview = previewForMassSummary();
      const moodKey = preview ? inferGospelMoodKey(preview) : null;
      if (!moodKey || !songCatalogData) {
        massMoodPickSelections = [];
        if (wrapEl) wrapEl.hidden = true;
        listEl.innerHTML = "";
        if (addBtn) addBtn.disabled = true;
        return;
      }
      if (!massMoodPickSelections.length || (massMoodPickSelections[0] && massMoodPickSelections[0].moodKey !== moodKey)) {
        massMoodPickExcludeIds = new Set();
        massMoodPickSelections = buildMassMoodPickSelections(moodKey, massMoodPickExcludeIds).map((p) => Object.assign({ moodKey }, p));
      }
      if (!massMoodPickSelections.length) {
        if (wrapEl) wrapEl.hidden = true;
        listEl.innerHTML = "";
        if (addBtn) addBtn.disabled = true;
        return;
      }
      if (wrapEl) wrapEl.hidden = false;
      renderMassMoodPickList(massMoodPickSelections);
      if (addBtn) addBtn.disabled = false;
    }

    function applyMassMoodPicksToSongPlan() {
      if (!massMoodPickSelections.length) return;
      massMoodPickSelections.forEach((pick) => {
        if (!pick.slotKey || !pick.id) return;
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(pick.slotKey, pick.id);
        else selectedLyricsSongs[pick.slotKey] = pick.id;
        updateMassSlotChip(pick.slotKey);
        updateMassSongPreviewButton(pick.slotKey);
      });
      renderFlowSongCount();
      notify("Suggested songs added to your plan.", "ok");
    }

    function selectionsFromSongIds(defaults, moodKey) {
      const out = [];
      const mood = moodKey || "reverent";
      MOOD_PICK_SECTIONS.forEach((sec) => {
        if (sec.slotKeys) {
          sec.slotKeys.forEach((slotKey, i) => {
            const id = String((defaults && defaults[slotKey]) || "").trim();
            if (!id) return;
            const row = ((songCatalogData && songCatalogData[sec.key]) || []).find((r) => String(r.id) === id);
            out.push({
              section: sec.key,
              slotKey,
              id,
              title: (row && row.title) || catalogSongTitle(sec.key, id) || id,
              label: sec.label + (sec.count > 1 ? " " + (i + 1) : ""),
              moodKey: mood,
            });
          });
          return;
        }
        const id = String((defaults && defaults[sec.slotKey]) || "").trim();
        if (!id) return;
        const row = ((songCatalogData && songCatalogData[sec.key]) || []).find((r) => String(r.id) === id);
        out.push({
          section: sec.key,
          slotKey: sec.slotKey,
          id,
          title: (row && row.title) || catalogSongTitle(sec.key, id) || id,
          label: sec.label,
          moodKey: mood,
        });
      });
      return out;
    }

    function songPlanLooksLikeCatalogHead() {
      if (!songCatalogData) return false;
      const checks = [
        ["entrance", "entrance", 0],
        ["offertory", "offertory", 0],
        ["recessional", "recessional", 0],
        ["communion_1", "communion", 0],
        ["communion_2", "communion", 1],
      ];
      let hits = 0;
      let compared = 0;
      checks.forEach(([slot, sec, idx]) => {
        const id = String(selectedLyricsSongs[slot] || "").trim();
        const row = ((songCatalogData[sec] || [])[idx]) || null;
        if (!id || !row || !row.id) return;
        compared += 1;
        if (String(row.id) === id) hits += 1;
      });
      return compared >= 3 && hits >= Math.min(3, compared);
    }

    // Legacy EN/TL "first unused" defaults (removed server-side). Sticky drafts still carry these.
    var LEGACY_FIRST_SONG_DEFAULTS = {
      entrance: "sing_new_song",
      offertory: "gift_finest_wheat",
      recessional: "we_are_called",
      communion_1: "manalig_ka",
      communion_2: "isang_bansa",
    };

    function songPlanLooksLikeLegacyFirstDefaults() {
      let hits = 0;
      let compared = 0;
      Object.keys(LEGACY_FIRST_SONG_DEFAULTS).forEach((slot) => {
        const id = String(selectedLyricsSongs[slot] || "").trim();
        if (!id) return;
        compared += 1;
        if (id === LEGACY_FIRST_SONG_DEFAULTS[slot]) hits += 1;
      });
      return compared >= 3 && hits >= Math.min(3, compared);
    }

    function songPlanNeedsMoodReload() {
      return songPlanLooksLikeCatalogHead() || songPlanLooksLikeLegacyFirstDefaults();
    }

    function applySongSelectionsToPlan(selections) {
      if (!selections || !selections.length) return false;
      massMoodPickSelections = selections;
      massMoodPickExcludeIds = new Set();
      selections.forEach((pick) => {
        if (!pick.slotKey || !pick.id) return;
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(pick.slotKey, pick.id);
        else selectedLyricsSongs[pick.slotKey] = pick.id;
        massMoodPickExcludeIds.add(String(pick.id));
      });
      return true;
    }

    function applyGospelMoodDefaultsToSongPlan() {
      const preview = flowPreviewData;
      const moodKey = (preview && inferGospelMoodKey(preview)) || "reverent";
      const serverDefaults = (preview && preview.default_song_selections) || {};
      massMoodPickExcludeIds = new Set();

      // 1) Client mood ranking from catalog (inferred moods included in lite API).
      let selections = [];
      if (songCatalogData) {
        selections = buildMassMoodPickSelections(moodKey, massMoodPickExcludeIds).map((p) =>
          Object.assign({ moodKey }, p)
        );
      }

      // 2) Server gospel-mood defaults when client pool is thin.
      if (selections.length < 4) {
        const fromServer = selectionsFromSongIds(serverDefaults, moodKey);
        if (fromServer.length >= 4) {
          return applySongSelectionsToPlan(fromServer);
        }
        if (fromServer.length > selections.length) {
          selections = fromServer;
        }
      }

      // 3) Random catalog picks — never first-in-section order.
      if (selections.length < 4 && songCatalogData) {
        massMoodPickExcludeIds = new Set(selections.map((p) => String(p.id || "")).filter(Boolean));
        const randomFill = buildRandomCatalogSelections(massMoodPickExcludeIds).map((p) =>
          Object.assign({ moodKey }, p)
        );
        const bySlot = {};
        selections.concat(randomFill).forEach((p) => {
          if (p.slotKey && p.id && !bySlot[p.slotKey]) bySlot[p.slotKey] = p;
        });
        selections = Object.keys(bySlot).map((k) => bySlot[k]);
      }

      if (!selections.length) return false;
      return applySongSelectionsToPlan(selections);
    }

    function formatGospelMoodsLabel(moods) {
      if (!Array.isArray(moods) || !moods.length) return "";
      const labels = { triumphant: "Triumphant", solemn: "Solemn", mercy: "Mercy", journey: "Journey", reverent: "Reverent" };
      return moods.map((m) => labels[m] || m).join(", ");
    }

    var composerGospelMoods = [];

    function setComposerSongLanguage(value) {
      const sel = $("lyrics-save-language");
      if (!sel) return;
      const lang = String(value || "").trim();
      const options = ["English", "Tagalog", "Latin", "Mix"];
      if (lang && options.includes(lang)) {
        sel.value = lang;
      } else {
        sel.value = "";
      }
      syncVerbumSelectTrigger(sel);
    }

    function setComposerSongSection(value) {
      const sel = $("lyrics-save-section");
      if (!sel) return;
      const sec = String(value || "").trim().toLowerCase();
      const options = ["entrance", "offertory", "communion", "recessional", "meditation"];
      if (options.includes(sec)) sel.value = sec;
      else sel.value = "";
      syncVerbumSelectTrigger(sel);
    }

    function inferComposerSongMoods() {
      const title = ($("lyrics-save-title") && $("lyrics-save-title").value.trim()) || "";
      const author = ($("lyrics-save-author") && $("lyrics-save-author").value.trim()) || "";
      let lyrics = "";
      if (lyricBlocks.length) {
        flushLyricBlocksFromDom();
        lyrics = serializedLyrics();
      } else if ($("lyrics-input")) {
        lyrics = $("lyrics-input").value.trim();
      }
      return inferGospelMoodsFromText(title, author, lyrics);
    }

    function getComposerSongMoods() {
      if (Array.isArray(composerGospelMoods) && composerGospelMoods.length) return composerGospelMoods.slice();
      return inferComposerSongMoods();
    }

    function readSongSaveMoodChecks() {
      return Array.from(document.querySelectorAll("[data-save-mood-opt]:checked")).map((el) => el.value);
    }

    function setSongSaveMoodChecks(moods) {
      const picked = new Set(Array.isArray(moods) ? moods : []);
      document.querySelectorAll("[data-save-mood-opt]").forEach((el) => {
        el.checked = picked.has(el.value);
      });
    }

    function highlightDetectedSaveMoods(detected) {
      const detectedSet = new Set(Array.isArray(detected) ? detected : []);
      document.querySelectorAll("#song-save-mood-grid [data-save-mood-key]").forEach((label) => {
        label.classList.toggle("is-detected", detectedSet.has(label.dataset.saveMoodKey));
      });
      document.querySelectorAll("#song-metadata-moods [data-gospel-mood-key]").forEach((label) => {
        label.classList.toggle("is-detected", detectedSet.has(label.dataset.gospelMoodKey));
      });
    }

    function clearMetadataMoodAttention() {
      const moods = $("song-metadata-moods");
      if (moods) moods.classList.remove("is-attention");
      const errEl = $("song-metadata-mood-error");
      if (errEl) errEl.hidden = true;
      document.querySelectorAll("#song-metadata-moods [data-gospel-mood-key]").forEach((label) => {
        label.classList.remove("is-detected");
      });
    }

    function pulseMetadataMoodAttention(detected) {
      const moods = $("song-metadata-moods");
      if (moods) moods.classList.add("is-attention");
      highlightDetectedSaveMoods(detected || []);
      const hintEl = $("song-metadata-mood-hint");
      if (hintEl) {
        const detectedLabel = formatGospelMoodsLabel(detected || []);
        hintEl.textContent = detectedLabel
          ? "Pulsing options match our keyword guess: " + detectedLabel + ". Adjust if needed."
          : "Select at least one Gospel mood before saving.";
      }
    }

    function readSongMetadataMoodChecks() {
      return Array.from(document.querySelectorAll("[data-gospel-mood-opt]:checked")).map((el) => el.value);
    }

    function setSongMetadataMoodChecks(moods) {
      const picked = new Set(Array.isArray(moods) ? moods : []);
      document.querySelectorAll("[data-gospel-mood-opt]").forEach((el) => {
        el.checked = picked.has(el.value);
      });
      document.querySelectorAll("[data-composer-mood-opt]").forEach((el) => {
        el.checked = picked.has(el.value);
      });
    }

    function readComposerAccordionMoodChecks() {
      return Array.from(document.querySelectorAll("[data-composer-mood-opt]:checked")).map((el) => el.value);
    }

    function syncComposerAccordionMoodsFromState() {
      setSongMetadataMoodChecks(Array.isArray(composerGospelMoods) ? composerGospelMoods : []);
    }

    function updateMassSummaryGospelTip() {
      const tipEl = $("mass-summary-gospel-tip");
      const textEl = $("mass-summary-gospel-tip-text");
      if (!tipEl || !textEl) return;
      const preview = previewForMassSummary();
      const moodKey = preview ? inferGospelMoodKey(preview) : null;
      const mood = moodKey ? GOSPEL_MOOD_TIPS[moodKey] : null;
      const ref = preview && preview.gospel_reference ? preview.gospel_reference.trim() : "";
      if (mood) {
        textEl.textContent = mood;
        tipEl.title = ref ? ref + " — " + mood : mood;
      } else {
        textEl.textContent = "Load readings to see this Sunday’s Gospel mood.";
        tipEl.title = "";
      }
      if (moodKey && massMoodPickSelections.length && massMoodPickSelections[0].moodKey !== moodKey) {
        massMoodPickSelections = [];
        massMoodPickExcludeIds = new Set();
      }
      updateMassSummaryMoodPicks();
    }

    function renderMassSummarySidebar() {
      const dateInp = $("mass-date");
      const dateLabel = $("mass-summary-date-label");
      const seasonLabel = $("mass-summary-season-label");
      const langSel = $("mass-song-plan-lang");
      const totalEl = $("mass-summary-song-total");
      const progress = $("mass-summary-progress");
      const progressFill = $("mass-summary-progress-fill");
      const summaryPreview = previewForMassSummary();
      if (dateLabel && dateInp) dateLabel.textContent = formatMassSummaryDate(dateInp.value);
      if (seasonLabel) {
        const season = summaryPreview ? formatLiturgicalSeasonLabel(summaryPreview.season || "") : "Ordinary Time";
        const year = summaryPreview ? formatLectionaryYearLabel(summaryPreview.lectionary_cycle || "") : "";
        seasonLabel.textContent = year ? season + ", " + year : season;
      }
      updateMassSummaryGospelTip();
      if (langSel && langSel.value !== massSongPlanLanguage) {
        if ([...langSel.options].some((o) => o.value === massSongPlanLanguage)) {
          langSel.value = massSongPlanLanguage;
          refreshVerbumSelect(langSel);
        }
      }
      const total = lyricSongSlots.length;
      if (totalEl) totalEl.textContent = String(total);
      const n = selectedLyricsSongCount();
      if (progress) {
        progress.setAttribute("aria-valuemax", String(total));
        progress.setAttribute("aria-valuenow", String(n));
        progress.setAttribute("aria-valuetext", n + " of " + total + " songs selected");
      }
      if (progressFill) progressFill.style.width = total ? ((n / total) * 100) + "%" : "0%";
      updateMassSongAddButton();
    }

    function getActiveFlowTab() {
      const selected = document.querySelector(".flow-builder-tabs [aria-selected=\"true\"]");
      return selected && selected.dataset.flowTab ? selected.dataset.flowTab : "setup";
    }

    function syncFlowDockVisibility(activeTab) {
      const flowDock = $("flow-dock-actions");
      if (flowDock) flowDock.hidden = true;
      document.body.classList.remove("flow-dock-visible");
    }

    /* Mass setup cards no longer paint an interactive red dot field on hover. */
    (function initMassCardDots() {
      const ids = [];
      const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const BASE = { r: 161, g: 15, b: 13 };   // app red (--accent #a10f0d)
      const GLOW = { r: 185, g: 28, b: 28 };   // berry glow (--liturgical-glow #b91c1c)
      const DOT_SIZE = 2;
      const GAP = 12;
      const PROXIMITY = 110;
      const GLOW_INTENSITY = 1;
      const WAVE_SPEED = 0.5;

      function setupCard(card) {
        if (!card || card.dataset.dotsBound === "1") return;
        card.dataset.dotsBound = "1";

        const wrap = document.createElement("div");
        wrap.className = "flow-card-dots-wrap";
        const canvas = document.createElement("canvas");
        canvas.className = "flow-card-dots";
        canvas.setAttribute("aria-hidden", "true");
        wrap.appendChild(canvas);
        card.insertBefore(wrap, card.firstChild);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let dots = [];
        let dpr = 1;
        const mouse = { x: -1000, y: -1000 };
        let raf = null;
        let hovering = false;
        let startTime = Date.now();

        function buildGrid() {
          const rect = card.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          dpr = window.devicePixelRatio || 1;
          canvas.width = Math.round(rect.width * dpr);
          canvas.height = Math.round(rect.height * dpr);
          canvas.style.width = rect.width + "px";
          canvas.style.height = rect.height + "px";
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const cell = DOT_SIZE + GAP;
          const cols = Math.ceil(rect.width / cell) + 1;
          const rows = Math.ceil(rect.height / cell) + 1;
          const offX = (rect.width - (cols - 1) * cell) / 2;
          const offY = (rect.height - (rows - 1) * cell) / 2;
          dots = [];
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              dots.push({ x: offX + col * cell, y: offY + row * cell, baseOpacity: 0.05 + Math.random() * 0.05 });
            }
          }
          return true;
        }

        function clear() {
          const rect = card.getBoundingClientRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
        }

        function drawStatic() {
          if (!dots.length && !buildGrid()) return;
          clear();
          for (const d of dots) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, DOT_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(" + BASE.r + "," + BASE.g + "," + BASE.b + "," + d.baseOpacity + ")";
            ctx.fill();
          }
        }

        function draw() {
          clear();
          const mx = mouse.x;
          const my = mouse.y;
          const proxSq = PROXIMITY * PROXIMITY;
          const time = (Date.now() - startTime) * 0.001 * WAVE_SPEED;
          for (const d of dots) {
            const dx = d.x - mx;
            const dy = d.y - my;
            const distSq = dx * dx + dy * dy;
            const wave = Math.sin(d.x * 0.02 + d.y * 0.02 + time) * 0.5 + 0.5;
            let opacity = d.baseOpacity + wave * 0.05;
            let scale = 1 + wave * 0.2;
            let r = BASE.r;
            let g = BASE.g;
            let b = BASE.b;
            let glow = 0;
            if (distSq < proxSq) {
              const dist = Math.sqrt(distSq);
              const t = 1 - dist / PROXIMITY;
              const e = t * t * (3 - 2 * t);
              r = Math.round(BASE.r + (GLOW.r - BASE.r) * e);
              g = Math.round(BASE.g + (GLOW.g - BASE.g) * e);
              b = Math.round(BASE.b + (GLOW.b - BASE.b) * e);
              opacity = Math.min(0.95, opacity + e * 0.75);
              scale = scale + e * 0.9;
              glow = e * GLOW_INTENSITY;
            }
            const radius = (DOT_SIZE / 2) * scale;
            if (glow > 0) {
              const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, radius * 4);
              grd.addColorStop(0, "rgba(" + GLOW.r + "," + GLOW.g + "," + GLOW.b + "," + (glow * 0.4) + ")");
              grd.addColorStop(0.5, "rgba(" + GLOW.r + "," + GLOW.g + "," + GLOW.b + "," + (glow * 0.1) + ")");
              grd.addColorStop(1, "rgba(" + GLOW.r + "," + GLOW.g + "," + GLOW.b + ",0)");
              ctx.beginPath();
              ctx.arc(d.x, d.y, radius * 4, 0, Math.PI * 2);
              ctx.fillStyle = grd;
              ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
            ctx.fill();
          }
          // Self-terminate if still hovering but the card was hidden (e.g. SPA route
          // change sets the page to display:none, which does not reliably fire
          // mouseleave). Without this the rAF loop runs forever on a hidden canvas.
          if (hovering && card.offsetParent !== null) {
            raf = requestAnimationFrame(draw);
          } else {
            hovering = false;
            raf = null;
          }
        }

        function start() {
          if (prefersReduced || card.offsetParent === null) return;
          buildGrid();
          hovering = true;
          startTime = Date.now();
          if (!raf) raf = requestAnimationFrame(draw);
        }

        function stop() {
          hovering = false;
          mouse.x = -1000;
          mouse.y = -1000;
          if (raf) { cancelAnimationFrame(raf); raf = null; }
          drawStatic();
        }

        card.addEventListener("mouseenter", start);
        card.addEventListener("mousemove", (e) => {
          const rect = canvas.getBoundingClientRect();
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;
        });
        card.addEventListener("mouseleave", stop);

        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(() => {
            if (buildGrid() && !hovering) drawStatic();
          });
          ro.observe(card);
        }

        drawStatic();
      }

      ids.forEach((id) => setupCard(document.getElementById(id)));
    })();


    function songPlanSearchKeyFromInput(inp) {
      if (!inp || !inp.id) return "";
      if (inp.id.indexOf("mass-song-q-") === 0) return inp.id.slice("mass-song-q-".length);
      if (inp.id.indexOf("ps-song-q-") === 0) return inp.id.slice("ps-song-q-".length);
      return "";
    }

    function syncCustomSlotLabel(key, rawValue, finalize) {
      const slot = lyricSongSlots.find((s) => s.key === key);
      if (!slot || !slot.custom) return;
      if (finalize) {
        slot.label = (rawValue || "").trim();
      } else {
        slot.label = rawValue || "";
      }
      const display = ((finalize ? slot.label : rawValue) || "").trim() || "section";
      ["mass-song-q-", "ps-song-q-"].forEach((prefix) => {
        const searchInp = $(prefix + key);
        if (searchInp) {
          searchInp.placeholder = "Search " + display.toLowerCase() + "…";
          searchInp.setAttribute("aria-label", "Search " + display);
        }
      });
      document.querySelectorAll("[data-mass-song-delete=\"" + key + "\"]").forEach((delBtn) => {
        delBtn.setAttribute("aria-label", "Delete " + display + " section");
        delBtn.title = "Delete section";
      });
    }

    function clearSongPlanSearchUi(key) {
      ["mass-song-q-", "ps-song-q-"].forEach((prefix) => {
        const inp = $(prefix + key);
        if (inp) inp.value = "";
      });
      songPlanResultsBoxes(key).forEach((box) => {
        closeVbDropdownPanel(box);
        markSongPlanResultsOpen(box, false);
        box.innerHTML = "";
      });
    }

    function bindMassSongPlanRoot(root) {
      if (!root || root.dataset.songPlanBound) return;
      root.dataset.songPlanBound = "1";

      root.addEventListener("mousedown", (e) => {
        const btn = e.target.closest("button[data-pick-slot]");
        if (!btn || !root.contains(btn)) return;
        e.preventDefault();
        const key = btn.dataset.pickSlot;
        const pickId = btn.dataset.pickId;
        if (!key) return;
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(key, pickId || "");
        else selectedLyricsSongs[key] = pickId || "";
        clearSongPlanSearchUi(key);
        updateMassSlotChip(key);
        updateMassSongPreviewButton(key);
        renderFlowSongCount();
        if (root.id === "practice-share-song-plan") {
          window.requestAnimationFrame(() => focusNextPracticeShareSection(key));
        }
      });

      root.addEventListener("input", (e) => {
        const labelInp = e.target.closest("[data-custom-label]");
        if (labelInp && root.contains(labelInp)) {
          syncCustomSlotLabel(labelInp.dataset.customLabel, labelInp.value, false);
          return;
        }
        const inp = e.target.closest(".mass-song-search-input");
        if (!inp || !root.contains(inp)) return;
        const key = songPlanSearchKeyFromInput(inp);
        if (!key) return;
        if (root.id === "practice-share-song-plan") {
          scrollPracticeShareSectionIntoView(key, { dropdownRoom: 260 });
        }
        clearTimeout(massPlanSearchDebounce);
        massPlanSearchDebounce = setTimeout(() => {
          const rows = filterMassPlanSongs(inp.value);
          const wrap = inp.closest(".mass-song-plan-row__search");
          const preferred = wrap ? wrap.querySelector(".mass-song-results") : null;
          renderMassSongResults(key, rows, inp.value, preferred);
          if (root.id === "practice-share-song-plan") {
            scrollPracticeShareSectionIntoView(key, { dropdownRoom: 260 });
          }
        }, 100);
      });

      root.addEventListener("blur", (e) => {
        const labelInp = e.target.closest("[data-custom-label]");
        if (!labelInp || !root.contains(labelInp)) return;
        syncCustomSlotLabel(labelInp.dataset.customLabel, labelInp.value, true);
        const slot = lyricSongSlots.find((s) => s.key === labelInp.dataset.customLabel);
        if (slot) labelInp.value = slot.label;
      }, true);

      root.addEventListener("click", (e) => {
        const addComposer = e.target.closest(".mass-song-add-composer-btn");
        if (addComposer && root.contains(addComposer)) {
          e.preventDefault();
          navigateToComposerWithMassSearch(
            addComposer.dataset.massAddQuery || "",
            addComposer.dataset.massAddComposer || "",
            { openGoogle: true }
          );
          return;
        }
        const prev = e.target.closest(".mass-song-preview-btn");
        if (prev && root.contains(prev) && !prev.classList.contains("is-disabled")) {
          const slotKey = prev.dataset.previewSlot;
          if (slotKey) openMassSongPreview(slotKey);
          return;
        }
        const audioBtn = e.target.closest(".mass-song-audio-btn[data-mass-song-audio]");
        if (audioBtn && root.contains(audioBtn)) {
          e.preventDefault();
          const slotKey = audioBtn.getAttribute("data-mass-song-audio");
          if (slotKey) playMassSectionAudio(slotKey, audioBtn);
          return;
        }
        const titleLink = e.target.closest(".mass-song-plan-card__title.is-audio-linkable");
        if (titleLink && root.contains(titleLink) && !e.target.closest("[data-mass-song-clear]")) {
          e.preventDefault();
          const card = titleLink.closest(".mass-song-plan-card[data-slot-key]");
          const slotKey = card && card.getAttribute("data-slot-key");
          if (slotKey) openMassSlotAudioLinkFromTitle(slotKey);
          return;
        }
        const mediaYoutubePlay = e.target.closest("[data-mw-play-youtube]");
        if (mediaYoutubePlay && root.contains(mediaYoutubePlay)) {
          e.preventDefault();
          const slotKey = mediaYoutubePlay.getAttribute("data-mw-media-slot");
          if (slotKey) playMassSectionYouTube(slotKey, mediaYoutubePlay);
          return;
        }
        const mediaVideoPlay = e.target.closest("[data-mw-play-video]");
        if (mediaVideoPlay && root.contains(mediaVideoPlay)) {
          e.preventDefault();
          const slotKey = mediaVideoPlay.getAttribute("data-mw-media-slot");
          if (slotKey) playMassSectionVideo(slotKey, mediaVideoPlay);
          return;
        }
        const slideModeBtn = e.target.closest("[data-mass-song-slide-mode-val]");
        if (slideModeBtn && root.contains(slideModeBtn)) {
          e.preventDefault();
          const slot = slideModeBtn.getAttribute("data-mass-song-slide-mode-slot");
          const mode = slideModeBtn.getAttribute("data-mass-song-slide-mode-val");
          if (slot && mode) void chooseMassSongSlideMode(slot, mode);
          return;
        }
        const ytLink = e.target.closest("[data-mw-link-youtube]");
        if (ytLink && root.contains(ytLink)) {
          e.preventDefault();
          const slot = ytLink.getAttribute("data-mw-media-slot");
          if (slot) openMassMediaPickModal("audio", slot, { youtubeOnly: true });
          return;
        }
        const mediaLink = e.target.closest("[data-mw-link-media]");
        if (mediaLink && root.contains(mediaLink)) {
          e.preventDefault();
          const kind = mediaLink.getAttribute("data-mw-link-media");
          const slot = mediaLink.getAttribute("data-mw-media-slot");
          if (kind && slot) openMassMediaPickModal(kind, slot);
          return;
        }
        const del = e.target.closest("[data-mass-song-delete]");
        if (del && root.contains(del)) {
          const key = del.dataset.massSongDelete;
          const slot = lyricSongSlots.find((s) => s.key === key);
          if (!slot) return;
          const name = massSongSlotShortLabel(slot.key, slot.label) || (slot.label || "").trim() || "this section";
          if (root.id === "practice-share-song-plan") {
            if (!window.confirm("Remove \"" + name + "\" from this share?")) return;
            if (slot.custom) {
              lyricSongSlots = lyricSongSlots.filter((s) => s.key !== key);
              if (typeof syncMassSlotMediaToSong === "function") syncMassSlotMediaToSong(key, "");
              delete selectedLyricsSongs[key];
            } else {
              practiceShareExcludedSlots.add(key);
            }
            closeMassSongResultPanels();
            renderPracticeShareSongPlan({ skipMassSync: !slot.custom });
            if (slot.custom) renderMassSongPlan();
            return;
          }
          if (!slot.custom) return;
          if (!window.confirm("Delete \"" + name + "\"? Any selected song for this section will be removed.")) return;
          lyricSongSlots = lyricSongSlots.filter((s) => s.key !== key);
          if (typeof syncMassSlotMediaToSong === "function") syncMassSlotMediaToSong(key, "");
          delete selectedLyricsSongs[key];
          renderMassSongPlan();
          return;
        }
        const clr = e.target.closest("[data-mass-song-clear]");
        if (!clr || !root.contains(clr)) return;
        const key = clr.dataset.massSongClear;
        if (!key) return;
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(key, "");
        else {
          selectedLyricsSongs[key] = "";
          if (typeof setMassSongVideoMode === "function") setMassSongVideoMode(key, false, { quiet: true });
        }
        clearSongPlanSearchUi(key);
        updateMassSlotChip(key);
        updateMassSongPreviewButton(key);
        renderFlowSongCount();
        if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
      });

      root.addEventListener("keydown", (e) => {
        const titleLink = e.target.closest(".mass-song-plan-card__title.is-audio-linkable");
        if (titleLink && root.contains(titleLink) && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          const card = titleLink.closest(".mass-song-plan-card[data-slot-key]");
          const slotKey = card && card.getAttribute("data-slot-key");
          if (slotKey) openMassSlotAudioLinkFromTitle(slotKey);
          return;
        }
        const inp = e.target.closest(".mass-song-search-input");
        if (!inp || !root.contains(inp)) return;
        const key = songPlanSearchKeyFromInput(inp);
        if (!key || e.key !== "Enter") return;
        const query = String(inp.value || "").trim();
        if (!query) return;
        const rows = filterMassPlanSongs(inp.value);
        if (rows.length) return;
        e.preventDefault();
        navigateToComposerWithMassSearch(query, key, { openGoogle: true });
      });

      root.addEventListener("focusin", (e) => {
        const inp = e.target.closest(".mass-song-search-input");
        if (!inp || !root.contains(inp)) return;
        const key = songPlanSearchKeyFromInput(inp);
        if (!key) return;
        // Practice share: only open results after the user types (not on bare focus / modal open).
        if (root.id === "practice-share-song-plan") {
          scrollPracticeShareSectionIntoView(key, { dropdownRoom: 260 });
          if (!String(inp.value || "").trim()) {
            closeMassSongResultPanels();
            return;
          }
        }
        closeMassSongResultPanels(key);
        const rows = filterMassPlanSongs(inp.value);
        const wrap = inp.closest(".mass-song-plan-row__search");
        const preferred = wrap ? wrap.querySelector(".mass-song-results") : null;
        renderMassSongResults(key, rows, inp.value, preferred);
        if (root.id === "practice-share-song-plan") {
          window.requestAnimationFrame(() => {
            scrollPracticeShareSectionIntoView(key, { dropdownRoom: 260 });
          });
        }
      }, true);
    }

    bindMassSongPlanRoot($("mass-song-plan"));
    bindMassSongPlanRoot($("practice-share-song-plan"));

    function addCustomMassSongSection(focusInPracticeShare) {
      if (lyricSongSlots.length >= MASS_SONG_PLAN_MAX_SECTIONS) return;
      massCustomSlotSeq += 1;
      const key = "custom_" + massCustomSlotSeq;
      lyricSongSlots.push({ key, label: "", section: "meditation", custom: true });
      selectedLyricsSongs[key] = "";
      renderMassSongPlan();
      const scope = focusInPracticeShare ? $("practice-share-song-plan") : $("mass-song-plan");
      const labelInp = (scope || document).querySelector("[data-custom-label=\"" + key + "\"]");
      if (labelInp) window.requestAnimationFrame(() => labelInp.focus());
    }

    $("mass-song-add-custom") && $("mass-song-add-custom").addEventListener("click", () => addCustomMassSongSection(false));
    $("practice-share-add-section") && $("practice-share-add-section").addEventListener("click", () => addCustomMassSongSection(true));
    bindMassCommunionCountUi();

    function selectedLyricsSongCount() {
      return lyricSongSlots.filter((slot) => !!(selectedLyricsSongs[slot.key] || "")).length;
    }

    function renderFlowSongCount() {
      const n = selectedLyricsSongCount();
      const el = $("flow-song-count");
      if (el) el.textContent = String(n);
      const r = $("flow-reading-loaded");
      if (r) {
        r.textContent = (flowPreviewData && flowPreviewData.ok) ? "Loaded" : "—";
      }
      renderMassSummarySidebar();
    }

    $("mass-song-plan-lang") && $("mass-song-plan-lang").addEventListener("change", (event) => {
      massSongPlanLanguage = event.target.value || "all";
      try {
        localStorage.setItem(MASS_SONG_LANG_KEY, massSongPlanLanguage);
      } catch (_e) {
        /* ignore */
      }
      massMoodPickSelections = [];
      massMoodPickExcludeIds = new Set();
      renderMassSummarySidebar();
      lyricSongSlots.forEach((slot) => {
        songPlanResultsBoxes(slot.key).forEach((box) => {
          if (box.hidden) return;
          const wrap = box.closest(".mass-song-plan-row__search");
          const inp = wrap ? wrap.querySelector(".mass-song-search-input") : null;
          if (!inp) return;
          renderMassSongResults(slot.key, filterMassPlanSongs(inp.value), inp.value, box);
        });
      });
    });

    $("mass-summary-recs-refresh") && $("mass-summary-recs-refresh").addEventListener("click", () => refreshMassMoodPicks());
    $("mass-summary-recs-add") && $("mass-summary-recs-add").addEventListener("click", () => applyMassMoodPicksToSongPlan());

    $("btn-load-flow-inline") && $("btn-load-flow-inline").addEventListener("click", () => loadFlowData(false));
    $("btn-generate-flow-inline") && $("btn-generate-flow-inline").addEventListener("click", () => {
      const gen = $("btn-generate-flow");
      if (gen) gen.click();
    });

    document.querySelectorAll(".mass-summary-link[data-route]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showRoute(link.dataset.route);
      });
    });

    (function initFlowBuilderTabs() {
      const tablist = document.querySelector(".flow-builder-tabs");
      if (!tablist) return;
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const panels = Array.from(document.querySelectorAll("#flow-page [data-flow-panel]"));
      function activateFlowTab(name) {
        if (typeof closeHeaderMenus === "function") closeHeaderMenus();
        tabs.forEach((tab) => {
          const on = tab.dataset.flowTab === name;
          tab.setAttribute("aria-selected", on ? "true" : "false");
          tab.tabIndex = on ? 0 : -1;
        });
        panels.forEach((panel) => {
          const on = panel.dataset.flowPanel === name;
          panel.hidden = !on;
        });
        if (name === "songs" && typeof refreshMassMusicSongPlan === "function") {
          refreshMassMusicSongPlan({ force: true }).catch(() => {});
        }
        syncFlowDockVisibility(name);
      }
      tablist.addEventListener("click", (e) => {
        const tab = e.target.closest('[role="tab"]');
        if (!tab || !tab.dataset.flowTab) return;
        activateFlowTab(tab.dataset.flowTab);
      });
      tablist.addEventListener("keydown", (e) => {
        const idx = tabs.indexOf(document.activeElement);
        if (idx < 0) return;
        let next = -1;
        if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        tabs[next].focus();
        activateFlowTab(tabs[next].dataset.flowTab);
      });
      syncFlowDockVisibility("setup");
    })();

    var NOTIF_STORAGE_KEY = "verbumNotifications";
    var appNotifications = [];

    function loadAppNotifications() {
      try {
        appNotifications = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
        if (!Array.isArray(appNotifications)) appNotifications = [];
        appNotifications = appNotifications.map((item) => ({
          ...item,
          seen: item && item.seen === true,
        }));
      } catch (_e) {
        appNotifications = [];
      }
    }

    function saveAppNotifications() {
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(appNotifications.slice(0, 120)));
      } catch (_e) { /* ignore */ }
    }

    function getUnreadAppNotificationCount() {
      return appNotifications.filter((item) => item && !item.seen).length;
    }

    function markAppNotificationsSeen() {
      let changed = false;
      appNotifications = appNotifications.map((item) => {
        if (item && !item.seen) {
          changed = true;
          return { ...item, seen: true };
        }
        return item;
      });
      if (changed) saveAppNotifications();
      updateNotifBadge();
    }

    function formatNotificationTime(iso) {
      const d = iso ? new Date(iso) : new Date();
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return mins + "m";
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + "h";
      const days = Math.floor(hours / 24);
      if (days < 7) return days + "d";
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    function updateNotifBadge() {
      const badge = $("notif-badge");
      const navBadge = $("notif-badge-nav");
      const accordionBadge = $("notif-badge-accordion");
      const saCount = typeof getSaApprovalBadgeCount === "function" ? getSaApprovalBadgeCount() : 0;
      const n = getUnreadAppNotificationCount() + saCount;
      const label = n > 99 ? "99+" : String(n);
      [badge, navBadge, accordionBadge].forEach((el) => {
        if (!el) return;
        if (n > 0) {
          el.hidden = false;
          el.removeAttribute("hidden");
          el.textContent = label;
        } else {
          el.hidden = true;
          el.textContent = "0";
        }
      });
    }

    function renderNotificationFeed() {
      const feed = $("notification-feed");
      const empty = $("notification-empty");
      if (!feed) return;
      feed.innerHTML = "";
      const hasSa = typeof renderSaApprovalNotifSection === "function" && renderSaApprovalNotifSection();
      if (!appNotifications.length && !hasSa) {
        if (empty) empty.style.display = "";
        updateNotifBadge();
        return;
      }
      if (empty) empty.style.display = appNotifications.length ? "none" : (hasSa ? "none" : "");
      appNotifications.forEach((item) => {
        const li = document.createElement("li");
        li.className = "notification-item notification-item--" + (item.kind || "info") + (item.seen ? " is-seen" : " is-unread");
        const row = document.createElement("div");
        row.className = "notification-item__row";
        const avatar = document.createElement("span");
        avatar.className = "notification-item__avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = (item.kind === "ok" ? "✓" : item.kind === "error" ? "!" : "•");
        const body = document.createElement("div");
        body.className = "notification-item__body";
        const msg = document.createElement("p");
        msg.className = "notification-item__msg";
        msg.textContent = item.message || "";
        body.appendChild(msg);
        const time = document.createElement("p");
        time.className = "notification-item__time";
        time.textContent = formatNotificationTime(item.at);
        body.appendChild(time);
        if (item.downloads && item.downloads.length) {
          const links = document.createElement("div");
          links.className = "notification-item__links";
          item.downloads.forEach((dl) => {
            if (!dl || !dl.url) return;
            const a = document.createElement("a");
            a.href = dl.url;
            a.textContent = dl.label || "Download";
            if (dl.download) a.setAttribute("download", "");
            links.appendChild(a);
          });
          if (links.childNodes.length) body.appendChild(links);
        }
        row.appendChild(avatar);
        row.appendChild(body);
        li.appendChild(row);
        feed.appendChild(li);
      });
      updateNotifBadge();
    }

    function pushAppNotification(message, kind, meta) {
      const item = {
        id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
        message: message || "",
        kind: kind === "ok" || kind === "error" ? kind : "info",
        at: new Date().toISOString(),
        seen: false,
        downloads: (meta && meta.downloads) ? meta.downloads : [],
      };
      appNotifications.unshift(item);
      saveAppNotifications();
      renderNotificationFeed();
      return item;
    }

    function dismissToast(el) {
      if (!el || !el.isConnected) return;
      clearTimeout(el._toastTimer);
      el.classList.remove("toast--visible");
      setTimeout(() => el.remove(), 220);
    }

    function showToast(message, kind, action) {
      const stack = $("toast-stack");
      if (!stack || !message) return;
      const el = document.createElement("div");
      el.className = "toast toast--" + (
        kind === "error" ? "error" : kind === "ok" ? "ok" : kind === "warn" ? "warn" : "info"
      );
      el.setAttribute("role", "status");
      const row = document.createElement("div");
      row.className = "toast__row";
      const text = document.createElement("span");
      text.className = "toast__text";
      text.textContent = message;
      row.appendChild(text);
      if (action && action.label && typeof action.onClick === "function") {
        const actionBtn = document.createElement("button");
        actionBtn.type = "button";
        actionBtn.className = "toast__action";
        actionBtn.textContent = action.label;
        actionBtn.addEventListener("click", async () => {
          if (actionBtn.disabled) return;
          actionBtn.disabled = true;
          try {
            await action.onClick();
            dismissToast(el);
          } catch (_err) {
            actionBtn.disabled = false;
          }
        });
        row.appendChild(actionBtn);
      }
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "toast__close";
      closeBtn.setAttribute("aria-label", "Dismiss notification");
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", () => dismissToast(el));
      row.appendChild(closeBtn);
      el.appendChild(row);
      stack.appendChild(el);
      requestAnimationFrame(() => el.classList.add("toast--visible"));
      const duration =
        (action && action.durationMs) ||
        (kind === "error" ? 5500 : action ? 14000 : 4200);
      el._toastTimer = setTimeout(() => dismissToast(el), duration);
    }

    function showToastWithAction(message, kind, action) {
      showToast(message, kind, action);
    }

    function notify(message, kind, meta) {
      if (!message) return;
      if (kind === "ok" || kind === "error" || kind === "warn") {
        pushAppNotification(message, kind === "warn" ? "error" : kind, meta);
        showToast(message, kind);
      }
    }

    function setFlowStatus(message, kind, meta) {
      notify(message, kind, meta);
    }

    function massGenerateDownloadLinks(data) {
      if (!data) return [];
      const out = [];
      if (data.zip_url) out.push({ label: "ZIP bundle", url: data.zip_url, download: true });
      if (data.pptx_url) out.push({ label: "PowerPoint", url: data.pptx_url, download: true });
      if (data.poster_url) out.push({ label: "Poster PNG", url: data.poster_url, download: true });
      if (data.poster_ppt_url) out.push({ label: "Poster 16:9", url: data.poster_ppt_url, download: true });
      return out;
    }

    (function initNotifPanel() {
      const btn = $("notif-toggle-btn");
      const panel = $("notif-panel");
      if (!btn || !panel) return;
      bindMobileHeaderSheetTrigger(btn, () => {
        toggleHeaderSheetPanel(panel, btn, "notif-panel");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) closeHeaderSheetPanel(panel, btn);
      });
    })();

    var clearNotifBtn = $("btn-clear-notifications");
    if (clearNotifBtn) {
      clearNotifBtn.addEventListener("click", () => {
        appNotifications = [];
        saveAppNotifications();
        renderNotificationFeed();
      });
    }

    function getCommunityName() {
      const b = $("settings-church-name");
      return (b && b.value.trim()) || "";
    }

    function syncChurchFieldsToSettings() {
      renderSettingsCelebrantList();
    }

    function syncChurchFieldsFromSettings() {
      /* church name is managed in Settings → Church Profile */
    }

    var celebrantNamesCache = [];

    function getMainCelebrantName() {
      const el = $("celebrant");
      return (el && el.value.trim()) || "";
    }

    function getMassCelebrantLine() {
      const main = getMainCelebrantName();
      const co = ($("co-celebrant") && $("co-celebrant").value.trim()) || "";
      if (!main) return "";
      return co ? main + " · " + co : main;
    }

    function renderSettingsCelebrantList() {
      const ul = $("settings-celebrant-list");
      if (!ul) return;
      const canRemove = churchMembershipState.is_superadmin;
      ul.innerHTML = celebrantNamesCache.map((name, i) => (
        "<li class=\"celebrant-settings-list__item\">" +
          "<span>" + escapeHtml(name) + "</span>" +
          (canRemove
            ? "<button type=\"button\" class=\"ghost mini\" data-remove-celebrant=\"" + i + "\">Remove</button>"
            : "") +
        "</li>"
      )).join("");
    }

    function syncCelebrantFromSelect() {
      if ($("poster-celebrant")) $("poster-celebrant").value = getMassCelebrantLine();
    }

    var CELEBRANT_PLACEHOLDER = "Select celebrant";

    function setCelebrantPickerValue(name) {
      const hidden = $("celebrant");
      const display = $("celebrant-display");
      const picker = $("celebrant-picker");
      const list = $("celebrant-list");
      if (!hidden || !display) return;
      const value = (name || "").trim();
      hidden.value = value;
      if (value) {
        display.textContent = value;
        display.classList.remove("is-placeholder");
      } else {
        display.textContent = CELEBRANT_PLACEHOLDER;
        display.classList.add("is-placeholder");
      }
      if (list) {
        list.querySelectorAll(".celebrant-picker__option").forEach((btn) => {
          const on = btn.dataset.value === value;
          btn.setAttribute("aria-selected", on ? "true" : "false");
          btn.classList.toggle("is-active", on);
        });
      }
      if (picker) picker.classList.toggle("celebrant-picker--disabled", !celebrantNamesCache.length);
      syncCelebrantFromSelect();
    }

    function closeCelebrantPicker() {
      const panel = $("celebrant-picker-panel");
      const trigger = $("celebrant-picker-trigger");
      closeVbDropdownPanel(panel);
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    }

    function openCelebrantPicker() {
      const panel = $("celebrant-picker-panel");
      const trigger = $("celebrant-picker-trigger");
      if (!panel || !trigger || pickerIsDisabled()) return;
      if (typeof closeAllVerbumSelects === "function") closeAllVerbumSelects();
      if (typeof closeGlobalSearch === "function") closeGlobalSearch();
      [
        ["liturgical-indicator-panel", "liturgical-indicator-btn"],
        ["account-menu-panel", "account-menu-btn"],
        ["create-menu-panel", "create-menu-btn"],
        ["notif-panel", "notif-toggle-btn"],
      ].forEach(([panelId, btnId]) => setVbDropdownOpen($(panelId), $(btnId), false));
      openVbDropdownPanel(panel);
      trigger.setAttribute("aria-expanded", "true");
    }

    function pickerIsDisabled() {
      const picker = $("celebrant-picker");
      return !!(picker && picker.classList.contains("celebrant-picker--disabled"));
    }

    function renderCelebrantSelect(selectedName) {
      const list = $("celebrant-list");
      const empty = $("celebrant-picker-empty");
      const picker = $("celebrant-picker");
      const hidden = $("celebrant");
      if (!list || !hidden) return;
      const keep = (selectedName || getMainCelebrantName() || "").trim();
      const names = celebrantNamesCache.slice();
      if (!names.length) {
        list.innerHTML = "";
        if (empty) empty.hidden = false;
        if (picker) picker.classList.add("celebrant-picker--disabled");
        setCelebrantPickerValue("");
        return;
      }
      if (empty) empty.hidden = true;
      if (picker) picker.classList.remove("celebrant-picker--disabled");
      list.innerHTML = names.map((name) => (
        "<li role=\"presentation\">" +
          "<button type=\"button\" class=\"vb-dropdown-item celebrant-picker__option\" role=\"option\" data-value=\"" +
          escapeHtml(name) + "\" aria-selected=\"false\">" +
          "<span class=\"vb-dropdown-item__label\">" + escapeHtml(name) + "</span></button>" +
        "</li>"
      )).join("");
      let chosen = "";
      if (keep && names.indexOf(keep) >= 0) {
        chosen = keep;
      } else if (names.length) {
        chosen = names[0];
      }
      setCelebrantPickerValue(chosen);
    }

    function bindCelebrantSelect() {
      const list = $("celebrant-list");
      const picker = $("celebrant-picker");
      const trigger = $("celebrant-picker-trigger");
      if (!list || !picker || picker.dataset.bound === "1") return;
      picker.dataset.bound = "1";
      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          const panel = $("celebrant-picker-panel");
          if (!panel) return;
          if (panel.hidden) openCelebrantPicker();
          else closeCelebrantPicker();
        });
      }
      list.addEventListener("click", (e) => {
        const btn = e.target.closest(".celebrant-picker__option");
        if (!btn || !btn.dataset.value) return;
        setCelebrantPickerValue(btn.dataset.value);
        closeCelebrantPicker();
      });
      list.addEventListener("keydown", (e) => {
        const opts = Array.from(list.querySelectorAll(".celebrant-picker__option"));
        if (!opts.length) return;
        const idx = opts.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          (opts[Math.min(opts.length - 1, idx < 0 ? 0 : idx + 1)] || opts[0]).focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          (opts[Math.max(0, idx <= 0 ? 0 : idx - 1)] || opts[0]).focus();
        } else if (e.key === "Enter" || e.key === " ") {
          if (idx >= 0) {
            e.preventDefault();
            setCelebrantPickerValue(opts[idx].dataset.value);
            closeCelebrantPicker();
          }
        } else if (e.key === "Escape") {
          closeCelebrantPicker();
        }
      });
    }

    function applyCelebrantNamesFromServer(names) {
      celebrantNamesCache = Array.isArray(names)
        ? names.map((x) => String(x).trim()).filter(Boolean)
        : [];
      renderSettingsCelebrantList();
      renderCelebrantSelect(getMainCelebrantName());
    }

    async function saveCelebrantNamesToDatabase() {
      if (!churchMembershipState.can_edit_church_profile) {
        throw new Error("Superadmin access is required to edit the celebrant list directly.");
      }
      const data = await postJSON("/api/community/profile", { celebrant_names: celebrantNamesCache });
      applyCelebrantNamesFromServer(data.celebrant_names || celebrantNamesCache);
      return data;
    }

    async function addSettingsCelebrantName(name) {
      const n = (name || "").trim();
      if (!n) return false;
      const key = n.toLowerCase();
      if (celebrantNamesCache.some((x) => x.toLowerCase() === key)) return false;
      if (!churchMembershipState.can_submit_priest && !churchMembershipState.can_edit_church_profile) {
        throw new Error("Sign in to submit a priest name for approval.");
      }
      if (churchMembershipState.is_superadmin) {
        celebrantNamesCache.push(n);
        renderSettingsCelebrantList();
        renderCelebrantSelect(n);
        try {
          await saveCelebrantNamesToDatabase();
        } catch (_e) {
          celebrantNamesCache = celebrantNamesCache.filter((x) => x !== n);
          renderSettingsCelebrantList();
          return false;
        }
        return true;
      }
      try {
        const data = await postJSON("/api/submissions/priest", { name: n });
        return { pending: true, message: data.message || "Priest submitted for superadmin approval." };
      } catch (_e) {
        return false;
      }
    }

    async function migrateCelebrantsFromBrowserStorage() {
      try {
        const local = JSON.parse(localStorage.getItem("savedCelebrants") || "[]");
        if (!Array.isArray(local) || !local.length) return;
        const merged = local.map((x) => String(x).trim()).filter(Boolean);
        if (!merged.length) return;
        await postJSON("/api/community/profile", { celebrant_names: merged });
        localStorage.removeItem("savedCelebrants");
        celebrantNamesCache = merged;
      } catch (_e) { /* ignore */ }
    }

    function upcomingSundayISO(base = new Date()) {
      // Next Sunday on or after `base` (local calendar day). If today is Sunday, use today.
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      const dow = d.getDay(); // 0 = Sunday
      const add = dow === 0 ? 0 : 7 - dow;
      d.setDate(d.getDate() + add);
      return formatDateInput(d);
    }

    function previousSundayISO(base = new Date()) {
      // Most recent Sunday strictly before today. If today is Sunday, use last week.
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      const dow = d.getDay(); // 0 = Sunday
      d.setDate(d.getDate() - (dow === 0 ? 7 : dow));
      return formatDateInput(d);
    }

    function daysUntilUpcomingSunday() {
      const today = new Date();
      const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const sun = parseLocalDateISO(upcomingSundayISO(t0));
      if (!sun) return 0;
      return Math.round((sun - t0) / 86400000);
    }

    function isPastLocalDateISO(iso) {
      const d = parseLocalDateISO(iso);
      if (!d) return true;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.getTime() < today.getTime();
    }

    function ensureMassBuilderDefaultDate(opts) {
      const el = $("mass-date");
      if (!el) return upcomingSundayISO();
      const next = upcomingSundayISO();
      const cur = (el.value || "").trim();
      const force = !!(opts && opts.force);
      // Never keep a past Mass date (common when an old draft still has last Sunday).
      if (force || !cur || isPastLocalDateISO(cur)) {
        el.value = next;
        if ($("poster-mass-date")) $("poster-mass-date").value = next;
        if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return el.value || next;
    }

    function ensureCollectionDefaultDate(opts) {
      const el = $("flow-collection-date");
      if (!el) return previousSundayISO();
      const last = previousSundayISO();
      const cur = (el.value || "").trim();
      const force = !!(opts && opts.force);
      if (force || !cur) {
        el.value = last;
        if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("flow-collection-date");
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return el.value || last;
    }
    window.ensureCollectionDefaultDate = ensureCollectionDefaultDate;

    /** Email CTAs: /sign-in?redirect_url=/home&intent=practice-share&date=… */
    var emailDeepLinkConsumed = false;
    var pendingPracticeLyricsHandoff = null;
    function readEmailDeepLink() {
      let intent = "";
      let dateParam = "";
      let handoff = "";
      try {
        const params = new URLSearchParams(window.location.search);
        intent = (params.get("intent") || "").trim().toLowerCase();
        dateParam = (params.get("date") || "").trim();
        handoff = (params.get("handoff") || "").trim();
      } catch (_e) { /* ignore */ }
      if (!intent || !dateParam || (intent === "practice-lyrics" && !handoff)) {
        try {
          const raw = sessionStorage.getItem(EMAIL_DEEPLINK_STORE_KEY);
          if (raw) {
            const stored = JSON.parse(raw) || {};
            if (!intent) intent = String(stored.intent || "").trim().toLowerCase();
            if (!dateParam) dateParam = String(stored.date || "").trim();
            if (!handoff) handoff = String(stored.handoff || "").trim();
          }
        } catch (_e2) { /* ignore */ }
      }
      return { intent: intent, dateParam: dateParam, handoff: handoff };
    }
    function pendingEmailDeepLinkIntent() {
      return readEmailDeepLink().intent;
    }
    function shouldSkipStartupPopups() {
      if (emailDeepLinkConsumed) return true;
      const intent = pendingEmailDeepLinkIntent();
      return intent === "practice-share" || intent === "generate" || intent === "practice-lyrics";
    }
    function closePracticeLyricsHandoffModal() {
      const modal = $("practice-lyrics-handoff-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
    function openPracticeLyricsHandoffModal(payload) {
      const modal = $("practice-lyrics-handoff-modal");
      if (!modal || !payload) return;
      pendingPracticeLyricsHandoff = payload;
      const meta = $("practice-lyrics-handoff-meta");
      const list = $("practice-lyrics-handoff-songs");
      const status = $("practice-lyrics-handoff-status");
      const applyBtn = $("practice-lyrics-handoff-apply");
      const genBtn = $("practice-lyrics-handoff-generate");
      const songs = Array.isArray(payload.songs) ? payload.songs : [];
      if (meta) {
        const bits = [];
        if (payload.mass_date) bits.push(payload.mass_date);
        if (payload.mass_title) bits.push(payload.mass_title);
        bits.push(songs.length + " song" + (songs.length === 1 ? "" : "s"));
        if (payload.sender_label) bits.push("from " + payload.sender_label);
        meta.textContent = bits.join(" · ");
      }
      if (list) {
        list.innerHTML = songs.map(function (s) {
          const label = (s.slot_label || s.section || "Song").trim();
          return "<li><strong>" + escapeHtml(label) + "</strong> — " + escapeHtml(s.title || "Untitled") + "</li>";
        }).join("");
      }
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      if (applyBtn) {
        applyBtn.hidden = false;
        applyBtn.disabled = false;
        applyBtn.textContent = "Use for this Mass";
      }
      if (genBtn) genBtn.hidden = true;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    }
    function applyPracticeLyricsHandoff(payload) {
      if (!payload || !Array.isArray(payload.songs)) return false;
      const dateParam = String(payload.mass_date || "").trim();
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const el = $("mass-date");
        if (el && el.value !== dateParam) {
          el.value = dateParam;
          if ($("poster-mass-date")) $("poster-mass-date").value = dateParam;
          if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
          el.dispatchEvent(new Event("change", { bubbles: true }));
          try { loadFlowData(true); } catch (_e) { /* ignore */ }
        }
      }
      payload.songs.forEach(function (song) {
        const id = String(song.hymn_id || "").trim();
        if (!id) return;
        const slotKey = String(song.slot_key || "").trim();
        let section = String(song.section || "").trim().toLowerCase();
        if (!section && slotKey) {
          section = (SLOT_TO_HYMN_SECTION[slotKey] || slotKey).toLowerCase();
        }
        if (slotKey) {
          if (typeof assignMassSlotSong === "function") assignMassSlotSong(slotKey, id);
          else selectedLyricsSongs[slotKey] = id;
        }
        const lyrics = String(song.lyrics || "").trim();
        if (section && lyrics) {
          setHymnLyricOverride(section, id, lyrics);
          try { massSongLyricsCache.set(section + "|" + id, lyrics); } catch (_e2) { /* ignore */ }
        }
      });
      try {
        if (typeof renderMassSongPlan === "function") renderMassSongPlan();
        if (typeof syncMassWizardFromLegacy === "function") syncMassWizardFromLegacy();
      } catch (_e3) { /* ignore */ }
      markHymnSlidePreviewDirty();
      return true;
    }
    async function beginPracticeLyricsHandoffFlow(handoffId, dateParam) {
      const hid = String(handoffId || "").trim();
      if (!hid) return;
      if (typeof showRoute === "function") showRoute("/mass/builder", true);
      try {
        history.replaceState({}, "", "/mass/builder");
      } catch (_e) { /* ignore */ }
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const el = $("mass-date");
        if (el && el.value !== dateParam) {
          el.value = dateParam;
          if ($("poster-mass-date")) $("poster-mass-date").value = dateParam;
          if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
          el.dispatchEvent(new Event("change", { bubbles: true }));
          try { await loadFlowData(true); } catch (_e2) { /* ignore */ }
        }
      }
      try {
        const res = await fetch("/api/practice/lyrics-handoff/" + encodeURIComponent(hid), {
          credentials: "same-origin",
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.ok) {
          notify(data.detail || "This practice lyrics link is invalid or expired.", "error");
          return;
        }
        openPracticeLyricsHandoffModal(data);
      } catch (_err) {
        notify("Could not load practice lyrics for Mass Builder.", "error");
      }
    }
    function consumeEmailDeepLinkIntent() {
      if (emailDeepLinkConsumed) return;
      const link = readEmailDeepLink();
      const intent = link.intent;
      const dateParam = link.dateParam;
      const handoff = link.handoff;
      if (!intent && !dateParam) return;
      const route = normalizeRoute(window.location.pathname);

      if (intent === "practice-share") {
        emailDeepLinkConsumed = true;
        try { sessionStorage.removeItem(EMAIL_DEEPLINK_STORE_KEY); } catch (_eClr) { /* ignore */ }
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          const el = $("mass-date");
          if (el && el.value !== dateParam) {
            el.value = dateParam;
            if ($("poster-mass-date")) $("poster-mass-date").value = dateParam;
            if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        try {
          history.replaceState({}, "", "/home");
        } catch (_e2) { /* ignore */ }
        if (route !== "/home" && typeof showRoute === "function") {
          showRoute("/home", true);
        }
        setTimeout(() => {
          try {
            if (typeof openPracticeShareSectionsModal === "function") {
              openPracticeShareSectionsModal({ date: dateParam });
            }
          } catch (_e3) { /* ignore */ }
        }, 80);
        return;
      }

      if (intent === "practice-lyrics") {
        emailDeepLinkConsumed = true;
        try { sessionStorage.removeItem(EMAIL_DEEPLINK_STORE_KEY); } catch (_eClrPl) { /* ignore */ }
        void beginPracticeLyricsHandoffFlow(handoff, dateParam);
        return;
      }

      if (route !== "/mass/builder" && intent !== "generate") return;
      if (intent !== "generate" && !dateParam) return;
      emailDeepLinkConsumed = true;
      try { sessionStorage.removeItem(EMAIL_DEEPLINK_STORE_KEY); } catch (_eClr2) { /* ignore */ }

      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const el = $("mass-date");
        if (el && el.value !== dateParam) {
          el.value = dateParam;
          if ($("poster-mass-date")) $("poster-mass-date").value = dateParam;
          if (typeof syncMassDatePickerByInputId === "function") syncMassDatePickerByInputId("mass-date");
          el.dispatchEvent(new Event("change", { bubbles: true }));
          try { loadFlowData(true); } catch (_e) { /* ignore */ }
        }
      }

      try {
        history.replaceState({}, "", "/mass/builder");
      } catch (_e2) { /* ignore */ }

      if (intent === "generate") {
        if (window.MassWizard && window.MassWizard.setStep) window.MassWizard.setStep(7);
        notify("Generate your Mass PowerPoint when ready.", "info");
      }
    }
    window.consumeEmailDeepLinkIntent = consumeEmailDeepLinkIntent;
    window.shouldSkipStartupPopups = shouldSkipStartupPopups;

    (function bindPracticeLyricsHandoffModal() {
      const modal = $("practice-lyrics-handoff-modal");
      if (!modal) return;
      const closeIds = ["practice-lyrics-handoff-close", "practice-lyrics-handoff-dismiss", "practice-lyrics-handoff-backdrop"];
      closeIds.forEach(function (id) {
        const el = $(id);
        if (!el) return;
        el.addEventListener("click", function () {
          closePracticeLyricsHandoffModal();
        });
      });
      const applyBtn = $("practice-lyrics-handoff-apply");
      if (applyBtn) {
        applyBtn.addEventListener("click", function () {
          if (!pendingPracticeLyricsHandoff) return;
          const ok = applyPracticeLyricsHandoff(pendingPracticeLyricsHandoff);
          if (!ok) {
            const status = $("practice-lyrics-handoff-status");
            if (status) {
              status.hidden = false;
              status.textContent = "Could not apply lyrics.";
            }
            return;
          }
          applyBtn.hidden = true;
          const genBtn = $("practice-lyrics-handoff-generate");
          if (genBtn) genBtn.hidden = false;
          if (window.MassWizard && window.MassWizard.setStep) window.MassWizard.setStep(7);
          notify("Practice lyric order applied for this Mass only.", "ok");
          const sub = $("practice-lyrics-handoff-sub");
          if (sub) {
            sub.textContent = "Lyric sequence updated. Next: generate the PowerPoint with this configuration.";
          }
        });
      }
      const genBtn = $("practice-lyrics-handoff-generate");
      if (genBtn) {
        genBtn.addEventListener("click", function () {
          closePracticeLyricsHandoffModal();
          const trigger = $("btn-generate-flow") || $("btn-generate-flow-inline") || $("mw-generate");
          if (trigger) trigger.click();
        });
      }
    })();

    var churchMembershipState = {
      membership_status: "draft",
      community_name_locked: false,
      logo_locked: false,
        can_edit_parish_name: true,
        can_request_parish_rename: false,
        can_edit_logo: true,
      can_edit_church_profile: false,
      can_use_full_app: true,
      can_submit_song: true,
      can_submit_priest: true,
      is_superadmin: false,
      role: "member",
    };

    loadAppNotifications();
    renderNotificationFeed();

    function guardSuperadminAction(message) {
      if (churchMembershipState.is_superadmin) return true;
      const msg = message || "This action is limited to the superadmin account.";
      notify(msg, "error");
      return false;
    }

    function guardFullAppAction(message) {
      if (churchMembershipState.can_use_full_app) return true;
      const msg = message || "Mass generation and parish tools require approved parish membership.";
      notify(msg, "error");
      return false;
    }
    var pendingLogoUploadFile = null;
    var currentLogoPreviewUrl = "";
    var currentAvatarPreviewUrl = "";
    var logoPreviewObjectUrl = "";
    var avatarPreviewObjectUrl = "";
    var imagePreviewKind = "logo"; // "logo" | "avatar"

    /** Safe src for <img> — never append query params to blob:/data:/signed URLs. */
    function displayImageSrc(url) {
      const src = String(url || "").trim();
      if (!src) return "";
      if (src.startsWith("blob:") || src.startsWith("data:")) return src;
      if (src.includes("/storage/v1/object/sign/") || /[?&]token=/.test(src)) return src;
      return src + (src.includes("?") ? "&" : "?") + "t=" + Date.now();
    }

    async function resolvePrivateImageUrl(url, kind) {
      if (!url) return "";
      if (!isPrivateFileUrl(url)) return url;
      const res = await authorizedFetch(url);
      if (!res.ok) return "";
      const blob = await res.blob();
      const slot = kind === "avatar" ? "avatar" : "logo";
      if (slot === "avatar") {
        if (avatarPreviewObjectUrl) URL.revokeObjectURL(avatarPreviewObjectUrl);
        avatarPreviewObjectUrl = URL.createObjectURL(blob);
        return avatarPreviewObjectUrl;
      }
      if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl);
      logoPreviewObjectUrl = URL.createObjectURL(blob);
      return logoPreviewObjectUrl;
    }

    function updateChurchLogoAvatar(logoUrl) {
      const btn = $("church-logo-avatar");
      const img = $("church-logo-avatar-img");
      const ph = $("church-logo-avatar-placeholder");
      if (!btn) return;
      if (logoUrl) {
        currentLogoPreviewUrl = logoUrl;
        const applySrc = (src) => {
          if (img) {
            img.src = displayImageSrc(src);
            img.hidden = false;
          }
          if (ph) ph.hidden = true;
          btn.disabled = false;
          btn.setAttribute("aria-label", "Preview church logo");
        };
        if (isPrivateFileUrl(logoUrl)) {
          resolvePrivateImageUrl(logoUrl, "logo").then((src) => {
            if (src && currentLogoPreviewUrl === logoUrl) applySrc(src);
          });
        } else {
          applySrc(logoUrl);
        }
      } else {
        currentLogoPreviewUrl = "";
        if (logoPreviewObjectUrl) {
          URL.revokeObjectURL(logoPreviewObjectUrl);
          logoPreviewObjectUrl = "";
        }
        if (img) {
          img.hidden = true;
          img.removeAttribute("src");
        }
        if (ph) ph.hidden = false;
        btn.disabled = true;
        btn.setAttribute("aria-label", "No church logo");
      }
    }

    function updateProfileAvatar(avatarUrl) {
      const btn = $("profile-avatar-btn");
      const img = $("profile-avatar-img");
      const ph = $("profile-avatar-placeholder");
      if (avatarUrl) {
        currentAvatarPreviewUrl = avatarUrl;
        const applySrc = (src) => {
          if (img) {
            img.src = displayImageSrc(src);
            img.hidden = false;
          }
          if (ph) ph.hidden = true;
          if (btn) {
            btn.disabled = false;
            btn.setAttribute("aria-label", "Preview profile picture");
          }
        };
        if (isPrivateFileUrl(avatarUrl)) {
          resolvePrivateImageUrl(avatarUrl, "avatar").then((src) => {
            if (src && currentAvatarPreviewUrl === avatarUrl) applySrc(src);
          });
        } else {
          applySrc(avatarUrl);
        }
      } else {
        currentAvatarPreviewUrl = "";
        if (avatarPreviewObjectUrl) {
          URL.revokeObjectURL(avatarPreviewObjectUrl);
          avatarPreviewObjectUrl = "";
        }
        if (img) {
          img.hidden = true;
          img.removeAttribute("src");
        }
        if (ph) {
          ph.hidden = false;
          const auth = window.VerbumAuth;
          const user = auth && auth.getUser ? auth.getUser() : null;
          const initial = ((auth && auth.getUserFirstName && auth.getUserFirstName(user)) || (user && user.email) || "?").charAt(0).toUpperCase();
          ph.textContent = initial || "?";
        }
        if (btn) {
          btn.disabled = false;
          btn.setAttribute("aria-label", "Change profile picture");
        }
      }
      if (window.VerbumAuth && typeof window.VerbumAuth.setAvatarUrl === "function") {
        window.VerbumAuth.setAvatarUrl(avatarUrl || "");
      }
      if (typeof updateAccountMenuDisplay === "function") updateAccountMenuDisplay();
    }

    function syncSettingsAccountPanel() {
      const auth = window.VerbumAuth;
      const user = auth && auth.getUser ? auth.getUser() : null;
      const profile = auth && auth.getProfile ? auth.getProfile() : null;
      const nameEl = $("settings-account-name");
      const emailEl = $("settings-account-email");
      const first = (auth && auth.getUserFirstName ? auth.getUserFirstName(user) : "") || "";
      const last = (profile && profile.last_name) || "";
      const full = [first, last].filter(Boolean).join(" ").trim();
      const email = (profile && profile.email) || (user && user.email) || "";
      if (nameEl) nameEl.innerHTML = full ? "<strong>" + escapeHtml(full) + "</strong>" : "<strong>Signed in</strong>";
      if (emailEl) emailEl.textContent = email || "—";
      const avatarUrl = (auth && auth.getAvatarUrl ? auth.getAvatarUrl() : "") || (profile && profile.avatar_url) || "";
      if (avatarUrl && avatarUrl !== currentAvatarPreviewUrl) {
        updateProfileAvatar(avatarUrl);
      } else if (!avatarUrl && !currentAvatarPreviewUrl) {
        updateProfileAvatar("");
      }
    }

    async function openLogoPreviewModal(kind) {
      const previewKind = kind === "avatar" ? "avatar" : "logo";
      imagePreviewKind = previewKind;
      const sourceUrl = previewKind === "avatar" ? currentAvatarPreviewUrl : currentLogoPreviewUrl;
      if (!sourceUrl) return;
      const titleEl = $("logo-preview-title");
      const img = $("logo-preview-modal-img");
      if (titleEl) titleEl.textContent = previewKind === "avatar" ? "Profile picture" : "Church logo";
      if (img) {
        img.alt = previewKind === "avatar" ? "Profile picture preview" : "Church logo preview";
        let src = sourceUrl;
        if (isPrivateFileUrl(sourceUrl)) {
          src = await resolvePrivateImageUrl(sourceUrl, previewKind);
        }
        if (src) img.src = displayImageSrc(src);
      }
      setUiOverlayOpen($("logo-preview-modal"), true);
    }

    function closeLogoPreviewModal() {
      setUiOverlayOpen($("logo-preview-modal"), false);
    }

    function closeLogoLockModal() {
      setUiOverlayOpen($("logo-lock-modal"), false);
      pendingLogoUploadFile = null;
      if ($("church-logo")) $("church-logo").value = "";
    }

    function syncGlobalMembershipBanner(data) {
      const state = data || churchMembershipState;
      const status = state.membership_status || "draft";
      const banners = [$("home-membership-banner"), $("flow-membership-banner")];
      let html = "";
      let cls = "app-membership-banner";
      let show = false;

      if (!state.is_superadmin && !state.can_use_full_app && state.can_submit_song) {
        show = true;
        cls += " is-pending";
        html = "Submit songs and priest names for superadmin approval. Mass generation unlocks after your parish membership is approved.";
      } else if (status === "pending") {
        show = true;
        cls += " is-pending";
        html = "Your parish membership is pending approval. <a href=\"/settings/church\" data-route=\"/settings/church\">Open Church Profile</a>";
      } else if (status === "rejected") {
        show = true;
        cls += " is-error";
        html = "Your parish membership was not approved. Review your profile in <a href=\"/settings/church\" data-route=\"/settings/church\">Church Profile</a> or contact the administrator.";
      } else if (status === "draft" && state.can_edit_parish_name) {
        show = true;
        html = "Submit your parish name and optional logo in <a href=\"/settings/church\" data-route=\"/settings/church\">Church Profile</a>.";
      }

      banners.forEach((el) => {
        if (!el) return;
        if (!show) {
          el.hidden = true;
          el.innerHTML = "";
          el.className = "app-membership-banner";
          return;
        }
        el.hidden = false;
        el.className = cls;
        el.innerHTML = html;
        el.querySelectorAll("a[data-route]").forEach(bindSpaRouteLink);
      });
    }

    function syncMembershipUi(data) {
      if (!data) return;
      churchMembershipState = {
        membership_status: data.membership_status || "draft",
        community_name_locked: !!data.community_name_locked,
        logo_locked: !!data.logo_locked,
        can_edit_parish_name: data.can_edit_parish_name != null
          ? !!data.can_edit_parish_name
          : (!data.community_name_locked && (data.membership_status || "draft") === "draft"),
        can_request_parish_rename: !!data.can_request_parish_rename,
        can_edit_logo: data.can_edit_logo != null ? !!data.can_edit_logo : !data.logo_locked,
        can_edit_church_profile: !!data.can_edit_church_profile,
        can_use_full_app: data.can_use_full_app != null ? !!data.can_use_full_app : !!data.can_edit_church_profile,
        can_submit_song: data.can_submit_song != null ? !!data.can_submit_song : !data.is_superadmin,
        can_submit_priest: data.can_submit_priest != null ? !!data.can_submit_priest : !data.is_superadmin,
        is_superadmin: !!data.is_superadmin,
        role: (data.role || "member").toLowerCase(),
        parish_role: (data.parish_role || "").toLowerCase(),
        parish_id: data.parish_id || "",
        user_id: data.user_id || churchMembershipState.user_id || "",
      };

      const teamNav = $("settings-nav-team");
      const teamModalTab = $("settings-modal-tab-team");
      const showTeam = churchMembershipState.parish_role === "president" || churchMembershipState.is_superadmin;
      if (teamNav) teamNav.hidden = !showTeam;
      if (teamModalTab) teamModalTab.hidden = !showTeam;

      const nameInput = $("settings-church-name");
      const nameHint = $("settings-church-name-hint");
      const logoHint = $("settings-church-logo-hint");
      const banner = $("settings-membership-banner");
      const submitBtn = $("btn-submit-parish-name");
      const renameBtn = $("btn-request-parish-rename");
      const saveBtn = $("btn-save-community-api");
      const celebrantNew = $("settings-celebrant-new");
      const celebrantAdd = $("btn-settings-celebrant-add");
      const logoInput = $("church-logo");
      const logoUpload = $("btn-upload-logo");
      const logoUploadRow = $("church-logo-upload-row");

      const locked = churchMembershipState.community_name_locked;
      const logoLocked = churchMembershipState.logo_locked;
      const status = churchMembershipState.membership_status;
      const canName = churchMembershipState.can_edit_parish_name;
      const canRequestRename = !!churchMembershipState.can_request_parish_rename;
      const canLogo = churchMembershipState.can_edit_logo;
      const canProfile = churchMembershipState.can_edit_church_profile;
      const canSubmitPriest = churchMembershipState.can_submit_priest || canProfile;

      if (nameInput) {
        nameInput.readOnly = locked && !canRequestRename && !canName;
        if (canRequestRename) nameInput.readOnly = false;
        if (canName) nameInput.readOnly = false;
        nameInput.setAttribute("aria-readonly", nameInput.readOnly ? "true" : "false");
      }
      if (nameHint) nameHint.hidden = !locked;
      if (logoHint) logoHint.hidden = !logoLocked;
      if (logoUploadRow) logoUploadRow.hidden = !canLogo;
      [logoInput, logoUpload].forEach((el) => {
        if (el) el.disabled = !canLogo;
      });

      if (submitBtn) submitBtn.hidden = !canName;
      if (renameBtn) renameBtn.hidden = !canRequestRename;
      if (saveBtn) saveBtn.hidden = !canProfile;

      [celebrantNew, celebrantAdd].forEach((el) => {
        if (el) el.disabled = !canSubmitPriest;
      });

      if (banner) {
        let msg = "";
        let cls = "status";
        if (churchMembershipState.is_superadmin) {
          msg = "Superadmin account — full access to Mass generation, songs, and parish settings.";
          cls = "status ok";
        } else if (canSubmitPriest && !churchMembershipState.can_use_full_app) {
          msg = "You can submit priest names and songs for superadmin approval. Mass generation unlocks after parish membership is approved.";
          cls = "status";
        } else if (status === "pending") {
          msg = "Your parish membership is pending superadmin approval.";
          cls = "status";
        } else if (status === "rejected") {
          msg = "Your parish membership was not approved. Contact the site administrator if you believe this is an error.";
          cls = "status error";
        } else if (status === "draft" && canName) {
          msg = "Enter your parish name and optional logo, then submit once. Name and logo cannot be changed later; a superadmin will confirm your membership.";
          cls = "status";
        }
        if (msg) {
          banner.hidden = false;
          banner.textContent = msg;
          banner.className = cls;
        } else {
          banner.hidden = true;
          banner.textContent = "";
        }
      }

      syncGlobalMembershipBanner(data);

      bindPendingSuperadminUnlock();
      syncSuperadminNavVisibility();
      if (saUnlockPendingNotify && churchMembershipState.is_superadmin && superadminToolsUnlocked()) {
        notify("Superadmin tools unlocked.", "ok");
        saUnlockPendingNotify = false;
      }
      if (isSuperadminRoute(normalizeRoute(currentRoute())) && !superadminToolsUnlocked()) {
        showRoute("/home", true);
      }
      if (typeof refreshSuperadminMembershipBadge === "function") refreshSuperadminMembershipBadge();

      if (churchMembershipState.is_superadmin && superadminToolsUnlocked()) {
        refreshSaApprovalInbox(true);
      } else if (typeof renderSaApprovalNotifSection === "function") {
        renderSaApprovalNotifSection();
        updateNotifBadge();
      }

      renderSettingsCelebrantList();
      syncGenerateButtons();
      syncPrivilegedUi();
    }

    function syncPrivilegedUi() {
      const sa = !!churchMembershipState.is_superadmin && superadminToolsUnlocked();
      const canFull = !!churchMembershipState.can_use_full_app;
      document.body.classList.toggle("is-superadmin", sa);
      document.body.classList.toggle("is-limited-member", !canFull);
      if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();

      const flowPage = $("flow-page");
      if (flowPage) flowPage.classList.toggle("is-readonly", !canFull);
      const themePage = $("theme-page");
      if (themePage) themePage.classList.toggle("is-readonly", !sa);

      [
        "btn-save-theme",
        "btn-analyze-template-pptx",
        "sa-btn-save-gemini-api-key",
        "saved-poster-upload",
      ].forEach((id) => {
        const el = $(id);
        if (el) el.disabled = !sa;
      });

      const geminiInp = $("sa-gemini-api-key");
      if (geminiInp) geminiInp.disabled = !sa;

      const posterGen = $("btn-poster-generate");
      if (posterGen) posterGen.disabled = !canFull;

      const tplUpload = $("template-pptx-upload");
      if (tplUpload) tplUpload.disabled = !sa;

      if (typeof renderThemeGrid === "function") renderThemeGrid();
      if (typeof renderSongCatalog === "function") renderSongCatalog();
      syncSuperadminNavVisibility();
      syncCalendarAdminVisibility();
    }

    function syncGenerateButtons() {
      const canGen = churchMembershipState.can_use_full_app;
      ["btn-generate-flow", "btn-generate-flow-inline"].forEach((id) => {
        const btn = $(id);
        if (!btn) return;
        btn.disabled = !canGen;
        btn.title = canGen ? "" : "Mass generation requires approved parish membership.";
      });
    }

    window.addEventListener("verbum:membership", (event) => {
      if (event.detail) syncMembershipUi(event.detail);
    });

    function applyCommunityPayload(data) {
      if (!data) return;
      if (data.community_name != null && $("settings-church-name")) {
        $("settings-church-name").value = data.community_name;
      }
      updateChurchLogoAvatar(data.logo_url || "");
      syncMembershipUi(data);
      applyCelebrantNamesFromServer(data.celebrant_names || []);
      bindCelebrantSelect();
      if (typeof syncSongHistoryScopeUi === "function") syncSongHistoryScopeUi();
    }

    async function fetchCommunityFromServer() {
      if (!memberApiAvailable()) {
        const err = new Error("Sign in required.");
        err.status = 401;
        throw err;
      }
      const auth = window.VerbumAuth;
      const headers = auth && auth.getAuthHeaders ? await auth.getAuthHeaders() : {};
      const res = await fetch("/api/community", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(
          typeof data.detail === "string" ? data.detail : (res.statusText || "Could not load church profile.")
        );
        err.status = res.status;
        throw err;
      }
      if (auth && auth.setCommunityPayload) auth.setCommunityPayload(data);
      applyCommunityPayload(data);
      updateAccountMenuDisplay();
      if (typeof syncSongHistoryScopeUi === "function") syncSongHistoryScopeUi();
      if (typeof pullSongHistoryFromAccount === "function") {
        void pullSongHistoryFromAccount().then(() => {
          if (typeof maybePreloadComposerFromRecentHistory === "function") maybePreloadComposerFromRecentHistory();
        });
      }
      if (!celebrantNamesCache.length) {
        migrateCelebrantsFromBrowserStorage().then(() => {
          applyCelebrantNamesFromServer(celebrantNamesCache);
          bindCelebrantSelect();
        });
      }
      return data;
    }

    async function openParishSubmitModal() {
      const name = ($("settings-church-name") && $("settings-church-name").value.trim()) || "";
      if (!name) {
        const statusEl = $("settings-church-status");
        if (statusEl) {
          statusEl.textContent = "Enter your parish name before submitting.";
          statusEl.className = "status error";
        }
        return;
      }
      const preview = $("parish-submit-name-preview");
      if (preview) preview.textContent = name;
      const modalImg = $("parish-submit-logo-img");
      const modalPh = $("parish-submit-logo-placeholder");
      const logoNote = $("parish-submit-logo-note");
      const hasLogo = !!currentLogoPreviewUrl;
      if (modalImg && modalPh) {
        if (hasLogo) {
          let src = currentLogoPreviewUrl;
          if (isPrivateFileUrl(currentLogoPreviewUrl)) {
            src = await resolvePrivateImageUrl(currentLogoPreviewUrl, "logo");
          }
          if (src) {
            modalImg.src = displayImageSrc(src);
            modalImg.hidden = false;
            modalPh.hidden = true;
          } else {
            modalImg.hidden = true;
            modalPh.hidden = false;
            modalPh.textContent = "—";
          }
        } else {
          modalImg.hidden = true;
          modalPh.hidden = false;
          modalPh.textContent = "—";
        }
      }
      if (logoNote) logoNote.hidden = hasLogo;
      setUiOverlayOpen($("parish-submit-modal"), true);
    }

    function closeParishSubmitModal() {
      setUiOverlayOpen($("parish-submit-modal"), false);
    }

    async function confirmParishSubmitFromModal() {
      const name = ($("settings-church-name") && $("settings-church-name").value.trim()) || "";
      if (!name) return;
      const statusEl = $("settings-church-status");
      const confirmBtn = $("parish-submit-confirm");
      if (statusEl) {
        statusEl.textContent = "Submitting parish name…";
        statusEl.className = "status";
      }
      if (confirmBtn) confirmBtn.disabled = true;
      try {
        const saved = await postJSON("/api/community/submit-parish", { community_name: name });
        closeParishSubmitModal();
        if (statusEl) {
          statusEl.textContent = "Parish name submitted. Waiting for superadmin approval.";
          statusEl.className = "status ok";
        }
        applyCommunityPayload(saved);
        updateAccountMenuDisplay();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Submit failed";
          statusEl.className = "status error";
        }
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    }

    async function refreshAdminPendingMemberships() {
      const listEl = $("sa-admin-pending-list");
      const statusEl = $("sa-admin-status");
      if (!listEl || !churchMembershipState.is_superadmin) return;
      if (statusEl) {
        statusEl.textContent = "Loading pending memberships…";
        statusEl.className = "status";
      }
      try {
        const auth = window.VerbumAuth;
        const headers = auth && auth.getAuthHeaders ? await auth.getAuthHeaders() : {};
        const res = await fetch("/api/admin/memberships/pending", { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not load pending memberships.");
        const pending = Array.isArray(data.pending) ? data.pending : [];
        if (!pending.length) {
          listEl.innerHTML = "<li class=\"muted\">No pending memberships.</li>";
        } else {
          listEl.innerHTML = pending.map((row) => {
            const parish = escapeHtml(row.community_name || "—");
            const email = escapeHtml((row.profile && row.profile.email) || row.user_id || "—");
            const uid = encodeURIComponent(row.user_id || "");
            return (
              "<li style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);\">" +
                "<span><strong>" + parish + "</strong><br><span class=\"muted\">" + email + "</span></span>" +
                "<span style=\"display:flex;gap:8px;\">" +
                  "<button type=\"button\" class=\"secondary btn-admin-reject\" data-user-id=\"" + uid + "\">Reject</button>" +
                  "<button type=\"button\" class=\"primary btn-admin-approve\" data-user-id=\"" + uid + "\">Approve</button>" +
                "</span>" +
              "</li>"
            );
          }).join("");
          listEl.querySelectorAll(".btn-admin-approve").forEach((btn) => {
            btn.addEventListener("click", () => {
              actOnMembership(btn.getAttribute("data-user-id"), "approve").catch((err) => {
                if (statusEl) {
                  statusEl.textContent = err.message || "Approve failed";
                  statusEl.className = "status error";
                }
              });
            });
          });
          listEl.querySelectorAll(".btn-admin-reject").forEach((btn) => {
            btn.addEventListener("click", () => {
              actOnMembership(btn.getAttribute("data-user-id"), "reject").catch((err) => {
                if (statusEl) {
                  statusEl.textContent = err.message || "Reject failed";
                  statusEl.className = "status error";
                }
              });
            });
          });
        }
        if (statusEl) {
          statusEl.textContent = "";
          statusEl.className = "status";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Could not load pending memberships.";
          statusEl.className = "status error";
        }
      }
    }

    async function actOnMembership(userId, action) {
      if (!userId) return;
      const statusEl = $("sa-admin-status");
      const auth = window.VerbumAuth;
      const headers = auth && auth.getAuthHeaders ? await auth.getAuthHeaders() : {};
      const res = await fetch(
        "/api/admin/memberships/" + encodeURIComponent(userId) + "/" + action,
        { method: "POST", headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Action failed.");
      if (statusEl) {
        statusEl.textContent = action === "approve" ? "Membership approved." : "Membership rejected.";
        statusEl.className = "status ok";
      }
      const inboxItem = (saApprovalInbox || []).find(
        (row) => row.kind === "membership" && String(row.entity_id) === String(userId)
      );
      if (inboxItem) markSaApprovalDone(inboxItem, action);
      await refreshAdminPendingMemberships();
      if (typeof refreshSaApprovalInbox === "function") await refreshSaApprovalInbox(false);
      if (normalizeRoute(currentRoute()) === "/superadmin") loadSaDashboard();
    }

    async function adminAuthHeaders() {
      const auth = window.VerbumAuth;
      return auth && auth.getAuthHeaders ? await auth.getAuthHeaders() : {};
    }

    var SA_APPROVAL_DONE_KEY = "verbum:sa-approval-done";
    var SA_APPROVAL_SESSION_KEY = "verbum:sa-session-started";
    var SA_APPROVAL_MODAL_KEY = "verbum:sa-approval-modal-dismissed";
    var saApprovalInbox = [];
    var saApprovalDone = [];

    function loadSaApprovalDone() {
      try {
        saApprovalDone = JSON.parse(sessionStorage.getItem(SA_APPROVAL_DONE_KEY) || "[]");
        if (!Array.isArray(saApprovalDone)) saApprovalDone = [];
      } catch (_e) {
        saApprovalDone = [];
      }
    }

    function saveSaApprovalDone() {
      try {
        sessionStorage.setItem(SA_APPROVAL_DONE_KEY, JSON.stringify(saApprovalDone.slice(0, 80)));
      } catch (_e) { /* ignore */ }
    }

    function beginSaApprovalSession() {
      if (sessionStorage.getItem(SA_APPROVAL_SESSION_KEY)) return;
      sessionStorage.setItem(SA_APPROVAL_SESSION_KEY, String(Date.now()));
      sessionStorage.removeItem(SA_APPROVAL_DONE_KEY);
      sessionStorage.removeItem(SA_APPROVAL_MODAL_KEY);
      saApprovalDone = [];
    }

    function resetSaApprovalSession() {
      sessionStorage.removeItem(SA_APPROVAL_SESSION_KEY);
      sessionStorage.removeItem(SA_APPROVAL_DONE_KEY);
      sessionStorage.removeItem(SA_APPROVAL_MODAL_KEY);
      saApprovalDone = [];
      saApprovalInbox = [];
      renderSaApprovalNotifSection();
    }

    function getSaApprovalDoneEntry(id) {
      return saApprovalDone.find((row) => row && row.id === id) || null;
    }

    function markSaApprovalDone(item, action) {
      if (!item || !item.id) return;
      const existing = getSaApprovalDoneEntry(item.id);
      const entry = {
        id: item.id,
        kind: item.kind,
        entity_id: item.entity_id,
        title: item.title,
        subtitle: item.subtitle,
        detail: item.detail,
        kind_label: item.kind_label,
        lyrics: item.lyrics || "",
        language: item.language || "",
        author: item.author || "",
        sections: Array.isArray(item.sections) ? item.sections : [],
        action: action || "resolved",
        at: new Date().toISOString(),
      };
      if (existing) {
        Object.assign(existing, entry);
      } else {
        saApprovalDone.unshift(entry);
      }
      saveSaApprovalDone();
      renderSaApprovalNotifSection();
      renderSaApprovalsModal();
      updateNotifBadge();
      refreshSuperadminMembershipBadgeFromInbox();
    }

    function getSaApprovalBadgeCount() {
      if (!churchMembershipState || !churchMembershipState.is_superadmin) return 0;
      const pendingIds = new Set((saApprovalInbox || []).map((row) => row.id));
      const open = (saApprovalInbox || []).filter((row) => !getSaApprovalDoneEntry(row.id)).length;
      const doneSticky = (saApprovalDone || []).filter((row) => !pendingIds.has(row.id)).length;
      return open + doneSticky;
    }

    function saApprovalActionLabel(action) {
      if (action === "approve") return "Approved";
      if (action === "reject") return "Rejected";
      return "Resolved";
    }

    function openSaSongLyricsModal(opts) {
      const options = opts || {};
      const modal = $("sa-song-lyrics-modal");
      const titleEl = $("sa-song-lyrics-modal-title");
      const descEl = $("sa-song-lyrics-modal-desc");
      const metaEl = $("sa-song-lyrics-modal-meta");
      const bodyEl = $("sa-song-lyrics-modal-body");
      if (!modal || !bodyEl) return;
      const title = String(options.title || "Submitted lyrics").trim() || "Submitted lyrics";
      const subtitle = String(options.subtitle || "").trim();
      const language = String(options.language || "").trim();
      const author = String(options.author || "").trim();
      const lyrics = String(options.lyrics || "").trim();
      if (titleEl) titleEl.textContent = title;
      if (descEl) {
        descEl.textContent = subtitle
          ? ("Submitted by " + subtitle)
          : "Review the full song before approving.";
      }
      if (metaEl) {
        const bits = [];
        if (language) bits.push(language);
        if (author) bits.push("Author: " + author);
        if (Array.isArray(options.sections) && options.sections.length) {
          bits.push("Sections: " + options.sections.filter(Boolean).join(", "));
        }
        if (bits.length) {
          metaEl.hidden = false;
          metaEl.textContent = bits.join(" · ");
        } else {
          metaEl.hidden = true;
          metaEl.textContent = "";
        }
      }
      bodyEl.textContent = lyrics || "No lyrics included with this submission.";
      setUiOverlayOpen(modal, true);
    }

    function closeSaSongLyricsModal() {
      setUiOverlayOpen($("sa-song-lyrics-modal"), false);
    }

    function openSaSongLyricsFromApprovalItem(item) {
      if (!item) return;
      openSaSongLyricsModal({
        title: item.title || "Submitted lyrics",
        subtitle: item.subtitle || "",
        lyrics: item.lyrics || "",
        language: item.language || "",
        author: item.author || "",
        sections: item.sections || [],
      });
    }

    function saApprovalCardHtml(item, opts) {
      const options = opts || {};
      const done = getSaApprovalDoneEntry(item.id);
      const isDone = !!done;
      const kind = escapeHtml(item.kind_label || item.kind || "Approval");
      const title = escapeHtml(item.title || "—");
      const sub = escapeHtml(item.subtitle || "");
      const detail = escapeHtml(item.detail || "");
      const cardClass = options.modal ? "sa-approvals-modal-card" : "sa-notif-item" + (isDone ? " sa-notif-item--done" : "");
      const tag = "li";
      const isSong = item.kind === "songs" || item.kind === "song";
      let actions = "";
      if (!isDone) {
        if (isSong) {
          actions +=
            "<button type=\"button\" class=\"secondary sa-approval-view-lyrics\" data-item-id=\"" +
            escapeHtml(item.id || "") +
            "\">View lyrics</button>";
        }
        if (item.kind === "membership") {
          actions +=
            "<button type=\"button\" class=\"secondary sa-approval-act\" data-kind=\"membership\" data-action=\"reject\" data-entity-id=\"" + escapeHtml(item.entity_id || "") + "\" data-item-id=\"" + escapeHtml(item.id || "") + "\">Reject</button>" +
            "<button type=\"button\" class=\"primary sa-approval-act\" data-kind=\"membership\" data-action=\"approve\" data-entity-id=\"" + escapeHtml(item.entity_id || "") + "\" data-item-id=\"" + escapeHtml(item.id || "") + "\">Approve</button>";
        } else {
          actions +=
            "<button type=\"button\" class=\"secondary sa-approval-act\" data-kind=\"" + escapeHtml(item.kind || "") + "\" data-action=\"reject\" data-entity-id=\"" + escapeHtml(item.entity_id || "") + "\" data-item-id=\"" + escapeHtml(item.id || "") + "\">Reject</button>" +
            "<button type=\"button\" class=\"primary sa-approval-act\" data-kind=\"" + escapeHtml(item.kind || "") + "\" data-action=\"approve\" data-entity-id=\"" + escapeHtml(item.entity_id || "") + "\" data-item-id=\"" + escapeHtml(item.id || "") + "\">Approve</button>";
        }
      } else {
        if (isSong) {
          actions +=
            "<button type=\"button\" class=\"secondary sa-approval-view-lyrics\" data-item-id=\"" +
            escapeHtml(item.id || "") +
            "\">View lyrics</button>";
        }
        actions += "<p class=\"sa-notif-item__status\">" + escapeHtml(saApprovalActionLabel(done.action)) + " · " + escapeHtml(formatNotificationTime(done.at)) + "</p>";
      }
      return (
        "<" + tag + " class=\"" + cardClass + "\" data-item-id=\"" + escapeHtml(item.id || "") + "\">" +
          "<p class=\"sa-notif-item__kind\">" + kind + "</p>" +
          "<p class=\"sa-notif-item__title\">" + title + "</p>" +
          (sub ? "<p class=\"sa-notif-item__sub\">" + sub + "</p>" : "") +
          (detail ? "<p class=\"sa-notif-item__detail\">" + detail + "</p>" : "") +
          "<div class=\"sa-notif-item__actions\">" + actions + "</div>" +
        "</" + tag + ">"
      );
    }

    function bindSaApprovalActions(root) {
      if (!root) return;
      root.querySelectorAll(".sa-approval-act").forEach((btn) => {
        btn.addEventListener("click", () => {
          runSaApprovalAction(
            btn.getAttribute("data-kind"),
            btn.getAttribute("data-entity-id"),
            btn.getAttribute("data-action"),
            btn.getAttribute("data-item-id"),
            btn
          );
        });
      });
      root.querySelectorAll(".sa-approval-view-lyrics").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemId = btn.getAttribute("data-item-id") || "";
          const item =
            (saApprovalInbox || []).find((row) => row.id === itemId) ||
            (saApprovalDone || []).find((row) => row.id === itemId);
          if (item) openSaSongLyricsFromApprovalItem(item);
        });
      });
    }

    async function runSaApprovalAction(kind, entityId, action, itemId, btnEl) {
      if (!kind || !entityId || !action) return;
      if (btnEl) btnEl.disabled = true;
      try {
        if (kind === "membership") {
          await actOnMembership(entityId, action);
        } else {
          await actOnSubmission(kind, entityId, action);
        }
      } catch (err) {
        notify(err.message || "Action failed.", "error");
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    }

    function renderSaApprovalNotifSection() {
      const section = $("sa-notif-section");
      const feed = $("sa-notif-feed");
      const countEl = $("sa-notif-count");
      if (!section || !feed) return false;
      if (!churchMembershipState || !churchMembershipState.is_superadmin) {
        section.hidden = true;
        feed.innerHTML = "";
        return false;
      }
      const openItems = (saApprovalInbox || []).filter((row) => !getSaApprovalDoneEntry(row.id));
      const doneSticky = (saApprovalDone || []).slice();
      const cards = openItems.concat(
        doneSticky.filter((done) => !openItems.some((open) => open.id === done.id))
      );
      if (!cards.length) {
        section.hidden = true;
        feed.innerHTML = "";
        if (countEl) countEl.textContent = "";
        return false;
      }
      section.hidden = false;
      if (countEl) {
        countEl.textContent = openItems.length
          ? (openItems.length + " pending")
          : "All caught up";
      }
      feed.innerHTML = cards.map((item) => saApprovalCardHtml(item, { modal: false })).join("");
      bindSaApprovalActions(feed);
      return true;
    }

    function renderSaApprovalsModal() {
      const listEl = $("sa-approvals-modal-list");
      const emptyEl = $("sa-approvals-modal-empty");
      if (!listEl) return;
      const openItems = (saApprovalInbox || []).filter((row) => !getSaApprovalDoneEntry(row.id));
      if (!openItems.length) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;
      listEl.innerHTML = openItems.map((item) => saApprovalCardHtml(item, { modal: true })).join("");
      bindSaApprovalActions(listEl);
    }

    function openSaApprovalsModal() {
      renderSaApprovalsModal();
      const modal = $("sa-approvals-modal");
      if (modal) {
        setUiOverlayOpen(modal, true);
        const adminLink = $("sa-approvals-modal-open-admin");
        if (adminLink) bindSpaRouteLink(adminLink);
      }
    }

    function closeSaApprovalsModal(dismiss) {
      setUiOverlayOpen($("sa-approvals-modal"), false);
      if (dismiss) {
        try { sessionStorage.setItem(SA_APPROVAL_MODAL_KEY, "1"); } catch (_e) { /* ignore */ }
      }
    }

    function maybeShowSaApprovalsLoginModal() {
      if (!churchMembershipState || !churchMembershipState.is_superadmin) return;
      const openCount = (saApprovalInbox || []).filter((row) => !getSaApprovalDoneEntry(row.id)).length;
      if (!openCount) return;
      if (sessionStorage.getItem(SA_APPROVAL_MODAL_KEY) === "1") return;
      openSaApprovalsModal();
    }

    async function refreshSaApprovalInbox(showLoginModal) {
      loadSaApprovalDone();
      if (!churchMembershipState || !churchMembershipState.is_superadmin) {
        saApprovalInbox = [];
        renderSaApprovalNotifSection();
        updateNotifBadge();
        return;
      }
      try {
        const data = await saFetchAdmin("/api/admin/approvals/inbox");
        saApprovalInbox = Array.isArray(data.items) ? data.items : [];
      } catch (_err) {
        saApprovalInbox = [];
      }
      renderSaApprovalNotifSection();
      renderNotificationFeed();
      updateNotifBadge();
      refreshSuperadminMembershipBadgeFromInbox();
      if (showLoginModal) maybeShowSaApprovalsLoginModal();
    }

    function refreshSuperadminMembershipBadgeFromInbox() {
      const open = (saApprovalInbox || []).filter((row) => !getSaApprovalDoneEntry(row.id)).length;
      const badge = $("sa-nav-badge-membership");
      if (!badge) return;
      if (open > 0) {
        badge.hidden = false;
        badge.textContent = String(open);
        badge.dataset.inboxCount = String(open);
      } else {
        delete badge.dataset.inboxCount;
        if (!badge.dataset.dashboardCount) {
          badge.hidden = true;
          badge.textContent = "";
        }
      }
    }

    function initSaApprovalNotifications() {
      loadSaApprovalDone();
      const closeBtn = $("sa-approvals-modal-close");
      const backdrop = $("sa-approvals-modal-backdrop");
      const laterBtn = $("sa-approvals-modal-later");
      if (closeBtn) closeBtn.addEventListener("click", () => closeSaApprovalsModal(true));
      if (backdrop) backdrop.addEventListener("click", () => closeSaApprovalsModal(true));
      if (laterBtn) laterBtn.addEventListener("click", () => closeSaApprovalsModal(true));
      const lyricsClose = $("sa-song-lyrics-modal-close");
      const lyricsBackdrop = $("sa-song-lyrics-modal-backdrop");
      const lyricsDone = $("sa-song-lyrics-modal-done");
      if (lyricsClose) lyricsClose.addEventListener("click", closeSaSongLyricsModal);
      if (lyricsBackdrop) lyricsBackdrop.addEventListener("click", closeSaSongLyricsModal);
      if (lyricsDone) lyricsDone.addEventListener("click", closeSaSongLyricsModal);
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const lyricsModal = $("sa-song-lyrics-modal");
        if (lyricsModal && lyricsModal.classList.contains("is-open")) {
          closeSaSongLyricsModal();
          e.preventDefault();
        }
      });
      window.addEventListener("verbum:signed-out", () => {
        resetSaApprovalSession();
        lockSuperadminTools();
      });
      window.addEventListener("verbum:auth-ready", (event) => {
        const user = event.detail && event.detail.user;
        if (!user) return;
        beginSaApprovalSession();
      });
    }

    initSaApprovalNotifications();

    async function actOnSubmission(kind, submissionId, action) {
      if (!submissionId) return;
      const statusEl = $("sa-admin-status");
      const headers = await adminAuthHeaders();
      const pathKind = kind === "parish_names" ? "parish-names" : kind;
      const res = await fetch(
        "/api/admin/submissions/" + pathKind + "/" + encodeURIComponent(submissionId) + "/" + action,
        { method: "POST", headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Action failed.");
      if (statusEl) {
        let msg = action === "approve" ? "Submission approved." : "Submission rejected.";
        if (kind === "songs") {
          msg = action === "approve" ? "Song approved and added to the library." : "Song submission rejected.";
        } else if (kind === "priests") {
          msg = action === "approve" ? "Priest approved and added to the list." : "Priest submission rejected.";
        } else if (kind === "parish_names") {
          msg = action === "approve" ? "Parish rename approved." : "Parish rename rejected.";
        }
        statusEl.textContent = msg;
        statusEl.className = "status ok";
      }
      const inboxItem = (saApprovalInbox || []).find(
        (row) => row.kind === kind && String(row.entity_id) === String(submissionId)
      );
      if (inboxItem) markSaApprovalDone(inboxItem, action);
      if (kind === "songs") {
        await refreshAdminPendingSongs();
        invalidateSongCatalogCaches();
        await loadSongCatalog(true);
      } else if (kind === "parish_names") {
        await refreshAdminPendingRenames();
        if (typeof loadSaParishes === "function") loadSaParishes();
        if (saState.parishDrawerId && typeof loadSaParishDetail === "function") {
          loadSaParishDetail(saState.parishDrawerId);
        }
      } else {
        await refreshAdminPendingPriests();
        await refreshCommunity();
      }
      if (normalizeRoute(currentRoute()) === "/superadmin") loadSaDashboard();
      if (typeof refreshSaApprovalInbox === "function") await refreshSaApprovalInbox(false);
    }

    async function refreshAdminPendingSongs() {
      const listEl = $("sa-admin-pending-songs");
      if (!listEl || !churchMembershipState.is_superadmin) return;
      try {
        const res = await fetch("/api/admin/submissions/songs/pending", { headers: await adminAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not load pending songs.");
        const pending = Array.isArray(data.pending) ? data.pending : [];
        if (!pending.length) {
          listEl.innerHTML = "<li class=\"muted\">No pending songs.</li>";
          return;
        }
        listEl.innerHTML = pending.map((row) => {
          const payload = row.payload || {};
          const title = escapeHtml(payload.title || "Untitled");
          const email = escapeHtml(row.submitted_by_email || row.submitted_by_user_id || "—");
          const sid = escapeHtml(String(row.id || ""));
          const matches = Array.isArray(payload.possible_matches) ? payload.possible_matches : [];
          const matchNote = matches.length
            ? "<br><span class=\"status error\" style=\"font-size:0.78rem;\">Similar in catalog: " +
              escapeHtml(matches.slice(0, 3).map((m) => m.title || m.id).join(", ")) +
              (matches.length > 3 ? "…" : "") + "</span>"
            : "";
          return (
            "<li style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);\">" +
              "<span><strong>" + title + "</strong><br><span class=\"muted\">" + email + "</span>" + matchNote + "</span>" +
              "<span style=\"display:flex;gap:8px;flex-wrap:wrap;\">" +
                "<button type=\"button\" class=\"secondary btn-admin-song-view-lyrics\" data-submission-id=\"" + sid + "\">View lyrics</button>" +
                "<button type=\"button\" class=\"secondary btn-admin-song-reject\" data-submission-id=\"" + sid + "\">Reject</button>" +
                "<button type=\"button\" class=\"primary btn-admin-song-approve\" data-submission-id=\"" + sid + "\">Approve</button>" +
              "</span>" +
            "</li>"
          );
        }).join("");
        const byId = {};
        pending.forEach((row) => {
          if (row && row.id) byId[String(row.id)] = row;
        });
        listEl.querySelectorAll(".btn-admin-song-view-lyrics").forEach((btn) => {
          btn.addEventListener("click", () => {
            const row = byId[btn.getAttribute("data-submission-id") || ""];
            const payload = (row && row.payload) || {};
            openSaSongLyricsModal({
              title: payload.title || "Submitted lyrics",
              subtitle: (row && (row.submitted_by_email || row.submitted_by_user_id)) || "",
              lyrics: payload.lyrics || "",
              language: payload.language || "",
              author: payload.author || "",
              sections: payload.sections || [],
            });
          });
        });
        listEl.querySelectorAll(".btn-admin-song-approve").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("songs", btn.getAttribute("data-submission-id"), "approve").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Approve failed";
                statusEl.className = "status error";
              }
            });
          });
        });
        listEl.querySelectorAll(".btn-admin-song-reject").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("songs", btn.getAttribute("data-submission-id"), "reject").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Reject failed";
                statusEl.className = "status error";
              }
            });
          });
        });
      } catch (err) {
        listEl.innerHTML = "<li class=\"muted\">" + escapeHtml(err.message || "Could not load pending songs.") + "</li>";
      }
    }

    async function refreshAdminPendingPriests() {
      const listEl = $("sa-admin-pending-priests");
      if (!listEl || !churchMembershipState.is_superadmin) return;
      try {
        const res = await fetch("/api/admin/submissions/priests/pending", { headers: await adminAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not load pending priests.");
        const pending = Array.isArray(data.pending) ? data.pending : [];
        if (!pending.length) {
          listEl.innerHTML = "<li class=\"muted\">No pending priests.</li>";
          return;
        }
        listEl.innerHTML = pending.map((row) => {
          const payload = row.payload || {};
          const name = escapeHtml(payload.name || "—");
          const email = escapeHtml(row.submitted_by_email || row.submitted_by_user_id || "—");
          const sid = encodeURIComponent(row.id || "");
          return (
            "<li style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);\">" +
              "<span><strong>" + name + "</strong><br><span class=\"muted\">" + email + "</span></span>" +
              "<span style=\"display:flex;gap:8px;\">" +
                "<button type=\"button\" class=\"secondary btn-admin-priest-reject\" data-submission-id=\"" + sid + "\">Reject</button>" +
                "<button type=\"button\" class=\"primary btn-admin-priest-approve\" data-submission-id=\"" + sid + "\">Approve</button>" +
              "</span>" +
            "</li>"
          );
        }).join("");
        listEl.querySelectorAll(".btn-admin-priest-approve").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("priests", btn.getAttribute("data-submission-id"), "approve").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Approve failed";
                statusEl.className = "status error";
              }
            });
          });
        });
        listEl.querySelectorAll(".btn-admin-priest-reject").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("priests", btn.getAttribute("data-submission-id"), "reject").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Reject failed";
                statusEl.className = "status error";
              }
            });
          });
        });
      } catch (err) {
        listEl.innerHTML = "<li class=\"muted\">" + escapeHtml(err.message || "Could not load pending priests.") + "</li>";
      }
    }

    var saState = {
      panel: "dashboard",
      parishes: { page: 1, perPage: 25, q: "" },
      users: { page: 1, perPage: 25, q: "" },
      generations: { page: 1, perPage: 25, q: "" },
      auditLog: { page: 1, perPage: 25, q: "", action: "", entityType: "" },
      storage: { prefix: "", page: 1, perPage: 50 },
      aiQuota: { page: 1, perPage: 25, q: "" },
      parishDrawerId: null,
      initialized: false,
      songPreviews: { page: 1, perPage: 40, q: "", section: "all", status: "all" },
    };

    var SA_PAGE_SIZE = 25;

    function saPagerMeta(total, page, perPage) {
      const t = Math.max(0, Number(total) || 0);
      const size = Math.max(1, Number(perPage) || SA_PAGE_SIZE);
      const pages = Math.max(1, Math.ceil(t / size) || 1);
      const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
      const start = t ? ((safePage - 1) * size + 1) : 0;
      const end = t ? Math.min(safePage * size, t) : 0;
      return { total: t, page: safePage, pages, start, end, perPage: size };
    }

    function saRenderPager(pagerEl, scope, meta) {
      if (!pagerEl) return;
      if (meta.total <= meta.perPage) {
        pagerEl.hidden = true;
        pagerEl.innerHTML = "";
        return;
      }
      pagerEl.hidden = false;
      pagerEl.innerHTML =
        "<div class=\"sa-pagination\">" +
          "<button type=\"button\" class=\"secondary sa-pager-prev\" data-sa-pager=\"" + escapeHtml(scope) + "\"" +
            (meta.page <= 1 ? " disabled" : "") + ">Previous</button>" +
          "<span class=\"sa-pagination__info\">" + meta.start + "–" + meta.end + " of " + meta.total +
            " · Page " + meta.page + " / " + meta.pages + "</span>" +
          "<button type=\"button\" class=\"secondary sa-pager-next\" data-sa-pager=\"" + escapeHtml(scope) + "\"" +
            (meta.page >= meta.pages ? " disabled" : "") + ">Next</button>" +
        "</div>";
    }

    function saPagerStatusText(meta) {
      if (!meta.total) return "No results.";
      if (meta.total <= meta.perPage) return meta.total + " total";
      return "Showing " + meta.start + "–" + meta.end + " of " + meta.total;
    }

    function showSaPanel(panelId) {
      saState.panel = panelId || "dashboard";
      document.querySelectorAll(".sa-nav-link[data-sa-panel]").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("data-sa-panel") === saState.panel);
      });
      document.querySelectorAll(".sa-mobile-nav__btn[data-sa-panel]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-sa-panel") === saState.panel);
      });
      document.querySelectorAll(".sa-panel[data-sa-panel]").forEach((panel) => {
        const on = panel.getAttribute("data-sa-panel") === saState.panel;
        panel.hidden = !on;
      });
      syncSaTopbar(saState.panel);
      scrollSaMobileNavToActive();
      scrollSaPanelToTop();
      if (saState.panel === "dashboard") loadSaDashboard();
      else if (saState.panel === "analytics") loadSaAnalytics();
      else if (saState.panel === "parishes") { loadSaParishes(); saPopulateMergeSelects(); }
      else if (saState.panel === "users") loadSaUsers();
      else if (saState.panel === "membership") loadSaMembership();
      else if (saState.panel === "invites") { saSyncInviteModeUi(); loadSaInvites(); }
      else if (saState.panel === "generations") loadSaGenerations();
      else if (saState.panel === "audit-log") loadSaAuditLog();
      else if (saState.panel === "content-readings") loadSaReadingsCache();
      else if (saState.panel === "content-songs") {
        loadSaHymnCatalogStatus();
        loadSaSongPreviews();
      }
      else if (saState.panel === "system-ai") { refreshGeminiSettings(); loadSaAiQuotaSummary(); loadSaParishQuotaTable(); }
      else if (saState.panel === "system-announcement") loadSaAnnouncementAdmin();
      else if (saState.panel === "system-storage") loadSaStorageBrowser();
      else if (saState.panel === "system-flags") loadSaFeatureFlags();
      else if (saState.panel === "system-maintenance") loadSaHealth();
    }

    function scrollSaPanelToTop() {
      const dash = document.querySelector(".dashboard");
      const target = $("sa-topbar") || $("superadmin-page");
      if (!dash || !target) return;
      const dashRect = dash.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = dash.scrollTop + (targetRect.top - dashRect.top) - 4;
      try {
        dash.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      } catch (_e) {
        dash.scrollTop = Math.max(0, nextTop);
      }
    }

    function syncSaTopbar(panelId) {
      const panel = document.querySelector('.sa-panel[data-sa-panel="' + panelId + '"]');
      const titleEl = $("sa-topbar-title");
      const descEl = $("sa-topbar-desc");
      const groupEl = $("sa-topbar-group");
      if (!panel) return;
      const head = panel.querySelector(".flow-bento-cell__head .home-card-head__text");
      const h3 = head && head.querySelector("h3");
      const p = head && head.querySelector("p");
      if (titleEl) titleEl.textContent = (h3 && h3.textContent.trim()) || panelId;
      if (descEl) descEl.textContent = (p && p.textContent.trim()) || "";
      const link = document.querySelector('.sa-nav-link[data-sa-panel="' + panelId + '"]');
      const group = link && link.closest(".sa-nav-group");
      const label = group && group.querySelector(".sa-nav-group__label span");
      if (groupEl) groupEl.textContent = (label && label.textContent.trim()) || "";
    }

    function buildSaMobileNav() {
      const host = $("sa-mobile-nav");
      if (!host || host.dataset.built === "1") return;
      host.dataset.built = "1";
      const frag = document.createDocumentFragment();
      document.querySelectorAll("#sa-sidebar-nav .sa-nav-link[data-sa-panel]").forEach((link) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sa-mobile-nav__btn";
        btn.setAttribute("data-sa-panel", link.getAttribute("data-sa-panel"));
        const label = Array.from(link.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(" ")
          .trim() || link.textContent.trim();
        btn.textContent = label.replace(/\s+/g, " ").trim();
        btn.addEventListener("click", () => showSaPanel(btn.getAttribute("data-sa-panel")));
        frag.appendChild(btn);
      });
      host.appendChild(frag);
    }

    function scrollSaMobileNavToActive() {
      const host = $("sa-mobile-nav");
      if (!host) return;
      const active = host.querySelector(".sa-mobile-nav__btn.active");
      if (active && active.scrollIntoView) {
        try { active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }
        catch (_e) { /* ignore */ }
      }
    }

    function saFormatStat(value, fallback) {
      if (value === null || value === undefined) return fallback || "—";
      return String(value);
    }

    function saParseIsoDate(iso) {
      if (!iso) return null;
      let raw = String(iso).trim();
      if (!raw || raw === "—") return null;
      // Date-only values stay calendar-local (noon avoids DST edge flips).
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const d = new Date(raw + "T12:00:00");
        return Number.isNaN(d.getTime()) ? null : d;
      }
      // Supabase timestamps are UTC; if no offset/Z is present, treat as UTC.
      if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
        raw = raw.replace(" ", "T");
        if (!raw.endsWith("Z")) raw += "Z";
      }
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function saFormatLocalDateTime(iso, fallback) {
      const d = saParseIsoDate(iso);
      if (!d) return fallback != null ? fallback : "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    function applyAppVersionLabelLocalTime() {
      const el = $("app-version-label");
      if (!el) return;
      const metaVer = document.querySelector('meta[name="lf-app-version"]');
      const metaAt = document.querySelector('meta[name="lf-built-at"]');
      const version = (metaVer && metaVer.getAttribute("content")) || "";
      const iso = (el.getAttribute("data-built-at") || (metaAt && metaAt.getAttribute("content")) || "").trim();
      if (!version) return;
      const when = iso ? saFormatLocalDateTime(iso, "") : "";
      el.textContent = when ? ("v " + version + " · " + when) : ("v " + version);
      if (iso) el.setAttribute("title", "Deployed " + when + " (local time)");
    }

    function saFormatLocalDate(iso, fallback) {
      const d = saParseIsoDate(iso);
      if (!d) return fallback != null ? fallback : "—";
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    function saRenderStatCard(label, value, sub) {
      return (
        "<div class=\"sa-stat\"><p class=\"sa-stat__label\">" + escapeHtml(label) + "</p>" +
        "<p class=\"sa-stat__value\">" + escapeHtml(saFormatStat(value)) + "</p>" +
        (sub ? "<p class=\"sa-stat__sub\">" + escapeHtml(sub) + "</p>" : "") +
        "</div>"
      );
    }

    async function saFetchAdmin(path, options) {
      const headers = Object.assign({}, await adminAuthHeaders(), (options && options.headers) || {});
      const res = await fetch(path, Object.assign({}, options || {}, { headers }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Request failed.");
      return data;
    }

    async function loadSaDashboard() {
      const statsEl = $("sa-dashboard-stats");
      const activityEl = $("sa-dashboard-activity");
      if (!statsEl) return;
      statsEl.innerHTML = Array(6).fill("<div class=\"sa-stat sa-skeleton\"></div>").join("");
      try {
        const data = await saFetchAdmin("/api/admin/dashboard");
        const c = data.cards || {};
        statsEl.innerHTML = [
          saRenderStatCard("Users", c.users_total),
          saRenderStatCard("Approved parishes", c.parishes_approved),
          saRenderStatCard("Pending parishes", c.parishes_pending),
          saRenderStatCard("Generations today", c.generations_today),
          saRenderStatCard("AI images today", c.ai_images_today),
          saRenderStatCard("Pending songs", c.pending_songs, (c.pending_priests || 0) + " priests pending"),
          saRenderStatCard("Supabase", c.supabase_ok ? "OK" : "Off", c.supabase_ok ? "Connected" : "Not configured"),
          saRenderStatCard("Redis", c.redis_ok ? "OK" : "Off"),
          saRenderStatCard("Readings cache", (c.readings_cache && c.readings_cache.entries) || 0, ((c.readings_cache && c.readings_cache.bytes) || 0) + " bytes"),
        ].join("");
        const activity = Array.isArray(data.recent_activity) ? data.recent_activity : [];
        if (activityEl) {
          activityEl.innerHTML = activity.length
            ? activity.map((row) => {
              const panel = row.panel || "";
              const jump = panel ? " data-sa-activity-jump=\"" + escapeHtml(panel) + "\" role=\"button\" tabindex=\"0\" style=\"cursor:pointer;\"" : "";
              return (
                "<li" + jump + "><span><strong>" + escapeHtml(String(row.label || "—")) + "</strong>" +
                "<br><span class=\"muted\">" + escapeHtml(String(row.detail || row.type || "")) + "</span></span>" +
                "<span class=\"muted\">" + escapeHtml(saFormatLocalDateTime(row.at)) + "</span></li>"
              );
            }).join("")
            : "<li class=\"muted\">No recent activity.</li>";
          activityEl.querySelectorAll("[data-sa-activity-jump]").forEach((el) => {
            const go = () => showSaPanel(el.getAttribute("data-sa-activity-jump"));
            el.addEventListener("click", go);
            el.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
            });
          });
        }
        refreshSuperadminMembershipBadge(c);
      } catch (err) {
        if (statsEl) statsEl.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Could not load dashboard.") + "</p>";
      }
    }

    function refreshSuperadminMembershipBadge(cards) {
      const badge = $("sa-nav-badge-membership");
      if (!badge) return;
      const pending = cards
        ? ((cards.parishes_pending || 0) + (cards.pending_songs || 0) + (cards.pending_priests || 0))
        : null;
      if (pending === null) {
        if (!badge.dataset.inboxCount) {
          badge.hidden = true;
        }
        return;
      }
      if (pending > 0) {
        badge.hidden = false;
        badge.textContent = String(pending);
        badge.dataset.dashboardCount = String(pending);
      } else {
        delete badge.dataset.dashboardCount;
        if (!badge.dataset.inboxCount) {
          badge.hidden = true;
          badge.textContent = "";
        }
      }
    }

    function saRenderTable(headers, rows, emptyMsg) {
      if (!rows.length) return "<p class=\"sa-empty\">" + escapeHtml(emptyMsg || "No results.") + "</p>";
      const head = "<thead><tr>" + headers.map((h) => "<th>" + escapeHtml(h) + "</th>").join("") + "</tr></thead>";
      const body = "<tbody>" + rows.join("") + "</tbody>";
      return "<table class=\"sa-table\">" + head + body + "</table>";
    }

    async function createSaParish() {
      if (!guardSuperadminAction()) return;
      const nameEl = $("sa-create-parish-name");
      const assignEl = $("sa-create-parish-assign");
      const roleEl = $("sa-create-parish-role");
      const statusEl = $("sa-create-parish-status");
      const name = nameEl ? nameEl.value.trim() : "";
      if (name.length < 2) {
        if (statusEl) { statusEl.textContent = "Enter a parish name."; statusEl.className = "status error"; }
        return;
      }
      let assignUserId = assignEl ? assignEl.value : "";
      if (assignUserId === "__self__") {
        assignUserId = (churchMembershipState && churchMembershipState.user_id) || "";
        if (!assignUserId && window.VerbumAuth && window.VerbumAuth.getUser) {
          const u = window.VerbumAuth.getUser();
          assignUserId = (u && (u.id || u.user_id)) || "";
        }
      }
      if (statusEl) { statusEl.textContent = "Creating parish…"; statusEl.className = "status"; }
      try {
        const data = await saFetchAdmin("/api/admin/parishes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            community_name: name,
            membership_status: "approved",
            assign_user_id: assignUserId || null,
            assign_role: (roleEl && roleEl.value) || "president",
          }),
        });
        if (statusEl) {
          statusEl.textContent = "Created " + ((data.parish && data.parish.community_name) || name) + ".";
          statusEl.className = "status ok";
        }
        if (nameEl) nameEl.value = "";
        saState.parishOptions = null;
        loadSaParishes();
        saPopulateMergeSelects();
        notify("Parish created.", "ok");
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Create failed."; statusEl.className = "status error"; }
      }
    }

    async function loadSaParishes() {
      const wrap = $("sa-parishes-table-wrap");
      const statusEl = $("sa-parishes-status");
      const pagerEl = $("sa-parishes-pager");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      try {
        const q = saState.parishes.q || "";
        const perPage = saState.parishes.perPage || SA_PAGE_SIZE;
        const data = await saFetchAdmin(
          "/api/admin/parishes?page=" + saState.parishes.page +
          "&per_page=" + perPage +
          "&q=" + encodeURIComponent(q)
        );
        const items = Array.isArray(data.items) ? data.items : [];
        const meta = saPagerMeta(data.total, data.page || saState.parishes.page, data.per_page || perPage);
        saState.parishes.page = meta.page;
        const rows = items.map((row) => {
          const pid = String(row.id || "");
          return (
          "<tr class=\"sa-parish-row\" data-parish-id=\"" + escapeHtml(pid) + "\" tabindex=\"0\" role=\"button\" aria-label=\"View parish details\">" +
          "<td>" + escapeHtml(row.community_name || "—") + "</td>" +
          "<td>" + escapeHtml(row.owner_email || "—") + "</td>" +
          "<td>" + escapeHtml(row.membership_status || "—") + "</td>" +
          "<td>" + escapeHtml(row.members_label || (String(row.members_count || 1) + "/5")) + "</td>" +
          "<td class=\"muted\">" + escapeHtml(saFormatLocalDate(row.updated_at)) + "</td></tr>"
          );
        });
        wrap.innerHTML = saRenderTable(["Parish", "Owner", "Status", "Members", "Updated"], rows, "No parishes found.");
        saRenderPager(pagerEl, "parishes", meta);
        if (statusEl) statusEl.textContent = saPagerStatusText(meta);
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function loadSaUsers() {
      const wrap = $("sa-users-table-wrap");
      const statusEl = $("sa-users-status");
      const pagerEl = $("sa-users-pager");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      try {
        if (!saState.parishOptions) {
          const optData = await saFetchAdmin("/api/admin/parishes/options");
          saState.parishOptions = Array.isArray(optData.items) ? optData.items : [];
        }
        const q = saState.users.q || "";
        const perPage = saState.users.perPage || SA_PAGE_SIZE;
        const data = await saFetchAdmin(
          "/api/admin/users?page=" + saState.users.page +
          "&per_page=" + perPage +
          "&q=" + encodeURIComponent(q)
        );
        const items = Array.isArray(data.items) ? data.items : [];
        const meta = saPagerMeta(data.total, data.page || saState.users.page, data.per_page || perPage);
        saState.users.page = meta.page;
        const parishOptions = saState.parishOptions || [];
        if (!items.length) {
          wrap.innerHTML = "<p class=\"sa-empty\">No users found.</p>";
        } else {
          const rows = items.map((row) => {
            const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
            const uid = encodeURIComponent(row.id || "");
            const metaBits = [];
            if (row.parish_name) metaBits.push("<span>" + escapeHtml(row.parish_name) + "</span>");
            if (row.parish_role) metaBits.push("<span>" + escapeHtml(row.parish_role) + "</span>");
            if (row.role) metaBits.push("<span>" + escapeHtml(row.role) + "</span>");
            if (row.membership_status) metaBits.push("<span>" + escapeHtml(row.membership_status) + "</span>");
            if (row.location_label) metaBits.push("<span>" + escapeHtml(row.location_label) + "</span>");
            if (row.language_hint) metaBits.push("<span>" + escapeHtml(row.language_hint) + "</span>");
            if (row.phone) metaBits.push("<span>" + escapeHtml(row.phone) + "</span>");
            if (row.last_seen_at) {
              metaBits.push(
                "<span title=\"" + escapeHtml(row.last_seen_at || "") + "\">Seen " +
                escapeHtml(saFormatLocalDateTime(row.last_seen_at)) + "</span>"
              );
            }
            let actions = "";
            if (row.can_set_parish_role) {
              actions +=
                "<select class=\"sa-user-parish-pick\" data-user-id=\"" + uid + "\" aria-label=\"Assign parish\">" +
                "<option value=\"\">" + (row.parish_id ? "Parish…" : "Assign…") + "</option>" +
                parishOptions.map((p) => (
                  "<option value=\"" + escapeHtml(p.id || "") + "\"" +
                  (String(p.id || "") === String(row.parish_id || "") ? " selected" : "") +
                  ">" + escapeHtml(p.community_name || "Parish") + "</option>"
                )).join("") +
                "</select>" +
                "<select class=\"sa-user-parish-role\" data-user-id=\"" + uid + "\" data-parish-id=\"" +
                  escapeHtml(row.parish_id || "") + "\" aria-label=\"Parish role\">" +
                "<option value=\"president\"" + (row.parish_role === "president" ? " selected" : "") + ">President</option>" +
                "<option value=\"media\"" + (row.parish_role === "media" ? " selected" : "") + ">Media</option>" +
                "</select>" +
                "<button type=\"button\" class=\"secondary sa-btn-save-parish-role\" data-user-id=\"" + uid + "\">Save</button>";
            }
            if (row.can_delete) {
              actions +=
                "<button type=\"button\" class=\"secondary sa-btn-delete-user\" data-user-id=\"" + uid +
                "\" data-user-email=\"" + escapeHtml(row.email || "") + "\">Delete</button>";
            }
            return (
              "<li class=\"sa-user-row\">" +
                "<div class=\"sa-user-row__main\">" +
                  "<div class=\"sa-user-row__title\">" +
                    "<span class=\"sa-user-row__name\">" + escapeHtml(name) + "</span>" +
                    "<span class=\"sa-user-row__email\">" + escapeHtml(row.email || "—") + "</span>" +
                  "</div>" +
                  (metaBits.length ? "<div class=\"sa-user-row__meta\">" + metaBits.join("") + "</div>" : "") +
                "</div>" +
                "<div class=\"sa-user-row__side\">" +
                  "<span class=\"sa-user-presence" + (row.online ? " is-online" : "") + "\">" +
                    (row.online ? "Online" : "Offline") +
                  "</span>" +
                  (row.created_at
                    ? "<span class=\"sa-user-row__joined\">Joined " + escapeHtml(saFormatLocalDate(row.created_at)) + "</span>"
                    : "") +
                  (actions ? "<div class=\"sa-user-row__actions\">" + actions + "</div>" : "") +
                "</div>" +
              "</li>"
            );
          }).join("");
          wrap.innerHTML = "<ul class=\"sa-user-list\" aria-label=\"Users\">" + rows + "</ul>";
        }
        wrap.querySelectorAll(".sa-btn-delete-user").forEach((btn) => {
          btn.addEventListener("click", () => deleteSaUser(btn));
        });
        wrap.querySelectorAll(".sa-btn-save-parish-role").forEach((btn) => {
          btn.addEventListener("click", () => saveSaUserParishRole(btn));
        });
        saRenderPager(pagerEl, "users", meta);
        if (statusEl) statusEl.textContent = saPagerStatusText(meta);
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

