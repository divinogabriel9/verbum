/**
 * PostHog loader — initializes only after Analytics cookie consent.
 * Config: window.__LF_POSTHOG__ = { enabled, key, host, session_recording }
 * API: window.LiturgyFlowAnalytics.{ identify, capture, reset, start, stop }
 */
(function () {
  "use strict";

  var started = false;
  var inited = false;

  function cfg() {
    var c = window.__LF_POSTHOG__;
    if (!c || !c.enabled || !c.key) return null;
    return c;
  }

  function hasAnalyticsConsent() {
    try {
      if (window.LiturgyFlowConsent && typeof window.LiturgyFlowConsent.has === "function") {
        return !!window.LiturgyFlowConsent.has("analytics");
      }
    } catch (_e) {}
    return false;
  }

  function ensureStub() {
    if (window.posthog && window.posthog.__SV) return window.posthog;
    /* Official PostHog array.js stub (trimmed). */
    (function (t, e) {
      if (e.__SV) return;
      var o, n, p, r;
      window.posthog = e;
      e._i = [];
      e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split(".");
          if (2 === o.length) {
            t = t[o[0]];
            e = o[1];
          }
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        p = t.createElement("script");
        p.type = "text/javascript";
        p.crossOrigin = "anonymous";
        p.async = true;
        p.src =
          s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") +
          "/static/array.js";
        r = t.getElementsByTagName("script")[0];
        r.parentNode.insertBefore(p, r);
        var u = e;
        if (void 0 !== a) u = e[a] = [];
        else a = "posthog";
        u.people = u.people || [];
        u.toString = function (t) {
          var e = "posthog";
          if ("posthog" !== a) e += "." + a;
          if (!t) e += " (stub)";
          return e;
        };
        u.people.toString = function () {
          return u.toString(1) + ".people (stub)";
        };
        o =
          "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_session_id createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug get_property getSessionProperty".split(
            " "
          );
        for (n = 0; n < o.length; n++) g(u, o[n]);
        e._i.push([i, s, a]);
      };
      e.__SV = 1;
    })(document, window.posthog || []);
    return window.posthog;
  }

  function start() {
    var c = cfg();
    if (!c) return;
    if (!hasAnalyticsConsent()) return;

    if (inited) {
      try {
        if (window.posthog && typeof window.posthog.opt_in_capturing === "function") {
          window.posthog.opt_in_capturing();
        }
      } catch (_e) {}
      started = true;
      return;
    }

    started = true;
    inited = true;

    var host = (c.host || "https://us.i.posthog.com").replace(/\/$/, "");
    var uiHost =
      host.indexOf("eu.") >= 0 ? "https://eu.posthog.com" : "https://us.posthog.com";

    try {
      var ph = ensureStub();
      ph.init(c.key, {
        api_host: host,
        ui_host: uiHost,
        persistence: "localStorage+cookie",
        capture_pageview: true,
        capture_pageleave: true,
        person_profiles: "identified_only",
        disable_session_recording: !c.session_recording,
        respect_dnt: true,
      });
    } catch (_e) {
      started = false;
      inited = false;
    }
  }

  function stop() {
    try {
      if (window.posthog && typeof window.posthog.opt_out_capturing === "function") {
        window.posthog.opt_out_capturing();
      }
      if (window.posthog && typeof window.posthog.reset === "function") {
        window.posthog.reset(true);
      }
    } catch (_e) {}
    started = false;
  }

  function syncFromConsent() {
    if (hasAnalyticsConsent()) start();
    else if (started || (window.posthog && window.posthog.__loaded)) stop();
  }

  function identify(distinctId, traits) {
    if (!distinctId || !hasAnalyticsConsent()) return;
    start();
    try {
      if (window.posthog && typeof window.posthog.identify === "function") {
        window.posthog.identify(String(distinctId), traits || undefined);
      }
    } catch (_e) {}
  }

  function capture(event, properties) {
    if (!event || !hasAnalyticsConsent()) return;
    start();
    try {
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture(String(event), properties || undefined);
      }
    } catch (_e) {}
  }

  function reset() {
    try {
      if (window.posthog && typeof window.posthog.reset === "function") {
        window.posthog.reset(true);
      }
    } catch (_e) {}
  }

  window.LiturgyFlowAnalytics = {
    identify: identify,
    capture: capture,
    reset: reset,
    start: start,
    stop: stop,
  };

  window.addEventListener("lf:consent-changed", syncFromConsent);

  function boot() {
    syncFromConsent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
