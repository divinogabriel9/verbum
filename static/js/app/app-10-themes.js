/* Verbum SPA part 10: theme marketplace (Pinterest desktop home feed) */

    var __tmCatalog = null;
    var __tmBound = false;
    var __tmTopic = "all";
    var __tmBuyPackId = null;
    var __tmPreviewCtx = null;

    function tmEscape(s) {
      return typeof escapeHtml === "function" ? escapeHtml(String(s || "")) : String(s || "");
    }

    function tmSelectedTerm() {
      const sel = $("tm-term-select");
      return (sel && sel.value) || "monthly";
    }

    function tmSelectedOffer() {
      const offers = (((__tmCatalog || {}).pricing || {}).offers) || [];
      const iv = tmSelectedTerm();
      return offers.find((o) => o.interval === iv) || offers[0] || null;
    }

    function tmStartingOffer() {
      const offers = (((__tmCatalog || {}).pricing || {}).offers) || [];
      return offers.find((o) => o.interval === "monthly") || offers[0] || null;
    }

    function tmSlideTone(packOrKind) {
      if (typeof packOrKind === "string") return packOrKind;
      if (packOrKind && packOrKind.is_placeholder) return "placeholder";
      const slug = String((packOrKind && packOrKind.slug) || "").toLowerCase();
      const tags = ((packOrKind && packOrKind.season_tags) || []).map((t) => String(t || "").toLowerCase());
      if (slug.indexOf("classic") >= 0 || slug.indexOf("basic") >= 0 || (packOrKind && packOrKind.is_free)) {
        return "classic";
      }
      if (slug.indexOf("amber") >= 0) return "ordinary";
      if (tags.indexOf("advent") >= 0 || slug.indexOf("advent") >= 0) return "advent";
      if (tags.indexOf("christmas") >= 0 || slug.indexOf("christmas") >= 0) return "christmas";
      if (tags.indexOf("lent") >= 0 || slug.indexOf("lent") >= 0) return "lent";
      if (tags.indexOf("easter") >= 0 || slug.indexOf("easter") >= 0) return "easter";
      if (tags.indexOf("ordinary") >= 0 || slug.indexOf("ordinary") >= 0) return "ordinary";
      if (tags.indexOf("placeholder") >= 0) return "placeholder";
      return "default";
    }

    function tmSlideTitlesForTone(tone) {
      if (tone === "advent") return ["O Come, O Come", "Gospel Acclamation", "Communion"];
      if (tone === "christmas") return ["Silent Night", "Gloria", "Nativity"];
      if (tone === "lent") return ["Attende Domine", "Penitential Act", "Communion"];
      if (tone === "easter") return ["Alleluia", "Sequence", "Final Blessing"];
      if (tone === "ordinary") return ["Entrance", "Responsorial Psalm", "Lamb of God"];
      if (tone === "classic") return ["Gloria", "Liturgy of the Word", "Sanctus"];
      if (tone === "parish") return ["Your master", "Reading", "Final Blessing"];
      if (tone === "placeholder") return ["Coming soon", "Preview", "Soon"];
      return ["Gloria", "Psalm", "Communion"];
    }

    function tmSlideTitleForTone(tone) {
      return tmSlideTitlesForTone(tone)[0] || "Gloria";
    }

    function tmSlidePreviewHtml(opts) {
      const tone = tmEscape(opts.tone || "default");
      const brand = tmEscape(opts.brand || "Mass");
      const title = tmEscape(opts.slideTitle || "Gloria");
      const extra = opts.extraClass ? (" " + opts.extraClass) : "";
      return (
        "<div class=\"tm-slide tm-slide--" + tone + extra + "\" aria-hidden=\"true\">" +
          "<div class=\"tm-slide__bg\"></div>" +
          "<div class=\"tm-slide__vignette\"></div>" +
          "<div class=\"tm-slide__brand\">" + brand + "</div>" +
          "<p class=\"tm-slide__title\">" + title + "</p>" +
          "<div class=\"tm-slide__lines\">" +
            "<span class=\"tm-slide__line\"></span>" +
            "<span class=\"tm-slide__line\"></span>" +
            "<span class=\"tm-slide__line\"></span>" +
          "</div>" +
        "</div>"
      );
    }

    function tmPinMediaHtml(tone, brand) {
      return tmSlidePreviewHtml({
        tone: tone,
        brand: brand,
        slideTitle: tmSlideTitleForTone(tone),
      });
    }

    function tmPreviewSlidesHtml(tone, brand) {
      const titles = tmSlideTitlesForTone(tone);
      return titles.map((title) => {
        return (
          "<figure class=\"tm-preview-slide\">" +
            tmSlidePreviewHtml({
              tone: tone,
              brand: brand,
              slideTitle: title,
              extraClass: "tm-slide--preview",
            }) +
            "<figcaption class=\"tm-preview-slide__cap\">" + tmEscape(title) + "</figcaption>" +
          "</figure>"
        );
      }).join("");
    }

    function tmMatchesTopic(pack, topic) {
      const t = String(topic || "all").toLowerCase();
      if (!t || t === "all") return true;
      if (t === "free" || t === "included") {
        return !!pack.is_free;
      }
      const tags = ((pack && pack.season_tags) || []).map((x) => String(x || "").toLowerCase());
      const slug = String((pack && pack.slug) || "").toLowerCase();
      if (tags.indexOf(t) >= 0) return true;
      if (slug.indexOf(t) >= 0) return true;
      return false;
    }

    function tmPinActionsHtml(opts) {
      const free = opts.free;
      const owned = opts.owned;
      const active = opts.active;
      const hasSub = opts.hasSub;
      const packId = opts.packId;
      const placeholder = opts.placeholder;
      const price = opts.priceLabel || "₱49";
      if (placeholder) {
        return "<span class=\"tm-pin__cta tm-pin__cta--ghost\" aria-disabled=\"true\">Soon</span>";
      }
      if (active) {
        return "<span class=\"tm-badge\">In use</span>";
      }
      if (free || owned) {
        return (
          "<button type=\"button\" class=\"tm-pin__cta tm-btn-apply\" data-pack-id=\"" +
          tmEscape(packId || "") + "\" data-free=\"" + (free ? "1" : "0") + "\">Apply</button>"
        );
      }
      return (
        "<button type=\"button\" class=\"tm-pin__cta tm-btn-buy\" data-pack-id=\"" +
        tmEscape(packId || "") + "\" data-pack-title=\"" + tmEscape(opts.title || "Theme") +
        "\"" + (hasSub ? "" : " data-needs-sub=\"1\"") + ">" +
        tmEscape(price) +
        "</button>"
      );
    }

    function renderThemeSkeletons(count) {
      const grid = $("tm-pack-grid");
      if (!grid) return;
      const n = Math.max(6, count || 10);
      const pins = [];
      for (let i = 0; i < n; i++) {
        pins.push(
          "<article class=\"tm-pin tm-pin--skeleton\" aria-hidden=\"true\" style=\"--tm-i:" + (i + 1) + "\">" +
            "<div class=\"tm-pin__media tm-pin__media--skeleton\">" +
              "<div class=\"tm-pin__chrome\">" +
                "<div class=\"tm-pin__foot\">" +
                  "<div class=\"tm-pin__foot-copy\">" +
                    "<span class=\"tm-skel tm-skel--title\"></span>" +
                    "<span class=\"tm-skel tm-skel--by\"></span>" +
                  "</div>" +
                  "<span class=\"tm-skel tm-skel--cta\"></span>" +
                "</div>" +
              "</div>" +
            "</div>" +
          "</article>"
        );
      }
      grid.innerHTML = pins.join("");
      grid.setAttribute("aria-busy", "true");
    }

    function renderThemeTermSelect() {
      const sel = $("tm-term-select");
      const segs = $("tm-term-segments");
      const hint = $("tm-term-hint");
      if (!sel) return;
      const offers = (((__tmCatalog || {}).pricing || {}).offers) || [];
      const prev = sel.value || "monthly";
      sel.innerHTML = offers.map((o) => {
        return "<option value=\"" + tmEscape(o.interval) + "\">" +
          tmEscape(o.label) + " · " + tmEscape(o.amount_display) +
          "</option>";
      }).join("");
      if (offers.some((o) => o.interval === prev)) sel.value = prev;
      else if (offers.length) sel.value = offers[0].interval;
      if (segs) {
        segs.innerHTML = offers.map((o) => {
          const active = o.interval === sel.value;
          const price = o.amount_display || "";
          return (
            "<button type=\"button\" class=\"tm-term-seg" + (active ? " is-active" : "") +
              "\" data-tm-interval=\"" + tmEscape(o.interval) + "\" aria-pressed=\"" +
              (active ? "true" : "false") + "\">" +
              tmEscape(o.label) +
              (price ? "<span class=\"tm-term-seg__price\">" + tmEscape(price) + "</span>" : "") +
            "</button>"
          );
        }).join("");
      }
      const offer = tmSelectedOffer();
      if (hint) {
        hint.textContent = offer
          ? (offer.amount_display || "") + (offer.months > 1 ? " · better monthly rate" : " / month")
          : "";
      }
    }

    function syncThemeTopics() {
      const nav = $("tm-topics");
      if (!nav) return;
      nav.querySelectorAll("[data-tm-topic]").forEach((btn) => {
        const on = btn.getAttribute("data-tm-topic") === __tmTopic;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function renderThemePackGrid() {
      const grid = $("tm-pack-grid");
      if (!grid) return;
      const packs = ((__tmCatalog || {}).packs) || [];
      const offer = tmStartingOffer();
      const hasSub = !!(__tmCatalog || {}).has_app_subscription;
      const state = (__tmCatalog || {}).state || {};
      const dnaActive = state.active_deck_source === "parish_dna";
      const topic = __tmTopic || "all";
      const pins = [];
      let pinIndex = 0;

      const showDna =
        !!state.has_parish_dna &&
        (topic === "all" || topic === "free" || topic === "included");

      if (showDna) {
        const dnaActions = dnaActive
          ? "<span class=\"tm-badge\">In use</span>"
          : "<button type=\"button\" class=\"tm-pin__cta tm-btn-apply-dna\">Apply</button>";
        pins.push(
          "<article class=\"tm-pin" + (dnaActive ? " is-active" : "") +
            "\" role=\"button\" tabindex=\"0\" data-tm-preview=\"dna\"" +
            " aria-label=\"Preview Parish Deck DNA\"" +
            " style=\"--tm-i:" + (pinIndex + 1) + "\">" +
            "<div class=\"tm-pin__media\">" +
              tmPinMediaHtml("parish", "Parish DNA") +
              "<div class=\"tm-pin__chrome\">" +
                "<div class=\"tm-pin__foot\">" +
                  "<div class=\"tm-pin__foot-copy\">" +
                    "<h3 class=\"tm-pin__title\">Parish Deck DNA</h3>" +
                    "<p class=\"tm-pin__by\"><strong>Your parish</strong> · Free</p>" +
                  "</div>" +
                  "<div class=\"tm-pin__foot-cta\">" + dnaActions + "</div>" +
                "</div>" +
              "</div>" +
            "</div>" +
          "</article>"
        );
        pinIndex += 1;
      }

      packs.forEach((pack) => {
        if (!tmMatchesTopic(pack, topic)) return;
        const free = !!pack.is_free;
        const owned = !!pack.owned;
        const active = !!pack.is_active;
        const placeholder = !!pack.is_placeholder;
        const buyPrice = (offer && offer.amount_display) || "₱49";
        const statusLabel = placeholder
          ? "Coming soon"
          : (free ? "Free" : (owned ? "Owned" : null));
        const tone = tmSlideTone(pack);
        const actions = tmPinActionsHtml({
          free: free,
          owned: owned,
          active: active,
          hasSub: hasSub,
          packId: pack.id,
          placeholder: placeholder,
          title: pack.title,
          priceLabel: buyPrice,
        });
        pins.push(
          "<article class=\"tm-pin" +
            (active ? " is-active" : "") +
            (placeholder ? " is-placeholder" : "") +
            "\" role=\"button\" tabindex=\"0\" data-tm-preview=\"pack\"" +
            " data-pack-id=\"" + tmEscape(pack.id || "") +
            "\" aria-label=\"Preview " + tmEscape(pack.title || "theme") +
            "\" style=\"--tm-i:" + (pinIndex + 1) + "\">" +
            "<div class=\"tm-pin__media\">" +
              tmPinMediaHtml(tone, pack.designer_label || "Designer") +
              "<div class=\"tm-pin__chrome\">" +
                "<div class=\"tm-pin__foot\">" +
                  "<div class=\"tm-pin__foot-copy\">" +
                    "<h3 class=\"tm-pin__title\">" + tmEscape(pack.title) + "</h3>" +
                    "<p class=\"tm-pin__by\"><strong>" + tmEscape(pack.designer_label || "Designer") +
                      "</strong>" + (statusLabel ? " · " + tmEscape(statusLabel) : "") + "</p>" +
                  "</div>" +
                  "<div class=\"tm-pin__foot-cta\">" + actions + "</div>" +
                "</div>" +
              "</div>" +
            "</div>" +
          "</article>"
        );
        pinIndex += 1;
      });

      if (!pins.length) {
        grid.innerHTML = "<p class=\"muted\">No themes in this topic yet.</p>";
        grid.removeAttribute("aria-busy");
        return;
      }
      grid.innerHTML = pins.join("");
      grid.removeAttribute("aria-busy");
      bindThemePinInteractions(grid);
    }

    function bindThemePinInteractions(grid) {
      if (!grid) return;
      grid.querySelectorAll(".tm-btn-apply").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          tmApplyPack(btn.dataset.packId, btn.dataset.free === "1");
        });
      });
      grid.querySelectorAll(".tm-btn-apply-dna").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await parishFetch("/api/themes/apply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source: "parish_dna" }),
            });
            if (typeof notify === "function") notify("Parish DNA applied for new Mass decks.", "success");
            await loadThemeMarketplace({ force: true });
          } catch (err) {
            if (typeof notify === "function") notify((err && err.message) || "Could not apply DNA.", "error");
          }
        });
      });
      grid.querySelectorAll(".tm-btn-buy").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (btn.dataset.needsSub === "1" && !((__tmCatalog || {}).has_app_subscription)) {
            if (typeof notify === "function") {
              notify("Subscribe to LiturgyFlow first, then you can buy theme packs.", "info");
            }
            if (typeof showRoute === "function") showRoute("/settings/billing");
            return;
          }
          openThemeBuyModal(btn.dataset.packId, btn.dataset.packTitle || "Theme");
        });
      });
      grid.querySelectorAll("[data-tm-preview]").forEach((pin) => {
        const open = () => {
          if (pin.getAttribute("data-tm-preview") === "dna") {
            openThemePreview({
              kind: "dna",
              title: "Parish Deck DNA",
              designer: "Your parish",
              tone: "parish",
              free: true,
              owned: true,
              active: (((__tmCatalog || {}).state || {}).active_deck_source === "parish_dna"),
              inspiration:
                "Built from your parish’s own Mass deck — the fonts, colors, and slide rhythm your community already knows.",
            });
            return;
          }
          const packId = pin.getAttribute("data-pack-id");
          const pack = ((((__tmCatalog || {}).packs) || []).find((p) => String(p.id) === String(packId))) || null;
          if (!pack) return;
          openThemePreview({
            kind: "pack",
            packId: pack.id,
            title: pack.title,
            designer: pack.designer_label || "Designer",
            tone: tmSlideTone(pack),
            free: !!pack.is_free,
            owned: !!pack.owned,
            active: !!pack.is_active,
            placeholder: !!pack.is_placeholder,
            inspiration: tmInspirationText(pack),
          });
        };
        pin.addEventListener("click", (e) => {
          if (e.target.closest(".tm-pin__foot-cta, .tm-pin__cta, .tm-badge, button, a")) return;
          open();
        });
        pin.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (e.target.closest(".tm-pin__foot-cta, .tm-pin__cta, button, a")) return;
          e.preventDefault();
          open();
        });
      });
    }

    function tmInspirationText(pack) {
      const desc = String((pack && pack.description) || "").trim();
      const sub = String((pack && pack.subtitle) || "").trim();
      if (desc && (!sub || desc.toLowerCase() !== sub.toLowerCase())) return desc;
      if (desc) return desc;
      if (sub) return sub;
      return "A Mass look shaped for the liturgy — quiet enough for prayer, clear enough for the assembly.";
    }

    function openThemePreview(ctx) {
      __tmPreviewCtx = ctx || null;
      const modal = $("tm-preview-modal");
      const titleEl = $("tm-preview-modal-title");
      const byEl = $("tm-preview-modal-by");
      const rail = $("tm-preview-rail");
      const inspEl = $("tm-preview-modal-inspiration");
      const inspBy = $("tm-preview-modal-inspiration-by");
      const cta = $("tm-preview-modal-cta");
      if (!modal || !rail) return;
      const tone = (ctx && ctx.tone) || "default";
      const brand = (ctx && ctx.designer) || "Mass";
      if (titleEl) titleEl.textContent = (ctx && ctx.title) || "Theme preview";
      if (byEl) {
        byEl.textContent = ctx && ctx.placeholder
          ? ((ctx.designer || "Designer") + " · Coming soon")
          : ((ctx && ctx.designer ? ctx.designer : "Designer") +
            (ctx && ctx.free ? " · Free" : (ctx && ctx.owned ? " · Owned" : "")));
      }
      if (inspEl) {
        inspEl.textContent = (ctx && ctx.inspiration) ||
          "A Mass look shaped for the liturgy — quiet enough for prayer, clear enough for the assembly.";
      }
      if (inspBy) {
        inspBy.textContent = "— " + ((ctx && ctx.designer) || "Designer");
      }
      rail.innerHTML = tmPreviewSlidesHtml(tone, brand);
      if (cta) {
        const offer = tmStartingOffer();
        const price = (offer && offer.amount_display) || "₱49";
        cta.innerHTML = tmPinActionsHtml({
          free: !!(ctx && ctx.free),
          owned: !!(ctx && ctx.owned),
          active: !!(ctx && ctx.active),
          hasSub: !!(__tmCatalog || {}).has_app_subscription,
          packId: (ctx && ctx.packId) || "",
          placeholder: !!(ctx && ctx.placeholder),
          title: (ctx && ctx.title) || "Theme",
          priceLabel: price,
        });
        if (ctx && ctx.kind === "dna" && !(ctx && ctx.active)) {
          cta.innerHTML = "<button type=\"button\" class=\"tm-pin__cta tm-btn-apply-dna\">Apply</button>";
        }
        cta.querySelectorAll(".tm-btn-apply").forEach((btn) => {
          btn.addEventListener("click", async () => {
            await tmApplyPack(btn.dataset.packId, btn.dataset.free === "1");
            closeThemePreview();
          });
        });
        cta.querySelectorAll(".tm-btn-apply-dna").forEach((btn) => {
          btn.addEventListener("click", async () => {
            try {
              await parishFetch("/api/themes/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: "parish_dna" }),
              });
              if (typeof notify === "function") notify("Parish DNA applied for new Mass decks.", "success");
              closeThemePreview();
              await loadThemeMarketplace({ force: true });
            } catch (err) {
              if (typeof notify === "function") notify((err && err.message) || "Could not apply DNA.", "error");
            }
          });
        });
        cta.querySelectorAll(".tm-btn-buy").forEach((btn) => {
          btn.addEventListener("click", () => {
            closeThemePreview();
            if (btn.dataset.needsSub === "1" && !((__tmCatalog || {}).has_app_subscription)) {
              if (typeof notify === "function") {
                notify("Subscribe to LiturgyFlow first, then you can buy theme packs.", "info");
              }
              if (typeof showRoute === "function") showRoute("/settings/billing");
              return;
            }
            openThemeBuyModal(btn.dataset.packId, btn.dataset.packTitle || "Theme");
          });
        });
      }
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    }

    function closeThemePreview() {
      __tmPreviewCtx = null;
      const modal = $("tm-preview-modal");
      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
    }

    function openThemeBuyModal(packId, title) {
      if (!((__tmCatalog || {}).has_app_subscription)) {
        if (typeof notify === "function") {
          notify("Subscribe to LiturgyFlow first, then you can buy theme packs.", "info");
        }
        if (typeof showRoute === "function") showRoute("/settings/billing");
        return;
      }
      __tmBuyPackId = packId;
      const modal = $("tm-buy-modal");
      const nameEl = $("tm-buy-pack-name");
      if (nameEl) nameEl.textContent = title || "Theme";
      renderThemeTermSelect();
      if (modal) {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
      }
    }

    function closeThemeBuyModal() {
      __tmBuyPackId = null;
      const modal = $("tm-buy-modal");
      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
    }

    async function confirmThemeBuyModal() {
      const packId = __tmBuyPackId;
      if (!packId) return;
      const confirmBtn = $("tm-buy-modal-confirm");
      if (confirmBtn) confirmBtn.disabled = true;
      try {
        const isSuper = !!(__tmCatalog || {}).is_superadmin;
        const billingOn = !!(__tmCatalog || {}).billing_enabled;
        if (isSuper || !billingOn) {
          await tmDevGrantPack(packId);
        } else {
          await tmBuyPack(packId);
        }
        closeThemeBuyModal();
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    }

    async function loadThemeMarketplace(opts) {
      const force = !!(opts && opts.force);
      const status = $("tm-status");
      if (status) status.textContent = "";

      // Returning to the tab: paint from cache — no skeleton flash.
      if (__tmCatalog && !force) {
        syncThemeTopics();
        renderThemePackGrid();
        return;
      }

      const firstLoad = !__tmCatalog;
      if (firstLoad) renderThemeSkeletons(10);
      try {
        const cur = (((__tmCatalog || {}).pricing || {}).currency) || "";
        const q = cur ? ("?currency=" + encodeURIComponent(cur)) : "";
        __tmCatalog = await parishFetch("/api/themes/catalog" + q);
        syncThemeTopics();
        renderThemePackGrid();
        if (status) status.textContent = "";
        const params = new URLSearchParams(window.location.search || "");
        if (params.get("theme_checkout") === "success") {
          if (typeof notify === "function") notify("Theme license activated.", "success");
          history.replaceState({}, "", "/themes");
        } else if (params.get("theme_checkout") === "cancel") {
          if (typeof notify === "function") notify("Theme checkout canceled.", "info");
          history.replaceState({}, "", "/themes");
        }
      } catch (err) {
        if (firstLoad) {
          const grid = $("tm-pack-grid");
          if (grid) {
            grid.innerHTML = "";
            grid.removeAttribute("aria-busy");
          }
        }
        if (status) status.textContent = (err && err.message) || "Could not load themes.";
      }
    }

    async function tmApplyPack(packId, isFree) {
      try {
        const body = isFree
          ? { source: "default" }
          : { source: "marketplace", pack_id: packId };
        await parishFetch("/api/themes/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (typeof notify === "function") notify("Theme applied for new Mass decks.", "success");
        await loadThemeMarketplace({ force: true });
      } catch (err) {
        if (typeof notify === "function") notify((err && err.message) || "Could not apply theme.", "error");
      }
    }

    async function tmBuyPack(packId) {
      const offer = tmSelectedOffer();
      if (!((__tmCatalog || {}).has_app_subscription)) {
        if (typeof notify === "function") {
          notify("Subscribe to LiturgyFlow first, then you can buy theme packs.", "info");
        }
        if (typeof showRoute === "function") showRoute("/settings/billing");
        return;
      }
      try {
        const data = await parishFetch("/api/themes/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pack_id: packId,
            interval: (offer && offer.interval) || "monthly",
            currency: (offer && offer.currency) || (((__tmCatalog || {}).pricing || {}).currency) || "php",
          }),
        });
        if (data && data.granted) {
          if (typeof notify === "function") notify("Theme activated.", "success");
          await loadThemeMarketplace({ force: true });
          return;
        }
        if (data && data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error("Checkout did not return a URL.");
      } catch (err) {
        const msg = (err && err.message) || "Checkout failed.";
        if (typeof notify === "function") notify(msg, "error");
        if (/subscribe/i.test(msg) && typeof showRoute === "function") showRoute("/settings/billing");
      }
    }

    async function tmDevGrantPack(packId) {
      const offer = tmSelectedOffer();
      if (!((__tmCatalog || {}).has_app_subscription)) {
        if (typeof notify === "function") {
          notify("Subscribe to LiturgyFlow first, then you can activate theme packs.", "info");
        }
        if (typeof showRoute === "function") showRoute("/settings/billing");
        return;
      }
      try {
        await parishFetch("/api/themes/dev-grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pack_id: packId,
            interval: (offer && offer.interval) || "monthly",
            currency: (offer && offer.currency) || (((__tmCatalog || {}).pricing || {}).currency) || "php",
          }),
        });
        if (typeof notify === "function") notify("Theme activated.", "success");
        await loadThemeMarketplace({ force: true });
      } catch (err) {
        if (typeof notify === "function") notify((err && err.message) || "Could not activate theme.", "error");
      }
    }

    function bindThemeMarketplace() {
      if (__tmBound) return;
      __tmBound = true;
      const sel = $("tm-term-select");
      if (sel) {
        sel.addEventListener("change", () => {
          renderThemeTermSelect();
        });
      }
      const segs = $("tm-term-segments");
      if (segs) {
        segs.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-tm-interval]");
          if (!btn || !sel) return;
          sel.value = btn.dataset.tmInterval;
          renderThemeTermSelect();
        });
      }
      const topics = $("tm-topics");
      if (topics) {
        topics.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-tm-topic]");
          if (!btn) return;
          __tmTopic = btn.getAttribute("data-tm-topic") || "all";
          syncThemeTopics();
          renderThemePackGrid();
        });
      }
      const closeBuy = () => closeThemeBuyModal();
      ["tm-buy-modal-close", "tm-buy-modal-cancel", "tm-buy-modal-backdrop"].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener("click", closeBuy);
      });
      const confirm = $("tm-buy-modal-confirm");
      if (confirm) confirm.addEventListener("click", () => confirmThemeBuyModal());
      const closePreview = () => closeThemePreview();
      ["tm-preview-modal-close", "tm-preview-modal-backdrop"].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener("click", closePreview);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const preview = $("tm-preview-modal");
        if (preview && preview.classList.contains("is-open")) {
          closeThemePreview();
          return;
        }
        const buy = $("tm-buy-modal");
        if (buy && buy.classList.contains("is-open")) closeThemeBuyModal();
      });
    }
