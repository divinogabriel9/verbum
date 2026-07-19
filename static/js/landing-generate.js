(function () {
  "use strict";

  var STORAGE_KEY = "liturgyflow.landing.generate.v1";

  var PRESET_THEMES = [
    {
      id: "theme1",
      name: "Theme 1 · Liturgy Flow",
      note: "Black background with amber titles.",
      bg: "#000000",
      primary: "#f0fdf4",
      accent: "#ffb800",
      text: "#f0fdf4",
      font: "Arial, Helvetica, sans-serif",
    },
    {
      id: "theme2",
      name: "Theme 2 · Midnight",
      note: "Black background, all text white.",
      bg: "#000000",
      primary: "#ffffff",
      accent: "#ffffff",
      text: "#ffffff",
      font: "Arial, Helvetica, sans-serif",
    },
    {
      id: "theme3",
      name: "Theme 3 · Paper",
      note: "White background, all text black.",
      bg: "#ffffff",
      primary: "#000000",
      accent: "#000000",
      text: "#000000",
      font: "Arial, Helvetica, sans-serif",
    },
  ];

  var MOOD_PICK_SECTIONS = [
    { key: "entrance", label: "Entrance", slotKey: "entrance", count: 1 },
    { key: "offertory", label: "Offertory", slotKey: "offertory", count: 1 },
    { key: "communion", label: "Communion", slotKeys: ["communion_1", "communion_2"], count: 2 },
    { key: "recessional", label: "Recessional", slotKey: "recessional", count: 1 },
  ];

  var GOSPEL_MOOD_RELATED = {
    triumphant: ["reverent"],
    solemn: ["reverent", "mercy"],
    mercy: ["solemn", "reverent"],
    journey: ["reverent", "mercy"],
    reverent: ["solemn", "journey"],
  };

  var state = {
    step: 1,
    language: "english",
    themeId: "theme1",
    celebrant: "",
    massDate: "",
    preview: null,
    songs: [],
    generating: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatDateInput(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function upcomingSundayISO(base) {
    var d = base ? new Date(base.getFullYear(), base.getMonth(), base.getDate()) : new Date();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      d = new Date();
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    var dow = d.getDay();
    var add = dow === 0 ? 0 : 7 - dow;
    d.setDate(d.getDate() + add);
    return formatDateInput(d);
  }

  function formatNiceDate(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso || "";
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSupabaseToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("sb-") !== 0 || k.indexOf("-auth-token") !== k.length - 11) continue;
        var raw = localStorage.getItem(k);
        if (!raw || raw === "null") continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.access_token) return parsed.access_token;
      }
    } catch (_e) { /* ignore */ }
    return null;
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    var token = getSupabaseToken();
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  async function postJSON(url, body) {
    var res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var message = data.detail || data.error || res.statusText;
      var err = new Error(typeof message === "string" ? message : JSON.stringify(message));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function landingAutoConfig(language) {
    var lang = String(language || "english").toLowerCase();
    return {
      our_father_choice: lang,
      creed_choice: "nicene",
      songLanguageFilter:
        lang === "tagalog" ? "Tagalog" : lang === "malay" ? "English" : "English",
      hymn_lyrics_layout: "dual",
      poster_template: "liturgical_color",
      include_gospel_art: false,
      include_ai_mass_poster: false,
      include_social_exports: false,
      include_church_logo: false,
      include_church_name: false,
      lotw_poster: "lotw1",
      lote_poster: "lote1",
    };
  }

  function inferGospelMoodKey(preview) {
    if (!preview || preview.ok === false) return "reverent";
    var seasonKey = String(preview.season || "").toLowerCase().replace(/\s+/g, "_");
    var blob = [
      preview.title,
      preview.gospel_reference,
      (preview.gospel_text || "").slice(0, 600),
      (preview.gospel_quote || "").slice(0, 400),
      seasonKey.replace(/_/g, " "),
    ]
      .join(" ")
      .toLowerCase();

    if (
      /\b(resurrection|risen|empty tomb|easter|alleluia|ascension|pentecost)\b/.test(blob) ||
      ["easter", "pentecost"].indexOf(seasonKey) >= 0
    ) {
      return "triumphant";
    }
    if (
      ["lent", "advent"].indexOf(seasonKey) >= 0 ||
      /\b(repent|fast|desert|temptation|passion|cross|suffer)\b/.test(blob)
    ) {
      return "solemn";
    }
    if (/\b(heal|blind|lame|paralytic|mercy|forgiv|compassion|bless|comfort|weep|touch)\b/.test(blob)) {
      return "mercy";
    }
    if (
      /\b(disciples|apostles|journey|road|follow|sent |mission|boat|sea|walk|teach)\b/.test(blob)
    ) {
      return "journey";
    }
    return "reverent";
  }

  function normSongLangToken(s) {
    return String(s || "").trim().toLowerCase();
  }

  function songMatchesLangFilter(song, filter) {
    var f = normSongLangToken(filter) || "english";
    var lang = normSongLangToken(song.language || "");
    if (f === "tagalog") {
      return lang === "tagalog" || lang.indexOf("tagalog") >= 0 || lang === "filipino";
    }
    return lang === "english" || lang.indexOf("english") >= 0 || !lang;
  }

  function songGospelMoods(row) {
    if (Array.isArray(row.gospel_moods) && row.gospel_moods.length) return row.gospel_moods;
    return [];
  }

  function moodMatchScore(moods, moodKey) {
    if (!moods || !moods.length) return 1;
    if (moods.indexOf(moodKey) >= 0) return 3;
    var related = GOSPEL_MOOD_RELATED[moodKey] || [];
    for (var i = 0; i < related.length; i++) {
      if (moods.indexOf(related[i]) >= 0) return 2;
    }
    return 1;
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pickMoodSongsForSection(catalog, section, moodKey, count, excludeIds, langFilter) {
    var rows = (catalog && catalog[section]) || [];
    if (!rows.length) return [];
    var exclude = excludeIds || new Set();
    var scored = rows
      .map(function (row) {
        var moods = songGospelMoods(row);
        var match = moodMatchScore(moods, moodKey);
        var lyrics = row.has_lyrics ? 1 : 0;
        var lang = songMatchesLangFilter(row, langFilter) ? 1 : 0;
        var jitter = Math.random() * 0.5;
        return { row: row, match: match, score: match * 100 + lyrics * 10 + lang * 5 + jitter };
      })
      .filter(function (item) {
        var id = String(item.row.id || "");
        return id && !exclude.has(id);
      });
    if (!scored.length) return [];
    scored.sort(function (a, b) { return b.score - a.score; });
    var bestMatch = scored[0].match;
    var minMatch = bestMatch >= 2 ? 2 : 1;
    var preferred = scored.filter(function (item) { return item.match >= minMatch; });
    var topMatch = preferred[0].match;
    var tier = preferred.filter(function (item) { return item.match === topMatch; });
    var picked = [];
    shuffleArray(tier).forEach(function (item) {
      var id = String(item.row.id || "");
      if (!id || exclude.has(id)) return;
      picked.push(item.row);
      exclude.add(id);
    });
    if (picked.length < count) {
      preferred.forEach(function (item) {
        if (picked.length >= count) return;
        var id = String(item.row.id || "");
        if (!id || exclude.has(id)) return;
        picked.push(item.row);
        exclude.add(id);
      });
    }
    if (picked.length < count) {
      scored.forEach(function (item) {
        if (picked.length >= count) return;
        var id = String(item.row.id || "");
        if (!id || exclude.has(id)) return;
        picked.push(item.row);
        exclude.add(id);
      });
    }
    return picked.slice(0, count);
  }

  function previewCatalog(preview) {
    return (preview && preview.songs_by_section) || {};
  }

  function buildSongSelections(preview, language) {
    var catalog = previewCatalog(preview);
    var cfg = landingAutoConfig(language);
    var moodKey = inferGospelMoodKey(preview);
    var exclude = new Set();
    var selections = [];

    MOOD_PICK_SECTIONS.forEach(function (sec) {
      var songs = pickMoodSongsForSection(
        catalog,
        sec.key,
        moodKey,
        sec.count || 1,
        exclude,
        cfg.songLanguageFilter
      );
      if (sec.slotKeys) {
        songs.forEach(function (row, i) {
          if (!row) return;
          selections.push({
            slotKey: sec.slotKeys[i],
            id: row.id,
            title: row.title || row.id,
            label: sec.label + (sec.count > 1 ? " " + (i + 1) : ""),
          });
        });
        return;
      }
      var row = songs[0];
      if (!row) return;
      selections.push({
        slotKey: sec.slotKey,
        id: row.id,
        title: row.title || row.id,
        label: sec.label,
      });
    });

    if (selections.length < 4 && preview && preview.default_song_selections) {
      var defaults = preview.default_song_selections;
      var fallback = [
        { slotKey: "entrance", label: "Entrance", id: defaults.entrance, section: "entrance" },
        { slotKey: "offertory", label: "Offertory", id: defaults.offertory, section: "offertory" },
        { slotKey: "communion_1", label: "Communion 1", id: defaults.communion_1, section: "communion" },
        { slotKey: "communion_2", label: "Communion 2", id: defaults.communion_2, section: "communion" },
        { slotKey: "recessional", label: "Recessional", id: defaults.recessional, section: "recessional" },
      ];
      selections = fallback
        .filter(function (item) { return !!item.id; })
        .map(function (item) {
          return {
            slotKey: item.slotKey,
            id: item.id,
            title: titleFromPreview(catalog, item.section, item.id) || item.id,
            label: item.label,
          };
        });
    }
    return selections;
  }

  function titleFromPreview(catalog, section, id) {
    var rows = catalog[section] || [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(id)) return rows[i].title || id;
    }
    return id;
  }

  function songsToPayload(selections) {
    var out = {};
    selections.forEach(function (pick) {
      if (pick.slotKey && pick.id) out[pick.slotKey] = pick.id;
    });
    return out;
  }

  function findTheme(id) {
    var tid = String(id || "").trim().toLowerCase();
    for (var i = 0; i < PRESET_THEMES.length; i++) {
      if (PRESET_THEMES[i].id === tid) return PRESET_THEMES[i];
    }
    return PRESET_THEMES[0];
  }

  function pptThemePayload(theme) {
    return {
      id: theme.id,
      name: theme.name,
      bg: theme.bg,
      primary: theme.primary,
      accent: theme.accent,
      text: theme.text,
      font: theme.font,
    };
  }

  async function loadPreview() {
    state.massDate = upcomingSundayISO();
    var data = await postJSON("/api/preview", {
      date: state.massDate,
      readings_only: false,
    });
    if (!data.ok) throw new Error(data.error || "Could not load readings.");
    state.preview = data;
    state.songs = buildSongSelections(data, state.language);
    return data;
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          language: state.language,
          themeId: state.themeId,
          celebrant: state.celebrant,
          massDate: state.massDate,
          songs: state.songs,
        })
      );
    } catch (_e) { /* ignore */ }
  }

  function restoreDraft() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var draft = JSON.parse(raw);
      if (draft.language) state.language = draft.language;
      if (draft.themeId) state.themeId = draft.themeId;
      if (draft.celebrant) state.celebrant = draft.celebrant;
      if (draft.massDate) state.massDate = draft.massDate;
      if (Array.isArray(draft.songs)) state.songs = draft.songs;
      sessionStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setStep(n) {
    state.step = n;
    var panels = document.querySelectorAll("[data-lf-step]");
    panels.forEach(function (panel) {
      var step = Number(panel.getAttribute("data-lf-step"));
      panel.hidden = step !== n;
    });
    var backBtn = $("lf-gen-back");
    var nextBtn = $("lf-gen-next");
    var genBtn = $("lf-gen-submit");
    if (backBtn) backBtn.hidden = n <= 1 || state.generating;
    if (nextBtn) nextBtn.hidden = n >= 5 || state.generating;
    if (genBtn) genBtn.hidden = n !== 5 || state.generating;
    var progress = $("lf-gen-progress");
    if (progress) progress.textContent = "Step " + n + " of 5";
    syncFormFromState();
  }

  function syncFormFromState() {
    document.querySelectorAll("[data-lf-lang]").forEach(function (btn) {
      var active = btn.getAttribute("data-lf-lang") === state.language;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll("[data-lf-theme]").forEach(function (card) {
      var active = card.getAttribute("data-lf-theme") === state.themeId;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var cel = $("lf-gen-celebrant");
    if (cel && document.activeElement !== cel) cel.value = state.celebrant;
    var dateLabel = state.massDate
      ? formatNiceDate(state.massDate)
      : "this coming Sunday";
    var dateEl = $("lf-gen-date-label");
    if (dateEl) dateEl.textContent = "Recommended for " + dateLabel + " — based on this week's Gospel.";
    var dateEl2 = $("lf-gen-date-label-2");
    if (dateEl2) dateEl2.textContent = dateLabel;
    renderSongList();
  }

  function songListHtml() {
    if (!state.songs.length) {
      return '<li class="lf-gen-songs__empty">Loading song recommendations…</li>';
    }
    return state.songs
      .map(function (pick) {
        return (
          '<li class="lf-gen-songs__item">' +
          '<span class="lf-gen-songs__cat">' + escapeHtml(pick.label) + "</span>" +
          '<span class="lf-gen-songs__title">' + escapeHtml(pick.title || pick.id) + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function renderSongList() {
    var html = songListHtml();
    var list = $("lf-gen-songs");
    if (list) list.innerHTML = html;
    var review = $("lf-gen-songs-review");
    if (review) review.innerHTML = html;
  }

  function setStatus(message, kind) {
    var el = $("lf-gen-status");
    if (!el) return;
    el.textContent = message || "";
    el.className = "lf-gen-status" + (kind ? " lf-gen-status--" + kind : "");
    el.hidden = !message;
  }

  function setGenerating(on, message) {
    state.generating = on;
    var overlay = $("lf-gen-busy");
    if (overlay) overlay.hidden = !on;
    var busyMsg = $("lf-gen-busy-msg");
    if (busyMsg) busyMsg.textContent = message || "Generating your Mass deck…";
    $("lf-gen-back") && ($("lf-gen-back").disabled = on);
    $("lf-gen-next") && ($("lf-gen-next").disabled = on);
    $("lf-gen-submit") && ($("lf-gen-submit").disabled = on);
    $("lf-gen-close") && ($("lf-gen-close").disabled = on);
  }

  function openModal() {
    var backdrop = $("lf-gen-backdrop");
    if (!backdrop) return;
    backdrop.hidden = false;
    document.body.classList.add("lf-gen-open");
    setStatus("");
    setGenerating(false);
    var signIn = $("lf-gen-signin");
    if (signIn) signIn.hidden = true;
    var done = $("lf-gen-done");
    if (done) done.hidden = true;
    var dl = $("lf-gen-download");
    if (dl) dl.hidden = true;
    state.massDate = upcomingSundayISO();
    var resumed = restoreDraft();
    setStep(resumed ? 5 : 1);
    if (state.step >= 4) {
      refreshSongs().catch(function (err) {
        setStatus(err.message || "Could not load songs.", "error");
      });
    }
  }

  function closeModal() {
    var backdrop = $("lf-gen-backdrop");
    if (!backdrop || state.generating) return;
    backdrop.hidden = true;
    document.body.classList.remove("lf-gen-open");
    setStatus("");
  }

  async function refreshSongs() {
    renderSongList();
    await loadPreview();
    renderSongList();
  }

  async function onLanguageChange(lang) {
    state.language = lang;
    syncFormFromState();
    if (state.step >= 4) {
      try {
        await refreshSongs();
      } catch (err) {
        setStatus(err.message || "Could not refresh songs.", "error");
      }
    }
  }

  async function goNext() {
    setStatus("");
    if (state.step === 1) {
      setStep(2);
      return;
    }
    if (state.step === 2) {
      setStep(3);
      return;
    }
    if (state.step === 3) {
      var cel = $("lf-gen-celebrant");
      state.celebrant = cel ? cel.value.trim() : "";
      if (!state.celebrant) {
        setStatus("Enter the celebrant name.", "error");
        if (cel) cel.focus();
        return;
      }
      setStep(4);
      try {
        await refreshSongs();
      } catch (err) {
        setStatus(err.message || "Could not load Sunday readings.", "error");
      }
      return;
    }
    if (state.step === 4) {
      setStep(5);
    }
  }

  function goBack() {
    if (state.generating || state.step <= 1) return;
    setStatus("");
    setStep(state.step - 1);
  }

  async function runGenerate() {
    if (state.generating) return;
    var cel = $("lf-gen-celebrant");
    state.celebrant = cel ? cel.value.trim() : state.celebrant;
    if (!state.celebrant) {
      setStatus("Enter the celebrant name.", "error");
      setStep(3);
      if (cel) cel.focus();
      return;
    }
    if (!state.songs.length) {
      try {
        await refreshSongs();
      } catch (err) {
        setStatus(err.message || "Could not load songs.", "error");
        return;
      }
    }

    var cfg = landingAutoConfig(state.language);
    var theme = findTheme(state.themeId);
    var body = {
      date: state.massDate || upcomingSundayISO(),
      celebrant: state.celebrant,
      co_celebrant: "",
      songs: songsToPayload(state.songs),
      custom_theme: pptThemePayload(theme),
      our_father_choice: cfg.our_father_choice,
      creed_choice: cfg.creed_choice,
      hymn_lyrics_layout: cfg.hymn_lyrics_layout,
      poster_template: cfg.poster_template,
      include_gospel_art: cfg.include_gospel_art,
      include_ai_mass_poster: cfg.include_ai_mass_poster,
      include_social_exports: cfg.include_social_exports,
      include_church_logo: cfg.include_church_logo,
      include_church_name: cfg.include_church_name,
      lotw_poster: cfg.lotw_poster,
      lote_poster: cfg.lote_poster,
    };

    setGenerating(true, "Building your PowerPoint…");
    setStatus("");
    try {
      var data = await postJSON("/api/generate", body);
      setGenerating(false);
      if (data.pptx_url) {
        setStatus("Your Mass deck is ready.", "success");
        var dl = $("lf-gen-download");
        if (dl) {
          dl.href = data.pptx_url;
          dl.hidden = false;
        }
        var done = $("lf-gen-done");
        if (done) done.hidden = false;
        $("lf-gen-submit") && ($("lf-gen-submit").hidden = true);
        $("lf-gen-next") && ($("lf-gen-next").hidden = true);
        window.open(data.pptx_url, "_blank", "noopener");
        return;
      }
      setStatus("Generation finished but no download link was returned.", "error");
    } catch (err) {
      setGenerating(false);
      if (err.status === 401 || err.status === 403) {
        saveDraft();
        setStatus("Sign in with an approved parish account to generate.", "error");
        var signIn = $("lf-gen-signin");
        if (signIn) signIn.hidden = false;
        return;
      }
      setStatus(err.message || "Generation failed.", "error");
    }
  }

  function bindEvents() {
    var openBtn = $("lf-hero-generate");
    if (openBtn) openBtn.addEventListener("click", openModal);

    var closeBtn = $("lf-gen-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    var backdrop = $("lf-gen-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) closeModal();
      });
    }

    document.querySelectorAll("[data-lf-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-lf-lang");
        if (!lang) return;
        onLanguageChange(lang);
      });
    });

    document.querySelectorAll("[data-lf-theme]").forEach(function (card) {
      card.addEventListener("click", function () {
        state.themeId = card.getAttribute("data-lf-theme") || "theme1";
        syncFormFromState();
      });
    });

    var nextBtn = $("lf-gen-next");
    if (nextBtn) nextBtn.addEventListener("click", goNext);

    var backBtn = $("lf-gen-back");
    if (backBtn) backBtn.addEventListener("click", goBack);

    var genBtn = $("lf-gen-submit");
    if (genBtn) genBtn.addEventListener("click", runGenerate);

    document.addEventListener("keydown", function (e) {
      var backdrop = $("lf-gen-backdrop");
      if (e.key === "Escape" && backdrop && !backdrop.hidden) {
        closeModal();
      }
    });

    if (new URLSearchParams(window.location.search).get("resume") === "1") {
      openModal();
    }
  }

  function paintThemePreviews() {
    document.querySelectorAll("[data-lf-theme-preview]").forEach(function (el) {
      var id = el.getAttribute("data-lf-theme-preview");
      var theme = findTheme(id);
      el.style.background = theme.bg;
      el.style.color = theme.text;
      var accent = el.querySelector(".lf-gen-theme__accent");
      if (accent) accent.style.color = theme.accent;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    paintThemePreviews();
    bindEvents();
    state.massDate = upcomingSundayISO();
    var heroDate = $("lf-hero-date");
    if (heroDate) heroDate.textContent = "For " + formatNiceDate(state.massDate);
  });
})();
