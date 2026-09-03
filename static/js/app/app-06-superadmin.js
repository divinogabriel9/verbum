/* Verbum SPA part 6/9: app-06-superadmin.js
 * Superadmin, history, event calendar helpers
 * Split from app.js — restore: git tag restore-before-appjs-split
 * Top-level const/let → var so classic multi-script scope is shared.
 * Lines (pre-split content): 17549-21004
 */
    async function saveSaUserParishRole(btn) {
      const uid = decodeURIComponent(btn.getAttribute("data-user-id") || "");
      if (!uid) return;
      const row = btn.closest(".sa-user-row") || btn.closest("tr");
      const roleEl = row && row.querySelector(".sa-user-parish-role");
      const parishEl = row && row.querySelector(".sa-user-parish-pick");
      const role = roleEl ? roleEl.value : "media";
      let parishId = roleEl ? (roleEl.getAttribute("data-parish-id") || "") : "";
      if (parishEl && parishEl.value) parishId = parishEl.value;
      const statusEl = $("sa-users-status");
      btn.disabled = true;
      if (statusEl) { statusEl.textContent = "Saving parish role…"; statusEl.className = "status"; }
      try {
        await saFetchAdmin("/api/admin/users/" + encodeURIComponent(uid) + "/parish-role", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: role, parish_id: parishId || null }),
        });
        if (statusEl) { statusEl.textContent = "Parish role updated."; statusEl.className = "status ok"; }
        notify("Parish role updated.", "ok");
        loadSaUsers();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Save failed."; statusEl.className = "status err"; }
        btn.disabled = false;
      }
    }

    async function parishFetch(path, options) {
      const headers = Object.assign({}, await adminAuthHeaders(), (options && options.headers) || {});
      const res = await fetch(path, Object.assign({}, options || {}, { headers }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Request failed.");
      return data;
    }

    async function loadSettingsParishTeam() {
      const membersEl = $("settings-team-members");
      const invitesEl = $("settings-team-invites");
      const capEl = $("settings-team-capacity");
      const statusEl = $("settings-team-status");
      if (!membersEl) return;
      membersEl.innerHTML = "<li class=\"muted\">Loading team…</li>";
      if (invitesEl) invitesEl.innerHTML = "";
      try {
        const data = await parishFetch("/api/parish/team");
        const members = Array.isArray(data.members) ? data.members : [];
        const invites = Array.isArray(data.invites) ? data.invites : [];
        if (capEl) {
          capEl.textContent = (data.members_count || members.length) + " / " + (data.member_limit || 5) + " members";
        }
        if (!members.length) {
          membersEl.innerHTML = "<li class=\"muted\">No members yet.</li>";
        } else {
          membersEl.innerHTML = members.map((m) => {
            const name = [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || m.email || "Member";
            const role = (m.role || "media").toLowerCase();
            const removeBtn = role !== "president"
              ? " <button type=\"button\" class=\"secondary settings-team-remove\" data-user-id=\"" + escapeHtml(m.user_id || "") + "\">Remove</button>"
              : "";
            return "<li><strong>" + escapeHtml(name) + "</strong> · " + escapeHtml(role) + removeBtn + "</li>";
          }).join("");
          membersEl.querySelectorAll(".settings-team-remove").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const uid = btn.getAttribute("data-user-id");
              if (!uid || !confirm("Remove this teammate from your parish?")) return;
              btn.disabled = true;
              try {
                await parishFetch("/api/parish/team/members/" + encodeURIComponent(uid), { method: "DELETE" });
                loadSettingsParishTeam();
              } catch (err) {
                if (statusEl) { statusEl.textContent = err.message || "Remove failed."; statusEl.className = "status err"; }
                btn.disabled = false;
              }
            });
          });
        }
        if (invitesEl) {
          if (!invites.length) {
            invitesEl.innerHTML = "<li class=\"muted\">No pending invites.</li>";
          } else {
            invitesEl.innerHTML = invites.map((row) => {
              const email = escapeHtml(row.email || "Any email");
              const parish = escapeHtml(row.community_name || "Your parish");
              const url = escapeHtml(row.invite_url || "");
              const exp = escapeHtml(saFormatLocalDate(row.expires_at));
              return "<li><strong>" + email + "</strong><br><span class=\"muted\">Parish: " + parish + "</span><br><span class=\"muted\">Expires " + exp + "</span>" +
                (url ? "<br><input type=\"text\" readonly value=\"" + url + "\" style=\"width:100%;margin-top:6px;font-size:0.8rem;\" />" : "") +
                "</li>";
            }).join("");
          }
        }
        if (statusEl) statusEl.textContent = "";
      } catch (err) {
        membersEl.innerHTML = "<li class=\"muted\">" + escapeHtml(err.message || "Could not load team.") + "</li>";
      }
    }

    async function acceptParishInviteFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const token = (params.get("parish_invite") || "").trim();
      if (!token) return;
      const auth = window.VerbumAuth;
      if (!auth || !auth.isReady || !auth.isReady()) return;
      try {
        const data = await parishFetch("/api/parish/team/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        params.delete("parish_invite");
        const qs = params.toString();
        history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
        notify("You joined " + ((data.parish && data.parish.community_name) || "the parish") + ".", "ok");
        if (auth.refreshUserProfile) await auth.refreshUserProfile();
        refreshCommunity();
      } catch (err) {
        notify(err.message || "Could not accept parish invite.", "error");
      }
    }

    async function deleteSaUser(btn) {
      const uid = decodeURIComponent(btn.getAttribute("data-user-id") || "");
      const email = btn.getAttribute("data-user-email") || uid;
      if (!uid) return;
      if (!confirm("Delete account " + email + "? This cannot be undone.")) return;
      btn.disabled = true;
      const statusEl = $("sa-users-status");
      if (statusEl) { statusEl.textContent = "Deleting user…"; statusEl.className = "status"; }
      try {
        await saFetchAdmin("/api/admin/users/" + encodeURIComponent(uid), { method: "DELETE" });
        if (statusEl) { statusEl.textContent = "User deleted."; statusEl.className = "status ok"; }
        notify("User deleted.", "ok");
        loadSaUsers();
        loadSaDashboard();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Delete failed."; statusEl.className = "status err"; }
        btn.disabled = false;
      }
    }

    function saAuditDetailLabel(detail) {
      if (!detail || typeof detail !== "object") return "—";
      if (detail.title) return String(detail.title);
      if (detail.name) return String(detail.name);
      const keys = Object.keys(detail);
      if (!keys.length) return "—";
      return keys.slice(0, 2).map((k) => k + ": " + String(detail[k])).join(" · ");
    }

    function closeSaParishDrawer() {
      const drawer = $("sa-parish-drawer");
      if (!drawer) return;
      drawer.classList.remove("is-open");
      drawer.hidden = true;
      drawer.setAttribute("aria-hidden", "true");
      saState.parishDrawerId = null;
    }

    function openSaParishDrawer(parishId) {
      const drawer = $("sa-parish-drawer");
      const body = $("sa-parish-drawer-body");
      const titleEl = $("sa-parish-drawer-title");
      const subEl = $("sa-parish-drawer-subtitle");
      if (!drawer || !body || !parishId) return;
      saState.parishDrawerId = parishId;
      drawer.hidden = false;
      drawer.setAttribute("aria-hidden", "false");
      drawer.classList.add("is-open");
      if (titleEl) titleEl.textContent = "Parish details";
      if (subEl) subEl.textContent = "Loading…";
      body.innerHTML = "<div class=\"sa-skeleton\" style=\"height:120px;border-radius:8px;\"></div>";
      loadSaParishDetail(parishId);
    }

    async function loadSaParishDetail(parishId) {
      const body = $("sa-parish-drawer-body");
      const titleEl = $("sa-parish-drawer-title");
      const subEl = $("sa-parish-drawer-subtitle");
      if (!body) return;
      try {
        const data = await saFetchAdmin("/api/admin/parishes/" + encodeURIComponent(parishId));
        const parish = data.parish || {};
        const members = Array.isArray(data.members) ? data.members : [];
        const quota = data.quota || {};
        const gens = Array.isArray(data.recent_generations) ? data.recent_generations : [];
        const celebrants = Array.isArray(parish.celebrant_names) ? parish.celebrant_names : [];
        if (titleEl) titleEl.textContent = parish.community_name || "Parish";
        if (subEl) {
          subEl.textContent = (parish.membership_status || "draft") + " · " +
            (parish.members_count || 0) + "/" + (parish.members_limit || 5) + " members";
        }
        const memberRows = members.length
          ? members.map((m) => (
            "<tr><td>" + escapeHtml(m.name || "—") + "</td>" +
            "<td>" + escapeHtml(m.email || "—") + "</td>" +
            "<td>" + escapeHtml(m.role || "—") + "</td></tr>"
          )).join("")
          : "<tr><td colspan=\"3\" class=\"muted\">No active members.</td></tr>";
        const genRows = gens.length
          ? gens.map((g) => (
            "<tr><td>" + escapeHtml(String(g.mass_date || "—")) + "</td>" +
            "<td>" + escapeHtml(g.title || g.celebrant || "—") + "</td>" +
            "<td class=\"muted\">" + escapeHtml(saFormatLocalDateTime(g.created_at)) + "</td></tr>"
          )).join("")
          : "<tr><td colspan=\"3\" class=\"muted\">No generations yet.</td></tr>";
        body.innerHTML =
          "<section class=\"sa-detail-section\">" +
            "<h4>Parish name</h4>" +
            "<div class=\"sa-rename-row\">" +
              "<input type=\"text\" id=\"sa-drawer-parish-name\" maxlength=\"120\" value=\"" + escapeHtml(parish.community_name || "") + "\" aria-label=\"Parish name\" />" +
              "<button type=\"button\" class=\"primary\" id=\"sa-drawer-save-name\" data-parish-id=\"" + escapeHtml(parish.id || "") + "\">Save name</button>" +
            "</div>" +
            "<p class=\"muted\" style=\"margin:8px 0 0;font-size:0.78rem;\">Superadmin can rename immediately. President requests appear under Approvals.</p>" +
          "</section>" +
          "<section class=\"sa-detail-section\">" +
            "<h4>Overview</h4>" +
            "<dl class=\"sa-detail-kv\">" +
              "<dt>Status</dt><dd><span class=\"sa-status-pill is-" + escapeHtml((parish.membership_status || "draft").toLowerCase()) + "\">" + escapeHtml(parish.membership_status || "—") + "</span></dd>" +
              "<dt>Created</dt><dd>" + escapeHtml(saFormatLocalDateTime(parish.created_at)) + "</dd>" +
              "<dt>Updated</dt><dd>" + escapeHtml(saFormatLocalDateTime(parish.updated_at)) + "</dd>" +
              "<dt>ID</dt><dd><code style=\"font-size:0.75rem;word-break:break-all;\">" + escapeHtml(parish.id || "—") + "</code></dd>" +
            "</dl>" +
          "</section>" +
          "<section class=\"sa-detail-section\">" +
            "<h4>AI quota this week (UTC)</h4>" +
            "<dl class=\"sa-detail-kv\">" +
              "<dt>Used</dt><dd>" + escapeHtml(String(quota.used != null ? quota.used : "—")) + " / " + escapeHtml(String(quota.limit != null ? quota.limit : "—")) + "</dd>" +
              "<dt>Remaining</dt><dd>" + escapeHtml(String(quota.remaining != null ? quota.remaining : "—")) + "</dd>" +
              "<dt>Status</dt><dd>" + (quota.allowed ? "Available" : "Limit reached") + "</dd>" +
            "</dl>" +
          "</section>" +
          "<section class=\"sa-detail-section\">" +
            "<h4>Members</h4>" +
            "<div class=\"sa-table-wrap\"><table class=\"sa-table\"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>" +
            memberRows + "</tbody></table></div>" +
          "</section>" +
          (celebrants.length
            ? ("<section class=\"sa-detail-section\"><h4>Celebrants</h4><p class=\"muted\" style=\"margin:0;font-size:0.86rem;\">" +
              escapeHtml(celebrants.join(", ")) + "</p></section>")
            : "") +
          "<section class=\"sa-detail-section\">" +
            "<h4>Recent generations</h4>" +
            "<div class=\"sa-table-wrap\"><table class=\"sa-table\"><thead><tr><th>Date</th><th>Title</th><th>When</th></tr></thead><tbody>" +
            genRows + "</tbody></table></div>" +
          "</section>" +
          saParishDrawerActionsHtml(parish) +
          "<section class=\"sa-detail-section\" id=\"sa-parish-drawer-flags\"><h4>Feature flags</h4><p class=\"muted\">Loading parish overrides…</p></section>";
        saBindParishDrawerActions(parish);
        loadSaParishDrawerFlags(parish.id);
      } catch (err) {
        body.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Could not load parish.") + "</p>";
        if (subEl) subEl.textContent = "Load failed";
      }
    }

    async function loadSaParishDrawerFlags(parishId) {
      const section = $("sa-parish-drawer-flags");
      if (!section || !parishId) return;
      try {
        const data = await saFetchAdmin("/api/admin/feature-flags?parish_id=" + encodeURIComponent(parishId));
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          section.innerHTML = "<h4>Feature flags</h4><p class=\"muted\">No feature flags configured.</p>";
          return;
        }
        const rows = items.map((row) => {
          const key = escapeHtml(row.key || "");
          const globalOn = row.global_enabled ? "On" : "Off";
          const override = row.has_parish_override
            ? "<span class=\"muted\">Override: " + (row.enabled ? "On" : "Off") + "</span>"
            : "<span class=\"muted\">Using global (" + globalOn + ")</span>";
          const checked = row.enabled ? " checked" : "";
          return (
            "<div class=\"sa-parish-flag-row\" data-flag-key=\"" + key + "\" style=\"padding:8px 0;border-bottom:1px solid var(--line);\">" +
              "<strong>" + escapeHtml(row.label || row.key || "—") + "</strong>" +
              "<br><span class=\"muted\" style=\"font-size:0.8rem;\">" + escapeHtml(row.description || "") + "</span>" +
              "<div style=\"margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;\">" +
                "<label style=\"display:flex;align-items:center;gap:6px;\"><input type=\"checkbox\" class=\"sa-parish-flag-toggle\"" + checked + " data-flag-key=\"" + key + "\" /><span>Enabled for parish</span></label>" +
                override +
                (row.has_parish_override
                  ? " <button type=\"button\" class=\"secondary sa-parish-flag-clear\" data-flag-key=\"" + key + "\" style=\"padding:2px 8px;font-size:0.78rem;\">Reset to global</button>"
                  : "") +
              "</div>" +
            "</div>"
          );
        }).join("");
        section.innerHTML = "<h4>Feature flags</h4><p class=\"muted\" style=\"font-size:0.82rem;margin:0 0 8px;\">Per-parish overrides stack on global defaults.</p>" + rows;
        section.querySelectorAll(".sa-parish-flag-toggle").forEach((input) => {
          input.addEventListener("change", () => saSaveParishDrawerFlag(parishId, input.getAttribute("data-flag-key"), input.checked, input));
        });
        section.querySelectorAll(".sa-parish-flag-clear").forEach((btn) => {
          btn.addEventListener("click", () => saClearParishDrawerFlag(parishId, btn.getAttribute("data-flag-key")));
        });
      } catch (err) {
        section.innerHTML = "<h4>Feature flags</h4><p class=\"muted\">" + escapeHtml(err.message || "Could not load flags.") + "</p>";
      }
    }

    async function saSaveParishDrawerFlag(parishId, key, enabled, inputEl) {
      if (!parishId || !key) return;
      if (inputEl) inputEl.disabled = true;
      try {
        await saFetchAdmin(
          "/api/admin/feature-flags/" + encodeURIComponent(key) + "/parishes/" + encodeURIComponent(parishId),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !!enabled }),
          }
        );
        notify("Parish flag saved.", "ok");
        loadSaParishDrawerFlags(parishId);
      } catch (err) {
        if (inputEl) inputEl.checked = !enabled;
        notify(err.message || "Could not save flag.", "error");
      } finally {
        if (inputEl) inputEl.disabled = false;
      }
    }

    async function saClearParishDrawerFlag(parishId, key) {
      if (!parishId || !key) return;
      try {
        await saFetchAdmin(
          "/api/admin/feature-flags/" + encodeURIComponent(key) + "/parishes/" + encodeURIComponent(parishId),
          { method: "DELETE" }
        );
        notify("Parish override cleared.", "ok");
        loadSaParishDrawerFlags(parishId);
      } catch (err) {
        notify(err.message || "Could not clear override.", "error");
      }
    }

    function saParishDrawerActionsHtml(parish) {
      const pid = parish.id || "";
      const status = parish.membership_status || "";
      const presidentUid = parish.president_user_id || "";
      let html = "<section class=\"sa-detail-section\"><h4>Actions</h4><div class=\"sa-quick-actions\">";
      if (status === "pending" && presidentUid) {
        html += "<button type=\"button\" class=\"primary sa-drawer-approve-parish\" data-user-id=\"" + escapeHtml(presidentUid) + "\">Approve membership</button>";
        html += "<button type=\"button\" class=\"secondary sa-drawer-reject-parish\" data-user-id=\"" + escapeHtml(presidentUid) + "\">Reject</button>";
      }
      html += "</div>";
      html += "<p class=\"muted\" style=\"margin:10px 0 6px;font-size:0.82rem;\">Merge this parish into another (moves members, deletes this record):</p>";
      html += "<div class=\"sa-toolbar\" style=\"margin-top:0;\">";
      html += "<select class=\"sa-filter-select sa-drawer-merge-target\" data-source-id=\"" + escapeHtml(pid) + "\" style=\"max-width:100%;\"><option value=\"\">Merge into…</option></select>";
      html += "<button type=\"button\" class=\"secondary danger sa-drawer-merge-btn\" data-source-id=\"" + escapeHtml(pid) + "\">Merge</button>";
      html += "</div></section>";
      return html;
    }

    function saBindParishDrawerActions(parish) {
      const body = $("sa-parish-drawer-body");
      if (!body) return;
      body.querySelectorAll(".sa-drawer-approve-parish").forEach((btn) => {
        btn.addEventListener("click", () => saSetParishMembership(btn.getAttribute("data-user-id"), "approve"));
      });
      body.querySelectorAll(".sa-drawer-reject-parish").forEach((btn) => {
        btn.addEventListener("click", () => saSetParishMembership(btn.getAttribute("data-user-id"), "reject"));
      });
      const saveNameBtn = body.querySelector("#sa-drawer-save-name");
      if (saveNameBtn) {
        saveNameBtn.addEventListener("click", () => {
          const input = body.querySelector("#sa-drawer-parish-name");
          const name = input ? input.value.trim() : "";
          saRenameParish(saveNameBtn.getAttribute("data-parish-id"), name, saveNameBtn);
        });
      }
      const mergeSel = body.querySelector(".sa-drawer-merge-target");
      if (mergeSel) saFillParishSelect(mergeSel, parish.id);
      body.querySelectorAll(".sa-drawer-merge-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sourceId = btn.getAttribute("data-source-id");
          const sel = body.querySelector(".sa-drawer-merge-target");
          const targetId = sel ? sel.value : "";
          saMergeParishes(sourceId, targetId, true);
        });
      });
    }

    async function saRenameParish(parishId, name, btnEl) {
      if (!parishId) return;
      if (!name || name.length < 2) {
        notify("Enter a parish name (at least 2 characters).", "warn");
        return;
      }
      if (btnEl) btnEl.disabled = true;
      try {
        await saFetchAdmin("/api/admin/parishes/" + encodeURIComponent(parishId) + "/name", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ community_name: name }),
        });
        notify("Parish renamed.", "ok");
        const titleEl = $("sa-parish-drawer-title");
        if (titleEl) titleEl.textContent = name;
        loadSaParishes();
        if (saState.parishDrawerId) loadSaParishDetail(saState.parishDrawerId);
      } catch (err) {
        notify(err.message || "Rename failed.", "error");
        if (btnEl) btnEl.disabled = false;
      }
    }

    async function saSetParishMembership(userId, action) {
      if (!userId) return;
      const path = action === "approve"
        ? "/api/admin/memberships/" + encodeURIComponent(userId) + "/approve"
        : "/api/admin/memberships/" + encodeURIComponent(userId) + "/reject";
      try {
        await saFetchAdmin(path, { method: "POST" });
        const inboxItem = (saApprovalInbox || []).find(
          (row) => row.kind === "membership" && String(row.entity_id) === String(userId)
        );
        if (inboxItem) markSaApprovalDone(inboxItem, action);
        notify(action === "approve" ? "Parish approved." : "Parish rejected.", action === "approve" ? "ok" : "info");
        if (saState.parishDrawerId) loadSaParishDetail(saState.parishDrawerId);
        loadSaParishes();
        loadSaDashboard();
        if (typeof refreshSaApprovalInbox === "function") await refreshSaApprovalInbox(false);
      } catch (err) {
        notify(err.message || "Action failed.", "error");
      }
    }

    async function saFillParishSelect(selectEl, excludeId) {
      if (!selectEl) return;
      try {
        if (!saState.mergeParishOptions) {
          const data = await saFetchAdmin("/api/admin/parishes/options");
          saState.mergeParishOptions = Array.isArray(data.items) ? data.items : [];
        }
        const current = selectEl.value;
        selectEl.innerHTML = "<option value=\"\">" + (selectEl.classList.contains("sa-drawer-merge-target") ? "Merge into…" : "Select parish…") + "</option>" +
          saState.mergeParishOptions
            .filter((p) => String(p.id || "") !== String(excludeId || ""))
            .map((p) => "<option value=\"" + escapeHtml(p.id || "") + "\">" + escapeHtml(p.community_name || "Parish") + "</option>")
            .join("");
        if (current) selectEl.value = current;
      } catch (_e) { /* ignore */ }
    }

    async function saPopulateMergeSelects() {
      await saFillParishSelect($("sa-merge-source"), null);
      await saFillParishSelect($("sa-merge-target"), null);
    }

    async function saMergeParishes(sourceId, targetId, fromDrawer) {
      const src = String(sourceId || (!fromDrawer && $("sa-merge-source") ? $("sa-merge-source").value : "") || "").trim();
      const tgt = String(targetId || ($("sa-merge-target") && $("sa-merge-target").value) || "").trim();
      const statusEl = fromDrawer ? null : $("sa-merge-status");
      if (!src || !tgt) {
        notify("Choose both source and target parishes.", "info");
        return;
      }
      if (src === tgt) {
        notify("Source and target must be different.", "info");
        return;
      }
      if (!confirm("Merge the source parish into the target? The source will be deleted permanently.")) return;
      if (statusEl) { statusEl.textContent = "Merging…"; statusEl.className = "status"; }
      try {
        const data = await saFetchAdmin("/api/admin/parishes/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: src, target_id: tgt }),
        });
        if (statusEl) {
          statusEl.textContent = "Merged — moved " + (data.moved_members || 0) + " member(s).";
          statusEl.className = "status ok";
        }
        notify("Parishes merged.", "ok");
        saState.mergeParishOptions = null;
        if (fromDrawer) closeSaParishDrawer();
        loadSaParishes();
        saPopulateMergeSelects();
        loadSaDashboard();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Merge failed."; statusEl.className = "status error"; }
        notify(err.message || "Merge failed.", "error");
      }
    }

    function saIsoToLocalInput(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function saLocalInputToIso(value) {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    async function loadSaAnalytics() {
      const statsEl = $("sa-analytics-stats");
      const gensWrap = $("sa-analytics-gens-wrap");
      const signupsWrap = $("sa-analytics-signups-wrap");
      const parishesWrap = $("sa-analytics-parishes-wrap");
      const statusEl = $("sa-analytics-status");
      const daysEl = $("sa-analytics-days");
      const days = daysEl ? parseInt(daysEl.value, 10) || 14 : 14;
      if (statsEl) statsEl.innerHTML = Array(4).fill("<div class=\"sa-stat sa-skeleton\"></div>").join("");
      try {
        const data = await saFetchAdmin("/api/admin/analytics?days=" + days);
        const s = data.summary || {};
        if (statsEl) {
          statsEl.innerHTML = [
            saRenderStatCard("Generations (period)", s.generations_in_period),
            saRenderStatCard("Signups (period)", s.signups_in_period),
            saRenderStatCard("Generations today", s.generations_today),
            saRenderStatCard("Active parishes (7d)", s.active_parishes_7d),
          ].join("");
        }
        const genRows = (data.generations_by_day || []).map((row) => (
          "<tr><td>" + escapeHtml(row.date || "—") + "</td><td>" + escapeHtml(String(row.count != null ? row.count : 0)) + "</td></tr>"
        ));
        const signupRows = (data.signups_by_day || []).map((row) => (
          "<tr><td>" + escapeHtml(row.date || "—") + "</td><td>" + escapeHtml(String(row.count != null ? row.count : 0)) + "</td></tr>"
        ));
        const parishRows = (data.top_parishes || []).map((row) => (
          "<tr><td>" + escapeHtml(row.community_name || "—") + "</td><td>" + escapeHtml(String(row.count != null ? row.count : 0)) + "</td></tr>"
        ));
        if (gensWrap) gensWrap.innerHTML = saRenderTable(["Date", "Count"], genRows, "No generations in period.");
        if (signupsWrap) signupsWrap.innerHTML = saRenderTable(["Date", "Count"], signupRows, "No signups in period.");
        if (parishesWrap) parishesWrap.innerHTML = saRenderTable(["Parish", "Generations"], parishRows, "No parish activity.");
        if (statusEl) {
          statusEl.textContent = (s.period_start && s.period_end)
            ? ("Period " + s.period_start + " → " + s.period_end + " (UTC)")
            : "";
        }
      } catch (err) {
        if (statsEl) statsEl.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function loadSaFeatureFlags() {
      const wrap = $("sa-flags-table-wrap");
      const statusEl = $("sa-flags-status");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      try {
        const data = await saFetchAdmin("/api/admin/feature-flags");
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          wrap.innerHTML = "<p class=\"sa-empty\">No feature flags configured.</p>";
          return;
        }
        const rows = items.map((row) => {
          const key = escapeHtml(row.key || "");
          const checked = row.global_enabled ? " checked" : "";
          return (
            "<tr data-flag-key=\"" + key + "\">" +
            "<td><strong>" + escapeHtml(row.label || row.key || "—") + "</strong><br><span class=\"muted\">" + escapeHtml(row.description || "") + "</span></td>" +
            "<td><code style=\"font-size:0.75rem;\">" + key + "</code></td>" +
            "<td><label style=\"display:flex;align-items:center;gap:8px;\"><input type=\"checkbox\" class=\"sa-flag-toggle\"" + checked + " data-flag-key=\"" + key + "\" /><span>Enabled globally</span></label></td>" +
            "</tr>"
          );
        });
        wrap.innerHTML = saRenderTable(["Feature", "Key", "Global"], rows, "No flags.");
        wrap.querySelectorAll(".sa-flag-toggle").forEach((input) => {
          input.addEventListener("change", () => saSaveFeatureFlag(input.getAttribute("data-flag-key"), input.checked, input));
        });
        if (statusEl) statusEl.textContent = items.length + " flag(s)";
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function saSaveFeatureFlag(key, enabled, inputEl) {
      const statusEl = $("sa-flags-status");
      if (!key) return;
      if (statusEl) { statusEl.textContent = "Saving…"; statusEl.className = "status"; }
      if (inputEl) inputEl.disabled = true;
      try {
        await saFetchAdmin("/api/admin/feature-flags/" + encodeURIComponent(key), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !!enabled }),
        });
        if (statusEl) { statusEl.textContent = "Saved."; statusEl.className = "status ok"; }
        refreshFeatureFlags();
      } catch (err) {
        if (inputEl) inputEl.checked = !enabled;
        if (statusEl) { statusEl.textContent = err.message || "Save failed."; statusEl.className = "status error"; }
      } finally {
        if (inputEl) inputEl.disabled = false;
      }
    }

    var verbumFeatureFlags = {};
    var FEATURE_OFF_HINT = "This feature is turned off for maintenance.";

    function isFeatureEnabled(flagKey) {
      const flags = verbumFeatureFlags || {};
      if (!flagKey || !(flagKey in flags)) return true;
      return flags[flagKey] !== false;
    }

    function ensureFeatureFlagHint(host, hintId) {
      if (!host) return null;
      let hint = document.getElementById(hintId);
      if (!hint) {
        hint = document.createElement("p");
        hint.id = hintId;
        hint.className = "feature-flag-hint";
        hint.setAttribute("role", "status");
        host.appendChild(hint);
      }
      return hint;
    }

    function setFeatureFlagDisabled(el, disabled, title) {
      if (!el) return;
      el.classList.toggle("feature-flag-off", !!disabled);
      el.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (disabled) {
        el.setAttribute("title", title || FEATURE_OFF_HINT);
      } else if (el.getAttribute("title") === FEATURE_OFF_HINT || el.getAttribute("title") === title) {
        el.removeAttribute("title");
      }
      if ("disabled" in el && (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) {
        el.disabled = !!disabled;
      }
      if (el.tagName === "A") {
        if (disabled) el.setAttribute("tabindex", "-1");
        else el.removeAttribute("tabindex");
      }
    }

    function applyFeatureFlagsUi() {
      const practiceOn = isFeatureEnabled("choir_practice_shares");
      const newsOn = isFeatureEnabled("catholic_news_feed");
      const aiOn = isFeatureEnabled("ai_image_generation");
      const socialOn = isFeatureEnabled("social_poster_export");

      [
        "btn-practice-share",
        "btn-practice-share-toolbar",
        "btn-practice-share-mobile",
        "btn-practice-share-wizard",
        "btn-home-practice-share",
      ].forEach((id) => {
        const el = $(id);
        if (!el) return;
        setFeatureFlagDisabled(el, !practiceOn);
      });

      document.querySelectorAll(".home-bento-cell--news, #home-wyd-card").forEach((el, idx) => {
        if (!el) return;
        setFeatureFlagDisabled(el, !newsOn);
        const hint = ensureFeatureFlagHint(el, "feature-hint-news-" + idx);
        if (hint) {
          hint.hidden = newsOn;
          hint.textContent = FEATURE_OFF_HINT;
        }
        el.querySelectorAll("a, button, input, select").forEach((child) => {
          if (child.classList.contains("feature-flag-hint")) return;
          setFeatureFlagDisabled(child, !newsOn);
        });
      });

      const aiControls = [
        "flow-use-ai-poster",
        "poster-use-ai-poster",
        "flow-use-openai-poster",
        "flow-use-gemini-poster",
        "poster-use-openai-poster",
        "poster-use-gemini-poster",
        "flow-openai-poster-style",
        "poster-openai-poster-style",
      ];
      aiControls.forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (!aiOn && el.type === "checkbox") el.checked = false;
        setFeatureFlagDisabled(el, !aiOn);
        const label = el.closest("label");
        if (label) setFeatureFlagDisabled(label, !aiOn);
      });
      ["flow-openai-style-wrap", "poster-openai-style-wrap"].forEach((id) => {
        const wrap = $(id);
        if (wrap) setFeatureFlagDisabled(wrap, !aiOn);
      });
      const aiHosts = [
        $("flow-ai-quota-hint") && (
          $("flow-ai-quota-hint").closest(".flow-poster-style__ai") ||
          $("flow-ai-quota-hint").closest(".flow-setup-footer") ||
          $("flow-ai-quota-hint").parentElement
        ),
        $("poster-ai-quota-hint") && $("poster-ai-quota-hint").parentElement,
      ];
      aiHosts.forEach((host, idx) => {
        if (!host) return;
        const hint = ensureFeatureFlagHint(host, "feature-hint-ai-" + idx);
        if (hint) {
          hint.hidden = aiOn;
          hint.textContent = FEATURE_OFF_HINT;
        }
      });

      ["flow-include-social-exports", "poster-include-social"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (!socialOn && el.type === "checkbox") el.checked = false;
        setFeatureFlagDisabled(el, !socialOn);
        const label = el.closest("label") || el.parentElement;
        if (label) {
          setFeatureFlagDisabled(label, !socialOn);
          const hint = ensureFeatureFlagHint(label.parentElement || label, "feature-hint-social-" + id);
          if (hint) {
            hint.hidden = socialOn;
            hint.textContent = FEATURE_OFF_HINT;
          }
        }
      });
    }

    async function refreshFeatureFlags() {
      try {
        const res = await fetch("/api/feature-flags", { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        verbumFeatureFlags = data.flags || {};
        applyFeatureFlagsUi();
      } catch (_e) {
        verbumFeatureFlags = {};
        applyFeatureFlagsUi();
      }
    }

    async function refreshPlatformAnnouncement() {
      const banners = [$("home-platform-banner"), $("flow-platform-banner")];
      if (!banners.some(Boolean)) return;
      try {
        const res = await fetch("/api/platform/announcement");
        const data = await res.json().catch(() => ({}));
        const ann = data.announcement;
        banners.forEach((el) => {
          if (!el) return;
          if (!ann || !ann.message) {
            el.hidden = true;
            el.innerHTML = "";
            el.className = "app-platform-banner";
            return;
          }
          const sev = ann.severity || "info";
          el.className = "app-platform-banner" + (sev === "warn" ? " is-warn" : sev === "success" ? " is-success" : "");
          let html = escapeHtml(ann.message);
          if (ann.link_url) {
            html += " <a href=\"" + escapeHtml(ann.link_url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
              escapeHtml(ann.link_label || "Learn more") + "</a>";
          }
          el.innerHTML = html;
          el.hidden = false;
        });
      } catch (_e) {
        banners.forEach((el) => { if (el) el.hidden = true; });
      }
    }

    async function loadSaAnnouncementAdmin() {
      const statusEl = $("sa-announce-status");
      try {
        const data = await saFetchAdmin("/api/admin/platform/announcement");
        const ann = data.announcement || {};
        if ($("sa-announce-message")) $("sa-announce-message").value = ann.message || "";
        if ($("sa-announce-severity")) $("sa-announce-severity").value = ann.severity || "info";
        if ($("sa-announce-active")) $("sa-announce-active").checked = !!ann.active;
        if ($("sa-announce-link-url")) $("sa-announce-link-url").value = ann.link_url || "";
        if ($("sa-announce-link-label")) $("sa-announce-link-label").value = ann.link_label || "";
        if ($("sa-announce-starts")) $("sa-announce-starts").value = saIsoToLocalInput(ann.starts_at);
        if ($("sa-announce-ends")) $("sa-announce-ends").value = saIsoToLocalInput(ann.ends_at);
        if (statusEl) statusEl.textContent = ann.updated_at ? ("Last saved " + saFormatLocalDateTime(ann.updated_at)) : "";
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Load failed."; statusEl.className = "status error"; }
      }
    }

    async function saveSaAnnouncementAdmin() {
      const statusEl = $("sa-announce-status");
      if (statusEl) { statusEl.textContent = "Saving…"; statusEl.className = "status"; }
      try {
        const body = {
          message: $("sa-announce-message") ? $("sa-announce-message").value.trim() : "",
          severity: $("sa-announce-severity") ? $("sa-announce-severity").value : "info",
          active: $("sa-announce-active") ? $("sa-announce-active").checked : false,
          link_url: $("sa-announce-link-url") ? $("sa-announce-link-url").value.trim() : null,
          link_label: $("sa-announce-link-label") ? $("sa-announce-link-label").value.trim() : null,
          starts_at: saLocalInputToIso($("sa-announce-starts") && $("sa-announce-starts").value),
          ends_at: saLocalInputToIso($("sa-announce-ends") && $("sa-announce-ends").value),
        };
        await saFetchAdmin("/api/admin/platform/announcement", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (statusEl) { statusEl.textContent = "Saved."; statusEl.className = "status ok"; }
        refreshPlatformAnnouncement();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Save failed."; statusEl.className = "status error"; }
      }
    }

    async function loadSaStorageBrowser() {
      const wrap = $("sa-storage-table-wrap");
      const statusEl = $("sa-storage-status");
      const pathLabel = $("sa-storage-path-label");
      const upBtn = $("sa-storage-up");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      const prefix = saState.storage.prefix || "";
      if (pathLabel) pathLabel.textContent = prefix ? ("/" + prefix) : "/";
      if (upBtn) upBtn.hidden = !prefix;
      try {
        const st = saState.storage;
        const data = await saFetchAdmin(
          "/api/admin/storage?prefix=" + encodeURIComponent(prefix) +
          "&page=" + (st.page || 1) + "&per_page=" + (st.perPage || 50)
        );
        const items = Array.isArray(data.items) ? data.items : [];
        const rows = items.map((row) => {
          const name = escapeHtml(row.name || "—");
          const kind = row.kind || "file";
          const size = row.size != null ? (Math.round(row.size / 1024) + " KB") : "—";
          if (kind === "folder") {
            return "<tr class=\"sa-storage-folder\" data-path=\"" + escapeHtml(row.path || "") + "\" tabindex=\"0\" role=\"button\"><td>📁 " + name + "</td><td>folder</td><td>—</td><td></td></tr>";
          }
          const url = row.url ? ("<a href=\"" + escapeHtml(row.url) + "\" target=\"_blank\" rel=\"noopener\">Open</a>") : "—";
          return "<tr><td>" + name + "</td><td>" + escapeHtml(row.content_type || "file") + "</td><td>" + size + "</td><td>" + url + "</td></tr>";
        });
        wrap.innerHTML = saRenderTable(["Name", "Type", "Size", "Link"], rows, "Empty folder.");
        wrap.querySelectorAll(".sa-storage-folder").forEach((row) => {
          const open = () => {
            saState.storage.prefix = row.getAttribute("data-path") || "";
            saState.storage.page = 1;
            loadSaStorageBrowser();
          };
          row.addEventListener("click", open);
          row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
        });
        if (statusEl) statusEl.textContent = items.length + " item(s)" + (data.has_more ? " · more available" : "");
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function loadSaAuditLog() {
      const wrap = $("sa-audit-table-wrap");
      const statusEl = $("sa-audit-status");
      const pagerEl = $("sa-audit-pager");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      try {
        const st = saState.auditLog;
        const perPage = st.perPage || SA_PAGE_SIZE;
        const params = new URLSearchParams({
          page: String(st.page || 1),
          per_page: String(perPage),
          q: st.q || "",
          action: st.action || "",
          entity_type: st.entityType || "",
        });
        const data = await saFetchAdmin("/api/admin/audit-log?" + params.toString());
        const items = Array.isArray(data.items) ? data.items : [];
        const meta = saPagerMeta(data.total, data.page || st.page, data.per_page || perPage);
        st.page = meta.page;
        const rows = items.map((row) => (
          "<tr><td class=\"muted\">" + escapeHtml(saFormatLocalDateTime(row.created_at)) + "</td>" +
          "<td><strong>" + escapeHtml(row.action || "—") + "</strong></td>" +
          "<td>" + escapeHtml(row.entity_type || "—") + "</td>" +
          "<td>" + escapeHtml(saAuditDetailLabel(row.detail)) + "</td>" +
          "<td>" + escapeHtml(row.actor_email || row.actor_name || "—") + "</td></tr>"
        ));
        wrap.innerHTML = saRenderTable(["When (local)", "Action", "Type", "Detail", "Actor"], rows, "No audit entries yet.");
        saRenderPager(pagerEl, "auditLog", meta);
        if (statusEl) statusEl.textContent = saPagerStatusText(meta);
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function loadSaGenerations() {
      const wrap = $("sa-generations-table-wrap");
      const statusEl = $("sa-generations-status");
      const pagerEl = $("sa-generations-pager");
      if (!wrap) return;
      wrap.innerHTML = "<div class=\"sa-empty\"><div class=\"sa-skeleton\"></div></div>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      try {
        const q = saState.generations.q || "";
        const perPage = saState.generations.perPage || SA_PAGE_SIZE;
        const data = await saFetchAdmin(
          "/api/admin/generations?page=" + saState.generations.page +
          "&per_page=" + perPage +
          "&q=" + encodeURIComponent(q)
        );
        const items = Array.isArray(data.items) ? data.items : [];
        const meta = saPagerMeta(data.total, data.page || saState.generations.page, data.per_page || perPage);
        saState.generations.page = meta.page;
        const rows = items.map((row) => (
          "<tr><td>" + escapeHtml(String(row.mass_date || "—")) + "</td>" +
          "<td>" + escapeHtml(row.title || row.celebrant || "—") + "</td>" +
          "<td>" + escapeHtml(row.parish_name || row.user_email || "—") + "</td>" +
          "<td>" + escapeHtml(row.slide_count != null ? String(row.slide_count) : "—") + "</td>" +
          "<td class=\"muted\">" + escapeHtml(saFormatLocalDateTime(row.created_at)) + "</td></tr>"
        ));
        wrap.innerHTML = saRenderTable(["Mass date", "Title", "Parish / user", "Slides", "When (local)"], rows, "No generations yet.");
        saRenderPager(pagerEl, "generations", meta);
        if (statusEl) statusEl.textContent = saPagerStatusText(meta);
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Load failed.") + "</p>";
      }
    }

    async function refreshAdminPendingRenames() {
      const listEl = $("sa-admin-pending-renames");
      if (!listEl || !churchMembershipState.is_superadmin) return;
      try {
        const res = await fetch("/api/admin/submissions/parish-names/pending", { headers: await adminAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not load pending renames.");
        const pending = Array.isArray(data.pending) ? data.pending : [];
        if (!pending.length) {
          listEl.innerHTML = "<li class=\"muted\">No pending parish renames.</li>";
          return;
        }
        listEl.innerHTML = pending.map((row) => {
          const payload = row.payload || {};
          const prev = escapeHtml(payload.previous_name || "—");
          const next = escapeHtml(payload.community_name || "—");
          const email = escapeHtml(row.submitted_by_email || row.submitted_by_user_id || "—");
          const sid = escapeHtml(String(row.id || ""));
          return (
            "<li style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);\">" +
              "<span><strong>" + prev + " → " + next + "</strong><br><span class=\"muted\">" + email + "</span></span>" +
              "<span style=\"display:flex;gap:8px;\">" +
                "<button type=\"button\" class=\"secondary btn-admin-rename-reject\" data-submission-id=\"" + sid + "\">Reject</button>" +
                "<button type=\"button\" class=\"primary btn-admin-rename-approve\" data-submission-id=\"" + sid + "\">Approve</button>" +
              "</span>" +
            "</li>"
          );
        }).join("");
        listEl.querySelectorAll(".btn-admin-rename-approve").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("parish_names", btn.getAttribute("data-submission-id"), "approve").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Approve failed";
                statusEl.className = "status error";
              }
            });
          });
        });
        listEl.querySelectorAll(".btn-admin-rename-reject").forEach((btn) => {
          btn.addEventListener("click", () => {
            actOnSubmission("parish_names", btn.getAttribute("data-submission-id"), "reject").catch((err) => {
              const statusEl = $("sa-admin-status");
              if (statusEl) {
                statusEl.textContent = err.message || "Reject failed";
                statusEl.className = "status error";
              }
            });
          });
        });
      } catch (err) {
        listEl.innerHTML = "<li class=\"muted\">" + escapeHtml(err.message || "Could not load pending renames.") + "</li>";
      }
    }

    function loadSaMembership() {
      refreshAdminPendingMemberships();
      refreshAdminPendingRenames();
      refreshAdminPendingSongs();
      refreshAdminPendingPriests();
    }

    function saInviteMode() {
      const existing = $("sa-invite-mode-existing");
      return existing && existing.checked ? "existing" : "new";
    }

    function saSyncInviteModeUi() {
      const mode = saInviteMode();
      const existingWrap = $("sa-invite-existing-wrap");
      const newWrap = $("sa-invite-new-wrap");
      if (existingWrap) existingWrap.hidden = mode !== "existing";
      if (newWrap) newWrap.hidden = mode !== "new";
      if (mode === "existing") loadSaInviteParishOptions();
    }

    async function loadSaInviteParishOptions() {
      const datalist = $("sa-invite-parish-datalist");
      if (!datalist) return;
      try {
        const data = await saFetchAdmin("/api/admin/parishes/options?approved_only=true");
        const items = Array.isArray(data.items) ? data.items : [];
        saState.inviteParishOptions = items;
        datalist.innerHTML = items.map((p) => (
          "<option value=\"" + escapeHtml(p.community_name || "") + "\" data-id=\"" + escapeHtml(p.id || "") + "\"></option>"
        )).join("");
      } catch (_e) {
        saState.inviteParishOptions = [];
      }
    }

    function saResolveInviteParishId() {
      const searchEl = $("sa-invite-parish-search");
      const hiddenEl = $("sa-invite-parish-id");
      const query = searchEl && searchEl.value.trim ? searchEl.value.trim().toLowerCase() : "";
      const options = saState.inviteParishOptions || [];
      const match = options.find((p) => String(p.community_name || "").trim().toLowerCase() === query);
      const pid = match ? String(match.id || "") : "";
      if (hiddenEl) hiddenEl.value = pid;
      return pid;
    }

    async function loadSaInvites() {
      const listEl = $("sa-invites-list");
      if (!listEl) return;
      listEl.innerHTML = "<li class=\"muted\">Loading invites…</li>";
      try {
        const data = await saFetchAdmin("/api/admin/invites");
        const invites = Array.isArray(data.invites) ? data.invites : [];
        if (!invites.length) {
          listEl.innerHTML = "<li class=\"muted\">No pending invites.</li>";
          return;
        }
        listEl.innerHTML = invites.map((row) => {
          const email = escapeHtml(row.email || "Any email");
          const parish = escapeHtml(row.community_name || "—");
          const role = escapeHtml(row.invite_role || "president");
          const url = escapeHtml(row.invite_url || "");
          const exp = escapeHtml(saFormatLocalDate(row.expires_at));
          const note = escapeHtml(row.note || "");
          return (
            "<li style=\"padding:10px 0;border-bottom:1px solid var(--line);\">" +
              "<strong>" + email + "</strong>" +
              "<br><span class=\"muted\">Parish: " + parish + " · Role: " + role + "</span>" +
              (note ? "<br><span class=\"muted\">" + note + "</span>" : "") +
              "<br><span class=\"muted\">Expires " + exp + "</span>" +
              (url ? "<br><code style=\"font-size:0.75rem;word-break:break-all;\">" + url + "</code>" : "") +
            "</li>"
          );
        }).join("");
      } catch (err) {
        listEl.innerHTML = "<li class=\"muted\">" + escapeHtml(err.message || "Could not load invites.") + "</li>";
      }
    }

    async function createSaInvite() {
      const statusEl = $("sa-invite-create-status");
      const parishEl = $("sa-invite-parish-name");
      const searchEl = $("sa-invite-parish-search");
      const roleEl = $("sa-invite-role");
      const emailEl = $("sa-invite-email");
      const noteEl = $("sa-invite-note");
      const urlWrap = $("sa-invite-url-wrap");
      const urlInput = $("sa-invite-url");
      const mode = saInviteMode();
      let body = {
        email: emailEl && emailEl.value.trim() ? emailEl.value.trim() : null,
        note: noteEl && noteEl.value.trim() ? noteEl.value.trim() : null,
        ttl_days: 7,
      };
      if (mode === "existing") {
        const parishId = saResolveInviteParishId();
        const parishLabel = searchEl && searchEl.value.trim ? searchEl.value.trim() : "";
        if (!parishId || !parishLabel) {
          if (statusEl) {
            statusEl.textContent = "Choose an approved parish from the list.";
            statusEl.className = "status error";
          }
          return;
        }
        body.parish_id = parishId;
        body.invite_role = roleEl ? roleEl.value : "media";
      } else {
        const parishName = parishEl && parishEl.value.trim ? parishEl.value.trim() : "";
        if (!parishName) {
          if (statusEl) {
            statusEl.textContent = "Enter the new parish name for this invite.";
            statusEl.className = "status error";
          }
          return;
        }
        body.community_name = parishName;
        body.invite_role = "president";
      }
      if (statusEl) { statusEl.textContent = "Creating invite…"; statusEl.className = "status"; }
      try {
        const data = await saFetchAdmin("/api/admin/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const url = data.invite_url || "";
        if (urlWrap) urlWrap.hidden = !url;
        if (urlInput) urlInput.value = url;
        if (statusEl) {
          statusEl.textContent = "Invite created. Copy the link and send it to the new user.";
          statusEl.className = "status ok";
        }
        if (parishEl) parishEl.value = "";
        if (searchEl) searchEl.value = "";
        const hiddenEl = $("sa-invite-parish-id");
        if (hiddenEl) hiddenEl.value = "";
        if (emailEl) emailEl.value = "";
        if (noteEl) noteEl.value = "";
        loadSaInvites();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Could not create invite.";
          statusEl.className = "status error";
        }
      }
    }

    async function loadSaHymnCatalogStatus() {
      const grid = $("sa-hymn-catalog-grid");
      const sectionsWrap = $("sa-hymn-catalog-sections-wrap");
      if (!grid) return;
      grid.innerHTML = Array(4).fill("<div class=\"sa-stat sa-skeleton\"></div>").join("");
      if (sectionsWrap) sectionsWrap.innerHTML = "<p class=\"muted\">Loading…</p>";
      try {
        const data = await saFetchAdmin("/api/admin/hymn-catalog/status");
        const counts = data.counts || {};
        const supabase = data.supabase || {};
        const supabaseLabel = supabase.configured === false
          ? "Not configured"
          : (supabase.seeded ? "Connected" : "Empty");
        const remoteUpdated = supabase.updated_at
          ? new Date(supabase.updated_at).toLocaleString()
          : "—";
        grid.innerHTML = [
          saRenderStatCard("Songs", counts.total || 0, "In catalog"),
          saRenderStatCard("With lyrics", counts.with_lyrics || 0, (counts.without_lyrics || 0) + " missing"),
          saRenderStatCard("Supabase", supabaseLabel, remoteUpdated),
          saRenderStatCard("Source", data.source === "supabase" ? "Remote" : "Local file", data.revision ? String(data.revision).slice(0, 19) : "—"),
        ].join("");
        if (sectionsWrap) {
          const sections = data.sections || {};
          const sectionKeys = Object.keys(sections);
          const rows = sectionKeys.map((sec) => {
            const row = sections[sec] || {};
            return "<tr><td>" + escapeHtml(sec) + "</td><td>" + escapeHtml(String(row.total || 0)) + "</td><td>" + escapeHtml(String(row.with_lyrics || 0)) + "</td></tr>";
          });
          sectionsWrap.innerHTML = saRenderTable(["Section", "Songs", "With lyrics"], rows, "No sections in catalog.");
        }
      } catch (err) {
        grid.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Could not load catalog status.") + "</p>";
        if (sectionsWrap) sectionsWrap.innerHTML = "";
      }
    }

    async function syncSaHymnCatalog() {
      if (!guardSuperadminAction()) return;
      const preferEl = $("sa-hymn-sync-prefer");
      const statusEl = $("sa-hymn-catalog-status");
      const btn = $("sa-btn-sync-hymn-catalog");
      const prefer = (preferEl && preferEl.value) || "active";
      const confirmMsg = prefer === "local"
        ? "Publish hymn_library.json to Supabase? This overwrites the remote global catalog."
        : "Republish the active hymn catalog to Supabase for all parishes?";
      if (!confirm(confirmMsg)) return;
      if (statusEl) { statusEl.textContent = "Syncing catalog to Supabase…"; statusEl.className = "status"; }
      if (btn) btn.disabled = true;
      try {
        const data = await saFetchAdmin("/api/admin/hymn-catalog/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefer: prefer }),
        });
        const counts = data.counts || {};
        if (statusEl) {
          statusEl.textContent = "Synced " + (counts.total || 0) + " songs (" + (counts.with_lyrics || 0) + " with lyrics) to Supabase.";
          statusEl.className = "status ok";
        }
        loadSaHymnCatalogStatus();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Sync failed."; statusEl.className = "status error"; }
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    function saPreviewDurationSec() {
      const el = $("sa-preview-duration");
      const n = parseInt(el && el.value, 10);
      return Math.max(5, Math.min(10, Number.isFinite(n) ? n : 10));
    }

    function syncSaPreviewDurationLabel() {
      const label = $("sa-preview-duration-label");
      if (label) label.textContent = String(saPreviewDurationSec());
    }

    async function loadSaSongPreviews() {
      const wrap = $("sa-song-preview-wrap");
      const pagerEl = $("sa-song-preview-pager");
      if (!wrap) return;
      wrap.innerHTML = "<p class=\"muted\">Loading songs…</p>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      const st = saState.songPreviews || { page: 1, perPage: 40, q: "", section: "all", status: "all" };
      const perPage = st.perPage || 40;
      const offset = Math.max(0, ((st.page || 1) - 1) * perPage);
      try {
        const data = await saFetchAdmin(
          "/api/admin/songs/previews?q=" + encodeURIComponent(st.q || "") +
          "&section=" + encodeURIComponent(st.section || "all") +
          "&status=" + encodeURIComponent(st.status || "all") +
          "&limit=" + perPage +
          "&offset=" + offset
        );
        const songs = Array.isArray(data.songs) ? data.songs : [];
        saState._previewRows = songs;
        const meta = saPagerMeta(data.total, st.page || 1, perPage);
        saState.songPreviews.page = meta.page;
        if (!songs.length) {
          wrap.innerHTML = "<p class=\"sa-empty\">No songs match these filters.</p>";
          return;
        }
        const rows = songs.map((song) => {
          const preview = song.audio_preview || null;
          const ready = !!song.ready;
          const dur = preview && preview.duration_sec ? preview.duration_sec : saPreviewDurationSec();
          const playing = massSectionAudioPlayingSlot === catalogPreviewPlayingSlot(song.section, song.id);
          return (
            "<tr data-sa-preview-row=\"" + escapeHtml(song.section) + ":" + escapeHtml(song.id) + "\" data-sa-preview-section=\"" + escapeHtml(song.section) + "\" data-sa-preview-id=\"" + escapeHtml(song.id) + "\">" +
              "<td><strong>" + escapeHtml(song.title || "") + "</strong>" +
                (song.author ? "<div class=\"muted\">" + escapeHtml(song.author) + "</div>" : "") +
                (song.has_chorus ? "<div class=\"muted\">Has chorus</div>" : "<div class=\"muted\">Uses verse 1</div>") +
              "</td>" +
              "<td>" + escapeHtml(song.section || "") + "</td>" +
              "<td><input type=\"url\" class=\"sa-preview-url\" data-sa-preview-url placeholder=\"https://youtube.com/watch?v=…\" value=\"" +
                escapeHtml(song.youtube_url || "") + "\" data-assigned-url=\"" + escapeHtml(song.youtube_url || "") + "\" /></td>" +
              "<td>" + (ready
                ? "<span class=\"sa-status-pill\">" + escapeHtml(String(dur) + "s ready") + "</span>"
                : "<span class=\"muted\">Missing</span>") + "</td>" +
              "<td><div class=\"sa-preview-actions\">" +
                "<button type=\"button\" class=\"primary\" data-sa-preview-fetch=\"" + escapeHtml(song.section) + "\" data-sa-preview-id=\"" + escapeHtml(song.id) + "\">Fetch</button>" +
                "<button type=\"button\" class=\"secondary" + (playing ? " is-playing" : "") + "\" data-sa-preview-play=\"" + escapeHtml(song.section) + "\" data-sa-preview-id=\"" + escapeHtml(song.id) + "\"" +
                  (ready ? "" : " disabled") + ">▶</button>" +
                "<button type=\"button\" class=\"secondary\" data-sa-preview-clear=\"" + escapeHtml(song.section) + "\" data-sa-preview-id=\"" + escapeHtml(song.id) + "\"" +
                  (ready ? "" : " disabled") + ">Clear</button>" +
              "</div></td>" +
            "</tr>"
          );
        });
        wrap.innerHTML = saRenderTable(
          ["Song", "Section", "Clip source URL", "Clip", "Actions"],
          rows,
          "No songs match these filters."
        );
        saRenderPager(pagerEl, "songPreviews", meta);
      } catch (err) {
        wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Could not load songs.") + "</p>";
      }
    }

    async function fetchSaSongPreview(section, hymnId, rowEl, btn) {
      if (!guardSuperadminAction()) return;
      const statusEl = $("sa-song-preview-status");
      const urlEl = rowEl && rowEl.querySelector("[data-sa-preview-url]");
      const youtubeUrl = urlEl ? String(urlEl.value || "").trim() : "";
      const titleEl = rowEl && rowEl.querySelector("strong");
      const title = titleEl ? titleEl.textContent.trim() : hymnId;
      if (btn) { btn.disabled = true; btn.textContent = "Queued…"; }
      if (statusEl) { statusEl.textContent = "Scanning captions and fetching clip…"; statusEl.className = "status"; }
      previewFetchState.attempted[String(section) + ":" + String(hymnId)] = true;
      try {
        if (youtubeUrl) {
          const ref = youtubeMediaRefFromInput(youtubeUrl, title);
          if (!ref) {
            if (typeof notify === "function") notify("Enter a valid YouTube URL.", "warn");
            return;
          }
          if (urlEl) {
            urlEl.dataset.assignedUrl = ref.youtube_url || youtubeUrl;
            urlEl.value = ref.youtube_url || youtubeUrl;
          }
        }
        await startPreviewFetchJob({
          section: section,
          id: hymnId,
          title: title,
          youtube_url: youtubeUrl,
          toast: true,
        });
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Fetch failed."; statusEl.className = "status error"; }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Fetch"; }
      }
    }

    async function commitSaPreviewYoutubeInput(input, opts) {
      const options = opts || {};
      if (!input || !guardSuperadminAction()) return;
      const rowEl = input.closest("tr");
      if (!rowEl) return;
      const section = rowEl.getAttribute("data-sa-preview-section") || "";
      const hymnId = rowEl.getAttribute("data-sa-preview-id") || "";
      const raw = String(input.value || "").trim();
      if (!section || !hymnId || !raw) return;
      const titleEl = rowEl.querySelector("strong");
      const title = titleEl ? titleEl.textContent.trim() : hymnId;
      const ref = youtubeMediaRefFromInput(raw, title);
      if (!ref) {
        if (options.warn && typeof notify === "function") notify("Enter a valid YouTube URL.", "warn");
        return;
      }
      const nextUrl = ref.youtube_url || raw;
      if (!options.force && String(input.dataset.assignedUrl || "") === nextUrl) return;
      input.dataset.assignedUrl = nextUrl;
      input.value = nextUrl;
      const statusEl = $("sa-song-preview-status");
      if (statusEl) { statusEl.textContent = "Scanning captions and fetching clip…"; statusEl.className = "status"; }
      previewFetchState.attempted[section + ":" + hymnId] = true;
      try {
        await startPreviewFetchJob({
          section: section,
          id: hymnId,
          title: title,
          youtube_url: nextUrl,
          toast: true,
        });
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Could not start clip fetch."; statusEl.className = "status error"; }
      }
    }

    async function playSaSongPreview(section, hymnId, btn) {
      const row = (saState._previewRows || []).find((s) => s.section === section && s.id === hymnId);
      let preview = row && row.audio_preview;
      if (!preview && songCatalogData) {
        const hit = (songCatalogData[section] || []).find((s) => String(s.id) === String(hymnId));
        preview = hit && hit.audio_preview;
      }
      preview = normalizeAudioPreviewRef(preview);
      if (!preview) {
        if (typeof notify === "function") notify("Fetch a clip for this song first.", "warn");
        return;
      }
      await playSavedMusicRef(preview, catalogPreviewPlayingSlot(section, hymnId), btn);
    }

    async function clearSaSongPreview(section, hymnId, btn) {
      if (!guardSuperadminAction()) return;
      if (typeof confirmUnlinkMedia === "function") {
        if (!confirmUnlinkMedia("this audio clip")) return;
      } else if (!window.confirm("Unlink this audio clip?")) {
        return;
      }
      const statusEl = $("sa-song-preview-status");
      if (btn) btn.disabled = true;
      try {
        await saFetchAdmin(
          "/api/admin/songs/" + encodeURIComponent(section) + "/" + encodeURIComponent(hymnId) + "/preview",
          { method: "DELETE" }
        );
        if (typeof updateLocalCatalogSongPreview === "function") {
          updateLocalCatalogSongPreview(section, hymnId, null);
        }
        if (statusEl) { statusEl.textContent = "Preview clip cleared."; statusEl.className = "status ok"; }
        await loadSaSongPreviews();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Could not clear preview."; statusEl.className = "status error"; }
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function loadSaReadingsCache() {
      const summary = $("sa-readings-cache-summary");
      if (!summary) return;
      try {
        const data = await saFetchAdmin("/api/admin/readings-cache/stats");
        summary.textContent = (data.entries || 0) + " cached dates · " + (data.bytes || 0) + " bytes (" + (data.path || "readings_cache.json") + ")";
      } catch (err) {
        summary.textContent = err.message || "Could not load cache stats.";
      }
    }

    async function loadSaAiQuotaSummary() {
      const el = $("sa-ai-quota-summary");
      if (!el) return;
      try {
        const res = await fetch("/api/image-quota");
        const q = await res.json();
        const limit = q.limit || "?";
        const used = q.used || 0;
        const remaining = q.remaining != null ? q.remaining : "?";
        if (q.scope === "parish") {
          el.textContent = "Your parish pool this week (UTC): " + remaining + " of " + limit + " AI image" + (limit === 1 ? "" : "s") + " remaining · " + used + " used · shared by all parish members.";
        } else {
          el.textContent = "Weekly limit: " + limit + " · Used: " + used + " · Remaining: " + remaining + " (UTC week).";
        }
      } catch (_e) {
        el.textContent = "Could not load quota status.";
      }
    }

    async function loadSaParishQuotaTable() {
      const body = $("sa-parish-quota-body");
      const pagerEl = $("sa-ai-quota-pager");
      if (!body) return;
      body.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">Loading parish usage…</td></tr>";
      if (pagerEl) { pagerEl.hidden = true; pagerEl.innerHTML = ""; }
      try {
        const st = saState.aiQuota;
        const perPage = st.perPage || SA_PAGE_SIZE;
        const q = st.q || "";
        const data = await saFetchAdmin(
          "/api/admin/image-quota?page=" + (st.page || 1) +
          "&per_page=" + perPage +
          "&q=" + encodeURIComponent(q)
        );
        const items = data.items || [];
        const meta = saPagerMeta(data.total, data.page || st.page, data.per_page || perPage);
        st.page = meta.page;
        const summary = $("sa-ai-quota-summary");
        if (summary && data.date) {
          summary.textContent = "This week (UTC " + data.date + "): " + (data.total_used || 0) + " AI image" + ((data.total_used || 0) === 1 ? "" : "s") + " across " + (data.parish_count || data.total || items.length) + " parish" + ((data.parish_count || data.total || items.length) === 1 ? "" : "es") + " · " + (data.limit_per_parish || "?") + " per parish per week.";
        }
        if (!items.length) {
          body.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">No parish usage recorded today.</td></tr>";
          return;
        }
        body.innerHTML = items.map((row) => {
          const name = escapeHtml(row.community_name || "—");
          const used = row.used != null ? row.used : 0;
          const remaining = row.remaining != null ? row.remaining : "—";
          const limit = row.limit != null ? row.limit : "—";
          const status = row.allowed ? "Available" : "Limit reached";
          const statusCls = row.allowed ? "ok" : "warn";
          return (
            "<tr>" +
            "<td><strong>" + name + "</strong>" +
            (row.membership_status ? " <span class=\"muted\">(" + escapeHtml(row.membership_status) + ")</span>" : "") +
            "</td>" +
            "<td>" + used + " / " + limit + "</td>" +
            "<td>" + remaining + "</td>" +
            "<td><span class=\"status " + statusCls + "\">" + status + "</span></td>" +
            "</tr>"
          );
        }).join("");
        saRenderPager(pagerEl, "aiQuota", meta);
      } catch (err) {
        body.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">" + escapeHtml(err.message || "Could not load parish quota.") + "</td></tr>";
      }
    }

    async function loadSaHealth() {
      const grid = $("sa-health-grid");
      const envList = $("sa-env-list");
      if (!grid) return;
      grid.innerHTML = Array(5).fill("<div class=\"sa-stat sa-skeleton\"></div>").join("");
      try {
        const data = await saFetchAdmin("/api/admin/health");
        const checks = data.checks || {};
        grid.innerHTML = [
          saRenderStatCard(
            "Version",
            data.version || data.git_commit_short || "—",
            (data.built_at
              ? saFormatLocalDateTime(data.built_at, data.built_at_display || "")
              : (data.built_at_display || data.git_branch || data.version_source || ""))
          ),
          saRenderStatCard("Supabase", checks.supabase && checks.supabase.ok ? "OK" : "Issue", checks.supabase && checks.supabase.configured ? "Configured" : "Off"),
          saRenderStatCard("Redis", checks.redis && checks.redis.ok ? "OK" : "Issue", checks.redis && checks.redis.configured ? "Configured" : "Off"),
          saRenderStatCard("Auth", checks.auth && checks.auth.enabled ? "On" : "Off"),
          saRenderStatCard("Readings cache", (data.readings_cache && data.readings_cache.entries) || 0),
        ].join("");
        if (envList) {
          const env = data.env || {};
          envList.innerHTML = Object.keys(env).map((key) => (
            "<li><span>" + escapeHtml(key) + "</span><span class=\"muted\">" +
            (env[key] === true || (typeof env[key] === "string" && env[key]) ? "set" : String(env[key] || "—")) +
            "</span></li>"
          )).join("");
        }
      } catch (err) {
        grid.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "Health check failed.") + "</p>";
      }
    }

    function renderSaApiProbes(data) {
      const wrap = $("sa-health-probes-wrap");
      const statusEl = $("sa-health-status");
      if (!wrap) return;
      const probes = (data && data.probes) || [];
      const summary = (data && data.summary) || {};
      if (!probes.length) {
        wrap.innerHTML = "<p class=\"muted\">No probes returned.</p>";
        return;
      }
      const rows = probes.map((probe) => {
        const skipped = probe.skipped;
        const ok = probe.ok;
        const statusLabel = skipped ? "skip" : (ok ? "pass" : "fail");
        const statusClass = skipped ? "muted" : (ok ? "ok" : "error");
        const note = probe.note ? ("<span class=\"muted\">" + escapeHtml(probe.note) + "</span>") : "—";
        return "<tr>" +
          "<td>" + escapeHtml(probe.label || "—") + "</td>" +
          "<td class=\"muted\">" + escapeHtml(probe.method || "—") + "</td>" +
          "<td><span class=\"status " + statusClass + "\">" + escapeHtml(statusLabel) + "</span></td>" +
          "<td>" + (skipped ? "—" : escapeHtml(String(probe.status || "—"))) + "</td>" +
          "<td>" + (skipped ? "—" : escapeHtml(String(probe.ms != null ? probe.ms : "—")) + " ms") + "</td>" +
          "<td>" + note + "</td>" +
          "</tr>";
      }).join("");
      wrap.innerHTML = "<table class=\"sa-table\" aria-label=\"API probe results\">" +
        "<thead><tr><th>Route</th><th>Method</th><th>Result</th><th>Status</th><th>Latency</th><th>Note</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table>";
      if (statusEl) {
        const failed = summary.failed || 0;
        const passed = summary.passed || 0;
        const tested = summary.tested || 0;
        statusEl.textContent = failed
          ? ("API probes: " + passed + "/" + tested + " passed (" + failed + " failed).")
          : ("API probes: " + passed + "/" + tested + " passed.");
        statusEl.className = failed ? "status error" : "status ok";
      }
    }

    async function runSaApiProbes() {
      if (!guardSuperadminAction()) return;
      const wrap = $("sa-health-probes-wrap");
      const statusEl = $("sa-health-status");
      const btn = $("sa-btn-run-api-probes");
      if (wrap) wrap.innerHTML = "<p class=\"muted\">Running probes…</p>";
      if (statusEl) { statusEl.textContent = "Running API probes…"; statusEl.className = "status"; }
      if (btn) btn.disabled = true;
      try {
        const data = await saFetchAdmin("/api/admin/health/probes");
        renderSaApiProbes(data);
      } catch (err) {
        if (wrap) wrap.innerHTML = "<p class=\"sa-empty\">" + escapeHtml(err.message || "API probes failed.") + "</p>";
        if (statusEl) { statusEl.textContent = err.message || "API probes failed."; statusEl.className = "status error"; }
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function saClearReadingsCache(date) {
      const statusEl = $("sa-readings-status");
      const body = date ? { date: date } : {};
      if (statusEl) { statusEl.textContent = "Clearing…"; statusEl.className = "status"; }
      try {
        await saFetchAdmin("/api/admin/readings-cache/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (statusEl) { statusEl.textContent = date ? ("Cleared " + date + ".") : "Entire readings cache cleared."; statusEl.className = "status ok"; }
        loadSaReadingsCache();
        if (saState.panel === "dashboard") loadSaDashboard();
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Clear failed."; statusEl.className = "status error"; }
      }
    }

    async function saBootstrapSuperadmins(statusEl) {
      if (!guardSuperadminAction()) return;
      if (statusEl) { statusEl.textContent = "Bootstrapping…"; statusEl.className = "status"; }
      try {
        const data = await saFetchAdmin("/api/admin/bootstrap-superadmins", { method: "POST" });
        if (statusEl) {
          statusEl.textContent = "Promoted " + (data.promoted || 0) + " profile(s) from SUPERADMIN_EMAILS.";
          statusEl.className = "status ok";
        }
      } catch (err) {
        if (statusEl) { statusEl.textContent = err.message || "Bootstrap failed."; statusEl.className = "status error"; }
      }
    }

    function initSaNav() {
      if (saState.initialized) return;
      saState.initialized = true;
      buildSaMobileNav();
      document.querySelectorAll(".sa-nav-link[data-sa-panel]").forEach((link) => {
        link.addEventListener("click", () => showSaPanel(link.getAttribute("data-sa-panel")));
      });
      document.querySelectorAll("[data-sa-panel-jump]").forEach((btn) => {
        btn.addEventListener("click", () => showSaPanel(btn.getAttribute("data-sa-panel-jump")));
      });
      $("sa-btn-goto-membership") && $("sa-btn-goto-membership").addEventListener("click", () => showSaPanel("membership"));
      $("sa-btn-goto-templates") && $("sa-btn-goto-templates").addEventListener("click", () => showRoute("/design/templates"));
      $("sa-btn-open-templates") && $("sa-btn-open-templates").addEventListener("click", () => showRoute("/design/templates"));
      $("sa-btn-open-library") && $("sa-btn-open-library").addEventListener("click", () => showRoute("/library/songs"));
      $("sa-btn-sync-hymn-catalog") && $("sa-btn-sync-hymn-catalog").addEventListener("click", () => syncSaHymnCatalog());
      $("sa-btn-refresh-hymn-catalog") && $("sa-btn-refresh-hymn-catalog").addEventListener("click", () => {
        loadSaHymnCatalogStatus();
        loadSaSongPreviews();
      });
      const previewSearch = $("sa-preview-search");
      if (previewSearch) {
        let previewTimer = null;
        previewSearch.addEventListener("input", () => {
          clearTimeout(previewTimer);
          previewTimer = setTimeout(() => {
            saState.songPreviews.q = previewSearch.value.trim();
            saState.songPreviews.page = 1;
            loadSaSongPreviews();
          }, 280);
        });
      }
      const previewSection = $("sa-preview-section");
      if (previewSection) {
        previewSection.addEventListener("change", () => {
          saState.songPreviews.section = previewSection.value || "all";
          saState.songPreviews.page = 1;
          loadSaSongPreviews();
        });
      }
      const previewStatus = $("sa-preview-status");
      if (previewStatus) {
        previewStatus.addEventListener("change", () => {
          saState.songPreviews.status = previewStatus.value || "all";
          saState.songPreviews.page = 1;
          loadSaSongPreviews();
        });
      }
      const previewDuration = $("sa-preview-duration");
      if (previewDuration) {
        previewDuration.addEventListener("input", syncSaPreviewDurationLabel);
      }
      const previewWrap = $("sa-song-preview-wrap");
      if (previewWrap && !previewWrap.dataset.previewBound) {
        previewWrap.dataset.previewBound = "1";
        let urlCommitTimer = null;
        previewWrap.addEventListener("click", (e) => {
          const fetchBtn = e.target.closest("[data-sa-preview-fetch]");
          if (fetchBtn) {
            e.preventDefault();
            fetchSaSongPreview(
              fetchBtn.getAttribute("data-sa-preview-fetch"),
              fetchBtn.getAttribute("data-sa-preview-id"),
              fetchBtn.closest("tr"),
              fetchBtn
            );
            return;
          }
          const playBtn = e.target.closest("[data-sa-preview-play]");
          if (playBtn) {
            e.preventDefault();
            playSaSongPreview(
              playBtn.getAttribute("data-sa-preview-play"),
              playBtn.getAttribute("data-sa-preview-id"),
              playBtn
            );
            return;
          }
          const clearBtn = e.target.closest("[data-sa-preview-clear]");
          if (clearBtn) {
            e.preventDefault();
            clearSaSongPreview(
              clearBtn.getAttribute("data-sa-preview-clear"),
              clearBtn.getAttribute("data-sa-preview-id"),
              clearBtn
            );
          }
        });
        previewWrap.addEventListener("paste", (e) => {
          const input = e.target.closest("[data-sa-preview-url]");
          if (!input || !previewWrap.contains(input)) return;
          clearTimeout(urlCommitTimer);
          urlCommitTimer = setTimeout(() => commitSaPreviewYoutubeInput(input), 50);
        });
        previewWrap.addEventListener("change", (e) => {
          const input = e.target.closest("[data-sa-preview-url]");
          if (!input || !previewWrap.contains(input)) return;
          commitSaPreviewYoutubeInput(input);
        });
        previewWrap.addEventListener("keydown", (e) => {
          const input = e.target.closest("[data-sa-preview-url]");
          if (!input || !previewWrap.contains(input) || e.key !== "Enter") return;
          e.preventDefault();
          commitSaPreviewYoutubeInput(input, { warn: true });
        });
        previewWrap.addEventListener("input", (e) => {
          const input = e.target.closest("[data-sa-preview-url]");
          if (!input || !previewWrap.contains(input)) return;
          clearTimeout(urlCommitTimer);
          urlCommitTimer = setTimeout(() => {
            const ref = youtubeMediaRefFromInput(input.value);
            if (ref) commitSaPreviewYoutubeInput(input);
          }, 650);
        });
      }
      $("sa-btn-clear-readings-cache") && $("sa-btn-clear-readings-cache").addEventListener("click", () => {
        if (!confirm("Clear the entire readings cache?")) return;
        saClearReadingsCache(null);
      });
      $("sa-btn-clear-readings-all") && $("sa-btn-clear-readings-all").addEventListener("click", () => {
        if (!confirm("Clear the entire readings cache?")) return;
        saClearReadingsCache(null);
      });
      $("sa-btn-clear-readings-date") && $("sa-btn-clear-readings-date").addEventListener("click", () => {
        const d = $("sa-readings-clear-date") && $("sa-readings-clear-date").value;
        if (!d) { notify("Choose a date first.", "info"); return; }
        saClearReadingsCache(d);
      });
      $("sa-btn-bootstrap-superadmins") && $("sa-btn-bootstrap-superadmins").addEventListener("click", () => saBootstrapSuperadmins($("sa-dashboard-status")));
      $("sa-btn-bootstrap-superadmins-2") && $("sa-btn-bootstrap-superadmins-2").addEventListener("click", () => saBootstrapSuperadmins($("sa-health-status")));
      $("sa-btn-refresh-health") && $("sa-btn-refresh-health").addEventListener("click", () => loadSaHealth());
      $("sa-btn-run-api-probes") && $("sa-btn-run-api-probes").addEventListener("click", () => runSaApiProbes());
      const parishSearch = $("sa-parishes-search");
      if (parishSearch) {
        let t = null;
        parishSearch.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => { saState.parishes.q = parishSearch.value.trim(); saState.parishes.page = 1; loadSaParishes(); }, 300);
        });
      }
      const usersSearch = $("sa-users-search");
      if (usersSearch) {
        let t = null;
        usersSearch.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => { saState.users.q = usersSearch.value.trim(); saState.users.page = 1; loadSaUsers(); }, 300);
        });
      }
      const genSearch = $("sa-generations-search");
      if (genSearch) {
        let t = null;
        genSearch.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => { saState.generations.q = genSearch.value.trim(); saState.generations.page = 1; loadSaGenerations(); }, 300);
        });
      }
      const auditSearch = $("sa-audit-search");
      if (auditSearch) {
        let t = null;
        auditSearch.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => { saState.auditLog.q = auditSearch.value.trim(); saState.auditLog.page = 1; loadSaAuditLog(); }, 300);
        });
      }
      const auditAction = $("sa-audit-action-filter");
      if (auditAction) {
        auditAction.addEventListener("change", () => {
          saState.auditLog.action = auditAction.value || "";
          saState.auditLog.page = 1;
          loadSaAuditLog();
        });
      }
      const auditEntity = $("sa-audit-entity-filter");
      if (auditEntity) {
        auditEntity.addEventListener("change", () => {
          saState.auditLog.entityType = auditEntity.value || "";
          saState.auditLog.page = 1;
          loadSaAuditLog();
        });
      }
      $("sa-audit-refresh") && $("sa-audit-refresh").addEventListener("click", () => loadSaAuditLog());
      $("sa-btn-merge-parishes") && $("sa-btn-merge-parishes").addEventListener("click", () => saMergeParishes(null, null, false));
      const mergeSource = $("sa-merge-source");
      if (mergeSource) {
        mergeSource.addEventListener("change", () => {
          saFillParishSelect($("sa-merge-target"), mergeSource.value || null);
        });
      }
      $("sa-btn-save-announcement") && $("sa-btn-save-announcement").addEventListener("click", () => saveSaAnnouncementAdmin());
      $("sa-btn-refresh-announcement") && $("sa-btn-refresh-announcement").addEventListener("click", () => loadSaAnnouncementAdmin());
      $("sa-analytics-refresh") && $("sa-analytics-refresh").addEventListener("click", () => loadSaAnalytics());
      $("sa-analytics-days") && $("sa-analytics-days").addEventListener("change", () => loadSaAnalytics());
      $("sa-storage-refresh") && $("sa-storage-refresh").addEventListener("click", () => loadSaStorageBrowser());
      $("sa-storage-up") && $("sa-storage-up").addEventListener("click", () => {
        const prefix = saState.storage.prefix || "";
        const parts = prefix.split("/").filter(Boolean);
        parts.pop();
        saState.storage.prefix = parts.join("/");
        saState.storage.page = 1;
        loadSaStorageBrowser();
      });
      $("sa-parishes-refresh") && $("sa-parishes-refresh").addEventListener("click", () => { loadSaParishes(); saPopulateMergeSelects(); });
      $("sa-btn-create-parish") && $("sa-btn-create-parish").addEventListener("click", () => createSaParish());
      $("sa-users-refresh") && $("sa-users-refresh").addEventListener("click", () => loadSaUsers());

      const saPageEl = $("superadmin-page");
      if (saPageEl && !saPageEl.dataset.pagerBound) {
        saPageEl.dataset.pagerBound = "1";
        saPageEl.addEventListener("click", (e) => {
          const prev = e.target.closest(".sa-pager-prev");
          const next = e.target.closest(".sa-pager-next");
          const btn = prev || next;
          if (!btn || btn.disabled) return;
          const scope = btn.getAttribute("data-sa-pager");
          if (!scope || !saState[scope]) return;
          if (prev) saState[scope].page = Math.max(1, (saState[scope].page || 1) - 1);
          else saState[scope].page = (saState[scope].page || 1) + 1;
          if (scope === "parishes") loadSaParishes();
          else if (scope === "users") loadSaUsers();
          else if (scope === "generations") loadSaGenerations();
          else if (scope === "auditLog") loadSaAuditLog();
          else if (scope === "aiQuota") loadSaParishQuotaTable();
          else if (scope === "songPreviews") loadSaSongPreviews();
        });
        saPageEl.addEventListener("click", (e) => {
          const row = e.target.closest(".sa-parish-row");
          if (!row || !row.getAttribute("data-parish-id")) return;
          openSaParishDrawer(row.getAttribute("data-parish-id"));
        });
        saPageEl.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const row = e.target.closest(".sa-parish-row");
          if (!row) return;
          e.preventDefault();
          openSaParishDrawer(row.getAttribute("data-parish-id"));
        });
      }

      $("sa-parish-drawer-close") && $("sa-parish-drawer-close").addEventListener("click", closeSaParishDrawer);
      $("sa-parish-drawer-backdrop") && $("sa-parish-drawer-backdrop").addEventListener("click", closeSaParishDrawer);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && saState.parishDrawerId) closeSaParishDrawer();
      });

      $("settings-team-create-invite") && $("settings-team-create-invite").addEventListener("click", async () => {
        const emailEl = $("settings-team-invite-email");
        const statusEl = $("settings-team-status");
        const urlWrap = $("settings-team-url-wrap");
        const urlInput = $("settings-team-invite-url");
        if (statusEl) { statusEl.textContent = "Creating invite…"; statusEl.className = "status"; }
        try {
          const data = await parishFetch("/api/parish/team/invites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailEl ? emailEl.value.trim() : "" }),
          });
          const url = data.invite_url || "";
          if (urlInput) urlInput.value = url;
          if (urlWrap) urlWrap.hidden = !url;
          if (statusEl) { statusEl.textContent = "Invite created. Send the link to your media teammate."; statusEl.className = "status ok"; }
          loadSettingsParishTeam();
        } catch (err) {
          if (statusEl) { statusEl.textContent = err.message || "Could not create invite."; statusEl.className = "status err"; }
        }
      });
      $("settings-team-refresh") && $("settings-team-refresh").addEventListener("click", () => loadSettingsParishTeam());
      $("settings-team-copy-url") && $("settings-team-copy-url").addEventListener("click", async () => {
        const inp = $("settings-team-invite-url");
        if (!inp || !inp.value) return;
        try {
          await navigator.clipboard.writeText(inp.value);
          notify("Invite link copied.", "ok");
        } catch (_e) {
          inp.select();
          document.execCommand("copy");
          notify("Invite link copied.", "ok");
        }
      });
      $("sa-generations-refresh") && $("sa-generations-refresh").addEventListener("click", () => loadSaGenerations());
      $("sa-btn-create-invite") && $("sa-btn-create-invite").addEventListener("click", () => createSaInvite());
      $("sa-btn-refresh-invites") && $("sa-btn-refresh-invites").addEventListener("click", () => loadSaInvites());
      $("sa-invite-mode-existing") && $("sa-invite-mode-existing").addEventListener("change", saSyncInviteModeUi);
      $("sa-invite-mode-new") && $("sa-invite-mode-new").addEventListener("change", saSyncInviteModeUi);
      $("sa-invite-parish-search") && $("sa-invite-parish-search").addEventListener("change", saResolveInviteParishId);
      $("sa-invite-parish-search") && $("sa-invite-parish-search").addEventListener("blur", saResolveInviteParishId);
      $("sa-btn-copy-invite-url") && $("sa-btn-copy-invite-url").addEventListener("click", async () => {
        const inp = $("sa-invite-url");
        if (!inp || !inp.value) return;
        try {
          await navigator.clipboard.writeText(inp.value);
          notify("Invite link copied.", "ok");
        } catch (_e) {
          inp.select();
          document.execCommand("copy");
          notify("Invite link copied.", "ok");
        }
      });
    }

    function initSuperadminPage() {
      if (!canAccessSuperadminRoute()) return;
      initSaNav();
      showSaPanel(saState.panel || "dashboard");
    }

    async function refreshCommunity() {
      const auth = window.VerbumAuth;
      if (!auth) return;
      if (!auth.isReady || !auth.isReady()) {
        if (auth.waitUntilReady) await auth.waitUntilReady();
      }
      if (auth.isReady && !auth.isReady()) return;

      const cfg = auth.getConfig ? auth.getConfig() : null;
      if (cfg && cfg.auth_enabled && auth.getUser && !auth.getUser()) {
        const statusEl = $("settings-church-status");
        if (statusEl && normalizeRoute(window.location.pathname) === "/settings/church") {
          statusEl.textContent = "Sign in to load and save your church profile.";
          statusEl.className = "status error";
        }
        return;
      }

      const cached = auth.getCommunityPayload ? auth.getCommunityPayload() : null;
      const cacheReady = cached && cached.membership_status !== undefined;
      if (cached) {
        applyCommunityPayload(cached);
        updateAccountMenuDisplay();
      }

      if (cacheReady) {
        fetchCommunityFromServer().catch(() => { /* keep cached UI */ });
        return;
      }

      try {
        await fetchCommunityFromServer();
        const statusEl = $("settings-church-status");
        if (
          statusEl &&
          statusEl.className === "status error" &&
          statusEl.textContent === "Sign in to load and save your church profile."
        ) {
          statusEl.textContent = "";
          statusEl.className = "status";
        }
      } catch (error) {
        if (cached) return;
        const statusEl = $("settings-church-status");
        if (statusEl) {
          if (error.status === 401) {
            statusEl.textContent = "Sign in to load and save your church profile.";
          } else {
            statusEl.textContent = error.message || "Could not load church profile.";
          }
          statusEl.className = "status error";
        }
      }
    }

    async function refreshGeminiSettings() {
      const hintEl = $("sa-gemini-api-key-hint");
      if (!hintEl) return;
      try {
        const res = await fetch("/api/settings/gemini-api-key");
        const data = await res.json();
        if (data.configured) {
          hintEl.textContent = data.key_hint
            ? "Configured (ends with …" + data.key_hint + "). Enter a new key to replace."
            : "Configured. Enter a new key to replace.";
        } else {
          hintEl.textContent = "Not configured. Paste your Gemini API key and save.";
        }
      } catch (_e) {
        hintEl.textContent = "Could not load Gemini key status.";
      }
    }

    function queueLogoUpload(file) {
      const statusEl = $("logo-status");
      if (!file) {
        if (statusEl) {
          statusEl.textContent = "Please select a file.";
          statusEl.className = "status error";
        }
        return;
      }
      if (!churchMembershipState.can_edit_logo) {
        if (statusEl) {
          statusEl.textContent = "Parish logo is locked and cannot be changed.";
          statusEl.className = "status error";
        }
        if ($("church-logo")) $("church-logo").value = "";
        return;
      }
      if (churchMembershipState.community_name_locked && !churchMembershipState.logo_locked) {
        pendingLogoUploadFile = file;
        const reader = new FileReader();
        reader.onload = () => {
          const img = $("logo-lock-preview-img");
          if (img) img.src = reader.result;
          setUiOverlayOpen($("logo-lock-modal"), true);
        };
        reader.readAsDataURL(file);
        return;
      }
      uploadLogo(file);
    }

    async function uploadLogo(file) {
      const statusEl = $("logo-status");
      const uploadBtn = $("btn-upload-logo");
      const chosen = file || pendingLogoUploadFile;
      if (!chosen) {
        if (statusEl) {
          statusEl.textContent = "Please select a file.";
          statusEl.className = "status error";
        }
        return;
      }
      if (statusEl) {
        statusEl.textContent = "Uploading logo...";
        statusEl.className = "status";
      }
      if (uploadBtn) uploadBtn.disabled = true;
      try {
        const formData = new FormData();
        formData.append("file", chosen);
        const logoHeaders = window.VerbumAuth && window.VerbumAuth.getAuthHeaders
          ? await window.VerbumAuth.getAuthHeaders()
          : {};
        const res = await fetch("/api/upload-logo", { method: "POST", headers: logoHeaders, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");
        closeLogoLockModal();
        if (data.logo_url) {
          updateChurchLogoAvatar(data.logo_url);
          if (window.VerbumAuth && window.VerbumAuth.setCommunityPayload) {
            window.VerbumAuth.setCommunityPayload(data);
          }
          syncMembershipUi(data);
        }
        if (statusEl) {
          statusEl.textContent = data.message || "Logo uploaded successfully!";
          statusEl.className = "status ok";
        }
        if ($("church-logo")) $("church-logo").value = "";
        refreshCommunity();
      } catch (error) {
        if (statusEl) {
          statusEl.textContent = error.message || "Upload failed";
          statusEl.className = "status error";
        }
      } finally {
        if (uploadBtn) uploadBtn.disabled = false;
        pendingLogoUploadFile = null;
      }
    }

    var RECENT_KEY = "churchMediaRecentDownloads";

    function readRecent() {
      try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      } catch (_e) {
        return [];
      }
    }

    function pushRecent(entry) {
      const raw = readRecent();
      raw.unshift(Object.assign({ t: Date.now() }, entry));
      localStorage.setItem(RECENT_KEY, JSON.stringify(raw.slice(0, 14)));
      renderHistoryList();
    }

    function renderRecentInto(el) {
      if (!el) return;
      const raw = readRecent();
      if (!raw.length) {
        el.innerHTML = "<span class=\"muted\">No recent downloads yet. Generate a deck to populate this list.</span>";
        return;
      }
      el.innerHTML = raw.map((row) => (
        "<div style=\"padding:10px 0;border-bottom:1px solid var(--line);\">" +
          "<strong>" + escapeHtml(row.title || "Mass export") + "</strong>" +
          "<div class=\"muted\" style=\"font-size:0.82rem;margin-top:4px;\">" + escapeHtml(row.date || "") + "</div>" +
          "<div style=\"display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;\">" +
            (row.zip_url ? "<a href=\"" + row.zip_url + "\">ZIP</a>" : "") +
            (row.pptx_url ? "<a href=\"" + row.pptx_url + "\">PowerPoint</a>" : "") +
            (row.poster_url ? "<a href=\"" + row.poster_url + "\">Poster</a>" : "") +
          "</div>" +
        "</div>"
      )).join("");
    }

    function renderHistoryList() {
      renderRecentInto($("history-list"));
    }

    function isPsalmReference(ref) {
      return /^(?:Psalm|Psalms)\s+\d+/i.test(String(ref || "").trim());
    }

    function responsorialSectionLabel(ref) {
      const r = String(ref || "").trim();
      if (isPsalmReference(r)) return "Responsorial Psalm";
      if (/^(?:\d+\s+)?[A-Za-z][A-Za-z\s]+?\s+\d+\s*:/.test(r)) return "Responsorial Canticle";
      return "Responsorial Psalm";
    }

    function psalmCardReference(data) {
      return String((data && (data.psalm_reference || data.psalm)) || "").trim() || "—";
    }

    function calExtractPsalmRefrain(psalmText) {
      let line = (psalmText || "").trim().split("\n\n")[0].split("\n")[0].trim();
      if (!line) return "";
      line = line.replace(/^R\.?\s*/i, "").trim();
      const m = line.match(/^(.+?[.!?])/);
      if (m) line = m[1].trim();
      return line;
    }

    function psalmCardBody(data) {
      const refrains = Array.isArray(data && data.psalm_refrains) ? data.psalm_refrains.filter(Boolean) : [];
      let refrain = refrains.length ? String(refrains[0]).replace(/\s+/g, " ").trim() : "";
      if (!refrain) refrain = calExtractPsalmRefrain((data && data.psalm_text) || "");
      if (!refrain && data) refrain = calExtractPsalmRefrain(data.psalm_response || "");
      if (!refrain) {
        const first = String((data && data.psalm_text) || "").trim().split("\n")[0].trim();
        if (/^R\.?\s/i.test(first)) return first;
        return "";
      }
      return /^R\.?\s/i.test(refrain) ? refrain : "R. " + refrain;
    }

    var FLOW_FOOD_MAX = 24;

    function syncFlowPsalmOverrideHidden() {
      /* legacy no-op — psalm custom line is sent directly from #flow-psalm-custom */
    }

    function setFlowPsalmUI(_text) {
      /* legacy no-op — psalm preview lives in #flow-psalm-body */
    }

    function syncFlowFoodSponsorsHidden() {
      const hidden = $("flow-food-sponsors");
      if (!hidden) return;
      hidden.value = getFlowFoodSponsorsLines().join("\n");
    }

    
    (function initAnnouncementSlideToggles() {
      const pairs = [
        ["flow-slide-mass-collection", "collection"],
        ["flow-slide-food-sponsor", "food"],
        ["flow-slide-sponsorship-contact", "contact"],
        ["flow-slide-merienda-location", "merienda"],
      ];
      function syncAnnouncementFields() {
        pairs.forEach(([cbId, key]) => {
          const cb = document.getElementById(cbId);
          const panel = document.querySelector('[data-ann-fields="' + key + '"]');
          if (!panel) return;
          const on = !!(cb && cb.checked);
          panel.hidden = !on;
        });
      }
      pairs.forEach(([cbId]) => {
        const cb = document.getElementById(cbId);
        if (cb) cb.addEventListener("change", syncAnnouncementFields);
      });
      syncAnnouncementFields();
      window.syncAnnouncementSlideFields = syncAnnouncementFields;
    })();

    function getFlowFoodSponsorsLines() {
      const list = ensureFoodSponsorsList();
      if (!list) return [];
      return Array.from(list.querySelectorAll(".flow-input-list-text")).map((el) => (el.textContent || "").trim()).filter(Boolean);
    }

    function ensureFoodSponsorsList() {
      let list = $("flow-food-sponsors-list");
      if (list) return list;
      list = document.createElement("ul");
      list.id = "flow-food-sponsors-list";
      list.className = "flow-input-list flow-input-list--compact mw-aside__sponsor-list";
      list.setAttribute("aria-live", "polite");
      const host = $("mw-aside-sponsors-list-host") || $("flow-food-sponsors-mobile-host");
      if (host) host.appendChild(list);
      return list;
    }

    function syncFoodSponsorsEmptyState() {
      const list = $("flow-food-sponsors-list");
      const has = !!(list && list.children.length);
      ["mw-aside-sponsors-empty", "mw-aside-sponsors-empty-mobile"].forEach((id) => {
        const el = $(id);
        if (el) el.hidden = has;
      });
    }

    function syncFoodSponsorsListHost() {
      const list = ensureFoodSponsorsList();
      const asideHost = $("mw-aside-sponsors-list-host");
      const mobileHost = $("flow-food-sponsors-mobile-host");
      if (!list || !asideHost || !mobileHost) return;
      const mobile = !!(window.matchMedia && window.matchMedia("(max-width: 1023px)").matches);
      const target = mobile ? mobileHost : asideHost;
      if (list.parentElement !== target) target.appendChild(list);
      syncFoodSponsorsEmptyState();
      if (typeof window.MassWizard !== "undefined" && window.MassWizard.getStep && window.MassWizard.getStep() === 6) {
        try { document.dispatchEvent(new CustomEvent("mw:aside-refresh")); } catch (_e) { /* ignore */ }
      }
    }
    window.syncFoodSponsorsListHost = syncFoodSponsorsListHost;

    function renderFlowFoodSponsorsList(lines) {
      const list = ensureFoodSponsorsList();
      if (!list) return;
      list.innerHTML = (lines || []).map((line, idx) => (
        "<li class=\"flow-input-list-item\">" +
        "<span class=\"flow-input-list-text\">" + escapeHtml(line) + "</span>" +
        "<button type=\"button\" class=\"ghost mini flow-input-list-remove\" data-food-idx=\"" + idx + "\" aria-label=\"Remove sponsor\">×</button>" +
        "</li>"
      )).join("");
      syncFoodSponsorsListHost();
    }

    function setFlowFoodSponsorsUI(lines) {
      renderFlowFoodSponsorsList((lines || []).map((s) => String(s).trim()).filter(Boolean).slice(0, FLOW_FOOD_MAX));
      syncFlowFoodSponsorsHidden();
    }

    function addFlowFoodSponsor(name) {
      const t = (name || "").trim();
      if (!t) return;
      const lines = getFlowFoodSponsorsLines();
      if (lines.some((x) => x.toLowerCase() === t.toLowerCase())) return;
      if (lines.length >= FLOW_FOOD_MAX) return;
      lines.push(t);
      renderFlowFoodSponsorsList(lines);
      syncFlowFoodSponsorsHidden();
      updateFlowParagraphPreviews();
    }

    function initFlowInputGroups() {
      const foodIn = $("flow-food-sponsor-input");
      const foodAdd = $("btn-flow-food-add");
      ensureFoodSponsorsList();
      syncFoodSponsorsListHost();
      if (window.matchMedia) {
        const mq = window.matchMedia("(max-width: 1023px)");
        const onMq = () => syncFoodSponsorsListHost();
        if (mq.addEventListener) mq.addEventListener("change", onMq);
        else if (mq.addListener) mq.addListener(onMq);
      }

      function bindEnterToAdd(input, addFn) {
        if (!input) return;
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addFn();
          }
        });
      }

      if (foodAdd) {
        foodAdd.addEventListener("click", () => {
          addFlowFoodSponsor(foodIn && foodIn.value);
          if (foodIn) foodIn.value = "";
          foodIn && foodIn.focus();
        });
      }
      bindEnterToAdd(foodIn, () => foodAdd && foodAdd.click());

      const foodList = ensureFoodSponsorsList();
      if (foodList) {
        foodList.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-food-idx]");
          if (!btn) return;
          const lines = getFlowFoodSponsorsLines();
          const idx = parseInt(btn.getAttribute("data-food-idx"), 10);
          if (Number.isNaN(idx)) return;
          lines.splice(idx, 1);
          renderFlowFoodSponsorsList(lines);
          syncFlowFoodSponsorsHidden();
          updateFlowParagraphPreviews();
        });
      }
    }

    function updateFlowParagraphPreviews() {
      syncFlowFoodSponsorsHidden();
    }

    function splitGospelSlideSentences(text) {
      const raw = String(text || "").replace(/\s+/g, " ").trim();
      if (!raw) return [];
      return raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    }

    function formatSlidePickLabel(text, index, total) {
      const label = String(text || "").replace(/\s+/g, " ").trim();
      if (!label) return "Option " + (index + 1);
      if (total <= 1) return label;
      return (index + 1) + ". " + label;
    }

    function setSlidePickPlaceholder(sel, message) {
      sel.innerHTML = "";
        const o = document.createElement("option");
      o.value = "";
      o.textContent = message;
      o.disabled = true;
      o.selected = true;
        sel.appendChild(o);
      sel.disabled = true;
      refreshVerbumSelect(sel);
    }

    function populateGospelSentenceSelect(data) {
      const sel = $("flow-gospel-sentence");
      if (!sel) return;
      sel.innerHTML = "";
      let sents = Array.isArray(data.sentences) ? data.sentences.filter(Boolean) : [];
      if (!sents.length) {
        const quote = (data.gospel_slide_quote || data.gospel_quote || data.gospel_text || "").trim();
        sents = splitGospelSlideSentences(quote);
      }
      if (!sents.length) {
        setSlidePickPlaceholder(sel, "No sentences found — use custom line below");
        return;
      }
      sel.disabled = false;
      sents.forEach((s, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = formatSlidePickLabel(s, i, sents.length);
        sel.appendChild(o);
      });
      refreshVerbumSelect(sel);
    }

    function populatePsalmRefrainSelect(data) {
      const sel = $("flow-psalm-refrain");
      if (!sel) return;
      sel.innerHTML = "";
      let refrains = Array.isArray(data.psalm_refrains) ? data.psalm_refrains.filter(Boolean) : [];
      if (!refrains.length) {
        setSlidePickPlaceholder(sel, "No refrain found — use custom refrain below");
        return;
      }
      sel.disabled = false;
      refrains.forEach((s, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        const line = String(s || "").replace(/\s+/g, " ").trim();
        const withResponse = /^R\.?\s/i.test(line) ? line : "R. " + line;
        o.textContent = formatSlidePickLabel(withResponse, i, refrains.length);
        sel.appendChild(o);
      });
      refreshVerbumSelect(sel);
    }

    function formatLiturgicalSeasonLabel(seasonStr) {
      const raw = (seasonStr || "").split(",")[0].trim();
      if (!raw) return "Ordinary Time";
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    function formatLectionaryYearLabel(cycle) {
      const c = (cycle || "").trim();
      if (!c) return "—";
      if (/^year\s/i.test(c)) return c;
      return "Year " + c;
    }

    function applyLiturgicalColorBar(lc) {
      const hex = (lc && lc.hex) ? String(lc.hex).trim() : "";
      const bar = $("topbar-liturgical-color-bar");
      if (!bar) return;
      bar.style.background = hex || "var(--liturgical-ordinary)";
    }

    function applyLiturgicalIndicatorStyle(preset, liturgicalColor) {
      const btn = $("liturgical-indicator-btn");
      if (!btn) return;
      const isOrdinary = (preset || "ordinary") === "ordinary";
      btn.classList.toggle("liturgical-indicator--ordinary", isOrdinary);
      if (isOrdinary) applyLiturgicalColorBar(liturgicalColor);
    }

    var WYD_2027_START_ISO = "2027-08-03";
    var USER_EVENTS_KEY = "verbumUserEvents";
    var USER_EVENT_NAME_KEY = "verbumUserEventName";
    var USER_EVENT_DATE_KEY = "verbumUserEventDate";
    var liturgicalCountdownTimer = null;

    function parseLocalDateISO(iso) {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      const parts = iso.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }

    function formatCountdown(target) {
      if (!target || Number.isNaN(target.getTime())) return "—";
      let ms = target.getTime() - Date.now();
      if (ms <= 0) return "Now";
      const days = Math.floor(ms / 86400000);
      ms -= days * 86400000;
      const hours = Math.floor(ms / 3600000);
      ms -= hours * 3600000;
      const mins = Math.floor(ms / 60000);
      if (days > 0) return days + "d " + hours + "h " + mins + "m";
      if (hours > 0) return hours + "h " + mins + "m";
      return mins + "m";
    }

    function formatNiceDate(iso) {
      const d = parseLocalDateISO(iso);
      if (!d) return "—";
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }

    function formatNiceTime(timeStr) {
      const t = (timeStr || "").trim();
      if (!t || !/^\d{2}:\d{2}/.test(t)) return "";
      const parts = t.split(":").map(Number);
      const d = new Date(2000, 0, 1, parts[0] || 0, parts[1] || 0);
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }

    function formatEventRangeLabel(startIso, endIso) {
      const start = (startIso || "").trim();
      if (!start) return "";
      const end = (endIso || "").trim() || start;
      if (start === end) return formatNiceDate(start);
      return formatNiceDate(start) + " – " + formatNiceDate(end);
    }

    function formatEventMeta(ev) {
      const range = formatEventRangeLabel(ev.date, ev.dateEnd || ev.date);
      const time = formatNiceTime(ev.time);
      if (range && time) return range + " · " + time;
      return range || time || "—";
    }

    function parseEventDateTime(ev) {
      const d = parseLocalDateISO(ev && ev.date);
      if (!d) return null;
      const t = ev && ev.time ? String(ev.time).trim() : "";
      if (t && /^\d{2}:\d{2}/.test(t)) {
        const parts = t.split(":").map(Number);
        d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
      }
      return d;
    }

    function startOfTodayLocal() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function eventStartDay(ev) {
      const d = parseLocalDateISO(ev && ev.date);
      if (!d) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function eventEndDay(ev) {
      const iso = ((ev && (ev.dateEnd || ev.date)) || "").trim();
      const d = parseLocalDateISO(iso);
      if (!d) return null;
      d.setHours(23, 59, 59, 999);
      return d;
    }

    function isEventExpired(ev) {
      const end = eventEndDay(ev);
      return !end || end.getTime() < Date.now();
    }

    function isEventOngoing(ev) {
      if (isEventExpired(ev)) return false;
      const start = eventStartDay(ev);
      const today = startOfTodayLocal();
      if (!start) return false;
      return today.getTime() >= start.getTime();
    }

    function isEventUpcoming(ev) {
      if (isEventExpired(ev)) return false;
      const start = eventStartDay(ev);
      const today = startOfTodayLocal();
      if (!start) return false;
      return start.getTime() > today.getTime();
    }

    function purgeExpiredUserEvents() {
      const events = getUserEvents();
      const active = events.filter((e) => !isEventExpired(e));
      if (active.length !== events.length) {
        saveUserEvents(active);
      }
      return active;
    }

    function getActiveUserEvents() {
      purgeExpiredUserEvents();
      return getUserEvents().filter((e) => !isEventExpired(e));
    }

    function formatEventStatusCountdown(ev, kind) {
      if (kind === "ongoing") {
        const end = eventEndDay(ev);
        const endDay = parseLocalDateISO(ev.dateEnd || ev.date);
        const today = startOfTodayLocal();
        if (endDay && endDay.getTime() === today.getTime()) return "Ends today";
        return "Ends in " + formatCountdown(end);
      }
      const t = parseEventDateTime(ev);
      return "Starts in " + formatCountdown(t);
    }

    function eventDateBadgeParts(ev) {
      const d = parseLocalDateISO(ev && ev.date);
      if (!d) return { day: "—", month: "" };
      return {
        day: String(d.getDate()),
        month: d.toLocaleDateString(undefined, { month: "short" }),
      };
    }

    function renderHomeEventItemMarkup(ev, kind) {
      const badge = eventDateBadgeParts(ev);
      const time = formatNiceTime(ev.time);
      const metaParts = [];
      if (time) metaParts.push(time);
      if (kind === "ongoing") metaParts.push(formatEventStatusCountdown(ev, kind));
      const meta = metaParts.join(" · ");
      return (
        "<li class=\"home-events-item home-events-item--" + kind + "\">" +
        "<div class=\"home-events-item__badge\" aria-hidden=\"true\">" +
          "<span class=\"home-events-item__badge-day\">" + escapeHtml(badge.day) + "</span>" +
          "<span class=\"home-events-item__badge-month\">" + escapeHtml(badge.month) + "</span>" +
        "</div>" +
        "<div class=\"home-events-item__body\">" +
          "<p class=\"home-events-item__name\">" + escapeHtml(ev.name) + "</p>" +
          (meta ? "<p class=\"home-events-item__meta\">" + escapeHtml(meta) + "</p>" : "") +
        "</div>" +
        "</li>"
      );
    }

    function renderLiturgicalEventItemMarkup(ev, kind) {
      return (
        "<li class=\"liturgical-panel-event liturgical-panel-event--" + kind + "\">" +
        "<span class=\"liturgical-panel-event__name\">" + escapeHtml(ev.name) + "</span>" +
        "<span class=\"liturgical-panel-event__when\">" + escapeHtml(formatEventMeta(ev)) + "</span>" +
        "<span class=\"liturgical-panel-event__cd\">" + escapeHtml(formatEventStatusCountdown(ev, kind)) + "</span>" +
        "</li>"
      );
    }

    var EVENTS_MONTH_FILTER_THRESHOLD = 5;
    var liturgicalSundayCelebrationsCache = {};

    function getNextThreeSundayISOs() {
      const sun = getNextSundayCountdownTarget();
      if (!sun.target) return [];
      const isos = [];
      let d = new Date(sun.target.getTime());
      for (let i = 0; i < 3; i++) {
        isos.push(formatDateInput(d));
        d.setDate(d.getDate() + 7);
      }
      return isos;
    }

    function eventsForDisplay(rawEvents) {
      if (!rawEvents || !rawEvents.length) return [];
      if (rawEvents.length <= EVENTS_MONTH_FILTER_THRESHOLD) return rawEvents;
      const monthStart = startOfTodayLocal();
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return rawEvents.filter((ev) => {
        const start = eventStartDay(ev);
        const end = eventEndDay(ev);
        if (!start || !end) return false;
        return start.getTime() <= monthEnd.getTime() && end.getTime() >= monthStart.getTime();
      });
    }

    async function updateLiturgicalSundayCelebrations() {
      const listEl = $("liturgical-sunday-celebrations");
      if (!listEl) return;
      const isos = getNextThreeSundayISOs();
      if (!isos.length) {
        listEl.innerHTML = "";
        return;
      }
      listEl.innerHTML = isos.map((iso) => (
        "<li class=\"liturgical-sunday-celebration\">" +
          "<span class=\"liturgical-sunday-celebration__date\">" + escapeHtml(formatNiceDate(iso)) + "</span>" +
          "<span class=\"liturgical-sunday-celebration__title\" data-celebration-iso=\"" + escapeHtml(iso) + "\">Loading…</span>" +
        "</li>"
      )).join("");
      await Promise.all(isos.map(async (iso) => {
        if (liturgicalSundayCelebrationsCache[iso]) return;
        const snap = calendarMonthData && calendarMonthData[iso];
        if (snap && snap.title) {
          liturgicalSundayCelebrationsCache[iso] = snap.title;
          return;
        }
        try {
          const data = await fetchReadings(iso);
          liturgicalSundayCelebrationsCache[iso] = (data.title || "").trim() || "Sunday Mass";
        } catch (_e) {
          liturgicalSundayCelebrationsCache[iso] = "Sunday Mass";
        }
      }));
      isos.forEach((iso) => {
        const titleEl = listEl.querySelector("[data-celebration-iso=\"" + iso + "\"]");
        if (titleEl) titleEl.textContent = liturgicalSundayCelebrationsCache[iso] || "Sunday Mass";
      });
    }

    function renderEventsSectionHtml(title, items, kind, itemRenderer) {
      if (!items.length) return "";
      const listHtml = items.map((ev) => itemRenderer(ev, kind)).join("");
      return (
        "<section class=\"home-events-section home-events-section--" + kind + "\">" +
        "<h4 class=\"home-events-section__title\">" + escapeHtml(title) + "</h4>" +
        "<ul class=\"home-events-list\">" + listHtml + "</ul>" +
        "</section>"
      );
    }

    function migrateLegacyUserEvent() {
      try {
        const raw = localStorage.getItem(USER_EVENTS_KEY);
        if (raw) return;
        const name = (localStorage.getItem(USER_EVENT_NAME_KEY) || "").trim();
        const date = (localStorage.getItem(USER_EVENT_DATE_KEY) || "").trim();
        if (name && date) {
          localStorage.setItem(USER_EVENTS_KEY, JSON.stringify([{ id: "legacy-" + Date.now(), name, date }]));
        }
      } catch (_e) { /* ignore */ }
    }

    function getUserEvents() {
      migrateLegacyUserEvent();
      try {
        const raw = localStorage.getItem(USER_EVENTS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) return [];
        return list
          .filter((e) => e && (e.name || "").trim() && (e.date || "").trim())
          .map((e) => ({
            id: String(e.id || e.date + "-" + e.name),
            name: String(e.name || "").trim(),
            date: String(e.date || "").trim(),
            dateEnd: String(e.dateEnd || e.date || "").trim() || String(e.date || "").trim(),
            time: String(e.time || "").trim(),
          }))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      } catch (_e) {
        return [];
      }
    }

    function saveUserEvents(events) {
      try {
        localStorage.setItem(USER_EVENTS_KEY, JSON.stringify(events));
      } catch (_e) { /* ignore */ }
    }

    function addUserEvent(name, date, dateEnd, time) {
      const events = getUserEvents();
      const end = (dateEnd || date || "").trim() || date;
      events.push({
        id: "ev-" + Date.now(),
        name,
        date,
        dateEnd: end,
        time: (time || "").trim(),
      });
      saveUserEvents(events);
      renderHomeEvents();
      updateLiturgicalCountdowns();
    }

    function renderHomeEvents() {
      const boardEl = $("home-events-board");
      const emptyEl = $("home-events-empty");
      if (!boardEl) return;
      const events = eventsForDisplay(getActiveUserEvents());
      const ongoing = events.filter(isEventOngoing);
      const upcoming = events.filter(isEventUpcoming);
      const combined = ongoing.map((ev) => ({ ev, kind: "ongoing" }))
        .concat(upcoming.map((ev) => ({ ev, kind: "upcoming" })))
        .slice(0, 3);
      if (!combined.length) {
        boardEl.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      boardEl.innerHTML =
        "<ul class=\"home-events-list\">" +
        combined.map(({ ev, kind }) => renderHomeEventItemMarkup(ev, kind)).join("") +
        "</ul>";
      if (emptyEl) emptyEl.hidden = true;
    }

    function renderLiturgicalPanelEvents() {
      const ongoingList = $("liturgical-panel-events-ongoing");
      const upcomingList = $("liturgical-panel-events-upcoming");
      const ongoingSection = $("liturgical-panel-events-ongoing-section") ||
        document.querySelector(".liturgical-panel-events-section--ongoing");
      const upcomingSection = $("liturgical-panel-events-upcoming-section") ||
        document.querySelector(".liturgical-panel-events-section--upcoming");
      const eventsWrap = $("liturgical-countdown-item-events") ||
        document.querySelector(".liturgical-countdown-item--events");
      if (!ongoingList || !upcomingList) return;
      const events = eventsForDisplay(getActiveUserEvents());
      const ongoing = events.filter(isEventOngoing);
      const upcoming = events.filter(isEventUpcoming);
      ongoingList.innerHTML = ongoing.map((ev) => renderLiturgicalEventItemMarkup(ev, "ongoing")).join("");
      upcomingList.innerHTML = upcoming.map((ev) => renderLiturgicalEventItemMarkup(ev, "upcoming")).join("");
      const hasOngoing = ongoing.length > 0;
      const hasUpcoming = upcoming.length > 0;
      if (ongoingSection) ongoingSection.hidden = !hasOngoing;
      if (upcomingSection) upcomingSection.hidden = !hasUpcoming;
      if (eventsWrap) eventsWrap.hidden = !hasOngoing && !hasUpcoming;
    }

    function updateHomeReadingCard(refId, excerptId, ref, body) {
      const refEl = $(refId);
      const excerptEl = $(excerptId);
      const text = (body || "").trim();
      const hasContent = !!(text || (ref || "").trim());
      const tile = excerptEl && excerptEl.closest(".flow-reading-tile");
      if (refEl) refEl.textContent = (ref || "").trim() || "—";
      if (excerptEl) {
        excerptEl.textContent = text || "Not available for this Sunday.";
      }
      if (tile) tile.classList.toggle("is-empty", !hasContent);
    }

    var eventDateRangeState = { month: new Date(), start: null, end: null };

    function updateEventDateTriggerLabel() {
      const label = $("home-event-date-trigger-label");
      const startIn = $("home-event-date-start");
      const endIn = $("home-event-date-end");
      const start = eventDateRangeState.start || (startIn && startIn.value) || "";
      const end = eventDateRangeState.end || (endIn && endIn.value) || "";
      if (startIn) startIn.value = start || "";
      if (endIn) endIn.value = end || "";
      if (!label) return;
      let text = "";
      if (start && end) text = formatEventRangeLabel(start, end);
      else if (start) text = formatNiceDate(start) + " – …";
      label.textContent = text || "Select dates";
      label.classList.toggle("event-date-trigger__placeholder", !text);
    }

    function setEventDatePopoverOpen(open) {
      const pop = $("home-event-date-popover");
      const trigger = $("home-event-date-trigger");
      const range = pop && pop.closest(".event-date-range");
      const card = $("home-event-modal") && $("home-event-modal").querySelector(".ui-card");
      if (!pop || !trigger) return;
      pop.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (range) range.classList.toggle("event-date-range--open", !!open);
      if (card) card.classList.toggle("ui-card--calendar-open", !!open);
      if (open) renderEventDateCalendar();
    }

    function closeEventDatePopover() {
      setEventDatePopoverOpen(false);
    }

    function resetEventDateRangePicker() {
      eventDateRangeState = { month: new Date(), start: null, end: null };
      closeEventDatePopover();
      updateEventDateTriggerLabel();
      renderEventDateCalendar();
    }

    function renderEventDateCalendar() {
      const cal = $("home-event-date-cal");
      if (!cal) return;
      const view = new Date(eventDateRangeState.month.getFullYear(), eventDateRangeState.month.getMonth(), 1);
      const year = view.getFullYear();
      const month = view.getMonth();
      const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const start = eventDateRangeState.start;
      const end = eventDateRangeState.end || eventDateRangeState.start;
      const firstDow = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dows = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      let html = "<div class=\"event-date-cal__nav\">" +
        "<button type=\"button\" class=\"ghost mini\" data-cal-nav=\"-1\" aria-label=\"Previous month\">‹</button>" +
        "<span class=\"event-date-cal__month\">" + escapeHtml(monthLabel) + "</span>" +
        "<button type=\"button\" class=\"ghost mini\" data-cal-nav=\"1\" aria-label=\"Next month\">›</button>" +
        "</div><div class=\"event-date-cal__grid\">";
      dows.forEach((d) => { html += "<span class=\"event-date-cal__dow\">" + d + "</span>"; });
      for (let i = 0; i < firstDow; i++) html += "<span></span>";
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = formatDateInput(new Date(year, month, day));
        let cls = "event-date-cal__day";
        if (start && end && iso >= start && iso <= end) cls += " is-range";
        if (start && iso === start) cls += " is-start";
        if (end && iso === end) cls += " is-end";
        html += "<button type=\"button\" class=\"" + cls + "\" data-cal-day=\"" + iso + "\">" + day + "</button>";
      }
      html += "</div>";
      cal.innerHTML = html;
    }

    function onEventCalendarDayClick(iso) {
      if (!eventDateRangeState.start || (eventDateRangeState.start && eventDateRangeState.end)) {
        eventDateRangeState.start = iso;
        eventDateRangeState.end = null;
      } else {
        eventDateRangeState.end = iso;
        if (eventDateRangeState.end < eventDateRangeState.start) {
          const tmp = eventDateRangeState.start;
          eventDateRangeState.start = eventDateRangeState.end;
          eventDateRangeState.end = tmp;
        }
        updateEventDateTriggerLabel();
        renderEventDateCalendar();
        closeEventDatePopover();
        return;
      }
      updateEventDateTriggerLabel();
      renderEventDateCalendar();
    }

    function initMassDatePickers() {
      document.querySelectorAll(".mass-date-picker").forEach((picker) => {
        if (picker.dataset.massDateInit === "1") return;
        picker.dataset.massDateInit = "1";
        const input = picker.querySelector('input[type="date"]');
        const trigger = picker.querySelector(".mass-date-picker__trigger");
        const display = picker.querySelector(".mass-date-picker__value");
        const popover = picker.querySelector(".mass-date-picker__popover");
        const cal = picker.querySelector(".event-date-cal");
        if (!input || !trigger || !display || !popover || !cal) return;

        const state = { month: new Date() };

        function syncDisplay() {
          const iso = (input.value || "").trim();
          if (iso) {
            display.textContent = formatNiceDate(iso);
            display.classList.remove("is-placeholder");
          } else {
            display.textContent = "Select date";
            display.classList.add("is-placeholder");
          }
        }

        function setOpen(open) {
          popover.hidden = !open;
          trigger.setAttribute("aria-expanded", open ? "true" : "false");
          if (open) {
            const iso = (input.value || "").trim();
            if (iso) {
              const d = parseLocalDateISO(iso);
              if (d) state.month = new Date(d.getFullYear(), d.getMonth(), 1);
            }
            renderCalendar();
          }
        }

        function closePopover() { setOpen(false); }

        function renderCalendar() {
          const year = state.month.getFullYear();
          const month = state.month.getMonth();
          const monthLabel = state.month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
          const selected = (input.value || "").trim();
          const today = formatDateInput(new Date());
          const firstDow = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const dows = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
          let html = "<div class=\"event-date-cal__nav\">" +
            "<button type=\"button\" class=\"ghost mini\" data-cal-nav=\"-1\" aria-label=\"Previous month\">‹</button>" +
            "<span class=\"event-date-cal__month\">" + escapeHtml(monthLabel) + "</span>" +
            "<button type=\"button\" class=\"ghost mini\" data-cal-nav=\"1\" aria-label=\"Next month\">›</button>" +
            "</div><div class=\"event-date-cal__grid\">";
          dows.forEach((d) => { html += "<span class=\"event-date-cal__dow\">" + d + "</span>"; });
          for (let i = 0; i < firstDow; i++) html += "<span></span>";
          for (let day = 1; day <= daysInMonth; day++) {
            const iso = formatDateInput(new Date(year, month, day));
            let cls = "event-date-cal__day";
            if (iso === selected) cls += " is-selected";
            if (iso === today) cls += " is-today";
            if (new Date(year, month, day).getDay() === 0) cls += " is-sunday";
            html += "<button type=\"button\" class=\"" + cls + "\" data-cal-day=\"" + iso + "\">" + day + "</button>";
          }
          html += "</div>";
          cal.innerHTML = html;
        }

        function pickDay(iso) {
          input.value = iso;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          syncDisplay();
          renderCalendar();
          closePopover();
        }

        picker._syncMassDateDisplay = syncDisplay;
        syncDisplay();

        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          setOpen(popover.hidden);
        });

        cal.addEventListener("click", (e) => {
          e.stopPropagation();
          const nav = e.target.closest("[data-cal-nav]");
          if (nav) {
            const dir = parseInt(nav.getAttribute("data-cal-nav"), 10) || 0;
            state.month = new Date(state.month.getFullYear(), state.month.getMonth() + dir, 1);
            renderCalendar();
            return;
          }
          const dayBtn = e.target.closest("[data-cal-day]");
          if (!dayBtn) return;
          pickDay(dayBtn.getAttribute("data-cal-day"));
        });

        trigger.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        });

        input.addEventListener("change", syncDisplay);
        input.addEventListener("input", syncDisplay);
      });

      document.addEventListener("click", (e) => {
        document.querySelectorAll(".mass-date-picker").forEach((picker) => {
          const popover = picker.querySelector(".mass-date-picker__popover");
          if (!popover || popover.hidden) return;
          if (e.target.closest(".mass-date-picker") === picker) return;
          const trigger = picker.querySelector(".mass-date-picker__trigger");
          popover.hidden = true;
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
      });
    }

    function syncMassDatePickerByInputId(inputId) {
      const input = $(inputId);
      if (!input) return;
      const picker = input.closest(".mass-date-picker");
      if (picker && typeof picker._syncMassDateDisplay === "function") picker._syncMassDateDisplay();
    }

    function initEventDateRangePicker() {
      const trigger = $("home-event-date-trigger");
      const pop = $("home-event-date-popover");
      const cal = $("home-event-date-cal");
      if (!trigger || !pop || !cal) return;

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        setEventDatePopoverOpen(pop.hidden);
      });

      cal.addEventListener("click", (e) => {
        e.stopPropagation();
        const nav = e.target.closest("[data-cal-nav]");
        if (nav) {
          const dir = parseInt(nav.getAttribute("data-cal-nav"), 10) || 0;
          const m = eventDateRangeState.month;
          eventDateRangeState.month = new Date(m.getFullYear(), m.getMonth() + dir, 1);
          renderEventDateCalendar();
          return;
        }
        const dayBtn = e.target.closest("[data-cal-day]");
        if (!dayBtn) return;
        onEventCalendarDayClick(dayBtn.getAttribute("data-cal-day"));
      });

      document.addEventListener("click", (e) => {
        if (pop.hidden) return;
        if (e.target.closest(".event-date-range")) return;
        closeEventDatePopover();
      });
    }

    function openReadingExpandModal(title, ref, body) {
      const modal = $("reading-expand-modal");
      const titleEl = $("reading-expand-title");
      const refEl = $("reading-expand-ref");
      const bodyEl = $("reading-expand-body");
      if (!modal || !bodyEl) return;
      if (titleEl) titleEl.textContent = title || "Reading";
      if (refEl) refEl.textContent = (ref || "").trim() || "—";
      bodyEl.textContent = (body || "").trim() || "Not available.";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeReadingExpandModal() {
      const modal = $("reading-expand-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (!$("home-event-modal") || !$("home-event-modal").classList.contains("is-open")) {
        if (!$("home-news-expand-modal") || !$("home-news-expand-modal").classList.contains("is-open")) {
        document.body.style.overflow = "";
        }
      }
    }

    function readingExpandFromCard(card) {
      if (!card) return;
      const title = card.getAttribute("data-reading-title") ||
        (card.querySelector("header strong") && card.querySelector("header strong").textContent) || "Reading";
      const refEl = card.querySelector(".home-reading-ref, .flow-reading-ref");
      const bodyEl = card.querySelector(".flow-reading-text");
      const ref = refEl ? refEl.textContent : "";
      const body = bodyEl ? bodyEl.textContent : "";
      openReadingExpandModal(title, ref, body);
    }

    function initReadingExpandModal() {
      const modal = $("reading-expand-modal");
      const backdrop = $("reading-expand-backdrop");
      const closeBtn = $("reading-expand-close");
      if (!modal) return;

      document.querySelectorAll(".reading-preview-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest("button, a, input, select, textarea, label")) return;
          readingExpandFromCard(card);
        });
        card.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          readingExpandFromCard(card);
        });
      });

      const gospelCard = $("home-gospel-card");
      if (gospelCard) {
        const openGospel = () => {
          const ref = $("home-gospel-ref") && $("home-gospel-ref").textContent;
          const body = $("home-gospel-quote") && $("home-gospel-quote").textContent;
          openReadingExpandModal("Gospel", ref, body);
        };
        gospelCard.addEventListener("click", (e) => {
          if (e.target.closest(".home-card-head__action")) return;
          openGospel();
        });
        gospelCard.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          openGospel();
        });
      }

      const todayGospelCard = $("home-reflection-card");
      if (todayGospelCard) {
        const openTodayGospel = () => {
          const ref = $("home-reflection-ref") && $("home-reflection-ref").textContent;
          const body = $("home-reflection-verse") && $("home-reflection-verse").textContent;
          openReadingExpandModal("Today's Gospel", ref, body);
        };
        todayGospelCard.addEventListener("click", (e) => {
          if (e.target.closest("a")) return;
          openTodayGospel();
        });
        todayGospelCard.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          openTodayGospel();
        });
      }

      if (closeBtn) closeBtn.addEventListener("click", closeReadingExpandModal);
      if (backdrop) backdrop.addEventListener("click", closeReadingExpandModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closeReadingExpandModal();
      });
    }

    function resetHomeEventModalForm() {
      const nameIn = $("home-event-modal-name");
      const timeIn = $("home-event-modal-time");
      if (nameIn) nameIn.value = "";
      if (timeIn) timeIn.value = "";
      resetEventDateRangePicker();
    }

    function openHomeEventModal() {
      const modal = $("home-event-modal");
      if (!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const nameIn = $("home-event-modal-name");
      if (nameIn) nameIn.focus();
    }

    function closeHomeEventModal() {
      const modal = $("home-event-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      const readingOpen = $("reading-expand-modal") && $("reading-expand-modal").classList.contains("is-open");
      if (!readingOpen) document.body.style.overflow = "";
      resetHomeEventModalForm();
    }

    function initHomeEventModal() {
      const modal = $("home-event-modal");
      const openBtn = $("btn-home-create-event");
      const openBtnEmpty = $("btn-home-create-event-empty");
      const cancelBtn = $("home-event-modal-cancel");
      const closeBtn = $("home-event-modal-close");
      const saveBtn = $("home-event-modal-save");
      const backdrop = $("home-event-modal-backdrop");
      if (!modal) return;

      initEventDateRangePicker();

      if (openBtn) openBtn.addEventListener("click", openHomeEventModal);
      if (openBtnEmpty) openBtnEmpty.addEventListener("click", openHomeEventModal);
      if (cancelBtn) cancelBtn.addEventListener("click", closeHomeEventModal);
      if (closeBtn) closeBtn.addEventListener("click", closeHomeEventModal);
      if (backdrop) backdrop.addEventListener("click", closeHomeEventModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closeHomeEventModal();
      });
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          const name = ($("home-event-modal-name") && $("home-event-modal-name").value.trim()) || "";
          const date = ($("home-event-date-start") && $("home-event-date-start").value.trim()) ||
            eventDateRangeState.start || "";
          const dateEnd = ($("home-event-date-end") && $("home-event-date-end").value.trim()) ||
            eventDateRangeState.end || "";
          const time = ($("home-event-modal-time") && $("home-event-modal-time").value.trim()) || "";
          if (!name) {
            notify("Enter an event name.", "error");
            return;
          }
          if (!date) {
            notify("Choose event dates.", "error");
            return;
          }
          if (!dateEnd) {
            notify("Select an end date.", "error");
            return;
          }
          addUserEvent(name, date, dateEnd, time);
          closeHomeEventModal();
          notify("Event saved.", "ok");
        });
      }
      renderHomeEvents();
    }

    function dateOnlyLocal(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function sameLocalDate(a, b) {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function easterSundayForYear(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const ell = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * ell) / 451);
      const month = Math.floor((h + ell - 7 * m + 114) / 31);
      const day = ((h + ell - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }

    function firstSundayOfAdventForYear(year) {
      const candidates = [
        [10, 27], [10, 28], [10, 29], [10, 30],
        [11, 1], [11, 2], [11, 3],
      ];
      for (let idx = 0; idx < candidates.length; idx++) {
        const d = new Date(year, candidates[idx][0], candidates[idx][1]);
        if (d.getDay() === 0) return d;
      }
      return new Date(year, 10, 27);
    }

    function epiphanySundayForYear(year) {
      for (let dom = 2; dom <= 8; dom++) {
        const d = new Date(year, 0, dom);
        if (d.getDay() === 0) return d;
      }
      return new Date(year, 0, 6);
    }

    function baptismOfTheLordForYear(year) {
      const ep = epiphanySundayForYear(year);
      const d = new Date(ep);
      d.setDate(d.getDate() + (ep.getDate() >= 7 ? 1 : 7));
      return d;
    }

    function ashWednesdayForYear(year) {
      const d = new Date(easterSundayForYear(year));
      d.setDate(d.getDate() - 46);
      return d;
    }

    function pentecostSundayForYear(year) {
      const d = new Date(easterSundayForYear(year));
      d.setDate(d.getDate() + 49);
      return d;
    }

    function inChristmasSeasonLocal(d) {
      if (d.getMonth() === 11 && d.getDate() >= 25) return true;
      if (d.getMonth() === 0) return d <= baptismOfTheLordForYear(d.getFullYear());
      return false;
    }

    function liturgicalPresetForDateLocal(d) {
      const y = d.getFullYear();
      const pentecost = pentecostSundayForYear(y);
      const easter = easterSundayForYear(y);
      const ash = ashWednesdayForYear(y);
      const holySaturday = new Date(easter);
      holySaturday.setDate(holySaturday.getDate() - 1);
      if (sameLocalDate(d, pentecost)) return "easter";
      if (d >= easter && d < pentecost) return "easter";
      if (d >= ash && d <= holySaturday) return "lent";
      if (inChristmasSeasonLocal(d)) return "christmas";
      const adventStart = firstSundayOfAdventForYear(y);
      if (d >= adventStart && d <= new Date(y, 11, 24)) return "advent";
      return "ordinary";
    }

    var NEXT_SEASON_LABELS = {
      advent: "Advent",
      christmas: "Christmas",
      lent: "Lent",
      easter: "Easter",
      ordinary: "Ordinary Time",
    };

    function getNextSeasonTransition(fromDate) {
      const start = dateOnlyLocal(fromDate || new Date());
      const currentPreset = liturgicalPresetForDateLocal(start);
      let probe = new Date(start);
      probe.setDate(probe.getDate() + 1);
      for (let i = 0; i < 370; i++) {
        const nextPreset = liturgicalPresetForDateLocal(probe);
        if (nextPreset !== currentPreset) {
          return {
            nextStart: dateOnlyLocal(probe),
            nextPreset: nextPreset,
            nextName: NEXT_SEASON_LABELS[nextPreset] || formatLiturgicalSeasonLabel(nextPreset),
            currentPreset: currentPreset,
          };
        }
        probe.setDate(probe.getDate() + 1);
      }
      return null;
    }

    function countSundaysUntilLocal(targetDate) {
      const target = dateOnlyLocal(targetDate);
      let d = dateOnlyLocal(new Date());
      if (d.getDay() !== 0) {
        d.setDate(d.getDate() + (7 - d.getDay()));
      }
      let count = 0;
      while (d < target) {
        count++;
        d.setDate(d.getDate() + 7);
      }
      return count;
    }

    function formatNextSeasonSundayCount(count) {
      if (count === 0) return "This Sunday";
      return count + " Sunday" + (count === 1 ? "" : "s");
    }

    function getNextSundayCountdownTarget() {
      const today = new Date();
      const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let sun = parseLocalDateISO(upcomingSundayISO());
      if (!sun) return { target: null, iso: "" };
      let iso = upcomingSundayISO();
      if (sun.getTime() <= t0.getTime()) {
        sun = new Date(sun);
        sun.setDate(sun.getDate() + 7);
        iso = formatDateInput(sun);
      }
      return { target: sun, iso: iso };
    }

    function updateLiturgicalCountdowns() {
      const sun = getNextSundayCountdownTarget();
      const sunEl = $("liturgical-countdown-sunday");
      const sunDateEl = $("liturgical-countdown-sunday-date");
      if (sunEl) sunEl.textContent = formatCountdown(sun.target);
      if (sunDateEl) sunDateEl.textContent = formatNiceDate(sun.iso);

      const nextSeason = getNextSeasonTransition(new Date());
      const nextSeasonLabelEl = $("liturgical-countdown-next-season-label");
      const nextSeasonSundaysEl = $("liturgical-countdown-next-season-sundays");
      const nextSeasonSubEl = $("liturgical-countdown-next-season-sub");
      if (nextSeason && nextSeasonSundaysEl) {
        const sundayCount = countSundaysUntilLocal(nextSeason.nextStart);
        nextSeasonSundaysEl.textContent = formatNextSeasonSundayCount(sundayCount);
        if (nextSeasonLabelEl) nextSeasonLabelEl.textContent = "Until " + nextSeason.nextName;
        if (nextSeasonSubEl) nextSeasonSubEl.textContent = "Begins " + formatNiceDate(formatDateInput(nextSeason.nextStart));
      } else {
        if (nextSeasonSundaysEl) nextSeasonSundaysEl.textContent = "—";
        if (nextSeasonLabelEl) nextSeasonLabelEl.textContent = "Next season";
        if (nextSeasonSubEl) nextSeasonSubEl.textContent = "—";
      }

      const wydEl = $("liturgical-countdown-wyd");
      const wydTarget = parseLocalDateISO(WYD_2027_START_ISO);
      if (wydEl) wydEl.textContent = formatCountdown(wydTarget);

      updateLiturgicalSundayCelebrations();
      renderLiturgicalPanelEvents();
      renderHomeEvents();
    }

    function startLiturgicalCountdownTimer() {
      updateLiturgicalCountdowns();
      if (liturgicalCountdownTimer) clearInterval(liturgicalCountdownTimer);
      liturgicalCountdownTimer = setInterval(updateLiturgicalCountdowns, 60000);
    }

    function updateHomeMassWelcome() {
      const textEl = $("home-mass-welcome-text");
      const subEl = $("home-mass-sub");
      if (!textEl) return;
      const auth = window.VerbumAuth;
      const user = auth && auth.getUser ? auth.getUser() : null;
      const label =
        auth && auth.getHomeWelcomeLabel
          ? auth.getHomeWelcomeLabel(user)
          : "Welcome!";
      textEl.textContent = label;
      if (subEl && auth && auth.getHomeWelcomeSubtext) {
        subEl.textContent = auth.getHomeWelcomeSubtext(user);
      }
    }

    function updateAccountMenuDisplay() {
      if (window.VerbumAuth && typeof window.VerbumAuth.updateAccountMenuDisplay === "function") {
        window.VerbumAuth.updateAccountMenuDisplay();
      } else {
        const signInLink = $("account-sign-in-link");
        const signUpLink = $("account-sign-up-link");
        const signOutBtn = $("account-sign-out-btn");
        if (signInLink) signInLink.hidden = true;
        if (signUpLink) signUpLink.hidden = true;
        if (signOutBtn) signOutBtn.hidden = true;
      }
      updateHomeMassWelcome();
    }

    function closeHeaderMenus(exceptPanelId) {
      if (exceptPanelId !== "global-search-panel" && typeof closeGlobalSearch === "function") {
        closeGlobalSearch();
      }
      if (typeof closeAllVerbumSelects === "function") closeAllVerbumSelects();
      if (typeof closeAllPosterPickers === "function") closeAllPosterPickers();
      if (typeof closeCelebrantPicker === "function") closeCelebrantPicker();
      if (typeof closeMassSongResultPanels === "function") closeMassSongResultPanels(null);
      [
        ["liturgical-indicator-panel", "liturgical-indicator-btn"],
        ["live-radio-panel", "live-radio-menu-btn"],
        ["account-menu-panel", "account-menu-btn"],
        ["create-menu-panel", "create-menu-btn"],
        ["notif-panel", "notif-toggle-btn"],
      ].forEach(([panelId, btnId]) => {
        if (exceptPanelId && panelId === exceptPanelId) return;
        setVbDropdownOpen($(panelId), $(btnId), false);
      });
      syncHeaderSheetBackdrop({ allowPointer: true });
    }

    function initDashboardDropdownDismiss() {
      if (window.__verbumDropdownDismissBound) return;
      window.__verbumDropdownDismissBound = true;
      const dropdownRoots =
        ".account-menu-wrap, .create-menu-wrap, .liturgical-indicator-wrap, .live-radio-wrap, " +
        ".notif-wrap, .app-header__search-wrap, .vb-select, .celebrant-picker, " +
        ".poster-picker, .mass-song-plan-row__search, " +
        "#notif-panel, #account-menu-panel, #liturgical-indicator-panel, #live-radio-panel";
      document.addEventListener("click", (e) => {
        if (window.__verbumHeaderDismissGuard) return;
        if (isMobileHeaderSheet() && hasOpenHeaderSheet()) return;
        if (isInsideHeaderDropdownUI(e.target)) return;
        if (e.target.closest(dropdownRoots)) return;
        closeHeaderMenus();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeHeaderMenus();
      });
      const backdrop = $("header-sheet-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.__verbumHeaderDismissGuard) return;
          closeHeaderMenus();
        });
        backdrop.addEventListener("touchend", (e) => {
          e.stopPropagation();
          if (window.__verbumHeaderDismissGuard) return;
          closeHeaderMenus();
        });
      }
    }

    function initAccountMenu() {
      const btn = $("account-menu-btn");
      const panel = $("account-menu-panel");
      if (!btn || !panel) return;
      bindMobileHeaderSheetTrigger(btn, () => {
        toggleHeaderSheetPanel(panel, btn, "account-menu-panel");
      });
      panel.querySelectorAll(".nav-link[data-route]").forEach((link) => {
        link.addEventListener("click", () => closeHeaderMenus());
      });
      const signInLink = $("account-sign-in-link");
      const signUpLink = $("account-sign-up-link");
      if (signInLink) signInLink.addEventListener("click", () => closeHeaderMenus());
      if (signUpLink) signUpLink.addEventListener("click", () => closeHeaderMenus());
      const signOutBtn = $("account-sign-out-btn");
      if (signOutBtn) signOutBtn.addEventListener("click", () => closeHeaderMenus());
    }

    var MOBILE_WELCOME_PENDING_KEY = "verbum:mobile-welcome-pending";
    var mobileWelcomeShownThisLoad = false;

