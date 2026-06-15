/**
 * Login page color theme — shared with main app via verbumColorTheme localStorage.
 */
(function () {
  "use strict";

  var THEME_STORAGE_KEY = "verbumColorTheme";
  var TOGGLE_DARK_STORAGE_KEY = "verbumToggleDarkMode";

  function getToggleDarkPreference() {
    try {
      var v = localStorage.getItem(TOGGLE_DARK_STORAGE_KEY);
      return v === "oled" ? "oled" : "dark";
    } catch (_e) {
      return "dark";
    }
  }

  function resolveColorTheme(preference) {
    var pref = preference;
    if (pref == null || pref === "") {
      try {
        pref = localStorage.getItem(THEME_STORAGE_KEY) || "system";
      } catch (_e) {
        pref = "system";
      }
    }
    if (pref === "dark" || pref === "oled") return "dark";
    if (pref === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncThemeToggleUI(resolved) {
    var btn = document.getElementById("auth-theme-toggle");
    if (!btn) return;
    var isDark = resolved === "dark";
    var toggleDark = getToggleDarkPreference();
    var darkLabel = toggleDark === "oled" ? "Switch to OLED mode" : "Switch to dark mode";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : darkLabel);
    btn.title = isDark ? "Switch to light mode" : darkLabel;
  }

  function applyColorTheme(preference) {
    var pref = preference;
    if (pref == null || pref === "") {
      try {
        pref = localStorage.getItem(THEME_STORAGE_KEY) || "system";
      } catch (_e) {
        pref = "system";
      }
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch (_e) {
      /* ignore */
    }
    var resolved = resolveColorTheme(pref);
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-preference", pref);
    root.style.colorScheme = resolved;
    if (pref === "oled") {
      root.setAttribute("data-dark-variant", "oled");
    } else {
      root.removeAttribute("data-dark-variant");
    }
    syncThemeToggleUI(resolved);
    try {
      window.dispatchEvent(
        new CustomEvent("verbum-theme-change", { detail: { preference: pref, resolved: resolved } })
      );
    } catch (_e) {
      /* ignore */
    }
    return resolved;
  }

  function toggleColorTheme() {
    var resolved = document.documentElement.getAttribute("data-theme") || "light";
    applyColorTheme(resolved === "dark" ? "light" : getToggleDarkPreference());
  }

  function initColorTheme() {
    applyColorTheme();
    var btn = document.getElementById("auth-theme-toggle");
    if (btn && !btn.dataset.themeBound) {
      btn.dataset.themeBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toggleColorTheme();
      });
    }
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        var pref = document.documentElement.getAttribute("data-theme-preference") || "system";
        if (pref === "system") applyColorTheme("system");
      });
    } catch (_e) {
      /* ignore */
    }
  }

  window.VerbumAuthTheme = {
    apply: applyColorTheme,
    toggle: toggleColorTheme,
    init: initColorTheme,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initColorTheme);
  } else {
    initColorTheme();
  }
})();
