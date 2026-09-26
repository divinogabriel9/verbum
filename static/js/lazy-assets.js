/* Verbum — on-demand script/CSS loader (HLS, wizard, tour, app parts). */
(function (global) {
  "use strict";

  var pending = Object.create(null);
  var TOUR_STORAGE_KEY = "liturgyflow.tour.pptx.v1";
  var TOUR_STORAGE_KEY_COMPOSER = "liturgyflow.tour.composer.v1";

  var ASSETS = {
    hls: "/static/js/hls.min.js",
    driver: "/static/js/driver.js?v=20260703",
    tour: "/static/js/guided-tour.js?v=20260920g",
    driverCss: "/static/css/driver.css?v=20260703",
    tourCss: "/static/css/guided-tour.css?v=20260920g",
    wizard: "/static/js/mw-wizard.js?v=20260926-ai-overlay2",
    wizardCss: "/static/css/mw-wizard.css?v=20260926-ai-overlay2",
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
      return !!localStorage.getItem(TOUR_STORAGE_KEY);
    } catch (_e) {
      return true;
    }
  }

  function hasCompletedComposerTour() {
    try {
      return !!localStorage.getItem(TOUR_STORAGE_KEY_COMPOSER);
    } catch (_e) {
      return true;
    }
  }

  function shouldAutoStartTour() {
    return !hasCompletedTour();
  }

  function shouldAutoStartComposerTour() {
    return false;
  }

  function bindTourTriggers() {
    function closeAccountMenu() {
      var panel = document.getElementById("account-menu-panel");
      var btn = document.getElementById("account-menu-btn");
      if (panel) panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (typeof closeHeaderMenus === "function") closeHeaderMenus();
    }

    function startPptx(event) {
      if (event) event.preventDefault();
      closeAccountMenu();
      ensureTour().then(function (tour) {
        if (tour && typeof tour.startPptxTour === "function") tour.startPptxTour();
      });
    }

    function startComposer(event) {
      if (event) event.preventDefault();
      closeAccountMenu();
      ensureTour().then(function (tour) {
        if (tour && typeof tour.startComposerTour === "function") tour.startComposerTour();
      });
    }

    function startContextual(event) {
      if (event) event.preventDefault();
      closeAccountMenu();
      ensureTour().then(function (tour) {
        if (!tour) return;
        if (typeof tour.startContextualTour === "function") {
          tour.startContextualTour();
          return;
        }
        var lyrics = document.getElementById("lyrics-page");
        if (lyrics && lyrics.classList.contains("active") && typeof tour.startComposerTour === "function") {
          tour.startComposerTour();
        } else if (typeof tour.startPptxTour === "function") {
          tour.startPptxTour();
        }
      });
    }

    [
      { id: "btn-mw-tour", handler: startPptx },
      { id: "home-mass-tour-link", handler: startPptx },
      { id: "btn-composer-tour", handler: startComposer },
      { id: "account-tour-link", handler: startContextual },
    ].forEach(function (item) {
      var el = document.getElementById(item.id);
      if (!el || el.dataset.lfTourBound === "1") return;
      el.dataset.lfTourBound = "1";
      el.addEventListener("click", item.handler);
    });
  }

  function prefetchWizardOnIntent() {
    document.addEventListener(
      "pointerenter",
      function (event) {
        var t = event.target;
        if (!t || !t.closest) return;
        var link = t.closest(
          '[data-route="/mass/builder"], #btn-mw-tour, #home-mass-tour-link, [data-route="/library/songs"], #btn-composer-tour'
        );
        if (!link) return;
        if (link.matches('[data-route="/library/songs"], #btn-composer-tour')) {
          ensureTour().catch(function () {});
          return;
        }
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
    STORAGE_KEY_COMPOSER: TOUR_STORAGE_KEY_COMPOSER,
    hasCompletedTour: hasCompletedTour,
    shouldAutoStart: shouldAutoStartTour,
    shouldAutoStartComposer: shouldAutoStartComposerTour,
    markComplete: function (kind) {
      try {
        var key = kind === "composer" ? TOUR_STORAGE_KEY_COMPOSER : TOUR_STORAGE_KEY;
        localStorage.setItem(key, "1");
      } catch (_e) { /* ignore */ }
    },
    startPptxTour: function (options) {
      return ensureTour().then(function (tour) {
        if (!tour || typeof tour.startPptxTour !== "function") return null;
        return tour.startPptxTour(options);
      });
    },
    startComposerTour: function (options) {
      return ensureTour().then(function (tour) {
        if (!tour || typeof tour.startComposerTour !== "function") return null;
        return tour.startComposerTour(options);
      });
    },
    startContextualTour: function (options) {
      return ensureTour().then(function (tour) {
        if (!tour) return null;
        if (typeof tour.startContextualTour === "function") return tour.startContextualTour(options);
        var lyrics = document.getElementById("lyrics-page");
        if (lyrics && lyrics.classList.contains("active") && typeof tour.startComposerTour === "function") {
          return tour.startComposerTour(options);
        }
        if (typeof tour.startPptxTour === "function") return tour.startPptxTour(options);
        return null;
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
