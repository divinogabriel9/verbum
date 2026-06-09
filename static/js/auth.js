(function () {
  "use strict";

  const state = {
    config: null,
    supabase: null,
    session: null,
    user: null,
    profile: null,
    ready: false,
  };

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
      },
    });

    const { data } = await state.supabase.auth.getSession();
    state.session = data.session || null;
    state.user = state.session && state.session.user ? state.session.user : null;

    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      state.user = session && session.user ? session.user : null;
      if (!state.user) state.profile = null;
      updateAccountMenuDisplay();
      if (state.user) {
        refreshUserProfile().then(updateAccountMenuDisplay);
      }
    });

    return state.supabase;
  }

  async function getSessionToken() {
    await ensureSupabase();
    if (!state.supabase) return null;
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session || null;
    state.user = state.session && state.session.user ? state.session.user : null;
    return state.session && state.session.access_token ? state.session.access_token : null;
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
    const cfg = state.config || (await loadConfig());
    if (!cfg.auth_enabled) return headers;
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

  function patchFetch() {
    if (window.__verbumFetchPatched) return;
    window.__verbumFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async function verbumFetch(input, init) {
      const cfg = state.config;
      if (!cfg || !cfg.auth_enabled) {
        return nativeFetch(input, init);
      }

      const token = await getSessionToken();
      if (!token) {
        return nativeFetch(input, init);
      }

      const nextInit = init ? { ...init } : {};
      const headers = new Headers(nextInit.headers || {});
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
        };
      }
    } catch (_err) {
      // optional enrichment
    }
  }

  function updateAccountMenuDisplay() {
    const avatar = document.getElementById("account-menu-avatar");
    const nameEl = document.getElementById("account-menu-name");
    const emailEl = document.getElementById("account-menu-email");
    const headerEl = document.getElementById("account-menu-header");
    const signOutBtn = document.getElementById("account-sign-out-btn");
    const signInLink = document.getElementById("account-sign-in-link");
    const signUpLink = document.getElementById("account-sign-up-link");
    const menuWrap = document.querySelector(".account-menu-wrap");
    const user =
      state.user || (state.session && state.session.user ? state.session.user : null);

    if (!user) {
      if (!state.ready) {
        if (signInLink) signInLink.hidden = true;
        if (signUpLink) signUpLink.hidden = true;
        if (signOutBtn) signOutBtn.hidden = true;
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
      if (signUpLink) signUpLink.hidden = false;
      if (menuWrap) menuWrap.classList.remove("is-authenticated");
      return;
    }

    if (signInLink) signInLink.hidden = true;
    if (signUpLink) signUpLink.hidden = true;
    if (signOutBtn) signOutBtn.hidden = false;
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
    state.session = null;
    state.user = null;
    state.profile = null;
    updateAccountMenuDisplay();
    const cfg = state.config;
    window.location.href = ((cfg && cfg.sign_in_url) || "/sign-in") + "?switch=1";
  }

  async function initMainAppAuth() {
    const publicPaths = ["/sign-in", "/sign-up", "/health"];
    const path = window.location.pathname || "/";

    try {
      await loadConfig();
      if (!state.config.auth_enabled) {
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
      if (state.user) {
        await refreshUserProfile();
        updateAccountMenuDisplay();
      }

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

      state.ready = true;
      window.dispatchEvent(
        new CustomEvent("verbum:auth-ready", { detail: { user: state.user } })
      );
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
    getSessionToken,
    refreshSession,
    getAuthHeaders,
    waitUntilReady,
    redirectToSignIn,
    signOut,
    isReady: () => state.ready,
    initMainAppAuth,
    updateAccountMenuDisplay,
  };

  if (document.body && !window.__VERBUM_AUTH_MODE__) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initMainAppAuth);
    } else {
      initMainAppAuth();
    }
  }
})();
