(function () {
  "use strict";

  const state = {
    config: null,
    supabase: null,
    session: null,
    user: null,
    profile: null,
    churchProfile: null,
    communityPayload: null,
    membership: null,
    cachedToken: null,
    ready: false,
    hydrated: false,
    initialSessionPromise: null,
  };

  function applySession(session) {
    state.session = session || null;
    state.user = session && session.user ? session.user : null;
    state.cachedToken =
      session && session.access_token ? session.access_token : null;
    if (!state.user) {
      state.profile = null;
      state.churchProfile = null;
      state.communityPayload = null;
      state.membership = null;
    }
  }

  function churchRowToCommunityPayload(row, membership) {
    if (!row) return null;
    const logoPath = (row.logo_path || "").trim();
    const status = (row.membership_status || "draft").toLowerCase();
    const locked = !!row.community_name_locked_at;
    const m = membership || {};
    const superadmin = !!m.is_superadmin;
    const approved = status === "approved";
    const fullAccess = m.can_use_full_app != null ? !!m.can_use_full_app : (superadmin || approved);
    return {
      ok: true,
      community_name: row.community_name || "",
      celebrant_names: Array.isArray(row.celebrant_names) ? row.celebrant_names : [],
      logo_url: null,
      membership_status: m.membership_status || status,
      community_name_locked: m.community_name_locked != null ? m.community_name_locked : locked,
      logo_locked: m.logo_locked != null ? m.logo_locked : !!row.logo_locked_at,
      can_edit_parish_name: m.can_edit_parish_name != null ? m.can_edit_parish_name : !locked,
      can_edit_logo: m.can_edit_logo != null ? m.can_edit_logo : !row.logo_locked_at,
      can_edit_church_profile: m.can_edit_church_profile != null ? m.can_edit_church_profile : fullAccess,
      can_use_full_app: fullAccess,
      can_submit_song: m.can_submit_song != null ? !!m.can_submit_song : (!superadmin && !fullAccess),
      can_submit_priest: m.can_submit_priest != null ? !!m.can_submit_priest : (!superadmin && !fullAccess),
      is_superadmin: superadmin,
    };
  }

  function setChurchProfile(row, membership) {
    state.churchProfile = row || null;
    state.communityPayload = churchRowToCommunityPayload(row, membership);
  }

  /** Wait for Supabase to restore session from localStorage before auth decisions. */
  function waitForInitialSession(supabase, timeoutMs) {
    if (state.hydrated) {
      return Promise.resolve(state.session);
    }
    if (!state.initialSessionPromise) {
      state.initialSessionPromise = new Promise((resolve) => {
        let settled = false;
        const finish = (session) => {
          if (settled) return;
          settled = true;
          state.hydrated = true;
          applySession(session);
          resolve(session || null);
        };
        const maxWait = typeof timeoutMs === "number" ? timeoutMs : 1500;
        const timer = setTimeout(() => finish(state.session), maxWait);
        supabase.auth.onAuthStateChange((event, session) => {
          applySession(session);
          if (event === "INITIAL_SESSION") {
            clearTimeout(timer);
            finish(session);
          }
        });
        supabase.auth
          .getSession()
          .then(({ data, error }) => {
            if (settled || error || !data || !data.session) return;
            clearTimeout(timer);
            finish(data.session);
          })
          .catch(() => {
            /* wait for INITIAL_SESSION or timeout */
          });
      });
    }
    return state.initialSessionPromise;
  }

  async function loadConfig() {
    const res = await fetch("/api/auth/config");
    if (!res.ok) throw new Error("Could not load auth config.");
    state.config = await res.json();
    return state.config;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (!src) {
        reject(new Error("Missing script src"));
        return;
      }
      const existing = document.querySelector('script[data-auth-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === "1") resolve();
        else existing.addEventListener("load", () => resolve());
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.authSrc = src;
      script.addEventListener("load", () => {
        script.dataset.loaded = "1";
        resolve();
      });
      script.addEventListener("error", () => reject(new Error("Failed to load " + src)));
      document.head.appendChild(script);
    });
  }

  async function ensureSupabase() {
    const cfg = state.config || (await loadConfig());
    const publishableKey =
      cfg.supabase_publishable_key || cfg.supabase_anon_key;
    if (!cfg.supabase_enabled || !cfg.supabase_url || !publishableKey) {
      return null;
    }
    if (state.supabase) return state.supabase;

    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
    const createClient = window.supabase && window.supabase.createClient;
    if (!createClient) throw new Error("Supabase SDK did not initialize.");

    state.supabase = createClient(cfg.supabase_url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });

    await waitForInitialSession(state.supabase);

    if (!state.supabase._verbumAuthListener) {
      state.supabase._verbumAuthListener = true;
      state.supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") return;
        applySession(session);
        updateAccountMenuDisplay();
        if (state.user) {
          refreshUserProfile().then(updateAccountMenuDisplay);
          startPresenceHeartbeat();
        }
      });
    }

    return state.supabase;
  }

  async function getSessionToken() {
    await ensureSupabase();
    if (!state.supabase) return null;
    if (!state.hydrated) {
      await waitForInitialSession(state.supabase);
    }
    if (state.cachedToken) {
      return state.cachedToken;
    }
    const { data } = await state.supabase.auth.getSession();
    applySession(data.session || null);
    return state.cachedToken;
  }

  async function refreshSession() {
    await ensureSupabase();
    if (!state.supabase) return null;
    const { data, error } = await state.supabase.auth.refreshSession();
    if (!error && data.session) {
      state.session = data.session;
      state.user = data.session.user || null;
      updateAccountMenuDisplay();
      return data.session.access_token || null;
    }
    return getSessionToken();
  }

  async function getAuthHeaders(extra) {
    const headers = { ...(extra || {}) };
    if (!state.config) {
      const cfg = await loadConfig();
      if (!cfg.auth_enabled) return headers;
    } else if (!state.config.auth_enabled) {
      return headers;
    }
    if (state.cachedToken) {
      headers.Authorization = "Bearer " + state.cachedToken;
      return headers;
    }
    const token = await getSessionToken();
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  function waitUntilReady(timeoutMs) {
    if (state.ready) return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = () => resolve(state.ready);
      window.addEventListener("verbum:auth-ready", finish, { once: true });
      setTimeout(finish, timeoutMs || 8000);
    });
  }

  function redirectToSignIn() {
    const cfg = state.config;
    const path = window.location.pathname || "/";
    const base = (cfg && cfg.sign_in_url) || "/sign-in";
    window.location.href =
      base + "?redirect_url=" + encodeURIComponent(path + window.location.search);
  }

  function revealAuthGate() {
    document.documentElement.removeAttribute("data-auth-gate");
    const overlay = document.getElementById("auth-gate-overlay");
    if (overlay) overlay.remove();
  }

  function hasCachedSupabaseSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          const raw = localStorage.getItem(key);
          if (raw && raw !== "null") return true;
        }
      }
    } catch (_err) {
      /* ignore storage access errors */
    }
    return false;
  }

  function revealAuthGateOptimistic() {
    if (!window.__VERBUM_AUTH_GATE__) return;
    if (hasCachedSupabaseSession()) revealAuthGate();
  }

  function resolveRequestUrl(input) {
    if (typeof input === "string") return input;
    if (input && input.url) return input.url;
    return "";
  }

  function resolveRequestMethod(init) {
    return ((init && init.method) || "GET").toUpperCase();
  }

  /** Read-only liturgy endpoints — do not block on Supabase session hydration. */
  function isPublicApiRequest(input, init) {
    const raw = resolveRequestUrl(input);
    if (!raw.includes("/api/")) return false;
    let path = raw;
    try {
      path = new URL(raw, window.location.origin).pathname;
    } catch (_e) {
      path = raw.split("?")[0];
    }
    const method = resolveRequestMethod(init);
    if (method === "POST" && path === "/api/preview") return false;
    return false;
  }

  function patchFetch() {
    if (window.__verbumFetchPatched) return;
    window.__verbumFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async function verbumFetch(input, init) {
      const cfg = state.config;
      if (!cfg || !cfg.auth_enabled) {
        return nativeFetch(input, init);
      }

      const nextInit = init ? { ...init } : {};
      const headers = new Headers(nextInit.headers || {});

      if (isPublicApiRequest(input, init)) {
        if (state.cachedToken && !headers.has("Authorization")) {
          headers.set("Authorization", "Bearer " + state.cachedToken);
        }
        nextInit.headers = headers;
        return nativeFetch(input, nextInit);
      }

      const token = await getSessionToken();
      if (!token) {
        return Promise.reject(new Error("Sign in required."));
      }

      if (!headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
      }
      nextInit.headers = headers;
      return nativeFetch(input, nextInit);
    };
  }

  function getUserFirstName(user) {
    if (!user) return null;
    const profile = state.profile || {};
    const meta = user.user_metadata || {};
    const first = (
      profile.first_name ||
      meta.first_name ||
      meta.given_name ||
      ""
    ).trim();
    const full = (meta.full_name || meta.name || "").trim();
    if (first) return first;
    if (full) return full.split(/\s+/)[0];
    return null;
  }

  function getGreetingLabel(user) {
    const name = getUserFirstName(user);
    return name ? "Hello! " + name : "Hello!";
  }

  function getTimeOfDayGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function getHomeWelcomeLabel(user) {
    const timeGreeting = getTimeOfDayGreeting();
    const name = getUserFirstName(user);
    if (name) return timeGreeting + ", " + name + "! Glad you're here.";
    return "Welcome! " + timeGreeting + ".";
  }

  function getHomeWelcomeSubtext(user) {
    const name = getUserFirstName(user);
    if (name) return "Let's make this Sunday's Mass beautiful together.";
    return "Your liturgy hub for readings, music, and slides — all in one place.";
  }

  async function refreshUserProfile() {
    const user =
      state.user || (state.session && state.session.user ? state.session.user : null);
    if (!user) {
      state.profile = null;
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/auth/me", { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        state.profile = {
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          email: data.email || user.email || null,
          role: data.role || (data.profile && data.profile.role) || "member",
        };
        if (data.membership) {
          state.membership = data.membership;
        }
        if (data.church_profile) {
          setChurchProfile(data.church_profile, data.membership);
        }
        window.dispatchEvent(
          new CustomEvent("verbum:membership", { detail: data.membership || null })
        );
        window.dispatchEvent(new CustomEvent("verbum:profile-ready"));
        sendPresenceHeartbeat();
      }
    } catch (_err) {
      // optional enrichment
    }
  }

  let _presenceTimer = null;
  let _presenceBound = false;

  function preferredLanguageForPresence() {
    try {
      const lang = (localStorage.getItem("churchMediaMassSongLang") || "").trim();
      if (!lang || /^(all|any)$/i.test(lang)) return null;
      return lang;
    } catch (_err) {
      return null;
    }
  }

  async function sendPresenceHeartbeat() {
    const user =
      state.user || (state.session && state.session.user ? state.session.user : null);
    if (!user || document.visibilityState === "hidden") return;
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      let timezone = null;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch (_tzErr) {
        timezone = null;
      }
      await fetch("/api/auth/heartbeat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          timezone: timezone,
          preferred_language: preferredLanguageForPresence(),
        }),
        keepalive: true,
      });
    } catch (_err) {
      // presence is best-effort
    }
  }

  function startPresenceHeartbeat() {
    if (_presenceBound) return;
    _presenceBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sendPresenceHeartbeat();
    });
    window.addEventListener("focus", () => sendPresenceHeartbeat());
    if (_presenceTimer) clearInterval(_presenceTimer);
    _presenceTimer = setInterval(sendPresenceHeartbeat, 2 * 60 * 1000);
  }

  function updateAccountMenuDisplay() {
    const avatar = document.getElementById("account-menu-avatar");
    const nameEl = document.getElementById("account-menu-name");
    const emailEl = document.getElementById("account-menu-email");
    const headerEl = document.getElementById("account-menu-header");
    const signOutBtn = document.getElementById("account-sign-out-btn");
    const signInLink = document.getElementById("account-sign-in-link");
    const signUpLink = document.getElementById("account-sign-up-link");
    const menuDivider = document.getElementById("account-menu-divider");
    const menuWrap = document.querySelector(".account-menu-wrap");
    const user =
      state.user || (state.session && state.session.user ? state.session.user : null);

    if (!user) {
      if (!state.ready) {
        if (signInLink) signInLink.hidden = true;
        if (signUpLink) signUpLink.hidden = true;
        if (signOutBtn) signOutBtn.hidden = true;
        if (menuDivider) menuDivider.hidden = true;
        if (headerEl) headerEl.hidden = true;
        if (menuWrap) menuWrap.classList.remove("is-authenticated");
        return;
      }
      if (avatar) avatar.textContent = "A";
      if (nameEl) nameEl.textContent = "Account";
      if (emailEl) emailEl.textContent = "";
      if (headerEl) headerEl.hidden = true;
      if (signOutBtn) signOutBtn.hidden = true;
      if (signInLink) signInLink.hidden = false;
      if (signUpLink) signUpLink.hidden = !!(state.config && state.config.invite_only_signup);
      if (menuDivider) menuDivider.hidden = false;
      if (menuWrap) menuWrap.classList.remove("is-authenticated");
      return;
    }

    if (signInLink) signInLink.hidden = true;
    if (signUpLink) signUpLink.hidden = true;
    if (signOutBtn) signOutBtn.hidden = false;
    if (menuDivider) menuDivider.hidden = false;
    if (menuWrap) menuWrap.classList.add("is-authenticated");

    const firstName = getUserFirstName(user);
    const email = (state.profile && state.profile.email) || user.email || "";
    const greeting = getGreetingLabel(user);
    const initial = ((firstName || email).charAt(0) || "A").toUpperCase();

    if (avatar) avatar.textContent = initial;
    if (nameEl) {
      nameEl.textContent = greeting.length > 24 ? greeting.slice(0, 22) + "…" : greeting;
    }
    if (emailEl) emailEl.textContent = email;
    if (headerEl) headerEl.hidden = !email;
  }

  async function signOut() {
    await ensureSupabase();
    if (state.supabase) {
      await state.supabase.auth.signOut({ scope: "global" });
    }
    try {
      sessionStorage.removeItem("verbum:sa-session-started");
      sessionStorage.removeItem("verbum:sa-approval-done");
      sessionStorage.removeItem("verbum:sa-approval-modal-dismissed");
    } catch (_e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent("verbum:signed-out"));
    state.session = null;
    state.user = null;
    state.profile = null;
    state.churchProfile = null;
    state.communityPayload = null;
    state.cachedToken = null;
    updateAccountMenuDisplay();
    const cfg = state.config;
    window.location.href = ((cfg && cfg.sign_in_url) || "/sign-in") + "?switch=1";
  }

  async function initMainAppAuth() {
    const publicPaths = ["/", "/sign-in", "/sign-up", "/health"];
    const path = window.location.pathname || "/";

    revealAuthGateOptimistic();

    try {
      await loadConfig();
      if (!state.config.auth_enabled) {
        revealAuthGate();
        state.ready = true;
        window.dispatchEvent(
          new CustomEvent("verbum:auth-ready", { detail: { user: null } })
        );
        return;
      }

      patchFetch();
      try {
        await ensureSupabase();
      } catch (supabaseErr) {
        console.warn("[Verbum auth] Supabase client failed to initialize", supabaseErr);
        state.session = null;
        state.user = null;
      }

      updateAccountMenuDisplay();

      const signOutBtn = document.getElementById("account-sign-out-btn");
      if (signOutBtn && !signOutBtn.dataset.bound) {
        signOutBtn.dataset.bound = "1";
        signOutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          signOutBtn.disabled = true;
          signOut().catch((err) => {
            console.warn("[Verbum auth] sign out failed", err);
            const base = (state.config && state.config.sign_in_url) || "/sign-in";
            window.location.href = base + "?switch=1";
          });
        });
      }

      if (!state.user && !publicPaths.includes(path)) {
        redirectToSignIn();
        return;
      }

      revealAuthGate();
      state.ready = true;
      window.dispatchEvent(
        new CustomEvent("verbum:auth-ready", { detail: { user: state.user } })
      );

      if (state.user) {
        refreshUserProfile().then(updateAccountMenuDisplay);
        startPresenceHeartbeat();
      }
    } catch (err) {
      console.warn("[Verbum auth]", err);
      if (state.config && state.config.auth_enabled && !publicPaths.includes(path)) {
        redirectToSignIn();
      }
    }
  }

  window.VerbumAuth = {
    getConfig: () => state.config,
    getSupabase: () => state.supabase,
    getUser: () =>
      state.user || (state.session && state.session.user ? state.session.user : null),
    getChurchProfile: () => state.churchProfile,
    getCommunityPayload: () => state.communityPayload,
    getMembership: () => state.membership,
    setCommunityPayload: (data) => {
      if (!data) return;
      state.communityPayload = {
        ...(state.communityPayload || {}),
        ...data,
      };
      if (state.churchProfile) {
        state.churchProfile = {
          ...state.churchProfile,
          community_name: data.community_name != null ? data.community_name : state.churchProfile.community_name,
          celebrant_names: data.celebrant_names || state.churchProfile.celebrant_names || [],
          membership_status: data.membership_status || state.churchProfile.membership_status,
          community_name_locked_at: data.community_name_locked
            ? state.churchProfile.community_name_locked_at || new Date().toISOString()
            : state.churchProfile.community_name_locked_at,
          logo_locked_at: data.logo_locked
            ? state.churchProfile.logo_locked_at || new Date().toISOString()
            : state.churchProfile.logo_locked_at,
        };
      }
    },
    getSessionToken,
    getCachedToken: () => state.cachedToken,
    refreshSession,
    getAuthHeaders,
    waitUntilReady,
    redirectToSignIn,
    revealAuthGate,
    signOut,
    isReady: () => state.ready,
    initMainAppAuth,
    refreshUserProfile,
    updateAccountMenuDisplay,
    getUserFirstName,
    getHomeWelcomeLabel,
    getHomeWelcomeSubtext,
  };

  if (document.body && !window.__VERBUM_AUTH_MODE__) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initMainAppAuth);
    } else {
      initMainAppAuth();
    }
  }
})();
