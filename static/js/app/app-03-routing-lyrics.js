/* Verbum SPA part 3/9: app-03-routing-lyrics.js
 * Routing, settings chrome, lyrics composer
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 6972-10495
 */
    function applyRouteState(r, replaceOnly) {
      if (!isSettingsRoute(r)) lastNonSettingsRoute = r;
      syncAppHeaderOffset();
      document.querySelectorAll(".page").forEach((page) => {
        page.classList.toggle("active", pageIsActiveForRoute(page, r));
        page.classList.remove("page--leaving");
      });
      document.querySelectorAll(".app-sidebar .app-sidebar__link, .app-bottom-nav .nav-link, .app-more-sheet__link.nav-link, .app-mobile-menu__link.nav-link").forEach((link) => {
        link.classList.toggle("active", navLinkIsActive(link, r));
      });
      const moreBtn = $("app-bottom-nav-more");
      if (moreBtn) moreBtn.classList.toggle("active", isDrawerNavRoute(r));
      closeAppMoreSheet();
      if (typeof closeMobileMenu === "function") closeMobileMenu();
      syncSettingsLayout(r);
      const lyricsFloat = $("lyrics-editor-float");
      if (lyricsFloat) {
        const onLyrics = r === "/library/songs";
        lyricsFloat.hidden = !onLyrics;
        lyricsFloat.setAttribute("aria-hidden", onLyrics ? "false" : "true");
        if (onLyrics && typeof syncLyricsEditorFloatPresence === "function") {
          syncLyricsEditorFloatPresence(true);
        } else if (!onLyrics && typeof syncLyricsEditorFloatPresence === "function") {
          syncLyricsEditorFloatPresence(false);
        }
      }
      const rs = $("route-switcher");
      if (rs) rs.value = r;
      const rd = $("topbar-route-desc");
      if (rd) rd.textContent = routeMeta[r] || "";
      const bc = $("topbar-breadcrumb");
      if (bc) bc.innerHTML = formatRouteBreadcrumb(r);
      const accountBtn = $("account-menu-btn");
      if (accountBtn) accountBtn.classList.toggle("is-active", isSettingsRoute(r));
      const menuBtn = $("app-header-menu-btn");
      if (menuBtn) menuBtn.classList.toggle("is-active", isSettingsRoute(r) || isDrawerNavRoute(r) || ($("app-mobile-menu") && $("app-mobile-menu").classList.contains("is-open")));
      if (r === "/home") {
        refreshHomeMassCard();
        refreshHomeMission();
        refreshCatholicNews();
        refreshWydNews();
        updateMassBuilderDraftHomeUI();
        if (typeof consumeEmailDeepLinkIntent === "function") {
          consumeEmailDeepLinkIntent();
        }
      }
      if (r === "/notifications" && typeof updateLiturgicalCountdowns === "function") {
        updateLiturgicalCountdowns();
        if (typeof markAppNotificationsSeen === "function") markAppNotificationsSeen();
        if (typeof renderNotificationFeed === "function") renderNotificationFeed();
        if (typeof syncNotificationsAccordionHeader === "function") syncNotificationsAccordionHeader();
      }
      if (isSettingsRoute(r)) {
        syncHomeNewsSettingsUI();
        syncNavTabSettingsUI();
        if (typeof renderSettingsRadioList === "function") renderSettingsRadioList();
        syncChurchFieldsToSettings();
        refreshCommunity();
        if (typeof syncSettingsAccountPanel === "function") syncSettingsAccountPanel();
        if (r === "/settings/team" && typeof loadSettingsParishTeam === "function") loadSettingsParishTeam();
        if (window.__scrollToLiveRadio) {
          window.__scrollToLiveRadio = false;
          requestAnimationFrame(() => {
            const el = $("settings-live-radio");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      }
      if (r === "/superadmin") {
        if (typeof initSuperadminPage === "function") initSuperadminPage();
      }
      if (!replaceOnly && normalizeRoute(window.location.pathname) !== r) history.pushState({}, "", r);
      if (r === "/mass/builder") {
        syncChurchFieldsFromSettings();
        refreshCommunity();
        refreshMassMusicSongPlan({ force: true }).catch(() => {});
        const draft = readMassBuilderDraft();
        const afterBuilderReady = () => {
          setTimeout(() => {
            if (typeof window.maybePromptDeckThemeOnStartup === "function") {
              window.maybePromptDeckThemeOnStartup();
            }
            if (typeof consumeEmailDeepLinkIntent === "function") {
              consumeEmailDeepLinkIntent();
            }
          }, 0);
        };
        if (massDraftSkipRestore) {
          massDraftSkipRestore = false;
          ensureMassBuilderDefaultDate({ force: true });
          ensureCollectionDefaultDate({ force: true });
          const massDate = $("mass-date") && $("mass-date").value;
          if (massDate && (!flowPreviewData || flowPreviewData.__previewDate !== massDate)) {
            loadFlowData(true);
          }
          afterBuilderReady();
        } else if (draft) {
          restoreMassBuilderDraft(draft).catch(() => {}).finally(afterBuilderReady);
        } else {
          ensureMassBuilderDefaultDate();
          ensureCollectionDefaultDate();
          const massDate = $("mass-date") && $("mass-date").value;
          if (massDate && (!flowPreviewData || flowPreviewData.__previewDate !== massDate)) {
            loadFlowData(true);
          }
          afterBuilderReady();
        }
      }
      syncFlowDockVisibility(getActiveFlowTab());
      if (r === "/media/posters") {
        syncPosterFromMassBuilder();
        refreshSavedPosters();
      }
      if (r === "/library/songs") {
        renderComposerRecent();
        if (composerPendingFromMassSearch) {
          loadSongCatalog().then(() => {
            applyComposerPendingFromMassSearch();
          }).catch(() => {
            applyComposerPendingFromMassSearch();
          });
          return;
        }
        if (composerSuppressPreload) {
          composerSuppressPreload = false;
          return;
        }
        const params = new URLSearchParams(window.location.search);
        const sec = (params.get("section") || "").trim().toLowerCase();
        const sid = (params.get("song") || params.get("id") || "").trim();
        if (sec && sid && ["entrance", "offertory", "communion", "recessional", "meditation"].includes(sec)) {
          loadSongCatalog().then(() => {
            loadSongIntoEditor(sec, sid, { clearSearch: false }).catch(() => {
              preloadComposerFromLatestSong().catch(() => resetComposerEditorEmpty());
            });
          }).catch(() => {});
          history.replaceState({}, "", r);
        } else {
          preloadComposerFromLatestSong().catch(() => resetComposerEditorEmpty());
        }
      }
      if (r === "/library/collections") {
        loadSongCatalog();
        renderCollectionsRecent();
      }
      if (r === "/mass/calendar") {
        loadCalendarMonth();
      }
      if (r === "/radio") {
        syncLiveRadioUi();
        renderRadioStationList($("radio-page-list"));
        refreshSavedMedia();
      }
    }

    function showRoute(route, replaceOnly = false) {
      if (typeof closeHeaderMenus === "function") closeHeaderMenus();
      if (typeof closeMobileMenu === "function") closeMobileMenu();
      let r = normalizeRoute(route);
      if (r === "/notifications" && !isMobileChromeLayout()) r = "/home";
      if (isSuperadminRoute(r) && !canAccessSuperadminRoute()) {
        if (!churchMembershipState.is_superadmin) {
          notify("Superadmin access required.", "error");
        }
        r = "/home";
      }
      const from = normalizeRoute(currentRoute());
      if (from === "/mass/builder" && r !== "/mass/builder") {
        autoSaveMassBuilderDraftOnLeave();
      }
      if (shouldBlockHiddenNavRoute(r)) {
        notify("That section is hidden. Turn it back on in Settings → Appearance.", "info");
        r = "/home";
      }
      const leaving = document.querySelector(".page.active");
      const next = Array.from(document.querySelectorAll(".page")).find((p) => pageIsActiveForRoute(p, r));
      const skipMotion = typeof shouldSkipStartupPopups === "function" && shouldSkipStartupPopups();
      const motionOk = !skipMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (motionOk && leaving && next && leaving !== next) {
        leaving.classList.add("page--leaving");
        leaving.classList.remove("active");
        setTimeout(() => {
          leaving.classList.remove("page--leaving");
          applyRouteState(r, replaceOnly);
        }, 130);
        return;
      }
      applyRouteState(r, replaceOnly);
    }

    function bindSpaRouteLink(link) {
      if (!link || link.dataset.routeBound === "1") return;
      link.dataset.routeBound = "1";
      link.addEventListener("click", (event) => {
        const route = link.dataset.route;
        if (!route) return;
        event.preventDefault();
        event.stopPropagation();
        showRoute(route);
      });
    }

    document.querySelectorAll(".app-sidebar__link[data-route], .app-bottom-nav .nav-link, .app-more-sheet__link.nav-link, .app-mobile-menu__link[data-route], .settings-sidebar-link, .settings-modal-tab, .brand-block[data-route], #account-menu-panel .nav-link, .home-card-head__action[data-route], .home-mass-cta[data-route], .home-mass-snippet[data-route]").forEach(bindSpaRouteLink);

    var appSidebar = document.getElementById("app-sidebar");
    if (appSidebar && appSidebar.dataset.spaBound !== "1") {
      appSidebar.dataset.spaBound = "1";
      appSidebar.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-route]");
        if (!link || !appSidebar.contains(link)) return;
        event.preventDefault();
        showRoute(link.dataset.route);
      });
    }

    document.addEventListener("click", (event) => {
      const link = event.target.closest(".app-membership-banner a[data-route]");
      if (!link) return;
      event.preventDefault();
      showRoute(link.dataset.route);
    });
    var routeSwitcherEl = $("route-switcher");
    if (routeSwitcherEl) routeSwitcherEl.addEventListener("change", (event) => showRoute(event.target.value));
    window.addEventListener("popstate", () => showRoute(currentRoute(), true));

    (function initSettingsModalChrome() {
      const overlay = document.getElementById("settings-page");
      const closeBtn = document.getElementById("settings-modal-close");
      if (closeBtn) closeBtn.addEventListener("click", closeSettingsModal);
      if (overlay) {
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) closeSettingsModal();
        });
      }
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isSettingsRoute(currentRoute())) closeSettingsModal();
      });
    })();

    var lyricBlocks = [];
    var draggedLyricId = null;
    var lyricsSyncLock = false;
    var lyricsRawSnapshot = "";
    var lyricsAnalyzeInFlight = false;
    var composerLoadedSong = null;
    var composerCatalogLyrics = "";
    var composerParishVersion = false;
    var composerUndoStack = [];
    var composerUndoApplying = false;
    var composerUndoBurstTimer = 0;
    var composerUndoLabelTimer = 0;
    var composerUndoHideTimer = 0;
    var COMPOSER_UNDO_MAX = 40;
    var COMPOSER_UNDO_BURST_MS = 700;
    var COMPOSER_UNDO_LABEL_MS = 2600;
    var COMPOSER_UNDO_EXIT_MS = 120;
    var typeLabels = {
      verse: "Verse",
      chorus: "Chorus",
      "pre-chorus": "Pre-Chorus",
      refrain: "Refrain",
      outro: "Outro",
      bridge: "Bridge",
      response: "Response",
    };
    var LYRIC_BLOCK_DRAG_SVG =
      '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">' +
      '<circle cx="2.5" cy="2" r="1.1"/><circle cx="7.5" cy="2" r="1.1"/>' +
      '<circle cx="2.5" cy="7" r="1.1"/><circle cx="7.5" cy="7" r="1.1"/>' +
      '<circle cx="2.5" cy="12" r="1.1"/><circle cx="7.5" cy="12" r="1.1"/></svg>';
    var LYRIC_BLOCK_ICON_UP =
      '<svg class="lyric-block__btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
    var LYRIC_BLOCK_ICON_DOWN =
      '<svg class="lyric-block__btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    var LYRIC_BLOCK_ICON_DUPLICATE =
      '<svg class="lyric-block__btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var LYRIC_BLOCK_ICON_DELETE =
      '<svg class="lyric-block__btn-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
    var LINES_PER_SLIDE = 6;
    var HYMN_DUAL_SOLO_PARAGRAPH_THRESHOLD = 6;

    function cloneComposerLyricBlocks(blocks) {
      return (blocks || []).map((block) => Object.assign({}, block));
    }

    function captureComposerEditorSnapshot() {
      return {
        lyrics: String(($("lyrics-input") && $("lyrics-input").value) || ""),
        blocks: cloneComposerLyricBlocks(lyricBlocks),
        rawSnapshot: String(lyricsRawSnapshot || ""),
        title: String(($("lyrics-save-title") && $("lyrics-save-title").value) || ""),
        author: String(($("lyrics-save-author") && $("lyrics-save-author").value) || ""),
        language: String(($("lyrics-save-language") && $("lyrics-save-language").value) || ""),
        section: String(($("lyrics-save-section") && $("lyrics-save-section").value) || ""),
        moods: Array.isArray(composerGospelMoods) ? composerGospelMoods.slice() : [],
      };
    }

    function composerEditorSnapshotsEqual(a, b) {
      if (!a || !b) return false;
      return (
        a.lyrics === b.lyrics &&
        a.title === b.title &&
        a.author === b.author &&
        a.language === b.language &&
        a.section === b.section &&
        JSON.stringify(a.blocks) === JSON.stringify(b.blocks) &&
        JSON.stringify(a.moods) === JSON.stringify(b.moods)
      );
    }

    function composerUndoPrefersReducedMotion() {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function finishComposerUndoHide(btn) {
      composerUndoHideTimer = 0;
      if (!btn) return;
      btn.hidden = true;
      btn.disabled = true;
      btn.classList.remove("is-visible", "is-hiding", "is-labeled");
    }

    function startComposerUndoLabel(btn) {
      btn.classList.add("is-labeled");
      if (composerUndoLabelTimer) window.clearTimeout(composerUndoLabelTimer);
      composerUndoLabelTimer = window.setTimeout(() => {
        composerUndoLabelTimer = 0;
        btn.classList.remove("is-labeled");
      }, COMPOSER_UNDO_LABEL_MS);
    }

    function refreshComposerUndoButton() {
      const btn = $("btn-undo-lyrics");
      if (!btn) return;
      const canUndo = composerUndoStack.length > 0;
      btn.setAttribute("aria-disabled", canUndo ? "false" : "true");

      if (canUndo) {
        if (composerUndoHideTimer) {
          window.clearTimeout(composerUndoHideTimer);
          composerUndoHideTimer = 0;
        }
        const wasHidden = !!btn.hidden;
        const wasHiding = btn.classList.contains("is-hiding");
        btn.disabled = false;
        btn.hidden = false;
        btn.classList.remove("is-hiding");
        if (wasHiding) {
          btn.classList.add("is-visible");
          return;
        }
        if (!wasHidden && btn.classList.contains("is-visible")) return;
        btn.classList.remove("is-visible");
        if (composerUndoPrefersReducedMotion()) {
          btn.classList.add("is-visible");
          startComposerUndoLabel(btn);
          return;
        }
        void btn.offsetWidth;
        window.requestAnimationFrame(() => {
          if ($("btn-undo-lyrics") !== btn || btn.hidden || btn.classList.contains("is-hiding")) return;
          btn.classList.add("is-visible");
        });
        startComposerUndoLabel(btn);
        return;
      }

      if (composerUndoLabelTimer) {
        window.clearTimeout(composerUndoLabelTimer);
        composerUndoLabelTimer = 0;
      }
      btn.classList.remove("is-labeled");
      if (btn.hidden) {
        btn.disabled = true;
        btn.classList.remove("is-visible", "is-hiding");
        return;
      }
      if (btn.classList.contains("is-hiding")) return;
      btn.disabled = true;
      if (composerUndoPrefersReducedMotion() || !btn.classList.contains("is-visible")) {
        finishComposerUndoHide(btn);
        return;
      }
      btn.classList.remove("is-visible");
      btn.classList.add("is-hiding");
      composerUndoHideTimer = window.setTimeout(() => finishComposerUndoHide(btn), COMPOSER_UNDO_EXIT_MS);
    }

    function clearComposerUndoStack() {
      composerUndoStack = [];
      if (composerUndoBurstTimer) {
        window.clearTimeout(composerUndoBurstTimer);
        composerUndoBurstTimer = 0;
      }
      refreshComposerUndoButton();
    }

    function pushComposerUndoCheckpoint() {
      if (composerUndoApplying) return;
      const snap = captureComposerEditorSnapshot();
      const last = composerUndoStack[composerUndoStack.length - 1];
      if (last && composerEditorSnapshotsEqual(last, snap)) return;
      composerUndoStack.push(snap);
      if (composerUndoStack.length > COMPOSER_UNDO_MAX) composerUndoStack.shift();
      refreshComposerUndoButton();
    }

    function beginComposerUndoBurst() {
      if (composerUndoApplying) return;
      if (composerUndoBurstTimer) {
        window.clearTimeout(composerUndoBurstTimer);
        composerUndoBurstTimer = window.setTimeout(() => {
          composerUndoBurstTimer = 0;
        }, COMPOSER_UNDO_BURST_MS);
        return;
      }
      pushComposerUndoCheckpoint();
      composerUndoBurstTimer = window.setTimeout(() => {
        composerUndoBurstTimer = 0;
      }, COMPOSER_UNDO_BURST_MS);
    }

    function applyComposerEditorSnapshot(snap) {
      if (!snap) return;
      composerUndoApplying = true;
      try {
        lyricBlocks = cloneComposerLyricBlocks(snap.blocks);
        lyricsRawSnapshot = String(snap.rawSnapshot || "");
        if ($("lyrics-input")) $("lyrics-input").value = snap.lyrics || "";
        if ($("lyrics-save-title")) $("lyrics-save-title").value = snap.title || "";
        if ($("lyrics-save-author")) $("lyrics-save-author").value = snap.author || "";
        if (typeof setComposerSongLanguage === "function") setComposerSongLanguage(snap.language || "");
        else if ($("lyrics-save-language")) $("lyrics-save-language").value = snap.language || "";
        if (typeof setComposerSongSection === "function") setComposerSongSection(snap.section || "");
        else if ($("lyrics-save-section")) $("lyrics-save-section").value = snap.section || "";
        composerGospelMoods = Array.isArray(snap.moods) ? snap.moods.slice() : [];
        if (typeof autoResizeLyricsMainInput === "function") autoResizeLyricsMainInput();
        renderLyrics({ writeBack: false });
        if (typeof updateLyricsWordStats === "function") updateLyricsWordStats();
        if (typeof markLyricsRawDirty === "function") markLyricsRawDirty();
        if (typeof updateParishLyricsControls === "function") updateParishLyricsControls();
        if (typeof updateLyricsComposerDetailsPreview === "function") updateLyricsComposerDetailsPreview();
      } finally {
        composerUndoApplying = false;
      }
    }

    function undoComposerLastEdit() {
      if (!composerUndoStack.length) {
        setLyricsStatus("Nothing to undo.", "");
        return;
      }
      if (composerUndoBurstTimer) {
        window.clearTimeout(composerUndoBurstTimer);
        composerUndoBurstTimer = 0;
      }
      const snap = composerUndoStack.pop();
      applyComposerEditorSnapshot(snap);
      refreshComposerUndoButton();
      setLyricsStatus("Last edit undone.", "ok");
    }

    function countBlockLines(text) {
      return (text || "").trim().split(/\n/).filter((ln) => ln.trim()).length;
    }

    function estimateSlidesForBlocks(blocks) {
      return (blocks || []).reduce((sum, block) => {
        const n = countBlockLines(block.text);
        return sum + (n ? Math.ceil(n / LINES_PER_SLIDE) : 0);
      }, 0);
    }

    function autoResizeLyricTextarea(ta) {
      if (!ta) return;
      // Collapse first so scrollHeight reflects wrapped content width.
      ta.style.height = "0px";
      const cs = getComputedStyle(ta);
      const line = Math.ceil(parseFloat(cs.lineHeight) || 22);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const minH = line + padY;
      ta.style.height = Math.max(minH, ta.scrollHeight) + "px";
    }

    function formatSongTitleCase(raw) {
      const text = String(raw || "").trim().replace(/\s+/g, " ");
      if (!text) return "";
      return text.split(" ").map((word) => {
        if (!word) return word;
        const lower = word.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }).join(" ");
    }

    function capitalizeFirstAlpha(token) {
      const s = String(token || "");
      if (!s) return s;
      for (let i = 0; i < s.length; i += 1) {
        const ch = s.charAt(i);
        if (/[a-zA-Z\u00C0-\u024F]/.test(ch)) {
          return s.slice(0, i) + ch.toUpperCase() + s.slice(i + 1);
        }
      }
      return s;
    }

    /**
     * Premium lyric casing — two steps so nothing is left out:
     * 1) lowercase all text
     * 2) uppercase the first letter of every word
     */
    function formatLyricsFirstLetters(raw) {
      let text = String(raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!text.trim()) return text.trim();
      text = text.toLowerCase();
      return text.split("\n").map((line) => {
        if (!line.trim()) return "";
        const leadMatch = line.match(/^[ \t]*/);
        const lead = leadMatch ? leadMatch[0] : "";
        const body = line.slice(lead.length);
        return lead + body.split(" ").map(capitalizeFirstAlpha).join(" ");
      }).join("\n").trim();
    }

    function applyLyricsFirstLettersToEditor() {
      if (lyricBlocks.length) {
        flushLyricBlocksFromDom();
        lyricBlocks = lyricBlocks.map((block) => Object.assign({}, block, {
          text: formatLyricsFirstLetters(block.text || ""),
        }));
        renderLyrics({ writeBack: true });
        return serializedLyrics();
      }
      const input = $("lyrics-input");
      if (!input) return "";
      const formatted = formatLyricsFirstLetters(input.value);
      input.value = formatted;
      return formatted;
    }

    function normalizeSongTitleInput(inputEl) {
      if (!inputEl) return "";
      const formatted = formatSongTitleCase(inputEl.value);
      if (formatted !== inputEl.value) inputEl.value = formatted;
      return formatted;
    }

    function autoResizeAllLyricTextareas() {
      document.querySelectorAll(".lyric-block__ta").forEach(autoResizeLyricTextarea);
    }

    function pruneLyricBlockCounters(scope) {
      const wraps = scope && scope.classList && scope.classList.contains("lyric-block__ta-wrap")
        ? [scope]
        : Array.from((scope || document).querySelectorAll(".lyric-block__ta-wrap"));
      wraps.forEach((wrap) => {
        wrap.querySelectorAll(".input-char-count").forEach((node) => node.remove());
        wrap.querySelectorAll(":scope > .lyric-block__char-count").forEach((node) => node.remove());
        const foot = wrap.querySelector(".lyric-block__ta-foot");
        if (!foot) return;
        foot.querySelectorAll(".lyric-block__char-count").forEach((node, index) => {
          if (index > 0) node.remove();
        });
      });
    }

    function syncLyricBlockCharCount(ta) {
      const wrap = ta && ta.closest(".lyric-block__ta-wrap");
      if (!wrap) return;
      pruneLyricBlockCounters(wrap);
      const foot = wrap.querySelector(".lyric-block__ta-foot");
      let counter = foot && foot.querySelector(":scope > .lyric-block__char-count");
      if (foot && !counter) {
        counter = document.createElement("span");
        counter.className = "lyric-block__char-count";
        counter.setAttribute("aria-live", "polite");
        foot.appendChild(counter);
      }
      if (counter) counter.textContent = ((ta && ta.value) || "").length + "/4000";
    }

    function syncAllLyricBlockCharCounts(scope) {
      const root = scope || document;
      root.querySelectorAll(".lyric-block__ta").forEach(syncLyricBlockCharCount);
    }

    function autoResizeLyricsMainInput() {
      const ta = $("lyrics-input");
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = Math.max(160, ta.scrollHeight) + "px";
    }

    function updateLyricsStructuredMeta() {
      const el = $("lyrics-structured-meta");
      if (!el) return;
      const slides = estimateSlidesForBlocks(lyricBlocks);
      const n = lyricBlocks.length;
      el.textContent = n + " block" + (n === 1 ? "" : "s") + " · ~" + slides + " slide" + (slides === 1 ? "" : "s");
    }

    function updateLyricsWordStats() {
      const el = $("lyrics-word-stats");
      const input = $("lyrics-input");
      if (!el || !input) return;
      const text = input.value || "";
      const words = (text.match(/\b[\w']+\b/g) || []).length;
      const lines = text.trim() ? text.split(/\n/).length : 0;
      el.textContent = words + " word" + (words === 1 ? "" : "s") + " · " + lines + " line" + (lines === 1 ? "" : "s");
      const counter = $("lyrics-input-char-count");
      if (counter) {
        const max = parseInt(input.getAttribute("maxlength") || input.getAttribute("data-max-length") || "50000", 10) || 50000;
        const len = text.length;
        counter.textContent = len + " / " + max;
        counter.style.color = len >= max ? "var(--warn)" : "";
      }
    }

    function scrollToLyricBlock(blockId, opts) {
      const id = String(blockId || "");
      if (!id) return;
      const focusEditor = !opts || opts.focus !== false;
      requestAnimationFrame(() => {
        const card = document.querySelector('#lyrics-block-list .lyric-block[data-id="' + id + '"]');
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        if (!focusEditor) return;
        const ta = card.querySelector('[data-action="text"]');
        if (ta) {
          try { ta.focus({ preventScroll: true }); } catch (_e) { ta.focus(); }
        }
      });
    }

    function addLyricBlockOfType(type) {
      pushComposerUndoCheckpoint();
      const n = lyricBlocks.filter((b) => b.type === type).length + 1;
      const label = typeLabels[type] || "Section";
      // Chorus / Refrain stay unnumbered. Verses and other types may number.
      const title = (type === "chorus" || type === "refrain") ? label : label + " " + n;
      const id = crypto.randomUUID();
      lyricBlocks.push({
        id,
        type: type,
        title,
        text: "",
        collapsed: false,
      });
      renderLyrics();
      scrollToLyricBlock(id);
    }

    function classifyLyricBlock(header, text, index) {
      const source = (header + " " + text).toLowerCase();
      if (/pre[- ]?chorus/.test(source)) return "pre-chorus";
      if (/refrain/.test(source)) return "refrain";
      if (/chorus/.test(source)) return "chorus";
      if (/bridge|middle/.test(source)) return "bridge";
      if (/response|responsorial|lord, hear|amen/.test(source)) return "response";
      if (/outro|ending|finale/.test(source)) return "outro";
      return "verse";
    }

    var LYRIC_STRUCTURE_LABEL_NAMES =
      "pre[- ]?chorus|post[- ]?chorus|pre[- ]?verse|post[- ]?verse|middle[- ]?8|" +
      "refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp|outro|" +
      "interlude|instrumental|ending|finale|hook|breakdown|spoken|solo|" +
      "ad[- ]?lib|tag|turnaround|chant";
    var LYRIC_STRUCTURE_HEADER_RE = new RegExp(
      "^\\s*[\\[(]?\\s*(" + LYRIC_STRUCTURE_LABEL_NAMES + ")(\\s*[\\w\\d.-]*)?\\s*[\\])]?\\s*[:.)-]?\\s*$",
      "i"
    );
    // Header + optional number only (not arbitrary words): "Verse 1", "Chorus", "[Refrain]"
    var LYRIC_STRUCTURE_HEADER_WITH_NUM =
      "(?:\\[|\\()?\\s*(?:" + LYRIC_STRUCTURE_LABEL_NAMES + ")(?:[ \\t]+\\d+)?\\s*(?:\\]|\\))?\\s*[:.)-]?";

    /** Insert blank lines before Verse/Chorus/… labels when lyrics were flattened into one paragraph. */
    function ensureLyricSectionBreaks(lyrics) {
      let raw = String(lyrics || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!raw.trim()) return "";
      // Mid-line header: "…mag-alab Verse 2 Buksan…" → start header on a new line
      raw = raw.replace(
        new RegExp(
          "(\\S)[ \\t]+(?=(" + LYRIC_STRUCTURE_HEADER_WITH_NUM + ")(?:[ \\t]+(?=[A-Za-zÀ-ÿ\"'“‘])|$))",
          "gi"
        ),
        "$1\n"
      );
      // Header sharing a line with lyrics: "Chorus Sing a new…" / "Verse 1 Hello…"
      // Require following text to start with a letter so "Verse 1" alone stays intact.
      raw = raw.replace(
        new RegExp(
          "(^|\\n)([ \\t]*" + LYRIC_STRUCTURE_HEADER_WITH_NUM + ")[ \\t]+(?=[A-Za-zÀ-ÿ\"'“‘])",
          "gi"
        ),
        "$1$2\n"
      );
      const out = [];
      raw.split("\n").forEach((line) => {
        const stripped = String(line || "").trim();
        if (stripped && out.length && out[out.length - 1] !== "" && LYRIC_STRUCTURE_HEADER_RE.test(stripped)) {
          out.push("");
        }
        out.push(String(line || "").replace(/[ \t]+$/g, ""));
      });
      return out.join("\n").trim();
    }

    function parseLyricsInputToBlocks(raw) {
      const spaced = ensureLyricSectionBreaks(raw);
      const chunks = spaced.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
      return chunks.map((chunk, index) => {
        const lines = chunk.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const first = lines[0] || "";
        const headerMatch = LYRIC_STRUCTURE_HEADER_RE.test(first);
        const title = headerMatch ? first : "Verse " + (index + 1);
        const text = headerMatch ? lines.slice(1).join("\n") : lines.join("\n");
        const type = classifyLyricBlock(title, text, index);
        return { id: crypto.randomUUID(), type, title: title || typeLabels[type], text, collapsed: false };
      });
    }

    function syncInputPanelToStructuredEditor(options) {
      const opts = options || {};
      const quiet = opts.quiet;
      const input = $("lyrics-input");
      const raw = (input && input.value.trim()) || "";
      if (!raw) {
        if (!quiet) {
          setLyricsAnalyzeHint("Add lyrics in the editor below, or upload a .txt file.", "error");
        }
        return false;
      }
      const spaced = ensureLyricSectionBreaks(raw);
      if (input && spaced !== raw) {
        input.value = spaced;
        if (typeof autoResizeLyricsMainInput === "function") autoResizeLyricsMainInput();
        if (typeof updateLyricsWordStats === "function") updateLyricsWordStats();
      }
      lyricBlocks = parseLyricsInputToBlocks(spaced);
      renderLyrics({ writeBack: opts.writeBack === true });
      if (!quiet) {
        const n = lyricBlocks.length;
        setLyricsAnalyzeHint(
          n + " section" + (n === 1 ? "" : "s") + " detected — refine blocks in the Structured Editor.",
          "ok"
        );
      }
      return true;
    }

    function setLyricsAnalyzeOverlay(mode) {
      const panel = document.querySelector(".lyrics-structured-panel");
      const sticky = $("lyrics-analyze-sticky-cta");
      const stickyIdle = $("lyrics-analyze-sticky-idle");
      const stickyLoading = $("lyrics-analyze-sticky-loading");
      const scrim = $("lyrics-structured-scrim");
      const overlayBtn = $("btn-analyze-lyrics-overlay");
      const headerBtn = $("btn-analyze-lyrics");
      if (!panel || !sticky) return;
      const showOverlay = mode === "idle" || mode === "analyzing";
      panel.classList.toggle("is-lyrics-overlay-open", showOverlay);
      sticky.hidden = !showOverlay;
      if (scrim) scrim.hidden = !showOverlay;
      if (stickyIdle) stickyIdle.hidden = mode !== "idle";
      if (stickyLoading) stickyLoading.hidden = mode !== "analyzing";
      if (overlayBtn) overlayBtn.disabled = mode === "analyzing";
      if (headerBtn) {
        headerBtn.disabled = mode === "analyzing";
        headerBtn.classList.toggle("is-analyzing", mode === "analyzing");
      }
    }

    var LYRICS_ANALYZE_TOTAL_MS = 2000;

    function setLyricsAnalyzeProgress(message) {
      const el = $("lyrics-analyze-overlay-progress");
      if (!el) return Promise.resolve();
      if (!message) {
        el.textContent = "";
        el.classList.remove("is-fading");
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        el.classList.add("is-fading");
        setTimeout(() => {
          el.textContent = message;
          el.classList.remove("is-fading");
          setTimeout(resolve, 90);
        }, 90);
      });
    }

    async function runLyricsAnalyzeProgress(deadlineMs, onMidpoint) {
      const steps = [
        "Reading lyrics…",
        "Finding section breaks…",
        "Grouping verses & choruses…",
        "Building blocks…",
        "Almost done…",
      ];
      let midpointDone = false;
      for (let i = 0; i < steps.length; i += 1) {
        await setLyricsAnalyzeProgress(steps[i]);
        if (!midpointDone && i >= 1 && typeof onMidpoint === "function") {
          onMidpoint();
          midpointDone = true;
        }
        if (i < steps.length - 1) {
          const remain = deadlineMs - Date.now();
          const stepsLeft = steps.length - i - 1;
          const wait = Math.max(50, Math.floor(remain / (stepsLeft + 1)));
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
      if (!midpointDone && typeof onMidpoint === "function") onMidpoint();
    }

    async function analyzeLyrics() {
      if (lyricsAnalyzeInFlight) return;
      const raw = ($("lyrics-input") && $("lyrics-input").value.trim()) || "";
      if (!raw) {
        setLyricsAnalyzeHint("Add lyrics in the raw editor first, then analyze.", "error");
        setLyricsAnalyzeOverlay("idle");
        return;
      }
      pushComposerUndoCheckpoint();
      lyricsAnalyzeInFlight = true;
      setLyricsAnalyzeOverlay("analyzing");
      setLyricsAnalyzeHint("", "");
      const deadline = Date.now() + LYRICS_ANALYZE_TOTAL_MS;
      let parsed = false;
      try {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await runLyricsAnalyzeProgress(deadline, () => {
          if (parsed) return;
          syncInputPanelToStructuredEditor({ quiet: false, writeBack: true });
          tidyLyricsInEditor({ quiet: true });
          commitLyricsAnalyzedSnapshot(false);
          parsed = true;
        });
        if (!parsed) {
          syncInputPanelToStructuredEditor({ quiet: false, writeBack: true });
          tidyLyricsInEditor({ quiet: true });
          commitLyricsAnalyzedSnapshot(false);
        }
        await setLyricsAnalyzeProgress("Done!");
        const remain = deadline - Date.now();
        if (remain > 0) await new Promise((resolve) => setTimeout(resolve, remain));
      } finally {
        lyricsAnalyzeInFlight = false;
        setLyricsAnalyzeOverlay("ready");
      }
    }
    function markLyricsRawDirty() {
      if (lyricsSyncLock || lyricsAnalyzeInFlight) return;
      const raw = ($("lyrics-input") && $("lyrics-input").value) || "";
      if (!raw.trim()) {
        lyricsRawSnapshot = "";
        lyricBlocks = [];
        renderLyrics({ writeBack: false });
        setLyricsAnalyzeOverlay("idle");
        return;
      }
      if (raw === lyricsRawSnapshot && lyricBlocks.length) {
        setLyricsAnalyzeOverlay("ready");
        return;
      }
      setLyricsAnalyzeOverlay("idle");
    }

    function commitLyricsAnalyzedSnapshot(updateOverlay) {
      lyricsRawSnapshot = ($("lyrics-input") && $("lyrics-input").value) || "";
      if (updateOverlay !== false) setLyricsAnalyzeOverlay("ready");
    }

    function resetComposerEditorEmpty(opts) {
      const preserveUndo = !!(opts && opts.preserveUndo);
      lyricBlocks = [];
      lyricsRawSnapshot = "";
      if ($("lyrics-input")) $("lyrics-input").value = "";
      if ($("lyrics-save-title")) $("lyrics-save-title").value = "";
      if ($("lyrics-save-author")) $("lyrics-save-author").value = "";
      composerLoadedSong = null;
      composerCatalogLyrics = "";
      composerParishVersion = false;
      composerSongMedia = { audio: null, video: null, preview: null };
      if (massSectionAudioPlayingSlot === COMPOSER_SONG_MEDIA_SLOT) stopMassSectionAudio();
      renderComposerSongMediaFields();
      setComposerSongLanguage("");
      setComposerSongSection("");
      composerGospelMoods = [];
      if (typeof syncComposerAccordionMoodsFromState === "function") syncComposerAccordionMoodsFromState();
      autoResizeLyricsMainInput();
      renderLyrics({ writeBack: false });
      setLyricsAnalyzeHint("", "");
      setLyricsAnalyzeOverlay("idle");
      updateLyricsWordStats();
      if (typeof updateLyricsComposerDetailsPreview === "function") updateLyricsComposerDetailsPreview();
      if (typeof updateParishLyricsControls === "function") updateParishLyricsControls();
      if (!preserveUndo) clearComposerUndoStack();
    }

    function composerEditorHasContentToClear() {
      const hasRaw = !!(($("lyrics-input") && $("lyrics-input").value.trim()) || "");
      const hasBlocks = !!(lyricBlocks && lyricBlocks.length);
      const hasTitle = !!(($("lyrics-save-title") && $("lyrics-save-title").value.trim()) || "");
      const hasAuthor = !!(($("lyrics-save-author") && $("lyrics-save-author").value.trim()) || "");
      const hasLanguage = !!(($("lyrics-save-language") && $("lyrics-save-language").value) || "");
      const hasSection = !!(($("lyrics-save-section") && $("lyrics-save-section").value) || "");
      const hasMoods = Array.isArray(composerGospelMoods) && composerGospelMoods.length > 0;
      const hasMedia = !!(
        (composerSongMedia && (composerSongMedia.audio || composerSongMedia.video || composerSongMedia.preview)) ||
        false
      );
      return hasRaw || hasBlocks || hasTitle || hasAuthor || hasLanguage || hasSection || hasMoods || hasMedia;
    }

    function startComposerNewSong() {
      openComposerNewSongModal();
    }

    var composerNewSongSearchDebounce = 0;
    var composerNewSongPickedCatalog = null;

    function readComposerNewSongMoodChecks() {
      return Array.from(document.querySelectorAll("[data-composer-new-mood-opt]:checked")).map((el) => el.value);
    }

    function setComposerNewSongMoodChecks(moods) {
      const picked = new Set(Array.isArray(moods) ? moods : []);
      document.querySelectorAll("[data-composer-new-mood-opt]").forEach((el) => {
        el.checked = picked.has(el.value);
      });
    }

    function setComposerNewSongError(message) {
      const el = $("composer-new-song-error");
      if (!el) return;
      const text = String(message || "").trim();
      el.hidden = !text;
      el.textContent = text;
    }

    function setComposerNewSongSearchHint(message, kind) {
      const el = $("composer-new-song-search-hint");
      if (!el) return;
      const text = String(message || "").trim();
      el.hidden = !text;
      el.textContent = text;
      el.className = "muted composer-new-song-search-hint" + (kind ? " " + kind : "");
    }

    function clearComposerNewSongFieldAttention() {
      document.querySelectorAll("#composer-new-song-modal .composer-new-song-field.is-attention").forEach((el) => {
        el.classList.remove("is-attention");
      });
    }

    function setComposerNewSongFieldAttention(fieldKey, on) {
      const map = {
        title: "composer-new-song-title-field",
        titleSearch: "composer-new-song-title-search-field",
        language: "composer-new-song-language-field",
        section: "composer-new-song-section-field",
        moods: "composer-new-song-moods-field",
        lyrics: "composer-new-song-lyrics-field",
      };
      const el = map[fieldKey] && $(map[fieldKey]);
      if (el) el.classList.toggle("is-attention", !!on);
    }

    function getComposerNewSongTitle() {
      const title = (($("composer-new-song-title") && $("composer-new-song-title").value) || "").trim();
      if (title) return title;
      const search = trimSongCatalogSearchText(($("composer-new-song-title-search") && $("composer-new-song-title-search").value) || "");
      return stripSongCatalogLyricsTag(search) || search;
    }

    function syncComposerNewSongTitleFieldsFromSearch(raw) {
      const titleEl = $("composer-new-song-title");
      const core = stripSongCatalogLyricsTag(trimSongCatalogSearchText(raw || "")) || trimSongCatalogSearchText(raw || "");
      if (titleEl) titleEl.value = core;
      updateComposerNewSongMoodGoogleVisibility();
    }

    function updateComposerNewSongMoodGoogleVisibility() {
      const wrap = $("composer-new-song-mood-google-wrap");
      if (!wrap) return;
      wrap.hidden = !getComposerNewSongTitle();
    }

    function openComposerNewSongMoodGoogleSearch() {
      const title = getComposerNewSongTitle();
      const lang = ($("composer-new-song-language") && $("composer-new-song-language").value) || "";
      if (!title) return;
      if (!lang) {
        setComposerNewSongFieldAttention("language", true);
        setComposerNewSongError("Select a language before searching mood on Google.");
        if ($("composer-new-song-language")) $("composer-new-song-language").focus();
        return;
      }
      setComposerNewSongError("");
      openExternalGoogleSearch(buildSongMoodGoogleQuery(title, lang));
    }

    function composerNewSongSearchHasNoMatches(query) {
      if (!songCatalogData) return false;
      const q = songCatalogSearchMeetsMinimum(query)
        ? songCatalogLibraryQuery(query).toLowerCase()
        : "";
      if (!q) return false;
      return !collectComposerNewSongSearchHits(query).length;
    }

    function validateComposerNewSongForm() {
      const title = getComposerNewSongTitle();
      const language = ($("composer-new-song-language") && $("composer-new-song-language").value) || "";
      const section = ($("composer-new-song-section") && $("composer-new-song-section").value) || "";
      const moods = readComposerNewSongMoodChecks();
      const lyrics = (($("composer-new-song-lyrics") && $("composer-new-song-lyrics").value) || "").trim();
      clearComposerNewSongFieldAttention();
      const missing = [];
      if (!title) {
        setComposerNewSongFieldAttention("title", true);
        setComposerNewSongFieldAttention("titleSearch", true);
        missing.push("Title");
      }
      if (!language) {
        setComposerNewSongFieldAttention("language", true);
        missing.push("Language");
      }
      if (!section) {
        setComposerNewSongFieldAttention("section", true);
        missing.push("Section");
      }
      if (!moods.length) {
        setComposerNewSongFieldAttention("moods", true);
        missing.push("Gospel mood");
      }
      if (!lyrics) {
        setComposerNewSongFieldAttention("lyrics", true);
        missing.push("Lyrics");
      }
      if (missing.length) {
        setComposerNewSongError("Fill in all required fields: " + missing.join(", ") + ".");
        const focusOrder = [
          ["title", "composer-new-song-title"],
          ["titleSearch", "composer-new-song-title-search"],
          ["language", "composer-new-song-language"],
          ["section", "composer-new-song-section"],
          ["moods", "composer-new-song-moods-field"],
          ["lyrics", "composer-new-song-lyrics"],
        ];
        for (const [key, id] of focusOrder) {
          const map = { title: !title, titleSearch: !title, language: !language, section: !section, moods: !moods.length, lyrics: !lyrics };
          if (!map[key]) continue;
          const el = $(id);
          if (el) {
            el.focus();
            break;
          }
        }
        return false;
      }
      setComposerNewSongError("");
      return true;
    }

    function closeComposerNewSongResults() {
      const box = $("composer-new-song-results");
      if (!box) return;
      box.hidden = true;
      box.innerHTML = "";
    }

    function resetComposerNewSongModalFields() {
      composerNewSongPickedCatalog = null;
      if ($("composer-new-song-title-search")) $("composer-new-song-title-search").value = "";
      if ($("composer-new-song-title")) $("composer-new-song-title").value = "";
      if ($("composer-new-song-author")) $("composer-new-song-author").value = "";
      if ($("composer-new-song-language")) $("composer-new-song-language").value = "";
      if ($("composer-new-song-section")) $("composer-new-song-section").value = "";
      if ($("composer-new-song-lyrics")) $("composer-new-song-lyrics").value = "";
      setComposerNewSongMoodChecks([]);
      setComposerNewSongError("");
      setComposerNewSongSearchHint("", "");
      clearComposerNewSongFieldAttention();
      updateComposerNewSongMoodGoogleVisibility();
      closeComposerNewSongResults();
    }

    function collectComposerNewSongSearchHits(query) {
      if (!songCatalogSearchMeetsMinimum(query)) return [];
      const q = songCatalogLibraryQuery(query).toLowerCase();
      if (!q || !songCatalogData) return [];
      const hits = [];
      SECTION_ORDER.forEach(({ key: sec, label }) => {
        filterSongCatalogRows(songCatalogData[sec] || [], sec, q).forEach((row) => {
          hits.push({ section: sec, sectionLabel: label, row });
        });
      });
      return hits.slice(0, 12);
    }

    function buildComposerNewSongNoMatchesHtml(rawQuery) {
      const q = String(rawQuery || "").trim();
      const canGoogle = songCatalogSearchMeetsMinimum(q);
      const core = stripSongCatalogLyricsTag(q) || q;
      let html = "<div class=\"song-catalog-empty\">";
      html += "<p class=\"muted\">No matches. Clear the search or try another title or author.</p>";
      if (canGoogle) {
        html +=
          "<p class=\"song-catalog-empty__google\">Not in your library? " +
          "<button type=\"button\" class=\"song-catalog-empty__google-btn\" data-composer-new-google-search=\"" +
          escapeHtml(q) + "\">Search Google for \"" + escapeHtml(core) + "\" lyrics</button></p>";
        html += "<p class=\"muted\" style=\"margin-top:8px;font-size:0.75rem;\">Or press Enter to search Google.</p>";
      }
      html += "</div>";
      return html;
    }

    function renderComposerNewSongSearchResults(query) {
      const box = $("composer-new-song-results");
      if (!box) return;
      const q = trimSongCatalogSearchText(query);
      const statusHint = songCatalogSearchStatusHint(q);
      setComposerNewSongSearchHint(statusHint.text, statusHint.kind);
      if (!q) {
        closeComposerNewSongResults();
        return;
      }
      if (!songCatalogSearchMeetsMinimum(q)) {
        closeComposerNewSongResults();
        return;
      }
      const hits = collectComposerNewSongSearchHits(q);
      if (!hits.length) {
        box.innerHTML = buildComposerNewSongNoMatchesHtml(q);
        box.hidden = false;
        return;
      }
      box.innerHTML =
        "<ul class=\"composer-new-song-results__list\" role=\"listbox\">" +
        hits.map(({ section, sectionLabel, row }) => (
          "<li><button type=\"button\" class=\"composer-new-song-results__item\" role=\"option\" " +
          "data-new-song-sec=\"" + escapeHtml(section) + "\" data-new-song-id=\"" + escapeHtml(String(row.id || "")) + "\">" +
          "<span class=\"composer-new-song-results__title\">" + escapeHtml(row.title || "Song") + "</span>" +
          "<span class=\"composer-new-song-results__meta\">" +
          escapeHtml(sectionLabel) +
          (row.author ? " · " + escapeHtml(row.author) : "") +
          (row.language ? " · " + escapeHtml(row.language) : "") +
          "</span></button></li>"
        )).join("") +
        "</ul>";
      box.hidden = false;
    }

    function handleComposerNewSongSearchEnter(e) {
      if (e.key !== "Enter") return;
      const el = $("composer-new-song-title-search");
      if (!el || e.target !== el) return;
      e.preventDefault();
      clearTimeout(composerNewSongSearchDebounce);
      syncComposerNewSongTitleFieldsFromSearch(el.value);
      renderComposerNewSongSearchResults(el.value);
      const query = trimSongCatalogSearchText(el.value);
      if (!query || !songCatalogSearchMeetsMinimum(query)) return;
      if (!composerNewSongSearchHasNoMatches(query)) return;
      openSongCatalogGoogleConfirmModal(query);
    }

    function trimComposerNewSongSearchOnBlur() {
      const el = $("composer-new-song-title-search");
      if (!el) return;
      let cleaned = trimSongCatalogSearchText(el.value);
      cleaned = normalizeSongCatalogLyricsTag(cleaned);
      if (cleaned === el.value) return;
      el.value = cleaned;
      syncComposerNewSongTitleFieldsFromSearch(cleaned);
      renderComposerNewSongSearchResults(cleaned);
    }

    async function applyComposerNewSongCatalogPick(section, id) {
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      if (!sec || !sid) return;
      try {
        const data = await fetchSongDetail(sec, sid, { forceNetwork: true });
        const song = data.song || {};
        const resolvedSec = String(data.section || sec || "").trim().toLowerCase() || sec;
        composerNewSongPickedCatalog = { section: resolvedSec, id: sid };
        if ($("composer-new-song-title-search")) $("composer-new-song-title-search").value = song.title || "";
        if ($("composer-new-song-title")) $("composer-new-song-title").value = song.title || "";
        if ($("composer-new-song-author")) $("composer-new-song-author").value = song.author || "";
        if ($("composer-new-song-language")) $("composer-new-song-language").value = song.language || "";
        if ($("composer-new-song-section")) $("composer-new-song-section").value = resolvedSec || "";
        if ($("composer-new-song-lyrics") && song.lyrics) $("composer-new-song-lyrics").value = String(song.lyrics);
        setComposerNewSongMoodChecks(song.gospel_moods || []);
        if (typeof refreshVerbumSelect === "function") {
          refreshVerbumSelect($("composer-new-song-language"));
          refreshVerbumSelect($("composer-new-song-section"));
        }
        closeComposerNewSongResults();
        setComposerNewSongError("");
        clearComposerNewSongFieldAttention();
        updateComposerNewSongMoodGoogleVisibility();
      } catch (_err) {
        setComposerNewSongError("Could not load that song. Try again or enter details manually.");
      }
    }

    function closeComposerNewSongModal() {
      setUiOverlayOpen($("composer-new-song-modal"), false);
      closeComposerNewSongResults();
      setComposerNewSongError("");
      setComposerNewSongSearchHint("", "");
      clearComposerNewSongFieldAttention();
      composerNewSongPickedCatalog = null;
    }

    async function openComposerNewSongModal() {
      if (normalizeRoute(currentRoute()) !== "/library/songs") {
        showRoute("/library/songs");
      }
      composerSuppressPreload = true;
      composerPreloadSeq += 1;
      resetComposerNewSongModalFields();
      try {
        await loadSongCatalog(true);
      } catch (_e) { /* catalog optional for manual entry */ }
      setUiOverlayOpen($("composer-new-song-modal"), true);
      if (typeof initVerbumSelects === "function") initVerbumSelects($("composer-new-song-modal"));
      if (typeof syncVerbumSelectTrigger === "function") {
        syncVerbumSelectTrigger($("composer-new-song-language"));
        syncVerbumSelectTrigger($("composer-new-song-section"));
      }
      const search = $("composer-new-song-title-search");
      if (search) search.focus();
      updateComposerNewSongMoodGoogleVisibility();
    }

    async function confirmComposerNewSongAnalyze() {
      if (!validateComposerNewSongForm()) return;
      const title = formatSongTitleCase(getComposerNewSongTitle());
      const author = (($("composer-new-song-author") && $("composer-new-song-author").value) || "").trim();
      const language = ($("composer-new-song-language") && $("composer-new-song-language").value) || "";
      const section = ($("composer-new-song-section") && $("composer-new-song-section").value) || "";
      const moods = readComposerNewSongMoodChecks();
      const lyrics = (($("composer-new-song-lyrics") && $("composer-new-song-lyrics").value) || "").trim();
      resetComposerEditorEmpty();
      if ($("lyrics-save-title")) $("lyrics-save-title").value = title;
      if ($("lyrics-save-author")) $("lyrics-save-author").value = author;
      if (typeof setComposerSongLanguage === "function") setComposerSongLanguage(language);
      else if ($("lyrics-save-language")) $("lyrics-save-language").value = language;
      if (typeof setComposerSongSection === "function") setComposerSongSection(section);
      else if ($("lyrics-save-section")) $("lyrics-save-section").value = section;
      composerGospelMoods = moods.slice();
      if ($("lyrics-input")) $("lyrics-input").value = lyrics;
      lyricsRawSnapshot = "";
      lyricBlocks = [];
      composerLoadedSong = composerNewSongPickedCatalog ? Object.assign({}, composerNewSongPickedCatalog, { title }) : null;
      autoResizeLyricsMainInput();
      updateLyricsWordStats();
      if (typeof updateLyricsComposerDetailsPreview === "function") updateLyricsComposerDetailsPreview();
      if (typeof clearSongCatalogSearch === "function") clearSongCatalogSearch();
      closeComposerNewSongModal();
      if (typeof expandSongComposerPanel === "function") expandSongComposerPanel();
      if (typeof setSongComposerDeflated === "function") setSongComposerDeflated(false);
      setLyricsStatus("Analyzing lyrics…", "");
      const workspace = $("lyrics-workspace-row");
      if (workspace) workspace.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (typeof scrollLyricsComposerToTab === "function") scrollLyricsComposerToTab("raw");
      await analyzeLyrics();
    }

    function autoAnalyzeLyricsOnLibraryTab() {
      const input = $("lyrics-input");
      if (!input || !input.value.trim()) {
        if (!lyricBlocks.length) renderLyrics();
        return;
      }
      syncInputPanelToStructuredEditor({ quiet: true });
      autoResizeLyricsMainInput();
    }

    function setLyricsStatus(message, kind) {
      const el = $("lyrics-status");
      if (!el) return;
      el.textContent = message || "";
      el.className = "status song-composer-status" + (kind ? " " + kind : "");
    }

    function setLyricsAnalyzeHint(message, kind) {
      const el = $("lyrics-analyze-hint");
      if (!el) return;
      el.textContent = message || "";
      el.className = "lyrics-analyze-hint" + (kind ? " " + kind : "");
    }

    function lyricBlockSectionTitle(block, index) {
      const type = block.type || "verse";
      const label = typeLabels[type] || "Section";
      // Chorus / Refrain are always unnumbered.
      if (type === "chorus" || type === "refrain") return label;
      const sameTypeIndex = lyricBlocks.slice(0, index + 1).filter((b) => b.type === type).length;
      if (type === "verse" || sameTypeIndex > 1) return label + " " + sameTypeIndex;
      return label;
    }

    function serializedLyrics() {
      if (!lyricBlocks.length) return $("lyrics-input").value.trim();
      return lyricBlocks.map((block, index) => {
        const title = lyricBlockSectionTitle(block, index);
        return [title, (block.text || "").trim()].filter(Boolean).join("\n");
      }).join("\n\n").trim();
    }

    /** Structured Editor block order → lyrics textarea (source of truth when blocks exist). */
    function syncStructuredEditorToInputPanel() {
      if (!lyricBlocks.length) return;
      const text = serializedLyrics();
      lyricsSyncLock = true;
      $("lyrics-input").value = text;
      lyricsSyncLock = false;
      lyricsRawSnapshot = text;
      autoResizeLyricsMainInput();
    }

    function lyricStats() {
      updateLyricsWordStats();
      const detected = $("lyrics-detected");
      if (!detected) return;
      const pills = ["verse", "chorus", "pre-chorus", "refrain", "outro", "bridge", "response"].map((type) => {
        const count = lyricBlocks.filter((block) => block.type === type).length;
        if (!count) return "";
        return (
          '<span class="detected-pill detected-pill--' + type + '">' +
            '<span class="detected-dot" aria-hidden="true"></span>' +
            typeLabels[type] + ": " + count +
          "</span>"
        );
      }).filter(Boolean);
      if (!pills.length) {
        detected.innerHTML = "";
        detected.hidden = true;
      } else {
        detected.hidden = false;
        detected.innerHTML = '<span class="muted">Detected sections:</span>' + pills.join("");
      }
      updateLyricsStructuredMeta();
    }

    function renderLyrics(options) {
      const writeBack = !options || options.writeBack !== false;
      lyricStats();
      const list = $("lyrics-block-list");
      if (!lyricBlocks.length) {
        list.innerHTML = '<div class="empty-state">Press Analyze to detect Verse, Chorus, Pre-Chorus, Refrain, Outro, and more from your lyrics.</div>';
        if (writeBack) syncStructuredEditorToInputPanel();
        return;
      }
      list.innerHTML = lyricBlocks.map((block, index) => {
        const collapsed = !!block.collapsed;
        const charCount = (block.text || "").length;
        const typeOpts = Object.keys(typeLabels).map((type) => (
          '<option value="' + type + '"' + (block.type === type ? " selected" : "") + ">" + typeLabels[type] + "</option>"
        )).join("");
        return (
          '<article class="lyric-block type-' + block.type + (collapsed ? " collapsed" : "") + '" draggable="true" data-id="' + block.id + '" data-index="' + index + '">' +
            '<div class="lyric-block__head">' +
              '<span class="lyric-block__drag" title="Drag to reorder" aria-hidden="true">' + LYRIC_BLOCK_DRAG_SVG + "</span>" +
              '<select class="lyric-block__pill-select" data-action="type" aria-label="Section type">' + typeOpts + "</select>" +
              '<div class="lyric-block__actions">' +
                '<button type="button" class="lyric-block__btn" data-action="move-up" title="Move up" aria-label="Move up"' + (index === 0 ? " disabled" : "") + ">" + LYRIC_BLOCK_ICON_UP + "</button>" +
                '<button type="button" class="lyric-block__btn" data-action="move-down" title="Move down" aria-label="Move down"' + (index === lyricBlocks.length - 1 ? " disabled" : "") + ">" + LYRIC_BLOCK_ICON_DOWN + "</button>" +
                '<button type="button" class="lyric-block__btn" data-action="duplicate" title="Duplicate" aria-label="Duplicate">' + LYRIC_BLOCK_ICON_DUPLICATE + "</button>" +
                '<button type="button" class="lyric-block__btn danger" data-action="delete" title="Delete" aria-label="Delete">' + LYRIC_BLOCK_ICON_DELETE + "</button>" +
              "</div>" +
            "</div>" +
            '<div class="lyric-block__body">' +
              '<div class="lyric-block__ta-wrap">' +
                '<textarea class="lyric-block__ta" data-action="text" data-limit-key="lyric_block" maxlength="4000" rows="1" spellcheck="true">' + escapeHtml(block.text) + "</textarea>" +
                '<div class="lyric-block__ta-foot">' +
                  '<span class="lyric-block__char-count" aria-live="polite">' + charCount + "/4000</span>" +
                "</div>" +
              "</div>" +
            "</div>" +
          "</article>"
        );
      }).join("");
      if (writeBack) syncStructuredEditorToInputPanel();
      requestAnimationFrame(() => {
        autoResizeAllLyricTextareas();
        syncAllLyricBlockCharCounts(list);
        setTimeout(() => syncAllLyricBlockCharCounts(list), 0);
      });
      initVerbumSelects(list);
      if (typeof syncLyricsComposerMobileUi === "function") syncLyricsComposerMobileUi();
    }

    $("lyrics-block-list").addEventListener("beforeinput", (event) => {
      if (event.target && event.target.dataset && event.target.dataset.action === "text") {
        beginComposerUndoBurst();
      }
    });
    $("lyrics-block-list").addEventListener("input", (event) => {
      const card = event.target.closest(".lyric-block");
      if (!card) return;
      const block = lyricBlocks.find((item) => item.id === card.dataset.id);
      if (!block) return;
      if (event.target.dataset.action === "text") {
        block.text = event.target.value;
        autoResizeLyricTextarea(event.target);
        syncLyricBlockCharCount(event.target);
      }
      lyricStats();
      syncStructuredEditorToInputPanel();
    });

    $("lyrics-block-list").addEventListener("change", (event) => {
      const card = event.target.closest(".lyric-block");
      if (!card || event.target.dataset.action !== "type") return;
      const block = lyricBlocks.find((item) => item.id === card.dataset.id);
      if (!block) return;
      pushComposerUndoCheckpoint();
      const index = lyricBlocks.findIndex((item) => item.id === card.dataset.id);
      block.type = event.target.value;
      block.title = lyricBlockSectionTitle(block, index);
      renderLyrics();
    });

    $("lyrics-block-list").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      const card = event.target.closest(".lyric-block");
      if (!card) return;
      if (action === "type" || action === "text") return;
      const index = lyricBlocks.findIndex((item) => item.id === card.dataset.id);
      if (index < 0) return;
      const block = lyricBlocks[index];
      if (action === "delete" || action === "duplicate" || action === "move-up" || action === "move-down") {
        pushComposerUndoCheckpoint();
      }
      if (action === "delete") lyricBlocks.splice(index, 1);
      if (action === "duplicate") {
        const dupId = crypto.randomUUID();
        lyricBlocks.splice(index + 1, 0, {
          ...block,
          id: dupId,
          title: block.title + " copy",
          collapsed: false,
        });
        renderLyrics();
        scrollToLyricBlock(dupId);
        return;
      }
      if (action === "move-up" && index > 0) {
        const tmp = lyricBlocks[index - 1];
        lyricBlocks[index - 1] = lyricBlocks[index];
        lyricBlocks[index] = tmp;
      }
      if (action === "move-down" && index < lyricBlocks.length - 1) {
        const tmp = lyricBlocks[index + 1];
        lyricBlocks[index + 1] = lyricBlocks[index];
        lyricBlocks[index] = tmp;
      }
      if (action === "toggle-collapse") {
        block.collapsed = !block.collapsed;
        renderLyrics();
        return;
      }
      renderLyrics();
    });

    $("lyrics-block-list").addEventListener("dragstart", (event) => {
      if (isMobileChromeLayout()) {
        event.preventDefault();
        return;
      }
      const card = event.target.closest(".lyric-block");
      if (!card) return;
      pushComposerUndoCheckpoint();
      draggedLyricId = card.dataset.id;
      card.classList.add("dragging");
      clearLyricDropHints();
      try {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedLyricId);
      } catch (_err) { /* ignore */ }
    });
    $("lyrics-block-list").addEventListener("dragend", () => {
      clearLyricDropHints();
      draggedLyricId = null;
      document.querySelectorAll(".lyric-block.dragging").forEach((el) => el.classList.remove("dragging"));
    });
    $("lyrics-block-list").addEventListener("dragover", (event) => {
      if (isMobileChromeLayout()) return;
      event.preventDefault();
      try { event.dataTransfer.dropEffect = "move"; } catch (_err) { /* ignore */ }
      if (!draggedLyricId) return;
      updateLyricDropHintAtPoint(event.clientX, event.clientY);
    });
    $("lyrics-block-list").addEventListener("dragleave", (event) => {
      if (isMobileChromeLayout()) return;
      const related = event.relatedTarget;
      if (related && event.currentTarget.contains(related)) return;
      clearLyricDropHints();
    });
    $("lyrics-block-list").addEventListener("drop", (event) => {
      if (isMobileChromeLayout()) return;
      event.preventDefault();
      updateLyricDropHintAtPoint(event.clientX, event.clientY);
      applyLyricDropFromHint();
      document.querySelectorAll(".lyric-block.dragging").forEach((el) => el.classList.remove("dragging"));
      draggedLyricId = null;
    });

    function clearLyricDropHints() {
      document.querySelectorAll(".lyric-block--drop-before, .lyric-block--drop-after").forEach((el) => {
        el.classList.remove("lyric-block--drop-before", "lyric-block--drop-after");
      });
    }

    function setLyricDropHint(target, before) {
      if (!target) {
        clearLyricDropHints();
        return;
      }
      const nextBefore = !!before;
      const hasBefore = target.classList.contains("lyric-block--drop-before");
      const hasAfter = target.classList.contains("lyric-block--drop-after");
      if ((nextBefore && hasBefore) || (!nextBefore && hasAfter)) return;
      clearLyricDropHints();
      target.classList.add(nextBefore ? "lyric-block--drop-before" : "lyric-block--drop-after");
    }

    function resolveLyricDropTargetAtPoint(clientX, clientY) {
      const list = $("lyrics-block-list");
      if (!list || !draggedLyricId) return null;
      const listRect = list.getBoundingClientRect();
      if (
        clientY < listRect.top - 8 ||
        clientY > listRect.bottom + 8 ||
        clientX < listRect.left - 24 ||
        clientX > listRect.right + 24
      ) {
        return null;
      }
      const cards = Array.from(list.querySelectorAll(".lyric-block")).filter(
        (el) => el.dataset.id !== draggedLyricId
      );
      if (!cards.length) return null;

      const hit = document.elementFromPoint(clientX, clientY);
      let target = hit && hit.closest ? hit.closest("#lyrics-block-list .lyric-block") : null;
      if (target && target.dataset.id === draggedLyricId) target = null;

      if (!target) {
        let best = null;
        let bestDist = Infinity;
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dist = Math.abs(clientY - midY);
          if (dist < bestDist) {
            bestDist = dist;
            best = card;
          }
        });
        target = best;
      }
      if (!target || target.dataset.id === draggedLyricId) return null;

      const rect = target.getBoundingClientRect();
      const before = clientY < rect.top + rect.height / 2;
      return { target, before };
    }

    function updateLyricDropHintAtPoint(clientX, clientY) {
      const resolved = resolveLyricDropTargetAtPoint(clientX, clientY);
      if (!resolved) {
        clearLyricDropHints();
        return;
      }
      setLyricDropHint(resolved.target, resolved.before);
    }

    function applyLyricDropFromHint() {
      const beforeEl = document.querySelector("#lyrics-block-list .lyric-block--drop-before");
      const afterEl = document.querySelector("#lyrics-block-list .lyric-block--drop-after");
      const dropId = draggedLyricId;
      clearLyricDropHints();
      if (!dropId) return;
      const from = lyricBlocks.findIndex((item) => item.id === dropId);
      if (from < 0) return;
      let to = -1;
      if (beforeEl) {
        to = lyricBlocks.findIndex((item) => item.id === beforeEl.dataset.id);
      } else if (afterEl) {
        to = lyricBlocks.findIndex((item) => item.id === afterEl.dataset.id);
        if (to >= 0) to += 1;
      } else {
        return;
      }
      if (to < 0 || to === from || to === from + 1) return;
      const [moved] = lyricBlocks.splice(from, 1);
      if (to > from) to -= 1;
      lyricBlocks.splice(to, 0, moved);
      renderLyrics();
      syncStructuredEditorToInputPanel();
      updateLyricsStructuredMeta();
    }

    function setLyricsBlocksDragZoom(on) {
      if (!isMobileChromeLayout()) return;
      document.body.classList.toggle("lyrics-blocks-drag-zoom", !!on);
    }

    function syncLyricBlocksOrderFromDom() {
      const list = $("lyrics-block-list");
      if (!list) return;
      const ids = Array.from(list.querySelectorAll(".lyric-block")).map((el) => el.dataset.id);
      const next = [];
      ids.forEach((id) => {
        const block = lyricBlocks.find((item) => item.id === id);
        if (block) next.push(block);
      });
      if (next.length !== lyricBlocks.length) return;
      lyricBlocks.length = 0;
      lyricBlocks.push(...next);
      syncStructuredEditorToInputPanel();
      updateLyricsStructuredMeta();
    }

    function initLyricBlockTouchDrag() {
      const list = $("lyrics-block-list");
      if (!list || list.dataset.touchDragBound === "1") return;
      list.dataset.touchDragBound = "1";

      let activeCard = null;
      let dragging = false;
      let startX = 0;
      let startY = 0;

      function endTouchDrag() {
        if (!dragging && !activeCard) return;
        const wasDragging = dragging;
        dragging = false;
        if (activeCard) activeCard.classList.remove("dragging");
        activeCard = null;
        setLyricsBlocksDragZoom(false);
        if (wasDragging) applyLyricDropFromHint();
        else clearLyricDropHints();
        draggedLyricId = null;
      }

      list.addEventListener("touchstart", (event) => {
        if (!isMobileChromeLayout()) return;
        const handle = event.target.closest(".lyric-block__drag");
        const card = event.target.closest(".lyric-block");
        if (!handle || !card) return;
        const touch = event.touches[0];
        if (!touch) return;
        activeCard = card;
        draggedLyricId = card.dataset.id;
        startX = touch.clientX;
        startY = touch.clientY;
        dragging = true;
        card.classList.add("dragging");
        clearLyricDropHints();
        setLyricsBlocksDragZoom(true);
        try {
          if (navigator.vibrate) navigator.vibrate(10);
        } catch (_err) { /* optional */ }
      }, { passive: true });

      list.addEventListener("touchmove", (event) => {
        if (!isMobileChromeLayout() || !dragging || !activeCard) return;
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        const dx = Math.abs(touch.clientX - startX);
        const dy = Math.abs(touch.clientY - startY);
        if (dx < 2 && dy < 2) return;
        updateLyricDropHintAtPoint(touch.clientX, touch.clientY);
      }, { passive: false });

      list.addEventListener("touchend", endTouchDrag, { passive: true });
      list.addEventListener("touchcancel", endTouchDrag, { passive: true });
    }

    initLyricBlockTouchDrag();

    $("lyrics-input").addEventListener("beforeinput", () => {
      beginComposerUndoBurst();
    });
    $("lyrics-input").addEventListener("input", () => {
      autoResizeLyricsMainInput();
      updateLyricsWordStats();
      markLyricsRawDirty();
      updateParishLyricsControls();
    });

    async function loadLyricsFromFile(file) {
      if (!file) return;
      const steps = buildMassGenStepList({ flow: "lyrics" });
      setMassGenLoading(true, {
        title: "Importing lyrics",
        steps,
        step: 0,
        message: "Uploading lyrics…",
      });
      try {
        advanceMassGenStep(1, { message: "Reading file…" });
        const text = await file.text();
        advanceMassGenStep(2, { message: "Detecting metadata…" });

        const nameLower = String(file.name || "").toLowerCase();
        const isRtf = nameLower.endsWith(".rtf") || /^\s*\{\\rtf/i.test(text);
        const looksVerbum =
          isRtf ||
          /===?\s*SONG\s*===?/i.test(text) ||
          /=\s*SONG\s*=/i.test(text) ||
          (/^TITLE\s*:/im.test(text) &&
            /^(SECTION|SECTIONS|MASS[_ ]?PART)\s*:/im.test(text) &&
            /^LYRICS\s*:/im.test(text));

        if (looksVerbum) {
          advanceMassGenStep(2, { message: isRtf ? "Converting RTF + parsing songs…" : "Parsing Verbum song format…" });
          const parsed = await postJSON("/api/lyrics/import-txt", { text: text, save: false });
          const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
          if (!songs.length) {
            throw new Error((parsed.error || parsed.errors && parsed.errors[0]) || "No songs found in file.");
          }

          if (songs.length === 1) {
            advanceMassGenStep(3, { message: "Analyzing lyric blocks…" });
            const blockCount = applyVerbumParsedSongToEditor(songs[0]);
            await new Promise((resolve) => setTimeout(resolve, 200));
            setMassGenLoading(false);
            setLyricsStatus(
              "Loaded \"" + (songs[0].title || file.name) + "\"" +
              (blockCount ? " · " + blockCount + " section" + (blockCount === 1 ? "" : "s") + " separated." : ".") +
              " Review and save.",
              "ok"
            );
            return;
          }

          const canBulk =
            !window.VerbumAuth ||
            (churchMembershipState && churchMembershipState.is_superadmin);
          if (!canBulk) {
            advanceMassGenStep(3, { message: "Analyzing lyric blocks…" });
            const blockCount = applyVerbumParsedSongToEditor(songs[0]);
            await new Promise((resolve) => setTimeout(resolve, 200));
            setMassGenLoading(false);
            setLyricsStatus(
              "Found " + songs.length + " songs. Loaded the first one" +
              (blockCount ? " (" + blockCount + " sections)" : "") +
              " — bulk import needs a superadmin account.",
              "error"
            );
            return;
          }

          const dupCount = Number(parsed.duplicates || 0) || songs.filter((s) => s && s.exists).length;
          const newCount = Math.max(0, songs.length - dupCount);
          let importMsg =
            "Found " + songs.length + " songs in this file" + (isRtf ? " (.rtf)" : "") + ".";
          if (dupCount > 0) {
            importMsg +=
              "\n\n" + dupCount + " already exist in the library" +
              (newCount ? " · " + newCount + " new" : "") + ".";
          }
          importMsg += "\n\nImport into the song library now?";
          const ok = window.confirm(importMsg);
          if (!ok) {
            advanceMassGenStep(3, { message: "Analyzing lyric blocks…" });
            const blockCount = applyVerbumParsedSongToEditor(songs[0]);
            await new Promise((resolve) => setTimeout(resolve, 200));
            setMassGenLoading(false);
            setLyricsStatus(
              "Import cancelled. Loaded first song \"" + (songs[0].title || "") + "\"" +
              (blockCount ? " · " + blockCount + " sections separated." : "."),
              "ok"
            );
            return;
          }

          let onDuplicate = "overwrite";
          if (dupCount > 0) {
            const overwrite = window.confirm(
              dupCount + " song" + (dupCount === 1 ? "" : "s") + " already exist.\n\n" +
              "OK = Overwrite existing songs with this file\n" +
              "Cancel = Skip duplicates (only add new songs)"
            );
            onDuplicate = overwrite ? "overwrite" : "skip";
          }

          advanceMassGenStep(3, { message: "Saving " + songs.length + " songs…" });
          const saved = await postJSON("/api/lyrics/import-txt", {
            text: text,
            save: true,
            on_duplicate: onDuplicate,
          });
          await loadSongCatalog(true);
          const results = Array.isArray(saved.results) ? saved.results : [];
          const langByTitle = {};
          (Array.isArray(saved.songs) ? saved.songs : songs).forEach((s) => {
            const key = String((s && s.title) || "").trim().toLowerCase();
            if (key) langByTitle[key] = String((s && s.language) || "Tagalog").trim() || "Tagalog";
          });
          const historyEntries = [];
          for (let i = results.length - 1; i >= 0; i -= 1) {
            const row = results[i];
            if (!row || !row.title || row.skipped) continue;
            const titleKey = String(row.title || "").trim().toLowerCase();
            historyEntries.push({
              title: row.title,
              section: row.section || "",
              id: row.id || "",
              language: langByTitle[titleKey] || "Tagalog",
              // Treat imported songs as newly added so Home "Newly added" + Recent both update.
              kind: "new",
            });
          }
          if (typeof pushSongHistoryBatch === "function") {
            pushSongHistoryBatch(historyEntries);
          } else {
            historyEntries.forEach((entry) => pushSongHistory(entry));
          }
          if (typeof refreshHomeSongsCard === "function") {
            void refreshHomeSongsCard();
          }
          if (typeof renderComposerRecent === "function") renderComposerRecent();
          await new Promise((resolve) => setTimeout(resolve, 200));
          setMassGenLoading(false);
          const failedN = Array.isArray(saved.failed) ? saved.failed.length : 0;
          const skippedN = Number(saved.skipped || 0) || 0;
          const msg =
            "Imported " + (saved.saved || 0) + " songs" +
            (saved.created ? " (" + saved.created + " new" : "") +
            (saved.updated ? (saved.created ? ", " : " (") + saved.updated + " updated" : "") +
            (saved.created || saved.updated ? ")" : "") +
            (skippedN ? ". Skipped " + skippedN + " existing." : "") +
            (failedN ? " " + failedN + " failed." : (skippedN ? "" : "."));
          setLyricsStatus(msg, failedN ? "error" : "ok");
          if (saved.undo_token) {
            rememberSongImportUndo(saved.undo_token, saved.undo_expires_at);
            showSongSaveSuccessModal(msg + " You can undo for 30 minutes.", "Songs imported", {
              undoToken: saved.undo_token,
            });
            showToastWithAction(
              "Import saved. Undo available for 30 minutes.",
              "ok",
              {
                label: "Undo",
                durationMs: 16000,
                onClick: () => undoLastSongImport({ token: saved.undo_token, source: "toast" }),
              }
            );
          } else {
            showSongSaveSuccessModal(msg, "Songs imported");
          }
          return;
        }

        if (($("lyrics-input") && $("lyrics-input").value.trim()) || (lyricBlocks && lyricBlocks.length)) {
          pushComposerUndoCheckpoint();
        }
        $("lyrics-input").value = text;
        autoResizeLyricsMainInput();
        updateLyricsWordStats();
        const baseTitle = (file.name || "").replace(/\.(txt|rtf)$/i, "").trim();
        if (baseTitle && $("lyrics-save-title")) $("lyrics-save-title").value = baseTitle;
        advanceMassGenStep(3, { message: "Analyzing lyric blocks…" });
        const blockCount = autoAnalyzeComposerLyrics({ quiet: true });
        await new Promise((resolve) => setTimeout(resolve, 280));
        setMassGenLoading(false);
        setLyricsStatus(
          "Loaded " + file.name +
          (blockCount ? " · " + blockCount + " section" + (blockCount === 1 ? "" : "s") + " separated." : ".") +
          " Review and save.",
          "ok"
        );
      } catch (err) {
        setMassGenLoading(false);
        setLyricsStatus(err && err.message ? err.message : "Could not import lyrics file.", "error");
      }
    }

    /** Run Analyze pipeline: blank lines before Verse/Chorus, split blocks, tidy casing. */
    function autoAnalyzeComposerLyrics(options) {
      const opts = options || {};
      const quiet = opts.quiet !== false;
      const input = $("lyrics-input");
      if (!input || !String(input.value || "").trim()) return 0;
      if (typeof ensureLyricSectionBreaks === "function") {
        const spaced = ensureLyricSectionBreaks(input.value);
        if (spaced && spaced !== input.value) {
          input.value = spaced;
          if (typeof autoResizeLyricsMainInput === "function") autoResizeLyricsMainInput();
          if (typeof updateLyricsWordStats === "function") updateLyricsWordStats();
        }
      }
      syncInputPanelToStructuredEditor({ quiet: quiet, writeBack: true });
      if (typeof tidyLyricsInEditor === "function") tidyLyricsInEditor({ quiet: true });
      commitLyricsAnalyzedSnapshot(false);
      if (typeof setLyricsAnalyzeOverlay === "function") setLyricsAnalyzeOverlay("ready");
      if (typeof updateLyricsComposerDetailsPreview === "function") updateLyricsComposerDetailsPreview();
      return Array.isArray(lyricBlocks) ? lyricBlocks.length : 0;
    }

    function applyVerbumParsedSongToEditor(song) {
      if (($("lyrics-input") && $("lyrics-input").value.trim()) || (lyricBlocks && lyricBlocks.length)) {
        pushComposerUndoCheckpoint();
      }
      const row = song || {};
      const title = String(row.title || "").trim();
      const author = String(row.author || "").trim();
      const language = String(row.language || "Tagalog").trim() || "Tagalog";
      const section = String(row.section || (row.sections && row.sections[0]) || "meditation").trim();
      const moods = Array.isArray(row.gospel_moods) ? row.gospel_moods.slice() : [];
      let lyrics = String(row.lyrics || "").trim();
      if (typeof ensureLyricSectionBreaks === "function") {
        lyrics = ensureLyricSectionBreaks(lyrics);
      }
      if ($("lyrics-save-title")) $("lyrics-save-title").value = title;
      if ($("lyrics-save-author")) $("lyrics-save-author").value = author;
      if (typeof setComposerSongLanguage === "function") setComposerSongLanguage(language);
      else if ($("lyrics-save-language")) $("lyrics-save-language").value = language;
      if (typeof setComposerSongSection === "function") setComposerSongSection(section);
      composerGospelMoods = moods;
      if (typeof syncComposerAccordionMoodsFromState === "function") syncComposerAccordionMoodsFromState();
      if (typeof setSongMetadataMoodChecks === "function") setSongMetadataMoodChecks(moods);
      $("lyrics-input").value = lyrics;
      autoResizeLyricsMainInput();
      updateLyricsWordStats();
      const blockCount = autoAnalyzeComposerLyrics({ quiet: true });
      composerLoadedSong = null;
      if (typeof updateParishLyricsControls === "function") updateParishLyricsControls();
      return blockCount;
    }

    $("lyrics-file").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      await loadLyricsFromFile(file);
      event.target.value = "";
    });

    (function bindLyricsDropZone() {
      const zone = $("lyrics-drop-zone");
      if (!zone) return;
      const prevent = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      ["dragenter", "dragover"].forEach((name) => {
        zone.addEventListener(name, (event) => {
          prevent(event);
          zone.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((name) => {
        zone.addEventListener(name, (event) => {
          prevent(event);
          if (name === "dragleave" && event.relatedTarget && zone.contains(event.relatedTarget)) return;
          zone.classList.remove("is-dragover");
        });
      });
      zone.addEventListener("drop", async (event) => {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file) return;
        await loadLyricsFromFile(file);
      });
    })();

    $("btn-lyrics-focus-meta") && $("btn-lyrics-focus-meta").addEventListener("click", () => {
      openComposerSongDetailsModal({ intent: "edit" });
    });

    var lyricsComposerMobileTab = "raw";

    function updateLyricsComposerDetailsPreview() {
      const preview = $("lyrics-composer-details-preview");
      if (!preview) return;
      const title = (($("lyrics-save-title") && $("lyrics-save-title").value) || "").trim();
      const author = (($("lyrics-save-author") && $("lyrics-save-author").value) || "").trim();
      const lang = (($("lyrics-save-language") && $("lyrics-save-language").value) || "").trim();
      const section = (($("lyrics-save-section") && $("lyrics-save-section").value) || "").trim();
      const sectionLabel = section && typeof songSectionLabel === "function" ? songSectionLabel(section) : "";
      const moods = typeof getComposerSongMoods === "function" ? getComposerSongMoods() : [];
      const moodLabel = typeof formatGospelMoodsLabel === "function" ? formatGospelMoodsLabel(moods) : "";
      const titleEl = preview.querySelector('[data-summary="title"]');
      const authorEl = preview.querySelector('[data-summary="author"]');
      const langEl = preview.querySelector('[data-summary="lang"]');
      const moodsEl = preview.querySelector('[data-summary="moods"]');
      if (titleEl) titleEl.textContent = title || "No title yet";
      if (authorEl) authorEl.textContent = author || "Author not set";
      if (langEl) {
        langEl.textContent = [lang || "Language not set", sectionLabel].filter(Boolean).join(" · ");
      }
      if (moodsEl) moodsEl.textContent = moodLabel || "Not set";
      preview.classList.toggle("is-empty", !title && !author && !lang && !moodLabel);
    }

    function placeLyricsBlockListForLayout() {
      const list = $("lyrics-block-list");
      const track = $("lyrics-composer-blocks-track");
      const desktopHost = document.querySelector("#lyrics-structured-body-inner .lyrics-block-list-scroll");
      if (!list) return;
      if (isMobileChromeLayout() && track) {
        if (list.parentElement !== track) track.appendChild(list);
      } else if (desktopHost && list.parentElement !== desktopHost) {
        desktopHost.appendChild(list);
      }
    }

    function scrollLyricsComposerToTab(tabId) {
      lyricsComposerMobileTab = (tabId === "blocks") ? "blocks" : "raw";
      const rawPane = $("lyrics-composer-pane-raw");
      const blocksPane = $("lyrics-composer-pane-blocks");
      const tabs = $("lyrics-composer-tabs");
      if (tabs) {
        tabs.querySelectorAll("[data-lyrics-tab]").forEach((btn) => {
          const on = btn.dataset.lyricsTab === lyricsComposerMobileTab;
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        });
      }
      if (!isMobileChromeLayout()) return;
      // Click-only tab switch — no horizontal swipe between panes
      if (rawPane) {
        const on = lyricsComposerMobileTab === "raw";
        rawPane.classList.toggle("is-active", on);
        rawPane.hidden = !on;
      }
      if (blocksPane) {
        const on = lyricsComposerMobileTab === "blocks";
        blocksPane.classList.toggle("is-active", on);
        blocksPane.hidden = !on;
      }
      requestAnimationFrame(() => {
        if (lyricsComposerMobileTab === "blocks") {
          autoResizeAllLyricTextareas();
          setTimeout(autoResizeAllLyricTextareas, 80);
          setTimeout(autoResizeAllLyricTextareas, 220);
        } else {
          autoResizeLyricsMainInput();
        }
      });
    }

    function syncLyricsComposerMobileUi() {
      placeLyricsBlockListForLayout();
      updateLyricsComposerDetailsPreview();
      if (typeof syncComposerAccordionMoodsFromState === "function") syncComposerAccordionMoodsFromState();
      const tabs = $("lyrics-composer-tabs");
      if (!tabs) return;
      if (!isMobileChromeLayout()) {
        tabs.innerHTML = "";
        lyricsComposerMobileTab = "raw";
        const rawPane = $("lyrics-composer-pane-raw");
        const blocksPane = $("lyrics-composer-pane-blocks");
        if (rawPane) {
          rawPane.classList.add("is-active");
          rawPane.hidden = false;
        }
        if (blocksPane) {
          blocksPane.classList.remove("is-active");
          blocksPane.hidden = false;
        }
        return;
      }
      if (lyricsComposerMobileTab !== "raw" && lyricsComposerMobileTab !== "blocks") {
        lyricsComposerMobileTab = "raw";
      }
      const items = [
        { id: "raw", label: "Raw" },
        { id: "blocks", label: "Blocks" },
      ];
      tabs.innerHTML = items.map((item) => (
        '<button type="button" class="lyrics-composer-tab' + (item.id === lyricsComposerMobileTab ? " is-active" : "") + '" role="tab" data-lyrics-tab="' + item.id + '" aria-selected="' + (item.id === lyricsComposerMobileTab ? "true" : "false") + '">' + escapeHtml(item.label) + "</button>"
      )).join("");
      scrollLyricsComposerToTab(lyricsComposerMobileTab);
    }

    function initLyricsComposerMobileUi() {
      ["lyrics-save-title", "lyrics-save-author", "lyrics-save-language", "lyrics-save-section"].forEach((id) => {
        const el = $(id);
        if (!el || el.dataset.composerPreviewBound === "1") return;
        el.dataset.composerPreviewBound = "1";
        el.addEventListener("input", updateLyricsComposerDetailsPreview);
        el.addEventListener("change", updateLyricsComposerDetailsPreview);
      });
      const moods = $("lyrics-composer-moods");
      if (moods && moods.dataset.bound !== "1") {
        moods.dataset.bound = "1";
        moods.addEventListener("change", () => {
          composerGospelMoods = readComposerAccordionMoodChecks();
          setSongMetadataMoodChecks(composerGospelMoods);
          updateLyricsComposerDetailsPreview();
        });
      }
      const saveBtn = $("btn-lyrics-accordion-save");
      if (saveBtn && saveBtn.dataset.bound !== "1") {
        saveBtn.dataset.bound = "1";
        saveBtn.addEventListener("click", () => {
          const mainSave = $("btn-save-lyrics");
          if (mainSave) mainSave.click();
        });
      }
      const analyzeBtn = $("btn-lyrics-mobile-analyze");
      if (analyzeBtn && analyzeBtn.dataset.bound !== "1") {
        analyzeBtn.dataset.bound = "1";
        analyzeBtn.addEventListener("click", () => {
          if (typeof analyzeLyrics === "function") analyzeLyrics();
        });
      }
      const quickAdd = $("lyrics-quick-add-mobile");
      if (quickAdd && quickAdd.dataset.bound !== "1") {
        quickAdd.dataset.bound = "1";
        quickAdd.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-add-type]");
          if (!btn) return;
          addLyricBlockOfType(btn.dataset.addType);
          requestAnimationFrame(() => scrollLyricsComposerToTab("blocks"));
        });
      }
      const tabs = $("lyrics-composer-tabs");
      if (tabs && tabs.dataset.bound !== "1") {
        tabs.dataset.bound = "1";
        tabs.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-lyrics-tab]");
          if (!btn) return;
          scrollLyricsComposerToTab(btn.dataset.lyricsTab);
        });
      }
      syncLyricsComposerMobileUi();
      window.addEventListener("resize", () => {
        placeLyricsBlockListForLayout();
        syncLyricsComposerMobileUi();
        if (isMobileChromeLayout()) {
          autoResizeAllLyricTextareas();
          autoResizeLyricsMainInput();
        }
      }, { passive: true });
    }
    var LYRICS_FLOAT_FADE_DELAY_MS = 2400;
    var LYRICS_FLOAT_LEAVE_DELAY_MS = 1400;
    var lyricsFloatFadeTimer = null;
    var lyricsFloatBound = false;

    function clearLyricsEditorFloatFadeTimer() {
      if (lyricsFloatFadeTimer) {
        clearTimeout(lyricsFloatFadeTimer);
        lyricsFloatFadeTimer = null;
      }
    }

    function snapLyricsEditorFloatBright() {
      const el = $("lyrics-editor-float");
      if (!el || el.hidden) return;
      clearLyricsEditorFloatFadeTimer();
      el.classList.add("is-bright", "lyrics-editor-float--snap");
      // Keep the short rise transition, then restore soft fade timing.
      if (el._lyricsFloatSnapClear) clearTimeout(el._lyricsFloatSnapClear);
      el._lyricsFloatSnapClear = setTimeout(() => {
        el._lyricsFloatSnapClear = null;
        el.classList.remove("lyrics-editor-float--snap");
      }, 140);
    }

    function scheduleLyricsEditorFloatFade(delayMs) {
      const el = $("lyrics-editor-float");
      if (!el || el.hidden) return;
      clearLyricsEditorFloatFadeTimer();
      lyricsFloatFadeTimer = setTimeout(() => {
        lyricsFloatFadeTimer = null;
        if (el.matches(":hover") || el.contains(document.activeElement)) return;
        el.classList.remove("is-bright", "lyrics-editor-float--snap");
      }, delayMs);
    }

    function syncLyricsEditorFloatPresence(visible) {
      const el = $("lyrics-editor-float");
      if (!el) return;
      if (!visible) {
        clearLyricsEditorFloatFadeTimer();
        el.classList.remove("is-bright", "lyrics-editor-float--snap", "is-expanded");
        const fab = $("lyrics-editor-float-fab");
        if (fab) {
          fab.setAttribute("aria-expanded", "false");
          fab.setAttribute("aria-label", "Open lyrics actions");
        }
        return;
      }
      // First show / route enter: fully visible, then countdown to fade.
      snapLyricsEditorFloatBright();
      scheduleLyricsEditorFloatFade(LYRICS_FLOAT_FADE_DELAY_MS);
      if (lyricsFloatBound) return;
      lyricsFloatBound = true;
      el.addEventListener("pointerenter", () => {
        snapLyricsEditorFloatBright();
      });
      el.addEventListener("pointerleave", () => {
        if (el.classList.contains("is-expanded") && isMobileChromeLayout()) return;
        scheduleLyricsEditorFloatFade(LYRICS_FLOAT_LEAVE_DELAY_MS);
      });
      el.addEventListener("focusin", () => {
        snapLyricsEditorFloatBright();
      });
      el.addEventListener("focusout", () => {
        // Wait a tick so focus moving between buttons doesn't flicker.
        setTimeout(() => {
          if (!el.contains(document.activeElement) && !el.matches(":hover")) {
            if (el.classList.contains("is-expanded") && isMobileChromeLayout()) return;
            scheduleLyricsEditorFloatFade(LYRICS_FLOAT_LEAVE_DELAY_MS);
          }
        }, 0);
      });

      const fab = $("lyrics-editor-float-fab");
      if (fab && !fab.dataset.bound) {
        fab.dataset.bound = "1";
        fab.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isMobileChromeLayout()) return;
          const open = !el.classList.contains("is-expanded");
          setLyricsEditorFloatExpanded(open);
          snapLyricsEditorFloatBright();
          if (!open) scheduleLyricsEditorFloatFade(LYRICS_FLOAT_LEAVE_DELAY_MS);
        });
      }
      if (!window.__lyricsFloatMenuDismissBound) {
        window.__lyricsFloatMenuDismissBound = true;
        document.addEventListener("pointerdown", (e) => {
          if (!isMobileChromeLayout()) return;
          const floatEl = $("lyrics-editor-float");
          if (!floatEl || floatEl.hidden || !floatEl.classList.contains("is-expanded")) return;
          if (floatEl.contains(e.target)) return;
          setLyricsEditorFloatExpanded(false);
          scheduleLyricsEditorFloatFade(LYRICS_FLOAT_LEAVE_DELAY_MS);
        }, true);
        document.addEventListener("keydown", (e) => {
          if (e.key !== "Escape") return;
          const floatEl = $("lyrics-editor-float");
          if (!floatEl || !floatEl.classList.contains("is-expanded")) return;
          setLyricsEditorFloatExpanded(false);
        });
      }
    }

    function setLyricsEditorFloatExpanded(open) {
      const el = $("lyrics-editor-float");
      const fab = $("lyrics-editor-float-fab");
      if (!el) return;
      el.classList.toggle("is-expanded", !!open);
      if (fab) {
        fab.setAttribute("aria-expanded", open ? "true" : "false");
        fab.setAttribute("aria-label", open ? "Close lyrics actions" : "Open lyrics actions");
      }
    }

    $("btn-analyze-lyrics").addEventListener("click", () => {
      analyzeLyrics();
      if (isMobileChromeLayout()) setLyricsEditorFloatExpanded(false);
    });
    $("btn-analyze-lyrics-overlay") && $("btn-analyze-lyrics-overlay").addEventListener("click", () => { analyzeLyrics(); });
    $("lyrics-quick-add") && $("lyrics-quick-add").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-add-type]");
      if (!btn) return;
      addLyricBlockOfType(btn.dataset.addType);
    });
    $("btn-add-lyric-block") && $("btn-add-lyric-block").addEventListener("click", () => addLyricBlockOfType("verse"));

    /** Strip leftover section markers from block body (e.g. [Verse 1], (Chorus), Verse:). */
    function tidyLyricBlockText(raw) {
      let lines = String(raw || "").replace(/[ \t]+$/gm, "").split("\n");
      while (lines.length && LYRIC_STRUCTURE_HEADER_RE.test(String(lines[0] || "").trim())) {
        lines = lines.slice(1);
      }
      lines = lines.filter((line) => {
        const t = String(line || "").trim();
        if (!t) return true;
        return !LYRIC_STRUCTURE_HEADER_RE.test(t);
      });
      return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    function tidyLyricsInEditor(opts) {
      const quiet = !!(opts && opts.quiet);
      if (lyricBlocks.length) {
        flushLyricBlocksFromDom();
        lyricBlocks = lyricBlocks.map((block, index) => ({
          ...block,
          title: lyricBlockSectionTitle(block, index),
          text: formatLyricsFirstLetters(tidyLyricBlockText(block.text)),
        }));
        renderLyrics({ writeBack: true });
      } else {
        const input = $("lyrics-input");
        if (!input || !String(input.value || "").trim()) {
          if (!quiet) setLyricsStatus("Add lyrics first.", "error");
          return false;
        }
        input.value = formatLyricsFirstLetters(tidyLyricBlockText(input.value));
        autoResizeLyricsMainInput();
        updateLyricsWordStats();
      }
      if (!quiet) {
        setLyricsStatus("Tidied casing and spacing.", "ok");
      }
      return true;
    }

    function setLyricsClearLidOpen(open) {
      const clearBtn = $("btn-clear-lyrics");
      const confirmBtn = $("lyrics-clear-confirm");
      if (clearBtn) clearBtn.classList.toggle("is-lid-open", !!open);
      if (confirmBtn) confirmBtn.classList.toggle("is-lid-open", !!open);
    }

    function openLyricsClearModal() {
      setLyricsClearLidOpen(true);
      setUiOverlayOpen($("lyrics-clear-modal"), true);
    }

    function closeLyricsClearModal() {
      setUiOverlayOpen($("lyrics-clear-modal"), false);
      setLyricsClearLidOpen(false);
    }

    function confirmLyricsClear() {
      closeLyricsClearModal();
      pushComposerUndoCheckpoint();
      resetComposerEditorEmpty({ preserveUndo: true });
      setLyricsStatus("Editor cleared.", "");
    }

    $("btn-undo-lyrics") && $("btn-undo-lyrics").addEventListener("click", () => {
      undoComposerLastEdit();
    });
    $("btn-clear-lyrics") && $("btn-clear-lyrics").addEventListener("click", () => {
      if (isMobileChromeLayout()) setLyricsEditorFloatExpanded(false);
      if (!composerEditorHasContentToClear()) {
        setLyricsStatus("Nothing to clear.", "");
        return;
      }
      openLyricsClearModal();
    });
    $("lyrics-clear-cancel") && $("lyrics-clear-cancel").addEventListener("click", closeLyricsClearModal);
    $("lyrics-clear-close") && $("lyrics-clear-close").addEventListener("click", closeLyricsClearModal);
    $("lyrics-clear-backdrop") && $("lyrics-clear-backdrop").addEventListener("click", closeLyricsClearModal);
    $("lyrics-clear-confirm") && $("lyrics-clear-confirm").addEventListener("click", confirmLyricsClear);

    function flushLyricBlocksFromDom() {
      document.querySelectorAll("#lyrics-block-list .lyric-block").forEach((card) => {
        const block = lyricBlocks.find((b) => b.id === card.dataset.id);
        if (!block) return;
        const ta = card.querySelector('[data-action="text"]');
        if (ta) block.text = ta.value;
        const sel = card.querySelector('[data-action="type"]');
        if (sel) block.type = sel.value;
        const index = lyricBlocks.findIndex((b) => b.id === block.id);
        if (index >= 0) block.title = lyricBlockSectionTitle(block, index);
      });
    }

    var songSaveMoodSearchTitle = "";

    function closeSongSaveMoodModal() {
      setUiOverlayOpen($("song-save-mood-modal"), false);
      songSaveMoodSearchTitle = "";
    }

    function buildExternalGoogleSearchUrl(query) {
      const q = String(query || "").trim();
      if (!q) return "";
      return "https://www.google.com/search?" + new URLSearchParams({ q, hl: "en" }).toString();
    }

    function buildInBrowserGoogleSearchUrl(queryOrGoogleUrl) {
      const raw = String(queryOrGoogleUrl || "").trim();
      if (!raw) return "";
      let query = raw;
      if (/^https?:\/\//i.test(raw)) {
        try {
          const parsed = new URL(raw);
          query = parsed.searchParams.get("q") || raw;
        } catch (_e) {
          query = raw;
        }
      }
      query = String(query || "").trim();
      if (!query) return "";
      // Same-origin bridge page — avoids iOS/Android handing google.com to the Google app.
      return "/go/google-search?" + new URLSearchParams({ q: query }).toString();
    }

    function openExternalGoogleSearch(queryOrUrl) {
      const bridgeUrl = buildInBrowserGoogleSearchUrl(queryOrUrl);
      if (!bridgeUrl) return;
      const a = document.createElement("a");
      a.href = bridgeUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function buildSongMoodGoogleQuery(title, language) {
      const titleForSearch = songTitleWithLanguageForSearch(title, language);
      return "what is the mood of this song " + titleForSearch + " ?";
    }

    function openSongMoodGoogleSearch() {
      const metaOpen = $("song-metadata-modal") && $("song-metadata-modal").classList.contains("is-open");
      let title = "";
      let lang = "";
      if (metaOpen) {
        title = normalizeSongTitleInput($("song-metadata-edit-title"));
        lang = ($("song-metadata-edit-language") && $("song-metadata-edit-language").value) || "";
      }
      if (!title) title = songSaveMoodSearchTitle || normalizeSongTitleInput($("lyrics-save-title"));
      if (!lang) lang = getComposerSongLanguage();
      if (!title) return;
      if (!lang) {
        const hint = metaOpen ? null : $("song-save-mood-hint");
        if (hint) hint.textContent = "Select a language on the lyrics card, then search again.";
        else setLyricsStatus("Select a language before searching mood.", "error");
        return;
      }
      const query = buildSongMoodGoogleQuery(title, lang);
      openExternalGoogleSearch(query);
    }

    function resetSongSaveSuccessModal() {
      const loading = $("song-save-result-loading");
      const success = $("song-save-result-success");
      const footer = $("song-save-success-footer");
      const closeBtn = $("song-save-success-close");
      const undoBtn = $("song-save-success-undo");
      const check = $("song-save-result-check");
      if (loading) {
        loading.hidden = false;
        loading.classList.remove("is-hiding");
      }
      if (success) {
        success.hidden = true;
        success.classList.remove("is-visible");
      }
      if (footer) footer.hidden = true;
      if (closeBtn) closeBtn.hidden = true;
      if (undoBtn) {
        undoBtn.hidden = true;
        undoBtn.disabled = false;
        undoBtn.dataset.undoToken = "";
      }
      if (check) {
        check.querySelectorAll(".song-save-result__check-circle, .song-save-result__check-mark").forEach((el) => {
          el.style.animation = "none";
          el.getBoundingClientRect();
          el.style.animation = "";
        });
      }
    }

    function closeSongSaveSuccessModal() {
      setUiOverlayOpen($("song-save-success-modal"), false);
      window.setTimeout(resetSongSaveSuccessModal, 280);
    }

    function showSongSaveProgressModal(title) {
      resetSongSaveSuccessModal();
      const loadingTitle = $("song-save-loading-title");
      const loadingDesc = $("song-save-loading-desc");
      if (loadingTitle) loadingTitle.textContent = "Saving song…";
      if (loadingDesc) {
        loadingDesc.textContent = title
          ? "Saving \"" + title + "\" to your library…"
          : "Adding to your library…";
      }
      setUiOverlayOpen($("song-save-success-modal"), true);
    }

    function showSongSaveSuccessState(message, heading, opts) {
      const options = opts || {};
      const loading = $("song-save-result-loading");
      const success = $("song-save-result-success");
      const footer = $("song-save-success-footer");
      const closeBtn = $("song-save-success-close");
      const undoBtn = $("song-save-success-undo");
      const desc = $("song-save-success-desc");
      const titleEl = $("song-save-success-title");
      if (titleEl) titleEl.textContent = heading || "Song saved";
      if (desc) desc.textContent = message || "Your song has been saved to the library.";
      if (undoBtn) {
        const token = String(options.undoToken || "").trim();
        undoBtn.hidden = !token;
        undoBtn.disabled = false;
        undoBtn.dataset.undoToken = token;
        if (token) undoBtn.textContent = "Undo import";
        undoBtn.setAttribute("aria-hidden", token ? "false" : "true");
      }
      const reveal = () => {
        if (loading) {
          loading.hidden = true;
          loading.classList.remove("is-hiding");
        }
        if (success) {
          success.hidden = false;
          requestAnimationFrame(() => success.classList.add("is-visible"));
        }
        if (footer) footer.hidden = false;
        if (closeBtn) closeBtn.hidden = false;
      };
      if (loading && !loading.hidden) {
        loading.classList.add("is-hiding");
        window.setTimeout(reveal, 40);
      } else {
        reveal();
      }
    }

    function showSongSaveSuccessModal(message, heading, opts) {
      showSongSaveSuccessState(message, heading, opts);
      setUiOverlayOpen($("song-save-success-modal"), true);
    }

    function openSongSaveMoodModal(title) {
      // Mood confirm folded into Edit Details / Save card.
      openComposerSongDetailsModal({ intent: "save", titleHint: title });
    }

    function willSaveAsParishVersion(title, matches) {
      if (churchMembershipState && churchMembershipState.is_superadmin) return false;
      if (!userHasParishForLyrics()) return false;
      const list = matches || findExistingCatalogSongMatches(title);
      return list.length > 0;
    }

    async function performSaveLyrics() {
      const title = normalizeSongTitleInput($("lyrics-save-title"));
      tidyLyricsInEditor({ quiet: true });
      if (lyricBlocks.length) {
        flushLyricBlocksFromDom();
        syncStructuredEditorToInputPanel();
      } else if ($("lyrics-input").value.trim()) {
        syncInputPanelToStructuredEditor({ quiet: true, writeBack: false });
      }
      const lyrics = applyLyricsFirstLettersToEditor();
      const saveSection = ($("lyrics-save-section") && $("lyrics-save-section").value) || "";
      const saveLanguage = ($("lyrics-save-language") && $("lyrics-save-language").value) || "";
      showSongSaveProgressModal(title);
      if ($("btn-save-lyrics")) $("btn-save-lyrics").disabled = true;
      try {
        const result = await postJSON("/api/lyrics/save", {
          title,
          lyrics,
          sections: [saveSection || "meditation"],
          language: saveLanguage,
          author: ($("lyrics-save-author") && $("lyrics-save-author").value.trim()) || "",
          gospel_moods: getComposerSongMoods(),
          audio_media: serializeSongMediaRef(typeof composerYoutubeRef === "function" ? composerYoutubeRef() : composerSongMedia.audio),
          video_media: composerSongMedia.video
            ? { basename: composerSongMedia.video.basename, display_name: composerSongMedia.video.display_name || composerSongMedia.video.basename }
            : null,
          audio_preview: serializeAudioPreviewRef(typeof composerAudioSnippetRef === "function" ? composerAudioSnippetRef() : composerSongMedia.preview),
        });
        const created = result.created || [];
        const updated = result.updated || [];
        const isNew = created.length > 0;
        const savedSection =
          result.section ||
          (Array.isArray(result.sections) && result.sections[0]) ||
          saveSection ||
          "meditation";
        let msg;
        let heading;
        if (result.pending && (result.parish_original || result.parish_version || result.id)) {
          msg = result.message || "Saved to your parish catalog and submitted for superadmin approval.";
          heading = "Saved to parish catalog";
          composerParishVersion = true;
          if (result.id) {
            composerLoadedSong = { section: savedSection, id: result.id, title: result.title || title };
          }
          updateParishLyricsControls();
        } else if (result.pending) {
          msg = result.message || "Song submitted for superadmin approval.";
          heading = "Submitted for review";
        } else if (result.parish_version) {
          msg = result.message || ("Saved parish version of " + (result.title || title) + ".");
          heading = "Parish version saved";
          composerParishVersion = true;
          if (result.id) {
            composerLoadedSong = { section: savedSection, id: result.id, title: result.title || title };
          }
          updateParishLyricsControls();
          void refreshComposerCatalogBaseline(savedSection, result.id || (composerLoadedSong && composerLoadedSong.id));
        } else {
          msg = "Saved lyrics for " + result.title + " in " + songSectionLabel(savedSection) + ".";
          heading = "Song saved";
        }
        if (savedSection) setComposerSongSection(savedSection);
        pushSongHistory({
          title: result.title || title,
          section: savedSection,
          id: result.id || "",
          language: saveLanguage,
          kind: isNew || result.parish_original ? "new" : "lyrics_updated",
        });
        if (result.id) {
          composerLoadedSong = { section: savedSection, id: result.id, title: result.title || title };
          if (saveLanguage) setComposerSongLanguage(saveLanguage);
        }
        // Parish-original + pending still belongs in the parish catalog UI.
        if (!result.pending || result.id) {
          mergeSavedSongIntoLocalCatalog(Object.assign({}, result, { pending: false }));
          renderSongCatalog();
          document.dispatchEvent(new CustomEvent("verbum:song-catalog-changed"));
          void loadSongCatalog(true);
        } else {
          invalidateSongCatalogCaches();
        }
        setLyricsStatus(msg, "ok");
        showSongSaveSuccessState(msg, heading);
      } catch (error) {
        closeSongSaveSuccessModal();
        setLyricsStatus(error.message || "Could not save lyrics.", "error");
      } finally {
        if ($("btn-save-lyrics")) $("btn-save-lyrics").disabled = false;
      }
    }

    var songSavePendingTitle = "";

    function findExistingCatalogSongMatches(title) {
      if (!songCatalogData || !title) return [];
      const ttl = String(title || "").trim().toLowerCase();
      if (!ttl) return [];
      const matches = [];
      SECTION_ORDER.forEach(({ key: sec }) => {
        (songCatalogData[sec] || []).forEach((row) => {
          const rowTitle = String(row.title || "").trim().toLowerCase();
          if (rowTitle !== ttl) return;
          matches.push({
            section: sec,
            id: String(row.id || "").trim(),
            title: String(row.title || "").trim(),
            language: String(row.language || "").trim(),
          });
        });
      });
      return matches;
    }

    function shouldConfirmSongOverwrite(title, saveSection, matches) {
      if (!matches.length) return false;
      const ttl = String(title || "").trim().toLowerCase();
      const sec = String(saveSection || "").trim().toLowerCase();
      if (composerLoadedSong) {
        const loadedTitle = String(composerLoadedSong.title || "").trim().toLowerCase();
        const loadedSec = String(composerLoadedSong.section || "").trim().toLowerCase();
        if (loadedTitle === ttl && loadedSec === sec) return false;
      }
      return true;
    }

    function closeSongSaveOverwriteModal() {
      setUiOverlayOpen($("song-save-overwrite-modal"), false);
      songSavePendingTitle = "";
    }

    function openSongSaveOverwriteModal(title, matches, saveSection) {
      songSavePendingTitle = String(title || "").trim();
      const descEl = $("song-save-overwrite-desc");
      const listEl = $("song-save-overwrite-list");
      const targetLabel = songSectionLabel(saveSection);
      if (descEl) {
        descEl.textContent = matches.length === 1
          ? "\"" + songSavePendingTitle + "\" is already in your library. Overwriting will replace that entry and save to " + targetLabel + "."
          : "\"" + songSavePendingTitle + "\" matches " + matches.length + " library entries. Overwriting will replace them and save to " + targetLabel + ".";
      }
      if (listEl) {
        listEl.innerHTML = matches.map((m) => (
          "<li><strong>" + escapeHtml(m.title) + "</strong><span>" +
          escapeHtml(songSectionLabel(m.section)) +
          (m.language ? " · " + escapeHtml(m.language) : "") +
          "</span></li>"
        )).join("");
      }
      setUiOverlayOpen($("song-save-overwrite-modal"), true);
    }

    function proceedToSongSaveMoodFlow(title) {
      if (!getComposerSongLanguage()) {
        setLyricsStatus("Select a language before saving.", "error");
        if ($("lyrics-save-language")) $("lyrics-save-language").focus();
        return;
      }
      openSongSaveMoodModal(title);
    }

    function confirmSongSaveOverwrite() {
      const title = songSavePendingTitle || normalizeSongTitleInput($("lyrics-save-title"));
      closeSongSaveOverwriteModal();
      if (title) performSaveLyrics();
    }

    $("btn-save-lyrics") && $("btn-save-lyrics").addEventListener("click", async () => {
      if (isMobileChromeLayout()) setLyricsEditorFloatExpanded(false);
      tidyLyricsInEditor({ quiet: true });
      if (lyricBlocks.length) {
        flushLyricBlocksFromDom();
        syncStructuredEditorToInputPanel();
      } else if ($("lyrics-input") && $("lyrics-input").value.trim()) {
        syncInputPanelToStructuredEditor({ quiet: true, writeBack: false });
      }
      const lyrics = serializedLyrics();
      if (!lyrics) {
        setLyricsStatus("Add lyrics before saving.", "error");
        return;
      }
      if (!songCatalogLoaded || !songCatalogData) {
        await loadSongCatalog(true);
      }
      const title = normalizeSongTitleInput($("lyrics-save-title"));
      const matches = findExistingCatalogSongMatches(title);
      if (title && getComposerSongLanguage() && willSaveAsParishVersion(title, matches)) {
        await performSaveLyrics();
        return;
      }
      openComposerSongDetailsModal({ intent: "save" });
    });

    $("lyrics-save-title") && $("lyrics-save-title").addEventListener("blur", () => {
      normalizeSongTitleInput($("lyrics-save-title"));
    });
    $("song-metadata-edit-title") && $("song-metadata-edit-title").addEventListener("blur", () => {
      normalizeSongTitleInput($("song-metadata-edit-title"));
    });

    $("lyrics-input") && $("lyrics-input").addEventListener("paste", () => {
      const ta = $("lyrics-input");
      if (!ta) return;
      const wasEmpty = !String(ta.value || "").trim();
      if (!wasEmpty) return;
      window.setTimeout(() => {
        if (!String(($("lyrics-input") && $("lyrics-input").value) || "").trim()) return;
        const modal = $("song-metadata-modal");
        if (modal && modal.classList.contains("is-open")) return;
        openComposerSongDetailsModal({ intent: "paste" });
      }, 0);
    });

    // Built-in deck themes for Mass PPTX generation (generators/powerpoint.py).
    // Theme 1 = LiturgyFlow (amber). Themes 2–3 are strict mono black/white.
    // Divider style is independent: divider1 (classic) | divider2 (Stone & Light) | divider3 (Gospel).
    var DECK_THEME_DEFAULT_KEY = "verbumDefaultDeckThemeId";
    var DECK_THEME_SESSION_KEY = "verbumDeckThemePrompted";
    var DIVIDER_STYLE_DEFAULT_KEY = "verbumDefaultDividerStyle";
    var DIVIDER_STYLES = {
      divider1: { id: "divider1", name: "Classic", note: "Celebrant left, gospel quote card, bottom title bar." },
      divider2: { id: "divider2", name: "Stone & Light", note: "Gospel quote with citation, celebrant on the right, bold title." },
      divider3: { id: "divider3", name: "Gospel", note: "Sunday title and celebrant on the left, gospel quote on the right panel." },
    };
    var presetThemes = [
      {
        id: "theme1",
        name: "LiturgyFlow",
        note: "Black background with amber titles. Dividers follow the liturgical season.",
        bg: "#000000",
        primary: "#f0fdf4",
        accent: "#ffb800",
        text: "#f0fdf4",
        font: "Arial, Helvetica, sans-serif",
      },
      {
        id: "theme2",
        name: "Midnight",
        note: "Black background. All text white, including titles and Mass dividers.",
        bg: "#000000",
        primary: "#ffffff",
        accent: "#ffffff",
        text: "#ffffff",
        font: "Arial, Helvetica, sans-serif",
      },
      {
        id: "theme3",
        name: "Paper",
        note: "White background. All text black, including titles and Mass dividers.",
        bg: "#ffffff",
        primary: "#000000",
        accent: "#000000",
        text: "#000000",
        font: "Arial, Helvetica, sans-serif",
      },
    ];
    var activeTheme = presetThemes[0];
    var activeDividerStyle = "divider1";
    var customThemes = [];
    var deckThemeModalMode = "startup"; // "startup" | "review"
    var deckThemeModalPendingId = "theme1";
    var deckDividerModalPendingId = "divider1";

    function findPresetTheme(id) {
      const tid = String(id || "").trim().toLowerCase();
      return presetThemes.find((t) => t.id === tid) || presetThemes[0];
    }

    function findDividerStyle(id) {
      const key = String(id || "").trim().toLowerCase();
      // Auto was removed from the chooser; map legacy "auto" to Classic.
      if (key === "auto") return DIVIDER_STYLES.divider1;
      return DIVIDER_STYLES[key] || DIVIDER_STYLES.divider1;
    }

    function pptThemePayload(theme) {
      return {
        id: theme.id,
        name: theme.name,
        bg: theme.bg,
        primary: theme.primary,
        accent: theme.accent,
        text: theme.text,
        font: theme.font,
      };
    }

    function syncDeckThemeHiddenInput() {
      const el = $("flow-deck-theme");
      if (el) el.value = activeTheme.id;
      const divEl = $("flow-divider-style");
      if (divEl) divEl.value = activeDividerStyle;
    }

    function paintMiniDeckThemePreview(root, theme) {
      if (!root || !theme) return;
      root.setAttribute("data-theme-id", theme.id);
      root.style.background = theme.bg;
      const kicker = root.querySelector(".mw-dt-kicker") || $("mw-deck-theme-preview-kicker");
      const title = root.querySelector(".mw-dt-title") || $("mw-deck-theme-preview-title");
      const body = root.querySelector(".mw-dt-body") || $("mw-deck-theme-preview-body");
      const ink = theme.text || theme.primary;
      const accent = theme.accent || ink;
      if (kicker) kicker.style.color = ink;
      if (title) title.style.color = accent;
      if (body) body.style.color = ink;
    }

    function updateReviewDeckThemeSummary() {
      const nameEl = $("mw-deck-theme-name");
      const noteEl = $("mw-deck-theme-note");
      const divNote = $("mw-deck-divider-note");
      if (nameEl) nameEl.textContent = activeTheme.name;
      if (noteEl) noteEl.textContent = activeTheme.note || "";
      if (divNote) {
        const d = findDividerStyle(activeDividerStyle);
        divNote.textContent = d.name;
      }
      paintMiniDeckThemePreview($("mw-deck-theme-preview"), activeTheme);
      syncDeckThemeHiddenInput();
      if (typeof syncMassDefaultPins === "function") syncMassDefaultPins();
    }

    function updateThemeIndicators() {
      const activeName = $("active-theme-name");
      if (activeName) activeName.textContent = activeTheme.name;
      const pptTheme = $("ppt-theme-indicator");
      if (pptTheme) pptTheme.textContent = activeTheme.name;
      try {
        localStorage.setItem("activePptTheme", JSON.stringify(activeTheme));
        localStorage.setItem("activeDividerStyle", activeDividerStyle);
      } catch (_e) { /* ignore */ }
      updateReviewDeckThemeSummary();
    }

    function setActiveDividerStyle(styleOrId, options) {
      const o = options || {};
      const style = findDividerStyle(styleOrId);
      activeDividerStyle = style.id;
      updateThemeIndicators();
      if (o.saveDefault) {
        try { localStorage.setItem(DIVIDER_STYLE_DEFAULT_KEY, activeDividerStyle); } catch (_e) { /* ignore */ }
      }
      if (typeof window.scheduleMassBuilderDraftAutoSave === "function") {
        window.scheduleMassBuilderDraftAutoSave();
      }
      return activeDividerStyle;
    }

    function setActiveDeckTheme(themeOrId, options) {
      const o = options || {};
      const theme = typeof themeOrId === "string" ? findPresetTheme(themeOrId) : (themeOrId || presetThemes[0]);
      activeTheme = theme;
      updateThemeIndicators();
      applyThemeToPreview($("theme-live-preview"), activeTheme);
      if (o.saveDefault) {
        try { localStorage.setItem(DECK_THEME_DEFAULT_KEY, activeTheme.id); } catch (_e) { /* ignore */ }
      }
      if (typeof window.scheduleMassBuilderDraftAutoSave === "function") {
        window.scheduleMassBuilderDraftAutoSave();
      }
      return activeTheme;
    }

    function applyThemeToPreview(el, theme) {
      if (!el || !theme) return;
      el.style.setProperty("--slide-bg", theme.bg);
      el.style.setProperty("--slide-primary", theme.primary);
      el.style.setProperty("--slide-accent", theme.accent);
      el.style.setProperty("--slide-text", theme.text);
      el.style.setProperty("--slide-font", theme.font);
    }

    function selectDeckThemeOption(themeId) {
      deckThemeModalPendingId = findPresetTheme(themeId).id;
      const grid = $("deck-theme-grid");
      if (!grid) return;
      grid.querySelectorAll(".deck-theme-option").forEach((btn) => {
        const selected = btn.getAttribute("data-theme-id") === deckThemeModalPendingId;
        btn.classList.toggle("is-selected", selected);
        btn.setAttribute("aria-checked", selected ? "true" : "false");
      });
    }

    function selectDividerStyleOption(styleId) {
      deckDividerModalPendingId = findDividerStyle(styleId).id;
      const grid = $("deck-divider-grid");
      if (!grid) return;
      grid.querySelectorAll(".deck-divider-option").forEach((btn) => {
        const selected = btn.getAttribute("data-divider-style") === deckDividerModalPendingId;
        btn.classList.toggle("is-selected", selected);
        btn.setAttribute("aria-checked", selected ? "true" : "false");
      });
    }

    function closeDeckThemeChooser() {
      setUiOverlayOpen($("deck-theme-modal"), false);
    }

    function openDeckThemeChooser(options) {
      const o = options || {};
      deckThemeModalMode = o.mode === "review" ? "review" : "startup";
      const preferred = o.themeId || activeTheme.id || localStorage.getItem(DECK_THEME_DEFAULT_KEY) || "theme1";
      selectDeckThemeOption(preferred);
      const preferredDiv = o.dividerStyle || activeDividerStyle || localStorage.getItem(DIVIDER_STYLE_DEFAULT_KEY) || "divider1";
      selectDividerStyleOption(preferredDiv);
      const title = $("deck-theme-modal-title");
      const desc = $("deck-theme-modal-desc");
      const closeBtn = $("deck-theme-modal-close");
      if (title) title.textContent = deckThemeModalMode === "review" ? "Change slide theme" : "Choose your slide theme";
      if (desc) {
        desc.textContent = deckThemeModalMode === "review"
          ? "Update how this Mass deck looks. Save as default if you want it next time too."
          : "Pick how Mass slides look. You can change this later under Additional Details.";
      }
      if (closeBtn) closeBtn.hidden = deckThemeModalMode !== "review";
      setUiOverlayOpen($("deck-theme-modal"), true);
    }

    function confirmDeckThemeChoice(saveDefault) {
      setActiveDeckTheme(deckThemeModalPendingId, { saveDefault: !!saveDefault });
      setActiveDividerStyle(deckDividerModalPendingId, { saveDefault: !!saveDefault });
      try { sessionStorage.setItem(DECK_THEME_SESSION_KEY, "1"); } catch (_e) { /* ignore */ }
      closeDeckThemeChooser();
    }

    function maybePromptDeckThemeOnStartup() {
      if (typeof shouldSkipStartupPopups === "function" && shouldSkipStartupPopups()) return;
      try {
        if (sessionStorage.getItem(DECK_THEME_SESSION_KEY) === "1") return;
      } catch (_e) { /* ignore */ }
      const preferred = (() => {
        try {
          return localStorage.getItem(DECK_THEME_DEFAULT_KEY) || activeTheme.id || "theme1";
        } catch (_e2) {
          return activeTheme.id || "theme1";
        }
      })();
      const preferredDiv = (() => {
        try {
          return localStorage.getItem(DIVIDER_STYLE_DEFAULT_KEY) || activeDividerStyle || "divider1";
        } catch (_e3) {
          return activeDividerStyle || "divider1";
        }
      })();
      setActiveDeckTheme(preferred);
      setActiveDividerStyle(preferredDiv);
      openDeckThemeChooser({ mode: "startup", themeId: preferred, dividerStyle: preferredDiv });
    }

    function liturgicalPresetIdFromSeason(seasonStr) {
      const s = (seasonStr || "").toLowerCase();
      if (s.includes("advent")) return "advent";
      if (s.includes("christ") || s.includes("nativity")) return "christmas";
      if (s.includes("lent") || s.includes("ash")) return "lent";
      if (s.includes("easter") || s.includes("pentecost")) return "easter";
      return "ordinary";
    }

    function renderThemeGrid() {
      updateThemeIndicators();
      applyThemeToPreview($("theme-live-preview"), activeTheme);
    }

    (function restoreActiveDeckThemeFromStorage() {
      try {
        const raw = localStorage.getItem("activePptTheme");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id) {
            activeTheme = findPresetTheme(parsed.id);
          }
        } else {
          const def = localStorage.getItem(DECK_THEME_DEFAULT_KEY);
          if (def) activeTheme = findPresetTheme(def);
        }
        const divStored = localStorage.getItem("activeDividerStyle") || localStorage.getItem(DIVIDER_STYLE_DEFAULT_KEY);
        if (divStored) activeDividerStyle = findDividerStyle(divStored).id;
      } catch (_e) { /* ignore */ }
    })();

    (function wireDeckThemeChooser() {
      const grid = $("deck-theme-grid");
      if (grid) {
        grid.addEventListener("click", (e) => {
          const btn = e.target.closest(".deck-theme-option");
          if (!btn || !grid.contains(btn)) return;
          selectDeckThemeOption(btn.getAttribute("data-theme-id"));
        });
      }
      const divGrid = $("deck-divider-grid");
      if (divGrid) {
        divGrid.addEventListener("click", (e) => {
          const btn = e.target.closest(".deck-divider-option");
          if (!btn || !divGrid.contains(btn)) return;
          selectDividerStyleOption(btn.getAttribute("data-divider-style"));
        });
      }
      $("deck-theme-once") && $("deck-theme-once").addEventListener("click", () => confirmDeckThemeChoice(false));
      $("deck-theme-default") && $("deck-theme-default").addEventListener("click", () => confirmDeckThemeChoice(true));
      $("deck-theme-modal-close") && $("deck-theme-modal-close").addEventListener("click", closeDeckThemeChooser);
      $("deck-theme-modal-backdrop") && $("deck-theme-modal-backdrop").addEventListener("click", () => {
        if (deckThemeModalMode === "review") closeDeckThemeChooser();
      });
      $("mw-deck-theme-change") && $("mw-deck-theme-change").addEventListener("click", () => {
        openDeckThemeChooser({ mode: "review", themeId: activeTheme.id, dividerStyle: activeDividerStyle });
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const modal = $("deck-theme-modal");
        if (modal && modal.classList.contains("is-open") && deckThemeModalMode === "review") {
          closeDeckThemeChooser();
        }
      });
      window.openDeckThemeChooser = openDeckThemeChooser;
      window.maybePromptDeckThemeOnStartup = maybePromptDeckThemeOnStartup;
      window.setActiveDeckTheme = setActiveDeckTheme;
      window.setActiveDividerStyle = setActiveDividerStyle;
      window.getActiveDeckTheme = () => activeTheme;
      window.getActiveDividerStyle = () => activeDividerStyle;
      syncDeckThemeHiddenInput();
      updateReviewDeckThemeSummary();
    })();

    $("btn-close-song-preview") && $("btn-close-song-preview").addEventListener("click", closeSongPreviewPanel);
    $("song-preview-backdrop") && $("song-preview-backdrop").addEventListener("click", closeSongPreviewPanel);
    $("song-preview-body") && $("song-preview-body").addEventListener("click", (e) => {
      if (!e.target.closest("#btn-save-hymn-typo")) return;
      if (songPreviewState && songPreviewState.section) saveSongPreviewToPptx(songPreviewState.section);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("song-preview-panel") && $("song-preview-panel").classList.contains("visible")) {
        closeSongPreviewPanel();
      }
    });
    (function wirePptDeckPreview() {
      const btn = $("btn-ppt-preview-refresh");
      if (!btn) return;
      const statusEl = $("ppt-preview-status");
      const grid = $("ppt-preview-grid");
      const setStatus = (msg, cls) => {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "status" + (cls ? " " + cls : "");
      };
      let objectUrls = [];
      const revokeObjectUrls = () => {
        objectUrls.forEach((u) => {
          try { URL.revokeObjectURL(u); } catch (_e) { /* ignore */ }
        });
        objectUrls = [];
      };
      // <img src> cannot send the auth Bearer token, so /api/files/preview/* returns
      // 401. Fetch each image with auth headers and show it via an object URL instead.
      const loadAuthedImage = async (img, url) => {
        try {
          const res = await authorizedFetch(url);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          img.src = objectUrl;
        } catch (_e) {
          img.alt = "Slide image failed to load";
          img.style.minHeight = "40px";
        }
      };
      const renderImageSlides = (slides) => {
        revokeObjectUrls();
        grid.innerHTML = "";
        grid.hidden = false;
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
        grid.style.gap = "14px";
        grid.style.marginTop = "14px";
        slides.forEach((s) => {
          const fig = document.createElement("figure");
          fig.style.cssText = "margin:0;border:1px solid var(--border,#d8dee9);border-radius:10px;overflow:hidden;background:#000;";
          const img = document.createElement("img");
          img.alt = "Slide " + s.index;
          img.loading = "lazy";
          img.style.cssText = "width:100%;display:block;";
          const cap = document.createElement("figcaption");
          cap.textContent = "Slide " + s.index;
          cap.style.cssText = "font-size:0.75rem;padding:6px 8px;opacity:0.8;";
          fig.appendChild(img);
          fig.appendChild(cap);
          grid.appendChild(fig);
          loadAuthedImage(img, s.image_url);
        });
      };
      const renderTextSlides = (slides) => {
        revokeObjectUrls();
        grid.innerHTML = "";
        grid.hidden = false;
        grid.style.display = "block";
        grid.style.marginTop = "14px";
        if (!slides.length) {
          grid.innerHTML = '<p class="muted">No slides to show yet — generate a Mass deck first.</p>';
          return;
        }
        slides.forEach((s) => {
          const block = document.createElement("div");
          block.style.cssText = "border:1px solid var(--border,#d8dee9);border-radius:10px;padding:10px 12px;margin-bottom:10px;white-space:pre-wrap;font-size:0.85rem;";
          block.textContent = "Slide " + s.index + "\n" + (s.text || "");
          grid.appendChild(block);
        });
      };
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        setStatus("Rendering the actual deck… this can take a few seconds.", "");
        try {
          const data = await postJSON("/api/ppt-preview/refresh", {});
          const slides = (data && data.slides) || [];
          if (data && data.mode === "image" && slides.length) {
            renderImageSlides(slides);
          } else {
            renderTextSlides(slides);
          }
          setStatus((data && data.message) || "Preview updated.", "ok");
        } catch (err) {
          setStatus((err && err.message) || "Could not render the deck preview.", "error");
        } finally {
          btn.disabled = false;
        }
      });
    })();

    var MASS_SONG_LANG_KEY = "churchMediaMassSongLang";
    var massSongPlanLanguage = "all";

    function normSongLangToken(s) {
      return String(s || "").trim().toLowerCase();
    }

    function songMatchesPlanLangFilter(song, filter) {
      const f = normSongLangToken(filter) || "all";
      if (f === "all") return true;
      const langRaw = String(song.language || "");
      const lang = normSongLangToken(langRaw);
      if (f === "mix") {
        if (lang === "mix") return true;
        const multi = /[/&+,]|·|\benglish\b.*\btagalog\b|\btagalog\b.*\benglish\b|\blatin\b.*\b(english|tagalog)\b|\b(english|tagalog)\b.*\blatin\b/i;
        if (multi.test(langRaw)) return true;
        return false;
      }
      return lang === f;
    }

    function restoreMassSongPlanLang() {
      const sel = $("mass-song-plan-lang");
      if (!sel) return;
      let v = "all";
      try {
        v = localStorage.getItem(MASS_SONG_LANG_KEY) || "all";
      } catch (_e) {
        v = "all";
      }
      if ([...sel.options].some((o) => o.value === v)) sel.value = v;
      massSongPlanLanguage = sel.value;
    }
    var MASS_COMMUNION_MAX = 5;
    var massCommunionCount = 2;
    var lyricSongSlots = [
      { key: "entrance", label: "Entrance song", section: "entrance" },
      { key: "offertory", label: "Offertory song", section: "offertory" },
      { key: "communion_1", label: "Communion song 1", section: "communion" },
      { key: "communion_2", label: "Communion song 2", section: "communion" },
      { key: "recessional", label: "Recessional song", section: "recessional" },
    ];
    var MASS_SONG_PLAN_MAX_SECTIONS = 10;
    var massCustomSlotSeq = 0;
    var selectedLyricsSongs = { entrance: "", offertory: "", communion_1: "", communion_2: "", recessional: "" };
    var songOptionsBySection = { entrance: [], offertory: [], communion: [], recessional: [], meditation: [] };
    var flowPreviewData = null;
    var massPlanAllSongs = [];
    var massPlanSearchDebounce = null;
    var massCommunionCountTimer = null;

    function clampMassCommunionCount(n) {
      const v = parseInt(n, 10);
      if (!Number.isFinite(v)) return massCommunionCount || 2;
      return Math.max(1, Math.min(MASS_COMMUNION_MAX, v));
    }

    function communionSlotKey(n) {
      return "communion_" + n;
    }

    function communionSlotKeys(count) {
      const n = clampMassCommunionCount(count);
      const keys = [];
      for (let i = 1; i <= n; i += 1) keys.push(communionSlotKey(i));
      return keys;
    }

    function isCommunionSlotKey(key) {
      return /^communion_\d+$/.test(String(key || ""));
    }

    function inferCommunionCountFromSlots(slots) {
      let max = 0;
      (slots || lyricSongSlots || []).forEach((slot) => {
        const m = String((slot && slot.key) || "").match(/^communion_(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
      });
      return max ? clampMassCommunionCount(max) : 2;
    }

    function communionSlotDef(n) {
      return {
        key: communionSlotKey(n),
        label: "Communion song " + n,
        section: "communion",
      };
    }

    function applyCommunionCountToSlots(count) {
      const n = clampMassCommunionCount(count);
      massCommunionCount = n;
      const existing = lyricSongSlots.slice();
      const customs = existing.filter((s) => s.custom);
      const nonComm = existing.filter((s) => !s.custom && !isCommunionSlotKey(s.key));
      const communion = [];
      for (let i = 1; i <= n; i += 1) {
        const key = communionSlotKey(i);
        communion.push(existing.find((s) => s.key === key) || communionSlotDef(i));
      }
      const offIdx = nonComm.findIndex((s) => s.key === "offertory");
      const before = offIdx >= 0 ? nonComm.slice(0, offIdx + 1) : nonComm.filter((s) => s.key === "entrance");
      const after = offIdx >= 0 ? nonComm.slice(offIdx + 1) : nonComm.filter((s) => s.key !== "entrance");
      lyricSongSlots = before.concat(communion, after, customs);
      if (typeof MOOD_PICK_SECTIONS !== "undefined") {
        const spec = MOOD_PICK_SECTIONS.find((s) => s.key === "communion");
        if (spec) {
          spec.slotKeys = communionSlotKeys(n);
          spec.count = n;
        }
      }
    }

    function syncCommunionCountUi() {
      const n = clampMassCommunionCount(massCommunionCount);
      document.querySelectorAll("[data-communion-count]").forEach((btn) => {
        const val = parseInt(btn.getAttribute("data-communion-count"), 10);
        const on = val === n && (n === 1 || n === 2);
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      const input = $("mass-communion-custom");
      if (input && document.activeElement !== input) input.value = String(n);
      const custom = input && input.closest(".mass-communion-count__custom");
      if (custom) custom.classList.toggle("is-active", n >= 3);
    }

    function applyCommunionCountFromSlotsOrDraft(draft) {
      const fromDraft = draft && draft.massCommunionCount != null
        ? clampMassCommunionCount(draft.massCommunionCount)
        : 0;
      const fromSlots = inferCommunionCountFromSlots((draft && draft.lyricSongSlots) || lyricSongSlots);
      massCommunionCount = fromDraft || fromSlots || 2;
      applyCommunionCountToSlots(massCommunionCount);
      syncCommunionCountUi();
    }

    function rebuildMassPlanSongPool() {
      const byId = new Map();
      const add = (row, section, source) => {
        if (!row || typeof row !== "object") return;
        const id = String(row.id != null ? row.id : "").trim();
        const title = String(row.title || "").trim();
        if (!id || !title) return;
        if (byId.has(id)) return;
        byId.set(id, {
          id,
          title,
          author: String(row.author || "").trim(),
          language: String(row.language || "").trim(),
          has_lyrics: !!row.has_lyrics,
          gospel_moods: Array.isArray(row.gospel_moods) ? row.gospel_moods : [],
          audio_media: row.audio_media && typeof row.audio_media === "object" ? row.audio_media : null,
          video_media: row.video_media && typeof row.video_media === "object" ? row.video_media : null,
          audio_preview: row.audio_preview && typeof row.audio_preview === "object" ? row.audio_preview : null,
          section: section || "",
          source: String(source || ""),
        });
      };
      const SECS = ["entrance", "offertory", "communion", "recessional", "meditation"];
      if (songCatalogData) {
        SECS.forEach((sec) => {
          (songCatalogData[sec] || []).forEach((row) => add(row, sec, "library"));
        });
      }
      SECS.forEach((sec) => {
        (songOptionsBySection[sec] || []).forEach((row) => add(row, sec, row.source || ""));
      });
      massPlanAllSongs = Array.from(byId.values());
    }

    async function refreshMassMusicSongPlan(options) {
      const opts = options || {};
      await loadSongCatalog(opts.force !== false);
      rebuildMassPlanSongPool();
      if (typeof renderMassSongPlan === "function") renderMassSongPlan();
      if (typeof updateMassSummaryMoodPicks === "function") updateMassSummaryMoodPicks();
      lyricSongSlots.forEach((s) => updateMassSlotChip(s.key));
      if (typeof renderFlowSongCount === "function") renderFlowSongCount();
    }
    window.refreshMassMusicSongPlan = refreshMassMusicSongPlan;

    function mergeSavedSongIntoLocalCatalog(result) {
      if (!result || !result.id) return;
      if (result.pending && !result.parish_original && !result.parish_version) return;
      const SECS = ["entrance", "offertory", "communion", "recessional", "meditation"];
      if (!songCatalogData) {
        songCatalogData = {};
        SECS.forEach((sec) => { songCatalogData[sec] = []; });
      }
      const section =
        result.section ||
        (Array.isArray(result.sections) && result.sections[0]) ||
        ($("lyrics-save-section") && $("lyrics-save-section").value) ||
        "meditation";
      const sec = String(section).trim().toLowerCase();
      if (!SECS.includes(sec)) return;
      if (!Array.isArray(songCatalogData[sec])) songCatalogData[sec] = [];
      const id = String(result.id).trim();
      const titleKey = String(result.title || "").trim().toLowerCase();
      SECS.forEach((otherSec) => {
        if (otherSec === sec || !Array.isArray(songCatalogData[otherSec])) return;
        songCatalogData[otherSec] = songCatalogData[otherSec].filter((r) => {
          const rid = String(r.id || "").trim();
          const rtitle = String(r.title || "").trim().toLowerCase();
          if (id && rid === id) return false;
          if (titleKey && rtitle === titleKey) return false;
          return true;
        });
      });
      const row = {
        id,
        title: String(result.title || "").trim(),
        author: ($("lyrics-save-author") && $("lyrics-save-author").value.trim()) || "",
        language: ($("lyrics-save-language") && $("lyrics-save-language").value) || "",
        has_lyrics: true,
        gospel_moods: getComposerSongMoods(),
        parish_only: !!(result.parish_original || result.parish_only),
        pending_global: !!result.pending,
        audio_media: normalizeComposerMediaRef(
          (result && result.audio_media) || (composerSongMedia && composerSongMedia.audio)
        ),
        video_media: normalizeComposerMediaRef(
          (result && result.video_media) || (composerSongMedia && composerSongMedia.video)
        ),
        audio_preview: normalizeAudioPreviewRef(
          (result && result.audio_preview) || (composerSongMedia && composerSongMedia.preview)
        ),
      };
      const idx = songCatalogData[sec].findIndex((r) => String(r.id) === id);
      if (idx >= 0) songCatalogData[sec][idx] = Object.assign({}, songCatalogData[sec][idx], row);
      else songCatalogData[sec].unshift(row);
      songCatalogLoaded = true;
      rebuildMassPlanSongPool();
    }

    function filterMassPlanSongs(query) {
      const needle = (query || "").trim().toLowerCase();
      return massPlanAllSongs.filter((row) => {
        if (!songMatchesPlanLangFilter(row, massSongPlanLanguage)) return false;
        if (!needle) return true;
        const blob = [row.title, row.author, row.language, row.section, row.id, row.source].join(" ").toLowerCase();
        return blob.includes(needle);
      }).slice(0, 100);
    }

    function updateMassSlotChip(key) {
      const cards = document.querySelectorAll(".mass-song-plan-card[data-slot-key=\"" + key + "\"]");
      if (!cards.length) return;
      const id = selectedLyricsSongs[key] || "";
      let rowData = id ? massPlanAllSongs.find((s) => String(s.id) === String(id)) : null;
      if (id && !rowData) {
        rebuildMassPlanSongPool();
        rowData = massPlanAllSongs.find((s) => String(s.id) === String(id));
      }
      const missingLyrics = !!(id && rowData && !rowData.has_lyrics);
      cards.forEach((row) => {
        const titleEl = row.querySelector(".mass-song-plan-card__title");
        const statusEl = row.querySelector(".mass-song-plan-card__meta");
        const alertEl = row.querySelector(".mass-song-alert-host");
        const badgeEl = row.querySelector(".mass-song-plan-card__badge");
        const clearBtn = row.querySelector("[data-mass-song-clear]");
        if (!titleEl) return;
        row.classList.toggle("has-selection", !!id);
        row.classList.toggle("mass-song-slot--missing-lyrics", missingLyrics);
        if (badgeEl) badgeEl.hidden = !id;
        if (clearBtn) clearBtn.hidden = !id;
        if (titleEl) {
          titleEl.classList.toggle("is-audio-linkable", !!id);
          if (id) {
            titleEl.setAttribute("role", "button");
            titleEl.setAttribute("tabindex", "0");
            titleEl.title = "Click to view lyrics"
              + (document.body.classList.contains("is-superadmin") ? " and link audio" : "");
          } else {
            titleEl.removeAttribute("role");
            titleEl.removeAttribute("tabindex");
            titleEl.removeAttribute("title");
          }
        }
        if (!id) {
          titleEl.textContent = "Choose a song";
          titleEl.classList.remove("has-selection");
          titleEl.classList.add("is-empty");
          if (statusEl) {
            statusEl.textContent = "";
            statusEl.classList.remove("is-warn");
          }
          if (alertEl) alertEl.innerHTML = "";
          if (typeof clearPracticeShareTitleMarquee === "function") clearPracticeShareTitleMarquee(row);
          if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(key);
          return;
        }
        titleEl.textContent = rowData ? rowData.title : id;
        titleEl.classList.add("has-selection");
        titleEl.classList.remove("is-empty");
        if (statusEl) {
          if (missingLyrics) {
            statusEl.textContent = "No lyrics";
            statusEl.classList.add("is-warn");
          } else {
            const lang = rowData && rowData.language ? rowData.language : "";
            const clip = massSlotAudioSnippetRef(key);
            const clipNote = clip ? " · Audio clip ready" : "";
            statusEl.textContent = (lang ? lang + " · Lyrics saved" : "Lyrics saved") + clipNote;
            statusEl.classList.remove("is-warn");
          }
        }
        if (alertEl) {
          if (missingLyrics) {
            alertEl.innerHTML =
              "<div class=\"mass-song-lyrics-alert\" role=\"alert\">" +
                "<span class=\"mass-song-lyrics-alert__icon\" aria-hidden=\"true\">!</span>" +
                "<div>" +
                  "<span class=\"mass-song-lyrics-alert__title\">Lyrics missing</span>" +
                  "<span class=\"mass-song-lyrics-alert__text\">Add lyrics in Song Library before generating.</span>" +
                "</div>" +
              "</div>";
          } else {
            alertEl.innerHTML = "";
          }
        }
        if (typeof setupPracticeShareTitleMarquee === "function") setupPracticeShareTitleMarquee(row);
        if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(key);
      });
      syncPracticeShareContinueEnabled();
    }

    var PS_TITLE_HOLD_MS = 2200;
    var PS_TITLE_HOLD_END_MS = 1400;
    var PS_TITLE_SCROLL_PX_PER_SEC = 36;

    function clearPracticeShareTitleMarquee(card) {
      if (!card) return;
      if (card._psTitleTimers) {
        card._psTitleTimers.forEach((id) => window.clearTimeout(id));
        card._psTitleTimers = null;
      }
      const titleEl = card.querySelector(".mass-song-plan-card__title");
      if (titleEl) {
        titleEl.style.transition = "none";
        titleEl.style.transform = "translateX(0)";
      }
      card.classList.remove("is-title-marquee");
    }

