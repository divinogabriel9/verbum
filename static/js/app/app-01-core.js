/* Verbum SPA part 1/9: app-01-core.js
 * Chrome, readings helpers, API utils, early mass/song wiring
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 1-3498
 */
    var $ = (id) => document.getElementById(id);

    function syncAppHeaderOffset() {
      const header = $("app-header");
      if (!header) return;
      const height = Math.ceil(header.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty("--app-header-offset", height + "px");
      }
    }

    function initAppHeaderOffset() {
      const header = $("app-header");
      if (!header || header.dataset.offsetBound === "1") return;
      header.dataset.offsetBound = "1";
      syncAppHeaderOffset();
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => syncAppHeaderOffset()).observe(header);
      }
      window.addEventListener("resize", syncAppHeaderOffset, { passive: true });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncAppHeaderOffset);
      }
    }
    initAppHeaderOffset();

    var mobileChromeRestore = { inited: false, litBefore: null, notifBefore: null, tickerNext: null, createParent: null, navParent: null, navNext: null };

    function isMobileChromeLayout() {
      return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    }

    function initMobileChromeRestore() {
      if (mobileChromeRestore.inited) return;
      mobileChromeRestore.inited = true;
      const notif = document.querySelector(".notif-wrap");
      const themeBtn = $("theme-toggle-btn");
      const main = document.querySelector(".app-header__main");
      const createParent = document.querySelector(".app-sidebar__create");
      const nav = $("app-bottom-nav");
      if (notif) mobileChromeRestore.litBefore = notif;
      if (themeBtn) mobileChromeRestore.notifBefore = themeBtn;
      if (main) mobileChromeRestore.tickerNext = main.querySelector(".app-header__utilities");
      if (createParent) mobileChromeRestore.createParent = createParent;
      if (nav) {
        mobileChromeRestore.navParent = nav.parentElement;
        mobileChromeRestore.navNext = nav.nextElementSibling;
      }
    }

    function restoreHeaderChipChild(wrap, beforeEl) {
      const chips = document.querySelector(".header-chips-wrap");
      if (!wrap || !chips) return;
      if (beforeEl && beforeEl.parentElement === chips) {
        chips.insertBefore(wrap, beforeEl);
      } else {
        chips.appendChild(wrap);
      }
    }

    function syncMobileChromeLayout() {
      initMobileChromeRestore();
      const mobile = isMobileChromeLayout();
      document.body.classList.toggle("mobile-chrome-tabs", mobile);
      document.body.classList.toggle("mobile-top-nav", mobile);

      const menuBtn = $("app-header-menu-btn");
      if (menuBtn) menuBtn.hidden = !mobile;

      const litWrap = document.querySelector(".liturgical-indicator-wrap");
      const notifWrap = document.querySelector(".notif-wrap");
      const accountWrap = document.querySelector(".account-menu-wrap");
      const createWrap = document.querySelector(".create-menu-wrap--sidebar");
      const litHost = $("today-liturgical-host");
      const notifHost = $("today-notif-host");
      const accountHost = $("app-mobile-menu-account-host");
      const headerCreateHost = $("header-create-host");
      const bottomCreateHost = $("bottom-nav-create-host");
      const litPanel = $("liturgical-indicator-panel");
      const notifPanel = $("notif-panel");
      const accountPanel = $("account-menu-panel");
      const ticker = $("app-header-ticker");
      const tickerRow = $("app-header-ticker-row");
      const navRow = $("app-header-nav-row");
      const nav = $("app-bottom-nav");
      const main = document.querySelector(".app-header__main");

      if (mobile) {
        if (litWrap && litHost) litHost.appendChild(litWrap);
        if (notifWrap && notifHost) notifHost.appendChild(notifWrap);
        if (accountWrap && accountHost) accountHost.appendChild(accountWrap);
        if (createWrap && headerCreateHost) {
          createWrap.classList.add("create-menu-wrap--header");
          createWrap.classList.remove("create-menu-wrap--bottom-nav");
          headerCreateHost.appendChild(createWrap);
        }
        if (bottomCreateHost) {
          bottomCreateHost.hidden = true;
          bottomCreateHost.setAttribute("aria-hidden", "true");
        }
        if (litPanel) {
          litPanel.hidden = false;
          litPanel.classList.add("today-page-panel");
        }
        if (notifPanel) {
          notifPanel.hidden = false;
          notifPanel.classList.add("today-page-panel");
        }
        if (accountPanel) {
          accountPanel.hidden = false;
          accountPanel.classList.add("mobile-menu-account-panel");
        }
        if (ticker && tickerRow) {
          tickerRow.appendChild(ticker);
          tickerRow.hidden = false;
          tickerRow.setAttribute("aria-hidden", "false");
        }
        if (nav && navRow) {
          navRow.appendChild(nav);
          navRow.hidden = false;
          navRow.removeAttribute("hidden");
          navRow.setAttribute("aria-hidden", "false");
          navRow.style.display = "block";
          nav.hidden = false;
          nav.style.display = "flex";
        }
        if (typeof applyMobileNavOrder === "function") applyMobileNavOrder();
        if (typeof closeHeaderMenus === "function") closeHeaderMenus();
        if (typeof closeMobileMenu === "function") closeMobileMenu();
        if (normalizeRoute(currentRoute()) === "/notifications" && typeof updateLiturgicalCountdowns === "function") {
          updateLiturgicalCountdowns();
        }
        if (typeof syncNotificationsAccordionHeader === "function") syncNotificationsAccordionHeader();
      } else {
        restoreHeaderChipChild(litWrap, mobileChromeRestore.litBefore);
        restoreHeaderChipChild(notifWrap, mobileChromeRestore.notifBefore);
        restoreHeaderChipChild(accountWrap, null);
        if (createWrap && mobileChromeRestore.createParent) {
          createWrap.classList.remove("create-menu-wrap--bottom-nav", "create-menu-wrap--header");
          mobileChromeRestore.createParent.appendChild(createWrap);
        }
        if (bottomCreateHost) {
          bottomCreateHost.hidden = true;
          bottomCreateHost.setAttribute("aria-hidden", "true");
        }
        if (litPanel) {
          litPanel.hidden = true;
          litPanel.classList.remove("today-page-panel");
        }
        if (notifPanel) {
          notifPanel.hidden = true;
          notifPanel.classList.remove("today-page-panel");
        }
        if (accountPanel) {
          accountPanel.hidden = true;
          accountPanel.classList.remove("mobile-menu-account-panel");
        }
        if (ticker && main && mobileChromeRestore.tickerNext) {
          main.insertBefore(ticker, mobileChromeRestore.tickerNext);
        }
        if (tickerRow) {
          tickerRow.hidden = true;
          tickerRow.setAttribute("aria-hidden", "true");
        }
        if (nav && mobileChromeRestore.navParent) {
          if (mobileChromeRestore.navNext && mobileChromeRestore.navNext.parentElement === mobileChromeRestore.navParent) {
            mobileChromeRestore.navParent.insertBefore(nav, mobileChromeRestore.navNext);
          } else {
            mobileChromeRestore.navParent.appendChild(nav);
          }
        }
        if (navRow) {
          navRow.hidden = true;
          navRow.setAttribute("aria-hidden", "true");
          navRow.style.display = "";
        }
        if (nav) nav.style.display = "";
        if (typeof closeMobileMenu === "function") closeMobileMenu();
      }
      syncAppHeaderOffset();
    }

    function syncNotificationsAccordionHeader() {
      const season = $("home-liturgical-season");
      const year = $("home-liturgical-year");
      const seasonEl = $("notifications-accordion-season");
      const yearEl = $("notifications-accordion-year");
      if (season && seasonEl) seasonEl.textContent = season.textContent || "Ordinary Time";
      if (year && yearEl) yearEl.textContent = year.textContent || "";
    }

    function initNotificationsAccordions() {
      const liturgyAcc = $("notifications-liturgy-accordion");
      if (liturgyAcc && liturgyAcc.dataset.bound !== "1") {
        liturgyAcc.dataset.bound = "1";
        liturgyAcc.addEventListener("toggle", () => {
          if (liturgyAcc.open && typeof updateLiturgicalCountdowns === "function") {
            updateLiturgicalCountdowns();
          }
        });
      }
      syncNotificationsAccordionHeader();
    }

    function initMobileChromeLayout() {
      syncMobileChromeLayout();
      window.addEventListener("resize", () => {
        syncMobileChromeLayout();
        if (typeof applyNavTabVisibility === "function") applyNavTabVisibility();
      }, { passive: true });
    }

    var MOBILE_NAV_ORDER_KEY = "verbumMobileNavOrder";
    var MOBILE_NAV_DEFAULT_ORDER = ["/home", "/mass/builder", "/library/songs", "/notifications"];
    var MOBILE_NAV_LOCKED = new Set(["/home", "/mass/builder", "/library/songs"]);
    var mobileNavDragBound = false;
    var mobileNavDragState = null;

    function shortMobileNavLabel(text) {
      const t = String(text || "").trim();
      const map = {
        "Mass setup": "Mass",
        "Lyrics Library": "Library",
        "Notifications": "Alerts",
        "Liturgical Calendar": "Calendar",
        "Theme Lab": "Design",
        "Live Radio": "Media",
      };
      if (map[t]) return map[t];
      if (t.length > 10) return t.split(/\s+/)[0];
      return t || "Tab";
    }

    function getMobileNavOrder() {
      try {
        const raw = localStorage.getItem(MOBILE_NAV_ORDER_KEY);
        if (!raw) return MOBILE_NAV_DEFAULT_ORDER.slice();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length) return MOBILE_NAV_DEFAULT_ORDER.slice();
        const cleaned = parsed.map((r) => normalizeRoute(String(r || ""))).filter(Boolean);
        const seen = new Set();
        const out = [];
        cleaned.forEach((r) => {
          if (seen.has(r)) return;
          seen.add(r);
          out.push(r);
        });
        // Locked tabs always remain somewhere in the bar
        [...MOBILE_NAV_LOCKED].reverse().forEach((r) => {
          if (!seen.has(r)) {
            out.unshift(r);
            seen.add(r);
          }
        });
        return out;
      } catch (_e) {
        return MOBILE_NAV_DEFAULT_ORDER.slice();
      }
    }

    function saveMobileNavOrder(order) {
      try {
        localStorage.setItem(MOBILE_NAV_ORDER_KEY, JSON.stringify(order));
      } catch (_e) { /* ignore */ }
    }

    function findNavLinkSource(route) {
      const nav = $("app-bottom-nav");
      const r = normalizeRoute(route);
      if (nav) {
        const existing = Array.from(nav.querySelectorAll(".nav-link")).find((el) => normalizeRoute(el.getAttribute("href") || el.dataset.route || "") === r);
        if (existing) return existing;
      }
      const menu = $("app-mobile-menu-pages");
      if (menu) {
        const fromMenu = Array.from(menu.querySelectorAll(".app-mobile-menu__link")).find((el) => normalizeRoute(el.getAttribute("href") || el.dataset.route || "") === r);
        if (fromMenu) return fromMenu;
      }
      const side = document.querySelector(".app-sidebar__nav");
      if (side) {
        const fromSide = Array.from(side.querySelectorAll(".app-sidebar__link")).find((el) => normalizeRoute(el.getAttribute("href") || el.dataset.route || "") === r);
        if (fromSide) return fromSide;
      }
      return null;
    }

    function buildPinnedNavLink(sourceEl, route) {
      const r = normalizeRoute(route || sourceEl.getAttribute("href") || sourceEl.dataset.route || "");
      const a = document.createElement("a");
      a.className = "nav-link nav-link--pinned nav-link--mobile-only";
      a.href = r;
      a.dataset.route = r;
      const tab = sourceEl.dataset.navTab || (typeof routeToNavTabId === "function" ? routeToNavTabId(r) : "") || "";
      if (tab) a.dataset.navTab = tab;
      if (sourceEl.dataset.routePrefix) a.dataset.routePrefix = sourceEl.dataset.routePrefix;
      if (sourceEl.dataset.routeExclude) a.dataset.routeExclude = sourceEl.dataset.routeExclude;
      const icon = sourceEl.querySelector("svg");
      if (icon) {
        const svg = icon.cloneNode(true);
        svg.removeAttribute("class");
        svg.classList.add("nav-icon", "app-bottom-nav__svg-icon");
        a.appendChild(svg);
      }
      const label = document.createElement("span");
      label.className = "nav-label";
      const rawLabel = (sourceEl.querySelector(".nav-label, span:not([class])") || sourceEl).textContent || "";
      label.textContent = shortMobileNavLabel(rawLabel.replace(/\s+/g, " ").trim());
      a.appendChild(label);
      return a;
    }

    function ensureMobileNavLink(route) {
      const nav = $("app-bottom-nav");
      if (!nav) return null;
      const r = normalizeRoute(route);
      let link = Array.from(nav.querySelectorAll(".nav-link")).find((el) => normalizeRoute(el.getAttribute("href") || el.dataset.route || "") === r);
      if (link) return link;
      const source = findNavLinkSource(r);
      if (!source) return null;
      link = buildPinnedNavLink(source, r);
      nav.appendChild(link);
      return link;
    }

    function applyMobileNavOrder() {
      const nav = $("app-bottom-nav");
      if (!nav || !isMobileChromeLayout()) return;
      const createSlot = $("bottom-nav-create-host");
      if (createSlot) {
        createSlot.hidden = true;
        createSlot.setAttribute("aria-hidden", "true");
      }
      let order = getMobileNavOrder().filter((route) => {
        const tabId = typeof routeToNavTabId === "function" ? routeToNavTabId(route) : null;
        if (tabId === "notifications") return true;
        if (MOBILE_NAV_LOCKED.has(route)) return true;
        // Pinned Extras routes stay in the bar even if optional desktop tabs are off
        if (typeof isDrawerNavRoute === "function" && isDrawerNavRoute(route)) return true;
        if (tabId && typeof isNavTabVisible === "function" && !isNavTabVisible(tabId)) {
          return false;
        }
        return true;
      });
      if (!order.length) order = MOBILE_NAV_DEFAULT_ORDER.slice();
      const links = [];
      order.forEach((route) => {
        const link = ensureMobileNavLink(route);
        if (link) links.push(link);
      });
      const kept = new Set(links);
      Array.from(nav.querySelectorAll(".nav-link")).forEach((el) => {
        if (!kept.has(el)) {
          if (el.classList.contains("nav-link--pinned")) el.remove();
          else el.hidden = true;
        }
      });
      links.forEach((link) => {
        link.hidden = false;
        nav.appendChild(link);
      });
      if (createSlot) nav.appendChild(createSlot);
      saveMobileNavOrder(links.map((el) => normalizeRoute(el.getAttribute("href") || el.dataset.route || "")).filter(Boolean));
      syncAppHeaderOffset();
    }

    function insertMobileNavRoute(route, beforeRoute) {
      const r = normalizeRoute(route);
      if (!r) return;
      let order = getMobileNavOrder().filter((x) => x !== r);
      if (beforeRoute) {
        const idx = order.indexOf(normalizeRoute(beforeRoute));
        if (idx >= 0) order.splice(idx, 0, r);
        else order.push(r);
      } else {
        order.push(r);
      }
      saveMobileNavOrder(order);
      applyMobileNavOrder();
    }

    function reorderMobileNavRoute(route, beforeRoute) {
      insertMobileNavRoute(route, beforeRoute);
    }

    function removeMobileNavRoute(route) {
      const r = normalizeRoute(route);
      if (MOBILE_NAV_LOCKED.has(r)) return false;
      const order = getMobileNavOrder().filter((x) => x !== r);
      saveMobileNavOrder(order);
      applyMobileNavOrder();
      return true;
    }

    function mobileNavDropBeforeRoute(clientX) {
      const nav = $("app-bottom-nav");
      if (!nav) return null;
      const links = Array.from(nav.querySelectorAll(".nav-link:not([hidden])"));
      for (const link of links) {
        const rect = link.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (clientX < mid) return normalizeRoute(link.getAttribute("href") || link.dataset.route || "");
      }
      return null;
    }

    function clearMobileNavDragUI() {
      document.body.classList.remove("mobile-nav-dragging");
      document.querySelectorAll(".nav-link.is-drag-source, .nav-link.is-drop-target, .app-mobile-menu__link.is-drag-source").forEach((el) => {
        el.classList.remove("is-drag-source", "is-drop-target");
      });
      const ghost = $("mobile-nav-drag-ghost");
      if (ghost) ghost.remove();
      mobileNavDragState = null;
    }

    function initMobileNavDragDrop() {
      if (mobileNavDragBound) return;
      mobileNavDragBound = true;
      const PRESS_MS = 240;
      const MOVE_PX = 10;

      function routeOf(el) {
        return normalizeRoute(el.getAttribute("href") || el.dataset.route || "");
      }

      function startGhost(el, x, y) {
        let ghost = $("mobile-nav-drag-ghost");
        if (!ghost) {
          ghost = document.createElement("div");
          ghost.id = "mobile-nav-drag-ghost";
          ghost.className = "mobile-nav-drag-ghost";
          document.body.appendChild(ghost);
        }
        const label = (el.querySelector(".nav-label, span") || el).textContent.trim();
        ghost.textContent = shortMobileNavLabel(label);
        ghost.style.left = x + "px";
        ghost.style.top = y + "px";
        ghost.hidden = false;
      }

      function moveGhost(x, y) {
        const ghost = $("mobile-nav-drag-ghost");
        if (!ghost) return;
        ghost.style.left = x + "px";
        ghost.style.top = y + "px";
      }

      function beginDrag(el, fromMenu, pointerId, x, y) {
        const route = routeOf(el);
        if (!route) return;
        mobileNavDragState = { el, fromMenu, route, pointerId, started: true, startX: x, startY: y, moved: false };
        document.body.classList.add("mobile-nav-dragging");
        el.classList.add("is-drag-source");
        if (fromMenu && typeof closeMobileMenu === "function") closeMobileMenu();
        startGhost(el, x, y);
        try { el.setPointerCapture(pointerId); } catch (_e) { /* ignore */ }
      }

      function onPointerDown(e) {
        if (!isMobileChromeLayout() || e.button != null && e.button !== 0) return;
        const menuLink = e.target.closest("#app-mobile-menu-pages .app-mobile-menu__link");
        const navLink = e.target.closest("#app-bottom-nav .nav-link");
        const el = menuLink || navLink;
        if (!el) return;
        const fromMenu = !!menuLink;
        const startX = e.clientX;
        const startY = e.clientY;
        const pointerId = e.pointerId;
        let armed = false;
        let cancelled = false;
        const timer = setTimeout(() => {
          if (cancelled) return;
          armed = true;
          beginDrag(el, fromMenu, pointerId, startX, startY);
        }, PRESS_MS);

        const onMove = (ev) => {
          if (ev.pointerId !== pointerId) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!armed && (Math.abs(dx) > MOVE_PX || Math.abs(dy) > MOVE_PX)) {
            cancelled = true;
            clearTimeout(timer);
            cleanup();
            return;
          }
          if (!mobileNavDragState || !mobileNavDragState.started) return;
          ev.preventDefault();
          mobileNavDragState.moved = true;
          moveGhost(ev.clientX, ev.clientY);
          const before = mobileNavDropBeforeRoute(ev.clientX);
          document.querySelectorAll("#app-bottom-nav .nav-link.is-drop-target").forEach((n) => n.classList.remove("is-drop-target"));
          if (before) {
            const target = Array.from(document.querySelectorAll("#app-bottom-nav .nav-link:not([hidden])")).find((n) => routeOf(n) === before);
            if (target) target.classList.add("is-drop-target");
          }
          const nav = $("app-bottom-nav");
          if (nav) {
            const rect = nav.getBoundingClientRect();
            const overNav = ev.clientY >= rect.top - 8 && ev.clientY <= rect.bottom + 24;
            nav.classList.toggle("is-drop-hover", overNav);
          }
        };

        const onUp = (ev) => {
          if (ev.pointerId !== pointerId) return;
          clearTimeout(timer);
          if (mobileNavDragState && mobileNavDragState.started) {
            ev.preventDefault();
            const nav = $("app-bottom-nav");
            const rect = nav ? nav.getBoundingClientRect() : null;
            const overNav = !!(rect && ev.clientY >= rect.top - 12 && ev.clientY <= rect.bottom + 36);
            const before = mobileNavDropBeforeRoute(ev.clientX);
            const route = mobileNavDragState.route;
            const fromMenu = mobileNavDragState.fromMenu;
            const moved = !!mobileNavDragState.moved;
            const dy = Math.abs(ev.clientY - (mobileNavDragState.startY || 0));
            clearMobileNavDragUI();
            if (nav) nav.classList.remove("is-drop-hover");
            if (overNav && moved) {
              reorderMobileNavRoute(route, before);
            } else if (!fromMenu && moved && !overNav && dy > 56) {
              removeMobileNavRoute(route);
            }
            if (moved) {
              const blockClick = (clickEv) => {
                clickEv.preventDefault();
                clickEv.stopPropagation();
                document.removeEventListener("click", blockClick, true);
              };
              document.addEventListener("click", blockClick, true);
            }
          }
          cleanup();
        };

        const cleanup = () => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          window.removeEventListener("pointercancel", onUp, true);
        };

        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
        window.addEventListener("pointercancel", onUp, true);
      }

      document.addEventListener("pointerdown", onPointerDown, true);
    }
    var escapeHtml = (value) => {
      const div = document.createElement("div");
      div.textContent = String(value || "");
      return div.innerHTML;
    };
    var formatDateInput = (date) => {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return "";
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    var PRACTICE_DEVICE_STORE_KEY = "lf-practice-device-id";
    function getPracticeDeviceId() {
      try {
        let id = String(localStorage.getItem(PRACTICE_DEVICE_STORE_KEY) || "").trim();
        if (id.length >= 16) return id;
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          id = window.crypto.randomUUID().replace(/-/g, "") + window.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
        } else {
          id = "d" + String(Date.now()) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        }
        id = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
        localStorage.setItem(PRACTICE_DEVICE_STORE_KEY, id);
        return id;
      } catch (_e) {
        return "";
      }
    }
    function practiceDeviceHeaders() {
      const deviceId = getPracticeDeviceId();
      return deviceId ? { "X-Practice-Device-Id": deviceId } : {};
    }
    window.getPracticeDeviceId = getPracticeDeviceId;
    window.practiceDeviceHeaders = practiceDeviceHeaders;

    var postJSON = async (url, body, opts) => {
      const skipAuthWait = !!(opts && opts.skipAuthWait);
      if (!skipAuthWait && window.VerbumAuth && window.VerbumAuth.waitUntilReady) {
        await window.VerbumAuth.waitUntilReady();
      }
      const headers = { "Content-Type": "application/json" };
      if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
      }
      if (String(url || "").indexOf("/api/practice/") === 0) {
        const deviceHdrs = (typeof practiceDeviceHeaders === "function"
          ? practiceDeviceHeaders
          : window.practiceDeviceHeaders);
        if (typeof deviceHdrs === "function") Object.assign(headers, deviceHdrs());
      }
      if (opts && opts.headers) Object.assign(headers, opts.headers);
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          res.status === 401 &&
          window.VerbumAuth &&
          window.VerbumAuth.isReady &&
          window.VerbumAuth.isReady() &&
          window.VerbumAuth.redirectToSignIn
        ) {
          window.VerbumAuth.redirectToSignIn();
        }
        const message = data.detail || data.error || res.statusText;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      return data;
    };

    var getJSON = async (url, opts) => {
      const skipAuthWait = !!(opts && opts.skipAuthWait);
      if (!skipAuthWait && window.VerbumAuth && window.VerbumAuth.waitUntilReady) {
        await window.VerbumAuth.waitUntilReady();
      }
      const headers = {};
      if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
      }
      if (opts && opts.headers) Object.assign(headers, opts.headers);
      const res = await fetch(url, { method: "GET", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.detail || data.error || res.statusText;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      return data;
    };

    var previewCache = new Map();
    var previewInflight = new Map();
    var readingsInflight = new Map();
    var READINGS_LS_PREFIX = "verbumReadings:";
    var READINGS_POLL_INTERVAL_MS = 4000;
    var READINGS_POLL_MAX_ATTEMPTS = 18;
    var readingsPollers = new Map();

    function currentMassLanguage() {
      const sel = $("flow-mass-language");
      return sel && sel.value === "tagalog" ? "tagalog" : "english";
    }

    function currentCalendarLanguage() {
      const sel = $("cal-language");
      return sel && sel.value === "tagalog" ? "tagalog" : "english";
    }

    function resolveReadingsLanguage(opts) {
      if (opts && (opts.language === "tagalog" || opts.language === "english")) {
        return opts.language;
      }
      return currentMassLanguage();
    }

    function previewCacheKey(date, readingsOnly, language) {
      const lang = language || currentMassLanguage();
      return (
        String(date || "").trim() +
        "|" +
        lang +
        "|" +
        (readingsOnly ? "readings" : "full")
      );
    }

    /* Don't trust or persist a readings payload that is missing the first reading
       or gospel — prevents a stale/incomplete cache from sticking for 7 days. */
    function readingsPayloadComplete(data) {
      if (!data || data.ok === false) return false;
      if (data.readings_complete === true) return true;
      if (data.readings_complete === false) return false;
      const frRef = String(data.first_reading_reference || "").trim();
      const frBody = String(data.first_reading_excerpt || data.first_reading_text || "").trim();
      const gospel = String(data.gospel_text || data.gospel_quote || data.gospel_reference || "").trim();
      const psalmRefrains = Array.isArray(data.psalm_refrains) ? data.psalm_refrains.filter(Boolean) : [];
      const psalm = String(data.psalm_text || data.psalm_verses || "").trim();
      return !!(frRef && frBody && gospel && (psalmRefrains.length || psalm));
    }

    function stopReadingsPoll(date, language) {
      const d = String(date || "").trim();
      if (!d) return;
      if (language) {
        const state = readingsPollers.get(language + ":" + d);
        if (!state) return;
        if (state.timer) clearTimeout(state.timer);
        readingsPollers.delete(language + ":" + d);
        return;
      }
      // Stop both language pollers for this date when language not specified.
      ["english", "tagalog"].forEach((lang) => {
        const state = readingsPollers.get(lang + ":" + d);
        if (!state) return;
        if (state.timer) clearTimeout(state.timer);
        readingsPollers.delete(lang + ":" + d);
      });
      // Legacy key (pre-language) if any.
      const legacy = readingsPollers.get(d);
      if (legacy) {
        if (legacy.timer) clearTimeout(legacy.timer);
        readingsPollers.delete(d);
      }
    }

    function startReadingsPoll(date, onUpdate, language) {
      const d = String(date || "").trim();
      if (!d) return;
      const lang = language || currentMassLanguage();
      const pollKey = lang + ":" + d;
      const existing = readingsPollers.get(pollKey);
      if (existing) {
        if (typeof onUpdate === "function") existing.listeners.add(onUpdate);
        return;
      }
      const state = { timer: null, attempts: 0, listeners: new Set(), language: lang };
      if (typeof onUpdate === "function") state.listeners.add(onUpdate);
      readingsPollers.set(pollKey, state);

      const notify = (data) => {
        state.listeners.forEach((fn) => {
          try { fn(data); } catch (_e) { /* ignore */ }
        });
      };

      const tick = async () => {
        const active = readingsPollers.get(pollKey);
        if (!active || active !== state) return;
        state.attempts += 1;
        try {
          const data = await fetchReadings(d, { forceRefresh: true, language: lang });
          previewCache.set(previewCacheKey(d, true, lang), data);
          if (readingsPayloadComplete(data)) writeStoredReadings(d, data, lang);
          notify(data);
          if (readingsPayloadComplete(data)) {
            stopReadingsPoll(d, lang);
            return;
          }
        } catch (_e) { /* keep polling */ }
        if (state.attempts >= READINGS_POLL_MAX_ATTEMPTS) {
          stopReadingsPoll(d, lang);
          return;
        }
        state.timer = setTimeout(tick, READINGS_POLL_INTERVAL_MS);
      };

      state.timer = setTimeout(tick, READINGS_POLL_INTERVAL_MS);
    }

    async function ensureReadingsComplete(date, opts) {
      const d = String(date || "").trim();
      const onUpdate = opts && opts.onUpdate;
      const lang = resolveReadingsLanguage(opts);
      const data = await fetchReadings(d, Object.assign({}, opts || {}, { language: lang }));
      if (typeof onUpdate === "function") onUpdate(data);
      if (readingsPayloadComplete(data)) return data;
      startReadingsPoll(d, onUpdate, lang);
      return data;
    }

    function readStoredReadings(date, language) {
      try {
        const lang = language || currentMassLanguage();
        const raw = localStorage.getItem(
          READINGS_LS_PREFIX + lang + ":" + String(date || "").trim()
        );
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.data || !parsed.ts) return null;
        if (Date.now() - parsed.ts > 7 * 86400000) return null;
        return parsed.data;
      } catch (_e) {
        return null;
      }
    }

    function writeStoredReadings(date, data, language) {
      try {
        const lang = language || currentMassLanguage();
        localStorage.setItem(
          READINGS_LS_PREFIX + lang + ":" + String(date || "").trim(),
          JSON.stringify({ ts: Date.now(), data })
        );
      } catch (_e) { /* quota */ }
    }

    async function fetchReadings(date, opts) {
      const d = String(date || "").trim();
      const forceRefresh = !!(opts && opts.forceRefresh);
      const lang = resolveReadingsLanguage(opts);
      if (!d) throw new Error("Date required");
      // Permanently use Mass Setup's POST /api/preview path so home, calendar,
      // and setup share one payload (same psalm refrain / gospel sentences).
      const fullKey = previewCacheKey(d, false, lang);
      const readKey = previewCacheKey(d, true, lang);
      if (!forceRefresh && previewCache.has(fullKey)) {
        const cached = previewCache.get(fullKey);
        if (readingsPayloadComplete(cached)) {
          previewCache.set(readKey, cached);
          return cached;
        }
      }
      if (!forceRefresh && previewCache.has(readKey)) {
        const cached = previewCache.get(readKey);
        if (readingsPayloadComplete(cached)) return cached;
      }
      if (!forceRefresh) {
        const stored = readStoredReadings(d, lang);
        if (stored && readingsPayloadComplete(stored)) {
          previewCache.set(readKey, stored);
          previewCache.set(fullKey, stored);
          return stored;
        }
      }
      const inflightKey = (forceRefresh ? "refresh:" : "") + lang + ":" + d;
      if (readingsInflight.has(inflightKey)) return readingsInflight.get(inflightKey);
      const req = fetchPreview(d, { readingsOnly: false, forceRefresh, language: lang })
        .then((data) => {
          previewCache.set(readKey, data);
          previewCache.set(fullKey, data);
          if (readingsPayloadComplete(data)) writeStoredReadings(d, data, lang);
          return data;
        })
        .finally(() => {
          readingsInflight.delete(inflightKey);
        });
      readingsInflight.set(inflightKey, req);
      return req;
    }

    async function fetchPreview(date, opts) {
      const readingsOnly = !!(opts && opts.readingsOnly);
      const forceRefresh = !!(opts && opts.forceRefresh);
      const lang = resolveReadingsLanguage(opts);
      const d = String(date || "").trim();
      if (!d) throw new Error("Date required");
      const fullKey = previewCacheKey(d, false, lang);
      const readKey = previewCacheKey(d, true, lang);
      if (!forceRefresh && !readingsOnly && previewCache.has(fullKey)) {
        const cached = previewCache.get(fullKey);
        if (readingsPayloadComplete(cached)) return previewCache.get(fullKey);
      }
      if (!forceRefresh && readingsOnly && previewCache.has(readKey)) {
        const cached = previewCache.get(readKey);
        if (readingsPayloadComplete(cached)) return cached;
      }
      if (!forceRefresh && readingsOnly && previewCache.has(fullKey)) {
        const cached = previewCache.get(fullKey);
        if (readingsPayloadComplete(cached)) return cached;
      }
      const key = (forceRefresh ? "refresh:" : "") + (readingsOnly ? readKey : fullKey);
      if (previewInflight.has(key)) return previewInflight.get(key);
      const req = postJSON("/api/preview", {
        date: d,
        readings_only: readingsOnly,
        refresh: forceRefresh,
        mass_language: lang,
      })
        .then((data) => {
          previewCache.set(readingsOnly ? readKey : fullKey, data);
          if (!readingsOnly) previewCache.set(fullKey, data);
          previewInflight.delete(key);
          return data;
        })
        .catch((err) => {
          previewInflight.delete(key);
          throw err;
        });
      previewInflight.set(key, req);
      return req;
    }

    /** Skip member-only API calls when auth is enabled but the user is not signed in yet. */
    function memberApiAvailable() {
      const auth = window.VerbumAuth;
      if (!auth) return true;
      const cfg = auth.getConfig ? auth.getConfig() : null;
      if (!cfg || !cfg.auth_enabled) return true;
      if (auth.isReady && !auth.isReady()) return false;
      if (auth.getUser && !auth.getUser()) return false;
      return true;
    }

    /** Programmatic file download (works for private /api/files and signed storage URLs). */
    function isPrivateFileUrl(url) {
      return typeof url === "string" && url.startsWith("/api/files/");
    }

    async function authorizedFetch(url, opts) {
      const options = opts || {};
      const headers = Object.assign({}, options.headers || {});
      if (isPrivateFileUrl(url) && window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
      }
      return fetch(url, Object.assign({}, options, { headers }));
    }

    async function triggerBrowserDownload(url, filename) {
      if (!url) return;
      const res = await authorizedFetch(url);
      if (!res.ok) throw new Error("Could not download file.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename || "download";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    document.addEventListener("click", (e) => {
      const anchor = e.target.closest("a[href^='/api/files/']");
      if (!anchor) return;
      e.preventDefault();
      const url = anchor.getAttribute("href");
      const name = anchor.getAttribute("download") || anchor.textContent.trim() || "download";
      triggerBrowserDownload(url, name).catch(() => {
        notify("Could not download file. Sign in and try again.", "error");
      });
    });

    var THEME_STORAGE_KEY = "verbumColorTheme";
    var TOGGLE_DARK_STORAGE_KEY = "verbumToggleDarkMode";
    var ACCENT_STORAGE_KEY = "verbumAccentColor";
    var HOME_NEWS_ENABLED_KEY = "verbumHomeNewsEnabled";
    var HOME_NEWS_VATICAN_KEY = "verbumHomeNewsVatican";
    var HOME_NEWS_CNA_KEY = "verbumHomeNewsCna";
    var NAV_TABS_ENABLED_KEY = "verbumNavTabsEnabled";
    var NAV_TABS_HIDDEN_KEY = "verbumNavTabsHidden"; // legacy — migrated on read
    var NAV_TAB_DEFS = [
      { id: "home", label: "Home", required: true },
      { id: "mass", label: "Mass", required: true },
      { id: "library", label: "Lyrics Library", required: true },
      { id: "radio", label: "Media", required: true },
      { id: "media", label: "Posters" },
      { id: "calendar", label: "Calendar" },
      { id: "design", label: "Design" },
    ];

    function getOptionalNavTabIds() {
      return NAV_TAB_DEFS.filter((def) => !def.required).map((def) => def.id);
    }

    function migrateNavTabPrefs() {
      try {
        if (localStorage.getItem(NAV_TABS_ENABLED_KEY) !== null) return;
        const optional = getOptionalNavTabIds();
        const raw = localStorage.getItem(NAV_TABS_HIDDEN_KEY);
        if (raw === null) {
          localStorage.setItem(NAV_TABS_ENABLED_KEY, "[]");
          return;
        }
        const hidden = JSON.parse(raw);
        if (!Array.isArray(hidden)) {
          localStorage.setItem(NAV_TABS_ENABLED_KEY, "[]");
          return;
        }
        const hiddenSet = new Set(hidden.filter((id) => optional.includes(id)));
        localStorage.setItem(
          NAV_TABS_ENABLED_KEY,
          JSON.stringify(optional.filter((id) => !hiddenSet.has(id)))
        );
      } catch (_e) { /* ignore */ }
    }

    function getHomeNewsPrefs() {
      const readBool = (key, defaultOn) => {
        try {
          const v = localStorage.getItem(key);
          if (v === null) return defaultOn;
          return v === "1" || v === "true";
        } catch (_e) {
          return defaultOn;
        }
      };
      return {
        enabled: readBool(HOME_NEWS_ENABLED_KEY, true),
        vatican: readBool(HOME_NEWS_VATICAN_KEY, true),
        cna: readBool(HOME_NEWS_CNA_KEY, true),
      };
    }

    function saveHomeNewsPrefs(prefs) {
      try {
        localStorage.setItem(HOME_NEWS_ENABLED_KEY, prefs.enabled ? "1" : "0");
        localStorage.setItem(HOME_NEWS_VATICAN_KEY, prefs.vatican ? "1" : "0");
        localStorage.setItem(HOME_NEWS_CNA_KEY, prefs.cna ? "1" : "0");
      } catch (_e) { /* ignore */ }
    }

    function syncHomeNewsSettingsUI() {
      const prefs = getHomeNewsPrefs();
      const en = $("settings-home-news-enabled");
      const va = $("settings-home-news-vatican");
      const cna = $("settings-home-news-cna");
      if (en) en.checked = prefs.enabled;
      if (va) {
        va.checked = prefs.vatican;
        va.disabled = !prefs.enabled;
      }
      if (cna) {
        cna.checked = prefs.cna;
        cna.disabled = !prefs.enabled;
      }
    }

    function getEnabledOptionalNavTabIds() {
      migrateNavTabPrefs();
      const optional = new Set(getOptionalNavTabIds());
      try {
        const raw = localStorage.getItem(NAV_TABS_ENABLED_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id) => optional.has(id)));
      } catch (_e) {
        return new Set();
      }
    }

    function saveEnabledOptionalNavTabIds(enabled) {
      const optional = new Set(getOptionalNavTabIds());
      try {
        localStorage.setItem(
          NAV_TABS_ENABLED_KEY,
          JSON.stringify([...enabled].filter((id) => optional.has(id)))
        );
      } catch (_e) { /* ignore */ }
    }

    function isNavTabVisible(tabId) {
      if (tabId === "notifications") return isMobileChromeLayout();
      const def = NAV_TAB_DEFS.find((row) => row.id === tabId);
      if (!def) return false;
      if (def.required) return true;
      return getEnabledOptionalNavTabIds().has(tabId);
    }

    function routeToNavTabId(route) {
      const r = normalizeRoute(route || "");
      if (r === "/home") return "home";
      if (r === "/notifications") return "notifications";
      if (r === "/radio") return "radio";
      if (r === "/mass/calendar") return "calendar";
      if (r.startsWith("/mass/")) return "mass";
      if (r.startsWith("/library/")) return "library";
      if (r.startsWith("/media/")) return "media";
      if (r.startsWith("/design/")) return "design";
      if (r.startsWith("/settings/")) return null;
      return null;
    }

    function syncNavTabSettingsUI() {
      const list = $("settings-nav-tabs-list");
      if (!list) return;
      const enabled = getEnabledOptionalNavTabIds();
      list.innerHTML = NAV_TAB_DEFS.map((def) => {
        const locked = !!def.required;
        const checked = locked || enabled.has(def.id);
        const id = "settings-nav-tab-" + def.id;
        const cls = "toggle" + (locked ? " is-locked" : "");
        const note = locked ? " <span class=\"muted\" style=\"font-size:0.78rem;\">(always on)</span>" : "";
        return (
          "<label class=\"" + cls + "\">" +
            "<input type=\"checkbox\" id=\"" + id + "\" data-nav-tab-toggle=\"" + escapeHtml(def.id) + "\" " +
              (checked ? "checked" : "") + (locked ? " disabled" : "") + " />" +
            escapeHtml(def.label) + note +
          "</label>"
        );
      }).join("");
    }

    function applyNavTabVisibility() {
      document.querySelectorAll("[data-nav-tab]").forEach((el) => {
        // Mobile top-nav order owns visibility for bar links
        if (isMobileChromeLayout() && el.closest && el.closest("#app-bottom-nav")) return;
        // Extras / drawer links stay reachable on mobile even when optional tabs are off
        if (isMobileChromeLayout() && el.closest && el.closest("#app-mobile-menu-pages, #app-more-sheet")) {
          el.hidden = false;
          return;
        }
        el.hidden = !isNavTabVisible(el.dataset.navTab);
      });
      const sidebarNav = document.querySelector(".app-sidebar__nav");
      const bottomNav = $("app-bottom-nav");
      if (sidebarNav) {
        const visibleCount = sidebarNav.querySelectorAll(".app-sidebar__link:not([hidden])").length;
        sidebarNav.classList.toggle("is-tab-balanced", visibleCount > 0 && visibleCount < NAV_TAB_DEFS.length);
      }
      if (bottomNav && !isMobileChromeLayout()) {
        const visibleCount = bottomNav.querySelectorAll(".nav-link:not([hidden])").length;
        bottomNav.classList.toggle("is-tab-balanced", visibleCount > 0);
      }
      const switcher = $("route-switcher");
      if (switcher) {
        switcher.querySelectorAll("option[data-nav-tab]").forEach((opt) => {
          const visible = isNavTabVisible(opt.dataset.navTab);
          opt.hidden = !visible;
          opt.disabled = !visible;
        });
      }
      if (typeof applyMobileNavOrder === "function") applyMobileNavOrder();
    }

    function shouldBlockHiddenNavRoute(route) {
      const r = normalizeRoute(route || "");
      const tabId = routeToNavTabId(r);
      if (!tabId || isNavTabVisible(tabId) || isSettingsRoute(r)) return false;
      // On mobile, Extras is the access path for drawer pages — never bounce those to Home
      if (isMobileChromeLayout() && typeof isDrawerNavRoute === "function" && isDrawerNavRoute(r)) {
        return false;
      }
      return true;
    }

    function redirectIfHiddenNavRoute() {
      const route = normalizeRoute(window.location.pathname);
      if (shouldBlockHiddenNavRoute(route)) {
        showRoute("/home", true);
        return true;
      }
      return false;
    }

    function bindNavTabSettings() {
      syncNavTabSettingsUI();
      const list = $("settings-nav-tabs-list");
      if (!list) return;
      list.addEventListener("change", (e) => {
        const inp = e.target.closest("[data-nav-tab-toggle]");
        if (!inp) return;
        const tabId = inp.dataset.navTabToggle;
        const def = NAV_TAB_DEFS.find((row) => row.id === tabId);
        if (!def || def.required) return;
        const enabled = getEnabledOptionalNavTabIds();
        if (inp.checked) enabled.add(tabId);
        else enabled.delete(tabId);
        saveEnabledOptionalNavTabIds(enabled);
        applyNavTabVisibility();
        if (redirectIfHiddenNavRoute()) {
          notify("That section is hidden. Redirected to Home.", "info");
        }
      });
    }

    var EWTN_RADIO_STORAGE_KEY = "verbumEwtRadioStationId";
    var EWTN_HLS_FALLBACK = {
      us: "https://ewtn-sgrewind.streamguys1.com/sgrewind/english/chunks.m3u8",
      extra: "https://ewtn-sgrewind.streamguys1.com/sgrewind/classics/chunks.m3u8",
      gbie: "https://ewtn-sgrewind.streamguys1.com/sgrewind/sky/chunks.m3u8",
      philippines: "https://ewtn-sgrewind.streamguys1.com/sgrewind/philippines/chunks.m3u8",
      catolica: "https://ewtn-sgrewind.streamguys1.com/sgrewind/spanish/chunks.m3u8",
    };
    var ewtnRadioStations = [];
    var ewtnRadioPlaying = false;
    var ewtnHls = null;
    var ewtnRadioActiveId = null;
    var mediaHubPlayerMode = "radio";
    var savedMediaLibrary = { music: [], video: [] };
    var libraryPlaylist = [];
    var libraryTrackIndex = -1;
    var libraryActiveItem = null;
    var libraryPlayObjectUrl = null;
    var librarySeekDragging = false;

    var MASS_SECTION_VIDEO_SLOTS = [
      "kyrie", "gloria", "sanctus", "our_father", "lamb_of_god",
      "entrance", "offertory",
      "communion_1", "communion_2", "communion_3", "communion_4", "communion_5",
      "recessional",
    ];
    var MASS_SECTION_VIDEO_SLOT_SET = new Set(MASS_SECTION_VIDEO_SLOTS);
    var MASS_RITE_OPTION_SECTIONS = new Set([
      "kyrie", "gloria", "sanctus", "our_father", "lamb_of_god", "penitential", "creed",
    ]);
    var MASS_RITE_VIDEO_MODE_SECTIONS = new Set([
      "kyrie", "gloria", "sanctus", "our_father", "lamb_of_god",
    ]);
    window.massRiteVideoMode = window.massRiteVideoMode || {};
    window.massRiteVideoLang = window.massRiteVideoLang || {};
    window.massSongVideoMode = window.massSongVideoMode || {};
    window.__riteVideoSyncFns = window.__riteVideoSyncFns || {};
    window.registerRiteVideoSync = function (section, fn) {
      if (section && typeof fn === "function") window.__riteVideoSyncFns[section] = fn;
    };
    function syncRiteVideoUi(section) {
      var map = window.__riteVideoSyncFns || {};
      if (section && map[section]) map[section]();
      else Object.keys(map).forEach((k) => map[k]());
    }
    window.syncRiteVideoUi = syncRiteVideoUi;
    var MASS_SECTION_MEDIA_LABELS = {
      kyrie: "Kyrie",
      gloria: "Gloria",
      sanctus: "Sanctus",
      our_father: "Our Father",
      lamb_of_god: "Lamb of God",
      penitential: "Penitential Act",
      creed: "Creed",
      entrance: "Entrance",
      offertory: "Offertory",
      communion_1: "Communion 1",
      communion_2: "Communion 2",
      communion_3: "Communion 3",
      communion_4: "Communion 4",
      communion_5: "Communion 5",
      recessional: "Recessional",
    };
    var MASS_RITE_OPTION_LABELS = {
      "kyrie::english": "Kyrie · English",
      "kyrie::greek": "Kyrie · Greek",
      "kyrie::latin": "Kyrie · Latin",
      "gloria::english": "Gloria · English",
      "gloria::latin": "Gloria · Latin",
      "sanctus::default": "Sanctus · Holy, Holy, Holy",
      "our_father::english": "Our Father · English",
      "our_father::malay": "Our Father · Malay",
      "our_father::tagalog": "Our Father · Tagalog",
      "our_father::visaya": "Our Father · Visaya",
      "our_father::korean": "Our Father · Korean",
      "lamb_of_god::english": "Lamb of God · English",
      "lamb_of_god::latin": "Lamb of God · Latin",
      "penitential::confiteor": "Penitential Act · Confiteor",
      "penitential::form-b": "Penitential Act · Form B",
      "penitential::form-c": "Penitential Act · Form C",
      "creed::nicene": "Creed · Nicene",
      "creed::apostles": "Creed · Apostles'",
    };
    var MASS_RITE_OPTION_PREVIEW_TEXT = {
      "kyrie::english": "Lord, have mercy.\nChrist, have mercy.\nLord, have mercy.",
      "kyrie::greek": "Kyrie eleison.\nChriste eleison.\nKyrie eleison.",
      "kyrie::latin": "Kyrie eleison.\nChriste eleison.\nKyrie eleison.",
      "gloria::english": "Glory to God in the highest,\nand on earth peace to people of good will.\nWe praise you, we bless you, we adore you,\nwe glorify you, we give you thanks\nfor your great glory,\nLord God, heavenly King, O God, almighty Father.\n\nLord Jesus Christ, Only Begotten Son,\nLord God, Lamb of God, Son of the Father,\nyou take away the sins of the world, have mercy on us;\nyou take away the sins of the world, receive our prayer;\nyou are seated at the right hand of the Father, have mercy on us.\n\nFor you alone are the Holy One,\nyou alone are the Lord,\nyou alone are the Most High,\nJesus Christ,\nwith the Holy Spirit,\nin the glory of God the Father.\nAmen.",
      "gloria::latin": "Gloria in excelsis Deo\net in terra pax hominibus bonae voluntatis.\nLaudamus te, benedicimus te, adoramus te,\nglorificamus te, gratias agimus tibi\npropter magnam gloriam tuam,\nDomine Deus, Rex caelestis, Deus Pater omnipotens.\n\nDomine Fili unigenite, Iesu Christe,\nDomine Deus, Agnus Dei, Filius Patris,\nqui tollis peccata mundi, miserere nobis;\nqui tollis peccata mundi, suscipe deprecationem nostram.\nQui sedes ad dexteram Patris, miserere nobis.\n\nQuoniam tu solus Sanctus, tu solus Dominus,\ntu solus Altissimus, Iesu Christe,\ncum Sancto Spiritu: in gloria Dei Patris.\nAmen.",
      "sanctus::default": "Holy, Holy, Holy Lord God of hosts.\nHeaven and earth are full of your glory.\nHosanna in the highest.\nBlessed is he who comes in the name of the Lord.\nHosanna in the highest.",
      "our_father::english": "Our Father, who art in heaven,\nhallowed be thy name;\nthy kingdom come,\nthy will be done,\non earth as it is in heaven.\nGive us this day our daily bread;\nand forgive us our trespasses,\nas we forgive those who trespass against us;\nand lead us not into temptation,\nbut deliver us from evil.",
      "our_father::malay": "Bapa kami yang di syurga,\ndikuduskanlah nama-Mu,\ndatanglah kerajaan-Mu,\njadilah kehendak-Mu,\ndi atas bumi seperti di dalam syurga.\nBerilah kami rezeki pada hari ini,\ndan ampunilah kesalahan kami,\nseperti kami mengampuni orang yang bersalah kepada kami.\nDan janganlah masukkan kami ke dalam pencubaan,\ntetapi lepaskanlah kami daripada yang jahat.",
      "our_father::tagalog": "Ama namin, sumasalangit ka,\nsambahin ang ngalan mo.\nMapasaamin ang kaharian mo.\nSundin ang loob mo,\ndito sa lupa para nang sa langit.\nBigyan mo kami ngayon ng aming kakanin sa araw-araw.\nAt patawarin mo kami sa aming mga sala,\npara nang pagpapatawad namin sa nagkakasala sa amin.\nAt huwag mo kaming ipahintulot sa tukso,\nat iadya mo kami sa lahat ng masama.",
      "our_father::visaya": "Amahan namo nga anaa sa mga langit,\npagdaygon ang imong ngalan.\nUmabot kanamo ang imong gingharian.\nMatuman ang imong pagbuot,\ndinhi sa yuta maingon sa langit.\nAng kalan-on namo sa matag adlaw, ihatag kanamo karong adlawa.\nUg pasayloa kami sa among mga sala,\ningon nga nagapasaylo kami sa mga nakasala kanamo.\nUg dili mo kami itugyan sa mga panulay,\nhinonoa luwasa kami sa dautan.",
      "our_father::korean": "하늘에 계신 우리 아버지,\n아버지의 이름이 거룩히 빛나시며\n아버지의 나라가 오시며\n아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지소서.\n오늘 저희에게 일용할 양식을 주시고\n저희에게 잘못한 이를 저희가 용서하오니\n저희 죄를 용서하시고\n저희를 유혹에 빠지지 않게 하시고\n악에서 구하소서.",
      "lamb_of_god::english": "Lamb of God,\nyou take away the sins of the world,\nhave mercy on us.\nLamb of God,\nyou take away the sins of the world,\nhave mercy on us.\nLamb of God,\nyou take away the sins of the world,\ngrant us peace.",
      "lamb_of_god::latin": "Agnus Dei,\nqui tollis peccata mundi,\nmiserere nobis.\nAgnus Dei,\nqui tollis peccata mundi,\nmiserere nobis.\nAgnus Dei,\nqui tollis peccata mundi,\ndona nobis pacem.",
      "penitential::confiteor": "I confess to almighty God\nand to you, my brothers and sisters,\nthat I have greatly sinned,\nin my thoughts and in my words,\nin what I have done and in what I have failed to do,\nthrough my fault, through my fault,\nthrough my most grievous fault;\ntherefore I ask blessed Mary ever-Virgin,\nall the Angels and Saints,\nand you, my brothers and sisters,\nto pray for me to the Lord our God.",
      "penitential::form-b": "Have mercy on us, O Lord.\nFor we have sinned against you.\nShow us, O Lord, your mercy.\nAnd grant us your salvation.",
      "penitential::form-c": "You were sent to heal the contrite of heart:\nLord, have mercy.\nYou came to call sinners:\nChrist, have mercy.\nYou are seated at the right hand of the Father to intercede for us:\nLord, have mercy.",
      "creed::nicene": "I believe in one God,\nthe Father almighty,\nmaker of heaven and earth,\nof all things visible and invisible…\n\n(Full Nicene Creed appears on the Mass slides.)",
      "creed::apostles": "I believe in God,\nthe Father almighty,\nCreator of heaven and earth,\nand in Jesus Christ, his only Son, our Lord…\n\n(Full Apostles' Creed appears on the Mass slides.)",
    };
    var massSectionMedia = { audio: {}, video: {} };
    var massSectionAudioEl = null;
    var massSectionAudioPlayingSlot = "";
    var massSectionMediaObjectUrl = null;
    // massMediaPickState / composerSongMedia declared with media-pick helpers below.

    function revokeMassSectionMediaObjectUrl() {
      if (massSectionMediaObjectUrl) {
        URL.revokeObjectURL(massSectionMediaObjectUrl);
        massSectionMediaObjectUrl = null;
      }
    }

    async function resolveMassSectionMediaUrl(url, preferredMime) {
      if (!url) return "";
      if (typeof isPrivateFileUrl === "function" && isPrivateFileUrl(url) && typeof authorizedFetch === "function") {
        const res = await authorizedFetch(url);
        if (!res.ok) throw new Error("Could not load media.");
        const buffer = await res.arrayBuffer();
        const headerType = String(res.headers.get("content-type") || "").split(";")[0].trim();
        const mime = headerType || preferredMime || "";
        const playBlob = mime ? new Blob([buffer], { type: mime }) : new Blob([buffer]);
        revokeMassSectionMediaObjectUrl();
        massSectionMediaObjectUrl = URL.createObjectURL(playBlob);
        return massSectionMediaObjectUrl;
      }
      return url;
    }

    function massMediaKey(section, option) {
      const sec = String(section || "").trim().toLowerCase();
      const opt = String(option || "").trim().toLowerCase();
      if (!sec) return "";
      return opt ? (sec + "::" + opt) : sec;
    }

    function parseMassMediaKey(key) {
      const raw = String(key || "").trim();
      const idx = raw.indexOf("::");
      if (idx < 0) return { section: raw.toLowerCase(), option: "" };
      return {
        section: raw.slice(0, idx).toLowerCase(),
        option: raw.slice(idx + 2).toLowerCase(),
      };
    }

    function massMediaKeyAllowsVideo(key) {
      const parsed = parseMassMediaKey(key);
      if (!MASS_SECTION_VIDEO_SLOT_SET.has(parsed.section)) return false;
      if (MASS_RITE_OPTION_SECTIONS.has(parsed.section) && !parsed.option) return false;
      return true;
    }

    function selectedRiteMediaOption(section) {
      if (section === "sanctus") {
        if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) {
          return (window.massRiteVideoLang && window.massRiteVideoLang.sanctus) || "default";
        }
        const opt = document.querySelector('.mw-options[aria-label="Sanctus tune"] .mw-option[aria-checked="true"]:not([data-val="__video"])');
        return (opt && (opt.getAttribute("data-val") || "default")) || "default";
      }
      const idMap = {
        kyrie: "flow-kyrie-choice",
        gloria: "flow-gloria-choice",
        our_father: "flow-our-father-choice",
        lamb_of_god: "flow-lamb-choice",
        penitential: "flow-penitential-choice",
        creed: "flow-creed-choice",
      };
      const el = $(idMap[section]);
      return el && el.value ? String(el.value).trim().toLowerCase() : "";
    }

    function resolveVideoMediaKey(section) {
      if (MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
        if (!(window.massRiteVideoMode && window.massRiteVideoMode[section])) return "";
        const opt = (window.massRiteVideoLang && window.massRiteVideoLang[section]) || selectedRiteMediaOption(section);
        return opt ? massMediaKey(section, opt) : "";
      }
      if (MASS_RITE_OPTION_SECTIONS.has(section)) {
        return "";
      }
      return section;
    }

    function parseYouTubeVideoId(value) {
      let raw = String(value || "").trim();
      if (!raw) return "";
      if (raw.toLowerCase().indexOf("yt:") === 0) raw = raw.slice(3).trim();
      if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
      const lowered = raw.toLowerCase();
      if (raw.indexOf("://") < 0 && (
        lowered.indexOf("youtube.com") === 0 ||
        lowered.indexOf("youtu.be") === 0 ||
        lowered.indexOf("m.youtube.com") === 0 ||
        lowered.indexOf("music.youtube.com") === 0 ||
        lowered.indexOf("www.youtube.com") === 0
      )) {
        raw = "https://" + raw;
      }
      let parsed;
      try { parsed = new URL(raw); } catch (_e) { return ""; }
      const host = String(parsed.hostname || "").toLowerCase();
      if (!/(^|\.)youtube\.com$/.test(host) && !/(^|\.)youtu\.be$/.test(host) && !/(^|\.)youtube-nocookie\.com$/.test(host)) {
        return "";
      }
      if (/(^|\.)youtu\.be$/.test(host)) {
        const cand = parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
        return /^[A-Za-z0-9_-]{11}$/.test(cand) ? cand : "";
      }
      const vid = parsed.searchParams.get("v") || "";
      if (/^[A-Za-z0-9_-]{11}$/.test(vid)) return vid;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v")) {
        const cand = parts[1];
        return /^[A-Za-z0-9_-]{11}$/.test(cand) ? cand : "";
      }
      return "";
    }

    function youtubeWatchUrl(id) {
      return id ? ("https://www.youtube.com/watch?v=" + id) : "";
    }

    function youtubeEmbedUrl(id) {
      return id ? ("https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0") : "";
    }

    function isYouTubeMediaRef(item) {
      if (!item || typeof item !== "object") return false;
      return !!(item.source === "youtube" || item.youtube_id || parseYouTubeVideoId(item.youtube_url || item.url || item.basename || ""));
    }

    function youtubeIdFromMediaRef(item) {
      if (!item || typeof item !== "object") return "";
      return parseYouTubeVideoId(item.youtube_id || item.youtube_url || item.url || item.basename || "");
    }

    function youtubeMediaRefFromInput(value, displayName) {
      const id = parseYouTubeVideoId(value);
      if (!id) return null;
      const name = String(displayName || "").trim() || "YouTube";
      return {
        basename: "yt:" + id,
        display_name: name,
        url: youtubeWatchUrl(id),
        source: "youtube",
        youtube_id: id,
        youtube_url: youtubeWatchUrl(id),
      };
    }

    function serializeSongMediaRef(item) {
      const norm = normalizeComposerMediaRef(item);
      if (!norm) return null;
      const out = {
        basename: norm.basename,
        display_name: norm.display_name || norm.basename,
      };
      if (isYouTubeMediaRef(norm)) {
        out.source = "youtube";
        out.youtube_id = youtubeIdFromMediaRef(norm);
        out.youtube_url = youtubeWatchUrl(out.youtube_id);
      }
      return out;
    }

    function normalizeMassMediaItem(item) {
      return normalizeComposerMediaRef(item);
    }

    function getMassSectionMedia(kind, slot) {
      const bucket = massSectionMedia[kind === "video" ? "video" : "audio"];
      return bucket && bucket[slot] ? bucket[slot] : null;
    }

    function setMassSectionMedia(kind, slot, item) {
      const key = kind === "video" ? "video" : "audio";
      if (key === "video" && !massMediaKeyAllowsVideo(slot)) return;
      if (!massSectionMedia[key]) massSectionMedia[key] = {};
      const norm = normalizeMassMediaItem(item);
      if (norm) massSectionMedia[key][slot] = norm;
      else {
        delete massSectionMedia[key][slot];
        if (key === "video" && typeof setMassSongVideoMode === "function") {
          setMassSongVideoMode(slot, false, { quiet: true });
        }
      }
      refreshMassSectionMediaUi();
      if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
    }

    function serializeMassSectionMedia() {
      return JSON.parse(JSON.stringify(massSectionMedia || { audio: {}, video: {} }));
    }

    function applyMassSectionMedia(data) {
      const next = { audio: {}, video: {} };
      if (data && typeof data === "object") {
        ["audio", "video"].forEach((kind) => {
          const src = data[kind];
          if (!src || typeof src !== "object") return;
          Object.keys(src).forEach((slot) => {
            const norm = normalizeMassMediaItem(src[slot]);
            if (!norm) return;
            if (kind === "video" && !massMediaKeyAllowsVideo(slot) && !MASS_SECTION_VIDEO_SLOT_SET.has(slot)) return;
            // Keep legacy section-only rite keys for migrate-on-resolve.
            next[kind][slot] = norm;
          });
        });
      }
      massSectionMedia = next;
      refreshMassSectionMediaUi();
    }

    function resetMassSectionMedia() {
      stopMassSectionAudio();
      massSectionMedia = { audio: {}, video: {} };
      window.massRiteVideoMode = {};
      window.massRiteVideoLang = {};
      window.massSongVideoMode = {};
      if (typeof syncRiteVideoUi === "function") syncRiteVideoUi();
      refreshMassSectionMediaUi();
    }

    function serializeRiteVideoState() {
      return {
        mode: JSON.parse(JSON.stringify(window.massRiteVideoMode || {})),
        lang: JSON.parse(JSON.stringify(window.massRiteVideoLang || {})),
      };
    }

    function getMassSongVideoMode(slot) {
      const key = String(slot || "").trim();
      return !!(key && window.massSongVideoMode && window.massSongVideoMode[key]);
    }

    function setMassSongVideoMode(slot, on, opts) {
      const key = String(slot || "").trim();
      if (!key || !MASS_SECTION_VIDEO_SLOT_SET.has(key)) return;
      if (!window.massSongVideoMode) window.massSongVideoMode = {};
      if (on) window.massSongVideoMode[key] = true;
      else delete window.massSongVideoMode[key];
      if (!(opts && opts.quiet)) {
        refreshMassSectionMediaUi();
        if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
      }
    }

    function serializeSongVideoState() {
      return {
        mode: JSON.parse(JSON.stringify(window.massSongVideoMode || {})),
      };
    }

    function applySongVideoState(data) {
      window.massSongVideoMode = {};
      const mode = data && typeof data === "object" ? (data.mode || data.songVideoMode || data) : null;
      if (mode && typeof mode === "object") {
        Object.keys(mode).forEach((slot) => {
          if (mode[slot] && MASS_SECTION_VIDEO_SLOT_SET.has(slot)) {
            window.massSongVideoMode[slot] = true;
          }
        });
      }
      refreshMassSectionMediaUi();
    }

    function slotHasSongVideoAvailable(slotKey) {
      if (!MASS_SECTION_VIDEO_SLOT_SET.has(slotKey)) return false;
      if (getMassSectionMedia("video", slotKey)) return true;
      const songId = (selectedLyricsSongs && selectedLyricsSongs[slotKey]) || "";
      if (!songId) return false;
      const row = typeof lookupMassPlanSong === "function" ? lookupMassPlanSong(songId) : null;
      return !!(row && row.video_media && (row.video_media.basename || row.video_media));
    }

    var massSongVideoPickPendingSlot = "";
    var massRiteVideoPickPending = null;

    function massRiteOptionMediaInnerHtml(mediaKey, section, lang) {
      const key = String(mediaKey || "").trim();
      const sec = String(section || "").trim().toLowerCase();
      const opt = String(lang || "").trim().toLowerCase();
      const audio = getMassSectionMedia("audio", key);
      const video = getMassSectionMedia("video", key);
      const audioOn = !!audio;
      const videoOn = !!video;
      const activeLang = String(
        (window.massRiteVideoLang && window.massRiteVideoLang[sec]) || ""
      ).trim().toLowerCase();
      const useVideo = !!(
        window.massRiteVideoMode &&
        window.massRiteVideoMode[sec] &&
        activeLang === opt
      );
      const audioPlayBtn =
        "<button type=\"button\" class=\"mw-media-play" + (audioOn ? " is-ready" : "") + "\" " +
          "data-mw-play-audio data-mw-media-slot=\"" + escapeHtml(key) + "\" " +
          (audioOn ? "" : "disabled ") +
          "aria-label=\"Play audio preview\" " +
          "title=\"" + escapeHtml(audioOn ? ("Play " + (audio.display_name || audio.basename)) : "Link audio first") + "\">▶</button>";
      const videoPlayBtn =
        "<button type=\"button\" class=\"mw-media-play" + (videoOn ? " is-ready" : "") + "\" " +
          "data-mw-play-video data-mw-media-slot=\"" + escapeHtml(key) + "\" " +
          (videoOn ? "" : "disabled ") +
          "aria-label=\"Play video preview\" " +
          "title=\"" + escapeHtml(videoOn ? ("Play " + (video.display_name || video.basename)) : "Link video first") + "\">▶</button>";
      return (
        "<div class=\"mass-song-slide-mode\" role=\"radiogroup\" aria-label=\"PowerPoint slide for this rite\" " +
          "data-mass-rite-slide-mode=\"" + escapeHtml(sec) + "\">" +
          "<button type=\"button\" class=\"mass-song-slide-mode__btn" + (!useVideo ? " is-active" : "") + "\" " +
            "role=\"radio\" aria-checked=\"" + (!useVideo ? "true" : "false") + "\" " +
            "data-mass-rite-slide-mode-val=\"lyrics\" " +
            "data-mass-rite-slide-mode-section=\"" + escapeHtml(sec) + "\" " +
            "data-mass-rite-slide-mode-lang=\"" + escapeHtml(opt) + "\" " +
            "title=\"Use lyric slides in the PowerPoint\">Lyrics</button>" +
          "<button type=\"button\" class=\"mass-song-slide-mode__btn" + (useVideo ? " is-active" : "") + "\" " +
            "role=\"radio\" aria-checked=\"" + (useVideo ? "true" : "false") + "\" " +
            "data-mass-rite-slide-mode-val=\"video\" " +
            "data-mass-rite-slide-mode-section=\"" + escapeHtml(sec) + "\" " +
            "data-mass-rite-slide-mode-lang=\"" + escapeHtml(opt) + "\" " +
            "title=\"Replace lyric slides with the linked video in the PowerPoint\">Video</button>" +
        "</div>" +
        "<div class=\"mw-media-group\">" +
          "<button type=\"button\" class=\"mw-media-chip mw-media-chip--sa" + (audioOn ? " is-on" : "") + "\" " +
            "data-mw-link-media=\"audio\" data-mw-media-slot=\"" + escapeHtml(key) + "\" " +
            "title=\"Audio snippet for the ministry to learn the tune (not added to the PowerPoint)\">" +
            "<span>Audio</span>" +
            (audioOn ? "<span class=\"mw-media-chip__name\">" + escapeHtml(audio.display_name || audio.basename) + "</span>" : "") +
          "</button>" +
          audioPlayBtn +
        "</div>" +
        "<div class=\"mw-media-group\">" +
          "<button type=\"button\" class=\"mw-media-chip mw-media-chip--sa" + (videoOn ? " is-on" : "") + "\" " +
            "data-mw-link-media=\"video\" data-mw-media-slot=\"" + escapeHtml(key) + "\" " +
            "title=\"Link an MP4. Choose Video above to use it instead of lyric slides.\">" +
            "<span>Video file</span>" +
            (videoOn ? "<span class=\"mw-media-chip__name\">" + escapeHtml(video.display_name || video.basename) + "</span>" : "") +
          "</button>" +
          videoPlayBtn +
        "</div>" +
        "<p class=\"mass-song-slide-mode__hint\">" +
          (useVideo
            ? "PowerPoint: video slide replaces lyrics."
            : "PowerPoint: lyric slides. Audio is preview only.") +
        "</p>"
      );
    }

    async function chooseMassRiteSlideMode(section, lang, mode) {
      const sec = String(section || "").trim().toLowerCase();
      const opt = String(lang || "").trim().toLowerCase();
      if (!sec || !opt || !MASS_RITE_VIDEO_MODE_SECTIONS.has(sec)) return;
      const idMap = {
        kyrie: "flow-kyrie-choice",
        gloria: "flow-gloria-choice",
        our_father: "flow-our-father-choice",
        lamb_of_god: "flow-lamb-choice",
      };
      const sel = idMap[sec] ? $(idMap[sec]) : null;
      if (sel && opt) {
        sel.value = opt;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (sec === "sanctus") {
        const wrap = document.querySelector('.mw-options[aria-label="Sanctus tune"]');
        if (wrap) {
          wrap.querySelectorAll(":scope > .mw-option").forEach((c) => {
            if (c.getAttribute("data-val") === "__video") return;
            c.setAttribute("aria-checked", String(c.getAttribute("data-val") === opt));
          });
        }
      }
      if (mode !== "video") {
        massRiteVideoPickPending = null;
        if (window.massRiteVideoMode) window.massRiteVideoMode[sec] = false;
        if (typeof syncRiteVideoUi === "function") syncRiteVideoUi(sec);
        refreshMassSectionMediaUi();
        if (typeof notify === "function") {
          notify("Using lyric slides for " + (MASS_SECTION_MEDIA_LABELS[sec] || sec) + ".", "ok");
        }
        if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
        return;
      }
      const mediaKey = massMediaKey(sec, opt);
      if (!getMassSectionMedia("video", mediaKey)) {
        massRiteVideoPickPending = { section: sec, lang: opt, slot: mediaKey };
        if (typeof notify === "function") {
          notify("Choose or upload a video for this option, then Video mode will apply.", "info");
        }
        await openMassMediaPickModal("video", mediaKey);
        return;
      }
      massRiteVideoPickPending = null;
      window.massRiteVideoMode = window.massRiteVideoMode || {};
      window.massRiteVideoLang = window.massRiteVideoLang || {};
      window.massRiteVideoMode[sec] = true;
      window.massRiteVideoLang[sec] = opt;
      if (typeof syncRiteVideoUi === "function") syncRiteVideoUi(sec);
      refreshMassSectionMediaUi();
      if (typeof notify === "function") {
        notify("PowerPoint will use the video slide for " + (MASS_SECTION_MEDIA_LABELS[sec] || sec) + ".", "ok");
      }
      if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
    }

    function ensureSongSlotVideoFromCatalog(slotKey) {
      if (getMassSectionMedia("video", slotKey)) return true;
      const songId = (selectedLyricsSongs && selectedLyricsSongs[slotKey]) || "";
      if (!songId) return false;
      const row = typeof lookupMassPlanSong === "function" ? lookupMassPlanSong(songId) : null;
      const videoRef = row ? normalizeComposerMediaRef(row.video_media) : null;
      if (!videoRef) return false;
      setMassSectionMedia("video", slotKey, resolveLibraryMediaRow("video", videoRef));
      return !!getMassSectionMedia("video", slotKey);
    }

    async function chooseMassSongSlideMode(slotKey, mode) {
      const slot = String(slotKey || "").trim();
      if (!slot || !MASS_SECTION_VIDEO_SLOT_SET.has(slot)) return;
      if (mode !== "video") {
        massSongVideoPickPendingSlot = "";
        setMassSongVideoMode(slot, false);
        if (typeof notify === "function") {
          notify("Using lyric slides for " + massMediaDisplayLabel(slot) + ".", "ok");
        }
        return;
      }
      if (!getMassSectionMedia("video", slot)) {
        ensureSongSlotVideoFromCatalog(slot);
      }
      if (!getMassSectionMedia("video", slot)) {
        massSongVideoPickPendingSlot = slot;
        if (typeof notify === "function") {
          notify("Choose or upload a video for this song, then Video mode will apply.", "info");
        }
        await openMassMediaPickModal("video", slot);
        return;
      }
      massSongVideoPickPendingSlot = "";
      setMassSongVideoMode(slot, true);
      if (typeof notify === "function") {
        notify("PowerPoint will use the video slide for " + massMediaDisplayLabel(slot) + ".", "ok");
      }
    }

    function applyRiteVideoState(data) {
      window.massRiteVideoMode = {};
      window.massRiteVideoLang = {};
      if (data && typeof data === "object") {
        const mode = data.mode || data.riteVideoMode || {};
        const lang = data.lang || data.riteVideoLang || {};
        if (mode && typeof mode === "object") {
          Object.keys(mode).forEach((section) => {
            if (mode[section] && MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
              window.massRiteVideoMode[section] = true;
            }
          });
        }
        if (lang && typeof lang === "object") {
          Object.keys(lang).forEach((section) => {
            const val = String(lang[section] || "").trim().toLowerCase();
            if (val && MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
              window.massRiteVideoLang[section] = val;
            }
          });
        }
      }
      if (typeof syncRiteVideoUi === "function") syncRiteVideoUi();
      // Keep language selects aligned with restored rite video lang.
      const idMap = {
        kyrie: "flow-kyrie-choice",
        gloria: "flow-gloria-choice",
        our_father: "flow-our-father-choice",
        lamb_of_god: "flow-lamb-choice",
      };
      Object.keys(idMap).forEach((section) => {
        const lang = window.massRiteVideoLang && window.massRiteVideoLang[section];
        const sel = $(idMap[section]);
        if (sel && lang) {
          const has = Array.prototype.some.call(sel.options, (o) => String(o.value).toLowerCase() === lang);
          if (has) sel.value = lang;
        }
      });
      if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) {
        const wrap = document.querySelector('.mw-options[aria-label="Sanctus tune"]');
        if (wrap) {
          wrap.querySelectorAll(":scope > .mw-option").forEach((c) => {
            if (c.getAttribute("data-val") === "__video") return;
            c.setAttribute(
              "aria-checked",
              String(c.getAttribute("data-val") === ((window.massRiteVideoLang && window.massRiteVideoLang.sanctus) || "default"))
            );
          });
        }
      }
      refreshMassSectionMediaUi();
    }

    function buildVideoReplacementsPayload() {
      const out = {};
      MASS_SECTION_VIDEO_SLOTS.forEach((section) => {
        if (MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
          if (!(window.massRiteVideoMode && window.massRiteVideoMode[section])) return;
        } else if (!getMassSongVideoMode(section)) {
          // Song slots default to lyrics slides unless user chooses Video.
          return;
        }
        const key = resolveVideoMediaKey(section);
        let item = key ? getMassSectionMedia("video", key) : null;
        if (!item && MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
          item = getMassSectionMedia("video", section);
        } else if (!item && !MASS_RITE_VIDEO_MODE_SECTIONS.has(section)) {
          item = getMassSectionMedia("video", section);
        }
        if (item && item.basename && /\.mp4$/i.test(item.basename)) {
          out[section] = item.basename;
        }
      });
      return Object.keys(out).length ? out : null;
    }

    function massMediaDisplayLabel(key) {
      if (MASS_RITE_OPTION_LABELS[key]) return MASS_RITE_OPTION_LABELS[key];
      const parsed = parseMassMediaKey(key);
      const base = MASS_SECTION_MEDIA_LABELS[parsed.section] || parsed.section;
      return parsed.option ? (base + " · " + parsed.option) : base;
    }

    function stripMassPreviewMarkers(text) {
      return String(text || "")
        .replace(/<<[APD]>>/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
    }

    var riteSlidePreviewCache = {};

    async function fetchRiteSlidePreview(section, option) {
      const sec = String(section || "").trim().toLowerCase();
      const opt = String(option || "").trim().toLowerCase() || "default";
      const cacheKey = sec + "::" + opt;
      if (riteSlidePreviewCache[cacheKey]) return riteSlidePreviewCache[cacheKey];
      const qs = "section=" + encodeURIComponent(sec) + "&option=" + encodeURIComponent(opt);
      const res = await fetch("/api/rite-preview-text?" + qs);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error((data && data.detail) || "Could not load slide text.");
      }
      riteSlidePreviewCache[cacheKey] = data;
      return data;
    }

    function getMassMediaPreviewText(key) {
      if (MASS_RITE_OPTION_PREVIEW_TEXT[key]) return MASS_RITE_OPTION_PREVIEW_TEXT[key];
      const parsed = parseMassMediaKey(key);
      if (MASS_SECTION_VIDEO_SLOT_SET.has(parsed.section) && !parsed.option) {
        const id = selectedLyricsSongs && selectedLyricsSongs[parsed.section];
        if (!id) return "";
        let row = massPlanAllSongs && massPlanAllSongs.find((s) => String(s.id) === String(id));
        if (!row && typeof rebuildMassPlanSongPool === "function") {
          rebuildMassPlanSongPool();
          row = massPlanAllSongs && massPlanAllSongs.find((s) => String(s.id) === String(id));
        }
        const lyrics = row && (row.lyrics || row.lyric_text || row.text || "");
        return stripMassPreviewMarkers(lyrics);
      }
      return "";
    }

    function formatRiteSlidesForPreview(slides) {
      const pages = Array.isArray(slides) ? slides.filter(Boolean) : [];
      if (!pages.length) return "";
      if (pages.length === 1) return pages[0];
      return pages.map((page, i) => "— Slide " + (i + 1) + " —\n" + page).join("\n\n");
    }

    async function openMassRiteTextPreview(key) {
      const parsed = parseMassMediaKey(key);
      const title = massMediaDisplayLabel(key) || "Text preview";
      try {
        const data = await fetchRiteSlidePreview(parsed.section, parsed.option || "default");
        const text = formatRiteSlidesForPreview(data.slides) || data.text || "";
        const count = data.slide_count || (data.slides && data.slides.length) || 0;
        const modalTitle = count > 1 ? (title + " · " + count + " slides") : title;
        if (typeof window.openMwTextPreview === "function") {
          window.openMwTextPreview(modalTitle, text, {});
        }
      } catch (_e) {
        const fallback = getMassMediaPreviewText(key);
        if (fallback && typeof window.openMwTextPreview === "function") {
          window.openMwTextPreview(title, fallback, {});
          return;
        }
        if (typeof notify === "function") notify("Could not load slide text for this option.", "error");
      }
    }

    function massMediaChipHtml(kind, slot) {
      const item = getMassSectionMedia(kind, slot);
      const on = !!item;
      const label = kind === "video" ? "Video" : "Audio";
      const name = on ? (item.display_name || item.basename) : "Link…";
      const playAttr = kind === "video" ? "data-mw-play-video" : "data-mw-play-audio";
      return (
        "<div class=\"mw-media-group\">" +
          "<button type=\"button\" class=\"mw-media-chip mw-media-chip--sa" + (on ? " is-on" : "") + "\" " +
            "data-mw-link-media=\"" + escapeHtml(kind) + "\" data-mw-media-slot=\"" + escapeHtml(slot) + "\" " +
            "title=\"" + escapeHtml(on ? (label + ": " + name) : ("Link " + label.toLowerCase() + " from Media library")) + "\">" +
            "<span>" + escapeHtml(label) + "</span>" +
            (on ? "<span class=\"mw-media-chip__name\">" + escapeHtml(name) + "</span>" : "") +
          "</button>" +
          "<button type=\"button\" class=\"mw-media-play" + (on ? " is-ready" : "") + "\" " + playAttr + " " +
            "data-mw-media-slot=\"" + escapeHtml(slot) + "\" " +
            (on ? "" : "disabled ") +
            "aria-label=\"" + escapeHtml(kind === "video" ? "Play video preview" : "Play audio preview") + "\" " +
            "title=\"" + escapeHtml(on ? ("Play " + label.toLowerCase()) : ("Link " + label.toLowerCase() + " first")) + "\">▶</button>" +
        "</div>"
      );
    }

    function massSongMediaRowHtml(slotKey) {
      const youtube = massSlotYoutubeRef(slotKey);
      const audioYoutube = !!youtube;
      const youtubePlayBtn =
        "<button type=\"button\" class=\"mw-media-play" + (audioYoutube ? " is-ready" : "") + "\" " +
          "data-mw-play-youtube data-mw-media-slot=\"" + escapeHtml(slotKey) + "\" " +
          (audioYoutube ? "" : "disabled ") +
          "aria-label=\"Play YouTube full song\" " +
          "title=\"" + escapeHtml(audioYoutube ? ("Play YouTube · " + (youtube.display_name || "YouTube")) : "Link YouTube first") + "\">▶</button>";
      const audioYoutubeBtn =
        "<button type=\"button\" class=\"mass-song-media-btn" + (audioYoutube ? " is-on" : "") + "\" " +
          "data-mw-link-youtube data-mw-media-slot=\"" + escapeHtml(slotKey) + "\" " +
          "title=\"Full YouTube video for choir practice (not added to the PowerPoint)\">YouTube</button>";
      const youtubeGroup =
        "<div class=\"mw-media-group\">" +
          audioYoutubeBtn +
          youtubePlayBtn +
        "</div>";
      if (!MASS_SECTION_VIDEO_SLOT_SET.has(slotKey)) {
        return (
          "<div class=\"mass-song-media-row\" data-mass-media-row=\"" + escapeHtml(slotKey) + "\">" +
            youtubeGroup +
          "</div>"
        );
      }
      const video = getMassSectionMedia("video", slotKey);
      const videoOn = !!video;
      const useVideo = getMassSongVideoMode(slotKey);
      const videoAvailable = !!(videoOn || slotHasSongVideoAvailable(slotKey));
      const videoPlayBtn =
        "<button type=\"button\" class=\"mw-media-play" + (videoOn ? " is-ready" : "") + "\" " +
          "data-mw-play-video data-mw-media-slot=\"" + escapeHtml(slotKey) + "\" " +
          (videoOn ? "" : "disabled ") +
          "aria-label=\"Play video preview\" " +
          "title=\"" + escapeHtml(videoOn ? ("Play " + (video.display_name || video.basename)) : (videoAvailable ? "Link or apply song video first" : "Link video first")) + "\">▶</button>";
      return (
        "<div class=\"mass-song-media-row\" data-mass-media-row=\"" + escapeHtml(slotKey) + "\">" +
          "<div class=\"mass-song-slide-mode\" role=\"radiogroup\" aria-label=\"PowerPoint slide for this song\" " +
            "data-mass-song-slide-mode=\"" + escapeHtml(slotKey) + "\">" +
            "<button type=\"button\" class=\"mass-song-slide-mode__btn" + (!useVideo ? " is-active" : "") + "\" " +
              "role=\"radio\" aria-checked=\"" + (!useVideo ? "true" : "false") + "\" " +
              "data-mass-song-slide-mode-val=\"lyrics\" data-mass-song-slide-mode-slot=\"" + escapeHtml(slotKey) + "\" " +
              "title=\"Use lyric slides in the PowerPoint\">Lyrics</button>" +
            "<button type=\"button\" class=\"mass-song-slide-mode__btn" + (useVideo ? " is-active" : "") + "\" " +
              "role=\"radio\" aria-checked=\"" + (useVideo ? "true" : "false") + "\" " +
              "data-mass-song-slide-mode-val=\"video\" data-mass-song-slide-mode-slot=\"" + escapeHtml(slotKey) + "\" " +
              "title=\"Replace lyric slides with the linked video in the PowerPoint\">Video</button>" +
          "</div>" +
          youtubeGroup +
          "<div class=\"mw-media-group\">" +
            "<button type=\"button\" class=\"mass-song-media-btn mass-song-media-btn--sa" + (videoOn ? " is-on" : "") + "\" " +
              "data-mw-link-media=\"video\" data-mw-media-slot=\"" + escapeHtml(slotKey) + "\" " +
              "title=\"Link an MP4. Choose Video above to use it instead of lyric slides.\">" +
              "Video file <span class=\"mass-song-media-btn__label\">" +
                escapeHtml(videoOn ? (video.display_name || video.basename) : (videoAvailable ? "From song…" : "Link…")) +
              "</span></button>" +
            videoPlayBtn +
          "</div>" +
          "<p class=\"mass-song-slide-mode__hint\">" +
            (useVideo
              ? "PowerPoint: video slide replaces lyrics."
              : "PowerPoint: lyric slides. Audio is preview only.") +
          "</p>" +
        "</div>"
      );
    }

    function refreshMassSectionMediaUi() {
      document.querySelectorAll("[data-mw-media-row]").forEach((row) => {
        const slot = row.getAttribute("data-mw-media-row");
        if (!slot) return;
        if (row.getAttribute("data-mw-rite-media") === "1") {
          const section = row.getAttribute("data-mw-media-section") || "";
          const lang = row.getAttribute("data-mw-media-lang") || "";
          row.innerHTML = massRiteOptionMediaInnerHtml(slot, section, lang);
          return;
        }
        const kindAttr = (row.getAttribute("data-mw-media-kind") || "").toLowerCase();
        if (kindAttr === "audio") {
          row.innerHTML = massMediaChipHtml("audio", slot);
          return;
        }
        if (kindAttr === "video") {
          row.innerHTML = massMediaKeyAllowsVideo(slot) ? massMediaChipHtml("video", slot) : "";
          return;
        }
        const allowVideo = massMediaKeyAllowsVideo(slot);
        row.innerHTML = massMediaChipHtml("audio", slot) + (allowVideo ? massMediaChipHtml("video", slot) : "");
      });
      document.querySelectorAll("[data-mass-media-row]").forEach((row) => {
        const slot = row.getAttribute("data-mass-media-row");
        if (!slot) return;
        const parent = row.parentNode;
        const html = massSongMediaRowHtml(slot);
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const next = tmp.firstElementChild;
        if (next && parent) parent.replaceChild(next, row);
      });
      document.querySelectorAll("[data-mw-play-audio]").forEach((play) => {
        const key = play.getAttribute("data-mw-media-slot");
        const has = !!(key && massSlotAudioSnippetRef(key));
        play.disabled = !has;
        play.classList.toggle("is-ready", has);
        play.classList.toggle("is-playing", !!(key && massSectionAudioPlayingSlot === key));
      });
      document.querySelectorAll("[data-mw-play-youtube]").forEach((play) => {
        const key = play.getAttribute("data-mw-media-slot");
        const has = !!(key && massSlotYoutubeRef(key));
        const playingKey = key ? youtubePlayingSlot(key) : "";
        play.disabled = !has;
        play.classList.toggle("is-ready", has);
        play.classList.toggle("is-playing", !!(playingKey && massSectionAudioPlayingSlot === playingKey));
      });
      document.querySelectorAll("[data-mw-play-video]").forEach((play) => {
        const key = play.getAttribute("data-mw-media-slot");
        const has = !!(key && getMassSectionMedia("video", key));
        play.disabled = !has;
        play.classList.toggle("is-ready", has);
      });
      document.querySelectorAll(".mass-song-audio-btn[data-mass-song-audio]").forEach((btn) => {
        const slot = btn.getAttribute("data-mass-song-audio");
        const hasAudio = !!(slot && massSlotAudioSnippetRef(slot));
        const playing = !!(slot && massSectionAudioPlayingSlot === slot);
        btn.disabled = !hasAudio;
        btn.classList.toggle("is-ready", hasAudio);
        btn.classList.toggle("is-playing", playing);
        btn.textContent = playing ? "❚❚" : "▶";
        btn.title = playing
          ? "Stop audio clip"
          : (hasAudio ? "Play 5–10s chorus preview" : "Link an audio clip via the song title first");
        btn.setAttribute("aria-label", playing ? "Stop audio clip" : "Play audio clip");
        btn.setAttribute("aria-disabled", hasAudio ? "false" : "true");
      });
      if (typeof syncMassDefaultPins === "function") syncMassDefaultPins();
    }

    function stopMassSectionAudio() {
      if (massSectionAudioEl) {
        try { massSectionAudioEl.pause(); } catch (_e) {}
        try { massSectionAudioEl.removeAttribute("src"); massSectionAudioEl.load(); } catch (_e2) {}
        massSectionAudioEl = null;
      }
      massSectionAudioPlayingSlot = "";
      revokeMassSectionMediaObjectUrl();
      document.querySelectorAll(
        "[data-mw-play-audio].is-playing, [data-mw-play-youtube].is-playing, .mass-song-audio-btn.is-playing, .composer-media-play.is-playing, .song-row-play.is-playing, [data-sa-preview-play].is-playing"
      ).forEach((el) => {
        el.classList.remove("is-playing");
        if (el.classList.contains("mass-song-audio-btn")) el.textContent = "▶";
      });
      const hint = $("mw-preview-audio-hint");
      if (hint) hint.hidden = true;
      if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
      lyricSongSlots.forEach((slot) => {
        if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(slot.key);
      });
    }

    var COMPOSER_SONG_MEDIA_SLOT = "song-composer";
    var COMPOSER_SONG_YOUTUBE_SLOT = "song-composer:yt";

    function youtubePlayingSlot(slot) {
      return String(slot || "") + ":yt";
    }

    function confirmUnlinkMedia(kindLabel) {
      const label = String(kindLabel || "this media link").trim() || "this media link";
      return window.confirm("Unlink " + label + "?\n\nThis cannot be undone until you link it again.");
    }

    var songMediaPreviewObjectUrl = null;

    function revokeSongMediaPreviewObjectUrl() {
      if (songMediaPreviewObjectUrl) {
        try { URL.revokeObjectURL(songMediaPreviewObjectUrl); } catch (_e) {}
        songMediaPreviewObjectUrl = null;
      }
    }

    function fallbackSavedMediaUrl(kind, basename) {
      const name = String(basename || "").trim();
      if (!name || name.indexOf("yt:") === 0) return "";
      const folder = kind === "video" ? "saved_media/video" : "saved_media/music";
      return "/api/files/uploads/" + folder + "/" + encodeURIComponent(name);
    }

    function normalizeAudioPreviewRef(raw) {
      if (!raw || typeof raw !== "object") return null;
      const basename = String(raw.basename || "").trim();
      if (!basename || basename.indexOf("yt:") === 0) return null;
      const durationRaw = parseInt(raw.duration_sec, 10);
      const duration = Math.max(5, Math.min(10, Number.isFinite(durationRaw) ? durationRaw : 10));
      const start = Number(raw.start_sec);
      return {
        basename: basename,
        display_name: String(raw.display_name || "").trim() || (duration + "s preview"),
        duration_sec: duration,
        start_sec: Number.isFinite(start) ? start : 0,
        url: String(raw.url || "").trim() || fallbackSavedMediaUrl("music", basename),
        source: "preview",
      };
    }

    function catalogRowPreviewRef(row) {
      return row ? normalizeAudioPreviewRef(row.audio_preview) : null;
    }

    function catalogSongForSlot(slot) {
      const id = selectedLyricsSongs && selectedLyricsSongs[slot];
      if (!id) return null;
      const hit = (massPlanAllSongs || []).find((s) => String(s.id) === String(id));
      if (hit) return hit;
      if (typeof lookupMassPlanSong === "function") return lookupMassPlanSong(id);
      return null;
    }

    function massSlotPreviewRef(slot) {
      return catalogRowPreviewRef(catalogSongForSlot(slot));
    }

    function massSlotYoutubeRef(slot) {
      const item = getMassSectionMedia("audio", slot);
      if (isYouTubeMediaRef(item)) return item;
      const row = catalogSongForSlot(slot);
      const cat = row && row.audio_media ? normalizeComposerMediaRef(row.audio_media) : null;
      return isYouTubeMediaRef(cat) ? cat : null;
    }

    function massSlotAudioSnippetRef(slot) {
      const preview = massSlotPreviewRef(slot);
      if (preview) return preview;
      const item = getMassSectionMedia("audio", slot);
      if (item && item.basename && !isYouTubeMediaRef(item)) return item;
      const row = catalogSongForSlot(slot);
      const cat = row && row.audio_media ? normalizeComposerMediaRef(row.audio_media) : null;
      if (cat && cat.basename && !isYouTubeMediaRef(cat)) return cat;
      return null;
    }

    function fileToAudioPreviewRef(item) {
      const norm = normalizeComposerMediaRef(item);
      if (!norm || isYouTubeMediaRef(norm) || !norm.basename) return null;
      return normalizeAudioPreviewRef({
        basename: norm.basename,
        display_name: norm.display_name || norm.basename,
        url: norm.url || fallbackSavedMediaUrl("music", norm.basename),
        source: "preview",
        duration_sec: 10,
      });
    }

    function serializeAudioPreviewRef(item) {
      const norm = normalizeAudioPreviewRef(item);
      if (!norm) return null;
      const out = {
        basename: norm.basename,
        display_name: norm.display_name || norm.basename,
        duration_sec: norm.duration_sec || 10,
        start_sec: norm.start_sec || 0,
        source: "preview",
      };
      if (item && item.youtube_id) out.youtube_id = item.youtube_id;
      if (item && item.youtube_url) out.youtube_url = item.youtube_url;
      else if (norm.youtube_id) {
        out.youtube_id = norm.youtube_id;
        out.youtube_url = norm.youtube_url;
      }
      return out;
    }

    function composerYoutubeRef() {
      return isYouTubeMediaRef(composerSongMedia && composerSongMedia.audio)
        ? composerSongMedia.audio
        : null;
    }

    function composerAudioSnippetRef() {
      const preview = composerSongMedia && composerSongMedia.preview;
      if (preview && preview.basename) return preview;
      const audio = composerSongMedia && composerSongMedia.audio;
      if (audio && audio.basename && !isYouTubeMediaRef(audio)) return audio;
      return null;
    }

    function massSlotHasPlayableAudio(slot) {
      if (massSlotAudioSnippetRef(slot)) return true;
      if (massSlotYoutubeRef(slot)) return true;
      const item = getMassSectionMedia("audio", slot);
      return !!(item && item.basename);
    }

    function catalogPreviewPlayingSlot(section, id) {
      return "catalog:" + String(section || "") + ":" + String(id || "");
    }

    async function playSavedMusicRef(ref, slotId, playEl) {
      const item = normalizeAudioPreviewRef(ref) || (ref && ref.basename
        ? {
            basename: ref.basename,
            display_name: ref.display_name || ref.basename,
            url: ref.url || fallbackSavedMediaUrl("music", ref.basename),
          }
        : null);
      if (!item || !item.url) return false;
      if (massSectionAudioPlayingSlot === slotId) {
        stopMassSectionAudio();
        return true;
      }
      stopMassSectionAudio();
      if (typeof closeSongMediaPreviewModal === "function") closeSongMediaPreviewModal();
      massSectionAudioPlayingSlot = slotId;
      if (playEl) playEl.classList.add("is-playing");
      if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
      if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
      try {
        const playUrl = await resolveMassSectionMediaUrl(item.url, "audio/mpeg");
        if (massSectionAudioPlayingSlot !== slotId) return true;
        massSectionAudioEl = new Audio(playUrl);
        massSectionAudioEl.preload = "auto";
        const clearPlaying = () => {
          if (massSectionAudioPlayingSlot === slotId) {
            massSectionAudioPlayingSlot = "";
            if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
            if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
            document.querySelectorAll(".song-row-play.is-playing, [data-sa-preview-play].is-playing").forEach((el) => {
              el.classList.remove("is-playing");
            });
          }
        };
        massSectionAudioEl.addEventListener("ended", clearPlaying);
        massSectionAudioEl.addEventListener("pause", () => {
          if (massSectionAudioEl && massSectionAudioEl.ended) clearPlaying();
        });
        massSectionAudioEl.addEventListener("error", () => {
          clearPlaying();
          if (typeof notify === "function") notify("Could not play that audio preview.", "error");
        });
        await massSectionAudioEl.play();
        if (massSectionAudioPlayingSlot !== slotId) {
          try { massSectionAudioEl.pause(); } catch (_e0) {}
          return true;
        }
        return true;
      } catch (_e) {
        if (massSectionAudioPlayingSlot !== slotId) return true;
        stopMassSectionAudio();
        if (typeof notify === "function") notify("Could not play that audio preview.", "error");
        return false;
      }
    }

    async function resolvePlayableMediaUrl(url, preferredMime) {
      if (!url) return "";
      if (typeof isPrivateFileUrl === "function" && isPrivateFileUrl(url) && typeof authorizedFetch === "function") {
        const res = await authorizedFetch(url);
        if (!res.ok) throw new Error("Could not load media.");
        const buffer = await res.arrayBuffer();
        const headerType = String(res.headers.get("content-type") || "").split(";")[0].trim();
        const mime = headerType || preferredMime || "";
        const playBlob = mime ? new Blob([buffer], { type: mime }) : new Blob([buffer]);
        revokeSongMediaPreviewObjectUrl();
        songMediaPreviewObjectUrl = URL.createObjectURL(playBlob);
        return songMediaPreviewObjectUrl;
      }
      return url;
    }

    function closeSongMediaPreviewModal() {
      const m = $("song-media-preview-modal");
      const vid = $("song-media-preview-video");
      const status = $("song-media-preview-status");
      const wrap = $("song-media-preview-youtube-wrap");
      const frame = $("song-media-preview-youtube");
      if (vid) {
        try { vid.pause(); } catch (_e0) {}
        vid.removeAttribute("src");
        try { vid.load(); } catch (_e1) {}
        vid.hidden = false;
      }
      if (frame) {
        frame.removeAttribute("src");
      }
      if (wrap) wrap.hidden = true;
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      if (m) {
        m.setAttribute("data-open", "false");
        m.setAttribute("aria-hidden", "true");
      }
      revokeSongMediaPreviewObjectUrl();
      if (massSectionAudioPlayingSlot) {
        const slot = massSectionAudioPlayingSlot;
        const isYtSlot = slot === COMPOSER_SONG_YOUTUBE_SLOT || String(slot).slice(-3) === ":yt";
        if (isYtSlot || isYouTubePreviewOpen()) {
          massSectionAudioPlayingSlot = "";
          if ((slot === COMPOSER_SONG_YOUTUBE_SLOT || slot === COMPOSER_SONG_MEDIA_SLOT) &&
              typeof renderComposerSongMediaFields === "function") {
            renderComposerSongMediaFields();
          } else if (typeof refreshMassSectionMediaUi === "function") {
            refreshMassSectionMediaUi();
          }
        }
      }
    }

    function isYouTubePreviewOpen() {
      const m = $("song-media-preview-modal");
      const frame = $("song-media-preview-youtube");
      return !!(m && m.getAttribute("data-open") === "true" && frame && frame.getAttribute("src"));
    }

    function openYouTubePreviewModal(videoId, title) {
      const id = parseYouTubeVideoId(videoId);
      const m = $("song-media-preview-modal");
      const vid = $("song-media-preview-video");
      const wrap = $("song-media-preview-youtube-wrap");
      const frame = $("song-media-preview-youtube");
      const titleEl = $("song-media-preview-title");
      const status = $("song-media-preview-status");
      if (!id || !m || !frame || !wrap) return false;
      if (massSectionAudioEl) {
        try { massSectionAudioEl.pause(); } catch (_eA) {}
        try { massSectionAudioEl.removeAttribute("src"); massSectionAudioEl.load(); } catch (_eB) {}
        massSectionAudioEl = null;
      }
      if (vid) {
        try { vid.pause(); } catch (_e0) {}
        vid.removeAttribute("src");
        try { vid.load(); } catch (_e1) {}
        vid.hidden = true;
      }
      if (titleEl) titleEl.textContent = title || "YouTube preview";
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      wrap.hidden = false;
      frame.src = youtubeEmbedUrl(id);
      m.setAttribute("data-open", "true");
      m.setAttribute("aria-hidden", "false");
      return true;
    }

    async function openSongMediaVideoPreview(title, sourceUrl) {
      const m = $("song-media-preview-modal");
      const vid = $("song-media-preview-video");
      const titleEl = $("song-media-preview-title");
      const status = $("song-media-preview-status");
      if (!m || !vid || !sourceUrl) return false;
      const wrap = $("song-media-preview-youtube-wrap");
      const frame = $("song-media-preview-youtube");
      if (frame) frame.removeAttribute("src");
      if (wrap) wrap.hidden = true;
      vid.hidden = false;
      if (titleEl) titleEl.textContent = title || "Video preview";
      if (status) {
        status.hidden = false;
        status.textContent = "Loading video…";
        status.className = "status song-media-preview-modal__status";
      }
      m.setAttribute("data-open", "true");
      m.setAttribute("aria-hidden", "false");
      try { vid.pause(); } catch (_e0) {}
      let playUrl = sourceUrl;
      try {
        playUrl = await resolvePlayableMediaUrl(sourceUrl, "video/mp4");
      } catch (_e) {
        if (status) {
          status.hidden = false;
          status.textContent = "Could not load that video file.";
          status.className = "status error song-media-preview-modal__status";
        }
        return false;
      }
      vid.src = playUrl;
      try { vid.load(); } catch (_e1) {}
      const onReady = () => {
        if (status) {
          status.hidden = true;
          status.textContent = "";
        }
      };
      const onError = () => {
        if (status) {
          status.hidden = false;
          status.textContent = "This video could not be played in the browser.";
          status.className = "status error song-media-preview-modal__status";
        }
      };
      vid.addEventListener("loadeddata", onReady, { once: true });
      vid.addEventListener("error", onError, { once: true });
      const playPromise = vid.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          if (status) {
            status.hidden = false;
            status.textContent = "Press play on the video to start preview.";
            status.className = "status song-media-preview-modal__status";
          }
        });
      }
      return true;
    }

    async function resolveComposerPlayableMedia(kind) {
      const key = kind === "video" ? "video" : "audio";
      const ref = composerSongMedia && composerSongMedia[key];
      if (!ref || !ref.basename) return null;
      try {
        if (typeof ensureSavedMediaLibrary === "function") {
          await ensureSavedMediaLibrary(false);
        }
      } catch (_e) { /* continue */ }
      const primaryKind = key === "video" ? "video" : "music";
      const secondaryKind = key === "video" ? "music" : "video";
      let row = typeof resolveLibraryMediaRow === "function"
        ? resolveLibraryMediaRow(primaryKind, ref)
        : null;
      if ((!row || !row.url) && typeof resolveLibraryMediaRow === "function") {
        const alt = resolveLibraryMediaRow(secondaryKind, ref);
        if (alt && alt.url) row = alt;
      }
      if ((!row || !row.url)) {
        try {
          if (typeof ensureSavedMediaLibrary === "function") {
            await ensureSavedMediaLibrary(true);
            row = resolveLibraryMediaRow(primaryKind, ref);
            if ((!row || !row.url)) {
              const alt = resolveLibraryMediaRow(secondaryKind, ref);
              if (alt && alt.url) row = alt;
            }
          }
        } catch (_e2) { /* fall through */ }
      }
      if (row && row.url) {
        return Object.assign({}, row, { kind: row.kind || primaryKind });
      }
      if (ref.url) {
        return Object.assign({}, ref, { kind: primaryKind });
      }
      const fallback = fallbackSavedMediaUrl(primaryKind, ref.basename);
      if (!fallback) return null;
      return {
        basename: ref.basename,
        display_name: ref.display_name || ref.basename,
        url: fallback,
        kind: primaryKind,
      };
    }

    async function playComposerSongMedia(kind, playEl) {
      const key = kind === "video" ? "video" : "audio";
      if (key === "audio") {
        if (massSectionAudioPlayingSlot === COMPOSER_SONG_MEDIA_SLOT) {
          stopMassSectionAudio();
          closeSongMediaPreviewModal();
          if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
          return;
        }
        const snippet = composerAudioSnippetRef();
        if (snippet && snippet.basename) {
          await playSavedMusicRef(snippet, COMPOSER_SONG_MEDIA_SLOT, playEl);
          if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
          return;
        }
        if (typeof notify === "function") {
          notify("Link a 5–10s audio clip in Edit Details first.", "warn");
        }
        return;
      }
      const item = await resolveComposerPlayableMedia(key);
      if (!item || !item.url) {
        if (typeof notify === "function") {
          notify("Link an MP4 from Media for this song first.", "warn");
        }
        return;
      }
      stopMassSectionAudio();
      closeSongMediaPreviewModal();
      const title =
        (($("lyrics-save-title") && $("lyrics-save-title").value) || "").trim() ||
        (item.display_name || item.basename) ||
        "Video preview";
      try {
        const opened = await openSongMediaVideoPreview(title, item.url);
        if (!opened && typeof notify === "function") {
          notify("Could not play that video.", "error");
        }
      } catch (_e) {
        if (typeof notify === "function") notify("Could not play that video.", "error");
      }
      void playEl;
    }

    function playComposerYouTube(playEl) {
      const ytSlot = COMPOSER_SONG_YOUTUBE_SLOT;
      if (massSectionAudioPlayingSlot === ytSlot && isYouTubePreviewOpen()) {
        closeSongMediaPreviewModal();
        stopMassSectionAudio();
        if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
        return;
      }
      const ref = composerYoutubeRef();
      if (!ref) {
        if (typeof notify === "function") notify("Link a YouTube URL in Edit Details first.", "warn");
        return;
      }
      stopMassSectionAudio();
      massSectionAudioPlayingSlot = ytSlot;
      openYouTubePreviewModal(youtubeIdFromMediaRef(ref), ref.display_name || "YouTube");
      if (playEl) playEl.classList.add("is-playing");
      if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
    }

    async function playMassSectionAudio(slot, playEl) {
      if (massSectionAudioPlayingSlot === slot) {
        stopMassSectionAudio();
        closeSongMediaPreviewModal();
        return;
      }
      const preview = massSlotPreviewRef(slot);
      const snippet = massSlotAudioSnippetRef(slot);
      if (preview || snippet) {
        await playSavedMusicRef(preview || snippet, slot, playEl);
        return;
      }
      if (typeof notify === "function") {
        notify(
          document.body.classList.contains("is-superadmin")
            ? "Click the song title to link a 5–10s audio clip first."
            : "No audio clip is linked for this option yet.",
          "warn"
        );
      }
    }

    function playMassSectionYouTube(slot, playEl) {
      const ytSlot = youtubePlayingSlot(slot);
      if (massSectionAudioPlayingSlot === ytSlot && isYouTubePreviewOpen()) {
        closeSongMediaPreviewModal();
        stopMassSectionAudio();
        return;
      }
      const youtube = massSlotYoutubeRef(slot);
      if (!youtube) {
        if (typeof notify === "function") notify("Link a YouTube URL for this option first.", "warn");
        return;
      }
      stopMassSectionAudio();
      massSectionAudioPlayingSlot = ytSlot;
      openYouTubePreviewModal(youtubeIdFromMediaRef(youtube), youtube.display_name || "YouTube");
      if (playEl) playEl.classList.add("is-playing");
      refreshMassSectionMediaUi();
    }

    async function playMassSectionVideo(slot, playEl) {
      let item = getMassSectionMedia("video", slot);
      if ((!item || !item.url) && typeof ensureSongSlotVideoFromCatalog === "function") {
        ensureSongSlotVideoFromCatalog(slot);
        item = getMassSectionMedia("video", slot);
      }
      if (item && item.basename && !item.url) {
        item = Object.assign({}, item, {
          url: fallbackSavedMediaUrl("video", item.basename),
        });
        setMassSectionMedia("video", slot, item);
      }
      if (!item || !item.url) {
        if (typeof notify === "function") {
          notify(
            document.body.classList.contains("is-superadmin")
              ? "Link an MP4 from Media for this option first."
              : "No video is linked for this option yet.",
            "warn"
          );
        }
        return;
      }
      stopMassSectionAudio();
      const title = massMediaDisplayLabel(slot) || item.display_name || item.basename || "Video preview";
      try {
        const opened = await openSongMediaVideoPreview(title, item.url);
        if (!opened && typeof notify === "function") {
          notify("Could not play that video preview.", "error");
        }
      } catch (_e) {
        if (typeof notify === "function") notify("Could not play that video preview.", "error");
      }
      void playEl;
    }

    var massMediaPickState = {
      kind: "",
      slot: "",
      purpose: "mass", // mass | song
      songField: "", // audio | video when purpose=song
      loading: false,
    };

    function normalizeComposerMediaRef(raw) {
      if (!raw || typeof raw !== "object") {
        if (typeof raw === "string") return youtubeMediaRefFromInput(raw) || (
          String(raw).trim() ? { basename: String(raw).trim(), display_name: String(raw).trim(), url: "" } : null
        );
        return null;
      }
      const yt = youtubeMediaRefFromInput(
        raw.youtube_id || raw.youtube_url || raw.url || (raw.source === "youtube" ? raw.basename : "") || "",
        raw.display_name
      );
      if (yt) return yt;
      const basename = String(raw.basename || "").trim();
      if (!basename) return null;
      const fromBase = youtubeMediaRefFromInput(basename, raw.display_name);
      if (fromBase) return fromBase;
      return {
        basename: basename,
        display_name: String(raw.display_name || "").trim() || basename,
        url: String(raw.url || "").trim(),
      };
    }

    var composerSongMedia = { audio: null, video: null, preview: null };

    function setComposerSongMediaField(field, item) {
      const key = field === "video" ? "video" : "audio";
      composerSongMedia[key] = item ? normalizeComposerMediaRef(item) : null;
      renderComposerSongMediaFields();
      refreshMetadataModalPrimaryState();
    }

    function setComposerAudioSnippet(item) {
      composerSongMedia.preview = fileToAudioPreviewRef(item) || (item ? normalizeAudioPreviewRef(item) : null);
      renderComposerSongMediaFields();
      refreshMetadataModalPrimaryState();
    }

    function setComposerYouTubeLink(ref) {
      const current = composerSongMedia.audio;
      if (current && !isYouTubeMediaRef(current) && !(composerSongMedia.preview && composerSongMedia.preview.basename)) {
        composerSongMedia.preview = fileToAudioPreviewRef(current);
      }
      composerSongMedia.audio = ref ? normalizeComposerMediaRef(ref) : null;
      renderComposerSongMediaFields();
      refreshMetadataModalPrimaryState();
    }

    function clearComposerAudioSnippet() {
      composerSongMedia.preview = null;
      if (composerSongMedia.audio && !isYouTubeMediaRef(composerSongMedia.audio)) {
        composerSongMedia.audio = null;
      }
      renderComposerSongMediaFields();
      refreshMetadataModalPrimaryState();
    }

    function renderComposerSongMediaFields() {
      const audioLabel = $("song-metadata-audio-label");
      const videoLabel = $("song-metadata-video-label");
      const audioClear = $("song-metadata-audio-clear");
      const videoClear = $("song-metadata-video-clear");
      const audioPlayMeta = $("song-metadata-audio-play");
      const youtubePlayMeta = $("song-metadata-youtube-play");
      const videoPlayMeta = $("song-metadata-video-play");
      const mediaPlayRow = $("lyrics-composer-media-play");
      const audioPlaySummary = $("lyrics-composer-play-audio");
      const youtubePlaySummary = $("lyrics-composer-play-youtube");
      const videoPlaySummary = $("lyrics-composer-play-video");
      const video = composerSongMedia.video;
      const preview = composerSongMedia.preview;
      const snippet = composerAudioSnippetRef();
      const youtube = composerYoutubeRef();
      const snippetOn = !!(snippet && snippet.basename);
      const youtubeOn = !!youtube;
      const videoOn = !!(video && video.basename);
      const audioPlaying = massSectionAudioPlayingSlot === COMPOSER_SONG_MEDIA_SLOT;
      const youtubePlaying = massSectionAudioPlayingSlot === COMPOSER_SONG_YOUTUBE_SLOT;
      if (audioLabel) {
        audioLabel.textContent = snippetOn
          ? (snippet.display_name || snippet.basename)
          : "None linked";
      }
      const ytInp = $("song-metadata-audio-youtube");
      const ytSearch = $("song-metadata-audio-youtube-search");
      const ytClear = $("song-metadata-audio-youtube-clear");
      if (ytInp && document.activeElement !== ytInp) {
        ytInp.value = youtube ? (youtube.youtube_url || youtubeWatchUrl(youtubeIdFromMediaRef(youtube))) : "";
      }
      if (ytSearch) ytSearch.hidden = !!youtube;
      if (ytClear) ytClear.hidden = !youtube;
      if (videoLabel) {
        videoLabel.textContent = video
          ? (video.display_name || video.basename)
          : "None linked";
      }
      if (audioClear) audioClear.hidden = !snippetOn;
      if (videoClear) videoClear.hidden = !videoOn;
      if (audioPlayMeta) {
        audioPlayMeta.hidden = !snippetOn;
        audioPlayMeta.disabled = !snippetOn;
        audioPlayMeta.classList.toggle("is-ready", snippetOn);
        audioPlayMeta.classList.toggle("is-playing", snippetOn && audioPlaying);
        audioPlayMeta.textContent = snippetOn && audioPlaying ? "Pause" : "Play";
      }
      if (youtubePlayMeta) {
        youtubePlayMeta.hidden = !youtubeOn;
        youtubePlayMeta.disabled = !youtubeOn;
        youtubePlayMeta.classList.toggle("is-ready", youtubeOn);
        youtubePlayMeta.classList.toggle("is-playing", youtubeOn && youtubePlaying);
        youtubePlayMeta.textContent = youtubeOn && youtubePlaying ? "Close" : "Play";
      }
      if (videoPlayMeta) {
        videoPlayMeta.hidden = !videoOn;
        videoPlayMeta.disabled = !videoOn;
        videoPlayMeta.classList.toggle("is-ready", videoOn);
      }
      if (mediaPlayRow) mediaPlayRow.hidden = !(snippetOn || youtubeOn || videoOn);
      if (audioPlaySummary) {
        audioPlaySummary.disabled = !snippetOn;
        audioPlaySummary.classList.toggle("is-ready", snippetOn);
        audioPlaySummary.classList.toggle("is-playing", snippetOn && audioPlaying);
        audioPlaySummary.textContent = snippetOn && audioPlaying
          ? "❚❚ Pause clip"
          : (snippetOn
            ? ("▶ Play " + ((preview && preview.duration_sec) || 10) + "s clip")
            : "▶ Play clip");
        audioPlaySummary.title = snippetOn
          ? (snippet.display_name || snippet.basename)
          : "Link a 5–10s audio clip in Edit Details first";
      }
      if (youtubePlaySummary) {
        youtubePlaySummary.hidden = !youtubeOn;
        youtubePlaySummary.disabled = !youtubeOn;
        youtubePlaySummary.classList.toggle("is-ready", youtubeOn);
        youtubePlaySummary.classList.toggle("is-playing", youtubeOn && youtubePlaying);
        youtubePlaySummary.textContent = youtubeOn && youtubePlaying ? "❚❚ Close YouTube" : "▶ Play YouTube";
        youtubePlaySummary.title = youtubeOn
          ? (youtube.display_name || "YouTube full song")
          : "Link YouTube in Edit Details first";
      }
      if (videoPlaySummary) {
        videoPlaySummary.disabled = !videoOn;
        videoPlaySummary.classList.toggle("is-ready", videoOn);
        videoPlaySummary.title = videoOn
          ? (video.display_name || video.basename)
          : "Link video in Edit Details first";
      }
    }

    function setMassMediaPickLoading(active, message) {
      const loading = $("mw-media-pick-loading");
      const list = $("mw-media-pick-list");
      const text = $("mw-media-pick-loading-text");
      massMediaPickState.loading = !!active;
      if (text && message) text.textContent = message;
      if (loading) loading.hidden = !active;
      if (list) list.hidden = !!active;
    }

    function currentComposerSongQuery() {
      let title = "";
      let author = "";
      let lang = "";
      const metaOpen = $("song-metadata-modal") && $("song-metadata-modal").classList.contains("is-open");
      if (metaOpen) {
        title = String(($("song-metadata-edit-title") && $("song-metadata-edit-title").value) || "").trim();
        author = String(($("song-metadata-edit-author") && $("song-metadata-edit-author").value) || "").trim();
        lang = String(($("song-metadata-edit-language") && $("song-metadata-edit-language").value) || "").trim();
      }
      if (!title) title = String(($("lyrics-save-title") && $("lyrics-save-title").value) || "").trim();
      if (!author) author = String(($("lyrics-save-author") && $("lyrics-save-author").value) || "").trim();
      if (!lang && typeof getComposerSongLanguage === "function") lang = getComposerSongLanguage() || "";
      title = title.replace(/\s+/g, " ").trim();
      if (!title) return "";
      let query = title;
      if (typeof songTitleWithLanguageForSearch === "function") {
        query = songTitleWithLanguageForSearch(title, lang) || title;
      } else if (lang && query.toLowerCase().indexOf(lang.toLowerCase()) === -1) {
        query = query + " " + lang;
      }
      if (author && query.toLowerCase().indexOf(author.toLowerCase()) === -1) {
        query = query + " " + author;
      }
      return query.replace(/\s+/g, " ").trim();
    }

    function currentMediaPickSongQuery() {
      const state = massMediaPickState || {};
      const metaOpen = $("song-metadata-modal") && $("song-metadata-modal").classList.contains("is-open");
      if (state.purpose === "song" || metaOpen) {
        return currentComposerSongQuery();
      }
      let title = "";
      let author = "";
      let lang = "";
      const slot = String(state.slot || "").trim();
      const songId = (typeof selectedLyricsSongs !== "undefined" && selectedLyricsSongs && selectedLyricsSongs[slot]) || "";
      const row = songId && typeof lookupMassPlanSong === "function" ? lookupMassPlanSong(songId) : null;
      if (row) {
        title = String(row.title || "").trim();
        author = String(row.author || "").trim();
        lang = String(row.language || "").trim();
      }
      if (!title && songId && typeof catalogSongTitle === "function") {
        const section = typeof catalogSectionForSlot === "function" ? catalogSectionForSlot(slot) : slot;
        title = catalogSongTitle(section, songId) || "";
      }
      title = title.replace(/\s+/g, " ").trim();
      if (!title) return "";
      let query = title;
      if (typeof songTitleWithLanguageForSearch === "function") {
        query = songTitleWithLanguageForSearch(title, lang) || title;
      } else if (lang && query.toLowerCase().indexOf(lang.toLowerCase()) === -1) {
        query = query + " " + lang;
      }
      if (author && query.toLowerCase().indexOf(author.toLowerCase()) === -1) {
        query = query + " " + author;
      }
      return query.replace(/\s+/g, " ").trim();
    }

    function youtubeSearchUrlForQuery(query) {
      const q = String(query || "").trim();
      if (!q) return "https://www.youtube.com/";
      return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
    }

    function withInstrumentalSearchSuffix(query) {
      const q = String(query || "").replace(/\s+/g, " ").trim();
      if (!q) return "instrumental";
      if (/\binstrumental\b/i.test(q)) return q;
      return (q + " instrumental").replace(/\s+/g, " ").trim();
    }

    function openYouTubeSearchForCurrentSong(opts) {
      const options = opts || {};
      let query = currentMediaPickSongQuery();
      if (options.instrumental) query = withInstrumentalSearchSuffix(query);
      const url = youtubeSearchUrlForQuery(query);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened && typeof notify === "function") {
        notify(
          query
            ? (options.instrumental
              ? "Allow pop-ups to search YouTube for an instrumental version."
              : "Allow pop-ups to search YouTube for this song.")
            : "Allow pop-ups to open YouTube.",
          "warn"
        );
      }
    }

    function openYouTubeSearchForComposerSong(opts) {
      const options = opts || {};
      let query = currentComposerSongQuery();
      if (options.instrumental) query = withInstrumentalSearchSuffix(query);
      const url = youtubeSearchUrlForQuery(query);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened && typeof notify === "function") {
        notify(
          query
            ? (options.instrumental
              ? "Allow pop-ups to search YouTube for an instrumental version."
              : "Allow pop-ups to search YouTube for this song.")
            : "Allow pop-ups to open YouTube.",
          "warn"
        );
      }
    }

    function clearMassYouTubeLink(slot, opts) {
      const options = opts || {};
      const key = String(slot || "").trim();
      if (!key) return false;
      const youtube = massSlotYoutubeRef(key);
      if (!youtube) return false;
      if (!options.skipConfirm && !confirmUnlinkMedia("this YouTube full-song link")) return false;
      if (massSectionAudioPlayingSlot === youtubePlayingSlot(key)) {
        closeSongMediaPreviewModal();
        stopMassSectionAudio();
      }
      const item = getMassSectionMedia("audio", key);
      if (isYouTubeMediaRef(item)) setMassSectionMedia("audio", key, null);
      void persistMassSlotYoutubeToCatalogSong(key, null);
      if (typeof notify === "function") notify("Cleared YouTube link.", "ok");
      return true;
    }

    function clearComposerYouTubeLink(opts) {
      const options = opts || {};
      if (!composerYoutubeRef()) return false;
      if (!options.skipConfirm && !confirmUnlinkMedia("this YouTube full-song link")) return false;
      if (massSectionAudioPlayingSlot === COMPOSER_SONG_YOUTUBE_SLOT) {
        closeSongMediaPreviewModal();
        stopMassSectionAudio();
      }
      setComposerYouTubeLink(null);
      if (typeof notify === "function") notify("Cleared YouTube link.", "ok");
      return true;
    }

    function refreshMassMediaPickYoutubeTabLabel() {
      const ytTab = $("mw-media-pick-tab-youtube");
      const query = currentMediaPickSongQuery();
      if (ytTab) {
        ytTab.title = query
          ? ("Search YouTube for “" + query + "”")
          : "Search YouTube for this song";
      }
    }

    function setMassMediaPickTab(tab) {
      const next = (tab === "upload" || tab === "youtube" || tab === "fetch") ? tab : "library";
      const libTab = $("mw-media-pick-tab-library");
      const fetchTab = $("mw-media-pick-tab-fetch");
      const upTab = $("mw-media-pick-tab-upload");
      const ytTab = $("mw-media-pick-tab-youtube");
      const libPane = $("mw-media-pick-pane-library");
      const fetchPane = $("mw-media-pick-pane-fetch");
      const upPane = $("mw-media-pick-pane-upload");
      const ytPane = $("mw-media-pick-pane-youtube");
      if (libTab) {
        libTab.classList.toggle("is-active", next === "library");
        libTab.setAttribute("aria-selected", next === "library" ? "true" : "false");
      }
      if (fetchTab) {
        fetchTab.classList.toggle("is-active", next === "fetch");
        fetchTab.setAttribute("aria-selected", next === "fetch" ? "true" : "false");
      }
      if (upTab) {
        upTab.classList.toggle("is-active", next === "upload");
        upTab.setAttribute("aria-selected", next === "upload" ? "true" : "false");
      }
      if (ytTab) {
        ytTab.classList.toggle("is-active", next === "youtube");
        ytTab.setAttribute("aria-selected", next === "youtube" ? "true" : "false");
      }
      if (libPane) libPane.hidden = next !== "library";
      if (fetchPane) fetchPane.hidden = next !== "fetch";
      if (upPane) upPane.hidden = next !== "upload";
      if (ytPane) ytPane.hidden = next !== "youtube";
      if (next === "youtube") {
        const inp = $("mw-media-pick-youtube-url");
        if (inp) window.requestAnimationFrame(() => inp.focus());
      }
      if (next === "fetch") {
        const inp = $("mw-media-pick-fetch-url");
        if (inp) window.requestAnimationFrame(() => inp.focus());
        refreshMassMediaPickFetchUi();
      }
    }

    function massMediaPickSongTarget() {
      if (massMediaPickState.purpose === "song") {
        if (composerLoadedSong && composerLoadedSong.id) {
          return {
            section: String(composerLoadedSong.section || "").trim(),
            id: String(composerLoadedSong.id || "").trim(),
            title: String(composerLoadedSong.title || "").trim(),
            row: null,
          };
        }
        return null;
      }
      const assigned = massSlotAssignedSong(massMediaPickState.slot);
      if (!assigned || !assigned.id) return null;
      return {
        section: String(assigned.section || "").trim(),
        id: String(assigned.id || "").trim(),
        title: String((assigned.row && assigned.row.title) || "").trim(),
        row: assigned.row || null,
      };
    }

    function massMediaPickFetchIsInstrumental() {
      return massMediaPickState.kind === "video" || massMediaPickState.songField === "video";
    }

    function syncMassMediaPickFetchPaneMode(isInstrumental) {
      const instrumental = !!isInstrumental;
      const hint = document.querySelector("#mw-media-pick-pane-fetch .mw-rite__hint");
      const durWrap = $("mw-media-pick-fetch-duration");
      const durField = durWrap ? durWrap.closest(".field") : null;
      const urlLabel = document.querySelector("label[for=\"mw-media-pick-fetch-url\"]");
      const runBtn = $("mw-media-pick-fetch-run");
      const searchBtn = $("mw-media-pick-fetch-search");
      if (hint) {
        hint.textContent = instrumental
          ? "Search YouTube for an instrumental version of this song (query adds “instrumental”), paste that URL, then download the full video. This is separate from the 10s audio clip and the choir-practice YouTube link."
          : "Paste a YouTube URL and fetch a 5–10s chorus clip. Captions are scanned for the chorus (or first verse). This does not replace the song’s full YouTube practice link.";
      }
      if (durField) durField.hidden = instrumental;
      if (urlLabel) {
        urlLabel.textContent = instrumental ? "YouTube URL (instrumental video)" : "YouTube URL (clip source)";
      }
      if (runBtn && !runBtn.disabled) {
        runBtn.textContent = instrumental ? "Download video" : "Fetch clip";
      }
      if (searchBtn) {
        searchBtn.title = instrumental
          ? "Search YouTube for this song + instrumental"
          : "Search YouTube for this song";
        searchBtn.textContent = instrumental ? "Search instrumental" : "Search";
      }
    }
    window.syncMassMediaPickFetchPaneMode = syncMassMediaPickFetchPaneMode;

    function massMediaPickFetchDurationSec() {
      const el = $("mw-media-pick-fetch-duration");
      const n = el ? parseInt(el.value, 10) : 10;
      return Math.max(5, Math.min(10, Number.isFinite(n) ? n : 10));
    }

    function refreshMassMediaPickFetchUi() {
      const target = massMediaPickSongTarget();
      const statusEl = $("mw-media-pick-fetch-status");
      const playBtn = $("mw-media-pick-fetch-play");
      const urlEl = $("mw-media-pick-fetch-url");
      const instrumental = massMediaPickFetchIsInstrumental();
      syncMassMediaPickFetchPaneMode(instrumental);
      let preview = null;
      let video = null;
      let youtube = null;
      if (massMediaPickState.purpose === "song") {
        preview = composerSongMedia && composerSongMedia.preview;
        video = composerSongMedia && composerSongMedia.video;
        youtube = typeof composerYoutubeRef === "function" ? composerYoutubeRef() : null;
      } else {
        preview = massSlotPreviewRef(massMediaPickState.slot);
        video = getMassSectionMedia("video", massMediaPickState.slot);
        youtube = massSlotYoutubeRef(massMediaPickState.slot);
      }
      preview = normalizeAudioPreviewRef(preview);
      video = video ? normalizeComposerMediaRef(video) : null;
      if (urlEl && document.activeElement !== urlEl) {
        if (instrumental) {
          // Instrumental uses its own YouTube source — do not reuse the practice/audio link.
          if (!String(urlEl.value || "").trim()) urlEl.value = "";
        } else {
          const fromPreview = preview && (preview.youtube_url || "");
          const fromYt = youtube && (youtube.youtube_url || youtubeWatchUrl(youtubeIdFromMediaRef(youtube)));
          urlEl.value = fromPreview || fromYt || "";
        }
      }
      const ready = instrumental
        ? !!(video && video.basename && !isYouTubeMediaRef(video))
        : !!(preview && preview.basename);
      if (playBtn) {
        playBtn.hidden = !ready;
        playBtn.disabled = !ready;
        playBtn.classList.toggle("is-ready", ready);
      }
      if (statusEl && !statusEl.dataset.fetching) {
        if (!target || !target.id) {
          statusEl.textContent = instrumental
            ? "Choose a song first, then download the video."
            : "Choose a song first, then fetch a clip.";
          statusEl.className = "status mw-media-pick-fetch-status";
        } else if (ready) {
          statusEl.textContent = instrumental
            ? ((video.display_name || video.basename) + " ready.")
            : ((preview.duration_sec || 10) + "s clip ready.");
          statusEl.className = "status ok mw-media-pick-fetch-status";
        } else {
          statusEl.textContent = instrumental
            ? "No instrumental video yet — paste a YouTube URL and download."
            : "No clip yet — paste a YouTube URL and fetch.";
          statusEl.className = "status mw-media-pick-fetch-status";
        }
      }
    }

    async function runMassMediaPickFetch() {
      const target = massMediaPickSongTarget();
      const statusEl = $("mw-media-pick-fetch-status");
      const btn = $("mw-media-pick-fetch-run");
      const urlEl = $("mw-media-pick-fetch-url");
      const instrumental = massMediaPickFetchIsInstrumental();
      if (!target || !target.section || !target.id) {
        if (typeof notify === "function") notify("Choose a song first.", "warn");
        return;
      }
      const youtubeUrl = String((urlEl && urlEl.value) || "").trim();
      const ref = youtubeUrl ? youtubeMediaRefFromInput(youtubeUrl, target.title || "YouTube") : null;
      if (!ref) {
        if (typeof notify === "function") notify("Enter a valid YouTube URL to fetch from.", "warn");
        return;
      }
      if (urlEl) urlEl.value = ref.youtube_url || youtubeUrl;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Queued…";
      }
      if (statusEl) {
        statusEl.dataset.fetching = "1";
        statusEl.textContent = instrumental
          ? "Downloading full instrumental video…"
          : "Scanning captions and fetching clip…";
        statusEl.className = "status mw-media-pick-fetch-status";
      }
      previewFetchState.attempted[target.section + ":" + target.id] = true;
      try {
        if (instrumental) {
          await startInstrumentalFetchJob({
            section: target.section,
            id: target.id,
            title: target.title || "this song",
            youtube_url: ref.youtube_url || youtubeUrl,
            toast: true,
          });
        } else {
          await startPreviewFetchJob({
            section: target.section,
            id: target.id,
            title: target.title || "this song",
            youtube_url: ref.youtube_url || youtubeUrl,
            duration_sec: massMediaPickFetchDurationSec(),
            toast: true,
          });
        }
        if (statusEl) {
          statusEl.textContent = "Fetch started — watch the progress bar below.";
          statusEl.className = "status ok mw-media-pick-fetch-status";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = (err && err.message) || (instrumental
            ? "Could not start video download."
            : "Could not start clip fetch.");
          statusEl.className = "status error mw-media-pick-fetch-status";
        }
        if (typeof notify === "function") {
          notify(
            (err && err.message) || (instrumental ? "Could not start video download." : "Could not start clip fetch."),
            "warn"
          );
        }
      } finally {
        if (statusEl) delete statusEl.dataset.fetching;
        if (btn) {
          btn.disabled = false;
          btn.textContent = instrumental ? "Download video" : "Fetch clip";
        }
      }
    }

    function applyMassMediaPickSelection(row) {
      if (!row || !row.basename) return;
      if (massMediaPickState.kind === "video") {
        if (videoAssignedToOtherDomain(row.basename)) {
          if (typeof notify === "function") {
            notify("That video is already used in another part of Mass. Pick a different file.", "warn");
          }
          return;
        }
        const taken = videoAssignmentElsewhere(row.basename);
        if (taken) {
          if (typeof notify === "function") {
            notify("Already assigned to " + taken + ". Pick a different video.", "warn");
          }
          return;
        }
      }
      if (massMediaPickState.purpose === "song") {
        if ((massMediaPickState.songField || "audio") === "video") {
          setComposerSongMediaField("video", row);
        } else {
          setComposerAudioSnippet(row);
        }
        closeMassMediaPickModal();
        if (typeof notify === "function") {
          notify(
            (massMediaPickState.songField === "video" ? "Instrumental video" : "Audio clip") + " linked to this song.",
            "ok"
          );
        }
        return;
      }
      const pickKind = massMediaPickState.kind;
      const pickSlot = massMediaPickState.slot;
      if (!pickKind || !pickSlot) return;
      if (pickKind === "audio") {
        const current = getMassSectionMedia("audio", pickSlot);
        if (!isYouTubeMediaRef(current)) setMassSectionMedia("audio", pickSlot, row);
        void persistMassSlotPreviewToCatalogSong(pickSlot, row);
        closeMassMediaPickModal();
        if (typeof updateMassSlotChip === "function") updateMassSlotChip(pickSlot);
        if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(pickSlot);
        if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
        if (typeof notify === "function") {
          notify("Audio clip linked — for ministry practice only (not added to the PowerPoint).", "ok");
        }
        return;
      }
      setMassSectionMedia(pickKind, pickSlot, row);
      const pendingSongVideo = pickKind === "video" && massSongVideoPickPendingSlot === pickSlot;
      if (pendingSongVideo) {
        massSongVideoPickPendingSlot = "";
        setMassSongVideoMode(pickSlot, true);
      }
      const pendingRite =
        pickKind === "video" &&
        massRiteVideoPickPending &&
        massRiteVideoPickPending.slot === pickSlot;
      if (pendingRite) {
        const sec = massRiteVideoPickPending.section;
        const lang = massRiteVideoPickPending.lang;
        massRiteVideoPickPending = null;
        window.massRiteVideoMode = window.massRiteVideoMode || {};
        window.massRiteVideoLang = window.massRiteVideoLang || {};
        window.massRiteVideoMode[sec] = true;
        window.massRiteVideoLang[sec] = lang;
        if (typeof syncRiteVideoUi === "function") syncRiteVideoUi(sec);
      }
      closeMassMediaPickModal();
      if (typeof notify === "function") {
        if (pickKind === "video") {
          notify(
            pendingSongVideo || pendingRite || getMassSongVideoMode(pickSlot)
              ? "PowerPoint will use this video instead of lyric slides."
              : "Video file linked. Choose Video in Lyrics|Video to use it in the PowerPoint.",
            "ok"
          );
        } else {
          notify("Audio preview linked — for ministry practice only (not added to the PowerPoint).", "ok");
        }
      }
    }

    function closeMassMediaPickModal() {
      const m = $("mw-media-pick-modal");
      if (!m) return;
      m.setAttribute("data-open", "false");
      m.setAttribute("aria-hidden", "true");
      massMediaPickState = {
        kind: "",
        slot: "",
        purpose: "mass",
        songField: "",
        loading: false,
        youtubeOnly: false,
        fromTitle: false,
      };
      const card = document.querySelector(".mw-media-pick-card");
      if (card) card.classList.remove("is-lyrics-access-only");
      setMassMediaPickLoading(false);
      const status = $("mw-media-pick-upload-status");
      if (status) {
        status.textContent = "";
        status.className = "status mw-media-pick-upload-status";
      }
      if ($("mw-media-pick-file")) $("mw-media-pick-file").value = "";
      refreshMassMediaPickLyricsUi();
    }

    function openMassSongLyricsModal(opts) {
      const options = opts || {};
      const modal = $("mass-song-lyrics-modal");
      const titleEl = $("mass-song-lyrics-title");
      const metaEl = $("mass-song-lyrics-meta");
      const bodyEl = $("mass-song-lyrics-body");
      const statusEl = $("mass-song-lyrics-status");
      if (!modal || !bodyEl) return;
      const title = String(options.title || "Lyrics").trim() || "Lyrics";
      const language = String(options.language || "").trim();
      const author = String(options.author || "").trim();
      const lyrics = String(options.lyrics || "").trim();
      if (titleEl) titleEl.textContent = title;
      if (metaEl) {
        const bits = [];
        if (language) bits.push(language);
        if (author) bits.push("Author: " + author);
        if (bits.length) {
          metaEl.hidden = false;
          metaEl.textContent = bits.join(" · ");
        } else {
          metaEl.hidden = true;
          metaEl.textContent = "";
        }
      }
      bodyEl.textContent = lyrics || "No lyrics saved for this song.";
      if (statusEl) statusEl.hidden = true;
      modal.setAttribute("data-open", "true");
      modal.setAttribute("aria-hidden", "false");
    }

    function closeMassSongLyricsModal() {
      const modal = $("mass-song-lyrics-modal");
      if (!modal) return;
      modal.setAttribute("data-open", "false");
      modal.setAttribute("aria-hidden", "true");
      const bodyEl = $("mass-song-lyrics-body");
      if (bodyEl) bodyEl.textContent = "";
    }

    async function openMassSongLyricsForSlot(slotKey) {
      const key = String(slotKey || "").trim();
      const assigned = massSlotAssignedSong(key);
      if (!assigned || !assigned.id) {
        if (typeof notify === "function") notify("Choose a song first.", "warn");
        return;
      }
      const btn = $("mw-media-pick-view-lyrics");
      const statusEl = $("mass-song-lyrics-status");
      const bodyEl = $("mass-song-lyrics-body");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Loading…";
      }
      try {
        const data = await fetchSongDetail(assigned.section, assigned.id);
        const song = (data && data.song) || {};
        const lyrics = String(song.lyrics || "").trim();
        if (!lyrics) {
          if (typeof notify === "function") notify("No lyrics saved for this song.", "warn");
          return;
        }
        openMassSongLyricsModal({
          title: song.title || (assigned.row && assigned.row.title) || "Lyrics",
          author: song.author || "",
          language: song.language || "",
          lyrics: lyrics,
        });
      } catch (err) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = err.message || "Could not load lyrics.";
          statusEl.className = "status error";
        } else if (typeof notify === "function") {
          notify(err.message || "Could not load lyrics.", "error");
        }
        if (bodyEl) bodyEl.textContent = "";
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "View lyrics";
        }
        refreshMassMediaPickLyricsUi();
      }
    }

    async function openMassSongLyricsFromMediaPick() {
      const slot = massMediaPickState && massMediaPickState.slot;
      if (!slot) return;
      await openMassSongLyricsForSlot(slot);
    }

    function refreshMassMediaPickLyricsUi() {
      const btn = $("mw-media-pick-view-lyrics");
      const card = document.querySelector(".mw-media-pick-card");
      if (!btn) return;
      const state = massMediaPickState || {};
      const isMass = state.purpose === "mass";
      const isSa = !!(document.body.classList.contains("is-superadmin") ||
        (churchMembershipState && churchMembershipState.is_superadmin));
      const lyricsOnly = isMass && !isSa && !state.youtubeOnly;
      const target = isMass ? massMediaPickSongTarget() : null;
      const hasLyrics = !!(target && target.row && target.row.has_lyrics);
      if (card) card.classList.toggle("is-lyrics-access-only", lyricsOnly);
      btn.hidden = !isMass || !target;
      btn.disabled = !hasLyrics;
      btn.title = hasLyrics ? "Open scrollable lyrics" : "No lyrics saved for this song";
    }

    function clearMassMediaPickSelection() {
      const youtubeOnly = !!(massMediaPickState && massMediaPickState.youtubeOnly);
      const kind = massMediaPickState.kind === "video" ? "video" : "audio";
      const label = youtubeOnly
        ? "this YouTube full-song link"
        : (kind === "video" ? "this instrumental video" : "this audio clip");
      if (!confirmUnlinkMedia(label)) return;
      if (massMediaPickState.purpose === "song") {
        if (youtubeOnly) {
          clearComposerYouTubeLink({ skipConfirm: true });
        } else if ((massMediaPickState.songField || "audio") === "video") {
          setComposerSongMediaField("video", null);
        } else {
          if (massSectionAudioPlayingSlot === COMPOSER_SONG_MEDIA_SLOT) stopMassSectionAudio();
          clearComposerAudioSnippet();
        }
        closeMassMediaPickModal();
        if (typeof notify === "function") notify("Cleared media link.", "ok");
        return;
      }
      if (!massMediaPickState.kind || !massMediaPickState.slot) return;
      const slot = massMediaPickState.slot;
      if (youtubeOnly) {
        clearMassYouTubeLink(slot, { skipConfirm: true });
      } else if (kind === "audio") {
        if (massSectionAudioPlayingSlot === slot) stopMassSectionAudio();
        const cur = getMassSectionMedia("audio", slot);
        if (cur && !isYouTubeMediaRef(cur)) setMassSectionMedia("audio", slot, null);
        void persistMassSlotPreviewToCatalogSong(slot, null);
      } else {
        setMassSectionMedia(kind, slot, null);
      }
      closeMassMediaPickModal();
      if (typeof notify === "function") notify("Cleared media link.", "ok");
    }

    function massVideoAssignmentDomain(slot) {
      const parsed = parseMassMediaKey(slot);
      const sec = String((parsed && parsed.section) || slot || "").trim().toLowerCase();
      if (MASS_RITE_VIDEO_MODE_SECTIONS.has(sec) || MASS_RITE_OPTION_SECTIONS.has(sec)) return "rite";
      return "music";
    }

    function mediaPickVideoDomain() {
      if (massMediaPickState && massMediaPickState.purpose === "song") return "music";
      return massVideoAssignmentDomain((massMediaPickState && massMediaPickState.slot) || "");
    }

    function massVideoAssignmentMap() {
      const map = {};
      const add = (basename, slot, label, domain) => {
        const base = String(basename || "").trim();
        if (!base) return;
        if (!map[base]) map[base] = [];
        map[base].push({
          slot: String(slot || ""),
          label: String(label || slot || "Mass"),
          domain: domain || "music",
        });
      };
      const bucket = (massSectionMedia && massSectionMedia.video) || {};
      Object.keys(bucket).forEach((slot) => {
        const item = bucket[slot];
        add(
          item && item.basename,
          slot,
          massMediaDisplayLabel(slot),
          massVideoAssignmentDomain(slot)
        );
      });
      const catalog = (typeof songCatalogData !== "undefined" && songCatalogData) ? songCatalogData : null;
      if (catalog && typeof catalog === "object") {
        Object.keys(catalog).forEach((sec) => {
          (catalog[sec] || []).forEach((row) => {
            if (!row || !row.video_media) return;
            const ref = typeof normalizeComposerMediaRef === "function"
              ? normalizeComposerMediaRef(row.video_media)
              : row.video_media;
            const base = ref && (ref.basename || ref);
            if (!base) return;
            const title = String(row.title || row.id || "Song").trim() || "Song";
            add(base, "song:" + sec + ":" + String(row.id || ""), "Song · " + title, "music");
          });
        });
      }
      return map;
    }

    function videoAssignmentElsewhere(basename) {
      const base = String(basename || "").trim();
      if (!base) return "";
      if (isCurrentMediaPickBasename(base)) return "";
      const currentSlot = String((massMediaPickState && massMediaPickState.slot) || "");
      const purpose = massMediaPickState && massMediaPickState.purpose;
      const pickDomain = mediaPickVideoDomain();
      const entries = (massVideoAssignmentMap()[base] || []).filter((entry) => {
        if (entry.domain !== pickDomain) return false;
        if (purpose === "song") return true;
        return entry.slot !== currentSlot;
      });
      if (!entries.length) return "";
      const labels = [];
      entries.forEach((entry) => {
        if (labels.indexOf(entry.label) < 0) labels.push(entry.label);
      });
      return labels.join(", ");
    }

    function videoAssignedToOtherDomain(basename) {
      const base = String(basename || "").trim();
      if (!base || isCurrentMediaPickBasename(base)) return false;
      const pickDomain = mediaPickVideoDomain();
      return (massVideoAssignmentMap()[base] || []).some((entry) => entry.domain !== pickDomain);
    }

    function isCurrentMediaPickBasename(basename) {
      const base = String(basename || "").trim();
      if (!base) return false;
      if (massMediaPickState.purpose === "song") {
        if (massMediaPickState.songField === "video") {
          const cur = composerSongMedia && composerSongMedia.video;
          return !!(cur && cur.basename === base);
        }
        const cur = typeof composerAudioSnippetRef === "function" ? composerAudioSnippetRef() : null;
        return !!(cur && cur.basename === base);
      }
      const cur = getMassSectionMedia(massMediaPickState.kind, massMediaPickState.slot);
      return !!(cur && cur.basename === base);
    }

    function renderMassMediaPickList() {
      const list = $("mw-media-pick-list");
      if (!list) return;
      const kind = massMediaPickState.kind === "video" ? "video" : "music";
      const q = (($("mw-media-pick-q") && $("mw-media-pick-q").value) || "").trim().toLowerCase();
      const rows = (kind === "video" ? savedMediaLibrary.video : savedMediaLibrary.music) || [];
      const filtered = rows.filter((item) => {
        if (!q) return true;
        const hay = ((item.display_name || "") + " " + (item.basename || "")).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      if (!filtered.length) {
        list.innerHTML = "<li class=\"muted\">No " + (kind === "video" ? "videos" : "audio files") +
          " found. Switch to Upload to add one.</li>";
        return;
      }
      const lockAssigned = kind === "video";
      const visible = filtered.filter((item) => {
        if (!lockAssigned) return true;
        if (isCurrentMediaPickBasename(item.basename)) return true;
        return !videoAssignedToOtherDomain(item.basename);
      });
      if (!visible.length) {
        list.innerHTML = "<li class=\"muted\">No " + (kind === "video" ? "videos" : "audio files") +
          " found. Switch to Upload to add one.</li>";
        return;
      }
      list.innerHTML = visible.map((item) => {
        const title = item.display_name || item.basename || "Media";
        const current = isCurrentMediaPickBasename(item.basename);
        const usedWhere = lockAssigned && !current ? videoAssignmentElsewhere(item.basename) : "";
        const taken = !!usedWhere;
        const meta = taken
          ? ("Assigned to " + usedWhere)
          : (current ? "Linked here" : "");
        return (
          "<li><button type=\"button\" class=\"mw-media-pick-item" +
            (taken ? " is-taken" : "") +
            (current ? " is-current" : "") +
            "\" data-pick-basename=\"" + escapeHtml(item.basename) + "\"" +
            (taken ? " disabled aria-disabled=\"true\"" : "") +
            (taken ? " title=\"" + escapeHtml("Already assigned to " + usedWhere) + "\"" : "") +
            ">" +
            "<span class=\"mw-media-pick-item__text\">" +
              "<span class=\"mw-media-pick-item__title\">" + escapeHtml(title) + "</span>" +
              (meta ? "<span class=\"mw-media-pick-item__used\">" + escapeHtml(meta) + "</span>" : "") +
            "</span>" +
          "</button></li>"
        );
      }).join("");
      list.querySelectorAll("[data-pick-basename]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.disabled || btn.classList.contains("is-taken")) return;
          const basename = btn.getAttribute("data-pick-basename");
          const row = rows.find((r) => r.basename === basename);
          if (!row) return;
          applyMassMediaPickSelection(row);
        });
      });
    }

    function massSlotAssignedSong(slot) {
      const key = String(slot || "").trim();
      const songId = String((typeof selectedLyricsSongs !== "undefined" && selectedLyricsSongs && selectedLyricsSongs[key]) || "").trim();
      if (!songId) return null;
      const row = typeof lookupMassPlanSong === "function" ? lookupMassPlanSong(songId) : null;
      const section = String(
        (row && row.section) ||
        (typeof catalogSectionForSlot === "function" ? catalogSectionForSlot(key) : key) ||
        ""
      ).trim().toLowerCase();
      return { id: songId, section: section, row: row };
    }

    function updateLocalCatalogSongAudio(section, songId, audioRef) {
      const id = String(songId || "").trim();
      if (!id) return;
      const secs = ["entrance", "offertory", "communion", "recessional", "meditation"];
      const prefer = String(section || "").trim().toLowerCase();
      const ordered = prefer && secs.indexOf(prefer) >= 0
        ? [prefer].concat(secs.filter((s) => s !== prefer))
        : secs;
      const ref = audioRef ? normalizeComposerMediaRef(audioRef) : null;
      if (typeof songCatalogData !== "undefined" && songCatalogData) {
        ordered.forEach((sec) => {
          if (!Array.isArray(songCatalogData[sec])) return;
          const idx = songCatalogData[sec].findIndex((r) => String(r.id) === id);
          if (idx < 0) return;
          const next = Object.assign({}, songCatalogData[sec][idx]);
          next.audio_media = ref ? (serializeSongMediaRef(ref) || ref) : null;
          songCatalogData[sec][idx] = next;
        });
      }
      if (typeof rebuildMassPlanSongPool === "function") rebuildMassPlanSongPool();
      if (typeof songDetailCache !== "undefined" && typeof songDetailCacheKey === "function") {
        ordered.forEach((sec) => {
          const key = songDetailCacheKey(sec, id);
          if (!songDetailCache.has(key)) return;
          const data = songDetailCache.get(key);
          if (!data || !data.song) return;
          data.song.audio_media = ref ? (serializeSongMediaRef(ref) || ref) : null;
          songDetailCache.set(key, data);
        });
      }
      if (typeof composerLoadedSong !== "undefined" && composerLoadedSong && String(composerLoadedSong.id) === id) {
        if (ref && isYouTubeMediaRef(ref) && composerSongMedia.audio && !isYouTubeMediaRef(composerSongMedia.audio) && !(composerSongMedia.preview && composerSongMedia.preview.basename)) {
          composerSongMedia.preview = fileToAudioPreviewRef(composerSongMedia.audio);
        }
        composerSongMedia.audio = ref;
        if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
        if (typeof songMetaSnapshot !== "undefined" && songMetaSnapshot) {
          songMetaSnapshot.audio = (typeof composerAudioSnippetRef === "function" && composerAudioSnippetRef())
            ? String(composerAudioSnippetRef().basename || "")
            : "";
          songMetaSnapshot.youtube = ref && isYouTubeMediaRef(ref) ? String(ref.youtube_id || ref.basename || "") : "";
        }
        if (typeof refreshMetadataModalPrimaryState === "function") refreshMetadataModalPrimaryState();
      }
    }

