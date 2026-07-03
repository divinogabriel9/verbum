(function () {
  "use strict";

  var STORAGE_KEY = "liturgyflow.tour.pptx.v1";
  var activeDriver = null;
  var autoStartPending = false;
  var highlightRing = null;
  var highlightRingRaf = 0;
  var highlightRingBound = false;

  var TOUR_GAP = 14;
  var STAGE_PADDING = 10;
  var STAGE_RADIUS = 12;
  var TOUR_WIDTH = 340;
  var TOUR_HEIGHT_EST = 220;
  var SIDE_ORDER = ["right", "left", "top", "bottom"];

  function getDriverFactory() {
    return window.driver && window.driver.js && window.driver.js.driver;
  }

  function waitForMassWizard(maxMs) {
    maxMs = maxMs || 8000;
    return new Promise(function (resolve) {
      if (window.MassWizard) return resolve(window.MassWizard);
      var start = Date.now();
      var timer = setInterval(function () {
        if (window.MassWizard) {
          clearInterval(timer);
          resolve(window.MassWizard);
        } else if (Date.now() - start > maxMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 40);
    });
  }

  function prepStep(n) {
    if (window.MassWizard && typeof window.MassWizard.setStep === "function") {
      window.MassWizard.setStep(n);
    }
  }

  function softScrollTo(el) {
    if (!el || el.id === "driver-dummy-element") return;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
    } catch (_err) {
      try { el.scrollIntoView(); } catch (_err2) { /* ignore */ }
    }
  }

  function spaceForSide(rect, side, vw, vh) {
    if (side === "right") return vw - rect.right - TOUR_GAP;
    if (side === "left") return rect.left - TOUR_GAP;
    if (side === "top") return rect.top - TOUR_GAP;
    return vh - rect.bottom - TOUR_GAP;
  }

  function resolvePopoverSide(el) {
    if (!el || el.id === "driver-dummy-element") return "bottom";
    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var minW = Math.min(TOUR_WIDTH, vw - 24);
    var minH = Math.min(TOUR_HEIGHT_EST, vh - 24);

    for (var i = 0; i < SIDE_ORDER.length; i++) {
      var side = SIDE_ORDER[i];
      var space = spaceForSide(rect, side, vw, vh);
      if (side === "right" || side === "left") {
        if (space >= minW) return side;
      } else if (space >= minH) {
        return side;
      }
    }

    var best = SIDE_ORDER[0];
    var bestSpace = spaceForSide(rect, best, vw, vh);
    for (var j = 1; j < SIDE_ORDER.length; j++) {
      var s = SIDE_ORDER[j];
      var sp = spaceForSide(rect, s, vw, vh);
      if (sp > bestSpace) {
        best = s;
        bestSpace = sp;
      }
    }
    return best;
  }

  function stepPrep(n, selector) {
    return function (_el, step) {
      prepStep(n);
      var target = selector
        ? document.querySelector(selector)
        : (step && typeof step.element === "string" ? document.querySelector(step.element) : _el);
      if (target && step && step.popover) {
        step.popover.side = resolvePopoverSide(target);
        step.popover.align = "start";
      }
      if (target) softScrollTo(target);
      syncHighlightRing();
      setTimeout(syncHighlightRing, 280);
    };
  }

  function ensureMassBuilderRoute() {
    return new Promise(function (resolve) {
      var flowPage = document.getElementById("flow-page");
      if (flowPage && flowPage.classList.contains("active")) {
        waitForMassWizard().then(function () { resolve(); });
        return;
      }
      var link = document.querySelector('.app-sidebar__link[data-route="/mass/builder"], .nav-link[data-route="/mass/builder"]');
      if (link) link.click();
      else {
        history.pushState({}, "", "/mass/builder");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      setTimeout(function () {
        waitForMassWizard().then(function () { resolve(); });
      }, 320);
    });
  }

  function markComplete() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedAt: Date.now() }));
    } catch (_err) { /* ignore */ }
  }

  function hasCompletedTour() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (_err) {
      return false;
    }
  }

  function shouldAutoStart() {
    if (hasCompletedTour()) return false;
    if (window.MassWizard && window.MassWizard.hasProgress && window.MassWizard.hasProgress()) return false;
    return true;
  }

  function setPopoverOrigin(popover, side) {
    if (!popover || !popover.wrapper) return;
    var map = {
      top: "bottom center",
      bottom: "top center",
      left: "center right",
      right: "center left",
      over: "center center",
    };
    popover.wrapper.style.transformOrigin = map[side] || "top center";
  }

  function wireSkipButton(popover) {
    if (!popover || !popover.wrapper || popover.wrapper.dataset.lfSkipWired === "1") return;
    popover.wrapper.dataset.lfSkipWired = "1";
    if (popover.footer) popover.footer.classList.add("lf-tour-footer");

    var row = document.createElement("div");
    row.className = "lf-tour-skip-row";
    var skip = document.createElement("button");
    skip.type = "button";
    skip.className = "lf-tour-skip-btn";
    skip.textContent = "Skip tour";
    skip.setAttribute("aria-label", "Skip guided tour");
    skip.addEventListener("click", function () {
      if (activeDriver && activeDriver.destroy) activeDriver.destroy();
    });
    row.appendChild(skip);
    popover.wrapper.appendChild(row);
  }

  function repositionProgress(popover) {
    if (!popover || !popover.progress || !popover.wrapper) return;
    var el = popover.progress;
    el.classList.add("lf-tour-progress-top");
    var title = popover.title;
    if (title && title.parentElement === popover.wrapper) {
      popover.wrapper.insertBefore(el, title);
    } else if (el.parentElement !== popover.wrapper) {
      popover.wrapper.insertBefore(el, popover.wrapper.firstChild);
    }
  }

  function ensureHighlightRing() {
    if (highlightRing) return highlightRing;
    highlightRing = document.createElement("div");
    highlightRing.className = "lf-tour-highlight-ring";
    highlightRing.setAttribute("aria-hidden", "true");
    document.body.appendChild(highlightRing);
    return highlightRing;
  }

  function positionHighlightRing(el) {
    if (!el || el.id === "driver-dummy-element") {
      if (highlightRing) highlightRing.classList.remove("is-visible");
      return;
    }
    var ring = ensureHighlightRing();
    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      ring.classList.remove("is-visible");
      return;
    }
    ring.style.top = Math.round(rect.top - STAGE_PADDING) + "px";
    ring.style.left = Math.round(rect.left - STAGE_PADDING) + "px";
    ring.style.width = Math.round(rect.width + STAGE_PADDING * 2) + "px";
    ring.style.height = Math.round(rect.height + STAGE_PADDING * 2) + "px";
    ring.style.borderRadius = STAGE_RADIUS + "px";
    ring.classList.add("is-visible");
  }

  function syncHighlightRing() {
    if (highlightRingRaf) cancelAnimationFrame(highlightRingRaf);
    highlightRingRaf = requestAnimationFrame(function () {
      highlightRingRaf = 0;
      positionHighlightRing(document.querySelector(".driver-active-element"));
    });
  }

  function bindHighlightRingListeners() {
    if (highlightRingBound) return;
    highlightRingBound = true;
    window.addEventListener("resize", syncHighlightRing, { passive: true });
    window.addEventListener("scroll", syncHighlightRing, true);
  }

  function unbindHighlightRingListeners() {
    if (!highlightRingBound) return;
    highlightRingBound = false;
    window.removeEventListener("resize", syncHighlightRing);
    window.removeEventListener("scroll", syncHighlightRing, true);
  }

  function destroyHighlightRing() {
    unbindHighlightRingListeners();
    if (highlightRingRaf) {
      cancelAnimationFrame(highlightRingRaf);
      highlightRingRaf = 0;
    }
    if (highlightRing) {
      highlightRing.classList.remove("is-visible");
      highlightRing.remove();
      highlightRing = null;
    }
  }

  function polishPopover(popover, ctx, isFirst, isLastStep) {
    if (!popover || !popover.wrapper) return;
    var step = ctx && ctx.state ? ctx.state.activeStep : null;
    var side = step && step.popover ? step.popover.side : "right";
    wireSkipButton(popover);
    setPopoverOrigin(popover, side);
    repositionProgress(popover);
    if (popover.previousButton) popover.previousButton.textContent = "Back";
    if (popover.nextButton) popover.nextButton.textContent = isLastStep ? "Finish" : "Next";
    if (popover.closeButton) popover.closeButton.textContent = "×";
    if (isFirst) popover.wrapper.classList.add("lf-tour-popover--ready");
  }

  function buildSteps() {
    return [
      {
        element: "#mw-progress",
        popover: {
          title: "Seven steps to your deck",
          description: "LiturgyFlow walks you through Mass prep in order — from date and celebrant to hymns, posters, and download. Tap any step number to jump back.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(1, "#mw-progress"),
      },
      {
        element: "#mass-date-trigger",
        popover: {
          title: "Pick the Mass date",
          description: "Choose the Sunday or feast day. Readings, liturgical season, and theme color load automatically for that date.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(1, "#mass-date-trigger"),
      },
      {
        element: "#celebrant-picker-trigger",
        popover: {
          title: "Mass celebrant",
          description: "Select who is presiding. Add celebrant names in Settings → Church Profile if the list is empty.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(1, "#celebrant-picker-trigger"),
      },
      {
        element: "#mw-next",
        popover: {
          title: "Continue",
          description: "Move forward when the date is set. Readings fetch in the background as you continue.",
          side: "top",
          align: "end",
        },
        onHighlightStarted: stepPrep(1, "#mw-next"),
      },
      {
        element: "#mass-step-target-liturgy",
        popover: {
          title: "Introductory Rites",
          description: "Choose the Penitential Act, Kyrie, and Gloria. Sensible defaults are already selected — tap a card to change the setting or tune.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(2, "#mass-step-target-liturgy"),
      },
      {
        element: "#mass-step-target-readings",
        popover: {
          title: "Liturgy of the Word",
          description: "Choose the responsorial psalm refrain and a Gospel sentence for your slides and poster title. Use the custom fields if you want to override the detected lines.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(3, "#mass-step-target-readings"),
      },
      {
        element: ".flow-readings-sidebar",
        popover: {
          title: "Sunday readings",
          description: "Full readings load here when you pick a date. Tap any reading card to preview the complete text while you refine psalm and Gospel lines.",
          side: "left",
          align: "start",
        },
        onHighlightStarted: stepPrep(3, ".flow-readings-sidebar"),
      },
      {
        element: '[data-mw-step="4"]',
        popover: {
          title: "Liturgy of the Eucharist",
          description: "Set the Creed, Sanctus, Our Father language, and Lamb of God. These choices shape the corresponding slides in your deck.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(4, '[data-mw-step="4"]'),
      },
      {
        element: "#mass-song-plan",
        popover: {
          title: "Music Ministry",
          description: "Assign a hymn to each part of the Mass — Entrance, Offertory, Communion, and more. Search the catalog or accept mood-based recommendations.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(5, "#mass-song-plan"),
      },
      {
        element: "#mass-summary-sidebar",
        popover: {
          title: "Hymn setup",
          description: "Track how many slots are filled, filter by language, and choose single- or dual-column lyric layout for the PowerPoint slides.",
          side: "left",
          align: "start",
        },
        onHighlightStarted: stepPrep(5, "#mass-summary-sidebar"),
      },
      {
        element: "#mass-step-target-stewardship",
        popover: {
          title: "Stewardship",
          description: "Optional collection amount and date for the stewardship slide, plus food sponsors and the Sign of Peace message.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(6, "#mass-step-target-stewardship"),
      },
      {
        element: "#mass-step-target-media",
        popover: {
          title: "Posters & branding",
          description: "Pick LOTW and LOTE poster styles, upload announcement images, toggle parish branding, and optionally generate AI gospel art (quota applies).",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(6, "#mass-step-target-media"),
      },
      {
        element: "#mw-review",
        popover: {
          title: "Review",
          description: "Confirm date, celebrant, readings, songs, and extras. The estimated slide count updates here before you generate.",
          side: "right",
          align: "start",
        },
        onHighlightStarted: stepPrep(7, "#mw-review"),
      },
      {
        element: "#mw-generate",
        popover: {
          title: "Generate your package",
          description: "Builds your PowerPoint deck, poster images, and optional PDF into one download package. Review the receipt, then grab the PPTX or full ZIP.",
          side: "top",
          align: "end",
        },
        onHighlightStarted: stepPrep(7, "#mw-generate"),
      },
    ];
  }

  function startPptxTour(options) {
    options = options || {};
    var driverFactory = getDriverFactory();
    if (!driverFactory) {
      console.warn("[LiturgyFlowTour] driver.js is not loaded.");
      return Promise.resolve(null);
    }
    if (activeDriver && activeDriver.isActive && activeDriver.isActive()) {
      activeDriver.destroy();
      activeDriver = null;
    }

    var steps = buildSteps();

    return ensureMassBuilderRoute().then(function () {
      var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      var firstPopover = true;
      var driverObj = driverFactory({
        animate: !reduced,
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        popoverClass: "lf-tour-popover",
        overlayOpacity: 0.42,
        stagePadding: 10,
        stageRadius: 12,
        popoverOffset: TOUR_GAP,
        allowClose: true,
        smoothScroll: false,
        disableActiveInteraction: true,
        onPopoverRender: function (popover, ctx) {
          var idx = ctx && ctx.state && typeof ctx.state.activeIndex === "number" ? ctx.state.activeIndex : 0;
          polishPopover(popover, ctx, firstPopover, idx >= steps.length - 1);
          firstPopover = false;
          syncHighlightRing();
        },
        onHighlighted: function () {
          syncHighlightRing();
        },
        onDestroyed: function () {
          document.body.classList.remove("lf-tour-active");
          destroyHighlightRing();
          activeDriver = null;
          if (!options.skipMarkComplete) markComplete();
        },
        steps: steps,
      });

      document.body.classList.add("lf-tour-active");
      bindHighlightRingListeners();
      activeDriver = driverObj;
      driverObj.drive();
      return driverObj;
    });
  }

  function bindTriggers() {
    var helpBtn = document.getElementById("btn-mw-tour");
    if (helpBtn) {
      helpBtn.addEventListener("click", function () {
        startPptxTour();
      });
    }

    var acctBtn = document.getElementById("account-tour-link");
    if (acctBtn) {
      acctBtn.addEventListener("click", function (event) {
        event.preventDefault();
        var panel = document.getElementById("account-menu-panel");
        var btn = document.getElementById("account-menu-btn");
        if (panel) panel.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (typeof closeHeaderMenus === "function") closeHeaderMenus();
        startPptxTour();
      });
    }

    var homeLink = document.getElementById("home-mass-tour-link");
    if (homeLink) {
      homeLink.addEventListener("click", function (event) {
        event.preventDefault();
        startPptxTour();
      });
    }
  }

  function maybeAutoStartTour() {
    if (!autoStartPending || !shouldAutoStart()) return;
    var flowPage = document.getElementById("flow-page");
    if (!flowPage || !flowPage.classList.contains("active")) return;
    autoStartPending = false;
    setTimeout(function () {
      if (shouldAutoStart()) startPptxTour();
    }, 700);
  }

  function watchBuilderRoute() {
    var flowPage = document.getElementById("flow-page");
    if (!flowPage) return;
    var observer = new MutationObserver(function () {
      if (flowPage.classList.contains("active")) maybeAutoStartTour();
    });
    observer.observe(flowPage, { attributes: true, attributeFilter: ["class"] });
    if (flowPage.classList.contains("active")) maybeAutoStartTour();
  }

  function init() {
    bindTriggers();
    if (shouldAutoStart()) {
      autoStartPending = true;
      watchBuilderRoute();
    }
  }

  window.LiturgyFlowTour = {
    startPptxTour: startPptxTour,
    markComplete: markComplete,
    hasCompletedTour: hasCompletedTour,
    shouldAutoStart: shouldAutoStart,
    STORAGE_KEY: STORAGE_KEY,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
