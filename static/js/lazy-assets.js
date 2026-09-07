/* Verbum — on-demand script/CSS loader (HLS, wizard, tour, app parts). */
(function (global) {
  "use strict";

  var pending = Object.create(null);
  var TOUR_STORAGE_KEY = "liturgyflow.tour.pptx.v1";

  var ASSETS = {
    hls: "/static/js/hls.min.js",
    driver: "/static/js/driver.js?v=20260703",
    tour: "/static/js/guided-tour.js?v=20260906-perf1",
    driverCss: "/static/css/driver.css?v=20260703",
    tourCss: "/static/css/guided-tour.css?v=20260703j",
    wizard: "/static/js/mw-wizard.js?v=20260906-perf1",
    wizardCss: "/static/css/mw-wizard.css?v=20260906-0945",
  };

  var APP_PARTS = [
    "/static/js/app/app-01-core.js",
    "/static/js/app/app-02-media-radio.js",
    "/static/js/app/app-03-routing-lyrics.js",
    "/static/js/app/app-04-song-plan.js",
    "/static/js/app/app-05-community.js",
    "/static/js/app/app-06-superadmin.js",
    "/static/js/app/app-07-posters-slideshow.js",
    "/static/js/app/app-08-calendar-catalog.js",
    "/static/js/app/app-09-boot.js",
  ];

  function loadScript(src) {
    if (pending[src]) return pending[src];
    pending[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      var s = existing || document.createElement("script");
      s.onload = function () {
        s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = function () {
        delete pending[src];
        reject(new Error("Failed to load " + src));
      };
      if (!existing) {
        s.src = src;
        s.async = true;
        (document.head || document.documentElement).appendChild(s);
      }
    });
    return pending[src];
  }

  function loadCss(href) {
    if (pending[href]) return pending[href];
    pending[href] = new Promise(function (resolve) {
      if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) {
        resolve();
        return;
      }
      var l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.onload = function () {
        resolve();
      };
      l.onerror = function () {
        resolve();
      };
      (document.head || document.documentElement).appendChild(l);
    });
    return pending[href];
  }

  /** Parallel download, ordered execution (async=false). */
  function loadScriptsOrdered(urls) {
    return new Promise(function (resolve, reject) {
      if (!urls || !urls.length) {
        resolve();
        return;
      }
      var left = urls.length;
      var failed = false;
      urls.forEach(function (url) {
        if (pending[url]) {
          pending[url].then(function () {
            left -= 1;
            if (!left && !failed) resolve();
          }, function (err) {
            failed = true;
            reject(err);
          });
          return;
        }
        pending[url] = new Promise(function (res, rej) {
          var s = document.createElement("script");
          s.src = url;
          s.async = false;
          s.onload = function () {
            s.dataset.loaded = "1";
            res();
          };
          s.onerror = function () {
            delete pending[url];
            rej(new Error("Failed to load " + url));
          };
          (document.head || document.documentElement).appendChild(s);
        });
        pending[url].then(function () {
          left -= 1;
          if (!left && !failed) resolve();
        }, function (err) {
          failed = true;
          reject(err);
        });
      });
    });
  }

  function ensureHls() {
    if (global.Hls) return Promise.resolve(global.Hls);
    return loadScript(ASSETS.hls).then(function () {
      return global.Hls;
    });
  }

  function ensureWizard() {
    if (global.MassWizard) return Promise.resolve(global.MassWizard);
    return Promise.all([loadCss(ASSETS.wizardCss), loadScript(ASSETS.wizard)]).then(function () {
      return global.MassWizard || null;
    });
  }

  function ensureTour() {
    return ensureWizard().then(function () {
      if (global.LiturgyFlowTour && global.LiturgyFlowTour.__fullyLoaded) {
        return global.LiturgyFlowTour;
      }
      return Promise.all([loadCss(ASSETS.driverCss), loadCss(ASSETS.tourCss), loadScript(ASSETS.driver)])
        .then(function () {
          return loadScript(ASSETS.tour);
        })
        .then(function () {
          if (global.LiturgyFlowTour) global.LiturgyFlowTour.__fullyLoaded = true;
          return global.LiturgyFlowTour;
        });
    });
  }

  function hasCompletedTour() {
    try {
      return localStorage.getItem(TOUR_STORAGE_KEY) === "1";
    } catch (_e) {
      return true;
    }
  }

  function shouldAutoStartTour() {
    return !hasCompletedTour();
  }

  function bindTourTriggers() {
    function start(event) {
      if (event) event.preventDefault();
      var panel = document.getElementById("account-menu-panel");
      var btn = document.getElementById("account-menu-btn");
      if (panel) panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (typeof closeHeaderMenus === "function") closeHeaderMenus();
      ensureTour().then(function (tour) {
        if (tour && typeof tour.startPptxTour === "function") tour.startPptxTour();
      });
    }

    ["btn-mw-tour", "account-tour-link", "home-mass-tour-link"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.lfTourBound === "1") return;
      el.dataset.lfTourBound = "1";
      el.addEventListener("click", start);
    });
  }

  function prefetchWizardOnIntent() {
    document.addEventListener(
      "pointerenter",
      function (event) {
        var t = event.target;
        if (!t || !t.closest) return;
        var link = t.closest('[data-route="/mass/builder"], #btn-mw-tour, #home-mass-tour-link');
        if (!link) return;
        ensureWizard().catch(function () {});
      },
      true
    );
  }

  function loadAppBundle(version) {
    var v = version ? "?v=" + encodeURIComponent(version) : "";
    var parts = APP_PARTS.map(function (p) {
      return p + v;
    });
    return loadScriptsOrdered(parts);
  }

  // Stub until guided-tour.js replaces this object.
  global.LiturgyFlowTour = {
    __fullyLoaded: false,
    STORAGE_KEY: TOUR_STORAGE_KEY,
    hasCompletedTour: hasCompletedTour,
    shouldAutoStart: shouldAutoStartTour,
    markComplete: function () {
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, "1");
      } catch (_e) { /* ignore */ }
    },
    startPptxTour: function (options) {
      return ensureTour().then(function (tour) {
        if (!tour || typeof tour.startPptxTour !== "function") return null;
        return tour.startPptxTour(options);
      });
    },
  };

  global.VerbumLazy = {
    loadScript: loadScript,
    loadCss: loadCss,
    loadScriptsOrdered: loadScriptsOrdered,
    loadAppBundle: loadAppBundle,
    ensureHls: ensureHls,
    ensureWizard: ensureWizard,
    ensureTour: ensureTour,
    bindTourTriggers: bindTourTriggers,
    prefetchWizardOnIntent: prefetchWizardOnIntent,
    APP_PARTS: APP_PARTS,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindTourTriggers();
      prefetchWizardOnIntent();
    });
  } else {
    bindTourTriggers();
    prefetchWizardOnIntent();
  }
})(window);
