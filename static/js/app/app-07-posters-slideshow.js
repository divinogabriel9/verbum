/* Verbum SPA part 7/9: app-07-posters-slideshow.js
 * Welcome, posters, AI poster, mass generate, slideshow
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 21005-24469
 */
    function getMobileWelcomeDisplayName() {
      const auth = window.VerbumAuth;
      const user = auth && auth.getUser ? auth.getUser() : null;
      if (!user) return null;
      return auth.getUserFirstName ? auth.getUserFirstName(user) : null;
    }

    function closeMobileWelcomeModal() {
      setUiOverlayOpen($("mobile-welcome-modal"), false);
    }

    function openMobileWelcomeModal() {
      const modal = $("mobile-welcome-modal");
      const titleEl = $("mobile-welcome-title");
      if (!modal || !titleEl) return;
      const name = getMobileWelcomeDisplayName();
      titleEl.textContent = name
        ? "Hi " + name + ", what do you want to do today?"
        : "Hi! What do you want to do today?";
      setUiOverlayOpen(modal, true);
    }

    function clearMobileWelcomeUrlFlag() {
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("welcome")) return;
        url.searchParams.delete("welcome");
        const next = url.pathname + (url.search || "") + (url.hash || "");
        history.replaceState({}, "", next || url.pathname);
      } catch (_e) { /* ignore */ }
    }

    function hasMobileWelcomePending() {
      try {
        if (sessionStorage.getItem(MOBILE_WELCOME_PENDING_KEY) === "1") return true;
      } catch (_e) { /* ignore */ }
      try {
        return new URLSearchParams(window.location.search).get("welcome") === "1";
      } catch (_e2) {
        return false;
      }
    }

    function consumeMobileWelcomePending() {
      let pending = false;
      try {
        if (sessionStorage.getItem(MOBILE_WELCOME_PENDING_KEY) === "1") {
          sessionStorage.removeItem(MOBILE_WELCOME_PENDING_KEY);
          pending = true;
        }
      } catch (_e) { /* ignore */ }
      try {
        if (new URLSearchParams(window.location.search).get("welcome") === "1") {
          pending = true;
          clearMobileWelcomeUrlFlag();
        }
      } catch (_e2) { /* ignore */ }
      return pending;
    }

    function maybeShowMobileWelcomeModal() {
      if (typeof shouldSkipStartupPopups === "function" && shouldSkipStartupPopups()) return;
      if (mobileWelcomeShownThisLoad) return;
      if (!isMobileChromeLayout()) return;
      if (window.__VERBUM_AUTH_GATE__) {
        const auth = window.VerbumAuth;
        if (!auth || !auth.getUser || !auth.getUser()) {
          // Keep the pending flag; retry once auth/user is ready.
          if (hasMobileWelcomePending()) {
            setTimeout(maybeShowMobileWelcomeModal, 400);
          }
          return;
        }
      }
      if (!consumeMobileWelcomePending()) return;
      mobileWelcomeShownThisLoad = true;
      requestAnimationFrame(() => {
        setTimeout(() => openMobileWelcomeModal(), 160);
      });
    }

    function initMobileWelcomeModal() {
      const modal = $("mobile-welcome-modal");
      if (!modal || modal.dataset.bound === "1") return;
      modal.dataset.bound = "1";
      const backdrop = $("mobile-welcome-backdrop");
      if (backdrop) backdrop.addEventListener("click", closeMobileWelcomeModal);
      modal.querySelectorAll("[data-mobile-welcome-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-mobile-welcome-action");
          closeMobileWelcomeModal();
          if (action === "mass-pptx") {
            showRoute("/mass/builder");
          } else if (action === "choir-practice") {
            if (typeof openPracticeShareSectionsModal === "function") openPracticeShareSectionsModal();
            else if (typeof openPracticeShareModal === "function") openPracticeShareModal();
          } else if (action === "add-song") {
            showRoute("/library/songs");
          }
        });
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (modal.classList.contains("is-open")) closeMobileWelcomeModal();
        const whatsNew = $("songs-whats-new-modal");
        if (whatsNew && whatsNew.classList.contains("is-open")) closeSongsWhatsNewModal();
      });
    }

    var SONGS_WHATS_NEW_SKIP_KEY = "verbum:songs-whats-new-skip-day";
    var SONGS_WHATS_NEW_SORT_KEY = "verbum:songs-whats-new-sort";
    var SONGS_WHATS_NEW_POPUP_KEY = "verbumSongsWhatsNewPopup";
    var songsWhatsNewPage = 0;
    var songsWhatsNewData = null;
    var songsWhatsNewShownThisLoad = false;
    var songsWhatsNewSort = "date_desc";

    function isSongsWhatsNewPopupEnabled() {
      try {
        const v = localStorage.getItem(SONGS_WHATS_NEW_POPUP_KEY);
        if (v === null) return false;
        return v === "1" || v === "true";
      } catch (_e) {
        return false;
      }
    }

    function setSongsWhatsNewPopupEnabled(enabled) {
      try {
        localStorage.setItem(SONGS_WHATS_NEW_POPUP_KEY, enabled ? "1" : "0");
      } catch (_e) { /* ignore */ }
    }

    function syncSongsWhatsNewPopupSettingsUI() {
      const el = $("settings-songs-whats-new-popup");
      if (el) el.checked = isSongsWhatsNewPopupEnabled();
    }

    function songsWhatsNewTodayKey() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function hasSkippedSongsWhatsNewToday() {
      try {
        return localStorage.getItem(SONGS_WHATS_NEW_SKIP_KEY) === songsWhatsNewTodayKey();
      } catch (_e) {
        return false;
      }
    }

    function setSkippedSongsWhatsNewToday(skip) {
      try {
        if (skip) localStorage.setItem(SONGS_WHATS_NEW_SKIP_KEY, songsWhatsNewTodayKey());
        else localStorage.removeItem(SONGS_WHATS_NEW_SKIP_KEY);
      } catch (_e) { /* ignore */ }
    }

    function readSongsWhatsNewSort() {
      try {
        const v = localStorage.getItem(SONGS_WHATS_NEW_SORT_KEY) || "date_desc";
        const allowed = {
          date_desc: 1,
          date_asc: 1,
          title_asc: 1,
          title_desc: 1,
          language: 1,
          section: 1,
          author: 1,
        };
        return allowed[v] ? v : "date_desc";
      } catch (_e) {
        return "date_desc";
      }
    }

    function writeSongsWhatsNewSort(value) {
      songsWhatsNewSort = value || "date_desc";
      try {
        localStorage.setItem(SONGS_WHATS_NEW_SORT_KEY, songsWhatsNewSort);
      } catch (_e) { /* ignore */ }
    }

    function formatWhatsNewDayLabel(isoDate) {
      const d = new Date(String(isoDate || "") + "T12:00:00");
      if (Number.isNaN(d.getTime())) return String(isoDate || "");
      const today = new Date();
      const yday = new Date();
      yday.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return "Today";
      if (d.toDateString() === yday.toDateString()) return "Yesterday";
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    function sortWhatsNewSongs(songs, sortKey) {
      const list = (songs || []).slice();
      const key = sortKey || songsWhatsNewSort || "date_desc";
      const text = (v) => String(v || "").trim().toLowerCase();
      list.sort((a, b) => {
        if (key === "date_asc") return String(a.at || "").localeCompare(String(b.at || ""));
        if (key === "date_desc") return String(b.at || "").localeCompare(String(a.at || ""));
        if (key === "title_asc") return text(a.title).localeCompare(text(b.title));
        if (key === "title_desc") return text(b.title).localeCompare(text(a.title));
        if (key === "language") {
          const c = text(a.language).localeCompare(text(b.language));
          return c || text(a.title).localeCompare(text(b.title));
        }
        if (key === "section") {
          const c = text(a.section).localeCompare(text(b.section));
          return c || text(a.title).localeCompare(text(b.title));
        }
        if (key === "author") {
          const c = text(a.author).localeCompare(text(b.author));
          return c || text(a.title).localeCompare(text(b.title));
        }
        return String(b.at || "").localeCompare(String(a.at || ""));
      });
      return list;
    }

    function groupWhatsNewByDate(songs) {
      const byDate = {};
      (songs || []).forEach((song) => {
        const day = String(song.date || (song.at || "").slice(0, 10) || "");
        if (!byDate[day]) byDate[day] = [];
        byDate[day].push(song);
      });
      const days = Object.keys(byDate).sort((a, b) => {
        if (songsWhatsNewSort === "date_asc") return a.localeCompare(b);
        return b.localeCompare(a);
      });
      return days.map((day) => ({ date: day, songs: byDate[day] }));
    }

    function renderSongsWhatsNewSongItem(song) {
      const title = escapeHtml(song.title || "Untitled");
      const section = typeof songSectionLabel === "function"
        ? songSectionLabel(song.section || "")
        : (song.section || "");
      const lang = String(song.language || "").trim();
      const author = String(song.author || "").trim();
      const meta = [section, lang, author].filter(Boolean).map(escapeHtml).join(" · ");
      const badge = song.kind === "added" ? "New" : "Updated";
      return (
        "<li class=\"songs-whats-new-item\">" +
          "<div>" +
            "<p class=\"songs-whats-new-item__title\">" + title + "</p>" +
            (meta ? "<p class=\"songs-whats-new-item__meta\">" + meta + "</p>" : "") +
          "</div>" +
          "<span class=\"songs-whats-new-item__badge\">" + badge + "</span>" +
        "</li>"
      );
    }

    function renderSongsWhatsNewPanes(data) {
      const monthPane = $("songs-whats-new-pane-month");
      const weekPane = $("songs-whats-new-pane-week");
      const desc = $("songs-whats-new-desc");
      if (!monthPane || !weekPane) return;
      const monthSongs = sortWhatsNewSongs(Array.isArray(data.month_added) ? data.month_added : [], songsWhatsNewSort);
      const weekSongs = sortWhatsNewSongs(Array.isArray(data.week_updated) ? data.week_updated : [], songsWhatsNewSort);
      const monthLabel = data.month_label || "This month";
      if (desc) {
        desc.textContent =
          (monthSongs.length ? monthSongs.length + " added in " + monthLabel : "No new songs this month") +
          " · " +
          (weekSongs.length || 0) + " updated this week";
      }
      const monthTab = $("songs-whats-new-tab-month");
      if (monthTab) monthTab.textContent = "This month (" + monthSongs.length + ")";
      const weekTab = $("songs-whats-new-tab-week");
      if (weekTab) weekTab.textContent = "This week (" + weekSongs.length + ")";
      if (!monthSongs.length) {
        monthPane.innerHTML = "<p class=\"songs-whats-new-empty\">No songs were added this month yet.</p>";
      } else {
        monthPane.innerHTML =
          "<ul class=\"songs-whats-new-list\">" +
          monthSongs.map(renderSongsWhatsNewSongItem).join("") +
          "</ul>";
      }
      if (!weekSongs.length) {
        weekPane.innerHTML = "<p class=\"songs-whats-new-empty\">No song updates in the past 7 days.</p>";
      } else if (songsWhatsNewSort === "date_desc" || songsWhatsNewSort === "date_asc") {
        const weekByDate = groupWhatsNewByDate(weekSongs);
        weekPane.innerHTML = weekByDate.map((group) => {
          const songs = Array.isArray(group.songs) ? group.songs : [];
          return (
            "<section class=\"songs-whats-new-day\">" +
              "<h4 class=\"songs-whats-new-day__label\">" + escapeHtml(formatWhatsNewDayLabel(group.date)) + "</h4>" +
              "<ul class=\"songs-whats-new-list\">" +
                songs.map(renderSongsWhatsNewSongItem).join("") +
              "</ul>" +
            "</section>"
          );
        }).join("");
      } else {
        weekPane.innerHTML =
          "<ul class=\"songs-whats-new-list\">" +
          weekSongs.map(renderSongsWhatsNewSongItem).join("") +
          "</ul>";
      }
    }

    function setSongsWhatsNewPage(page) {
      songsWhatsNewPage = page === 1 ? 1 : 0;
      document.querySelectorAll("[data-whats-new-pane]").forEach((pane) => {
        const on = Number(pane.getAttribute("data-whats-new-pane")) === songsWhatsNewPage;
        pane.hidden = !on;
      });
      document.querySelectorAll(".songs-whats-new-tab").forEach((tab) => {
        const on = Number(tab.getAttribute("data-whats-new-page")) === songsWhatsNewPage;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll(".songs-whats-new-pager__dot").forEach((dot) => {
        const on = Number(dot.getAttribute("data-whats-new-page")) === songsWhatsNewPage;
        dot.classList.toggle("is-active", on);
      });
      const prev = $("songs-whats-new-prev");
      const next = $("songs-whats-new-next");
      if (prev) prev.disabled = songsWhatsNewPage === 0;
      if (next) next.textContent = songsWhatsNewPage === 1 ? "Done" : "Next";
    }

    function closeSongsWhatsNewModal() {
      const skip = $("songs-whats-new-skip-today");
      if (skip && skip.checked) setSkippedSongsWhatsNewToday(true);
      setUiOverlayOpen($("songs-whats-new-modal"), false);
    }

    function openSongsWhatsNewModal(data) {
      songsWhatsNewData = data || songsWhatsNewData;
      if (!songsWhatsNewData) return;
      songsWhatsNewSort = readSongsWhatsNewSort();
      const sortEl = $("songs-whats-new-sort");
      if (sortEl) sortEl.value = songsWhatsNewSort;
      renderSongsWhatsNewPanes(songsWhatsNewData);
      const skip = $("songs-whats-new-skip-today");
      if (skip) skip.checked = false;
      setSongsWhatsNewPage(0);
      setUiOverlayOpen($("songs-whats-new-modal"), true);
    }

    async function maybeShowSongsWhatsNewModal() {
      if (typeof shouldSkipStartupPopups === "function" && shouldSkipStartupPopups()) return;
      if (!isSongsWhatsNewPopupEnabled()) return;
      if (songsWhatsNewShownThisLoad) return;
      if (hasSkippedSongsWhatsNewToday()) return;
      const welcome = $("mobile-welcome-modal");
      if (welcome && welcome.classList.contains("is-open")) {
        setTimeout(maybeShowSongsWhatsNewModal, 600);
        return;
      }
      if (window.__VERBUM_AUTH_GATE__) {
        const auth = window.VerbumAuth;
        if (!auth || !auth.getUser || !auth.getUser()) return;
      }
      try {
        if (window.VerbumAuth && window.VerbumAuth.waitUntilReady) {
          await window.VerbumAuth.waitUntilReady();
        }
        const headers = {};
        if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
          Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
        }
        const res = await fetch("/api/catalog/songs/whats-new", { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return;
        const monthN = (data.counts && data.counts.month_added) || 0;
        const weekN = (data.counts && data.counts.week_updated) || 0;
        if (!monthN && !weekN) return;
        songsWhatsNewShownThisLoad = true;
        requestAnimationFrame(() => {
          setTimeout(() => openSongsWhatsNewModal(data), 280);
        });
      } catch (_err) {
        /* ignore network/auth errors — modal is optional */
      }
    }

    function initSongsWhatsNewModal() {
      const modal = $("songs-whats-new-modal");
      if (!modal || modal.dataset.bound === "1") return;
      modal.dataset.bound = "1";
      const backdrop = $("songs-whats-new-backdrop");
      if (backdrop) backdrop.addEventListener("click", closeSongsWhatsNewModal);
      const closeBtn = $("songs-whats-new-close");
      if (closeBtn) closeBtn.addEventListener("click", closeSongsWhatsNewModal);
      const prev = $("songs-whats-new-prev");
      const next = $("songs-whats-new-next");
      if (prev) {
        prev.addEventListener("click", () => setSongsWhatsNewPage(Math.max(0, songsWhatsNewPage - 1)));
      }
      if (next) {
        next.addEventListener("click", () => {
          if (songsWhatsNewPage >= 1) closeSongsWhatsNewModal();
          else setSongsWhatsNewPage(1);
        });
      }
      modal.querySelectorAll("[data-whats-new-page]").forEach((el) => {
        el.addEventListener("click", () => {
          setSongsWhatsNewPage(Number(el.getAttribute("data-whats-new-page")) || 0);
        });
      });
      const sortEl = $("songs-whats-new-sort");
      if (sortEl) {
        sortEl.value = readSongsWhatsNewSort();
        sortEl.addEventListener("change", () => {
          writeSongsWhatsNewSort(sortEl.value);
          if (songsWhatsNewData) renderSongsWhatsNewPanes(songsWhatsNewData);
        });
      }
      syncSongsWhatsNewPopupSettingsUI();
      const prefEl = $("settings-songs-whats-new-popup");
      if (prefEl && prefEl.dataset.bound !== "1") {
        prefEl.dataset.bound = "1";
        prefEl.addEventListener("change", () => {
          setSongsWhatsNewPopupEnabled(!!prefEl.checked);
        });
      }
    }

    function initCreateMenu() {
      const btn = $("create-menu-btn");
      const panel = $("create-menu-panel");
      if (!btn || !panel) return;
      bindMobileHeaderSheetTrigger(btn, () => {
        toggleHeaderSheetPanel(panel, btn, "create-menu-panel");
      });
      btn.addEventListener("click", (e) => {
        if (isMobileHeaderSheet()) return;
        e.stopPropagation();
        const open = panel.hidden;
        closeHeaderMenus(open ? "create-menu-panel" : null);
        setVbDropdownOpen(panel, btn, open);
      });
      panel.querySelectorAll("[data-create]").forEach((item) => {
        item.addEventListener("click", () => {
          closeHeaderMenus();
          const action = item.getAttribute("data-create");
          if (action === "pptx") {
            showRoute("/mass/builder");
          } else if (action === "share-lyrics") {
            if (typeof openPracticeShareSectionsModal === "function") openPracticeShareSectionsModal();
            else if (typeof openPracticeShareModal === "function") openPracticeShareModal();
          } else if (action === "event") {
            if (typeof openHomeEventModal === "function") openHomeEventModal();
          } else if (action === "poster") {
            showRoute("/media/posters");
          } else if (action === "song") {
            showRoute("/library/songs");
          } else if (action === "collection") {
            showRoute("/library/collections");
          }
        });
      });
    }

    var GLOBAL_SEARCH_ITEMS = [
      { id: "page-home", label: "Home", hint: "Page", group: "Pages", route: "/home", keywords: ["home", "dashboard", "liturgyflow", "sunday"] },
      { id: "page-mass", label: "Mass Builder", hint: "Page", group: "Pages", route: "/mass/builder", keywords: ["mass", "builder", "pptx", "powerpoint", "slides", "generate"] },
      { id: "page-songs", label: "Song Library", hint: "Page", group: "Pages", route: "/library/songs", keywords: ["library", "song", "lyrics", "hymn", "music"] },
      { id: "page-radio", label: "Media", hint: "Page", group: "Pages", route: "/radio", keywords: ["media", "radio", "ewtn", "stream", "listen", "live"] },
      { id: "page-collections", label: "Collections", hint: "Page", group: "Pages", route: "/library/collections", keywords: ["collection", "setlist"] },
      { id: "page-posters", label: "Posters", hint: "Page", group: "Pages", route: "/media/posters", keywords: ["media", "poster", "graphic", "social"] },
      { id: "page-history", label: "History", hint: "Page", group: "Pages", route: "/media/history", keywords: ["history", "download", "recent"] },
      { id: "page-calendar", label: "Liturgical Calendar", hint: "Page", group: "Pages", route: "/mass/calendar", keywords: ["calendar", "liturgical", "readings"] },
      { id: "page-theme", label: "Theme Lab", hint: "Page", group: "Pages", route: "/design/theme-lab", keywords: ["design", "theme", "style", "color"] },
      { id: "page-templates", label: "Templates", hint: "Page", group: "Pages", route: "/design/templates", keywords: ["template", "layout"] },
      { id: "page-account", label: "Account", hint: "Page", group: "Pages", route: "/settings/account", keywords: ["account", "profile", "picture", "avatar", "photo"] },
      { id: "page-church", label: "Church Profile", hint: "Page", group: "Pages", route: "/settings/church", keywords: ["church", "profile", "logo", "parish", "community"] },
      { id: "page-appearance", label: "Appearance", hint: "Page", group: "Pages", route: "/settings/app", keywords: ["appearance", "dark", "light", "theme", "settings"] },
      { id: "act-event", label: "Create event", hint: "Action", group: "Actions", action: "create-event", keywords: ["event", "create", "schedule"] },
      { id: "act-pptx", label: "Generate PPTX", hint: "Action", group: "Actions", action: "generate-pptx", keywords: ["generate", "pptx", "package", "export"] },
      { id: "act-readings", label: "Load readings", hint: "Action", group: "Actions", action: "load-readings", keywords: ["readings", "load", "refresh"] },
    ];

    var globalSearchActiveIndex = -1;
    var globalSearchVisibleItems = [];

    function scoreGlobalSearchItem(item, query) {
      if (!query) return 1;
      const q = query.toLowerCase();
      const label = item.label.toLowerCase();
      if (label === q) return 100;
      if (label.startsWith(q)) return 80;
      if (label.includes(q)) return 60;
      if ((item.keywords || []).some((k) => k === q || k.startsWith(q))) return 50;
      if ((item.keywords || []).some((k) => k.includes(q) || q.includes(k))) return 35;
      if ((item.hint || "").toLowerCase().includes(q)) return 20;
      if ((routeMeta[item.route] || "").toLowerCase().includes(q)) return 15;
      return 0;
    }

    function getGlobalSearchSongHits(query, limit) {
      if (!query || !songCatalogData) return [];
      const q = query.trim().toLowerCase();
      if (q.length < 2) return [];
      const hits = [];
      const secs = ["entrance", "offertory", "communion", "recessional", "meditation"];
      secs.forEach((sec) => {
        (songCatalogData[sec] || []).forEach((row) => {
          if (hits.length >= limit) return;
          const title = String(row.title || "").trim();
          const author = String(row.author || "").trim();
          const blob = (title + " " + author + " " + sec).toLowerCase();
          if (!blob.includes(q)) return;
          hits.push({
            id: "song-" + String(row.id || title),
            label: title || "Untitled song",
            hint: author || sec,
            group: "Songs",
            action: "song-search",
            query: q,
            keywords: [],
          });
        });
      });
      return hits;
    }

    function filterGlobalSearchItems(query) {
      const q = (query || "").trim();
      const scored = GLOBAL_SEARCH_ITEMS
        .filter((item) => {
          if (!item.route) return true;
          const tabId = routeToNavTabId(item.route);
          return !tabId || isNavTabVisible(tabId);
        })
        .map((item) => ({ item, score: scoreGlobalSearchItem(item, q) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
        .map((row) => row.item);
      const songs = getGlobalSearchSongHits(q, 6);
      return scored.concat(songs).slice(0, 12);
    }

    function runGlobalSearchItem(item) {
      if (!item) return;
      closeGlobalSearch();
      const input = $("app-global-search");
      if (input) input.value = "";
      if (item.route) {
        showRoute(item.route);
        return;
      }
      if (item.action === "create-event") {
        if (typeof openHomeEventModal === "function") openHomeEventModal();
        return;
      }
      if (item.action === "generate-pptx") {
        showRoute("/mass/builder");
        setTimeout(() => {
          const gen = $("btn-generate-flow");
          if (gen && !gen.disabled) gen.click();
        }, 450);
        return;
      }
      if (item.action === "load-readings") {
        showRoute("/mass/builder");
        setTimeout(() => {
          const btn = $("btn-load-flow");
          if (btn && !btn.disabled) btn.click();
        }, 350);
        return;
      }
      if (item.action === "song-search") {
        showRoute("/library/songs");
        setTimeout(() => {
          const searchEl = $("song-catalog-search");
          if (searchEl) {
            searchEl.value = item.query || "";
            if (typeof applySongCatalogSearch === "function") applySongCatalogSearch(searchEl);
          }
        }, 200);
      }
    }

    function renderGlobalSearchResults(query) {
      const list = $("global-search-list");
      const empty = $("global-search-empty");
      const input = $("app-global-search");
      if (!list || !empty) return;
      globalSearchVisibleItems = filterGlobalSearchItems(query);
      globalSearchActiveIndex = globalSearchVisibleItems.length ? 0 : -1;
      list.innerHTML = "";
      if (!globalSearchVisibleItems.length) {
        empty.hidden = false;
        if (input) input.setAttribute("aria-activedescendant", "");
        return;
      }
      empty.hidden = true;
      let lastGroup = "";
      globalSearchVisibleItems.forEach((item, index) => {
        if (item.group && item.group !== lastGroup) {
          lastGroup = item.group;
          const groupEl = document.createElement("li");
          groupEl.className = "global-search-group-label";
          groupEl.textContent = item.group;
          groupEl.setAttribute("role", "presentation");
          list.appendChild(groupEl);
        }
        const li = document.createElement("li");
        li.setAttribute("role", "presentation");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vb-dropdown-item global-search-item" + (index === globalSearchActiveIndex ? " is-active" : "");
        btn.id = "global-search-opt-" + index;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", index === globalSearchActiveIndex ? "true" : "false");
        btn.dataset.index = String(index);
        btn.innerHTML =
          '<span class="global-search-item__label"></span><span class="global-search-item__hint"></span>';
        btn.querySelector(".global-search-item__label").textContent = item.label;
        btn.querySelector(".global-search-item__hint").textContent = item.hint || "";
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", () => runGlobalSearchItem(item));
        li.appendChild(btn);
        list.appendChild(li);
      });
      if (input && globalSearchActiveIndex >= 0) {
        input.setAttribute("aria-activedescendant", "global-search-opt-" + globalSearchActiveIndex);
      }
    }

    function highlightGlobalSearchIndex(nextIndex) {
      if (!globalSearchVisibleItems.length) return;
      const count = globalSearchVisibleItems.length;
      globalSearchActiveIndex = ((nextIndex % count) + count) % count;
      const list = $("global-search-list");
      const input = $("app-global-search");
      if (!list) return;
      list.querySelectorAll(".global-search-item").forEach((el) => {
        const idx = Number(el.dataset.index);
        const active = idx === globalSearchActiveIndex;
        el.classList.toggle("is-active", active);
        el.setAttribute("aria-selected", active ? "true" : "false");
        if (active) {
          el.scrollIntoView({ block: "nearest" });
          if (input) input.setAttribute("aria-activedescendant", el.id);
        }
      });
    }

    function openGlobalSearch() {
      const panel = $("global-search-panel");
      const input = $("app-global-search");
      if (!panel || !input) return;
      closeHeaderMenus("global-search-panel");
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add("is-open"));
      input.setAttribute("aria-expanded", "true");
      renderGlobalSearchResults(input.value);
    }

    function closeGlobalSearch() {
      const panel = $("global-search-panel");
      const input = $("app-global-search");
      if (!panel) return;
      panel.classList.remove("is-open");
      panel.hidden = true;
      if (input) {
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-activedescendant", "");
      }
      globalSearchActiveIndex = -1;
      globalSearchVisibleItems = [];
    }

    var VB_SELECT_CHEVRON_SVG =
      "<svg class=\"vb-select__chevron\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\"/></svg>";

    function syncVerbumSelectTrigger(select) {
      const wrap = select.closest(".vb-select");
      if (!wrap) return;
      const trigger = wrap.querySelector(".vb-select__trigger");
      const valueEl = wrap.querySelector(".vb-select__value");
      const opt = select.options[select.selectedIndex];
      const label = opt ? opt.text : "";
      const isPlaceholder = !opt || opt.value === "";
      if (valueEl) {
        valueEl.textContent = label;
        valueEl.classList.toggle("is-placeholder", isPlaceholder);
      } else if (trigger) trigger.childNodes[0].textContent = label;
      if (trigger) trigger.disabled = !!select.disabled;
      wrap.querySelectorAll(".vb-dropdown-item[data-value]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.value === select.value);
        btn.setAttribute("aria-selected", btn.dataset.value === select.value ? "true" : "false");
      });
    }

    function rebuildVerbumSelectList(select) {
      const wrap = select.closest(".vb-select");
      if (!wrap) return;
      const list = wrap.querySelector(".vb-dropdown-list");
      if (!list) return;
      list.innerHTML = "";
      const isPillSelect = select.classList.contains("lyric-block__pill-select");
      const isSlidePick = select.classList.contains("flow-slide-pick-select");
      Array.from(select.options).forEach((opt) => {
        if (isSlidePick && (opt.disabled || opt.value === "")) return;
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vb-dropdown-item";
        if (isPillSelect && opt.value) btn.classList.add("vb-dropdown-item--" + opt.value);
        btn.setAttribute("role", "option");
        btn.dataset.value = opt.value;
        btn.innerHTML = "<span class=\"vb-dropdown-item__label\">" + escapeHtml(opt.text) + "</span>";
        if (opt.disabled) btn.disabled = true;
        const isSelected = opt.value === select.value;
        if (isSelected) btn.classList.add("is-active");
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncVerbumSelectTrigger(select);
          closeVerbumSelect(wrap);
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
      syncVerbumSelectTrigger(select);
    }

    function closeVerbumSelect(wrap) {
      if (!wrap) return;
      const panel = wrap.querySelector(".vb-select__panel");
      const trigger = wrap.querySelector(".vb-select__trigger");
      closeVbDropdownPanel(panel);
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    }

    function closeAllVerbumSelects(exceptWrap) {
      document.querySelectorAll(".vb-select").forEach((wrap) => {
        if (exceptWrap && wrap === exceptWrap) return;
        closeVerbumSelect(wrap);
      });
    }

    function enhanceVerbumSelect(select) {
      if (!select || select.closest(".vb-select") || select.dataset.vbSelect === "off") return;
      if (select.classList.contains("mass-song-plan-lang-select")) return;
      const wrap = document.createElement("div");
      wrap.className = "vb-select";
      if (select.classList.contains("lyric-block__pill-select")) wrap.classList.add("vb-select--pill");
      if (select.classList.contains("flow-slide-pick-select")) wrap.classList.add("vb-select--slide-pick");
      if (select.classList.contains("mass-song-plan-lang-select")) wrap.classList.add("vb-select--sm");
      if (select.classList.contains("route-switcher")) {
        wrap.classList.add("vb-select--sm", "vb-select--drop-up");
      }
      if (select.id === "flow-collection-currency") wrap.classList.add("vb-select--sm", "vb-select--currency-compact");

      const triggerId = (select.id || "vb-select-" + Math.random().toString(36).slice(2, 9)) + "-trigger";
      const panelId = (select.id || triggerId) + "-panel";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "vb-select__trigger";
      trigger.id = triggerId;
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      trigger.innerHTML = "<span class=\"vb-select__value\"></span>" + VB_SELECT_CHEVRON_SVG;

      const panel = document.createElement("div");
      panel.className = "vb-dropdown-panel vb-select__panel";
      panel.id = panelId;
      panel.setAttribute("role", "listbox");
      panel.hidden = true;
      trigger.setAttribute("aria-controls", panelId);

      const list = document.createElement("ul");
      list.className = "vb-dropdown-list";
      panel.appendChild(list);

      select.classList.add("vb-select__native");
      const label = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
      if (label) label.setAttribute("for", triggerId);

      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select);
      wrap.appendChild(trigger);
      wrap.appendChild(panel);

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.disabled) return;
        const opening = panel.hidden;
        closeHeaderMenus();
        closeAllVerbumSelects(wrap);
        if (opening) {
          openVbDropdownPanel(panel);
          trigger.setAttribute("aria-expanded", "true");
        } else {
          closeVerbumSelect(wrap);
        }
      });

      select.addEventListener("change", () => syncVerbumSelectTrigger(select));
      rebuildVerbumSelectList(select);
    }

    function refreshVerbumSelect(select) {
      if (!select) return;
      if (!select.closest(".vb-select")) {
        enhanceVerbumSelect(select);
        return;
      }
      rebuildVerbumSelectList(select);
    }

    function initVerbumSelects(root) {
      const scope = root || document;
      scope.querySelectorAll("select:not(.vb-select__native)").forEach((select) => {
        enhanceVerbumSelect(select);
      });
    }

    var POSTER_DESIGNS = [
      { n: 1, label: "Design 1 · Warm beige" },
      { n: 2, label: "Design 2 · Light, cross accents" },
      { n: 3, label: "Design 3 · Spotlight (dark)" },
      { n: 4, label: "Design 4 · Soft light" },
    ];

    function closeAllPosterPickers(exceptPicker) {
      document.querySelectorAll("[data-poster-picker]").forEach((picker) => {
        if (exceptPicker && picker === exceptPicker) return;
        const menu = picker.querySelector(".poster-picker__menu");
        const trigger = picker.querySelector(".poster-picker__trigger");
        if (menu) menu.hidden = true;
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    function initDividerPosterPickers() {
      document.querySelectorAll("[data-poster-picker]").forEach((picker) => {
        const trigger = picker.querySelector(".poster-picker__trigger");
        const menu = picker.querySelector(".poster-picker__menu");
        if (!trigger || !menu) return;

        const isPair = picker.hasAttribute("data-pair");
        if (isPair) {
          const lotwEl = $(picker.getAttribute("data-lotw-target") || "flow-lotw-poster");
          const loteEl = $(picker.getAttribute("data-lote-target") || "flow-lote-poster");
          const name = picker.getAttribute("data-name") || "Liturgy divider";

          menu.innerHTML = "";
          POSTER_DESIGNS.forEach((design) => {
            const n = design.n;
            const lotwId = "lotw" + n;
            const loteId = "lote" + n;
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "poster-picker__option poster-picker__option--pair";
            opt.setAttribute("role", "option");
            opt.setAttribute("data-pair", String(n));
            opt.setAttribute("data-value", lotwId + "+" + loteId);
            opt.setAttribute("aria-label", name + " — " + design.label);
            opt.title = design.label;
            opt.innerHTML =
              '<span class="poster-picker__pair">' +
                '<span class="poster-picker__pair-item">' +
                  '<img src="/static/images/posters/' + lotwId + '.png" alt="" loading="lazy" />' +
                  '<span class="poster-picker__pair-caption">Word</span>' +
                "</span>" +
                '<span class="poster-picker__pair-item">' +
                  '<img src="/static/images/posters/' + loteId + '.png" alt="" loading="lazy" />' +
                  '<span class="poster-picker__pair-caption">Eucharist</span>' +
                "</span>" +
              "</span>";
            opt.addEventListener("click", () => {
              setPairedPosterSelection(picker, n);
              closeAllPosterPickers();
              trigger.focus();
            });
            menu.appendChild(opt);
          });

          trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const opening = menu.hidden;
            if (typeof closeHeaderMenus === "function") closeHeaderMenus();
            closeAllPosterPickers(picker);
            menu.hidden = !opening;
            trigger.setAttribute("aria-expanded", opening ? "true" : "false");
          });

          const initial = posterPairNumberFromIds(
            (lotwEl && lotwEl.value) || "lotw1",
            (loteEl && loteEl.value) || "lote1"
          );
          setPairedPosterSelection(picker, initial);
          return;
        }

        const target = $(picker.getAttribute("data-target"));
        const prefix = picker.getAttribute("data-prefix");
        const name = picker.getAttribute("data-name") || "poster";
        const current = picker.querySelector(".poster-picker__current");
        if (!target || !prefix || !current) return;

        const setSelected = (id) => {
          if (!/^lot[we][1-4]$/.test(id)) return;
          target.value = id;
          current.src = "/static/images/posters/" + id + ".png";
          menu.querySelectorAll(".poster-picker__option").forEach((opt) => {
            opt.setAttribute("aria-selected", opt.getAttribute("data-value") === id ? "true" : "false");
          });
          target.dispatchEvent(new Event("change", { bubbles: true }));
        };

        menu.innerHTML = "";
        POSTER_DESIGNS.forEach((design) => {
          const id = prefix + design.n;
          const opt = document.createElement("button");
          opt.type = "button";
          opt.className = "poster-picker__option";
          opt.setAttribute("role", "option");
          opt.setAttribute("data-value", id);
          opt.setAttribute("aria-selected", id === target.value ? "true" : "false");
          opt.setAttribute("aria-label", name + " — " + design.label);
          opt.title = design.label;
          opt.innerHTML = '<img src="/static/images/posters/' + id + '.png" alt="' + design.label + '" loading="lazy" />';
          opt.addEventListener("click", () => {
            setSelected(id);
            closeAllPosterPickers();
            trigger.focus();
          });
          menu.appendChild(opt);
        });

        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          const opening = menu.hidden;
          if (typeof closeHeaderMenus === "function") closeHeaderMenus();
          closeAllPosterPickers(picker);
          menu.hidden = !opening;
          trigger.setAttribute("aria-expanded", opening ? "true" : "false");
        });

        setSelected(target.value || prefix + "1");
      });
    }


    function initGlobalSearch() {
      const input = $("app-global-search");
      const panel = $("global-search-panel");
      const wrap = document.querySelector(".app-header__search-wrap");
      if (!input || !panel) return;

      document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
          e.preventDefault();
          openGlobalSearch();
          input.focus();
          input.select();
        }
      });

      input.addEventListener("focus", () => openGlobalSearch());
      input.addEventListener("input", () => renderGlobalSearchResults(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeGlobalSearch();
          input.blur();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!panel.classList.contains("is-open")) openGlobalSearch();
          highlightGlobalSearchIndex(globalSearchActiveIndex + 1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          highlightGlobalSearchIndex(globalSearchActiveIndex - 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const item = globalSearchVisibleItems[globalSearchActiveIndex] || globalSearchVisibleItems[0];
          if (item) runGlobalSearchItem(item);
        }
      });

    }

    function initLiturgicalIndicatorPanel() {
      const btn = $("liturgical-indicator-btn");
      const panel = $("liturgical-indicator-panel");
      if (!btn || !panel) return;

      bindMobileHeaderSheetTrigger(btn, () => {
        if (panel.hidden) updateLiturgicalCountdowns();
        toggleHeaderSheetPanel(panel, btn, "liturgical-indicator-panel");
      });
      startLiturgicalCountdownTimer();
    }

    async function refreshHomeMission() {
      const sun = upcomingSundayISO();
      if ($("home-sunday-label")) $("home-sunday-label").textContent = "Sunday " + sun;
      // Prefer Mass Setup's full preview cache so home never shows a divergent
      // readings-only snapshot for the same Sunday.
      const cached = (flowPreviewData && flowPreviewData.__previewDate === sun ? flowPreviewData : null)
        || (window.__homePreview && window.__homePreview.__previewDate === sun ? window.__homePreview : null)
        || previewCache.get(previewCacheKey(sun, false))
        || previewCache.get(previewCacheKey(sun, true))
        || readStoredReadings(sun);
      if (cached && readingsPayloadComplete(cached)) {
        applyHomePreviewData(cached, sun);
      }
      try {
        await ensureReadingsComplete(sun, {
          onUpdate: (data) => {
            window.__homePreview = Object.assign({}, data, { __previewDate: sun });
            applyHomePreviewData(data, sun);
          },
        });
      } catch (e) {
        if (!cached) notify(e.message || "Could not load lectionary preview.", "error");
      }
    }

    function lastSundayISO(base = new Date()) {
      return previousSundayISO(base);
    }

    function setHomeMassSnippet(kind, data, iso) {
      const titleEl = $("home-mass-" + kind + "-title");
      const dateEl = $("home-mass-" + kind + "-date");
      const refEl = $("home-mass-" + kind + "-ref");
      if (dateEl) dateEl.textContent = formatNiceDate(iso);
      if (titleEl) titleEl.textContent = (data && (data.title || "").trim()) || "Sunday Mass";
      if (refEl) refEl.textContent = (data && (data.gospel_reference || "").trim()) || "";
    }

    async function populateHomeMassSnippet(kind, iso) {
      const dateEl = $("home-mass-" + kind + "-date");
      if (dateEl) dateEl.textContent = formatNiceDate(iso);
      const cached = readStoredReadings(iso)
        || previewCache.get(previewCacheKey(iso, false))
        || previewCache.get(previewCacheKey(iso, true));
      if (cached) setHomeMassSnippet(kind, cached, iso);
      try {
        const data = await fetchReadings(iso);
        setHomeMassSnippet(kind, data, iso);
      } catch (e) {
        if (!cached) {
          const titleEl = $("home-mass-" + kind + "-title");
          if (titleEl) titleEl.textContent = "Sunday Mass";
        }
      }
    }

    function refreshHomeMassCard() {
      if (!$("home-mass-card")) return;
      populateHomeMassSnippet("next", upcomingSundayISO());
      populateHomeMassSnippet("last", lastSundayISO());
    }

    var HOME_SONG_SLOTS = [
      { key: "entrance", label: "Entrance" },
      { key: "offertory", label: "Offertory" },
      { key: "communion_1", label: "Communion 1" },
      { key: "communion_2", label: "Communion 2" },
      { key: "recessional", label: "Recessional" },
    ];

    function catalogSectionForSlot(slotKey) {
      if (/^communion_\d+$/.test(String(slotKey || ""))) return "communion";
      return slotKey;
    }

    function catalogSongTitle(section, id) {
      if (!section || !id || !songCatalogData) return "";
      const rows = songCatalogData[section] || [];
      const row = rows.find((r) => String(r.id) === String(id));
      return row ? (row.title || "").trim() : "";
    }

    async function refreshHomeSongsCard() {
      /* Songs carousel removed — Quick Actions workspace replaced it. */
    }

    function initHomeQuickActions() {
      const root = $("home-events-card");
      if (!root || root.dataset.qaBound === "1") return;
      root.dataset.qaBound = "1";

      function openAddSong() {
        showRoute("/library/songs");
        requestAnimationFrame(() => {
          startComposerNewSong();
        });
      }

      function openRecentSongs() {
        showRoute("/library/songs");
        requestAnimationFrame(() => {
          if (typeof expandSongComposerPanel === "function") expandSongComposerPanel();
          if (typeof setSongComposerDeflated === "function") setSongComposerDeflated(false);
          const recent = $("song-composer-recent-list");
          if (recent) recent.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }

      root.querySelectorAll("[data-home-qa]").forEach((el) => {
        const action = el.getAttribute("data-home-qa");
        if (action === "favorites") return; /* navigates via href */
        el.addEventListener("click", (e) => {
          if (action === "add-song") {
            e.preventDefault();
            openAddSong();
          } else if (action === "recent") {
            e.preventDefault();
            openRecentSongs();
          }
        });
      });
    }

    function applyHomeReflectionData(data) {
      if ($("home-reflection-date")) {
        $("home-reflection-date").textContent = new Date().toLocaleDateString(undefined, {
          weekday: "long", month: "long", day: "numeric",
        });
      }
      const verse = (data.gospel_quote || data.gospel_text || "").trim();
      if ($("home-reflection-verse")) {
        $("home-reflection-verse").textContent = verse || "Today's Gospel verse will appear here.";
      }
      if ($("home-reflection-ref")) $("home-reflection-ref").textContent = data.gospel_reference || "—";
      const reflection = (data.gospel_synopsis || "").trim();
      if ($("home-reflection-text")) {
        $("home-reflection-text").textContent = reflection;
      }
    }

    var reflectionImageCache = new Map();

    function applyReflectionBackground(payload) {
      const card = $("home-reflection-card");
      const bg = $("home-reflection-bg");
      const credit = $("home-reflection-credit");
      if (!card || !bg) return;
      const url = payload && payload.ok ? String(payload.image_url || "").trim() : "";
      if (!url) {
        card.classList.remove("has-bg", "text-light", "text-dark");
        bg.style.backgroundImage = "";
        if (credit) { credit.hidden = true; credit.removeAttribute("href"); }
        return;
      }
      const img = new Image();
      img.onload = () => {
        bg.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        card.classList.add("has-bg");
        card.classList.remove("text-light", "text-dark");
        card.classList.add(payload.text_mode === "dark" ? "text-dark" : "text-light");
        if (credit) {
          const who = (payload.creator || "Openverse").trim();
          const lic = (payload.license || "").trim().toUpperCase();
          credit.textContent = "Image: " + who + (lic ? " · " + lic : "");
          credit.href = payload.source_url || payload.license_url || "https://openverse.org";
          credit.hidden = false;
        }
      };
      img.onerror = () => {
        card.classList.remove("has-bg", "text-light", "text-dark");
        if (credit) credit.hidden = true;
      };
      img.src = url;
    }

    async function refreshReflectionBackground(date) {
      if (!$("home-reflection-card")) return;
      if (reflectionImageCache.has(date)) {
        applyReflectionBackground(reflectionImageCache.get(date));
        return;
      }
      try {
        const res = await fetch("/api/gospel-image/" + encodeURIComponent(date));
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload && payload.ok) {
          reflectionImageCache.set(date, payload);
          applyReflectionBackground(payload);
        } else {
          applyReflectionBackground(null);
        }
      } catch (e) {
        applyReflectionBackground(null);
      }
    }

    async function refreshHomeReflection() {
      const today = formatDateInput(new Date());
      if (!today) return;
      const cached = readStoredReadings(today) || previewCache.get(previewCacheKey(today, true));
      if (cached && cached.ok) applyHomeReflectionData(cached);
      refreshReflectionBackground(today);
      try {
        await ensureReadingsComplete(today, {
          onUpdate: (data) => applyHomeReflectionData(data),
        });
      } catch (e) {
        if (!cached && $("home-reflection-text")) {
          $("home-reflection-text").textContent = "Could not load today's Gospel.";
        }
      }
    }

    function setHomeWydCountdown(daysUntil) {
      const el = $("home-wyd-countdown");
      if (!el) return;
      if (typeof daysUntil !== "number" || Number.isNaN(daysUntil)) {
        el.textContent = "Aug 3, 2027";
        return;
      }
      if (daysUntil > 1) el.textContent = daysUntil + " days to go";
      else if (daysUntil === 1) el.textContent = "Tomorrow";
      else if (daysUntil === 0) el.textContent = "Today";
      else el.textContent = "Underway";
    }

    async function refreshWydNews(force) {
      const now = Date.now();
      if (!force && wydNewsLastRefreshAt && now - wydNewsLastRefreshAt < HOME_NEWS_STALE_MS) return;
      wydNewsLastRefreshAt = now;
      const list = $("home-wyd-list");
      const status = $("home-wyd-status");
      if (status) status.textContent = "Loading WYD news…";
      try {
        const headers = {};
        if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
          Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
        }
        const res = await fetch("/api/wyd-news", { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("WYD news unavailable");
        setHomeWydCountdown(data.days_until);
        const items = (Array.isArray(data.items) ? data.items : []).slice(0, HOME_WYD_PREVIEW_COUNT);
        if (list) {
          list.innerHTML = items.map((item) => "<li>" + renderHomeNewsItemMarkup(item, false) + "</li>").join("");
        }
        if (status) {
          status.textContent = items.length
            ? ""
            : "No recent World Youth Day headlines yet — follow the official site for updates.";
          status.hidden = items.length > 0;
        }
      } catch (e) {
        setHomeWydCountdown(undefined);
        if (list) list.innerHTML = "";
        if (status) {
          status.hidden = false;
          status.textContent = "Could not load WYD news — follow the official site for updates.";
        }
      }
    }

    var WYD_OFFICIAL_URL = "https://wydseoul.org/en";

    function visitWydSite(skipConfirm) {
      if (!skipConfirm && !window.confirm("Open the official World Youth Day Seoul 2027 website in a new tab?")) {
        return;
      }
      window.open(WYD_OFFICIAL_URL, "_blank", "noopener");
    }

    function initWydCard() {
      const card = $("home-wyd-card");
      if (!card || card.dataset.bound === "1") return;
      card.dataset.bound = "1";
      card.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        visitWydSite(false);
      });
      card.addEventListener("keydown", (e) => {
        if (e.target.closest("a")) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          visitWydSite(false);
        }
      });
    }

    function applyHomePreviewData(data, sun) {
      window.__liturgicalPresetId = liturgicalPresetIdFromSeason(data.season || "");
      applyLiturgicalSeasonTheme(data.season || "", data.liturgical_color || null);
      const seasonLabel = formatLiturgicalSeasonLabel(data.season || "");
      const yearLabel = formatLectionaryYearLabel(data.lectionary_cycle || "");
      if ($("home-liturgical-season")) $("home-liturgical-season").textContent = seasonLabel;
      if ($("home-liturgical-year")) $("home-liturgical-year").textContent = yearLabel;
      if (typeof syncHeaderTickerLiturgy === "function") syncHeaderTickerLiturgy();
      updateLiturgicalCountdowns();
      if (typeof syncCtaCardStats === "function") syncCtaCardStats();
      if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
      const fullG = (data.gospel_text || "").trim();
      if ($("home-gospel-quote")) {
        $("home-gospel-quote").textContent = fullG || data.gospel_quote || data.title || "Gospel text will appear when readings load.";
      }
      if ($("home-gospel-ref")) $("home-gospel-ref").textContent = data.gospel_reference || "—";
      updateHomeReadingCard("home-reading1-ref", "home-reading1-excerpt", data.first_reading_reference, data.first_reading_excerpt);
      updateHomeReadingCard("home-reading2-ref", "home-reading2-excerpt", data.second_reading_reference, data.second_reading_excerpt);
      const psalmRef = psalmCardReference(data);
      const psalmFull = psalmCardBody(data);
      updateHomeReadingCard("home-psalm-ref", "home-psalm-excerpt", psalmRef, psalmFull);
      const deferTheme = () => {
        renderThemeGrid();
        if ($("mass-date") && $("mass-date").value === sun) {
          renderMassSummarySidebar();
        }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(deferTheme, { timeout: 1200 });
      } else {
        setTimeout(deferTheme, 0);
      }
    }

    function syncCtaCardStats() {
      const seasonEl = $("home-liturgical-season");
      const yearEl = $("home-liturgical-year");
      const sun = getNextSundayCountdownTarget();
      const dateEl = $("liturgical-countdown-sunday-date");
      const gospelEl = $("home-gospel-ref");
      if (seasonEl && $("home-mass-stat-season")) {
        $("home-mass-stat-season").textContent = seasonEl.textContent;
      }
      if (yearEl && $("home-mass-stat-year")) {
        $("home-mass-stat-year").textContent = yearEl.textContent;
      }
      if ($("home-mass-days-countdown") && sun.target) {
        const dayMs = sun.target.getTime() - Date.now();
        const d = Math.max(0, Math.ceil(dayMs / 86400000));
        $("home-mass-days-countdown").textContent = d === 0 ? "today" : d + " day" + (d === 1 ? "" : "s");
      }
      if (dateEl && $("home-mass-sunday-date")) $("home-mass-sunday-date").textContent = dateEl.textContent || "—";
      if (gospelEl && $("home-mass-stat-gospel")) $("home-mass-stat-gospel").textContent = gospelEl.textContent || "—";
    }

    async function reloadFlowReadingsForLanguage(date) {
      const d = String(date || ($("mass-date") && $("mass-date").value) || "").trim();
      if (!d) return;
      try {
        const data = await fetchPreview(d, { readingsOnly: true, forceRefresh: true });
        if (data && data.ok !== false) {
          applyFlowReadingsData(data);
          flowPreviewData = Object.assign({}, flowPreviewData || {}, data, { __previewDate: d });
          window.__mwPreviewData = flowPreviewData;
          if (typeof fillAside === "function") {
            /* no-op if wizard aside unavailable outside mw scope */
          }
        }
      } catch (_err) {
        notify("Could not load " + currentMassLanguage() + " readings for this date.", "error");
      }
    }
    window.reloadFlowReadingsForLanguage = reloadFlowReadingsForLanguage;

    function applyFlowReadingsData(data) {
      if ($("flow-reading1-ref")) $("flow-reading1-ref").textContent = data.first_reading_reference || "—";
      if ($("flow-reading1-body")) $("flow-reading1-body").textContent = data.first_reading_excerpt || "—";
      if ($("flow-reading2-ref")) $("flow-reading2-ref").textContent = data.second_reading_reference || "—";
      if ($("flow-reading2-body")) $("flow-reading2-body").textContent = data.second_reading_excerpt || "—";
      if ($("flow-gospel-ref")) $("flow-gospel-ref").textContent = data.gospel_reference || "—";
      if ($("flow-gospel-body")) {
        const gt = (data.gospel_text || "").trim();
        $("flow-gospel-body").textContent = gt || "Retrieving Gospel text…";
      }
      populateGospelSentenceSelect(data);
      populatePsalmRefrainSelect(data);
      if ($("flow-psalm-ref")) $("flow-psalm-ref").textContent = psalmCardReference(data);
      if ($("flow-psalm-body")) {
        const pt = psalmCardBody(data);
        $("flow-psalm-body").textContent = pt || "Retrieving psalm text…";
      }
      if ($("flow-psalm-label")) {
        const psalmKind = responsorialSectionLabel(data.psalm_reference || data.psalm || "");
        $("flow-psalm-label").textContent = (psalmKind || "Responsorial psalm") + " refrain for the slide in PowerPoint.";
      }
      updateFlowParagraphPreviews();
      const activeDate = $("mass-date") && $("mass-date").value;
      if (flowPreviewData && flowPreviewData.__previewDate === activeDate) {
        Object.assign(flowPreviewData, {
          first_reading_reference: data.first_reading_reference,
          first_reading_excerpt: data.first_reading_excerpt,
          second_reading_reference: data.second_reading_reference,
          second_reading_excerpt: data.second_reading_excerpt,
          gospel_reference: data.gospel_reference,
          gospel_text: data.gospel_text,
          gospel_quote: data.gospel_quote,
          psalm_text: data.psalm_text,
          psalm_verses: data.psalm_verses,
          psalm_reference: data.psalm_reference,
          psalm_refrains: data.psalm_refrains,
          readings_complete: data.readings_complete,
        });
        window.__mwPreviewData = flowPreviewData;
        try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (mwErr) {}
      }
      try {
        const homeSun = upcomingSundayISO();
        if (activeDate && activeDate === homeSun) {
          window.__homePreview = Object.assign({}, data, { __previewDate: activeDate });
          previewCache.set(previewCacheKey(activeDate, false), Object.assign({}, (previewCache.get(previewCacheKey(activeDate, false)) || {}), data));
          previewCache.set(previewCacheKey(activeDate, true), data);
          if (readingsPayloadComplete(data)) writeStoredReadings(activeDate, data);
          applyHomePreviewData(Object.assign({}, (window.__homePreview || {}), data, { __previewDate: activeDate }), activeDate);
        }
      } catch (_homeSyncErr) { /* home card optional */ }
    }

    var MASS_PINNED_DEFAULTS_KEY = "mass_builder_pinned_defaults";

    function readMassPinnedDefaults() {
      try {
        const raw = localStorage.getItem(MASS_PINNED_DEFAULTS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (_e) {
        return {};
      }
    }

    function writeMassPinnedDefaults(map) {
      try {
        localStorage.setItem(MASS_PINNED_DEFAULTS_KEY, JSON.stringify(map || {}));
      } catch (_e) { /* ignore */ }
    }

    function massDefaultPinCurrentValue(key) {
      const k = String(key || "").trim();
      if (!k) return "";
      if (k.startsWith("songs.")) {
        const slot = k.slice(6);
        return String((selectedLyricsSongs && selectedLyricsSongs[slot]) || "").trim();
      }
      if (k === "flow-hymn-layout") {
        const picked = document.querySelector('input[name="flow-hymn-layout"]:checked');
        return picked ? String(picked.value || "").trim() : "";
      }
      const el = $(k);
      return el ? String(el.value || "").trim() : "";
    }

    function setMassDefaultPin(key, value, on) {
      const k = String(key || "").trim();
      const v = String(value || "").trim();
      if (!k || !v) return;
      const map = readMassPinnedDefaults();
      if (on) map[k] = v;
      else if (map[k] === v) delete map[k];
      writeMassPinnedDefaults(map);
      syncMassDefaultPins();
      if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
    }
    window.setMassDefaultPin = setMassDefaultPin;

    function massDefaultPinCompareValue(inp) {
      const key = inp.getAttribute("data-mw-default-key") || "";
      const optionVal = String(inp.getAttribute("data-mw-default-value") || "").trim();
      if (optionVal) return optionVal;
      const currentVal = massDefaultPinCurrentValue(key);
      if (currentVal) inp.setAttribute("data-mw-default-value", currentVal);
      return currentVal;
    }

    function syncMassDefaultPins(root) {
      const map = readMassPinnedDefaults();
      const scope = root && root.querySelectorAll ? root : document;
      const nodes = scope.querySelectorAll ? scope.querySelectorAll(".mw-default-pin__input") : [];
      nodes.forEach((inp) => {
        const key = inp.getAttribute("data-mw-default-key") || "";
        const compareVal = massDefaultPinCompareValue(inp);
        const on = !!(key && compareVal && map[key] === compareVal);
        inp.checked = on;
        const wrap = inp.closest(".mw-default-pin");
        if (wrap) wrap.classList.toggle("is-on", on);
      });
      syncRiteOptionsCollapse(root);
    }
    window.syncMassDefaultPins = syncMassDefaultPins;

    function riteSectionPinKey(riteEl) {
      if (!riteEl) return "";
      const sel = riteEl.querySelector("select[data-mw-tunes]");
      if (sel && sel.id) return sel.id;
      const pin = riteEl.querySelector(".mw-default-pin__input[data-mw-default-key]");
      return pin ? String(pin.getAttribute("data-mw-default-key") || "").trim() : "";
    }

    function syncRiteOptionsCollapse(root) {
      const flowPage = $("flow-page");
      if (!flowPage) return;
      const map = readMassPinnedDefaults();
      let rites = [];
      if (root && root.classList && root.classList.contains("mw-rite")) {
        rites = [root];
      } else if (root && root.closest) {
        const parentRite = root.closest('[data-mw-step="2"] .mw-rite, [data-mw-step="4"] .mw-rite');
        rites = parentRite
          ? [parentRite]
          : Array.from(flowPage.querySelectorAll('[data-mw-step="2"] .mw-rite, [data-mw-step="4"] .mw-rite'));
      } else {
        rites = Array.from(flowPage.querySelectorAll('[data-mw-step="2"] .mw-rite, [data-mw-step="4"] .mw-rite'));
      }
      rites.forEach((rite) => {
        const optsWrap = rite.querySelector(".mw-options");
        if (!optsWrap) {
          rite.classList.remove("mw-rite--collapse-default");
          return;
        }
        const pinKey = riteSectionPinKey(rite);
        const pinnedVal = pinKey ? String(map[pinKey] || "").trim() : "";
        const collapsed = !!pinnedVal;
        rite.classList.toggle("mw-rite--collapse-default", collapsed);
        optsWrap.querySelectorAll(".mw-option").forEach((opt) => {
          const val = String(opt.getAttribute("data-val") || "");
          opt.classList.toggle("mw-option--collapse-show", !collapsed || val === pinnedVal);
        });
      });
    }
    window.syncRiteOptionsCollapse = syncRiteOptionsCollapse;

    function initMassFieldDefaultPins() {
      document.querySelectorAll("[data-mw-field-pin]").forEach((host) => {
        const fieldId = host.getAttribute("data-mw-field-pin") || "";
        if (!fieldId || host.dataset.mwFieldPinReady === "1") return;
        host.dataset.mwFieldPinReady = "1";
        const label = document.createElement("label");
        label.className = "mw-default-pin";
        label.title = "Save current choice as my default next time";
        label.innerHTML =
          "<input type=\"checkbox\" class=\"mw-default-pin__input\" data-mw-default-key=\"" + escapeHtml(fieldId) + "\" />" +
          "<span class=\"mw-default-pin__text\">Use as default</span>";
        label.addEventListener("click", (e) => e.stopPropagation());
        label.addEventListener("change", (e) => {
          e.stopPropagation();
          const val = massDefaultPinCurrentValue(fieldId);
          if (!val) {
            e.target.checked = false;
            return;
          }
          setMassDefaultPin(fieldId, val, !!e.target.checked);
        });
        host.appendChild(label);
        if (fieldId === "flow-hymn-layout") {
          document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
            el.addEventListener("change", () => syncMassDefaultPins(host));
          });
        } else {
          const el = $(fieldId);
          if (el) el.addEventListener("change", () => syncMassDefaultPins(host));
        }
      });
      syncMassDefaultPins();
    }

    function applyMassPinnedDefaults() {
      const map = readMassPinnedDefaults();
      Object.keys(map).forEach((key) => {
        const val = String(map[key] || "").trim();
        if (!val) return;
        if (key.startsWith("songs.")) {
          const slot = key.slice(6);
          if (slot) assignMassSlotSong(slot, val);
          return;
        }
        if (key === "flow-hymn-layout") {
          document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
            el.checked = el.value === val;
          });
          return;
        }
        if (key === "flow-deck-theme" && typeof setActiveDeckTheme === "function") {
          setActiveDeckTheme(val);
          return;
        }
        if (key === "sanctus_tune") return;
        const el = $(key);
        if (el && "value" in el) {
          setMassBuilderFieldValue(key, val);
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      if (typeof syncRiteVideoUi === "function") syncRiteVideoUi();
      syncMassDefaultPins();
    }

    function bindMassDefaultPinDelegation() {
      if (window.__massDefaultPinBound) return;
      window.__massDefaultPinBound = true;
      document.addEventListener("change", (e) => {
        const inp = e.target && e.target.classList && e.target.classList.contains("mw-default-pin__input")
          ? e.target
          : null;
        if (!inp) return;
        const key = inp.getAttribute("data-mw-default-key") || "";
        const val = massDefaultPinCompareValue(inp);
        if (!val) {
          inp.checked = false;
          return;
        }
        setMassDefaultPin(key, val, !!inp.checked);
      });
      document.addEventListener("click", (e) => {
        if (e.target.closest(".mw-default-pin")) e.stopPropagation();
      }, true);
    }

    var massHabitsCache = null;
    var massHabitsCacheDate = "";
    var massHabitsDismissedForDate = "";

    function hideMassHabitsBanner() {
      const banner = $("mw-habits-banner");
      if (banner) banner.hidden = true;
    }

    function showMassHabitsBanner(payload) {
      if (!isFeatureEnabled("mass_habits")) {
        hideMassHabitsBanner();
        return;
      }
      const banner = $("mw-habits-banner");
      if (!banner || !payload || !payload.has_habits) {
        hideMassHabitsBanner();
        return;
      }
      const title = $("mw-habits-banner-title");
      const hint = $("mw-habits-banner-hint");
      const n = payload.learned_count || 0;
      if (title) {
        title.textContent = n
          ? ("Your usual settings · " + n + " remembered")
          : "Your usual settings";
      }
      if (hint) {
        hint.textContent = payload.hint || "Based on your Masses from the last month.";
      }
      banner.hidden = false;
    }

    function applyMassHabitSuggestions(suggestions, opts) {
      const o = opts || {};
      const force = !!o.force;
      if (!suggestions || typeof suggestions !== "object") return false;
      let applied = false;

      if (suggestions.creed_choice) {
        setMassBuilderFieldValue("flow-creed-choice", suggestions.creed_choice);
        applied = true;
      }
      if (suggestions.our_father_choice) {
        setMassBuilderFieldValue("flow-our-father-choice", suggestions.our_father_choice);
        applied = true;
      }
      if (suggestions.mass_language === "english" || suggestions.mass_language === "tagalog") {
        // Never auto-switch Mass language on date/load — only Quick Mass (force) may apply it.
        if (force) {
          setMassBuilderFieldValue("flow-mass-language", suggestions.mass_language);
          applied = true;
        }
      }
      if (suggestions.hymn_lyrics_layout === "single" || suggestions.hymn_lyrics_layout === "dual") {
        document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
          el.checked = el.value === suggestions.hymn_lyrics_layout;
        });
        applied = true;
      }
      if (typeof suggestions.include_church_logo === "boolean") {
        setMassBuilderFieldValue("flow-include-church-logo", suggestions.include_church_logo);
        applied = true;
      }
      if (typeof suggestions.include_church_name === "boolean") {
        setMassBuilderFieldValue("flow-include-church-name", suggestions.include_church_name);
        applied = true;
      }
      if (typeof suggestions.include_footer === "boolean") {
        setMassBuilderFieldValue("flow-show-footer", suggestions.include_footer);
        applied = true;
      }
      if (suggestions.lotw_poster) {
        setMassBuilderFieldValue("flow-lotw-poster", suggestions.lotw_poster);
        if (typeof restoreMassBuilderPosterPicker === "function") {
          restoreMassBuilderPosterPicker("flow-lotw-poster", suggestions.lotw_poster);
        }
        applied = true;
      }
      if (suggestions.lote_poster) {
        setMassBuilderFieldValue("flow-lote-poster", suggestions.lote_poster);
        if (typeof restoreMassBuilderPosterPicker === "function") {
          restoreMassBuilderPosterPicker("flow-lote-poster", suggestions.lote_poster);
        }
        applied = true;
      }
      if (suggestions.divider_style && typeof window.setActiveDividerStyle === "function") {
        window.setActiveDividerStyle(suggestions.divider_style);
        applied = true;
      }
      if (suggestions.celebrant && (force || !(($("celebrant") && $("celebrant").value) || "").trim())) {
        if (typeof setCelebrantPickerValue === "function") {
          setCelebrantPickerValue(String(suggestions.celebrant));
          applied = true;
        }
      }

      const songs = suggestions.songs;
      const songMeta = (o.confidence && o.confidence.songs) || {};
      if (songs && typeof songs === "object") {
        const habitSongs = {};
        Object.keys(songs).forEach((slot) => {
          const id = String(songs[slot] || "").trim();
          if (!id) return;
          const meta = songMeta[slot] || {};
          const fromHabit = meta.source === "user" || meta.source === "parish";
          if (!(force || fromHabit)) return;
          // Permanent sticky-song fix: on normal loads only fill empty slots.
          // Overwrite existing picks only for Quick Mass (force).
          if (!force && String(selectedLyricsSongs[slot] || "").trim()) return;
          habitSongs[slot] = id;
        });
        if (Object.keys(habitSongs).length) {
          const picks = selectionsFromSongIds(habitSongs, (flowPreviewData && inferGospelMoodKey(flowPreviewData)) || "reverent");
          if (picks.length) {
            if (force) {
              applySongSelectionsToPlan(picks);
            } else {
              picks.forEach((pick) => {
                if (!pick.slotKey || !pick.id) return;
                if (String(selectedLyricsSongs[pick.slotKey] || "").trim()) return;
                if (typeof assignMassSlotSong === "function") assignMassSlotSong(pick.slotKey, pick.id);
                else selectedLyricsSongs[pick.slotKey] = pick.id;
              });
            }
            applied = true;
          }
        }
      }
      return applied;
    }

    async function fetchMassSmartDefaults(date) {
      const d = String(date || "").trim();
      if (!d || !isFeatureEnabled("mass_habits")) return null;
      if (massHabitsCache && massHabitsCacheDate === d) return massHabitsCache;
      try {
        const data = await getJSON("/api/mass/smart-defaults?date=" + encodeURIComponent(d));
        massHabitsCache = data;
        massHabitsCacheDate = d;
        return data;
      } catch (_e) {
        return null;
      }
    }

    async function maybeApplyMassHabits(date, opts) {
      const o = opts || {};
      if (massDraftRestoring && !o.force) return null;
      if (!isFeatureEnabled("mass_habits")) {
        hideMassHabitsBanner();
        return null;
      }
      const d = String(date || "").trim();
      if (!d) return null;
      if (!o.force && massHabitsDismissedForDate === d) {
        hideMassHabitsBanner();
        return null;
      }
      const data = await fetchMassSmartDefaults(d);
      if (!data || data.disabled) {
        hideMassHabitsBanner();
        return null;
      }
      if (data.has_habits && !o.skipApply) {
        applyMassHabitSuggestions(data.suggestions || {}, {
          force: !!o.force,
          confidence: data.confidence || {},
        });
        if (typeof rebuildMassPlanSongPool === "function") rebuildMassPlanSongPool();
        if (typeof renderMassSongPlan === "function") renderMassSongPlan();
        if (typeof renderMassSummarySidebar === "function") renderMassSummarySidebar();
        document.dispatchEvent(new CustomEvent("mw:aside-refresh"));
      }
      if (data.has_habits && massHabitsDismissedForDate !== d) {
        showMassHabitsBanner(data);
      } else {
        hideMassHabitsBanner();
      }
      return data;
    }

    async function runQuickMassFromHabits() {
      const dateEl = $("mass-date");
      const date = dateEl ? (dateEl.value || "").trim() : "";
      if (!date) {
        notify("Choose a Mass date first.", "error");
        return;
      }
      const data = await fetchMassSmartDefaults(date);
      if (data && data.suggestions) {
        applyMassHabitSuggestions(data.suggestions, {
          force: true,
          confidence: data.confidence || {},
        });
        if (typeof rebuildMassPlanSongPool === "function") rebuildMassPlanSongPool();
        if (typeof renderMassSongPlan === "function") renderMassSongPlan();
        if (typeof renderMassSummarySidebar === "function") renderMassSummarySidebar();
      }
      hideMassHabitsBanner();
      if (window.MassWizard && typeof window.MassWizard.setStep === "function") {
        window.MassWizard.setStep(7);
      }
      if (typeof scheduleMassBuilderDraftAutoSave === "function") {
        scheduleMassBuilderDraftAutoSave();
      }
      notify("Quick Mass ready — review and generate.", "ok");
    }

    function wireMassHabitsBanner() {
      const dismiss = $("mw-habits-dismiss");
      const quick = $("mw-habits-quick");
      if (dismiss && dismiss.dataset.habitsWired !== "1") {
        dismiss.dataset.habitsWired = "1";
        dismiss.addEventListener("click", () => {
          const d = ($("mass-date") && $("mass-date").value) || massHabitsCacheDate || "";
          massHabitsDismissedForDate = d;
          hideMassHabitsBanner();
        });
      }
      if (quick && quick.dataset.habitsWired !== "1") {
        quick.dataset.habitsWired = "1";
        quick.addEventListener("click", () => {
          runQuickMassFromHabits().catch(() => notify("Could not apply Quick Mass defaults.", "error"));
        });
      }
    }
    wireMassHabitsBanner();

    async function loadFlowData(auto = false) {
      const date = $("mass-date").value;
      if (!date) {
        if (!auto) notify("Choose a Mass date first.", "error");
        return;
      }
      $("btn-load-flow").disabled = true;
      if ($("btn-load-flow-inline")) $("btn-load-flow-inline").disabled = true;
      if (!auto) setMassSongPlanRefreshing(true);
      const readSteps = buildMassGenStepList({ flow: "readings" });
      if (!auto) {
        setMassGenLoading(true, {
          title: "Loading readings",
          steps: readSteps,
          step: 0,
        });
        advanceMassGenStep(1);
      }
      const recsWrap = $("mass-summary-recs");
      const moodList = $("mass-summary-mood-picks");
      if (!auto && recsWrap && !recsWrap.hidden && moodList) {
        recsWrap.classList.add("is-refreshing");
        moodList.setAttribute("aria-busy", "true");
        moodList.innerHTML = massMoodPickSkeletonHtml(massMoodPickSelections.length || 5);
      }
      try {
        if (!auto) advanceMassGenStep(2, { message: "Retrieving official readings…" });
        const [data] = await Promise.all([
          fetchPreview(date, { readingsOnly: false }),
          loadSongCatalog(),
        ]);
        if (!auto) advanceMassGenStep(3, { message: "Preparing the Liturgy of the Word…" });
        flowPreviewData = Object.assign({}, data, { __previewDate: date });
        window.__liturgicalPresetId = liturgicalPresetIdFromSeason(data.season || "");
        applyLiturgicalSeasonTheme(data.season || "", data.liturgical_color || null);
        renderThemeGrid();
        const season = [data.season, data.lectionary_cycle].filter(Boolean).join(" - ") || "Season loaded";
        const seasonEl = $("season-indicator");
        if (seasonEl) seasonEl.textContent = season;
        songOptionsBySection = data.songs_by_section || songOptionsBySection;
        if (!massDraftRestoring) {
          // Permanent sticky-song fix: do NOT rebuild the 5 hymn picks on every
          // date change. Only seed when the plan is empty or clearly stuck on
          // legacy/catalog-head defaults. Habits fill empty slots only (see
          // applyMassHabitSuggestions) unless Quick Mass is used.
          const hasSongPlan = typeof HOME_SONG_SLOTS !== "undefined" && HOME_SONG_SLOTS.some(function (slot) {
            return !!(selectedLyricsSongs[slot.key] || "").trim();
          });
          const stuckDefaults = typeof songPlanNeedsMoodReload === "function" && songPlanNeedsMoodReload();
          if (!hasSongPlan || stuckDefaults) {
            applyGospelMoodDefaultsToSongPlan();
          }
          window.__massSongPlanPreviewDate = date;
          maybeApplyMassHabits(date).catch(function () { /* habits optional */ });
        }
        rebuildMassPlanSongPool();
        renderMassSongPlan();
        updateMassSummaryMoodPicks();
        revealStaggerChildren($("mass-song-plan"), ".mass-song-plan-card:not(.mass-song-plan-card--skeleton)");
        revealStaggerChildren(moodList, ".mass-summary-mood-pick:not(.mass-summary-mood-pick--skeleton)");
        if ($("flow-reading1-ref")) $("flow-reading1-ref").textContent = data.first_reading_reference || "—";
        if ($("flow-reading1-body")) $("flow-reading1-body").textContent = data.first_reading_excerpt || "Retrieving first reading…";
        if ($("flow-reading2-ref")) $("flow-reading2-ref").textContent = data.second_reading_reference || "—";
        if ($("flow-reading2-body")) $("flow-reading2-body").textContent = data.second_reading_excerpt || "Retrieving second reading…";
        if ($("flow-gospel-ref")) $("flow-gospel-ref").textContent = data.gospel_reference || "—";
        if ($("flow-gospel-body")) {
          const gt = (data.gospel_text || "").trim();
          $("flow-gospel-body").textContent = gt || "Retrieving Gospel text…";
        }
        populateGospelSentenceSelect(data);
        if ($("flow-gospel-custom")) $("flow-gospel-custom").value = "";
        populatePsalmRefrainSelect(data);
        if ($("flow-psalm-custom")) $("flow-psalm-custom").value = "";
        if ($("flow-psalm-ref")) {
          $("flow-psalm-ref").textContent = psalmCardReference(data);
        }
        if ($("flow-psalm-body")) {
          const pt = psalmCardBody(data);
          $("flow-psalm-body").textContent = pt || "Retrieving psalm text…";
        }
        if ($("flow-psalm-label")) {
          const psalmKind = responsorialSectionLabel(data.psalm_reference || data.psalm || "");
          $("flow-psalm-label").textContent = (psalmKind || "Responsorial psalm") + " refrain for the slide in PowerPoint.";
        }
        updateFlowParagraphPreviews();
        renderFlowSongCount();
        updatePosterLivePreview();
        window.__mwPreviewData = flowPreviewData;
        try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (mwErr) {}
        // Keep the home Sunday readings card on the same preview payload.
        try {
          const homeSun = upcomingSundayISO();
          if (date === homeSun) {
            window.__homePreview = Object.assign({}, data, { __previewDate: date });
            previewCache.set(previewCacheKey(date, false), data);
            previewCache.set(previewCacheKey(date, true), data);
            if (readingsPayloadComplete(data)) writeStoredReadings(date, data);
            applyHomePreviewData(data, date);
          }
        } catch (_homeSyncErr) { /* home card optional */ }
        if (!readingsPayloadComplete(data)) {
          startReadingsPoll(date, (fresh) => {
            if ($("mass-date").value !== date) return;
            applyFlowReadingsData(fresh);
            try {
              const homeSun = upcomingSundayISO();
              if (date === homeSun) {
                window.__homePreview = Object.assign({}, fresh, { __previewDate: date });
                applyHomePreviewData(fresh, date);
              }
            } catch (_e) { /* ignore */ }
          });
        }
        if (!auto) notify("Planner refreshed with lectionary context and hymn recommendations.", "ok");
      } catch (error) {
        if (!auto) {
          showMassGenError(error.message || "Unable to retrieve Sunday readings.", readSteps.length ? readSteps.length - 1 : 2, () => loadFlowData(false));
        } else {
          notify(error.message || "Could not load readings.", "error");
        }
        renderMassSongPlan();
      } finally {
        setMassSongPlanRefreshing(false);
        if (recsWrap) recsWrap.classList.remove("is-refreshing");
        if (moodList) moodList.setAttribute("aria-busy", "false");
        $("btn-load-flow").disabled = false;
        if ($("btn-load-flow-inline")) $("btn-load-flow-inline").disabled = false;
        if (!auto && !massGenProgressState.errored) {
          await new Promise((resolve) => setTimeout(resolve, 320));
          setMassGenLoading(false);
        }
      }
    }

    function selectedSongsForGenerate() {
      const songs = {};
      const entrance = selectedLyricsSongs.entrance;
      const offertory = selectedLyricsSongs.offertory;
      const recessional = selectedLyricsSongs.recessional;
      if (entrance) songs.entrance = entrance;
      if (offertory) songs.offertory = offertory;
      communionSlotKeys(massCommunionCount).forEach((key) => {
        const id = selectedLyricsSongs[key];
        if (id) songs[key] = id;
      });
      if (recessional) songs.recessional = recessional;
      const extra = [];
      lyricSongSlots.forEach((slot) => {
        if (!slot.custom) return;
        const sid = (selectedLyricsSongs[slot.key] || "").trim();
        if (sid) extra.push({ label: (slot.label || "").trim(), song_id: sid });
      });
      if (extra.length) songs.extra_sections = extra;
      return songs;
    }

    function formatLongDateLabel(iso) {
      if (!iso) return "";
      const d = new Date(iso + "T12:00:00");
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }

    async function uploadMassImage(file, endpoint) {
      if (!guardFullAppAction()) throw new Error("Upload not allowed for this account.");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.detail || data.error || res.statusText;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      return data.basename;
    }

    var massGenProgressState = {
      steps: [],
      current: 0,
      simTimer: null,
      errored: false,
      onRetry: null,
    };

    var MASS_GEN_STEP_SETS = {
      standard: [
        "Validating liturgical information",
        "Loading liturgical calendar",
        "Fetching Sunday readings",
        "Building PowerPoint slides",
        "Applying presentation preset",
        "Optimizing typography",
        "Finalizing presentation",
      ],
      withUpload: [
        "Validating liturgical information",
        "Loading liturgical calendar",
        "Fetching Sunday readings",
        "Uploading artwork",
        "Building PowerPoint slides",
        "Applying presentation preset",
        "Optimizing typography",
        "Finalizing presentation",
      ],
      withAi: [
        "Validating liturgical information",
        "Loading liturgical calendar",
        "Fetching Sunday readings",
        "Understanding the Gospel",
        "Connecting to AI",
        "Creating the artwork",
        "Composing your Mass Divider",
        "Building PowerPoint slides",
        "Checking typography",
        "Finalizing your poster",
      ],
      withAiUpload: [
        "Validating liturgical information",
        "Loading liturgical calendar",
        "Fetching Sunday readings",
        "Uploading artwork",
        "Understanding the Gospel",
        "Connecting to AI",
        "Creating the artwork",
        "Composing your Mass Divider",
        "Building PowerPoint slides",
        "Checking typography",
        "Finalizing your poster",
      ],
      reusePoster: [
        "Validating liturgical information",
        "Loading liturgical calendar",
        "Fetching Sunday readings",
        "Applying saved artwork",
        "Building PowerPoint slides",
        "Applying presentation preset",
        "Finalizing presentation",
      ],
      readings: [
        "Loading liturgical calendar",
        "Finding the selected Mass",
        "Retrieving official readings",
        "Preparing the Liturgy of the Word",
      ],
      lyricsImport: [
        "Uploading lyrics",
        "Reading file",
        "Detecting metadata",
        "Separating verses",
      ],
    };

    function buildMassGenStepList(opts) {
      const o = opts || {};
      if (o.flow === "readings") return MASS_GEN_STEP_SETS.readings.slice();
      if (o.flow === "lyrics") return MASS_GEN_STEP_SETS.lyricsImport.slice();
      if (o.reusePoster) return MASS_GEN_STEP_SETS.reusePoster.slice();
      if (o.useAi && o.hasUpload) return MASS_GEN_STEP_SETS.withAiUpload.slice();
      if (o.useAi) return MASS_GEN_STEP_SETS.withAi.slice();
      if (o.hasUpload) return MASS_GEN_STEP_SETS.withUpload.slice();
      return MASS_GEN_STEP_SETS.standard.slice();
    }

    function clearMassGenProgressTimers() {
      if (massGenProgressState.simTimer) {
        clearInterval(massGenProgressState.simTimer);
        massGenProgressState.simTimer = null;
      }
    }

    function renderMassGenSteps(steps, activeIndex, failedIndex) {
      const list = $("mass-gen-loader-steps");
      if (!list) return;
      const items = steps || [];
      list.innerHTML = items.map((label, i) => {
        let state = "is-pending";
        let icon = '<span class="mass-gen-loader__step-icon" aria-hidden="true">○</span>';
        if (failedIndex != null && i === failedIndex) {
          state = "is-failed";
          icon = '<span class="mass-gen-loader__step-icon" aria-hidden="true">✕</span>';
        } else if (i < activeIndex) {
          state = "is-done";
          icon = '<span class="mass-gen-loader__step-icon" aria-hidden="true">✓</span>';
        } else if (i === activeIndex) {
          state = "is-active";
          icon = '<span class="mass-gen-loader__step-icon" aria-hidden="true"><span class="mass-gen-loader__step-spinner"></span></span>';
        }
        return (
          '<li class="mass-gen-loader__step ' + state + '" role="listitem">' +
            icon +
            '<span class="mass-gen-loader__step-label">' + escapeHtml(label) + "</span>" +
          "</li>"
        );
      }).join("");
    }

    function updateMassGenPercent(percent) {
      const wrap = $("mass-gen-loader-pct-wrap");
      const fill = $("mass-gen-loader-pct-fill");
      const label = $("mass-gen-loader-pct-label");
      if (!wrap || !fill) return;
      if (percent == null || Number.isNaN(percent)) {
        wrap.hidden = true;
        return;
      }
      const pct = Math.max(0, Math.min(100, Math.round(percent)));
      wrap.hidden = false;
      fill.style.width = pct + "%";
      if (label) label.textContent = pct + "%";
    }

    function massGenPercentFromStep(activeIndex, total) {
      if (!total) return null;
      return Math.round(((activeIndex + 0.35) / total) * 100);
    }

    function advanceMassGenStep(index, opts) {
      const o = opts || {};
      const steps = o.steps || massGenProgressState.steps;
      if (!steps.length) return;
      const idx = Math.max(0, Math.min(index, steps.length - 1));
      massGenProgressState.steps = steps;
      massGenProgressState.current = idx;
      renderMassGenSteps(steps, idx, o.failedIndex);
      if (o.message) {
        const msgEl = $("mass-gen-loader-msg");
        if (msgEl) msgEl.textContent = o.message;
      } else {
        const msgEl = $("mass-gen-loader-msg");
        if (msgEl && steps[idx]) msgEl.textContent = steps[idx] + "…";
      }
      if (o.percent != null) {
        updateMassGenPercent(o.percent);
      } else {
        updateMassGenPercent(massGenPercentFromStep(idx, steps.length));
      }
    }

    function startMassGenStepSimulation(fromIndex, paceMs) {
      clearMassGenProgressTimers();
      const steps = massGenProgressState.steps;
      if (!steps.length) return;
      let i = Math.max(0, fromIndex);
      const cap = Math.max(0, steps.length - 2);
      massGenProgressState.simTimer = setInterval(() => {
        if (i >= cap) {
          clearMassGenProgressTimers();
          return;
        }
        advanceMassGenStep(i);
        i += 1;
      }, paceMs || 2400);
    }

    function showMassGenError(message, failedStepIndex, onRetry) {
      const overlay = $("mass-gen-loader");
      if (!overlay) return;
      massGenProgressState.errored = true;
      massGenProgressState.onRetry = typeof onRetry === "function" ? onRetry : null;
      overlay.classList.add("visible", "is-error");
      overlay.classList.remove("is-success");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      clearMassGenProgressTimers();
      const title = $("mass-gen-loader-title");
      if (title) title.textContent = "Something went wrong";
      renderMassGenSteps(massGenProgressState.steps, massGenProgressState.current, failedStepIndex != null ? failedStepIndex : massGenProgressState.current);
      const msgEl = $("mass-gen-loader-msg");
      if (msgEl) msgEl.textContent = "";
      const errWrap = $("mass-gen-loader-error");
      const errMsg = $("mass-gen-loader-error-msg");
      if (errWrap) errWrap.hidden = false;
      if (errMsg) errMsg.textContent = message || "We could not finish this step. Your Mass settings are still saved.";
      updateMassGenPercent(null);
    }

    async function showMassGenSuccess(title, subtitle) {
      const overlay = $("mass-gen-loader");
      if (!overlay) return;
      clearMassGenProgressTimers();
      overlay.classList.add("is-success");
      overlay.classList.remove("is-error");
      const titleEl = $("mass-gen-loader-title");
      if (titleEl) titleEl.textContent = title || "Presentation successfully generated.";
      const msgEl = $("mass-gen-loader-msg");
      if (msgEl) msgEl.textContent = subtitle || "Your PowerPoint is ready.";
      updateMassGenPercent(100);
      await new Promise((resolve) => setTimeout(resolve, 1400));
    }

    function setMassGenLoading(active, messageOrOpts) {
      const overlay = $("mass-gen-loader");
      if (!overlay) return;
      if (!active) {
        clearMassGenProgressTimers();
        massGenProgressState.errored = false;
        massGenProgressState.onRetry = null;
        overlay.classList.remove("visible", "is-success", "is-error");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        const errWrap = $("mass-gen-loader-error");
        if (errWrap) errWrap.hidden = true;
        updateMassGenPercent(null);
        return;
      }
      const opts = typeof messageOrOpts === "string" ? { message: messageOrOpts } : (messageOrOpts || {});
      massGenProgressState.errored = false;
      overlay.classList.add("visible");
      overlay.classList.remove("is-success", "is-error");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const errWrap = $("mass-gen-loader-error");
      if (errWrap) errWrap.hidden = true;
      if (opts.title) {
        const titleEl = $("mass-gen-loader-title");
        if (titleEl) titleEl.textContent = opts.title;
      }
      if (opts.steps) {
        massGenProgressState.steps = opts.steps.slice();
      }
      if (opts.step != null) {
        advanceMassGenStep(opts.step, {
          steps: massGenProgressState.steps,
          message: opts.message,
          percent: opts.percent,
          failedIndex: opts.failedIndex,
        });
      } else if (opts.message) {
        const msgEl = $("mass-gen-loader-msg");
        if (msgEl) msgEl.textContent = opts.message;
      }
      if (opts.percent != null && opts.step == null) {
        updateMassGenPercent(opts.percent);
      }
    }

    (function bindMassGenLoaderRetry() {
      const btn = $("mass-gen-loader-retry");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const retry = massGenProgressState.onRetry;
        setMassGenLoading(false);
        if (retry) retry();
      });
    })();

    function readSocialExportSettings(o) {
      if (!isFeatureEnabled("social_poster_export")) return false;
      if (o && o.include_social != null) return !!o.include_social;
      const flowCb = $("flow-include-social-exports");
      const posterCb = $("poster-include-social");
      if (flowCb) return flowCb.checked;
      if (posterCb) return posterCb.checked;
      return false;
    }

    function bindSocialExportControls() {
      const ids = ["flow-include-social-exports", "poster-include-social"];
      ids.forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          ids.forEach((oid) => {
            const other = $(oid);
            if (other) other.checked = el.checked;
          });
        });
      });
    }

    function readOpenAiPosterSettings() {
      if (!isFeatureEnabled("ai_image_generation")) {
        return {
          useOpenai: false,
          useGemini: false,
          useAi: false,
          backend: null,
          style: "cinematic",
        };
      }
      syncAiPosterToggleState();
      const flowAi = $("flow-use-ai-poster");
      const posterAi = $("poster-use-ai-poster");
      const useAi = !!(
        (flowAi && flowAi.checked) ||
        (posterAi && posterAi.checked) ||
        ($("flow-use-openai-poster") && $("flow-use-openai-poster").checked) ||
        ($("flow-use-gemini-poster") && $("flow-use-gemini-poster").checked) ||
        ($("poster-use-openai-poster") && $("poster-use-openai-poster").checked) ||
        ($("poster-use-gemini-poster") && $("poster-use-gemini-poster").checked)
      );
      const styleEl = $("flow-openai-poster-style") || $("poster-openai-poster-style");
      return {
        useOpenai: useAi,
        useGemini: false,
        useAi,
        backend: useAi ? "openai" : null,
        style: (styleEl && styleEl.value) || "cinematic",
      };
    }

    function setAiPosterSwitchLabel(on) {
      const flowInput = $("flow-use-ai-poster");
      const flowLabel = flowInput && flowInput.closest("label");
      const flowText = flowLabel && flowLabel.querySelector(".mw-switch__text");
      if (flowText) flowText.textContent = on ? "On" : "Off";
      const posterInput = $("poster-use-ai-poster");
      const posterLabel = posterInput && posterInput.closest("label");
      const posterText = posterLabel && posterLabel.querySelector(".mw-switch__text");
      if (posterText) posterText.textContent = on ? "AI poster art · On" : "AI poster art · Off";
    }

    function migrateLegacyAiPosterToggles() {
      const masters = ["flow-use-ai-poster", "poster-use-ai-poster"]
        .map((id) => $(id))
        .filter(Boolean);
      if (!masters.length || masters.some((el) => el.checked)) return;
      const legacyOn = [
        "flow-use-openai-poster",
        "flow-use-gemini-poster",
        "poster-use-openai-poster",
        "poster-use-gemini-poster",
      ].some((id) => {
        const el = $(id);
        return !!(el && el.checked);
      });
      if (legacyOn) masters.forEach((el) => { el.checked = true; });
    }

    function syncAiPosterToggleState() {
      const masters = ["flow-use-ai-poster", "poster-use-ai-poster"]
        .map((id) => $(id))
        .filter(Boolean);
      // Masters are the source of truth. Never re-enable from legacy checkboxes here —
      // that snapped the switch back On after the user turned it Off.
      const on = masters.some((el) => el.checked);
      masters.forEach((el) => { el.checked = on; });
      ["flow-use-openai-poster", "poster-use-openai-poster"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = on;
      });
      ["flow-use-gemini-poster", "poster-use-gemini-poster"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = false;
      });
      setAiPosterSwitchLabel(on);
    }

    function syncOpenAiPosterUi() {
      syncAiPosterToggleState();
      const { useAi } = readOpenAiPosterSettings();
      const litWrap = $("poster-liturgical-template-wrap");
      if (litWrap) litWrap.style.display = useAi ? "none" : "";
      ["flow-openai-style-wrap", "poster-openai-style-wrap"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        const field = el.closest(".field") || el.closest(".flow-setup-footer__toggle-item") || el;
        field.style.opacity = useAi ? "1" : "0.55";
        field.style.pointerEvents = useAi ? "" : "none";
        field.setAttribute("aria-disabled", useAi ? "false" : "true");
      });
      ["flow-openai-poster-style", "poster-openai-poster-style"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.disabled = !useAi;
        const wrap = el.closest(".vb-select");
        if (wrap) {
          if (!useAi) closeVerbumSelect(wrap);
          syncVerbumSelectTrigger(el);
        }
      });
    }

    async function refreshAiImageQuotaHint() {
      const nodes = document.querySelectorAll(".ai-image-quota-hint");
      if (!nodes.length) return;
      try {
        const res = await fetch("/api/image-quota");
        const q = await res.json();
        nodes.forEach((el) => {
          const compact = el.closest(".flow-setup-quota-badge");
          const rem = (q.remaining != null ? q.remaining : "?");
          const lim = (q.limit != null ? q.limit : "?");
          const msg = q.allowed
            ? (compact
              ? (rem + " left this week")
              : (rem + " of " + lim + " AI poster generation" + (lim === 1 ? "" : "s") + " left this week."))
            : (compact
              ? ("Weekly limit reached (" + lim + "/wk)")
              : ("Weekly AI image limit reached (" + lim + "/week UTC). Use the liturgical template, or try again next week."));
          el.textContent = msg;
          el.style.color = q.allowed ? "" : "var(--warn)";
        });
        const disableAi = !q.allowed;
        ["flow-use-ai-poster", "poster-use-ai-poster", "flow-use-openai-poster", "flow-use-gemini-poster", "poster-use-openai-poster", "poster-use-gemini-poster"].forEach((id) => {
          const el = $(id);
          if (!el) return;
          el.disabled = disableAi;
          if (disableAi) el.checked = false;
        });
        syncOpenAiPosterUi();
      } catch (_e) {
        nodes.forEach((el) => { el.textContent = ""; });
      }
    }

    
    function bindAiPosterQuotaStyleWatch() {
      if (window.__aiQuotaStyleBound) return;
      window.__aiQuotaStyleBound = true;
      ["flow-openai-poster-style", "poster-openai-poster-style", "mass-date"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => { refreshAiImageQuotaHint(); });
      });
    }

    function bindOpenAiPosterControls() {
      ["flow-use-ai-poster", "poster-use-ai-poster"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          const on = !!el.checked;
          ["flow-use-ai-poster", "poster-use-ai-poster"].forEach((oid) => {
            const other = $(oid);
            if (other) other.checked = on;
          });
          syncOpenAiPosterUi();
          if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
        });
      });
      const textCheckboxes = ["flow-include-poster-text", "poster-include-poster-text"];
      textCheckboxes.forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          textCheckboxes.forEach((oid) => {
            const other = $(oid);
            if (other) other.checked = el.checked;
          });
        });
      });
      const styles = ["flow-openai-poster-style", "poster-openai-poster-style"];
      styles.forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          styles.forEach((oid) => {
            const other = $(oid);
            if (other) other.value = el.value;
          });
        });
      });
      migrateLegacyAiPosterToggles();
      syncOpenAiPosterUi();
    }

    var massGenReceiptResolve = null;
    var massGenReceiptEditMode = false;
    var massGenReceiptOptionsCache = null;

    function receiptSlotShortLabel(song) {
      const map = {
        entrance: "Entrance",
        offertory: "Offertory",
        communion_1: "Communion I",
        communion_2: "Communion II",
        communion_3: "Communion III",
        communion_4: "Communion IV",
        communion_5: "Communion V",
        recessional: "Recessional",
      };
      return map[song.slotKey] || song.label;
    }

    function receiptCelebrantDisplay(model) {
      if (model.coCelebrant) return model.mainCelebrant + " · " + model.coCelebrant;
      return model.mainCelebrant || "—";
    }

    function receiptFootnote(model) {
      const parts = [];
      if (model.collection) parts.push(model.collection);
      if (model.aiPoster) parts.push("AI poster");
      if (model.creed) parts.push(model.creed);
      return parts.join(" · ");
    }

    function receiptViewLine(label, value, missing) {
      const cls = "mass-gen-receipt__line" + (missing ? " mass-gen-receipt__line--missing" : "");
      const display = value || "—";
      const suffix = missing ? " · no lyrics" : "";
      return (
        "<div class=\"" + cls + "\">" +
          "<span class=\"mass-gen-receipt__line-label\">" + escapeHtml(label) + "</span>" +
          "<span class=\"mass-gen-receipt__line-dots\" aria-hidden=\"true\"></span>" +
          "<span class=\"mass-gen-receipt__line-value\">" + escapeHtml(display + suffix) + "</span>" +
        "</div>"
      );
    }

    function renderMassGenerateReceiptView(model) {
      const alertHtml = model.missingLyricsCount > 0
        ? "<div class=\"mass-gen-receipt__alert\" role=\"alert\">" +
            escapeHtml(model.missingLyricsCount + " missing lyrics") +
          "</div>"
        : "";
      const selectedSongs = model.songs.filter((s) => s.id);
      const songLines = selectedSongs.length
        ? selectedSongs.map((song) => receiptViewLine(
            receiptSlotShortLabel(song),
            song.title,
            song.missingLyrics
          )).join("")
        : receiptViewLine("Songs", "None selected", false);
      const foot = receiptFootnote(model);
      return (
        alertHtml +
        "<div class=\"mass-gen-receipt__meta\">" +
          "<p class=\"mass-gen-receipt__title\">" + escapeHtml(formatMassSummaryDate(model.date)) + "</p>" +
          "<p class=\"mass-gen-receipt__sub\">" + escapeHtml(receiptCelebrantDisplay(model)) + "</p>" +
          (model.gospelRef ? "<p class=\"mass-gen-receipt__stamp\">" + escapeHtml(model.gospelRef) + "</p>" : "") +
        "</div>" +
        receiptViewLine("Mass", model.massTitle, false) +
        songLines +
        (foot ? "<p class=\"mass-gen-receipt__foot\">" + escapeHtml(foot) + "</p>" : "") +
        "<p class=\"mass-gen-receipt__foot\">" + model.selectedSongCount + " song" + (model.selectedSongCount === 1 ? "" : "s") + "</p>"
      );
    }

    function lookupMassPlanSong(id) {
      if (!id) return null;
      rebuildMassPlanSongPool();
      return massPlanAllSongs.find((s) => String(s.id) === String(id)) || null;
    }

    function resolveLibraryMediaRow(kind, ref) {
      const norm = normalizeComposerMediaRef(ref);
      if (!norm) return null;
      if (isYouTubeMediaRef(norm)) return norm;
      const libKind = kind === "video" ? "video" : "music";
      const rows = ((libKind === "video" ? savedMediaLibrary.video : savedMediaLibrary.music) || []);
      const hit = rows.find((r) => r && r.basename === norm.basename);
      if (hit && hit.url) return hit;
      const url = (hit && hit.url) || norm.url || fallbackSavedMediaUrl(libKind, norm.basename);
      return {
        basename: norm.basename,
        display_name: (hit && hit.display_name) || norm.display_name || norm.basename,
        url: url,
        kind: libKind,
      };
    }

    function syncMassSlotMediaToSong(slotKey, songId) {
      const slot = String(slotKey || "").trim();
      if (!slot) return;
      const row = songId && typeof lookupMassPlanSong === "function" ? lookupMassPlanSong(songId) : null;
      const audioRef = row ? normalizeComposerMediaRef(row.audio_media) : null;
      const videoRef = row ? normalizeComposerMediaRef(row.video_media) : null;
      const apply = () => {
        setMassSectionMedia(
          "audio",
          slot,
          audioRef ? resolveLibraryMediaRow("music", audioRef) : null
        );
        if (massMediaKeyAllowsVideo(slot) || getMassSectionMedia("video", slot)) {
          setMassSectionMedia(
            "video",
            slot,
            videoRef && massMediaKeyAllowsVideo(slot)
              ? resolveLibraryMediaRow("video", videoRef)
              : null
          );
        }
      };
      apply();
      if (
        (audioRef || videoRef) &&
        !((savedMediaLibrary.music && savedMediaLibrary.music.length) ||
          (savedMediaLibrary.video && savedMediaLibrary.video.length))
      ) {
        ensureSavedMediaLibrary(false).then(apply).catch(() => {});
      }
    }

    function assignMassSlotSong(slotKey, songId) {
      const key = String(slotKey || "").trim();
      if (!key) return;
      const nextId = String(songId || "").trim();
      const prevId = String((selectedLyricsSongs && selectedLyricsSongs[key]) || "").trim();
      selectedLyricsSongs[key] = nextId;
      if (prevId !== nextId) syncMassSlotMediaToSong(key, nextId);
    }

    function maybeApplySongCatalogMediaToMassSlot(slotKey, songId) {
      syncMassSlotMediaToSong(slotKey, songId);
    }

    function songSlotHasLyrics(slotKey, id) {
      if (!id) return true;
      const row = lookupMassPlanSong(id);
      const sec = (SLOT_TO_HYMN_SECTION[slotKey] || slotKey).toLowerCase();
      if (massSongLyricsCache.has(sec + "|" + id)) return true;
      return !!(row && row.has_lyrics);
    }

    function buildMassGenerateReceiptModel(options) {
      const o = options || {};
      const date = o.date || ($("mass-date") && $("mass-date").value) || "";
      const celebrant = (o.celebrant != null ? o.celebrant : getMassCelebrantLine()).trim();
      const mainCelebrant = ($("celebrant") && $("celebrant").value.trim()) || celebrant.split(" · ")[0].trim();
      const coCelebrant = ($("co-celebrant") && $("co-celebrant").value.trim()) || "";
      const preview = previewForMassSummary();
      const creedSel = $("flow-creed-choice");
      const creed = creedSel && creedSel.value === "apostles" ? "Apostles' Creed" : "Nicene Creed";
      const collFormatted = getFormattedCollectionAmount();
      const foodLines = getFlowFoodSponsorsLines();
      const posterOpts = readOpenAiPosterSettings();
      const useAiPoster = o.include_ai != null ? !!o.include_ai : posterOpts.useAi;
      rebuildMassPlanSongPool();
      const songs = lyricSongSlots.map((slot) => {
        const id = (selectedLyricsSongs[slot.key] || "").trim();
        const row = id ? massPlanAllSongs.find((s) => String(s.id) === String(id)) : null;
        const sec = (SLOT_TO_HYMN_SECTION[slot.key] || slot.key).toLowerCase();
        const missingLyrics = !!(id && !(
          massSongLyricsCache.has(sec + "|" + id) || (row && row.has_lyrics)
        ));
        return {
          slotKey: slot.key,
          label: slot.custom ? ((slot.label || "").trim() || "Custom section") : slot.label,
          section: slot.section || SLOT_TO_HYMN_SECTION[slot.key] || slot.key,
          id,
          title: row ? row.title : (id || ""),
          missingLyrics,
        };
      });
      return {
        date,
        mainCelebrant,
        coCelebrant,
        celebrant,
        massTitle: preview && preview.title ? preview.title : "Sunday Mass",
        gospelRef: preview && preview.gospel_reference ? preview.gospel_reference : "",
        creed,
        collection: collFormatted || "",
        foodSponsors: foodLines,
        aiPoster: useAiPoster,
        aiBackend: o.ai_poster_backend || posterOpts.backend || "openai",
        songs,
        missingLyricsCount: songs.filter((s) => s.missingLyrics).length,
        selectedSongCount: songs.filter((s) => s.id).length,
      };
    }

    function receiptCelebrantFieldHtml(model) {
      if (celebrantNamesCache.length) {
        const opts = celebrantNamesCache.map((name) =>
          "<option value=\"" + escapeHtml(name) + "\"" + (name === model.mainCelebrant ? " selected" : "") + ">" + escapeHtml(name) + "</option>"
        ).join("");
        return "<select class=\"mass-gen-receipt__edit\" id=\"receipt-celebrant\">" + opts + "</select>";
      }
      return "<input type=\"text\" class=\"mass-gen-receipt__edit\" id=\"receipt-celebrant\" value=\"" + escapeHtml(model.mainCelebrant) + "\" maxlength=\"200\" autocomplete=\"name\" />";
    }

    function renderMassGenerateReceiptEditPanel(model) {
      const songRows = model.songs.map((song) => {
        const rowCls = "mass-gen-receipt__row" + (song.missingLyrics ? " mass-gen-receipt__row--missing" : "");
        const editCls = "mass-gen-receipt__edit" + (song.missingLyrics ? " mass-gen-receipt__edit--missing" : "");
        const datalistId = "receipt-songs-" + song.slotKey;
        const candidates = massPlanAllSongs.filter((row) => {
          if (!songMatchesPlanLangFilter(row, massSongPlanLanguage)) return false;
          const sec = song.section;
          if (!sec) return true;
          return row.section === sec || (sec === "communion" && row.section === "communion");
        }).slice(0, 80);
        const options = candidates.map((row) =>
          "<option value=\"" + escapeHtml(row.title) + "\" data-id=\"" + escapeHtml(row.id) + "\"></option>"
        ).join("");
        const missingBadge = song.missingLyrics
          ? "<span class=\"mass-gen-receipt__missing-badge\">No lyrics</span>"
          : "";
        const editLyricsBtn = song.missingLyrics && song.id
          ? "<button type=\"button\" class=\"mass-gen-receipt__edit-link\" data-receipt-add-lyrics=\"" + escapeHtml(song.slotKey) + "\">Add lyrics</button>"
          : "";
        return (
          "<div class=\"" + rowCls + "\" data-receipt-slot=\"" + escapeHtml(song.slotKey) + "\">" +
            "<span class=\"mass-gen-receipt__label\">" + escapeHtml(receiptSlotShortLabel(song)) + "</span>" +
            "<div class=\"mass-gen-receipt__value\">" +
              "<input type=\"text\" class=\"" + editCls + "\" " +
                "id=\"receipt-song-" + escapeHtml(song.slotKey) + "\" " +
                "list=\"" + datalistId + "\" " +
                "data-receipt-song-input=\"" + escapeHtml(song.slotKey) + "\" " +
                "data-song-id=\"" + escapeHtml(song.id) + "\" " +
                "value=\"" + escapeHtml(song.title || "") + "\" " +
                "placeholder=\"—\" autocomplete=\"off\" />" +
              "<datalist id=\"" + datalistId + "\">" + options + "</datalist>" +
              missingBadge + editLyricsBtn +
            "</div>" +
          "</div>"
        );
      }).join("");
      return (
        "<div class=\"mass-gen-receipt__section\">Edit</div>" +
        "<div class=\"mass-gen-receipt__row\">" +
          "<span class=\"mass-gen-receipt__label\">Date</span>" +
          "<input type=\"date\" class=\"mass-gen-receipt__edit\" id=\"receipt-date\" value=\"" + escapeHtml(model.date) + "\" />" +
        "</div>" +
        "<div class=\"mass-gen-receipt__row\">" +
          "<span class=\"mass-gen-receipt__label\">Celebrant</span>" +
          receiptCelebrantFieldHtml(model) +
        "</div>" +
        "<div class=\"mass-gen-receipt__row\">" +
          "<span class=\"mass-gen-receipt__label\">Co-celebrant</span>" +
          "<input type=\"text\" class=\"mass-gen-receipt__edit\" id=\"receipt-co-celebrant\" value=\"" + escapeHtml(model.coCelebrant) + "\" placeholder=\"Optional\" maxlength=\"200\" />" +
        "</div>" +
        songRows
      );
    }

    function renderMassGenerateReceipt(model) {
      const body = $("mass-gen-receipt-body");
      if (!body) return;
      const rootCls = "mass-gen-receipt" + (massGenReceiptEditMode ? " is-editing" : "");
      body.innerHTML =
        "<div class=\"" + rootCls + "\" id=\"mass-gen-receipt-root\">" +
          "<div class=\"mass-gen-receipt__view\" id=\"mass-gen-receipt-view\">" +
            renderMassGenerateReceiptView(model) +
          "</div>" +
          "<div class=\"mass-gen-receipt__edit-panel\" id=\"mass-gen-receipt-edit-panel\"></div>" +
        "</div>";
      syncMassGenerateReceiptEditButton();
    }

    function syncMassGenerateReceiptEditButton() {
      const btn = $("mass-gen-receipt-edit");
      if (!btn) return;
      btn.textContent = massGenReceiptEditMode ? "Done editing" : "Quick edit";
      btn.setAttribute("aria-pressed", massGenReceiptEditMode ? "true" : "false");
    }

    function refreshMassGenerateReceiptView() {
      const view = $("mass-gen-receipt-view");
      if (!view || !massGenReceiptOptionsCache) return;
      view.innerHTML = renderMassGenerateReceiptView(buildMassGenerateReceiptModel(massGenReceiptOptionsCache));
    }

    function setMassGenerateReceiptEditMode(on) {
      massGenReceiptEditMode = !!on;
      const root = $("mass-gen-receipt-root");
      if (root) root.classList.toggle("is-editing", massGenReceiptEditMode);
      syncMassGenerateReceiptEditButton();
      if (massGenReceiptEditMode) {
        if (massGenReceiptOptionsCache) {
          const panel = $("mass-gen-receipt-edit-panel");
          if (panel) panel.innerHTML = renderMassGenerateReceiptEditPanel(buildMassGenerateReceiptModel(massGenReceiptOptionsCache));
          bindMassGenerateReceiptEvents();
        }
        const body = $("mass-gen-receipt-body");
        const missingInp = body && body.querySelector(".mass-gen-receipt__edit--missing");
        if (missingInp) {
          missingInp.focus();
          missingInp.select();
          return;
        }
        const dateInp = $("receipt-date");
        if (dateInp) dateInp.focus();
      } else {
        applyMassGenerateReceiptEdits();
        refreshMassGenerateReceiptView();
      }
    }

    function toggleMassGenerateReceiptEditMode() {
      setMassGenerateReceiptEditMode(!massGenReceiptEditMode);
    }

    function bindMassGenerateReceiptEvents() {
      const body = $("mass-gen-receipt-body");
      if (!body) return;
      body.querySelectorAll("[data-receipt-song-input]").forEach((inp) => {
        inp.addEventListener("change", () => syncReceiptSongInput(inp));
        inp.addEventListener("blur", () => syncReceiptSongInput(inp));
      });
      body.querySelectorAll("[data-receipt-add-lyrics]").forEach((btn) => {
        btn.addEventListener("click", () => openReceiptAddLyrics(btn.dataset.receiptAddLyrics));
      });
    }

    async function openReceiptAddLyrics(slotKey) {
      const id = selectedLyricsSongs[slotKey];
      const slot = lyricSongSlots.find((s) => s.key === slotKey);
      if (!id || !slot) return;
      const sec = slot.section || SLOT_TO_HYMN_SECTION[slotKey] || slotKey;
      closeMassGenerateReceiptModal({ confirmed: false });
      try {
        await loadSongIntoEditor(sec, id);
        if (normalizeRoute(currentRoute()) !== "/library/songs") showRoute("/library/songs");
      } catch (_e) { /* ignore */ }
    }

    function syncReceiptSongInput(inp) {
      const slotKey = inp.dataset.receiptSongInput;
      const val = (inp.value || "").trim();
      if (!val) {
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(slotKey, "");
        else selectedLyricsSongs[slotKey] = "";
        inp.dataset.songId = "";
        updateMassSlotChip(slotKey);
        updateMassSongPreviewButton(slotKey);
        renderFlowSongCount();
        refreshReceiptSongRow(slotKey);
        return;
      }
      rebuildMassPlanSongPool();
      const slot = lyricSongSlots.find((s) => s.key === slotKey);
      const sec = slot ? slot.section : null;
      let match = massPlanAllSongs.find((row) => row.title.toLowerCase() === val.toLowerCase());
      if (!match) {
        match = massPlanAllSongs.find((row) => {
          if (sec && row.section && row.section !== sec && !(sec === "communion" && row.section === "communion")) return false;
          return row.title.toLowerCase().includes(val.toLowerCase());
        });
      }
      if (match) {
        if (typeof assignMassSlotSong === "function") assignMassSlotSong(slotKey, match.id);
        else selectedLyricsSongs[slotKey] = match.id;
        inp.value = match.title;
        inp.dataset.songId = match.id;
      }
      updateMassSlotChip(slotKey);
      updateMassSongPreviewButton(slotKey);
      renderFlowSongCount();
      refreshReceiptSongRow(slotKey);
    }

    function refreshReceiptSongRow(slotKey) {
      if (!massGenReceiptEditMode) {
        refreshMassGenerateReceiptView();
        return;
      }
      const row = document.querySelector(".mass-gen-receipt__row[data-receipt-slot=\"" + slotKey + "\"]");
      const inp = $("receipt-song-" + slotKey);
      if (!row || !inp) return;
      const id = (selectedLyricsSongs[slotKey] || "").trim();
      const missing = !!(id && !songSlotHasLyrics(slotKey, id));
      row.classList.toggle("mass-gen-receipt__row--missing", missing);
      inp.classList.toggle("mass-gen-receipt__edit--missing", missing);
      const valueWrap = inp.parentElement;
      if (!valueWrap) return;
      valueWrap.querySelectorAll(".mass-gen-receipt__missing-badge, [data-receipt-add-lyrics]").forEach((el) => el.remove());
      if (missing) {
        const badge = document.createElement("span");
        badge.className = "mass-gen-receipt__missing-badge";
        badge.textContent = "No lyrics";
        valueWrap.appendChild(badge);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mass-gen-receipt__edit-link";
        btn.dataset.receiptAddLyrics = slotKey;
        btn.textContent = "Add lyrics";
        btn.addEventListener("click", () => openReceiptAddLyrics(slotKey));
        valueWrap.appendChild(btn);
      }
    }

    function updateReceiptAlertBanner() {
      if (massGenReceiptEditMode) return;
      refreshMassGenerateReceiptView();
    }

    function applyMassGenerateReceiptEdits() {
      const dateInp = $("receipt-date");
      if (dateInp && dateInp.value && $("mass-date")) {
        $("mass-date").value = dateInp.value;
        if ($("poster-mass-date")) $("poster-mass-date").value = dateInp.value;
        syncMassDatePickerByInputId("mass-date");
      }
      const celField = $("receipt-celebrant");
      if (celField && celField.value) setCelebrantPickerValue(celField.value.trim());
      const coInp = $("receipt-co-celebrant");
      if (coInp && $("co-celebrant")) $("co-celebrant").value = coInp.value.trim();
      renderMassSummarySidebar();
    }

    function openMassGenerateReceiptModal(model, options) {
      return new Promise((resolve) => {
        massGenReceiptResolve = resolve;
        massGenReceiptEditMode = false;
        massGenReceiptOptionsCache = options || {};
        const desc = $("mass-gen-receipt-desc");
        if (desc) {
          desc.textContent = "Review before continuing. Choose Generate for a PowerPoint download, or Slideshow to present in the browser.";
        }
        renderMassGenerateReceipt(model);
        setUiOverlayOpen($("mass-gen-receipt-modal"), true);
      });
    }

    function closeMassGenerateReceiptModal(result) {
      massGenReceiptEditMode = false;
      massGenReceiptOptionsCache = null;
      setUiOverlayOpen($("mass-gen-receipt-modal"), false);
      if (massGenReceiptResolve) {
        massGenReceiptResolve(result || { confirmed: false });
        massGenReceiptResolve = null;
      }
    }

    var massSlideshowState = {
      open: false,
      index: 0,
      mode: "image",
      slides: [],
      objectUrls: [],
      pptxUrl: "",
      pptxName: "mass_presentation.pptx",
      blank: false,
      chromeTimer: null,
      hintTimer: null,
      cursorTimer: null,
      bound: false,
      expectedTotal: 0,
      pollTimer: null,
      generation: 0,
      complete: true,
    };

    var lastMassGenerateResult = null;
    var lastMassSlideshowSession = null;
    window.__massPresentAvailable = false;

    function syncMassPresentAgainUi() {
      const available = !!(
        (lastMassSlideshowSession && lastMassSlideshowSession.slides && lastMassSlideshowSession.slides.length)
        || (lastMassGenerateResult && lastMassGenerateResult.pptx_url)
      );
      window.__massPresentAvailable = available;
      const bar = $("mass-present-bar");
      const sub = $("mass-present-bar-sub");
      if (bar) {
        // Hide while actively presenting.
        bar.hidden = !available || massSlideshowState.open;
      }
      if (sub) {
        sub.textContent = lastMassSlideshowSession && lastMassSlideshowSession.slides && lastMassSlideshowSession.slides.length
          ? "Resume without regenerating."
          : "Open slideshow from the latest deck.";
      }
      const mwPresent = $("mw-present");
      if (mwPresent) {
        const onReview = document.body.classList.contains("mw-on")
          && $("mw-generate")
          && !$("mw-generate").hidden;
        mwPresent.hidden = !available || !onReview || massSlideshowState.open;
      }
    }
    window.syncMassPresentAgainUi = syncMassPresentAgainUi;

    function rememberMassSlideshowSessionFromState() {
      if (!massSlideshowState.slides || !massSlideshowState.slides.length) return;
      lastMassSlideshowSession = {
        mode: massSlideshowState.mode,
        pptxUrl: massSlideshowState.pptxUrl || (lastMassGenerateResult && lastMassGenerateResult.pptx_url) || "",
        pptxName: massSlideshowState.pptxName || (((lastMassGenerateResult && lastMassGenerateResult.export_stem) || "mass_presentation") + ".pptx"),
        expectedTotal: Math.max(massSlideshowState.expectedTotal || 0, massSlideshowState.slides.length),
        complete: !!massSlideshowState.complete,
        resumeIndex: massSlideshowState.index || 0,
        slides: massSlideshowState.slides.map((s) => ({
          index: s.index,
          image_url: s.image_url || "",
          text: s.text || "",
          kind: s.kind || "",
          video_url: s.video_url || "",
          title: s.title || "",
          slot: s.slot || "",
        })),
      };
      syncMassPresentAgainUi();
    }

    function rememberMassGenerateResult(data) {
      if (!data) return;
      lastMassGenerateResult = data;
      syncMassPresentAgainUi();
    }

    function stopMassSlideshowPoll() {
      if (massSlideshowState.pollTimer) {
        clearTimeout(massSlideshowState.pollTimer);
        massSlideshowState.pollTimer = null;
      }
    }

    function revokeMassSlideshowObjectUrls() {
      massSlideshowState.objectUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (_e) { /* ignore */ }
      });
      massSlideshowState.objectUrls = [];
    }

    async function loadMassSlideshowAuthedImage(url) {
      const res = await authorizedFetch(url);
      if (!res.ok) throw new Error("Slide image failed (" + res.status + ")");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      massSlideshowState.objectUrls.push(objectUrl);
      return objectUrl;
    }

    async function loadMassSlideshowAuthedVideo(url) {
      const res = await authorizedFetch(url);
      if (!res.ok) throw new Error("Slide video failed (" + res.status + ")");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      massSlideshowState.objectUrls.push(objectUrl);
      return objectUrl;
    }

    function pauseMassSlideshowVideo() {
      const video = $("mass-slideshow-video");
      if (!video) return;
      try { video.pause(); } catch (_e) { /* ignore */ }
      video.removeAttribute("src");
      try { video.load(); } catch (_e2) { /* ignore */ }
      video.hidden = true;
    }

    function applyMassSlideshowCues(cues) {
      if (!Array.isArray(cues) || !cues.length) return;
      cues.forEach((cue) => {
        if (!cue || cue.kind !== "video") return;
        const index = parseInt(cue.index, 10);
        if (!index) return;
        let slide = massSlideshowState.slides.find((s) => s.index === index);
        if (!slide) {
          slide = { index: index, image_url: "", text: "", objectUrl: "" };
          massSlideshowState.slides.push(slide);
        }
        slide.kind = "video";
        slide.video_url = cue.video_url || slide.video_url || "";
        slide.title = cue.title || slide.title || "";
        slide.slot = cue.slot || slide.slot || "";
      });
      massSlideshowState.slides.sort((a, b) => a.index - b.index);
      // Ensure image placeholders exist for gaps before video-only indices from cues.
      const maxIdx = Math.max(
        massSlideshowState.expectedTotal || 0,
        ...massSlideshowState.slides.map((s) => s.index)
      );
      massSlideshowState.expectedTotal = Math.max(massSlideshowState.expectedTotal || 0, maxIdx);
    }

    function setMassSlideshowChromeVisible(visible) {
      const root = $("mass-slideshow");
      if (!root) return;
      root.classList.toggle("is-chrome-visible", !!visible);
      if (massSlideshowState.chromeTimer) {
        clearTimeout(massSlideshowState.chromeTimer);
        massSlideshowState.chromeTimer = null;
      }
      if (visible) {
        massSlideshowState.chromeTimer = setTimeout(() => {
          if (massSlideshowState.open && !massSlideshowState.blank) {
            root.classList.remove("is-chrome-visible");
          }
        }, 2200);
      }
    }

    function bumpMassSlideshowCursor() {
      const root = $("mass-slideshow");
      if (!root || !massSlideshowState.open) return;
      root.classList.remove("is-cursor-hidden");
      if (massSlideshowState.cursorTimer) clearTimeout(massSlideshowState.cursorTimer);
      massSlideshowState.cursorTimer = setTimeout(() => {
        if (massSlideshowState.open && !massSlideshowState.blank) {
          root.classList.add("is-cursor-hidden");
        }
      }, 1800);
    }

    function updateMassSlideshowCounter() {
      const counter = $("mass-slideshow-counter");
      if (!counter) return;
      const ready = massSlideshowState.slides.length;
      const total = Math.max(ready, massSlideshowState.expectedTotal || 0);
      const idx = massSlideshowState.index;
      if (!ready) {
        counter.textContent = "0 / 0";
        return;
      }
      const label = (idx + 1) + " / " + total;
      counter.textContent = (!massSlideshowState.complete && ready < total)
        ? (label + " · loading")
        : label;
    }

    function renderMassSlideshowSlide() {
      const img = $("mass-slideshow-img");
      const video = $("mass-slideshow-video");
      const text = $("mass-slideshow-text");
      const slides = massSlideshowState.slides;
      const total = slides.length;
      const idx = Math.max(0, Math.min(massSlideshowState.index, Math.max(0, total - 1)));
      massSlideshowState.index = idx;
      updateMassSlideshowCounter();
      const slide = slides[idx];
      pauseMassSlideshowVideo();
      if (!slide) {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (text) {
          text.hidden = false;
          text.textContent = "No slides to present.";
        }
        return;
      }

      const showVideo = async (objectUrl) => {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (text) { text.hidden = true; text.textContent = ""; }
        if (!video) return;
        video.hidden = false;
        video.src = objectUrl;
        video.currentTime = 0;
        try {
          await video.play();
        } catch (_playErr) {
          // Autoplay may be blocked until a user gesture; click/arrow still advances.
        }
      };

      if (slide.kind === "video" && (slide.videoObjectUrl || slide.video_url)) {
        if (slide.videoObjectUrl) {
          showVideo(slide.videoObjectUrl);
          return;
        }
        if (text) {
          text.hidden = false;
          text.textContent = "Loading video…";
        }
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        loadMassSlideshowAuthedVideo(slide.video_url).then((objectUrl) => {
          if (!massSlideshowState.open) return;
          slide.videoObjectUrl = objectUrl;
          if (massSlideshowState.index === idx) showVideo(objectUrl);
        }).catch(() => {
          if (!massSlideshowState.open || massSlideshowState.index !== idx) return;
          if (text) text.textContent = slide.title ? (slide.title + " (video unavailable)") : "Video unavailable";
        });
        return;
      }

      if (massSlideshowState.mode === "image" && slide.objectUrl) {
        if (text) { text.hidden = true; text.textContent = ""; }
        if (img) {
          img.hidden = false;
          img.alt = "Slide " + (slide.index || (idx + 1));
          img.src = slide.objectUrl;
        }
      } else if (massSlideshowState.mode === "image" && slide.image_url && !slide.objectUrl) {
        if (text) {
          text.hidden = false;
          text.textContent = "Loading slide…";
        }
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        loadMassSlideshowAuthedImage(slide.image_url).then((objectUrl) => {
          if (!massSlideshowState.open) return;
          slide.objectUrl = objectUrl;
          if (massSlideshowState.index === idx) renderMassSlideshowSlide();
        }).catch(() => {
          if (!massSlideshowState.open || massSlideshowState.index !== idx) return;
          if (text) text.textContent = slide.text || ("Slide " + (slide.index || (idx + 1)));
        });
      } else {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (text) {
          text.hidden = false;
          text.textContent = slide.text || ("Slide " + (slide.index || (idx + 1)));
        }
      }
    }

    function mergeMassSlideshowRemoteSlides(remoteSlides) {
      if (!Array.isArray(remoteSlides) || !remoteSlides.length) return 0;
      let added = 0;
      remoteSlides.forEach((s, i) => {
        const index = (s && s.index) || (i + 1);
        const existing = massSlideshowState.slides.find((row) => row.index === index);
        if (existing) {
          if (!existing.image_url && s.image_url) existing.image_url = s.image_url;
          if (!existing.text && s.text) existing.text = s.text;
          if (!existing.kind && s.kind) existing.kind = s.kind;
          if (!existing.video_url && s.video_url) existing.video_url = s.video_url;
          if (!existing.title && s.title) existing.title = s.title;
          return;
        }
        massSlideshowState.slides.push({
          index: index,
          image_url: (s && s.image_url) || "",
          text: (s && s.text) || "",
          kind: (s && s.kind) || "",
          video_url: (s && s.video_url) || "",
          title: (s && s.title) || "",
          slot: (s && s.slot) || "",
          objectUrl: "",
        });
        added += 1;
      });
      massSlideshowState.slides.sort((a, b) => a.index - b.index);
      if (added) updateMassSlideshowCounter();
      return added;
    }

    async function fetchMassSlideshowStatus() {
      if (window.VerbumAuth && window.VerbumAuth.waitUntilReady) {
        await window.VerbumAuth.waitUntilReady();
      }
      const headers = {};
      if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
      }
      const res = await fetch("/api/ppt-preview/slideshow/status", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.detail || data.error || res.statusText;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      return data;
    }

    function scheduleMassSlideshowPoll() {
      stopMassSlideshowPoll();
      if (!massSlideshowState.open || massSlideshowState.complete) return;
      massSlideshowState.pollTimer = setTimeout(async () => {
        if (!massSlideshowState.open || massSlideshowState.complete) return;
        try {
          const st = await fetchMassSlideshowStatus();
          if (!massSlideshowState.open) return;
          if (st.total) massSlideshowState.expectedTotal = Math.max(massSlideshowState.expectedTotal, st.total);
          if (st.mode === "text" && massSlideshowState.mode !== "text") {
            massSlideshowState.mode = "text";
          }
          mergeMassSlideshowRemoteSlides(st.slides || []);
          applyMassSlideshowCues(st.cues || []);
          rememberMassSlideshowSessionFromState();
          updateMassSlideshowCounter();
          // Prefetch any newly arrived slides while presenting.
          (async () => {
            for (let i = 0; i < massSlideshowState.slides.length; i++) {
              if (!massSlideshowState.open) return;
              const slot = massSlideshowState.slides[i];
              if (!slot || slot.objectUrl || !slot.image_url) continue;
              try {
                slot.objectUrl = await loadMassSlideshowAuthedImage(slot.image_url);
              } catch (_e) { /* skip */ }
            }
          })();
          if (st.complete) {
            massSlideshowState.complete = true;
            updateMassSlideshowCounter();
            return;
          }
        } catch (_e) {
          /* keep polling briefly; generation may still be running */
        }
        scheduleMassSlideshowPoll();
      }, 450);
    }

    function massSlideshowGo(delta) {
      if (!massSlideshowState.open || !massSlideshowState.slides.length) return;
      if (massSlideshowState.blank) {
        setMassSlideshowBlank(false);
        return;
      }
      const next = massSlideshowState.index + delta;
      if (next < 0 || next >= massSlideshowState.slides.length) return;
      massSlideshowState.index = next;
      renderMassSlideshowSlide();
      setMassSlideshowChromeVisible(true);
    }

    function massSlideshowJump(index) {
      if (!massSlideshowState.open || !massSlideshowState.slides.length) return;
      massSlideshowState.index = index;
      setMassSlideshowBlank(false);
      renderMassSlideshowSlide();
      setMassSlideshowChromeVisible(true);
    }

    function setMassSlideshowBlank(on) {
      massSlideshowState.blank = !!on;
      const root = $("mass-slideshow");
      if (root) root.classList.toggle("is-blank", massSlideshowState.blank);
      if (!massSlideshowState.blank) setMassSlideshowChromeVisible(true);
    }

    function closeMassSlideshow() {
      const root = $("mass-slideshow");
      if (!root) return;
      rememberMassSlideshowSessionFromState();
      massSlideshowState.open = false;
      massSlideshowState.blank = false;
      massSlideshowState.complete = true;
      stopMassSlideshowPoll();
      pauseMassSlideshowVideo();
      root.classList.remove("is-open", "is-blank", "is-chrome-visible", "is-hint-visible", "is-cursor-hidden");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (massSlideshowState.chromeTimer) clearTimeout(massSlideshowState.chromeTimer);
      if (massSlideshowState.hintTimer) clearTimeout(massSlideshowState.hintTimer);
      if (massSlideshowState.cursorTimer) clearTimeout(massSlideshowState.cursorTimer);
      massSlideshowState.chromeTimer = null;
      massSlideshowState.hintTimer = null;
      massSlideshowState.cursorTimer = null;
      revokeMassSlideshowObjectUrls();
      massSlideshowState.slides = [];
      massSlideshowState.expectedTotal = 0;
      const img = $("mass-slideshow-img");
      if (img) { img.hidden = true; img.removeAttribute("src"); }
      const text = $("mass-slideshow-text");
      if (text) { text.hidden = true; text.textContent = ""; }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      syncMassPresentAgainUi();
      setFlowStatus("Slideshow closed. Tap Present to open it again.", "ok");
    }

    async function openMassSlideshow(payload) {
      const root = $("mass-slideshow");
      if (!root) return;
      const opts = payload || {};
      const slidesIn = Array.isArray(opts.slides) ? opts.slides : [];
      stopMassSlideshowPoll();
      revokeMassSlideshowObjectUrls();
      massSlideshowState.mode = opts.mode === "text" ? "text" : "image";
      massSlideshowState.pptxUrl = opts.pptxUrl || "";
      massSlideshowState.pptxName = opts.pptxName || "mass_presentation.pptx";
      massSlideshowState.index = 0;
      massSlideshowState.blank = false;
      massSlideshowState.expectedTotal = Math.max(0, parseInt(opts.expectedTotal, 10) || slidesIn.length || 0);
      massSlideshowState.complete = opts.complete !== false;
      massSlideshowState.generation = opts.generation || 0;
      massSlideshowState.slides = [];

      const dlBtn = $("mass-slideshow-download");
      if (dlBtn) dlBtn.hidden = !massSlideshowState.pptxUrl;

      if (massSlideshowState.mode === "image") {
        mergeMassSlideshowRemoteSlides(slidesIn);
        applyMassSlideshowCues(opts.cues || []);
        // Load the first available slide before opening so projection isn't blank.
        for (let i = 0; i < massSlideshowState.slides.length; i++) {
          const slot = massSlideshowState.slides[i];
          if (slot.kind === "video") {
            if (!slot.video_url && !slot.videoObjectUrl) continue;
            massSlideshowState.index = i;
            break;
          }
          if (!slot.image_url) continue;
          try {
            slot.objectUrl = await loadMassSlideshowAuthedImage(slot.image_url);
            massSlideshowState.index = i;
            break;
          } catch (_e) {
            /* try next */
          }
        }
        const anyMedia = massSlideshowState.slides.some((s) => !!s.objectUrl || s.kind === "video");
        if (!anyMedia && slidesIn.length && slidesIn.some((s) => s && s.text)) {
          massSlideshowState.mode = "text";
          massSlideshowState.slides = slidesIn.map((s, i) => ({
            index: (s && s.index) || (i + 1),
            text: (s && s.text) || "",
          }));
        } else if (anyMedia) {
          // Prefetch nearby image slides in the background.
          (async () => {
            for (let i = 0; i < massSlideshowState.slides.length; i++) {
              if (!massSlideshowState.open) return;
              const slot = massSlideshowState.slides[i];
              if (!slot || slot.kind === "video" || slot.objectUrl || !slot.image_url) continue;
              try {
                slot.objectUrl = await loadMassSlideshowAuthedImage(slot.image_url);
              } catch (_e) { /* skip */ }
            }
          })();
        }
      } else {
        massSlideshowState.slides = slidesIn.map((s, i) => ({
          index: (s && s.index) || (i + 1),
          text: (s && s.text) || "",
        }));
      }

      massSlideshowState.open = true;
      root.classList.add("is-open", "is-hint-visible", "is-chrome-visible");
      root.classList.remove("is-blank", "is-cursor-hidden");
      root.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      syncMassPresentAgainUi();
      const resumeAt = Math.max(0, parseInt(opts.resumeIndex, 10) || 0);
      if (resumeAt > 0 && resumeAt < massSlideshowState.slides.length) {
        massSlideshowState.index = resumeAt;
      }
      renderMassSlideshowSlide();
      bumpMassSlideshowCursor();
      if (massSlideshowState.hintTimer) clearTimeout(massSlideshowState.hintTimer);
      massSlideshowState.hintTimer = setTimeout(() => {
        root.classList.remove("is-hint-visible");
      }, 3200);
      setMassSlideshowChromeVisible(true);
      try {
        if (root.requestFullscreen) await root.requestFullscreen();
      } catch (_e) { /* ignore — still present windowed */ }
      if (root.focus) root.focus();
      if (!massSlideshowState.complete) scheduleMassSlideshowPoll();
      rememberMassSlideshowSessionFromState();
    }

