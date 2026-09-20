(function () {
  "use strict";

  var STORAGE_KEY = "liturgyflow.tour.pptx.v1";
  var STORAGE_KEY_COMPOSER = "liturgyflow.tour.composer.v1";
  var STORAGE_KEY_COMPOSER_HINT = "liturgyflow.tour.composer.hint.v1";
  var activeDriver = null;
  var activeTourKind = null;
  var autoStartPending = false;
  var composerHintPending = false;
  var composerHintTimer = 0;
  var highlightRing = null;
  var highlightRingRaf = 0;
  var highlightRingBound = false;
  var popoverClampTimer = 0;

  var TOUR_GAP = 14;
  var STAGE_PADDING = 10;
  var STAGE_RADIUS = 12;
  var TOUR_WIDTH = 340;
  var TOUR_HEIGHT_EST = 260;
  var SIDE_ORDER = ["right", "left", "top", "bottom"];
  var VIEWPORT_PAD = 12;

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
    var rect = el.getBoundingClientRect();
    var tall = rect.height > window.innerHeight * 0.45;
    try {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: tall ? "center" : "nearest",
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

  function resolvePopoverSide(el, order) {
    if (!el || el.id === "driver-dummy-element") return "bottom";
    var rect = el.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var minW = Math.min(TOUR_WIDTH, vw - 24);
    var minH = Math.min(TOUR_HEIGHT_EST, vh - 24);
    var sides = order && order.length ? order : SIDE_ORDER;

    // Tall/wide targets rarely leave room on the sides — prefer above/below.
    if (rect.height > vh * 0.5 || rect.width > vw * 0.55) {
      sides = ["bottom", "top", "right", "left"];
    }

    for (var i = 0; i < sides.length; i++) {
      var side = sides[i];
      var space = spaceForSide(rect, side, vw, vh);
      if (side === "right" || side === "left") {
        if (space >= minW) return side;
      } else if (space >= minH) {
        return side;
      }
    }

    var best = sides[0];
    var bestSpace = spaceForSide(rect, best, vw, vh);
    for (var j = 1; j < sides.length; j++) {
      var s = sides[j];
      var sp = spaceForSide(rect, s, vw, vh);
      if (sp > bestSpace) {
        best = s;
        bestSpace = sp;
      }
    }
    return best;
  }

  function clampPopoverInView(popover) {
    if (!popover || !popover.wrapper) return;
    var el = popover.wrapper;
    el.classList.remove("lf-tour-popover--docked");

    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    var vv = window.visualViewport;
    var vw = vv && vv.width ? vv.width : window.innerWidth;
    var vh = vv && vv.height ? vv.height : window.innerHeight;
    var ox = vv && typeof vv.offsetLeft === "number" ? vv.offsetLeft : 0;
    var oy = vv && typeof vv.offsetTop === "number" ? vv.offsetTop : 0;
    var pad = VIEWPORT_PAD;
    var w = rect.width;
    var h = rect.height;
    var top = rect.top;
    var left = rect.left;

    var bottomClearance = pad;
    var active = document.querySelector(".driver-active-element");
    var floatEl = document.getElementById("lyrics-editor-float");
    if (
      activeTourKind === "composer" &&
      floatEl &&
      !floatEl.hidden &&
      !(active && (active === floatEl || floatEl.contains(active)))
    ) {
      var fr = floatEl.getBoundingClientRect();
      if (fr.top > 0 && fr.top < oy + vh) {
        bottomClearance = Math.max(bottomClearance, Math.round(oy + vh - fr.top + 10));
      }
    }

    var minTop = oy + pad;
    var minLeft = ox + pad;
    var maxTop = oy + vh - h - bottomClearance;
    var maxLeft = ox + vw - w - pad;
    if (maxTop < minTop) maxTop = minTop;
    if (maxLeft < minLeft) maxLeft = minLeft;

    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.top = Math.round(top) + "px";
    el.style.left = Math.round(left) + "px";
  }

  function schedulePopoverClamp(popover) {
    if (!popover || !popover.wrapper) return;
    if (popoverClampTimer) {
      clearTimeout(popoverClampTimer);
      popoverClampTimer = 0;
    }
    requestAnimationFrame(function () {
      clampPopoverInView(popover);
      popoverClampTimer = setTimeout(function () {
        popoverClampTimer = 0;
        clampPopoverInView(popover);
        syncHighlightRing();
      }, 40);
    });
  }

  function isMobileComposerLayout() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
  }

  function showComposerBlocksPane() {
    if (!isMobileComposerLayout()) return;
    var tabs = document.getElementById("lyrics-composer-tabs");
    var blocksBtn = tabs && tabs.querySelector('[data-lyrics-tab="blocks"]');
    if (blocksBtn) {
      blocksBtn.click();
      return;
    }
    var rawPane = document.getElementById("lyrics-composer-pane-raw");
    var blocksPane = document.getElementById("lyrics-composer-pane-blocks");
    if (rawPane) {
      rawPane.classList.remove("is-active");
      rawPane.hidden = true;
    }
    if (blocksPane) {
      blocksPane.classList.add("is-active");
      blocksPane.hidden = false;
    }
  }

  function showComposerRawPane() {
    if (!isMobileComposerLayout()) return;
    var tabs = document.getElementById("lyrics-composer-tabs");
    var rawBtn = tabs && tabs.querySelector('[data-lyrics-tab="raw"]');
    if (rawBtn) {
      rawBtn.click();
      return;
    }
    var rawPane = document.getElementById("lyrics-composer-pane-raw");
    var blocksPane = document.getElementById("lyrics-composer-pane-blocks");
    if (blocksPane) {
      blocksPane.classList.remove("is-active");
      blocksPane.hidden = true;
    }
    if (rawPane) {
      rawPane.classList.add("is-active");
      rawPane.hidden = false;
    }
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

  function storageKeyFor(kind) {
    return kind === "composer" ? STORAGE_KEY_COMPOSER : STORAGE_KEY;
  }

  function markComplete(kind) {
    try {
      localStorage.setItem(storageKeyFor(kind || "pptx"), JSON.stringify({ completedAt: Date.now() }));
    } catch (_err) { /* ignore */ }
  }

  function hasCompletedTour(kind) {
    try {
      return !!localStorage.getItem(storageKeyFor(kind || "pptx"));
    } catch (_err) {
      return false;
    }
  }

  function shouldAutoStart() {
    if (hasCompletedTour("pptx")) return false;
    if (window.MassWizard && window.MassWizard.hasProgress && window.MassWizard.hasProgress()) return false;
    return true;
  }

  function shouldAutoStartComposer() {
    return false;
  }

  function hasSeenComposerHint() {
    try {
      return !!localStorage.getItem(STORAGE_KEY_COMPOSER_HINT);
    } catch (_err) {
      return true;
    }
  }

  function markComposerHintSeen() {
    try {
      localStorage.setItem(STORAGE_KEY_COMPOSER_HINT, JSON.stringify({ seenAt: Date.now() }));
    } catch (_err) { /* ignore */ }
  }

  function shouldShowComposerHint() {
    if (hasCompletedTour("composer")) return false;
    return !hasSeenComposerHint();
  }

  function hideComposerTourHint(immediate) {
    var hint = document.getElementById("composer-tour-hint");
    if (composerHintTimer) {
      clearTimeout(composerHintTimer);
      composerHintTimer = 0;
    }
    if (!hint) return;
    if (immediate) {
      hint.hidden = true;
      hint.classList.remove("is-visible", "is-fading");
      return;
    }
    if (!hint.classList.contains("is-visible") && hint.hidden) return;
    hint.classList.remove("is-visible");
    hint.classList.add("is-fading");
    composerHintTimer = setTimeout(function () {
      composerHintTimer = 0;
      hint.hidden = true;
      hint.classList.remove("is-fading");
    }, 720);
  }

  function showComposerTourHint() {
    if (!shouldShowComposerHint()) return;
    var lyricsPage = document.getElementById("lyrics-page");
    var hint = document.getElementById("composer-tour-hint");
    var btn = document.getElementById("btn-composer-tour");
    if (!lyricsPage || !lyricsPage.classList.contains("active") || !hint || !btn) return;

    hint.hidden = false;
    hint.classList.remove("is-fading");
    void hint.offsetWidth;
    hint.classList.add("is-visible");
    markComposerHintSeen();

    if (composerHintTimer) clearTimeout(composerHintTimer);
    composerHintTimer = setTimeout(function () {
      composerHintTimer = 0;
      hideComposerTourHint(false);
    }, 4800);
  }

  function maybeShowComposerTourHint() {
    if (!composerHintPending) return;
    var lyricsPage = document.getElementById("lyrics-page");
    if (!lyricsPage || !lyricsPage.classList.contains("active")) return;
    if (!shouldShowComposerHint()) {
      composerHintPending = false;
      return;
    }
    composerHintPending = false;
    setTimeout(function () {
      showComposerTourHint();
    }, 500);
  }

  function setComposerLibraryExpanded(expanded) {
    var panel = document.getElementById("song-composer-panel");
    var btn = document.getElementById("song-composer-collapse-btn");
    if (!panel) return;
    panel.classList.toggle("song-composer-panel--deflated", !expanded);
    if (btn) {
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      var label = expanded ? "Collapse song library" : "Expand song library";
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
  }

  function ensureComposerFloatForTour() {
    var el = document.getElementById("lyrics-editor-float");
    if (!el) return;
    el.hidden = false;
    el.classList.add("is-bright", "is-expanded");
    var fab = document.getElementById("lyrics-editor-float-fab");
    if (fab) {
      fab.setAttribute("aria-expanded", "true");
      fab.setAttribute("aria-label", "Close lyrics actions");
    }
  }

  function ensureComposerRoute() {
    return new Promise(function (resolve) {
      var lyricsPage = document.getElementById("lyrics-page");
      if (lyricsPage && lyricsPage.classList.contains("active")) {
        resolve();
        return;
      }
      var link = document.querySelector(
        '.app-sidebar__link[data-route="/library/songs"], .nav-link[data-route="/library/songs"], a[data-route="/library/songs"]'
      );
      if (link) link.click();
      else {
        history.pushState({}, "", "/library/songs");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      setTimeout(function () {
        resolve();
      }, 360);
    });
  }

  function composerStepPrep(opts) {
    opts = opts || {};
    return function (_el, step) {
      if (opts.expandLibrary) {
        setComposerLibraryExpanded(true);
        var panel = document.getElementById("song-composer-panel");
        if (panel) void panel.offsetHeight;
      }
      if (opts.deflateLibrary) setComposerLibraryExpanded(false);
      if (opts.showBlocksPane) showComposerBlocksPane();
      if (opts.showRawPane) showComposerRawPane();
      if (opts.ensureFloat) ensureComposerFloatForTour();

      var target = opts.selector
        ? document.querySelector(opts.selector)
        : _el;

      if (target) softScrollTo(target);
      syncHighlightRing();

      // One remount after layout prep (pane expand / library) — no refresh spam.
      if (opts.remount || opts.expandLibrary || opts.showBlocksPane || opts.showRawPane || opts.ensureFloat) {
        setTimeout(function () {
          if (activeDriver && typeof activeDriver.refresh === "function") {
            try { activeDriver.refresh(); } catch (_err) { /* ignore */ }
          }
          syncHighlightRing();
        }, 70);
      } else {
        setTimeout(syncHighlightRing, 160);
      }
    };
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

  function buildPptxSteps() {
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
          title: "Next step",
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
          description: "Pick LOTW and LOTE poster styles, upload announcement images, toggle parish branding, and optionally generate AI mass poster art (quota applies).",
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
          description: "Builds your PowerPoint deck and poster images into one download package. Review the receipt, then grab the PPTX or full ZIP.",
          side: "top",
          align: "end",
        },
        onHighlightStarted: stepPrep(7, "#mw-generate"),
      },
    ];
  }

  function buildComposerSteps() {
    var mobile = isMobileComposerLayout();
    return [
      {
        element: ".song-composer-head__copy",
        popover: {
          title: "Song Composer",
          description: "Build and edit parish hymns here — search the library, paste lyrics, structure verses and choruses, then save for Mass Builder.",
          side: "bottom",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({ selector: ".song-composer-head__copy" }),
      },
      {
        element: "#song-catalog-search",
        popover: {
          title: "Search the library",
          description: "Type a title to find songs in the catalog. Matching results expand the library panel below as you search.",
          side: "bottom",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({ selector: "#song-catalog-search" }),
      },
      {
        element: "#btn-composer-add-song",
        popover: {
          title: "Add a new song",
          description: "Start from scratch: set title, author, language, section, and mood, then paste lyrics and analyze to structure them.",
          side: "bottom",
          align: "end",
        },
        onHighlightStarted: composerStepPrep({ selector: "#btn-composer-add-song" }),
      },
      {
        element: "#song-composer-catalog-wrap",
        popover: {
          title: "Browse the songs library",
          description: "Expand the panel to browse hymns by Mass section. Tap a song to load its lyrics into the editor.",
          side: "bottom",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({
          selector: "#song-composer-catalog-wrap",
          expandLibrary: true,
        }),
      },
      {
        element: "#lyrics-drop-zone",
        popover: {
          title: "Upload a lyrics file",
          description: "Opens a short format guide — copy the Awit Ng Paghahangad example, then choose or drop a .txt / .rtf file (single song or multi-song catalog).",
          side: "bottom",
          align: "end",
        },
        onHighlightStarted: composerStepPrep({
          selector: "#lyrics-drop-zone",
          expandLibrary: true,
        }),
      },
      {
        element: ".song-composer-recent",
        popover: {
          title: "Recent songs",
          description: "Jump back to songs you opened lately. Switch Global vs Parish to see community-wide or your parish’s recent picks.",
          side: "left",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({
          selector: ".song-composer-recent",
          expandLibrary: true,
        }),
      },
      {
        element: "#lyrics-composer-details-preview",
        popover: {
          title: "Song details",
          description: "Title, author, language, and gospel mood show here. Use Edit Details to change them before saving.",
          side: "bottom",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({
          selector: "#lyrics-composer-details-preview",
          deflateLibrary: true,
        }),
      },
      {
        element: "#lyrics-input",
        popover: {
          title: "Edit lyrics",
          description: "Paste or type the full song text. Word and line counts update as you go — this is the raw source Analyze reads.",
          side: "top",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({
          selector: "#lyrics-input",
          deflateLibrary: true,
          showRawPane: true,
          remount: true,
        }),
      },
      {
        element: mobile ? "#lyrics-composer-pane-blocks" : ".lyrics-structured-panel",
        popover: {
          title: "Structure the song",
          description: "Add Verse, Chorus, and other sections, or tap Analyze to detect them. Edit the blocks here — they become lyric slides in your Mass deck.",
          side: "left",
          align: "start",
        },
        onHighlightStarted: composerStepPrep({
          selector: mobile ? "#lyrics-composer-pane-blocks" : ".lyrics-structured-panel",
          deflateLibrary: true,
          showBlocksPane: true,
          remount: true,
        }),
      },
      {
        element: "#btn-save-lyrics",
        popover: {
          title: "Analyze & Save",
          description: "Analyze turns raw lyrics into structured blocks. Save writes the song to your library so Mass Builder can pick it up.",
          side: "top",
          align: "end",
        },
        onHighlightStarted: composerStepPrep({
          selector: "#btn-save-lyrics",
          ensureFloat: true,
          remount: true,
        }),
      },
    ];
  }

  function destroyActiveDriver() {
    if (activeDriver && activeDriver.isActive && activeDriver.isActive()) {
      activeDriver.destroy();
    }
    activeDriver = null;
    activeTourKind = null;
  }

  function runTour(kind, steps, ensureRoute, options) {
    options = options || {};
    var driverFactory = getDriverFactory();
    if (!driverFactory) {
      console.warn("[LiturgyFlowTour] driver.js is not loaded.");
      return Promise.resolve(null);
    }
    destroyActiveDriver();

    return ensureRoute().then(function () {
      var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      var firstPopover = true;
      var lastPopover = null;
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
          lastPopover = popover;
          polishPopover(popover, ctx, firstPopover, idx >= steps.length - 1);
          firstPopover = false;
          schedulePopoverClamp(popover);
          syncHighlightRing();
        },
        onHighlighted: function () {
          syncHighlightRing();
          if (lastPopover) schedulePopoverClamp(lastPopover);
        },
        onDestroyed: function () {
          document.body.classList.remove("lf-tour-active");
          if (popoverClampTimer) {
            clearTimeout(popoverClampTimer);
            popoverClampTimer = 0;
          }
          destroyHighlightRing();
          activeDriver = null;
          activeTourKind = null;
          if (!options.skipMarkComplete) markComplete(kind);
        },
        steps: steps,
      });

      document.body.classList.add("lf-tour-active");
      bindHighlightRingListeners();
      activeTourKind = kind;
      activeDriver = driverObj;
      driverObj.drive();
      return driverObj;
    });
  }

  function startPptxTour(options) {
    return runTour("pptx", buildPptxSteps(), ensureMassBuilderRoute, options);
  }

  function startComposerTour(options) {
    hideComposerTourHint(true);
    markComposerHintSeen();
    return runTour("composer", buildComposerSteps(), ensureComposerRoute, options);
  }

  function startContextualTour(options) {
    var lyricsPage = document.getElementById("lyrics-page");
    if (lyricsPage && lyricsPage.classList.contains("active")) {
      return startComposerTour(options);
    }
    return startPptxTour(options);
  }

  function bindTriggers() {
    // Prefer VerbumLazy early bindings (lazy-assets.js) to avoid double handlers.
    var helpBtn = document.getElementById("btn-mw-tour");
    if (helpBtn && helpBtn.dataset.lfTourBound !== "1") {
      helpBtn.dataset.lfTourBound = "1";
      helpBtn.addEventListener("click", function () {
        startPptxTour();
      });
    }

    var composerBtn = document.getElementById("btn-composer-tour");
    if (composerBtn && composerBtn.dataset.lfTourBound !== "1") {
      composerBtn.dataset.lfTourBound = "1";
      composerBtn.addEventListener("click", function () {
        hideComposerTourHint(true);
        markComposerHintSeen();
        startComposerTour();
      });
    }

    var acctBtn = document.getElementById("account-tour-link");
    if (acctBtn && acctBtn.dataset.lfTourBound !== "1") {
      acctBtn.dataset.lfTourBound = "1";
      acctBtn.addEventListener("click", function (event) {
        event.preventDefault();
        var panel = document.getElementById("account-menu-panel");
        var btn = document.getElementById("account-menu-btn");
        if (panel) panel.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (typeof closeHeaderMenus === "function") closeHeaderMenus();
        startContextualTour();
      });
    }

    var homeLink = document.getElementById("home-mass-tour-link");
    if (homeLink && homeLink.dataset.lfTourBound !== "1") {
      homeLink.dataset.lfTourBound = "1";
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

  function watchComposerRoute() {
    var lyricsPage = document.getElementById("lyrics-page");
    if (!lyricsPage) return;
    var observer = new MutationObserver(function () {
      if (lyricsPage.classList.contains("active")) maybeShowComposerTourHint();
    });
    observer.observe(lyricsPage, { attributes: true, attributeFilter: ["class"] });
    if (lyricsPage.classList.contains("active")) maybeShowComposerTourHint();
  }

  function init() {
    bindTriggers();
    if (shouldAutoStart()) {
      autoStartPending = true;
      watchBuilderRoute();
    }
    if (shouldShowComposerHint()) {
      composerHintPending = true;
      watchComposerRoute();
    }
  }

  window.LiturgyFlowTour = {
    __fullyLoaded: true,
    startPptxTour: startPptxTour,
    startComposerTour: startComposerTour,
    startContextualTour: startContextualTour,
    markComplete: markComplete,
    hasCompletedTour: hasCompletedTour,
    shouldAutoStart: shouldAutoStart,
    shouldAutoStartComposer: shouldAutoStartComposer,
    shouldShowComposerHint: shouldShowComposerHint,
    STORAGE_KEY: STORAGE_KEY,
    STORAGE_KEY_COMPOSER: STORAGE_KEY_COMPOSER,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
