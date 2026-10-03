/**
 * Public pricing page — catalog from /api/billing/catalog.
 * Currency by location: KRW / PHP / MYR / USD (no manual switcher).
 * CTAs go through full /sign-up, then Settings → Billing.
 */
(function () {
  "use strict";

  var INTERVALS = ["monthly", "quarterly", "semiannual", "annual"];
  var FALLBACK_AMOUNTS = {
    usd: {
      monthly: "$6.99",
      quarterly: "$18.99",
      semiannual: "$34.99",
      annual: "$59.99",
    },
    krw: {
      monthly: "₩9,900",
      quarterly: "₩27,000",
      semiannual: "₩49,000",
      annual: "₩79,000",
    },
    php: {
      monthly: "₱199",
      quarterly: "₱549",
      semiannual: "₱999",
      annual: "₱1,599",
    },
    myr: {
      monthly: "RM19.90",
      quarterly: "RM54.90",
      semiannual: "RM99.90",
      annual: "RM159.90",
    },
  };
  var FALLBACK_LABELS = {
    monthly: { label: "Monthly", billing_hint: "Billed every month" },
    quarterly: { label: "3-month", billing_hint: "Billed every 3 months" },
    semiannual: { label: "6-month", billing_hint: "Billed every 6 months" },
    annual: { label: "Annual", billing_hint: "Billed once a year" },
  };

  var state = {
    currency: resolveCurrency(),
    interval: "annual",
    catalog: null,
    plansBound: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function localCurrencyHint() {
    try {
      var langs = [];
      var primary = (navigator.language || "").toLowerCase();
      if (primary) langs.push(primary);
      var navLangs = navigator.languages || [];
      for (var i = 0; i < navLangs.length; i++) {
        var l = String(navLangs[i] || "").toLowerCase();
        if (l && langs.indexOf(l) < 0) langs.push(l);
      }
      var tz = "";
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch (_tz) { /* ignore */ }

      function hasLang(prefixes) {
        for (var i = 0; i < langs.length; i++) {
          var lang = langs[i];
          for (var j = 0; j < prefixes.length; j++) {
            var p = prefixes[j];
            if (lang === p || lang.indexOf(p + "-") === 0) return true;
          }
        }
        return false;
      }

      if (hasLang(["ko"]) || tz === "Asia/Seoul") return "krw";
      if (hasLang(["fil", "tl"]) || primary === "en-ph" || tz === "Asia/Manila") return "php";
      if (hasLang(["ms"]) || primary === "en-my" || tz === "Asia/Kuala_Lumpur" || tz === "Asia/Kuching") {
        return "myr";
      }
    } catch (_e) { /* ignore */ }
    return "";
  }

  function resolveCurrency() {
    var cfg = window.__LF_BILLING__ || {};
    var country = String(cfg.country || "").toUpperCase();
    // Trust CDN country when present; otherwise use browser locale/timezone
    // (local/dev and hosts without CF-IPCountry often send empty country + usd).
    if (country === "KR") return "krw";
    if (country === "PH") return "php";
    if (country === "MY") return "myr";
    if (country) return "usd";
    var local = localCurrencyHint();
    if (local) return local;
    var serverCur = String(cfg.currency || "").toLowerCase();
    if (serverCur === "krw" || serverCur === "php" || serverCur === "myr") return serverCur;
    return "usd";
  }

  function hasSession() {
    return !!window.__LF_SIGNED_IN__;
  }

  function billingRedirect(interval, currency) {
    return (
      "/settings/billing?plan=" +
      encodeURIComponent(interval) +
      "&currency=" +
      encodeURIComponent(currency) +
      "&autostart=1"
    );
  }

  function signupUrl(interval, currency) {
    return (
      "/sign-up?intent=billing&redirect_url=" +
      encodeURIComponent(billingRedirect(interval, currency))
    );
  }

  function ctaHref(interval, currency) {
    if (hasSession()) return billingRedirect(interval, currency);
    return signupUrl(interval, currency);
  }

  function setStatus(msg) {
    var el = $("lf-pricing-status");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function intervalMeta(interval) {
    var intervals = (state.catalog && state.catalog.intervals) || [];
    var row = intervals.find(function (r) {
      return r.interval === interval;
    });
    var fallback = FALLBACK_LABELS[interval] || { label: interval, billing_hint: "" };
    return {
      interval: interval,
      label: (row && row.label) || fallback.label,
      billing_hint: (row && row.billing_hint) || fallback.billing_hint,
    };
  }

  function priceFor(interval) {
    var intervals = (state.catalog && state.catalog.intervals) || [];
    var row = intervals.find(function (r) {
      return r.interval === interval;
    });
    if (row) {
      var prices = row.prices || [];
      var hit =
        prices.find(function (p) {
          return p.currency === state.currency;
        }) || null;
      if (hit && hit.amount_display) return hit.amount_display;
    }
    var table = FALLBACK_AMOUNTS[state.currency] || FALLBACK_AMOUNTS.usd;
    return table[interval] || "—";
  }

  function selectInterval(interval) {
    if (!INTERVALS.includes(interval)) return;
    state.interval = interval;
    updatePlanSelection();
    updateCta();
  }

  function updatePlanSelection() {
    var host = $("lf-pricing-plans");
    if (!host) return;
    host.querySelectorAll(".lf-pricing__plan").forEach(function (btn) {
      var iv = btn.getAttribute("data-interval") || "";
      var selected = iv === state.interval;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function updateCta() {
    var cta = $("lf-pricing-cta");
    if (!cta) return;
    cta.href = ctaHref(state.interval, state.currency);
    cta.textContent = hasSession() ? "Continue to billing" : "Start free trial";
    var accessSignup = $("lf-gen-access-signup");
    if (accessSignup) {
      accessSignup.href = ctaHref(state.interval, state.currency);
    }
  }

  function renderPlans() {
    var host = $("lf-pricing-plans");
    if (!host) return;
    host.innerHTML = "";
    INTERVALS.forEach(function (interval) {
      var meta = intervalMeta(interval);
      var amount = priceFor(interval);
      var featured = interval === "annual";
      var selected = interval === state.interval;
      var item = document.createElement("button");
      item.type = "button";
      item.className =
        "lf-pricing__plan" +
        (featured ? " is-featured" : "") +
        (selected ? " is-selected" : "");
      item.setAttribute("role", "option");
      item.setAttribute("data-interval", interval);
      item.setAttribute("aria-selected", selected ? "true" : "false");
      item.setAttribute("aria-pressed", selected ? "true" : "false");
      item.innerHTML =
        '<div class="lf-pricing__plan-copy">' +
        '<div class="lf-pricing__plan-label">' +
        escapeHtml(meta.label) +
        (featured ? '<span class="lf-pricing__badge">Best value</span>' : "") +
        "</div>" +
        '<p class="lf-pricing__plan-meta">' +
        escapeHtml(meta.billing_hint) +
        "</p></div>" +
        '<div class="lf-pricing__plan-amount">' +
        escapeHtml(amount) +
        "</div>";
      item.addEventListener("click", function () {
        selectInterval(interval);
      });
      host.appendChild(item);
    });
    state.plansBound = true;
    updateCta();
  }

  async function loadCatalog() {
    setStatus("Loading plans…");
    try {
      var res = await fetch(
        "/api/billing/catalog?currency=" + encodeURIComponent(state.currency),
        { credentials: "same-origin" }
      );
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.detail || "Could not load pricing.");
      state.catalog = data;
      setStatus("");
      renderPlans();
    } catch (_err) {
      setStatus("");
      // Fallback display amounts still let visitors pick a plan.
      renderPlans();
    }
  }

  function bindAccessPricingLink() {
    var link = $("lf-gen-access-see-pricing");
    if (!link || link.dataset.bound) return;
    link.dataset.bound = "1";
    link.addEventListener("click", function () {
      var backdrop = $("lf-access-backdrop");
      if (backdrop) {
        backdrop.hidden = true;
        document.body.classList.remove("lf-access-open");
      }
    });
  }

  function boot() {
    // Hide legacy currency switcher if present on an older markup.
    var currencyHost = $("lf-pricing-currency");
    if (currencyHost) currencyHost.hidden = true;
    bindAccessPricingLink();
    // Landing access popup only needs the CTA currency wired.
    if (!$("lf-pricing-plans")) {
      updateCta();
      return;
    }
    loadCatalog();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
