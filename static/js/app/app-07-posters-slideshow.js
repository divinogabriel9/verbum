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
      const modal = $("mobile-welcome-modal");
      if (modal) setUiOverlayOpen(modal, false);
    }

    function openMobileWelcomeModal() {
      /* Mobile welcome card removed. */
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
      // Mobile welcome card removed — clear any leftover pending flag.
      try { sessionStorage.removeItem(MOBILE_WELCOME_PENDING_KEY); } catch (_e) { /* ignore */ }
      clearMobileWelcomeUrlFlag();
    }

    function initMobileWelcomeModal() {
      /* Mobile welcome card removed. */
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
      { id: "page-themes", label: "Themes", hint: "Page", group: "Pages", route: "/themes", keywords: ["theme", "marketplace", "design", "pack"] },
      { id: "page-theme", label: "Theme Lab", hint: "Page", group: "Pages", route: "/design/theme-lab", keywords: ["design", "theme", "style", "color"] },
      { id: "page-templates", label: "Templates", hint: "Page", group: "Pages", route: "/design/templates", keywords: ["template", "layout"] },
      { id: "page-account", label: "Account", hint: "Page", group: "Pages", route: "/settings/account", keywords: ["account", "profile", "picture", "avatar", "photo"] },
      { id: "page-church", label: "Parish", hint: "Page", group: "Pages", route: "/settings/church", keywords: ["church", "profile", "logo", "parish", "community"] },
      { id: "page-appearance", label: "Appearance", hint: "Page", group: "Pages", route: "/settings/app", keywords: ["appearance", "dark", "light", "theme", "settings"] },
      { id: "page-preferences", label: "Preferences", hint: "Page", group: "Pages", route: "/settings/preferences", keywords: ["preferences", "navigation", "news", "radio", "settings"] },
      { id: "page-privacy", label: "Privacy & legal", hint: "Page", group: "Pages", route: "/settings/privacy", keywords: ["privacy", "legal", "cookies", "terms", "gdpr", "copyright"] },
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
      if (select.classList.contains("sr-only") || select.getAttribute("aria-hidden") === "true") return;
      if (select.classList.contains("mass-song-plan-lang-select")) return;
      const wrap = document.createElement("div");
      wrap.className = "vb-select";
      if (select.classList.contains("lyric-block__pill-select")) wrap.classList.add("vb-select--pill");
      if (select.classList.contains("flow-slide-pick-select")) wrap.classList.add("vb-select--slide-pick");
      if (select.classList.contains("mass-song-plan-lang-select")) wrap.classList.add("vb-select--sm");
      if (select.classList.contains("mw-weekly-posters__select")) wrap.classList.add("vb-select--weekly");
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

    function posterPickerScrollParent(el) {
      var node = el && el.parentElement;
      while (node && node !== document.body && node !== document.documentElement) {
        var style = window.getComputedStyle(node);
        var oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && node.scrollHeight > node.clientHeight + 1) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    function scrollPosterPickerMenuIntoView(menu) {
      if (!menu || menu.hidden) return;
      var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      var behavior = reduceMotion ? "auto" : "smooth";
      var run = function () {
        if (menu.hidden) return;
        var rect = menu.getBoundingClientRect();
        if (!rect.height) return;
        var pad = 14;
        var header = document.querySelector(".app-header");
        var headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        var topLimit = Math.max(pad, headerBottom + pad);
        var nav = document.querySelector("body.mw-on .mw-nav");
        var navH = nav && !nav.hidden ? nav.getBoundingClientRect().height : 0;
        var bottomLimit = window.innerHeight - navH - pad;
        var delta = 0;
        if (rect.bottom > bottomLimit) delta = rect.bottom - bottomLimit;
        else if (rect.top < topLimit) delta = rect.top - topLimit;
        if (Math.abs(delta) < 2) return;
        var scroller = posterPickerScrollParent(menu);
        if (scroller) {
          scroller.scrollBy({ top: delta, left: 0, behavior: behavior });
        } else {
          window.scrollBy({ top: delta, left: 0, behavior: behavior });
        }
      };
      requestAnimationFrame(function () {
        requestAnimationFrame(run);
        var imgs = menu.querySelectorAll("img");
        if (!imgs.length) return;
        var pending = 0;
        Array.prototype.forEach.call(imgs, function (img) {
          if (img.complete) return;
          pending += 1;
          var done = function () {
            pending -= 1;
            if (pending <= 0) requestAnimationFrame(run);
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      });
    }

    function liturgyPosterThumbUrl(id) {
      const sid = String(id || "").replace(/\.png$/i, "").trim();
      if (!sid) return "";
      return "/static/images/posters/thumbs/" + encodeURIComponent(sid) + ".webp";
    }

    function preloadLiturgyPosterThumbs() {
      for (let n = 1; n <= 4; n += 1) {
        ["lotw" + n, "lote" + n].forEach((id) => {
          const img = new Image();
          img.decoding = "async";
          img.src = liturgyPosterThumbUrl(id);
        });
      }
    }

    var weeklyThumbBlobCache = Object.create(null);
    var weeklyPosterRefreshInflight = null;
    var weeklyPosterCatalogFp = "";
    var weeklyPosterItemsFp = "";

    function preloadWeeklyPosterThumbs(items) {
      (Array.isArray(items) ? items : []).forEach((item) => {
        const src = String((item && (item.thumb_url || item.proxy_url)) || "").trim();
        if (!src || !src.startsWith("/api/")) return;
        void hydrateWeeklyPosterUrl(src).catch(() => {});
      });
    }

    async function hydrateWeeklyPosterUrl(url) {
      const src = String(url || "").trim();
      if (!src) return "";
      // Signed https URLs work in <img>. Same-origin /api/ needs Bearer auth.
      if (!src.startsWith("/api/")) return src;
      if (weeklyThumbBlobCache[src]) return weeklyThumbBlobCache[src];
      const headers = (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function")
        ? await window.VerbumAuth.getAuthHeaders()
        : {};
      const res = await fetch(src, { headers: headers, credentials: "same-origin" });
      if (!res.ok) throw new Error("weekly thumb " + res.status);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      weeklyThumbBlobCache[src] = objectUrl;
      return objectUrl;
    }

    function setWeeklyPosterCardHydrateLoading(card, on) {
      if (!card) return;
      card.classList.toggle("is-loading", !!on);
      const badge = card.querySelector(".mw-weekly-posters__badge");
      if (!badge) return;
      if (on) {
        if (!badge.dataset.idleText) badge.dataset.idleText = String(badge.textContent || "").trim();
        badge.textContent = "Loading…";
        badge.hidden = false;
      } else if (!card.classList.contains("is-pending")) {
        badge.hidden = true;
      } else if (badge.dataset.idleText) {
        badge.textContent = badge.dataset.idleText;
        badge.hidden = false;
      }
    }

    async function hydrateWeeklyPosterCardImages(root) {
      const host = root || $("mw-weekly-posters-track");
      if (!host) return;
      const imgs = host.querySelectorAll("img[data-weekly-src]:not([data-weekly-hydrated='1'])");
      await Promise.all(Array.prototype.map.call(imgs, async (img) => {
        const card = img.closest(".mw-weekly-posters__card");
        const src = img.getAttribute("data-weekly-src") || "";
        const full = img.getAttribute("data-weekly-full") || "";
        const proxy = img.getAttribute("data-weekly-proxy") || "";
        const tryUrls = [src, proxy, full].filter((u, i, arr) => u && arr.indexOf(u) === i);
        setWeeklyPosterCardHydrateLoading(card, true);
        let ok = false;
        for (let i = 0; i < tryUrls.length; i += 1) {
          const candidate = tryUrls[i];
          try {
            const resolved = await hydrateWeeklyPosterUrl(candidate);
            if (!resolved) continue;
            // For signed https URLs, confirm the image actually paints.
            if (!String(resolved).startsWith("/api/") && !String(resolved).startsWith("blob:")) {
              await new Promise((resolve, reject) => {
                const probe = new Image();
                probe.onload = () => resolve();
                probe.onerror = () => reject(new Error("img_load_failed"));
                probe.src = resolved;
              });
            }
            img.src = resolved;
            img.setAttribute("data-weekly-hydrated", "1");
            ok = true;
            break;
          } catch (_e) {
            /* try next candidate */
          }
        }
        if (!ok && proxy && proxy !== src) {
          try {
            const resolvedProxy = await hydrateWeeklyPosterUrl(proxy);
            if (resolvedProxy) {
              img.src = resolvedProxy;
              img.setAttribute("data-weekly-hydrated", "1");
              ok = true;
            }
          } catch (_e3) { /* keep placeholder */ }
        }
        setWeeklyPosterCardHydrateLoading(card, false);
        if (!ok && card && !card.classList.contains("is-pending")) {
          // Ready in catalog but image failed — keep a soft loading shell, not white.
          card.classList.add("is-pending");
          const badge = card.querySelector(".mw-weekly-posters__badge");
          if (badge) {
            badge.hidden = false;
            badge.textContent = "Retrying…";
          }
        }
      }));
      if (typeof syncAiPosterOpacityPreview === "function") syncAiPosterOpacityPreview();
    }

    function initDividerPosterPickers() {
      document.querySelectorAll("[data-poster-picker]").forEach((picker) => {
        if (picker.hasAttribute("data-look-picker")) return;
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
                  '<img src="' + liturgyPosterThumbUrl(lotwId) + '" alt="" decoding="async" loading="eager" />' +
                  '<span class="poster-picker__pair-caption">Word</span>' +
                "</span>" +
                '<span class="poster-picker__pair-item">' +
                  '<img src="' + liturgyPosterThumbUrl(loteId) + '" alt="" decoding="async" loading="eager" />' +
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
            if (opening) scrollPosterPickerMenuIntoView(menu);
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
          current.src = liturgyPosterThumbUrl(id);
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
          opt.innerHTML = '<img src="' + liturgyPosterThumbUrl(id) + '" alt="' + design.label + '" decoding="async" loading="eager" />';
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
          if (opening) scrollPosterPickerMenuIntoView(menu);
        });

        setSelected(target.value || prefix + "1");
      });
      preloadLiturgyPosterThumbs();
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

    function refreshHomeMassCard(opts) {
      if (!$("home-mass-card")) return;
      populateHomeMassSnippet("next", upcomingSundayISO());
      populateHomeMassSnippet("last", lastSundayISO());
      void refreshHomeMassCtaPosterBg(opts);
    }

    var HOME_CTA_POSTER_STYLE_KEY = "home_cta_weekly_poster_style";
    var HOME_CTA_POSTER_SLIDE_MS = 720;
    var HOME_CTA_POSTER_AUTO_MS = 9000;
    var homeCtaPosterBgInflight = null;
    var homeCtaPosterSyncingFromHome = false;
    var homeCtaPosterAwaitRetryTimer = null;
    var homeCtaPosterAwaitRetries = 0;
    var HOME_CTA_POSTER_AWAIT_MAX = 8;
    var HOME_CTA_POSTER_AWAIT_MS = 8000;
    var homeCtaPosterState = {
      sunday: "",
      items: [],
      index: 0,
      layer: 0,
      timer: null,
      fading: false,
      navBound: false,
      activeVersion: 0,
    };

    function homeCtaPosterLayers() {
      const card = $("home-mass-card");
      if (!card) return [];
      return Array.prototype.slice.call(card.querySelectorAll(".redesign-mass-bg--layer"));
    }

    function clearHomeCtaPosterMotionClasses(bg) {
      if (!bg) return;
      bg.classList.remove(
        "is-enter-next",
        "is-enter-prev",
        "is-exit-next",
        "is-exit-prev",
        "is-sliding",
        "is-animating"
      );
    }

    function settleHomeCtaPosterLayers(activeLayer) {
      const layers = homeCtaPosterLayers();
      if (!layers.length) return;
      const active = activeLayer && layers.indexOf(activeLayer) >= 0
        ? activeLayer
        : (layers.find((bg) => bg.classList.contains("is-visible")) || layers[0]);
      layers.forEach((bg) => {
        clearHomeCtaPosterMotionClasses(bg);
        bg.classList.toggle("is-visible", bg === active);
      });
      // Recovery: never leave has-poster-bg without a painted visible layer.
      const card = $("home-mass-card");
      if (card && card.classList.contains("has-poster-bg")) {
        const painted = !!(active && String(active.style.backgroundImage || "").trim());
        if (!painted) {
          card.classList.remove("has-poster-bg");
          // Keep loading chrome — don't flash the empty white card.
          setHomeCtaPosterLoading(true);
        }
      }
    }

    function stopHomeCtaPosterAwaitRetry() {
      if (homeCtaPosterAwaitRetryTimer) {
        clearTimeout(homeCtaPosterAwaitRetryTimer);
        homeCtaPosterAwaitRetryTimer = null;
      }
    }

    function keepHomeCtaPosterAwaiting(styleLabel) {
      const card = $("home-mass-card");
      if (!card) return;
      if (!card.classList.contains("has-poster-bg")) {
        setHomeCtaPosterLoading(true, styleLabel || "");
      }
      stopHomeCtaPosterAwaitRetry();
      if (homeCtaPosterAwaitRetries >= HOME_CTA_POSTER_AWAIT_MAX) return;
      homeCtaPosterAwaitRetries += 1;
      homeCtaPosterAwaitRetryTimer = setTimeout(() => {
        homeCtaPosterAwaitRetryTimer = null;
        void refreshHomeMassCtaPosterBg({ forceReload: true });
      }, HOME_CTA_POSTER_AWAIT_MS);
    }

    function activeExtrasPosterStyleId() {
      const sel = $("flow-ai-poster-style") || $("poster-ai-poster-style");
      const raw = sel ? String(sel.value || "").trim() : "";
      if (!raw || raw === "auto") return "";
      return raw;
    }

    function rememberHomeCtaPosterStyle(styleId) {
      try { localStorage.setItem(HOME_CTA_POSTER_STYLE_KEY, String(styleId || "")); } catch (_e) { /* ignore */ }
    }

    function lastHomeCtaPosterStyle() {
      try { return String(localStorage.getItem(HOME_CTA_POSTER_STYLE_KEY) || "").trim(); } catch (_e) { return ""; }
    }

    function stopHomeCtaPosterAutoplay() {
      if (homeCtaPosterState.timer) {
        clearInterval(homeCtaPosterState.timer);
        homeCtaPosterState.timer = null;
      }
    }

    function startHomeCtaPosterAutoplay() {
      // Home CTA follows the Extras-selected style — no independent carousel autoplay.
      stopHomeCtaPosterAutoplay();
    }

    function syncHomeCtaPosterNav() {
      const nav = $("home-mass-poster-nav");
      const label = $("home-mass-poster-style-label");
      const item = homeCtaPosterState.items[homeCtaPosterState.index];
      if (!nav) return;
      if (!item || homeCtaPosterState.items.length < 1) {
        nav.hidden = true;
        return;
      }
      nav.hidden = false;
      if (label) label.textContent = String(item.label || item.id || "Poster");
    }

    function bindHomeCtaPosterNav() {
      if (homeCtaPosterState.navBound) return;
      const prev = $("home-mass-poster-prev");
      const next = $("home-mass-poster-next");
      if (!prev || !next) return;
      homeCtaPosterState.navBound = true;
      prev.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void showHomeCtaPosterAt(homeCtaPosterState.index - 1, {
          animate: true,
          source: "manual",
          dir: -1,
        });
      });
      next.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void showHomeCtaPosterAt(homeCtaPosterState.index + 1, {
          animate: true,
          source: "manual",
          dir: 1,
        });
      });
    }

    async function syncHomeCtaPosterToExtrasStyle(styleId, opts) {
      const sid = String(styleId || activeExtrasPosterStyleId() || "").trim();
      if (!sid || sid === "auto") return false;
      const card = $("home-mass-card");
      if (!card) return false;
      if (!homeCtaPosterState.items.length || !card.classList.contains("has-poster-bg")) {
        await refreshHomeMassCtaPosterBg(Object.assign({}, opts || {}, { preferStyle: sid }));
        return true;
      }
      const idx = homeCtaPosterState.items.findIndex((it) => String(it.id) === sid);
      if (idx < 0) {
        await refreshHomeMassCtaPosterBg(Object.assign({}, opts || {}, { forceReload: true, preferStyle: sid }));
        return true;
      }
      if (idx === homeCtaPosterState.index && card.classList.contains("has-poster-bg")) {
        syncHomeCtaPosterNav();
        return true;
      }
      return showHomeCtaPosterAt(idx, {
        animate: !(opts && opts.animate === false),
        source: "extras",
      });
    }
    window.syncHomeCtaPosterToExtrasStyle = syncHomeCtaPosterToExtrasStyle;

    function setHomeCtaPosterLoading(on, styleLabel) {
      const card = $("home-mass-card");
      if (!card) return;
      // Never drop loading chrome unless a poster is actually painted.
      const painted = card.classList.contains("has-poster-bg");
      const show = !!on || !painted;
      card.classList.toggle("is-poster-loading", show);
      const el = $("home-mass-poster-loading");
      if (el) {
        el.hidden = !show;
        el.setAttribute("aria-busy", show ? "true" : "false");
        const labelEl = el.querySelector(".home-mass-poster-loading__label");
        if (labelEl) {
          const name = String(styleLabel || "").trim();
          labelEl.textContent = show
            ? (name ? ("Loading " + name + "…") : "Loading this week poster…")
            : "Loading this week poster…";
        }
      }
      const veil = $("home-mass-poster-loading-veil");
      if (veil) veil.hidden = !show;
    }

    function clearHomeMassCtaPosterBg(opts) {
      stopHomeCtaPosterAutoplay();
      stopHomeCtaPosterAwaitRetry();
      homeCtaPosterAwaitRetries = 0;
      const card = $("home-mass-card");
      const layers = homeCtaPosterLayers();
      const nav = $("home-mass-poster-nav");
      if (card) {
        card.classList.remove("has-poster-bg");
        card.removeAttribute("data-home-poster-style");
      }
      layers.forEach((bg, i) => {
        bg.style.backgroundImage = "";
        bg.removeAttribute("data-poster-url");
        clearHomeCtaPosterMotionClasses(bg);
        bg.classList.toggle("is-visible", i === 0);
      });
      if (nav) nav.hidden = true;
      // After clear there is no painted poster — always keep loading chrome.
      setHomeCtaPosterLoading(true, (opts && opts.styleLabel) || "");
      homeCtaPosterState = Object.assign(homeCtaPosterState, {
        sunday: "",
        items: [],
        index: 0,
        layer: 0,
        fading: false,
        activeVersion: 0,
      });
    }

    function preloadHomeCtaPosterUrl(url) {
      return new Promise((resolve) => {
        if (!url) { resolve(false); return; }
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    }

    async function resolveHomeCtaPosterItem(item) {
      if (!item) return null;
      if (item._resolvedUrl) return item;
      const sunday = String(
        homeCtaPosterState.sunday ||
        (typeof upcomingSundayISO === "function" ? upcomingSundayISO() : "") ||
        ""
      ).trim();
      const styleId = String(item.id || "").trim();
      const full = String(item.full_url || "").trim();
      const card = String(item.card_url || "").trim();
      // Always keep an active (non-versioned) card proxy as a last-resort paint path.
      const activeCard = styleId && sunday
        ? ("/api/weekly-style-posters/image?date=" + encodeURIComponent(sunday) + "&style=" + encodeURIComponent(styleId) + "&variant=card")
        : "";
      const cardProxy = card || activeCard;
      // Prefer HTTPS signed assets in CSS directly (no JS blob hydrate) — sharp + fast CDN load.
      // Fall back to sharp 1600px card WebP, never the tiny 720 picker thumb.
      const candidates = [];
      if (/^https?:\/\//i.test(full)) candidates.push(full);
      if (/^https?:\/\//i.test(card)) candidates.push(card);
      if (cardProxy) candidates.push(cardProxy);
      if (activeCard && activeCard !== cardProxy) candidates.push(activeCard);
      if (full) candidates.push(full);
      const seen = {};
      const urls = [];
      candidates.forEach((u) => {
        const key = String(u || "").trim();
        if (!key || seen[key]) return;
        seen[key] = true;
        urls.push(key);
      });
      for (let i = 0; i < urls.length; i++) {
        const raw = urls[i];
        try {
          let resolved = raw;
          if (raw.startsWith("/api/")) {
            resolved = await hydrateWeeklyPosterUrl(raw);
          } else if (!/^https?:\/\//i.test(raw)) {
            continue;
          }
          if (!resolved) continue;
          // Confirm the asset actually decodes before accepting it as the CTA bg.
          const ok = await preloadHomeCtaPosterUrl(resolved);
          if (!ok) continue;
          item._resolvedUrl = resolved;
          item._rawUrl = raw;
          return item;
        } catch (_e) {
          /* try next candidate */
        }
      }
      return null;
    }

    async function showHomeCtaPosterAt(nextIndex, opts) {
      const card = $("home-mass-card");
      const layers = homeCtaPosterLayers();
      const items = homeCtaPosterState.items;
      if (!card || layers.length < 1 || !items.length) return false;
      const animate = !(opts && opts.animate === false);
      const total = items.length;
      const index = ((Number(nextIndex) % total) + total) % total;
      if (homeCtaPosterState.fading && animate) return false;
      if (index === homeCtaPosterState.index && card.classList.contains("has-poster-bg") && animate) {
        return true;
      }
      const pendingItem = items[index];
      const needsResolve = !(pendingItem && pendingItem._resolvedUrl);
      if (needsResolve) {
        setHomeCtaPosterLoading(true, (pendingItem && (pendingItem.label || pendingItem.id)) || "");
      }
      const item = await resolveHomeCtaPosterItem(pendingItem);
      if (!item || !item._resolvedUrl) {
        // Still waiting on decode/hydrate — keep loading, never flash white.
        if (needsResolve && !card.classList.contains("has-poster-bg")) {
          setHomeCtaPosterLoading(true, (pendingItem && (pendingItem.label || pendingItem.id)) || "");
        } else if (needsResolve && card.classList.contains("has-poster-bg")) {
          setHomeCtaPosterLoading(false);
        }
        return false;
      }

      const incoming = layers[homeCtaPosterState.layer === 0 ? 1 % layers.length : 0];
      const outgoing = layers[homeCtaPosterState.layer] || layers[0];
      const targetLayer = layers.length > 1 ? incoming : outgoing;
      // dir > 0 = forever-next (enter from right); dir < 0 = previous (enter from left).
      // Infer neighbor direction when callers omit dir so wrap-around still feels forward/back.
      let dir = Number(opts && opts.dir);
      if (!dir || !Number.isFinite(dir)) {
        const from = Number(homeCtaPosterState.index) || 0;
        if ((from + 1) % total === index) dir = 1;
        else if ((from - 1 + total) % total === index) dir = -1;
        else dir = index >= from ? 1 : -1;
      }
      dir = dir < 0 ? -1 : 1;
      const reduceMotion = !!(window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

      targetLayer.style.backgroundImage = 'url("' + item._resolvedUrl.replace(/"/g, '\\"') + '")';
      targetLayer.setAttribute("data-poster-url", item._rawUrl || "");

      layers.forEach((bg) => clearHomeCtaPosterMotionClasses(bg));

      if (animate && layers.length > 1 && outgoing !== targetLayer) {
        homeCtaPosterState.fading = true;
        if (!reduceMotion) {
          // 1) Park incoming off-screen with transitions off (paint "from" frame).
          targetLayer.classList.remove("is-visible");
          targetLayer.classList.add(
            "is-sliding",
            dir > 0 ? "is-enter-next" : "is-enter-prev"
          );
          outgoing.classList.add("is-sliding", "is-visible");
          void targetLayer.offsetWidth;
          // 2) Next frames: enable transition, then push both panels together.
          requestAnimationFrame(() => {
            targetLayer.classList.add("is-animating");
            outgoing.classList.add("is-animating");
            requestAnimationFrame(() => {
              targetLayer.classList.remove("is-enter-next", "is-enter-prev");
              targetLayer.classList.add("is-visible");
              outgoing.classList.remove("is-visible");
              outgoing.classList.add(dir > 0 ? "is-exit-next" : "is-exit-prev");
            });
          });
        } else {
          settleHomeCtaPosterLayers(targetLayer);
        }
        homeCtaPosterState.layer = Number(targetLayer.getAttribute("data-rmc-bg-layer") || 0);
        window.setTimeout(() => {
          settleHomeCtaPosterLayers(targetLayer);
          homeCtaPosterState.fading = false;
        }, HOME_CTA_POSTER_SLIDE_MS + 40);
      } else {
        settleHomeCtaPosterLayers(targetLayer);
        homeCtaPosterState.layer = Number(targetLayer.getAttribute("data-rmc-bg-layer") || 0);
      }

      card.classList.add("has-poster-bg");
      card.setAttribute("data-home-poster-style", String(item.id || ""));
      homeCtaPosterState.index = index;
      rememberHomeCtaPosterStyle(item.id);
      syncHomeCtaPosterNav();

      // Keep Extras style picker in sync when the home CTA nav changes style.
      if ((opts && opts.source === "manual") && typeof setWeeklyPosterStyle === "function") {
        homeCtaPosterSyncingFromHome = true;
        try { setWeeklyPosterStyle(item.id); } finally { homeCtaPosterSyncingFromHome = false; }
      }

      stopHomeCtaPosterAwaitRetry();
      homeCtaPosterAwaitRetries = 0;
      setHomeCtaPosterLoading(false);
      // Final guard: visible layer must have paint (CSS !important + settle).
      if (!String(targetLayer.style.backgroundImage || "").trim()) {
        settleHomeCtaPosterLayers(targetLayer);
        if (!card.classList.contains("has-poster-bg")) {
          keepHomeCtaPosterAwaiting((item && (item.label || item.id)) || "");
        }
        return false;
      }
      if (opts && opts.source === "manual") startHomeCtaPosterAutoplay();
      return true;
    }

    function pickInitialHomeCtaPosterIndex(items, preferStyle) {
      if (!items.length) return 0;
      const want = String(preferStyle || activeExtrasPosterStyleId() || "").trim();
      if (want && want !== "auto") {
        const idx = items.findIndex((it) => String(it.id) === want);
        if (idx >= 0) return idx;
      }
      const last = lastHomeCtaPosterStyle();
      if (last) {
        const idx = items.findIndex((it) => String(it.id) === last);
        if (idx >= 0) return idx;
      }
      return 0;
    }

    function homeCtaPosterSundayKey(iso) {
      const raw = String(iso || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
      // Normalize any mass date to that week's Sunday (local noon).
      try {
        const d = new Date(raw + "T12:00:00");
        if (Number.isNaN(d.getTime())) return raw;
        const add = d.getDay() === 0 ? 0 : -d.getDay();
        d.setDate(d.getDate() + add);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
      } catch (_e) {
        return raw;
      }
    }

    async function refreshHomeMassCtaPosterBg(opts) {
      const card = $("home-mass-card");
      if (!card) return;
      bindHomeCtaPosterNav();
      let forceReload = !!(opts && opts.forceReload);
      const preferStyle = String((opts && opts.preferStyle) || activeExtrasPosterStyleId() || "").trim();
      const sunday = homeCtaPosterSundayKey(
        (typeof upcomingSundayISO === "function" ? upcomingSundayISO() : "") || ""
      );
      const activeVer = Number(
        (typeof weeklyPosterVersionState !== "undefined" && weeklyPosterVersionState)
          ? (weeklyPosterVersionState.active || 0)
          : 0
      );
      const extrasSunday = homeCtaPosterSundayKey(
        (typeof weeklyPosterVersionState !== "undefined" && weeklyPosterVersionState && weeklyPosterVersionState.sunday)
          || (typeof weeklyPosterCatalogState !== "undefined" && weeklyPosterCatalogState && weeklyPosterCatalogState.sunday)
          || ""
      );
      if (!sunday) {
        // Sunday not known yet — keep loading chrome, never flash white mesh.
        keepHomeCtaPosterAwaiting();
        return;
      }
      if (
        !forceReload &&
        activeVer &&
        extrasSunday === sunday &&
        homeCtaPosterState.activeVersion &&
        homeCtaPosterState.activeVersion !== activeVer
      ) {
        forceReload = true;
      }
      if (
        !forceReload &&
        homeCtaPosterState.sunday === sunday &&
        homeCtaPosterState.items.length &&
        card.classList.contains("has-poster-bg")
      ) {
        if (preferStyle) {
          const idx = homeCtaPosterState.items.findIndex((it) => String(it.id) === preferStyle);
          if (idx >= 0 && idx !== homeCtaPosterState.index) {
            const shown = await showHomeCtaPosterAt(idx, { animate: false, source: "extras" });
            if (!shown) forceReload = true;
          }
        }
        if (!forceReload) {
          stopHomeCtaPosterAwaitRetry();
          homeCtaPosterAwaitRetries = 0;
          setHomeCtaPosterLoading(false);
          startHomeCtaPosterAutoplay();
          syncHomeCtaPosterNav();
          return;
        }
      }
      if (homeCtaPosterBgInflight) return homeCtaPosterBgInflight;
      if (!card.classList.contains("has-poster-bg")) setHomeCtaPosterLoading(true);
      homeCtaPosterBgInflight = (async () => {
        let data = null;
        let painted = false;
        try {
          if (window.VerbumAuth && typeof window.VerbumAuth.waitUntilReady === "function") {
            await window.VerbumAuth.waitUntilReady(4000);
          }
          let ready = [];
          // Only reuse the Extras version catalog when it is for THIS upcoming Sunday.
          try {
            if (typeof weeklyPosterViewCatalogForActiveVersion === "function" && extrasSunday === sunday) {
              const view = weeklyPosterViewCatalogForActiveVersion();
              const viewSunday = homeCtaPosterSundayKey((view && view.sunday) || extrasSunday);
              if (view && viewSunday === sunday && Array.isArray(view.items)) {
                ready = view.items.filter((it) => it && it.id && it.ready);
              }
            }
          } catch (_eView) { /* fall through to API catalog */ }

          // Authoritative source: active disk heroes for the upcoming Sunday.
          const headers = (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function")
            ? await window.VerbumAuth.getAuthHeaders()
            : {};
          const res = await fetch("/api/weekly-style-posters?date=" + encodeURIComponent(sunday), {
            headers: headers,
            credentials: "same-origin",
          });
          data = await res.json().catch(() => ({}));
          if (res.ok && data && data.ok) {
            if (data.versions && typeof syncWeeklyPosterVersionUi === "function") {
              try { syncWeeklyPosterVersionUi(data.versions); } catch (_eVer) { /* ignore */ }
            }
            const apiReady = (Array.isArray(data.items) ? data.items : []).filter((it) => it && it.id && it.ready);
            // Prefer API active heroes (what parishioners get). Keep versioned
            // preview only when API has nothing yet for this Sunday.
            if (apiReady.length) ready = apiReady;
          } else if (!ready.length) {
            if (!card.classList.contains("has-poster-bg")) keepHomeCtaPosterAwaiting();
            return;
          }
          if (!ready.length) {
            if (!card.classList.contains("has-poster-bg")) keepHomeCtaPosterAwaiting();
            return;
          }

          // Bust resolved URL cache when version flips so the new active set paints.
          ready = ready.map((it) => Object.assign({}, it, { _resolvedUrl: "", _rawUrl: "" }));

          homeCtaPosterState.sunday = sunday;
          homeCtaPosterState.items = ready;
          homeCtaPosterState.activeVersion = Number(
            (data && data.versions && data.versions.active_version)
            || ((typeof weeklyPosterVersionState !== "undefined" && weeklyPosterVersionState)
              ? (weeklyPosterVersionState.active || activeVer || 0)
              : activeVer)
            || 0
          );

          const startIndex = pickInitialHomeCtaPosterIndex(homeCtaPosterState.items, preferStyle);
          const preferred = resolveHomeCtaPosterItem(homeCtaPosterState.items[startIndex]);
          homeCtaPosterState.items.forEach((it, i) => {
            if (i === startIndex) return;
            void resolveHomeCtaPosterItem(it);
          });
          let first = await preferred;
          let shown = false;
          if (first) {
            shown = await showHomeCtaPosterAt(startIndex, { animate: false, source: "boot" });
          }
          if (!shown) {
            for (let i = 0; i < homeCtaPosterState.items.length; i++) {
              if (i === startIndex) continue;
              first = await resolveHomeCtaPosterItem(homeCtaPosterState.items[i]);
              if (!first) continue;
              shown = await showHomeCtaPosterAt(i, { animate: false, source: "boot" });
              if (shown) break;
            }
          }
          if (!shown) {
            if (!card.classList.contains("has-poster-bg")) keepHomeCtaPosterAwaiting();
            return;
          }
          painted = true;
          homeCtaPosterState.items.forEach((it) => {
            if (it && it._resolvedUrl) void preloadHomeCtaPosterUrl(it._resolvedUrl);
          });
          startHomeCtaPosterAutoplay();
        } catch (_e) {
          if (!card.classList.contains("has-poster-bg")) keepHomeCtaPosterAwaiting();
        } finally {
          homeCtaPosterBgInflight = null;
          // Only drop the veil once a poster is actually painted.
          if (painted || card.classList.contains("has-poster-bg")) {
            setHomeCtaPosterLoading(false);
          } else if (!card.classList.contains("is-poster-loading")) {
            setHomeCtaPosterLoading(true);
          }
        }
      })();
      return homeCtaPosterBgInflight;
    }

    window.refreshHomeMassCtaPosterBg = refreshHomeMassCtaPosterBg;
    if (!window.__homeCtaPosterAuthHook) {
      window.__homeCtaPosterAuthHook = true;
      window.addEventListener("verbum:auth-ready", () => {
        void refreshHomeMassCtaPosterBg();
      });
      if (window.VerbumAuth && window.VerbumAuth.isReady && window.VerbumAuth.isReady()) {
        void refreshHomeMassCtaPosterBg();
      }
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

    async function reloadFlowReadingsForLanguage(date, language) {
      const d = String(date || ($("mass-date") && $("mass-date").value) || "").trim();
      if (!d) return;
      const lang = language === "tagalog" || language === "english"
        ? language
        : currentMassLanguage();
      const apply = (data) => {
        if (!flowApplyIsCurrent(d, lang)) return;
        if (readingsPayloadComplete(data) && !payloadMatchesLanguage(data, lang)) return;
        applyFlowReadingsData(data, lang);
        flowPreviewData = Object.assign({}, flowPreviewData || {}, data, {
          __previewDate: d,
          readings_language: lang,
        });
        window.__mwPreviewData = flowPreviewData;
        try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (_mwPrev) { /* ignore */ }
      };
      const cached = typeof cachedReadingsForLanguage === "function"
        ? cachedReadingsForLanguage(d, lang)
        : null;
      if (cached) {
        apply(cached);
        return;
      }
      try {
        try { document.dispatchEvent(new CustomEvent("mw:preview-loading")); } catch (_mwLoad) { /* ignore */ }
        const data = await fetchPreview(d, { readingsOnly: true, forceRefresh: false, language: lang });
        if (data && data.ok !== false) {
          data.readings_language = lang;
          if (readingsPayloadComplete(data) && payloadMatchesLanguage(data, lang)) {
            writeStoredReadings(d, data, lang);
          }
          apply(data);
        }
      } catch (_err) {
        notify("Could not load " + lang + " readings for this date.", "error");
        try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (_mwPrev) { /* ignore */ }
      }
    }
    window.reloadFlowReadingsForLanguage = reloadFlowReadingsForLanguage;

    function applyFlowReadingsData(data, language) {
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
      const lang = language || readingsLanguageOf(data) || currentMassLanguage();
      if (flowPreviewData && flowPreviewData.__previewDate === activeDate) {
        Object.assign(flowPreviewData, {
          title: data.title,
          first_reading_reference: data.first_reading_reference,
          first_reading_excerpt: data.first_reading_excerpt,
          second_reading_reference: data.second_reading_reference,
          second_reading_excerpt: data.second_reading_excerpt,
          gospel_reference: data.gospel_reference,
          gospel_text: data.gospel_text,
          gospel_quote: data.gospel_quote,
          gospel_slide_quote: data.gospel_slide_quote,
          sentences: data.sentences,
          psalm_text: data.psalm_text,
          psalm_verses: data.psalm_verses,
          psalm_reference: data.psalm_reference,
          psalm_refrains: data.psalm_refrains,
          readings_complete: data.readings_complete,
          readings_language: lang,
        });
        window.__mwPreviewData = flowPreviewData;
        try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (mwErr) {}
      }
      try {
        const homeSun = upcomingSundayISO();
        if (activeDate && activeDate === homeSun && payloadMatchesLanguage(data, lang)) {
          window.__homePreview = Object.assign({}, data, { __previewDate: activeDate, readings_language: lang });
          previewCache.set(previewCacheKey(activeDate, false, lang), Object.assign({}, data, { readings_language: lang }));
          previewCache.set(previewCacheKey(activeDate, true, lang), Object.assign({}, data, { readings_language: lang }));
          writeStoredReadings(activeDate, Object.assign({}, data, { readings_language: lang }), lang);
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

    function setMassDefaultPin(key, value, on, opts) {
      const options = opts || {};
      const k = String(key || "").trim();
      const v = String(value || "").trim();
      if (!k) return;
      const map = readMassPinnedDefaults();
      if (on) {
        if (!v) return;
        map[k] = v;
      } else if (options.clearKey || !v || map[k] === v) {
        // Field-level pins clear the whole key; option pins only clear when that option is pinned.
        delete map[k];
      }
      writeMassPinnedDefaults(map);
      if (on && k === "flow-hymn-layout" && (v === "single" || v === "dual") && typeof applyHymnLyricsLayout === "function") {
        applyHymnLyricsLayout(v);
      }
      if (on) applyPinnedRiteOptionValue(k, v);
      syncMassDefaultPins();
      if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
    }
    window.setMassDefaultPin = setMassDefaultPin;

    function applyPinnedRiteOptionValue(key, value) {
      const k = String(key || "").trim();
      const v = String(value || "").trim();
      if (!k || !v) return false;
      if (k === "sanctus_tune") {
        const wrap = document.querySelector('.mw-options[aria-label="Sanctus tune"]');
        if (!wrap) return false;
        wrap.querySelectorAll(".mw-option").forEach((c) => {
          const cv = c.getAttribute("data-val");
          if (cv === "__video") return;
          c.setAttribute("aria-checked", String(cv === v));
        });
        if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) {
          if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
          window.massRiteVideoLang.sanctus = v;
        }
        if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
        if (typeof syncRiteOptionsCollapse === "function") syncRiteOptionsCollapse();
        const flowPage = $("flow-page");
        if (flowPage) flowPage.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      const el = $(k);
      if (el && "value" in el && el.hasAttribute("data-mw-tunes")) {
        if (String(el.value || "") !== v) {
          if (typeof setMassBuilderFieldValue === "function") setMassBuilderFieldValue(k, v);
          else el.value = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return true;
      }
      return false;
    }
    window.applyPinnedRiteOptionValue = applyPinnedRiteOptionValue;

    function massDefaultPinCompareValue(inp) {
      const key = inp.getAttribute("data-mw-default-key") || "";
      // Rite/option pins ship with an explicit data-mw-default-value. Field pins must
      // compare against the live selection — never cache it onto the checkbox or the
      // "Use as default" control sticks to the first value (e.g. dual) forever.
      if (inp.hasAttribute("data-mw-default-value")) {
        return String(inp.getAttribute("data-mw-default-value") || "").trim();
      }
      return massDefaultPinCurrentValue(key);
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
        const hasChoice = !!optsWrap.querySelector('.mw-option[aria-checked="true"]');
        rite.classList.toggle("mw-rite--collapse-default", hasChoice);
        optsWrap.querySelectorAll(".mw-option").forEach((opt) => {
          opt.classList.toggle(
            "mw-option--collapse-show",
            opt.getAttribute("aria-checked") === "true"
          );
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
          const checked = !!e.target.checked;
          if (!checked) {
            setMassDefaultPin(fieldId, massDefaultPinCurrentValue(fieldId), false, { clearKey: true });
            return;
          }
          const val = massDefaultPinCurrentValue(fieldId);
          if (!val) {
            e.target.checked = false;
            return;
          }
          setMassDefaultPin(fieldId, val, true);
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
          if (typeof applyHymnLyricsLayout === "function") {
            applyHymnLyricsLayout(val);
          } else {
            document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
              el.checked = el.value === val;
            });
          }
          return;
        }
        if (key === "flow-deck-theme" && typeof setActiveDeckTheme === "function") {
          setActiveDeckTheme(val);
          return;
        }
        if (key === "sanctus_tune") {
          applyPinnedRiteOptionValue(key, val);
          return;
        }
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
        // Field-level pins handle their own change (and stopPropagation).
        if (!inp.hasAttribute("data-mw-default-value")) return;
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
      /* Quick Mass stays visible in the step rail */
    }

    function showMassHabitsBanner(_payload) {
      /* Quick Mass is always visible; habits still gate the confirm modal */
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
      const brandingLocked = typeof hasSavedChurchBrandingSettings === "function"
        && hasSavedChurchBrandingSettings();
      if (!brandingLocked && typeof suggestions.include_church_logo === "boolean") {
        setMassBuilderFieldValue("flow-include-church-logo", suggestions.include_church_logo);
        applied = true;
      }
      if (!brandingLocked && typeof suggestions.include_church_name === "boolean") {
        setMassBuilderFieldValue("flow-include-church-name", suggestions.include_church_name);
        applied = true;
      }
      if (!brandingLocked && typeof suggestions.include_footer === "boolean") {
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
      if (typeof applySavedChurchBrandingSettings === "function") applySavedChurchBrandingSettings();
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
      const quick = $("mw-habits-quick");
      if (quick && quick.dataset.habitsWired !== "1") {
        quick.dataset.habitsWired = "1";
        quick.addEventListener("click", () => {
          if (typeof openQuickMassModal === "function") {
            openQuickMassModal().catch(() => notify("Could not load Quick Mass defaults.", "error"));
          } else {
            runQuickMassFromHabits().catch(() => notify("Could not apply Quick Mass defaults.", "error"));
          }
        });
      }
      const keep = $("mw-quick-mass-keep");
      const cont = $("mw-quick-mass-continue");
      const modal = $("mw-quick-mass-modal");
      if (keep && keep.dataset.habitsWired !== "1") {
        keep.dataset.habitsWired = "1";
        keep.addEventListener("click", () => {
          if (typeof closeQuickMassModal === "function") closeQuickMassModal();
        });
      }
      if (cont && cont.dataset.habitsWired !== "1") {
        cont.dataset.habitsWired = "1";
        cont.addEventListener("click", () => {
          runQuickMassFromHabits().catch(() => notify("Could not apply Quick Mass defaults.", "error"));
        });
      }
      if (modal && modal.dataset.habitsWired !== "1") {
        modal.dataset.habitsWired = "1";
        modal.addEventListener("click", (e) => {
          if (e.target === modal && typeof closeQuickMassModal === "function") closeQuickMassModal();
        });
      }
    }
    wireMassHabitsBanner();

    async function loadFlowData(auto = false, opts) {
      const date = $("mass-date").value;
      const forceRefresh = !!(opts && opts.forceRefresh);
      const lang = resolveReadingsLanguage(opts);
      const seq = ++flowLoadSeq;
      if (!date) {
        if (!auto) notify("Choose a Mass date first.", "error");
        return;
      }
      try { document.dispatchEvent(new CustomEvent("mw:preview-loading")); } catch (_mwLoad) { /* ignore */ }
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
        if (!auto) advanceMassGenStep(2, { message: "Loading the readings…" });
        const [data] = await Promise.all([
          fetchPreview(date, { readingsOnly: false, forceRefresh, language: lang }),
          loadSongCatalog(),
        ]);
        if (seq !== flowLoadSeq || !flowApplyIsCurrent(date, lang)) return;
        if (data && data.ok !== false) {
          // /api/preview was called with mass_language=lang — stamp that so a
          // bad client heuristic cannot discard a complete English payload.
          data.readings_language = lang;
        }
        if (readingsPayloadComplete(data) && !payloadMatchesLanguage(data, lang)) {
          invalidateClientReadings(date);
          const retry = await fetchPreview(date, { readingsOnly: false, forceRefresh: true, language: lang });
          if (seq !== flowLoadSeq || !flowApplyIsCurrent(date, lang)) return;
          if (retry && retry.ok !== false) retry.readings_language = lang;
          if (readingsPayloadComplete(retry) && !payloadMatchesLanguage(retry, lang)) return;
          Object.assign(data, retry || {});
        }
        if (!auto) advanceMassGenStep(3, { message: "Ready for the Word…" });
        if (data && data.ok !== false) data.readings_language = lang;
        flowPreviewData = Object.assign({}, data, { __previewDate: date, readings_language: lang });
        window.__liturgicalPresetId = liturgicalPresetIdFromSeason(data.season || "");
        applyLiturgicalSeasonTheme(data.season || "", data.liturgical_color || null);
        renderThemeGrid();
        const season = [data.season, data.lectionary_cycle].filter(Boolean).join(" - ") || "Season loaded";
        const seasonEl = $("season-indicator");
        if (seasonEl) seasonEl.textContent = season;
        songOptionsBySection = data.songs_by_section || songOptionsBySection;
        if (!massDraftRestoring) {
          // Seed hymns only when the plan is empty or still on the known legacy
          // sticky set. Never overwrite an explicit draft / user plan.
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
        if (typeof prefetchAlternateMassLanguage === "function") {
          prefetchAlternateMassLanguage(date);
        }
        // Keep the home Sunday readings card on the same preview payload.
        try {
          const homeSun = upcomingSundayISO();
          if (date === homeSun && payloadMatchesLanguage(data, lang)) {
            window.__homePreview = Object.assign({}, data, { __previewDate: date, readings_language: lang });
            previewCache.set(previewCacheKey(date, false, lang), data);
            previewCache.set(previewCacheKey(date, true, lang), data);
            if (readingsPayloadComplete(data)) writeStoredReadings(date, data, lang);
            applyHomePreviewData(data, date);
          }
        } catch (_homeSyncErr) { /* home card optional */ }
        if (!readingsPayloadComplete(data)) {
          startReadingsPoll(date, (fresh) => {
            if (!flowApplyIsCurrent(date, lang)) return;
            applyFlowReadingsData(fresh, lang);
            try {
              const homeSun = upcomingSundayISO();
              if (date === homeSun && payloadMatchesLanguage(fresh, lang)) {
                window.__homePreview = Object.assign({}, fresh, { __previewDate: date, readings_language: lang });
                applyHomePreviewData(fresh, date);
              }
            } catch (_e) { /* ignore */ }
          }, lang);
        }
        if (!auto) notify("Planner refreshed with lectionary context and hymn recommendations.", "ok");
      } catch (error) {
        if (!auto) {
          showMassGenError(error.message || "Unable to retrieve Sunday readings.", readSteps.length ? readSteps.length - 1 : 2, () => loadFlowData(false));
        } else {
          notify(error.message || "Could not load readings.", "error");
        }
        renderMassSongPlan();
        setTimeout(function () {
          try { document.dispatchEvent(new CustomEvent("mw:preview")); } catch (mwErr) {}
        }, 0);
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
      minimized: false,
      percent: null,
      statusText: "",
      titleText: "",
    };

    var MASS_GEN_STEP_SETS = {
      standard: [
        "Gathering Mass details",
        "Setting the liturgical day",
        "Arranging the readings",
        "Composing your presentation",
        "Polishing the slides",
        "Almost ready",
      ],
      withUpload: [
        "Gathering Mass details",
        "Setting the liturgical day",
        "Arranging the readings",
        "Adding your artwork",
        "Composing your presentation",
        "Polishing the slides",
        "Almost ready",
      ],
      withAi: [
        "Gathering Mass details",
        "Setting the liturgical day",
        "Arranging the readings",
        "Preparing Mass visuals",
        "Composing your presentation",
        "Polishing the slides",
        "Almost ready",
      ],
      withAiUpload: [
        "Gathering Mass details",
        "Setting the liturgical day",
        "Arranging the readings",
        "Adding your artwork",
        "Preparing Mass visuals",
        "Composing your presentation",
        "Polishing the slides",
        "Almost ready",
      ],
      reusePoster: [
        "Gathering Mass details",
        "Setting the liturgical day",
        "Arranging the readings",
        "Applying saved artwork",
        "Composing your presentation",
        "Almost ready",
      ],
      readings: [
        "Setting the liturgical day",
        "Finding this Mass",
        "Loading the readings",
        "Ready for the Word",
      ],
      lyricsImport: [
        "Uploading lyrics",
        "Reading your file",
        "Organizing song details",
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

    function syncMassGenDock() {
      const dock = $("mass-gen-loader-dock");
      const pctEl = $("mass-gen-loader-dock-pct");
      const titleEl = $("mass-gen-loader-dock-title");
      const subEl = $("mass-gen-loader-dock-sub");
      const expandBtn = $("mass-gen-loader-dock-expand");
      if (!dock) return;
      const overlay = $("mass-gen-loader");
      const isSuccess = !!(overlay && overlay.classList.contains("is-success"));
      const pct = massGenProgressState.percent;
      if (pctEl) {
        pctEl.textContent = pct == null || Number.isNaN(pct) ? "…" : Math.round(pct) + "%";
      }
      const stepLabel =
        (massGenProgressState.steps && massGenProgressState.steps[massGenProgressState.current]) ||
        massGenProgressState.titleText ||
        "Preparing…";
      if (titleEl) {
        titleEl.textContent = isSuccess
          ? (massGenProgressState.titleText || "Ready")
          : stepLabel;
      }
      if (subEl) {
        subEl.textContent = isSuccess
          ? (massGenProgressState.statusText || "Your presentation is ready.")
          : (massGenProgressState.statusText || "This may take a moment…");
      }
      if (expandBtn) {
        expandBtn.setAttribute(
          "aria-label",
          isSuccess ? "Dismiss" : "Expand progress"
        );
      }
      dock.hidden = !(overlay && overlay.classList.contains("is-minimized"));
    }

    function setMassGenMinimized(minimized) {
      const overlay = $("mass-gen-loader");
      if (!overlay) return;
      const next = !!minimized;
      massGenProgressState.minimized = next;
      overlay.classList.toggle("is-minimized", next);
      if (next) {
        document.body.style.overflow = "";
        syncMassGenDock();
      } else if (overlay.classList.contains("visible") && !overlay.classList.contains("is-success")) {
        document.body.style.overflow = "hidden";
        const dock = $("mass-gen-loader-dock");
        if (dock) dock.hidden = true;
      } else {
        syncMassGenDock();
      }
    }

    function renderMassGenSteps(steps, activeIndex, failedIndex) {
      const list = $("mass-gen-loader-steps");
      if (!list) return;
      const items = steps || [];
      // Show only the active (or failed) beat — avoid listing the full pipeline.
      let focus = activeIndex;
      if (failedIndex != null && failedIndex >= 0) focus = failedIndex;
      if (focus == null || focus < 0) focus = 0;
      if (focus >= items.length) focus = Math.max(0, items.length - 1);
      const label = items[focus] || "";
      if (!label) {
        list.innerHTML = "";
        return;
      }
      const failed = failedIndex != null && focus === failedIndex;
      const state = failed ? "is-failed" : "is-active";
      const icon = failed
        ? '<span class="mass-gen-loader__step-icon" aria-hidden="true">✕</span>'
        : '<span class="mass-gen-loader__step-icon" aria-hidden="true"><span class="mass-gen-loader__step-spinner"></span></span>';
      list.innerHTML =
          '<li class="mass-gen-loader__step ' + state + '" role="listitem">' +
            icon +
            '<span class="mass-gen-loader__step-label">' + escapeHtml(label) + "</span>" +
        "</li>";
    }

    function updateMassGenPercent(percent) {
      const wrap = $("mass-gen-loader-pct-wrap");
      const fill = $("mass-gen-loader-pct-fill");
      const label = $("mass-gen-loader-pct-label");
      if (!wrap || !fill) return;
      if (percent == null || Number.isNaN(percent)) {
        wrap.hidden = true;
        massGenProgressState.percent = null;
        syncMassGenDock();
        return;
      }
      const pct = Math.max(0, Math.min(100, Math.round(percent)));
      massGenProgressState.percent = pct;
      wrap.hidden = false;
      fill.style.width = pct + "%";
      if (label) label.textContent = pct + "%";
      syncMassGenDock();
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
        const msgEl = $("mass-gen-loader-msg");
      let statusText = "This may take a moment…";
      if (msgEl) {
        const beat = steps[idx] || "";
        const incoming = String(o.message || "").trim();
        const same =
          !incoming ||
          incoming === beat ||
          incoming === beat + "…" ||
          incoming.replace(/…$/, "") === beat;
        statusText = same ? "This may take a moment…" : incoming;
        msgEl.textContent = statusText;
      }
      massGenProgressState.statusText = statusText;
      if (o.percent != null) {
        updateMassGenPercent(o.percent);
      } else {
        updateMassGenPercent(massGenPercentFromStep(idx, steps.length));
      }
      syncMassGenDock();
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
      setMassGenMinimized(false);
      overlay.classList.add("visible", "is-error");
      overlay.classList.remove("is-success");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      clearMassGenProgressTimers();
      const title = $("mass-gen-loader-title");
      if (title) title.textContent = "Something went wrong";
      massGenProgressState.titleText = "Something went wrong";
      renderMassGenSteps(massGenProgressState.steps, massGenProgressState.current, failedStepIndex != null ? failedStepIndex : massGenProgressState.current);
      const msgEl = $("mass-gen-loader-msg");
      if (msgEl) msgEl.textContent = "";
      massGenProgressState.statusText = message || "We could not finish this step.";
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
      massGenProgressState.titleText = title || "Presentation successfully generated.";
      massGenProgressState.statusText = subtitle || "Your PowerPoint is ready.";
      massGenProgressState.percent = 100;
      overlay.classList.add("visible", "is-success");
      overlay.classList.remove("is-error");
      overlay.setAttribute("aria-hidden", "false");
      const titleEl = $("mass-gen-loader-title");
      if (titleEl) titleEl.textContent = massGenProgressState.titleText;
      const msgEl = $("mass-gen-loader-msg");
      if (msgEl) msgEl.textContent = massGenProgressState.statusText;
      updateMassGenPercent(100);
      // Always land success in the bottom-right dock.
      setMassGenMinimized(true);
      syncMassGenDock();
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }

    function setMassGenLoading(active, messageOrOpts) {
      const overlay = $("mass-gen-loader");
      if (!overlay) return;
      if (!active) {
        clearMassGenProgressTimers();
        massGenProgressState.errored = false;
        massGenProgressState.onRetry = null;
        massGenProgressState.minimized = false;
        massGenProgressState.percent = null;
        massGenProgressState.statusText = "";
        massGenProgressState.titleText = "";
        overlay.classList.remove("visible", "is-success", "is-error", "is-minimized");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        const errWrap = $("mass-gen-loader-error");
        if (errWrap) errWrap.hidden = true;
        const dock = $("mass-gen-loader-dock");
        if (dock) dock.hidden = true;
        updateMassGenPercent(null);
        return;
      }
      const opts = typeof messageOrOpts === "string" ? { message: messageOrOpts } : (messageOrOpts || {});
      massGenProgressState.errored = false;
      massGenProgressState.minimized = false;
      overlay.classList.add("visible");
      overlay.classList.remove("is-success", "is-error", "is-minimized");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const dock = $("mass-gen-loader-dock");
      if (dock) dock.hidden = true;
      const errWrap = $("mass-gen-loader-error");
      if (errWrap) errWrap.hidden = true;
      if (opts.title) {
        const titleEl = $("mass-gen-loader-title");
        if (titleEl) titleEl.textContent = opts.title;
        massGenProgressState.titleText = opts.title;
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
        massGenProgressState.statusText = opts.message;
        syncMassGenDock();
      }
      if (opts.percent != null && opts.step == null) {
        updateMassGenPercent(opts.percent);
      }
    }

    (function bindMassGenLoaderChrome() {
      const minimizeBtn = $("mass-gen-loader-minimize");
      if (minimizeBtn) {
        minimizeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setMassGenMinimized(true);
        });
      }
      const expandBtn = $("mass-gen-loader-dock-expand");
      if (expandBtn) {
        expandBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const overlay = $("mass-gen-loader");
          if (overlay && overlay.classList.contains("is-success")) {
            setMassGenLoading(false);
            return;
          }
          setMassGenMinimized(false);
        });
      }
      const retryBtn = $("mass-gen-loader-retry");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
        const retry = massGenProgressState.onRetry;
        setMassGenLoading(false);
        if (retry) retry();
      });
      }
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

    function readAiPosterTransparencyPct() {
      const el = $("flow-ai-poster-transparency");
      if (!el) return 0;
      let n = Number(el.value);
      if (!Number.isFinite(n)) n = 0;
      return Math.max(0, Math.min(10, Math.round(n)));
    }

    function syncAiPosterOpacityPreview() {
      const pct = readAiPosterTransparencyPct();
      // Match PPTX mapping: 0% = opaque, 10% ≈ 90% opacity.
      const opacity = String(Math.max(0, Math.min(1, 1 - pct / 100)));
      const host = $("mw-weekly-posters");
      if (host) host.style.setProperty("--mw-ai-poster-opacity", opacity);
    }

    function syncAiPosterTransparencyLabel() {
      const el = $("flow-ai-poster-transparency");
      const label = $("flow-ai-poster-transparency-label");
      if (!el) return;
      const pct = readAiPosterTransparencyPct();
      el.value = String(pct);
      el.setAttribute("aria-valuenow", String(pct));
      el.setAttribute("aria-valuetext", pct + " percent");
      if (label) label.textContent = pct + "%";
      syncAiPosterOpacityPreview();
    }

    function readOpenAiPosterSettings() {
      const styleEl = $("flow-ai-poster-style") || $("poster-ai-poster-style");
      let style = (styleEl && styleEl.value) || "cinematic";
      const transparencyPct = readAiPosterTransparencyPct();
      if (!isFeatureEnabled("ai_image_generation")) {
        return {
          useOpenai: false,
          useGemini: false,
          useAi: false,
          backend: null,
          style,
          transparencyPct,
        };
      }
      syncAiPosterToggleState();
      const useAi = typeof areWeeklyAiPostersReady === "function" && areWeeklyAiPostersReady();
      if (useAi) {
        const readyStyle = ensureReadyWeeklyPosterStyle();
        if (readyStyle) style = readyStyle;
        else if (style === "auto") style = "cinematic";
      } else if (style === "auto") {
        style = "cinematic";
      }
      return {
        useOpenai: useAi,
        useGemini: false,
        useAi,
        // Provider is server-selected; do not advertise openai/gemini to the client payload.
        backend: useAi ? "ai" : null,
        style,
        transparencyPct,
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
      if (posterText) posterText.textContent = on ? "Beautifully curated poster · On" : "Beautifully curated poster · Off";
    }

    function migrateLegacyAiPosterToggles() {
      ["flow-use-ai-poster", "poster-use-ai-poster", "flow-use-ai-poster-legacy", "poster-use-ai-poster-legacy"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = true;
      });
      ["flow-use-ai-poster-alt", "poster-use-ai-poster-alt"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = false;
      });
    }

    function syncAiPosterToggleState() {
      ["flow-use-ai-poster", "poster-use-ai-poster", "flow-use-ai-poster-legacy", "poster-use-ai-poster-legacy"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = true;
      });
      ["flow-use-ai-poster-alt", "poster-use-ai-poster-alt"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = false;
      });
      setAiPosterSwitchLabel(true);
    }

    function syncOpenAiPosterUi() {
      syncAiPosterToggleState();
      const litWrap = $("poster-liturgical-template-wrap");
      if (litWrap) litWrap.hidden = true;
      ["flow-ai-poster-style-wrap", "poster-ai-poster-style-wrap"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        const field = el.closest(".field") || el.closest(".flow-setup-footer__toggle-item") || el;
        field.style.opacity = "1";
        field.style.pointerEvents = "";
        field.setAttribute("aria-disabled", "false");
      });
      ["flow-ai-poster-style", "poster-ai-poster-style"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.disabled = false;
        const wrap = el.closest(".vb-select");
        if (wrap) syncVerbumSelectTrigger(el);
      });
      if (typeof syncWeeklyPosterSelectionUi === "function") syncWeeklyPosterSelectionUi();
    }

    async function refreshAiImageQuotaHint() {
      // Quota is enforced server-side; do not surface remaining counts in the UI.
      try {
        const res = await fetch("/api/image-quota");
        const q = await res.json();
        const disableAi = !q.allowed;
        // Keep Mass Builder weekly style path enabled; server enforces quota on generate.
        ["poster-use-ai-poster", "poster-use-ai-poster-legacy", "poster-use-ai-poster-alt"].forEach((id) => {
          const el = $(id);
          if (!el) return;
          el.disabled = disableAi;
          if (disableAi) el.checked = false;
        });
        syncOpenAiPosterUi();
      } catch (_e) {
        /* ignore */
      }
    }

    
    function bindAiPosterQuotaStyleWatch() {
      if (window.__aiQuotaStyleBound) return;
      window.__aiQuotaStyleBound = true;
      ["flow-ai-poster-style", "poster-ai-poster-style", "mass-date"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          if (id === "mass-date") scheduleWeeklyStylePosterRefresh({ force: true });
          syncWeeklyPosterSelectionUi();
          void refreshAiImageQuotaHint();
        });
      });
      initWeeklyStylePosters();
    }

    var weeklyPosterAutoTimer = 0;
    var weeklyPosterEnsureInflight = false;
    var weeklyPosterForceInflight = false;
    var weeklyPosterOverwriteInflight = false;
    var weeklyPosterUnlockReadyChecks = false;
    var weeklyPosterRefreshToken = 0;
    var weeklyPosterRefreshDate = "";
    var weeklyPosterRefreshTimer = 0;
    var weeklyPosterVersionState = { sunday: "", active: 0, versions: [], sundays: [] };
    var weeklyPosterCatalogState = { ready: false, sunday: "", date: "", readyCount: 0, total: 0 };

    function weeklyPosterSaPanelOpen() {
      const page = $("superadmin-page");
      if (!page || page.hidden || !page.classList.contains("active")) return false;
      const panel = document.querySelector('.sa-panel[data-sa-panel="system-gospel-posters"]');
      return !!(panel && !panel.hidden);
    }

    function weeklyPosterMassDate() {
      // Superadmin Gospel posters panel: Sunday picker is the catalog date.
      if (weeklyPosterSaPanelOpen()) {
        const sunSel = $("mw-weekly-posters-sunday");
        const fromSun = sunSel && sunSel.value ? String(sunSel.value).trim() : "";
        if (fromSun) return fromSun;
      }
      const el = $("mass-date") || $("flow-mass-date");
      const fromMass = el && el.value ? String(el.value).trim() : "";
      if (fromMass) return fromMass;
      // Fallback: Sunday dropdown when set (SA) — never invent today's date.
      const sunSel = $("mw-weekly-posters-sunday");
      const fromSun = sunSel && sunSel.value ? String(sunSel.value).trim() : "";
      return fromSun;
    }

    function formatWeeklyPosterSundayLabel(iso) {
      const raw = String(iso || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || "this";
      try {
        const d = new Date(raw + "T12:00:00");
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (_e) {
        return raw;
      }
    }

    function areWeeklyAiPostersReady() {
      return !!weeklyPosterCatalogState.ready;
    }

    /** First carousel card that is ready (not pending), or "". */
    function firstReadyWeeklyPosterStyleId() {
      const track = $("mw-weekly-posters-track") || $("sa-weekly-posters-track");
      if (!track) return "";
      const btn = track.querySelector(".mw-weekly-posters__card:not(.is-pending)");
      return btn ? String(btn.getAttribute("data-weekly-style") || "").trim() : "";
    }

    /**
     * Keep the hidden style select on a ready style. Defaults (cinematic / auto) often
     * point at a pending card when only a partial weekly set exists.
     */
    function ensureReadyWeeklyPosterStyle() {
      if (!areWeeklyAiPostersReady()) return "";
      const sel = $("flow-ai-poster-style") || $("poster-ai-poster-style");
      const track = $("mw-weekly-posters-track");
      const cur = sel ? String(sel.value || "").trim() : "";
      const curBtn = track && cur && cur !== "auto"
        ? track.querySelector('[data-weekly-style="' + cur + '"]')
        : null;
      const curReady = !!(curBtn && !curBtn.classList.contains("is-pending"));
      if (curReady) return cur;
      const sid = firstReadyWeeklyPosterStyleId();
      if (sid && typeof setWeeklyPosterStyle === "function") setWeeklyPosterStyle(sid);
      return sid;
    }

    function syncWeeklyPosterDateIndicator(catalog) {
      const sunday = String(
        (catalog && catalog.sunday) ||
        weeklyPosterCatalogState.sunday ||
        weeklyPosterCatalogState.date ||
        weeklyPosterMassDate() ||
        ""
      ).trim();
      const label = sunday ? ("Mass Sunday · " + formatWeeklyPosterSundayLabel(sunday)) : "";
      ["mw-weekly-posters-date", "sa-weekly-posters-date"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (!sunday) {
          el.hidden = true;
          el.textContent = "";
          return;
        }
        el.hidden = false;
        el.textContent = label;
      });
      const saHint = $("mw-weekly-posters-sa-hint");
      if (saHint) {
        const sa = isWeeklyPosterSuperadmin();
        saHint.hidden = !sa;
        if (sa) saHint.removeAttribute("hidden");
      }
    }

    function setWeeklyPosterProgress(state) {
      const wrap = $("mw-weekly-posters-progress");
      const label = $("mw-weekly-posters-progress-label");
      const pctEl = $("mw-weekly-posters-progress-pct");
      const fill = $("mw-weekly-posters-progress-fill");
      const track = $("mw-weekly-posters-progress-track");
      const hosts = [$("mw-weekly-posters"), $("sa-weekly-posters")].filter(Boolean);
      if (!wrap) return;
      if (!state || !state.active) {
        wrap.hidden = true;
        wrap.classList.remove("is-active");
        hosts.forEach((host) => host.classList.remove("is-generating"));
        if (fill) fill.style.width = "0%";
        if (track) track.setAttribute("aria-valuenow", "0");
        if (pctEl) pctEl.textContent = "0%";
        if (label) label.textContent = "Generating…";
        return;
      }
      const total = Math.max(1, Number(state.total || 5));
      const index = Math.max(0, Math.min(total, Number(state.index || 0)));
      const pct = Math.max(0, Math.min(100, Math.round(Number(state.pct != null ? state.pct : ((index / total) * 100)))));
      const styleLabel = String(state.styleLabel || state.styleId || "style").trim();
      const dateLabel = String(state.dateLabel || "").trim();
      wrap.hidden = false;
      wrap.classList.add("is-active");
      hosts.forEach((host) => host.classList.add("is-generating"));
      if (fill) fill.style.width = pct + "%";
      if (track) track.setAttribute("aria-valuenow", String(pct));
      if (pctEl) pctEl.textContent = pct + "%";
      if (label) {
        const step = state.phase === "done"
          ? ("Done — " + total + "/" + total + " posters")
          : ("Generating " + Math.min(total, Math.max(1, index)) + "/" + total + " · " + styleLabel);
        label.textContent = dateLabel ? (step + " · " + dateLabel) : step;
      }
    }

    function markWeeklyPosterCardLoading(styleId, on) {
      ["mw-weekly-posters-track", "sa-weekly-posters-track"].forEach((id) => {
        const track = $(id);
        if (!track) return;
        track.querySelectorAll("[data-weekly-style]").forEach((btn) => {
          const match = btn.getAttribute("data-weekly-style") === styleId;
          if (on && match) {
            btn.classList.add("is-loading");
            const badge = btn.querySelector(".mw-weekly-posters__badge");
            if (badge) {
              if (!badge.dataset.idleText) {
                badge.dataset.idleText = String(badge.textContent || "").trim() || "Not generated yet";
              }
              badge.hidden = false;
              badge.textContent = "Generating…";
            }
          } else if (!on) {
            btn.classList.remove("is-loading");
            const badge = btn.querySelector(".mw-weekly-posters__badge");
            if (badge && btn.classList.contains("is-pending")) {
              badge.hidden = false;
              badge.textContent = badge.dataset.idleText || "Not generated yet";
            } else if (badge && !btn.classList.contains("is-pending")) {
              badge.hidden = true;
            }
          }
        });
      });
    }

    function syncWeeklyAiPosterGate(catalog) {
      const gate = $("mw-ai-poster-gate");
      const body = $("mw-ai-poster-body");
      const wrap = $("flow-ai-poster-style-wrap");
      const msg = $("mw-ai-poster-gate-msg");
      if (catalog && typeof catalog === "object") {
        const items = Array.isArray(catalog.items) ? catalog.items : [];
        const readyFromItems = items.filter((it) => it && it.ready).length;
        const ready = Number(
          catalog.ready_count != null ? catalog.ready_count : readyFromItems
        ) || readyFromItems;
        const total = Number(catalog.total || items.length || 5);
        weeklyPosterCatalogState = {
          // Unlock as soon as any style is ready so partial sets are selectable.
          ready: ready >= 1,
          sunday: String(catalog.sunday || ""),
          date: String(catalog.date || weeklyPosterMassDate() || ""),
          readyCount: ready,
          total: total,
        };
      }
      syncWeeklyPosterDateIndicator(catalog);
      const dateLabel = formatWeeklyPosterSundayLabel(
        weeklyPosterCatalogState.sunday || weeklyPosterCatalogState.date || weeklyPosterMassDate()
      );
      const unlocked = areWeeklyAiPostersReady();
      if (gate) {
        gate.hidden = unlocked;
        gate.setAttribute("data-ai-ready", unlocked ? "1" : "0");
      }
      if (wrap) wrap.classList.toggle("is-ai-poster-locked", !unlocked);
      const section = $("mw-ai-poster-section");
      if (section) section.classList.toggle("is-ai-poster-locked", !unlocked);
      if (body) {
        body.setAttribute("aria-disabled", unlocked ? "false" : "true");
      }
      if (msg) {
        msg.textContent = unlocked
          ? ""
          : (
            isWeeklyPosterSuperadmin()
              ? ('Beautifully curated posters aren\'t ready for the "' + dateLabel + '" Mass Sunday yet. Use “Generate this week’s styles” above the carousel.')
              : ('Beautifully curated posters aren\'t ready for the "' + dateLabel + '" Mass Sunday yet. Please check back soon.')
          );
      }
      if (unlocked) {
        startWeeklyPosterAutoScroll();
        ensureReadyWeeklyPosterStyle();
      } else {
        stopWeeklyPosterAutoScroll();
      }
      syncWeeklyPosterExpandUi();
      window.areWeeklyAiPostersReady = areWeeklyAiPostersReady;
    }

    function syncWeeklyPosterSelectionUi() {
      const sel = $("flow-ai-poster-style") || $("poster-ai-poster-style");
      let val = sel ? String(sel.value || "cinematic") : "cinematic";
      let pick = val === "auto" ? "cinematic" : val;
      const extrasTrack = $("mw-weekly-posters-track");
      let pickBtn = extrasTrack && extrasTrack.querySelector('[data-weekly-style="' + pick + '"]');
      // Never leave a pending (not-yet-generated) style selected.
      if (!pickBtn || pickBtn.classList.contains("is-pending")) {
        const readyId = firstReadyWeeklyPosterStyleId();
        if (readyId) {
          pick = readyId;
          if (sel && sel.value !== readyId) {
            sel.value = readyId;
            ["flow-ai-poster-style", "poster-ai-poster-style"].forEach((id) => {
              const el = $(id);
              if (el && el.value !== readyId) el.value = readyId;
            });
          }
        }
      }
      [
        { track: $("mw-weekly-posters-track"), viewport: $("mw-weekly-posters-viewport") },
        { track: $("sa-weekly-posters-track"), viewport: $("sa-weekly-posters-viewport") },
      ].forEach((pair) => {
        const track = pair.track;
        if (!track) return;
        let selectedBtn = null;
        track.querySelectorAll("[data-weekly-style]").forEach((btn) => {
          const on = btn.getAttribute("data-weekly-style") === pick;
          btn.classList.toggle("is-selected", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
          if (on) selectedBtn = btn;
        });
        if (selectedBtn && pair.viewport && !selectedBtn.classList.contains("is-pending")) {
          const left = selectedBtn.offsetLeft;
          if (Math.abs(pair.viewport.scrollLeft - left) > 4) {
            pair.viewport.scrollTo({ left: left, behavior: "smooth" });
          }
        }
      });
      syncAiPosterOpacityPreview();
    }

    function setWeeklyPosterStyle(styleId) {
      const sid = String(styleId || "cinematic").trim() || "cinematic";
      ["flow-use-ai-poster", "poster-use-ai-poster", "flow-use-ai-poster-legacy", "poster-use-ai-poster-legacy"].forEach((id) => {
        const el = $(id);
        if (el) el.checked = true;
      });
      ["flow-ai-poster-style", "poster-ai-poster-style"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (el.value !== sid) {
          el.value = sid;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (typeof refreshVerbumSelect === "function") refreshVerbumSelect(el);
      });
      syncAiPosterToggleState();
      syncWeeklyPosterSelectionUi();
      syncWeeklyPosterExpandUi();
      if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
      if (!homeCtaPosterSyncingFromHome && typeof syncHomeCtaPosterToExtrasStyle === "function") {
        void syncHomeCtaPosterToExtrasStyle(sid);
      }
    }

    function currentWeeklyPosterExpandTarget() {
      const sel = $("flow-ai-poster-style") || $("poster-ai-poster-style");
      let styleId = sel ? String(sel.value || "").trim() : "";
      if (!styleId || styleId === "auto") styleId = firstReadyWeeklyPosterStyleId() || "cinematic";
      const tracks = [$("mw-weekly-posters-track"), $("sa-weekly-posters-track")].filter(Boolean);
      let btn = null;
      for (let i = 0; i < tracks.length; i++) {
        btn = tracks[i].querySelector('[data-weekly-style="' + styleId + '"]');
        if (btn) break;
      }
      if (!btn || btn.classList.contains("is-pending")) {
        for (let i = 0; i < tracks.length; i++) {
          const ready = tracks[i].querySelector(".mw-weekly-posters__card:not(.is-pending)");
          if (ready) {
            btn = ready;
            styleId = String(ready.getAttribute("data-weekly-style") || styleId);
            break;
          }
        }
      }
      if (!btn) return null;
      const img = btn.querySelector("img.mw-weekly-posters__img");
      const full = img && (img.getAttribute("data-weekly-full") || img.getAttribute("data-weekly-src") || img.currentSrc || img.src);
      const label = String(btn.getAttribute("title") || styleId || "Poster").trim();
      return {
        styleId: styleId,
        label: label,
        fullUrl: String(full || "").trim(),
        ready: !btn.classList.contains("is-pending"),
      };
    }

    function syncWeeklyPosterExpandUi() {
      const btn = $("mw-weekly-posters-expand");
      if (!btn) return;
      const target = currentWeeklyPosterExpandTarget();
      const canView = !!(target && target.ready && target.fullUrl);
      btn.hidden = !canView;
      btn.disabled = !canView;
      if (canView) {
        btn.setAttribute("aria-label", "View " + target.label + " poster larger");
        btn.title = "View " + target.label + " larger";
      } else {
        btn.setAttribute("aria-label", "View poster larger");
        btn.title = "View poster larger";
      }
    }

    function closeWeeklyPosterExpandModal() {
      const modal = $("mw-weekly-poster-expand-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      const img = $("mw-weekly-poster-expand-img");
      if (img) {
        img.removeAttribute("src");
        img.alt = "";
      }
    }

    async function openWeeklyPosterExpandModal() {
      const target = currentWeeklyPosterExpandTarget();
      if (!target || !target.ready || !target.fullUrl) return;
      const modal = $("mw-weekly-poster-expand-modal");
      const img = $("mw-weekly-poster-expand-img");
      const title = $("mw-weekly-poster-expand-title");
      if (!modal || !img) return;
      if (title) title.textContent = target.label || "Poster";
      img.alt = (target.label || "Poster") + " preview";
      let src = target.fullUrl;
      try {
        if (typeof hydrateWeeklyPosterUrl === "function") {
          src = (await hydrateWeeklyPosterUrl(src)) || src;
        }
      } catch (_e) { /* keep original */ }
      img.src = src;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      const closeBtn = $("mw-weekly-poster-expand-close");
      if (closeBtn) closeBtn.focus();
    }

    function bindWeeklyPosterExpandUi() {
      const expandBtn = $("mw-weekly-posters-expand");
      const modal = $("mw-weekly-poster-expand-modal");
      if (expandBtn && expandBtn.dataset.bound !== "1") {
        expandBtn.dataset.bound = "1";
        expandBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          void openWeeklyPosterExpandModal();
        });
      }
      if (!modal || modal.dataset.bound === "1") {
        syncWeeklyPosterExpandUi();
        return;
      }
      modal.dataset.bound = "1";
      const backdrop = $("mw-weekly-poster-expand-backdrop");
      const closeBtn = $("mw-weekly-poster-expand-close");
      [backdrop, closeBtn].forEach((el) => {
        if (el) el.addEventListener("click", () => closeWeeklyPosterExpandModal());
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!modal.classList.contains("is-open")) return;
        e.preventDefault();
        closeWeeklyPosterExpandModal();
      });
      syncWeeklyPosterExpandUi();
    }

    var weeklyPosterScrollLockUntil = Object.create(null);

    function weeklyPosterCardStep(viewport) {
      if (!viewport) return 1;
      const track = viewport.querySelector(".mw-weekly-posters__track");
      const card = track && track.querySelector(".mw-weekly-posters__card");
      const w = card ? card.getBoundingClientRect().width : 0;
      return Math.max(1, Math.round(w) || viewport.clientWidth || 1);
    }

    function weeklyPosterViewportReady(viewport) {
      if (!viewport) return false;
      // Hidden / not laid out viewports report 0 width — never reorder then.
      return viewport.clientWidth >= 48 && viewport.scrollWidth > viewport.clientWidth + 8;
    }

    function snapWeeklyPosterViewport(viewport, preferredBtn) {
      if (!viewport || !weeklyPosterViewportReady(viewport)) return;
      const track = viewport.querySelector(".mw-weekly-posters__track");
      if (!track) return;
      const cards = Array.prototype.slice.call(track.querySelectorAll(".mw-weekly-posters__card"));
      if (!cards.length) return;
      let target = preferredBtn && cards.indexOf(preferredBtn) >= 0 ? preferredBtn : null;
      if (!target) {
        let best = Infinity;
        cards.forEach((card) => {
          const d = Math.abs(card.offsetLeft - viewport.scrollLeft);
          if (d < best) {
            best = d;
            target = card;
          }
        });
      }
      if (!target) return;
      const prevBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";
      viewport.scrollLeft = target.offsetLeft;
      viewport.style.scrollBehavior = prevBehavior || "";
    }

    function scrollWeeklyPostersBy(dir, viewportId) {
      const id = viewportId || "mw-weekly-posters-viewport";
      const viewport = $(id)
        || $("mw-weekly-posters-viewport")
        || $("sa-weekly-posters-viewport");
      if (!viewport || !weeklyPosterViewportReady(viewport)) return;
      const lockKey = viewport.id || id;
      if (Date.now() < (weeklyPosterScrollLockUntil[lockKey] || 0)) return;
      const track = viewport.querySelector(".mw-weekly-posters__track");
      if (!track) return;
      const cards = Array.prototype.slice.call(track.querySelectorAll(".mw-weekly-posters__card"));
      if (cards.length < 2) return;
      const step = weeklyPosterCardStep(viewport);
      const direction = dir < 0 ? -1 : 1;
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const atStart = viewport.scrollLeft <= 4;
      const atEnd = viewport.scrollLeft >= max - 4;

      const jumpThenAnimate = (prepare) => {
        weeklyPosterScrollLockUntil[lockKey] = Date.now() + 520;
        const prevSnap = viewport.style.scrollSnapType;
        const prevBehavior = viewport.style.scrollBehavior;
        viewport.style.scrollSnapType = "none";
        viewport.style.scrollBehavior = "auto";
        prepare();
        void viewport.offsetWidth;
        requestAnimationFrame(() => {
          viewport.style.scrollBehavior = prevBehavior || "";
          viewport.scrollBy({ left: step * direction, behavior: "smooth" });
          window.setTimeout(() => {
            viewport.style.scrollSnapType = prevSnap || "";
            snapWeeklyPosterViewport(viewport);
            recoverWeeklyPosterCardImages();
          }, 420);
        });
      };

      // Endless loop: rotate DOM so wrap-around always animates in the click direction
      // (5 → 1 feels like next, not a rewind to the start).
      if (direction > 0 && atEnd) {
        const keepCard = cards[cards.length - 1];
        jumpThenAnimate(() => {
          track.appendChild(cards[0]);
          viewport.scrollLeft = keepCard.offsetLeft;
        });
        return;
      }
      if (direction < 0 && atStart) {
        const keepCard = cards[0];
        jumpThenAnimate(() => {
          track.insertBefore(cards[cards.length - 1], cards[0]);
          viewport.scrollLeft = keepCard.offsetLeft;
        });
        return;
      }
      weeklyPosterScrollLockUntil[lockKey] = Date.now() + 420;
      viewport.scrollBy({ left: step * direction, behavior: "smooth" });
    }

    function stopWeeklyPosterAutoScroll() {
      if (weeklyPosterAutoTimer) {
        clearInterval(weeklyPosterAutoTimer);
        weeklyPosterAutoTimer = 0;
      }
    }

    function startWeeklyPosterAutoScroll() {
      stopWeeklyPosterAutoScroll();
      if (!areWeeklyAiPostersReady()) return;
      const host = $("mw-weekly-posters");
      const viewport = $("mw-weekly-posters-viewport");
      if (!host || !viewport) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      weeklyPosterAutoTimer = setInterval(() => {
        if (!areWeeklyAiPostersReady()) {
          stopWeeklyPosterAutoScroll();
          return;
        }
        if (host.matches(":hover") || host.classList.contains("is-paused")) return;
        if (!weeklyPosterViewportReady(viewport)) return;
        // Always advance forward — wrap uses endless-next reorder, never rewind.
        scrollWeeklyPostersBy(1, "mw-weekly-posters-viewport");
      }, 4200);
    }

    function weeklyPosterCardHtml(item) {
      const id = escapeHtml(item.id || "");
      const label = escapeHtml(item.label || item.id || "Style");
      const ready = !!item.ready;
      const rawProxy = String(item.proxy_url || "").trim();
      const rawSrc = String(item.thumb_url || item.proxy_url || "").trim();
      const rawFull = String(item.full_url || "").trim();
      const src = escapeHtml(rawSrc);
      const full = escapeHtml(rawFull);
      const proxy = escapeHtml(rawProxy || (rawSrc.startsWith("/api/") ? rawSrc : ""));
      const needsAuthHydrate = rawSrc.startsWith("/api/");
      const cached = needsAuthHydrate ? weeklyThumbBlobCache[rawSrc] : "";
      const initialSrc = ready ? (cached || "") : "";
      const awaitingPaint = !!(ready && src && !initialSrc);
      const img = ready && src
        ? (
          '<img class="mw-weekly-posters__img" alt="" decoding="async" loading="eager" ' +
          'data-weekly-src="' + src + '" data-weekly-full="' + full + '" data-weekly-proxy="' + proxy + '"' +
          (cached ? ' data-weekly-hydrated="1"' : "") +
          (initialSrc ? (' src="' + escapeHtml(initialSrc) + '"') : "") +
          " />"
        )
        : (
          '<div class="mw-weekly-posters__placeholder" aria-hidden="true">' +
            '<span class="mw-weekly-posters__skel"></span>' +
          "</div>"
        );
      const badgeText = ready
        ? (awaitingPaint ? "Loading…" : "")
        : "Not generated yet";
      const cardCls = "mw-weekly-posters__card"
        + (ready ? "" : " is-pending")
        + (awaitingPaint ? " is-loading" : "");
      return (
        '<button type="button" class="' + cardCls + '" ' +
          'role="option" data-weekly-style="' + id + '" aria-selected="false" title="' + label + '">' +
          '<span class="mw-weekly-posters__frame">' + img + "</span>" +
          '<span class="mw-weekly-posters__label">' + label + "</span>" +
          (badgeText
            ? ('<span class="mw-weekly-posters__badge"' + (ready && !awaitingPaint ? " hidden" : "") + ">" + badgeText + "</span>")
            : '<span class="mw-weekly-posters__badge" hidden></span>') +
        "</button>"
      );
    }

    function bindWeeklyPosterTrackClicks(track, hostId) {
      if (!track) return;
      track.querySelectorAll("[data-weekly-style]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.classList.contains("is-pending")) return;
          if (!areWeeklyAiPostersReady() && !isWeeklyPosterSuperadmin()) return;
          setWeeklyPosterStyle(btn.getAttribute("data-weekly-style"));
          const host = $(hostId);
          if (host) {
            host.classList.add("is-paused");
            setTimeout(() => host.classList.remove("is-paused"), 8000);
          }
        });
      });
    }

    function renderWeeklyStylePosterCards(items) {
      const tracks = [
        { el: $("mw-weekly-posters-track"), hostId: "mw-weekly-posters" },
        { el: $("sa-weekly-posters-track"), hostId: "sa-weekly-posters" },
      ].filter((t) => t.el);
      if (!tracks.length) return;
      const list = Array.isArray(items) ? items : [];
      const fp = list.map((it) => [
        String((it && it.id) || ""),
        (it && it.ready) ? "1" : "0",
        String((it && (it.thumb_url || it.proxy_url)) || ""),
      ].join("|")).join(";");
      // Require every track (Extras + Superadmin) to be populated — otherwise SA
      // preview stays empty after Extras already rendered the same fingerprint.
      const allPopulated = tracks.every((t) => t.el.querySelector(".mw-weekly-posters__card"));
      if (fp && fp === weeklyPosterItemsFp && allPopulated) {
        syncWeeklyPosterSelectionUi();
        syncWeeklyPosterGenerateUi();
        syncWeeklyPosterExpandUi();
        return;
      }
      weeklyPosterItemsFp = fp;
      const html = list.map(weeklyPosterCardHtml).join("");
      tracks.forEach((t) => {
        t.el.innerHTML = html;
        bindWeeklyPosterTrackClicks(t.el, t.hostId);
        void hydrateWeeklyPosterCardImages(t.el);
      });
      preloadWeeklyPosterThumbs(list);
      syncWeeklyPosterSelectionUi();
      syncWeeklyPosterGenerateUi();
      syncWeeklyPosterExpandUi();
      // After rebuild, snap viewports so endless-loop scrollLeft can't leave a blank gap.
      requestAnimationFrame(() => {
        [
          { track: $("mw-weekly-posters-track"), viewport: $("mw-weekly-posters-viewport") },
          { track: $("sa-weekly-posters-track"), viewport: $("sa-weekly-posters-viewport") },
        ].forEach((pair) => {
          if (!pair.track || !pair.viewport) return;
          const selected = pair.track.querySelector(".mw-weekly-posters__card.is-selected")
            || pair.track.querySelector(".mw-weekly-posters__card:not(.is-pending)");
          snapWeeklyPosterViewport(pair.viewport, selected);
        });
      });
    }

    function isWeeklyPosterSuperadmin() {
      return !!(
        document.body.classList.contains("is-superadmin") ||
        (typeof churchMembershipState !== "undefined" && churchMembershipState && churchMembershipState.is_superadmin)
      );
    }

    function weeklyPosterEsc(value) {
      if (typeof escapeHtml === "function") return escapeHtml(value);
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function normalizeWeeklyVersionsPayload(payload) {
      if (!payload) return null;
      // Full versions_payload object
      if (!Array.isArray(payload) && typeof payload === "object") {
        if (Array.isArray(payload.versions) || Array.isArray(payload.sundays) || payload.sunday || payload.active_version != null) {
          return {
            sunday: String(payload.sunday || weeklyPosterCatalogState.sunday || weeklyPosterMassDate() || ""),
            active_version: Number(payload.active_version || 0),
            versions: Array.isArray(payload.versions) ? payload.versions : [],
            sundays: (Array.isArray(payload.sundays) && payload.sundays.length)
              ? payload.sundays
              : (weeklyPosterVersionState.sundays || []),
          };
        }
      }
      // Accidentally passed the inner versions array
      if (Array.isArray(payload)) {
        return {
          sunday: String(weeklyPosterCatalogState.sunday || weeklyPosterMassDate() || ""),
          active_version: Number(weeklyPosterVersionState.active || 0),
          versions: payload,
          sundays: weeklyPosterVersionState.sundays || [],
        };
      }
      return null;
    }

    function syncWeeklyPosterSelectUi(select) {
      if (!select) return;
      delete select.dataset.vbSelect;
      if (typeof refreshVerbumSelect === "function") {
        refreshVerbumSelect(select);
        return;
      }
      if (typeof enhanceVerbumSelect === "function") enhanceVerbumSelect(select);
    }

    function syncWeeklyPosterVersionUi(payload) {
      const sunSel = $("mw-weekly-posters-sunday");
      const verSel = $("mw-weekly-posters-version");
      const sunField = $("mw-weekly-posters-sunday-field");
      const verField = $("mw-weekly-posters-version-field");
      const sa = isWeeklyPosterSuperadmin();
      const normalized = normalizeWeeklyVersionsPayload(payload);
      if (normalized) {
        weeklyPosterVersionState = {
          sunday: normalized.sunday,
          active: normalized.active_version,
          versions: normalized.versions,
          sundays: normalized.sundays,
        };
      }
      if (!sa) {
        if (sunField) sunField.hidden = true;
        if (verField) verField.hidden = true;
        return;
      }
      const massDate = weeklyPosterMassDate();
      const currentSunday = String(
        weeklyPosterVersionState.sunday ||
        weeklyPosterCatalogState.sunday ||
        massDate ||
        ""
      );
      const sundays = listWeeklyPosterSundayOptions(currentSunday);
      if (sunField) {
        sunField.hidden = false;
        sunField.removeAttribute("hidden");
      }
      if (verField) {
        verField.hidden = false;
        verField.removeAttribute("hidden");
      }
      if (sunSel) {
        const prev = String(sunSel.value || "");
        const opts = sundays.length
          ? sundays
          : (currentSunday ? [{ sunday: currentSunday, version_count: (weeklyPosterVersionState.versions || []).length }] : []);
        sunSel.innerHTML = opts.length
          ? opts.map((s) => {
            const label = formatWeeklyPosterSundayLabel(s.sunday) +
              (s.version_count ? (" · " + s.version_count + " ver") : "");
            const selected = s.sunday === currentSunday ? " selected" : "";
            return '<option value="' + weeklyPosterEsc(s.sunday) + '"' + selected + ">" + weeklyPosterEsc(label) + "</option>";
          }).join("")
          : '<option value="">Set Mass date in Step 1</option>';
        sunSel.disabled = opts.length <= 0 || !!weeklyPosterEnsureInflight;
        if (currentSunday) {
          try { sunSel.value = currentSunday; } catch (_e) { /* ignore */ }
        }
        if (!sunSel.value && prev) {
          try { sunSel.value = prev; } catch (_e2) { /* ignore */ }
        }
        syncWeeklyPosterSelectUi(sunSel);
      }
      if (verSel) {
        const versions = weeklyPosterVersionState.versions || [];
        if (!versions.length) {
          verSel.innerHTML = '<option value="">No versions yet</option>';
          verSel.disabled = true;
        } else {
          verSel.disabled = !!weeklyPosterEnsureInflight;
          verSel.innerHTML = versions.map((v) => {
            const num = Number(v.version || 0);
            const active = !!v.active || num === Number(weeklyPosterVersionState.active || 0);
            const status = String(v.status || "").toLowerCase();
            const styles = Array.isArray(v.styles) ? v.styles : [];
            const styleCount = Number(v.style_count != null ? v.style_count : styles.length) || 0;
            // Prefer server label (includes style names for partial sets).
            let label = String(v.label || ("v" + num)).trim();
            if (!label.includes("·") && styleCount > 0 && styleCount < 5) {
              label = "v" + num + " · " + styleCount + "/5";
            }
            const bits = [label];
            if (active) bits.push("active");
            else if (status && status !== "ready" && label.indexOf(status) < 0) bits.push(status);
            return '<option value="' + num + '"' + (active ? " selected" : "") + ">" +
              weeklyPosterEsc(bits.join(" · ")) + "</option>";
          }).join("");
          const active = String(weeklyPosterVersionState.active || versions[0].version || "");
          if (active) {
            try { verSel.value = active; } catch (_e3) { /* ignore */ }
          }
        }
        syncWeeklyPosterSelectUi(verSel);
      }
    }

    function listWeeklyPosterSundayOptions(currentSunday) {
      const map = Object.create(null);
      (weeklyPosterVersionState.sundays || []).forEach((s) => {
        if (!s || !s.sunday) return;
        map[s.sunday] = {
          sunday: String(s.sunday),
          version_count: Number(s.version_count || (s.versions && s.versions.length) || 0),
        };
      });
      const mass = weeklyPosterMassDate();
      const cur = String(currentSunday || mass || "").trim();
      if (cur && !map[cur]) map[cur] = { sunday: cur, version_count: (weeklyPosterVersionState.versions || []).length };
      if (mass && !map[mass]) map[mass] = { sunday: mass, version_count: 0 };
      return Object.keys(map).sort().reverse().map((k) => map[k]);
    }

    async function loadWeeklyPosterVersions(date) {
      const iso = String(date || weeklyPosterMassDate() || "").trim();
      if (!iso || !isWeeklyPosterSuperadmin()) {
        syncWeeklyPosterVersionUi({ sunday: iso, active_version: 0, versions: [], sundays: [] });
        return null;
      }
      try {
        const headers = (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function")
          ? await window.VerbumAuth.getAuthHeaders()
          : {};
        const res = await fetch("/api/weekly-style-posters/versions?date=" + encodeURIComponent(iso), {
          headers: headers,
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.detail) || "versions_failed");
        syncWeeklyPosterVersionUi(data);
        preloadWeeklyPosterVersionThumbs(data.versions || []);
        return data;
      } catch (_e) {
        syncWeeklyPosterVersionUi({
          sunday: iso,
          active_version: weeklyPosterVersionState.active || 0,
          versions: weeklyPosterVersionState.versions || [],
          sundays: weeklyPosterVersionState.sundays || [],
        });
        return null;
      }
    }

    function weeklyPosterVersionCatalogItems(version) {
      const ver = Number(version || 0);
      const sunday = String(
        weeklyPosterVersionState.sunday ||
        weeklyPosterCatalogState.sunday ||
        weeklyPosterCatalogState.date ||
        weeklyPosterMassDate() ||
        ""
      ).trim();
      const defaults = [
        { id: "cinematic", label: "Cinematic" },
        { id: "realistic", label: "Realistic" },
        { id: "renaissance", label: "Renaissance" },
        { id: "stained_glass", label: "Stained Glass" },
        { id: "modern", label: "Modern" },
      ];
      if (!sunday || !ver) {
        return defaults.map((d) => ({ id: d.id, label: d.label, ready: false }));
      }
      const meta = (weeklyPosterVersionState.versions || []).find(
        (v) => Number((v && v.version) || 0) === ver
      );
      const owned = Object.create(null);
      const styleList = meta && Array.isArray(meta.styles) ? meta.styles : null;
      // Unknown ownership (full set) → assume ready; partial → only listed styles.
      if (styleList) {
        styleList.forEach((sid) => { owned[String(sid)] = true; });
      }
      const partial = !!(meta && (meta.complete === false || String(meta.status || "").toLowerCase() === "partial" || (styleList && styleList.length > 0 && styleList.length < defaults.length)));
      return defaults.map((d) => {
        const ready = styleList ? !!owned[d.id] : !partial;
        const base =
          "/api/weekly-style-posters/image?date=" +
          encodeURIComponent(sunday) +
          "&style=" +
          encodeURIComponent(d.id) +
          "&version=" +
          encodeURIComponent(String(ver));
        return {
          id: d.id,
          label: d.label,
          ready: ready,
          thumb_url: ready ? (base + "&variant=thumb") : "",
          card_url: ready ? (base + "&variant=card") : "",
          proxy_url: base + "&variant=thumb",
          full_url: ready ? base : "",
        };
      });
    }

    var weeklyPosterVersionPreloadKey = "";
    var weeklyPosterVersionPreloadQueue = [];
    var weeklyPosterVersionPreloadBusy = 0;

    function preloadWeeklyPosterVersionThumbs(versions) {
      const list = Array.isArray(versions) ? versions : (weeklyPosterVersionState.versions || []);
      const sunday = String(
        weeklyPosterVersionState.sunday ||
        weeklyPosterCatalogState.sunday ||
        weeklyPosterMassDate() ||
        ""
      ).trim();
      if (!sunday || !list.length) return;
      const active = Number(weeklyPosterVersionState.active || 0);
      const key = sunday + ":" + active + ":" + list.map((v) => Number((v && v.version) || 0)).join(",");
      if (key === weeklyPosterVersionPreloadKey) return;
      weeklyPosterVersionPreloadKey = key;
      // Warm only non-active archives, a few at a time (avoid API 429 storms).
      const urls = [];
      list.forEach((v) => {
        const num = Number((v && v.version) || 0);
        if (!num || num === active) return;
        weeklyPosterVersionCatalogItems(num).forEach((it) => {
          const src = String((it && (it.thumb_url || it.proxy_url)) || "").trim();
          if (src && src.startsWith("/api/") && !weeklyThumbBlobCache[src]) urls.push(src);
        });
      });
      weeklyPosterVersionPreloadQueue = urls;
      const pump = () => {
        while (weeklyPosterVersionPreloadBusy < 2 && weeklyPosterVersionPreloadQueue.length) {
          const src = weeklyPosterVersionPreloadQueue.shift();
          weeklyPosterVersionPreloadBusy += 1;
          hydrateWeeklyPosterUrl(src)
            .catch(() => {})
            .finally(() => {
              weeklyPosterVersionPreloadBusy = Math.max(0, weeklyPosterVersionPreloadBusy - 1);
              pump();
            });
        }
      };
      pump();
    }

    async function activateWeeklyPosterVersion(version) {
      const date = weeklyPosterMassDate();
      const ver = Number(version || 0);
      const status = $("mw-weekly-posters-gen-status");
      const verSel = $("mw-weekly-posters-version");
      if (!isWeeklyPosterSuperadmin() || !date || !ver) return;
      if (weeklyPosterEnsureInflight) return;
      if (Number(weeklyPosterVersionState.active || 0) === ver) return;
      const prevActive = Number(weeklyPosterVersionState.active || 0);
      const prevVersions = (weeklyPosterVersionState.versions || []).slice();
      // Drop unversioned active thumbs — they reuse one cache key across versions.
      const sundayKey = String(
        weeklyPosterVersionState.sunday || weeklyPosterCatalogState.sunday || date || ""
      ).trim();
      clearWeeklyPosterThumbCache({ sunday: sundayKey, unversionedOnly: true });
      // Instant paint from archived version URLs only (never hybrid active files).
      syncWeeklyPosterVersionUi({
        sunday: weeklyPosterVersionState.sunday || weeklyPosterCatalogState.sunday || date,
        active_version: ver,
        versions: (weeklyPosterVersionState.versions || []).map((v) => ({
          ...v,
          active: Number(v.version || 0) === ver,
        })),
        sundays: weeklyPosterVersionState.sundays || [],
      });
      const optimistic = weeklyPosterVersionCatalogItems(ver);
      weeklyPosterItemsFp = "";
      renderWeeklyStylePosterCards(optimistic);
      recoverWeeklyPosterCardImages();
      const optimisticReady = optimistic.filter((it) => it && it.ready).length;
      syncWeeklyPosterGenerateUi({
        items: optimistic,
        ready_count: optimisticReady,
        total: 5,
        sunday: weeklyPosterCatalogState.sunday || date,
        date: date,
      });
      weeklyPosterEnsureInflight = true;
      if (verSel) verSel.disabled = true;
      if (status) status.textContent = "Switching to v" + ver + "…";
      try {
        const headers = { "Content-Type": "application/json" };
        if (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function") {
          Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
        }
        const res = await fetch("/api/weekly-style-posters/activate", {
          method: "POST",
          headers: headers,
          credentials: "same-origin",
          body: JSON.stringify({ date: date, version: ver }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && data.detail) || "Activate failed");
        if (data.versions) syncWeeklyPosterVersionUi(data.versions);
        // Always re-render from versioned archive URLs for the selected version.
        const view = weeklyPosterViewCatalogForActiveVersion()
          || (data.catalog && data.catalog.items ? data.catalog : null);
        if (view && view.items) {
          weeklyPosterItemsFp = "";
          renderWeeklyStylePosterCards(view.items);
          syncWeeklyPosterGenerateUi(view);
          syncWeeklyAiPosterGate(view);
          syncWeeklyPosterDateIndicator(view);
        }
        if (status) status.textContent = "Active poster set: v" + ver + ".";
        if (typeof refreshHomeMassCtaPosterBg === "function") {
          void refreshHomeMassCtaPosterBg({ forceReload: true });
        }
      } catch (err) {
        if (status) status.textContent = (err && err.message) || "Could not switch version";
        if (typeof notify === "function") notify((err && err.message) || "Could not switch version", "error");
        // Revert UI to previous active version.
        syncWeeklyPosterVersionUi({
          sunday: weeklyPosterVersionState.sunday || date,
          active_version: prevActive,
          versions: prevVersions,
          sundays: weeklyPosterVersionState.sundays || [],
        });
        if (prevActive) {
          weeklyPosterItemsFp = "";
          renderWeeklyStylePosterCards(weeklyPosterVersionCatalogItems(prevActive));
        }
        if (verSel && prevActive) {
          try { verSel.value = String(prevActive); } catch (_e) { /* ignore */ }
        }
      } finally {
        weeklyPosterEnsureInflight = false;
        syncWeeklyPosterGenerateUi();
      }
    }

    function weeklyPosterActiveVersionMeta() {
      const active = Number(weeklyPosterVersionState.active || 0);
      if (!active) return null;
      const hit = (weeklyPosterVersionState.versions || []).find(
        (v) => Number((v && v.version) || 0) === active
      );
      return hit || null;
    }

    function weeklyPosterVersionIsPartial(meta) {
      if (!meta) return false;
      const styles = Array.isArray(meta.styles) ? meta.styles : [];
      if (meta.complete === false) return true;
      if (String(meta.status || "").toLowerCase() === "partial") return true;
      if (String(meta.status || "").toLowerCase() === "generating") return true;
      return styles.length > 0 && styles.length < 5;
    }

    function weeklyPosterReadyStyleMap(catalog) {
      const ready = Object.create(null);
      // Partial active version: only styles archived in that version count as
      // "already generated". Active disk heroes may still hold older-version art.
      const meta = weeklyPosterActiveVersionMeta();
      if (meta && weeklyPosterVersionIsPartial(meta)) {
        (Array.isArray(meta.styles) ? meta.styles : []).forEach((sid) => {
          const id = String(sid || "").trim();
          if (id) ready[id] = true;
        });
        return ready;
      }
      const items = catalog && Array.isArray(catalog.items) ? catalog.items : null;
      if (items) {
        items.forEach((it) => {
          const id = String((it && it.id) || "").trim();
          if (id && it.ready) ready[id] = true;
        });
        return ready;
      }
      const track = $("mw-weekly-posters-track");
      if (track) {
        track.querySelectorAll("[data-weekly-style]").forEach((btn) => {
          const id = String(btn.getAttribute("data-weekly-style") || "").trim();
          if (id && !btn.classList.contains("is-pending")) ready[id] = true;
        });
      }
      return ready;
    }

    function applyWeeklyPosterVersionReadyOverlay(catalog) {
      if (!catalog || typeof catalog !== "object") return catalog;
      const meta = weeklyPosterActiveVersionMeta();
      if (!meta || !weeklyPosterVersionIsPartial(meta)) return catalog;
      const owned = Object.create(null);
      (Array.isArray(meta.styles) ? meta.styles : []).forEach((sid) => {
        owned[String(sid || "").trim()] = true;
      });
      const ver = Number(meta.version || 0);
      const sunday = String(
        weeklyPosterVersionState.sunday ||
        catalog.sunday ||
        weeklyPosterCatalogState.sunday ||
        weeklyPosterMassDate() ||
        ""
      ).trim();
      const defaults = ["cinematic", "realistic", "renaissance", "stained_glass", "modern"];
      const byId = Object.create(null);
      (Array.isArray(catalog.items) ? catalog.items : []).forEach((it) => {
        if (it && it.id) byId[String(it.id)] = it;
      });
      const items = defaults.map((id) => {
        const prev = byId[id] || { id: id, label: id.replace(/_/g, " ") };
        const isReady = !!owned[id];
        const base = sunday && ver
          ? (
            "/api/weekly-style-posters/image?date=" +
            encodeURIComponent(sunday) +
            "&style=" +
            encodeURIComponent(id) +
            "&version=" +
            encodeURIComponent(String(ver))
          )
          : "";
        return {
          id: id,
          label: prev.label || id,
          ready: isReady,
          thumb_url: isReady && base ? (base + "&variant=thumb") : (isReady ? String(prev.thumb_url || "") : ""),
          card_url: isReady && base ? (base + "&variant=card") : (isReady ? String(prev.card_url || "") : ""),
          proxy_url: base ? (base + "&variant=thumb") : String(prev.proxy_url || ""),
          full_url: isReady && base ? base : (isReady ? String(prev.full_url || "") : ""),
        };
      });
      return Object.assign({}, catalog, {
        items: items,
        ready_count: items.filter((it) => it.ready).length,
        total: items.length,
      });
    }

    function weeklyPosterCheckedStyleIds() {
      const boxes = document.querySelectorAll('#mw-weekly-posters-style-checks input[name="mw-weekly-gen-style"]');
      const out = [];
      boxes.forEach((box) => {
        if (!box.checked || box.disabled) return;
        const id = String(box.value || "").trim();
        if (id && out.indexOf(id) < 0) out.push(id);
      });
      return out;
    }

    function syncWeeklyPosterStyleCheckState(catalog) {
      const host = $("mw-weekly-posters-style-checks");
      if (!host) return;
      const readyMap = weeklyPosterReadyStyleMap(catalog);
      const inflight = !!weeklyPosterEnsureInflight;
      // New-version / in-place remake unlocks already-generated styles so they can be remade.
      const unlockReady = !!weeklyPosterUnlockReadyChecks
        || !!weeklyPosterForceInflight
        || !!weeklyPosterOverwriteInflight;
      host.querySelectorAll('input[name="mw-weekly-gen-style"]').forEach((box) => {
        const id = String(box.value || "").trim();
        const isReady = !!readyMap[id];
        const label = box.closest(".mw-weekly-posters__style-check");
        const disable = inflight || (isReady && !unlockReady);
        box.disabled = disable;
        if (isReady && !unlockReady) {
          box.checked = false;
          if (label) label.classList.add("is-ready");
        } else if (label) {
          label.classList.remove("is-ready");
        }
      });
    }

    function bindWeeklyPosterStyleChecks() {
      const host = $("mw-weekly-posters-style-checks");
      if (!host || host.dataset.bound === "1") return;
      host.dataset.bound = "1";
      host.querySelectorAll('input[name="mw-weekly-gen-style"]').forEach((box) => {
        box.addEventListener("change", () => { syncWeeklyPosterGenerateUi(); });
      });
    }

    function weeklyPosterSelectedCarouselStyleId() {
      const track = $("sa-weekly-posters-track") || $("mw-weekly-posters-track");
      if (!track) return "";
      const active = track.querySelector("[data-weekly-style].is-active, [data-weekly-style].is-selected, [data-weekly-style][aria-pressed='true']");
      if (active) return String(active.getAttribute("data-weekly-style") || "").trim();
      const first = track.querySelector("[data-weekly-style]");
      return first ? String(first.getAttribute("data-weekly-style") || "").trim() : "";
    }

    function unlockWeeklyPosterReadyChecks(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      weeklyPosterUnlockReadyChecks = true;
      const host = $("mw-weekly-posters-style-checks");
      if (!host) return;
      host.querySelectorAll('input[name="mw-weekly-gen-style"]').forEach((box) => {
        box.disabled = false;
        const label = box.closest(".mw-weekly-posters__style-check");
        if (label) label.classList.remove("is-ready");
      });
      if (weeklyPosterCheckedStyleIds().length) return;
      const prefer = String(options.preferStyle || weeklyPosterSelectedCarouselStyleId() || "").trim();
      if (prefer) {
        const box = host.querySelector('input[name="mw-weekly-gen-style"][value="' + prefer + '"]');
        if (box) {
          box.checked = true;
          return;
        }
      }
      if (options.checkAll) {
        host.querySelectorAll('input[name="mw-weekly-gen-style"]').forEach((box) => {
          box.checked = true;
        });
      }
    }

    function syncWeeklyPosterGenerateUi(catalog) {
      const btn = $("mw-weekly-posters-generate");
      const regenBtn = $("mw-weekly-posters-regenerate");
      const regenInPlaceBtn = $("mw-weekly-posters-regen-inplace");
      const status = $("mw-weekly-posters-gen-status");
      const checks = $("mw-weekly-posters-style-checks");
      const toolbar = $("mw-weekly-posters-toolbar")
        || ((btn || regenBtn || regenInPlaceBtn) && (btn || regenBtn || regenInPlaceBtn).closest(".mw-weekly-posters__toolbar"));
      const sa = isWeeklyPosterSuperadmin();
      bindWeeklyPosterStyleChecks();
      if (toolbar) {
        // Controls live on Superadmin Gospel posters panel only.
        toolbar.hidden = !sa;
        if (sa) toolbar.removeAttribute("hidden");
      }
      if (checks) {
        checks.hidden = !sa;
        if (sa) checks.removeAttribute("hidden");
      }
      if (!sa) {
        if (btn) btn.hidden = true;
        if (regenBtn) regenBtn.hidden = true;
        if (regenInPlaceBtn) regenInPlaceBtn.hidden = true;
        if (status) status.textContent = "";
        syncWeeklyPosterVersionUi();
        return;
      }
      const overlayCatalog = applyWeeklyPosterVersionReadyOverlay(catalog || null);
      syncWeeklyPosterStyleCheckState(overlayCatalog);
      const readyMap = weeklyPosterReadyStyleMap(overlayCatalog);
      const ready = Object.keys(readyMap).length;
      const total = 5;
      const missing = Math.max(0, total - ready);
      const picked = weeklyPosterCheckedStyleIds();
      const pickCount = picked.length;
      const inflight = !!weeklyPosterEnsureInflight;
      const activeVer = Number(weeklyPosterVersionState.active || 0);
      const hasVersions = (weeklyPosterVersionState.versions || []).length > 0 || ready > 0;
      if (btn) {
        btn.hidden = false;
        btn.disabled = inflight || pickCount <= 0 || missing <= 0;
        if (inflight && !weeklyPosterForceInflight && !weeklyPosterOverwriteInflight) {
          btn.textContent = "Generating…";
        } else if (missing <= 0) {
          btn.textContent = "Styles ready";
        } else if (pickCount <= 0) {
          btn.textContent = "Select styles to generate";
        } else {
          btn.textContent = "Generate " + pickCount + " style" + (pickCount === 1 ? "" : "s");
        }
      }
      if (regenInPlaceBtn) {
        regenInPlaceBtn.hidden = !hasVersions;
        regenInPlaceBtn.disabled = inflight || !activeVer;
        if (weeklyPosterOverwriteInflight) {
          regenInPlaceBtn.textContent = "Regenerating in v" + activeVer + "…";
        } else if (activeVer) {
          regenInPlaceBtn.textContent = "Regenerate selected in v" + activeVer;
        } else {
          regenInPlaceBtn.textContent = "Regenerate selected in this version";
        }
      }
      if (regenBtn) {
        // New version is available once a baseline exists (or while generating).
        regenBtn.hidden = !hasVersions && missing > 0;
        regenBtn.disabled = inflight;
        if (weeklyPosterForceInflight) {
          regenBtn.textContent = "Generating new version…";
        } else {
          regenBtn.textContent = "Generate new version";
        }
      }
      const verSel = $("mw-weekly-posters-version");
      const sunSel = $("mw-weekly-posters-sunday");
      if (verSel) verSel.disabled = inflight || !(weeklyPosterVersionState.versions || []).length;
      if (sunSel) sunSel.disabled = inflight;
      if (status && !inflight && missing <= 0) {
        const active = Number(weeklyPosterVersionState.active || 0);
        status.textContent = active
          ? ("Poster styles ready · active v" + active + ". Remake checked styles in this version, or create a new version.")
          : "Poster styles are ready. Use New version to regenerate.";
      } else if (status && !inflight && weeklyPosterVersionIsPartial(weeklyPosterActiveVersionMeta())) {
        const active = Number(weeklyPosterVersionState.active || 0);
        status.textContent = pickCount > 0
          ? ("Continue v" + active + ": " + picked.join(", ").replace(/_/g, " ") + ".")
          : ("v" + active + " is partial (" + ready + "/" + total + "). Check styles still to generate.");
      } else if (status && !inflight && pickCount <= 0) {
        status.textContent = "Check one or more ungenerated styles.";
      } else if (status && !inflight && pickCount > 0) {
        status.textContent = "Selected: " + picked.join(", ").replace(/_/g, " ") + ".";
      }
      syncWeeklyPosterVersionUi();
    }

    function weeklyPosterStyleQueue(force) {
      const defaults = [
        { id: "cinematic", label: "Cinematic" },
        { id: "realistic", label: "Realistic" },
        { id: "renaissance", label: "Renaissance" },
        { id: "stained_glass", label: "Stained Glass" },
        { id: "modern", label: "Modern" },
      ];
      const track = $("sa-weekly-posters-track") || $("mw-weekly-posters-track");
      const fromDom = [];
      if (track) {
        track.querySelectorAll("[data-weekly-style]").forEach((btn) => {
          const id = String(btn.getAttribute("data-weekly-style") || "").trim();
          if (!id) return;
          const labelEl = btn.querySelector(".mw-weekly-posters__label");
          const label = labelEl ? String(labelEl.textContent || "").trim() : id;
          const ready = !btn.classList.contains("is-pending");
          fromDom.push({ id: id, label: label || id, ready: ready });
        });
      }
      let list = fromDom.length ? fromDom : defaults.map((d) => ({ id: d.id, label: d.label, ready: false }));
      const checked = weeklyPosterCheckedStyleIds();
      if (checked.length) {
        const allow = Object.create(null);
        checked.forEach((id) => { allow[id] = true; });
        list = list.filter((it) => allow[it.id]);
        // Keep checkbox order.
        list.sort((a, b) => checked.indexOf(a.id) - checked.indexOf(b.id));
      }
      if (!force) list = list.filter((it) => !it.ready);
      return list;
    }

    function clearWeeklyPosterThumbCache(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      const sunday = String(options.sunday || "").trim();
      const unversionedOnly = !!options.unversionedOnly;
      Object.keys(weeklyThumbBlobCache).forEach((k) => {
        const key = String(k || "");
        if (sunday && key.indexOf("date=" + encodeURIComponent(sunday)) < 0 && key.indexOf("date=" + sunday) < 0) {
          return;
        }
        if (unversionedOnly && /[?&]version=\d+/.test(key)) return;
        try {
          const u = weeklyThumbBlobCache[k];
          if (u && String(u).indexOf("blob:") === 0) URL.revokeObjectURL(u);
        } catch (_e) {}
        delete weeklyThumbBlobCache[k];
      });
      // Always bust render fingerprints — otherwise early-return skips rehydrate
      // and cards keep revoked blob: URLs (blank posters).
      weeklyPosterCatalogFp = "";
      weeklyPosterItemsFp = "";
      // Mark matching live imgs dirty so hydrate can repaint without a full rebuild.
      document.querySelectorAll("img.mw-weekly-posters__img[data-weekly-src]").forEach((img) => {
        const src = String(img.getAttribute("data-weekly-src") || "");
        if (!src) return;
        if (sunday && src.indexOf(sunday) < 0 && src.indexOf(encodeURIComponent(sunday)) < 0) return;
        if (unversionedOnly && /[?&]version=\d+/.test(src)) return;
        img.removeAttribute("data-weekly-hydrated");
        try { img.removeAttribute("src"); } catch (_e2) { /* ignore */ }
      });
    }

    function recoverWeeklyPosterCardImages() {
      ["mw-weekly-posters-track", "sa-weekly-posters-track"].forEach((id) => {
        const track = $(id);
        if (!track || !track.querySelector(".mw-weekly-posters__card")) return;
        track.querySelectorAll("img.mw-weekly-posters__img[data-weekly-src]").forEach((img) => {
          const painted = String(img.getAttribute("src") || "");
          if (!painted || painted.indexOf("blob:") === 0) {
            img.removeAttribute("data-weekly-hydrated");
            if (painted.indexOf("blob:") === 0) {
              try { img.removeAttribute("src"); } catch (_e) { /* ignore */ }
            }
          }
        });
        void hydrateWeeklyPosterCardImages(track);
      });
    }

    function weeklyPosterViewCatalogForActiveVersion() {
      const active = Number(weeklyPosterVersionState.active || 0);
      if (!active || !(weeklyPosterVersionState.versions || []).length) return null;
      const items = weeklyPosterVersionCatalogItems(active);
      const ready = items.filter((it) => it && it.ready).length;
      return {
        ok: true,
        items: items,
        ready_count: ready,
        total: 5,
        sunday: weeklyPosterVersionState.sunday || weeklyPosterCatalogState.sunday || weeklyPosterMassDate(),
        date: weeklyPosterCatalogState.date || weeklyPosterMassDate(),
      };
    }

    async function generateWeeklyStylePosters(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      const force = !!options.force;
      const overwriteInPlace = !!options.overwriteInPlace;
      const newVersion = !overwriteInPlace && !!(options.newVersion || force);
      const date = weeklyPosterMassDate();
      const btn = $("mw-weekly-posters-generate");
      const regenBtn = $("mw-weekly-posters-regenerate");
      const regenInPlaceBtn = $("mw-weekly-posters-regen-inplace");
      const status = $("mw-weekly-posters-gen-status");
      const hint = $("mw-weekly-posters-hint");
      if (!isWeeklyPosterSuperadmin()) return;
      if (!date) {
        if (status) status.textContent = "Set the Mass date first (Step 1).";
        syncWeeklyPosterDateIndicator({ sunday: "", date: "" });
        return;
      }
      if (weeklyPosterEnsureInflight) return;
      const sundayLabel = formatWeeklyPosterSundayLabel(
        weeklyPosterCatalogState.sunday || weeklyPosterCatalogState.date || date
      );
      const activeMeta = weeklyPosterActiveVersionMeta();
      const activeVer = Number((activeMeta && activeMeta.version) || weeklyPosterVersionState.active || 0);
      if (overwriteInPlace) {
        if (!activeVer) {
          if (status) status.textContent = "Activate a version first, then remake selected styles.";
          syncWeeklyPosterGenerateUi();
          return;
        }
        unlockWeeklyPosterReadyChecks({ preferStyle: weeklyPosterSelectedCarouselStyleId() });
        syncWeeklyPosterGenerateUi();
      } else if (newVersion) {
        unlockWeeklyPosterReadyChecks({ checkAll: true });
        syncWeeklyPosterGenerateUi();
      }
      const picked = weeklyPosterCheckedStyleIds();
      if (!picked.length) {
        weeklyPosterUnlockReadyChecks = false;
        if (status) {
          status.textContent = overwriteInPlace
            ? "Check the style(s) to remake in v" + activeVer + "."
            : "Check one or more styles to generate.";
        }
        syncWeeklyPosterGenerateUi();
        return;
      }
      const partial = picked.length < 5;
      const continuingPartial = !newVersion && !overwriteInPlace && weeklyPosterVersionIsPartial(activeMeta);
      if (overwriteInPlace) {
        const ok = window.confirm(
          "Remake " + picked.length + " style" + (picked.length === 1 ? "" : "s")
          + " inside v" + activeVer + " for " + sundayLabel + "?\n\n"
          + picked.join(", ").replace(/_/g, " ")
          + "\n\nThis replaces those posters in the current version (no new version tab)."
        );
        if (!ok) {
          weeklyPosterUnlockReadyChecks = false;
          syncWeeklyPosterGenerateUi();
          return;
        }
      } else if (newVersion) {
        const nextHint = (weeklyPosterVersionState.versions || []).length
          ? ("v" + ((Number(weeklyPosterVersionState.active) || (weeklyPosterVersionState.versions || []).length) + 1))
          : "v1";
        const countNote = partial
          ? ("\n\nOnly checked styles will generate: " + picked.join(", ").replace(/_/g, " ") + ".")
          : "";
        const ok = window.confirm(
          "Generate a new poster version (" + nextHint + ") for " + sundayLabel + "?\n\n"
          + "Older versions stay available in the Version dropdown."
          + countNote
        );
        if (!ok) {
          weeklyPosterUnlockReadyChecks = false;
          syncWeeklyPosterGenerateUi();
          return;
        }
      }
      // Partial / continue-partial / in-place remake always regenerates checked styles.
      const queue = weeklyPosterStyleQueue(newVersion || overwriteInPlace || partial || continuingPartial);
      if (!queue.length) {
        if (status) status.textContent = "Poster styles are already ready for " + sundayLabel + ".";
        setWeeklyPosterProgress(null);
        return;
      }
      weeklyPosterEnsureInflight = true;
      weeklyPosterForceInflight = newVersion;
      weeklyPosterOverwriteInflight = overwriteInPlace;
      if (btn) {
        btn.disabled = true;
        if (!newVersion && !overwriteInPlace) btn.textContent = "Generating…";
      }
      if (regenBtn) {
        regenBtn.disabled = true;
        if (newVersion) regenBtn.textContent = "Generating new version…";
      }
      if (regenInPlaceBtn) {
        regenInPlaceBtn.disabled = true;
        if (overwriteInPlace) regenInPlaceBtn.textContent = "Regenerating in v" + activeVer + "…";
      }
      let genCount = 0;
      let lastCatalog = null;
      let batchVersion = overwriteInPlace ? activeVer : null;
      const total = queue.length;
      try {
        if (window.VerbumAuth && typeof window.VerbumAuth.waitUntilReady === "function") {
          await window.VerbumAuth.waitUntilReady(4000);
        }
        const headers = { "Content-Type": "application/json" };
        if (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function") {
          Object.assign(headers, await window.VerbumAuth.getAuthHeaders());
        }
        for (let i = 0; i < queue.length; i += 1) {
          const item = queue[i];
          const step = i + 1;
          const pct = Math.round(((step - 1) / total) * 100);
          markWeeklyPosterCardLoading(item.id, true);
          setWeeklyPosterProgress({
            active: true,
            index: step,
            total: total,
            pct: pct,
            styleId: item.id,
            styleLabel: item.label,
            dateLabel: sundayLabel,
          });
          if (status) {
            const phaseLabel = newVersion
              ? "New version"
              : (overwriteInPlace ? ("v" + activeVer) : "Generating");
            status.textContent = phaseLabel
              + " " + step + "/" + total + " · " + item.label
              + " · " + sundayLabel;
          }
          const body = { date: date, style: item.id };
          if (overwriteInPlace) {
            body.force = true;
            body.overwrite_only = true;
            body.version = batchVersion || activeVer;
          } else if (newVersion) {
            body.force = true;
            body.new_version = true;
            if (batchVersion) body.version = batchVersion;
          } else if (continuingPartial && activeMeta) {
            // Finish styles still missing from the active partial version (e.g. v3).
            body.force = true;
            body.new_version = true;
            body.version = batchVersion || Number(activeMeta.version || 0);
          } else if (partial) {
            // Prompt test: overwrite the checked styles without allocating a full new version.
            body.force = true;
            body.overwrite_only = true;
            if (activeVer) body.version = activeVer;
          }
          const res = await fetch("/api/weekly-style-posters/ensure", {
            method: "POST",
            headers: headers,
            credentials: "same-origin",
            body: JSON.stringify(body),
          });
          const ensured = await res.json().catch(() => ({}));
          if (!res.ok) {
            const detail = ensured && (ensured.detail || ensured.error);
            const msg = typeof sanitizePublicError === "function"
              ? sanitizePublicError(detail || ("Generate failed (" + res.status + ")"))
              : (typeof detail === "string" ? detail : ("Generate failed (" + res.status + ")"));
            throw new Error(msg);
          }
          if (ensured.version != null && batchVersion == null) {
            batchVersion = Number(ensured.version) || null;
          }
          if (ensured.versions) syncWeeklyPosterVersionUi(ensured.versions);
          if (Array.isArray(ensured.generated)) genCount += ensured.generated.length;
          clearWeeklyPosterThumbCache({
            sunday: String(
              (ensured.catalog && (ensured.catalog.sunday || ensured.catalog.date))
              || weeklyPosterCatalogState.sunday
              || date
              || ""
            ).trim(),
          });
          const catalog = weeklyPosterViewCatalogForActiveVersion()
            || applyWeeklyPosterVersionReadyOverlay(ensured.catalog || null)
            || ensured.catalog
            || null;
          if (catalog && catalog.items) {
            lastCatalog = catalog;
            renderWeeklyStylePosterCards(catalog.items);
            const rc = Number(catalog.ready_count || 0);
            const tc = Number(catalog.total || 5);
            if (hint) {
              hint.textContent = rc >= tc
                ? "Your pick becomes the Mass divider background."
                : (rc + " of " + tc + " styles ready — pick one when available.");
            }
            syncWeeklyPosterGenerateUi(catalog);
            syncWeeklyAiPosterGate(catalog);
          }
          markWeeklyPosterCardLoading(item.id, false);
          setWeeklyPosterProgress({
            active: true,
            index: step,
            total: total,
            pct: Math.round((step / total) * 100),
            styleId: item.id,
            styleLabel: item.label,
            dateLabel: sundayLabel,
            phase: step >= total ? "done" : "running",
          });
        }
        if (!lastCatalog) await refreshWeeklyStylePosters({ force: true });
        else await loadWeeklyPosterVersions(date);
        const verLabel = batchVersion ? ("v" + batchVersion) : "";
        if (status) {
          if (overwriteInPlace) {
            status.textContent = genCount
              ? ("Updated " + (verLabel || ("v" + activeVer)) + " (" + genCount + " remade) for " + sundayLabel + ".")
              : ("No styles remade for " + sundayLabel + ".");
          } else if (newVersion) {
            status.textContent = genCount
              ? ("Created " + (verLabel || "new version") + " (" + genCount + " styles) for " + sundayLabel + ".")
              : ("New version finished for " + sundayLabel + ".");
          } else {
            status.textContent = genCount
              ? ("Generated " + genCount + " style" + (genCount === 1 ? "" : "s") + " for " + sundayLabel + ".")
              : ("No new styles needed for " + sundayLabel + ".");
          }
        }
        if (typeof notify === "function") {
          notify(
            overwriteInPlace
              ? (genCount
                ? ("Remade " + genCount + " style" + (genCount === 1 ? "" : "s") + " in " + (verLabel || ("v" + activeVer)) + ".")
                : "No styles remade.")
              : (newVersion
                ? (genCount ? ("Poster " + (verLabel || "version") + " ready for " + sundayLabel + ".") : "New version finished.")
                : (genCount ? ("Weekly posters updated (" + genCount + " new) for " + sundayLabel + ".") : "Weekly posters already ready.")),
            "ok"
          );
        }
      } catch (err) {
        markWeeklyPosterCardLoading("", false);
        const failLabel = overwriteInPlace
          ? "Regenerate failed"
          : (newVersion ? "New version failed" : "Generate failed");
        if (status) status.textContent = (err && err.message) || failLabel;
        if (typeof notify === "function") notify((err && err.message) || failLabel, "error");
        syncWeeklyPosterGenerateUi();
      } finally {
        weeklyPosterEnsureInflight = false;
        weeklyPosterForceInflight = false;
        weeklyPosterOverwriteInflight = false;
        weeklyPosterUnlockReadyChecks = false;
        markWeeklyPosterCardLoading("", false);
        setTimeout(() => setWeeklyPosterProgress(null), 900);
        syncWeeklyPosterGenerateUi(
          weeklyPosterCatalogState.total
            ? {
              ready_count: weeklyPosterCatalogState.readyCount,
              total: weeklyPosterCatalogState.total,
              sunday: weeklyPosterCatalogState.sunday,
              date: weeklyPosterCatalogState.date,
            }
            : undefined
        );
      }
    }

    function scheduleWeeklyStylePosterRefresh(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      if (weeklyPosterRefreshTimer) {
        try { clearTimeout(weeklyPosterRefreshTimer); } catch (_e) { /* ignore */ }
      }
      weeklyPosterRefreshTimer = setTimeout(() => {
        weeklyPosterRefreshTimer = 0;
        void refreshWeeklyStylePosters(options);
      }, options.force ? 40 : 160);
    }

    async function refreshWeeklyStylePosters(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      const force = !!options.force;
      const date = weeklyPosterMassDate();
      // If a refresh for this same date is already running, reuse it.
      // If the date changed (or force), wait out the stale one then reload.
      if (weeklyPosterRefreshInflight) {
        if (!force && weeklyPosterRefreshDate === date) return weeklyPosterRefreshInflight;
        try { await weeklyPosterRefreshInflight; } catch (_e) { /* ignore */ }
      }
      const token = ++weeklyPosterRefreshToken;
      weeklyPosterRefreshDate = date;
      weeklyPosterRefreshInflight = (async () => {
      const hint = $("mw-weekly-posters-hint");
      const track = $("mw-weekly-posters-track");
      if (!track) return;
      const dateNow = weeklyPosterMassDate();
      weeklyPosterRefreshDate = dateNow;
      syncWeeklyPosterDateIndicator({ sunday: dateNow, date: dateNow });
      if (!dateNow) {
        weeklyPosterCatalogFp = "";
        if (hint) hint.textContent = "Set the Mass date in Step 1 to load this week’s poster styles.";
        track.innerHTML = "";
        syncWeeklyPosterGenerateUi();
        syncWeeklyAiPosterGate({ ready_count: 0, total: 5, sunday: "", date: "" });
        syncWeeklyPosterDateIndicator({ sunday: "", date: "" });
        return;
      }
      try {
        const headers = (window.VerbumAuth && typeof window.VerbumAuth.getAuthHeaders === "function")
          ? await window.VerbumAuth.getAuthHeaders()
          : {};
        const res = await fetch("/api/weekly-style-posters?date=" + encodeURIComponent(dateNow), {
          headers: headers,
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data && data.detail) || "Load failed");
        // Drop stale responses if a newer refresh started or the Mass date changed.
        if (token !== weeklyPosterRefreshToken || weeklyPosterMassDate() !== dateNow) return;
        if (data.versions) syncWeeklyPosterVersionUi(data.versions);
        else await loadWeeklyPosterVersions(dateNow);
        // When browsing an older archive version in Superadmin, use versioned URLs.
        // When viewing the active set (Extras / default), use the API catalog's
        // unversioned active heroes — archives are often missing after regenerating
        // only the active ``*_hero.png`` slot (which caused grey empty carousels).
        const selectedVer = Number(weeklyPosterVersionState.active || 0);
        const catalogActiveVer = Number(
          (data.versions && data.versions.active_version) || 0
        );
        const viewingArchive = !!(
          weeklyPosterSaPanelOpen() &&
          selectedVer > 0 &&
          catalogActiveVer > 0 &&
          selectedVer !== catalogActiveVer
        );
        const versionView = weeklyPosterViewCatalogForActiveVersion()
          || applyWeeklyPosterVersionReadyOverlay(data);
        const apiHasReady = Array.isArray(data.items)
          && data.items.some((it) => it && it.ready && (it.thumb_url || it.proxy_url || it.full_url));
        const view = viewingArchive
          ? (versionView || data)
          : (apiHasReady ? data : (versionView || data));
        const sundayKey = String(view.sunday || dateNow);
        const activeVer = Number(weeklyPosterVersionState.active || (view.versions && view.versions.active_version) || 0);
        const ready = Number(view.ready_count || 0);
        const total = Number(view.total || 0);
        const fp = [sundayKey, activeVer, ready, total, (weeklyPosterActiveVersionMeta() && weeklyPosterActiveVersionMeta().styles || []).join(",")].join("|");
        const sundayChanged = sundayKey !== String(weeklyPosterCatalogState.sunday || "");
        if (!force && fp === weeklyPosterCatalogFp && track.querySelector("[data-weekly-style]")) {
          syncWeeklyPosterGenerateUi(view);
          syncWeeklyAiPosterGate(view);
          syncWeeklyPosterDateIndicator(view);
          return;
        }
        weeklyPosterCatalogFp = fp;
        if (force || sundayChanged) clearWeeklyPosterThumbCache({ sunday: sundayKey });
        renderWeeklyStylePosterCards(view.items || []);
        if (hint) {
          hint.textContent = ready >= total && total
            ? "Your pick becomes the Mass divider background."
            : (ready + " of " + total + " styles ready — pick one when available.");
        }
        syncWeeklyPosterGenerateUi(view);
        syncWeeklyAiPosterGate(view);
        syncWeeklyPosterDateIndicator(view);
        // Keep the home CTA on the same active Sunday posters / selected style.
        try {
          const homeSun = typeof homeCtaPosterSundayKey === "function"
            ? homeCtaPosterSundayKey(typeof upcomingSundayISO === "function" ? upcomingSundayISO() : "")
            : "";
          const viewSun = typeof homeCtaPosterSundayKey === "function"
            ? homeCtaPosterSundayKey(sundayKey)
            : sundayKey;
          if (homeSun && viewSun && homeSun === viewSun && typeof refreshHomeMassCtaPosterBg === "function") {
            void refreshHomeMassCtaPosterBg({ forceReload: !!force });
          }
        } catch (_eHome) { /* ignore */ }
      } catch (_e) {
        if (token !== weeklyPosterRefreshToken || weeklyPosterMassDate() !== dateNow) return;
        if (hint) hint.textContent = "Could not load weekly posters for " + formatWeeklyPosterSundayLabel(dateNow) + ".";
        renderWeeklyStylePosterCards([
          { id: "cinematic", label: "Cinematic", ready: false },
          { id: "realistic", label: "Realistic", ready: false },
          { id: "renaissance", label: "Renaissance", ready: false },
          { id: "stained_glass", label: "Stained Glass", ready: false },
          { id: "modern", label: "Modern", ready: false },
        ]);
        syncWeeklyPosterGenerateUi();
        syncWeeklyAiPosterGate({ ready_count: 0, total: 5, sunday: dateNow, date: dateNow });
        syncWeeklyPosterDateIndicator({ sunday: dateNow, date: dateNow });
      }
      })().finally(() => {
        if (token === weeklyPosterRefreshToken) weeklyPosterRefreshInflight = null;
      });
      return weeklyPosterRefreshInflight;
    }

    function bindWeeklyPosterCarouselHost(hostId, viewportId, navAttr) {
      const host = $(hostId);
      if (!host || host.dataset.bound === "1") return;
      host.dataset.bound = "1";
      host.querySelectorAll("[" + navAttr + "]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = parseInt(btn.getAttribute(navAttr) || "1", 10) || 1;
          scrollWeeklyPostersBy(dir, viewportId);
          host.classList.add("is-paused");
          setTimeout(() => host.classList.remove("is-paused"), 8000);
        });
      });
      const viewport = $(viewportId);
      if (viewport) {
        viewport.addEventListener("pointerdown", () => {
          host.classList.add("is-paused");
          setTimeout(() => host.classList.remove("is-paused"), 8000);
        });
      }
    }

    function initWeeklyStylePosters() {
      const genBtn = $("mw-weekly-posters-generate");
      const regenBtn = $("mw-weekly-posters-regenerate");
      const regenInPlaceBtn = $("mw-weekly-posters-regen-inplace");
      const verSel = $("mw-weekly-posters-version");
      const sunSel = $("mw-weekly-posters-sunday");
      const openSa = $("mw-weekly-posters-open-sa");
      if (genBtn && genBtn.dataset.bound !== "1") {
        genBtn.dataset.bound = "1";
        genBtn.addEventListener("click", () => { void generateWeeklyStylePosters(); });
      }
      if (regenInPlaceBtn && regenInPlaceBtn.dataset.bound !== "1") {
        regenInPlaceBtn.dataset.bound = "1";
        regenInPlaceBtn.addEventListener("click", () => {
          void generateWeeklyStylePosters({ overwriteInPlace: true });
        });
      }
      if (regenBtn && regenBtn.dataset.bound !== "1") {
        regenBtn.dataset.bound = "1";
        regenBtn.addEventListener("click", () => { void generateWeeklyStylePosters({ newVersion: true }); });
      }
      if (verSel && verSel.dataset.bound !== "1") {
        verSel.dataset.bound = "1";
        verSel.addEventListener("change", () => {
          void activateWeeklyPosterVersion(verSel.value);
        });
      }
      if (sunSel && sunSel.dataset.bound !== "1") {
        sunSel.dataset.bound = "1";
        sunSel.addEventListener("change", () => {
          // Browse catalog for this Sunday without rewriting the Mass builder date.
          scheduleWeeklyStylePosterRefresh({ force: true });
        });
      }
      if (openSa && openSa.dataset.bound !== "1") {
        openSa.dataset.bound = "1";
        openSa.addEventListener("click", () => {
          try {
            if (typeof saState !== "undefined" && saState) {
              saState.panel = "system-gospel-posters";
              saState.hub = "platform";
              if (!saState.hubPanel) saState.hubPanel = {};
              saState.hubPanel.platform = "system-gospel-posters";
            }
          } catch (_e) { /* ignore */ }
        });
      }
      window.refreshWeeklyStylePosters = refreshWeeklyStylePosters;
      window.scheduleWeeklyStylePosterRefresh = scheduleWeeklyStylePosterRefresh;
      window.setWeeklyPosterStyle = setWeeklyPosterStyle;
      window.preloadExtrasPosterAssets = function preloadExtrasPosterAssets() {
        preloadLiturgyPosterThumbs();
      };
      bindWeeklyPosterCarouselHost("mw-weekly-posters", "mw-weekly-posters-viewport", "data-weekly-nav");
      bindWeeklyPosterCarouselHost("sa-weekly-posters", "sa-weekly-posters-viewport", "data-sa-weekly-nav");
      bindWeeklyPosterExpandUi();
      scheduleWeeklyStylePosterRefresh({ force: weeklyPosterSaPanelOpen() });
      // Recover blank carousels after cache/blob races (page restore, bfcache, tab focus).
      if (!window.__weeklyPosterRecoverBound) {
        window.__weeklyPosterRecoverBound = true;
        const recover = () => {
          recoverWeeklyPosterCardImages();
          const card = $("home-mass-card");
          if (card && card.classList.contains("has-poster-bg")) {
            const layers = homeCtaPosterLayers();
            const visible = layers.find((bg) => bg.classList.contains("is-visible")) || layers[0];
            if (!visible || !String(visible.style.backgroundImage || "").trim()) {
              if (typeof refreshHomeMassCtaPosterBg === "function") {
                void refreshHomeMassCtaPosterBg({ forceReload: true });
              }
            } else {
              settleHomeCtaPosterLayers(visible);
            }
          }
        };
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") recover();
        });
        window.addEventListener("pageshow", recover);
        window.setTimeout(recover, 1200);
      }
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
      const transparencyEl = $("flow-ai-poster-transparency");
      if (transparencyEl && !transparencyEl.dataset.boundTransparency) {
        transparencyEl.dataset.boundTransparency = "1";
        syncAiPosterTransparencyLabel();
        transparencyEl.addEventListener("input", () => {
          syncAiPosterTransparencyLabel();
          if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
        });
        transparencyEl.addEventListener("change", () => {
          syncAiPosterTransparencyLabel();
          if (typeof scheduleMassBuilderDraftAutoSave === "function") scheduleMassBuilderDraftAutoSave();
        });
      }
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
      const styles = ["flow-ai-poster-style", "poster-ai-poster-style"];
      styles.forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          styles.forEach((oid) => {
            const other = $(oid);
            if (other) other.value = el.value;
          });
          if (!homeCtaPosterSyncingFromHome && typeof syncHomeCtaPosterToExtrasStyle === "function") {
            void syncHomeCtaPosterToExtrasStyle(el.value);
          }
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
      if (model.aiPoster) parts.push("Beautifully curated poster");
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
          "<span class=\"mass-gen-receipt__line-value\">" + escapeHtml(display + suffix) + "</span>" +
        "</div>"
      );
    }

    function renderMassGenerateReceiptView(model) {
      const alertHtml = model.missingLyricsCount > 0
        ? "<div class=\"mass-gen-receipt__alert\" role=\"alert\">" +
            escapeHtml(model.missingLyricsCount + " song" + (model.missingLyricsCount === 1 ? "" : "s") + " still need lyrics") +
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
        "<div class=\"mass-gen-receipt__hero\">" +
          "<p class=\"mass-gen-receipt__kicker\">This Mass</p>" +
          "<p class=\"mass-gen-receipt__title\">" + escapeHtml(formatMassSummaryDate(model.date)) + "</p>" +
          "<p class=\"mass-gen-receipt__sub\">" + escapeHtml(receiptCelebrantDisplay(model)) + "</p>" +
          (model.gospelRef ? "<p class=\"mass-gen-receipt__stamp\">" + escapeHtml(model.gospelRef) + "</p>" : "") +
        "</div>" +
        "<div class=\"mass-gen-receipt__block\">" +
          "<p class=\"mass-gen-receipt__block-label\">Celebration</p>" +
          receiptViewLine("Title", model.massTitle, false) +
        "</div>" +
        "<div class=\"mass-gen-receipt__block\">" +
          "<p class=\"mass-gen-receipt__block-label\">Music · " + model.selectedSongCount + "</p>" +
        songLines +
        "</div>" +
        (foot ? "<p class=\"mass-gen-receipt__foot\">" + escapeHtml(foot) + "</p>" : "")
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
      const creedVal = creedSel ? String(creedSel.value || "").trim().toLowerCase() : "";
      const creed = creedVal === "apostles"
        ? "Apostles' Creed"
        : (creedVal === "none" ? "No Creed" : "Nicene Creed");
      const gloriaSel = $("flow-gloria-choice");
      const gloriaVal = gloriaSel ? String(gloriaSel.value || "").trim().toLowerCase() : "";
      const gloria = gloriaVal === "latin"
        ? "Gloria · Latin"
        : (gloriaVal === "none" ? "No Gloria" : "Gloria · English");
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
        aiBackend: o.ai_poster_backend || posterOpts.backend || "ai",
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
          const rowSec = String(row.section || "").toLowerCase();
          const sec = String(song.section || "").toLowerCase();
          // Never offer Meditation catalog songs for non-meditation Mass slots.
          if (rowSec === "meditation" && sec !== "meditation") return false;
          if (!sec) return rowSec !== "meditation";
          return rowSec === sec || (sec === "communion" && rowSec === "communion");
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
      pendingFullscreen: null, // true = enter, false = exit, null = none
      webpptx: null,
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
      if (bar) bar.hidden = true;
      const mwPresent = $("mw-present");
      if (mwPresent) {
        const inWizard = document.body.classList.contains("mw-on");
        const show = !!(available && inWizard && !massSlideshowState.open);
        if (typeof window.setMwNavBtnVisible === "function") window.setMwNavBtnVisible(mwPresent, show);
        else mwPresent.hidden = !show;
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
        cues: (massSlideshowState.slides || [])
          .filter((s) => s && s.kind === "video" && s.video_url)
          .map((s) => ({
            index: s.index,
            kind: "video",
            video_url: s.video_url,
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

    var massProjectionRemote = {
      token: null,
      remoteUrl: "",
      qrUrl: "",
      lastSeq: 0,
      pollTimer: null,
      applyingRemote: false,
      panelOpen: false,
    };

    function massSlideshowPptxName() {
      if (massSlideshowState.pptxName) return massSlideshowState.pptxName;
      if (lastMassGenerateResult && lastMassGenerateResult.export_stem) {
        return lastMassGenerateResult.export_stem + ".pptx";
      }
      return "";
    }

    function massSlideshowSlideNames() {
      return (massSlideshowState.slides || []).map((s, i) => {
        const url = (s && s.image_url) || "";
        const m = url.match(/\/preview\/([^/?#]+)/);
        if (m && m[1]) return decodeURIComponent(m[1]);
        return "slide_" + String(i + 1).padStart(4, "0") + ".jpg";
      });
    }

    function stopMassProjectionRemotePoll() {
      if (massProjectionRemote.pollTimer) {
        clearTimeout(massProjectionRemote.pollTimer);
        massProjectionRemote.pollTimer = null;
      }
    }

    function setMassProjectionRemotePanel(open) {
      massProjectionRemote.panelOpen = !!open;
      const panel = $("mass-slideshow-remote-panel");
      if (panel) panel.hidden = !open;
      if (open) setMassSlideshowChromeVisible(true);
    }

    async function ensureMassProjectionSession() {
      if (!massSlideshowState.open) return null;
      if (massProjectionRemote.token) return massProjectionRemote;
      try {
        const data = await postJSON("/api/projection/session", {
          total: Math.max(massSlideshowState.slides.length, massSlideshowState.expectedTotal || 0),
          index: massSlideshowState.index || 0,
          pptx_name: massSlideshowPptxName(),
          slide_names: massSlideshowSlideNames(),
        });
        if (!data || !data.token) return null;
        massProjectionRemote.token = data.token;
        massProjectionRemote.remoteUrl = data.remote_url || (location.origin + "/projection/" + data.token);
        massProjectionRemote.qrUrl = data.qr_url || ("/api/projection/" + data.token + "/qr.png");
        massProjectionRemote.lastSeq = data.command_seq || 0;
        const qr = $("mass-slideshow-remote-qr");
        if (qr) qr.src = massProjectionRemote.qrUrl + "?t=" + Date.now();
        const link = $("mass-slideshow-remote-link");
        if (link) {
          link.href = massProjectionRemote.remoteUrl;
          link.textContent = massProjectionRemote.remoteUrl;
        }
        scheduleMassProjectionRemotePoll();
        void uploadMassProjectionDeck(massProjectionRemote.token);
        return massProjectionRemote;
      } catch (_e) {
        return null;
      }
    }

    async function uploadMassProjectionDeck(token) {
      if (!token || !massSlideshowState.webpptx || typeof massSlideshowState.webpptx.bytes !== "function") return;
      try {
        const bytes = massSlideshowState.webpptx.bytes();
        if (!bytes || !bytes.byteLength) return;
        await authorizedFetch("/api/projection/" + encodeURIComponent(token) + "/deck", {
          method: "PUT",
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          },
          body: bytes,
        });
      } catch (_e) {
        /* Phone can still open the server copy if generate left the PPTX on disk. */
      }
    }

    function pushMassProjectionState() {
      if (!massProjectionRemote.token || massProjectionRemote.applyingRemote || !massSlideshowState.open) return;
      const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
      const desired = massSlideshowState.pendingFullscreen;
      const body = {
        index: massSlideshowState.index || 0,
        total: Math.max(massSlideshowState.slides.length, massSlideshowState.expectedTotal || 0),
        blank: !!massSlideshowState.blank,
        preview_index: massSlideshowState.index || 0,
        fullscreen: desired == null ? on : !!desired,
        pptx_name: massSlideshowPptxName(),
        slide_names: massSlideshowSlideNames(),
      };
      authorizedFetch("/api/projection/" + encodeURIComponent(massProjectionRemote.token) + "/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    function applyMassProjectionCommand(cmd) {
      if (!cmd || !cmd.action) return;
      const action = String(cmd.action || "").toLowerCase();
      massProjectionRemote.applyingRemote = true;
      try {
        if (action === "next") massSlideshowGo(1);
        else if (action === "prev") massSlideshowGo(-1);
        else if (action === "jump" && cmd.index != null) massSlideshowJump(parseInt(cmd.index, 10) || 0);
        else if (action === "blank_on") setMassSlideshowBlank(true);
        else if (action === "blank_off") setMassSlideshowBlank(false);
        else if (action === "blank_toggle") setMassSlideshowBlank(!massSlideshowState.blank);
        else if (action === "fullscreen_on") setMassSlideshowFullscreen(true, { fromRemote: true });
        else if (action === "fullscreen_off") setMassSlideshowFullscreen(false, { fromRemote: true });
        else if (action === "fullscreen_toggle") {
          const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
          setMassSlideshowFullscreen(!on, { fromRemote: true });
        }
        else if (action === "go_live") {
          const idx = (typeof cmd.index === "number") ? cmd.index : null;
          setMassSlideshowBlank(false);
          if (idx != null && !Number.isNaN(idx)) massSlideshowJump(idx);
        } else if (action === "preview_next" || action === "preview_prev" || action === "preview_jump"
          || action === "freeze_on" || action === "freeze_off" || action === "freeze_toggle") {
          setMassSlideshowChromeVisible(true);
        }
      } finally {
        massProjectionRemote.applyingRemote = false;
      }
    }

    async function pollMassProjectionRemoteOnce() {
      if (!massProjectionRemote.token || !massSlideshowState.open) return;
      try {
        const res = await authorizedFetch(
          "/api/projection/" + encodeURIComponent(massProjectionRemote.token)
            + "/poll?after=" + encodeURIComponent(String(massProjectionRemote.lastSeq || 0))
        );
        if (res.status === 404) {
          massProjectionRemote.token = null;
          stopMassProjectionRemotePoll();
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const st = data && data.state;
        const cmds = (data && data.commands) || [];
        cmds.forEach((cmd) => {
          if (cmd && cmd.id) massProjectionRemote.lastSeq = Math.max(massProjectionRemote.lastSeq, cmd.id);
          applyMassProjectionCommand(cmd);
        });
        if (st && !massProjectionRemote.applyingRemote) {
          if (typeof st.index === "number" && st.index !== massSlideshowState.index && !st.frozen) {
            massProjectionRemote.applyingRemote = true;
            try { massSlideshowJump(st.index); }
            finally { massProjectionRemote.applyingRemote = false; }
          }
          if (typeof st.blank === "boolean" && st.blank !== massSlideshowState.blank) {
            massProjectionRemote.applyingRemote = true;
            try { setMassSlideshowBlank(st.blank); }
            finally { massProjectionRemote.applyingRemote = false; }
          }
          if (typeof st.fullscreen === "boolean") {
            const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
            const pending = massSlideshowState.pendingFullscreen;
            if (pending != null && pending === st.fullscreen) {
              // Waiting for presenter tap — keep gate open.
            } else if (st.fullscreen !== on) {
              massProjectionRemote.applyingRemote = true;
              try { setMassSlideshowFullscreen(st.fullscreen, { fromRemote: true }); }
              finally { massProjectionRemote.applyingRemote = false; }
            }
          }
        }
      } catch (_e) { /* ignore transient */ }
    }

    function scheduleMassProjectionRemotePoll() {
      stopMassProjectionRemotePoll();
      if (!massProjectionRemote.token || !massSlideshowState.open) return;
      massProjectionRemote.pollTimer = setTimeout(async () => {
        await pollMassProjectionRemoteOnce();
        scheduleMassProjectionRemotePoll();
      }, 700);
    }

    function resetMassProjectionRemote() {
      stopMassProjectionRemotePoll();
      massProjectionRemote.token = null;
      massProjectionRemote.remoteUrl = "";
      massProjectionRemote.qrUrl = "";
      massProjectionRemote.lastSeq = 0;
      massProjectionRemote.applyingRemote = false;
      setMassProjectionRemotePanel(false);
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
          if (massSlideshowState.open && !massSlideshowState.blank && !massProjectionRemote.panelOpen) {
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

    function hideMassSlideshowWebpptx() {
      const host = $("mass-slideshow-webpptx");
      if (host) host.hidden = true;
    }

    function destroyMassSlideshowWebpptx() {
      if (massSlideshowState.webpptx && massSlideshowState.webpptx.destroy) {
        try { massSlideshowState.webpptx.destroy(); } catch (_e) { /* ignore */ }
      }
      massSlideshowState.webpptx = null;
      hideMassSlideshowWebpptx();
    }

    function renderMassSlideshowSlide() {
      const img = $("mass-slideshow-img");
      const video = $("mass-slideshow-video");
      const text = $("mass-slideshow-text");
      const host = $("mass-slideshow-webpptx");
      const slides = massSlideshowState.slides;
      const total = slides.length;
      const idx = Math.max(0, Math.min(massSlideshowState.index, Math.max(0, total - 1)));
      massSlideshowState.index = idx;
      updateMassSlideshowCounter();
      const slide = slides[idx];
      pauseMassSlideshowVideo();
      if (!slide) {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        hideMassSlideshowWebpptx();
        if (text) {
          text.hidden = false;
          text.textContent = "No slides to present.";
        }
        return;
      }

      if (massSlideshowState.mode === "webpptx" && massSlideshowState.webpptx && slide.kind !== "video") {
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (video) { video.hidden = true; video.removeAttribute("src"); }
        if (text) { text.hidden = true; text.textContent = ""; }
        if (host) host.hidden = false;
        void massSlideshowState.webpptx.goTo(idx);
        return;
      }
      hideMassSlideshowWebpptx();

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
            pushMassProjectionState();
            return;
          }
          pushMassProjectionState();
        } catch (_e) {
          /* keep polling briefly; generation may still be running */
        }
        scheduleMassSlideshowPoll();
      }, 450);
    }

    function syncMassSlideshowFullscreenUi() {
      const btn = $("mass-slideshow-fullscreen");
      const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
      if (btn) {
        btn.textContent = on ? "Exit full" : "Fullscreen";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      if (on && massSlideshowState.pendingFullscreen === true) {
        hideMassSlideshowFullscreenGate();
      }
      if (!on && massSlideshowState.pendingFullscreen === false) {
        hideMassSlideshowFullscreenGate();
      }
      pushMassProjectionState();
    }

    function showMassSlideshowFullscreenGate(wantOn) {
      massSlideshowState.pendingFullscreen = !!wantOn;
      const gate = $("mass-slideshow-fs-gate");
      const title = $("mass-slideshow-fs-gate-title");
      const sub = $("mass-slideshow-fs-gate-sub");
      if (title) title.textContent = wantOn ? "Enter fullscreen?" : "Exit fullscreen?";
      if (sub) {
        sub.textContent = wantOn
          ? "Remote requested this — tap here on the presenter to confirm"
          : "Remote requested exit — tap here on the presenter to confirm";
      }
      if (gate) gate.hidden = false;
      setMassSlideshowChromeVisible(true);
      pushMassProjectionState();
    }

    function hideMassSlideshowFullscreenGate() {
      massSlideshowState.pendingFullscreen = null;
      const gate = $("mass-slideshow-fs-gate");
      if (gate) gate.hidden = true;
    }

    async function setMassSlideshowFullscreen(wantOn, opts) {
      const options = opts || {};
      const root = $("mass-slideshow");
      if (!root || !massSlideshowState.open) return;
      const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
      const fromRemote = !!options.fromRemote;
      const fromUserGesture = !!options.fromUserGesture;

      if (wantOn && on) {
        hideMassSlideshowFullscreenGate();
        syncMassSlideshowFullscreenUi();
        return;
      }
      if (!wantOn && !on) {
        hideMassSlideshowFullscreenGate();
        syncMassSlideshowFullscreenUi();
        return;
      }

      try {
        if (wantOn && !on) {
          if (root.requestFullscreen) await root.requestFullscreen();
        } else if (!wantOn && document.fullscreenElement) {
          if (document.exitFullscreen) await document.exitFullscreen();
        }
        const nowOn = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
        if (wantOn ? nowOn : !nowOn) {
          hideMassSlideshowFullscreenGate();
        } else if (fromRemote || !fromUserGesture) {
          showMassSlideshowFullscreenGate(wantOn);
        } else {
          setFlowStatus("Fullscreen was blocked by the browser.", "warn");
          hideMassSlideshowFullscreenGate();
        }
      } catch (_e) {
        if (fromRemote || !fromUserGesture) {
          showMassSlideshowFullscreenGate(wantOn);
        } else {
          setFlowStatus("Fullscreen was blocked by the browser.", "warn");
          hideMassSlideshowFullscreenGate();
        }
      }
      syncMassSlideshowFullscreenUi();
      setMassSlideshowChromeVisible(true);
    }

    async function toggleMassSlideshowFullscreen() {
      const on = !!(document.fullscreenElement && document.fullscreenElement.id === "mass-slideshow");
      await setMassSlideshowFullscreen(!on, { fromUserGesture: true });
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
      pushMassProjectionState();
    }

    function massSlideshowJump(index) {
      if (!massSlideshowState.open || !massSlideshowState.slides.length) return;
      massSlideshowState.index = index;
      setMassSlideshowBlank(false);
      renderMassSlideshowSlide();
      setMassSlideshowChromeVisible(true);
      pushMassProjectionState();
    }

    function setMassSlideshowBlank(on) {
      massSlideshowState.blank = !!on;
      const root = $("mass-slideshow");
      if (root) root.classList.toggle("is-blank", massSlideshowState.blank);
      if (!massSlideshowState.blank) setMassSlideshowChromeVisible(true);
      pushMassProjectionState();
    }

    function closeMassSlideshow() {
      const root = $("mass-slideshow");
      if (!root) return;
      rememberMassSlideshowSessionFromState();
      massSlideshowState.open = false;
      massSlideshowState.blank = false;
      massSlideshowState.complete = true;
      stopMassSlideshowPoll();
      hideMassSlideshowFullscreenGate();
      resetMassProjectionRemote();
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
      destroyMassSlideshowWebpptx();
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
      resetMassProjectionRemote();
      revokeMassSlideshowObjectUrls();
      destroyMassSlideshowWebpptx();
      massSlideshowState.mode = opts.mode === "text" ? "text" : opts.mode === "webpptx" ? "webpptx" : "image";
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

      if (massSlideshowState.mode === "webpptx") {
        const host = $("mass-slideshow-webpptx");
        if (!host || !window.WebPptx || !window.WebPptx.createProjector || !massSlideshowState.pptxUrl) {
          throw new Error("Browser projector is not available.");
        }
        host.hidden = false;
        host.innerHTML = "";
        massSlideshowState.webpptx = await window.WebPptx.createProjector(host, {
          url: massSlideshowState.pptxUrl,
          fetchImpl: typeof authorizedFetch === "function" ? authorizedFetch : fetch,
        });
        const count = massSlideshowState.webpptx.slideCount();
        massSlideshowState.slides = Array.from({ length: count }, (_, i) => ({ index: i + 1 }));
        massSlideshowState.expectedTotal = count;
        massSlideshowState.complete = true;
        applyMassSlideshowCues(opts.cues || []);
      } else

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
      syncMassSlideshowFullscreenUi();
      if (root.focus) root.focus();
      if (!massSlideshowState.complete) scheduleMassSlideshowPoll();
      rememberMassSlideshowSessionFromState();
    }

