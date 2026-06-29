// LiturgyFlow Mass Builder Wizard — wires the 7-step design to the live APIs.
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  var TOTAL = 7;
  var current = 1;
  var STEP_NAMES = ["Details", "Order", "Readings", "Steward", "Branding", "Songs", "Summary"];
  var STEP_TITLES = ["Mass Details", "Order of Mass", "Readings & Psalm", "Stewardship", "Posters & Branding", "Song Plan", "Review & Generate"];

  var SLOT_ORDER = ["entrance", "offertory", "communion_1", "communion_2", "meditation", "recessional"];
  var SLOT_LABEL = { entrance: "Entrance", offertory: "Offertory", communion_1: "Communion 1", communion_2: "Communion 2", meditation: "Meditation", recessional: "Recessional" };
  var SLOT_SECTION = { entrance: "entrance", offertory: "offertory", communion_1: "communion", communion_2: "communion", meditation: "meditation", recessional: "recessional" };

  var state = {
    celebrants: [],
    coCelebrants: [],
    catalog: {},
    preview: null,
    quota: null,
    songs: {},          // slot -> {section, id, title, author}
    sponsors: [],
    lotw: "lotw1",
    lote: "lote1",
    dividerBasename: null,
    announcementBasenames: [],
    activeSlot: "entrance"
  };

  /* ---------- Auth-aware fetch (reuses the app's VerbumAuth helper) ---------- */
  function authHeaders() {
    return new Promise(function (resolve) {
      try {
        if (window.VerbumAuth) {
          var done = function () {
            try {
              if (window.VerbumAuth.getAuthHeaders) { Promise.resolve(window.VerbumAuth.getAuthHeaders()).then(resolve, function () { resolve({}); }); return; }
            } catch (_e) {}
            resolve({});
          };
          if (window.VerbumAuth.waitUntilReady) { Promise.resolve(window.VerbumAuth.waitUntilReady(3000)).then(done, done); return; }
          done(); return;
        }
      } catch (_e) {}
      resolve({});
    });
  }
  function apiGet(url) {
    return authHeaders().then(function (h) {
      return fetch(url, { headers: h, credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    });
  }
  function apiPostJSON(url, body) {
    return authHeaders().then(function (h) {
      h = Object.assign({ "Content-Type": "application/json" }, h);
      return fetch(url, { method: "POST", headers: h, credentials: "same-origin", body: JSON.stringify(body) }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }, function () { return { ok: r.ok, status: r.status, data: {} }; });
      });
    });
  }
  function apiUpload(url, file) {
    return authHeaders().then(function (h) {
      var fd = new FormData();
      fd.append("file", file);
      return fetch(url, { method: "POST", headers: h, credentials: "same-origin", body: fd }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("w-toast");
    $("w-toast-msg").textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2000);
  }

  /* ---------- Date helpers ---------- */
  function isoDateFromInput() {
    var v = $("w-date").value || "";
    return v ? v.split("T")[0] : "";
  }
  function prettyDateTime() {
    var v = $("w-date").value;
    if (!v) return "Not set";
    var d = new Date(v);
    if (isNaN(d.getTime())) return "Not set";
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  /* ---------- Loaders ---------- */
  function loadCommunity() {
    return apiGet("/api/community").then(function (j) {
      state.celebrants = Array.isArray(j.celebrant_names) ? j.celebrant_names.filter(Boolean) : [];
    }, function () { state.celebrants = []; }).then(function () {
      var hint = $("w-celebrant-hint");
      if (!state.celebrants.length) { hint.classList.remove("hidden"); hint.textContent = "No saved priests yet — type a name, or add them in Settings → Church."; }
      else { hint.classList.add("hidden"); }
    });
  }

  function applyPreview() {
    var p = state.preview;
    var ref = function (id, v) { var el = $(id); if (el) el.textContent = v || "—"; };
    if (!p || !p.ok) {
      ref("w-ref-first", "Imports on generate"); ref("w-ref-second", "Imports on generate"); ref("w-ref-gospel", "Imports on generate");
      $("w-side-gospel").textContent = "Readings will import automatically for this date.";
      $("w-side-gospel-ref").textContent = "";
      return;
    }
    ref("w-ref-first", p.first_reading_reference);
    ref("w-ref-second", p.second_reading_reference || "Not appointed today");
    ref("w-ref-gospel", p.gospel_reference);
    if (p.title) $("w-lectionary-title").textContent = String(p.title).toUpperCase();
    $("hdr-season").textContent = [p.season, p.lectionary_cycle ? "Year " + p.lectionary_cycle : ""].filter(Boolean).join(", ") || "—";
    // gospel sidebar
    var gq = p.gospel_quote || (p.sentences && p.sentences[0]) || "";
    $("w-side-gospel").textContent = gq ? '"' + gq + '"' : "—";
    $("w-side-gospel-ref").textContent = (p.gospel_reference || "").toUpperCase();
    // color
    var col = p.liturgical_color || {};
    if (col.hex) { $("w-side-color-dot").style.background = col.hex; }
    $("w-side-color").textContent = col.color_name || col.season || "—";
    $("w-dock-season").textContent = col.color_name || p.season || "—";
    // psalm refrain options
    var psalmSel = $("w-psalm-refrain");
    psalmSel.innerHTML = '<option value="">Auto (from lectionary)</option>';
    (p.psalm_refrains || []).forEach(function (r, i) {
      var o = document.createElement("option"); o.value = String(i); o.textContent = r; psalmSel.appendChild(o);
    });
    // gospel sentence options
    var sentSel = $("w-gospel-sentence");
    sentSel.innerHTML = '<option value="">Auto (suggested sentence)</option>';
    (p.sentences || []).forEach(function (s, i) {
      var o = document.createElement("option"); o.value = String(i); o.textContent = (s.length > 80 ? s.slice(0, 80) + "…" : s); sentSel.appendChild(o);
    });
    // prefill song slots from defaults
    prefillSongs(p);
    renderRecs();
    updateEstimate();
  }

  function loadPreview(date) {
    if (!date) return Promise.resolve();
    $("w-ref-first").textContent = $("w-ref-second").textContent = $("w-ref-gospel").textContent = "Loading…";
    return apiPostJSON("/api/preview", { date: date, readings_only: false }).then(function (res) {
      state.preview = res.data || null;
      applyPreview();
    }, function () { state.preview = null; applyPreview(); });
  }

  function loadCatalog() {
    return apiGet("/api/catalog/songs?lite=true").then(function (j) {
      state.catalog = (j && j.catalog) ? j.catalog : (j || {});
      if (state.catalog.catalog) state.catalog = state.catalog.catalog;
    }, function () { state.catalog = {}; }).then(function () { renderSongSlots(); renderRecs(); });
  }

  function loadQuota() {
    return apiGet("/api/image-quota").then(function (q) {
      state.quota = q; applyQuota();
    }, function () { state.quota = null; });
  }
  function applyQuota() {
    var q = state.quota; var hint = $("w-quota-hint");
    if (!q) { hint.textContent = "AI poster available"; return; }
    if (q.allowed) { hint.textContent = (q.remaining + " of " + q.limit + " AI generations left today (UTC)"); hint.classList.remove("text-primary"); }
    else {
      hint.textContent = "Daily AI limit reached (" + q.limit + "/day) — using template instead";
      var t = $("w-use-ai"); if (t) { t.checked = false; t.disabled = true; }
      syncAiOptions();
    }
  }

  /* ---------- Stepper + navigation ---------- */
  function buildStepper() {
    var html = "";
    for (var i = 0; i < TOTAL; i++) {
      html += '<div class="flex flex-col gap-2 flex-1 cursor-pointer transition-opacity" data-goto="' + (i + 1) + '">' +
        '<div class="flex items-center gap-2">' +
        '<span class="w-6 h-6 rounded-full flex items-center justify-center font-label-caps text-[10px] font-bold step-dot"></span>' +
        '<span class="font-label-caps text-[9px] tracking-widest step-name">' + STEP_NAMES[i].toUpperCase() + '</span></div>' +
        '<div class="h-1 w-full rounded-full step-bar"></div></div>';
    }
    $("stepper").innerHTML = html;
    Array.prototype.forEach.call($("stepper").querySelectorAll("[data-goto]"), function (el) {
      el.addEventListener("click", function () {
        var n = parseInt(el.getAttribute("data-goto"), 10);
        if (n <= current) go(n); // only allow jumping back via stepper
      });
    });
  }

  function render() {
    Array.prototype.forEach.call(document.querySelectorAll(".wizard-step"), function (s) {
      s.classList.toggle("is-active", parseInt(s.getAttribute("data-step"), 10) === current);
    });
    var items = $("stepper").querySelectorAll("[data-goto]");
    Array.prototype.forEach.call(items, function (el, i) {
      var step = i + 1;
      var dot = el.querySelector(".step-dot");
      var name = el.querySelector(".step-name");
      var bar = el.querySelector(".step-bar");
      el.style.opacity = step === current ? "1" : (step < current ? "0.7" : "0.3");
      if (step === current) {
        dot.className = "w-6 h-6 rounded-full flex items-center justify-center font-label-caps text-[10px] font-bold step-dot bg-primary text-on-primary";
        dot.textContent = step;
        name.className = "font-label-caps text-[9px] tracking-widest step-name text-primary font-bold";
        bar.className = "h-1 w-full rounded-full step-bar bg-primary";
      } else if (step < current) {
        dot.className = "w-6 h-6 rounded-full flex items-center justify-center font-label-caps text-[10px] font-bold step-dot bg-primary/30 text-primary";
        dot.innerHTML = '<span class="material-symbols-outlined text-[14px]">check</span>';
        name.className = "font-label-caps text-[9px] tracking-widest step-name text-on-surface-variant";
        bar.className = "h-1 w-full rounded-full step-bar bg-primary/40";
      } else {
        dot.className = "w-6 h-6 rounded-full border border-outline text-outline flex items-center justify-center font-label-caps text-[10px] step-dot";
        dot.textContent = step;
        name.className = "font-label-caps text-[9px] tracking-widest step-name text-on-surface-variant";
        bar.className = "h-[1px] w-full rounded-full step-bar bg-outline-variant/30";
      }
    });
    // dock
    $("w-dock-title").textContent = "Step " + current + ": " + STEP_NAMES[current - 1];
    $("w-dock-time").textContent = prettyDateTime();
    var last = current === TOTAL;
    $("w-next-kicker").textContent = last ? "Finish" : "Continue to";
    $("w-next-label").textContent = last ? "Generate Presentation" : STEP_TITLES[current];
    $("w-next-icon").textContent = last ? "auto_awesome" : "arrow_forward";
    $("w-back").disabled = current === 1;
    if (last) buildSummary();
    updateEstimate();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStep(n) {
    if (n === 1) {
      if (!isoDateFromInput()) { toast("Pick a Mass date to continue."); return false; }
      if (!$("w-celebrant").value.trim()) { toast("Select or type a celebrant."); return false; }
    }
    return true;
  }

  function go(n) { current = Math.max(1, Math.min(TOTAL, n)); render(); }

  $("w-next").addEventListener("click", function () {
    if (current === TOTAL) { generate(); return; }
    if (!validateStep(current)) return;
    go(current + 1);
  });
  $("w-back").addEventListener("click", function () { go(current - 1); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeSongModal(); }
  });

  /* ---------- Celebrant picker ---------- */
  function celebrantMatches(q, exclude) {
    q = String(q || "").toLowerCase();
    return state.celebrants.filter(function (p) {
      if (exclude && exclude.indexOf(p) !== -1) return false;
      return !q || p.toLowerCase().indexOf(q) !== -1;
    });
  }
  function renderCelebrantResults() {
    var box = $("w-celebrant-results");
    var matches = celebrantMatches($("w-celebrant").value, state.coCelebrants);
    if (!matches.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.innerHTML = matches.slice(0, 6).map(function (p) {
      return '<div class="px-4 py-2 hover:bg-surface-variant/40 cursor-pointer text-sm" data-name="' + esc(p) + '">' + esc(p) + "</div>";
    }).join("");
    box.classList.remove("hidden");
    Array.prototype.forEach.call(box.querySelectorAll("[data-name]"), function (r) {
      r.addEventListener("mousedown", function (e) {
        e.preventDefault();
        $("w-celebrant").value = r.getAttribute("data-name");
        box.classList.add("hidden");
      });
    });
  }
  $("w-celebrant").addEventListener("input", renderCelebrantResults);
  $("w-celebrant").addEventListener("focus", renderCelebrantResults);
  $("w-celebrant").addEventListener("blur", function () { setTimeout(function () { $("w-celebrant-results").classList.add("hidden"); }, 120); });

  /* ---------- Co-celebrant chips ---------- */
  function renderCo() {
    $("w-co-chips").innerHTML = state.coCelebrants.map(function (n, i) {
      return '<span class="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs flex items-center gap-2" data-i="' + i + '">' + esc(n) + ' <span class="material-symbols-outlined text-xs cursor-pointer co-x">close</span></span>';
    }).join("");
    Array.prototype.forEach.call($("w-co-chips").querySelectorAll(".co-x"), function (x) {
      x.addEventListener("click", function () {
        var i = parseInt(x.parentNode.getAttribute("data-i"), 10);
        state.coCelebrants.splice(i, 1); renderCo();
      });
    });
  }
  $("w-co-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var n = $("w-co-input").value.trim();
      if (n && state.coCelebrants.indexOf(n) === -1) { state.coCelebrants.push(n); renderCo(); }
      $("w-co-input").value = "";
    }
  });

  /* ---------- Sponsor chips ---------- */
  function renderSponsors() {
    $("w-sponsor-chips").innerHTML = state.sponsors.map(function (n, i) {
      return '<span class="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs flex items-center gap-2" data-i="' + i + '">' + esc(n) + ' <span class="material-symbols-outlined text-xs cursor-pointer sp-x">close</span></span>';
    }).join("");
    Array.prototype.forEach.call($("w-sponsor-chips").querySelectorAll(".sp-x"), function (x) {
      x.addEventListener("click", function () {
        var i = parseInt(x.parentNode.getAttribute("data-i"), 10);
        state.sponsors.splice(i, 1); renderSponsors();
      });
    });
  }
  $("w-sponsor-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var n = $("w-sponsor-input").value.trim();
      if (n && state.sponsors.indexOf(n) === -1) { state.sponsors.push(n); renderSponsors(); }
      $("w-sponsor-input").value = "";
    }
  });

  /* ---------- Song slots ---------- */
  function langFilter(list) {
    var lang = ($("w-song-lang") && $("w-song-lang").value) || "";
    if (!lang) return list;
    return list.filter(function (s) { return !s.language || String(s.language).toLowerCase().indexOf(lang.toLowerCase()) !== -1; });
  }
  function songCount() { return SLOT_ORDER.filter(function (k) { return state.songs[k]; }).length; }
  function renderSongSlots() {
    var html = SLOT_ORDER.map(function (key) {
      var picked = state.songs[key];
      var filled = !!picked;
      return '<button type="button" data-slot="' + key + '" class="w-full text-left glass-panel rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors ' + (filled ? "border-primary/30" : "") + '">' +
        '<span class="w-10 h-10 rounded-xl bg-surface-variant/40 flex items-center justify-center text-primary"><span class="material-symbols-outlined">' + (filled ? "check_circle" : "add") + '</span></span>' +
        '<span class="flex-1"><span class="block font-label-caps text-[9px] text-outline uppercase">' + SLOT_LABEL[key] + '</span>' +
        '<span class="block text-sm ' + (filled ? "text-soft-white font-bold" : "text-outline") + '">' + (filled ? esc(picked.title) : "Tap to choose a hymn") + '</span></span>' +
        (filled ? '<span class="material-symbols-outlined text-outline slot-clear" data-clear="' + key + '">close</span>' : "") +
        "</button>";
    }).join("");
    $("w-song-slots").innerHTML = html;
    Array.prototype.forEach.call($("w-song-slots").querySelectorAll("[data-slot]"), function (b) {
      b.addEventListener("click", function () { openSongModal(b.getAttribute("data-slot")); });
    });
    Array.prototype.forEach.call($("w-song-slots").querySelectorAll(".slot-clear"), function (x) {
      x.addEventListener("click", function (e) { e.stopPropagation(); delete state.songs[x.getAttribute("data-clear")]; renderSongSlots(); updateEstimate(); });
    });
    $("w-song-count").textContent = songCount();
  }

  /* ---------- Song picker modal ---------- */
  var modalSlot = null;
  function openSongModal(slot) {
    modalSlot = slot; state.activeSlot = slot;
    var section = SLOT_SECTION[slot];
    var n = (state.catalog[section] || []).length;
    $("w-modal-title").textContent = SLOT_LABEL[slot];
    $("w-modal-sub").textContent = n ? (n + " hymns in your " + section + " library") : ("Your " + section + " library is empty");
    $("w-modal-search").value = "";
    renderModalList("");
    $("w-song-modal").classList.add("show");
    setTimeout(function () { try { $("w-modal-search").focus(); } catch (_e) {} }, 200);
    renderRecs();
  }
  function closeSongModal() { $("w-song-modal").classList.remove("show"); modalSlot = null; }
  function renderModalList(q) {
    if (!modalSlot) return;
    var section = SLOT_SECTION[modalSlot];
    var all = langFilter(state.catalog[section] || []);
    q = String(q || "").toLowerCase();
    var list = q ? all.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1 || (s.author || "").toLowerCase().indexOf(q) !== -1; }) : all;
    if (!list.length) {
      $("w-modal-list").innerHTML = '<div class="text-center text-outline text-sm py-8">' + (q ? "No matches." : "No songs here yet. Add hymns in the Song Library.") + "</div>";
      return;
    }
    var chosen = state.songs[modalSlot] && state.songs[modalSlot].id;
    $("w-modal-list").innerHTML = list.map(function (s) {
      var sel = String(s.id) === String(chosen);
      return '<div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-surface-variant/40 ' + (sel ? "bg-primary/10 border border-primary/30" : "") + '" data-id="' + esc(s.id) + '">' +
        '<span class="material-symbols-outlined text-primary">music_note</span>' +
        '<div class="flex-1"><div class="text-sm font-bold text-soft-white">' + esc(s.title) + '</div><div class="text-xs text-outline">' + (esc(s.author) || "Traditional") + '</div></div>' +
        (sel ? '<span class="material-symbols-outlined text-primary">check</span>' : "") + "</div>";
    }).join("");
    Array.prototype.forEach.call($("w-modal-list").querySelectorAll("[data-id]"), function (row) {
      row.addEventListener("click", function () {
        var song = (state.catalog[section] || []).filter(function (s) { return String(s.id) === String(row.getAttribute("data-id")); })[0];
        if (song) { fillSlot(modalSlot, song); toast(song.title + " → " + SLOT_LABEL[modalSlot]); }
        closeSongModal();
      });
    });
  }
  function fillSlot(slot, song) {
    state.songs[slot] = { section: SLOT_SECTION[slot], id: song.id, title: song.title, author: song.author || "" };
    renderSongSlots(); updateEstimate();
  }
  $("w-modal-search").addEventListener("input", function () { renderModalList($("w-modal-search").value); });
  $("w-modal-close").addEventListener("click", closeSongModal);
  $("w-song-modal").addEventListener("click", function (e) { if (e.target === $("w-song-modal")) closeSongModal(); });
  $("w-song-lang").addEventListener("change", function () { renderSongSlots(); renderRecs(); if (modalSlot) renderModalList($("w-modal-search").value); });

  /* ---------- Recommendations ---------- */
  function seasonMood() {
    var s = String(state.preview && state.preview.season || "").toLowerCase();
    if (s.indexOf("easter") !== -1 || s.indexOf("christmas") !== -1) return "triumphant";
    if (s.indexOf("lent") !== -1 || s.indexOf("advent") !== -1) return "solemn";
    return "reverent";
  }
  function renderRecs() {
    var box = $("w-rec-list"); if (!box) return;
    var slot = state.activeSlot || "entrance";
    $("w-rec-target").textContent = SLOT_LABEL[slot];
    var section = SLOT_SECTION[slot];
    var mood = seasonMood();
    var list = langFilter((state.catalog[section] || []).slice());
    list.sort(function (a, b) {
      var sa = ((a.gospel_moods || []).indexOf(mood) !== -1 ? 4 : 0) + (a.gospel_moods || []).length;
      var sb = ((b.gospel_moods || []).indexOf(mood) !== -1 ? 4 : 0) + (b.gospel_moods || []).length;
      return sb - sa;
    });
    list = list.slice(0, 4);
    if (!list.length) { box.innerHTML = '<div class="text-outline text-sm col-span-2">' + (Object.keys(state.catalog).length ? "No suggestions for this section yet." : "Loading your song library…") + "</div>"; return; }
    box.innerHTML = list.map(function (s) {
      var chosen = state.songs[slot] && String(state.songs[slot].id) === String(s.id);
      return '<div class="flex items-center gap-3 p-3 bg-surface-variant/10 rounded-xl" data-id="' + esc(s.id) + '">' +
        '<span class="material-symbols-outlined text-primary">library_music</span>' +
        '<div class="flex-1"><div class="text-sm font-bold text-soft-white">' + esc(s.title) + '</div><div class="text-xs text-outline">' + (esc(s.author) || "Traditional") + '</div></div>' +
        '<button class="material-symbols-outlined text-primary rec-add">' + (chosen ? "check" : "add") + "</button></div>";
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-id]"), function (card) {
      card.querySelector(".rec-add").addEventListener("click", function () {
        var song = (state.catalog[section] || []).filter(function (s) { return String(s.id) === String(card.getAttribute("data-id")); })[0];
        if (song) { fillSlot(slot, song); toast(song.title + " → " + SLOT_LABEL[slot]); renderRecs(); }
      });
    });
  }

  function prefillSongs(p) {
    var defaults = p && p.default_song_selections;
    if (!defaults || typeof defaults !== "object") return;
    SLOT_ORDER.forEach(function (slot) {
      if (state.songs[slot]) return;
      var section = SLOT_SECTION[slot];
      var id = defaults[slot] || defaults[section];
      if (id == null) return;
      var song = (state.catalog[section] || []).filter(function (s) { return String(s.id) === String(id); })[0];
      if (song) state.songs[slot] = { section: section, id: song.id, title: song.title, author: song.author || "" };
    });
    renderSongSlots();
  }

  /* ---------- Poster pickers ---------- */
  function buildPosterGrid(gridId, prefix, stateKey) {
    var grid = $(gridId);
    var html = "";
    for (var i = 1; i <= 4; i++) {
      var id = prefix + i;
      html += '<button type="button" data-poster="' + id + '" class="aspect-[3/4] rounded-xl flex items-center justify-center border transition-all ' +
        (state[stateKey] === id ? "border-primary border-2 bg-primary-container/40" : "border-outline-variant/20 bg-surface-variant/30 hover:border-primary/50") + '">' +
        '<span class="font-label-caps text-[10px] ' + (state[stateKey] === id ? "text-primary" : "text-outline") + '">' + prefix.toUpperCase() + " " + i + "</span></button>";
    }
    grid.innerHTML = html;
    Array.prototype.forEach.call(grid.querySelectorAll("[data-poster]"), function (b) {
      b.addEventListener("click", function () { state[stateKey] = b.getAttribute("data-poster"); buildPosterGrid(gridId, prefix, stateKey); });
    });
  }

  /* ---------- AI vs template toggle ---------- */
  function syncAiOptions() {
    var on = $("w-use-ai").checked;
    $("w-ai-options").style.display = on ? "" : "none";
    $("w-template-wrap").style.display = on ? "none" : "";
  }
  $("w-use-ai").addEventListener("change", syncAiOptions);

  /* ---------- Uploads ---------- */
  $("w-divider").addEventListener("change", function () {
    var f = $("w-divider").files && $("w-divider").files[0];
    if (!f) return;
    $("w-divider-status").textContent = "Uploading…";
    apiUpload("/api/upload/mass-divider", f).then(function (j) {
      state.dividerBasename = j.basename || null;
      $("w-divider-status").textContent = j.basename ? ("Uploaded: " + j.basename) : "Uploaded";
    }, function () { $("w-divider-status").textContent = "Upload failed — sign in / membership may be required."; });
  });
  $("w-announcements").addEventListener("change", function () {
    var files = $("w-announcements").files;
    if (!files || !files.length) return;
    $("w-announce-status").textContent = "Uploading " + files.length + "…";
    state.announcementBasenames = [];
    var chain = Promise.resolve();
    Array.prototype.forEach.call(files, function (f) {
      chain = chain.then(function () {
        return apiUpload("/api/upload/announcement-slide", f).then(function (j) { if (j.basename) state.announcementBasenames.push(j.basename); });
      });
    });
    chain.then(function () { $("w-announce-status").textContent = state.announcementBasenames.length + " uploaded"; },
      function () { $("w-announce-status").textContent = "Some uploads failed."; });
  });

  /* ---------- Slide estimate ---------- */
  function updateEstimate() {
    var n = 8 + 16;
    n += songCount() * 4;
    if (state.sponsors.length) n += 1;
    if ($("w-collection-amount") && $("w-collection-amount").value.trim()) n += 1;
    if (state.announcementBasenames.length) n += state.announcementBasenames.length;
    var el = $("w-slide-estimate"); if (el) el.textContent = "~" + n;
  }
  $("w-date").addEventListener("change", function () { var d = isoDateFromInput(); if (d) loadPreview(d); render(); });
  ["w-collection-amount"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", updateEstimate); });

  /* ---------- Summary ---------- */
  function summaryCard(step, label, lines) {
    return '<div class="glass-panel p-6 rounded-2xl flex justify-between items-start">' +
      '<div><p class="text-[10px] font-label-caps text-outline uppercase mb-2">' + esc(label) + '</p>' +
      lines.map(function (l, i) { return '<p class="' + (i === 0 ? "font-bold text-soft-white" : "text-sm text-on-surface-variant") + '">' + l + "</p>"; }).join("") +
      '</div><button class="text-primary font-label-caps text-[10px] underline" data-edit="' + step + '">EDIT</button></div>';
  }
  function buildSummary() {
    var p = state.preview || {};
    var coStr = state.coCelebrants.length ? (" +" + state.coCelebrants.length + " co") : "";
    var useAi = $("w-use-ai").checked;
    var cards = [
      summaryCard(1, "Liturgical Basics", [esc(prettyDateTime()), "Celebrant: " + (esc($("w-celebrant").value.trim()) || "—") + coStr]),
      summaryCard(2, "Order of the Mass", ["Creed: " + ($("w-creed").value === "apostles" ? "Apostles'" : "Nicene"), "Our Father: " + esc($("w-ourfather").options[$("w-ourfather").selectedIndex].text)]),
      summaryCard(3, "Scripture", [esc(p.title || "Imports on generate"), esc(p.gospel_reference || "")]),
      summaryCard(4, "Stewardship", [(state.sponsors.length + " sponsor(s)"), ($("w-collection-amount").value.trim() ? ($("w-currency").value + " " + esc($("w-collection-amount").value.trim())) : "No collection")]),
      summaryCard(5, "Posters & Branding", [(useAi ? "AI poster (" + $("w-ai-backend").value + ", " + $("w-ai-style").value + ")" : "Template: " + $("w-template").value), "LOTW " + state.lotw + " · LOTE " + state.lote]),
      summaryCard(6, "Song Plan", [songCount() + " of 6 songs", "Layout: " + $("w-hymn-layout").value])
    ];
    $("w-summary-grid").innerHTML = cards.join("");
    Array.prototype.forEach.call($("w-summary-grid").querySelectorAll("[data-edit]"), function (b) {
      b.addEventListener("click", function () { go(parseInt(b.getAttribute("data-edit"), 10)); });
    });
  }

  /* ---------- Build GenerateBody ---------- */
  function selectedSongs() {
    var out = {};
    SLOT_ORDER.forEach(function (slot) { if (state.songs[slot]) out[slot] = String(state.songs[slot].id); });
    return out;
  }
  function buildBody() {
    var useAi = $("w-use-ai").checked && !$("w-use-ai").disabled;
    var body = {
      date: isoDateFromInput(),
      celebrant: $("w-celebrant").value.trim(),
      co_celebrant: state.coCelebrants.join(", "),
      songs: selectedSongs(),
      poster_template: $("w-template").value || "liturgical_color",
      include_social_exports: $("w-social").checked,
      include_gospel_art: true,
      include_ai_mass_poster: useAi,
      ai_poster_backend: $("w-ai-backend").value || "openai",
      ai_poster_style: $("w-ai-style").value || "cinematic",
      reuse_existing_poster: false,
      lotw_poster: state.lotw,
      lote_poster: state.lote,
      creed_choice: $("w-creed").value === "apostles" ? "apostles" : "nicene",
      our_father_choice: $("w-ourfather").value || "english",
      hymn_lyrics_layout: $("w-hymn-layout").value || "single",
      include_church_logo: $("w-logo").checked,
      include_church_name: $("w-name").checked,
      include_footer: $("w-footer").checked,
      export_pdf: $("w-pdf").checked
    };
    // psalm
    var psalmCustom = $("w-psalm-custom").value.trim();
    if (psalmCustom) body.psalm_text_override = psalmCustom;
    else if ($("w-psalm-refrain").value !== "") { var pi = parseInt($("w-psalm-refrain").value, 10); if (!isNaN(pi)) body.psalm_refrain_index = pi; }
    // gospel
    var gospelCustom = $("w-gospel-custom").value.trim();
    if (gospelCustom) body.gospel_quote_override = gospelCustom;
    else if ($("w-gospel-sentence").value !== "") { var si = parseInt($("w-gospel-sentence").value, 10); if (!isNaN(si)) body.sentence_index = si; }
    // stewardship
    var amount = $("w-collection-amount").value.trim();
    if (amount) { body.mass_collection_amount = amount; body.mass_collection_currency = $("w-currency").value; }
    var collDate = $("w-collection-date").value;
    if (collDate) {
      var d = new Date(collDate + "T00:00:00");
      body.mass_collection_date_label = isNaN(d.getTime()) ? collDate : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    }
    if (state.sponsors.length) body.food_sponsors = state.sponsors.slice();
    if (state.dividerBasename) body.divider_poster_basename = state.dividerBasename;
    if (state.announcementBasenames.length) body.announcement_basenames = state.announcementBasenames.slice();
    return body;
  }

  /* ---------- Generate + receipt ---------- */
  function downloadFile(url, name) {
    authHeaders().then(function (h) {
      fetch(url, { headers: h, credentials: "same-origin" }).then(function (r) { return r.blob(); }).then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name || (url.split("/").pop() || "download");
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }, function () { window.open(url, "_blank"); });
    });
  }
  function dlButton(url, label, icon) {
    return '<button class="flex items-center gap-2 bg-deep-charcoal text-white px-5 py-3 rounded-xl hover:bg-black transition-colors" data-url="' + esc(url) + '" data-label="' + esc(label) + '">' +
      '<span class="material-symbols-outlined">' + icon + '</span>' + esc(label) + "</button>";
  }
  function renderReceipt(d) {
    var btns = [];
    if (d.zip_url) btns.push(dlButton(d.zip_url, "Download ZIP", "folder_zip"));
    if (d.pptx_url) btns.push(dlButton(d.pptx_url, "PowerPoint", "slideshow"));
    if (d.pdf_url) btns.push(dlButton(d.pdf_url, "PDF", "picture_as_pdf"));
    if (d.poster_url) btns.push(dlButton(d.poster_url, "Poster", "image"));
    if (d.poster_ppt_url) btns.push(dlButton(d.poster_ppt_url, "Poster PPT", "image"));
    if (d.ai_poster_urls) { Object.keys(d.ai_poster_urls).forEach(function (k) { btns.push(dlButton(d.ai_poster_urls[k], "AI Poster (" + k + ")", "auto_awesome")); }); }
    $("w-receipt-downloads").innerHTML = btns.join("") || '<p class="text-outline text-sm">Generated (no direct download links returned).</p>';
    $("w-receipt").classList.remove("hidden");
    Array.prototype.forEach.call($("w-receipt-downloads").querySelectorAll("[data-url]"), function (b) {
      b.addEventListener("click", function () { downloadFile(b.getAttribute("data-url")); });
    });
  }
  function generate() {
    if (!validateStep(1)) { go(1); return; }
    var body = buildBody();
    $("w-loader-msg").textContent = "Preparing Mass package…";
    $("w-loader").classList.add("show");
    apiPostJSON("/api/generate", body).then(function (res) {
      $("w-loader").classList.remove("show");
      if (!res.ok || !res.data || res.data.ok === false) {
        var msg = (res.data && (res.data.detail || res.data.error)) || ("Generation failed (HTTP " + res.status + ").");
        toast(typeof msg === "string" ? msg : "Generation failed.");
        return;
      }
      var d = res.data;
      var stem = d.export_stem || "mass_presentation";
      renderReceipt(d);
      // Auto-download the deck (and PDF) like the classic builder does.
      if (d.pptx_url) {
        toast("Generated — downloading PowerPoint…");
        downloadFile(d.pptx_url, stem + ".pptx");
        if (d.pdf_url) setTimeout(function () { downloadFile(d.pdf_url, stem + ".pdf"); }, 1200);
      } else if (d.zip_url) {
        toast("Generated — downloading…");
        downloadFile(d.zip_url, stem + ".zip");
      } else {
        toast("Mass package generated.");
      }
    }, function () { $("w-loader").classList.remove("show"); toast("Network error while generating."); });
  }

  /* ---------- Boot ---------- */
  (function init() {
    // default date = next Sunday 10:00
    var d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    $("w-date").value = iso + "T10:00";

    buildStepper();
    buildPosterGrid("w-lotw-grid", "lotw", "lotw");
    buildPosterGrid("w-lote-grid", "lote", "lote");
    renderSongSlots();
    renderCo();
    renderSponsors();
    syncAiOptions();
    render();

    loadCommunity();
    loadCatalog();
    loadQuota();
    loadPreview(iso);
  })();
})();
