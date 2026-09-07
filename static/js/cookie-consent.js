/**
 * LiturgyFlow cookie / privacy consent (GDPR + ePrivacy style).
 * Necessary storage is always allowed. Preferences / media / analytics
 * require affirmative consent before non-essential features run.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "lf_consent_v1";
  var VERSION = 1;

  var DEFAULTS = {
    version: VERSION,
    necessary: true,
    preferences: false,
    media: false,
    analytics: false,
    decidedAt: null,
  };

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = safeParse(raw);
      if (!data || data.version !== VERSION) return null;
      return {
        version: VERSION,
        necessary: true,
        preferences: !!data.preferences,
        media: !!data.media,
        analytics: !!data.analytics,
        decidedAt: data.decidedAt || null,
      };
    } catch (_e) {
      return null;
    }
  }

  function writeConsent(next) {
    var payload = {
      version: VERSION,
      necessary: true,
      preferences: !!next.preferences,
      media: !!next.media,
      analytics: !!next.analytics,
      decidedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_e) {
      /* private mode */
    }
    window.__LF_CONSENT__ = payload;
    window.dispatchEvent(
      new CustomEvent("lf:consent-changed", { detail: payload })
    );
    return payload;
  }

  function hasCategory(cat) {
    if (cat === "necessary") return true;
    var c = window.__LF_CONSENT__ || readConsent();
    if (!c || !c.decidedAt) return false;
    return !!c[cat];
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (attrs[k] === false || attrs[k] == null) return;
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function buildPrefsCard(current) {
    function catRow(id, title, desc, locked) {
      var input = el("input", {
        type: "checkbox",
        id: "lf-consent-" + id,
        class: "lf-consent-switch-input",
      });
      input.checked = locked ? true : !!current[id];
      input.disabled = !!locked;
      input.setAttribute("data-consent-cat", id);
      var label = el("label", { class: "lf-consent-switch", for: "lf-consent-" + id }, [input]);
      return el("div", { class: "lf-consent-cat" }, [
        el("div", { class: "lf-consent-cat__row" }, [
          el("div", null, [
            el("strong", { text: title }),
            el("p", { text: desc }),
          ]),
          label,
        ]),
      ]);
    }

    return el("div", { class: "lf-consent-prefs__card", role: "document" }, [
      el("h2", { id: "lf-consent-prefs-title", text: "Privacy preferences" }),
      el("p", {
        text:
          "We use necessary cookies to keep you signed in and secure. Optional categories need your consent. You can change this anytime.",
      }),
      catRow(
        "necessary",
        "Necessary",
        "Sign-in, security, rate limiting, and practice-share unlock cookies. Always on.",
        true
      ),
      catRow(
        "preferences",
        "Preferences",
        "Remember theme, song-plan language, and UI layout choices on this device.",
        false
      ),
      catRow(
        "media",
        "Media embeds",
        "Load YouTube / radio embeds. These third parties may set their own cookies.",
        false
      ),
      catRow(
        "analytics",
        "Analytics",
        "Optional product analytics. Currently unused — reserved if we add privacy-friendly analytics later.",
        false
      ),
      el("div", { class: "lf-consent-prefs__actions" }, [
        el("button", {
          type: "button",
          class: "lf-consent-btn lf-consent-btn--ghost",
          id: "lf-consent-prefs-cancel",
          text: "Cancel",
        }),
        el("button", {
          type: "button",
          class: "lf-consent-btn lf-consent-btn--primary",
          id: "lf-consent-prefs-save",
          text: "Save choices",
        }),
      ]),
    ]);
  }

  function closePrefs() {
    var prefs = document.getElementById("lf-consent-prefs");
    if (prefs) prefs.hidden = true;
  }

  function openPrefs() {
    var existing = document.getElementById("lf-consent-prefs");
    if (existing) existing.remove();
    var current = readConsent() || DEFAULTS;
    var overlay = el(
      "div",
      {
        class: "lf-consent-prefs",
        id: "lf-consent-prefs",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "lf-consent-prefs-title",
      },
      [buildPrefsCard(current)]
    );
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) closePrefs();
    });
    document.getElementById("lf-consent-prefs-cancel").addEventListener("click", closePrefs);
    document.getElementById("lf-consent-prefs-save").addEventListener("click", function () {
      var prefs = {
        preferences: !!(document.getElementById("lf-consent-preferences") || {}).checked,
        media: !!(document.getElementById("lf-consent-media") || {}).checked,
        analytics: !!(document.getElementById("lf-consent-analytics") || {}).checked,
      };
      writeConsent(prefs);
      hideBanner();
      closePrefs();
    });
    document.getElementById("lf-consent-prefs-save").focus();
  }

  function hideBanner() {
    var banner = document.getElementById("lf-consent-banner");
    if (banner) banner.hidden = true;
  }

  function showBanner() {
    if (document.getElementById("lf-consent-banner")) return;
    var panel = el("div", { class: "lf-consent-banner__panel", role: "dialog", "aria-labelledby": "lf-consent-title", "aria-describedby": "lf-consent-desc" }, [
      el("h2", { class: "lf-consent-banner__title", id: "lf-consent-title", text: "We value your privacy" }),
      el("p", {
        class: "lf-consent-banner__text",
        id: "lf-consent-desc",
        html:
          'We use necessary cookies to run LiturgyFlow securely. Optional preferences and media embeds need your consent. See our <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/cookies">Cookie Policy</a>.',
      }),
      el("div", { class: "lf-consent-banner__actions" }, [
        el("button", {
          type: "button",
          class: "lf-consent-btn lf-consent-btn--primary",
          id: "lf-consent-accept",
          text: "Accept all",
        }),
        el("button", {
          type: "button",
          class: "lf-consent-btn lf-consent-btn--ghost",
          id: "lf-consent-necessary",
          text: "Necessary only",
        }),
        el("button", {
          type: "button",
          class: "lf-consent-btn lf-consent-btn--ghost",
          id: "lf-consent-customize",
          text: "Customize",
        }),
      ]),
    ]);
    var banner = el("div", { class: "lf-consent-banner", id: "lf-consent-banner" }, [panel]);
    document.body.appendChild(banner);
    document.getElementById("lf-consent-accept").addEventListener("click", function () {
      writeConsent({ preferences: true, media: true, analytics: false });
      hideBanner();
    });
    document.getElementById("lf-consent-necessary").addEventListener("click", function () {
      writeConsent({ preferences: false, media: false, analytics: false });
      hideBanner();
    });
    document.getElementById("lf-consent-customize").addEventListener("click", openPrefs);
  }

  function gateMediaEmbed(loadFn) {
    if (hasCategory("media")) {
      loadFn();
      return true;
    }
    return false;
  }

  function init() {
    window.__LF_CONSENT__ = readConsent();
    if (!window.__LF_CONSENT__ || !window.__LF_CONSENT__.decidedAt) {
      showBanner();
    }

    document.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var btn = t.closest("[data-lf-consent-manage]");
      if (btn) {
        ev.preventDefault();
        openPrefs();
      }
    });
  }

  window.LiturgyFlowConsent = {
    get: readConsent,
    has: hasCategory,
    openPreferences: openPrefs,
    gateMediaEmbed: gateMediaEmbed,
    acceptAll: function () {
      return writeConsent({ preferences: true, media: true, analytics: false });
    },
    necessaryOnly: function () {
      return writeConsent({ preferences: false, media: false, analytics: false });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
