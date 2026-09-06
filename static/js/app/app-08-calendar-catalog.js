/* Verbum SPA part 8/9: app-08-calendar-catalog.js
 * Calendar admin, song history/catalog search
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 24470-27500
 */
    function bindMassSlideshowControls() {
      if (massSlideshowState.bound) return;
      massSlideshowState.bound = true;
      const root = $("mass-slideshow");
      if (!root) return;
      if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");

      $("mass-slideshow-exit") && $("mass-slideshow-exit").addEventListener("click", (e) => {
        e.stopPropagation();
        closeMassSlideshow();
      });
      $("mass-slideshow-fullscreen") && $("mass-slideshow-fullscreen").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMassSlideshowFullscreen();
      });
      $("mass-slideshow-fs-gate-btn") && $("mass-slideshow-fs-gate-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const want = massSlideshowState.pendingFullscreen;
        if (want == null) {
          hideMassSlideshowFullscreenGate();
          return;
        }
        setMassSlideshowFullscreen(!!want, { fromUserGesture: true });
      });
      $("mass-slideshow-remote") && $("mass-slideshow-remote").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (massProjectionRemote.panelOpen) {
          setMassProjectionRemotePanel(false);
          return;
        }
        const session = await ensureMassProjectionSession();
        if (!session) {
          setFlowStatus("Could not start phone remote.", "error");
          return;
        }
        setMassProjectionRemotePanel(true);
      });
      $("mass-slideshow-remote-close") && $("mass-slideshow-remote-close").addEventListener("click", (e) => {
        e.stopPropagation();
        setMassProjectionRemotePanel(false);
      });
      $("mass-slideshow-remote-panel") && $("mass-slideshow-remote-panel").addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target && e.target.id === "mass-slideshow-remote-panel") {
          setMassProjectionRemotePanel(false);
        }
      });
      $("mass-slideshow-download") && $("mass-slideshow-download").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!massSlideshowState.pptxUrl) return;
        try {
          await triggerBrowserDownload(massSlideshowState.pptxUrl, massSlideshowState.pptxName);
        } catch (_err) { /* ignore */ }
      });
      $("mass-slideshow-hit-prev") && $("mass-slideshow-hit-prev").addEventListener("click", (e) => {
        e.stopPropagation();
        massSlideshowGo(-1);
      });
      $("mass-slideshow-hit-next") && $("mass-slideshow-hit-next").addEventListener("click", (e) => {
        e.stopPropagation();
        massSlideshowGo(1);
      });
      $("mass-slideshow-stage") && $("mass-slideshow-stage").addEventListener("click", (e) => {
        if (e.target.closest(".mass-slideshow__hit") || e.target.closest(".mass-slideshow__chrome")) return;
        massSlideshowGo(1);
      });
      root.addEventListener("mousemove", () => {
        bumpMassSlideshowCursor();
        setMassSlideshowChromeVisible(true);
      });
      document.addEventListener("fullscreenchange", () => {
        if (!massSlideshowState.open) return;
        syncMassSlideshowFullscreenUi();
      });
      document.addEventListener("keydown", (e) => {
        if (!massSlideshowState.open) return;
        const key = e.key;
        if (key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (massProjectionRemote.panelOpen) {
            setMassProjectionRemotePanel(false);
            return;
          }
          closeMassSlideshow();
          return;
        }
        if (key === "f" || key === "F") {
          e.preventDefault();
          toggleMassSlideshowFullscreen();
          return;
        }
        if (key === "b" || key === "B" || key === ".") {
          e.preventDefault();
          setMassSlideshowBlank(!massSlideshowState.blank);
          return;
        }
        if (massSlideshowState.blank && (key === "ArrowRight" || key === "ArrowLeft" || key === " " || key === "PageDown" || key === "PageUp")) {
          e.preventDefault();
          setMassSlideshowBlank(false);
          return;
        }
        if (key === "ArrowRight" || key === "PageDown" || key === " " || key === "Enter") {
          e.preventDefault();
          massSlideshowGo(1);
        } else if (key === "ArrowLeft" || key === "PageUp" || key === "Backspace") {
          e.preventDefault();
          massSlideshowGo(-1);
        } else if (key === "Home") {
          e.preventDefault();
          massSlideshowJump(0);
        } else if (key === "End") {
          e.preventDefault();
          massSlideshowJump(massSlideshowState.slides.length - 1);
        }
      }, true);
    }

    async function prepareAndOpenMassSlideshow(data, statusFn) {
      bindMassSlideshowControls();
      const setStatus = statusFn || setFlowStatus;
      if (data) rememberMassGenerateResult(data);
      setMassGenLoading(true, {
        title: "Preparing slideshow",
        message: "Opening first slides…",
        percent: 100,
      });
      try {
        const preview = await postJSON("/api/ppt-preview/slideshow/start", { quality: "presentation" });
        const slides = (preview && preview.slides) || [];
        if (!slides.length) {
          throw new Error((preview && preview.message) || "No slides were rendered for slideshow.");
        }
        setMassGenLoading(false);
        await openMassSlideshow({
          mode: (preview && preview.mode) === "text" ? "text" : "image",
          slides: slides,
          pptxUrl: data && data.pptx_url,
          pptxName: ((data && data.export_stem) || "mass_presentation") + ".pptx",
          expectedTotal: (preview && preview.total) || slides.length,
          complete: !!(preview && preview.complete),
          generation: (preview && preview.generation) || 0,
          cues: (preview && preview.cues) || (data && data.slideshow_cues) || [],
        });
        const modeNote = (preview && preview.mode) === "image"
          ? (preview.complete ? "Slideshow ready." : "Slideshow open — remaining slides loading…")
          : ((preview && preview.message) || "Slideshow ready (text fallback).");
        setStatus(modeNote, "ok", { downloads: massGenerateDownloadLinks(data || {}) });
      } catch (err) {
        setMassGenLoading(false);
        setStatus((err && err.message) || "Could not open slideshow.", "error");
        throw err;
      }
    }

    async function reopenLastMassSlideshow() {
      if (massSlideshowState.open) return;
      bindMassSlideshowControls();
      const btn = $("btn-present-slideshow");
      const mwBtn = $("mw-present");
      if (btn) btn.disabled = true;
      if (mwBtn) mwBtn.disabled = true;
      const quietCloseFailedOpen = () => {
        const root = $("mass-slideshow");
        massSlideshowState.open = false;
        stopMassSlideshowPoll();
        resetMassProjectionRemote();
        hideMassSlideshowFullscreenGate();
        if (root) {
          root.classList.remove("is-open", "is-blank", "is-chrome-visible", "is-hint-visible", "is-cursor-hidden");
          root.setAttribute("aria-hidden", "true");
        }
        document.body.style.overflow = "";
        revokeMassSlideshowObjectUrls();
        massSlideshowState.slides = [];
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      };
      try {
        // 1) Instant resume from cached slide URLs (no regenerate, no LibreOffice).
        if (lastMassSlideshowSession && lastMassSlideshowSession.slides && lastMassSlideshowSession.slides.length) {
          try {
            await openMassSlideshow({
              mode: lastMassSlideshowSession.mode || "image",
              slides: lastMassSlideshowSession.slides,
              pptxUrl: lastMassSlideshowSession.pptxUrl,
              pptxName: lastMassSlideshowSession.pptxName,
              expectedTotal: lastMassSlideshowSession.expectedTotal || lastMassSlideshowSession.slides.length,
              complete: lastMassSlideshowSession.complete !== false,
              resumeIndex: lastMassSlideshowSession.resumeIndex || 0,
            });
            // If first media failed to load, fall through to server resume.
            const hasMedia = massSlideshowState.slides.some((s) => s.objectUrl || s.videoObjectUrl || (s.kind === "video" && s.video_url));
            if (massSlideshowState.mode === "image" && !hasMedia) {
              quietCloseFailedOpen();
              throw new Error("Cached slides expired.");
            }
            setFlowStatus("Slideshow resumed.", "ok");
            return;
          } catch (_cacheErr) {
            quietCloseFailedOpen();
            /* fall through */
          }
        }

        // 2) Reuse already-rendered preview images on the server.
        try {
          const st = await fetchMassSlideshowStatus();
          if (st && st.mode === "image" && st.slides && st.slides.length) {
            await openMassSlideshow({
              mode: "image",
              slides: st.slides,
              pptxUrl: (lastMassGenerateResult && lastMassGenerateResult.pptx_url) || (lastMassSlideshowSession && lastMassSlideshowSession.pptxUrl) || "",
              pptxName: ((lastMassGenerateResult && lastMassGenerateResult.export_stem) || "mass_presentation") + ".pptx",
              expectedTotal: st.total || st.slides.length,
              complete: !!st.complete,
              resumeIndex: (lastMassSlideshowSession && lastMassSlideshowSession.resumeIndex) || 0,
              cues: st.cues || (lastMassGenerateResult && lastMassGenerateResult.slideshow_cues) || [],
            });
            if (massSlideshowState.mode === "image" && !massSlideshowState.slides.some((s) => s.objectUrl || s.videoObjectUrl || (s.kind === "video" && s.video_url))) {
              quietCloseFailedOpen();
              throw new Error("Preview slides expired.");
            }
            setFlowStatus(st.complete ? "Slideshow resumed." : "Slideshow resumed — remaining slides loading…", "ok");
            return;
          }
        } catch (_stErr) {
          quietCloseFailedOpen();
          /* fall through */
        }

        // 3) Re-rasterize latest PPTX only (still no Mass regenerate).
        if (!lastMassGenerateResult || !lastMassGenerateResult.pptx_url) {
          throw new Error("No generated deck yet. Use Generate or Slideshow first.");
        }
        await prepareAndOpenMassSlideshow(lastMassGenerateResult, setFlowStatus);
      } catch (err) {
        setFlowStatus((err && err.message) || "Could not reopen slideshow.", "error");
      } finally {
        if (btn) btn.disabled = false;
        if (mwBtn) mwBtn.disabled = false;
        syncMassPresentAgainUi();
      }
    }
    window.reopenLastMassSlideshow = reopenLastMassSlideshow;

    async function runFullMassGenerate(options) {
      const o = options || {};
      const statusFn = o.setStatus || setFlowStatus;
      if (window.MassWizard && typeof window.MassWizard.validateBeforeGenerate === "function") {
        if (window.MassWizard.validateBeforeGenerate()) {
          return null;
        }
      }
      if (!churchMembershipState.can_use_full_app) {
        statusFn("Mass generation requires approved parish membership.", "error");
        return null;
      }
      let date = o.date || $("mass-date").value;
      let celebrant = (o.celebrant != null ? o.celebrant : getMassCelebrantLine()).trim();
      const celebrantMain = ($("celebrant") && $("celebrant").value.trim()) || "";
      if (!date || !celebrantMain) {
        statusFn("Enter Mass date and select a celebrant in Basics before generating.", "error");
        return null;
      }
      const posterOpts = readOpenAiPosterSettings();
      const useAiPoster = o.include_ai != null ? !!o.include_ai : posterOpts.useAi;
      const aiBackend = o.ai_poster_backend || posterOpts.backend || "openai";
      const body = {
        date,
        celebrant: celebrantMain,
        co_celebrant: (($("co-celebrant") && $("co-celebrant").value.trim()) || ""),
        songs: selectedSongsForGenerate(),
        custom_theme: pptThemePayload(activeTheme),
        poster_template: o.poster_template || "liturgical_color",
        include_social_exports: readSocialExportSettings(o),
        include_gospel_art: false,
        include_ai_mass_poster: useAiPoster,
        ai_poster_backend: aiBackend,
        ai_poster_style: o.ai_poster_style || posterOpts.style,
      };
      const church = getCommunityName();
      if (church) body.community_name = church;
      try {
        body.hymn_typography = buildHymnTypographyPayload();
        const receiptResult = await openMassGenerateReceiptModal(buildMassGenerateReceiptModel(o), o);
        if (!receiptResult || !receiptResult.confirmed) {
          return null;
        }
        o.openSlideshow = !!receiptResult.openSlideshow;
        if (o.openSlideshow) {
          o.autoDownloadPptx = false;
        } else if (o.autoDownloadPptx == null) {
          o.autoDownloadPptx = true;
        }
        applyMassGenerateReceiptEdits();
        date = ($("mass-date") && $("mass-date").value) || o.date || date;
        const mainAfter = ($("celebrant") && $("celebrant").value.trim()) || celebrantMain;
        const coAfter = ($("co-celebrant") && $("co-celebrant").value.trim()) || "";
        celebrant = getMassCelebrantLine().trim() || (o.celebrant != null ? o.celebrant : celebrant).trim();
        body.date = date;
        body.celebrant = mainAfter;
        body.co_celebrant = coAfter;
        body.songs = selectedSongsForGenerate();
        if (!(await confirmHymnPreviewChangesBeforeGenerate())) {
          return null;
        }
        await ensureLyricsCachedForSelectedSongs();

        const divIn = $("flow-divider-poster");
        const annIn = $("flow-announcement-posters");
        const hasUpload = !!(
          (divIn && divIn.files && divIn.files[0]) ||
          (annIn && annIn.files && annIn.files.length)
        );
        let genSteps = buildMassGenStepList({
          hasUpload,
          useAi: body.include_ai_mass_poster,
          reusePoster: false,
        });
        const massGenStepIndex = (label) => genSteps.indexOf(label);

        setMassGenLoading(true, {
          title: "Preparing your Sunday Mass",
          steps: genSteps,
          step: 0,
        });
        advanceMassGenStep(1);
        advanceMassGenStep(2);

        let divider_bn = null;
        if (divIn && divIn.files && divIn.files[0]) {
          const uploadIdx = massGenStepIndex("Uploading artwork");
          advanceMassGenStep(uploadIdx >= 0 ? uploadIdx : 3, { message: "Uploading artwork…" });
          divider_bn = await uploadMassImage(divIn.files[0], "/api/upload/mass-divider");
        }
        const ann_bns = [];
        if (annIn && annIn.files && annIn.files.length) {
          const uploadIdx = massGenStepIndex("Uploading artwork");
          if (uploadIdx >= 0) advanceMassGenStep(uploadIdx, { message: "Uploading artwork…" });
          for (let i = 0; i < annIn.files.length; i++) {
            ann_bns.push(await uploadMassImage(annIn.files[i], "/api/upload/announcement-slide"));
          }
        }
        const collFormatted = getFormattedCollectionAmount();
        const collIso = $("flow-collection-date") && $("flow-collection-date").value;
        const collLabel = formatLongDateLabel(collIso) || collIso || "";
        syncFlowFoodSponsorsHidden();
        const psalmCustom = $("flow-psalm-custom") && $("flow-psalm-custom").value.trim();
        const foodLines = getFlowFoodSponsorsLines();
        const gospelCustom = $("flow-gospel-custom") && $("flow-gospel-custom").value.trim();
        const sentSel = $("flow-gospel-sentence");
        const psalmSel = $("flow-psalm-refrain");
        if (gospelCustom) {
          body.gospel_quote_override = gospelCustom;
        } else if (sentSel && sentSel.value !== "") {
          const idx = parseInt(sentSel.value, 10);
          if (!Number.isNaN(idx)) {
            body.sentence_index = idx;
          }
        }
        if (psalmCustom) {
          body.psalm_text_override = psalmCustom;
        } else if (psalmSel && psalmSel.value !== "") {
          const pidx = parseInt(psalmSel.value, 10);
          if (!Number.isNaN(pidx)) {
            body.psalm_refrain_index = pidx;
          }
        }
        if (divider_bn) body.divider_poster_basename = divider_bn;
        if (ann_bns.length) body.announcement_basenames = ann_bns;
        const lotwSel = $("flow-lotw-poster");
        const loteSel = $("flow-lote-poster");
        body.lotw_poster = (lotwSel && lotwSel.value) || "lotw1";
        body.lote_poster = (loteSel && loteSel.value) || "lote1";
        // Prefer live JS state over hidden inputs (draft restore can leave stale values).
        syncDeckThemeHiddenInput();
        const themeFromInput = ($("flow-deck-theme") && $("flow-deck-theme").value) || "";
        const resolvedTheme = findPresetTheme(themeFromInput || activeTheme.id);
        activeTheme = resolvedTheme;
        body.custom_theme = pptThemePayload(resolvedTheme);
        const divStyleEl = $("flow-divider-style");
        const divAllowed = ["divider1", "divider2", "divider3", "auto"];
        const divLive = (typeof activeDividerStyle === "string" && activeDividerStyle) || "";
        const divHidden = (divStyleEl && divStyleEl.value) || "";
        const divVal = divAllowed.includes(divLive) ? divLive : (divAllowed.includes(divHidden) ? divHidden : "divider1");
        activeDividerStyle = divVal;
        if (divStyleEl) divStyleEl.value = divVal;
        body.divider_style = divVal;
        if (collFormatted) {
          body.mass_collection_amount = collFormatted;
          body.mass_collection_currency = readCollectionCurrencyCode();
        }
        if (collLabel) body.mass_collection_date_label = collLabel;
        if (foodLines.length) body.food_sponsors = foodLines;
        const collAmtLive = ($("flow-collection-amount") && $("flow-collection-amount").value.trim()) || "";
        body.include_mass_collection_slide = !!( $("flow-slide-mass-collection") && $("flow-slide-mass-collection").checked && collAmtLive );
        body.include_food_sponsor_slide = !!( $("flow-slide-food-sponsor") && $("flow-slide-food-sponsor").checked );
        body.include_sponsorship_contact_slide = !!( $("flow-slide-sponsorship-contact") && $("flow-slide-sponsorship-contact").checked );
        body.include_merienda_location_slide = !!( $("flow-slide-merienda-location") && $("flow-slide-merienda-location").checked );
        body.include_welcoming_newcomers_slide = !!( $("flow-slide-welcoming-newcomers") && $("flow-slide-welcoming-newcomers").checked );
        const sponsorshipContact = $("flow-sponsorship-contact") && $("flow-sponsorship-contact").value.trim();
        const meriendaLocation = $("flow-merienda-location") && $("flow-merienda-location").value.trim();
        if (sponsorshipContact) body.sponsorship_contact = sponsorshipContact;
        if (meriendaLocation) body.merienda_location = meriendaLocation;
        if (typeof getAnnouncementBgColors === "function") {
          body.announcement_bg_colors = getAnnouncementBgColors();
        }
        if (typeof getFlowCustomSlidesPayload === "function") {
          const customSlides = getFlowCustomSlidesPayload();
          if (customSlides.length) body.custom_announcement_slides = customSlides;
        }
        const creedSel = $("flow-creed-choice");
        body.creed_choice = creedSel && creedSel.value === "apostles" ? "apostles" : "nicene";
        const ofSel = $("flow-our-father-choice");
        const ofAllowed = ["english", "malay", "tagalog", "visaya", "korean"];
        body.our_father_choice = ofSel && ofAllowed.includes(ofSel.value) ? ofSel.value : "english";
        const massLangSel = $("flow-mass-language");
        body.mass_language = massLangSel && massLangSel.value === "tagalog" ? "tagalog" : "english";
        body.hymn_lyrics_layout = readHymnLyricsLayout();
        body.show_hymn_section_labels = readHymnSectionLabels();
        body.hymn_lyric_overrides = buildHymnLyricOverridesPayload();
        body.hymn_layout_overrides = buildHymnLayoutOverridesPayload();
        const videoReplacements = buildVideoReplacementsPayload();
        if (videoReplacements) body.video_replacements = videoReplacements;
        const logoCb = $("flow-include-church-logo");
        const nameCb = $("flow-include-church-name");
        body.include_church_logo = logoCb ? logoCb.checked : false;
        body.include_church_name = nameCb ? nameCb.checked : false;
        const showFooterCb = $("flow-show-footer");
        body.include_footer = showFooterCb ? !!showFooterCb.checked : false;

        const dupKey = "churchMediaLastGenFp";
        const fp = JSON.stringify({
          date,
          celebrant,
          co_celebrant: body.co_celebrant || "",
          songs: body.songs,
          divider_poster_basename: body.divider_poster_basename || null,
          lotw_poster: body.lotw_poster || "lotw1",
          lote_poster: body.lote_poster || "lote1",
          divider_style: body.divider_style || "divider1",
          announcement_basenames: body.announcement_basenames || [],
          mass_collection_amount: body.mass_collection_amount || null,
          mass_collection_currency: body.mass_collection_currency || null,
          mass_collection_date_label: body.mass_collection_date_label || null,
          food_sponsors: body.food_sponsors || [],
          include_mass_collection_slide: !!body.include_mass_collection_slide,
          include_food_sponsor_slide: !!body.include_food_sponsor_slide,
          include_sponsorship_contact_slide: !!body.include_sponsorship_contact_slide,
          include_merienda_location_slide: !!body.include_merienda_location_slide,
          include_welcoming_newcomers_slide: !!body.include_welcoming_newcomers_slide,
          sponsorship_contact: body.sponsorship_contact || null,
          merienda_location: body.merienda_location || null,
          announcement_bg_colors: body.announcement_bg_colors || null,
          custom_announcement_slides: body.custom_announcement_slides || [],
          psalm_text_override: body.psalm_text_override || null,
          psalm_refrain_index: body.psalm_refrain_index != null ? body.psalm_refrain_index : null,
          sentence_index: body.sentence_index != null ? body.sentence_index : null,
          gospel_quote_override: body.gospel_quote_override || null,
          creed_choice: body.creed_choice || "nicene",
          our_father_choice: body.our_father_choice || "english",
          mass_language: body.mass_language || "english",
          hymn_lyrics_layout: body.hymn_lyrics_layout || "dual",
          hymn_body_align: (body.hymn_typography && body.hymn_typography.default && body.hymn_typography.default.body_align) || "center",
          show_hymn_section_labels: !!body.show_hymn_section_labels,
          poster_template: body.poster_template,
          include_ai_mass_poster: body.include_ai_mass_poster,
          ai_poster_backend: body.ai_poster_backend,
          ai_poster_style: body.ai_poster_style,
          include_social_exports: body.include_social_exports,
          custom_theme: body.custom_theme,
          include_church_logo: body.include_church_logo,
          include_church_name: body.include_church_name,
          include_footer: body.include_footer,
          video_replacements: body.video_replacements || null,
        });
        const prev = localStorage.getItem(dupKey);
        if (prev && prev === fp) {
          setMassGenLoading(false);
          if (!window.confirm("These Mass Builder settings match your last successful generation. Generate again anyway?")) {
            return null;
          }
        }

        // Silent shared/local hero reuse (server may skip the image API), but the
        // product still charges weekly quota and always shows the AI-generation UX.
        body.reuse_existing_poster = false;
        if (body.include_ai_mass_poster) {
          try {
            const qs = "date=" + encodeURIComponent(date) + "&style=" + encodeURIComponent(body.ai_poster_style || "cinematic");
            const exRes = await fetch("/api/poster-exists?" + qs);
            const exData = exRes.ok ? await exRes.json() : { exists: false };
            if (exData && exData.exists) body.reuse_existing_poster = true;
          } catch (_e) {
            body.reuse_existing_poster = false;
          }
        }

        genSteps = buildMassGenStepList({
          hasUpload,
          useAi: !!body.include_ai_mass_poster,
          reusePoster: false,
        });
        massGenProgressState.steps = genSteps;

        let workIdx = massGenStepIndex("Building PowerPoint slides");
        if (body.include_ai_mass_poster) {
          workIdx = massGenStepIndex("Connecting to AI");
          statusFn("Creating sacred artwork and building your presentation…", "");
        } else {
          statusFn("Building PowerPoint slides…", "");
        }
        if (workIdx < 0) workIdx = Math.max(0, genSteps.length - 3);

        setMassGenLoading(true, {
          title: "Preparing your Sunday Mass",
          steps: genSteps,
          step: workIdx,
        });
        startMassGenStepSimulation(workIdx + 1, body.include_ai_mass_poster ? 2800 : 2200);
        const data = await postJSON("/api/generate", body);
        clearMassGenProgressTimers();
        advanceMassGenStep(genSteps.length - 1, { message: "Finalizing presentation…", percent: 100 });
        localStorage.setItem(dupKey, fp);
        if (divIn) divIn.value = "";
        if (annIn) annIn.value = "";
        const linkMap = o.links || [
          ["dl-zip", "zip_url"],
          ["dl-pptx", "pptx_url"],
          ["dl-poster", "poster_url"],
          ["dl-poster-ppt", "poster_ppt_url"],
        ];
        linkMap.forEach(([id, key]) => {
          const el = $(id);
          const url = data[key];
          if (el) {
            if (url) {
              el.href = url;
              el.style.display = "";
            } else {
              el.removeAttribute("href");
              el.style.display = "none";
            }
          }
        });
        if (o.downloadRowId) {
          const row = $(o.downloadRowId);
          if (row) row.classList.add("visible");
        } else {
          $("download-row").classList.add("visible");
        }
        windowLastMassGenerateBody = JSON.parse(JSON.stringify(body));
        rememberMassGenerateResult(data);
        commitHymnPreviewBaseline();
        pushRecent({
          title: data.title || "Mass media",
          date,
          zip_url: data.zip_url,
          pptx_url: data.pptx_url,
          poster_url: data.poster_url,
        });
        const dlMeta = { downloads: massGenerateDownloadLinks(data) };
        const wantSlideshow = !!o.openSlideshow;
        // Show success immediately; don't keep the overlay waiting on a multi‑MB blob download.
        const successUi = showMassGenSuccess(
          wantSlideshow ? "Presentation ready." : "Presentation successfully generated.",
          wantSlideshow ? "Opening slideshow…" : "Your PowerPoint is ready."
        );
        if (!wantSlideshow && o.autoDownloadPptx && data.pptx_url) {
          const stemName = data.export_stem || "mass_presentation";
          triggerBrowserDownload(data.pptx_url, stemName + ".pptx")
            .then(() => {
              statusFn("Presentation ready. PowerPoint download started.", "ok", dlMeta);
            })
            .catch(() => {
              statusFn(
                "Presentation ready. Use the PowerPoint download link if the file did not start automatically.",
                "ok",
                dlMeta
              );
            });
        } else if (!wantSlideshow) {
          statusFn("Presentation ready.", "ok", dlMeta);
        }
        refreshAiImageQuotaHint();
        clearMassBuilderDraft();
        await successUi;
        if (wantSlideshow) {
          try {
            await prepareAndOpenMassSlideshow(data, statusFn);
          } catch (_slideErr) {
            if (data.pptx_url) {
              statusFn(
                "Presentation ready, but slideshow could not open. Use the PowerPoint download link.",
                "error",
                dlMeta
              );
            }
          }
        }
        return data;
      } catch (error) {
        clearMassGenProgressTimers();
        const friendly = error.message || "We could not finish generating your presentation.";
        statusFn(friendly, "error");
        showMassGenError(friendly, massGenProgressState.current, () => runFullMassGenerate(o));
        return null;
      } finally {
        if (!massGenProgressState.errored) {
          setMassGenLoading(false);
        }
      }
    }

    function updatePosterLivePreview() {
      const frame = $("poster-live-preview");
      if (!frame) return;
      const q = ($("poster-gospel-quote") && $("poster-gospel-quote").value.trim()) || ($("home-gospel-quote") && $("home-gospel-quote").textContent.trim()) || "Gospel quote appears here.";
      const title = getCommunityName() || "Parish community";
      const d = ($("poster-mass-date") && $("poster-mass-date").value) || ($("mass-date") && $("mass-date").value) || "";
      const c = ($("poster-celebrant") && $("poster-celebrant").value.trim()) || getMassCelebrantLine() || "Celebrant";
      if ($("poster-prev-kicker")) $("poster-prev-kicker").textContent = "Sunday Mass";
      if ($("poster-prev-title")) $("poster-prev-title").textContent = title;
      if ($("poster-prev-quote")) $("poster-prev-quote").textContent = q;
      if ($("poster-prev-meta")) $("poster-prev-meta").textContent = d + " · " + c;
      applyThemeToPreview(frame, activeTheme);
    }

    function syncPosterFromMassBuilder() {
      if ($("poster-mass-date") && $("mass-date")) $("poster-mass-date").value = $("mass-date").value;
      if ($("poster-celebrant")) $("poster-celebrant").value = getMassCelebrantLine();
      if ($("poster-gospel-quote") && flowPreviewData && flowPreviewData.gospel_quote) {
        $("poster-gospel-quote").value = flowPreviewData.gospel_quote;
      }
      updatePosterLivePreview();
    }

    var calendarCursor = new Date();
    var calendarMonthData = {};
    var calendarMonthLoading = false;
    var calendarMonthKey = "";

    function updateCalReadingCard(refEl, excerptEl, toggleEl, ref, body) {
      const text = (body || "").trim();
      const hasContent = !!(text || (ref || "").trim());
      const card = excerptEl && excerptEl.closest(".cal-reading-card");
      if (refEl) refEl.textContent = (ref || "").trim() || "—";
      if (excerptEl) {
        excerptEl.textContent = text || "Not available for this day.";
        excerptEl.classList.remove("is-expanded");
      }
      if (toggleEl) {
        toggleEl.hidden = text.length < 160;
        toggleEl.textContent = "Read more";
      }
      if (card) card.classList.toggle("is-empty", !hasContent);
    }

    function renderCalendarDow() {
      const row = $("cal-dow-row");
      if (!row) return;
      row.innerHTML = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => "<div class=\"cal-dow\">" + d + "</div>").join("");
    }

    function renderCalendarGrid() {
      const grid = $("cal-grid");
      const label = $("cal-month-label");
      if (!grid || !label) return;
      const y = calendarCursor.getFullYear();
      const m = calendarCursor.getMonth();
      const adminMode = canUseCalendarReadingsAdmin();
      label.textContent = calendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
      const first = new Date(y, m, 1);
      const startPad = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push("<div class=\"cal-cell muted\" aria-hidden=\"true\"></div>");
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = formatDateInput(new Date(y, m, d));
        const sunday = new Date(y, m, d).getDay() === 0;
        const day = calendarMonthData[iso] || {};
        const lc = day.liturgical_color || {};
        const hex = lc.hex || "";
        const hasData = !!(day.has_cache || day.loaded);
        const classes = ["cal-cell"];
        if (sunday) classes.push("sunday");
        if (hasData) classes.push("has-data");
        if (iso === calSelected) classes.push("selected");
        if (sunday && calendarMonthLoading && !day.gospel_reference) classes.push("loading");
        let healthHtml = "";
        if (adminMode && day.readings_health) {
          const h = day.readings_health;
          classes.push("cal-cell--" + h);
          const icon = h === "healthy" ? "✓" : h === "warning" ? "⚠" : "!";
          healthHtml = "<span class=\"cal-health-badge cal-health-badge--" + h + "\" aria-hidden=\"true\">" + icon + "</span>";
        }
        const dotAttr = hex ? " style=\"background:" + escapeHtml(hex) + "\"" : "";
        const gospelLabel = day.gospel_reference ? escapeHtml(day.gospel_reference) : "";
        cells.push(
          "<button type=\"button\" class=\"" + classes.join(" ") + "\" data-cal=\"" + iso + "\">" +
          "<span class=\"cal-cell-top\"><span class=\"cal-cell-day\">" + d + "</span>" +
          "<span class=\"cal-cell-indicators\">" + healthHtml +
          "<span class=\"cal-cell-dot\"" + dotAttr + " aria-hidden=\"true\"></span></span></span>" +
          "<span class=\"cal-cell-gospel\">" + gospelLabel + "</span>" +
          "</button>"
        );
      }
      grid.innerHTML = cells.join("");
    }

    async function loadCalendarMonth() {
      const y = calendarCursor.getFullYear();
      const m = calendarCursor.getMonth() + 1;
      const lang = currentCalendarLanguage();
      const key = y + "-" + m + "-" + lang;
      calendarMonthLoading = true;
      syncCalendarAdminVisibility();
      renderCalendarGrid();
      const status = $("cal-month-status");
      if (status) {
        status.textContent = lang === "tagalog"
          ? "Loading Tagalog liturgical calendar…"
          : "Loading liturgical calendar…";
      }
      try {
        const qs = "year=" + y + "&month=" + m + "&lang=" + encodeURIComponent(lang);
        const endpoint = canUseCalendarReadingsAdmin()
          ? "/api/admin/calendar/month?" + qs
          : "/api/calendar/month?" + qs;
        const res = await fetch(endpoint);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.error || "Could not load month");
        calendarMonthData = data.days || {};
        calendarMonthKey = key;
        if (status) status.textContent = lang === "tagalog" ? "Tagalog · Awit at Papuri" : "English · Philippines Proper";
      } catch (err) {
        calendarMonthData = {};
        calendarMonthKey = "";
        if (status) status.textContent = err.message || "Month load failed.";
      } finally {
        calendarMonthLoading = false;
        renderCalendarGrid();
      }
    }

    var calReadingsAdminDate = "";
    var calReadingsAdminDetail = null;

    var CAL_ADMIN_FIELD_KEYS = [
      "first_reading_ref", "first_reading",
      "second_reading_ref", "second_reading",
      "psalm_ref", "psalm_response", "psalm_verses", "psalm_text",
      "gospel_ref", "gospel",
    ];

    function setCalAdminFieldStatus(key, field) {
      const el = document.querySelector("[data-admin-status=\"" + key + "\"]");
      if (!el || !field) return;
      const ok = !!field.ok;
      el.textContent = ok ? "OK" : "Missing";
      el.className = "cal-admin-reading-status " + (ok ? "ok" : "bad");
    }

    function fillCalReadingsAdminModal(detail) {
      calReadingsAdminDetail = detail;
      const entry = detail.entry || {};
      const health = detail.health || {};
      const modal = $("cal-readings-admin-modal");
      const title = $("cal-readings-admin-title");
      const subtitle = $("cal-readings-admin-subtitle");
      const statusEl = $("cal-readings-admin-status");
      if (title) title.textContent = "Readings — " + (detail.date || "");
      if (subtitle) {
        const h = health.status || "unknown";
        subtitle.textContent = "Global cache · " + h.charAt(0).toUpperCase() + h.slice(1);
      }
      if (statusEl) {
        statusEl.textContent = detail.title
          ? (detail.title + (detail.season ? " · " + detail.season : ""))
          : "No lectionary title cached yet.";
      }
      modal.querySelectorAll("[data-admin-field]").forEach((input) => {
        const key = input.getAttribute("data-admin-field");
        input.value = entry[key] || "";
      });
      modal.querySelectorAll("[data-admin-reading]").forEach((block) => {
        block.classList.remove("is-editing");
      });
      const fields = health.fields || {};
      setCalAdminFieldStatus("first", fields.first_reading);
      setCalAdminFieldStatus("second", fields.second_reading);
      setCalAdminFieldStatus("psalm", fields.psalm);
      setCalAdminFieldStatus("gospel", fields.gospel);
    }

    function openCalReadingsAdminModal(iso) {
      if (!canUseCalendarReadingsAdmin()) return;
      clearCalReadingsAdminSaveAnimation();
      calReadingsAdminDate = iso;
      const modal = $("cal-readings-admin-modal");
      const statusEl = $("cal-readings-admin-status");
      if (statusEl) statusEl.textContent = "Loading readings cache…";
      if (modal) {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
      }
      fetch("/api/admin/readings-cache/" + encodeURIComponent(iso))
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.detail || "Could not load readings");
          if (calReadingsAdminDate !== iso) return;
          fillCalReadingsAdminModal(data);
        })
        .catch((err) => {
          if (calReadingsAdminDate !== iso) return;
          if (statusEl) statusEl.textContent = err.message || "Load failed.";
        });
    }

    function closeCalReadingsAdminModal() {
      clearCalReadingsAdminSaveAnimation();
      calReadingsAdminDate = "";
      calReadingsAdminDetail = null;
      const modal = $("cal-readings-admin-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }

    function collectCalReadingsAdminPayload() {
      const modal = $("cal-readings-admin-modal");
      if (!modal) return {};
      const payload = {};
      CAL_ADMIN_FIELD_KEYS.forEach((key) => {
        const input = modal.querySelector("[data-admin-field=\"" + key + "\"]");
        if (input) payload[key] = input.value;
      });
      return payload;
    }

    function calReadingsAdminPayloadUnchanged(payload) {
      const entry = (calReadingsAdminDetail && calReadingsAdminDetail.entry) || {};
      return CAL_ADMIN_FIELD_KEYS.every((key) => {
        return String(payload[key] || "") === String(entry[key] || "");
      });
    }

    var calAdminSaveAnimTimer = 0;

    function setCalAdminSaveOverlay(mode) {
      // mode: "" | "saving" | "success"
      const modalCard = document.querySelector("#cal-readings-admin-modal .ui-card--cal-admin");
      const overlay = $("cal-admin-save-overlay");
      const loading = $("cal-admin-save-overlay-loading");
      const success = $("cal-admin-save-overlay-success");
      if (!modalCard || !overlay) return;
      modalCard.classList.remove("is-saving", "is-save-success", "is-just-saved");
      overlay.classList.remove("is-visible", "is-success");
      if (!mode) {
        overlay.hidden = true;
        if (loading) loading.hidden = false;
        if (success) success.hidden = true;
        return;
      }
      overlay.hidden = false;
      void overlay.offsetWidth;
      overlay.classList.add("is-visible");
      if (mode === "saving") {
        modalCard.classList.add("is-saving");
        if (loading) loading.hidden = false;
        if (success) success.hidden = true;
        return;
      }
      modalCard.classList.add("is-save-success", "is-just-saved");
      overlay.classList.add("is-success");
      if (loading) loading.hidden = true;
      if (success) {
        success.hidden = false;
        success.querySelectorAll(
          ".cal-admin-save-overlay__check-circle, .cal-admin-save-overlay__check-mark"
        ).forEach((el) => {
          el.style.animation = "none";
          el.getBoundingClientRect();
          el.style.animation = "";
        });
      }
    }

    function clearCalReadingsAdminSaveAnimation() {
      if (calAdminSaveAnimTimer) {
        window.clearTimeout(calAdminSaveAnimTimer);
        calAdminSaveAnimTimer = 0;
      }
      const saveBtn = $("cal-readings-admin-save");
      const statusEl = $("cal-readings-admin-status");
      const done = saveBtn && saveBtn.querySelector(".cal-admin-save__done");
      if (saveBtn) {
        saveBtn.classList.remove("is-saved");
        saveBtn.disabled = false;
      }
      if (done) done.hidden = true;
      if (statusEl) statusEl.classList.remove("is-saved");
      setCalAdminSaveOverlay("");
    }

    function playCalReadingsAdminSaveAnimation(iso, opts) {
      const options = opts || {};
      const holdMs = typeof options.holdMs === "number" ? options.holdMs : 700;
      const message = options.message || "Saved — applies to all parishes.";
      const showOverlay = options.overlay !== false;
      const saveBtn = $("cal-readings-admin-save");
      const statusEl = $("cal-readings-admin-status");
      const done = saveBtn && saveBtn.querySelector(".cal-admin-save__done");
      if (calAdminSaveAnimTimer) {
        window.clearTimeout(calAdminSaveAnimTimer);
        calAdminSaveAnimTimer = 0;
      }
      if (saveBtn) {
        saveBtn.classList.remove("is-saved");
        void saveBtn.offsetWidth;
        saveBtn.classList.add("is-saved");
        saveBtn.disabled = true;
      }
      if (done) done.hidden = false;
      if (statusEl) {
        statusEl.classList.remove("is-saved");
        void statusEl.offsetWidth;
        statusEl.classList.add("is-saved");
        statusEl.textContent = message;
      }
      if (showOverlay) setCalAdminSaveOverlay("success");
      const cell = iso
        ? document.querySelector(".cal-cell[data-cal=\"" + iso + "\"]")
        : null;
      if (cell && showOverlay) {
        cell.classList.remove("is-just-saved");
        void cell.offsetWidth;
        cell.classList.add("is-just-saved");
        window.setTimeout(() => cell.classList.remove("is-just-saved"), 750);
      }
      calAdminSaveAnimTimer = window.setTimeout(() => {
        clearCalReadingsAdminSaveAnimation();
        calAdminSaveAnimTimer = 0;
      }, holdMs);
    }

    async function saveCalReadingsAdminAll() {
      if (!calReadingsAdminDate) return;
      const saveBtn = $("cal-readings-admin-save");
      const statusEl = $("cal-readings-admin-status");
      const payload = collectCalReadingsAdminPayload();
      clearCalReadingsAdminSaveAnimation();

      if (calReadingsAdminPayloadUnchanged(payload)) {
        playCalReadingsAdminSaveAnimation(calReadingsAdminDate, {
          message: "No changes to save.",
          holdMs: 650,
          overlay: false,
        });
        return;
      }

      if (saveBtn) saveBtn.disabled = true;
      if (statusEl) {
        statusEl.classList.remove("is-saved");
        statusEl.textContent = "Saving global readings cache…";
      }
      setCalAdminSaveOverlay("saving");
      try {
        const res = await fetch("/api/admin/readings-cache/" + encodeURIComponent(calReadingsAdminDate), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Save failed");
        const savedIso = calReadingsAdminDate;
        fillCalReadingsAdminModal(data);
        const monthKey = calendarCursor.getFullYear() + "-" + (calendarCursor.getMonth() + 1) + "-" + currentCalendarLanguage();
        if (calendarMonthKey === monthKey && data.health) {
          calendarMonthData[savedIso] = Object.assign(
            {},
            calendarMonthData[savedIso] || {},
            { readings_health: data.health.status }
          );
          renderCalendarGrid();
        }
        if (calSelected === savedIso) setCalDetail(calSelected);
        if (data.unchanged) {
          playCalReadingsAdminSaveAnimation(savedIso, {
            message: "No changes to save.",
            holdMs: 650,
            overlay: false,
          });
        } else {
          playCalReadingsAdminSaveAnimation(savedIso, {
            message: "Saved — applies to all parishes.",
            holdMs: 700,
            overlay: true,
          });
        }
      } catch (err) {
        clearCalReadingsAdminSaveAnimation();
        if (statusEl) statusEl.textContent = err.message || "Could not save readings.";
        if (saveBtn) saveBtn.disabled = false;
      }
    }

    var CAL_ADMIN_MAX_FETCH_ATTEMPTS = 3;
    var calAdminFetchJob = {
      active: false,
      cancelled: false,
      abort: null,
      mode: "",
      scope: "",
      total: 0,
      done: 0,
      improved: 0,
    };

    var CAL_ADMIN_FETCH_BUTTON_IDS = [
      "cal-admin-fetch-missing-btn",
      "cal-admin-fetch-month-btn",
      "cal-readings-admin-fetch",
    ];

    function setCalFetchButtonState(btn, running, meta) {
      if (!btn) return;
      btn.classList.toggle("is-running", !!running);
      btn.setAttribute("aria-busy", running ? "true" : "false");
      btn.title = running ? "Click to stop fetch" : (btn.dataset.defaultTitle || btn.title || "");
      const idle = btn.querySelector(".cal-fetch-btn__idle");
      const runningWrap = btn.querySelector(".cal-fetch-btn__running");
      if (idle) idle.hidden = !!running;
      if (runningWrap) runningWrap.hidden = !running;
      const metaEl = btn.querySelector(".cal-fetch-btn__meta");
      if (metaEl) metaEl.textContent = meta || "";
    }

    function getCalAdminActiveFetchButton() {
      if (!calAdminFetchJob.active) return null;
      if (calAdminFetchJob.mode === "date") return $("cal-readings-admin-fetch");
      if (calAdminFetchJob.mode === "month") {
        return calAdminFetchJob.scope === "all"
          ? $("cal-admin-fetch-month-btn")
          : $("cal-admin-fetch-missing-btn");
      }
      return null;
    }

    function updateCalAdminFetchButtons(meta) {
      const active = getCalAdminActiveFetchButton();
      CAL_ADMIN_FETCH_BUTTON_IDS.forEach((id) => {
        const btn = $(id);
        if (!btn || btn.hidden) return;
        const isActive = btn === active;
        setCalFetchButtonState(btn, isActive, isActive ? (meta || "") : "");
        btn.disabled = !!calAdminFetchJob.active && !isActive;
      });
      const saveBtn = $("cal-readings-admin-save");
      if (saveBtn) saveBtn.disabled = !!calAdminFetchJob.active;
    }

    function calAdminSyncFetchButtonMeta(iso, attempt) {
      let meta = iso + " · try " + attempt + "/" + CAL_ADMIN_MAX_FETCH_ATTEMPTS;
      if (calAdminFetchJob.mode === "month") {
        meta = (calAdminFetchJob.done + 1) + "/" + calAdminFetchJob.total + " · " + meta;
      }
      updateCalAdminFetchButtons(meta);
    }

    function calAdminFetchSleep(ms) {
      return new Promise((resolve) => {
        if (calAdminFetchJob.cancelled) {
          resolve(false);
          return;
        }
        const t = setTimeout(() => resolve(true), ms);
        const check = setInterval(() => {
          if (calAdminFetchJob.cancelled) {
            clearTimeout(t);
            clearInterval(check);
            resolve(false);
          }
        }, 50);
        setTimeout(() => clearInterval(check), ms + 50);
      });
    }

    function updateCalAdminFetchStopButtons() {
      updateCalAdminFetchButtons();
    }

    function updateCalAdminFetchProgress(done, total, label) {
      if (label) updateCalAdminFetchButtons(label);
    }

    function beginCalAdminFetchJob(mode, total, scope) {
      if (calAdminFetchJob.active) stopCalAdminFetchJob();
      calAdminFetchJob.active = true;
      calAdminFetchJob.cancelled = false;
      calAdminFetchJob.abort = null;
      calAdminFetchJob.mode = mode;
      calAdminFetchJob.scope = scope || "";
      calAdminFetchJob.total = total || 0;
      calAdminFetchJob.done = 0;
      calAdminFetchJob.improved = 0;
      updateCalAdminFetchButtons(mode === "month" ? "Starting…" : "Fetching…");
    }

    function finishCalAdminFetchJob(message) {
      const wasMonth = calAdminFetchJob.mode === "month";
      calAdminFetchJob.active = false;
      calAdminFetchJob.cancelled = false;
      calAdminFetchJob.abort = null;
      calAdminFetchJob.mode = "";
      calAdminFetchJob.scope = "";
      updateCalAdminFetchButtons();
      if (message) {
        const status = $("cal-month-status");
        if (status && wasMonth) status.textContent = message;
      }
      syncCalendarAdminVisibility();
    }

    function stopCalAdminFetchJob() {
      if (!calAdminFetchJob.active) return;
      calAdminFetchJob.cancelled = true;
      if (calAdminFetchJob.abort) calAdminFetchJob.abort.abort();
      const status = $("cal-month-status");
      const modalStatus = $("cal-readings-admin-status");
      if (status && calAdminFetchJob.mode === "month") status.textContent = "Fetch stopped.";
      if (modalStatus && calAdminFetchJob.mode === "date") modalStatus.textContent = "Fetch stopped.";
    }

    function calAdminDatesForMonthFetch(scope) {
      const y = calendarCursor.getFullYear();
      const m = calendarCursor.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const out = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = formatDateInput(new Date(y, m, d));
        const health = (calendarMonthData[iso] || {}).readings_health;
        if (scope === "all" || health !== "healthy") out.push(iso);
      }
      return out;
    }

    async function postCalAdminFetchDate(iso) {
      calAdminFetchJob.abort = new AbortController();
      const res = await fetch("/api/admin/readings-cache/fetch-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: iso }),
        signal: calAdminFetchJob.abort.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Fetch failed");
      return data;
    }

    function calAdminApplyFetchResult(iso, data) {
      if (!data || !data.health) return;
      const monthKey = calendarCursor.getFullYear() + "-" + (calendarCursor.getMonth() + 1) + "-" + currentCalendarLanguage();
      if (calendarMonthKey === monthKey) {
        calendarMonthData[iso] = Object.assign({}, calendarMonthData[iso] || {}, { readings_health: data.health.status });
        renderCalendarGrid();
      }
      if (calReadingsAdminDate === iso) fillCalReadingsAdminModal(data);
      if (calSelected === iso) setCalDetail(iso);
    }

    async function fetchCalAdminDateWithRetries(iso, opts) {
      const quietMonth = !!(opts && opts.quietMonthStatus);
      const statusEl = $("cal-readings-admin-status");
      const monthStatus = $("cal-month-status");
      let lastData = null;
      let lastBefore = "";
      let attempts = 0;

      for (let attempt = 1; attempt <= CAL_ADMIN_MAX_FETCH_ATTEMPTS; attempt++) {
        if (calAdminFetchJob.cancelled) break;
        attempts = attempt;
        calAdminSyncFetchButtonMeta(iso, attempt);
        const attemptLabel = "Fetching " + iso + " — attempt " + attempt + "/" + CAL_ADMIN_MAX_FETCH_ATTEMPTS + "…";
        if (statusEl && calAdminFetchJob.mode === "date") statusEl.textContent = attemptLabel;
        if (monthStatus && calAdminFetchJob.mode === "month" && !quietMonth) {
          monthStatus.textContent = attemptLabel;
        }
        try {
          lastData = await postCalAdminFetchDate(iso);
          lastBefore = (lastData.fetch && lastData.fetch.before) || "";
          calAdminApplyFetchResult(iso, lastData);
          if (lastData.health && lastData.health.status === "healthy") {
            calAdminFetchJob.improved += lastBefore !== "healthy" ? 1 : 0;
            break;
          }
        } catch (err) {
          if (err && err.name === "AbortError") break;
          if (statusEl && calAdminFetchJob.mode === "date") {
            statusEl.textContent = (err.message || "Fetch failed") + " (attempt " + attempt + "/" + CAL_ADMIN_MAX_FETCH_ATTEMPTS + ")";
          }
          if (attempt >= CAL_ADMIN_MAX_FETCH_ATTEMPTS) break;
        }
        if (attempt < CAL_ADMIN_MAX_FETCH_ATTEMPTS && !calAdminFetchJob.cancelled) {
          await calAdminFetchSleep(500);
        }
      }
      const exhausted = !calAdminFetchJob.cancelled
        && attempts >= CAL_ADMIN_MAX_FETCH_ATTEMPTS
        && lastData
        && lastData.health
        && lastData.health.status !== "healthy";
      return { data: lastData, attempts, exhausted, cancelled: !!calAdminFetchJob.cancelled };
    }

    function calAdminFetchStatusMessage(fetchMeta, opts) {
      if (opts && opts.cancelled) return "Fetch stopped.";
      if (!fetchMeta) return "Fetch finished — no response.";
      const before = fetchMeta.before || "?";
      const after = fetchMeta.after || "?";
      if (fetchMeta.stoppedMaxAttempts) {
        return "Stopped after " + CAL_ADMIN_MAX_FETCH_ATTEMPTS + " attempts — still " + after + ". Edit manually or try later.";
      }
      if (fetchMeta.error) return "Fetch failed: " + fetchMeta.error;
      if (after === "healthy" && before !== after) return "Fetched from USCCB — now healthy.";
      if (after === "healthy") return "Fetched from USCCB — readings look complete.";
      if (fetchMeta.fetched) return "Fetched from USCCB — still " + after + " (bot block or partial data).";
      return "Could not fetch from USCCB. Try again later.";
    }

    async function fetchCalReadingsAdminDate(iso, opts) {
      if (!canUseCalendarReadingsAdmin() || !iso) return null;
      if (calAdminFetchJob.active) {
        notify("Another fetch is already running. Stop it first.", "info");
        return null;
      }
      beginCalAdminFetchJob("date", 1);
      const statusEl = $("cal-readings-admin-status");
      const monthStatus = $("cal-month-status");
      try {
        const result = await fetchCalAdminDateWithRetries(iso, opts);
        const data = result.data;
        if (result.cancelled) {
          if (statusEl) statusEl.textContent = "Fetch stopped.";
          return data;
        }
        const fetchMeta = Object.assign({}, (data && data.fetch) || {}, {
          stoppedMaxAttempts: result.exhausted,
        });
        const msg = calAdminFetchStatusMessage(fetchMeta, { cancelled: false });
        if (statusEl) statusEl.textContent = msg;
        if (monthStatus && !(opts && opts.quietMonthStatus)) monthStatus.textContent = msg;
        return data;
      } catch (err) {
        const message = err.message || "Fetch failed.";
        if (statusEl) statusEl.textContent = message;
        if (monthStatus && !(opts && opts.quietMonthStatus)) monthStatus.textContent = message;
        return null;
      } finally {
        finishCalAdminFetchJob();
      }
    }

    async function fetchCalendarMonthReadings(scope) {
      if (!canUseCalendarReadingsAdmin()) return;
      if (calAdminFetchJob.active) {
        notify("Another fetch is already running.", "info");
        return;
      }
      const allDays = scope === "all";
      const dates = calAdminDatesForMonthFetch(scope || "missing");
      if (!dates.length) {
        const status = $("cal-month-status");
        if (status) status.textContent = allDays ? "No dates in this month." : "All dates in this month look healthy.";
        return;
      }
      beginCalAdminFetchJob("month", dates.length, scope || "missing");
      const status = $("cal-month-status");
      let improved = 0;
      try {
        for (let i = 0; i < dates.length; i++) {
          if (calAdminFetchJob.cancelled) break;
          const iso = dates[i];
          calAdminFetchJob.done = i;
          updateCalAdminFetchButtons((i + 1) + "/" + dates.length + " · " + iso);
          if (status) status.textContent = "Fetching " + iso + " (" + (i + 1) + "/" + dates.length + ")…";
          const beforeHealth = ((calendarMonthData[iso] || {}).readings_health) || "critical";
          const result = await fetchCalAdminDateWithRetries(iso, { quietMonthStatus: true });
          const afterHealth = ((calendarMonthData[iso] || {}).readings_health)
            || ((result.data && result.data.health && result.data.health.status) || beforeHealth);
          if (afterHealth === "healthy" && beforeHealth !== "healthy") improved += 1;
          calAdminFetchJob.done = i + 1;
          updateCalAdminFetchButtons((i + 1) + "/" + dates.length + " · done " + iso);
          if (calAdminFetchJob.cancelled) break;
          if (i < dates.length - 1) await calAdminFetchSleep(350);
        }
        const stopped = calAdminFetchJob.cancelled;
        const summary = stopped
          ? "Fetch stopped — processed " + calAdminFetchJob.done + " of " + dates.length + ", fixed " + improved + "."
          : "Fetch complete — processed " + dates.length + " dates, fixed " + improved + ".";
        calendarMonthKey = "";
        await loadCalendarMonth();
        if (calReadingsAdminDate) openCalReadingsAdminModal(calReadingsAdminDate);
        finishCalAdminFetchJob(summary);
      } catch (err) {
        finishCalAdminFetchJob(err.message || "Fetch failed.");
      }
    }

    var calSelected = upcomingSundayISO();

    function setCalDetail(iso) {
      const prev = calSelected;
      const lang = currentCalendarLanguage();
      if (prev && prev !== iso) stopReadingsPoll(prev);
      calSelected = iso;
      if ($("cal-detail-date")) $("cal-detail-date").textContent = iso;
      document.querySelectorAll(".cal-cell.selected").forEach((c) => c.classList.remove("selected"));
      const btn = document.querySelector(".cal-cell[data-cal=\"" + iso + "\"]");
      if (btn) btn.classList.add("selected");
      const snap = calendarMonthData[iso] || {};
      if ($("cal-detail-title")) $("cal-detail-title").textContent = snap.title || "Loading…";
      if ($("cal-detail-season")) $("cal-detail-season").textContent = snap.season || "—";
      if ($("cal-detail-color")) {
        $("cal-detail-color").textContent = (snap.liturgical_color && snap.liturgical_color.color_name) || "—";
      }
      updateCalReadingCard($("cal-gospel-ref"), $("cal-gospel-excerpt"), document.querySelector("[data-target=\"cal-gospel-excerpt\"]"), snap.gospel_reference, snap.gospel_quote_short || "");
      updateCalReadingCard($("cal-psalm-ref"), $("cal-psalm-excerpt"), document.querySelector("[data-target=\"cal-psalm-excerpt\"]"), snap.psalm_reference, snap.psalm_refrain ? "R. " + snap.psalm_refrain : "");
      updateCalReadingCard($("cal-reading1-ref"), $("cal-reading1-excerpt"), document.querySelector("[data-target=\"cal-reading1-excerpt\"]"), snap.first_reading_reference, "");
      updateCalReadingCard($("cal-reading2-ref"), $("cal-reading2-excerpt"), document.querySelector("[data-target=\"cal-reading2-excerpt\"]"), snap.second_reading_reference, "");

      ensureReadingsComplete(iso, {
        language: lang,
        onUpdate: (data) => {
          if (calSelected !== iso || currentCalendarLanguage() !== lang) return;
          applyCalDetailReadings(data, snap, lang);
        },
      }).catch(() => {
        if (calSelected !== iso || currentCalendarLanguage() !== lang) return;
        if ($("cal-detail-title")) $("cal-detail-title").textContent = "Preview unavailable";
      });
    }

    function applyCalDetailReadings(data, snap, language) {
      const lang = language || currentCalendarLanguage();
      const phTitle = (lang === "english" && snap && snap.calendar_region === "philippines" && snap.title)
        ? snap.title
        : "";
      if ($("cal-detail-title")) {
        $("cal-detail-title").textContent = phTitle || data.title || snap.title || "Mass";
      }
      if ($("cal-detail-season")) $("cal-detail-season").textContent = data.season || "—";
      if ($("cal-detail-color")) {
        $("cal-detail-color").textContent = (data.liturgical_color && data.liturgical_color.color_name) || "—";
      }
      const gospelBody = (data.gospel_text || data.gospel_quote || "").trim();
      const psalmBody = calExtractPsalmRefrain(data.psalm_text || "") || calExtractPsalmRefrain(snap.psalm_refrain || "");
      const psalmRef = data.psalm_reference || snap.psalm_reference || "";
      updateCalReadingCard($("cal-gospel-ref"), $("cal-gospel-excerpt"), document.querySelector("[data-target=\"cal-gospel-excerpt\"]"), data.gospel_reference, gospelBody);
      updateCalReadingCard($("cal-psalm-ref"), $("cal-psalm-excerpt"), document.querySelector("[data-target=\"cal-psalm-excerpt\"]"), psalmRef, psalmBody ? "R. " + psalmBody : (data.psalm_text || "").trim());
      updateCalReadingCard($("cal-reading1-ref"), $("cal-reading1-excerpt"), document.querySelector("[data-target=\"cal-reading1-excerpt\"]"), data.first_reading_reference, data.first_reading_excerpt || "");
      updateCalReadingCard($("cal-reading2-ref"), $("cal-reading2-excerpt"), document.querySelector("[data-target=\"cal-reading2-excerpt\"]"), data.second_reading_reference, data.second_reading_excerpt || "");
    }

    var RECENT_SONGS_KEY = "churchMediaRecentSongAdds";
    var SONG_HISTORY_MAX = 120;
    var SONG_HISTORY_SCOPE_KEY = "verbumSongHistoryScope";
    var songHistorySyncTimer = 0;
    var songHistoryPullPromise = null;
    var songHistoryParishPullPromise = null;
    var songHistoryGlobalPullPromise = null;
    var parishSongHistoryRows = [];
    var globalSongHistoryRows = [];
    var SONG_HISTORY_KIND_LABELS = {
      new: "Added",
      edited: "Edited",
      lyrics_updated: "Updated lyrics",
      saved: "Updated lyrics",
      deleted: "Deleted",
    };
    var COMPOSER_RECENT_KINDS = new Set(["new", "edited", "lyrics_updated", "saved", "deleted"]);
    var SECTION_ORDER = [
      { key: "entrance", label: "Entrance" },
      { key: "offertory", label: "Offertory" },
      { key: "communion", label: "Communion" },
      { key: "recessional", label: "Recessional" },
      { key: "meditation", label: "Meditation" },
    ];
    var songCatalogData = null;
    var songCatalogFilter = "";
    var composerPendingFromMassSearch = null;
    var composerSuppressPreload = false;
    var composerEditorLoadSeq = 0;
    var songCatalogLoaded = false;
    var songCatalogLoadPromise = null;
    var songCatalogLoadSeq = 0;
    var SONG_CATALOG_SEARCH_DEBOUNCE_MS = 320;
    var SONG_CATALOG_SEARCH_MIN_LEN = 2;
    var SONG_CATALOG_SEARCH_MAX_LEN = 200;
    var SONG_CATALOG_SEARCH_MIN_WORDS = 1;
    var SONG_CATALOG_SEARCH_MAX_WORDS = 25;
    var songDetailCache = new Map();
    var songDetailInflight = new Map();
    var SONG_DETAIL_SS_PREFIX = "verbumSong:"; // legacy — no longer persisted
    var songDetailPrefetchTimer = null;
    var lyricsAnalyzeFrame = 0;
    var songCatalogExpanded = { entrance: false, offertory: false, communion: false, recessional: false, meditation: false };

    function songDetailCacheKey(section, id) {
      return String(section || "").trim().toLowerCase() + "\0" + String(id || "").trim();
    }

    function invalidateSongCatalogCaches() {
      songCatalogLoaded = false;
      songDetailCache.clear();
      songDetailInflight.clear();
    }

    function readStoredSongDetail(_key) {
      return null;
    }

    function writeStoredSongDetail(_key, _data) {
      /* lyrics stay in memory only — not sessionStorage */
    }

    async function catalogAuthHeaders() {
      if (window.VerbumAuth && window.VerbumAuth.getAuthHeaders) {
        return await window.VerbumAuth.getAuthHeaders();
      }
      return {};
    }

    function applySongMetaToForm(section, meta) {
      const s = meta || {};
      if ($("lyrics-save-title")) $("lyrics-save-title").value = s.title || "";
      if ($("lyrics-save-author")) $("lyrics-save-author").value = s.author || "";
      const lang = String(s.language || "").trim();
      if (lang) setComposerSongLanguage(lang);
      const sec = String(section || s.section || "").trim().toLowerCase();
      if (sec) setComposerSongSection(sec);
      composerGospelMoods = Array.isArray(s.gospel_moods) ? s.gospel_moods.slice() : [];
      if (typeof syncComposerAccordionMoodsFromState === "function") syncComposerAccordionMoodsFromState();
      if (typeof updateLyricsComposerDetailsPreview === "function") updateLyricsComposerDetailsPreview();
    }

    function mergeSongEditorMeta(catalogRow, apiSong, section, hint) {
      const cat = catalogRow || {};
      const api = apiSong || {};
      const hints = hint || {};
      const catLang = String(cat.language || "").trim();
      const apiLang = String(api.language || "").trim();
      const hintLang = String(hints.language || "").trim();
      return {
        id: String(api.id || cat.id || "").trim(),
        title: String(api.title || cat.title || hints.title || "").trim(),
        author: String(api.author || cat.author || "").trim(),
        language: catLang || apiLang || hintLang,
        gospel_moods: Array.isArray(api.gospel_moods) && api.gospel_moods.length
          ? api.gospel_moods.slice()
          : (Array.isArray(cat.gospel_moods) ? cat.gospel_moods.slice() : []),
        section: String(section || cat.section || api.section || hints.section || "").trim().toLowerCase(),
      };
    }

    function resolveCatalogSongPlacement(section, id, title) {
      const SECS = SECTION_ORDER.map((s) => s.key);
      const sid = String(id || "").trim();
      const ttl = String(title || "").trim().toLowerCase();
      const preferred = String(section || "").trim().toLowerCase();
      if (!songCatalogData) {
        return preferred && sid ? { section: preferred, id: sid, row: null } : null;
      }
      if (sid) {
        for (let i = 0; i < SECS.length; i += 1) {
          const sec = SECS[i];
          const row = (songCatalogData[sec] || []).find((r) => String(r.id || "").trim() === sid);
          if (row) return { section: sec, id: sid, row };
        }
      }
      if (ttl && preferred) {
        const prefRow = (songCatalogData[preferred] || []).find((r) =>
          String(r.title || "").trim().toLowerCase() === ttl
        );
        if (prefRow) {
          return {
            section: preferred,
            id: String(prefRow.id || sid).trim(),
            row: prefRow,
          };
        }
      }
      if (ttl) {
        for (let i = 0; i < SECS.length; i += 1) {
          const sec = SECS[i];
          const row = (songCatalogData[sec] || []).find((r) =>
            String(r.title || "").trim().toLowerCase() === ttl
          );
          if (row) {
            return { section: sec, id: String(row.id || sid).trim(), row };
          }
        }
      }
      return preferred && sid ? { section: preferred, id: sid, row: null } : null;
    }

    function bustStoredSongDetail(section, id) {
      const key = songDetailCacheKey(section, id);
      songDetailCache.delete(key);
      try {
        sessionStorage.removeItem(SONG_DETAIL_SS_PREFIX + key);
      } catch (_e) { /* ignore */ }
    }

    function scheduleLyricsStructuredSync(quiet) {
      if (lyricsAnalyzeFrame) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(lyricsAnalyzeFrame);
        else cancelAnimationFrame(lyricsAnalyzeFrame);
        lyricsAnalyzeFrame = 0;
      }
      const run = () => {
        lyricsAnalyzeFrame = 0;
        if (syncInputPanelToStructuredEditor({ quiet: !!quiet, writeBack: false })) {
          commitLyricsAnalyzedSnapshot();
        }
        autoResizeLyricsMainInput();
      };
      if (typeof requestIdleCallback === "function") {
        lyricsAnalyzeFrame = requestIdleCallback(run, { timeout: 900 });
      } else {
        lyricsAnalyzeFrame = requestAnimationFrame(run);
      }
    }

    function songDetailCacheIsStale(stored, section, id) {
      if (!stored || !stored.ok || !songCatalogData) return false;
      const placement = resolveCatalogSongPlacement(section, id);
      const catalogRow = placement && placement.row ? placement.row : null;
      if (!catalogRow) return false;
      const cachedLang = String((stored.song && stored.song.language) || "").trim();
      const catalogLang = String(catalogRow.language || "").trim();
      if (catalogLang && cachedLang !== catalogLang) return true;
      const cachedTitle = String((stored.song && stored.song.title) || "").trim();
      const catalogTitle = String(catalogRow.title || "").trim();
      if (catalogTitle && cachedTitle !== catalogTitle) return true;
      return false;
    }

    async function fetchSongDetail(section, id, options) {
      const opts = options || {};
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      const key = songDetailCacheKey(sec, sid);
      if (opts.forceNetwork) {
        bustStoredSongDetail(sec, sid);
      } else if (songDetailCache.has(key)) {
        return songDetailCache.get(key);
      }
      if (!opts.forceNetwork) {
        const stored = readStoredSongDetail(key);
        if (stored && stored.ok) {
          if (songDetailCacheIsStale(stored, sec, sid)) {
            bustStoredSongDetail(sec, sid);
          } else {
            songDetailCache.set(key, stored);
            return stored;
          }
        }
      }
      if (!opts.forceNetwork && songDetailInflight.has(key)) return songDetailInflight.get(key);
      const req = (async () => {
        const headers = await catalogAuthHeaders();
        const res = await fetch(
          "/api/catalog/songs/" + encodeURIComponent(sec) + "/" + encodeURIComponent(sid),
          { headers, cache: opts.forceNetwork ? "no-store" : "default" }
        );
        if (!res.ok) {
          let detail = "";
          try {
            const errBody = await res.json();
            detail = String((errBody && errBody.detail) || "").trim();
          } catch (_e) { /* ignore */ }
          if (res.status === 429) {
            throw new Error(detail || "Too many song loads. Wait a minute and try again.");
          }
          if (res.status === 401) {
            throw new Error("Sign in required to load songs.");
          }
          if (res.status === 403) {
            throw new Error(detail || "You do not have access to load this song.");
          }
          if (res.status === 404) {
            throw new Error(detail || "Song not found on the server. Try refreshing the page.");
          }
          throw new Error(detail || ("Could not load song (" + res.status + ")."));
        }
        const data = await res.json();
        songDetailCache.set(key, data);
        writeStoredSongDetail(key, data);
        return data;
      })().finally(() => {
        songDetailInflight.delete(key);
      });
      songDetailInflight.set(key, req);
      return req;
    }

    function prefetchSongDetail(section, id, options) {
      const opts = options || {};
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      if (!sec || !sid) return;
      if (songDetailCache.has(songDetailCacheKey(sec, sid))) return;
      if (songDetailInflight.has(songDetailCacheKey(sec, sid))) return;
      const run = () => {
        fetchSongDetail(sec, sid).catch(() => {});
      };
      if (opts.immediate) {
        clearTimeout(songDetailPrefetchTimer);
        run();
        return;
      }
      // Avoid burning the production lyric rate limit by prefetching every hovered row.
      if (songDetailInflight.size > 0) return;
      clearTimeout(songDetailPrefetchTimer);
      songDetailPrefetchTimer = setTimeout(run, 450);
    }

    function recentSongDedupeKey(r) {
      const sec = String(r.section || "").trim().toLowerCase();
      const id = String(r.id || "").trim();
      if (sec && id) return sec + "\0" + id;
      return sec + "\0" + String(r.title || "").trim().toLowerCase();
    }

    function songHistoryUserId() {
      try {
        const auth = window.VerbumAuth;
        const user = auth && auth.getUser ? auth.getUser() : null;
        return user && user.id ? String(user.id).trim() : "";
      } catch (_e) {
        return "";
      }
    }

    function songHistoryIsSuperadmin() {
      try {
        return !!(churchMembershipState && churchMembershipState.is_superadmin);
      } catch (_e) {
        return false;
      }
    }

    function songHistoryParishId() {
      try {
        if (churchMembershipState && churchMembershipState.parish_id) {
          return String(churchMembershipState.parish_id).trim();
        }
      } catch (_e) { /* ignore */ }
      return "";
    }

    function songHistoryWriteBucket() {
      // Superadmin catalog edits feed Global; parish members feed Parish.
      return songHistoryIsSuperadmin() ? "global" : "parish";
    }

    function getSongHistoryViewScope() {
      try {
        const saved = String(sessionStorage.getItem(SONG_HISTORY_SCOPE_KEY) || "").trim().toLowerCase();
        if (saved === "mine") return "global";
        if (saved === "parish" || saved === "global") return saved;
      } catch (_e) { /* ignore */ }
      return songHistoryParishId() ? "parish" : "global";
    }

    function setSongHistoryViewScope(scope) {
      let next = scope === "parish" ? "parish" : "global";
      if (next === "parish" && !songHistoryParishId()) next = "global";
      try {
        sessionStorage.setItem(SONG_HISTORY_SCOPE_KEY, next);
      } catch (_e) { /* ignore */ }
      syncSongHistoryScopeUi();
      renderCollectionsRecent();
      renderComposerRecent();
      if (next === "parish") void pullParishSongHistoryFromAccount();
      else void pullGlobalSongHistoryFromAccount();
    }

    function syncSongHistoryScopeUi() {
      const hasParish = !!songHistoryParishId();
      let scope = getSongHistoryViewScope();
      if (scope === "parish" && !hasParish) scope = "global";
      const composerScope = $("song-composer-recent-scope");
      const collectionsScope = $("collections-recent-scope");
      if (composerScope) composerScope.hidden = false;
      if (collectionsScope) collectionsScope.hidden = false;
      document.querySelectorAll("#song-composer-recent-scope label, #collections-recent-scope label").forEach((label) => {
        const input = label.querySelector('input[type="radio"]');
        if (!input) return;
        if (input.value === "parish") {
          label.hidden = !hasParish;
          input.disabled = !hasParish;
        } else {
          label.hidden = false;
          input.disabled = false;
        }
      });
      document.querySelectorAll('input[name="song-recent-scope"]').forEach((input) => {
        input.checked = input.value === scope;
      });
      document.querySelectorAll('input[name="collections-recent-scope"]').forEach((input) => {
        input.checked = input.value === scope;
      });
    }

    function songHistoryStorageKey() {
      const uid = songHistoryUserId();
      if (songHistoryWriteBucket() === "global") {
        return uid ? RECENT_SONGS_KEY + ":global:u:" + uid : RECENT_SONGS_KEY + ":global";
      }
      const pid = songHistoryParishId();
      if (uid && pid) return RECENT_SONGS_KEY + ":u:" + uid + ":p:" + pid;
      if (uid) return RECENT_SONGS_KEY + ":u:" + uid;
      return RECENT_SONGS_KEY;
    }

    function readSongHistoryRawFromKey(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch (_e) {
        return [];
      }
    }

    function writeSongHistoryRaw(raw) {
      try {
        localStorage.setItem(
          songHistoryStorageKey(),
          JSON.stringify((raw || []).slice(0, SONG_HISTORY_MAX))
        );
      } catch (_e) { /* ignore quota */ }
    }

    function mergeSongHistoryLists() {
      const sources = [];
      const uid = songHistoryUserId();
      const pid = songHistoryParishId();
      sources.push(readSongHistoryRawFromKey(songHistoryStorageKey()));
      if (uid) {
        sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY + ":global:u:" + uid));
        if (pid) sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY + ":u:" + uid + ":p:" + pid));
        sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY + ":u:" + uid));
        sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY + ":u:" + uid + ":p:none"));
      }
      sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY + ":global"));
      sources.push(readSongHistoryRawFromKey(RECENT_SONGS_KEY));
      const seen = new Set();
      const merged = [];
      sources.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((raw) => {
          const r = normalizeSongHistoryRow(raw);
          if (!r || !r.title) return;
          const key = recentSongDedupeKey(r);
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(r);
        });
      });
      merged.sort((a, b) => (b.t || 0) - (a.t || 0));
      return merged.slice(0, SONG_HISTORY_MAX);
    }

    async function pullParishSongHistoryFromAccount() {
      if (!memberApiAvailable() || !songHistoryParishId()) {
        parishSongHistoryRows = [];
        return false;
      }
      if (songHistoryParishPullPromise) return songHistoryParishPullPromise;
      songHistoryParishPullPromise = (async () => {
        try {
          const headers = await catalogAuthHeaders();
          const res = await fetch("/api/user/song-history?scope=parish", { headers, cache: "no-store" });
          if (!res.ok) {
            parishSongHistoryRows = [];
            return false;
          }
          const data = await res.json();
          parishSongHistoryRows = (Array.isArray(data.entries) ? data.entries : [])
            .map((raw) => normalizeSongHistoryRow(raw))
            .filter(Boolean);
          if (getSongHistoryViewScope() === "parish") {
            renderCollectionsRecent();
            renderComposerRecent();
            if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
          }
          return true;
        } catch (_e) {
          parishSongHistoryRows = [];
          return false;
        } finally {
          songHistoryParishPullPromise = null;
        }
      })();
      return songHistoryParishPullPromise;
    }

    async function pullGlobalSongHistoryFromAccount() {
      if (!memberApiAvailable()) {
        globalSongHistoryRows = [];
        return false;
      }
      if (songHistoryGlobalPullPromise) return songHistoryGlobalPullPromise;
      songHistoryGlobalPullPromise = (async () => {
        try {
          const headers = await catalogAuthHeaders();
          const res = await fetch("/api/user/song-history?scope=global", { headers, cache: "no-store" });
          if (!res.ok) {
            globalSongHistoryRows = [];
            return false;
          }
          const data = await res.json();
          globalSongHistoryRows = (Array.isArray(data.entries) ? data.entries : [])
            .map((raw) => normalizeSongHistoryRow(raw))
            .filter(Boolean);
          if (getSongHistoryViewScope() === "global") {
            renderCollectionsRecent();
            renderComposerRecent();
            if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
          }
          return true;
        } catch (_e) {
          globalSongHistoryRows = [];
          return false;
        } finally {
          songHistoryGlobalPullPromise = null;
        }
      })();
      return songHistoryGlobalPullPromise;
    }

    async function pullSongHistoryFromAccount() {
      if (!memberApiAvailable()) return false;
      if (songHistoryPullPromise) return songHistoryPullPromise;
      songHistoryPullPromise = (async () => {
        try {
          // Seed local write-cache from legacy keys, then push own activity into the
          // correct bucket (global for superadmin, parish for members).
          const local = mergeSongHistoryLists();
          if (local.length) {
            writeSongHistoryRaw(local);
            scheduleSongHistoryPush(true);
          }
          syncSongHistoryScopeUi();
          await Promise.all([
            pullGlobalSongHistoryFromAccount(),
            pullParishSongHistoryFromAccount(),
          ]);
          renderCollectionsRecent();
          renderComposerRecent();
          if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
          return true;
        } catch (_e) {
          return false;
        } finally {
          songHistoryPullPromise = null;
        }
      })();
      return songHistoryPullPromise;
    }

    function scheduleSongHistoryPush(immediate) {
      if (!memberApiAvailable()) return;
      if (songHistoryWriteBucket() === "parish" && !songHistoryParishId()) return;
      if (songHistorySyncTimer) {
        clearTimeout(songHistorySyncTimer);
        songHistorySyncTimer = 0;
      }
      const run = async () => {
        songHistorySyncTimer = 0;
        try {
          const rows = getSongHistoryRows(SONG_HISTORY_MAX);
          const headers = Object.assign(
            { "Content-Type": "application/json" },
            await catalogAuthHeaders()
          );
          await fetch("/api/user/song-history", {
            method: "POST",
            headers,
            body: JSON.stringify({ entries: rows }),
          });
          if (songHistoryWriteBucket() === "global") void pullGlobalSongHistoryFromAccount();
          else void pullParishSongHistoryFromAccount();
        } catch (_e) { /* best-effort sync */ }
      };
      if (immediate) {
        void run();
        return;
      }
      songHistorySyncTimer = setTimeout(run, 900);
    }

    function readSongHistoryRaw() {
      return readSongHistoryRawFromKey(songHistoryStorageKey());
    }

    function normalizeSongHistoryRow(r) {
      if (!r) return null;
      let kind = r.kind || "";
      if (!kind) {
        if (r.isNew) kind = "new";
        else if (r.isEdited) kind = "edited";
        else if (r.isLoaded) kind = "loaded";
        else return null;
      }
      if (kind === "loaded" || kind === "opened") return null;
      if (kind === "saved") kind = "lyrics_updated";
      return {
        t: r.t || Date.now(),
        title: r.title || "",
        section: r.section || "",
        id: r.id || "",
        language: r.language || "",
        kind,
        actor_name: r.actor_name || "",
        user_id: r.user_id || "",
      };
    }

    function getActiveSongHistoryRows(limit, kindsFilter) {
      const scope = getSongHistoryViewScope();
      const source =
        scope === "parish" && songHistoryParishId()
          ? (parishSongHistoryRows || [])
          : (globalSongHistoryRows || []);
      if (source.length) {
        const seen = new Set();
        const rows = [];
        source.forEach((r) => {
          if (!r || !r.title) return;
          if (kindsFilter && !kindsFilter.has(r.kind)) return;
          const key = recentSongDedupeKey(r);
          if (seen.has(key)) return;
          seen.add(key);
          rows.push(r);
        });
        return rows.slice(0, limit || 16);
      }
      // Offline / not-yet-synced fallback: local write cache for the active bucket.
      return getSongHistoryRows(limit, kindsFilter);
    }

    function getSongHistoryRows(limit, kindsFilter) {
      const seen = new Set();
      const rows = [];
      readSongHistoryRaw().forEach((raw) => {
        const r = normalizeSongHistoryRow(raw);
        if (!r || !r.title) return;
        if (kindsFilter && !kindsFilter.has(r.kind)) return;
        const key = recentSongDedupeKey(r);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(r);
      });
      return rows.slice(0, limit || 16);
    }

    function pushSongHistory(entry) {
      if (!entry || !entry.title) return;
      pushSongHistoryBatch([entry]);
    }

    function pushSongHistoryBatch(entries) {
      const list = Array.isArray(entries) ? entries.filter((e) => e && e.title) : [];
      if (!list.length) return;
      let raw = readSongHistoryRaw();
      const now = Date.now();
      list.forEach((entry, idx) => {
        const kind = entry.kind || "lyrics_updated";
        if (kind === "loaded" || kind === "opened") return;
        const key = recentSongDedupeKey(entry);
        raw = raw.filter((r) => {
          const n = normalizeSongHistoryRow(r);
          return recentSongDedupeKey(n || r) !== key;
        });
        raw.unshift({
          t: now - idx,
          title: entry.title || "",
          section: entry.section || "",
          id: entry.id || "",
          language: entry.language || "",
          kind,
        });
      });
      // Keep enough room for bulk TXT imports (was 32).
      writeSongHistoryRaw(raw);
      renderCollectionsRecent();
      renderComposerRecent();
      if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
      scheduleSongHistoryPush(false);
    }

    var SONG_IMPORT_UNDO_KEY = "verbum:last-song-import-undo";

    function rememberSongImportUndo(token, expiresAt) {
      const tid = String(token || "").trim();
      if (!tid) return;
      try {
        sessionStorage.setItem(
          SONG_IMPORT_UNDO_KEY,
          JSON.stringify({
            token: tid,
            expiresAt: String(expiresAt || ""),
            savedAt: Date.now(),
          })
        );
      } catch (_err) { /* ignore */ }
    }

    function clearSongImportUndo() {
      try {
        sessionStorage.removeItem(SONG_IMPORT_UNDO_KEY);
      } catch (_err) { /* ignore */ }
      const undoBtn = $("song-save-success-undo");
      if (undoBtn) {
        undoBtn.hidden = true;
        undoBtn.disabled = false;
        undoBtn.dataset.undoToken = "";
      }
    }

    function getRememberedSongImportUndo() {
      try {
        const raw = JSON.parse(sessionStorage.getItem(SONG_IMPORT_UNDO_KEY) || "null");
        if (!raw || !raw.token) return null;
        const expires = Date.parse(String(raw.expiresAt || ""));
        if (Number.isFinite(expires) && Date.now() > expires) {
          clearSongImportUndo();
          return null;
        }
        // Fallback TTL if server didn't send expires_at.
        if (!Number.isFinite(expires) && raw.savedAt && Date.now() - Number(raw.savedAt) > 30 * 60 * 1000) {
          clearSongImportUndo();
          return null;
        }
        return raw;
      } catch (_err) {
        return null;
      }
    }

    function applyImportUndoToSongHistory(results) {
      const rows = Array.isArray(results) ? results : [];
      if (!rows.length) return;
      const idSet = new Set();
      const titleSet = new Set();
      rows.forEach((r) => {
        if (!r) return;
        const id = String(r.id || "").trim();
        const title = String(r.title || "").trim().toLowerCase();
        if (id) idSet.add(id);
        if (title) titleSet.add(title);
      });
      let raw = readSongHistoryRaw().filter((entry) => {
        const n = normalizeSongHistoryRow(entry) || entry;
        const id = String((n && n.id) || "").trim();
        const title = String((n && n.title) || "").trim().toLowerCase();
        if (id && idSet.has(id)) return false;
        if (title && titleSet.has(title)) return false;
        return true;
      });
      const now = Date.now();
      rows.forEach((r, idx) => {
        if (!r || !r.title) return;
        if (r.op === "delete") {
          raw.unshift({
            t: now - idx,
            title: r.title || "",
            section: r.section || "",
            id: r.id || "",
            language: "",
            kind: "deleted",
          });
        }
      });
      writeSongHistoryRaw(raw);
      renderCollectionsRecent();
      renderComposerRecent();
      if (typeof refreshHomeSongsCard === "function") refreshHomeSongsCard();
      scheduleSongHistoryPush(false);
    }

    async function undoLastSongImport(opts) {
      const options = opts || {};
      const remembered = getRememberedSongImportUndo();
      const token = String(options.token || (remembered && remembered.token) || "").trim();
      if (!token) {
        setLyricsStatus("No recent import to undo (expired or already undone).", "warn");
        showToast("No recent import to undo.", "warn");
        return false;
      }
      const undoBtn = $("song-save-success-undo");
      if (undoBtn) undoBtn.disabled = true;
      try {
        const result = await postJSON("/api/lyrics/import-txt/undo", { token });
        clearSongImportUndo();
        await loadSongCatalog(true);
        applyImportUndoToSongHistory(result.results || []);
        if (typeof refreshHomeSongsCard === "function") void refreshHomeSongsCard();
        if (typeof renderComposerRecent === "function") renderComposerRecent();
        closeSongSaveSuccessModal();
        const msg =
          result.message ||
          ("Undid import · restored " + (result.restored || 0) +
            ", removed " + (result.removed || 0) + ".");
        setLyricsStatus(msg, "ok");
        showToast(msg, "ok");
        return true;
      } catch (err) {
        const detail =
          (err && err.message) ||
          "Could not undo import.";
        if (undoBtn) undoBtn.disabled = false;
        setLyricsStatus(String(detail), "error");
        showToast(String(detail), "error");
        return false;
      }
    }

    function renderComposerRecent() {
      const el = $("song-composer-recent-list");
      if (!el) return;
      syncSongHistoryScopeUi();
      const rows = getActiveSongHistoryRows(14, COMPOSER_RECENT_KINDS);
      const scope = getSongHistoryViewScope();
      const showActor = true;
      if (!rows.length) {
        el.innerHTML = scope === "parish"
          ? "<p class=\"song-composer-recent-empty\">Parish song activity from your team appears here.</p>"
          : "<p class=\"song-composer-recent-empty\">Global catalog updates from Verbum appear here.</p>";
        return;
      }
      el.innerHTML = rows.map((r) => {
        const placement = resolveCatalogSongPlacement(r.section, r.id, r.title);
        const displaySec = placement ? placement.section : r.section;
        const displayLang = String(
          (placement && placement.row && placement.row.language) || r.language || ""
        ).trim();
        const hasId = r.id && displaySec && r.kind !== "deleted";
        const badge = SONG_HISTORY_KIND_LABELS[r.kind] || "Recent";
        const metaParts = [songSectionLabel(displaySec)];
        if (r.t) metaParts.push(formatSongHistoryWhen(r.t));
        if (showActor && r.actor_name) metaParts.push(r.actor_name);
        const meta = metaParts.join(" · ");
        const attrs = hasId
          ? " type=\"button\" data-recent-sec=\"" + escapeHtml(displaySec) + "\" data-recent-id=\"" + escapeHtml(r.id) + "\" data-recent-title=\"" + escapeHtml(r.title || "") + "\" data-recent-lang=\"" + escapeHtml(displayLang) + "\""
          : " type=\"button\" disabled";
        return (
          "<button class=\"song-composer-recent-item song-composer-recent-item--" + escapeHtml(r.kind) + "\" role=\"listitem\"" + attrs + ">" +
            "<span class=\"song-composer-recent-item__badge\">" + escapeHtml(badge) + "</span>" +
            "<span class=\"song-composer-recent-item__title\">" + escapeHtml(r.title) + "</span>" +
            "<span class=\"song-composer-recent-item__meta\">" + escapeHtml(meta) + "</span>" +
          "</button>"
        );
      }).join("");
      const top = rows.find((r) => r && r.kind !== "deleted" && r.id && r.section);
      if (top) prefetchSongDetail(top.section, top.id, { immediate: true });
    }

    function formatSongHistoryWhen(ts) {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) {
        return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      }
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function renderCollectionsRecent() {
      const el = $("collections-recent-songs");
      if (!el) return;
      syncSongHistoryScopeUi();
      const rows = getActiveSongHistoryRows(12, COMPOSER_RECENT_KINDS);
      const scope = getSongHistoryViewScope();
      if (!rows.length) {
        el.textContent = scope === "parish"
          ? "No parish activity yet — when your team saves or edits songs, they show up here."
          : "No global catalog updates yet — superadmin song changes appear here.";
        return;
      }
      el.innerHTML = rows.map((r) => {
        const hasId = r.id && r.section;
        const rightBits = [];
        if (r.kind === "edited" || r.kind === "saved" || r.kind === "lyrics_updated") {
          rightBits.push("<span class=\"collections-recent-label\">" + escapeHtml(SONG_HISTORY_KIND_LABELS[r.kind] || "") + "</span>");
        }
        if (hasId) {
          rightBits.push("<button type=\"button\" class=\"ghost\" style=\"font-size:0.76rem;white-space:nowrap;\" data-jump-song=\"" + escapeHtml(r.section) + "\" data-jump-id=\"" + escapeHtml(r.id) + "\">Open</button>");
        }
        const actorBit = r.actor_name
          ? " <span class=\"muted\">· " + escapeHtml(r.actor_name) + "</span>"
          : "";
        return (
          "<div class=\"collections-recent-row\">" +
            "<div><strong>" + escapeHtml(r.title || "Song") + "</strong> <span class=\"muted\">· " + escapeHtml(songSectionLabel(r.section)) + "</span>" + actorBit + "</div>" +
            "<div style=\"display:flex;align-items:center;gap:8px;flex-shrink:0;\">" + rightBits.join("") + "</div>" +
          "</div>"
        );
      }).join("");
    }

    function bindSongHistoryScopeControls() {
      const onScopeChange = (e) => {
        const input = e.target.closest('input[name="song-recent-scope"], input[name="collections-recent-scope"]');
        if (!input || !input.checked) return;
        setSongHistoryViewScope(input.value);
      };
      const composerScope = $("song-composer-recent-scope");
      const collectionsScope = $("collections-recent-scope");
      if (composerScope && !composerScope.dataset.bound) {
        composerScope.dataset.bound = "1";
        composerScope.addEventListener("change", onScopeChange);
      }
      if (collectionsScope && !collectionsScope.dataset.bound) {
        collectionsScope.dataset.bound = "1";
        collectionsScope.addEventListener("change", onScopeChange);
      }
    }

    async function loadSongCatalog(force) {
      if (!memberApiAvailable()) return;
      if (songCatalogLoaded && songCatalogData && !force) {
        rebuildMassPlanSongPool();
        lyricSongSlots.forEach((s) => updateMassSlotChip(s.key));
        if (typeof updateMassSummaryMoodPicks === "function") updateMassSummaryMoodPicks();
        return;
      }
      // Non-force callers may share an in-flight load. Force refresh must not
      // join a stuck/stale promise (that left Edit Details Save spinning forever).
      if (songCatalogLoadPromise && !force) return songCatalogLoadPromise;
      const seq = ++songCatalogLoadSeq;
      const pending = (async () => {
        try {
          const headers = await catalogAuthHeaders();
          const res = await fetch("/api/catalog/songs?lite=1", {
            headers,
            cache: force ? "no-store" : "default",
          });
          const data = await res.json();
          if (seq !== songCatalogLoadSeq) return;
          if (data.ok) {
            songCatalogData = data.catalog;
            songCatalogLoaded = true;
          }
        } catch (_e) {
          if (seq !== songCatalogLoadSeq) return;
          if (!songCatalogData) songCatalogData = null;
        }
        if (seq !== songCatalogLoadSeq) return;
        renderSongCatalog();
        rebuildMassPlanSongPool();
        lyricSongSlots.forEach((s) => updateMassSlotChip(s.key));
        if (typeof updateMassSummaryMoodPicks === "function") updateMassSummaryMoodPicks();
      })();
      songCatalogLoadPromise = pending;
      try {
        await pending;
      } finally {
        if (songCatalogLoadPromise === pending) songCatalogLoadPromise = null;
      }
    }

    function refreshSongCatalogInBackground() {
      invalidateSongCatalogCaches();
      void loadSongCatalog(true).catch(function () { /* catalog refresh is best-effort */ });
    }

    function filterSongCatalogRows(rows, secKey, query) {
      const q = (query || "").trim().toLowerCase();
      if (!q) return rows || [];
      const tokens = q.split(/\s+/).filter(Boolean);
      return (rows || []).filter((row) => {
        const blob = [row.title, row.author, row.language, row.id, secKey].join(" ").toLowerCase();
        if (!tokens.length) return true;
        if (tokens.length === 1) return blob.includes(tokens[0]);
        return tokens.every((token) => blob.includes(token));
      });
    }

    function normalizeSongCatalogSearchText(raw) {
      return String(raw || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
    }

    function trimSongCatalogSearchText(raw) {
      return normalizeSongCatalogSearchText(raw).trim();
    }

    function songCatalogSearchWords(query) {
      const q = trimSongCatalogSearchText(query);
      if (!q) return [];
      return q.split(" ").map((token) => token.replace(/^[^\w\d\u00C0-\u024F]+|[^\w\d\u00C0-\u024F]+$/gi, "")).filter(Boolean);
    }

    function isSongCatalogLyricsTagWord(word) {
      const w = String(word || "").trim().toLowerCase();
      return w === "lyrics" || w === "lirik";
    }

    function songCatalogSearchCountableWords(query) {
      return songCatalogSearchWords(query).filter((w) => !isSongCatalogLyricsTagWord(w));
    }

    function stripSongCatalogLyricsTag(query) {
      let q = trimSongCatalogSearchText(query);
      if (!q) return q;
      q = q.replace(/\blyrics\b|\blirik\b/gi, " ").replace(/\s+/g, " ").trim();
      return q;
    }

    function normalizeSongCatalogLyricsTag(query) {
      const words = songCatalogSearchWords(query);
      if (!words.length) return "";
      const hadLyricsTag = words.some((w) => isSongCatalogLyricsTagWord(w));
      const contentWords = words.filter((w) => !isSongCatalogLyricsTagWord(w));
      if (hadLyricsTag) contentWords.push("lyrics");
      return contentWords.join(" ");
    }

    function getComposerSongLanguage() {
      const sel = $("lyrics-save-language");
      return sel && sel.value ? String(sel.value).trim() : "";
    }

    function appendSongLanguageToSearchText(text, language) {
      const t = trimSongCatalogSearchText(text);
      const lang = String(language || "").trim();
      if (!t || !lang) return t;
      if (t.toLowerCase().includes(lang.toLowerCase())) return t;
      return t + " " + lang;
    }

    function songTitleWithLanguageForSearch(title, language) {
      return appendSongLanguageToSearchText(title, language || getComposerSongLanguage());
    }

    function songCatalogGoogleSearchPhrase(query, options) {
      const opts = options || {};
      const normalized = normalizeSongCatalogLyricsTag(query);
      let core = stripSongCatalogLyricsTag(normalized);
      if (!core && normalized) core = normalized;
      if (!core) return "lyrics";
      const lang = String(opts.language || "").trim();
      if (lang) core = appendSongLanguageToSearchText(core, lang);
      return core + " lyrics";
    }

    function songCatalogSearchOverLimit(query) {
      const q = trimSongCatalogSearchText(query);
      if (!q) return false;
      const words = songCatalogSearchCountableWords(q);
      return q.length > SONG_CATALOG_SEARCH_MAX_LEN || words.length > SONG_CATALOG_SEARCH_MAX_WORDS;
    }

    function songCatalogSearchMeetsMinimum(query) {
      const q = trimSongCatalogSearchText(query);
      if (!q) return true;
      if (songCatalogSearchOverLimit(q)) return false;
      const words = songCatalogSearchCountableWords(q);
      if (q.length < SONG_CATALOG_SEARCH_MIN_LEN) return false;
      return words.length >= SONG_CATALOG_SEARCH_MIN_WORDS;
    }

    function songCatalogSearchStatusHint(query) {
      const q = trimSongCatalogSearchText(query);
      if (!q) return { text: "", kind: "" };
      if (songCatalogSearchOverLimit(q)) {
        return {
          text: "Search is limited to " + SONG_CATALOG_SEARCH_MAX_WORDS + " words and " + SONG_CATALOG_SEARCH_MAX_LEN + " characters (“lyrics” does not count as a word).",
          kind: "warn",
        };
      }
      if (!songCatalogSearchMeetsMinimum(q)) {
        return {
          text: "Enter " + SONG_CATALOG_SEARCH_MIN_WORDS + "–" + SONG_CATALOG_SEARCH_MAX_WORDS + " words (" + SONG_CATALOG_SEARCH_MIN_LEN + "–" + SONG_CATALOG_SEARCH_MAX_LEN + " characters) to search.",
          kind: "",
        };
      }
      return { text: "", kind: "" };
    }

    function songCatalogLibraryQuery(rawQuery) {
      return stripSongCatalogLyricsTag(rawQuery);
    }

    function songCatalogGoogleLyricsSearchUrl(query, language) {
      const subject = trimSongCatalogSearchText(query);
      const lang = String(language || "").trim();
      if (!subject || !lang || !songCatalogSearchMeetsMinimum(subject)) return "";
      return buildExternalGoogleSearchUrl(songCatalogGoogleSearchPhrase(subject, { language: lang }));
    }

    function songCatalogSearchHasNoMatchesForQuery(query) {
      if (!songCatalogData) return false;
      const q = songCatalogSearchMeetsMinimum(query)
        ? songCatalogLibraryQuery(query).toLowerCase()
        : "";
      if (!q) return false;
      return !SECTION_ORDER.some((sec) => {
        const rows = filterSongCatalogRows(songCatalogData[sec.key] || [], sec.key, q);
        return rows.length > 0;
      });
    }

    var songCatalogGooglePendingQuery = "";
    var songCatalogGoogleSearchOpening = false;

    function closeSongCatalogGoogleConfirmModal() {
      const langPick = $("song-catalog-google-lang");
      const wrap = langPick && langPick.closest(".vb-select");
      if (wrap) closeVerbumSelect(wrap);
      setUiOverlayOpen($("song-catalog-google-modal"), false);
      songCatalogGooglePendingQuery = "";
    }

    function updateSongCatalogGoogleModalPreview() {
      const query = songCatalogGooglePendingQuery;
      const lang = ($("song-catalog-google-lang") && $("song-catalog-google-lang").value) || "";
      const desc = $("song-catalog-google-desc");
      const preview = $("song-catalog-google-preview");
      const core = stripSongCatalogLyricsTag(query) || query;
      if (desc) {
        desc.textContent = core
          ? 'No songs matched in your library for "' + core + '".'
          : "No songs matched in your library.";
      }
      if (preview) {
        preview.textContent = lang
          ? 'Google search: "' + songCatalogGoogleSearchPhrase(query, { language: lang }) + '"'
          : "Choose a language to include in the Google search.";
      }
    }

    function openSongCatalogGoogleConfirmModal(query, options) {
      const opts = options || {};
      const subject = trimSongCatalogSearchText(query);
      if (!subject) return;
      if (!songCatalogSearchMeetsMinimum(subject) && !opts.force) return;
      songCatalogGooglePendingQuery = subject;
      const langPick = $("song-catalog-google-lang");
      const newSongModalOpen = $("composer-new-song-modal") && $("composer-new-song-modal").classList.contains("is-open");
      const modalLang = newSongModalOpen && $("composer-new-song-language") && $("composer-new-song-language").value;
      const composerLang = modalLang || getComposerSongLanguage();
      if (langPick) {
        langPick.value = composerLang || "";
        refreshVerbumSelect(langPick);
      }
      updateSongCatalogGoogleModalPreview();
      setUiOverlayOpen($("song-catalog-google-modal"), true);
      const langTrigger = langPick && langPick.closest(".vb-select") && langPick.closest(".vb-select").querySelector(".vb-select__trigger");
      if (langTrigger) langTrigger.focus();
      else if (langPick) langPick.focus();
    }

    function navigateToComposerWithMassSearch(query, slotKey, options) {
      const opts = options || {};
      const trimmed = trimSongCatalogSearchText(query);
      if (!trimmed) return;
      const title = formatSongTitleCase(stripSongCatalogLyricsTag(trimmed) || trimmed);
      const slot = lyricSongSlots.find((s) => s.key === slotKey);
      composerPendingFromMassSearch = {
        title,
        googleQuery: trimmed,
        section: slot && slot.section ? slot.section : "",
        openGoogle: opts.openGoogle !== false,
      };
      showRoute("/library/songs");
    }

    function applyComposerPendingFromMassSearch() {
      const pending = composerPendingFromMassSearch;
      if (!pending) return false;
      composerPendingFromMassSearch = null;

      resetComposerEditorEmpty();
      if ($("lyrics-save-title")) $("lyrics-save-title").value = pending.title || "";
      if (pending.section) setComposerSongSection(pending.section);
      if ($("song-catalog-search")) {
        $("song-catalog-search").value = pending.title || "";
        applySongCatalogSearch($("song-catalog-search"));
      }
      expandSongComposerPanel();
      setSongComposerDeflated(false);

      if (pending.openGoogle !== false) {
        const googleQuery = pending.googleQuery || pending.title || "";
        requestAnimationFrame(() => {
          openSongCatalogGoogleConfirmModal(googleQuery, { force: true });
        });
      }

      if ($("lyrics-save-title")) $("lyrics-save-title").focus();
      return true;
    }

    function confirmSongCatalogGoogleSearch() {
      if (songCatalogGoogleSearchOpening) return;
      const lang = ($("song-catalog-google-lang") && $("song-catalog-google-lang").value) || "";
      const query = songCatalogGooglePendingQuery;
      if (!query) {
        closeSongCatalogGoogleConfirmModal();
        return;
      }
      if (!lang) {
        if ($("song-catalog-google-lang")) $("song-catalog-google-lang").focus();
        return;
      }
      const url = songCatalogGoogleLyricsSearchUrl(query, lang);
      songCatalogGoogleSearchOpening = true;
      closeSongCatalogGoogleConfirmModal();
      if (url) openExternalGoogleSearch(url);
      window.setTimeout(() => {
        songCatalogGoogleSearchOpening = false;
      }, 500);
    }

    function handleSongCatalogSearchEnter(e) {
      if (e.key !== "Enter") return;
      const el = $("song-catalog-search");
      if (!el || e.target !== el) return;
      e.preventDefault();
      clearTimeout(songCatalogSearchDebounce);
      applySongCatalogSearch(el);
      trimSongCatalogSearchInputOnBlur(el);
      const query = trimSongCatalogSearchText(el.value);
      if (!query || !songCatalogSearchMeetsMinimum(query)) return;
      if (!songCatalogSearchHasNoMatchesForQuery(query)) return;
      openSongCatalogGoogleConfirmModal(query);
    }

    function buildSongCatalogNoMatchesHtml(rawQuery) {
      const q = String(rawQuery || "").trim();
      const canGoogle = songCatalogSearchMeetsMinimum(q);
      const core = stripSongCatalogLyricsTag(q) || q;
      let html = "<div class=\"song-catalog-empty\">";
      html += "<p class=\"muted\">No matches. Clear the search or try another title or author.</p>";
      if (canGoogle) {
        html +=
          "<p class=\"song-catalog-empty__google\">Not in your library? " +
          "<button type=\"button\" class=\"song-catalog-empty__google-btn\" data-catalog-google-search=\"" +
          escapeHtml(q) + "\">Search Google for \"" + escapeHtml(core) + "\" lyrics</button></p>";
      }
      html += "</div>";
      return html;
    }

    function setSongCatalogSearchHint(message, kind) {
      const el = $("song-catalog-search-hint");
      if (!el) return;
      const text = String(message || "").trim();
      el.hidden = !text;
      el.textContent = text;
      el.className = "muted song-composer-search-hint" + (kind ? " " + kind : "");
    }

    function renderSongCatalogInto(root) {
      if (!root) return;
      if (!songCatalogData) {
        root.innerHTML = "<p class=\"muted\" style=\"padding:12px 14px;\">Catalog unavailable.</p>";
        return;
      }
      const statusHint = songCatalogSearchStatusHint(songCatalogFilter);
      const q = songCatalogSearchMeetsMinimum(songCatalogFilter)
        ? songCatalogLibraryQuery(songCatalogFilter).toLowerCase()
        : "";
      if (root.id === "song-catalog-root") {
        setSongCatalogSearchHint(statusHint.text, statusHint.kind);
      }
      const sections = SECTION_ORDER.map((sec) => {
        const allRows = songCatalogData[sec.key] || [];
        const rows = filterSongCatalogRows(allRows, sec.key, q);
        return { sec, allRows, rows };
      });
      if (q && !sections.some((s) => s.rows.length)) {
        root.innerHTML = buildSongCatalogNoMatchesHtml(songCatalogFilter);
        return;
      }
      const visible = q ? sections.filter((s) => s.rows.length) : sections;
      const canEditCatalog = churchMembershipState.is_superadmin;
      root.innerHTML = visible.map(({ sec, allRows, rows }) => {
        const open = q ? true : songCatalogExpanded[sec.key] === true;
        const countLabel = q ? rows.length + " / " + allRows.length : String(allRows.length);
        return (
          "<div class=\"song-sec" + (q ? " song-sec-search-open" : "") + "\" data-sec=\"" + sec.key + "\">" +
            "<button type=\"button\" class=\"song-sec-toggle\" data-sec-toggle=\"" + sec.key + "\">" +
              "<span>" + escapeHtml(sec.label) + "</span><span>" + countLabel + "</span>" +
            "</button>" +
            "<div class=\"song-sec-body" + (open ? "" : " collapsed") + "\" data-sec-body=\"" + sec.key + "\">" +
              (rows.length ? rows.map((row) => (
                "<div class=\"song-row\" data-sid=\"" + escapeHtml(row.id) + "\" data-ssec=\"" + sec.key + "\">" +
                  "<div class=\"song-row-clickable\" role=\"button\" tabindex=\"0\" aria-label=\"Load " + escapeHtml(row.title) + "\">" +
                    "<div class=\"song-row-title\">" + escapeHtml(row.title) + "</div>" +
                    "<div class=\"song-row-meta\">" +
                      (row.author ? escapeHtml(row.author) + " · " : "") +
                      escapeHtml(row.language || "") +
                      (formatGospelMoodsLabel(row.gospel_moods) ? " · " + escapeHtml(formatGospelMoodsLabel(row.gospel_moods)) : "") +
                    "</div>" +
                    ((row.audio_preview && row.audio_preview.basename) || (row.audio_media && row.audio_media.basename) || (row.video_media && row.video_media.basename)
                      ? "<div class=\"song-row-media\" aria-label=\"Linked media\">" +
                          (row.audio_preview && row.audio_preview.basename
                            ? "<span class=\"song-row-media__badge song-row-media__badge--preview\" title=\"Chorus preview\">" +
                              escapeHtml(String((row.audio_preview.duration_sec || 10) + "s")) + "</span>"
                            : "") +
                          (row.audio_media && row.audio_media.basename
                            ? "<span class=\"song-row-media__badge\" title=\"Audio linked\">Audio</span>"
                            : "") +
                          (row.video_media && row.video_media.basename
                            ? "<span class=\"song-row-media__badge song-row-media__badge--video\" title=\"Video linked\">Video</span>"
                            : "") +
                        "</div>"
                      : "") +
                  "</div>" +
                  ((catalogRowPreviewRef(row) || canEditCatalog)
                    ? "<div class=\"song-row-actions\">" +
                        (catalogRowPreviewRef(row)
                          ? "<button type=\"button\" class=\"song-row-play" +
                            (massSectionAudioPlayingSlot === catalogPreviewPlayingSlot(sec.key, row.id) ? " is-playing is-ready" : " is-ready") +
                            "\" data-act=\"play-preview\" title=\"Play " +
                            escapeHtml(String((row.audio_preview && row.audio_preview.duration_sec) || 10)) +
                            "s chorus preview\" aria-label=\"Play chorus preview\">▶</button>"
                          : "") +
                        (canEditCatalog
                          ? "<button type=\"button\" data-act=\"edit\">Edit</button>" +
                            "<button type=\"button\" data-act=\"del\">Delete</button>"
                          : "") +
                      "</div>"
                    : "") +
                "</div>"
              )).join("") : "<p class=\"muted\" style=\"padding:10px 14px;\">No matches.</p>") +
            "</div></div>"
        );
      }).join("");
    }

    function renderSongCatalog() {
      renderSongCatalogInto($("song-catalog-root"));
      renderSongCatalogInto($("collections-catalog-root"));
    }

    function collapseSongCatalogSection(secKey) {
      if (!secKey || !songCatalogExpanded.hasOwnProperty(secKey)) return;
      songCatalogExpanded[secKey] = false;
      requestAnimationFrame(() => renderSongCatalog());
    }

    function findCatalogSongLocation(section, id, title) {
      const placement = resolveCatalogSongPlacement(section, id, title);
      if (!placement) return null;
      return { section: placement.section, id: placement.id };
    }

    function getLatestComposerPreloadEntry() {
      // Prefer the active recent list (global catalog or parish team), newest first.
      const rows = getActiveSongHistoryRows(32, COMPOSER_RECENT_KINDS).filter(
        (r) => r && r.kind !== "deleted" && r.title
      );
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const placement = resolveCatalogSongPlacement(r.section, r.id, r.title);
        if (placement && placement.id) {
          const lang = String(
            (placement.row && placement.row.language) || r.language || ""
          ).trim();
          return Object.assign({}, r, {
            section: placement.section,
            id: placement.id,
            language: lang,
          });
        }
        if (String(r.section || "").trim() && String(r.id || "").trim()) {
          return r;
        }
      }
      return null;
    }

    function songExistsInCatalog(section, id) {
      if (!songCatalogData) return false;
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      return (songCatalogData[sec] || []).some((row) => String(row.id) === sid);
    }

    function composerEditorIsIdleForPreload() {
      if (composerSuppressPreload) return false;
      if (composerLoadedSong && composerLoadedSong.id) return false;
      const raw = ($("lyrics-input") && $("lyrics-input").value.trim()) || "";
      if (raw) return false;
      if (lyricBlocks && lyricBlocks.length) return false;
      return true;
    }

    function maybePreloadComposerFromRecentHistory() {
      try {
        if (typeof normalizeRoute !== "function" || normalizeRoute(currentRoute()) !== "/library/songs") return;
        if (!composerEditorIsIdleForPreload()) return;
        void preloadComposerFromLatestSong();
      } catch (_e) { /* ignore */ }
    }

    var composerPreloadSeq = 0;
    var composerSongLoadingToken = 0;

    function clearComposerSongRowLoading() {
      document.querySelectorAll(".song-row.is-loading-song, .song-composer-recent-item.is-loading-song").forEach((el) => {
        el.classList.remove("is-loading-song");
      });
    }

    function markComposerSongSourceLoading(section, id) {
      clearComposerSongRowLoading();
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      if (!sec || !sid) return;
      document.querySelectorAll(
        '.song-row[data-ssec="' + sec + '"][data-sid="' + sid + '"],' +
        '.song-composer-recent-item[data-recent-sec="' + sec + '"][data-recent-id="' + sid + '"]'
      ).forEach((el) => el.classList.add("is-loading-song"));
    }

    function setComposerSongLoading(active, options) {
      const opts = options || {};
      const workspace = $("lyrics-workspace");
      const panel = $("song-composer-panel");
      const overlay = $("composer-song-loading");
      const label = $("composer-song-loading-label");
      const railStatus = $("song-composer-load-status");
      const titleHint = String(opts.title || "").trim();
      const statusText = titleHint
        ? ("Loading “" + titleHint + "”…")
        : (opts.message || "Loading song…");
      if (active) {
        composerSongLoadingToken += 1;
        if (typeof setSongComposerDeflated === "function") setSongComposerDeflated(true);
        if (workspace) workspace.classList.add("is-loading-song");
        if (panel) panel.classList.add("is-loading-song");
        if (overlay) {
          overlay.hidden = false;
          overlay.setAttribute("aria-hidden", "false");
        }
        if (label) label.textContent = statusText;
        if (railStatus) {
          railStatus.hidden = false;
          railStatus.textContent = statusText;
        }
        if (opts.section && opts.id) markComposerSongSourceLoading(opts.section, opts.id);
        return composerSongLoadingToken;
      }
      const token = opts.token;
      if (token != null && token !== composerSongLoadingToken) return composerSongLoadingToken;
      if (workspace) workspace.classList.remove("is-loading-song");
      if (panel) panel.classList.remove("is-loading-song");
      if (overlay) {
        overlay.hidden = true;
        overlay.setAttribute("aria-hidden", "true");
      }
      if (railStatus) {
        railStatus.hidden = true;
        railStatus.textContent = "";
      }
      clearComposerSongRowLoading();
      return composerSongLoadingToken;
    }

    async function preloadComposerFromLatestSong() {
      const seq = ++composerPreloadSeq;
      const loadingToken = setComposerSongLoading(true, { message: "Loading your recent song…" });
      // Prefer local recent history for an instant open; sync account history in parallel.
      const historyPromise = (
        typeof memberApiAvailable === "function" && memberApiAvailable() && typeof pullSongHistoryFromAccount === "function"
      ) ? pullSongHistoryFromAccount().catch(() => false) : Promise.resolve(false);
      await loadSongCatalog(false);
      if (seq !== composerPreloadSeq) {
        setComposerSongLoading(false, { token: loadingToken });
        return;
      }
      if (composerSuppressPreload) {
        setComposerSongLoading(false, { token: loadingToken });
        return;
      }
      renderComposerRecent();
      let entry = getLatestComposerPreloadEntry();
      if (!entry) {
        await historyPromise;
        if (seq !== composerPreloadSeq) {
          setComposerSongLoading(false, { token: loadingToken });
          return;
        }
        if (composerSuppressPreload) {
          setComposerSongLoading(false, { token: loadingToken });
          return;
        }
        renderComposerRecent();
        entry = getLatestComposerPreloadEntry();
      } else {
        void historyPromise;
      }
      if (!entry) {
        setComposerSongLoading(false, { token: loadingToken });
        if (composerEditorIsIdleForPreload()) {
          resetComposerEditorEmpty();
          setLyricsStatus("Pick a song from the library or start typing new lyrics.", "");
        }
        return;
      }
      prefetchSongDetail(entry.section, entry.id, { immediate: true });
      try {
        await loadSongIntoEditor(entry.section, entry.id, {
          clearSearch: false,
          title: entry.title || "",
          language: entry.language || "",
          loadingToken,
        });
      } catch (_e) {
        setComposerSongLoading(false, { token: loadingToken });
        if (seq !== composerPreloadSeq) return;
        if (composerEditorIsIdleForPreload()) {
          resetComposerEditorEmpty();
          setLyricsStatus("Could not load your most recent song.", "error");
        }
      }
    }

    async function loadSongIntoEditor(section, id, options) {
      const opts = options || {};
      const loadSeq = ++composerEditorLoadSeq;
      composerPreloadSeq += 1;
      composerSuppressPreload = true;
      const clearSearch = opts.clearSearch !== false;
      const forceNetwork = !!opts.forceNetwork;
      const hint = {
        title: String(opts.title || "").trim(),
        language: String(opts.language || "").trim(),
        section: String(section || "").trim().toLowerCase(),
      };
      // Collapse the library immediately so the editor stays in focus while lyrics load.
      if (typeof setSongComposerDeflated === "function") setSongComposerDeflated(true);
      // Paint title immediately so the editor feels responsive while lyrics load.
      if (hint.title || hint.language || hint.section) {
        applySongMetaToForm(hint.section, mergeSongEditorMeta(null, {}, hint.section, hint));
      }
      let loadingToken = opts.loadingToken != null
        ? opts.loadingToken
        : setComposerSongLoading(true, {
            title: hint.title,
            section: hint.section,
            id: String(id || "").trim(),
            message: hint.title ? undefined : "Retrieving song…",
          });
      if (opts.loadingToken != null) {
        // Keep preload overlay, but switch copy to the concrete song title when known.
        const statusText = hint.title
          ? ("Loading “" + hint.title + "”…")
          : "Retrieving song…";
        const labelEl = $("composer-song-loading-label");
        const railStatus = $("song-composer-load-status");
        if (labelEl) labelEl.textContent = statusText;
        if (railStatus) {
          railStatus.hidden = false;
          railStatus.textContent = statusText;
        }
        markComposerSongSourceLoading(hint.section, String(id || "").trim());
      }
      try {
        await loadSongCatalog(false);
        if (loadSeq !== composerEditorLoadSeq) return;
        const requestedSec = String(section || "").trim().toLowerCase();
        const requestedId = String(id || "").trim();
        const placement = resolveCatalogSongPlacement(requestedSec, requestedId, hint.title);
        const sec = placement ? placement.section : requestedSec;
        const sid = placement ? placement.id : requestedId;
        const catalogRow = placement && placement.row ? placement.row : null;
        if (catalogRow || hint.title || hint.language) {
          applySongMetaToForm(sec, mergeSongEditorMeta(catalogRow, {}, sec, hint));
        }
        const songTitle = String((catalogRow && catalogRow.title) || hint.title || "").trim();
        const statusText = songTitle ? ("Loading “" + songTitle + "”…") : "Retrieving song…";
        markComposerSongSourceLoading(sec, sid);
        const labelEl = $("composer-song-loading-label");
        const railStatus = $("song-composer-load-status");
        if (labelEl) labelEl.textContent = statusText;
        if (railStatus) {
          railStatus.hidden = false;
          railStatus.textContent = statusText;
        }
        setLyricsStatus(
          songTitle ? ("Retrieving lyrics for \"" + songTitle + "\"…") : "Retrieving song…",
          ""
        );
        const data = await fetchSongDetail(sec, sid, forceNetwork ? { forceNetwork: true } : {});
        if (loadSeq !== composerEditorLoadSeq) return;
        const s = data.song || {};
        const apiSec = String(data.section || sec).trim().toLowerCase();
        const merged = mergeSongEditorMeta(catalogRow, Object.assign({}, s, { id: sid }), apiSec, hint);
        applySongMetaToForm(apiSec, merged);
        composerLoadedSong = { section: apiSec, id: sid, title: merged.title };
        composerSongMedia = {
          audio: normalizeComposerMediaRef(s.audio_media || (catalogRow && catalogRow.audio_media)),
          video: normalizeComposerMediaRef(s.video_media || (catalogRow && catalogRow.video_media)),
          preview: normalizeAudioPreviewRef(s.audio_preview || (catalogRow && catalogRow.audio_preview)),
        };
        renderComposerSongMediaFields();
        maybeAutoFetchSongPreview(apiSec, sid, {
          title: merged.title || s.title || "",
          audio: composerSongMedia.audio,
          preview: composerSongMedia.preview,
        });
        composerCatalogLyrics = String(
          s.catalog_lyrics != null && String(s.catalog_lyrics).length
            ? s.catalog_lyrics
            : (s.parish_version ? "" : (s.lyrics || ""))
        );
        composerParishVersion = !!s.parish_version;
        if (($("lyrics-input") && $("lyrics-input").value.trim()) || (lyricBlocks && lyricBlocks.length)) {
          pushComposerUndoCheckpoint();
        }
        lyricBlocks = [];
        if ($("lyrics-input")) $("lyrics-input").value = s.lyrics || "";
        scheduleLyricsStructuredSync(true);
        updateParishLyricsControls();
        if (composerParishVersion && !normalizeLyricsForCompare(composerCatalogLyrics)) {
          void refreshComposerCatalogBaseline(apiSec, sid);
        }
        setLyricsStatus(
          "Loaded \"" + (merged.title || s.title || "") + "\" from " + songSectionLabel(apiSec) +
          (composerParishVersion ? " (parish version)." : "."),
          "ok"
        );
        if (clearSearch) clearSongCatalogSearch();
        setSongComposerDeflated(true);
      } finally {
        if (loadSeq === composerEditorLoadSeq) {
          setComposerSongLoading(false, { token: loadingToken });
        }
      }
    }

    function songSectionLabel(key) {
      const hit = SECTION_ORDER.find((s) => s.key === key);
      return hit ? hit.label : key;
    }

    function userHasParishForLyrics() {
      return !!(churchMembershipState && churchMembershipState.parish_id);
    }

    function normalizeLyricsForCompare(text) {
      return String(text || "").replace(/\r\n/g, "\n").replace(/\s+$/gm, "").trim();
    }

    function getComposerEditorLyricsText() {
      const raw = String(($("lyrics-input") && $("lyrics-input").value) || "");
      // Never write blocks back into #lyrics-input while reading — that runs on every
      // raw keystroke via updateParishLyricsControls and made deletes appear to do nothing.
      try {
        if (lyricBlocks.length) {
          if (raw !== lyricsRawSnapshot) return raw;
          flushLyricBlocksFromDom();
          return serializedLyrics() || raw;
        }
      } catch (_e) { /* keep textarea value */ }
      return raw;
    }

    function editorDiffersFromCatalogLyrics() {
      const baseline = normalizeLyricsForCompare(composerCatalogLyrics);
      if (!baseline) return false;
      return normalizeLyricsForCompare(getComposerEditorLyricsText()) !== baseline;
    }

    async function refreshComposerCatalogBaseline(section, id) {
      const sec = String(section || (composerLoadedSong && composerLoadedSong.section) || "").trim().toLowerCase();
      const sid = String(id || (composerLoadedSong && composerLoadedSong.id) || "").trim();
      if (!sec || !sid) return;
      try {
        bustStoredSongDetail(sec, sid);
        const data = await fetchSongDetail(sec, sid, { forceNetwork: true });
        const s = data.song || {};
        const catalog = String(
          s.catalog_lyrics != null && String(s.catalog_lyrics).length
            ? s.catalog_lyrics
            : (s.parish_version ? "" : (s.lyrics || ""))
        );
        if (catalog) composerCatalogLyrics = catalog;
        composerParishVersion = !!s.parish_version;
      } catch (_e) { /* keep existing baseline */ }
      updateParishLyricsControls();
    }

    function updateParishLyricsControls() {
      const wrap = $("song-metadata-sync-wrap");
      const btn = $("btn-sync-catalog-lyrics");
      const hint = $("song-metadata-sync-hint");
      if (wrap) wrap.hidden = false;
      if (!btn) return;
      const hasSong = !!(composerLoadedSong && composerLoadedSong.id);
      const hasBaseline = !!normalizeLyricsForCompare(composerCatalogLyrics);
      const differs = editorDiffersFromCatalogLyrics();
      const canClearOverride = !!(hasSong && composerParishVersion && userHasParishForLyrics());
      const canRestoreLocal = !!(hasSong && hasBaseline && differs);
      const canSync = canClearOverride || canRestoreLocal;
      btn.disabled = !canSync;
      if (canClearOverride) {
        btn.title = "Restore global catalog lyrics and remove the parish override";
        if (hint) {
          hint.textContent = "This song has a parish short version. Sync restores the global catalog lyrics and removes that override.";
        }
      } else if (canRestoreLocal) {
        btn.title = "Restore the global catalog lyrics in the editor";
        if (hint) {
          hint.textContent = "Editor lyrics differ from the global catalog. Sync restores the catalog text (unsaved local edits are discarded).";
        }
      } else if (composerParishVersion && !userHasParishForLyrics()) {
        btn.title = "Join a parish to sync parish lyric versions";
        if (hint) {
          hint.textContent = "Sync restores the global catalog lyrics and removes any parish short-version override for this song.";
        }
      } else {
        btn.title = "Available when lyrics differ from the catalog, or a parish short version is loaded";
        if (hint) {
          hint.textContent = "Sync restores the global catalog lyrics and removes any parish short-version override for this song.";
        }
      }
    }

    async function syncParishLyricsToCatalog() {
      if (!composerLoadedSong || !composerLoadedSong.id) {
        setLyricsStatus("Open a catalog song first, then sync.", "error");
        return;
      }
      const hasOverride = !!composerParishVersion;
      const differs = editorDiffersFromCatalogLyrics();
      if (hasOverride && !userHasParishForLyrics()) {
        setLyricsStatus("Join a parish first to manage parish lyric versions.", "error");
        return;
      }
      if (!hasOverride && !differs) {
        setLyricsStatus("This song is already using the catalog lyrics.", "");
        return;
      }
      const confirmMsg = hasOverride
        ? "Reset this song to the global catalog lyrics? Your parish short version will be removed."
        : "Restore the global catalog lyrics in the editor? Unsaved local edits will be discarded.";
      if (!confirm(confirmMsg)) return;
      const section = composerLoadedSong.section || "meditation";
      const btn = $("btn-sync-catalog-lyrics");
      if (btn) btn.disabled = true;
      try {
        if (hasOverride) {
          const headers = await catalogAuthHeaders();
          const res = await fetch(
            "/api/parish/hymn-overrides/" + encodeURIComponent(section) + "/" + encodeURIComponent(composerLoadedSong.id),
            { method: "DELETE", headers }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || data.error || "Sync failed.");
          composerParishVersion = false;
        }
        let catalogText = composerCatalogLyrics;
        if (!normalizeLyricsForCompare(catalogText)) {
          bustStoredSongDetail(section, composerLoadedSong.id);
          const detail = await fetchSongDetail(section, composerLoadedSong.id, { forceNetwork: true });
          const s = (detail && detail.song) || {};
          catalogText = String(s.catalog_lyrics || s.lyrics || "");
          if (catalogText) composerCatalogLyrics = catalogText;
        }
        if ($("lyrics-input") && catalogText) {
          $("lyrics-input").value = catalogText;
          lyricBlocks = [];
          scheduleLyricsStructuredSync(true);
        } else {
          await loadSongIntoEditor(section, composerLoadedSong.id, {
            title: composerLoadedSong.title,
            clearSearch: false,
          });
        }
        composerParishVersion = false;
        updateParishLyricsControls();
        closeSongMetadataModal();
        const okMsg = hasOverride
          ? "Synced to catalog lyrics."
          : "Restored catalog lyrics in the editor.";
        setLyricsStatus(okMsg, "ok");
        notify(okMsg, "ok");
      } catch (err) {
        setLyricsStatus(err.message || "Sync failed.", "error");
        notify(err.message || "Sync failed.", "error");
      } finally {
        updateParishLyricsControls();
      }
    }

    var songMetaEditCtx = null;
    var songMetaSnapshot = null;
    var songDeletePending = null;

    function setUiOverlayOpen(modal, open) {
      if (!modal) return;
      if (open) {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      } else {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        if (!document.querySelector(".ui-overlay.is-open")) {
          document.body.style.overflow = "";
        }
      }
    }

    function setSongMetadataDismissLabel(mode) {
      const btn = $("song-metadata-cancel");
      if (!btn) return;
      const isClose = mode === "close";
      btn.textContent = isClose ? "Close" : "Cancel";
      btn.setAttribute("aria-label", isClose ? "Close" : "Cancel");
      btn.classList.toggle("is-dismiss-close", isClose);
    }

    function closeSongMetadataModal() {
      setUiOverlayOpen($("song-metadata-modal"), false);
      songMetaEditCtx = null;
      songMetaSnapshot = null;
      clearMetadataMoodAttention();
      const sectionSel = $("song-metadata-edit-section");
      if (sectionSel) sectionSel.disabled = false;
      setSongMetadataSaveButtonState("idle", "Save changes");
      setSongMetadataDismissLabel("cancel");
    }

    function closeSongDeleteModal() {
      setUiOverlayOpen($("song-delete-modal"), false);
      songDeletePending = null;
    }

    async function openSongMetadataModal(section, id) {
      const data = await fetchSongDetail(section, id, { forceNetwork: true });
      const s = data.song || {};
      const resolvedSec = String(data.section || section || "").trim().toLowerCase() || section;
      songMetaEditCtx = { section: resolvedSec, id, intent: "catalog" };
      if ($("song-metadata-title")) $("song-metadata-title").textContent = "Edit song details";
      if ($("song-metadata-edit-title")) $("song-metadata-edit-title").value = s.title || "";
      if ($("song-metadata-edit-author")) $("song-metadata-edit-author").value = s.author || "";
      if ($("song-metadata-edit-language")) $("song-metadata-edit-language").value = s.language || "English";
      if ($("song-metadata-edit-section")) {
        $("song-metadata-edit-section").value = resolvedSec || "";
        $("song-metadata-edit-section").disabled = true;
      }
      if ($("song-metadata-subtitle")) {
        $("song-metadata-subtitle").textContent = "Editing metadata for \"" + (s.title || "Song") + "\".";
      }
      setSongMetadataSaveButtonState("idle", "Save changes");
      if ($("song-metadata-save")) $("song-metadata-save").disabled = true;
      setSongMetadataDismissLabel("cancel");
      clearMetadataMoodAttention();
      setSongMetadataMoodChecks(s.gospel_moods || []);
      composerSongMedia = {
        audio: normalizeComposerMediaRef(s.audio_media),
        video: normalizeComposerMediaRef(s.video_media),
        preview: normalizeAudioPreviewRef(s.audio_preview),
      };
      renderComposerSongMediaFields();
      songMetaSnapshot = captureMetadataModalSnapshot();
      bindMetadataModalDirtyTracking();
      if (composerLoadedSong && String(composerLoadedSong.id) === String(id)) {
        composerParishVersion = !!s.parish_version;
        if (s.catalog_lyrics != null && String(s.catalog_lyrics).length) {
          composerCatalogLyrics = String(s.catalog_lyrics);
        }
      }
      updateParishLyricsControls();
      setUiOverlayOpen($("song-metadata-modal"), true);
      syncVerbumSelectTrigger($("song-metadata-edit-language"));
      syncVerbumSelectTrigger($("song-metadata-edit-section"));
      const titleInput = $("song-metadata-edit-title");
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }

    function captureMetadataModalSnapshot() {
      const snippet = typeof composerAudioSnippetRef === "function" ? composerAudioSnippetRef() : null;
      const youtube = typeof composerYoutubeRef === "function" ? composerYoutubeRef() : null;
      const video = composerSongMedia && composerSongMedia.video;
      return {
        title: String(($("song-metadata-edit-title") && $("song-metadata-edit-title").value) || "").trim(),
        author: String(($("song-metadata-edit-author") && $("song-metadata-edit-author").value) || "").trim(),
        language: String(($("song-metadata-edit-language") && $("song-metadata-edit-language").value) || "").trim(),
        section: String(($("song-metadata-edit-section") && $("song-metadata-edit-section").value) || "").trim(),
        moods: readSongMetadataMoodChecks().slice().sort().join(","),
        audio: snippet ? String(snippet.basename || "") : "",
        youtube: youtube ? String(youtube.youtube_id || youtube.basename || "") : "",
        video: video ? String(video.basename || "") : "",
      };
    }

    function metadataModalIsDirty() {
      if (!songMetaSnapshot) return true;
      const now = captureMetadataModalSnapshot();
      return (
        now.title !== songMetaSnapshot.title ||
        now.author !== songMetaSnapshot.author ||
        now.language !== songMetaSnapshot.language ||
        now.section !== songMetaSnapshot.section ||
        now.moods !== songMetaSnapshot.moods ||
        now.audio !== songMetaSnapshot.audio ||
        now.youtube !== songMetaSnapshot.youtube ||
        now.video !== songMetaSnapshot.video
      );
    }

