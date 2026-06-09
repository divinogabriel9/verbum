(function () {
  "use strict";

  const state = {
    config: null,
    supabase: null,
    session: null,
    user: null,
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
      updateAccountMenuDisplay();
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

  function updateAccountMenuDisplay() {
    const avatar = document.getElementById("account-menu-avatar");
    const nameEl = document.getElementById("account-menu-name");
    const signOutBtn = document.getElementById("account-sign-out-btn");
    const signInLink = document.getElementById("account-sign-in-link");
    const signUpLink = document.getElementById("account-sign-up-link");
    const user = state.user;
    if (!user) {
      if (avatar) avatar.textContent = "A";
      if (nameEl) nameEl.textContent = "Account";
      if (signOutBtn) signOutBtn.hidden = true;
      if (signInLink) signInLink.hidden = false;
      if (signUpLink) signUpLink.hidden = false;
      return;
    }
    if (signInLink) signInLink.hidden = true;
    if (signUpLink) signUpLink.hidden = true;
    const label = user.email || "Account";
    const initial = (label.charAt(0) || "A").toUpperCase();
    if (avatar) avatar.textContent = initial;
    if (nameEl) nameEl.textContent = label.length > 22 ? label.slice(0, 20) + "…" : label;
    if (signOutBtn) signOutBtn.hidden = false;
  }

  async function signOut() {
    await ensureSupabase();
    if (state.supabase) {
      await state.supabase.auth.signOut();
    }
    state.session = null;
    state.user = null;
    const cfg = state.config;
    window.location.href = (cfg && cfg.sign_in_url) || "/sign-in";
  }

  async function initMainAppAuth() {
    try {
      await loadConfig();
      if (!state.config.auth_enabled) return;

      patchFetch();
      await ensureSupabase();
      updateAccountMenuDisplay();

      const signOutBtn = document.getElementById("account-sign-out-btn");
      if (signOutBtn && !signOutBtn.dataset.bound) {
        signOutBtn.dataset.bound = "1";
        signOutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          signOut();
        });
      }

      if (!state.user) {
        const path = window.location.pathname || "/";
        const publicPaths = ["/sign-in", "/sign-up", "/health"];
        if (!publicPaths.includes(path)) {
          window.location.href =
            state.config.sign_in_url + "?redirect_url=" + encodeURIComponent(path);
          return;
        }
      }

      state.ready = true;
      window.dispatchEvent(
        new CustomEvent("verbum:auth-ready", { detail: { user: state.user } })
      );
    } catch (err) {
      console.warn("[Verbum auth]", err);
    }
  }

  window.VerbumAuth = {
    getConfig: () => state.config,
    getSupabase: () => state.supabase,
    getUser: () => state.user,
    getSessionToken,
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
