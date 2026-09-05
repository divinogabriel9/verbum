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
      churchInput.placeholder = "e.g. St. Mary's Parish";
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

      if (mode === "sign-up" && cfg.invite_only_signup && !inviteValid) {
        showInviteBlocked();
        return;
      }

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
        redirectAfterAuth();
      }

      function oauthRedirectTo() {
        const params = new URLSearchParams(window.location.search);
        params.delete("code");
        params.delete("error");
        params.delete("error_description");
        params.delete("error_code");
        const qs = params.toString();
        return (
          window.location.origin +
          (cfg.sign_in_url || "/sign-in") +
          (qs ? "?" + qs : "")
        );
      }

      async function startGoogleSignIn() {
        showError("");
        const googleBtn = $("auth-google-btn");
        if (googleBtn) googleBtn.disabled = true;
        try {
          if (inviteToken) stashPendingInvite(inviteToken);
          const { data, error } = await client.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: oauthRedirectTo(),
              queryParams: {
                prompt: "select_account",
              },
            },
          });
          if (error) throw error;
          if (data && data.url) {
            window.location.href = data.url;
            return;
          }
          throw new Error("Google sign-in did not return a redirect URL.");
        } catch (err) {
          showError((err && err.message) || "Google sign-in failed.");
          if (googleBtn) googleBtn.disabled = false;
        }
      }

      function showLoginForm() {
        if (loading) loading.remove();
        if (blocked) blocked.hidden = true;
        if (sessionPanel) sessionPanel.hidden = true;
        if (form) form.hidden = false;
        if (signupFields) signupFields.hidden = mode !== "sign-up";
        if (footer) footer.hidden = false;

        const oauth = $("auth-oauth");
        const oauthDivider = $("auth-oauth-divider");
        const showGoogle = mode === "sign-in" || (mode === "sign-up" && !!inviteToken);
        if (oauth) oauth.hidden = !showGoogle;
        if (oauthDivider) oauthDivider.hidden = !showGoogle;

        if (mode === "sign-up") {
          applyInviteChurchName(inviteCommunityName);
        }

        if (mode === "sign-up" && inviteEmail) {
          const emailInput = $("auth-email");
          if (emailInput) {
            emailInput.value = inviteEmail;
            emailInput.readOnly = true;
          }
        }

        const googleBtn = $("auth-google-btn");
        if (googleBtn && !googleBtn.dataset.bound) {
          googleBtn.dataset.bound = "1";
          googleBtn.addEventListener("click", startGoogleSignIn);
        }
      }

      function showExistingSession(user) {
        if (loading) loading.remove();
        if (blocked) blocked.hidden = true;
        if (form) form.hidden = true;
        if (signupFields) signupFields.hidden = true;
        if (footer) footer.hidden = true;
        if (sessionPanel) sessionPanel.hidden = false;
        const emailEl = $("auth-session-email");
        if (emailEl) emailEl.textContent = user && user.email ? user.email : "your account";

        const continueBtn = $("auth-continue-btn");
        if (continueBtn && !continueBtn.dataset.bound) {
          continueBtn.dataset.bound = "1";
          continueBtn.addEventListener("click", redirectAfterAuth);
        }

        const switchBtn = $("auth-switch-btn");
        if (switchBtn && !switchBtn.dataset.bound) {
          switchBtn.dataset.bound = "1";
          switchBtn.addEventListener("click", async () => {
            switchBtn.disabled = true;
            clearSuperadminUnlockCache();
            await client.auth.signOut();
            const params = new URLSearchParams(window.location.search);
            params.delete("switch");
            const qs = params.toString();
            window.location.href = window.location.pathname + (qs ? "?" + qs : "");
          });
        }
      }

      if (wantsSwitchAccount()) {
        clearSuperadminUnlockCache();
        await client.auth.signOut();
      }

      const oauthError = new URLSearchParams(window.location.search).get("error_description")
        || new URLSearchParams(window.location.search).get("error");
      if (oauthError) {
        showError(decodeURIComponent(String(oauthError).replace(/\+/g, " ")));
      }

      if (!oauthError && isAuthCallback()) {
        client.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
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
      }

      const { data: sessionData } = await client.auth.getSession();
      const existingUser =
        sessionData.session && sessionData.session.user
          ? sessionData.session.user
          : null;

      if (existingUser && mode === "sign-up") {
        redirectAfterAuth();
        return;
      }

      if (existingUser && mode === "sign-in") {
        showExistingSession(existingUser);
        return;
      }

      showLoginForm();

      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          showError("");
          const email = ($("auth-email") && $("auth-email").value.trim()) || "";
          const password = ($("auth-password") && $("auth-password").value) || "";
          const firstName = ($("auth-first-name") && $("auth-first-name").value.trim()) || "";
          const lastName = ($("auth-last-name") && $("auth-last-name").value.trim()) || "";
          const phone = ($("auth-phone") && $("auth-phone").value.trim()) || "";
          const churchName = (
            (inviteCommunityName || "").trim() ||
            ($("auth-church-name") && $("auth-church-name").value.trim()) ||
            ""
          ).trim();
          const submitBtn = $("auth-submit");

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
          if (mode === "sign-up" && inviteOnly && !churchName) {
            showError("This invite is missing a parish name. Ask your administrator for a new link.");
            return;
          }
          if (mode === "sign-up" && inviteEmail && email.toLowerCase() !== inviteEmail.toLowerCase()) {
            showError("This invite is locked to " + inviteEmail + ".");
            return;
          }

          if (submitBtn) submitBtn.disabled = true;

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
                    first_name: firstName || undefined,
                    last_name: lastName || undefined,
                    community_name: churchName || undefined,
                    phone: phone || undefined,
                  },
                },
              });
              if (error) throw error;
              if (data.session) {
                if (inviteToken) {
                  await consumeInvite(inviteToken, data.session.access_token);
                }
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
              showError("Check your email to confirm your account, then sign in.");
            } else {
              const { error } = await client.auth.signInWithPassword({ email, password });
              if (error) throw error;
              redirectAfterAuth();
            }
          } catch (err) {
            showError((err && err.message) || "Authentication failed.");
          } finally {
            if (submitBtn) submitBtn.disabled = false;
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
