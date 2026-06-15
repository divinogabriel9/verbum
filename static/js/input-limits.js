/** Client-side input length limits (loaded from /api/input-limits when available). */
(function () {
  "use strict";

  const FALLBACK = {
    church_name: 240,
    celebrant_name: 200,
    song_title: 240,
    song_author: 240,
    song_id: 160,
    section_label: 80,
    section_key: 40,
    gospel_quote: 2000,
    psalm_refrain: 500,
    psalm_full: 12000,
    lyrics_full: 50000,
    lyric_block: 4000,
    hymn_override: 12000,
    search_query: 120,
    event_name: 120,
    food_sponsor: 120,
    collection_amount: 120,
    collection_date_label: 240,
    theme_name: 80,
    hex_color: 7,
    ai_prompt: 4000,
    api_key: 512,
    file_basename: 200,
    language: 40,
  };

  let limits = Object.assign({}, FALLBACK);

  const FIELD_MAP = {
    "app-global-search": "search_query",
    "song-catalog-search": "search_query",
    "collections-catalog-search": "search_query",
    "home-event-modal-name": "event_name",
    "song-metadata-edit-title": "song_title",
    "song-metadata-edit-author": "song_author",
    "lyrics-save-title": "song_title",
    "lyrics-save-author": "song_author",
    "lyrics-input": "lyrics_full",
    "custom-theme-name": "theme_name",
    "theme-bg-text": "hex_color",
    "theme-primary-text": "hex_color",
    "theme-accent-text": "hex_color",
    "theme-text-text": "hex_color",
    "co-celebrant": "celebrant_name",
    "celebrant": "celebrant_name",
    "flow-collection-amount": "collection_amount",
    "flow-food-sponsor-input": "food_sponsor",
    "flow-gospel-custom": "gospel_quote",
    "flow-psalm-custom": "psalm_refrain",
    "poster-celebrant": "celebrant_name",
    "poster-gospel-quote": "gospel_quote",
    "settings-church-name": "church_name",
    "settings-celebrant-new": "celebrant_name",
    "settings-gemini-api-key": "api_key",
  };

  function limitFor(el) {
    const key = el.getAttribute("data-limit-key");
    if (key && limits[key] != null) return limits[key];
    const id = el.id;
    if (id && FIELD_MAP[id] && limits[FIELD_MAP[id]] != null) return limits[FIELD_MAP[id]];
    const raw = el.getAttribute("data-max-length");
    if (raw) return parseInt(raw, 10) || 0;
    return 0;
  }

  function ensureCounter(el) {
    if (!el || el.tagName !== "TEXTAREA") return null;
    if (el.dataset.limitCounterBound === "1") return el.nextElementSibling;
    const wrap = el.closest(".field") || el.parentElement;
    if (!wrap) return null;
    let counter = wrap.querySelector(".input-char-count[data-for=\"" + el.id + "\"]");
    if (!counter) {
      counter = document.createElement("p");
      counter.className = "muted input-char-count";
      counter.dataset.for = el.id || "";
      counter.style.margin = "6px 0 0";
      counter.style.fontSize = "0.75rem";
      counter.style.textAlign = "right";
      el.insertAdjacentElement("afterend", counter);
    }
    el.dataset.limitCounterBound = "1";
    return counter;
  }

  function updateCounter(el, max) {
    const counter = ensureCounter(el);
    if (!counter || !max) return;
    const len = (el.value || "").length;
    const compact = el.classList.contains("lyric-block__ta");
    counter.textContent = compact ? (len + "/" + max) : (len + " / " + max);
    if (!compact) {
      counter.style.color = len >= max ? "var(--warn)" : "";
    }
  }

  function clampValue(el, max) {
    if (!max || max <= 0) return;
    const val = el.value || "";
    if (val.length > max) {
      el.value = val.slice(0, max);
    }
  }

  function bindElement(el) {
    if (!el || el.dataset.limitBound === "1") return;
    if (el.classList.contains("lyric-block__ta")) {
      const max = limitFor(el) || limits.lyric_block || 4000;
      el.dataset.limitBound = "1";
      el.setAttribute("maxlength", String(max));
      const clampHandler = function () {
        clampValue(el, max);
      };
      el.addEventListener("input", clampHandler);
      el.addEventListener("paste", function () {
        setTimeout(clampHandler, 0);
      });
      return;
    }
    const max = limitFor(el);
    if (!max) return;
    el.dataset.limitBound = "1";
    if (el.tagName !== "TEXTAREA") {
      el.setAttribute("maxlength", String(max));
    } else {
      el.setAttribute("maxlength", String(max));
      el.setAttribute("data-max-length", String(max));
    }
    const handler = function () {
      clampValue(el, max);
      updateCounter(el, max);
    };
    el.addEventListener("input", handler);
    el.addEventListener("paste", function () {
      setTimeout(handler, 0);
    });
    handler();
  }

  function bindAll(root) {
    const scope = root || document;
    scope.querySelectorAll("input[type='text'], input[type='search'], input[type='password'], textarea:not(.lyric-block__ta)").forEach(bindElement);
    scope.querySelectorAll(".lyric-block__ta").forEach(function (el) {
      el.setAttribute("data-limit-key", "lyric_block");
      bindElement(el);
    });
    scope.querySelectorAll(".mass-song-search-input").forEach(function (el) {
      el.setAttribute("data-limit-key", "search_query");
      bindElement(el);
    });
    scope.querySelectorAll(".mass-song-plan-card__part-input").forEach(function (el) {
      el.setAttribute("data-limit-key", "section_label");
      bindElement(el);
    });
  }

  function observeDynamic() {
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          bindAll(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function loadLimits() {
    try {
      const res = await fetch("/api/input-limits");
      if (res.ok) {
        const data = await res.json();
        limits = Object.assign({}, FALLBACK, data);
      }
    } catch (_e) {
      limits = Object.assign({}, FALLBACK);
    }
  }

  async function init() {
    await loadLimits();
    bindAll(document);
    observeDynamic();
  }

  window.VerbumInputLimits = {
    get: function () { return Object.assign({}, limits); },
    bindAll: bindAll,
    clamp: function (text, key) {
      const max = limits[key];
      if (!max || text == null) return text || "";
      return String(text).slice(0, max);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
