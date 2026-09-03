/* Verbum SPA part 9/9: app-09-boot.js
 * Song metadata, saved media library, dashboard boot
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 27501-29749
 */
    function refreshMetadataModalPrimaryState() {
      const btn = $("song-metadata-save");
      if (!btn) return;
      if (btn.classList.contains("is-saving")) return;
      const intent = (songMetaEditCtx && songMetaEditCtx.intent) || "edit";
      if (intent === "save") {
        btn.disabled = false;
        return;
      }
      const dirty = metadataModalIsDirty();
      if (btn.classList.contains("is-saved") && dirty) {
        setSongMetadataSaveButtonState("idle", "Save changes");
        setSongMetadataDismissLabel("cancel");
      }
      btn.disabled = !metadataModalIsDirty();
    }

    function bindMetadataModalDirtyTracking() {
      const modal = $("song-metadata-modal");
      if (!modal || modal.dataset.dirtyBound === "1") return;
      modal.dataset.dirtyBound = "1";
      modal.addEventListener("input", () => refreshMetadataModalPrimaryState());
      modal.addEventListener("change", () => {
        refreshMetadataModalPrimaryState();
        const intent = (songMetaEditCtx && songMetaEditCtx.intent) || "";
        if (intent === "save" && readSongMetadataMoodChecks().length) {
          const moods = $("song-metadata-moods");
          if (moods) moods.classList.remove("is-attention");
          const errEl = $("song-metadata-mood-error");
          if (errEl) errEl.hidden = true;
        }
      });
    }

    function applyMetadataModalToComposerFields() {
      let title = formatSongTitleCase(($("song-metadata-edit-title") && $("song-metadata-edit-title").value) || "");
      if ($("song-metadata-edit-title")) $("song-metadata-edit-title").value = title;
      const author = ($("song-metadata-edit-author") && $("song-metadata-edit-author").value.trim()) || "";
      const language = ($("song-metadata-edit-language") && $("song-metadata-edit-language").value) || "";
      const section = ($("song-metadata-edit-section") && $("song-metadata-edit-section").value) || "";
      const gospel_moods = readSongMetadataMoodChecks();
      if ($("lyrics-save-title")) $("lyrics-save-title").value = title;
      if ($("lyrics-save-author")) $("lyrics-save-author").value = author;
      setComposerSongLanguage(language);
      setComposerSongSection(section);
      composerGospelMoods = gospel_moods.slice();
      setSongMetadataMoodChecks(gospel_moods);
      updateLyricsComposerDetailsPreview();
      return { title, author, language, section, gospel_moods };
    }

    function openComposerSongDetailsModal(opts) {
      const options = opts || {};
      const intent = options.intent || "edit";
      const titleHint = String(options.titleHint || "").trim();
      if (titleHint && $("lyrics-save-title") && !$("lyrics-save-title").value.trim()) {
        $("lyrics-save-title").value = titleHint;
      }
      const title = ($("lyrics-save-title") && $("lyrics-save-title").value.trim()) || "";
      const author = ($("lyrics-save-author") && $("lyrics-save-author").value.trim()) || "";
      const language = ($("lyrics-save-language") && $("lyrics-save-language").value) || "";
      const section = ($("lyrics-save-section") && $("lyrics-save-section").value) || "";
      songMetaEditCtx = { mode: "composer", intent: intent };
      if ($("song-metadata-edit-title")) $("song-metadata-edit-title").value = title;
      if ($("song-metadata-edit-author")) $("song-metadata-edit-author").value = author;
      if ($("song-metadata-edit-language")) $("song-metadata-edit-language").value = language;
      if ($("song-metadata-edit-section")) {
        $("song-metadata-edit-section").disabled = false;
        $("song-metadata-edit-section").value = section || "";
      }
      const saveBtn = $("song-metadata-save");
      const titleEl = $("song-metadata-title");
      const subEl = $("song-metadata-subtitle");
      if (intent === "save") {
        if (titleEl) titleEl.textContent = "Save song";
        if (subEl) {
          subEl.textContent = title
            ? "Review details for \"" + title + "\" before saving to your library."
            : "Add title, language, section, and Gospel mood, then save.";
        }
        setSongMetadataSaveButtonState("idle", "Save");
        if (saveBtn) saveBtn.disabled = false;
        setSongMetadataDismissLabel("cancel");
      } else {
        if (titleEl) titleEl.textContent = "Edit song details";
        if (subEl) {
          subEl.textContent = intent === "paste"
            ? "You pasted lyrics — add a title, language, section, and mood."
            : (title
              ? "Editing details for \"" + title + "\"."
              : "Update title, author, language, section, media, and Gospel mood.");
        }
        setSongMetadataSaveButtonState("idle", "Save changes");
        if (saveBtn) saveBtn.disabled = true;
        setSongMetadataDismissLabel("cancel");
      }
      const detected = inferComposerSongMoods();
      const selected = composerGospelMoods.length ? composerGospelMoods : detected;
      setSongMetadataMoodChecks(selected);
      clearMetadataMoodAttention();
      if (intent === "save" || intent === "paste") {
        pulseMetadataMoodAttention(detected);
      } else {
        const hintEl = $("song-metadata-mood-hint");
        if (hintEl) hintEl.textContent = "Select the mood that best fits this song.";
      }
      songMetaSnapshot = captureMetadataModalSnapshot();
      bindMetadataModalDirtyTracking();
      refreshMetadataModalPrimaryState();
      if (composerLoadedSong && composerLoadedSong.id && !normalizeLyricsForCompare(composerCatalogLyrics)) {
        void refreshComposerCatalogBaseline(composerLoadedSong.section, composerLoadedSong.id);
      } else {
        updateParishLyricsControls();
      }
      songSaveMoodSearchTitle = title;
      renderComposerSongMediaFields();
      setUiOverlayOpen($("song-metadata-modal"), true);
      syncVerbumSelectTrigger($("song-metadata-edit-language"));
      syncVerbumSelectTrigger($("song-metadata-edit-section"));
      const titleInput = $("song-metadata-edit-title");
      if (titleInput) {
        titleInput.focus();
        if (title) titleInput.select();
      }
    }

    async function finishComposerSaveFromModal() {
      const applied = applyMetadataModalToComposerFields();
      if (!applied.title) {
        setLyricsStatus("Song title is required before saving.", "error");
        if ($("song-metadata-edit-title")) $("song-metadata-edit-title").focus();
        return false;
      }
      if (!applied.language) {
        setLyricsStatus("Select a language before saving.", "error");
        if ($("song-metadata-edit-language")) $("song-metadata-edit-language").focus();
        return false;
      }
      if (!applied.section) {
        setLyricsStatus("Select a section before saving.", "error");
        if ($("song-metadata-edit-section")) $("song-metadata-edit-section").focus();
        return false;
      }
      if (!applied.gospel_moods.length) {
        pulseMetadataMoodAttention(inferComposerSongMoods());
        const errEl = $("song-metadata-mood-error");
        if (errEl) errEl.hidden = false;
        return false;
      }
      if (!songCatalogLoaded || !songCatalogData) {
        await loadSongCatalog(true);
      }
      const matches = findExistingCatalogSongMatches(applied.title);
      closeSongMetadataModal();
      if (willSaveAsParishVersion(applied.title, matches)) {
        await performSaveLyrics();
        return true;
      }
      if (
        churchMembershipState &&
        churchMembershipState.is_superadmin &&
        shouldConfirmSongOverwrite(applied.title, applied.section, matches)
      ) {
        openSongSaveOverwriteModal(applied.title, matches, applied.section);
        return true;
      }
      await performSaveLyrics();
      return true;
    }

    function setSongMetadataSaveButtonState(state, labelText) {
      const btn = $("song-metadata-save");
      const label = $("song-metadata-save-label");
      if (!btn) return;
      const next = state === "saving" || state === "saved" || state === "error" ? state : "idle";
      btn.classList.remove("is-saving", "is-saved", "is-error");
      if (next === "saving") btn.classList.add("is-saving");
      if (next === "saved") btn.classList.add("is-saved");
      if (next === "error") btn.classList.add("is-error");
      if (label) {
        if (labelText != null) label.textContent = labelText;
        else if (next === "saving") label.textContent = "Saving…";
        else if (next === "saved") label.textContent = "Saved";
        else if (next === "error") label.textContent = "Failed";
      }
      if (next === "saving" || next === "saved") {
        btn.disabled = true;
        btn.setAttribute("aria-busy", next === "saving" ? "true" : "false");
      } else if (next === "error") {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      } else {
        btn.removeAttribute("aria-busy");
        refreshMetadataModalPrimaryState();
        const intent = (songMetaEditCtx && songMetaEditCtx.intent) || "edit";
        if (label && !labelText) {
          label.textContent = intent === "save" ? "Save" : "Save changes";
        }
      }
    }

    function playSongMetadataSaveSuccess(message) {
      setSongMetadataSaveButtonState("saved");
      setSongMetadataDismissLabel("close");
      songMetaSnapshot = captureMetadataModalSnapshot();
      refreshMetadataModalPrimaryState();
      if (typeof showToast === "function") showToast(message || "Song details saved.", "ok");
    }

    async function patchCatalogSongFromMetadataModal(section, id, title) {
      const author = ($("song-metadata-edit-author") && $("song-metadata-edit-author").value.trim()) || "";
      const language = ($("song-metadata-edit-language") && $("song-metadata-edit-language").value) || "English";
      const gospel_moods = readSongMetadataMoodChecks();
      const patchBody = { title, author, language, gospel_moods };
      const youtube = typeof composerYoutubeRef === "function" ? composerYoutubeRef() : (composerSongMedia && composerSongMedia.audio);
      const snippet = typeof composerAudioSnippetRef === "function" ? composerAudioSnippetRef() : (composerSongMedia && composerSongMedia.preview);
      const video = composerSongMedia && composerSongMedia.video;
      if (youtube) patchBody.audio_media = serializeSongMediaRef(youtube);
      else patchBody.clear_audio_media = true;
      if (snippet) patchBody.audio_preview = serializeAudioPreviewRef(snippet);
      else patchBody.clear_audio_preview = true;
      if (video) patchBody.video_media = { basename: video.basename, display_name: video.display_name || video.basename };
      else patchBody.clear_video_media = true;
      const res = await fetch(
        "/api/catalog/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail || data.error || "Update failed";
        throw new Error(typeof detail === "string" ? detail : "Update failed");
      }
      return { title, author, language, gospel_moods, data };
    }

    async function saveSongMetadataFromModal() {
      const intent = (songMetaEditCtx && songMetaEditCtx.intent) || "edit";
      if (intent === "save") {
        setSongMetadataSaveButtonState("saving", "Saving…");
        try {
          const ok = await finishComposerSaveFromModal();
          if (!ok) setSongMetadataSaveButtonState("idle");
        } catch (err) {
          setSongMetadataSaveButtonState("error", "Failed");
          await new Promise((resolve) => setTimeout(resolve, 500));
          setSongMetadataSaveButtonState("idle");
          throw err;
        }
        return;
      }
      let title = formatSongTitleCase(($("song-metadata-edit-title") && $("song-metadata-edit-title").value) || "");
      if ($("song-metadata-edit-title")) $("song-metadata-edit-title").value = title;
      if (!title) {
        setLyricsStatus("Song title is required.", "error");
        setSongMetadataSaveButtonState("error", "Title required");
        await new Promise((resolve) => setTimeout(resolve, 700));
        setSongMetadataSaveButtonState("idle");
        return;
      }
      if (songMetaEditCtx && songMetaEditCtx.mode === "composer") {
        if (intent !== "save" && !metadataModalIsDirty()) {
          setSongMetadataSaveButtonState("error", "No changes");
          await new Promise((resolve) => setTimeout(resolve, 550));
          setSongMetadataSaveButtonState("idle");
          return;
        }
        setSongMetadataSaveButtonState("saving");
        try {
          applyMetadataModalToComposerFields();
          if (
            intent !== "save" &&
            composerLoadedSong &&
            composerLoadedSong.id &&
            churchMembershipState &&
            churchMembershipState.is_superadmin
          ) {
            const section = composerLoadedSong.section || (($("lyrics-save-section") && $("lyrics-save-section").value) || "meditation");
            const id = composerLoadedSong.id;
            await patchCatalogSongFromMetadataModal(section, id, title);
            composerLoadedSong = { section, id, title };
            mergeSavedSongIntoLocalCatalog({
              id,
              title,
              section,
              audio_media: composerSongMedia && composerSongMedia.audio,
              video_media: composerSongMedia && composerSongMedia.video,
              audio_preview: composerSongMedia && composerSongMedia.preview,
            });
            renderSongCatalog();
            refreshSongCatalogInBackground();
          }
          playSongMetadataSaveSuccess("Song details saved.");
          setLyricsStatus("Song details updated.", "ok");
        } catch (err) {
          setSongMetadataSaveButtonState("error", "Failed");
          await new Promise((resolve) => setTimeout(resolve, 650));
          setSongMetadataSaveButtonState("idle");
          throw err;
        }
        return;
      }
      if (!guardSuperadminAction()) return;
      if (!songMetaEditCtx) return;
      if (!metadataModalIsDirty()) {
        setSongMetadataSaveButtonState("error", "No changes");
        await new Promise((resolve) => setTimeout(resolve, 550));
        setSongMetadataSaveButtonState("idle");
        return;
      }
      const { section, id } = songMetaEditCtx;
      setSongMetadataSaveButtonState("saving");
      try {
        const patched = await patchCatalogSongFromMetadataModal(section, id, title);
        mergeSavedSongIntoLocalCatalog({
          id,
          title: patched.title,
          section,
          audio_media: composerSongMedia && composerSongMedia.audio,
          video_media: composerSongMedia && composerSongMedia.video,
          audio_preview: composerSongMedia && composerSongMedia.preview,
        });
        renderSongCatalog();
        refreshSongCatalogInBackground();
        if ($("lyrics-save-title")) $("lyrics-save-title").value = patched.title;
        if ($("lyrics-save-author")) $("lyrics-save-author").value = patched.author;
        setComposerSongLanguage(patched.language);
        composerGospelMoods = patched.gospel_moods.slice();
        updateLyricsComposerDetailsPreview();
        pushSongHistory({ title: patched.title, section, id, kind: "edited" });
        playSongMetadataSaveSuccess("Updated \"" + patched.title + "\".");
        setLyricsStatus("Updated \"" + patched.title + "\".", "ok");
      } catch (err) {
        setSongMetadataSaveButtonState("error", "Failed");
        await new Promise((resolve) => setTimeout(resolve, 650));
        setSongMetadataSaveButtonState("idle");
        throw err;
      }
    }

    function openSongDeleteConfirmModal(section, id, title) {
      songDeletePending = { section, id, title: title || "" };
      const desc = $("song-delete-desc");
      if (desc) {
        desc.textContent =
          "Remove \"" + (title || "this song") + "\" from " + songSectionLabel(section) + "? This cannot be undone.";
      }
      setUiOverlayOpen($("song-delete-modal"), true);
    }

    async function confirmSongDeleteFromModal() {
      if (!guardSuperadminAction()) return;
      if (!songDeletePending) return;
      const { section, id, title } = songDeletePending;
      const confirmBtn = $("song-delete-confirm");
      if (confirmBtn) {
        if (confirmBtn.disabled) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Deleting…";
      }
      try {
        const headers = await catalogAuthHeaders();
        const res = await fetch(
          "/api/catalog/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(id),
          { method: "DELETE", headers }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail || data.error || "Delete failed";
          throw new Error(typeof detail === "string" ? detail : "Delete failed");
        }
        if (songCatalogData) {
          Object.keys(songCatalogData).forEach((sec) => {
            if (!Array.isArray(songCatalogData[sec])) return;
            songCatalogData[sec] = songCatalogData[sec].filter(
              (row) => String(row.id || "").trim() !== String(id || "").trim()
            );
          });
        }
        if (composerLoadedSong && String(composerLoadedSong.id || "").trim() === String(id || "").trim()) {
          composerLoadedSong = null;
        }
        renderSongCatalog();
        closeSongDeleteModal();
        pushSongHistory({ title: title || "Song", section, id, kind: "deleted" });
        refreshSongCatalogInBackground();
        setLyricsStatus("Song removed from catalog.", "ok");
        if (typeof showToast === "function") showToast("Removed \"" + (title || "song") + "\".", "ok");
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Delete";
        }
      }
    }

    function clearSongCatalogSearch() {
      songCatalogFilter = "";
      const a = $("song-catalog-search");
      const b = $("collections-catalog-search");
      if (a) a.value = "";
      if (b) b.value = "";
      syncSongSearchClearButton();
      setSongCatalogSearchHint("", "");
      renderSongCatalog();
    }

    function syncSongSearchClearButton() {
      const input = $("song-catalog-search");
      const btn = $("song-catalog-search-clear");
      if (!btn || !input) return;
      const hasText = !!(input.value || "").trim();
      btn.classList.toggle("is-idle", !hasText);
      btn.setAttribute("aria-hidden", hasText ? "false" : "true");
      btn.tabIndex = hasText ? 0 : -1;
    }

    function initSongCatalogModals() {
      const metaModal = $("song-metadata-modal");
      const delModal = $("song-delete-modal");
      [
        ["song-metadata-backdrop", closeSongMetadataModal],
        ["song-metadata-close", closeSongMetadataModal],
        ["song-metadata-cancel", closeSongMetadataModal],
        ["song-delete-backdrop", closeSongDeleteModal],
        ["song-delete-close", closeSongDeleteModal],
        ["song-delete-cancel", closeSongDeleteModal],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      $("song-metadata-save") && $("song-metadata-save").addEventListener("click", () => {
        const btn = $("song-metadata-save");
        if (btn && (btn.disabled || btn.classList.contains("is-saving") || btn.classList.contains("is-saved"))) return;
        saveSongMetadataFromModal().catch((err) => {
          setLyricsStatus(err.message || "Could not save song details.", "error");
          if (typeof showToast === "function") showToast(err.message || "Could not save song details.", "error");
        });
      });
      $("song-metadata-audio-pick") && $("song-metadata-audio-pick").addEventListener("click", () => {
        openMassMediaPickModal("audio", "song-composer", { purpose: "song", songField: "audio" });
      });
      $("song-metadata-video-pick") && $("song-metadata-video-pick").addEventListener("click", () => {
        openMassMediaPickModal("video", "song-composer", { purpose: "song", songField: "video" });
      });
      $("song-metadata-audio-play") && $("song-metadata-audio-play").addEventListener("click", () => {
        playComposerSongMedia("audio", $("song-metadata-audio-play")).catch(() => {});
      });
      $("song-metadata-youtube-play") && $("song-metadata-youtube-play").addEventListener("click", () => {
        playComposerYouTube($("song-metadata-youtube-play"));
      });
      const ytLinkBtn = $("song-metadata-audio-youtube-link");
      const ytField = $("song-metadata-audio-youtube");
      const ytSearchBtn = $("song-metadata-audio-youtube-search");
      const ytClearBtn = $("song-metadata-audio-youtube-clear");
      function commitComposerYouTubeLink() {
        const ref = youtubeMediaRefFromInput(ytField && ytField.value);
        if (!ref) {
          if (typeof notify === "function") notify("Enter a valid YouTube URL.", "warn");
          return;
        }
        setComposerYouTubeLink(ref);
        if (typeof notify === "function") notify("YouTube linked for choir practice.", "ok");
        if (composerLoadedSong && composerLoadedSong.id) {
          maybeAutoFetchSongPreview(composerLoadedSong.section, composerLoadedSong.id, {
            title: composerLoadedSong.title || (($("song-metadata-edit-title") && $("song-metadata-edit-title").value) || ""),
            audio: ref,
            preview: composerSongMedia && composerSongMedia.preview,
          });
        }
      }
      if (ytSearchBtn) {
        ytSearchBtn.addEventListener("click", () => {
          openYouTubeSearchForComposerSong();
        });
      }
      if (ytClearBtn) {
        ytClearBtn.addEventListener("click", () => {
          clearComposerYouTubeLink();
        });
      }
      if (ytLinkBtn) ytLinkBtn.addEventListener("click", commitComposerYouTubeLink);
      if (ytField) {
        ytField.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitComposerYouTubeLink();
          }
        });
      }
      $("song-metadata-video-play") && $("song-metadata-video-play").addEventListener("click", () => {
        playComposerSongMedia("video", $("song-metadata-video-play")).catch(() => {});
      });
      $("lyrics-composer-play-audio") && $("lyrics-composer-play-audio").addEventListener("click", () => {
        playComposerSongMedia("audio", $("lyrics-composer-play-audio")).catch(() => {});
      });
      $("lyrics-composer-play-youtube") && $("lyrics-composer-play-youtube").addEventListener("click", () => {
        playComposerYouTube($("lyrics-composer-play-youtube"));
      });
      $("lyrics-composer-play-video") && $("lyrics-composer-play-video").addEventListener("click", () => {
        playComposerSongMedia("video", $("lyrics-composer-play-video")).catch(() => {});
      });
      $("song-media-preview-close") && $("song-media-preview-close").addEventListener("click", closeSongMediaPreviewModal);
      const songMediaPreviewModal = $("song-media-preview-modal");
      if (songMediaPreviewModal && songMediaPreviewModal.dataset.bound !== "1") {
        songMediaPreviewModal.dataset.bound = "1";
        songMediaPreviewModal.addEventListener("click", (e) => {
          if (e.target === songMediaPreviewModal) closeSongMediaPreviewModal();
        });
      }
      $("song-metadata-audio-clear") && $("song-metadata-audio-clear").addEventListener("click", () => {
        if (!confirmUnlinkMedia("this audio clip")) return;
        if (massSectionAudioPlayingSlot === COMPOSER_SONG_MEDIA_SLOT) stopMassSectionAudio();
        clearComposerAudioSnippet();
        if (typeof notify === "function") notify("Cleared audio clip.", "ok");
      });
      $("song-metadata-video-clear") && $("song-metadata-video-clear").addEventListener("click", () => {
        if (!confirmUnlinkMedia("this instrumental video")) return;
        setComposerSongMediaField("video", null);
        if (typeof notify === "function") notify("Cleared video link.", "ok");
      });
      $("song-delete-confirm") && $("song-delete-confirm").addEventListener("click", () => {
        confirmSongDeleteFromModal().catch((err) => {
          setLyricsStatus(err.message || "Delete failed.", "error");
          if (typeof showToast === "function") showToast(err.message || "Delete failed.", "error");
        });
      });
      [
        ["song-save-mood-backdrop", closeSongSaveMoodModal],
        ["song-save-mood-close", closeSongSaveMoodModal],
        ["song-save-mood-cancel", closeSongSaveMoodModal],
        ["song-save-overwrite-backdrop", closeSongSaveOverwriteModal],
        ["song-save-overwrite-close", closeSongSaveOverwriteModal],
        ["song-save-overwrite-cancel", closeSongSaveOverwriteModal],
        ["song-save-success-backdrop", closeSongSaveSuccessModal],
        ["song-save-success-close", closeSongSaveSuccessModal],
        ["song-save-success-ok", closeSongSaveSuccessModal],
        ["song-catalog-google-backdrop", closeSongCatalogGoogleConfirmModal],
        ["song-catalog-google-close", closeSongCatalogGoogleConfirmModal],
        ["song-catalog-google-cancel", closeSongCatalogGoogleConfirmModal],
        ["composer-new-song-backdrop", closeComposerNewSongModal],
        ["composer-new-song-close", closeComposerNewSongModal],
        ["composer-new-song-cancel", closeComposerNewSongModal],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      $("song-save-mood-confirm") && $("song-save-mood-confirm").addEventListener("click", () => {
        const picked = readSongSaveMoodChecks();
        const errEl = $("song-save-mood-error");
        if (!picked.length) {
          if (errEl) errEl.hidden = false;
          return;
        }
        if (errEl) errEl.hidden = true;
        composerGospelMoods = picked.slice();
        closeSongSaveMoodModal();
        performSaveLyrics();
      });
      $("song-save-mood-google-link") && $("song-save-mood-google-link").addEventListener("click", () => {
        openSongMoodGoogleSearch();
      });
      $("song-metadata-mood-google-link") && $("song-metadata-mood-google-link").addEventListener("click", () => {
        openSongMoodGoogleSearch();
      });
      $("btn-sync-catalog-lyrics") && $("btn-sync-catalog-lyrics").addEventListener("click", () => {
        syncParishLyricsToCatalog();
      });
      $("song-save-overwrite-confirm") && $("song-save-overwrite-confirm").addEventListener("click", () => {
        confirmSongSaveOverwrite();
      });
      $("song-save-success-undo") && $("song-save-success-undo").addEventListener("click", () => {
        const btn = $("song-save-success-undo");
        const token = (btn && btn.dataset.undoToken) || "";
        void undoLastSongImport({ token, source: "modal" });
      });
      $("song-catalog-google-confirm") && $("song-catalog-google-confirm").addEventListener("click", () => {
        confirmSongCatalogGoogleSearch();
      });
      $("composer-new-song-analyze") && $("composer-new-song-analyze").addEventListener("click", () => {
        void confirmComposerNewSongAnalyze();
      });
      $("composer-new-song-mood-google-link") && $("composer-new-song-mood-google-link").addEventListener("click", () => {
        openComposerNewSongMoodGoogleSearch();
      });
      $("composer-new-song-title-search") && $("composer-new-song-title-search").addEventListener("input", (e) => {
        composerNewSongPickedCatalog = null;
        syncComposerNewSongTitleFieldsFromSearch(e.target.value || "");
        setComposerNewSongFieldAttention("title", false);
        setComposerNewSongFieldAttention("titleSearch", false);
        clearTimeout(composerNewSongSearchDebounce);
        composerNewSongSearchDebounce = window.setTimeout(() => {
          renderComposerNewSongSearchResults(e.target.value || "");
        }, SONG_CATALOG_SEARCH_DEBOUNCE_MS);
      });
      $("composer-new-song-title") && $("composer-new-song-title").addEventListener("input", (e) => {
        composerNewSongPickedCatalog = null;
        const val = e.target.value || "";
        if ($("composer-new-song-title-search")) $("composer-new-song-title-search").value = val;
        updateComposerNewSongMoodGoogleVisibility();
        setComposerNewSongFieldAttention("title", false);
        setComposerNewSongFieldAttention("titleSearch", false);
        clearTimeout(composerNewSongSearchDebounce);
        composerNewSongSearchDebounce = window.setTimeout(() => {
          renderComposerNewSongSearchResults(val);
        }, SONG_CATALOG_SEARCH_DEBOUNCE_MS);
      });
      $("composer-new-song-title-search") && $("composer-new-song-title-search").addEventListener("keydown", handleComposerNewSongSearchEnter);
      $("composer-new-song-title-search") && $("composer-new-song-title-search").addEventListener("search", (e) => {
        e.preventDefault();
        handleComposerNewSongSearchEnter({ key: "Enter", target: e.target, preventDefault: () => e.preventDefault() });
      });
      $("composer-new-song-title-search") && $("composer-new-song-title-search").addEventListener("blur", () => {
        trimComposerNewSongSearchOnBlur();
      });
      $("composer-new-song-title-search") && $("composer-new-song-title-search").addEventListener("focus", (e) => {
        renderComposerNewSongSearchResults(e.target.value || "");
      });
      ["composer-new-song-language", "composer-new-song-section"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("change", () => {
          if (id === "composer-new-song-language") setComposerNewSongFieldAttention("language", false);
          if (id === "composer-new-song-section") setComposerNewSongFieldAttention("section", false);
        });
      });
      $("composer-new-song-lyrics") && $("composer-new-song-lyrics").addEventListener("input", () => {
        setComposerNewSongFieldAttention("lyrics", false);
      });
      document.querySelectorAll("[data-composer-new-mood-opt]").forEach((el) => {
        el.addEventListener("change", () => {
          if (readComposerNewSongMoodChecks().length) setComposerNewSongFieldAttention("moods", false);
        });
      });
      $("composer-new-song-results") && $("composer-new-song-results").addEventListener("click", (e) => {
        const googleBtn = e.target.closest("[data-composer-new-google-search]");
        if (googleBtn) {
          e.preventDefault();
          openSongCatalogGoogleConfirmModal(googleBtn.getAttribute("data-composer-new-google-search") || "");
          return;
        }
        const btn = e.target.closest("[data-new-song-sec][data-new-song-id]");
        if (!btn) return;
        e.preventDefault();
        void applyComposerNewSongCatalogPick(btn.getAttribute("data-new-song-sec"), btn.getAttribute("data-new-song-id"));
      });
      document.addEventListener("click", (e) => {
        const modal = $("composer-new-song-modal");
        if (!modal || !modal.classList.contains("is-open")) return;
        if (e.target.closest(".composer-new-song-search")) return;
        closeComposerNewSongResults();
      });
      $("song-catalog-google-lang") && $("song-catalog-google-lang").addEventListener("change", () => {
        updateSongCatalogGoogleModalPreview();
      });
      const parishModal = $("parish-submit-modal");
      const logoPreviewModal = $("logo-preview-modal");
      const logoLockModal = $("logo-lock-modal");
      [
        ["parish-submit-backdrop", closeParishSubmitModal],
        ["parish-submit-close", closeParishSubmitModal],
        ["parish-submit-cancel", closeParishSubmitModal],
        ["logo-preview-backdrop", closeLogoPreviewModal],
        ["logo-preview-close", closeLogoPreviewModal],
        ["logo-lock-backdrop", closeLogoLockModal],
        ["logo-lock-close", closeLogoLockModal],
        ["logo-lock-cancel", closeLogoLockModal],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      $("parish-submit-confirm") && $("parish-submit-confirm").addEventListener("click", () => {
        confirmParishSubmitFromModal();
      });
      $("logo-lock-confirm") && $("logo-lock-confirm").addEventListener("click", () => {
        uploadLogo(pendingLogoUploadFile);
      });

      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (metaModal && metaModal.classList.contains("is-open")) closeSongMetadataModal();
        else if ($("song-save-overwrite-modal") && $("song-save-overwrite-modal").classList.contains("is-open")) closeSongSaveOverwriteModal();
        else if ($("song-save-mood-modal") && $("song-save-mood-modal").classList.contains("is-open")) closeSongSaveMoodModal();
        else if ($("song-save-success-modal") && $("song-save-success-modal").classList.contains("is-open")) closeSongSaveSuccessModal();
        else if ($("song-catalog-google-modal") && $("song-catalog-google-modal").classList.contains("is-open")) closeSongCatalogGoogleConfirmModal();
        else if ($("composer-new-song-modal") && $("composer-new-song-modal").classList.contains("is-open")) closeComposerNewSongModal();
        else if (logoLockModal && logoLockModal.classList.contains("is-open")) closeLogoLockModal();
        else if (logoPreviewModal && logoPreviewModal.classList.contains("is-open")) closeLogoPreviewModal();
        else if (parishModal && parishModal.classList.contains("is-open")) closeParishSubmitModal();
        else if (delModal && delModal.classList.contains("is-open")) closeSongDeleteModal();
        else if ($("mass-slideshow") && $("mass-slideshow").classList.contains("is-open")) closeMassSlideshow();
        else if ($("mass-gen-receipt-modal") && $("mass-gen-receipt-modal").classList.contains("is-open")) closeMassGenerateReceiptModal({ confirmed: false });
      });
    }

    function playCatalogSongPreview(section, id, playEl) {
      const sec = String(section || "").trim().toLowerCase();
      const sid = String(id || "").trim();
      const row = (songCatalogData && songCatalogData[sec] || []).find((r) => String(r.id) === sid)
        || (massPlanAllSongs || []).find((s) => String(s.id) === sid);
      const preview = catalogRowPreviewRef(row);
      if (!preview) {
        if (typeof notify === "function") notify("No chorus preview for this song yet.", "warn");
        return Promise.resolve();
      }
      return playSavedMusicRef(preview, catalogPreviewPlayingSlot(sec, sid), playEl);
    }

    function bindSongCatalogRoot(root) {
      if (!root || root.dataset.catBound === "1") return;
      root.dataset.catBound = "1";
      root.addEventListener("click", async (e) => {
        const googleBtn = e.target.closest("[data-catalog-google-search]");
        if (googleBtn) {
          e.preventDefault();
          openSongCatalogGoogleConfirmModal(googleBtn.getAttribute("data-catalog-google-search") || "");
          return;
        }
        const t = e.target.closest("button[data-sec-toggle]");
        if (t) {
          const k = t.dataset.secToggle;
          songCatalogExpanded[k] = !songCatalogExpanded[k];
          renderSongCatalog();
          return;
        }
        const actBtn = e.target.closest("button[data-act]");
        const row = e.target.closest(".song-row");
        if (!row) return;
        const section = row.dataset.ssec;
        const id = row.dataset.sid;
        if (actBtn) {
          const act = actBtn.dataset.act;
          try {
            if (act === "play-preview") {
              e.preventDefault();
              await playCatalogSongPreview(section, id, actBtn);
            } else if (act === "edit") {
              showRoute("/library/songs");
              await openSongMetadataModal(section, id);
            } else if (act === "del") {
              const titleEl = row.querySelector(".song-row-title");
              openSongDeleteConfirmModal(section, id, titleEl ? titleEl.textContent : "");
            }
          } catch (err) {
            setLyricsStatus(err.message || "Catalog action failed.", "error");
          }
          return;
        }
        if (!e.target.closest(".song-row-clickable")) return;
        composerSuppressPreload = true;
        composerPreloadSeq += 1;
        try {
          await loadSongIntoEditor(section, id);
          if (root.id === "song-catalog-root") collapseSongCatalogSection(section);
          if (normalizeRoute(currentRoute()) !== "/library/songs") showRoute("/library/songs");
        } catch (err) {
          setLyricsStatus(err.message || "Could not load song.", "error");
        }
      });
      root.addEventListener("mouseover", (e) => {
        const clickable = e.target.closest(".song-row-clickable");
        if (!clickable || !root.contains(clickable)) return;
        const row = clickable.closest(".song-row");
        if (!row) return;
        prefetchSongDetail(row.dataset.ssec, row.dataset.sid);
      });
      root.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const clickable = e.target.closest(".song-row-clickable");
        if (!clickable) return;
        e.preventDefault();
        const row = clickable.closest(".song-row");
        if (!row) return;
        const section = row.dataset.ssec;
        const id = row.dataset.sid;
        composerSuppressPreload = true;
        composerPreloadSeq += 1;
        try {
          await loadSongIntoEditor(section, id);
          if (root.id === "song-catalog-root") collapseSongCatalogSection(section);
          if (normalizeRoute(currentRoute()) !== "/library/songs") showRoute("/library/songs");
        } catch (err) {
          setLyricsStatus(err.message || "Could not load song.", "error");
        }
      });
    }
    bindSongCatalogRoot($("song-catalog-root"));
    bindSongCatalogRoot($("collections-catalog-root"));
    initSongCatalogModals();
    initPracticeShareUi();

    function syncSongCatalogSearchInputs(sourceEl) {
      const a = $("song-catalog-search");
      const b = $("collections-catalog-search");
      const peer = sourceEl === a ? b : a;
      if (peer && peer !== sourceEl) peer.value = songCatalogFilter;
    }

    var songCatalogSearchDebounce = null;

    function syncSongComposerCollapseBtn() {
      const panel = $("song-composer-panel");
      const btn = $("song-composer-collapse-btn");
      if (!panel || !btn) return;
      const deflated = panel.classList.contains("song-composer-panel--deflated");
      btn.setAttribute("aria-expanded", deflated ? "false" : "true");
      btn.title = deflated ? "Expand song library" : "Collapse song library";
      btn.setAttribute("aria-label", deflated ? "Expand song library" : "Collapse song library");
    }

    function setSongComposerDeflated(deflated) {
      const panel = $("song-composer-panel");
      if (!panel) return;
      panel.classList.toggle("song-composer-panel--deflated", !!deflated);
      syncSongComposerCollapseBtn();
    }

    function expandSongComposerPanel() {
      setSongComposerDeflated(false);
    }

    function initSongComposerCollapse() {
      const btn = $("song-composer-collapse-btn");
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const panel = $("song-composer-panel");
        if (!panel) return;
        setSongComposerDeflated(!panel.classList.contains("song-composer-panel--deflated"));
      });
      syncSongComposerCollapseBtn();
    }

    function applySongCatalogSearch(sourceEl) {
      if (sourceEl && sourceEl.id === "song-catalog-search") {
        expandSongComposerPanel();
      }
      const raw = (sourceEl && sourceEl.value) || "";
      songCatalogFilter = raw;
      syncSongCatalogSearchInputs(sourceEl);
      syncSongSearchClearButton();
      if (sourceEl && sourceEl.id === "song-catalog-search") {
        const hint = songCatalogSearchStatusHint(songCatalogFilter);
        setSongCatalogSearchHint(hint.text, hint.kind);
      }
      renderSongCatalog();
    }

    function trimSongCatalogSearchInputOnBlur(sourceEl) {
      if (!sourceEl) return;
      let cleaned = trimSongCatalogSearchText(sourceEl.value);
      cleaned = normalizeSongCatalogLyricsTag(cleaned);
      if (cleaned === sourceEl.value) return;
      sourceEl.value = cleaned;
      applySongCatalogSearch(sourceEl);
    }

    $("song-catalog-search-clear") && $("song-catalog-search-clear").addEventListener("click", () => {
      clearSongCatalogSearch();
    });

    $("btn-composer-add-song") && $("btn-composer-add-song").addEventListener("click", () => {
      openComposerNewSongModal();
    });

    $("song-composer-recent-list") && $("song-composer-recent-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recent-sec][data-recent-id]");
      if (!btn) return;
      composerSuppressPreload = true;
      composerPreloadSeq += 1;
      loadSongIntoEditor(btn.dataset.recentSec, btn.dataset.recentId, {
        clearSearch: false,
        title: btn.dataset.recentTitle || "",
        language: btn.dataset.recentLang || "",
      }).catch((err) => {
        setLyricsStatus(err.message || "Could not load song.", "error");
      });
    });

    ["song-catalog-search", "collections-catalog-search"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        if (id === "song-catalog-search") expandSongComposerPanel();
        clearTimeout(songCatalogSearchDebounce);
        songCatalogSearchDebounce = setTimeout(() => applySongCatalogSearch(el), SONG_CATALOG_SEARCH_DEBOUNCE_MS);
      });
      el.addEventListener("paste", () => {
        clearTimeout(songCatalogSearchDebounce);
        songCatalogSearchDebounce = setTimeout(() => applySongCatalogSearch(el), 0);
      });
      el.addEventListener("blur", () => {
        trimSongCatalogSearchInputOnBlur(el);
      });
      el.addEventListener("focus", () => {
        if (id === "song-catalog-search") expandSongComposerPanel();
      });
      if (id === "song-catalog-search") {
        el.addEventListener("keydown", handleSongCatalogSearchEnter);
      }
    });

    $("song-catalog-search") && $("song-catalog-search").addEventListener("search", (e) => {
      e.preventDefault();
      handleSongCatalogSearchEnter({ key: "Enter", target: e.target, preventDefault: () => e.preventDefault() });
    });

    document.addEventListener("verbum:song-catalog-changed", () => {
      refreshMassMusicSongPlan({ force: false }).catch(() => {});
    });

    $("btn-collections-open-library") && $("btn-collections-open-library").addEventListener("click", () => showRoute("/library/songs"));
    $("btn-collections-open-builder") && $("btn-collections-open-builder").addEventListener("click", () => showRoute("/mass/builder"));

    $("collections-recent-songs") && $("collections-recent-songs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-jump-song]");
      if (!b) return;
      const sec = b.dataset.jumpSong;
      const id = b.dataset.jumpId;
      composerSuppressPreload = true;
      composerPreloadSeq += 1;
      loadSongIntoEditor(sec, id, { clearSearch: false })
        .then(() => {
          if (normalizeRoute(currentRoute()) !== "/library/songs") showRoute("/library/songs");
        })
        .catch(() => {});
    });

    $("btn-load-flow").addEventListener("click", () => loadFlowData(false));
    initFlowInputGroups();
    initMassDatePickers();
    initHymnLyricsLayoutUi();
    initHymnBodyAlignUi();
    initHymnSectionLabelsToggle();
    initCollectionCurrencyUi();
    $("mass-date").addEventListener("change", () => {
      loadFlowData(true);
      renderMassSummarySidebar();
    });
    $("btn-generate-flow").addEventListener("click", async () => {
      $("btn-generate-flow").disabled = true;
      await runFullMassGenerate({ setStatus: setFlowStatus, autoDownloadPptx: true });
      $("btn-generate-flow").disabled = false;
    });

    $("btn-present-slideshow") && $("btn-present-slideshow").addEventListener("click", () => {
      reopenLastMassSlideshow();
    });

    (function bindMassGenReceiptModal() {
      const cancelReceipt = () => closeMassGenerateReceiptModal({ confirmed: false });
      $("mass-gen-receipt-close") && $("mass-gen-receipt-close").addEventListener("click", cancelReceipt);
      $("mass-gen-receipt-backdrop") && $("mass-gen-receipt-backdrop").addEventListener("click", cancelReceipt);
      $("mass-gen-receipt-edit") && $("mass-gen-receipt-edit").addEventListener("click", () => toggleMassGenerateReceiptEditMode());
      const confirmReceipt = (openSlideshow) => {
        if (massGenReceiptEditMode) applyMassGenerateReceiptEdits();
        closeMassGenerateReceiptModal({ confirmed: true, openSlideshow: !!openSlideshow });
      };
      $("mass-gen-receipt-slideshow") && $("mass-gen-receipt-slideshow").addEventListener("click", () => confirmReceipt(true));
      $("mass-gen-receipt-confirm") && $("mass-gen-receipt-confirm").addEventListener("click", () => confirmReceipt(false));
    })();

    $("church-logo-avatar") && $("church-logo-avatar").addEventListener("click", () => {
      if (currentLogoPreviewUrl) openLogoPreviewModal("logo");
    });

    function setProfileAvatarMenuOpen(open) {
      const menu = $("profile-avatar-menu");
      const addBtn = $("profile-avatar-add");
      if (!menu || !addBtn) return;
      if (open) {
        menu.hidden = false;
        addBtn.setAttribute("aria-expanded", "true");
      } else {
        menu.hidden = true;
        addBtn.setAttribute("aria-expanded", "false");
      }
    }

    function toggleProfileAvatarMenu() {
      const menu = $("profile-avatar-menu");
      setProfileAvatarMenuOpen(!!(menu && menu.hidden));
    }

    function hashStringToHue(str) {
      let h = 0;
      const s = String(str || "verbum");
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h % 360;
    }

    function buildGeneratedAvatarFile() {
      const auth = window.VerbumAuth;
      const user = auth && auth.getUser ? auth.getUser() : null;
      const profile = auth && auth.getProfile ? auth.getProfile() : null;
      const first = (auth && auth.getUserFirstName ? auth.getUserFirstName(user) : "") || "";
      const email = (profile && profile.email) || (user && user.email) || "";
      const seed = email || first || (user && user.id) || "verbum";
      const initial = (first || email || "?").charAt(0).toUpperCase();
      const hue = hashStringToHue(seed + ":" + Date.now().toString(36).slice(-3));
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, "hsl(" + hue + " 42% 42%)");
      grad.addColorStop(1, "hsl(" + ((hue + 28) % 360) + " 48% 28%)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(size * 0.78, size * 0.22, size * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 " + Math.round(size * 0.42) + "px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initial, size / 2, size / 2 + 4);
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Could not generate avatar."));
            return;
          }
          resolve(new File([blob], "generated-avatar.png", { type: "image/png" }));
        }, "image/png");
      });
    }

    async function uploadProfileAvatar(file) {
      const statusEl = $("avatar-status");
      const addBtn = $("profile-avatar-add");
      if (!file) {
        if (statusEl) {
          statusEl.textContent = "Please select a photo.";
          statusEl.className = "status error";
        }
        return;
      }
      if (statusEl) {
        statusEl.textContent = "Saving profile photo…";
        statusEl.className = "status";
      }
      if (addBtn) addBtn.disabled = true;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const headers = window.VerbumAuth && window.VerbumAuth.getAuthHeaders
          ? await window.VerbumAuth.getAuthHeaders()
          : {};
        const res = await fetch("/api/upload-avatar", { method: "POST", headers, body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string" ? data.detail : (data.message || "Upload failed")
          );
        }
        const url = data && data.avatar_url ? String(data.avatar_url) : "";
        updateProfileAvatar(url);
        if (statusEl) {
          statusEl.textContent = (data && data.message) || "Profile photo saved.";
          statusEl.className = "status ok";
        }
        if ($("profile-avatar-file")) $("profile-avatar-file").value = "";
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = (err && err.message) || "Could not upload profile photo.";
          statusEl.className = "status error";
        }
      } finally {
        if (addBtn) addBtn.disabled = false;
      }
    }

    $("profile-avatar-btn") && $("profile-avatar-btn").addEventListener("click", () => {
      if (currentAvatarPreviewUrl) openLogoPreviewModal("avatar");
      else toggleProfileAvatarMenu();
    });

    $("profile-avatar-add") && $("profile-avatar-add").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleProfileAvatarMenu();
    });

    $("profile-avatar-menu") && $("profile-avatar-menu").addEventListener("click", async (e) => {
      const item = e.target.closest("[data-avatar-action]");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const action = item.getAttribute("data-avatar-action");
      setProfileAvatarMenuOpen(false);
      if (action === "upload") {
        const input = $("profile-avatar-file");
        if (input) input.click();
        return;
      }
      if (action === "generate") {
        const statusEl = $("avatar-status");
        try {
          if (statusEl) {
            statusEl.textContent = "Generating avatar…";
            statusEl.className = "status";
          }
          const file = await buildGeneratedAvatarFile();
          await uploadProfileAvatar(file);
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = (err && err.message) || "Could not generate avatar.";
            statusEl.className = "status error";
          }
        }
      }
    });

    $("profile-avatar-file") && $("profile-avatar-file").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) uploadProfileAvatar(file);
    });

    document.addEventListener("click", (e) => {
      const wrap = $("profile-avatar-wrap");
      if (!wrap || wrap.contains(e.target)) return;
      setProfileAvatarMenuOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setProfileAvatarMenuOpen(false);
    });

    $("btn-upload-logo").addEventListener("click", () => {
      const file = $("church-logo").files[0];
      queueLogoUpload(file);
    });

    $("church-logo").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) queueLogoUpload(file);
    });

    $("settings-church-name").addEventListener("input", () => {
      syncChurchFieldsFromSettings();
      updateAccountMenuDisplay();
    });

    $("btn-submit-parish-name") && $("btn-submit-parish-name").addEventListener("click", openParishSubmitModal);

    $("btn-request-parish-rename") && $("btn-request-parish-rename").addEventListener("click", async () => {
      const nameEl = $("settings-church-name");
      const statusEl = $("settings-church-status");
      const name = nameEl && nameEl.value ? nameEl.value.trim() : "";
      if (!name || name.length < 2) {
        if (statusEl) {
          statusEl.textContent = "Enter the new parish name first.";
          statusEl.className = "status error";
        }
        return;
      }
      if (!confirm("Request renaming this parish to “" + name + "”? A superadmin must approve the change.")) return;
      if (statusEl) {
        statusEl.textContent = "Submitting rename request…";
        statusEl.className = "status";
      }
      try {
        const data = await postJSON("/api/community/request-rename", { community_name: name });
        if (statusEl) {
          statusEl.textContent = (data && data.message) || "Rename request submitted for approval.";
          statusEl.className = "status ok";
        }
        notify((data && data.message) || "Rename request submitted.", "ok");
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Request failed.";
          statusEl.className = "status error";
        }
      }
    });

    $("btn-save-community-api").addEventListener("click", async () => {
      if (!churchMembershipState.can_edit_church_profile) {
        $("settings-church-status").textContent = "Submit your parish name and wait for superadmin approval first.";
        $("settings-church-status").className = "status error";
        return;
      }
      $("settings-church-status").textContent = "Saving…";
      try {
        const saved = await postJSON("/api/community/profile", {
          celebrant_names: celebrantNamesCache,
        });
        applyCommunityPayload(saved);
        $("settings-church-status").textContent = "Saved church profile to database.";
        $("settings-church-status").className = "status ok";
        updateAccountMenuDisplay();
        renderCelebrantSelect(getMainCelebrantName());
      } catch (err) {
        $("settings-church-status").textContent = err.message || "Save failed";
        $("settings-church-status").className = "status error";
      }
    });

    $("sa-btn-save-gemini-api-key") && $("sa-btn-save-gemini-api-key").addEventListener("click", async () => {
      if (!guardSuperadminAction()) return;
      const inp = $("sa-gemini-api-key");
      const statusEl = $("sa-gemini-status");
      const key = inp && inp.value.trim();
      if (!key) {
        if (statusEl) {
          statusEl.textContent = "Enter a Gemini API key.";
          statusEl.className = "status error";
        }
        return;
      }
      if (statusEl) {
        statusEl.textContent = "Saving…";
        statusEl.className = "status";
      }
      try {
        const saved = await postJSON("/api/settings/gemini-api-key", { api_key: key });
        if (inp) inp.value = "";
        await refreshGeminiSettings();
        if (statusEl) {
          statusEl.textContent = saved.key_format_warning
            ? "Saved to .env.gemini. " + saved.key_format_warning
            : "Saved to .env.gemini.";
          statusEl.className = saved.key_format_warning ? "status error" : "status ok";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Save failed";
          statusEl.className = "status error";
        }
      }
    });

    $("btn-settings-celebrant-add").addEventListener("click", async () => {
      const inp = $("settings-celebrant-new");
      if (!inp) return;
      const statusEl = $("settings-church-status");
      if (statusEl) {
        statusEl.textContent = "Saving…";
        statusEl.className = "status";
      }
      const ok = await addSettingsCelebrantName(inp.value);
      if (!ok) {
        if (statusEl) {
          statusEl.textContent = "Enter a new name, or check that the server is running.";
          statusEl.className = "status error";
        }
        return;
      }
      inp.value = "";
      if (statusEl) {
        statusEl.textContent = ok.pending
          ? (ok.message || "Priest submitted for superadmin approval.")
          : "Celebrant saved to database.";
        statusEl.className = "status ok";
      }
    });

    $("settings-celebrant-new").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      $("btn-settings-celebrant-add").click();
    });

    $("settings-celebrant-list").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-celebrant]");
      if (!btn) return;
      if (!churchMembershipState.is_superadmin) return;
      const idx = parseInt(btn.dataset.removeCelebrant, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= celebrantNamesCache.length) return;
      const statusEl = $("settings-church-status");
      const removed = celebrantNamesCache[idx];
      celebrantNamesCache.splice(idx, 1);
      renderSettingsCelebrantList();
      const keep = getMainCelebrantName();
      renderCelebrantSelect(keep && keep !== removed ? keep : (celebrantNamesCache[0] || ""));
      if (statusEl) {
        statusEl.textContent = "Saving…";
        statusEl.className = "status";
      }
      try {
        await saveCelebrantNamesToDatabase();
        if (statusEl) {
          statusEl.textContent = "Celebrant removed from database.";
          statusEl.className = "status ok";
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Remove failed.";
          statusEl.className = "status error";
        }
      }
    });

    $("btn-poster-sync").addEventListener("click", () => syncPosterFromMassBuilder());
    $("poster-template").addEventListener("change", updatePosterLivePreview);
    ["poster-mass-date", "poster-celebrant", "poster-gospel-quote"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", updatePosterLivePreview);
    });
    $("btn-poster-generate").addEventListener("click", async () => {
      if (!guardFullAppAction()) return;
      const st = (m, k, meta) => {
        const el = $("poster-status");
        if (el) {
          el.textContent = m || "";
          el.className = "status " + (k || "");
        }
        notify(m, k, meta);
      };
      $("btn-poster-generate").disabled = true;
      st("Preparing export…", "");
      const date = $("poster-mass-date").value;
      const celebrant = $("poster-celebrant").value.trim();
      if (!date || !celebrant) {
        st("Enter poster date and celebrant.", "error");
        $("btn-poster-generate").disabled = false;
        return;
      }
      if ($("mass-date")) $("mass-date").value = date;
      renderCelebrantSelect(celebrant.split(" · ")[0].trim());
      const data = await runFullMassGenerate({
        setStatus: st,
        date,
        celebrant,
        poster_template: $("poster-template").value,
        include_social: isFeatureEnabled("social_poster_export") && $("poster-include-social").checked,
        include_ai: isFeatureEnabled("ai_image_generation") && !!(
          ($("poster-use-ai-poster") && $("poster-use-ai-poster").checked) ||
          ($("poster-use-openai-poster") && $("poster-use-openai-poster").checked) ||
          ($("poster-use-gemini-poster") && $("poster-use-gemini-poster").checked)
        ),
        ai_poster_backend: "openai",
        ai_poster_style: $("poster-openai-poster-style").value,
        downloadRowId: "poster-download-row",
        links: [
          ["poster-dl-zip", "zip_url"],
          ["poster-dl-png", "poster_url"],
          ["poster-dl-169", "poster_ppt_url"],
        ],
      });
      $("btn-poster-generate").disabled = false;
      if (data) {
        [["dl-zip", data.zip_url], ["dl-pptx", data.pptx_url]].forEach(([id, url]) => {
          const el = $(id);
          if (el && url) {
            el.href = url;
            el.style.display = "";
          }
        });
        $("download-row").classList.add("visible");
      }
    });

    async function refreshSavedPosters() {
      const list = $("saved-poster-list");
      if (!list) return;
      try {
        const res = await fetch("/api/saved-posters");
        const data = await res.json();
        if (!data.ok || !data.posters || !data.posters.length) {
          list.innerHTML = "<span class=\"muted\">No saved posters yet.</span>";
          return;
        }
        list.innerHTML = data.posters.map((p) => (
          "<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;\">" +
            "<a href=\"" + escapeHtml(p.url) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(p.basename) + "</a>" +
            "<button type=\"button\" class=\"ghost\" data-del-poster=\"" + escapeHtml(p.basename) + "\" style=\"font-size:0.78rem;\">Delete</button>" +
          "</div>"
        )).join("");
      } catch (_e) {
        list.textContent = "Could not load saved posters.";
      }
    }

    function mediaLibraryDownloadFilename(item, kind) {
      const basename = String((item && item.basename) || "").trim();
      const display = String((item && item.display_name) || "").trim();
      const ext = kind === "video" ? ".mp4" : ".mp3";
      if (display) {
        const lower = display.toLowerCase();
        if (lower.endsWith(".mp3") || lower.endsWith(".mp4")) return display;
        return display + ext;
      }
      return basename || ("media" + ext);
    }

    function mediaLibraryItemHtml(kind, item) {
      const title = String(item.display_name || item.basename || "");
      if (kind === "music") {
        return (
          "<li class=\"media-track\" data-media-kind=\"music\" data-media-name=\"" + escapeHtml(item.basename) + "\">" +
            "<button type=\"button\" class=\"media-track__hit\" data-play-media=\"music\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Play " + escapeHtml(title) + "\">" +
              "<span class=\"media-track__name\" title=\"" + escapeHtml(title) + "\">" + escapeHtml(title) + "</span>" +
            "</button>" +
            "<div class=\"media-track__actions\">" +
              "<button type=\"button\" class=\"media-track__download\" data-download-media=\"music\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Download " + escapeHtml(title) + "\" title=\"Download\">" + MEDIA_DOWNLOAD_SVG + "</button>" +
              "<button type=\"button\" class=\"media-track__remove\" data-del-media=\"music\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Delete " + escapeHtml(title) + "\" title=\"Delete\">×</button>" +
            "</div>" +
          "</li>"
        );
      }
      return (
        "<li class=\"media-thumb\" data-media-kind=\"video\" data-media-name=\"" + escapeHtml(item.basename) + "\">" +
          "<div class=\"media-thumb__frame\">" +
            "<button type=\"button\" class=\"media-thumb__hit\" data-play-media=\"video\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Play " + escapeHtml(title) + "\">" +
              "<span class=\"media-thumb__surface is-video\">" +
                "<video class=\"media-thumb__art\" muted playsinline preload=\"metadata\" data-media-url=\"" + escapeHtml(item.url || "") + "\" aria-hidden=\"true\"></video>" +
                "<span class=\"media-thumb__fallback\" aria-hidden=\"true\">" + MEDIA_THUMB_VIDEO_SVG + "</span>" +
              "</span>" +
              "<span class=\"media-thumb__play-overlay\">" + MEDIA_THUMB_PLAY_SVG + "</span>" +
            "</button>" +
            "<button type=\"button\" class=\"media-thumb__download\" data-download-media=\"video\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Download " + escapeHtml(title) + "\" title=\"Download\">" + MEDIA_DOWNLOAD_SVG + "</button>" +
            "<button type=\"button\" class=\"media-thumb__remove\" data-del-media=\"video\" data-media-name=\"" + escapeHtml(item.basename) + "\" aria-label=\"Delete " + escapeHtml(title) + "\" title=\"Delete\">×</button>" +
          "</div>" +
          "<p class=\"media-thumb__title\" title=\"" + escapeHtml(title) + "\">" + escapeHtml(title) + "</p>" +
        "</li>"
      );
    }

    var MEDIA_UPLOAD_MAX_FILES = 5;
    var mediaThumbObjectUrls = new Map();

    function mediaThumbCacheKey(kind, basename) {
      return kind + "|" + basename;
    }

    function revokeMediaThumbObjectUrl(key) {
      const url = mediaThumbObjectUrls.get(key);
      if (!url) return;
      URL.revokeObjectURL(url);
      mediaThumbObjectUrls.delete(key);
    }

    function pruneMediaThumbObjectUrls(activeKeys) {
      for (const key of Array.from(mediaThumbObjectUrls.keys())) {
        if (!activeKeys.has(key)) revokeMediaThumbObjectUrl(key);
      }
    }

    async function resolveMediaThumbUrl(url) {
      if (!url) return "";
      if (!isPrivateFileUrl(url)) return url;
      const res = await authorizedFetch(url);
      if (!res.ok) throw new Error("Could not load media thumbnail.");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }

    function markVideoThumbArtwork(video) {
      const surface = video && video.closest(".media-thumb__surface");
      if (surface) surface.classList.add("has-artwork");
    }

    async function hydrateVideoMediaThumb(video) {
      if (!video || video.dataset.thumbReady === "1" || video.dataset.thumbLoading === "1") return;
      const url = String(video.dataset.mediaUrl || "").trim();
      if (!url) return;
      const thumb = video.closest(".media-thumb");
      const kind = thumb ? thumb.getAttribute("data-media-kind") : "video";
      const basename = thumb ? thumb.getAttribute("data-media-name") : "";
      const cacheKey = mediaThumbCacheKey(kind || "video", basename || url);
      video.dataset.thumbLoading = "1";
      try {
        let src = mediaThumbObjectUrls.get(cacheKey);
        if (!src) {
          src = await resolveMediaThumbUrl(url);
          if (src && isPrivateFileUrl(url)) mediaThumbObjectUrls.set(cacheKey, src);
        }
        video.src = src;
        await new Promise((resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            video.removeEventListener("loadeddata", onLoaded);
            video.removeEventListener("error", onError);
          };
          const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            markVideoThumbArtwork(video);
            video.dataset.thumbReady = "1";
            delete video.dataset.thumbLoading;
            resolve();
          };
          const fail = () => {
            if (settled) return;
            settled = true;
            cleanup();
            delete video.dataset.thumbLoading;
            reject(new Error("thumb load failed"));
          };
          const onError = () => { fail(); };
          const onLoaded = () => {
            const duration = Number(video.duration);
            const seekTo = Number.isFinite(duration) && duration > 0
              ? Math.min(0.75, Math.max(0.05, duration * 0.08))
              : 0;
            if (seekTo > 0) {
              const seekTimeout = setTimeout(finish, 1500);
              video.addEventListener("seeked", () => {
                clearTimeout(seekTimeout);
                finish();
              }, { once: true });
              try {
                video.currentTime = seekTo;
                return;
              } catch (_e) { /* fall through */ }
            }
            finish();
          };
          video.addEventListener("loadeddata", onLoaded, { once: true });
          video.addEventListener("error", onError, { once: true });
          try { video.load(); } catch (_e) { onError(); }
        });
      } catch (_e) {
        delete video.dataset.thumbLoading;
      }
    }

    function hydrateVideoMediaThumbs(root) {
      const scope = root || document;
      scope.querySelectorAll(".media-thumb__art[data-media-url]").forEach((video) => {
        hydrateVideoMediaThumb(video);
      });
    }

    async function postMediaForm(url, fd) {
      const headers = await catalogAuthHeaders();
      const res = await fetch(url, { method: "POST", headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.detail || data.error || res.statusText;
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      return data;
    }

    async function fetchSavedMedia() {
      const headers = await catalogAuthHeaders();
      return fetch("/api/saved-media", { headers });
    }

    function assignInputFiles(input, files) {
      if (!input) return;
      const dt = new DataTransfer();
      Array.from(files || []).slice(0, MEDIA_UPLOAD_MAX_FILES).forEach((file) => {
        if (file) dt.items.add(file);
      });
      input.files = dt.files;
    }

    function detectSavedMediaKind(file) {
      if (!file) return null;
      const name = String(file.name || "").trim().toLowerCase();
      const type = String(file.type || "").trim().toLowerCase();
      if (name.endsWith(".mp3") || type === "audio/mpeg" || type === "audio/mp3") return "music";
      if (name.endsWith(".mp4") || type === "video/mp4") return "video";
      return null;
    }

    async function ensureSavedMediaLibrary(force) {
      if (!force && ((savedMediaLibrary.music && savedMediaLibrary.music.length) || (savedMediaLibrary.video && savedMediaLibrary.video.length))) {
        return savedMediaLibrary;
      }
      const res = await fetchSavedMedia();
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.detail || "Could not load media.");
      const musicRows = Array.isArray(data.music) ? data.music : [];
      const videoRows = Array.isArray(data.video) ? data.video : [];
      savedMediaLibrary = { music: musicRows, video: videoRows };
      rebuildLibraryPlaylist();
      return savedMediaLibrary;
    }

    async function refreshSavedMedia() {
      const musicList = $("media-library-music-list");
      const videoList = $("media-library-video-list");
      const musicCount = $("media-library-music-count");
      const videoCount = $("media-library-video-count");
      try {
        await ensureSavedMediaLibrary(true);
        const musicRows = savedMediaLibrary.music || [];
        const videoRows = savedMediaLibrary.video || [];
        if (libraryActiveItem) {
          const stillThere = libraryPlaylist.some(
            (row) => row.basename === libraryActiveItem.basename && row.kind === libraryActiveItem.kind
          );
          if (!stillThere) {
            stopLibraryPlayback();
            syncLiveRadioPanelUi();
          } else if (libraryTrackIndex >= 0) libraryActiveItem = libraryPlaylist[libraryTrackIndex] || libraryActiveItem;
        }
        if (musicCount) musicCount.textContent = String(musicRows.length);
        if (videoCount) videoCount.textContent = String(videoRows.length);
        if (musicList) {
          musicList.innerHTML = musicRows.length
            ? musicRows.map((item) => mediaLibraryItemHtml("music", item)).join("")
            : "<li class=\"muted media-library-empty\">No songs uploaded yet.</li>";
        }
        if (videoList) {
          videoList.innerHTML = videoRows.length
            ? videoRows.map((item) => mediaLibraryItemHtml("video", item)).join("")
            : "<li class=\"muted media-library-empty\">No videos uploaded yet.</li>";
          if (videoRows.length) hydrateVideoMediaThumbs(videoList);
        }
        pruneMediaThumbObjectUrls(new Set(
          videoRows.map((item) => mediaThumbCacheKey("video", item.basename))
        ));
        if (libraryActiveItem) markActiveLibraryThumb(libraryActiveItem);
      } catch (_e) {
        if (musicList) musicList.innerHTML = "<li class=\"muted media-library-empty\">Could not load music.</li>";
        if (videoList) videoList.innerHTML = "<li class=\"muted media-library-empty\">Could not load video.</li>";
        if (musicCount) musicCount.textContent = "—";
        if (videoCount) videoCount.textContent = "—";
      }
    }

    function wireMediaDropzone(dropId, inputId) {
      const drop = $(dropId);
      const input = $(inputId);
      if (!drop || !input) return;
      ["dragenter", "dragover"].forEach((evt) => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          drop.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((evt) => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          drop.classList.remove("is-dragover");
        });
      });
      drop.addEventListener("drop", (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;
        assignInputFiles(input, files);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    async function uploadSavedMedia(kind, file, statusEl, inputEl, opts) {
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const quiet = !!(opts && opts.quiet);
      if (statusEl && !quiet) {
        statusEl.textContent = "Uploading " + (kind === "music" ? "song" : "video") + "…";
        statusEl.className = "status media-upload-status";
      }
      await postMediaForm("/api/upload/saved-media/" + kind, fd);
      if (statusEl && !quiet) {
        statusEl.textContent = (kind === "music" ? "MP3" : "MP4") + " saved to your library.";
        statusEl.className = "status ok media-upload-status";
      }
      if (inputEl && !quiet) inputEl.value = "";
    }

    async function uploadSavedMediaBatch(fileList, statusEl, inputEl) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;
      const batch = files.slice(0, MEDIA_UPLOAD_MAX_FILES);
      if (files.length > MEDIA_UPLOAD_MAX_FILES && statusEl) {
        statusEl.textContent = "Uploading first " + MEDIA_UPLOAD_MAX_FILES + " of " + files.length + " files…";
        statusEl.className = "status media-upload-status";
      }
      let ok = 0;
      const errors = [];
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        const kind = detectSavedMediaKind(file);
        if (!kind) {
          errors.push((file.name || "File") + ": not MP3 or MP4");
          continue;
        }
        if (statusEl) {
          statusEl.textContent = "Uploading " + (i + 1) + " / " + batch.length + "…";
          statusEl.className = "status media-upload-status";
        }
        try {
          await uploadSavedMedia(kind, file, statusEl, null, { quiet: true });
          ok += 1;
        } catch (err) {
          errors.push((file.name || "File") + ": " + (err.message || "upload failed"));
        }
      }
      if (inputEl) inputEl.value = "";
      await refreshSavedMedia();
      if (!statusEl) return;
      if (ok && !errors.length) {
        statusEl.textContent = ok === 1 ? "1 file saved to your library." : ok + " files saved to your library.";
        statusEl.className = "status ok media-upload-status";
      } else if (ok && errors.length) {
        statusEl.textContent = ok + " saved · " + errors.length + " failed. " + errors[0];
        statusEl.className = "status error media-upload-status";
      } else {
        statusEl.textContent = errors[0] || "Upload failed.";
        statusEl.className = "status error media-upload-status";
      }
    }

    async function uploadSavedMediaAuto(file, statusEl, inputEl) {
      if (!file) return;
      const kind = detectSavedMediaKind(file);
      if (!kind) {
        if (statusEl) {
          statusEl.textContent = "Only MP3 (music) or MP4 (video) files are allowed.";
          statusEl.className = "status error media-upload-status";
        }
        if (inputEl) inputEl.value = "";
        return;
      }
      try {
        await uploadSavedMedia(kind, file, statusEl, inputEl);
        await refreshSavedMedia();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Upload failed";
          statusEl.className = "status error media-upload-status";
        }
      }
    }

    var savedPosterListEl = $("saved-poster-list");
    if (savedPosterListEl) {
      savedPosterListEl.addEventListener("click", async (e) => {
        const b = e.target.closest("button[data-del-poster]");
        if (!b) return;
        if (!guardSuperadminAction()) return;
        if (!window.confirm("Delete this saved poster from the server?")) return;
        const name = b.dataset.delPoster;
        await fetch("/api/saved-posters/" + encodeURIComponent(name), { method: "DELETE" });
        refreshSavedPosters();
      });
    }

    var savedPosterUpload = $("saved-poster-upload");
    if (savedPosterUpload) {
      savedPosterUpload.addEventListener("change", async (e) => {
        if (!guardSuperadminAction()) {
          e.target.value = "";
          return;
        }
        const file = e.target.files[0];
        if (!file) return;
        const st = $("saved-poster-status");
        const fd = new FormData();
        fd.append("file", file);
        if (st) { st.textContent = "Uploading…"; st.className = "status"; }
        try {
          const res = await fetch("/api/upload/saved-poster", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || "Upload failed");
          if (st) { st.textContent = "Saved to your poster library."; st.className = "status ok"; }
          e.target.value = "";
          refreshSavedPosters();
        } catch (err) {
          if (st) { st.textContent = err.message || "Upload failed"; st.className = "status error"; }
        }
      });
    }

    wireMediaDropzone("media-upload-drop", "media-upload-file");

    var mediaFileUpload = $("media-upload-file");
    if (mediaFileUpload) {
      mediaFileUpload.addEventListener("change", async (e) => {
        if (!guardFullAppAction()) {
          e.target.value = "";
          return;
        }
        const files = e.target.files;
        if (!files || !files.length) return;
        const statusEl = $("media-upload-status");
        if (files.length === 1) {
          await uploadSavedMediaAuto(files[0], statusEl, e.target);
          return;
        }
        await uploadSavedMediaBatch(files, statusEl, e.target);
      });
    }

    var mediaDeletePending = null;

    function closeMediaDeleteModal() {
      setUiOverlayOpen($("media-delete-modal"), false);
      mediaDeletePending = null;
    }

    function openMediaDeleteConfirmModal(kind, basename, title) {
      mediaDeletePending = { kind: kind, basename: basename, title: title || "" };
      const desc = $("media-delete-desc");
      if (desc) {
        desc.textContent = "Remove \"" + (title || "this file") + "\" from your library? This cannot be undone.";
      }
      setUiOverlayOpen($("media-delete-modal"), true);
    }

    async function confirmMediaDeleteFromModal() {
      if (!guardFullAppAction()) return;
      if (!mediaDeletePending) return;
      const pending = mediaDeletePending;
      const { kind, basename, title } = pending;
      const deletingActive = libraryActiveItem
        && libraryActiveItem.basename === basename
        && libraryActiveItem.kind === kind;
      try {
        const headers = await catalogAuthHeaders();
        const res = await fetch(
          "/api/saved-media/" + encodeURIComponent(kind) + "/" + encodeURIComponent(basename),
          { method: "DELETE", headers }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.error || "Delete failed");
        closeMediaDeleteModal();
        if (deletingActive) {
          stopLibraryPlayback();
          syncLiveRadioPanelUi();
        }
        await refreshSavedMedia();
        notify("\"" + (title || "File") + "\" deleted.", "ok");
      } catch (err) {
        notify(err.message || "Could not delete file.", "error");
      }
    }

    function initMediaDeleteModal() {
      const modal = $("media-delete-modal");
      if (!modal) return;
      [
        ["media-delete-backdrop", closeMediaDeleteModal],
        ["media-delete-close", closeMediaDeleteModal],
        ["media-delete-cancel", closeMediaDeleteModal],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      const confirmBtn = $("media-delete-confirm");
      if (confirmBtn) confirmBtn.addEventListener("click", () => { confirmMediaDeleteFromModal(); });
    }

    async function downloadSavedMediaItem(kind, basename) {
      if (!guardFullAppAction()) return;
      const rows = kind === "music" ? savedMediaLibrary.music : savedMediaLibrary.video;
      const item = rows.find((row) => row.basename === basename);
      if (!item || !item.url) {
        notify("Could not find that file.", "error");
        return;
      }
      try {
        await triggerBrowserDownload(item.url, mediaLibraryDownloadFilename(item, kind));
      } catch (_e) {
        notify("Could not download file. Sign in and try again.", "error");
      }
    }

    function handleSavedMediaListClick(e) {
      const downloadBtn = e.target.closest("button[data-download-media]");
      if (downloadBtn) {
        e.preventDefault();
        e.stopPropagation();
        const kind = downloadBtn.dataset.downloadMedia;
        const name = downloadBtn.dataset.mediaName;
        if (!kind || !name) return;
        downloadSavedMediaItem(kind, name);
        return;
      }
      const delBtn = e.target.closest("button[data-del-media]");
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (!guardFullAppAction()) return;
        const kind = delBtn.dataset.delMedia;
        const name = delBtn.dataset.mediaName;
        if (!kind || !name) return;
        const rows = kind === "music" ? savedMediaLibrary.music : savedMediaLibrary.video;
        const item = rows.find((row) => row.basename === name);
        openMediaDeleteConfirmModal(kind, name, item ? (item.display_name || item.basename) : name);
        return;
      }
      const playBtn = e.target.closest("[data-play-media]");
      if (playBtn) {
        if (!guardFullAppAction()) return;
        const kind = playBtn.dataset.playMedia;
        const name = playBtn.dataset.mediaName;
        const rows = kind === "music" ? savedMediaLibrary.music : savedMediaLibrary.video;
        const item = rows.find((row) => row.basename === name);
        if (item) startLibraryPlayback(Object.assign({ kind: kind }, item));
      }
    }

    var mediaLibrary = $("media-library");
    if (mediaLibrary) mediaLibrary.addEventListener("click", handleSavedMediaListClick);
    initMediaDeleteModal();

    var btnAnalyzeTpl = $("btn-analyze-template-pptx");
    if (btnAnalyzeTpl) {
      btnAnalyzeTpl.addEventListener("click", async () => {
        if (!guardSuperadminAction()) return;
        const inp = $("template-pptx-upload");
        const st = $("template-analyze-status");
        if (!inp || !inp.files[0]) {
          if (st) { st.textContent = "Choose a .pptx file first."; st.className = "status error"; }
          return;
        }
        const fd = new FormData();
        fd.append("file", inp.files[0]);
        if (st) { st.textContent = "Analyzing deck…"; st.className = "status"; }
        try {
          const res = await fetch("/api/design/analyze-template", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || "Analysis failed");
          const ct = data.custom_theme || {};
          activeTheme = {
            id: "imported-" + Date.now(),
            name: "Imported · " + (ct.template_source || "pptx"),
            note: data.notes || "",
            bg: ct.bg || "#111827",
            primary: ct.text || "#f9fafb",
            accent: ct.accent || ct.primary || "#fbbf24",
            text: ct.text || "#f9fafb",
            font: ct.font || "Calibri",
          };
          localStorage.setItem("activePptTheme", JSON.stringify(activeTheme));
          renderThemeGrid();
          if (st) {
            st.textContent = (data.notes || "Theme extracted.") + " Applied as active slide theme for Mass Builder.";
            st.className = "status ok";
          }
        } catch (err) {
          if (st) { st.textContent = err.message || "Could not analyze file."; st.className = "status error"; }
        }
      });
    }

    $("btn-app-open-mass").addEventListener("click", () => showRoute("/mass/builder"));
    $("btn-app-open-theme").addEventListener("click", () => showRoute("/design/theme-lab"));

    $("cal-prev").addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() - 1);
      calendarMonthKey = "";
      loadCalendarMonth();
    });
    $("cal-next").addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() + 1);
      calendarMonthKey = "";
      loadCalendarMonth();
    });
    var calLanguageSel = $("cal-language");
    if (calLanguageSel) {
      try {
        const savedCalLang = localStorage.getItem("verbumCalLanguage");
        if (savedCalLang === "tagalog" || savedCalLang === "english") {
          calLanguageSel.value = savedCalLang;
        }
      } catch (_e) { /* ignore */ }
      calLanguageSel.addEventListener("change", () => {
        try {
          localStorage.setItem("verbumCalLanguage", currentCalendarLanguage());
        } catch (_e) { /* ignore */ }
        stopReadingsPoll(calSelected);
        calendarMonthKey = "";
        loadCalendarMonth().then(() => setCalDetail(calSelected));
      });
    }
    var calReadingStack = $("cal-reading-stack");
    if (calReadingStack) {
      calReadingStack.addEventListener("click", (e) => {
        const toggle = e.target.closest(".cal-reading-toggle");
        if (!toggle || toggle.hidden) return;
        const targetId = toggle.getAttribute("data-target");
        const excerpt = targetId && $(targetId);
        if (!excerpt) return;
        const expanded = excerpt.classList.toggle("is-expanded");
        toggle.textContent = expanded ? "Show less" : "Read more";
      });
    }
    $("cal-grid").addEventListener("click", (e) => {
      const cell = e.target.closest(".cal-cell[data-cal]");
      if (!cell) return;
      setCalDetail(cell.dataset.cal);
    });
    $("cal-grid").addEventListener("dblclick", (e) => {
      const cell = e.target.closest(".cal-cell[data-cal]");
      if (!cell || !canUseCalendarReadingsAdmin()) return;
      e.preventDefault();
      const iso = cell.dataset.cal;
      setCalDetail(iso);
      openCalReadingsAdminModal(iso);
    });
    var btnCalEditReadings = $("btn-cal-edit-readings");
    if (btnCalEditReadings) {
      btnCalEditReadings.addEventListener("click", () => {
        if (!canUseCalendarReadingsAdmin() || !calSelected) return;
        openCalReadingsAdminModal(calSelected);
      });
    }
    function bindCalFetchToggleButton(btn, startFn) {
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (calAdminFetchJob.active && getCalAdminActiveFetchButton() === btn) {
          stopCalAdminFetchJob();
          return;
        }
        if (calAdminFetchJob.active) {
          notify("Another fetch is already running. Stop it first.", "info");
          return;
        }
        startFn();
      });
    }

    bindCalFetchToggleButton($("cal-admin-fetch-missing-btn"), () => fetchCalendarMonthReadings("missing"));
    bindCalFetchToggleButton($("cal-admin-fetch-month-btn"), () => {
      if (!confirm("Force-fetch all " + calendarCursor.toLocaleString(undefined, { month: "long" }) + " dates from USCCB? Each date tries up to 3 times. Click the button again to stop.")) return;
      fetchCalendarMonthReadings("all");
    });
    bindCalFetchToggleButton($("cal-readings-admin-fetch"), () => {
      if (calReadingsAdminDate) fetchCalReadingsAdminDate(calReadingsAdminDate);
    });
    var calReadingsAdminSaveBtn = $("cal-readings-admin-save");
    if (calReadingsAdminSaveBtn) {
      calReadingsAdminSaveBtn.addEventListener("click", () => saveCalReadingsAdminAll());
    }
    var calReadingsAdminModal = $("cal-readings-admin-modal");
    if (calReadingsAdminModal) {
      ["cal-readings-admin-close", "cal-readings-admin-backdrop"].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener("click", closeCalReadingsAdminModal);
      });
    }
    $("btn-cal-use-date").addEventListener("click", () => {
      if ($("mass-date")) {
        $("mass-date").value = calSelected;
        syncMassDatePickerByInputId("mass-date");
      }
      // Keep Mass language independent of calendar language toggle.
      showRoute("/mass/builder");
      loadFlowData(true);
    });
    $("btn-cal-generate").addEventListener("click", () => {
      if ($("mass-date")) {
        $("mass-date").value = calSelected;
        syncMassDatePickerByInputId("mass-date");
      }
      // Keep Mass language independent of calendar language toggle.
      showRoute("/mass/builder");
      loadFlowData(false).then(() => $("btn-generate-flow").click());
    });

    function bootDashboardApp() {
    initColorTheme();

    $("co-celebrant") && $("co-celebrant").addEventListener("input", () => {
      if ($("poster-celebrant")) $("poster-celebrant").value = getMassCelebrantLine();
    });

    ensureMassBuilderDefaultDate({ force: true });
    if ($("poster-mass-date")) $("poster-mass-date").value = $("mass-date").value;
    ensureCollectionDefaultDate({ force: true });
    syncMassDatePickerByInputId("mass-date");
    syncMassDatePickerByInputId("flow-collection-date");
    (function initAppSidebarFlyout() {
      const sidebar = document.getElementById("app-sidebar");
      if (!sidebar) return;

      const COLLAPSE_DELAY_MS = 350;
      let collapseTimer = null;
      let pointerInside = false;

      function expand() {
        if (collapseTimer) {
          clearTimeout(collapseTimer);
          collapseTimer = null;
        }
        sidebar.classList.add("is-expanded");
      }

      function collapse() {
        sidebar.classList.remove("is-expanded");
        const active = document.activeElement;
        if (active && sidebar.contains(active)) active.blur();
      }

      function scheduleCollapse() {
        if (pointerInside) return;
        if (collapseTimer) clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => {
          if (pointerInside) return;
          collapse();
          collapseTimer = null;
        }, COLLAPSE_DELAY_MS);
      }

      sidebar.addEventListener("mouseenter", () => {
        pointerInside = true;
        expand();
      });
      sidebar.addEventListener("mouseleave", () => {
        pointerInside = false;
        scheduleCollapse();
      });
      sidebar.addEventListener("focusin", expand);
      sidebar.addEventListener("focusout", (e) => {
        if (pointerInside) return;
        if (!sidebar.contains(e.relatedTarget)) scheduleCollapse();
      });
    })();
    initSuperadminEasterEgg();
    renderCalendarDow();
    bindCelebrantSelect();
    renderComposerRecent();
    renderCollectionsRecent();
    bindSongHistoryScopeControls();
    bindSocialExportControls();
    bindOpenAiPosterControls();
    bindAiPosterQuotaStyleWatch();
    bindMassDefaultPinDelegation();
    initMassFieldDefaultPins();
    applyMassPinnedDefaults();
    syncMassDefaultPins($("flow-page"));
    if (typeof consumeEmailDeepLinkIntent === "function") consumeEmailDeepLinkIntent();
    showRoute(currentRoute(), true);
    renderLyrics({ writeBack: false });
    setLyricsAnalyzeOverlay("idle");
    updateLyricsWordStats();
    autoResizeLyricsMainInput();
    renderThemeGrid();
    restoreMassSongPlanLang();
    renderHistoryList();
    bindHomeNewsSettings();
    bindNavTabSettings();
    applyNavTabVisibility();
    initMobileChromeLayout();
    initMobileNavDragDrop();
    initNotificationsAccordions();
    redirectIfHiddenNavRoute();
    initLiveRadio();
    initHomeNewsExpandModal();
    initLiturgicalIndicatorPanel();
    initDashboardDropdownDismiss();
    initAccountMenu();
    initMobileWelcomeModal();
    initSongsWhatsNewModal();
    initCreateMenu();
    initVerbumSelects();
    initDividerPosterPickers();
    migrateLegacyAiPosterToggles();
    syncOpenAiPosterUi();
    initGlobalSearch();
    initHeaderTicker();
    updateAccountMenuDisplay();
    initHomeEventModal();
    initHomeQuickActions();
    initReadingExpandModal();
    initWydCard();
    initAppMoreSheet();
    initMobileMenu();
    initSongPlanSummaryCollapse();
    initHomeTourBanner();
    initSongComposerCollapse();
    initLyricsComposerMobileUi();

    refreshHomeMassCard();
    refreshHomeMission();
    refreshHomeSongsCard();
    updateHomeMassWelcome();
    var bootDeferredData = () => {
      loadCalendarMonth().then(() => setCalDetail(upcomingSundayISO()));
      refreshSavedPosters();
      refreshAiImageQuotaHint();
      updatePosterLivePreview();
      refreshWydNews();
      refreshHomeReflection();
      refreshPlatformAnnouncement();
      refreshFeatureFlags();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(bootDeferredData, { timeout: 400 });
    } else {
      setTimeout(bootDeferredData, 0);
    }
    }

    var dashboardBooted = false;
    function scheduleDashboardBoot() {
      const run = () => {
        if (dashboardBooted) return;
        if (window.__VERBUM_AUTH_GATE__) {
          const auth = window.VerbumAuth;
          if (!auth || !auth.isReady || !auth.isReady()) return;
        }
        dashboardBooted = true;
        bootDashboardApp();
        applyAppVersionLabelLocalTime();
        if (window.VerbumAuth && window.VerbumAuth.refreshUserProfile) {
          window.VerbumAuth.refreshUserProfile().then(() => {
            updateAccountMenuDisplay();
            updateHomeMassWelcome();
            refreshCommunity();
            acceptParishInviteFromUrl();
            maybeShowMobileWelcomeModal();
            maybeShowSongsWhatsNewModal();
            void pullSongHistoryFromAccount().then(() => {
              if (typeof maybePreloadComposerFromRecentHistory === "function") maybePreloadComposerFromRecentHistory();
            });
          });
        } else {
          refreshCommunity();
          acceptParishInviteFromUrl();
          maybeShowMobileWelcomeModal();
          maybeShowSongsWhatsNewModal();
          void pullSongHistoryFromAccount().then(() => {
            if (typeof maybePreloadComposerFromRecentHistory === "function") maybePreloadComposerFromRecentHistory();
          });
        }
      };
      if (!window.__VERBUM_AUTH_GATE__) {
        run();
        return;
      }
      window.addEventListener("verbum:auth-ready", run, { once: true });
      window.addEventListener("verbum:auth-ready", () => {
        updateHomeMassWelcome();
        maybeShowMobileWelcomeModal();
        maybeShowSongsWhatsNewModal();
      });
      window.addEventListener("verbum:profile-ready", () => {
        updateHomeMassWelcome();
        maybeShowMobileWelcomeModal();
        maybeShowSongsWhatsNewModal();
        if (typeof syncSettingsAccountPanel === "function") syncSettingsAccountPanel();
        if (memberApiAvailable()) {
          loadSongCatalog();
          refreshAiImageQuotaHint();
          void pullSongHistoryFromAccount().then(() => {
            if (typeof maybePreloadComposerFromRecentHistory === "function") maybePreloadComposerFromRecentHistory();
          });
        }
      });
      if (window.VerbumAuth && window.VerbumAuth.isReady && window.VerbumAuth.isReady()) {
        run();
      }
    }
