/* Verbum SPA part 2/9: app-02-media-radio.js
 * Catalog media, mass lyrics modal, EWTN radio, themes
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 3499-6971
 */
    function updateLocalCatalogSongPreview(section, songId, previewRef) {
      const id = String(songId || "").trim();
      if (!id) return;
      const prefer = String(section || "").trim().toLowerCase();
      const secs = ["entrance", "offertory", "communion", "recessional", "meditation"];
      const targets = prefer && secs.indexOf(prefer) >= 0 ? [prefer] : secs;
      const ref = previewRef ? normalizeAudioPreviewRef(previewRef) : null;
      if (typeof songCatalogData !== "undefined" && songCatalogData) {
        targets.forEach((sec) => {
          if (!Array.isArray(songCatalogData[sec])) return;
          const idx = songCatalogData[sec].findIndex((r) => String(r.id) === id);
          if (idx < 0) return;
          const next = Object.assign({}, songCatalogData[sec][idx]);
          next.audio_preview = ref;
          songCatalogData[sec][idx] = next;
        });
      }
      if (typeof rebuildMassPlanSongPool === "function") rebuildMassPlanSongPool();
      if (typeof songDetailCache !== "undefined" && typeof songDetailCacheKey === "function") {
        targets.forEach((sec) => {
          const key = songDetailCacheKey(sec, id);
          if (!songDetailCache.has(key)) return;
          const data = songDetailCache.get(key);
          if (!data || !data.song) return;
          data.song.audio_preview = ref;
          songDetailCache.set(key, data);
        });
      }
      if (
        typeof composerLoadedSong !== "undefined" &&
        composerLoadedSong &&
        String(composerLoadedSong.id || "") === id &&
        (!prefer || String(composerLoadedSong.section || "").toLowerCase() === prefer) &&
        typeof setComposerAudioSnippet === "function"
      ) {
        setComposerAudioSnippet(ref);
      } else if (
        typeof composerLoadedSong !== "undefined" &&
        composerLoadedSong &&
        String(composerLoadedSong.id) === id &&
        (!prefer || String(composerLoadedSong.section || "").toLowerCase() === prefer)
      ) {
        composerSongMedia.preview = ref;
        if (typeof renderComposerSongMediaFields === "function") renderComposerSongMediaFields();
      }
      if (typeof renderSongCatalog === "function") renderSongCatalog();
      if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
      if (typeof massSlotsForSongId === "function") {
        massSlotsForSongId(id).forEach((slot) => {
          if (typeof updateMassSlotChip === "function") updateMassSlotChip(slot);
          if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(slot);
        });
      }
    }

    function updateLocalCatalogSongVideo(section, songId, videoRef) {
      const id = String(songId || "").trim();
      if (!id) return;
      const prefer = String(section || "").trim().toLowerCase();
      const secs = ["entrance", "offertory", "communion", "recessional", "meditation"];
      const targets = prefer && secs.indexOf(prefer) >= 0 ? [prefer] : secs;
      const ref = videoRef ? normalizeComposerMediaRef(videoRef) : null;
      if (typeof songCatalogData !== "undefined" && songCatalogData) {
        targets.forEach((sec) => {
          if (!Array.isArray(songCatalogData[sec])) return;
          const idx = songCatalogData[sec].findIndex((r) => String(r.id) === id);
          if (idx < 0) return;
          const next = Object.assign({}, songCatalogData[sec][idx]);
          next.video_media = ref;
          songCatalogData[sec][idx] = next;
        });
      }
      if (typeof rebuildMassPlanSongPool === "function") rebuildMassPlanSongPool();
      if (typeof songDetailCache !== "undefined" && typeof songDetailCacheKey === "function") {
        targets.forEach((sec) => {
          const key = songDetailCacheKey(sec, id);
          if (!songDetailCache.has(key)) return;
          const data = songDetailCache.get(key);
          if (!data || !data.song) return;
          data.song.video_media = ref;
          songDetailCache.set(key, data);
        });
      }
      if (
        typeof composerLoadedSong !== "undefined" &&
        composerLoadedSong &&
        String(composerLoadedSong.id || "") === id &&
        (!prefer || String(composerLoadedSong.section || "").toLowerCase() === prefer) &&
        typeof setComposerSongMediaField === "function"
      ) {
        setComposerSongMediaField("video", ref);
      }
      if (typeof selectedLyricsSongs !== "undefined" && selectedLyricsSongs && typeof syncMassSlotMediaToSong === "function") {
        Object.keys(selectedLyricsSongs).forEach((slot) => {
          if (String(selectedLyricsSongs[slot] || "") !== id) return;
          syncMassSlotMediaToSong(slot, id);
          if (typeof updateMassSlotChip === "function") updateMassSlotChip(slot);
          if (typeof updateMassSongPreviewButton === "function") updateMassSongPreviewButton(slot);
        });
      }
      if (typeof renderSongCatalog === "function") renderSongCatalog();
      if (typeof refreshMassSectionMediaUi === "function") refreshMassSectionMediaUi();
    }

    async function persistMassSlotVideoToCatalogSong(slot, videoRef) {
      const assigned = massSlotAssignedSong(slot);
      if (!assigned || !assigned.section || !assigned.id) return;
      const ref = videoRef ? normalizeComposerMediaRef(videoRef) : null;
      const fileRef = ref && ref.basename && !(typeof isYouTubeMediaRef === "function" && isYouTubeMediaRef(ref))
        ? ref
        : null;
      updateLocalCatalogSongVideo(assigned.section, assigned.id, fileRef);
      const body = fileRef
        ? {
            video_media: {
              basename: fileRef.basename,
              display_name: fileRef.display_name || fileRef.basename,
              ...(fileRef.youtube_id ? { youtube_id: fileRef.youtube_id } : {}),
              ...(fileRef.youtube_url ? { youtube_url: fileRef.youtube_url } : {}),
            },
          }
        : { clear_video_media: true };
      try {
        const headers = typeof catalogAuthHeaders === "function"
          ? Object.assign({ "Content-Type": "application/json" }, await catalogAuthHeaders())
          : { "Content-Type": "application/json" };
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        const res = await fetch(
          "/api/catalog/songs/" + encodeURIComponent(assigned.section) + "/" + encodeURIComponent(assigned.id),
          { method: "PATCH", headers: headers, body: JSON.stringify(body) }
        );
        if (res.ok && typeof bustStoredSongDetail === "function") {
          bustStoredSongDetail(assigned.section, assigned.id);
        }
      } catch (_e) { /* local catalog already updated */ }
    }
    window.persistMassSlotVideoToCatalogSong = persistMassSlotVideoToCatalogSong;

    async function persistMassSlotYoutubeToCatalogSong(slot, youtubeRef) {
      const assigned = massSlotAssignedSong(slot);
      if (!assigned) return;
      const ref = youtubeRef ? normalizeComposerMediaRef(youtubeRef) : null;
      if (ref && assigned.row && assigned.row.title && (!ref.display_name || ref.display_name === "YouTube")) {
        ref.display_name = assigned.row.title;
      }
      updateLocalCatalogSongAudio(assigned.section, assigned.id, ref);
      const applyYoutubeToSlot = (key) => {
        const cur = getMassSectionMedia("audio", key);
        if (!cur || isYouTubeMediaRef(cur)) setMassSectionMedia("audio", key, ref);
      };
      applyYoutubeToSlot(slot);
      if (typeof selectedLyricsSongs !== "undefined" && selectedLyricsSongs) {
        Object.keys(selectedLyricsSongs).forEach((other) => {
          if (other === slot) return;
          if (String(selectedLyricsSongs[other] || "") !== assigned.id) return;
          applyYoutubeToSlot(other);
        });
      }
      if (!assigned.section || !assigned.id) return;
      const body = ref
        ? { audio_media: serializeSongMediaRef(ref) }
        : { clear_audio_media: true };
      try {
        const headers = typeof catalogAuthHeaders === "function"
          ? Object.assign({ "Content-Type": "application/json" }, await catalogAuthHeaders())
          : { "Content-Type": "application/json" };
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        const res = await fetch(
          "/api/catalog/songs/" + encodeURIComponent(assigned.section) + "/" + encodeURIComponent(assigned.id),
          { method: "PATCH", headers: headers, body: JSON.stringify(body) }
        );
        if (res.ok && typeof bustStoredSongDetail === "function") {
          bustStoredSongDetail(assigned.section, assigned.id);
        }
      } catch (_e) { /* local catalog already updated for this session */ }
      if (ref && isYouTubeMediaRef(ref)) {
        maybeAutoFetchSongPreview(assigned.section, assigned.id, {
          title: assigned.row && assigned.row.title,
          audio: ref,
          preview: assigned.row && assigned.row.audio_preview,
        });
      }
    }

    async function persistMassSlotPreviewToCatalogSong(slot, previewRef) {
      const assigned = massSlotAssignedSong(slot);
      if (!assigned) return;
      const ref = previewRef ? (fileToAudioPreviewRef(previewRef) || normalizeAudioPreviewRef(previewRef)) : null;
      updateLocalCatalogSongPreview(assigned.section, assigned.id, ref);
      if (!assigned.section || !assigned.id) return;
      const body = ref
        ? { audio_preview: serializeAudioPreviewRef(ref) }
        : { clear_audio_preview: true };
      try {
        const headers = typeof catalogAuthHeaders === "function"
          ? Object.assign({ "Content-Type": "application/json" }, await catalogAuthHeaders())
          : { "Content-Type": "application/json" };
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        const res = await fetch(
          "/api/catalog/songs/" + encodeURIComponent(assigned.section) + "/" + encodeURIComponent(assigned.id),
          { method: "PATCH", headers: headers, body: JSON.stringify(body) }
        );
        if (res.ok && typeof bustStoredSongDetail === "function") {
          bustStoredSongDetail(assigned.section, assigned.id);
        }
      } catch (_e) { /* local catalog already updated for this session */ }
    }

    var previewFetchState = {
      attempted: {},
      applied: {},
      pollTimer: null,
      hideTimer: null,
      currentJobId: "",
    };

    function previewFetchStageLabel(stage, kind) {
      const key = String(stage || "").toLowerCase();
      const isVideo = kind === "instrumental_video" || kind === "karaoke_instrumental";
      const isKaraoke = kind === "karaoke_instrumental";
      if (key === "captions") return "Scanning lyrics";
      if (key === "words") return "Listening for sung words";
      if (key === "download") return isVideo ? "Downloading video" : "Downloading audio";
      if (key === "extract") return "Using saved video";
      if (key === "compressing") return "Compressing video";
      if (key === "aligning") return "Timing lyrics to vocals";
      if (key === "vocals") return "Building instrumental bed";
      if (key === "rendering") return "Rendering karaoke video";
      if (key === "cutting") return "Trimming clip";
      if (key === "saving") return isVideo ? "Saving video" : "Saving clip";
      if (key === "queued") return "Waiting";
      if (key === "done") return isKaraoke ? "Karaoke ready" : (isVideo ? "Video ready" : "Clip ready");
      if (isKaraoke) return "Building karaoke";
      return isVideo ? "Fetching instrumental video" : "Fetching chorus clip";
    }

    function setPreviewFetchStrip(visible, text, percent) {
      const strip = $("preview-fetch-strip");
      const bar = $("preview-fetch-strip-bar");
      const textEl = $("preview-fetch-strip-text");
      const pctEl = $("preview-fetch-strip-pct");
      if (!strip) return;
      const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      strip.hidden = !visible;
      document.body.classList.toggle("has-preview-fetch-strip", !!visible);
      if (textEl && text) textEl.textContent = text;
      if (pctEl) pctEl.textContent = pct + "%";
      if (bar) bar.style.width = pct + "%";
    }

    function stopPreviewFetchPoll() {
      if (previewFetchState.pollTimer) {
        clearInterval(previewFetchState.pollTimer);
        previewFetchState.pollTimer = null;
      }
    }

    async function pollPreviewFetchJobs() {
      if (typeof saFetchAdmin !== "function") return;
      try {
        const data = await saFetchAdmin("/api/admin/songs/preview-jobs");
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const queued = jobs.filter((j) => j.status === "queued" || j.status === "running");
        jobs.forEach((job) => {
          const jid = job.job_id || "";
          if (!jid || previewFetchState.applied[jid]) return;
          if (job.status !== "done" && job.status !== "error") return;
          previewFetchState.applied[jid] = true;
          const title = String(job.title || "this song").trim() || "this song";
          const isInstrumental = job.kind === "instrumental_video" || job.kind === "karaoke_instrumental";
          const isKaraoke = job.kind === "karaoke_instrumental";
          if (job.status === "done") {
            if (job.section && job.id) {
              if (isInstrumental) {
                updateLocalCatalogSongVideo(job.section, job.id, job.video_media || null);
              } else {
                updateLocalCatalogSongPreview(job.section, job.id, job.audio_preview || null);
              }
            }
            if (typeof showToast === "function") {
              showToast(
                isKaraoke
                  ? ("Karaoke ready for \"" + title + "\".")
                  : (isInstrumental
                    ? ("Instrumental video ready for \"" + title + "\".")
                    : ("Chorus clip ready for \"" + title + "\".")),
                "ok"
              );
            }
            const pickModal = $("mw-media-pick-modal");
            if (pickModal && pickModal.getAttribute("data-open") === "true") {
              const openTarget = typeof massMediaPickSongTarget === "function" ? massMediaPickSongTarget() : null;
              const sameSong = !!(
                openTarget &&
                job.section &&
                job.id &&
                String(openTarget.section || "") === String(job.section || "") &&
                String(openTarget.id || "") === String(job.id || "")
              );
              if (sameSong) {
                const statusEl = $("mw-media-pick-fetch-status");
                if (statusEl) delete statusEl.dataset.fetching;
                refreshMassMediaPickFetchUi();
              }
            }
          } else {
            if (typeof showToast === "function") {
              showToast(
                job.error ||
                  (isKaraoke
                    ? ("Could not build karaoke for \"" + title + "\".")
                    : (isInstrumental
                      ? ("Could not download instrumental video for \"" + title + "\".")
                      : ("Could not fetch a chorus clip for \"" + title + "\"."))),
                "warn"
              );
            }
            const pickModal = $("mw-media-pick-modal");
            if (pickModal && pickModal.getAttribute("data-open") === "true") {
              const openTarget = typeof massMediaPickSongTarget === "function" ? massMediaPickSongTarget() : null;
              const sameSong = !!(
                openTarget &&
                job.section &&
                job.id &&
                String(openTarget.section || "") === String(job.section || "") &&
                String(openTarget.id || "") === String(job.id || "")
              );
              if (sameSong) {
                const statusEl = $("mw-media-pick-fetch-status");
                if (statusEl) {
                  delete statusEl.dataset.fetching;
                  statusEl.textContent = job.error || (isKaraoke
                    ? "Could not build karaoke."
                    : (isInstrumental
                      ? "Could not download instrumental video."
                      : "Could not fetch a chorus clip."));
                  statusEl.className = "status error mw-media-pick-fetch-status";
                }
              }
            }
          }
        });
        if (queued.length) {
          const current = data.active || queued[0];
          const title = String(current.title || "this song").trim() || "this song";
          const pct = Number(current.percent) || 0;
          const prefix = queued.length > 1 ? (queued.length + " media · ") : "";
          setPreviewFetchStrip(
            true,
            prefix + previewFetchStageLabel(current.stage, current.kind) + " · " + title,
            pct
          );
          const pickModal = $("mw-media-pick-modal");
          if (pickModal && pickModal.getAttribute("data-open") === "true") {
            const openTarget = typeof massMediaPickSongTarget === "function" ? massMediaPickSongTarget() : null;
            const sameSong = !!(
              openTarget &&
              current.section &&
              current.id &&
              String(openTarget.section || "") === String(current.section || "") &&
              String(openTarget.id || "") === String(current.id || "")
            );
            if (sameSong) {
              const statusEl = $("mw-media-pick-fetch-status");
              if (statusEl) {
                statusEl.dataset.fetching = "1";
                statusEl.textContent = prefix + previewFetchStageLabel(current.stage, current.kind) + "…";
                statusEl.className = "status mw-media-pick-fetch-status";
              }
            }
          }
          return;
        }
        stopPreviewFetchPoll();
        if ($("sa-panel-content-songs") && !$("sa-panel-content-songs").hidden && typeof loadSaSongPreviews === "function") {
          loadSaSongPreviews();
        }
        previewFetchState.hideTimer = setTimeout(() => setPreviewFetchStrip(false, "", 0), 1400);
      } catch (_err) {
        /* keep polling through brief network blips */
      }
    }

    async function startPreviewFetchJob(opts) {
      const options = opts || {};
      const section = String(options.section || "").trim();
      const id = String(options.id || "").trim();
      if (!section || !id || typeof saFetchAdmin !== "function") return null;
      if (previewFetchState.hideTimer) {
        clearTimeout(previewFetchState.hideTimer);
        previewFetchState.hideTimer = null;
      }
      const title = String(options.title || "this song").trim() || "this song";
      const durationOpt = Number(options.duration_sec);
      const durationSec = Number.isFinite(durationOpt)
        ? Math.max(5, Math.min(10, Math.round(durationOpt)))
        : (typeof saPreviewDurationSec === "function" ? saPreviewDurationSec() : 10);
      const body = {
        youtube_url: String(options.youtube_url || "").trim(),
        duration_sec: durationSec,
      };
      if (options.start_sec != null && Number.isFinite(Number(options.start_sec))) {
        body.start_sec = Number(options.start_sec);
      }
      const data = await saFetchAdmin(
        "/api/admin/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(id) + "/preview-job",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const jobId = data.job_id || "";
      if (!jobId) throw new Error("Could not start preview fetch.");
      previewFetchState.currentJobId = jobId;
      setPreviewFetchStrip(true, previewFetchStageLabel(data.stage, data.kind) + " · " + title, data.percent || 1);
      if (options.toast !== false && typeof showToast === "function") {
        showToast("Fetching a " + (body.duration_sec || 10) + "s chorus clip for \"" + title + "\".", "info");
      }
      if (!previewFetchState.pollTimer) {
        previewFetchState.pollTimer = setInterval(pollPreviewFetchJobs, 450);
      }
      pollPreviewFetchJobs();
      return data;
    }

    async function startInstrumentalFetchJob(opts) {
      const options = opts || {};
      const section = String(options.section || "").trim();
      const id = String(options.id || "").trim();
      if (!section || !id || typeof saFetchAdmin !== "function") return null;
      if (previewFetchState.hideTimer) {
        clearTimeout(previewFetchState.hideTimer);
        previewFetchState.hideTimer = null;
      }
      const title = String(options.title || "this song").trim() || "this song";
      const body = {
        youtube_url: String(options.youtube_url || "").trim(),
      };
      if (!body.youtube_url) throw new Error("Enter a valid YouTube URL.");
      const data = await saFetchAdmin(
        "/api/admin/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(id) + "/instrumental-job",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const jobId = data.job_id || "";
      if (!jobId) throw new Error("Could not start instrumental video download.");
      previewFetchState.currentJobId = jobId;
      setPreviewFetchStrip(
        true,
        previewFetchStageLabel(data.stage || "download", "instrumental_video") + " · " + title,
        data.percent || 1
      );
      if (options.toast !== false && typeof showToast === "function") {
        showToast("Downloading full instrumental video for \"" + title + "\".", "info");
      }
      if (!previewFetchState.pollTimer) {
        previewFetchState.pollTimer = setInterval(pollPreviewFetchJobs, 450);
      }
      pollPreviewFetchJobs();
      return data;
    }

    async function startKaraokeFetchJob(opts) {
      const options = opts || {};
      const section = String(options.section || "").trim();
      const id = String(options.id || "").trim();
      if (!section || !id || typeof saFetchAdmin !== "function") return null;
      if (previewFetchState.hideTimer) {
        clearTimeout(previewFetchState.hideTimer);
        previewFetchState.hideTimer = null;
      }
      const title = String(options.title || "this song").trim() || "this song";
      const body = {
        youtube_url: String(options.youtube_url || "").trim(),
      };
      const data = await saFetchAdmin(
        "/api/admin/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(id) + "/karaoke-job",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const jobId = data.job_id || "";
      if (!jobId) throw new Error("Could not start karaoke build.");
      previewFetchState.currentJobId = jobId;
      setPreviewFetchStrip(
        true,
        previewFetchStageLabel(data.stage || "download", "karaoke_instrumental") + " · " + title,
        data.percent || 1
      );
      if (options.toast !== false && typeof showToast === "function") {
        showToast("Building karaoke for \"" + title + "\" — timing from sung audio, then stripping vocals.", "info");
      }
      if (!previewFetchState.pollTimer) {
        previewFetchState.pollTimer = setInterval(pollPreviewFetchJobs, 450);
      }
      pollPreviewFetchJobs();
      return data;
    }

    function maybeAutoFetchSongPreview(section, id, opts) {
      const options = opts || {};
      if (!(churchMembershipState && churchMembershipState.is_superadmin)) return;
      const sec = String(section || "").trim();
      const sid = String(id || "").trim();
      if (!sec || !sid) return;
      const key = sec + ":" + sid;
      if (previewFetchState.attempted[key] && !options.force) return;
      const preview = normalizeAudioPreviewRef(options.preview);
      if (preview && preview.basename) return;
      const audio = options.audio ? normalizeComposerMediaRef(options.audio) : null;
      const youtubeUrl = String(options.youtube_url || (audio && audio.youtube_url) || "").trim();
      if (!youtubeUrl && !isYouTubeMediaRef(audio)) return;
      previewFetchState.attempted[key] = true;
      startPreviewFetchJob({
        section: sec,
        id: sid,
        title: options.title || "",
        youtube_url: youtubeUrl,
        toast: options.toast !== false,
      }).catch((err) => {
        if (typeof showToast === "function") {
          showToast(err.message || "Could not start chorus clip fetch.", "warn");
        }
      });
    }

    function applyYouTubeAudioLink(value) {
      const ref = youtubeMediaRefFromInput(value);
      if (!ref) {
        if (typeof notify === "function") notify("Enter a valid YouTube URL.", "warn");
        return false;
      }
      if (massMediaPickState.purpose === "song" || massMediaPickState.slot === COMPOSER_SONG_MEDIA_SLOT) {
        setComposerYouTubeLink(ref);
        if (typeof persistComposerSongMediaToCatalog === "function") {
          void persistComposerSongMediaToCatalog();
        }
        if (composerLoadedSong && composerLoadedSong.id) {
          maybeAutoFetchSongPreview(composerLoadedSong.section, composerLoadedSong.id, {
            title: composerLoadedSong.title,
            audio: ref,
            preview: composerSongMedia && composerSongMedia.preview,
          });
        }
      } else {
        const slot = massMediaPickState.slot;
        if (!slot) return false;
        const assigned = massSlotAssignedSong(slot);
        if (assigned && assigned.row && assigned.row.title) ref.display_name = assigned.row.title;
        const current = getMassSectionMedia("audio", slot);
        if (!current || isYouTubeMediaRef(current)) setMassSectionMedia("audio", slot, ref);
        void persistMassSlotYoutubeToCatalogSong(slot, ref);
      }
      closeMassMediaPickModal();
      if (typeof notify === "function") {
        notify("YouTube linked for choir practice. It is not added to the PowerPoint.", "ok");
      }
      return true;
    }

    async function openMassMediaPickModal(kind, slot, opts) {
      const options = opts || {};
      const purpose = options.purpose === "song" ? "song" : "mass";
      const isVideo = kind === "video";
      const youtubeOnly = !isVideo && !!options.youtubeOnly;
      const fromTitle = !!options.fromTitle;
      const isSa = !!(document.body.classList.contains("is-superadmin") ||
        (churchMembershipState && churchMembershipState.is_superadmin));
      if (purpose === "mass" && !youtubeOnly && !fromTitle) {
        if (!isSa) {
          if (typeof notify === "function") notify("Only superadmins can link Media files here.", "warn");
          return;
        }
        if (isVideo && !massMediaKeyAllowsVideo(slot)) return;
      }
      massMediaPickState = {
        kind: isVideo ? "video" : "audio",
        slot: String(slot || ""),
        purpose: purpose,
        songField: options.songField === "video" ? "video" : "audio",
        loading: false,
        youtubeOnly: youtubeOnly,
        fromTitle: fromTitle,
      };
      const title = $("mw-media-pick-title");
      const hint = $("mw-media-pick-hint");
      const ytTab = $("mw-media-pick-tab-youtube");
      const libTab = $("mw-media-pick-tab-library");
      const fetchTab = $("mw-media-pick-tab-fetch");
      const upTab = $("mw-media-pick-tab-upload");
      const useInstrumentalFetch = isVideo && isSa;
      const useFetchClip = (!isVideo && !youtubeOnly) || useInstrumentalFetch;
      const showYoutube = !isVideo;
      if (ytTab) ytTab.hidden = !showYoutube;
      if (libTab) libTab.hidden = youtubeOnly || (useFetchClip && !isVideo);
      if (fetchTab) {
        fetchTab.hidden = !useFetchClip;
        fetchTab.textContent = useInstrumentalFetch ? "Fetch video" : "Fetch clip";
      }
      if (upTab) upTab.hidden = youtubeOnly;
      syncMassMediaPickFetchPaneMode(useInstrumentalFetch);
      if (purpose === "song") {
        if (title) {
          title.textContent = isVideo
            ? (useInstrumentalFetch ? "Instrumental video" : "Choose video for this song")
            : (youtubeOnly ? "YouTube" : "Fetch audio clip");
        }
        if (hint) {
          hint.textContent = isVideo
            ? (useInstrumentalFetch
              ? "Download video: Search instrumental → paste URL → Download (best karaoke bed). Make karaoke: Search sung → paste that URL → Make karaoke (Whisper timing; uses instrumental bed if downloaded, else strips vocals)."
              : "Pick an MP4 from your Media library or upload a new one. It stays linked on this song.")
            : (youtubeOnly
              ? "Paste a YouTube URL for the full song (choir practice). This does not replace the 5–10s audio clip."
              : "Fetch a 5–10s chorus clip from YouTube, or upload an MP3. Full-song YouTube is a separate link.");
        }
      } else {
        const label = massMediaDisplayLabel(slot);
        if (title) {
          title.textContent = isVideo
            ? (useInstrumentalFetch ? "Instrumental video for " + label : "Choose video for " + label)
            : (youtubeOnly ? "YouTube" : "Fetch audio clip for " + label);
        }
        if (hint) {
          hint.textContent = isVideo
            ? (useInstrumentalFetch
              ? "Download video: Search instrumental → paste URL → Download (best karaoke bed). Make karaoke: Search sung → paste that URL → Make karaoke (Whisper timing; uses instrumental bed if downloaded, else strips vocals)."
              : "This MP4 replaces the lyric/prayer slides with one embedded video slide when this option is selected at generate time.")
            : (youtubeOnly
              ? "Paste a YouTube URL for choir practice. This does not replace the 5–10s audio clip."
              : "Fetch a 5–10s chorus clip from YouTube (same as Superadmin). It plays from the card ▶ — not embedded in the deck.");
        }
      }
      const lyricsOnly = purpose === "mass" && !isSa && !youtubeOnly;
      if (lyricsOnly) {
        const target = massSlotAssignedSong(slot);
        if (title) title.textContent = (target && target.row && target.row.title) || "Song";
        if (hint) hint.textContent = "View the full lyrics for this Mass slot.";
      }
      refreshMassMediaPickLyricsUi();
      if ($("mw-media-pick-q")) $("mw-media-pick-q").value = "";
      const uploadTitle = $("mw-media-pick-upload-title");
      const uploadHint = $("mw-media-pick-upload-hint");
      if (uploadTitle) uploadTitle.textContent = isVideo ? "Upload MP4" : "Upload MP3";
      if (uploadHint) {
        uploadHint.textContent = isVideo
          ? "Drop a video here or click to browse (.mp4)"
          : "Drop an audio file here or click to browse (.mp3)";
      }
      if ($("mw-media-pick-file")) {
        $("mw-media-pick-file").accept = isVideo
          ? ".mp4,video/mp4"
          : ".mp3,audio/mpeg,audio/mp3";
      }
      const status = $("mw-media-pick-upload-status");
      if (status) {
        status.textContent = "";
        status.className = "status mw-media-pick-upload-status";
      }
      const fetchStatus = $("mw-media-pick-fetch-status");
      if (fetchStatus) {
        delete fetchStatus.dataset.fetching;
        fetchStatus.textContent = "";
        fetchStatus.className = "status mw-media-pick-fetch-status";
      }
      const fetchUrl = $("mw-media-pick-fetch-url");
      if (fetchUrl) {
        fetchUrl.value = "";
        delete fetchUrl.dataset.songKey;
      }
      const durEl = $("mw-media-pick-fetch-duration");
      const durLabel = $("mw-media-pick-fetch-duration-label");
      if (durEl && durLabel) durLabel.textContent = String(massMediaPickFetchDurationSec());
      const ytInp = $("mw-media-pick-youtube-url");
      if (ytInp) {
        const current = purpose === "song"
          ? (composerSongMedia && composerSongMedia.audio)
          : getMassSectionMedia("audio", slot);
        ytInp.value = isYouTubeMediaRef(current) ? (current.youtube_url || youtubeWatchUrl(youtubeIdFromMediaRef(current))) : "";
      }
      refreshMassMediaPickYoutubeTabLabel();
      setMassMediaPickTab(youtubeOnly ? "youtube" : (useFetchClip ? "fetch" : "library"));
      const m = $("mw-media-pick-modal");
      if (!m) return;
      m.setAttribute("data-open", "true");
      m.setAttribute("aria-hidden", "false");
      if (lyricsOnly) {
        setMassMediaPickLoading(false);
        const lyricsBtn = $("mw-media-pick-view-lyrics");
        if (lyricsBtn && !lyricsBtn.hidden && !lyricsBtn.disabled) lyricsBtn.focus();
        return;
      }
      if (youtubeOnly || useFetchClip) {
        setMassMediaPickLoading(false);
        if (useFetchClip) refreshMassMediaPickFetchUi();
        return;
      }
      setMassMediaPickLoading(true, "Loading media library…");
      try {
        await ensureSavedMediaLibrary(false);
        if (massMediaPickState.loading) {
          setMassMediaPickLoading(false);
          renderMassMediaPickList();
        }
      } catch (_e) {
        setMassMediaPickLoading(false);
        const list = $("mw-media-pick-list");
        if (list) {
          list.hidden = false;
          list.innerHTML = "<li class=\"muted\">Could not load Media library. Try Upload, or open the Media tab.</li>";
        }
        if (typeof notify === "function") notify("Could not load Media library.", "error");
      }
      if ($("mw-media-pick-q") && !youtubeOnly) $("mw-media-pick-q").focus();
    }

    async function handleMassMediaPickUpload(file) {
      if (!file) return;
      const wantVideo = massMediaPickState.kind === "video";
      const kind = detectSavedMediaKind(file);
      const status = $("mw-media-pick-upload-status");
      if (!kind || (wantVideo && kind !== "video") || (!wantVideo && kind !== "music")) {
        if (status) {
          status.textContent = wantVideo ? "Please choose an MP4 video." : "Please choose an MP3 audio file.";
          status.className = "status error mw-media-pick-upload-status";
        }
        return;
      }
      if (status) {
        status.textContent = "Uploading…";
        status.className = "status mw-media-pick-upload-status";
      }
      setMassMediaPickLoading(true, "Uploading and refreshing library…");
      const useFetchClip = massMediaPickState.kind === "audio" && !massMediaPickState.youtubeOnly;
      if (!useFetchClip) setMassMediaPickTab("library");
      try {
        await uploadSavedMedia(kind, file, status, $("mw-media-pick-file"), { quiet: true });
        await ensureSavedMediaLibrary(true);
        if (typeof refreshSavedMedia === "function") void refreshSavedMedia();
        setMassMediaPickLoading(false);
        if (!useFetchClip) renderMassMediaPickList();
        const rows = (kind === "video" ? savedMediaLibrary.video : savedMediaLibrary.music) || [];
        const uploadedName = String(file.name || "").trim().toLowerCase();
        let match = rows.find((r) => String(r.display_name || "").trim().toLowerCase() === uploadedName);
        if (!match) {
          match = rows.find((r) => String(r.basename || "").toLowerCase().indexOf(uploadedName.replace(/\.(mp3|mp4)$/i, "")) !== -1);
        }
        if (!match && rows.length) match = rows[0];
        if (match) {
          applyMassMediaPickSelection(match);
          if (status) {
            status.textContent = "Uploaded and linked.";
            status.className = "status ok mw-media-pick-upload-status";
          }
        } else {
          if (status) {
            status.textContent = useFetchClip
              ? "Uploaded. Open Fetch clip or try uploading again."
              : "Uploaded. Pick it from the library list.";
            status.className = "status ok mw-media-pick-upload-status";
          }
        }
      } catch (err) {
        setMassMediaPickLoading(false);
        if (!useFetchClip) renderMassMediaPickList();
        if (status) {
          status.textContent = (err && err.message) || "Upload failed.";
          status.className = "status error mw-media-pick-upload-status";
        }
      }
    }

    function wireMassMediaPickUploadUi() {
      const drop = $("mw-media-pick-drop");
      const input = $("mw-media-pick-file");
      if (!drop || !input || drop.dataset.wired === "1") return;
      drop.dataset.wired = "1";
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
        void handleMassMediaPickUpload(files[0]);
      });
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        void handleMassMediaPickUpload(file);
      });
      const libTab = $("mw-media-pick-tab-library");
      const fetchTab = $("mw-media-pick-tab-fetch");
      const upTab = $("mw-media-pick-tab-upload");
      const ytTab = $("mw-media-pick-tab-youtube");
      if (libTab) libTab.addEventListener("click", () => setMassMediaPickTab("library"));
      if (fetchTab) fetchTab.addEventListener("click", () => setMassMediaPickTab("fetch"));
      if (upTab) upTab.addEventListener("click", () => setMassMediaPickTab("upload"));
      if (ytTab) {
        ytTab.addEventListener("click", () => {
          setMassMediaPickTab("youtube");
          openYouTubeSearchForCurrentSong();
        });
      }
      const ytApply = $("mw-media-pick-youtube-apply");
      const ytInp = $("mw-media-pick-youtube-url");
      if (ytApply) {
        ytApply.addEventListener("click", () => {
          applyYouTubeAudioLink(ytInp && ytInp.value);
        });
      }
      if (ytInp) {
        ytInp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyYouTubeAudioLink(ytInp.value);
          }
        });
      }
      const fetchDur = $("mw-media-pick-fetch-duration");
      const fetchDurLabel = $("mw-media-pick-fetch-duration-label");
      if (fetchDur) {
        fetchDur.addEventListener("input", () => {
          if (fetchDurLabel) fetchDurLabel.textContent = String(massMediaPickFetchDurationSec());
        });
      }
      const fetchSearch = $("mw-media-pick-fetch-search");
      if (fetchSearch) {
        fetchSearch.addEventListener("click", () => {
          const instrumental = typeof massMediaPickFetchIsInstrumental === "function"
            ? massMediaPickFetchIsInstrumental()
            : (massMediaPickState.kind === "video" || massMediaPickState.songField === "video");
          openYouTubeSearchForCurrentSong({ instrumental: instrumental });
        });
      }
      const fetchSearchSung = $("mw-media-pick-fetch-search-sung");
      if (fetchSearchSung) {
        fetchSearchSung.addEventListener("click", () => {
          openYouTubeSearchForCurrentSong({ instrumental: false });
        });
      }
      const fetchRun = $("mw-media-pick-fetch-run");
      if (fetchRun) {
        fetchRun.addEventListener("click", () => { void runMassMediaPickFetch(); });
      }
      const fetchKaraoke = $("mw-media-pick-fetch-karaoke");
      if (fetchKaraoke) {
        fetchKaraoke.addEventListener("click", () => { void runMassMediaPickKaraoke(); });
      }
      const fetchUrl = $("mw-media-pick-fetch-url");
      if (fetchUrl) {
        fetchUrl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void runMassMediaPickFetch();
          }
        });
      }
      const fetchPlay = $("mw-media-pick-fetch-play");
      if (fetchPlay) {
        fetchPlay.addEventListener("click", () => {
          const instrumental = massMediaPickState.kind === "video" || massMediaPickState.songField === "video";
          if (instrumental) {
            if (massMediaPickState.purpose === "song") {
              void playComposerSongMedia("video", fetchPlay);
            } else if (typeof playMassSectionVideo === "function") {
              void playMassSectionVideo(massMediaPickState.slot, fetchPlay);
            }
            return;
          }
          if (massMediaPickState.purpose === "song") {
            const snippet = typeof composerAudioSnippetRef === "function" ? composerAudioSnippetRef() : null;
            if (snippet) void playSavedMusicRef(snippet, COMPOSER_SONG_MEDIA_SLOT, fetchPlay);
            return;
          }
          void playMassSectionAudio(massMediaPickState.slot, fetchPlay);
        });
      }
      const viewLyrics = $("mw-media-pick-view-lyrics");
      if (viewLyrics && viewLyrics.dataset.wired !== "1") {
        viewLyrics.dataset.wired = "1";
        viewLyrics.addEventListener("click", () => { void openMassSongLyricsFromMediaPick(); });
      }
      const lyricsClose = $("mass-song-lyrics-close");
      if (lyricsClose && lyricsClose.dataset.wired !== "1") {
        lyricsClose.dataset.wired = "1";
        lyricsClose.addEventListener("click", closeMassSongLyricsModal);
      }
      const lyricsModal = $("mass-song-lyrics-modal");
      if (lyricsModal && lyricsModal.dataset.wired !== "1") {
        lyricsModal.dataset.wired = "1";
        lyricsModal.addEventListener("click", (e) => {
          if (e.target === lyricsModal) closeMassSongLyricsModal();
        });
      }
      if (!document.documentElement.dataset.massLyricsEscBound) {
        document.documentElement.dataset.massLyricsEscBound = "1";
        document.addEventListener("keydown", (e) => {
          if (e.key !== "Escape") return;
          const lyricsOpen = $("mass-song-lyrics-modal") && $("mass-song-lyrics-modal").getAttribute("data-open") === "true";
          if (lyricsOpen) {
            e.preventDefault();
            closeMassSongLyricsModal();
          }
        });
      }
    }
    wireMassMediaPickUploadUi();

    window.massMediaKey = massMediaKey;
    window.playMassSectionAudio = playMassSectionAudio;
    window.playMassSectionYouTube = playMassSectionYouTube;
    window.playMassSectionVideo = playMassSectionVideo;
    window.openMassRiteTextPreview = openMassRiteTextPreview;
    window.chooseMassRiteSlideMode = chooseMassRiteSlideMode;
    window.refreshMassSectionMediaUi = refreshMassSectionMediaUi;
    window.openMassMediaPickModal = openMassMediaPickModal;
    window.closeMassMediaPickModal = closeMassMediaPickModal;
    window.openMassSongLyricsForSlot = openMassSongLyricsForSlot;
    window.closeMassSongLyricsModal = closeMassSongLyricsModal;
    window.clearMassMediaPickSelection = clearMassMediaPickSelection;
    window.clearMassYouTubeLink = clearMassYouTubeLink;
    window.renderMassMediaPickList = renderMassMediaPickList;

    var MEDIA_THUMB_PLAY_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><polygon points=\"8 5 19 12 8 19 8 5\"/></svg>";
    var MEDIA_THUMB_VIDEO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5\"/><rect x=\"2\" y=\"6\" width=\"14\" height=\"12\" rx=\"2\"/></svg>";
    var MEDIA_DOWNLOAD_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"/></svg>";

    function getEwtRadioHlsUrl(station) {
      if (!station) return "";
      return station.hls_url || EWTN_HLS_FALLBACK[station.id] || "";
    }

    function getEwtRadioStationId() {
      try {
        const id = localStorage.getItem(EWTN_RADIO_STORAGE_KEY) || "us";
        return ewtnRadioStations.some((s) => s.id === id) ? id : (ewtnRadioStations[0] && ewtnRadioStations[0].id) || "us";
      } catch (_e) {
        return "us";
      }
    }

    function saveEwtRadioStationId(id) {
      try {
        localStorage.setItem(EWTN_RADIO_STORAGE_KEY, id);
      } catch (_e) { /* ignore */ }
    }

    function getEwtRadioDefaultStation() {
      const id = getEwtRadioStationId();
      return ewtnRadioStations.find((s) => s.id === id) || ewtnRadioStations[0] || null;
    }

    function getEwtRadioActiveStationId() {
      if (ewtnRadioActiveId && ewtnRadioStations.some((s) => s.id === ewtnRadioActiveId)) {
        return ewtnRadioActiveId;
      }
      return getEwtRadioStationId();
    }

    function getEwtRadioActiveStation() {
      const id = getEwtRadioActiveStationId();
      return ewtnRadioStations.find((s) => s.id === id) || ewtnRadioStations[0] || null;
    }

    function setLiveRadioPlayingUi(playing) {
      ewtnRadioPlaying = !!playing;
      const pill = $("live-radio-pill");
      const wrap = $("live-radio-wrap");
      const pageLayout = $("radio-page-layout");
      if (pill) pill.classList.toggle("is-playing", ewtnRadioPlaying);
      if (wrap) wrap.classList.toggle("is-playing", ewtnRadioPlaying);
      if (pageLayout) pageLayout.classList.toggle("is-playing", ewtnRadioPlaying);
      const playBtn = $("live-radio-play-btn");
      const panelPlay = $("live-radio-panel-play");
      const pagePlay = $("radio-page-play");
      const label = mediaHubPlayerMode === "library"
        ? (playing ? "Pause media" : "Play media")
        : (playing ? "Pause live radio" : "Play live radio");
      if (playBtn) playBtn.setAttribute("aria-label", label);
      if (panelPlay) panelPlay.setAttribute("aria-label", label);
      if (pagePlay) pagePlay.setAttribute("aria-label", label);
    }

    function revokeLibraryObjectUrl() {
      if (libraryPlayObjectUrl) {
        URL.revokeObjectURL(libraryPlayObjectUrl);
        libraryPlayObjectUrl = null;
      }
    }

    function rebuildLibraryPlaylist() {
      libraryPlaylist = savedMediaLibrary.music
        .map((item) => Object.assign({ kind: "music" }, item))
        .concat(savedMediaLibrary.video.map((item) => Object.assign({ kind: "video" }, item)));
    }

    function markActiveLibraryThumb(item) {
      document.querySelectorAll(".media-thumb.is-active, .media-track.is-active").forEach((el) => el.classList.remove("is-active"));
      if (!item) return;
      const sel = "[data-media-kind=\"" + item.kind + "\"][data-media-name=\"" + CSS.escape(item.basename) + "\"]";
      const thumb = document.querySelector(".media-thumb" + sel + ", .media-track" + sel);
      if (thumb) thumb.classList.add("is-active");
    }

    function formatMediaClock(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) {
        return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      }
      return m + ":" + String(s).padStart(2, "0");
    }

    function getActiveLibraryMediaEl() {
      if (mediaHubPlayerMode !== "library" || !libraryActiveItem) return null;
      if (libraryActiveItem.kind === "video") {
        const video = $("radio-page-video");
        return video && video.dataset.libraryMode ? video : null;
      }
      const audio = $("live-radio-audio");
      return audio && audio.dataset.libraryMode ? audio : null;
    }

    function setLibrarySeekVisible(show) {
      const seek = $("radio-page-seek");
      if (!seek) return;
      seek.hidden = !show;
    }

    function syncLibrarySeekUi(force) {
      const seek = $("radio-page-seek");
      const range = $("radio-page-seek-range");
      const curEl = $("radio-page-seek-current");
      const durEl = $("radio-page-seek-duration");
      if (!seek || !range) return;
      const media = getActiveLibraryMediaEl();
      if (!media) {
        setLibrarySeekVisible(false);
        range.value = "0";
        range.style.setProperty("--seek-progress", "0%");
        if (curEl) curEl.textContent = "0:00";
        if (durEl) durEl.textContent = "0:00";
        return;
      }
      setLibrarySeekVisible(true);
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
      const current = Number.isFinite(media.currentTime) ? media.currentTime : 0;
      if (durEl) durEl.textContent = duration ? formatMediaClock(duration) : "0:00";
      if (curEl) curEl.textContent = formatMediaClock(current);
      if (!librarySeekDragging || force) {
        const pct = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
        range.value = String(Math.round(pct * 1000));
        range.style.setProperty("--seek-progress", (pct * 100).toFixed(2) + "%");
      }
      range.disabled = duration <= 0;
    }

    function seekLibraryMediaFromRange() {
      const range = $("radio-page-seek-range");
      const media = getActiveLibraryMediaEl();
      if (!range || !media) return;
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
      if (duration <= 0) return;
      const pct = Math.min(1, Math.max(0, (Number(range.value) || 0) / 1000));
      try {
        media.currentTime = pct * duration;
      } catch (_e) { /* ignore */ }
      range.style.setProperty("--seek-progress", (pct * 100).toFixed(2) + "%");
      const curEl = $("radio-page-seek-current");
      if (curEl) curEl.textContent = formatMediaClock(media.currentTime);
    }

    function syncLibraryControllerUi() {
      const item = libraryActiveItem;
      const pageTitle = $("radio-page-station-title");
      const pageArt = $("radio-page-art");
      const pagePos = $("radio-page-channel-pos");
      const title = item ? (item.display_name || item.basename || "Media") : "Media";
      if (pageTitle) pageTitle.textContent = title;
      if (pageArt && item) {
        pageArt.alt = title + " artwork";
      }
      if (pagePos) {
        if (libraryPlaylist.length && libraryTrackIndex >= 0) {
          pagePos.textContent = (libraryTrackIndex + 1) + " / " + libraryPlaylist.length;
        } else {
          pagePos.textContent = "—";
        }
      }
      syncLibrarySeekUi();
    }

    function libraryVideoPipSupported(video) {
      return !!(document.pictureInPictureEnabled && video && typeof video.requestPictureInPicture === "function");
    }

    async function exitLibraryVideoPiP(video) {
      if (video && document.pictureInPictureElement === video) {
        try { await document.exitPictureInPicture(); } catch (_e) { /* ignore */ }
        syncLibraryVideoPiPUi(video);
      }
    }

    async function enterLibraryVideoPiP(video) {
      if (!libraryVideoPipSupported(video)) {
        notify("Picture-in-Picture is not available in this browser.", "info");
        return false;
      }
      if (document.pictureInPictureElement === video) return true;
      try {
        await video.requestPictureInPicture();
        syncLibraryVideoPiPUi(video);
        return true;
      } catch (err) {
        if (err && err.name !== "AbortError") {
          notify("Could not open Picture-in-Picture.", "info");
        }
        return false;
      }
    }

    function syncLibraryVideoPiPUi(video) {
      const layout = $("radio-page-layout");
      const pipBtn = $("radio-page-pip");
      const inPiP = !!(video && document.pictureInPictureElement === video);
      if (layout) layout.classList.toggle("is-pip-active", inPiP);
      if (pipBtn) {
        pipBtn.setAttribute("aria-pressed", inPiP ? "true" : "false");
        pipBtn.setAttribute("aria-label", inPiP ? "Exit picture in picture" : "Picture in picture");
      }
    }

    async function toggleLibraryVideoPiP() {
      const item = libraryActiveItem;
      const video = $("radio-page-video");
      if (!item || item.kind !== "video" || !video || !video.dataset.libraryMode) return;
      if (document.pictureInPictureElement === video) {
        await exitLibraryVideoPiP(video);
        return;
      }
      try {
        if (video.paused) await video.play();
        await enterLibraryVideoPiP(video);
        setLiveRadioPlayingUi(true);
      } catch (_e) {
        notify("Could not open Picture-in-Picture.", "error");
      }
    }

    function setLibraryPlayerLayout(item) {
      const layout = $("radio-page-layout");
      if (!layout) return;
      layout.classList.add("is-library-mode");
      layout.classList.toggle("is-library-video", !!(item && item.kind === "video"));
      layout.classList.toggle("is-library-music", !!(item && item.kind === "music"));
    }

    function clearLibraryPlayerLayout() {
      const layout = $("radio-page-layout");
      if (!layout) return;
      layout.classList.remove("is-library-mode", "is-library-video", "is-library-music", "is-pip-active");
      const pipBtn = $("radio-page-pip");
      if (pipBtn) {
        pipBtn.setAttribute("aria-pressed", "false");
        pipBtn.setAttribute("aria-label", "Picture in picture");
      }
      librarySeekDragging = false;
      setLibrarySeekVisible(false);
      syncLibrarySeekUi(true);
    }

    function stopLibraryPlayback() {
      const audio = $("live-radio-audio");
      const video = $("radio-page-video");
      if (audio && audio.dataset.libraryMode) {
        audio.pause();
        audio.removeAttribute("src");
        try { audio.load(); } catch (_e) { /* ignore */ }
        delete audio.dataset.libraryMode;
      }
      if (video) {
        exitLibraryVideoPiP(video);
        video.pause();
        video.removeAttribute("src");
        delete video.dataset.libraryMode;
        try { video.load(); } catch (_e) { /* ignore */ }
      }
      revokeLibraryObjectUrl();
      libraryActiveItem = null;
      libraryTrackIndex = -1;
      mediaHubPlayerMode = "radio";
      clearLibraryPlayerLayout();
      markActiveLibraryThumb(null);
    }

    async function resolveLibraryMediaUrl(url) {
      if (!url) return "";
      if (!isPrivateFileUrl(url)) return url;
      const res = await authorizedFetch(url);
      if (!res.ok) throw new Error("Could not load media.");
      const blob = await res.blob();
      revokeLibraryObjectUrl();
      libraryPlayObjectUrl = URL.createObjectURL(blob);
      return libraryPlayObjectUrl;
    }

    async function startLibraryPlayback(item) {
      if (!item) return;
      rebuildLibraryPlaylist();
      libraryTrackIndex = libraryPlaylist.findIndex(
        (row) => row.basename === item.basename && row.kind === item.kind
      );
      if (libraryTrackIndex < 0) {
        libraryPlaylist.push(Object.assign({ kind: item.kind }, item));
        libraryTrackIndex = libraryPlaylist.length - 1;
      }
      libraryActiveItem = libraryPlaylist[libraryTrackIndex];
      mediaHubPlayerMode = "library";
      const audio = $("live-radio-audio");
      resetEwtRadioAudio(audio);
      setLiveRadioPlayingUi(false);
      setLibraryPlayerLayout(libraryActiveItem);
      syncLibraryControllerUi();
      markActiveLibraryThumb(libraryActiveItem);
      const playUrl = await resolveLibraryMediaUrl(libraryActiveItem.url);
      try {
        if (libraryActiveItem.kind === "video") {
          const video = $("radio-page-video");
          if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            delete audio.dataset.libraryMode;
          }
          if (!video) throw new Error("Video player unavailable.");
          video.src = playUrl;
          video.dataset.libraryMode = "1";
          await video.play();
          setLiveRadioPlayingUi(true);
          syncLibrarySeekUi(true);
        } else {
          const video = $("radio-page-video");
          if (video) {
            await exitLibraryVideoPiP(video);
            video.pause();
            video.removeAttribute("src");
            delete video.dataset.libraryMode;
          }
          if (!audio) throw new Error("Audio player unavailable.");
          audio.src = playUrl;
          audio.dataset.libraryMode = "1";
          await audio.play();
          setLiveRadioPlayingUi(true);
          syncLibrarySeekUi(true);
        }
      } catch (e) {
        console.error("Library playback failed:", e);
        setLiveRadioPlayingUi(false);
        notify("Could not play file.", "error");
      }
    }

    async function toggleLibraryPlayback() {
      const item = libraryActiveItem;
      if (!item) return;
      const audio = $("live-radio-audio");
      const video = $("radio-page-video");
      try {
        if (item.kind === "video" && video) {
          if (!video.paused) {
            await exitLibraryVideoPiP(video);
            video.pause();
            setLiveRadioPlayingUi(false);
          } else {
            await video.play();
            setLiveRadioPlayingUi(true);
          }
          return;
        }
        if (audio) {
          if (!audio.paused) {
            audio.pause();
            setLiveRadioPlayingUi(false);
          } else {
            await audio.play();
            setLiveRadioPlayingUi(true);
          }
        }
      } catch (_e) {
        notify("Could not resume playback.", "error");
      }
    }

    async function stepLibraryTrack(delta) {
      if (!libraryPlaylist.length) rebuildLibraryPlaylist();
      if (!libraryPlaylist.length) return;
      if (libraryTrackIndex < 0) libraryTrackIndex = 0;
      const nextIdx = (libraryTrackIndex + delta + libraryPlaylist.length) % libraryPlaylist.length;
      await startLibraryPlayback(libraryPlaylist[nextIdx]);
    }

    function syncLiveRadioPanelUi() {
      const station = getEwtRadioActiveStation();
      const title = $("live-radio-panel-title");
      const art = $("live-radio-art");
      const pos = $("live-radio-channel-pos");
      const pageTitle = $("radio-page-station-title");
      const pageArt = $("radio-page-art");
      const pagePos = $("radio-page-channel-pos");
      if (station) {
        if (title) title.textContent = station.name;
        if (pageTitle) pageTitle.textContent = station.name;
        if (art && station.image_url) {
          art.src = station.image_url;
          art.alt = station.name + " artwork";
        }
        if (pageArt && station.image_url) {
          pageArt.src = station.image_url;
          pageArt.alt = station.name + " artwork";
        }
      }
      if (ewtnRadioStations.length) {
        const idx = ewtnRadioStations.findIndex((s) => s.id === getEwtRadioActiveStationId());
        const posText = (idx >= 0 ? idx + 1 : 1) + " / " + ewtnRadioStations.length;
        if (pos) pos.textContent = posText;
        if (pagePos) pagePos.textContent = posText;
      }
    }

    function syncLiveRadioUi() {
      if (!ewtnRadioActiveId) ewtnRadioActiveId = getEwtRadioStationId();
      syncLiveRadioPanelUi();
      renderSettingsRadioList();
    }

    async function stepLiveRadioChannel(delta) {
      if (mediaHubPlayerMode === "library") {
        await stepLibraryTrack(delta);
        return;
      }
      if (!ewtnRadioStations.length) return;
      const currentId = getEwtRadioActiveStationId();
      const idx = ewtnRadioStations.findIndex((s) => s.id === currentId);
      const base = idx >= 0 ? idx : 0;
      const nextIdx = (base + delta + ewtnRadioStations.length) % ewtnRadioStations.length;
      ewtnRadioActiveId = ewtnRadioStations[nextIdx].id;
      syncLiveRadioPanelUi();
      const wasPlaying = ewtnRadioPlaying;
      const audio = $("live-radio-audio");
      resetEwtRadioAudio(audio);
      setLiveRadioPlayingUi(false);
      if (!wasPlaying) return;
      try {
        await startEwtRadioPlayback(getEwtRadioActiveStation());
        setLiveRadioPlayingUi(true);
      } catch (e) {
        resetEwtRadioAudio(audio);
        console.error("Live radio channel switch failed:", e);
        notify("Could not switch channel. Try play again.", "error");
      }
    }

    function stationSubtitle(station) {
      return isStationPlayable(station) ? "24/7 live stream" : "In-app playback unavailable";
    }

    function renderRadioStationList(listEl) {
      if (!listEl) return;
      const selected = getEwtRadioActiveStationId();
      if (!ewtnRadioStations.length) {
        listEl.innerHTML = "<p class=\"muted\">Loading stations…</p>";
        return;
      }
      listEl.innerHTML = ewtnRadioStations.map((station) => (
        "<button type=\"button\" class=\"settings-radio-option" + (station.id === selected ? " is-selected" : "") + "\" " +
          "data-ewtn-radio-id=\"" + escapeHtml(station.id) + "\">" +
          "<img class=\"settings-radio-option__art\" src=\"" + escapeHtml(station.image_url || "") + "\" alt=\"\" loading=\"lazy\" width=\"52\" height=\"40\" />" +
          "<span class=\"settings-radio-option__text\">" +
            "<strong>" + escapeHtml(station.name) + "</strong>" +
            "<span>" + escapeHtml(stationSubtitle(station)) + "</span>" +
          "</span>" +
          "<span class=\"settings-radio-option__mark\" aria-hidden=\"true\">Default</span>" +
        "</button>"
      )).join("");
    }

    function renderRadioStationDropdown(selectEl) {
      if (!selectEl) return;
      const selected = getEwtRadioStationId();
      selectEl.innerHTML = ewtnRadioStations.map((station) => (
        "<option value=\"" + escapeHtml(station.id) + "\"" + (station.id === selected ? " selected" : "") + ">" +
          escapeHtml(station.name) + (isStationPlayable(station) ? "" : " (no in-app stream)") +
        "</option>"
      )).join("");
      if (typeof refreshVerbumSelect === "function") refreshVerbumSelect(selectEl);
    }

    function renderSettingsRadioList() {
      renderRadioStationDropdown($("settings-radio-select"));
      renderRadioStationList($("radio-page-list"));
    }

    async function loadEwtRadioCatalog() {
      const status = $("settings-radio-status");
      const pageStatus = $("radio-page-status");
      try {
        const res = await fetch("/api/ewtn/radio");
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.detail || data.error || "Could not load radio stations.");
        ewtnRadioStations = Array.isArray(data.stations) ? data.stations : [];
        if (!ewtnRadioActiveId) ewtnRadioActiveId = getEwtRadioStationId();
        syncLiveRadioUi();
        if (status) status.textContent = "";
        if (pageStatus) pageStatus.textContent = "";
      } catch (e) {
        const msg = e.message || "Could not load EWTN radio.";
        if (status) status.textContent = msg;
        if (pageStatus) pageStatus.textContent = msg;
        notify(msg, "error");
      }
    }

    function destroyEwtRadioHls() {
      if (ewtnHls) {
        try { ewtnHls.destroy(); } catch (_e) { /* ignore */ }
        ewtnHls = null;
      }
    }

    function resetEwtRadioAudio(audio) {
      if (!audio) return;
      destroyEwtRadioHls();
      audio.pause();
      audio.removeAttribute("src");
      try { audio.load(); } catch (_e) { /* ignore */ }
      delete audio.dataset.stationId;
    }

    function waitForAudioCanPlay(audio, timeoutMs) {
      const ms = timeoutMs || 15000;
      return new Promise((resolve, reject) => {
        if (audio.readyState >= 2) {
          resolve();
          return;
        }
        let timer = null;
        const cleanup = () => {
          if (timer) clearTimeout(timer);
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("error", onErr);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onErr = () => {
          cleanup();
          const code = audio.error && audio.error.code;
          reject(new Error(code ? "Audio error " + code : "Audio failed to load"));
        };
        timer = setTimeout(() => { cleanup(); reject(new Error("Radio stream timed out")); }, ms);
        audio.addEventListener("canplay", onReady);
        audio.addEventListener("error", onErr);
      });
    }

    function loadEwtRadioWithHls(audio, station) {
      const hlsUrl = getEwtRadioHlsUrl(station);
      if (!hlsUrl) return Promise.reject(new Error("No HLS stream"));
      if (window.Hls && Hls.isSupported()) {
        return new Promise((resolve, reject) => {
          destroyEwtRadioHls();
          ewtnHls = new Hls({ enableWorker: true, lowLatencyMode: true });
          ewtnHls.attachMedia(audio);
          ewtnHls.on(Hls.Events.MANIFEST_PARSED, () => resolve());
          ewtnHls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data && data.fatal) reject(data);
          });
          ewtnHls.loadSource(hlsUrl);
        });
      }
      if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = hlsUrl;
        audio.load();
        return waitForAudioCanPlay(audio);
      }
      return Promise.reject(new Error("HLS not supported"));
    }

    async function startEwtRadioPlayback(station) {
      const audio = $("live-radio-audio");
      if (!audio || !station) throw new Error("No station");
      resetEwtRadioAudio(audio);
      try {
        await loadEwtRadioWithHls(audio, station);
      } catch (_hlsErr) {
        if (!station.stream_url) throw _hlsErr;
        audio.src = station.stream_url;
        audio.load();
        await waitForAudioCanPlay(audio);
      }
      audio.dataset.stationId = station.id;
      await audio.play();
    }

    function isStationPlayable(station) {
      return !!(
        station &&
        !station.page_only &&
        (getEwtRadioHlsUrl(station) || station.stream_url)
      );
    }

    async function toggleLiveRadioPlay() {
      if (mediaHubPlayerMode === "library") {
        await toggleLibraryPlayback();
        return;
      }
      const audio = $("live-radio-audio");
      const station = getEwtRadioActiveStation();
      if (!station) {
        notify("Choose a radio station in Settings first.", "info");
        openLiveRadioSettings();
        return;
      }
      if (!isStationPlayable(station)) {
        notify(
          station.name + " can’t play in the mini player. Pick a station with a live stream in Settings.",
          "info"
        );
        return;
      }
      if (!audio) return;
      if (ewtnRadioPlaying) {
        audio.pause();
        setLiveRadioPlayingUi(false);
        return;
      }
      if (
        audio.dataset.stationId === station.id &&
        (ewtnHls || audio.src) &&
        audio.paused
      ) {
        try {
          await audio.play();
          setLiveRadioPlayingUi(true);
          return;
        } catch (_e) { /* reload stream below */ }
      }
      try {
        await startEwtRadioPlayback(station);
        setLiveRadioPlayingUi(true);
      } catch (e) {
        resetEwtRadioAudio(audio);
        console.error("Live radio playback failed:", e);
        setLiveRadioPlayingUi(false);
        notify("Could not start playback. Tap play again or pick another station in Settings.", "error");
      }
    }

    function selectEwtRadioStation(id) {
      if (!ewtnRadioStations.some((s) => s.id === id)) return;
      stopLibraryPlayback();
      const wasPlaying = ewtnRadioPlaying;
      saveEwtRadioStationId(id);
      ewtnRadioActiveId = id;
      syncLiveRadioUi();
      const audio = $("live-radio-audio");
      resetEwtRadioAudio(audio);
      setLiveRadioPlayingUi(false);
      const station = getEwtRadioDefaultStation();
      if (wasPlaying && isStationPlayable(station)) toggleLiveRadioPlay();
      const status = $("settings-radio-status");
      if (status) status.textContent = (station ? station.name : "Station") + " is now your default.";
    }

    function openLiveRadioSettings() {
      showRoute("/radio");
    }

    function initLiveRadio() {
      const playBtn = $("live-radio-play-btn");
      const panelPlay = $("live-radio-panel-play");
      const settingsBtn = $("live-radio-settings-btn");
      const menuBtn = $("live-radio-menu-btn");
      const prevBtn = $("live-radio-prev");
      const nextBtn = $("live-radio-next");
      const panel = $("live-radio-panel");
      const audio = $("live-radio-audio");
      const settingsSelect = $("settings-radio-select");

      if (playBtn) {
        playBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleLiveRadioPlay();
        });
      }
      if (panelPlay) {
        panelPlay.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleLiveRadioPlay();
        });
      }
      if (settingsBtn) {
        settingsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openLiveRadioSettings();
        });
      }
      if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          stepLiveRadioChannel(-1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          stepLiveRadioChannel(1);
        });
      }
      if (menuBtn && panel) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (panel.hidden) {
            closeHeaderMenus("live-radio-panel");
            syncLiveRadioPanelUi();
            setVbDropdownOpen(panel, menuBtn, true);
          } else {
            setVbDropdownOpen(panel, menuBtn, false);
          }
        });
      }
      if (settingsSelect) {
        settingsSelect.addEventListener("change", () => {
          if (settingsSelect.value) selectEwtRadioStation(settingsSelect.value);
        });
      }
      const pageList = $("radio-page-list");
      if (pageList) {
        pageList.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-ewtn-radio-id]");
          if (!btn) return;
          selectEwtRadioStation(btn.dataset.ewtnRadioId);
        });
      }
      const pagePlay = $("radio-page-play");
      const pagePrev = $("radio-page-prev");
      const pageNext = $("radio-page-next");
      if (pagePlay) {
        pagePlay.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleLiveRadioPlay();
        });
      }
      if (pagePrev) {
        pagePrev.addEventListener("click", (e) => {
          e.stopPropagation();
          stepLiveRadioChannel(-1);
        });
      }
      if (pageNext) {
        pageNext.addEventListener("click", (e) => {
          e.stopPropagation();
          stepLiveRadioChannel(1);
        });
      }
      const seekRange = $("radio-page-seek-range");
      if (seekRange) {
        const beginSeekDrag = () => {
          if (mediaHubPlayerMode !== "library") return;
          librarySeekDragging = true;
        };
        const endSeekDrag = () => {
          if (!librarySeekDragging) return;
          seekLibraryMediaFromRange();
          librarySeekDragging = false;
          syncLibrarySeekUi(true);
        };
        seekRange.addEventListener("pointerdown", beginSeekDrag);
        seekRange.addEventListener("mousedown", beginSeekDrag);
        seekRange.addEventListener("touchstart", beginSeekDrag, { passive: true });
        seekRange.addEventListener("input", () => {
          if (mediaHubPlayerMode !== "library") return;
          librarySeekDragging = true;
          const pct = Math.min(1, Math.max(0, (Number(seekRange.value) || 0) / 1000));
          seekRange.style.setProperty("--seek-progress", (pct * 100).toFixed(2) + "%");
          const media = getActiveLibraryMediaEl();
          const curEl = $("radio-page-seek-current");
          if (curEl && media && Number.isFinite(media.duration) && media.duration > 0) {
            curEl.textContent = formatMediaClock(pct * media.duration);
          }
        });
        seekRange.addEventListener("change", endSeekDrag);
        seekRange.addEventListener("pointerup", endSeekDrag);
        seekRange.addEventListener("mouseup", endSeekDrag);
        seekRange.addEventListener("touchend", endSeekDrag);
        seekRange.addEventListener("keyup", (e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            seekLibraryMediaFromRange();
            syncLibrarySeekUi(true);
          }
        });
      }
      if (audio) {
        audio.addEventListener("playing", () => {
          if (audio.dataset.libraryMode) mediaHubPlayerMode = "library";
          setLiveRadioPlayingUi(true);
          if (audio.dataset.libraryMode) syncLibrarySeekUi();
        });
        audio.addEventListener("pause", () => {
          if (mediaHubPlayerMode === "library" && audio.dataset.libraryMode) setLiveRadioPlayingUi(false);
          else if (mediaHubPlayerMode !== "library") setLiveRadioPlayingUi(false);
        });
        audio.addEventListener("ended", () => {
          if (mediaHubPlayerMode === "library" && audio.dataset.libraryMode) setLiveRadioPlayingUi(false);
          else setLiveRadioPlayingUi(false);
          if (audio.dataset.libraryMode) syncLibrarySeekUi(true);
        });
        audio.addEventListener("timeupdate", () => {
          if (audio.dataset.libraryMode) syncLibrarySeekUi();
        });
        audio.addEventListener("loadedmetadata", () => {
          if (audio.dataset.libraryMode) syncLibrarySeekUi(true);
        });
        audio.addEventListener("durationchange", () => {
          if (audio.dataset.libraryMode) syncLibrarySeekUi(true);
        });
        audio.addEventListener("error", () => {
          setLiveRadioPlayingUi(false);
          if (mediaHubPlayerMode === "library" && audio.dataset.libraryMode) {
            notify("Could not play this file.", "error");
            return;
          }
          destroyEwtRadioHls();
          notify("Radio stream interrupted. Try play again or pick another station.", "error");
        });
      }
      const pagePip = $("radio-page-pip");
      if (pagePip) {
        pagePip.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleLibraryVideoPiP();
        });
      }
      const pageVideo = $("radio-page-video");
      if (pageVideo) {
        pageVideo.addEventListener("playing", () => {
          mediaHubPlayerMode = "library";
          setLiveRadioPlayingUi(true);
          syncLibrarySeekUi();
        });
        pageVideo.addEventListener("pause", () => {
          if (mediaHubPlayerMode === "library") setLiveRadioPlayingUi(false);
        });
        pageVideo.addEventListener("ended", () => {
          if (mediaHubPlayerMode === "library") {
            exitLibraryVideoPiP(pageVideo);
            syncLibraryVideoPiPUi(pageVideo);
            setLiveRadioPlayingUi(false);
            syncLibrarySeekUi(true);
          }
        });
        pageVideo.addEventListener("timeupdate", () => {
          if (pageVideo.dataset.libraryMode) syncLibrarySeekUi();
        });
        pageVideo.addEventListener("loadedmetadata", () => {
          if (pageVideo.dataset.libraryMode) syncLibrarySeekUi(true);
        });
        pageVideo.addEventListener("durationchange", () => {
          if (pageVideo.dataset.libraryMode) syncLibrarySeekUi(true);
        });
        pageVideo.addEventListener("enterpictureinpicture", () => {
          syncLibraryVideoPiPUi(pageVideo);
        });
        pageVideo.addEventListener("leavepictureinpicture", () => {
          syncLibraryVideoPiPUi(pageVideo);
          if (mediaHubPlayerMode !== "library" || !libraryActiveItem || libraryActiveItem.kind !== "video") return;
          setLiveRadioPlayingUi(!pageVideo.paused);
        });
        pageVideo.addEventListener("error", () => {
          if (mediaHubPlayerMode === "library") {
            setLiveRadioPlayingUi(false);
            notify("Could not play this video.", "error");
          }
        });
      }
      loadEwtRadioCatalog();
    }

    function formatNewsDate(isoOrRaw) {
      if (!isoOrRaw) return "";
      const d = new Date(isoOrRaw);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function homeNewsThumbUrl(url) {
      const u = String(url || "").trim();
      if (!u) return "";
      if (u.includes("res.cloudinary.com") && u.includes("/upload/")) {
        return u.replace("/upload/", "/upload/w_240,h_180,c_fill,f_auto,q_70/");
      }
      return u;
    }

    var HOME_NEWS_PLACEHOLDER_LIGHT = "/static/images/news-no-image-placeholder.png";
    var HOME_NEWS_PLACEHOLDER_DARK = "/static/images/news-no-image-placeholder-dark.png";

    function getHomeNewsPlaceholderSrc() {
      return (document.documentElement.getAttribute("data-theme") || "light") === "dark"
        ? HOME_NEWS_PLACEHOLDER_DARK
        : HOME_NEWS_PLACEHOLDER_LIGHT;
    }

    function applyNewsPlaceholderImg(img) {
      if (!img) return;
      img.onerror = null;
      img.src = getHomeNewsPlaceholderSrc();
      img.classList.add("home-news-item__img--placeholder");
    }
    window.__applyNewsPlaceholderImg = applyNewsPlaceholderImg;

    function refreshHomeNewsPlaceholders() {
      document.querySelectorAll(".home-news-item__img--placeholder").forEach((img) => {
        img.src = getHomeNewsPlaceholderSrc();
      });
    }

    function homeNewsPlaceholderHtml() {
      return (
        '<img class="home-news-item__img home-news-item__img--placeholder" src="' + getHomeNewsPlaceholderSrc() + '" alt="" loading="lazy" decoding="async" />'
      );
    }

    function homeNewsMediaHtml(imageUrl) {
      const url = String(imageUrl || "").trim();
      if (!url) {
        return '<div class="home-news-item__media">' + homeNewsPlaceholderHtml() + "</div>";
      }
      const thumb = homeNewsThumbUrl(url);
      return (
        '<div class="home-news-item__media">' +
        '<img class="home-news-item__img" src="' + escapeHtml(thumb) + '" alt="" loading="lazy" decoding="async" width="96" height="72" ' +
        'onerror="this.onerror=null;window.__applyNewsPlaceholderImg&&window.__applyNewsPlaceholderImg(this);" />' +
        "</div>"
      );
    }

    function renderHomeNewsItemMarkup(item, expanded) {
      const title = escapeHtml(item.title || "Untitled");
      const src = escapeHtml(item.source || "News");
      const when = formatNewsDate(item.pub_date);
      const summaryText = expanded ? (item.summary_full || item.summary || "") : (item.summary || "");
      const summary = summaryText
        ? `<p class="home-news-item__summary">${escapeHtml(summaryText)}</p>`
        : "";
      const link = String(item.link || "").trim();
      const itemClass = "home-news-item" + (expanded ? " home-news-expand-item" : "");
      const inner =
        homeNewsMediaHtml(item.image_url) +
        '<div class="home-news-item__content">' +
        '<div class="home-news-item__meta">' +
        '<span class="home-news-item__badge">' + src + "</span>" +
        (when ? "<span>" + escapeHtml(when) + "</span>" : "") +
        "</div>" +
        '<p class="home-news-item__title">' + title + "</p>" +
        summary +
        "</div>";
      if (link) {
        return (
          '<a class="' + itemClass + '" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">' +
          inner +
          "</a>"
        );
      }
      return '<article class="' + itemClass + '">' + inner + "</article>";
    }

    var HOME_NEWS_HOME_PREVIEW_COUNT = 6;
    var HOME_WYD_PREVIEW_COUNT = 3;
    var HOME_NEWS_EXPAND_COLS = 3;
    var HOME_NEWS_EXPAND_ROWS = 5;
    var HOME_NEWS_EXPAND_PAGE_SIZE = HOME_NEWS_EXPAND_COLS * HOME_NEWS_EXPAND_ROWS;
    var HOME_NEWS_MAX_AGE_DAYS = 3;
    var EMIL_STAGGER_STEP_MS = 42;

    function homeNewsSkeletonHtml(count) {
      const n = count || 6;
      return Array.from({ length: n }, () => (
        "<li class=\"home-news-item home-news-item--skeleton\" aria-hidden=\"true\">" +
        "<div class=\"home-news-item__media emil-skeleton\"></div>" +
        "<div class=\"home-news-item__content\">" +
        "<div class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-sm\"></div>" +
        "<div class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-lg\"></div>" +
        "<div class=\"emil-skeleton emil-skeleton--line\"></div>" +
        "</div></li>"
      )).join("");
    }

    function massSongPlanSkeletonHtml(count) {
      const n = count || Math.max(5, lyricSongSlots.length || 5);
      return Array.from({ length: n }, () => (
        "<article class=\"mass-song-plan-card mass-song-plan-card--skeleton\" aria-hidden=\"true\">" +
        "<div class=\"mass-song-plan-card__row\">" +
        "<span class=\"emil-skeleton emil-skeleton--drag\"></span>" +
        "<span class=\"emil-skeleton emil-skeleton--num\"></span>" +
        "<div class=\"mass-song-plan-card__core\">" +
        "<div class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-lg\"></div>" +
        "<div class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-sm\"></div>" +
        "</div></div></article>"
      )).join("");
    }

    function revealStaggerChildren(container, itemSelector) {
      if (!container || !itemSelector) return;
      const items = container.querySelectorAll(itemSelector);
      if (!items.length) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      items.forEach((el, i) => {
        if (reduced) return;
        el.classList.add("emil-stagger-enter");
        el.style.animationDelay = (i * EMIL_STAGGER_STEP_MS) + "ms";
      });
      if (reduced) return;
      const totalMs = 200 + items.length * EMIL_STAGGER_STEP_MS + 80;
      window.setTimeout(() => {
        items.forEach((el) => {
          el.classList.remove("emil-stagger-enter");
          el.style.animationDelay = "";
        });
      }, totalMs);
    }

    function massMoodPickSkeletonHtml(count) {
      const n = count || 5;
      return Array.from({ length: n }, () => (
        "<li class=\"mass-summary-mood-pick mass-summary-mood-pick--skeleton\" aria-hidden=\"true\">" +
        "<span class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-sm\"></span>" +
        "<span class=\"emil-skeleton emil-skeleton--line emil-skeleton--line-lg\"></span>" +
        "</li>"
      )).join("");
    }

    async function runEmilRefresh(opts) {
      const container = opts && opts.container;
      const trigger = opts && opts.trigger;
      const contentEl = opts && opts.contentEl;
      if (!contentEl || typeof opts.task !== "function") return;
      if (container) container.classList.add("is-refreshing");
      contentEl.setAttribute("aria-busy", "true");
      if (trigger) {
        trigger.classList.add("is-loading");
        trigger.disabled = true;
      }
      if (opts.skeletonHtml) contentEl.innerHTML = opts.skeletonHtml;
      try {
        const result = await opts.task();
        if (typeof opts.reveal === "function") opts.reveal(result);
        if (opts.staggerSelector) revealStaggerChildren(contentEl, opts.staggerSelector);
      } finally {
        if (container) container.classList.remove("is-refreshing");
        contentEl.setAttribute("aria-busy", "false");
        if (trigger) {
          trigger.classList.remove("is-loading");
          trigger.disabled = false;
        }
      }
    }

    function setMassSongPlanRefreshing(active) {
      const plan = $("mass-song-plan");
      if (!plan) return;
      plan.classList.toggle("is-refreshing", !!active);
      plan.setAttribute("aria-busy", active ? "true" : "false");
      if (active) {
        plan.innerHTML = massSongPlanSkeletonHtml();
      }
    }

    function setHomeNewsRefreshing(active) {
      const panel = $("home-news-panel");
      const list = $("home-news-list");
      if (panel) panel.classList.toggle("is-refreshing", !!active);
      if (list) list.setAttribute("aria-busy", active ? "true" : "false");
    }

    async function fetchCatholicNewsPage(limit, offset, maxAgeDays, sources) {
      const prefs = getHomeNewsPrefs();
      const wantVatican = sources ? !!sources.vatican : prefs.vatican;
      const wantCna = sources ? !!sources.cna : prefs.cna;
      const params = new URLSearchParams({
        vatican: wantVatican ? "true" : "false",
        cna: wantCna ? "true" : "false",
        limit: String(limit),
        offset: String(offset),
        max_age_days: String(maxAgeDays != null ? maxAgeDays : HOME_NEWS_MAX_AGE_DAYS),
      });
      const res = await fetch("/api/catholic-news?" + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not load news.");
      return data;
    }

    var homeNewsExpandState = {
      offset: 0,
      loading: false,
      hasMore: true,
    };

    async function refreshNewsCard() {
      const panel = $("home-news-panel");
      const list = $("home-news-list");
      const status = $("home-news-status");
      if (!panel || !list) return;
      const prefs = getHomeNewsPrefs();
      if (!prefs.enabled || (!prefs.vatican && !prefs.cna)) {
        panel.hidden = true;
        list.innerHTML = "";
        if (status) status.textContent = "";
        return;
      }
      panel.hidden = false;
      list.setAttribute("aria-busy", "true");
      list.innerHTML = homeNewsSkeletonHtml(HOME_NEWS_HOME_PREVIEW_COUNT);
      if (status) status.textContent = "Refreshing headlines…";
      try {
        const sources = { vatican: !!prefs.vatican, cna: !!prefs.cna };
        const data = await fetchCatholicNewsPage(HOME_NEWS_HOME_PREVIEW_COUNT, 0, HOME_NEWS_MAX_AGE_DAYS, sources);
        const items = (data.items || []).slice(0, HOME_NEWS_HOME_PREVIEW_COUNT);
        if (!items.length) {
          list.innerHTML = "";
          if (status) {
            status.textContent = (data.errors && data.errors.length)
              ? "News temporarily unavailable."
              : "No headlines right now.";
          }
          return;
        }
        list.innerHTML = items.map((item) => (
          "<li>" + renderHomeNewsItemMarkup(item, false) + "</li>"
        )).join("");
        revealStaggerChildren(list, ":scope > li");
        if (status) {
          status.textContent = (data.errors && data.errors.length)
            ? "Some headlines unavailable · tap to browse all"
            : "Tap to browse all";
        }
      } catch (e) {
        list.innerHTML = "";
        if (status) status.textContent = e.message || "Could not load Catholic news.";
      } finally {
        list.setAttribute("aria-busy", "false");
      }
    }

    var homeNewsLastRefreshAt = 0;
    var wydNewsLastRefreshAt = 0;
    var HOME_NEWS_STALE_MS = 5 * 60 * 1000;

    async function refreshCatholicNews(force) {
      const prefs = getHomeNewsPrefs();
      if (!prefs.enabled) {
        const panel = $("home-news-panel");
        if (panel) panel.hidden = true;
        return;
      }
      const now = Date.now();
      if (!force && homeNewsLastRefreshAt && now - homeNewsLastRefreshAt < HOME_NEWS_STALE_MS) return;
      homeNewsLastRefreshAt = now;
      const refreshBtn = $("btn-home-news-refresh");
      if (refreshBtn) refreshBtn.classList.add("is-loading");
      setHomeNewsRefreshing(true);
      try {
        await refreshNewsCard();
      } finally {
        setHomeNewsRefreshing(false);
        if (refreshBtn) refreshBtn.classList.remove("is-loading");
      }
    }

    var HEADER_TICKER_ROTATE_MS = 6000;
    var HEADER_TICKER_HOLD_MS = 2200;
    var HEADER_TICKER_HOLD_END_MS = 1400;
    var HEADER_TICKER_SCROLL_PX_PER_SEC = 36;
    var headerTickerItems = [];
    var headerTickerIndex = 0;
    var headerTickerAdvanceTimer = null;
    var headerTickerScrollTimer = null;

    function clearHeaderTickerTimers() {
      if (headerTickerAdvanceTimer) {
        window.clearTimeout(headerTickerAdvanceTimer);
        headerTickerAdvanceTimer = null;
      }
      if (headerTickerScrollTimer) {
        window.clearTimeout(headerTickerScrollTimer);
        headerTickerScrollTimer = null;
      }
    }

    function resetHeaderTickerTrack() {
      const root = $("app-header-ticker");
      const track = $("app-header-ticker-track");
      if (!track) return;
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      if (root) root.classList.remove("is-marquee");
    }

    function setupHeaderTickerCycle() {
      const root = $("app-header-ticker");
      const viewport = root && root.querySelector(".app-header__ticker-viewport");
      const track = $("app-header-ticker-track");
      const textEl = $("app-header-ticker-text");
      if (!root || !viewport || !track || !textEl || !headerTickerItems.length) return;
      if (document.hidden) return;

      clearHeaderTickerTimers();
      resetHeaderTickerTrack();

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const canRotate = headerTickerItems.length >= 2;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          root.classList.add("is-marquee");
          const overflow = Math.ceil(textEl.scrollWidth - viewport.clientWidth);
          let totalDelay = HEADER_TICKER_ROTATE_MS;

          if (overflow > 6 && !reduce) {
            const scrollMs = Math.max(2800, Math.round((overflow / HEADER_TICKER_SCROLL_PX_PER_SEC) * 1000));
            totalDelay = HEADER_TICKER_HOLD_MS + scrollMs + HEADER_TICKER_HOLD_END_MS;
            headerTickerScrollTimer = window.setTimeout(() => {
              track.style.transition = "transform " + scrollMs + "ms linear";
              track.style.transform = "translateX(-" + overflow + "px)";
            }, HEADER_TICKER_HOLD_MS);
          } else {
            root.classList.remove("is-marquee");
          }

          if (!canRotate && overflow <= 6) return;

          headerTickerAdvanceTimer = window.setTimeout(() => {
            if (canRotate) advanceHeaderTicker();
            else setupHeaderTickerCycle();
          }, totalDelay);
        });
      });
    }

    var TICKER_SEASON_ACCENTS = {
      ordinary: "#22c55e",
      advent: "#8b5cf6",
      christmas: "#f59e0b",
      lent: "#a78bfa",
      easter: "#eab308",
    };

    function normalizeTickerAccentHex(hex) {
      const raw = String(hex || "").trim().replace(/^#/, "");
      if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "";
      return "#" + raw.toLowerCase();
    }

    function resolveTickerSeasonAccent() {
      const preset = window.__liturgicalPresetId || "ordinary";
      return TICKER_SEASON_ACCENTS[preset] || TICKER_SEASON_ACCENTS.ordinary;
    }

    function resolveTickerSeasonKicker() {
      return "Season";
    }

    function isLiturgyTickerItem(item) {
      return !!(item && (item.isLiturgy || item.kicker === "Season" || item.kicker === "Liturgy"));
    }

    function applyHeaderTickerSeasonStyle(root, isLiturgy) {
      if (!root) return;
      root.classList.toggle("is-liturgy", !!isLiturgy);
      if (isLiturgy) {
        const accent = resolveTickerSeasonAccent();
        root.style.setProperty("--ticker-season-accent", accent);
        root.style.setProperty("--ticker-season-on-accent", typeof onAccentColor === "function" ? onAccentColor(accent) : "#fff");
      } else {
        root.style.removeProperty("--ticker-season-accent");
        root.style.removeProperty("--ticker-season-on-accent");
      }
    }

    function buildLiturgicalTickerItem() {
      const seasonEl = $("home-liturgical-season");
      const yearEl = $("home-liturgical-year");
      const season = seasonEl && seasonEl.textContent ? seasonEl.textContent.trim() : "";
      const year = yearEl && yearEl.textContent ? yearEl.textContent.trim() : "";
      if (!season) return null;
      const text = year ? season + " · " + year : season;
      return { kicker: resolveTickerSeasonKicker(), text: text, href: "/mass/calendar", external: false, isLiturgy: true };
    }

    function renderHeaderTickerFrame() {
      const root = $("app-header-ticker");
      const kicker = $("app-header-ticker-kicker");
      const textEl = $("app-header-ticker-text");
      if (!root || !kicker || !textEl || !headerTickerItems.length) return;
      resetHeaderTickerTrack();
      const item = headerTickerItems[headerTickerIndex % headerTickerItems.length];
      const href = item.href || "#";
      kicker.textContent = item.kicker;
      textEl.textContent = item.text;
      applyHeaderTickerSeasonStyle(root, !!item.isLiturgy);
      root.setAttribute("href", href);
      if (item.external) {
        root.setAttribute("target", "_blank");
        root.setAttribute("rel", "noopener noreferrer");
        root.setAttribute("aria-label", item.kicker + ": " + item.text + " (opens in new tab)");
      } else {
        root.removeAttribute("target");
        root.removeAttribute("rel");
        root.setAttribute("aria-label", item.kicker + ": " + item.text);
      }
    }

    function syncHeaderTickerLiturgy() {
      const root = $("app-header-ticker");
      if (!root) return;
      const lit = buildLiturgicalTickerItem();
      if (!lit) return;
      const idx = headerTickerItems.findIndex((i) => isLiturgyTickerItem(i));
      if (idx >= 0) headerTickerItems[idx] = lit;
      else headerTickerItems.unshift(lit);
      if (root.hidden) {
        root.hidden = false;
        renderHeaderTickerFrame();
        startHeaderTicker();
      } else if (headerTickerItems.length === 1) {
        renderHeaderTickerFrame();
        startHeaderTicker();
      }
    }

    function advanceHeaderTicker() {
      const root = $("app-header-ticker");
      if (!root || headerTickerItems.length < 2) return;
      clearHeaderTickerTimers();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      headerTickerIndex = (headerTickerIndex + 1) % headerTickerItems.length;
      if (reduce) {
        renderHeaderTickerFrame();
        setupHeaderTickerCycle();
        return;
      }
      root.classList.add("is-swapping");
      window.setTimeout(() => {
        renderHeaderTickerFrame();
        root.classList.remove("is-swapping");
        setupHeaderTickerCycle();
      }, 320);
    }

    function stopHeaderTicker() {
      clearHeaderTickerTimers();
    }

    function startHeaderTicker() {
      stopHeaderTicker();
      if (!headerTickerItems.length) return;
      if (document.hidden) return;
      setupHeaderTickerCycle();
    }

    async function refreshHeaderTicker() {
      const root = $("app-header-ticker");
      if (!root) return;
      const items = [];
      const litItem = buildLiturgicalTickerItem();
      if (litItem) items.push(litItem);
      try {
        const prefs = getHomeNewsPrefs();
        if (prefs.enabled && (prefs.vatican || prefs.cna)) {
          const data = await fetchCatholicNewsPage(8, 0, HOME_NEWS_MAX_AGE_DAYS, null);
          (data.items || []).slice(0, 8).forEach((it) => {
            if (!it || !it.title) return;
            const link = String(it.link || it.url || "").trim();
            if (!link) return;
            const src = (it.source || "").toLowerCase();
            const kicker = src.indexOf("vatican") >= 0 ? "Vatican"
              : src.indexOf("cna") >= 0 || src.indexOf("catholic news") >= 0 ? "CNA"
              : "News";
            items.push({ kicker: kicker, text: it.title, href: link, external: true });
          });
        }
      } catch (_e) { /* news optional; liturgy line still shows */ }
      headerTickerItems = items;
      headerTickerIndex = 0;
      if (!items.length) {
        root.hidden = true;
        stopHeaderTicker();
        return;
      }
      root.hidden = false;
      renderHeaderTickerFrame();
      startHeaderTicker();
    }

    function initHeaderTicker() {
      const root = $("app-header-ticker");
      if (!root) return;
      root.addEventListener("mouseenter", stopHeaderTicker);
      root.addEventListener("focus", stopHeaderTicker);
      root.addEventListener("mouseleave", startHeaderTicker);
      root.addEventListener("blur", startHeaderTicker);
      root.addEventListener("click", (e) => {
        const href = root.getAttribute("href");
        if (!href || href === "#") { e.preventDefault(); return; }
        if (!root.hasAttribute("target")) {
          e.preventDefault();
          showRoute(href);
        }
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopHeaderTicker();
        else startHeaderTicker();
      });
      refreshHeaderTicker();
    }

    function closeHomeNewsExpandModal() {
      const modal = $("home-news-expand-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (!$("home-event-modal") || !$("home-event-modal").classList.contains("is-open")) {
        if (!$("reading-expand-modal") || !$("reading-expand-modal").classList.contains("is-open")) {
          document.body.style.overflow = "";
        }
      }
    }

    function setHomeNewsExpandFoot(message) {
      const foot = $("home-news-expand-foot");
      if (foot) foot.textContent = message || "";
    }

    function homeNewsExpandFootMessage(data, append) {
      const total = data.total != null ? data.total : 0;
      const age = data.max_age_days || HOME_NEWS_MAX_AGE_DAYS;
      const ageLabel = "the last " + age + " day" + (age === 1 ? "" : "s");
      if (!append && total === 0) {
        return "No headlines from " + ageLabel + ".";
      }
      if (data.has_more) {
        return "Showing headlines from " + ageLabel + " · scroll down for more";
      }
      return "All headlines from " + ageLabel + " loaded (" + total + ").";
    }

    async function loadHomeNewsExpandPage(append) {
      const list = $("home-news-expand-list");
      if (!list || homeNewsExpandState.loading) return;
      homeNewsExpandState.loading = true;
      setHomeNewsExpandFoot("Loading headlines…");
      try {
        const data = await fetchCatholicNewsPage(
          HOME_NEWS_EXPAND_PAGE_SIZE,
          homeNewsExpandState.offset,
          HOME_NEWS_MAX_AGE_DAYS
        );
        const items = data.items || [];
        homeNewsExpandState.hasMore = !!data.has_more;
        homeNewsExpandState.offset += items.length;
        const html = items.map((item) => (
          "<li>" + renderHomeNewsItemMarkup(item, true) + "</li>"
        )).join("");
        if (append) list.insertAdjacentHTML("beforeend", html);
        else list.innerHTML = html;
        setHomeNewsExpandFoot(homeNewsExpandFootMessage(data, append));
      } catch (e) {
        setHomeNewsExpandFoot(e.message || "Could not load news.");
      } finally {
        homeNewsExpandState.loading = false;
      }
    }

    async function openHomeNewsExpandModal() {
      const modal = $("home-news-expand-modal");
      const scroll = $("home-news-expand-scroll");
      if (!modal) return;
      homeNewsExpandState.offset = 0;
      homeNewsExpandState.hasMore = true;
      homeNewsExpandState.loading = false;
      syncHomeNewsExpandModalWidth();
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      await loadHomeNewsExpandPage(false);
      syncHomeNewsExpandModalWidth();
      if (scroll) scroll.scrollTop = 0;
    }

    function syncHomeNewsExpandModalWidth() {
      const panel = document.querySelector(".home-bento-grid") || $("home-news-panel");
      const card = document.querySelector("#home-news-expand-modal .ui-card--news-expand");
      if (!panel || !card || panel.hidden) return;
      const panelWidth = panel.getBoundingClientRect().width;
      if (panelWidth <= 0) return;
      const overlay = $("home-news-expand-modal");
      const overlayStyle = overlay ? getComputedStyle(overlay) : null;
      const padX = overlayStyle
        ? (parseFloat(overlayStyle.paddingLeft) || 0) + (parseFloat(overlayStyle.paddingRight) || 0)
        : 32;
      const maxWidth = Math.max(280, window.innerWidth - padX);
      card.style.width = Math.min(panelWidth, maxWidth) + "px";
    }

    function initHomeNewsExpandModal() {
      const modal = $("home-news-expand-modal");
      const backdrop = $("home-news-expand-backdrop");
      const closeBtn = $("home-news-expand-close");
      const scroll = $("home-news-expand-scroll");
      const panels = Array.from(document.querySelectorAll(".home-news-panel"));
      const refreshBtn = $("btn-home-news-refresh");

      if (backdrop) backdrop.addEventListener("click", closeHomeNewsExpandModal);
      if (closeBtn) closeBtn.addEventListener("click", closeHomeNewsExpandModal);

      if (scroll) {
        scroll.addEventListener("scroll", () => {
          if (!modal || !modal.classList.contains("is-open")) return;
          if (!homeNewsExpandState.hasMore || homeNewsExpandState.loading) return;
          const nearBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 120;
          if (nearBottom) loadHomeNewsExpandPage(true);
        });
      }

      if (refreshBtn) {
        refreshBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          refreshCatholicNews(true);
        });
      }

      panels.forEach((panel) => {
        panel.querySelectorAll(".home-news-panel__expand-zone").forEach((zone) => {
          zone.addEventListener("click", (e) => {
            if (e.target.closest("#btn-home-news-refresh, button, a, input, select, textarea, label")) return;
            openHomeNewsExpandModal();
          });
        });
        panel.addEventListener("click", (e) => {
          if (e.target.closest(".home-news-item, #btn-home-news-refresh, button, a, input, select, textarea, label")) return;
          if (e.target.closest(".home-news-panel__expand-zone")) return;
          openHomeNewsExpandModal();
        });
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && modal.classList.contains("is-open")) {
          closeHomeNewsExpandModal();
        }
      });

      window.addEventListener("resize", () => {
        if (modal && modal.classList.contains("is-open")) {
          syncHomeNewsExpandModalWidth();
        }
      });
    }

    function bindHomeNewsSettings() {
      syncHomeNewsSettingsUI();
      const en = $("settings-home-news-enabled");
      const va = $("settings-home-news-vatican");
      const cna = $("settings-home-news-cna");
      const onChange = () => {
        const prefs = {
          enabled: en ? en.checked : true,
          vatican: va ? va.checked : true,
          cna: cna ? cna.checked : true,
        };
        if (!prefs.enabled) {
          prefs.vatican = va ? va.checked : true;
          prefs.cna = cna ? cna.checked : true;
        }
        saveHomeNewsPrefs(prefs);
        syncHomeNewsSettingsUI();
        if (normalizeRoute(window.location.pathname) === "/home") refreshCatholicNews(true);
      };
      if (en) en.addEventListener("change", onChange);
      if (va) va.addEventListener("change", onChange);
      if (cna) cna.addEventListener("change", onChange);
    }
    var VISUAL_STYLE_STORAGE_KEY = "verbumVisualStyle";

    function hexToRgb(hex) {
      const raw = String(hex || "").replace("#", "").trim();
      const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
      if (h.length !== 6) return null;
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function mixHex(hex, amount, target = 255) {
      const rgb = hexToRgb(hex);
      if (!rgb) return hex;
      const mix = (c) => Math.round(c + (target - c) * amount);
      const toHex = (v) => v.toString(16).padStart(2, "0");
      return "#" + toHex(mix(rgb.r)) + toHex(mix(rgb.g)) + toHex(mix(rgb.b));
    }

    function relativeLuminance(hex) {
      const rgb = hexToRgb(hex);
      if (!rgb) return 0;
      const chan = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
    }

    function onAccentColor(hex) {
      return relativeLuminance(hex) > 0.42 ? "#1A1528" : "#FFFFFF";
    }

    function readStoredUserAccent() {
      try {
        const v = localStorage.getItem(ACCENT_STORAGE_KEY);
        return v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null;
      } catch (_e) {
        return null;
      }
    }

    function syncAccentSwatchUI(hex) {
      document.querySelectorAll(".accent-swatch").forEach((btn) => {
        const match = hex && btn.dataset.accent && btn.dataset.accent.toLowerCase() === hex.toLowerCase();
        const isDefault = !hex && btn.dataset.accentDefault === "1";
        btn.classList.toggle("active", !!match || isDefault);
      });
      const picker = $("app-accent-color");
      if (picker && hex) picker.value = hex;
    }

    /** App icon accent — default app chrome, not season-driven. */
    var APP_ICON_ACCENT_PALETTE = {
      light: { accent: "#a10f0d", glow: "#b91c1c", secondary: "#788898" },
      dark: { accent: "#a10f0d", glow: "#b91c1c", secondary: "#788898" },
    };

    function resolveAppIconAccentPalette() {
      const mode = resolveColorTheme() === "dark" ? "dark" : "light";
      return APP_ICON_ACCENT_PALETTE[mode];
    }

    function resetAppAccentToDefault() {
      clearUserAccentOverrides();
      const palette = resolveAppIconAccentPalette();
      const picker = $("app-accent-color");
      if (picker && palette) picker.value = palette.accent;
      syncAccentSwatchUI(null);
    }

    function clearUserAccentOverrides() {
      const body = document.body;
      body.removeAttribute("data-user-accent");
      ["--liturgical-accent", "--liturgical-glow", "--liturgical-secondary", "--accent", "--on-accent"].forEach((prop) => {
        body.style.removeProperty(prop);
      });
      try { localStorage.removeItem(ACCENT_STORAGE_KEY); } catch (_e) { /* ignore */ }
      syncAccentSwatchUI(null);
    }

    function followLiturgicalSeasonAccent() {
      resetAppAccentToDefault();
    }

    function applyUserAccent(hex, persist = true) {
      const body = document.body;
      if (!hex || !hexToRgb(hex)) {
        clearUserAccentOverrides();
        if (!persist) {
          try { localStorage.removeItem(ACCENT_STORAGE_KEY); } catch (_e) { /* ignore */ }
        }
        return;
      }
      const glow = mixHex(hex, 0.38, 255);
      const secondary = mixHex(hex, 0.2, 0);
      body.setAttribute("data-user-accent", "1");
      body.style.setProperty("--liturgical-accent", hex);
      body.style.setProperty("--liturgical-glow", glow);
      body.style.setProperty("--liturgical-secondary", secondary);
      body.style.setProperty("--accent", hex);
      body.style.setProperty("--on-accent", onAccentColor(hex));
      if (persist) {
        try { localStorage.setItem(ACCENT_STORAGE_KEY, hex); } catch (_e) { /* ignore */ }
      }
      syncAccentSwatchUI(hex);
    }

    function applyVisualStyle(_styleId, persist = true) {
      const style = "parchment";
      document.documentElement.setAttribute("data-visual-style", style);
      if (persist) {
        try { localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, style); } catch (_e) { /* ignore */ }
      }
    }

    function initAppearanceSettings() {
      applyVisualStyle("parchment", false);
      const storedAccent = readStoredUserAccent();
      if (storedAccent) applyUserAccent(storedAccent, false);
      else {
        resetAppAccentToDefault();
      }

      document.querySelectorAll(".accent-swatch").forEach((btn) => {
        btn.addEventListener("click", () => {
          const hex = btn.dataset.accent;
          const glow = btn.dataset.accentGlow;
          if (!hex) return;
          applyUserAccent(hex);
          if (glow) document.body.style.setProperty("--liturgical-glow", glow);
        });
      });
      const accentPicker = $("app-accent-color");
      if (accentPicker) {
        accentPicker.addEventListener("input", () => applyUserAccent(accentPicker.value));
      }
      const resetAccent = $("btn-reset-accent");
      if (resetAccent) {
        resetAccent.addEventListener("click", () => {
          resetAppAccentToDefault();
        });
      }
    }

    function getToggleDarkPreference() {
      try {
        const v = localStorage.getItem(TOGGLE_DARK_STORAGE_KEY);
        return v === "oled" ? "oled" : "dark";
      } catch (_e) {
        return "dark";
      }
    }

    function setToggleDarkPreference(value) {
      const pref = value === "oled" ? "oled" : "dark";
      try { localStorage.setItem(TOGGLE_DARK_STORAGE_KEY, pref); } catch (_e) { /* ignore */ }
      syncToggleDarkPreferenceUI(pref);
      const resolved = document.documentElement.getAttribute("data-theme") || "light";
      if (resolved !== "dark") syncColorThemeUI(null, resolved);
    }

    function syncToggleDarkPreferenceUI(pref) {
      const mode = pref || getToggleDarkPreference();
      document.querySelectorAll('input[name="toggle-dark-preference"]').forEach((inp) => {
        inp.checked = inp.value === mode;
      });
    }

    function resolveColorTheme(preference) {
      let pref = preference;
      if (pref == null) {
        try { pref = localStorage.getItem(THEME_STORAGE_KEY) || "system"; } catch (_e) { pref = "system"; }
      }
      if (pref === "dark" || pref === "oled") return "dark";
      if (pref === "light") return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function syncColorThemeUI(preference, resolved) {
      const pref = preference || document.documentElement.getAttribute("data-theme-preference") || "system";
      const btn = $("theme-toggle-btn");
      if (btn) {
        const isDark = resolved === "dark";
        const toggleDark = getToggleDarkPreference();
        const darkLabel = toggleDark === "oled" ? "Switch to OLED mode" : "Switch to dark mode";
        btn.setAttribute("aria-pressed", isDark ? "true" : "false");
        btn.setAttribute("aria-label", isDark ? "Switch to light mode" : darkLabel);
        btn.title = isDark ? "Switch to light mode" : darkLabel;
      }
      const accountThemeLabel = $("account-theme-toggle-label");
      if (accountThemeLabel) {
        const isDark = resolved === "dark";
        const toggleDark = getToggleDarkPreference();
        accountThemeLabel.textContent = isDark
          ? "Light mode"
          : (toggleDark === "oled" ? "OLED mode" : "Dark mode");
      }
      document.querySelectorAll('input[name="theme-preference"]').forEach((inp) => {
        inp.checked = inp.value === pref;
      });
      syncToggleDarkPreferenceUI();
    }

    function applyColorTheme(preference) {
      let pref = preference;
      if (pref == null) {
        try { pref = localStorage.getItem(THEME_STORAGE_KEY) || "system"; } catch (_e) { pref = "system"; }
      }
      try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch (_e) { /* ignore */ }
      const resolved = resolveColorTheme(pref);
      document.documentElement.setAttribute("data-theme", resolved);
      document.documentElement.setAttribute("data-theme-preference", pref);
      if (pref === "oled") {
        document.documentElement.setAttribute("data-dark-variant", "oled");
      } else {
        document.documentElement.removeAttribute("data-dark-variant");
      }
      syncColorThemeUI(pref, resolved);
      if (typeof refreshHomeNewsPlaceholders === "function") refreshHomeNewsPlaceholders();
      return resolved;
    }

    function initColorTheme() {
      initAppearanceSettings();
      applyColorTheme();
      const btn = $("theme-toggle-btn");
      if (btn) {
        btn.addEventListener("click", () => {
          const resolved = document.documentElement.getAttribute("data-theme") || "light";
          applyColorTheme(resolved === "dark" ? "light" : getToggleDarkPreference());
        });
      }
      const accountThemeBtn = $("account-theme-toggle");
      if (accountThemeBtn) {
        accountThemeBtn.addEventListener("click", () => {
          const resolved = document.documentElement.getAttribute("data-theme") || "light";
          applyColorTheme(resolved === "dark" ? "light" : getToggleDarkPreference());
          closeHeaderMenus();
        });
      }
      document.querySelectorAll('input[name="theme-preference"]').forEach((inp) => {
        inp.addEventListener("change", () => {
          if (inp.checked) applyColorTheme(inp.value);
        });
      });
      document.querySelectorAll('input[name="toggle-dark-preference"]').forEach((inp) => {
        inp.addEventListener("change", () => {
          if (inp.checked) setToggleDarkPreference(inp.value);
        });
      });
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
          const pref = document.documentElement.getAttribute("data-theme-preference") || "system";
          if (pref === "system") applyColorTheme("system");
        });
      } catch (_e) { /* ignore */ }
    }

    var routeMeta = {
      "/home": "Mission control for the upcoming Sunday Mass.",
      "/notifications": "Liturgical season and app notifications.",
      "/mass/builder": "Assemble songs, timeline, and generate the full package.",
      "/mass/calendar": "Monthly liturgical view with readings context.",
      "/radio": "EWTN 24/7 Catholic radio while you plan.",
      "/media/posters": "Poster and social graphic configuration.",
      "/media/history": "Recent downloads from this browser.",
      "/library/songs": "Song library and lyrics structuring.",
      "/library/collections": "Song collections for seasons and events.",
      "/design/theme-lab": "Liturgical themes and custom slide styling.",
      "/design/templates": "Poster and slide template reference.",
      "/settings/account": "Your profile picture and account details.",
      "/settings/church": "Community name and parish logo.",
      "/settings/team": "Invite and manage your parish media team.",
      "/settings/app": "Light/dark mode, accent colors, and visual style.",
      "/superadmin": "Platform mission control — superadmin only.",
    };

    var routeBreadcrumb = {
      "/home": ["Home"],
      "/notifications": ["Notifications"],
      "/mass/builder": ["Mass", "Builder"],
      "/mass/calendar": ["Mass", "Calendar"],
      "/media/posters": ["Posters", "Create"],
      "/media/history": ["Posters", "History"],
      "/radio": ["Media"],
      "/library/songs": ["Lyrics Library", "Songs"],
      "/library/collections": ["Lyrics Library", "Collections"],
      "/design/theme-lab": ["Design", "Theme Lab"],
      "/design/templates": ["Design", "Templates"],
      "/settings/account": ["Settings", "Account"],
      "/settings/church": ["Settings", "Church Profile"],
      "/settings/team": ["Settings", "Parish Team"],
      "/settings/app": ["Settings", "Appearance"],
      "/superadmin": ["Superadmin"],
    };

    function formatRouteBreadcrumb(route) {
      const parts = routeBreadcrumb[route] || ["Home"];
      if (parts.length === 1) return parts[0];
      return parts[0] + ' <span aria-hidden="true">›</span> <span>' + parts[1] + "</span>";
    }

    function applyLiturgicalSeasonTheme(seasonStr, liturgicalColor) {
      window.__liturgicalSeasonRaw = String(seasonStr || "");
      const preset = liturgicalPresetIdFromSeason(seasonStr || "");
      document.body.setAttribute("data-season", preset || "ordinary");
      window.__liturgicalPresetId = preset || "ordinary";
      window.__liturgicalColorHex = normalizeTickerAccentHex(liturgicalColor && liturgicalColor.hex);
      const seasonEl = $("home-liturgical-season");
      if (seasonEl) {
        seasonEl.textContent = formatLiturgicalSeasonLabel(seasonStr || "");
      }
      applyLiturgicalIndicatorStyle(preset, liturgicalColor);
      if (typeof syncNotificationsAccordionHeader === "function") syncNotificationsAccordionHeader();
      const ticker = $("app-header-ticker");
      if (ticker && ticker.classList.contains("is-liturgy")) {
        const accent = resolveTickerSeasonAccent();
        ticker.style.setProperty("--ticker-season-accent", accent);
        ticker.style.setProperty("--ticker-season-on-accent", typeof onAccentColor === "function" ? onAccentColor(accent) : "#fff");
        const kickerEl = $("app-header-ticker-kicker");
        if (kickerEl) kickerEl.textContent = "Season";
      }
      if (typeof syncHeaderTickerLiturgy === "function") {
        const litIdx = headerTickerItems && headerTickerItems.findIndex((i) => isLiturgyTickerItem(i));
        if (litIdx >= 0) {
          const lit = buildLiturgicalTickerItem();
          if (lit) headerTickerItems[litIdx] = lit;
        }
      }
    }

    var legacyRoutes = {
      "/today": "/notifications",
      "/lyrics-dashboard": "/library/songs",
      "/theme-dashboard": "/design/theme-lab",
      "/mass-flow-dashboard": "/mass/builder",
      "/media/presentation": "/mass/builder",
    };

    var EMAIL_DEEPLINK_STORE_KEY = "verbum:email-deeplink";
    (function captureEmailDeepLinkEarly() {
      try {
        const params = new URLSearchParams(window.location.search);
        const intent = (params.get("intent") || "").trim().toLowerCase();
        const date = (params.get("date") || "").trim();
        const handoff = (params.get("handoff") || "").trim();
        if (intent === "practice-share" || intent === "generate" || intent === "practice-lyrics") {
          sessionStorage.setItem(
            EMAIL_DEEPLINK_STORE_KEY,
            JSON.stringify({ intent: intent, date: date, handoff: handoff })
          );
        }
      } catch (_e) { /* ignore */ }
    })();

    var rawPathInit = window.location.pathname;
    if (legacyRoutes[rawPathInit]) {
      history.replaceState({}, "", legacyRoutes[rawPathInit]);
    } else if (rawPathInit === "/" || rawPathInit === "") {
      history.replaceState({}, "", "/home");
    }

    function normalizeRoute(path) {
      if (legacyRoutes[path]) return legacyRoutes[path];
      if (path === "/" || path === "") return "/home";
      if (path === "/media/presentation") return "/mass/builder";
      return path;
    }

    function currentRoute() {
      const path = normalizeRoute(window.location.pathname);
      return routeMeta[path] ? path : "/home";
    }

    function navLinkIsActive(link, route) {
      const exact = link.dataset.route;
      if (exact && route === exact) return true;
      const prefix = link.dataset.routePrefix;
      if (prefix && route.startsWith(prefix)) {
        const exclude = link.dataset.routeExclude;
        if (exclude && route === exclude) return false;
        return true;
      }
      return false;
    }

    function isDrawerNavRoute(route) {
      if (route === "/radio") return true;
      if (route === "/mass/calendar") return true;
      if (route.startsWith("/design/")) return true;
      if (route.startsWith("/media/")) return true;
      if (route === "/library/collections") return true;
      if (route === "/media/history") return true;
      return false;
    }

    function isMoreNavRoute(route) {
      return isDrawerNavRoute(route);
    }

    function closeAppMoreSheet() {
      const sheet = $("app-more-sheet");
      const btn = $("app-bottom-nav-more");
      if (sheet) {
        sheet.classList.remove("is-open");
        sheet.setAttribute("aria-hidden", "true");
      }
      if (btn) btn.setAttribute("aria-expanded", "false");
      const anyOverlayOpen = document.querySelector(".ui-overlay.is-open, .modal.visible, .song-preview-panel.is-open");
      if (!anyOverlayOpen) document.body.style.overflow = "";
    }

    function closeMobileMenu() {
      const menu = $("app-mobile-menu");
      const btn = $("app-header-menu-btn");
      if (menu) {
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
      }
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.classList.remove("is-active");
      }
      const anyOverlayOpen = document.querySelector(".ui-overlay.is-open, .modal.visible, .song-preview-panel.is-open");
      if (!anyOverlayOpen) document.body.style.overflow = "";
    }

    function setMobileMenuExtrasExpanded(open) {
      const extras = $("app-mobile-menu-extras");
      const toggle = $("app-mobile-menu-extras-toggle");
      if (!extras) return;
      extras.classList.toggle("is-expanded", !!open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function openMobileMenu() {
      const menu = $("app-mobile-menu");
      const btn = $("app-header-menu-btn");
      if (!menu || !isMobileChromeLayout()) return;
      closeAppMoreSheet();
      if (typeof closeHeaderMenus === "function") closeHeaderMenus();
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      if (btn) {
        btn.setAttribute("aria-expanded", "true");
        btn.classList.add("is-active");
      }
      document.body.style.overflow = "hidden";
      const extras = $("app-mobile-menu-extras");
      // Stay collapsed unless the current page is one of the Extras links
      setMobileMenuExtrasExpanded(!!(extras && extras.querySelector(".app-mobile-menu__link.active")));
    }

    function initMobileMenu() {
      const btn = $("app-header-menu-btn");
      const menu = $("app-mobile-menu");
      const backdrop = $("app-mobile-menu-backdrop");
      const closeBtn = $("app-mobile-menu-close");
      if (!btn || !menu) return;
      btn.addEventListener("click", () => {
        if (menu.classList.contains("is-open")) closeMobileMenu();
        else openMobileMenu();
      });
      backdrop && backdrop.addEventListener("click", closeMobileMenu);
      closeBtn && closeBtn.addEventListener("click", closeMobileMenu);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && menu.classList.contains("is-open")) closeMobileMenu();
      });
      const extrasToggle = $("app-mobile-menu-extras-toggle");
      if (extrasToggle && !extrasToggle.dataset.bound) {
        extrasToggle.dataset.bound = "1";
        extrasToggle.addEventListener("click", () => {
          const extras = $("app-mobile-menu-extras");
          if (!extras) return;
          setMobileMenuExtrasExpanded(!extras.classList.contains("is-expanded"));
        });
      }
      const panel = $("account-menu-panel");
      if (panel) {
        panel.querySelectorAll(".nav-link[data-route], #account-sign-in-link, #account-sign-up-link").forEach((link) => {
          link.addEventListener("click", () => closeMobileMenu());
        });
        panel.querySelectorAll("#account-tour-link, #account-sign-out-btn").forEach((link) => {
          link.addEventListener("click", () => closeMobileMenu());
        });
      }
      const pagesNav = $("app-mobile-menu-pages");
      if (pagesNav) {
        pagesNav.querySelectorAll(".app-mobile-menu__link[data-route]").forEach((link) => {
          bindSpaRouteLink(link);
          link.addEventListener("click", () => closeMobileMenu());
        });
      }
    }

    function openAppMoreSheet() {
      const sheet = $("app-more-sheet");
      const btn = $("app-bottom-nav-more");
      if (!sheet) return;
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
      if (btn) btn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function initAppMoreSheet() {
      const btn = $("app-bottom-nav-more");
      const sheet = $("app-more-sheet");
      const backdrop = $("app-more-sheet-backdrop");
      const closeBtn = $("app-more-sheet-close");
      if (!btn || !sheet) return;
      btn.addEventListener("click", () => {
        if (sheet.classList.contains("is-open")) closeAppMoreSheet();
        else openAppMoreSheet();
      });
      backdrop && backdrop.addEventListener("click", closeAppMoreSheet);
      closeBtn && closeBtn.addEventListener("click", closeAppMoreSheet);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sheet.classList.contains("is-open")) closeAppMoreSheet();
      });
      sheet.querySelectorAll(".app-more-sheet__link[data-route]").forEach((link) => {
        link.addEventListener("click", () => closeAppMoreSheet());
      });
    }

    function initSongPlanSummaryCollapse() {
      const aside = $("mass-summary-sidebar");
      const btn = $("mass-summary-toggle");
      if (!aside || !btn) return;
      const mq = window.matchMedia("(max-width: 768px)");
      function syncSummaryCollapseState() {
        if (mq.matches) {
          aside.classList.remove("is-expanded");
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-label", "Show hymn setup details");
          btn.title = "Show hymn setup";
        } else {
          aside.classList.add("is-expanded");
          btn.setAttribute("aria-expanded", "true");
          btn.setAttribute("aria-label", "Hymn setup details");
          btn.title = "";
        }
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!mq.matches) return;
        const open = aside.classList.toggle("is-expanded");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Hide hymn setup details" : "Show hymn setup details");
        btn.title = open ? "Hide hymn setup" : "Show hymn setup";
      });
      const head = aside.querySelector(".song-plan-summary__head");
      head && head.addEventListener("click", (e) => {
        if (!mq.matches) return;
        if (e.target.closest(".song-plan-summary__toggle")) return;
        btn.click();
      });
      mq.addEventListener("change", syncSummaryCollapseState);
      syncSummaryCollapseState();
    }

    function initHomeTourBanner() {
      const banner = $("home-mass-tour-banner");
      const dismiss = $("home-mass-tour-dismiss");
      if (!banner || !dismiss) return;
      try {
        if (localStorage.getItem("lf_home_tour_banner_dismissed") === "1") {
          banner.classList.add("is-dismissed");
        }
      } catch (_err) { /* ignore */ }
      dismiss.addEventListener("click", (e) => {
        e.stopPropagation();
        banner.classList.add("is-dismissed");
        try { localStorage.setItem("lf_home_tour_banner_dismissed", "1"); } catch (_err) { /* ignore */ }
      });
    }

    function initHomeMobileCollapsible(cardId, toggleId, labels) {
      const card = $(cardId);
      const btn = $(toggleId);
      if (!card || !btn) return;
      const mq = window.matchMedia("(max-width: 768px)");
      const showLabel = (labels && labels.show) || "Show section";
      const hideLabel = (labels && labels.hide) || "Hide section";
      function syncState() {
        if (mq.matches) {
          card.classList.remove("is-expanded");
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-label", showLabel);
          btn.title = showLabel;
        } else {
          card.classList.add("is-expanded");
          btn.setAttribute("aria-expanded", "true");
          btn.setAttribute("aria-label", hideLabel);
          btn.title = "";
        }
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!mq.matches) return;
        const open = card.classList.toggle("is-expanded");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? hideLabel : showLabel);
        btn.title = open ? hideLabel : showLabel;
      });
      const head = card.querySelector(".home-mobile-collapsible__head");
      head && head.addEventListener("click", (e) => {
        if (!mq.matches) return;
        if (e.target.closest(".home-mobile-collapsible__toggle")) return;
        if (e.target.closest(".btn-home-create-event")) return;
        btn.click();
      });
      mq.addEventListener("change", syncState);
      syncState();
    }

    function isSuperadminRoute(route) {
      return route === "/superadmin";
    }

    var SA_UNLOCK_KEY = "verbum:sa-unlocked";

    function currentSaUnlockUserId() {
      try {
        const auth = window.VerbumAuth;
        const user = auth && auth.getUser ? auth.getUser() : null;
        return (user && user.id) || "";
      } catch (_e) {
        return "";
      }
    }

    function superadminToolsUnlocked() {
      try {
        const raw = sessionStorage.getItem(SA_UNLOCK_KEY) || "";
        if (!raw || raw === "1") return false;
        const uid = currentSaUnlockUserId();
        if (raw === "pending") return true;
        return !!uid && raw === uid;
      } catch (_e) {
        return false;
      }
    }

    function persistSuperadminUnlock() {
      try {
        const uid = currentSaUnlockUserId();
        sessionStorage.setItem(SA_UNLOCK_KEY, uid || "pending");
      } catch (_e) { /* ignore */ }
    }

    function bindPendingSuperadminUnlock() {
      try {
        if (sessionStorage.getItem(SA_UNLOCK_KEY) !== "pending") return;
        const uid = currentSaUnlockUserId();
        if (uid) sessionStorage.setItem(SA_UNLOCK_KEY, uid);
      } catch (_e) { /* ignore */ }
    }

    function lockSuperadminTools() {
      try { sessionStorage.removeItem(SA_UNLOCK_KEY); } catch (_e) { /* ignore */ }
      saUnlockPendingNotify = false;
      if (typeof syncPrivilegedUi === "function") syncPrivilegedUi();
      else syncSuperadminNavVisibility();
      if (typeof isSuperadminRoute === "function" && isSuperadminRoute(normalizeRoute(currentRoute()))) {
        showRoute("/home", true);
      }
    }

    function canUseCalendarReadingsAdmin() {
      return !!churchMembershipState.is_superadmin && superadminToolsUnlocked();
    }

    function syncCalendarAdminVisibility() {
      const on = !!churchMembershipState.is_superadmin && superadminToolsUnlocked();
      const fetchMissingBtn = $("cal-admin-fetch-missing-btn");
      const fetchMonthBtn = $("cal-admin-fetch-month-btn");
      const banner = $("cal-admin-banner");
      const modalFetchBtn = $("cal-readings-admin-fetch");
      const modalSaveBtn = $("cal-readings-admin-save");
      const editReadingsBtn = $("btn-cal-edit-readings");
      if (fetchMissingBtn) {
        fetchMissingBtn.hidden = !on;
        fetchMissingBtn.style.display = on ? "" : "none";
      }
      if (fetchMonthBtn) {
        fetchMonthBtn.hidden = !on;
        fetchMonthBtn.style.display = on ? "" : "none";
      }
      if (banner) banner.hidden = !on;
      if (modalFetchBtn) {
        modalFetchBtn.hidden = !on;
        modalFetchBtn.style.display = on ? "" : "none";
      }
      if (modalSaveBtn) modalSaveBtn.hidden = !on;
      if (editReadingsBtn) {
        editReadingsBtn.hidden = !on;
        editReadingsBtn.style.display = on ? "" : "none";
      }
      updateCalAdminFetchButtons();
    }

    var saUnlockPendingNotify = false;

    function completeSuperadminUnlock() {
      persistSuperadminUnlock();
      syncSuperadminNavVisibility();
      if (typeof syncPrivilegedUi === "function") syncPrivilegedUi();
      if (churchMembershipState.is_superadmin) {
        notify("Superadmin tools unlocked.", "ok");
        saUnlockPendingNotify = false;
        if (typeof refreshSaApprovalInbox === "function") refreshSaApprovalInbox(true);
      } else {
        saUnlockPendingNotify = true;
      }
    }

    function initSuperadminEasterEgg() {
      const brand = document.getElementById("app-sidebar-brand") || document.querySelector(".app-sidebar__brand");
      if (!brand || brand.dataset.saEggBound === "1") return;
      brand.dataset.saEggBound = "1";
      let clicks = 0;
      let resetTimer = null;
      const SA_EGG_CLICKS = 7;
      const SA_EGG_WINDOW_MS = 4000;

      brand.addEventListener("click", () => {
        clicks += 1;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { clicks = 0; }, SA_EGG_WINDOW_MS);
        if (clicks < SA_EGG_CLICKS) return;
        clicks = 0;
        clearTimeout(resetTimer);
        completeSuperadminUnlock();
      });
    }

    function syncSuperadminNavVisibility() {
      const link = $("superadmin-nav-link");
      if (!link) return;
      const show = !!churchMembershipState.is_superadmin && superadminToolsUnlocked();
      link.hidden = !show;
      link.style.display = show ? "" : "none";
      syncCalendarAdminVisibility();
      const calPage = $("calendar-page");
      if (show && calPage && calPage.classList.contains("active")) {
        calendarMonthKey = "";
        loadCalendarMonth();
      }
    }

    function canAccessSuperadminRoute() {
      return !!churchMembershipState.is_superadmin && superadminToolsUnlocked();
    }

    function isSettingsRoute(route) {
      return route === "/settings/account" || route === "/settings/church" || route === "/settings/team" || route === "/settings/app";
    }

    var lastNonSettingsRoute = "/home";

    var MASS_BUILDER_DRAFT_VERSION = 1;
    var massDraftSkipRestore = false;
    var massDraftAutoSaveTimer = null;
    var massDraftRestoring = false;
    var massDraftToastLastAt = 0;

    function massBuilderDraftStorageKey() {
      let scope = "local";
      try {
        const auth = window.VerbumAuth;
        const user = auth && auth.getUser ? auth.getUser() : null;
        if (user && user.id) scope = "u:" + user.id;
        else if (typeof getCommunityName === "function") {
          const church = (getCommunityName() || "").trim();
          if (church) scope = "c:" + church;
        }
      } catch (_e) { /* ignore */ }
      return "verbum_mass_builder_draft_v" + MASS_BUILDER_DRAFT_VERSION + ":" + scope;
    }

    function readMassBuilderDraft() {
      try {
        const raw = localStorage.getItem(massBuilderDraftStorageKey());
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.version !== MASS_BUILDER_DRAFT_VERSION) return null;
        return data;
      } catch (_e) {
        return null;
      }
    }

    function formatMassBuilderDraftStepLabel(step) {
      const labels = {
        1: "Mass Info",
        2: "Introductory Rites",
        3: "Liturgy of the Word",
        4: "Eucharist",
        5: "Music",
        6: "Extras",
        7: "Review",
      };
      const n = parseInt(step, 10);
      if (!n || n < 1 || n > 7) return "In progress";
      return "Step " + n + " · " + (labels[n] || "In progress");
    }

    function massBuilderDraftFieldIds() {
      return [
        "mass-date", "co-celebrant",
        "flow-penitential-choice", "flow-kyrie-choice", "flow-gloria-choice",
        "flow-creed-choice", "flow-our-father-choice", "flow-lamb-choice",
        "flow-mass-language",
        "flow-psalm-refrain", "flow-psalm-custom", "flow-gospel-sentence", "flow-gospel-custom",
        "flow-collection-date", "flow-collection-amount", "flow-collection-currency",
        "flow-slide-mass-collection", "flow-slide-food-sponsor",
        "flow-slide-sponsorship-contact", "flow-slide-merienda-location",
        "flow-slide-welcoming-newcomers",
        "flow-slide-bg-collection", "flow-slide-bg-collection-hex",
        "flow-slide-bg-food", "flow-slide-bg-food-hex",
        "flow-slide-bg-contact", "flow-slide-bg-contact-hex",
        "flow-slide-bg-merienda", "flow-slide-bg-merienda-hex",
        "flow-sponsorship-contact", "flow-merienda-location",
        "flow-lotw-poster", "flow-lote-poster", "flow-openai-poster-style",
        "flow-use-ai-poster", "flow-use-openai-poster", "flow-use-gemini-poster",
        "flow-include-church-logo", "flow-include-church-name", "flow-show-footer",
        "flow-include-social-exports", "flow-deck-theme", "flow-divider-style",
      ];
    }

    function massBuilderSanctusPicked() {
      if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) return true;
      const flowPage = $("flow-page");
      if (!flowPage) return false;
      return !!flowPage.querySelector('.mw-options[aria-label="Sanctus tune"] .mw-option[aria-checked="true"]:not([data-val="__video"])');
    }

    function restoreMassBuilderPosterPicker(targetId, value) {
      const target = $(targetId);
      if (!target || !value) return;
      target.value = value;
      const pairPicker = document.querySelector("[data-poster-picker][data-pair]");
      if (pairPicker) {
        const lotwEl = $(pairPicker.getAttribute("data-lotw-target") || "flow-lotw-poster");
        const loteEl = $(pairPicker.getAttribute("data-lote-target") || "flow-lote-poster");
        const lotwVal = (lotwEl && lotwEl.value) || "lotw1";
        const loteVal = (loteEl && loteEl.value) || "lote1";
        const pairN = posterPairNumberFromIds(lotwVal, loteVal);
        setPairedPosterSelection(pairPicker, pairN);
        return;
      }
      const picker = document.querySelector('[data-poster-picker][data-target="' + targetId + '"]');
      if (!picker) return;
      const current = picker.querySelector(".poster-picker__current");
      const menu = picker.querySelector(".poster-picker__menu");
      if (current) current.src = "/static/images/posters/" + value + ".png";
      if (menu) {
        menu.querySelectorAll(".poster-picker__option").forEach((opt) => {
          opt.setAttribute("aria-selected", opt.getAttribute("data-value") === value ? "true" : "false");
        });
      }
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function posterPairNumberFromIds(lotwId, loteId) {
      const fromLotw = String(lotwId || "").match(/^lotw([1-4])$/i);
      const fromLote = String(loteId || "").match(/^lote([1-4])$/i);
      if (fromLotw) return parseInt(fromLotw[1], 10);
      if (fromLote) return parseInt(fromLote[1], 10);
      return 1;
    }

    function setPairedPosterSelection(picker, pairN) {
      if (!picker) return;
      const n = Math.max(1, Math.min(4, parseInt(pairN, 10) || 1));
      const lotwId = "lotw" + n;
      const loteId = "lote" + n;
      const lotwEl = $(picker.getAttribute("data-lotw-target") || "flow-lotw-poster");
      const loteEl = $(picker.getAttribute("data-lote-target") || "flow-lote-poster");
      if (lotwEl) {
        lotwEl.value = lotwId;
        lotwEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (loteEl) {
        loteEl.value = loteId;
        loteEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const lotwImg = picker.querySelector('.poster-picker__current[data-pair-role="lotw"]');
      const loteImg = picker.querySelector('.poster-picker__current[data-pair-role="lote"]');
      if (lotwImg) lotwImg.src = "/static/images/posters/" + lotwId + ".png";
      if (loteImg) loteImg.src = "/static/images/posters/" + loteId + ".png";
      const menu = picker.querySelector(".poster-picker__menu");
      if (menu) {
        menu.querySelectorAll(".poster-picker__option").forEach((opt) => {
          opt.setAttribute("aria-selected", String(opt.getAttribute("data-pair")) === String(n) ? "true" : "false");
        });
      }
    }

    function setMassBuilderFieldValue(id, value) {
      const el = $(id);
      if (!el || value == null) return;
      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = String(value);
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (id === "mass-date" || id === "flow-collection-date") syncMassDatePickerByInputId(id);
    }

    function collectMassBuilderDraft() {
      const step = window.MassWizard && window.MassWizard.getStep ? window.MassWizard.getStep() : 1;
      const fields = {};
      massBuilderDraftFieldIds().forEach((id) => {
        const el = $(id);
        if (!el) return;
        fields[id] = el.type === "checkbox" ? !!el.checked : (el.value || "");
      });
      const cel = $("celebrant");
      fields.celebrant = cel ? (cel.value || "").trim() : "";
      const hymnLayout = document.querySelector('input[name="flow-hymn-layout"]:checked');
      return {
        version: MASS_BUILDER_DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        step: step,
        fields: fields,
        sanctusPicked: massBuilderSanctusPicked(),
        foodSponsors: typeof getFlowFoodSponsorsLines === "function" ? getFlowFoodSponsorsLines() : [],
        customAnnouncementSlides: typeof getFlowCustomSlidesPayload === "function" ? getFlowCustomSlidesPayload() : [],
        announcementBgColors: typeof getAnnouncementBgColors === "function" ? getAnnouncementBgColors() : null,
        lyricSongSlots: JSON.parse(JSON.stringify(lyricSongSlots)),
        selectedLyricsSongs: Object.assign({}, selectedLyricsSongs),
        massCommunionCount: massCommunionCount,
        massCustomSlotSeq: massCustomSlotSeq,
        massSongPlanLanguage: massSongPlanLanguage,
        hymnLayout: hymnLayout ? hymnLayout.value : "dual",
        hymnBodyAlign: readHymnBodyAlign(),
        hymnSectionLabels: readHymnSectionLabels(),
        readingsLoaded: !!(flowPreviewData && flowPreviewData.__previewDate),
        previewDate: flowPreviewData && flowPreviewData.__previewDate ? flowPreviewData.__previewDate : "",
        sectionMedia: typeof serializeMassSectionMedia === "function" ? serializeMassSectionMedia() : { audio: {}, video: {} },
        riteVideo: typeof serializeRiteVideoState === "function" ? serializeRiteVideoState() : { mode: {}, lang: {} },
        songVideo: typeof serializeSongVideoState === "function" ? serializeSongVideoState() : { mode: {} },
      };
    }

    function massBuilderHasDraftableProgress() {
      return !!(window.MassWizard && window.MassWizard.hasProgress && window.MassWizard.hasProgress());
    }

    function massBuilderDraftCompareKey(draft) {
      if (!draft) return "";
      const d = Object.assign({}, draft);
      delete d.savedAt;
      return JSON.stringify(d);
    }

    function massBuilderDraftsEqual(a, b) {
      if (!a || !b) return false;
      return massBuilderDraftCompareKey(a) === massBuilderDraftCompareKey(b);
    }

    function formatMassBuilderDraftSavedStamp(date) {
      const d = date instanceof Date ? date : new Date();
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }

    function notifyMassBuilderDraftSaved(force) {
      if (typeof notify !== "function") return;
      const now = Date.now();
      const stamp = formatMassBuilderDraftSavedStamp(new Date(now));
      const message = stamp ? ("Draft saved · " + stamp) : "Draft saved";
      const key = "mass-builder-draft";
      const toastOpen = typeof hasToastWithKey === "function" && hasToastWithKey(key);
      const skipToast = !force && !toastOpen && now - massDraftToastLastAt < 30000;
      if (!skipToast) massDraftToastLastAt = now;
      notify(message, "ok", { key: key, skipToast: skipToast });
    }

    function saveMassBuilderDraft(options) {
      if (!massBuilderHasDraftableProgress()) return false;
      const opts = options || {};
      const next = collectMassBuilderDraft();
      const existing = readMassBuilderDraft();
      if (existing && massBuilderDraftsEqual(next, existing)) return false;
      try {
        localStorage.setItem(massBuilderDraftStorageKey(), JSON.stringify(next));
        updateMassBuilderDraftHomeUI();
        if (opts.toast) notifyMassBuilderDraftSaved(!!opts.toastAlways);
        return true;
      } catch (_e) {
        return false;
      }
    }

    function autoSaveMassBuilderDraftOnLeave() {
      if (massDraftRestoring) return;
      if (massBuilderHasDraftableProgress()) {
        saveMassBuilderDraft({ toast: true, toastAlways: true });
      } else {
        clearMassBuilderDraft();
      }
    }

    function scheduleMassBuilderDraftAutoSave() {
      if (normalizeRoute(currentRoute()) !== "/mass/builder") return;
      if (!massBuilderHasDraftableProgress()) return;
      const existing = readMassBuilderDraft();
      if (existing && massBuilderDraftsEqual(collectMassBuilderDraft(), existing)) return;
      if (massDraftAutoSaveTimer) window.clearTimeout(massDraftAutoSaveTimer);
      massDraftAutoSaveTimer = window.setTimeout(() => {
        massDraftAutoSaveTimer = null;
        saveMassBuilderDraft({ toast: true });
      }, 15000);
    }
    window.scheduleMassBuilderDraftAutoSave = scheduleMassBuilderDraftAutoSave;

    function clearMassBuilderDraft() {
      try { localStorage.removeItem(massBuilderDraftStorageKey()); } catch (_e) { /* ignore */ }
      updateMassBuilderDraftHomeUI();
    }

    function runHomeMassStartNew() {
      massDraftSkipRestore = true;
      clearMassBuilderDraft();
      try { sessionStorage.removeItem("verbumDeckThemePrompted"); } catch (_e) { /* ignore */ }
      if (typeof resetMassSectionMedia === "function") resetMassSectionMedia();
      closeHomeMassNewModal();
      showRoute("/mass/builder");
      requestAnimationFrame(() => {
        if ($("mass-date")) {
          ensureMassBuilderDefaultDate({ force: true });
        }
        ensureCollectionDefaultDate({ force: true });
        if (window.MassWizard && window.MassWizard.setStep) window.MassWizard.setStep(1);
        loadFlowData(true).catch(() => {});
        setTimeout(() => {
          if (typeof window.maybePromptDeckThemeOnStartup === "function") {
            window.maybePromptDeckThemeOnStartup();
          }
        }, 0);
      });
    }

    function closeHomeMassNewModal() {
      setUiOverlayOpen($("home-mass-new-modal"), false);
    }

    function openHomeMassNewModal() {
      const draft = readMassBuilderDraft();
      const desc = $("home-mass-new-desc");
      if (desc) {
        const stepLabel = draft ? formatMassBuilderDraftStepLabel(draft.step) : "";
        desc.textContent = draft
          ? "Your saved draft (" + stepLabel + ") will be permanently deleted. This cannot be undone."
          : "Your saved draft will be permanently deleted. This cannot be undone.";
      }
      setUiOverlayOpen($("home-mass-new-modal"), true);
      requestAnimationFrame(() => $("home-mass-new-cancel") && $("home-mass-new-cancel").focus());
    }

    function updateMassBuilderDraftHomeUI() {
      const draft = readMassBuilderDraft();
      const ctaLabel = $("home-mass-cta-label");
      const statusEl = $("home-mass-stat-status");
      const statusSub = $("home-mass-stat-status-sub");
      const cta = $("home-mass-cta");
      if (draft) {
        const stepLabel = formatMassBuilderDraftStepLabel(draft.step);
        const stamp = formatMassBuilderDraftSavedStamp(draft.savedAt ? new Date(draft.savedAt) : new Date());
        if (ctaLabel) ctaLabel.textContent = "Continue where you left off\u00a0›";
        if (statusEl) statusEl.textContent = stamp ? ("Draft saved · " + stamp) : "Draft saved";
        if (statusSub) statusSub.textContent = stepLabel;
        if (cta) cta.setAttribute("data-mw-resume-draft", "1");
      } else {
        if (ctaLabel) ctaLabel.textContent = "Start preparing\u00a0›";
        if (statusEl) statusEl.textContent = "Not started";
        if (statusSub) statusSub.textContent = "Open builder to begin";
        if (cta) cta.removeAttribute("data-mw-resume-draft");
      }
    }

    async function restoreMassBuilderDraft(draft) {
      if (!draft || !draft.fields) return;
      massDraftRestoring = true;
      try {
      const f = draft.fields;
      const savedSongs = draft.selectedLyricsSongs ? Object.assign({}, draft.selectedLyricsSongs) : null;
      const savedSlots = Array.isArray(draft.lyricSongSlots) ? JSON.parse(JSON.stringify(draft.lyricSongSlots)) : null;
      const savedPsalmCustom = f["flow-psalm-custom"] || "";
      const savedGospelCustom = f["flow-gospel-custom"] || "";
      const savedPsalmRefrain = f["flow-psalm-refrain"];
      const savedGospelSentence = f["flow-gospel-sentence"];
      if (f["mass-date"]) setMassBuilderFieldValue("mass-date", f["mass-date"]);
      ensureMassBuilderDefaultDate();
      if (typeof setCelebrantPickerValue === "function") setCelebrantPickerValue(f.celebrant || "");
      else if ($("celebrant")) $("celebrant").value = f.celebrant || "";
      massBuilderDraftFieldIds().forEach((id) => {
        if (id === "mass-date" || id === "flow-psalm-custom" || id === "flow-gospel-custom" ||
            id === "flow-psalm-refrain" || id === "flow-gospel-sentence") return;
        if (Object.prototype.hasOwnProperty.call(f, id)) setMassBuilderFieldValue(id, f[id]);
      });
      ensureCollectionDefaultDate();
      if (typeof window.syncAnnouncementSlideFields === "function") window.syncAnnouncementSlideFields();
      if (typeof migrateLegacyAiPosterToggles === "function") migrateLegacyAiPosterToggles();
      if (typeof syncOpenAiPosterUi === "function") syncOpenAiPosterUi();
      if (typeof applyRiteVideoState === "function") {
        applyRiteVideoState(draft.riteVideo || { mode: {}, lang: {} });
      }
      if (f["flow-deck-theme"] && typeof window.setActiveDeckTheme === "function") {
        window.setActiveDeckTheme(f["flow-deck-theme"]);
      }
      if (f["flow-divider-style"] && typeof window.setActiveDividerStyle === "function") {
        window.setActiveDividerStyle(f["flow-divider-style"]);
      }
      if (draft.sanctusPicked && !(window.massRiteVideoMode && window.massRiteVideoMode.sanctus)) {
        const opt = document.querySelector('.mw-options[aria-label="Sanctus tune"] .mw-option[data-val="default"]');
        if (opt) opt.click();
      }
      {
        const lotwVal = f["flow-lotw-poster"] || "lotw1";
        const loteVal = f["flow-lote-poster"] || "lote1";
        const lotwEl = $("flow-lotw-poster");
        const loteEl = $("flow-lote-poster");
        if (lotwEl) lotwEl.value = lotwVal;
        if (loteEl) loteEl.value = loteVal;
        restoreMassBuilderPosterPicker("flow-lotw-poster", lotwVal);
      }
      if (Array.isArray(draft.foodSponsors) && typeof renderFlowFoodSponsorsList === "function") {
        renderFlowFoodSponsorsList(draft.foodSponsors);
        if (typeof syncFlowFoodSponsorsHidden === "function") syncFlowFoodSponsorsHidden();
      }
      if (typeof setAnnouncementBgColors === "function" && draft.announcementBgColors) {
        setAnnouncementBgColors(draft.announcementBgColors);
      }
      if (typeof setFlowCustomSlidesUI === "function") {
        setFlowCustomSlidesUI(Array.isArray(draft.customAnnouncementSlides) ? draft.customAnnouncementSlides : []);
      }
      if (savedSlots) lyricSongSlots = savedSlots;
      if (savedSongs) selectedLyricsSongs = savedSongs;
      if (draft.massCustomSlotSeq != null) massCustomSlotSeq = draft.massCustomSlotSeq;
      if (draft.massSongPlanLanguage) {
        massSongPlanLanguage = draft.massSongPlanLanguage;
        const langSel = $("mass-song-plan-lang");
        if (langSel && [...langSel.options].some((o) => o.value === massSongPlanLanguage)) {
          langSel.value = massSongPlanLanguage;
          if (typeof refreshVerbumSelect === "function") refreshVerbumSelect(langSel);
        }
      }
      const layoutVal = draft.hymnLayout || "dual";
      if (typeof applyHymnLyricsLayout === "function") {
        applyHymnLyricsLayout(layoutVal);
      } else {
        document.querySelectorAll('input[name="flow-hymn-layout"]').forEach((el) => {
          el.checked = el.value === layoutVal;
        });
      }
      if (typeof applyHymnBodyAlign === "function") {
        applyHymnBodyAlign(draft.hymnBodyAlign || "center");
      }
      if (typeof applyHymnSectionLabels === "function") {
        applyHymnSectionLabels(!!draft.hymnSectionLabels);
      }
      const date = ($("mass-date") && $("mass-date").value) || f["mass-date"] || "";
      if (date && typeof loadFlowData === "function") {
        await loadFlowData(true);
      }
      if (savedSongs) selectedLyricsSongs = savedSongs;
      if (savedSlots) lyricSongSlots = savedSlots;
      if (typeof applyCommunionCountFromSlotsOrDraft === "function") {
        applyCommunionCountFromSlotsOrDraft(draft);
      }
      if (savedPsalmCustom) setMassBuilderFieldValue("flow-psalm-custom", savedPsalmCustom);
      else if (savedPsalmRefrain !== "" && savedPsalmRefrain != null) setMassBuilderFieldValue("flow-psalm-refrain", savedPsalmRefrain);
      if (savedGospelCustom) setMassBuilderFieldValue("flow-gospel-custom", savedGospelCustom);
      else if (savedGospelSentence !== "" && savedGospelSentence != null) setMassBuilderFieldValue("flow-gospel-sentence", savedGospelSentence);
      // Replace sticky first-in-section / legacy first-song drafts with gospel-mood picks.
      if (typeof songPlanNeedsMoodReload === "function" && songPlanNeedsMoodReload()) {
        if (typeof applyGospelMoodDefaultsToSongPlan === "function") applyGospelMoodDefaultsToSongPlan();
      }
      if (typeof renderMassSongPlan === "function") renderMassSongPlan();
      if (draft.sectionMedia && typeof applyMassSectionMedia === "function") {
        applyMassSectionMedia(draft.sectionMedia);
      } else if (typeof refreshMassSectionMediaUi === "function") {
        refreshMassSectionMediaUi();
      }
      if (typeof applySongVideoState === "function") {
        applySongVideoState(draft.songVideo || { mode: {} });
      }
      if (typeof applyRiteVideoState === "function") {
        applyRiteVideoState(draft.riteVideo || { mode: {}, lang: {} });
      }
      if (window.MassWizard && window.MassWizard.setStep) {
        window.MassWizard.setStep(draft.step || 1);
      }
      if (typeof renderMassSummarySidebar === "function") renderMassSummarySidebar();
      document.dispatchEvent(new CustomEvent("mw:preview"));
      } finally {
        massDraftRestoring = false;
      }
    }

    (function initMassBuilderDraftUi() {
      const flowPage = $("flow-page");
      if (flowPage && flowPage.dataset.draftAutosaveBound !== "1") {
        flowPage.dataset.draftAutosaveBound = "1";
        flowPage.addEventListener("input", scheduleMassBuilderDraftAutoSave, true);
        flowPage.addEventListener("change", scheduleMassBuilderDraftAutoSave, true);
      }
      document.addEventListener("mw:preview", scheduleMassBuilderDraftAutoSave);
      const ctaNew = $("home-mass-cta-new");
      if (ctaNew && ctaNew.dataset.draftBound !== "1") {
        ctaNew.dataset.draftBound = "1";
        ctaNew.addEventListener("click", (e) => {
          e.preventDefault();
          if (readMassBuilderDraft()) {
            openHomeMassNewModal();
            return;
          }
          runHomeMassStartNew();
        });
      }
      const newModal = $("home-mass-new-modal");
      [
        ["home-mass-new-backdrop", closeHomeMassNewModal],
        ["home-mass-new-close", closeHomeMassNewModal],
        ["home-mass-new-cancel", closeHomeMassNewModal],
      ].forEach(([id, fn]) => {
        const el = $(id);
        if (el) el.addEventListener("click", fn);
      });
      $("home-mass-new-confirm") && $("home-mass-new-confirm").addEventListener("click", runHomeMassStartNew);
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const modal = $("home-mass-new-modal");
        if (modal && modal.classList.contains("is-open")) closeHomeMassNewModal();
      });
      updateMassBuilderDraftHomeUI();
    })();

    function syncSettingsLayout(route) {
      const inSettings = isSettingsRoute(route);
      const panelForRoute = {
        "/settings/account": "account",
        "/settings/church": "church",
        "/settings/team": "team",
        "/settings/app": "appearance",
      };
      const activeKey = panelForRoute[route] || "account";
      document.querySelectorAll(".settings-panel").forEach((panel) => {
        if (!inSettings) {
          panel.hidden = true;
          return;
        }
        panel.hidden = panel.dataset.settingsPanel !== activeKey;
      });
      document.querySelectorAll(".settings-sidebar-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.route === route);
      });
      document.querySelectorAll(".settings-modal-tab").forEach((link) => {
        link.classList.toggle("active", link.dataset.route === route);
      });
      if (inSettings) {
        const settingsMain = document.querySelector("#settings-page .settings-main");
        if (settingsMain) settingsMain.scrollTop = 0;
      }
    }

    function closeSettingsModal() {
      showRoute(lastNonSettingsRoute && !isSettingsRoute(lastNonSettingsRoute) ? lastNonSettingsRoute : "/home");
    }

    function pageIsActiveForRoute(page, route) {
      if (page.id === "settings-page") return isSettingsRoute(route);
      if (page.id === "today-page") return route === "/notifications";
      return page.dataset.route === route;
    }

