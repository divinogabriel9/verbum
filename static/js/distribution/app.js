/**
 * LiturgyFlow Distribution — church acquisition CRM SPA
 * Hash routes on /admin/distribution
 */
(function () {
  "use strict";

  var PIPELINE_STAGES = [
    "discovered",
    "contacted",
    "interested",
    "demo",
    "trial",
    "activated",
    "paid",
  ];
  var PIPELINE_LABELS = {
    discovered: "Discovered",
    contacted: "Contacted",
    interested: "Interested",
    demo: "Demo",
    trial: "Trial",
    activated: "Activated",
    paid: "Paid",
    referral: "Referral",
  };
  var PRIORITIES = ["low", "medium", "high"];
  var INTERACTION_TYPES = [
    "email",
    "phone",
    "kakaotalk",
    "facebook",
    "in_person",
    "demo",
    "other",
  ];
  var CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"];

  var CSV_HEADER_MAP = {
    parish: "parish_name",
    parish_name: "parish_name",
    "parish name": "parish_name",
    name: "parish_name",
    church: "parish_name",
    church_name: "parish_name",
    diocese: "diocese",
    country: "country",
    city: "city",
    state: "state_province",
    state_province: "state_province",
    province: "state_province",
    address: "address",
    website: "website",
    email: "email",
    phone: "phone",
    contact: "contact_person",
    contact_person: "contact_person",
    "contact person": "contact_person",
    contact_role: "contact_role",
    language: "language",
    mass_language: "mass_language",
    notes: "notes",
    priority: "priority",
    pipeline_status: "pipeline_status",
    status: "pipeline_status",
  };

  var els = {};
  var state = {
    route: { name: "dashboard", params: {} },
    churchesCache: [],
    importPreview: null,
    importRows: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message, type) {
    var host = els.toastHost;
    if (!host) return;
    var el = document.createElement("div");
    el.className = "dx-toast" + (type === "error" ? " dx-toast--error" : type === "ok" ? " dx-toast--ok" : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 3400);
  }

  async function api(path, options) {
    var headers = Object.assign(
      { "Content-Type": "application/json" },
      await window.VerbumAuth.getAuthHeaders(),
      (options && options.headers) || {}
    );
    var res = await fetch(
      "/api/admin/distribution" + path,
      Object.assign({}, options || {}, { headers: headers })
    );
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : data.error || "Request failed"
      );
    }
    return data;
  }

  function statusChip(status) {
    var s = String(status || "discovered");
    return (
      '<span class="dx-chip dx-chip--' +
      escapeHtml(s) +
      '">' +
      escapeHtml(PIPELINE_LABELS[s] || s) +
      "</span>"
    );
  }

  function priorityBadge(priority) {
    var p = String(priority || "medium").toLowerCase();
    return (
      '<span class="dx-chip dx-prio--' +
      escapeHtml(p) +
      '">' +
      escapeHtml(p) +
      "</span>"
    );
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtShort(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function place(city, country) {
    return [city, country].filter(Boolean).join(", ") || "—";
  }

  function optionList(values, selected, blankLabel) {
    var html = blankLabel
      ? '<option value="">' + escapeHtml(blankLabel) + "</option>"
      : "";
    values.forEach(function (v) {
      var val = typeof v === "object" ? v.value : v;
      var label = typeof v === "object" ? v.label : PIPELINE_LABELS[v] || v;
      html +=
        '<option value="' +
        escapeHtml(val) +
        '"' +
        (String(selected || "") === String(val) ? " selected" : "") +
        ">" +
        escapeHtml(label) +
        "</option>";
    });
    return html;
  }

  function setPageMeta(title, sub, actionsHtml) {
    if (els.pageTitle) els.pageTitle.textContent = title;
    if (els.pageSub) els.pageSub.textContent = sub || "";
    if (els.pageActions) els.pageActions.innerHTML = actionsHtml || "";
  }

  function setNavActive(routeName) {
    if (!els.nav) return;
    var key = routeName === "church" ? "churches" : routeName === "campaign" ? "campaigns" : routeName === "opportunity" ? "analytics" : routeName;
    els.nav.querySelectorAll("a[data-route]").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-route") === key);
    });
  }

  function closeSidebar() {
    if (els.app) els.app.classList.remove("dx-sidebar-open");
    if (els.backdrop) els.backdrop.hidden = true;
  }

  function openSidebar() {
    if (els.app) els.app.classList.add("dx-sidebar-open");
    if (els.backdrop) els.backdrop.hidden = false;
  }

  function navigate(hash) {
    if (hash.charAt(0) !== "#") hash = "#/" + hash.replace(/^\/+/, "");
    if (location.hash === hash) {
      route();
    } else {
      location.hash = hash;
    }
    closeSidebar();
  }

  function parseRoute() {
    var raw = (location.hash || "").replace(/^#\/?/, "").trim();
    if (!raw) {
      var path = location.pathname || "";
      var m = path.match(/^\/admin\/distribution\/?(.*)$/);
      if (m && m[1]) {
        raw = m[1].replace(/\/+$/, "");
        history.replaceState(null, "", "/admin/distribution#/" + raw);
      }
    }
    if (!raw) return { name: "dashboard", params: {} };
    var parts = raw.split("/").filter(Boolean);
    var head = parts[0] || "dashboard";
    if (head === "churches" && parts[1]) return { name: "church", params: { id: parts[1] } };
    if (head === "campaigns" && parts[1]) return { name: "campaign", params: { id: parts[1] } };
    if (
      [
        "dashboard",
        "churches",
        "pipeline",
        "campaigns",
        "follow-ups",
        "invitations",
        "referrals",
        "analytics",
        "settings",
        "opportunity",
      ].indexOf(head) >= 0
    ) {
      return { name: head, params: {} };
    }
    return { name: "dashboard", params: {} };
  }

  function closeModal() {
    if (!els.modalHost) return;
    els.modalHost.hidden = true;
    els.modalHost.innerHTML = "";
  }

  function openModal(title, bodyHtml, footHtml, wide) {
    if (!els.modalHost) return;
    els.modalHost.hidden = false;
    els.modalHost.innerHTML =
      '<div class="dx-modal' +
      (wide ? " dx-modal--wide" : "") +
      '" role="dialog" aria-modal="true">' +
      '<div class="dx-modal__head"><h2>' +
      escapeHtml(title) +
      '</h2><button type="button" class="dx-btn dx-btn--ghost dx-btn--sm" data-dx-close>Close</button></div>' +
      '<div class="dx-modal__body">' +
      bodyHtml +
      "</div>" +
      (footHtml ? '<div class="dx-modal__foot">' + footHtml + "</div>" : "") +
      "</div>";
    els.modalHost.querySelectorAll("[data-dx-close]").forEach(function (btn) {
      btn.addEventListener("click", closeModal);
    });
    els.modalHost.addEventListener("click", function onBg(e) {
      if (e.target === els.modalHost) {
        closeModal();
        els.modalHost.removeEventListener("click", onBg);
      }
    });
  }

  function skeleton(n) {
    var html = '<div class="dx-grid dx-grid--' + (n > 3 ? "4" : "3") + '">';
    for (var i = 0; i < (n || 4); i++) html += '<div class="dx-skeleton"></div>';
    return html + "</div>";
  }

  function emptyState(msg, ctaLabel, ctaHash) {
    return (
      '<div class="dx-empty"><p>' +
      escapeHtml(msg) +
      "</p>" +
      (ctaLabel
        ? '<button type="button" class="dx-btn dx-btn--primary" data-nav="' +
          escapeHtml(ctaHash) +
          '">' +
          escapeHtml(ctaLabel) +
          "</button>"
        : "") +
      "</div>"
    );
  }

  /* ---------- Pages ---------- */

  async function renderDashboard() {
    setPageMeta("Dashboard", "Acquisition overview", "");
    els.main.innerHTML = skeleton(4);
    try {
      var data = await api("/dashboard");
      var totals = data.totals || {};
      var by = totals.by_pipeline_status || {};
      var weekly = data.weekly || {};
      var rates = data.conversion_rates || {};
      var fu = data.follow_ups || {};
      var attention = (data.needing_attention && data.needing_attention.items) || [];

      var stageCards = PIPELINE_STAGES.map(function (s) {
        return (
          '<div class="dx-card dx-card--clickable" data-nav="#/pipeline">' +
          '<p class="dx-stat__label">' +
          escapeHtml(PIPELINE_LABELS[s]) +
          "</p>" +
          '<p class="dx-stat__value">' +
          escapeHtml(by[s] || 0) +
          "</p></div>"
        );
      }).join("");

      var rateKeys = Object.keys(rates);
      var ratesHtml = rateKeys.length
        ? rateKeys
            .slice(0, 6)
            .map(function (k) {
              return (
                "<li><strong>" +
                escapeHtml(k.replace(/_/g, " ")) +
                ":</strong> " +
                escapeHtml(rates[k]) +
                "%</li>"
              );
            })
            .join("")
        : "<li class=\"dx-muted\">No conversion sample yet.</li>";

      var attentionHtml = attention.length
        ? attention
            .map(function (item) {
              var church = item.church || item;
              var id = church.id || item.id;
              var reasons = (item.reasons || []).join(", ");
              return (
                '<div class="dx-list-item" data-nav="#/churches/' +
                escapeHtml(id) +
                '"><div><p class="dx-list-item__title">' +
                escapeHtml(church.parish_name || "Church") +
                '</p><p class="dx-list-item__meta">' +
                escapeHtml(place(church.city, church.country)) +
                (reasons ? " · " + escapeHtml(reasons) : "") +
                "</p></div>" +
                statusChip(church.pipeline_status) +
                "</div>"
              );
            })
            .join("")
        : '<p class="dx-muted">Nothing needs attention right now.</p>';

      els.main.innerHTML =
        '<div class="dx-grid dx-grid--4">' +
        '<div class="dx-card"><p class="dx-stat__label">Total churches</p><p class="dx-stat__value">' +
        escapeHtml(totals.churches || 0) +
        "</p></div>" +
        '<div class="dx-card"><p class="dx-stat__label">Follow-ups today</p><p class="dx-stat__value">' +
        escapeHtml(fu.today || 0) +
        '</p></div>' +
        '<div class="dx-card"><p class="dx-stat__label">Overdue</p><p class="dx-stat__value">' +
        escapeHtml(fu.overdue || 0) +
        '</p></div>' +
        '<div class="dx-card"><p class="dx-stat__label">Weekly new</p><p class="dx-stat__value">' +
        escapeHtml(weekly.new || 0) +
        "</p></div></div>" +
        '<div class="dx-section"><div class="dx-section__head"><h2 class="dx-section__title">Pipeline</h2></div>' +
        '<div class="dx-grid dx-grid--4">' +
        stageCards +
        "</div></div>" +
        '<div class="dx-grid dx-grid--2 dx-section">' +
        '<div class="dx-card"><h3 class="dx-section__title">This week</h3>' +
        '<dl class="dx-dl" style="margin-top:12px">' +
        "<dt>New</dt><dd>" +
        escapeHtml(weekly.new || 0) +
        "</dd>" +
        "<dt>Contacted</dt><dd>" +
        escapeHtml(weekly.contacted || 0) +
        "</dd>" +
        "<dt>Trials</dt><dd>" +
        escapeHtml(weekly.trials || 0) +
        "</dd>" +
        "<dt>Paid</dt><dd>" +
        escapeHtml(weekly.paid || 0) +
        "</dd></dl></div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Conversion sample</h3><ul style="margin:12px 0 0;padding-left:18px">' +
        ratesHtml +
        "</ul></div></div>" +
        '<div class="dx-section dx-card"><div class="dx-section__head"><h2 class="dx-section__title">Churches needing attention</h2>' +
        '<a class="dx-link" href="#/follow-ups">Follow-ups</a></div>' +
        attentionHtml +
        "</div>" +
        '<div class="dx-section"><div class="dx-section__head"><h2 class="dx-section__title">Quick links</h2></div>' +
        '<div class="dx-quick-links">' +
        '<a class="dx-btn" href="#/churches">Churches</a>' +
        '<a class="dx-btn" href="#/pipeline">Pipeline</a>' +
        '<a class="dx-btn" href="#/campaigns">Campaigns</a>' +
        '<a class="dx-btn" href="#/analytics">Analytics</a>' +
        '<a class="dx-btn" href="#/invitations">Invitations</a>' +
        "</div></div>";
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message || "Failed to load dashboard") + "</p></div>";
    }
  }

  function churchFiltersHtml(f) {
    f = f || {};
    return (
      '<div class="dx-filters" id="dx-church-filters">' +
      '<div class="dx-field dx-field--grow"><label>Search</label><input name="q" value="' +
      escapeHtml(f.q || "") +
      '" placeholder="Parish, contact, email…" /></div>' +
      '<div class="dx-field"><label>Country</label><input name="country" value="' +
      escapeHtml(f.country || "") +
      '" /></div>' +
      '<div class="dx-field"><label>City</label><input name="city" value="' +
      escapeHtml(f.city || "") +
      '" /></div>' +
      '<div class="dx-field"><label>Diocese</label><input name="diocese" value="' +
      escapeHtml(f.diocese || "") +
      '" /></div>' +
      '<div class="dx-field"><label>Language</label><input name="language" value="' +
      escapeHtml(f.language || "") +
      '" /></div>' +
      '<div class="dx-field"><label>Status</label><select name="pipeline_status">' +
      optionList(PIPELINE_STAGES.concat(["referral"]), f.pipeline_status, "Any") +
      '</select></div>' +
      '<div class="dx-field"><label>Priority</label><select name="priority">' +
      optionList(PRIORITIES, f.priority, "Any") +
      '</select></div>' +
      '<div class="dx-field"><label>Account</label><select name="has_account">' +
      '<option value="">Any</option>' +
      '<option value="true"' +
      (f.has_account === "true" ? " selected" : "") +
      ">Has parish</option>" +
      '<option value="false"' +
      (f.has_account === "false" ? " selected" : "") +
      ">No parish</option></select></div>" +
      '<button type="button" class="dx-btn dx-btn--primary" id="dx-filter-apply">Apply</button>' +
      "</div>"
    );
  }

  function readFilters() {
    var root = $("dx-church-filters");
    var out = {};
    if (!root) return out;
    root.querySelectorAll("input,select").forEach(function (el) {
      if (el.name && el.value) out[el.name] = el.value;
    });
    return out;
  }

  function churchesQuery(filters) {
    var params = new URLSearchParams();
    Object.keys(filters || {}).forEach(function (k) {
      if (filters[k] !== "" && filters[k] != null) params.set(k, filters[k]);
    });
    params.set("limit", "200");
    var qs = params.toString();
    return "/churches" + (qs ? "?" + qs : "");
  }

  async function renderChurches(filters) {
    filters = filters || {};
    setPageMeta(
      "Churches",
      "Prospect directory",
      '<button type="button" class="dx-btn" id="dx-import-csv">Import CSV</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-add-church">Add Church</button>'
    );
    els.main.innerHTML = churchFiltersHtml(filters) + '<div id="dx-churches-table">' + skeleton(3) + "</div>";
    bindChurchListChrome(filters);
    await loadChurchesTable(filters);
  }

  function bindChurchListChrome(filters) {
    var apply = $("dx-filter-apply");
    if (apply) {
      apply.onclick = function () {
        renderChurches(readFilters());
      };
    }
    var add = $("dx-add-church");
    if (add) add.onclick = openAddChurchModal;
    var imp = $("dx-import-csv");
    if (imp) {
      imp.onclick = function () {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,text/csv";
        input.onchange = function () {
          var file = input.files && input.files[0];
          if (file) handleCsvImport(file);
        };
        input.click();
      };
    }
    var search = els.main.querySelector('input[name="q"]');
    if (search) {
      search.addEventListener("keydown", function (e) {
        if (e.key === "Enter") renderChurches(readFilters());
      });
    }
  }

  async function loadChurchesTable(filters) {
    var host = $("dx-churches-table");
    if (!host) return;
    try {
      var data = await api(churchesQuery(filters));
      var rows = data.churches || [];
      state.churchesCache = rows;
      if (!rows.length) {
        host.innerHTML = emptyState("No churches match these filters.", "Add Church", "#/churches");
        var btn = host.querySelector("[data-nav]");
        if (btn) btn.onclick = openAddChurchModal;
        return;
      }
      host.innerHTML =
        '<div class="dx-table-wrap"><table class="dx-table"><thead><tr>' +
        "<th>Parish</th><th>Location</th><th>Diocese</th><th>Contact</th><th>Language</th><th>Status</th><th>Priority</th><th>Last contact</th>" +
        "</tr></thead><tbody>" +
        rows
          .map(function (c) {
            return (
              '<tr data-nav="#/churches/' +
              escapeHtml(c.id) +
              '"><td><strong>' +
              escapeHtml(c.parish_name) +
              "</strong></td><td>" +
              escapeHtml(place(c.city, c.country)) +
              "</td><td>" +
              escapeHtml(c.diocese || "—") +
              "</td><td>" +
              escapeHtml(c.contact_person || c.email || "—") +
              "</td><td>" +
              escapeHtml(c.language || "—") +
              "</td><td>" +
              statusChip(c.pipeline_status) +
              "</td><td>" +
              priorityBadge(c.priority) +
              "</td><td>" +
              escapeHtml(fmtShort(c.last_contacted_at)) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>" +
        '<p class="dx-muted" style="margin-top:8px">' +
        escapeHtml(rows.length) +
        " shown</p>";
    } catch (err) {
      host.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  function openAddChurchModal() {
    openModal(
      "Add Church",
      '<form id="dx-add-church-form" class="dx-form-grid">' +
        '<div class="dx-field dx-field--full"><label>Parish name *</label><input name="parish_name" required /></div>' +
        '<div class="dx-field"><label>Diocese</label><input name="diocese" /></div>' +
        '<div class="dx-field"><label>Country</label><input name="country" /></div>' +
        '<div class="dx-field"><label>City</label><input name="city" /></div>' +
        '<div class="dx-field"><label>Language</label><input name="language" /></div>' +
        '<div class="dx-field"><label>Contact person</label><input name="contact_person" /></div>' +
        '<div class="dx-field"><label>Email</label><input name="email" type="email" /></div>' +
        '<div class="dx-field"><label>Phone</label><input name="phone" /></div>' +
        '<div class="dx-field"><label>Website</label><input name="website" /></div>' +
        '<div class="dx-field"><label>Priority</label><select name="priority">' +
        optionList(PRIORITIES, "medium") +
        "</select></div>" +
        '<div class="dx-field"><label>Status</label><select name="pipeline_status">' +
        optionList(PIPELINE_STAGES, "discovered") +
        "</select></div>" +
        '<div class="dx-field dx-field--full"><label>Notes</label><textarea name="notes"></textarea></div>' +
        "</form>",
      '<button type="button" class="dx-btn" data-dx-close>Cancel</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-add-church-save">Save</button>'
    );
    var save = $("dx-add-church-save");
    if (save) {
      save.onclick = async function () {
        var form = $("dx-add-church-form");
        if (!form) return;
        var payload = {};
        new FormData(form).forEach(function (v, k) {
          if (String(v).trim()) payload[k] = String(v).trim();
        });
        if (!payload.parish_name) {
          toast("Parish name is required", "error");
          return;
        }
        save.disabled = true;
        try {
          var res = await api("/churches", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          closeModal();
          toast("Church added", "ok");
          navigate("#/churches/" + (res.church && res.church.id));
        } catch (err) {
          toast(err.message, "error");
          save.disabled = false;
        }
      };
    }
  }

  function parseCsv(text) {
    var lines = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(function (l) {
        return l.trim().length;
      });
    if (!lines.length) return [];
    function splitLine(line) {
      var out = [];
      var cur = "";
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = !inQ;
        } else if (ch === "," && !inQ) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) {
        return s.trim();
      });
    }
    var headers = splitLine(lines[0]).map(function (h) {
      return h.toLowerCase().replace(/\s+/g, " ").trim();
    });
    var mapped = headers.map(function (h) {
      return CSV_HEADER_MAP[h] || CSV_HEADER_MAP[h.replace(/ /g, "_")] || null;
    });
    var rows = [];
    for (var r = 1; r < lines.length; r++) {
      var cells = splitLine(lines[r]);
      var obj = {};
      mapped.forEach(function (key, idx) {
        if (key && cells[idx]) obj[key] = cells[idx];
      });
      if (obj.parish_name) rows.push(obj);
    }
    return rows;
  }

  async function handleCsvImport(file) {
    try {
      var text = await file.text();
      var rows = parseCsv(text);
      if (!rows.length) {
        toast("No valid rows found (need parish_name header)", "error");
        return;
      }
      var preview = await api("/import/preview", {
        method: "POST",
        body: JSON.stringify({ rows: rows }),
      });
      state.importRows = rows;
      state.importPreview = preview;
      showImportPreview(preview, rows);
    } catch (err) {
      toast(err.message || "Import failed", "error");
    }
  }

  function showImportPreview(preview, rows) {
    var list = (preview.rows || []).slice(0, 40);
    openModal(
      "Import preview",
      '<p class="dx-muted">' +
        escapeHtml(preview.valid || 0) +
        " valid · " +
        escapeHtml(preview.invalid || 0) +
        " invalid · " +
        escapeHtml(preview.duplicates || 0) +
        " duplicates (of " +
        escapeHtml(preview.total || rows.length) +
        ")</p>" +
        '<div class="dx-table-wrap" style="max-height:360px;overflow:auto"><table class="dx-table dx-table--static"><thead><tr><th>#</th><th>Parish</th><th>OK</th><th>Notes</th></tr></thead><tbody>' +
        list
          .map(function (item) {
            var notes = []
              .concat(item.errors || [])
              .concat(item.warnings || [])
              .concat(item.duplicate_of ? ["duplicate"] : [])
              .join("; ");
            return (
              "<tr><td>" +
              escapeHtml(item.index) +
              "</td><td>" +
              escapeHtml((item.row && item.row.parish_name) || "") +
              "</td><td>" +
              (item.ok ? "yes" : "no") +
              "</td><td>" +
              escapeHtml(notes || "—") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>",
      '<button type="button" class="dx-btn" data-dx-close>Cancel</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-import-confirm">Confirm import</button>',
      true
    );
    var conf = $("dx-import-confirm");
    if (conf) {
      conf.onclick = async function () {
        conf.disabled = true;
        try {
          var res = await api("/import/confirm", {
            method: "POST",
            body: JSON.stringify({ rows: state.importRows || rows }),
          });
          closeModal();
          toast(
            "Imported " +
              (res.created_count || 0) +
              ", skipped " +
              (res.skipped_count || 0),
            "ok"
          );
          renderChurches(readFilters());
        } catch (err) {
          toast(err.message, "error");
          conf.disabled = false;
        }
      };
    }
  }

  async function renderChurchProfile(id) {
    setPageMeta("Church", "Loading…", "");
    els.main.innerHTML = skeleton(3);
    try {
      var pack = await Promise.all([
        api("/churches/" + encodeURIComponent(id)),
        api("/churches/" + encodeURIComponent(id) + "/activity?limit=50"),
        api("/churches/" + encodeURIComponent(id) + "/interactions?limit=50"),
        api("/churches/" + encodeURIComponent(id) + "/liturgyflow"),
      ]);
      var church = pack[0].church || {};
      var activities = pack[1].activities || [];
      var interactions = pack[2].interactions || [];
      var lf = pack[3].liturgyflow || {};

      setPageMeta(
        church.parish_name || "Church",
        place(church.city, church.country),
        '<button type="button" class="dx-btn" data-dx-back-churches>Back</button>' +
          '<button type="button" class="dx-btn dx-btn--primary" id="dx-invite-church">Invite Church</button>'
      );

      els.main.innerHTML =
        '<div class="dx-profile-actions">' +
        '<label class="dx-field" style="min-width:160px"><span class="dx-muted" style="font-size:0.72rem;font-weight:600;text-transform:uppercase">Status</span>' +
        '<select id="dx-status-select">' +
        optionList(PIPELINE_STAGES.concat(["referral"]), church.pipeline_status) +
        "</select></label>" +
        '<button type="button" class="dx-btn" id="dx-status-save">Change status</button>' +
        '<button type="button" class="dx-btn" id="dx-log-contact">Log contact</button>' +
        '<button type="button" class="dx-btn" id="dx-schedule-fu">Schedule follow-up</button>' +
        '<button type="button" class="dx-btn" id="dx-referral-code">Referral code</button>' +
        (church.next_follow_up_at
          ? '<button type="button" class="dx-btn" id="dx-complete-fu">Complete follow-up</button>'
          : "") +
        "</div>" +
        '<div class="dx-profile-grid">' +
        '<div class="dx-stack">' +
        '<div class="dx-card"><h3 class="dx-section__title">Overview</h3>' +
        '<dl class="dx-dl" style="margin-top:12px">' +
        "<dt>Status</dt><dd>" +
        statusChip(church.pipeline_status) +
        " " +
        priorityBadge(church.priority) +
        "</dd>" +
        "<dt>Diocese</dt><dd>" +
        escapeHtml(church.diocese || "—") +
        "</dd>" +
        "<dt>Location</dt><dd>" +
        escapeHtml(place(church.city, church.country)) +
        "</dd>" +
        "<dt>Language</dt><dd>" +
        escapeHtml(church.language || church.mass_language || "—") +
        "</dd>" +
        "<dt>Website</dt><dd>" +
        (church.website
          ? '<a class="dx-link" href="' +
            escapeHtml(church.website) +
            '" target="_blank" rel="noopener">' +
            escapeHtml(church.website) +
            "</a>"
          : "—") +
        "</dd>" +
        "<dt>Parish ID</dt><dd>" +
        escapeHtml(church.parish_id || "—") +
        "</dd>" +
        "<dt>Referral</dt><dd><span class=\"dx-code\">" +
        escapeHtml(church.referral_code || "—") +
        "</span></dd>" +
        "</dl></div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Contact</h3>' +
        '<dl class="dx-dl" style="margin-top:12px">' +
        "<dt>Person</dt><dd>" +
        escapeHtml(church.contact_person || "—") +
        "</dd>" +
        "<dt>Role</dt><dd>" +
        escapeHtml(church.contact_role || "—") +
        "</dd>" +
        "<dt>Email</dt><dd>" +
        escapeHtml(church.email || "—") +
        "</dd>" +
        "<dt>Phone</dt><dd>" +
        escapeHtml(church.phone || "—") +
        "</dd>" +
        "<dt>Messaging</dt><dd>" +
        escapeHtml(church.messaging_platform || "—") +
        "</dd>" +
        "<dt>Last contact</dt><dd>" +
        escapeHtml(fmtDate(church.last_contacted_at)) +
        "</dd>" +
        "<dt>Next follow-up</dt><dd>" +
        escapeHtml(fmtDate(church.next_follow_up_at)) +
        (church.next_follow_up_note
          ? " — " + escapeHtml(church.next_follow_up_note)
          : "") +
        "</dd></dl></div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Distribution</h3>' +
        '<dl class="dx-dl" style="margin-top:12px">' +
        "<dt>Demo</dt><dd>" +
        escapeHtml(church.demo_status || "—") +
        "</dd>" +
        "<dt>Trial start</dt><dd>" +
        escapeHtml(fmtDate(church.trial_start_at)) +
        "</dd>" +
        "<dt>Trial ends</dt><dd>" +
        escapeHtml(fmtDate(church.trial_expires_at)) +
        "</dd>" +
        "<dt>Subscription</dt><dd>" +
        escapeHtml(church.subscription_status || "—") +
        "</dd>" +
        "<dt>Source</dt><dd>" +
        escapeHtml(church.referral_source || "—") +
        "</dd>" +
        "<dt>Assigned</dt><dd>" +
        escapeHtml(church.assigned_to || "—") +
        "</dd></dl></div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Notes</h3>' +
        '<textarea id="dx-notes" class="dx-field" style="width:100%;min-height:120px;margin-top:10px">' +
        escapeHtml(church.notes || "") +
        "</textarea>" +
        '<div style="margin-top:8px"><button type="button" class="dx-btn dx-btn--primary" id="dx-save-notes">Save notes</button></div></div>' +
        "</div>" +
        '<div class="dx-stack">' +
        '<div class="dx-card"><h3 class="dx-section__title">LiturgyFlow activity</h3>' +
        (lf.linked
          ? '<dl class="dx-dl" style="margin-top:12px">' +
            "<dt>Generations</dt><dd>" +
            escapeHtml(lf.generation_count || 0) +
            "</dd>" +
            "<dt>First</dt><dd>" +
            escapeHtml(fmtDate(lf.first_generation_at)) +
            "</dd>" +
            "<dt>Last</dt><dd>" +
            escapeHtml(fmtDate(lf.last_generation_at)) +
            "</dd>" +
            "<dt>Members</dt><dd>" +
            escapeHtml(lf.member_count || 0) +
            "</dd>" +
            "<dt>Posters</dt><dd>" +
            escapeHtml(lf.poster_count || 0) +
            "</dd></dl>"
          : '<p class="dx-muted" style="margin-top:10px">Not linked to a LiturgyFlow parish yet.</p>') +
        "</div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Interactions</h3>' +
        (interactions.length
          ? '<ul class="dx-timeline">' +
            interactions
              .map(function (ix) {
                return (
                  "<li><div class=\"dx-timeline__type\">" +
                  escapeHtml(ix.interaction_type || "contact") +
                  '</div><div>' +
                  escapeHtml(ix.summary || "") +
                  '</div><div class="dx-timeline__when">' +
                  escapeHtml(fmtDate(ix.interacted_at || ix.created_at)) +
                  "</div></li>"
                );
              })
              .join("") +
            "</ul>"
          : '<p class="dx-muted" style="margin-top:10px">No interactions logged.</p>') +
        "</div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Activity timeline</h3>' +
        (activities.length
          ? '<ul class="dx-timeline">' +
            activities
              .map(function (a) {
                return (
                  "<li><div class=\"dx-timeline__type\">" +
                  escapeHtml(a.activity_type || "event") +
                  "</div><div>" +
                  escapeHtml(a.summary || a.message || "") +
                  '</div><div class="dx-timeline__when">' +
                  escapeHtml(fmtDate(a.occurred_at || a.created_at)) +
                  "</div></li>"
                );
              })
              .join("") +
            "</ul>"
          : '<p class="dx-muted" style="margin-top:10px">No activity yet.</p>') +
        "</div></div></div>";

      var back = els.pageActions.querySelector("[data-dx-back-churches]");
      if (back) back.onclick = function () {
        navigate("#/churches");
      };
      var inviteBtn = $("dx-invite-church");
      if (inviteBtn) {
        inviteBtn.onclick = async function () {
          inviteBtn.disabled = true;
          try {
            var res = await api("/churches/" + encodeURIComponent(id) + "/invite", {
              method: "POST",
              body: JSON.stringify({ ttl_days: 14 }),
            });
            var url = res.join_url || res.invite_url || (res.join_path || "");
            if (url && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(
                  url.indexOf("http") === 0 ? url : location.origin + url
                );
              } catch (_e) {}
            }
            toast("Invite created" + (url ? " — link copied" : ""), "ok");
            renderChurchProfile(id);
          } catch (err) {
            toast(err.message, "error");
            inviteBtn.disabled = false;
          }
        };
      }
      var statusSave = $("dx-status-save");
      if (statusSave) {
        statusSave.onclick = async function () {
          var sel = $("dx-status-select");
          try {
            await api("/churches/" + encodeURIComponent(id) + "/status", {
              method: "POST",
              body: JSON.stringify({ status: sel.value }),
            });
            toast("Status updated", "ok");
            renderChurchProfile(id);
          } catch (err) {
            toast(err.message, "error");
          }
        };
      }
      var saveNotes = $("dx-save-notes");
      if (saveNotes) {
        saveNotes.onclick = async function () {
          try {
            await api("/churches/" + encodeURIComponent(id), {
              method: "PATCH",
              body: JSON.stringify({ notes: ($("dx-notes") || {}).value || "" }),
            });
            toast("Notes saved", "ok");
          } catch (err) {
            toast(err.message, "error");
          }
        };
      }
      var logBtn = $("dx-log-contact");
      if (logBtn) logBtn.onclick = function () {
        openLogContactModal(id);
      };
      var fuBtn = $("dx-schedule-fu");
      if (fuBtn) fuBtn.onclick = function () {
        openScheduleFollowUpModal(id);
      };
      var refBtn = $("dx-referral-code");
      if (refBtn) {
        refBtn.onclick = async function () {
          try {
            var res = await api(
              "/churches/" + encodeURIComponent(id) + "/referral-code",
              { method: "POST", body: "{}" }
            );
            toast("Referral code: " + (res.referral_code || ""), "ok");
            if (res.referral_code && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(res.referral_code);
              } catch (_e) {}
            }
            renderChurchProfile(id);
          } catch (err) {
            toast(err.message, "error");
          }
        };
      }
      var completeFu = $("dx-complete-fu");
      if (completeFu) {
        completeFu.onclick = async function () {
          try {
            await api("/churches/" + encodeURIComponent(id) + "/follow-up/complete", {
              method: "POST",
              body: JSON.stringify({ note: "" }),
            });
            toast("Follow-up completed", "ok");
            renderChurchProfile(id);
          } catch (err) {
            toast(err.message, "error");
          }
        };
      }
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p>" +
        '<button type="button" class="dx-btn" data-nav="#/churches">Back to churches</button></div>';
    }
  }

  function openLogContactModal(churchId) {
    openModal(
      "Log contact",
      '<form id="dx-log-form" class="dx-form-grid">' +
        '<div class="dx-field"><label>Type</label><select name="interaction_type">' +
        optionList(
          INTERACTION_TYPES.map(function (t) {
            return { value: t, label: t };
          }),
          "email"
        ) +
        "</select></div>" +
        '<div class="dx-field dx-field--full"><label>Summary</label><textarea name="summary" required></textarea></div>' +
        '<div class="dx-field dx-field--full"><label>Result</label><input name="result" /></div>' +
        '<div class="dx-field dx-field--full"><label>Next action</label><input name="next_action" /></div>' +
        "</form>",
      '<button type="button" class="dx-btn" data-dx-close>Cancel</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-log-save">Save</button>'
    );
    var save = $("dx-log-save");
    if (save) {
      save.onclick = async function () {
        var form = $("dx-log-form");
        var payload = {};
        new FormData(form).forEach(function (v, k) {
          payload[k] = String(v).trim();
        });
        try {
          await api(
            "/churches/" + encodeURIComponent(churchId) + "/interactions",
            { method: "POST", body: JSON.stringify(payload) }
          );
          closeModal();
          toast("Contact logged", "ok");
          renderChurchProfile(churchId);
        } catch (err) {
          toast(err.message, "error");
        }
      };
    }
  }

  function openScheduleFollowUpModal(churchId) {
    var local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    var def = local.toISOString().slice(0, 16);
    openModal(
      "Schedule follow-up",
      '<form id="dx-fu-form" class="dx-form-grid">' +
        '<div class="dx-field dx-field--full"><label>When</label><input type="datetime-local" name="at" value="' +
        escapeHtml(def) +
        '" required /></div>' +
        '<div class="dx-field dx-field--full"><label>Note</label><input name="note" /></div>' +
        "</form>",
      '<button type="button" class="dx-btn" data-dx-close>Cancel</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-fu-save">Save</button>'
    );
    var save = $("dx-fu-save");
    if (save) {
      save.onclick = async function () {
        var form = $("dx-fu-form");
        var fd = new FormData(form);
        var atRaw = String(fd.get("at") || "");
        var at = atRaw ? new Date(atRaw).toISOString() : "";
        try {
          await api(
            "/churches/" + encodeURIComponent(churchId) + "/follow-up/reschedule",
            {
              method: "POST",
              body: JSON.stringify({
                at: at,
                note: String(fd.get("note") || "").trim() || null,
              }),
            }
          );
          closeModal();
          toast("Follow-up scheduled", "ok");
          if (state.route.name === "church") renderChurchProfile(churchId);
          else if (state.route.name === "follow-ups") renderFollowUps();
          else route();
        } catch (err) {
          toast(err.message, "error");
        }
      };
    }
  }

  async function renderPipeline() {
    setPageMeta("Pipeline", "Drag cards between stages", "");
    els.main.innerHTML = '<div class="dx-loading">Loading pipeline…</div>';
    try {
      var data = await api("/churches?limit=500");
      var churches = data.churches || [];
      var byStage = {};
      PIPELINE_STAGES.forEach(function (s) {
        byStage[s] = [];
      });
      churches.forEach(function (c) {
        var st = c.pipeline_status || "discovered";
        if (!byStage[st]) byStage[st] = [];
        if (PIPELINE_STAGES.indexOf(st) >= 0) byStage[st].push(c);
      });

      els.main.innerHTML =
        '<div class="dx-kanban" id="dx-kanban">' +
        PIPELINE_STAGES.map(function (stage) {
          var cards = byStage[stage] || [];
          return (
            '<div class="dx-kanban__col" data-stage="' +
            escapeHtml(stage) +
            '"><div class="dx-kanban__head"><span>' +
            escapeHtml(PIPELINE_LABELS[stage]) +
            '</span><span class="dx-kanban__count">' +
            cards.length +
            '</span></div><div class="dx-kanban__cards">' +
            cards
              .map(function (c) {
                var trialHint =
                  c.trial_expires_at && stage === "trial"
                    ? "Trial ends " + fmtShort(c.trial_expires_at)
                    : "";
                return (
                  '<div class="dx-kcard" draggable="true" data-id="' +
                  escapeHtml(c.id) +
                  '"><p class="dx-kcard__name">' +
                  escapeHtml(c.parish_name) +
                  '</p><p class="dx-kcard__meta">' +
                  escapeHtml(place(c.city, c.country)) +
                  "</p><p class=\"dx-kcard__meta\">" +
                  escapeHtml(c.diocese || "") +
                  (c.contact_person ? " · " + escapeHtml(c.contact_person) : "") +
                  "</p><p class=\"dx-kcard__meta\">" +
                  escapeHtml(c.language || "") +
                  (c.last_contacted_at
                    ? " · " + escapeHtml(fmtShort(c.last_contacted_at))
                    : "") +
                  (trialHint ? " · " + escapeHtml(trialHint) : "") +
                  '</p><div class="dx-kcard__row">' +
                  priorityBadge(c.priority) +
                  '<button type="button" class="dx-btn dx-btn--sm dx-btn--ghost" data-nav="#/churches/' +
                  escapeHtml(c.id) +
                  '">Open</button></div></div>'
                );
              })
              .join("") +
            "</div></div>"
          );
        }).join("") +
        "</div>";

      bindKanbanDnD();
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  function bindKanbanDnD() {
    var dragId = null;
    els.main.querySelectorAll(".dx-kcard").forEach(function (card) {
      card.addEventListener("dragstart", function (e) {
        dragId = card.getAttribute("data-id");
        e.dataTransfer.setData("text/plain", dragId);
        e.dataTransfer.effectAllowed = "move";
      });
    });
    els.main.querySelectorAll(".dx-kanban__col").forEach(function (col) {
      col.addEventListener("dragover", function (e) {
        e.preventDefault();
        col.classList.add("is-dragover");
      });
      col.addEventListener("dragleave", function () {
        col.classList.remove("is-dragover");
      });
      col.addEventListener("drop", async function (e) {
        e.preventDefault();
        col.classList.remove("is-dragover");
        var id = e.dataTransfer.getData("text/plain") || dragId;
        var status = col.getAttribute("data-stage");
        if (!id || !status) return;
        try {
          await api("/churches/" + encodeURIComponent(id) + "/status", {
            method: "POST",
            body: JSON.stringify({ status: status }),
          });
          toast("Moved to " + (PIPELINE_LABELS[status] || status), "ok");
          renderPipeline();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }

  async function renderCampaigns() {
    setPageMeta(
      "Campaigns",
      "Outreach campaigns",
      '<button type="button" class="dx-btn dx-btn--primary" id="dx-add-campaign">New campaign</button>'
    );
    els.main.innerHTML = skeleton(2);
    var add = $("dx-add-campaign");
    if (add) add.onclick = openCreateCampaignModal;
    try {
      var data = await api("/campaigns");
      var rows = data.campaigns || [];
      if (!rows.length) {
        els.main.innerHTML = emptyState("No campaigns yet.", "Create campaign", "#/campaigns");
        var cta = els.main.querySelector("[data-nav]");
        if (cta) cta.onclick = openCreateCampaignModal;
        return;
      }
      els.main.innerHTML =
        '<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Name</th><th>Status</th><th>Geo</th><th>Dates</th></tr></thead><tbody>' +
        rows
          .map(function (c) {
            return (
              '<tr data-nav="#/campaigns/' +
              escapeHtml(c.id) +
              '"><td><strong>' +
              escapeHtml(c.name) +
              "</strong></td><td>" +
              escapeHtml(c.status || "—") +
              "</td><td>" +
              escapeHtml(place(c.city, c.country)) +
              "</td><td>" +
              escapeHtml((c.start_date || "—") + " → " + (c.end_date || "—")) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  function openCreateCampaignModal() {
    openModal(
      "New campaign",
      '<form id="dx-camp-form" class="dx-form-grid">' +
        '<div class="dx-field dx-field--full"><label>Name *</label><input name="name" required /></div>' +
        '<div class="dx-field dx-field--full"><label>Description</label><textarea name="description"></textarea></div>' +
        '<div class="dx-field"><label>Country</label><input name="country" /></div>' +
        '<div class="dx-field"><label>City</label><input name="city" /></div>' +
        '<div class="dx-field"><label>Diocese</label><input name="diocese" /></div>' +
        '<div class="dx-field"><label>Language</label><input name="language" /></div>' +
        '<div class="dx-field"><label>Status</label><select name="status">' +
        optionList(
          CAMPAIGN_STATUSES.map(function (s) {
            return { value: s, label: s };
          }),
          "active"
        ) +
        "</select></div></form>",
      '<button type="button" class="dx-btn" data-dx-close>Cancel</button>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-camp-save">Create</button>'
    );
    var save = $("dx-camp-save");
    if (save) {
      save.onclick = async function () {
        var form = $("dx-camp-form");
        var payload = {};
        new FormData(form).forEach(function (v, k) {
          if (String(v).trim()) payload[k] = String(v).trim();
        });
        if (!payload.name) {
          toast("Name required", "error");
          return;
        }
        try {
          var res = await api("/campaigns", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          closeModal();
          toast("Campaign created", "ok");
          navigate("#/campaigns/" + (res.campaign && res.campaign.id));
        } catch (err) {
          toast(err.message, "error");
        }
      };
    }
  }

  async function renderCampaignDetail(id) {
    setPageMeta("Campaign", "Loading…", "");
    els.main.innerHTML = skeleton(2);
    try {
      var data = await api("/campaigns/" + encodeURIComponent(id));
      var c = data.campaign || {};
      var churches = c.churches || [];
      var stats = c.stats || {};
      setPageMeta(
        c.name || "Campaign",
        c.status || "",
        '<button type="button" class="dx-btn" data-nav="#/campaigns">Back</button>'
      );
      var statsHtml = Object.keys(stats).length
        ? Object.keys(stats)
            .map(function (k) {
              return (
                "<dt>" +
                escapeHtml(k) +
                "</dt><dd>" +
                escapeHtml(
                  typeof stats[k] === "object"
                    ? JSON.stringify(stats[k])
                    : stats[k]
                ) +
                "</dd>"
              );
            })
            .join("")
        : "<dt>Churches</dt><dd>" + escapeHtml(c.church_count || churches.length) + "</dd>";

      els.main.innerHTML =
        '<div class="dx-grid dx-grid--2">' +
        '<div class="dx-card"><h3 class="dx-section__title">Details</h3>' +
        '<dl class="dx-dl" style="margin-top:12px">' +
        "<dt>Status</dt><dd>" +
        escapeHtml(c.status || "—") +
        "</dd>" +
        "<dt>Geo</dt><dd>" +
        escapeHtml(place(c.city, c.country)) +
        "</dd>" +
        "<dt>Diocese</dt><dd>" +
        escapeHtml(c.diocese || "—") +
        "</dd>" +
        "<dt>Language</dt><dd>" +
        escapeHtml(c.language || "—") +
        "</dd>" +
        "<dt>Dates</dt><dd>" +
        escapeHtml((c.start_date || "—") + " → " + (c.end_date || "—")) +
        "</dd></dl>" +
        (c.description
          ? '<p style="margin-top:12px">' + escapeHtml(c.description) + "</p>"
          : "") +
        "</div>" +
        '<div class="dx-card"><h3 class="dx-section__title">Stats</h3><dl class="dx-dl" style="margin-top:12px">' +
        statsHtml +
        "</dl></div></div>" +
        '<div class="dx-section dx-card"><div class="dx-section__head"><h3 class="dx-section__title">Churches in campaign</h3></div>' +
        '<div class="dx-filters"><div class="dx-field dx-field--grow"><label>Add by church ID</label><input id="dx-camp-add-id" placeholder="uuid" /></div>' +
        '<button type="button" class="dx-btn dx-btn--primary" id="dx-camp-add-btn">Add</button></div>' +
        (churches.length
          ? '<div class="dx-table-wrap"><table class="dx-table dx-table--static"><thead><tr><th>Parish</th><th>Status</th><th></th></tr></thead><tbody>' +
            churches
              .map(function (ch) {
                return (
                  "<tr><td><a class=\"dx-link\" href=\"#/churches/" +
                  escapeHtml(ch.id) +
                  '">' +
                  escapeHtml(ch.parish_name) +
                  "</a></td><td>" +
                  statusChip(ch.pipeline_status) +
                  '</td><td><button type="button" class="dx-btn dx-btn--sm dx-btn--danger" data-remove-church="' +
                  escapeHtml(ch.id) +
                  '">Remove</button></td></tr>'
                );
              })
              .join("") +
            "</tbody></table></div>"
          : '<p class="dx-muted">No churches associated yet.</p>') +
        "</div>";

      var addBtn = $("dx-camp-add-btn");
      if (addBtn) {
        addBtn.onclick = async function () {
          var cid = (($("dx-camp-add-id") || {}).value || "").trim();
          if (!cid) {
            toast("Enter a church id", "error");
            return;
          }
          try {
            await api("/campaigns/" + encodeURIComponent(id) + "/churches", {
              method: "POST",
              body: JSON.stringify({ church_ids: [cid] }),
            });
            toast("Church added", "ok");
            renderCampaignDetail(id);
          } catch (err) {
            toast(err.message, "error");
          }
        };
      }
      els.main.querySelectorAll("[data-remove-church]").forEach(function (btn) {
        btn.onclick = async function () {
          try {
            await api(
              "/campaigns/" +
                encodeURIComponent(id) +
                "/churches/" +
                encodeURIComponent(btn.getAttribute("data-remove-church")),
              { method: "DELETE" }
            );
            toast("Removed", "ok");
            renderCampaignDetail(id);
          } catch (err) {
            toast(err.message, "error");
          }
        };
      });
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  async function renderFollowUps() {
    setPageMeta("Follow-ups", "Today and overdue", "");
    els.main.innerHTML = skeleton(2);
    try {
      var data = await api("/follow-ups?today=true&overdue=true");
      function listBlock(title, rows) {
        rows = rows || [];
        return (
          '<div class="dx-card dx-section"><div class="dx-section__head"><h2 class="dx-section__title">' +
          escapeHtml(title) +
          " (" +
          rows.length +
          ")</h2></div>" +
          (rows.length
            ? rows
                .map(function (c) {
                  return (
                    '<div class="dx-list-item" style="cursor:default"><div data-nav="#/churches/' +
                    escapeHtml(c.id) +
                    '" style="cursor:pointer;flex:1"><p class="dx-list-item__title">' +
                    escapeHtml(c.parish_name) +
                    '</p><p class="dx-list-item__meta">' +
                    escapeHtml(fmtDate(c.next_follow_up_at)) +
                    (c.next_follow_up_note
                      ? " · " + escapeHtml(c.next_follow_up_note)
                      : "") +
                    "</p></div>" +
                    '<div class="dx-inline-actions">' +
                    '<button type="button" class="dx-btn dx-btn--sm" data-complete="' +
                    escapeHtml(c.id) +
                    '">Complete</button>' +
                    '<button type="button" class="dx-btn dx-btn--sm" data-reschedule="' +
                    escapeHtml(c.id) +
                    '">Reschedule</button></div></div>'
                  );
                })
                .join("")
            : '<p class="dx-muted">None.</p>') +
          "</div>"
        );
      }
      els.main.innerHTML =
        listBlock("Overdue", data.overdue) + listBlock("Today", data.today);

      els.main.querySelectorAll("[data-complete]").forEach(function (btn) {
        btn.onclick = async function () {
          try {
            await api(
              "/churches/" +
                encodeURIComponent(btn.getAttribute("data-complete")) +
                "/follow-up/complete",
              { method: "POST", body: JSON.stringify({ note: "" }) }
            );
            toast("Completed", "ok");
            renderFollowUps();
          } catch (err) {
            toast(err.message, "error");
          }
        };
      });
      els.main.querySelectorAll("[data-reschedule]").forEach(function (btn) {
        btn.onclick = function () {
          openScheduleFollowUpModal(btn.getAttribute("data-reschedule"));
        };
      });
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  async function renderInvitations() {
    setPageMeta("Invitations", "Onboarding invite links", "");
    els.main.innerHTML = skeleton(2);
    try {
      var data = await api("/invites");
      var rows = data.invites || [];
      if (!rows.length) {
        els.main.innerHTML = emptyState(
          "No invitations yet. Create one from a church profile.",
          "Go to churches",
          "#/churches"
        );
        return;
      }
      els.main.innerHTML =
        '<div class="dx-table-wrap"><table class="dx-table dx-table--static"><thead><tr>' +
        "<th>Church</th><th>Status</th><th>Slug</th><th>URLs</th><th></th></tr></thead><tbody>" +
        rows
          .map(function (inv) {
            var ch = inv.distribution_churches || {};
            var join = inv.join_path || (inv.slug ? "/join/" + inv.slug : "");
            var inviteUrl = inv.invite_url || "";
            return (
              "<tr><td>" +
              escapeHtml(ch.parish_name || inv.church_id || "—") +
              "</td><td>" +
              escapeHtml(inv.status || "—") +
              '</td><td><span class="dx-code">' +
              escapeHtml(inv.slug || "—") +
              "</span></td><td style=\"max-width:220px;word-break:break-all;font-size:0.78rem\">" +
              escapeHtml(join || inviteUrl || "—") +
              '</td><td class="dx-inline-actions">' +
              '<button type="button" class="dx-btn dx-btn--sm" data-copy="' +
              escapeHtml(join || inviteUrl) +
              '">Copy</button>' +
              (inv.status === "pending"
                ? '<button type="button" class="dx-btn dx-btn--sm dx-btn--danger" data-revoke="' +
                  escapeHtml(inv.id) +
                  '">Revoke</button>'
                : "") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";

      els.main.querySelectorAll("[data-copy]").forEach(function (btn) {
        btn.onclick = async function () {
          var v = btn.getAttribute("data-copy") || "";
          var full = v.indexOf("http") === 0 ? v : location.origin + v;
          try {
            await navigator.clipboard.writeText(full);
            toast("Copied", "ok");
          } catch (_e) {
            toast(full, "ok");
          }
        };
      });
      els.main.querySelectorAll("[data-revoke]").forEach(function (btn) {
        btn.onclick = async function () {
          try {
            await api(
              "/invites/" + encodeURIComponent(btn.getAttribute("data-revoke")) + "/revoke",
              { method: "POST", body: "{}" }
            );
            toast("Revoked", "ok");
            renderInvitations();
          } catch (err) {
            toast(err.message, "error");
          }
        };
      });
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  async function renderReferrals() {
    setPageMeta("Referrals", "Referral graph", "");
    els.main.innerHTML = skeleton(2);
    try {
      var data = await api("/referrals");
      var rows = data.referrals || [];
      if (!rows.length) {
        els.main.innerHTML = emptyState(
          "No referrals yet. Generate a code from a church profile.",
          "Churches",
          "#/churches"
        );
        return;
      }
      els.main.innerHTML =
        '<div class="dx-table-wrap"><table class="dx-table"><thead><tr>' +
        "<th>Code</th><th>Referring</th><th>Referred</th><th>Status</th><th>Created</th></tr></thead><tbody>" +
        rows
          .map(function (r) {
            return (
              "<tr><td><span class=\"dx-code\">" +
              escapeHtml(r.referral_code || "—") +
              "</span></td><td>" +
              (r.referring_church_id
                ? '<a class="dx-link" href="#/churches/' +
                  escapeHtml(r.referring_church_id) +
                  '">' +
                  escapeHtml(r.referring_church_id.slice(0, 8)) +
                  "…</a>"
                : "—") +
              "</td><td>" +
              (r.referred_church_id
                ? '<a class="dx-link" href="#/churches/' +
                  escapeHtml(r.referred_church_id) +
                  '">' +
                  escapeHtml(r.referred_church_id.slice(0, 8)) +
                  "…</a>"
                : "—") +
              "</td><td>" +
              escapeHtml(r.status || "—") +
              "</td><td>" +
              escapeHtml(fmtShort(r.created_at)) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  async function renderAnalytics() {
    setPageMeta("Analytics", "Funnel and opportunity", "");
    els.main.innerHTML = skeleton(3);
    try {
      var pack = await Promise.all([
        api("/analytics/funnel"),
        api("/analytics/opportunity"),
      ]);
      var funnel = pack[0];
      var opp = pack[1];
      var stages = funnel.stages || [];
      var maxCum = Math.max.apply(
        null,
        stages.map(function (s) {
          return s.cumulative || s.count || 0;
        }).concat([1])
      );

      var funnelHtml = stages
        .map(function (s) {
          var pct = Math.max(2, Math.round(((s.cumulative || s.count || 0) / maxCum) * 100));
          return (
            '<div class="dx-funnel__row"><div class="dx-funnel__label">' +
            escapeHtml(s.label || s.status) +
            '</div><div class="dx-funnel__bar-track"><div class="dx-funnel__bar" style="width:' +
            pct +
            '%"></div></div><div class="dx-funnel__meta">' +
            escapeHtml(s.count || 0) +
            (s.conversion_from_previous_pct != null
              ? " · " + escapeHtml(s.conversion_from_previous_pct) + "%"
              : "") +
            "</div></div>"
          );
        })
        .join("");

      var countries = opp.countries || [];
      var oppHtml = countries.length
        ? countries
            .slice(0, 24)
            .map(function (c) {
              return (
                '<div class="dx-card"><p class="dx-stat__label">' +
                escapeHtml(c.country) +
                '</p><p class="dx-stat__value">' +
                escapeHtml(c.total) +
                '</p><p class="dx-stat__hint">' +
                escapeHtml(
                  Object.keys(c.by_status || {})
                    .map(function (k) {
                      return k + ":" + c.by_status[k];
                    })
                    .join(" · ")
                ) +
                "</p>" +
                ((c.cities || [])
                  .slice(0, 5)
                  .map(function (city) {
                    return (
                      '<p class="dx-muted" style="margin:4px 0 0">' +
                      escapeHtml(city.city) +
                      " — " +
                      escapeHtml(city.total) +
                      "</p>"
                    );
                  })
                  .join("") || "") +
                "</div>"
              );
            })
            .join("")
        : '<p class="dx-muted">No geo data yet.</p>';

      els.main.innerHTML =
        '<div class="dx-card"><div class="dx-section__head"><h2 class="dx-section__title">Funnel</h2>' +
        '<span class="dx-muted">Total ' +
        escapeHtml(funnel.total || 0) +
        "</span></div>" +
        '<div class="dx-funnel">' +
        funnelHtml +
        "</div></div>" +
        '<div class="dx-section"><div class="dx-section__head"><h2 class="dx-section__title">Opportunity by geography</h2>' +
        '<a class="dx-link" href="#/opportunity">Focus view</a></div>' +
        '<div class="dx-grid dx-grid--3">' +
        oppHtml +
        "</div></div>";
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' + escapeHtml(err.message) + "</p></div>";
    }
  }

  async function renderOpportunity() {
    setPageMeta("Opportunity", "Country / city concentration", "");
    await renderAnalytics();
    setPageMeta("Opportunity", "Country / city concentration", "");
  }

  function renderSettings() {
    setPageMeta("Settings", "Access & links", "");
    els.main.innerHTML =
      '<div class="dx-card" style="max-width:560px">' +
      "<h2 class=\"dx-section__title\">Who can access</h2>" +
      "<p style=\"margin:10px 0 16px;color:var(--dx-body)\">LiturgyFlow Distribution is limited to <strong>superadmin</strong> accounts. " +
      "All API calls require an authenticated superadmin session.</p>" +
      '<div class="dx-quick-links">' +
      '<a class="dx-btn dx-btn--primary" href="/superadmin">Open Superadmin</a>' +
      '<a class="dx-btn" href="/home">Main app</a>' +
      "</div></div>";
  }

  async function route() {
    if (!els.main) return;
    state.route = parseRoute();
    setNavActive(state.route.name);
    var name = state.route.name;
    try {
      if (name === "dashboard") await renderDashboard();
      else if (name === "churches") await renderChurches();
      else if (name === "church") await renderChurchProfile(state.route.params.id);
      else if (name === "pipeline") await renderPipeline();
      else if (name === "campaigns") await renderCampaigns();
      else if (name === "campaign") await renderCampaignDetail(state.route.params.id);
      else if (name === "follow-ups") await renderFollowUps();
      else if (name === "invitations") await renderInvitations();
      else if (name === "referrals") await renderReferrals();
      else if (name === "analytics") await renderAnalytics();
      else if (name === "opportunity") await renderOpportunity();
      else if (name === "settings") renderSettings();
      else await renderDashboard();
    } catch (err) {
      els.main.innerHTML =
        '<div class="dx-empty"><p>' +
        escapeHtml(err.message || "Something went wrong") +
        "</p></div>";
    }
  }

  function bindShell() {
    if (els.sidebarToggle) {
      els.sidebarToggle.addEventListener("click", function () {
        if (els.app && els.app.classList.contains("dx-sidebar-open")) closeSidebar();
        else openSidebar();
      });
    }
    if (els.backdrop) els.backdrop.addEventListener("click", closeSidebar);
    document.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-nav]");
      if (nav) {
        e.preventDefault();
        navigate(nav.getAttribute("data-nav"));
      }
    });
    window.addEventListener("hashchange", route);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  function showLocked() {
    if (els.boot) els.boot.hidden = true;
    if (els.app) els.app.hidden = true;
    if (els.locked) els.locked.hidden = false;
  }

  function showApp() {
    if (els.boot) els.boot.hidden = true;
    if (els.locked) els.locked.hidden = true;
    if (els.app) els.app.hidden = false;
  }

  async function boot() {
    els.boot = $("dx-boot");
    els.bootStatus = $("dx-boot-status");
    els.locked = $("dx-locked");
    els.app = $("dx-app");
    els.main = $("dx-main");
    els.nav = $("dx-nav");
    els.pageTitle = $("dx-page-title");
    els.pageSub = $("dx-page-sub");
    els.pageActions = $("dx-page-actions");
    els.toastHost = $("dx-toast-host");
    els.modalHost = $("dx-modal-host");
    els.sidebarToggle = $("dx-sidebar-toggle");
    els.backdrop = $("dx-sidebar-backdrop");

    if (!window.VerbumAuth) {
      if (els.bootStatus) els.bootStatus.textContent = "Auth library missing.";
      return;
    }

    try {
      if (els.bootStatus) els.bootStatus.textContent = "Signing in…";
      await window.VerbumAuth.initMainAppAuth();
      await window.VerbumAuth.waitUntilReady(10000);

      var headers = await window.VerbumAuth.getAuthHeaders();
      var meRes = await fetch("/api/auth/me", { headers: headers, credentials: "include" });
      var me = await meRes.json().catch(function () {
        return {};
      });

      if (!me.authenticated) {
        var next = encodeURIComponent(
          location.pathname + location.search + location.hash
        );
        location.href = "/sign-in?redirect_url=" + next;
        return;
      }
      var isSa =
        me.role === "superadmin" ||
        (me.membership && me.membership.is_superadmin) ||
        (me.profile && me.profile.role === "superadmin");
      if (!isSa) {
        showLocked();
        return;
      }

      showApp();
      bindShell();
      if (!location.hash || location.hash === "#") {
        location.hash = "#/dashboard";
      } else {
        await route();
      }
    } catch (err) {
      if (els.bootStatus) {
        els.bootStatus.textContent = err.message || "Could not start Distribution.";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
