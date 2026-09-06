(function () {
  "use strict";

  const mode = window.__VERBUM_AUTH_MODE__ || "sign-in";
  const inviteOnly = !!window.__VERBUM_INVITE_ONLY__;
  const inviteValid = !!window.__VERBUM_INVITE_VALID__;
  const inviteToken = window.__VERBUM_INVITE_TOKEN__ || "";
  const inviteEmail = window.__VERBUM_INVITE_EMAIL__ || "";
  let inviteCommunityName = window.__VERBUM_INVITE_COMMUNITY_NAME__ || "";

  function $(id) {
    return document.getElementById(id);
  }

  function showError(msg) {
    const el = $("auth-error");
    if (el) {
      el.textContent = msg || "";
      el.hidden = !msg;
    }
  }

  function isAuthCallback() {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(window.location.search);
    return (
      hash.includes("access_token") ||
      params.has("code") ||
      params.get("type") === "signup" ||
      params.get("type") === "recovery" ||
      params.get("type") === "magiclink" ||
      params.get("type") === "invite"
    );
  }

  function pendingInviteKey() {
    return "verbum:pending-invite";
  }

  function stashPendingInvite(token) {
    if (!token) return;
    try {
      sessionStorage.setItem(pendingInviteKey(), token);
    } catch (_e) { /* ignore */ }
  }

  function takePendingInvite() {
    try {
      const token = sessionStorage.getItem(pendingInviteKey()) || "";
      sessionStorage.removeItem(pendingInviteKey());
      return token;
    } catch (_e) {
      return "";
    }
  }

  function wantsSwitchAccount() {
    return new URLSearchParams(window.location.search).get("switch") === "1";
  }

  function clearSwitchAccountParam() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("switch")) return;
      url.searchParams.delete("switch");
      const next = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
      window.history.replaceState({}, "", next);
    } catch (_e) { /* ignore */ }
  }

  function clearSuperadminUnlockCache() {
    try { sessionStorage.removeItem("verbum:sa-unlocked"); } catch (_e) { /* ignore */ }
  }

  function applyInviteChurchName(name) {
    const churchInput = $("auth-church-name");
    const clean = (name || "").trim();
    if (clean) {
      inviteCommunityName = clean;
    }
    if (!churchInput) return;
    churchInput.value = inviteCommunityName;
    if (inviteOnly && inviteToken) {
      churchInput.readOnly = true;
      churchInput.setAttribute("aria-readonly", "true");
      churchInput.tabIndex = -1;
      const hint = $("auth-church-name-hint");
      if (hint) hint.hidden = false;
    } else if (inviteCommunityName) {
      churchInput.readOnly = true;
      churchInput.setAttribute("aria-readonly", "true");
      churchInput.tabIndex = -1;
      const hint = $("auth-church-name-hint");
      if (hint) hint.hidden = false;
    } else {
      churchInput.readOnly = false;
      churchInput.removeAttribute("aria-readonly");
      churchInput.tabIndex = 0;
      churchInput.placeholder = "Gwangju Filipino Catholic Community";
    }
  }

  async function consumeInvite(token, accessToken) {
    if (!token || !accessToken) return;
    try {
      const res = await fetch("/api/auth/invite/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Could not apply invite.");
      }
    } catch (err) {
      showError((err && err.message) || "Account created, but the invite could not be applied.");
    }
  }

  function showInviteBlocked() {
    const loading = $("auth-loading");
    const blocked = $("auth-invite-blocked");
    const form = $("auth-form");
    const footer = $("auth-footer");
    if (loading) loading.remove();
    if (form) form.hidden = true;
    if (footer) footer.hidden = true;
    if (blocked) blocked.hidden = false;
  }

  async function boot() {
    const loading = $("auth-loading");
    const form = $("auth-form");
    const signupFields = $("auth-signup-fields");
    const sessionPanel = $("auth-session-panel");
    const footer = document.querySelector(".auth-footer");
    const blocked = $("auth-invite-blocked");

    try {
      const res = await fetch("/api/auth/config");
      const cfg = await res.json();
      if (!cfg.auth_enabled) {
        if (loading) loading.textContent = "Authentication is not configured on this server.";
        return;
      }

      const inviteSignupBlocked =
        mode === "sign-up" && cfg.invite_only_signup && !inviteValid;

      if (mode === "sign-up" && inviteToken) {
        try {
          const validateRes = await fetch(
            "/api/auth/invite/validate?token=" + encodeURIComponent(inviteToken)
          );
          const validateData = await validateRes.json();
          if (validateData.ok && validateData.community_name) {
            applyInviteChurchName(validateData.community_name);
          }
          if (validateData.ok && validateData.existing_parish) {
            const hint = $("auth-church-name-hint");
            if (hint) {
              hint.textContent = "You will join this parish as " +
                (validateData.invite_role === "president" ? "president" : "media team") +
                " when signup completes.";
              hint.hidden = false;
            }
          }
        } catch (_e) {
          /* non-blocking */
        }
      }

      if (mode === "sign-up") {
        applyInviteChurchName(inviteCommunityName);
      }

      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Could not load Supabase."));
        document.head.appendChild(script);
      });

      const createClient = window.supabase && window.supabase.createClient;
      if (!createClient) throw new Error("Supabase SDK missing.");

      const publishableKey =
        cfg.supabase_publishable_key || cfg.supabase_anon_key;
      const client = createClient(cfg.supabase_url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      function setMobileWelcomePending() {
        try {
          sessionStorage.setItem("verbum:mobile-welcome-pending", "1");
        } catch (_e) { /* ignore */ }
      }

      function resolvePostAuthUrl() {
        const params = new URLSearchParams(window.location.search);
        let target = params.get("redirect_url") || cfg.after_sign_in_url || "/home";
        const siblingIntent = (params.get("intent") || "").trim().toLowerCase();
        const siblingDate = (params.get("date") || "").trim();
        const siblingHandoff = (params.get("handoff") || "").trim();
        try {
          const parsed = new URL(target, window.location.origin);
          // Marketing root (/) or stay flag — send signed-in users into the app.
          if (
            parsed.pathname === "/" ||
            parsed.pathname === "" ||
            parsed.searchParams.get("stay") === "1"
          ) {
            target = "/home";
          } else {
            target = parsed.pathname + (parsed.search || "") + (parsed.hash || "");
          }
        } catch (_e) {
          target = "/home";
        }
        try {
          const next = new URL(target, window.location.origin);
          next.searchParams.delete("stay");
          if (siblingIntent && !next.searchParams.get("intent")) {
            next.searchParams.set("intent", siblingIntent);
          }
          if (siblingDate && /^\d{4}-\d{2}-\d{2}$/.test(siblingDate) && !next.searchParams.get("date")) {
            next.searchParams.set("date", siblingDate);
          }
          if (siblingHandoff && !next.searchParams.get("handoff")) {
            next.searchParams.set("handoff", siblingHandoff);
          }
          const intent = (next.searchParams.get("intent") || "").trim().toLowerCase();
          if (intent === "practice-share") {
            next.pathname = "/home";
          }
          if (intent === "practice-lyrics") {
            next.pathname = "/mass/builder";
          }
          // Email CTAs already have a destination — skip the mobile welcome popup.
          if (intent !== "practice-share" && intent !== "generate" && intent !== "practice-lyrics") {
            next.searchParams.set("welcome", "1");
          }
          return next.pathname + next.search + next.hash;
        } catch (_e2) {
          return "/home?welcome=1";
        }
      }

      function onboardingUrl() {
        const params = new URLSearchParams(window.location.search);
        params.set("complete", "1");
        params.delete("code");
        params.delete("error");
        params.delete("error_description");
        params.delete("error_code");
        params.delete("switch");
        const qs = params.toString();
        return "/sign-up" + (qs ? "?" + qs : "");
      }

      function redirectAfterAuth() {
        const dest = resolvePostAuthUrl();
        try {
          const next = new URL(dest, window.location.origin);
          const intent = (next.searchParams.get("intent") || "").trim().toLowerCase();
          if (intent !== "practice-share" && intent !== "generate" && intent !== "practice-lyrics") {
            setMobileWelcomePending();
          }
        } catch (_e) {
          setMobileWelcomePending();
        }
        window.location.href = dest;
      }

      async function fetchOnboardingStatus(accessToken) {
        if (!accessToken) return null;
        try {
          const res = await fetch("/api/auth/onboarding", {
            headers: { Authorization: "Bearer " + accessToken },
          });
          if (!res.ok) return null;
          return await res.json();
        } catch (_e) {
          return null;
        }
      }

      function prefillOnboardingForm(status) {
        const profile = (status && status.profile) || {};
        const church = (status && status.church_profile) || {};
        const first = $("auth-first-name");
        const middle = $("auth-middle-name");
        const last = $("auth-last-name");
        const phone = $("auth-phone");
        const role = $("auth-ministry-role");
        const roleOther = $("auth-role-other");
        const churchInput = $("auth-church-name");
        if (first && !first.value && profile.first_name) first.value = profile.first_name;
        if (middle && !middle.value && profile.middle_name) middle.value = profile.middle_name;
        if (last && !last.value && profile.last_name) last.value = profile.last_name;
        if (role && !role.value && profile.ministry_role) setMinistryRole(profile.ministry_role);
        if (roleOther && !roleOther.value && profile.ministry_role_other) roleOther.value = profile.ministry_role_other;
        if (profile.phone) {
          const parsed = splitPhoneE164(profile.phone);
          if (parsed.country) {
            const opt = countryByCode(parsed.country);
            if (opt) setSelectedCountry(opt);
            else {
              const hidden = $("auth-phone-country");
              const display = $("auth-phone-code-display");
              if (hidden) hidden.value = parsed.country;
              if (display) display.textContent = parsed.country;
            }
          }
          if (phone && !phone.value) phone.value = parsed.national;
        }
        setRoleOtherVisibility();
        if (churchInput && !churchInput.value) {
          if (inviteCommunityName) {
            applyInviteChurchName(inviteCommunityName);
          } else if (church.community_name) {
            churchInput.value = church.community_name;
            if (church.community_name_locked) {
              churchInput.readOnly = true;
              churchInput.setAttribute("aria-readonly", "true");
            }
          }
        }
        const emailInput = $("auth-email");
        if (emailInput && profile.email) {
          emailInput.value = profile.email;
        }
      }

      const COUNTRY_DIAL_OPTIONS = [
        { name: "Philippines", code: "+63", iso: "PH" },
        { name: "South Korea", code: "+82", iso: "KR" },
        { name: "United States", code: "+1", iso: "US" },
        { name: "Canada", code: "+1", iso: "CA" },
        { name: "United Kingdom", code: "+44", iso: "GB" },
        { name: "Australia", code: "+61", iso: "AU" },
        { name: "Japan", code: "+81", iso: "JP" },
        { name: "Singapore", code: "+65", iso: "SG" },
        { name: "Malaysia", code: "+60", iso: "MY" },
        { name: "United Arab Emirates", code: "+971", iso: "AE" },
        { name: "Saudi Arabia", code: "+966", iso: "SA" },
        { name: "Italy", code: "+39", iso: "IT" },
        { name: "Spain", code: "+34", iso: "ES" },
        { name: "France", code: "+33", iso: "FR" },
        { name: "Germany", code: "+49", iso: "DE" },
        { name: "Ireland", code: "+353", iso: "IE" },
        { name: "New Zealand", code: "+64", iso: "NZ" },
        { name: "Hong Kong", code: "+852", iso: "HK" },
        { name: "Taiwan", code: "+886", iso: "TW" },
        { name: "India", code: "+91", iso: "IN" },
        { name: "Brazil", code: "+55", iso: "BR" },
        { name: "Mexico", code: "+52", iso: "MX" },
        { name: "Indonesia", code: "+62", iso: "ID" },
        { name: "Vietnam", code: "+84", iso: "VN" },
        { name: "Thailand", code: "+66", iso: "TH" },
        { name: "Qatar", code: "+974", iso: "QA" },
        { name: "Kuwait", code: "+965", iso: "KW" },
        { name: "Bahrain", code: "+973", iso: "BH" },
        { name: "Netherlands", code: "+31", iso: "NL" },
        { name: "Belgium", code: "+32", iso: "BE" },
        { name: "Switzerland", code: "+41", iso: "CH" },
        { name: "Austria", code: "+43", iso: "AT" },
        { name: "Portugal", code: "+351", iso: "PT" },
        { name: "Poland", code: "+48", iso: "PL" },
        { name: "China", code: "+86", iso: "CN" },
      ];

      function splitPhoneE164(raw) {
        const value = String(raw || "").trim();
        const sorted = COUNTRY_DIAL_OPTIONS
          .map(function (c) { return c.code; })
          .filter(function (v, i, a) { return a.indexOf(v) === i; })
          .sort(function (a, b) { return b.length - a.length; });
        for (let i = 0; i < sorted.length; i++) {
          const code = sorted[i];
          if (value.startsWith(code)) {
            return { country: code, national: value.slice(code.length).replace(/\D/g, "") };
          }
        }
        if (value.startsWith("+")) {
          const m = value.match(/^\+(\d{1,4})/);
          if (m) {
            return {
              country: "+" + m[1],
              national: value.slice(m[0].length).replace(/\D/g, ""),
            };
          }
        }
        return { country: "", national: value.replace(/\D/g, "") };
      }

      function defaultPhoneCountry() {
        try {
          const lang = String(navigator.language || navigator.userLanguage || "").toLowerCase();
          const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
          if (tz.indexOf("seoul") >= 0 || lang.indexOf("ko") === 0 || /-(kr)\b/.test(lang)) return "+82";
          if (tz.indexOf("manila") >= 0 || lang.indexOf("fil") === 0 || lang.indexOf("tl") === 0 || /-(ph)\b/.test(lang)) return "+63";
          if (/-(gb|uk)\b/.test(lang) || tz.indexOf("london") >= 0) return "+44";
          if (/-(au)\b/.test(lang) || tz.indexOf("sydney") >= 0 || tz.indexOf("melbourne") >= 0) return "+61";
          if (/-(jp)\b/.test(lang) || tz.indexOf("tokyo") >= 0) return "+81";
          if (/-(sg)\b/.test(lang) || tz.indexOf("singapore") >= 0) return "+65";
          if (/-(my)\b/.test(lang) || tz.indexOf("kuala_lumpur") >= 0) return "+60";
          if (/-(ae)\b/.test(lang) || tz.indexOf("dubai") >= 0) return "+971";
          if (/-(sa)\b/.test(lang) || tz.indexOf("riyadh") >= 0) return "+966";
          if (/-(ca)\b/.test(lang) || tz.indexOf("toronto") >= 0 || tz.indexOf("vancouver") >= 0) return "+1";
          if (/-(us)\b/.test(lang) || tz.indexOf("new_york") >= 0 || tz.indexOf("los_angeles") >= 0) return "+1";
        } catch (_e) { /* ignore */ }
        return "+63";
      }

      function flagEmoji(iso) {
        const code = String(iso || "").toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) return "";
        return String.fromCodePoint(
          127397 + code.charCodeAt(0),
          127397 + code.charCodeAt(1)
        );
      }

      function countryLabel(opt) {
        if (!opt) return "";
        const flag = flagEmoji(opt.iso);
        return (flag ? flag + " " : "") + opt.name;
      }

      function countryByCode(code) {
        const needle = String(code || "").trim();
        for (let i = 0; i < COUNTRY_DIAL_OPTIONS.length; i++) {
          if (COUNTRY_DIAL_OPTIONS[i].code === needle) return COUNTRY_DIAL_OPTIONS[i];
        }
        return null;
      }

      function scoreCountryMatch(opt, query) {
        const q = String(query || "").trim().toLowerCase().replace(/\s*\(\+\d+\)\s*$/, "");
        if (!q) return 0;
        const name = opt.name.toLowerCase();
        const iso = opt.iso.toLowerCase();
        const code = opt.code.toLowerCase();
        const qDigits = q.replace(/\s/g, "");
        if (name === q || iso === q) return 100;
        if (name.startsWith(q)) return 90 - Math.min(name.length, 30);
        if (iso.startsWith(q)) return 85;
        if (code.indexOf(qDigits) === 0 || code.indexOf(qDigits) > 0) return 75;
        const idx = name.indexOf(q);
        if (idx >= 0) return 60 - Math.min(idx, 20);
        return 0;
      }

      function closestCountry(query) {
        let best = null;
        let bestScore = 0;
        for (let i = 0; i < COUNTRY_DIAL_OPTIONS.length; i++) {
          const score = scoreCountryMatch(COUNTRY_DIAL_OPTIONS[i], query);
          if (score > bestScore) {
            bestScore = score;
            best = COUNTRY_DIAL_OPTIONS[i];
          }
        }
        return bestScore > 0 ? best : null;
      }

      function applyCountryDial(opt) {
        const hidden = $("auth-phone-country");
        const display = $("auth-phone-code-display");
        if (!opt) {
          if (hidden) hidden.value = "";
          if (display) display.textContent = "+";
          return;
        }
        if (hidden) hidden.value = opt.code;
        if (display) display.textContent = opt.code;
      }

      function showCountryChip(opt) {
        const picker = $("auth-country-picker");
        const chip = $("auth-country-chip");
        const flag = $("auth-country-chip-flag");
        const label = $("auth-country-chip-label");
        const filter = $("auth-country-filter");
        if (!opt || !chip) return;
        if (flag) flag.textContent = flagEmoji(opt.iso);
        if (label) label.textContent = opt.name;
        chip.hidden = false;
        if (picker) picker.classList.add("is-selected");
        if (filter) filter.value = "";
      }

      function hideCountryChip() {
        const picker = $("auth-country-picker");
        const chip = $("auth-country-chip");
        const flag = $("auth-country-chip-flag");
        const label = $("auth-country-chip-label");
        if (chip) chip.hidden = true;
        if (flag) flag.textContent = "";
        if (label) label.textContent = "";
        if (picker) picker.classList.remove("is-selected");
      }

      function clearSelectedCountry(focusInput) {
        applyCountryDial(null);
        hideCountryChip();
        const filter = $("auth-country-filter");
        if (filter) {
          filter.value = "";
          filter.dataset.userCleared = "1";
          if (focusInput) {
            filter.focus();
            window.setTimeout(function () {
              renderCountryMenu("");
              openCountryMenu();
            }, 0);
          } else {
            closeCountryMenu();
          }
        } else {
          closeCountryMenu();
        }
      }

      function setSelectedCountry(opt, opts) {
        const options = opts || {};
        if (!opt) return;
        const filter = $("auth-country-filter");
        if (filter) delete filter.dataset.userCleared;
        applyCountryDial(opt);
        if (options.previewOnly) return;
        showCountryChip(opt);
        if (!options.keepOpen) closeCountryMenu();
      }

      function pinAuthDropdown(panel, anchor) {
        if (!panel || !anchor) return;
        const rect = anchor.getBoundingClientRect();
        const maxH = Math.min(240, window.innerHeight * 0.42);
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const openUp = spaceBelow < 120 && rect.top > spaceBelow;
        panel.style.position = "fixed";
        panel.style.left = Math.max(8, rect.left) + "px";
        panel.style.width = Math.max(160, rect.width) + "px";
        panel.style.right = "auto";
        panel.style.zIndex = "10000";
        panel.style.maxHeight = Math.min(maxH, openUp ? rect.top - 12 : spaceBelow) + "px";
        if (openUp) {
          panel.style.top = "auto";
          panel.style.bottom = window.innerHeight - rect.top + 6 + "px";
        } else {
          panel.style.bottom = "auto";
          panel.style.top = rect.bottom + 6 + "px";
        }
      }

      function unpinAuthDropdown(panel) {
        if (!panel) return;
        panel.style.position = "";
        panel.style.left = "";
        panel.style.right = "";
        panel.style.top = "";
        panel.style.bottom = "";
        panel.style.width = "";
        panel.style.zIndex = "";
        panel.style.maxHeight = "";
      }

      function closeCountryMenu() {
        const menu = $("auth-country-menu");
        const filter = $("auth-country-filter");
        if (menu) {
          menu.hidden = true;
          menu.classList.remove("is-open");
          unpinAuthDropdown(menu);
        }
        if (filter) filter.setAttribute("aria-expanded", "false");
      }

      function openCountryMenu() {
        const menu = $("auth-country-menu");
        const filter = $("auth-country-filter");
        const chip = $("auth-country-chip");
        const picker = $("auth-country-picker");
        const anchor =
          picker && picker.classList.contains("is-selected") && chip && !chip.hidden
            ? chip
            : filter;
        if (menu) {
          menu.hidden = false;
          menu.classList.add("is-open");
          pinAuthDropdown(menu, anchor || filter);
        }
        if (filter) filter.setAttribute("aria-expanded", "true");
      }

      function renderCountryMenu(query) {
        const menu = $("auth-country-menu");
        if (!menu) return;
        const q = String(query || "").trim();
        const ranked = COUNTRY_DIAL_OPTIONS
          .map(function (c) {
            return { opt: c, score: q ? scoreCountryMatch(c, q) : 1 };
          })
          .filter(function (row) {
            return row.score > 0;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, 8);
        const closest = ranked.length ? ranked[0].opt : null;
        menu.innerHTML = "";
        if (!ranked.length) {
          const empty = document.createElement("li");
          empty.innerHTML = '<button type="button" class="auth-dropdown-item is-empty" tabindex="-1">No matching country</button>';
          menu.appendChild(empty);
        } else {
          ranked.forEach(function (row, index) {
            const c = row.opt;
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "auth-dropdown-item" + (index === 0 ? " is-active" : "");
            btn.setAttribute("role", "option");
            btn.dataset.code = c.code;
            btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
            btn.innerHTML =
              '<span class="auth-flag" aria-hidden="true">' +
              flagEmoji(c.iso) +
              "</span><span>" +
              c.name +
              " · " +
              c.code +
              "</span>";
            btn.addEventListener("mousedown", function (e) {
              e.preventDefault();
              setSelectedCountry(c);
            });
            li.appendChild(btn);
            menu.appendChild(li);
          });
          // Only preview dial while typing — never auto-fill on empty/open-all list.
          if (q && closest) applyCountryDial(closest);
        }
        openCountryMenu();
      }

      function applyDefaultPhoneCountry() {
        /* Do not auto-select a country — user must choose one. */
        const hidden = $("auth-phone-country");
        const display = $("auth-phone-code-display");
        if (hidden && !(hidden.value || "").trim()) {
          if (display) display.textContent = "+";
          hideCountryChip();
          const filter = $("auth-country-filter");
          if (filter) filter.value = "";
        } else if (hidden && (hidden.value || "").trim()) {
          const existing = countryByCode(hidden.value);
          if (existing) setSelectedCountry(existing);
        }
      }

      function bindPhoneDigitsOnly() {
        const phone = $("auth-phone");
        if (!phone || phone.dataset.digitsBound) return;
        phone.dataset.digitsBound = "1";
        phone.addEventListener("input", function () {
          const cleaned = phone.value.replace(/[^\d\s\-()]/g, "");
          if (cleaned !== phone.value) phone.value = cleaned;
        });
        phone.addEventListener("keypress", function (e) {
          if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
          if (/[A-Za-z]/.test(e.key)) e.preventDefault();
        });
      }

      function bindPhoneCountryInput() {
        const filter = $("auth-country-filter");
        const clearBtn = $("auth-country-clear");
        if (clearBtn && !clearBtn.dataset.bound) {
          clearBtn.dataset.bound = "1";
          clearBtn.addEventListener("mousedown", function (e) {
            e.preventDefault();
          });
          clearBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            clearSelectedCountry(true);
          });
        }
        const chip = $("auth-country-chip");
        if (chip && !chip.dataset.bound) {
          chip.dataset.bound = "1";
          chip.addEventListener("click", function (e) {
            if (e.target && e.target.closest && e.target.closest("#auth-country-clear")) return;
            clearSelectedCountry(true);
          });
        }
        if (!filter || filter.dataset.bound) return;
        filter.dataset.bound = "1";
        filter.addEventListener("focus", function () {
          hideCountryChip();
          renderCountryMenu(filter.value);
        });
        filter.addEventListener("input", function () {
          if (filter.value.trim()) delete filter.dataset.userCleared;
          hideCountryChip();
          renderCountryMenu(filter.value);
        });
        filter.addEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            closeCountryMenu();
            filter.blur();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (!String(filter.value || "").trim()) return;
            const menu = $("auth-country-menu");
            const first = menu && menu.querySelector(".auth-dropdown-item[data-code]");
            if (first) {
              const opt = countryByCode(first.dataset.code);
              if (opt) setSelectedCountry(opt);
            } else {
              const closest = closestCountry(filter.value);
              if (closest) setSelectedCountry(closest);
            }
          }
        });
        filter.addEventListener("blur", function () {
          setTimeout(function () {
            const picker = $("auth-country-picker");
            if (picker && picker.classList.contains("is-selected")) {
              closeCountryMenu();
              return;
            }
            const typed = String(filter.value || "").trim();
            if (filter.dataset.userCleared === "1" || !typed) {
              applyCountryDial(null);
              hideCountryChip();
              closeCountryMenu();
              return;
            }
            const closest = closestCountry(typed);
            if (closest) setSelectedCountry(closest);
            else closeCountryMenu();
          }, 140);
        });
      }

      const ROLE_LABELS = {
        media_officer: "Media & Projection",
        choir_leader: "Choir / Music Ministry",
        secretary: "Parish Secretary",
        priest: "Priest / Clergy",
        volunteer: "Volunteer",
        other: "Other",
      };

      function closeRoleMenu() {
        const menu = $("auth-role-menu");
        const trigger = $("auth-role-trigger");
        if (menu) {
          menu.hidden = true;
          menu.classList.remove("is-open");
          unpinAuthDropdown(menu);
        }
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      }

      function openRoleMenu() {
        const menu = $("auth-role-menu");
        const trigger = $("auth-role-trigger");
        if (menu) {
          menu.hidden = false;
          menu.classList.add("is-open");
          pinAuthDropdown(menu, trigger);
        }
        if (trigger) trigger.setAttribute("aria-expanded", "true");
      }

      function setMinistryRole(value) {
        const hidden = $("auth-ministry-role");
        const label = $("auth-role-value");
        const clean = String(value || "").trim();
        if (hidden) hidden.value = clean;
        if (label) {
          if (clean && ROLE_LABELS[clean]) {
            label.textContent = ROLE_LABELS[clean];
            label.classList.remove("is-placeholder");
          } else {
            label.textContent = "Select a Role";
            label.classList.add("is-placeholder");
          }
        }
        const menu = $("auth-role-menu");
        if (menu) {
          menu.querySelectorAll(".auth-dropdown-item[data-value]").forEach(function (btn) {
            const selected = btn.dataset.value === clean;
            btn.setAttribute("aria-selected", selected ? "true" : "false");
            btn.classList.toggle("is-active", selected);
          });
        }
        setRoleOtherVisibility();
        closeRoleMenu();
      }

      function bindRoleSelect() {
        const trigger = $("auth-role-trigger");
        const menu = $("auth-role-menu");
        if (!trigger || !menu || trigger.dataset.bound) return;
        trigger.dataset.bound = "1";
        trigger.addEventListener("click", function () {
          const open = trigger.getAttribute("aria-expanded") === "true";
          if (open) closeRoleMenu();
          else {
            closeCountryMenu();
            openRoleMenu();
          }
        });
        menu.querySelectorAll(".auth-dropdown-item[data-value]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            setMinistryRole(btn.dataset.value);
          });
        });
        document.addEventListener("click", function (e) {
          const root = $("auth-role-select");
          if (!root) return;
          if (!root.contains(e.target) && !(menu && menu.contains(e.target))) closeRoleMenu();
        });
        if (!window.__authDropdownPinBound) {
          window.__authDropdownPinBound = true;
          window.addEventListener(
            "resize",
            function () {
              const countryMenu = $("auth-country-menu");
              const roleMenu = $("auth-role-menu");
              if (countryMenu && countryMenu.classList.contains("is-open")) openCountryMenu();
              if (roleMenu && roleMenu.classList.contains("is-open")) openRoleMenu();
            },
            { passive: true }
          );
          window.addEventListener(
            "scroll",
            function () {
              const countryMenu = $("auth-country-menu");
              const roleMenu = $("auth-role-menu");
              if (countryMenu && countryMenu.classList.contains("is-open")) closeCountryMenu();
              if (roleMenu && roleMenu.classList.contains("is-open")) closeRoleMenu();
            },
            true
          );
        }
      }

      function setRoleOtherVisibility() {
        const role = $("auth-ministry-role");
        const wrap = $("auth-role-other-wrap");
        if (!role || !wrap) return;
        wrap.hidden = role.value !== "other";
      }

      function selectedSurveySources() {
        return Array.prototype.slice
          .call(document.querySelectorAll('input[name="auth-survey-source"]:checked'))
          .map(function (el) {
            return el.value;
          });
      }

      function setSurveyOtherVisibility() {
        const wrap = $("auth-survey-other-wrap");
        if (!wrap) return;
        wrap.hidden = selectedSurveySources().indexOf("other") < 0;
      }

      function bindSurveyChecks() {
        const root = $("auth-survey-sources");
        if (!root || root.dataset.bound) return;
        root.dataset.bound = "1";
        root.addEventListener("change", setSurveyOtherVisibility);
        setSurveyOtherVisibility();
      }

      function bindLetterOnlyNames() {
        ["auth-first-name", "auth-middle-name", "auth-last-name"].forEach(function (id) {
          const el = $(id);
          if (!el || el.dataset.lettersBound) return;
          el.dataset.lettersBound = "1";
          el.addEventListener("input", function () {
            const cleaned = el.value.replace(/[^\p{L}\s'\-.]/gu, "");
            if (cleaned !== el.value) el.value = cleaned;
          });
        });
      }

      function isLettersName(value) {
        const clean = String(value || "").trim();
        if (!clean) return false;
        return /^[\p{L}][\p{L}\s'\-.]*$/u.test(clean);
      }

      let signupStep = 1;
      let stepAnimating = false;

      function lockStepsHeight() {
        const stage = $("auth-form-stage");
        const wrap = $("auth-steps");
        const step1 = $("auth-step-1");
        const step2 = $("auth-step-2");
        if (stage) stage.style.minHeight = "";
        if (!wrap) return;
        const active = signupStep === 2 ? step2 : step1;
        if (!active || active.hidden) {
          wrap.style.minHeight = "";
          return;
        }
        wrap.style.minHeight = active.offsetHeight + "px";
      }

      function applyStepChrome() {
        const backBtn = $("auth-step-back");
        const nextBtn = $("auth-step-next");
        const submitBtn = $("auth-submit");
        const submitSimple = $("auth-submit-simple");
        const stepNav = $("auth-step-nav");
        const creds = $("auth-credentials-fields");
        const onboardingMode = form && form.dataset.onboardingMode === "1";
        const multiStep = mode === "sign-up" || onboardingMode;

        if (!multiStep) {
          if (stepNav) stepNav.hidden = true;
          if (submitSimple) {
            submitSimple.hidden = false;
            submitSimple.textContent = "Sign in";
          }
          if (submitBtn) submitBtn.hidden = true;
          if (creds) creds.hidden = false;
          return;
        }

        if (submitSimple) submitSimple.hidden = true;
        if (stepNav) {
          stepNav.hidden = false;
          stepNav.classList.toggle("is-step1", signupStep === 1);
        }
        if (backBtn) backBtn.hidden = signupStep !== 2;
        if (nextBtn) nextBtn.hidden = signupStep !== 1;
        if (submitBtn) {
          submitBtn.hidden = signupStep !== 2;
          submitBtn.textContent = onboardingMode ? "Complete signup" : "Create account";
        }
        if (creds) {
          if (onboardingMode) creds.hidden = true;
          else creds.hidden = signupStep !== 2;
        }
      }

      function setSignupStep(step, options) {
        const opts = options || {};
        const next = step === 2 ? 2 : 1;
        const step1 = $("auth-step-1");
        const step2 = $("auth-step-2");
        const onboardingMode = form && form.dataset.onboardingMode === "1";
        const multiStep = mode === "sign-up" || onboardingMode;
        const animate = !!opts.animate && multiStep && !stepAnimating && signupStep !== next;

        if (!multiStep) {
          signupStep = 1;
          if (step1) {
            step1.hidden = true;
            step1.classList.remove("is-active");
          }
          if (step2) {
            step2.hidden = true;
            step2.classList.remove("is-active");
          }
          applyStepChrome();
          return;
        }

        if (!animate) {
          signupStep = next;
          if (step1) {
            step1.hidden = signupStep !== 1;
            step1.classList.toggle("is-active", signupStep === 1);
            step1.classList.remove("is-animating", "is-leave-next", "is-leave-back", "is-enter-next", "is-enter-back");
          }
          if (step2) {
            step2.hidden = signupStep !== 2;
            step2.classList.toggle("is-active", signupStep === 2);
            step2.classList.remove("is-animating", "is-leave-next", "is-leave-back", "is-enter-next", "is-enter-back");
          }
          applyStepChrome();
          lockStepsHeight();
          return;
        }

        const from = signupStep;
        const leaving = from === 1 ? step1 : step2;
        const entering = next === 1 ? step1 : step2;
        if (!leaving || !entering) {
          signupStep = next;
          applyStepChrome();
          return;
        }
        stepAnimating = true;
        const leaveClass = from < next ? "is-leave-next" : "is-leave-back";
        const enterClass = from < next ? "is-enter-next" : "is-enter-back";
        entering.hidden = false;
        entering.classList.add("is-animating", enterClass);
        entering.classList.remove("is-active");
        leaving.classList.add("is-animating", leaveClass);
        leaving.classList.remove("is-active");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            entering.classList.remove(enterClass);
            entering.classList.add("is-active");
          });
        });
        window.setTimeout(function () {
          leaving.hidden = true;
          leaving.classList.remove("is-animating", leaveClass, "is-enter-next", "is-enter-back");
          entering.classList.remove("is-animating", enterClass);
          signupStep = next;
          stepAnimating = false;
          applyStepChrome();
          lockStepsHeight();
        }, 300);
      }

      function clearFieldErrors() {
        document.querySelectorAll(".field.is-invalid, .field.is-shaking").forEach(function (field) {
          field.classList.remove("is-invalid");
          field.classList.remove("is-shaking");
          const tip = field.querySelector(".auth-field-error");
          if (tip) {
            tip.textContent = "";
            tip.hidden = true;
          }
        });
      }

      function setFieldError(controlId, message) {
        const control = $(controlId);
        if (!control) return;
        const field = control.closest ? control.closest(".field") : null;
        if (!field) return;
        field.classList.add("is-invalid");
        field.classList.remove("is-shaking");
        // Restart shake animation
        void field.offsetWidth;
        field.classList.add("is-shaking");
        window.setTimeout(function () {
          field.classList.remove("is-shaking");
        }, 1000);
        let tip = field.querySelector(".auth-field-error");
        if (!tip) {
          tip = document.createElement("p");
          tip.className = "auth-field-error";
          tip.setAttribute("role", "alert");
          field.appendChild(tip);
        }
        tip.textContent = message || "";
        tip.hidden = !message;
      }

      function focusFirstInvalid() {
        const field = document.querySelector(".field.is-invalid");
        if (!field) return;
        const focusable = field.querySelector(
          "input:not([type='hidden']):not([type='checkbox']), button.auth-vb-select__trigger, .auth-check input"
        );
        if (focusable && typeof focusable.focus === "function") {
          try { focusable.focus(); } catch (_e) { /* ignore */ }
        }
        try {
          field.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (_e2) { /* ignore */ }
      }

      function validateStep1(opts) {
        const options = opts || {};
        if (!options.skipClear) clearFieldErrors();
        const details = collectSignupDetails();
        let firstMsg = "";
        function fail(id, msg) {
          setFieldError(id, msg);
          if (!firstMsg) firstMsg = msg;
        }
        if (!details.firstName) fail("auth-first-name", "First Name is required.");
        else if (!isLettersName(details.firstName)) fail("auth-first-name", "First Name can only include letters.");
        if (details.middleName && !isLettersName(details.middleName)) {
          fail("auth-middle-name", "Middle Name can only include letters.");
        }
        if (!details.lastName) fail("auth-last-name", "Last Name is required.");
        else if (!isLettersName(details.lastName)) fail("auth-last-name", "Last Name can only include letters.");
        if (!details.countryCode) fail("auth-country-filter", "Please select your country.");
        if (!details.phoneNational || details.phoneNational.length < 7) {
          fail("auth-phone", "Please enter a valid phone number.");
        }
        if (!details.ministryRole) fail("auth-role-trigger", "Please select your parish role.");
        if (details.ministryRole === "other" && details.ministryRoleOther.length < 2) {
          fail("auth-role-other", "Please describe your role.");
        }
        if (firstMsg && !options.skipFocus) focusFirstInvalid();
        return firstMsg;
      }

      function validateStep2(opts) {
        const options = opts || {};
        if (!options.skipClear) clearFieldErrors();
        const details = collectSignupDetails();
        let firstMsg = "";
        function fail(id, msg) {
          setFieldError(id, msg);
          if (!firstMsg) firstMsg = msg;
        }
        if (!details.churchName || details.churchName.length < 2) {
          fail("auth-church-name", "Church/Community Name is required.");
        }
        if (!details.surveySources.length) {
          fail("auth-survey-sources", "Please tell us how you heard about LiturgyFlow.");
        }
        if (details.surveySources.indexOf("other") >= 0 && details.surveyOther.length < 2) {
          fail("auth-survey-other", "Please specify how you heard about us.");
        }
        if (firstMsg && !options.skipFocus) focusFirstInvalid();
        return firstMsg;
      }

      function bindStepNav() {
        const nextBtn = $("auth-step-next");
        const backBtn = $("auth-step-back");
        if (nextBtn && !nextBtn.dataset.bound) {
          nextBtn.dataset.bound = "1";
          nextBtn.addEventListener("click", function () {
            showError("");
            const err = validateStep1();
            if (err) return;
            setSignupStep(2, { animate: true });
          });
        }
        if (backBtn && !backBtn.dataset.bound) {
          backBtn.dataset.bound = "1";
          backBtn.addEventListener("click", function () {
            showError("");
            clearFieldErrors();
            setSignupStep(1, { animate: true });
          });
        }
        bindPhoneCountryInput();
        bindPhoneDigitsOnly();
        bindRoleSelect();
        bindSurveyChecks();
        bindLetterOnlyNames();
        setRoleOtherVisibility();
        ["auth-first-name", "auth-middle-name", "auth-last-name", "auth-phone", "auth-role-other", "auth-church-name", "auth-survey-other", "auth-country-filter"].forEach(function (id) {
          const el = $(id);
          if (!el || el.dataset.clearErrBound) return;
          el.dataset.clearErrBound = "1";
          el.addEventListener("input", function () {
            const field = el.closest && el.closest(".field");
            if (field) {
              field.classList.remove("is-invalid");
              const tip = field.querySelector(".auth-field-error");
              if (tip) {
                tip.textContent = "";
                tip.hidden = true;
              }
            }
          });
        });
        const roleTrigger = $("auth-role-trigger");
        if (roleTrigger && !roleTrigger.dataset.clearErrBound) {
          roleTrigger.dataset.clearErrBound = "1";
          roleTrigger.addEventListener("click", function () {
            const field = roleTrigger.closest && roleTrigger.closest(".field");
            if (field) {
              field.classList.remove("is-invalid");
              const tip = field.querySelector(".auth-field-error");
              if (tip) {
                tip.textContent = "";
                tip.hidden = true;
              }
            }
          });
        }
        const surveyRoot = $("auth-survey-sources");
        if (surveyRoot && !surveyRoot.dataset.clearErrBound) {
          surveyRoot.dataset.clearErrBound = "1";
          surveyRoot.addEventListener("change", function () {
            const field = surveyRoot.closest && surveyRoot.closest(".field");
            if (field) {
              field.classList.remove("is-invalid");
              const tip = field.querySelector(".auth-field-error");
              if (tip) {
                tip.textContent = "";
                tip.hidden = true;
              }
            }
          });
        }
      }

      function collectSignupDetails() {
        const firstName = ($("auth-first-name") && $("auth-first-name").value.trim()) || "";
        const middleName = ($("auth-middle-name") && $("auth-middle-name").value.trim()) || "";
        const lastName = ($("auth-last-name") && $("auth-last-name").value.trim()) || "";
        const national = ($("auth-phone") && $("auth-phone").value.trim()) || "";
        const countryCode = (($("auth-phone-country") && $("auth-phone-country").value) || "").trim();
        const phoneNational = national.replace(/\D/g, "");
        let phone = "";
        if (phoneNational) {
          if (national.trim().indexOf("+") === 0) {
            phone = "+" + phoneNational;
          } else {
            phone = (countryCode || defaultPhoneCountry()) + phoneNational;
          }
        }
        const churchName = (
          (inviteCommunityName || "").trim() ||
          ($("auth-church-name") && $("auth-church-name").value.trim()) ||
          ""
        ).trim();
        const ministryRole = ($("auth-ministry-role") && $("auth-ministry-role").value) || "";
        const ministryRoleOther = ($("auth-role-other") && $("auth-role-other").value.trim()) || "";
        const surveySources = selectedSurveySources();
        const surveyOther = ($("auth-survey-other") && $("auth-survey-other").value.trim()) || "";
        return {
          firstName,
          middleName,
          lastName,
          countryCode,
          phoneNational,
          phone,
          churchName,
          ministryRole,
          ministryRoleOther,
          surveySources,
          surveyOther,
        };
      }

      function validateSignupDetails(details) {
        clearFieldErrors();
        const e1 = validateStep1({ skipClear: true, skipFocus: true });
        const e2 = validateStep2({ skipClear: true, skipFocus: true });
        const msg = e1 || e2;
        if (msg) focusFirstInvalid();
        return msg;
      }

      async function submitOnboardingComplete(accessToken, details) {
        const res = await fetch("/api/auth/onboarding/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            first_name: details.firstName,
            middle_name: details.middleName,
            last_name: details.lastName,
            phone: details.phone,
            community_name: details.churchName,
            ministry_role: details.ministryRole,
            ministry_role_other: details.ministryRoleOther,
            survey_sources: details.surveySources,
            survey_source_other: details.surveyOther,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          let msg = data.error || "Could not complete signup.";
          if (typeof data.detail === "string") msg = data.detail;
          else if (Array.isArray(data.detail) && data.detail[0] && data.detail[0].msg) {
            msg = data.detail.map(function (d) { return d.msg; }).join(" ");
          }
          throw new Error(msg);
        }
        return data;
      }

      let finishingAuth = false;
      async function finishAuthWithSession(session) {
        if (finishingAuth) return;
        finishingAuth = true;
        if (!session || !session.access_token) {
          redirectAfterAuth();
          return;
        }
        const pendingInvite = takePendingInvite() || inviteToken;
        if (pendingInvite) {
          await consumeInvite(pendingInvite, session.access_token);
        }
        const status = await fetchOnboardingStatus(session.access_token);
        if (status && status.needs_onboarding) {
          window.location.href = onboardingUrl();
          return;
        }
        redirectAfterAuth();
      }

      function showOnboardingForm(session, status) {
        if (loading) loading.remove();
        if (blocked) blocked.hidden = true;
        if (sessionPanel) sessionPanel.hidden = true;
        if (form) form.hidden = false;
        if (signupFields) signupFields.hidden = false;
        if (footer) footer.hidden = false;
        const oauth = $("auth-oauth");
        const oauthDivider = $("auth-oauth-divider");
        if (oauth) oauth.hidden = true;
        if (oauthDivider) oauthDivider.hidden = true;
        const emailInput = $("auth-email");
        const passwordInput = $("auth-password");
        if (emailInput) {
          emailInput.required = false;
          emailInput.disabled = true;
        }
        if (passwordInput) {
          passwordInput.required = false;
          passwordInput.disabled = true;
        }
        form.dataset.onboardingMode = "1";
        form.dataset.accessToken = session.access_token || "";
        bindPhoneCountryInput();
        applyDefaultPhoneCountry();
        prefillOnboardingForm(status);
        bindStepNav();
        setSignupStep(1);
        lockStepsHeight();
      }

      function oauthRedirectTo() {
        const params = new URLSearchParams(window.location.search);
        params.delete("code");
        params.delete("error");
        params.delete("error_description");
        params.delete("error_code");
        // Never carry switch=1 into the OAuth return URL — it forces an immediate sign-out.
        params.delete("switch");
        const qs = params.toString();
        return (
          window.location.origin +
          (cfg.sign_in_url || "/sign-in") +
          (qs ? "?" + qs : "")
        );
      }

      function providerLabel(provider) {
        return provider === "facebook" ? "Facebook" : "Google";
      }

      function oauthButtonsFor(provider) {
        if (provider === "facebook") {
          return [
            $("auth-facebook-btn"),
            $("auth-invite-facebook-btn"),
            $("auth-session-facebook-btn"),
          ].filter(Boolean);
        }
        return [
          $("auth-google-btn"),
          $("auth-invite-google-btn"),
          $("auth-session-google-btn"),
        ].filter(Boolean);
      }

      function allOauthButtons() {
        return oauthButtonsFor("google").concat(oauthButtonsFor("facebook"));
      }

      async function startOAuthSignIn(provider, opts) {
        const options = opts || {};
        const link = !!options.link;
        const label = providerLabel(provider);
        showError("");
        clearSwitchAccountParam();
        const buttons = allOauthButtons();
        buttons.forEach(function (btn) { btn.disabled = true; });
        try {
          if (inviteToken) stashPendingInvite(inviteToken);
          const oauthOptions = {
            redirectTo: oauthRedirectTo(),
            skipBrowserRedirect: true,
          };
          if (provider === "google") {
            oauthOptions.queryParams = { prompt: "select_account" };
          }
          if (link) {
            try {
              sessionStorage.setItem("verbum:link-" + provider, "1");
            } catch (_e) { /* ignore */ }
            if (typeof client.auth.linkIdentity !== "function") {
              throw new Error(label + " linking is unavailable in this browser. Refresh and try again.");
            }
            const { data: sessionCheck } = await client.auth.getSession();
            if (!sessionCheck || !sessionCheck.session) {
              throw new Error("Sign in with email first, then connect " + label + ".");
            }
            const { data, error } = await client.auth.linkIdentity({
              provider: provider,
              options: oauthOptions,
            });
            if (error) {
              const msg = String((error && error.message) || "");
              const code = String((error && error.code) || "");
              if (/identity_already_exists|already linked/i.test(msg + " " + code)) {
                showError("");
                redirectAfterAuth();
                return;
              }
              if (/manual linking/i.test(msg) || /linking.*(disabled|not enabled)/i.test(msg)) {
                throw new Error(
                  label + " linking is disabled in Auth settings. Enable “Allow manual linking” in Supabase, or sign out and use Continue with " + label + " with the same email."
                );
              }
              throw error;
            }
            if (data && data.url) {
              window.location.assign(data.url);
              return;
            }
            throw new Error(label + " linking did not return a redirect URL.");
          }
          const { data, error } = await client.auth.signInWithOAuth({
            provider: provider,
            options: oauthOptions,
          });
          if (error) throw error;
          if (data && data.url) {
            window.location.assign(data.url);
            return;
          }
          throw new Error(label + " sign-in did not return a redirect URL.");
        } catch (err) {
          showError((err && err.message) || (label + " sign-in failed."));
          buttons.forEach(function (btn) { btn.disabled = false; });
        }
      }

      function userHasProvider(user, provider) {
        const identities = (user && user.identities) || [];
        const needle = String(provider || "").toLowerCase();
        return identities.some(function (item) {
          return String((item && item.provider) || "").toLowerCase() === needle;
        });
      }

      function bindOAuthButtons() {
        const pairs = [
          ["auth-google-btn", "google", false],
          ["auth-facebook-btn", "facebook", false],
          ["auth-invite-google-btn", "google", false],
          ["auth-invite-facebook-btn", "facebook", false],
          ["auth-session-google-btn", "google", true],
          ["auth-session-facebook-btn", "facebook", true],
        ];
        pairs.forEach(function (pair) {
          const el = $(pair[0]);
          if (!el || el.dataset.bound) return;
          el.dataset.bound = "1";
          el.addEventListener("click", function () {
            startOAuthSignIn(pair[1], { link: pair[2] });
          });
        });
      }

      function showLoginForm() {
        if (loading) loading.remove();
        if (blocked) blocked.hidden = true;
        if (sessionPanel) sessionPanel.hidden = true;
        if (form) form.hidden = false;
        if (signupFields) signupFields.hidden = mode !== "sign-up";
        if (footer) footer.hidden = false;
        const emailInput = $("auth-email");
        const passwordInput = $("auth-password");
        if (emailInput) {
          emailInput.required = true;
          emailInput.disabled = false;
        }
        if (passwordInput) {
          passwordInput.required = true;
          passwordInput.disabled = false;
        }
        if (form) {
          delete form.dataset.onboardingMode;
          delete form.dataset.accessToken;
        }

        const oauth = $("auth-oauth");
        const oauthDivider = $("auth-oauth-divider");
        const showOAuth = mode === "sign-in" || mode === "sign-up";
        if (oauth) oauth.hidden = !showOAuth;
        if (oauthDivider) oauthDivider.hidden = !showOAuth;
        const hint = $("auth-google-hint");
        if (hint) hint.hidden = !(mode === "sign-up" && inviteToken);
        const googleLabel = $("auth-google-btn-label");
        if (googleLabel) {
          googleLabel.textContent = mode === "sign-up" ? "Sign up with Google" : "Continue with Google";
        }
        const facebookLabel = $("auth-facebook-btn-label");
        if (facebookLabel) {
          facebookLabel.textContent = mode === "sign-up" ? "Sign up with Facebook" : "Continue with Facebook";
        }

        if (mode === "sign-up") {
          applyInviteChurchName(inviteCommunityName);
          bindPhoneCountryInput();
          applyDefaultPhoneCountry();
          bindStepNav();
          setSignupStep(1);
          lockStepsHeight();
        } else {
          setSignupStep(1);
        }

        if (mode === "sign-up" && inviteEmail) {
          if (emailInput) {
            emailInput.value = inviteEmail;
            emailInput.readOnly = true;
          }
        }

        bindOAuthButtons();
      }

      function setAuthSubmitting(busy) {
        ["auth-submit", "auth-submit-simple", "auth-step-next", "auth-step-back"].forEach(function (id) {
          const el = $(id);
          if (el) el.disabled = !!busy;
        });
      }

      function showExistingSession(user) {
        if (loading) loading.remove();
        if (blocked) blocked.hidden = true;
        if (form) form.hidden = true;
        if (signupFields) signupFields.hidden = true;
        if (footer) footer.hidden = true;
        const oauth = $("auth-oauth");
        const oauthDivider = $("auth-oauth-divider");
        if (oauth) oauth.hidden = true;
        if (oauthDivider) oauthDivider.hidden = true;
        if (sessionPanel) sessionPanel.hidden = false;
        const emailEl = $("auth-session-email");
        if (emailEl) emailEl.textContent = user && user.email ? user.email : "your account";

        const sessionGoogle = $("auth-session-google-btn");
        if (sessionGoogle) {
          sessionGoogle.hidden = userHasProvider(user, "google");
        }
        const sessionFacebook = $("auth-session-facebook-btn");
        if (sessionFacebook) {
          sessionFacebook.hidden = userHasProvider(user, "facebook");
        }
        bindOAuthButtons();

        const continueBtn = $("auth-continue-btn");
        if (continueBtn && !continueBtn.dataset.bound) {
          continueBtn.dataset.bound = "1";
          continueBtn.addEventListener("click", redirectAfterAuth);
        }
      }

      if (wantsSwitchAccount() && !isAuthCallback()) {
        clearSuperadminUnlockCache();
        await client.auth.signOut();
        clearSwitchAccountParam();
      } else if (wantsSwitchAccount()) {
        // OAuth/magic-link return: keep the new session; drop switch so it can't loop.
        clearSwitchAccountParam();
      }

      if (inviteSignupBlocked) {
        // Allow authenticated incomplete users to finish onboarding even when
        // public /sign-up is invite-only (OAuth already created their Auth user).
        const { data: earlySession } = await client.auth.getSession();
        const earlyTok =
          earlySession && earlySession.session && earlySession.session.access_token
            ? earlySession.session.access_token
            : "";
        if (earlyTok) {
          const earlyStatus = await fetchOnboardingStatus(earlyTok);
          if (earlyStatus && earlyStatus.needs_onboarding) {
            showOnboardingForm(earlySession.session, earlyStatus);
            if (form) {
              form.addEventListener("submit", async (e) => {
                e.preventDefault();
                showError("");
                if (signupStep !== 2) {
                  const err = validateStep1();
                  if (err) return;
                  setSignupStep(2);
                  return;
                }
                const details = collectSignupDetails();
                const detailErr = validateSignupDetails(details);
                if (detailErr) return;
                setAuthSubmitting(true);
                try {
                  const pendingInvite = takePendingInvite() || inviteToken;
                  if (pendingInvite) {
                    await consumeInvite(pendingInvite, earlyTok);
                  }
                  await submitOnboardingComplete(earlyTok, details);
                  setMobileWelcomePending();
                  window.location.href = "/home?welcome=1";
                } catch (err) {
                  showError((err && err.message) || "Could not complete signup.");
                } finally {
                  setAuthSubmitting(false);
                }
              });
            }
            return;
          }
        }
        showInviteBlocked();
        bindOAuthButtons();
        return;
      }

      const oauthParams = new URLSearchParams(window.location.search);
      const oauthErrorCode = (oauthParams.get("error_code") || "").trim();
      const oauthError = oauthParams.get("error_description") || oauthParams.get("error");
      if (oauthError) {
        if (/identity_already_exists|already linked/i.test(oauthErrorCode + " " + String(oauthError))) {
          // Linking was already done — continue with the current session if present.
          const { data: linkedSession } = await client.auth.getSession();
          if (linkedSession && linkedSession.session) {
            await finishAuthWithSession(linkedSession.session);
            return;
          }
          showError("Google is already linked to an account. Use Continue with Google to sign in.");
        } else {
          showError(decodeURIComponent(String(oauthError).replace(/\+/g, " ")));
        }
      }

      if (!oauthError && isAuthCallback()) {
        client.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
            finishAuthWithSession(session);
          }
        });
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session) {
          await finishAuthWithSession(sessionData.session);
          return;
        }
        // Wait briefly for PKCE code exchange / hash tokens.
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retry = await client.auth.getSession();
        if (retry.data && retry.data.session) {
          await finishAuthWithSession(retry.data.session);
          return;
        }
        showError("Google sign-in did not complete. Please try Continue with Google again.");
      }

      const { data: sessionData } = await client.auth.getSession();
      const existingUser =
        sessionData.session && sessionData.session.user
          ? sessionData.session.user
          : null;
      const existingSession = sessionData.session || null;

      if (existingSession && existingSession.access_token) {
        const status = await fetchOnboardingStatus(existingSession.access_token);
        if (status && status.needs_onboarding) {
          if (mode === "sign-up") {
            showOnboardingForm(existingSession, status);
            // Fall through to bind form submit for onboarding.
          } else {
            window.location.href = onboardingUrl();
            return;
          }
        } else if (existingUser && mode === "sign-up") {
          redirectAfterAuth();
          return;
        } else if (existingUser && mode === "sign-in") {
          showExistingSession(existingUser);
          return;
        } else {
          showLoginForm();
        }
      } else {
        showLoginForm();
      }

      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          showError("");
          const details = collectSignupDetails();
          const email = ($("auth-email") && $("auth-email").value.trim()) || "";
          const password = ($("auth-password") && $("auth-password").value) || "";
          const onboardingMode = form.dataset.onboardingMode === "1";

          if (onboardingMode || mode === "sign-up") {
            if (signupStep !== 2) {
              const err = validateStep1();
              if (err) return;
              setSignupStep(2, { animate: true });
              return;
            }
            const detailErr = validateSignupDetails(details);
            if (detailErr) return;
          }

          if (onboardingMode) {
            const token = form.dataset.accessToken || (existingSession && existingSession.access_token) || "";
            if (!token) {
              showError("Your session expired. Please sign in again.");
              return;
            }
            setAuthSubmitting(true);
            try {
              const pendingInvite = takePendingInvite() || inviteToken;
              if (pendingInvite) {
                await consumeInvite(pendingInvite, token);
              }
              await submitOnboardingComplete(token, details);
              setMobileWelcomePending();
              try {
                const next = new URL(cfg.after_sign_up_url || "/home", window.location.origin);
                next.searchParams.set("welcome", "1");
                window.location.href = next.pathname + next.search + next.hash;
              } catch (_e) {
                window.location.href = "/home?welcome=1";
              }
            } catch (err) {
              showError((err && err.message) || "Could not complete signup.");
            } finally {
              setAuthSubmitting(false);
            }
            return;
          }

          if (!email || !password) {
            showError("Email and password are required.");
            return;
          }
          if (password.length < 8) {
            showError("Password must be at least 8 characters.");
            return;
          }
          if (mode === "sign-up" && inviteOnly && !inviteToken) {
            showError("A valid invitation link is required to create an account.");
            return;
          }
          if (mode === "sign-up" && inviteOnly && !details.churchName) {
            showError("This invite is missing a parish name. Ask your administrator for a new link.");
            return;
          }
          if (mode === "sign-up" && inviteEmail && email.toLowerCase() !== inviteEmail.toLowerCase()) {
            showError("This invite is locked to " + inviteEmail + ".");
            return;
          }

          setAuthSubmitting(true);

          try {
            const emailRedirectTo =
              cfg.email_confirm_redirect_url ||
              window.location.origin + cfg.sign_in_url;

            if (mode === "sign-up") {
              const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo,
                  data: {
                    first_name: details.firstName || undefined,
                    middle_name: details.middleName || undefined,
                    last_name: details.lastName || undefined,
                    community_name: details.churchName || undefined,
                    phone: details.phone || undefined,
                    ministry_role: details.ministryRole || undefined,
                    ministry_role_other: details.ministryRoleOther || undefined,
                  },
                },
              });
              if (error) throw error;
              if (data.session) {
                if (inviteToken) {
                  await consumeInvite(inviteToken, data.session.access_token);
                }
                await submitOnboardingComplete(data.session.access_token, details);
                setMobileWelcomePending();
                try {
                  const next = new URL(cfg.after_sign_up_url || "/home", window.location.origin);
                  next.searchParams.set("welcome", "1");
                  window.location.href = next.pathname + next.search + next.hash;
                } catch (_e) {
                  window.location.href = "/home?welcome=1";
                }
                return;
              }
              showError("Check your email to confirm your account, then sign in to finish setup.");
            } else {
              const { data, error } = await client.auth.signInWithPassword({ email, password });
              if (error) throw error;
              const session = data && data.session;
              if (session) {
                await finishAuthWithSession(session);
              } else {
                redirectAfterAuth();
              }
            }
          } catch (err) {
            showError((err && err.message) || "Authentication failed.");
          } finally {
            setAuthSubmitting(false);
          }
        });
      }
    } catch (err) {
      if (loading) loading.textContent = err.message || "Could not start sign-in.";
      console.error("[Verbum auth page]", err);
    }
  }

  boot();
})();
