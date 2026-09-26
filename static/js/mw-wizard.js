/* Mass Builder wizard controller — extracted from templates/index.html */
      (function () {
        function $(id) { return document.getElementById(id); }
        function prefersReducedMotion() {
          return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        }
        function animateMwNavChrome(el, show) {
          if (!el) return;
          var wantShow = !!show;
          var isHidden = !!el.hidden;
          var isOut = el.classList.contains('is-nav-out');
          if (prefersReducedMotion()) {
            el.hidden = !wantShow;
            el.classList.remove('is-nav-in', 'is-nav-out');
            return;
          }
          if (wantShow) {
            if (!isHidden && !isOut) {
              el.classList.add('is-nav-in');
              return;
            }
            if (el._mwNavOutTimer) {
              clearTimeout(el._mwNavOutTimer);
              el._mwNavOutTimer = null;
            }
            el.hidden = false;
            el.classList.remove('is-nav-out');
            el.classList.remove('is-nav-in');
            void el.offsetWidth;
            el.classList.add('is-nav-in');
            return;
          }
          if (isHidden && !isOut) return;
          el.classList.remove('is-nav-in');
          el.classList.add('is-nav-out');
          if (el._mwNavOutTimer) clearTimeout(el._mwNavOutTimer);
          el._mwNavOutTimer = setTimeout(function () {
            el._mwNavOutTimer = null;
            if (el.classList.contains('is-nav-out')) {
              el.hidden = true;
              el.classList.remove('is-nav-out');
            }
            if (el.id === 'btn-practice-share-wizard' || el.id === 'mw-present') syncMwNavExtraPill();
          }, 280);
        }
        function syncMwNavExtraPill() {
          var pill = $('mw-nav-extra-pill') || document.querySelector('.mw-nav__pill--extra');
          if (!pill) return;
          var share = $('btn-practice-share-wizard');
          var present = $('mw-present');
          var want = [share, present].some(function (btn) {
            return !!(btn && btn.dataset.mwNavWant === '1');
          });
          animateMwNavChrome(pill, want);
        }
        function setMwNavBtnVisible(el, show) {
          if (!el) return;
          if (el.id === 'btn-practice-share-wizard' || el.id === 'mw-present') {
            el.dataset.mwNavWant = show ? '1' : '0';
          }
          animateMwNavChrome(el, show);
          if (el.id === 'btn-practice-share-wizard' || el.id === 'mw-present') syncMwNavExtraPill();
        }
        window.setMwNavBtnVisible = setMwNavBtnVisible;
        window.syncMwNavExtraPill = syncMwNavExtraPill;
        var flowPage = $('flow-page');
        if (!flowPage) return;
        window.massRiteVideoMode = window.massRiteVideoMode || {};
        window.massRiteVideoLang = window.massRiteVideoLang || {};
        window.__riteVideoSyncFns = window.__riteVideoSyncFns || {};
        window.registerRiteVideoSync = function (section, fn) {
          if (section && typeof fn === 'function') window.__riteVideoSyncFns[section] = fn;
        };
        window.syncRiteVideoUi = function (section) {
          var map = window.__riteVideoSyncFns || {};
          if (section && map[section]) map[section]();
          else Object.keys(map).forEach(function (k) { map[k](); });
        };
        var STEP_META = {
          1: { title: 'Let’s Prepare Today’s Mass', sub: 'Pick a date and who’s celebrating.' },
          2: { title: 'Introductory Rites', sub: 'Set the Penitential Act, Kyrie, and Gloria.' },
          3: { title: 'Liturgy of the Word', sub: 'Readings import automatically — refine the psalm and Gospel lines.' },
          4: { title: 'Liturgy of the Eucharist', sub: 'Creed, Sanctus, Our Father, and Lamb of God.' },
          5: { title: 'Music Ministry', sub: '' },
          6: { title: 'Additional Details', sub: '' },
          7: { title: 'Review & Generate', sub: '' }
        };
        var ASIDE_STEPS = { 1: true, 2: true, 4: true, 6: true };
        var ASIDE_ART = {
          1: '/static/images/landing/step-calendar.png',
          2: '/static/images/roman-missal-bg.jpg',
          4: '/static/images/roman-missal-bg.jpg',
          6: '/static/images/landing/step-typography.png'
        };
        var current = 1;
        var progItems = Array.prototype.slice.call(document.querySelectorAll('#mw-progress .mw-progress__item'));

        function setPanels(step) {
          var songs = step === 5;
          var setup = $('flow-panel-setup'), songsP = $('flow-panel-songs');
          if (setup) setup.hidden = songs;
          if (songsP) songsP.hidden = !songs;
          var ts = $('flow-tab-setup'), tg = $('flow-tab-songs');
          if (ts) ts.setAttribute('aria-selected', String(!songs));
          if (tg) tg.setAttribute('aria-selected', String(songs));
        }
        function fillGuide() {
          var map = [['mw-guide-r1', 'flow-reading1-body'], ['mw-guide-r1-ref', 'flow-reading1-ref'],
            ['mw-guide-psalm', 'flow-psalm-body'], ['mw-guide-psalm-ref', 'flow-psalm-ref'],
            ['mw-guide-r2', 'flow-reading2-body'], ['mw-guide-r2-ref', 'flow-reading2-ref'],
            ['mw-guide-gospel', 'flow-gospel-body'], ['mw-guide-gospel-ref', 'flow-gospel-ref']];
          map.forEach(function (p) { var d = $(p[0]), s = $(p[1]); if (d && s) d.textContent = s.textContent; });
        }
        function parishNameForContext() {
          var fromSettings = $('settings-church-name');
          if (fromSettings && fromSettings.value && fromSettings.value.trim()) return fromSettings.value.trim();
          try {
            if (window.VerbumAuth && typeof window.VerbumAuth.getChurchProfile === 'function') {
              var profile = window.VerbumAuth.getChurchProfile();
              if (profile && profile.community_name) return String(profile.community_name).trim();
            }
          } catch (_e) { /* optional */ }
          return '';
        }
        function formatMwSeasonLabel(seasonStr) {
          if (typeof window.formatLiturgicalSeasonLabel === 'function') {
            return window.formatLiturgicalSeasonLabel(seasonStr);
          }
          var raw = String(seasonStr || '').split(',')[0].trim();
          if (!raw) return 'Ordinary Time';
          return raw.charAt(0).toUpperCase() + raw.slice(1);
        }
        function formatMwYearLabel(cycle) {
          if (typeof window.formatLectionaryYearLabel === 'function') {
            return window.formatLectionaryYearLabel(cycle);
          }
          var c = String(cycle || '').trim();
          if (!c) return '—';
          if (/^year\s/i.test(c)) return c;
          return 'Year ' + c;
        }
        function setMwMassContextState(state) {
          var root = $('mw-mass-context');
          if (!root) return;
          var skeleton = $('mw-mass-context-skeleton');
          var idle = $('mw-mass-context-idle');
          var body = $('mw-mass-context-body');
          root.setAttribute('data-state', state || 'idle');
          if (skeleton) skeleton.hidden = state !== 'loading';
          if (idle) idle.hidden = state !== 'idle';
          if (body) body.hidden = state !== 'ready';
          root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
        }
        function fillMwMassContext() {
          var root = $('mw-mass-context');
          if (!root) return;
          var idleText = root.querySelector('.mw-mass-context__idle-text');
          var dateEl = $('mass-date');
          var dateVal = dateEl && dateEl.value ? String(dateEl.value).trim() : '';
          if (!dateVal) {
            if (idleText) idleText.textContent = 'Pick a date to see the parish and liturgical day for this Mass.';
            setMwMassContextState('idle');
            return;
          }
          var pd = window.__mwPreviewData || null;
          var previewDate = pd && pd.__previewDate ? String(pd.__previewDate) : '';
          var wantLang = (typeof window.currentMassLanguage === 'function')
            ? window.currentMassLanguage()
            : (function () {
                var sel = $('flow-mass-language');
                return sel && sel.value === 'tagalog' ? 'tagalog' : 'english';
              })();
          var gotLang = (typeof window.readingsLanguageOf === 'function')
            ? window.readingsLanguageOf(pd)
            : '';
          if (pd && previewDate === dateVal && gotLang && gotLang !== wantLang) {
            setMwMassContextState('loading');
            var reloadKey = dateVal + ':' + wantLang;
            if (root.dataset.mwLangReload !== reloadKey && typeof window.reloadFlowReadingsForLanguage === 'function') {
              root.dataset.mwLangReload = reloadKey;
              window.reloadFlowReadingsForLanguage(dateVal, wantLang);
            }
            return;
          }
          if (root.dataset) root.dataset.mwLangReload = '';
          var matched = !!(pd && previewDate && previewDate === dateVal && (pd.season || pd.title || pd.lectionary_cycle));
          if (!matched) {
            var busy = $('btn-load-flow') && $('btn-load-flow').disabled;
            if (busy || root.getAttribute('data-state') === 'loading') {
              setMwMassContextState('loading');
              return;
            }
            if (idleText) idleText.textContent = 'Liturgical details for this date aren’t available yet. They’ll appear when readings load.';
            setMwMassContextState('idle');
            return;
          }
          var parishEl = $('mw-mass-context-parish');
          var parish = parishNameForContext();
          if (parishEl) {
            if (parish) {
              parishEl.hidden = false;
              parishEl.textContent = parish;
            } else {
              parishEl.hidden = true;
              parishEl.textContent = '';
            }
          }
          var titleEl = $('mw-mass-context-title');
          var seasonEl = $('mw-mass-context-season');
          var yearEl = $('mw-mass-context-year');
          var colorEl = $('mw-mass-context-color');
          var swatch = $('mw-mass-context-swatch');
          var rootEl = $('mw-mass-context');
          var gospelEl = $('mw-mass-context-gospel');
          var seasonLabel = formatMwSeasonLabel(pd.season || '');
          var yearLabel = formatMwYearLabel(pd.lectionary_cycle || '');
          var dayTitle = String(pd.title || '').trim() || seasonLabel;
          if (titleEl) titleEl.textContent = dayTitle;
          if (seasonEl) seasonEl.textContent = seasonLabel;
          if (yearEl) yearEl.textContent = yearLabel;
          var lc = pd.liturgical_color || null;
          var hex = lc && lc.hex ? String(lc.hex).trim() : '';
          var colorName = lc && lc.color_name ? String(lc.color_name).trim() : '';
          var railColor = hex || 'var(--liturgical-ordinary, #2e7d4f)';
          if (rootEl) rootEl.style.setProperty('--mw-mass-rail', railColor);
          if (swatch) swatch.style.background = railColor;
          if (colorEl) {
            if (colorName) {
              colorEl.hidden = false;
              colorEl.textContent = colorName;
            } else {
              colorEl.hidden = true;
              colorEl.textContent = '';
            }
          }
          var gospelRef = '';
          var gr = $('flow-gospel-ref');
          if (gr && gr.textContent && gr.textContent.trim() && gr.textContent.trim() !== '—') {
            gospelRef = gr.textContent.trim();
          } else if (pd.gospel_reference) {
            gospelRef = String(pd.gospel_reference).trim();
          }
          if (gospelEl) {
            if (gospelRef) {
              gospelEl.hidden = false;
              gospelEl.textContent = 'Gospel · ' + gospelRef;
            } else {
              gospelEl.hidden = true;
              gospelEl.textContent = '';
            }
          }
          setMwMassContextState('ready');
        }
        function beginMwMassContextLoading() {
          var dateEl = $('mass-date');
          if (dateEl && dateEl.value) setMwMassContextState('loading');
          else setMwMassContextState('idle');
        }
        function readingsLoaded() {
          var ref = $('flow-gospel-ref');
          return !!(ref && ref.textContent && ref.textContent.trim() && ref.textContent.trim() !== '—');
        }
        function ensureReadings() {
          var date = $('mass-date');
          if (!date || !date.value) return;
          if (!readingsLoaded()) { var b = $('btn-load-flow'); if (b) b.click(); }
        }
        function reviewSection(title, stepLabel, rowsHtml, opts) {
          opts = opts || {};
          var step = parseInt(opts.step, 10) || 0;
          var cls = 'mw-review-section' + (opts.multi ? ' mw-review-section--multi' : '');
          var attrs = '';
          if (step >= 1 && step <= 6) {
            attrs = ' role="button" tabindex="0" data-mw-review-go="' + step + '" aria-label="Edit ' + title + ', ' + stepLabel + '"';
          }
          var editHint = (step >= 1 && step <= 6) ? '<span class="mw-review-section__edit" aria-hidden="true">Edit</span>' : '';
          return '<section class="' + cls + '"' + attrs + '>' +
            '<header class="mw-review-section__head"><h3>' + title + '</h3>' + editHint + '<span>' + stepLabel + '</span></header>' +
            '<dl class="mw-review-rows mw-aside__list">' + rowsHtml + '</dl></section>';
        }
        function bindReviewSummaryNavigation() {
          var host = $('mw-review-summary');
          if (!host || host.dataset.mwReviewNavBound === '1') return;
          host.dataset.mwReviewNavBound = '1';
          function goReviewStep(card) {
            var s = parseInt(card.getAttribute('data-mw-review-go'), 10);
            if (s >= 1 && s <= 6) showStep(s);
          }
          host.addEventListener('click', function (e) {
            var card = e.target.closest('[data-mw-review-go]');
            if (!card || !host.contains(card)) return;
            goReviewStep(card);
          });
          host.addEventListener('keydown', function (e) {
            var card = e.target.closest('[data-mw-review-go]');
            if (!card || !host.contains(card)) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goReviewStep(card);
            }
          });
        }
        function fillWizardReviewSummary() {
          var host = $('mw-review-summary');
          if (!host) return;
          var sections = [];
          var d = $('mass-date');
          var cd = $('celebrant-display');
          var cname = (cd && cd.textContent && cd.textContent.trim() && cd.textContent.indexOf('Select') < 0) ? cd.textContent.trim() : '—';
          var co = $('co-celebrant');
          var s1 = asideRow('Date', fmtAsideDate(d && d.value), 'mass_date');
          s1 += asideRow('Celebrant', cname, 'celebrant');
          if (co && co.value.trim()) s1 += asideRow('Co-celebrant', co.value.trim());
          s1 += asideRow('Mass language', selText('flow-mass-language'));
          var pd = window.__mwPreviewData || null;
          if (pd && pd.season) s1 += asideRow('Season', pd.season);
          sections.push(reviewSection('Mass info', 'Step 1', s1, { step: 1 }));
          var s2 = asideRow('Penitential Act', (function () {
            var form = selText('flow-penitential-choice') || '—';
            var lang = selText('flow-penitential-language');
            return lang ? (form + ' · ' + lang) : form;
          })(), 'penitential');
          s2 += asideRow('Kyrie', riteVideoAsideLabel('kyrie', 'flow-kyrie-choice') || '—', 'kyrie');
          s2 += asideRow('Gloria', riteVideoAsideLabel('gloria', 'flow-gloria-choice') || '—', 'gloria');
          sections.push(reviewSection('Introductory rites', 'Step 2', s2, { step: 2 }));
          var psalm = $('flow-psalm-custom');
          var psalmVal = (psalm && psalm.value.trim()) ? psalm.value.trim() : selText('flow-psalm-refrain');
          var gospel = $('flow-gospel-custom');
          var gospelVal = (gospel && gospel.value.trim()) ? gospel.value.trim() : selText('flow-gospel-sentence');
          var s3 = asideRow('Readings', readingsLoaded() ? 'Loaded' : 'Not loaded', 'readings');
          s3 += asideRow('Psalm', psalmVal || '—');
          s3 += asideRow('Gospel line', gospelVal || '—');
          var gr = $('flow-gospel-ref');
          if (gr && gr.textContent && gr.textContent.trim() !== '—') s3 += asideRow('Gospel ref', gr.textContent.trim());
          sections.push(reviewSection('Liturgy of the Word', 'Step 3', s3, { step: 3 }));
          var s4 = asideRow('Creed', (function () {
            var form = selText('flow-creed-choice') || '—';
            var lang = selText('flow-creed-language');
            if (!form || form === '—') return form;
            if (String(($('flow-creed-choice') || {}).value || '') === 'none') return form;
            return lang ? (form + ' · ' + lang) : form;
          })(), 'creed');
          s4 += asideRow('Sanctus', (function () {
            var tune = sanctusLabel() || '—';
            var lang = selText('flow-sanctus-language');
            return lang ? (tune + ' · ' + lang) : tune;
          })(), 'sanctus');
          s4 += asideRow('Our Father', riteVideoAsideLabel('our_father', 'flow-our-father-choice') || '—', 'our_father');
          s4 += asideRow('Lamb of God', riteVideoAsideLabel('lamb_of_god', 'flow-lamb-choice') || '—', 'lamb_of_god');
          sections.push(reviewSection('Liturgy of the Eucharist', 'Step 4', s4, { step: 4 }));
          var songRows = '';
          if (typeof buildMassGenerateReceiptModel === 'function') {
            try {
              var model = buildMassGenerateReceiptModel();
              (model.songs || []).forEach(function (song) {
                if (!song.id) return;
                var sectionLabel = (typeof receiptSlotShortLabel === 'function' ? receiptSlotShortLabel(song) : '') || song.label || 'Song';
                sectionLabel = String(sectionLabel).replace(/\s+song\b/gi, '').trim() || 'Song';
                songRows += asideSongRow(sectionLabel, song.title || song.id || '—', 'song:' + song.slotKey);
              });
            } catch (e) { /* optional */ }
          }
          if (!songRows) {
            var sc = $('flow-song-count'), st = $('mass-summary-song-total');
            songRows = asideRow('Songs', (sc ? sc.textContent : '0') + ' / ' + (st ? st.textContent : '5') + ' selected');
          }
          var hymnLayout = document.querySelector('input[name="flow-hymn-layout"]:checked');
          if (hymnLayout) songRows += asideSongRow('Hymn layout', hymnLayout.value === 'single' ? '1 verse / slide' : '2 verses / slide');
          sections.push(reviewSection('Music ministry', 'Step 5', songRows, { multi: true, step: 5 }));
          var themeName = $('mw-deck-theme-name');
          var s6 = asideSongRow('Slide theme', themeName ? themeName.textContent.trim() : selText('flow-deck-theme'));
          var styleEl = $('flow-openai-poster-style');
          var styleLabel = styleEl ? (selText('flow-openai-poster-style') || styleEl.value || 'Cinematic') : 'Cinematic';
          s6 += asideRow('Divider poster style', styleLabel);
          var collOn = $('flow-slide-mass-collection') && $('flow-slide-mass-collection').checked;
          var amt = $('flow-collection-amount');
          var cur = $('flow-collection-currency');
          var coll = collOn ? ((amt && amt.value.trim()) ? ((cur && cur.value) ? (cur.value + ' ' + amt.value.trim()) : amt.value.trim()) : 'Included') : 'Off';
          s6 += asideRow('Collection slide', coll);
          var annFlags = [];
          if ($('flow-slide-welcoming-newcomers') && $('flow-slide-welcoming-newcomers').checked) annFlags.push('Newcomers');
          if ($('flow-slide-food-sponsor') && $('flow-slide-food-sponsor').checked) annFlags.push('Food sponsor');
          if ($('flow-slide-sponsorship-contact') && $('flow-slide-sponsorship-contact').checked) annFlags.push('Sponsorship contact');
          if ($('flow-slide-merienda-location') && $('flow-slide-merienda-location').checked) annFlags.push('Merienda');
          var customSlides = (typeof getFlowCustomSlidesPayload === 'function') ? getFlowCustomSlidesPayload() : [];
          if (customSlides.length) annFlags.push(customSlides.length + ' custom');
          var ann = $('flow-announcement-posters'); var nann = (ann && ann.files) ? ann.files.length : 0;
          s6 += asideRow('Announcement slides', annFlags.length ? annFlags.join(', ') : (nann ? (nann + ' upload' + (nann > 1 ? 's' : '')) : 'None'));
          sections.push(reviewSection('Additional details', 'Step 6', s6, { multi: true, step: 6 }));
          var slides = '—';
          if (window.__mwPreviewData && window.__mwPreviewData.estimated_slide_count) slides = window.__mwPreviewData.estimated_slide_count;
          var slideCountHost = $('mw-review-slide-count');
          var slideCountVal = $('mw-review-slide-count-value');
          if (slideCountVal) slideCountVal.textContent = String(slides);
          if (slideCountHost) slideCountHost.hidden = false;
          host.innerHTML = sections.join('');
        }
        function fillReceipt() { fillWizardReviewSummary(); }
        function fmtAsideDate(iso) {
          if (!iso) return '—';
          try {
            var d = new Date(iso + 'T12:00:00');
            return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          } catch (e) { return iso; }
        }
        function selText(id) {
          var s = $(id);
          if (!s || !s.value) return '';
          var o = s.options[s.selectedIndex];
          return (o && o.textContent) ? o.textContent.trim() : s.value;
        }
        function riteVideoAsideLabel(section, selectId) {
          var languageLabel = selText(selectId);
          if (section === 'kyrie' && $(selectId) && $(selectId).value === 'tagalog') {
            var slideSel = $('flow-kyrie-tagalog-slide');
            var slideLabel = slideSel ? selText('flow-kyrie-tagalog-slide') : '';
            languageLabel = slideLabel ? ('Tagalog · ' + slideLabel) : 'Tagalog';
          }
          if (!(window.massRiteVideoMode && window.massRiteVideoMode[section])) return languageLabel || '';
          var lang = (window.massRiteVideoLang && window.massRiteVideoLang[section]) || '';
          var label = '';
          if (lang) {
            var s = $(selectId);
            if (s) {
              Array.prototype.some.call(s.options, function (o) {
                if (String(o.value).toLowerCase() === String(lang).toLowerCase()) {
                  label = (o.textContent || '').trim();
                  return true;
                }
                return false;
              });
            }
            if (!label) label = lang;
          }
          if (!label) label = languageLabel || '';
          return label ? ('Video · ' + label) : 'Video';
        }
        function sanctusLabel() {
          if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) {
            return 'Video · Holy, Holy, Holy';
          }
          var c = flowPage.querySelector('.mw-options[aria-label="Sanctus tune"] .mw-option[aria-checked="true"]:not([data-val="__video"]) .mw-option__label');
          return c ? c.textContent.trim() : '';
        }
        function asideRow(label, val, reviewId) {
          var attr = reviewId ? ' data-mw-review-item="' + reviewId + '"' : '';
          return '<div class="mw-aside__row"' + attr + '><dt>' + label + '</dt><dd>' + (val || '—') + '</dd></div>';
        }
        function asideSongRow(label, val, reviewId) {
          var attr = reviewId ? ' data-mw-review-item="' + reviewId + '"' : '';
          return '<div class="mw-aside__row mw-aside__row--song"' + attr + '><dt>' + label + '</dt><dd>' + (val || '—') + '</dd></div>';
        }
        function fillAside(n) {
          var aside = $('mw-aside');
          var list = $('mw-aside-list');
          var illus = $('mw-aside-illus');
          var canvas = document.querySelector('#mw-wizard .mw-step-canvas');
          var wiz = $('mw-wizard');
          var show = !!ASIDE_STEPS[n];
          if (aside) {
            aside.hidden = !show;
            aside.setAttribute('data-step', String(n));
          }
          if (canvas) canvas.classList.toggle('has-aside', show);
          if (wiz) wiz.classList.toggle('has-aside', show);
          if (!show || !list) return;
          var rows = [];
          var pd = window.__mwPreviewData || null;
          if (n === 1) {
            var d = $('mass-date');
            rows.push(asideRow('Date', fmtAsideDate(d && d.value)));
            var cd = $('celebrant-display');
            var cname = (cd && cd.textContent && cd.textContent.indexOf('Select') < 0) ? cd.textContent.trim() : '';
            rows.push(asideRow('Celebrant', cname));
            var co = $('co-celebrant');
            if (co && co.value.trim()) rows.push(asideRow('Co-celebrant', co.value.trim()));
            rows.push(asideRow('Mass language', selText('flow-mass-language')));
            if (pd && pd.season) rows.push(asideRow('Season', pd.season));
            var gr = $('flow-gospel-ref');
            if (gr && gr.textContent && gr.textContent.trim() !== '—') rows.push(asideRow('Gospel', gr.textContent.trim()));
          } else if (n === 2) {
            rows.push(asideRow('Penitential Act', (function () {
              var form = selText('flow-penitential-choice') || '—';
              var lang = selText('flow-penitential-language');
              return lang ? (form + ' · ' + lang) : form;
            })()));
            rows.push(asideRow('Kyrie', riteVideoAsideLabel('kyrie', 'flow-kyrie-choice')));
            rows.push(asideRow('Gloria', riteVideoAsideLabel('gloria', 'flow-gloria-choice')));
          } else if (n === 4) {
            rows.push(asideRow('Creed', (function () {
              var form = selText('flow-creed-choice') || '—';
              var lang = selText('flow-creed-language');
              if (String(($('flow-creed-choice') || {}).value || '') === 'none') return form;
              return lang ? (form + ' · ' + lang) : form;
            })()));
            rows.push(asideRow('Sanctus', (function () {
              var tune = sanctusLabel() || '—';
              var lang = selText('flow-sanctus-language');
              return lang ? (tune + ' · ' + lang) : tune;
            })()));
            rows.push(asideRow('Our Father', riteVideoAsideLabel('our_father', 'flow-our-father-choice')));
            rows.push(asideRow('Lamb of God', riteVideoAsideLabel('lamb_of_god', 'flow-lamb-choice')));
          } else if (n === 6) {
            rows.push(asideRow('Mass date', fmtAsideDate($('mass-date') && $('mass-date').value)));
            var cdate = $('flow-collection-date');
            rows.push(asideRow('Collection date', fmtAsideDate(cdate && cdate.value)));
            var amt = $('flow-collection-amount');
            var cur = $('flow-collection-currency');
            var coll = (amt && amt.value.trim()) ? ((cur && cur.value) ? (cur.value + ' ' + amt.value.trim()) : amt.value.trim()) : '';
            rows.push(asideRow('Collection', coll || 'Not set'));
          }
          list.innerHTML = rows.join('');
          var legend = $('mw-aside-legend');
          if (legend) {
            legend.hidden = n !== 2 && n !== 4;
            if (n === 2 || n === 4) legend.textContent = riteSlideAsideHint(n);
          }
          var sponsorsWrap = $('mw-aside-sponsors');
          if (sponsorsWrap) sponsorsWrap.hidden = n !== 6;
          if (n === 6 && typeof window.syncFoodSponsorsListHost === 'function') window.syncFoodSponsorsListHost();
          if (illus && ASIDE_ART[n]) {
            illus.style.backgroundImage = 'linear-gradient(180deg, color-mix(in srgb, var(--surface-solid) 8%, transparent), color-mix(in srgb, var(--surface-solid) 82%, transparent)), url("' + ASIDE_ART[n] + '")';
          }
        }
        function showStep(n) {
          current = n;
          clearMissingTargetHighlight();
          setPanels(n);
          Array.prototype.forEach.call(flowPage.querySelectorAll('[data-mw-step]'), function (el) {
            el.hidden = (parseInt(el.getAttribute('data-mw-step'), 10) !== n);
          });
          progItems.forEach(function (it) {
            var s = parseInt(it.getAttribute('data-mw-go'), 10);
            it.classList.toggle('is-active', s === n);
            it.classList.toggle('is-done', s < n);
          });
          var meta = STEP_META[n] || { title: '', sub: '' };
          if ($('mw-eyebrow')) $('mw-eyebrow').textContent = 'Step ' + n + ' of 7';
          if ($('mw-title')) $('mw-title').textContent = meta.title;
          if ($('mw-sub')) {
            $('mw-sub').textContent = meta.sub || '';
            $('mw-sub').hidden = !meta.sub;
          }
          if ($('mw-back')) setMwNavBtnVisible($('mw-back'), n !== 1);
          if ($('mw-next')) $('mw-next').hidden = n === 7;
          if ($('mw-generate')) $('mw-generate').hidden = n !== 7;
          var practiceShareNav = $('btn-practice-share-wizard');
          if (practiceShareNav) setMwNavBtnVisible(practiceShareNav, n === 5);
          var practiceShareTitle = $('btn-practice-share-wizard-title');
          if (practiceShareTitle) practiceShareTitle.hidden = n !== 5;
          var offlineLeafletBtn = $('btn-mw-offline-leaflet');
          if (offlineLeafletBtn) offlineLeafletBtn.hidden = n !== 7;
          if (typeof window.syncMassPresentAgainUi === 'function') window.syncMassPresentAgainUi();
          else if ($('mw-present')) setMwNavBtnVisible($('mw-present'), !!window.__massPresentAvailable);
          var slideCountHost = $('mw-review-slide-count');
          if (slideCountHost) slideCountHost.hidden = n !== 7;
          if (n === 3) { ensureReadings(); }
          if (n === 5 && typeof window.refreshMassMusicSongPlan === "function") {
            window.refreshMassMusicSongPlan({ force: true }).catch(function () {});
          }
          if (n === 6 && typeof window.ensureCollectionDefaultDate === "function") {
            window.ensureCollectionDefaultDate();
          }
          if (n === 6 && typeof window.refreshWeeklyStylePosters === "function") {
            window.refreshWeeklyStylePosters();
          }
          if (n === 7) { fillReceipt(); }
          if (n === 2 || n === 4) scheduleRiteDefaultPinLabelHide(flowPage);
          fillAside(n);
          fillMwMassContext();
          var canvas = document.querySelector('#mw-wizard .mw-step-canvas');
          var wiz = $('mw-wizard');
          if (canvas) {
            canvas.classList.toggle('is-basics-step', n === 1);
            canvas.classList.toggle('is-readings-step', n === 3);
            canvas.classList.toggle('is-extras-step', n === 6);
            canvas.classList.toggle('is-music-step', n === 5);
            canvas.classList.toggle('is-review-step', n === 7);
          }
          if (wiz) {
            wiz.classList.toggle('is-basics-step', n === 1);
            wiz.classList.toggle('is-readings-step', n === 3);
            wiz.classList.toggle('is-extras-step', n === 6);
            wiz.classList.toggle('is-music-step', n === 5);
            wiz.classList.toggle('is-review-step', n === 7);
          }
          restartAnim(n === 5 ? $('flow-panel-songs') : $('flow-panel-setup'));
          refreshContinue();
          var w = $('mw-wizard'); if (w && w.scrollIntoView) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
        }
        function validStep1() {
          var d = $('mass-date');
          if (!(d && d.value)) { if (d && d.focus) d.focus(); return false; }
          var cel = $('celebrant');
          if (!(cel && cel.value && cel.value.trim())) {
            var display = $('celebrant-display');
            if (display && display.focus) display.focus();
            return false;
          }
          return true;
        }
        function shake(el) {
          if (!el) return; var i = 0; var seq = [-4, 4, -3, 3, 0];
          (function s() { if (i >= seq.length) { el.style.transform = ''; return; } el.style.transform = 'translateX(' + seq[i++] + 'px)'; setTimeout(s, 55); })();
        }
        function collectStepMissingOptions(step) {
          var n = parseInt(step, 10) || current;
          return collectMassMissingOptions().filter(function (item) {
            return item.step === n;
          });
        }
        function highlightStepMissing(missing) {
          clearMissingTargetHighlight();
          if (!missing || !missing.length) return null;
          var firstTarget = null;
          missing.forEach(function (item) {
            var target = resolveMissingTarget(item);
            if (!target) return;
            target.classList.add('mw-missing-target');
            if (!firstTarget) firstTarget = target;
          });
          return firstTarget;
        }
        function pruneMissingTargetHighlights() {
          var still = collectStepMissingOptions(current);
          var keep = [];
          still.forEach(function (item) {
            var target = resolveMissingTarget(item);
            if (target && keep.indexOf(target) < 0) keep.push(target);
          });
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-missing-target'), function (el) {
            if (keep.indexOf(el) < 0) el.classList.remove('mw-missing-target');
          });
        }
        function next() {
          var missing = collectStepMissingOptions(current);
          if (missing.length) {
            shake($('mw-next'));
            var target = highlightStepMissing(missing);
            if (target) mwReveal(target);
            return;
          }
          if (current === 1) ensureReadings();
          if (current < 7) showStep(current + 1);
        }
        function back() { if (current > 1) showStep(current - 1); }
        function openPreview(title, text, opts) {
          var m = $('mw-preview-modal'); if (!m) return;
          opts = opts || {};
          if ($('mw-preview-title')) $('mw-preview-title').textContent = title;
          var vid = $('mw-preview-video');
          if (vid) {
            try { vid.pause(); } catch (e0) {}
            if (opts.videoUrl) {
              vid.hidden = false;
              vid.removeAttribute('hidden');
              if (vid.src !== opts.videoUrl) {
                vid.src = opts.videoUrl;
                try { vid.load(); } catch (eLoad) {}
              }
              var playVid = vid.play();
              if (playVid && playVid.catch) {
                playVid.catch(function () {
                  /* Autoplay may be blocked after async fetch; controls still work. */
                });
              }
            } else {
              vid.hidden = true;
              vid.removeAttribute('src');
              try { vid.load(); } catch (e1) {}
            }
          }
          if ($('mw-preview-text')) {
            $('mw-preview-text').textContent = text || '';
            $('mw-preview-text').hidden = !!(opts.videoUrl && !text);
          }
          var hint = $('mw-preview-audio-hint');
          if (hint) hint.hidden = !opts.audioPlaying;
          m.setAttribute('data-open', 'true'); m.setAttribute('aria-hidden', 'false');
        }
        function closePreview() {
          var m = $('mw-preview-modal'); if (!m) return;
          m.setAttribute('data-open', 'false'); m.setAttribute('aria-hidden', 'true');
          var hint = $('mw-preview-audio-hint');
          if (hint) hint.hidden = true;
          var vid = $('mw-preview-video');
          if (vid) {
            try { vid.pause(); } catch (e0) {}
            vid.hidden = true;
            vid.removeAttribute('src');
            try { vid.load(); } catch (e1) {}
          }
        }
        function preferredMassLanguageOption() {
          var massLang = $('flow-mass-language');
          var lang = massLang && massLang.value === 'tagalog' ? 'tagalog' : 'english';
          return lang;
        }
        function isLanguageRiteSelect(sel) {
          if (!sel) return false;
          var section = sel.getAttribute('data-mw-media-section') || '';
          return section === 'kyrie' || section === 'gloria' || section === 'our_father' || section === 'lamb_of_god';
        }
        function reorderSelectLanguageOptions(sel, preferred) {
          if (!sel || !preferred || !isLanguageRiteSelect(sel)) return false;
          var match = null;
          Array.prototype.forEach.call(sel.options, function (o) {
            if (!match && o.value === preferred && !o.disabled) match = o;
          });
          if (!match) return false;
          if (sel.options[0] === match) return true;
          var current = sel.value;
          sel.insertBefore(match, sel.options[0] || null);
          if (current) sel.value = current;
          return true;
        }
        function reorderMwLanguageCards(sel, preferred) {
          if (!sel || !preferred) return false;
          var rite = sel.closest('.mw-rite');
          var langMenu = rite && rite.querySelector('.mw-rite-lang__menu, .mw-rite-lang .mw-kyrie-dd__menu');
          if (langMenu) {
            var langItem = langMenu.querySelector('[data-val="' + preferred + '"]');
            if (!langItem) return false;
            if (langMenu.firstElementChild === langItem) return true;
            langMenu.insertBefore(langItem, langMenu.firstElementChild);
            return true;
          }
          var wrap = sel.nextElementSibling;
          if (!wrap || !wrap.classList || !wrap.classList.contains('mw-options')) return false;
          var card = wrap.querySelector('.mw-option[data-val="' + preferred + '"]');
          if (!card) return false;
          var move = card.closest('.mw-option-line') || card;
          if (wrap.firstElementChild === move) return true;
          wrap.insertBefore(move, wrap.firstElementChild);
          return true;
        }
        function applyMassLanguageOptionOrder(preferredLang) {
          var preferred = preferredLang || preferredMassLanguageOption();
          Array.prototype.forEach.call(flowPage.querySelectorAll('select[data-mw-tunes]'), function (sel) {
            if (!isLanguageRiteSelect(sel)) return;
            if (!reorderSelectLanguageOptions(sel, preferred)) return;
            reorderMwLanguageCards(sel, preferred);
          });
          if (typeof window.syncRiteOptionsCollapse === 'function') window.syncRiteOptionsCollapse();
          if (typeof window.syncMassDefaultPins === 'function') window.syncMassDefaultPins();
        }
        window.applyMassLanguageOptionOrder = applyMassLanguageOptionOrder;
        function escapeAttr(s) {
          return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }
        function riteDefaultPinHtml(pinKey, pinVal) {
          return '<input type="checkbox" class="mw-default-pin__input" data-mw-default-key="' + escapeAttr(pinKey) + '" data-mw-default-value="' + escapeAttr(pinVal) + '" />' +
            '<span class="mw-default-pin__mark" aria-hidden="true"></span>' +
            '<span class="mw-default-pin__text">Default</span>';
        }
        function riteLabelLinkHtml(mediaKey) {
          return '<span class="mw-option__label-wrap mw-media-dd mw-media-dd--link">' +
            '<button type="button" class="mw-option__label mw-media-dd__btn" data-mw-media-dd-btn="link" data-mw-media-slot="' + escapeAttr(mediaKey) + '"></button>' +
            '<div class="mw-media-dd__menu mw-media-dd__menu--link" hidden role="menu">' +
              '<button type="button" class="mw-media-dd__item" role="menuitem" data-mw-link-media="audio" data-mw-media-slot="' + escapeAttr(mediaKey) + '">Link audio</button>' +
              '<button type="button" class="mw-media-dd__item" role="menuitem" data-mw-link-media="video" data-mw-media-slot="' + escapeAttr(mediaKey) + '">Link video</button>' +
            '</div>' +
          '</span>';
        }
        function ritePreviewEyeHtml() {
          return '<svg class="mw-rite-preview__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>' +
            '<circle cx="12" cy="12" r="3"/>' +
          '</svg>';
        }
        function ritePreviewHtml(mediaKey, opts) {
          opts = opts || {};
          var key = escapeAttr(mediaKey || '');
          if (opts.directText) {
            return (
              '<button type="button" class="mw-rite-preview__action mw-rite-preview__action--direct" ' +
                'data-mw-text-preview data-mw-media-key="' + key + '">See text</button>'
            );
          }
          var withAudio = opts.audio !== false;
          var actions =
            '<button type="button" class="mw-rite-preview__action" data-mw-text-preview data-mw-media-key="' + key + '">See text</button>';
          if (withAudio) {
            actions +=
              '<button type="button" class="mw-rite-preview__action" data-mw-play-audio data-mw-media-slot="' + key + '">Play sound</button>';
          }
          return (
            '<div class="mw-rite-preview" data-mw-rite-preview>' +
              '<div class="mw-rite-preview__detail" aria-hidden="true">' +
                '<span class="mw-rite-preview__actions">' + actions + '</span>' +
              '</div>' +
              '<button type="button" class="mw-rite-preview__btn" data-mw-rite-preview-btn aria-expanded="false" aria-label="Preview" title="Preview">' +
                ritePreviewEyeHtml() +
              '</button>' +
            '</div>'
          );
        }
        function riteAudioPlayHtml(mediaKey) {
          return ritePreviewHtml(mediaKey, { audio: true });
        }
        function closeAllRitePreviews(except) {
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-rite-preview.is-open'), function (host) {
            if (except && host === except) return;
            if (host._mwPreviewHideTimer) {
              clearTimeout(host._mwPreviewHideTimer);
              host._mwPreviewHideTimer = 0;
            }
            host.classList.remove('is-open');
            var btn = host.querySelector('[data-mw-rite-preview-btn]');
            var detail = host.querySelector('.mw-rite-preview__detail');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (detail) detail.setAttribute('aria-hidden', 'true');
          });
        }
        var MW_RITE_PREVIEW_HIDE_MS = 4200;
        function scheduleRitePreviewAutoHide(host) {
          if (!host) return;
          if (host._mwPreviewHideTimer) clearTimeout(host._mwPreviewHideTimer);
          host._mwPreviewHideTimer = setTimeout(function () {
            host._mwPreviewHideTimer = 0;
            setRitePreviewOpen(host, false);
          }, MW_RITE_PREVIEW_HIDE_MS);
        }
        function setRitePreviewOpen(host, open) {
          if (!host) return;
          if (open) {
            closeAllRitePreviews(host);
            closeAllRiteLangDd();
            closeAllRiteSettings();
            closeAllMediaDd();
            setKyrieTagalogMenuOpen(false);
          } else if (host._mwPreviewHideTimer) {
            clearTimeout(host._mwPreviewHideTimer);
            host._mwPreviewHideTimer = 0;
          }
          host.classList.toggle('is-open', !!open);
          var btn = host.querySelector('[data-mw-rite-preview-btn]');
          var detail = host.querySelector('.mw-rite-preview__detail');
          if (btn) btn.setAttribute('aria-expanded', String(!!open));
          if (detail) detail.setAttribute('aria-hidden', String(!open));
          if (open) scheduleRitePreviewAutoHide(host);
        }
        var mwFloatingMenus = [];
        function mwMenuHome(menu) {
          if (menu && !menu._mwHome) {
            menu._mwHome = { parent: menu.parentNode, next: menu.nextSibling };
          }
          return menu && menu._mwHome;
        }
        function mwPlaceFloatingMenu(menu, trigger) {
          if (!menu || !trigger) return;
          var r = trigger.getBoundingClientRect();
          var menuW = menu.offsetWidth || 160;
          var left = r.left;
          if (left + menuW > window.innerWidth - 8) left = Math.max(8, r.right - menuW);
          menu.style.position = 'fixed';
          menu.style.top = Math.round(r.bottom + 4) + 'px';
          menu.style.left = Math.round(left) + 'px';
          menu.style.right = 'auto';
          menu.style.zIndex = '5000';
        }
        function mwFloatMenu(menu, trigger) {
          if (!menu || !trigger) return;
          mwMenuHome(menu);
          var host = trigger.closest('.mw-media-dd, .mw-kyrie-dd, .mw-rite-lang, .mw-rite-settings');
          if (host) host._mwFloatedMenu = menu;
          if (menu.parentNode !== document.body) document.body.appendChild(menu);
          menu.hidden = false;
          mwPlaceFloatingMenu(menu, trigger);
          menu._mwTrigger = trigger;
          if (mwFloatingMenus.indexOf(menu) === -1) mwFloatingMenus.push(menu);
        }
        function mwRestoreMenu(menu) {
          if (!menu) return;
          var home = menu._mwHome;
          menu.hidden = true;
          menu.style.position = '';
          menu.style.top = '';
          menu.style.left = '';
          menu.style.right = '';
          menu.style.zIndex = '';
          menu._mwTrigger = null;
          if (home && home.parent && menu.parentNode !== home.parent) {
            if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(menu, home.next);
            else home.parent.appendChild(menu);
          }
          var i = mwFloatingMenus.indexOf(menu);
          if (i !== -1) mwFloatingMenus.splice(i, 1);
        }
        function mwRepositionFloatingMenus() {
          mwFloatingMenus.forEach(function (menu) {
            if (menu._mwTrigger && !menu.hidden) mwPlaceFloatingMenu(menu, menu._mwTrigger);
          });
        }
        if (document.documentElement.dataset.mwFloatMenuDoc !== '1') {
          document.documentElement.dataset.mwFloatMenuDoc = '1';
          window.addEventListener('resize', mwRepositionFloatingMenus);
          window.addEventListener('scroll', mwRepositionFloatingMenus, true);
        }
        function closeAllMediaDd(except) {
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-media-dd.is-open'), function (dd) {
            if (except && dd === except) return;
            dd.classList.remove('is-open');
            var btn = dd.querySelector('[data-mw-media-dd-btn]');
            var menu = dd.querySelector('.mw-media-dd__menu') || dd._mwFloatedMenu;
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (menu) mwRestoreMenu(menu);
          });
        }
        function closeAllRiteLangDd(except) {
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-rite-lang.is-open'), function (dd) {
            if (except && dd === except) return;
            dd.classList.remove('is-open');
            var btn = dd.querySelector('.mw-rite-lang__btn');
            var menu = dd.querySelector('.mw-rite-lang__menu') || dd._mwFloatedMenu;
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (menu) mwRestoreMenu(menu);
          });
        }
        function setRiteLangOpen(dd, open) {
          if (!dd) return;
          if (open) {
            closeAllRiteLangDd(dd);
            closeAllRiteSettings();
            closeAllMediaDd();
            closeAllRitePreviews();
            setKyrieTagalogMenuOpen(false);
          }
          dd.classList.toggle('is-open', !!open);
          var btn = dd.querySelector('.mw-rite-lang__btn');
          var menu = dd.querySelector('.mw-rite-lang__menu') || dd._mwFloatedMenu;
          if (btn) btn.setAttribute('aria-expanded', String(!!open));
          if (menu) {
            if (open) mwFloatMenu(menu, btn);
            else mwRestoreMenu(menu);
          }
        }
        function setMediaDdOpen(dd, open) {
          if (!dd) return;
          if (open) {
            closeAllMediaDd(dd);
            setKyrieTagalogMenuOpen(false);
            closeAllRiteLangDd();
            closeAllRiteSettings();
            closeAllRitePreviews();
          }
          dd.classList.toggle('is-open', !!open);
          var btn = dd.querySelector('[data-mw-media-dd-btn]');
          var menu = dd.querySelector('.mw-media-dd__menu') || dd._mwFloatedMenu;
          if (btn) btn.setAttribute('aria-expanded', String(!!open));
          if (menu) {
            if (open) mwFloatMenu(menu, btn);
            else mwRestoreMenu(menu);
          }
        }
        function bindMediaDropdowns(scope) {
          Array.prototype.forEach.call((scope || flowPage).querySelectorAll('.mw-media-dd'), function (dd) {
            if (dd.dataset.mwDdBound === '1') return;
            dd.dataset.mwDdBound = '1';
            var btn = dd.querySelector('[data-mw-media-dd-btn]');
            if (!btn) return;
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              setMediaDdOpen(dd, !dd.classList.contains('is-open'));
            });
            Array.prototype.forEach.call(dd.querySelectorAll('[data-mw-link-media]'), function (item) {
              if (item.dataset.mwDdItemBound === '1') return;
              item.dataset.mwDdItemBound = '1';
              item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeAllMediaDd();
                var kind = item.getAttribute('data-mw-link-media');
                var slot = item.getAttribute('data-mw-media-slot');
                if (kind && slot && typeof window.openMassMediaPickModal === 'function') {
                  window.openMassMediaPickModal(kind, slot, { fromTitle: true });
                }
              });
            });
          });
        }
        function riteSlideAsideHint(n) {
          var secs = n === 2 ? ['kyrie', 'gloria'] : (n === 4 ? ['sanctus', 'our_father', 'lamb_of_god'] : []);
          var useVideo = secs.some(function (sec) {
            return !!(window.massRiteVideoMode && window.massRiteVideoMode[sec]);
          });
          return useVideo
            ? 'PowerPoint: video slide replaces lyrics.'
            : 'PowerPoint: lyric slides. Audio is preview only.';
        }
        function scheduleRiteDefaultPinLabelHide(scope) {
          Array.prototype.forEach.call((scope || flowPage).querySelectorAll('.mw-default-pin--rite'), function (pin) {
            pin.classList.remove('is-label-hidden');
            if (pin._mwLabelHide) window.clearTimeout(pin._mwLabelHide);
            pin._mwLabelHide = window.setTimeout(function () {
              pin.classList.add('is-label-hidden');
            }, 2800);
          });
        }
        function kyrieTagalogSlideValue() {
          var slideSel = $('flow-kyrie-tagalog-slide');
          return slideSel && slideSel.value === '2' ? '2' : '1';
        }
        function kyrieTagalogSlideLabel(value) {
          return value === '2' ? 'Spoken' : 'Sung';
        }
        function setKyrieTagalogMenuOpen(open) {
          var dd = $('mw-kyrie-tagalog-dd');
          var btn = $('mw-kyrie-tagalog-dd-btn');
          var menu = $('mw-kyrie-tagalog-dd-menu');
          if (!dd || !btn || !menu) return;
          if (open) {
            closeAllMediaDd();
            closeAllRiteLangDd();
            closeAllRiteSettings();
          }
          dd.classList.toggle('is-open', !!open);
          btn.setAttribute('aria-expanded', String(!!open));
          if (open) mwFloatMenu(menu, btn);
          else mwRestoreMenu(menu);
        }
        function setKyrieTagalogSlide(value) {
          var slideSel = $('flow-kyrie-tagalog-slide');
          var next = value === '2' ? '2' : '1';
          if (slideSel && slideSel.value !== next) {
            slideSel.value = next;
            slideSel.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
          refreshKyrieTagalogPanel();
        }
        function refreshKyrieTagalogPanel() {
          var kyrieSel = $('flow-kyrie-choice');
          var panel = $('mw-kyrie-tagalog');
          var slideSel = $('flow-kyrie-tagalog-slide');
          var valueEl = $('mw-kyrie-tagalog-dd-value');
          var isTagalog = !!(kyrieSel && kyrieSel.value === 'tagalog');
          if (panel) panel.hidden = !isTagalog;
          if (!isTagalog) {
            setKyrieTagalogMenuOpen(false);
            return;
          }
          var slide = kyrieTagalogSlideValue();
          if (slideSel && slideSel.value !== slide) slideSel.value = slide;
          if (valueEl) valueEl.textContent = kyrieTagalogSlideLabel(slide);
          Array.prototype.forEach.call((panel && panel.querySelectorAll('[data-mw-kyrie-slide]')) || [], function (opt) {
            opt.setAttribute('aria-selected', String(opt.getAttribute('data-mw-kyrie-slide') === slide));
          });
        }
        function ensureKyrieTagalogPanel() {
          var kyrieSel = $('flow-kyrie-choice');
          var panel = $('mw-kyrie-tagalog');
          var slideSel = $('flow-kyrie-tagalog-slide');
          var ddBtn = $('mw-kyrie-tagalog-dd-btn');
          if (!kyrieSel || !panel) return;
          var rite = kyrieSel.closest('.mw-rite');
          var active = rite && rite.querySelector('[data-mw-rite-active="kyrie"]');
          var wrap = kyrieSel.nextElementSibling;
          var tagalogCard = wrap && wrap.classList && wrap.classList.contains('mw-options')
            ? wrap.querySelector('.mw-option[data-val="tagalog"]')
            : null;
          var row = (active && active.querySelector(':scope > .mw-option > .mw-option__row'))
            || (tagalogCard && tagalogCard.querySelector(':scope > .mw-option__row'));
          var label = row && (row.querySelector('.mw-option__label-wrap') || row.querySelector('.mw-option__label'));
          if (label) label.insertAdjacentElement('afterend', panel);
          else if (row && panel.parentElement !== row) row.appendChild(panel);
          else if (active && panel.parentElement !== active) active.appendChild(panel);
          else if (tagalogCard && panel.parentElement !== tagalogCard) tagalogCard.appendChild(panel);
          if (row) {
            var preview = row.querySelector(':scope > .mw-rite-preview');
            if (preview) row.appendChild(preview);
          }
          if (kyrieSel.dataset.mwKyrieTagalogBound !== '1') {
            kyrieSel.dataset.mwKyrieTagalogBound = '1';
            kyrieSel.addEventListener('change', refreshKyrieTagalogPanel);
          }
          if (panel && panel.dataset.mwKyrieTagalogPanelBound !== '1') {
            panel.dataset.mwKyrieTagalogPanelBound = '1';
            panel.addEventListener('click', function (e) { e.stopPropagation(); });
            panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
          }
          if (slideSel && slideSel.dataset.mwKyrieTagalogBound !== '1') {
            slideSel.dataset.mwKyrieTagalogBound = '1';
            slideSel.addEventListener('change', function (e) {
              e.stopPropagation();
              refreshKyrieTagalogPanel();
              if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
            });
          }
          if (ddBtn && ddBtn.dataset.mwKyrieTagalogBound !== '1') {
            ddBtn.dataset.mwKyrieTagalogBound = '1';
            ddBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              e.preventDefault();
              var menu = $('mw-kyrie-tagalog-dd-menu');
              setKyrieTagalogMenuOpen(!!(menu && menu.hidden));
            });
          }
          Array.prototype.forEach.call(panel.querySelectorAll('[data-mw-kyrie-slide]'), function (opt) {
            if (opt.dataset.mwKyrieChipBound === '1') return;
            opt.dataset.mwKyrieChipBound = '1';
            opt.addEventListener('click', function (e) {
              if (e.target.closest('[data-mw-text-preview]')) return;
              e.stopPropagation();
              setKyrieTagalogSlide(opt.getAttribute('data-mw-kyrie-slide'));
              setKyrieTagalogMenuOpen(false);
            });
          });
          Array.prototype.forEach.call(panel.querySelectorAll('[data-mw-text-preview]'), function (btn) {
            if (btn.dataset.mwTextBound === '1') return;
            btn.dataset.mwTextBound = '1';
            btn.addEventListener('click', function (e) {
              e.stopPropagation();
              e.preventDefault();
              var key = btn.getAttribute('data-mw-media-key');
              var slide = key && key.indexOf('tagalog-2') !== -1 ? '2' : '1';
              setKyrieTagalogSlide(slide);
              if (key && typeof window.openMassRiteTextPreview === 'function') window.openMassRiteTextPreview(key);
            });
            btn.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                btn.click();
              }
            });
          });
          if (document.documentElement.dataset.mwKyrieDdDoc !== '1') {
            document.documentElement.dataset.mwKyrieDdDoc = '1';
            document.addEventListener('click', function (e) {
              if (e.target.closest('#mw-kyrie-tagalog-dd, #mw-kyrie-tagalog-dd-menu')) return;
              setKyrieTagalogMenuOpen(false);
              if (!e.target.closest('.mw-media-dd, .mw-media-dd__menu')) closeAllMediaDd();
              if (!e.target.closest('.mw-rite-lang, .mw-rite-lang__menu')) closeAllRiteLangDd();
              if (!e.target.closest('.mw-rite-settings, .mw-rite-settings__pop')) closeAllRiteSettings();
            });
            document.addEventListener('keydown', function (e) {
              if (e.key === 'Escape') {
                setKyrieTagalogMenuOpen(false);
                closeAllMediaDd();
                closeAllRiteLangDd();
                closeAllRiteSettings();
              }
            });
          }
          refreshKyrieTagalogPanel();
        }
        function riteSettingsGearHtml() {
          /* Lucide "settings" — https://lucide.dev/icons/settings */
          return '<svg class="mw-rite-settings__icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
            '<circle cx="12" cy="12" r="3"/>' +
          '</svg>';
        }
        function placeRiteSettingsBesideVideo(root) {
          var scope = root || flowPage;
          if (!scope || !scope.querySelectorAll) return;
          Array.prototype.forEach.call(
            scope.querySelectorAll('.mw-option__media[data-mw-rite-media="1"], .mw-option .mw-rite-settings'),
            function (el) {
              var option = el.closest('.mw-option');
              if (!option) return;
              var media = option.querySelector('.mw-option__media[data-mw-rite-media="1"], .mw-option__media.mass-song-media-row');
              var settings = option.querySelector('.mw-rite-settings');
              if (!media && !settings) return;
              var row = option.querySelector(':scope > .mw-option__row');
              if (!row) return;
              var bar = row.querySelector(':scope > .mw-rite-media-bar');
              if (!bar) {
                bar = document.createElement('div');
                bar.className = 'mw-rite-media-bar';
                var preview = row.querySelector(':scope > .mw-rite-preview');
                if (preview) row.insertBefore(bar, preview);
                else row.appendChild(bar);
              }
              if (media && media.parentElement !== bar) bar.appendChild(media);
              if (settings && settings.parentElement !== bar) bar.appendChild(settings);
            }
          );
        }
        window.placeRiteSettingsBesideVideo = placeRiteSettingsBesideVideo;
        function closeAllRiteSettings(except) {
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-rite-settings.is-open'), function (host) {
            if (except && host === except) return;
            host.classList.remove('is-open');
            var btn = host.querySelector('.mw-rite-settings__btn');
            var pop = host.querySelector('.mw-rite-settings__pop');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (pop) pop.hidden = true;
          });
        }
        function setRiteSettingsOpen(host, open) {
          if (!host) return;
          if (open) {
            closeAllRiteSettings(host);
            closeAllRiteLangDd();
            closeAllMediaDd();
            closeAllRitePreviews();
            setKyrieTagalogMenuOpen(false);
          }
          host.classList.toggle('is-open', !!open);
          var btn = host.querySelector('.mw-rite-settings__btn');
          var pop = host.querySelector('.mw-rite-settings__pop');
          if (btn) btn.setAttribute('aria-expanded', String(!!open));
          if (pop) pop.hidden = !open;
        }
        function attachInlineOptionLanguages() {
          Array.prototype.forEach.call(flowPage.querySelectorAll('select[data-mw-rite-lang]'), function (sel) {
            if (sel.dataset.mwRiteLangUi === '1') return;
            sel.dataset.mwRiteLangUi = '1';
            var section = sel.getAttribute('data-mw-rite-lang') || '';
            if (!section) return;
            var opts = Array.prototype.slice.call(sel.options).filter(function (o) {
              return o.value && !o.disabled;
            });
            if (!opts.length) return;

            var langDd = document.createElement('div');
            langDd.className = 'mw-rite-lang mw-rite-lang--inline mw-kyrie-dd';
            langDd.setAttribute('data-mw-rite-lang-ui', section);
            langDd.hidden = true;
            var menuId = 'mw-rite-inline-lang-menu-' + section;
            langDd.innerHTML =
              '<button type="button" class="mw-rite-lang__btn mw-kyrie-dd__btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + menuId + '">' +
                '<span class="mw-rite-lang__value"></span>' +
              '</button>' +
              '<div class="mw-rite-lang__menu mw-kyrie-dd__menu" id="' + menuId + '" hidden role="listbox" aria-label="Language"></div>';
            var langBtn = langDd.querySelector('.mw-rite-lang__btn');
            var langValue = langDd.querySelector('.mw-rite-lang__value');
            var langMenu = langDd.querySelector('.mw-rite-lang__menu');

            opts.forEach(function (o) {
              var item = document.createElement('button');
              item.type = 'button';
              item.className = 'mw-rite-lang__option mw-kyrie-dd__option';
              item.setAttribute('role', 'option');
              item.setAttribute('data-val', o.value);
              item.setAttribute('aria-selected', 'false');
              item.innerHTML = '<span class="mw-kyrie-dd__name"></span>';
              item.querySelector('.mw-kyrie-dd__name').textContent = o.textContent;
              item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                sel.value = item.getAttribute('data-val') || 'english';
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                syncLabel();
                setRiteLangOpen(langDd, false);
                if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') {
                  window.scheduleMassBuilderDraftAutoSave();
                }
                if (typeof refreshContinue === 'function') refreshContinue();
                if (typeof fillAside === 'function') fillAside(current);
              });
              langMenu.appendChild(item);
            });

            function optionLabel(val) {
              var found = '';
              Array.prototype.some.call(sel.options, function (o) {
                if (o.value === val) { found = (o.textContent || '').trim(); return true; }
                return false;
              });
              return found || val || 'English';
            }

            function syncLabel() {
              var val = sel.value || 'english';
              langValue.textContent = optionLabel(val);
              langDd.classList.add('is-chosen');
              Array.prototype.forEach.call(langMenu.querySelectorAll('[data-val]'), function (item) {
                item.setAttribute('aria-selected', String(item.getAttribute('data-val') === val));
              });
            }

            function findOptionsHost() {
              var rite = sel.closest('.mw-rite');
              if (!rite) return null;
              if (section === 'sanctus') {
                return rite.querySelector('.mw-options[aria-label="Sanctus tune"]')
                  || rite.querySelector('.mw-options[data-mw-media-section="sanctus"]');
              }
              return rite.querySelector('.mw-options[data-mw-media-section="' + section + '"]')
                || rite.querySelector('.mw-options[role="radiogroup"]');
            }

            function placeOnSelected() {
              setRiteLangOpen(langDd, false);
              var host = findOptionsHost();
              if (!host) {
                langDd.hidden = true;
                if (sel.parentElement && langDd.parentElement !== sel.parentElement) {
                  sel.parentElement.appendChild(langDd);
                }
                return;
              }
              var selected = host.querySelector(
                '.mw-option[aria-checked="true"]:not(.mw-option--omit):not([data-val="none"]):not([data-val="__video"])'
              );
              if (!selected) {
                langDd.hidden = true;
                host.appendChild(langDd);
                return;
              }
              var row = selected.querySelector('.mw-option__row');
              var label = selected.querySelector('.mw-option__label');
              var labelWrap = selected.querySelector('.mw-option__label-wrap');
              langDd.hidden = false;
              if (labelWrap) {
                if (label && label.parentElement === labelWrap) {
                  label.insertAdjacentElement('afterend', langDd);
                } else {
                  var btn = labelWrap.querySelector('.mw-option__label, [data-mw-media-dd-btn]');
                  if (btn) btn.insertAdjacentElement('afterend', langDd);
                  else labelWrap.appendChild(langDd);
                }
              } else if (label) {
                label.insertAdjacentElement('afterend', langDd);
              } else if (row) {
                row.appendChild(langDd);
              } else {
                selected.appendChild(langDd);
              }
            }

            langBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              setRiteLangOpen(langDd, !langDd.classList.contains('is-open'));
            });
            sel.addEventListener('change', syncLabel);
            sel._mwPlaceInlineLang = placeOnSelected;
            if (sel.parentElement) sel.parentElement.appendChild(langDd);
            syncLabel();
            placeOnSelected();
          });
        }
        function syncInlineOptionLanguages(scope) {
          var root = scope || flowPage;
          Array.prototype.forEach.call(root.querySelectorAll('select[data-mw-rite-lang]'), function (sel) {
            if (typeof sel._mwPlaceInlineLang === 'function') sel._mwPlaceInlineLang();
          });
        }
        function syncVariantRiteLanguagesFromMass(lang) {
          var preferred = lang === 'tagalog' ? 'tagalog' : 'english';
          Array.prototype.forEach.call(flowPage.querySelectorAll('select[data-mw-rite-lang]'), function (sel) {
            var has = Array.prototype.some.call(sel.options, function (o) {
              return o.value === preferred && !o.disabled;
            });
            if (!has) return;
            if (sel.value === preferred) {
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
            sel.value = preferred;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          });
          syncInlineOptionLanguages();
        }
        function buildLanguageRiteUi(sel, section) {
          var rite = sel.closest('.mw-rite');
          var opts = Array.prototype.slice.call(sel.options).filter(function (o) { return o.value && !o.disabled; });
          if (!rite || !opts.length) return;
          rite.classList.add('mw-rite--lang');
          sel.selectedIndex = -1;
          sel.style.display = 'none';

          var langMenu = document.createElement('div');
          langMenu.className = 'mw-rite-lang__menu mw-kyrie-dd__menu';
          langMenu.id = 'mw-rite-lang-menu-' + section;
          langMenu.hidden = true;
          langMenu.setAttribute('role', 'listbox');
          langMenu.setAttribute('aria-label', 'Language');
          opts.forEach(function (o) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'mw-rite-lang__option mw-kyrie-dd__option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-val', o.value);
            item.setAttribute('aria-selected', 'false');
            item.innerHTML = '<span class="mw-kyrie-dd__name"></span>';
            item.querySelector('.mw-kyrie-dd__name').textContent = o.textContent;
            item.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              pickLang(item.getAttribute('data-val') || '');
            });
            langMenu.appendChild(item);
          });

          var line = document.createElement('div');
          line.className = 'mw-option-line';
          var active = document.createElement('div');
          active.className = 'mw-rite-active';
          active.setAttribute('data-mw-rite-active', section);
          line.appendChild(active);

          var pinKey = sel.id || ('flow-' + section.replace(/_/g, '-') + '-choice');
          var pin = document.createElement('label');
          pin.className = 'mw-default-pin mw-default-pin--rite mw-default-pin--lang';
          pin.title = 'Use this choice as my default next time';
          pin.setAttribute('aria-label', 'Default');
          pin.innerHTML = riteDefaultPinHtml(pinKey, '');
          pin.addEventListener('click', function (e) { e.stopPropagation(); });
          line.appendChild(pin);
          var pinInput = pin.querySelector('.mw-default-pin__input');
          sel.insertAdjacentElement('afterend', line);

          function optionLabel(val) {
            var found = '';
            Array.prototype.some.call(sel.options, function (o) {
              if (o.value === val) { found = (o.textContent || '').trim(); return true; }
              return false;
            });
            return found || val;
          }

          function parkOverlays() {
            if (langMenu.parentElement && langMenu.parentElement !== sel.parentElement) {
              sel.parentElement.appendChild(langMenu);
              langMenu.hidden = true;
            }
            if (section === 'kyrie') {
              var kyriePanel = $('mw-kyrie-tagalog');
              if (kyriePanel && active.contains(kyriePanel) && sel.parentElement) {
                sel.parentElement.appendChild(kyriePanel);
              }
            }
          }

          function bindLangTrigger(wrap) {
            if (!wrap) return;
            var btn = wrap.querySelector('.mw-rite-lang__btn');
            if (!btn) return;
            wrap.appendChild(langMenu);
            btn.setAttribute('aria-controls', langMenu.id);
            btn.setAttribute('aria-expanded', 'false');
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              setRiteLangOpen(wrap, !wrap.classList.contains('is-open'));
            });
          }

          function bindSettings(host, mediaKey) {
            if (!host) return;
            var btn = host.querySelector('.mw-rite-settings__btn');
            var pop = host.querySelector('.mw-rite-settings__pop');
            if (!btn || !pop) return;
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              setRiteSettingsOpen(host, !host.classList.contains('is-open'));
            });
            Array.prototype.forEach.call(pop.querySelectorAll('[data-mw-link-media]'), function (item) {
              item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeAllRiteSettings();
                var kind = item.getAttribute('data-mw-link-media');
                if (kind && mediaKey && typeof window.openMassMediaPickModal === 'function') {
                  window.openMassMediaPickModal(kind, mediaKey, { fromTitle: true });
                }
              });
            });
          }

          function syncLangMenu() {
            var val = sel.value || '';
            Array.prototype.forEach.call(langMenu.querySelectorAll('[data-val]'), function (item) {
              item.setAttribute('aria-selected', String(item.getAttribute('data-val') === val));
            });
            if (pinInput) pinInput.setAttribute('data-mw-default-value', val);
          }

          function renderActive() {
            var val = sel.value || '';
            closeAllRiteLangDd();
            closeAllRiteSettings();
            parkOverlays();
            syncLangMenu();

            if (val === 'none') {
              active.innerHTML =
                '<div class="mw-option mw-option--surface mw-option--omit" data-val="none" aria-checked="true">' +
                  '<div class="mw-option__row">' +
                    '<span class="mw-option__label-wrap mw-rite-lang mw-kyrie-dd is-chosen">' +
                      '<button type="button" class="mw-option__label mw-rite-lang__btn" aria-haspopup="listbox"></button>' +
                    '</span>' +
                  '</div>' +
                  '<p class="mw-rite-active__omit muted">Omitted from this Mass</p>' +
                '</div>';
              if (window.massRiteVideoMode) window.massRiteVideoMode[section] = false;
              var omitBtn = active.querySelector('.mw-rite-lang__btn');
              if (omitBtn) omitBtn.textContent = optionLabel('none');
              bindLangTrigger(active.querySelector('.mw-rite-lang'));
              if (section === 'kyrie') refreshKyrieTagalogPanel();
              if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
              if (typeof window.syncMassDefaultPins === 'function') window.syncMassDefaultPins(rite);
              return;
            }

            var mediaKey = val && typeof window.massMediaKey === 'function'
              ? window.massMediaKey(section, val)
              : (val ? (section + '::' + val) : '');
            var labelText = val ? optionLabel(val) : 'Choose language';
            var actions = val ? ritePreviewHtml(mediaKey, { audio: true }) : '';
            var mediaRow = val
              ? ('<div class="mw-option__media mass-song-media-row" data-mw-media-row="' + escapeAttr(mediaKey) +
                 '" data-mw-rite-media="1" data-mw-media-section="' + escapeAttr(section) +
                 '" data-mw-media-lang="' + escapeAttr(val) + '"></div>')
              : '';
            var settings = val
              ? ('<div class="mw-rite-settings">' +
                   '<button type="button" class="mw-rite-settings__btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Link audio or video" title="Link audio or video">' +
                     riteSettingsGearHtml() +
                   '</button>' +
                   '<div class="mw-rite-settings__pop" hidden role="dialog" aria-label="Link media">' +
                     '<p class="mw-rite-settings__title">Link media</p>' +
                     '<button type="button" class="mw-rite-settings__item" data-mw-link-media="audio" data-mw-media-slot="' + escapeAttr(mediaKey) + '">Link audio</button>' +
                     '<button type="button" class="mw-rite-settings__item" data-mw-link-media="video" data-mw-media-slot="' + escapeAttr(mediaKey) + '">Link video</button>' +
                   '</div>' +
                 '</div>')
              : '';

            active.innerHTML =
              '<div class="mw-option mw-option--surface' + (val ? '' : ' is-empty') + '" data-val="' + escapeAttr(val || '') + '"' +
                (mediaKey ? ' data-mw-media-key="' + escapeAttr(mediaKey) + '"' : '') +
                ' aria-checked="' + (val ? 'true' : 'false') + '">' +
                '<div class="mw-option__row">' +
                  '<span class="mw-option__label-wrap mw-rite-lang mw-kyrie-dd' + (val ? ' is-chosen' : '') + '">' +
                    '<button type="button" class="mw-option__label mw-rite-lang__btn" aria-haspopup="listbox"></button>' +
                  '</span>' +
                  (val
                    ? ('<div class="mw-rite-media-bar">' + mediaRow + settings + '</div>')
                    : '') +
                  actions +
                '</div>' +
              '</div>';

            var langBtn = active.querySelector('.mw-rite-lang__btn');
            if (langBtn) langBtn.textContent = labelText;
            bindLangTrigger(active.querySelector('.mw-rite-lang'));

            var textBtn = active.querySelector('[data-mw-text-preview]');
            if (textBtn && mediaKey) {
              textBtn.setAttribute('data-mw-media-key', mediaKey);
              textBtn.addEventListener('click', function (e) {
                e.stopPropagation(); e.preventDefault();
                if (typeof window.openMassRiteTextPreview === 'function') window.openMassRiteTextPreview(mediaKey);
              });
              textBtn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); textBtn.click(); }
              });
            }
            if (val) bindSettings(active.querySelector('.mw-rite-settings'), mediaKey);
            if (section === 'kyrie') ensureKyrieTagalogPanel();
            if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
            placeRiteSettingsBesideVideo(active);
            if (typeof window.syncMassDefaultPins === 'function') window.syncMassDefaultPins(rite);
          }

          function pickLang(val) {
            sel.value = val;
            if (val === 'none') {
              if (window.massRiteVideoMode) window.massRiteVideoMode[section] = false;
            } else if (window.massRiteVideoMode && window.massRiteVideoMode[section]) {
              if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
              window.massRiteVideoLang[section] = val;
            }
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            renderActive();
            mwAdvanceAfterPick(rite);
            if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
            if (typeof refreshContinue === 'function') refreshContinue();
          }

          sel.addEventListener('change', function () { renderActive(); });
          if (typeof window.registerRiteVideoSync === 'function') window.registerRiteVideoSync(section, renderActive);
          scheduleRiteDefaultPinLabelHide(pin);
          renderActive();
        }
        function buildGloriaChoiceUi(sel) {
          var section = 'gloria';
          var rite = sel.closest('.mw-rite');
          if (!rite) return;
          var langOpts = Array.prototype.slice.call(sel.options).filter(function (o) {
            return o.value && o.value !== 'none' && !o.disabled;
          });
          if (!langOpts.length) return;

          var wrap = document.createElement('div');
          wrap.className = 'mw-options';
          wrap.setAttribute('role', 'radiogroup');
          wrap.setAttribute('data-mw-media-section', section);

          var lastLang = (sel.value && sel.value !== 'none') ? sel.value : '';
          if (!lastLang || !langOpts.some(function (o) { return o.value === lastLang; })) {
            var preferred = preferredMassLanguageOption();
            lastLang = langOpts.some(function (o) { return o.value === preferred; })
              ? preferred
              : (langOpts[0].value || 'english');
          }

          function optionLabel(val) {
            var found = '';
            Array.prototype.some.call(sel.options, function (o) {
              if (o.value === val) { found = (o.textContent || '').trim(); return true; }
              return false;
            });
            return found || val;
          }

          var langDd = document.createElement('div');
          langDd.className = 'mw-rite-lang mw-rite-lang--inline mw-kyrie-dd';
          langDd.setAttribute('data-mw-rite-lang-ui', section);
          langDd.hidden = true;
          var menuId = 'mw-gloria-lang-menu';
          langDd.innerHTML =
            '<button type="button" class="mw-rite-lang__btn mw-kyrie-dd__btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + menuId + '">' +
              '<span class="mw-rite-lang__value"></span>' +
            '</button>' +
            '<div class="mw-rite-lang__menu mw-kyrie-dd__menu" id="' + menuId + '" hidden role="listbox" aria-label="Gloria language"></div>';
          var langBtn = langDd.querySelector('.mw-rite-lang__btn');
          var langValue = langDd.querySelector('.mw-rite-lang__value');
          var langMenu = langDd.querySelector('.mw-rite-lang__menu');

          langOpts.forEach(function (o) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'mw-rite-lang__option mw-kyrie-dd__option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-val', o.value);
            item.setAttribute('aria-selected', 'false');
            item.innerHTML = '<span class="mw-kyrie-dd__name"></span>';
            item.querySelector('.mw-kyrie-dd__name').textContent = o.textContent;
            item.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              pickLang(o.value);
              setRiteLangOpen(langDd, false);
            });
            langMenu.appendChild(item);
          });

          langBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setRiteLangOpen(langDd, !langDd.classList.contains('is-open'));
          });

          function mediaKeyFor(lang) {
            if (!lang || lang === 'none') return '';
            return typeof window.massMediaKey === 'function'
              ? window.massMediaKey(section, lang)
              : (section + '::' + lang);
          }

          var gloriaItem = document.createElement('div');
          gloriaItem.className = 'mw-option';
          gloriaItem.setAttribute('role', 'radio');
          gloriaItem.setAttribute('tabindex', '0');
          gloriaItem.setAttribute('data-val', '__gloria');
          gloriaItem.setAttribute('aria-checked', 'false');
          gloriaItem.innerHTML =
            '<div class="mw-option__row">' +
              '<span class="mw-option__check" aria-hidden="true"></span>' +
              '<span class="mw-option__label-wrap mw-option__label-wrap--choice">' +
                '<span class="mw-option__label">Gloria</span>' +
              '</span>' +
              '<div class="mw-rite-media-bar">' +
                '<div class="mw-option__media mass-song-media-row" data-mw-rite-media="1" data-mw-media-section="gloria"></div>' +
                '<div class="mw-rite-settings">' +
                  '<button type="button" class="mw-rite-settings__btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Link audio or video" title="Link audio or video">' +
                    riteSettingsGearHtml() +
                  '</button>' +
                  '<div class="mw-rite-settings__pop" hidden role="dialog" aria-label="Link media">' +
                    '<p class="mw-rite-settings__title">Link media</p>' +
                    '<button type="button" class="mw-rite-settings__item" data-mw-link-media="audio">Link audio</button>' +
                    '<button type="button" class="mw-rite-settings__item" data-mw-link-media="video">Link video</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              ritePreviewHtml('', { audio: true }) +
            '</div>';

          var gloriaLine = document.createElement('div');
          gloriaLine.className = 'mw-option-line';
          gloriaLine.appendChild(gloriaItem);
          var gloriaPin = document.createElement('label');
          gloriaPin.className = 'mw-default-pin mw-default-pin--rite';
          gloriaPin.title = 'Use this choice as my default next time';
          gloriaPin.setAttribute('aria-label', 'Default');
          gloriaPin.innerHTML = riteDefaultPinHtml(sel.id || 'flow-gloria-choice', lastLang);
          gloriaPin.addEventListener('click', function (e) { e.stopPropagation(); });
          gloriaLine.appendChild(gloriaPin);
          wrap.appendChild(gloriaLine);

          var noneItem = document.createElement('div');
          noneItem.className = 'mw-option mw-option--omit';
          noneItem.setAttribute('role', 'radio');
          noneItem.setAttribute('tabindex', '0');
          noneItem.setAttribute('data-val', 'none');
          noneItem.setAttribute('aria-checked', 'false');
          noneItem.innerHTML =
            '<div class="mw-option__row">' +
              '<span class="mw-option__check" aria-hidden="true"></span>' +
              '<span class="mw-option__label-wrap mw-option__label-wrap--choice">' +
                '<span class="mw-option__label">No Gloria</span>' +
              '</span>' +
            '</div>';
          var noneLine = document.createElement('div');
          noneLine.className = 'mw-option-line';
          noneLine.appendChild(noneItem);
          var nonePin = document.createElement('label');
          nonePin.className = 'mw-default-pin mw-default-pin--rite';
          nonePin.title = 'Use this choice as my default next time';
          nonePin.setAttribute('aria-label', 'Default');
          nonePin.innerHTML = riteDefaultPinHtml(sel.id || 'flow-gloria-choice', 'none');
          nonePin.addEventListener('click', function (e) { e.stopPropagation(); });
          noneLine.appendChild(nonePin);
          wrap.appendChild(noneLine);

          var labelWrap = gloriaItem.querySelector('.mw-option__label-wrap--choice');
          var textBtn = gloriaItem.querySelector('[data-mw-text-preview]');
          var playBtn = gloriaItem.querySelector('[data-mw-play-audio]');
          var mediaRow = gloriaItem.querySelector('[data-mw-rite-media="1"]');
          var settingsHost = gloriaItem.querySelector('.mw-rite-settings');
          var gloriaPinInput = gloriaPin.querySelector('.mw-default-pin__input');

          function syncLangMenu(lang) {
            langValue.textContent = optionLabel(lang);
            langDd.classList.add('is-chosen');
            Array.prototype.forEach.call(langMenu.querySelectorAll('[data-val]'), function (item) {
              item.setAttribute('aria-selected', String(item.getAttribute('data-val') === lang));
            });
          }

          function syncMedia(lang) {
            var key = mediaKeyFor(lang);
            if (key) {
              gloriaItem.setAttribute('data-mw-media-key', key);
              if (mediaRow) {
                mediaRow.setAttribute('data-mw-media-row', key);
                mediaRow.setAttribute('data-mw-media-lang', lang);
              }
              if (textBtn) textBtn.setAttribute('data-mw-media-key', key);
              if (playBtn) playBtn.setAttribute('data-mw-media-slot', key);
              Array.prototype.forEach.call(settingsHost.querySelectorAll('[data-mw-link-media]'), function (btn) {
                btn.setAttribute('data-mw-media-slot', key);
              });
            } else {
              gloriaItem.removeAttribute('data-mw-media-key');
            }
          }

          function sync() {
            var val = sel.value || '';
            var isOmit = val === 'none';
            var isOn = !!val && !isOmit;
            if (isOn) lastLang = val;
            gloriaItem.setAttribute('aria-checked', String(isOn));
            noneItem.setAttribute('aria-checked', String(isOmit));
            setRiteLangOpen(langDd, false);
            closeAllRiteSettings();
            if (isOn) {
              langDd.hidden = false;
              if (labelWrap && langDd.parentElement !== labelWrap) {
                labelWrap.appendChild(langDd);
              }
              syncLangMenu(val);
              syncMedia(val);
              if (gloriaPinInput) gloriaPinInput.setAttribute('data-mw-default-value', val);
            } else {
              langDd.hidden = true;
              if (langDd.parentElement !== wrap) wrap.appendChild(langDd);
              syncMedia(lastLang);
              if (gloriaPinInput) gloriaPinInput.setAttribute('data-mw-default-value', lastLang);
            }
            if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
            placeRiteSettingsBesideVideo(gloriaItem);
            if (typeof window.syncRiteOptionsCollapse === 'function') window.syncRiteOptionsCollapse(rite);
            if (typeof window.syncMassDefaultPins === 'function') window.syncMassDefaultPins(wrap);
          }

          function pickLang(val) {
            sel.value = val;
            if (val === 'none') {
              if (window.massRiteVideoMode) window.massRiteVideoMode[section] = false;
            } else {
              lastLang = val;
              if (window.massRiteVideoMode && window.massRiteVideoMode[section]) {
                if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                window.massRiteVideoLang[section] = val;
              }
            }
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            sync();
            mwAdvanceAfterPick(wrap);
            if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') {
              window.scheduleMassBuilderDraftAutoSave();
            }
            if (typeof refreshContinue === 'function') refreshContinue();
          }

          gloriaItem.addEventListener('click', function (e) {
            if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-link-media], .mw-media-dd, .mw-rite-lang, .mw-rite-settings, .mw-rite-preview')) return;
            pickLang(lastLang || 'english');
          });
          gloriaItem.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pickLang(lastLang || 'english');
            }
          });
          noneItem.addEventListener('click', function () { pickLang('none'); });
          noneItem.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickLang('none'); }
          });

          if (textBtn) {
            textBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              e.preventDefault();
              var key = gloriaItem.getAttribute('data-mw-media-key') || mediaKeyFor(lastLang);
              if (key && typeof window.openMassRiteTextPreview === 'function') {
                window.openMassRiteTextPreview(key);
              }
            });
          }

          var settingsBtn = settingsHost.querySelector('.mw-rite-settings__btn');
          var settingsPop = settingsHost.querySelector('.mw-rite-settings__pop');
          if (settingsBtn && settingsPop) {
            settingsBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              setRiteSettingsOpen(settingsHost, !settingsHost.classList.contains('is-open'));
            });
            Array.prototype.forEach.call(settingsPop.querySelectorAll('[data-mw-link-media]'), function (item) {
              item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeAllRiteSettings();
                var kind = item.getAttribute('data-mw-link-media');
                var slot = item.getAttribute('data-mw-media-slot') || mediaKeyFor(lastLang);
                if (kind && slot && typeof window.openMassMediaPickModal === 'function') {
                  window.openMassMediaPickModal(kind, slot, { fromTitle: true });
                }
              });
            });
          }

          sel.selectedIndex = -1;
          sel.style.display = 'none';
          sel.insertAdjacentElement('afterend', wrap);
          sel.addEventListener('change', function () { sync(); });
          if (typeof window.registerRiteVideoSync === 'function') {
            window.registerRiteVideoSync(section, sync);
          }
          scheduleRiteDefaultPinLabelHide(wrap);
          sync();
        }
        function buildChoiceCards() {
          Array.prototype.forEach.call(flowPage.querySelectorAll('select[data-mw-tunes]'), function (sel) {
            if (sel.dataset.mwCards === '1') return; sel.dataset.mwCards = '1';
            var section = sel.getAttribute('data-mw-media-section') || '';
            var textOnly = section === 'penitential' || section === 'creed';
            var mediaRite = section === 'kyrie' || section === 'our_father' || section === 'lamb_of_god';
            if (section === 'gloria') {
              buildGloriaChoiceUi(sel);
              return;
            }
            if (mediaRite) {
              buildLanguageRiteUi(sel, section);
              return;
            }
            var wrap = document.createElement('div'); wrap.className = 'mw-options'; wrap.setAttribute('role', 'radiogroup');
            if (section) wrap.setAttribute('data-mw-media-section', section);
            var opts = Array.prototype.slice.call(sel.options).filter(function (o) { return o.value && !o.disabled; });
            sel.selectedIndex = -1;
            function sync() {
              closeAllRitePreviews();
              Array.prototype.forEach.call(wrap.querySelectorAll('.mw-option'), function (c) {
                var v = c.getAttribute('data-val');
                c.setAttribute('aria-checked', String(!!sel.value && sel.value === v));
              });
              syncInlineOptionLanguages(wrap.closest('.mw-rite') || wrap);
              if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
              if (typeof window.syncRiteOptionsCollapse === 'function') window.syncRiteOptionsCollapse(wrap.closest('.mw-rite') || wrap);
            }
            function pickLang(val) {
              sel.value = val;
              if (val === 'none' && window.massRiteVideoMode && section) {
                window.massRiteVideoMode[section] = false;
              } else if (val && window.massRiteVideoMode && window.massRiteVideoMode[section]) {
                if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                window.massRiteVideoLang[section] = val;
              }
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              sync();
              mwAdvanceAfterPick(wrap);
              if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
              if (typeof refreshContinue === 'function') refreshContinue();
            }
            opts.forEach(function (o) {
              var isOmit = o.value === 'none';
              var mediaKey = (!isOmit && section && typeof window.massMediaKey === 'function')
                ? window.massMediaKey(section, o.value)
                : ((!isOmit && section) ? (section + '::' + o.value) : '');
              var item = document.createElement('div'); item.className = 'mw-option' + (isOmit ? ' mw-option--omit' : '');
              item.setAttribute('role', 'radio'); item.setAttribute('tabindex', '0'); item.setAttribute('data-val', o.value);
              item.setAttribute('aria-checked', 'false');
              if (mediaKey) item.setAttribute('data-mw-media-key', mediaKey);
              var action = '';
              if (!isOmit && (textOnly || mediaKey)) {
                action = ritePreviewHtml(mediaKey, {
                  audio: !textOnly && !!mediaKey,
                  directText: textOnly
                });
              }
              var labelHtml = '<span class="mw-option__label-wrap mw-option__label-wrap--choice"><span class="mw-option__label"></span></span>';
              item.innerHTML =
                '<div class="mw-option__row">' +
                  '<span class="mw-option__check" aria-hidden="true"></span>' +
                  labelHtml +
                  action +
                '</div>';
              item.querySelector('.mw-option__label').textContent = o.textContent;
              var pinKey = sel.id || (section ? ('flow-' + section.replace(/_/g, '-') + '-choice') : '');
              var line = document.createElement('div');
              line.className = 'mw-option-line';
              line.appendChild(item);
              if (pinKey) {
                var pin = document.createElement('label');
                pin.className = 'mw-default-pin mw-default-pin--rite';
                pin.title = 'Use this choice as my default next time';
                pin.setAttribute('aria-label', 'Default');
                pin.innerHTML = riteDefaultPinHtml(pinKey, o.value);
                pin.addEventListener('click', function (e) { e.stopPropagation(); });
                line.appendChild(pin);
              }
              var textBtn = item.querySelector('[data-mw-text-preview]');
              if (textBtn && mediaKey) {
                textBtn.setAttribute('data-mw-media-key', mediaKey);
                textBtn.addEventListener('click', function (e) {
                  e.stopPropagation(); e.preventDefault();
                  if (typeof window.openMassRiteTextPreview === 'function') window.openMassRiteTextPreview(mediaKey);
                });
                textBtn.addEventListener('keydown', function (e) {
                  if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); textBtn.click(); }
                });
              }
              item.addEventListener('click', function (e) {
                if (e.target.closest('[data-mw-text-preview], .mw-media-dd, .mw-rite-lang, .mw-rite-preview')) return;
                pickLang(o.value);
              });
              item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickLang(o.value); } });
              wrap.appendChild(line);
            });
            scheduleRiteDefaultPinLabelHide(wrap);
            bindMediaDropdowns(wrap);
            sel.style.display = 'none';
            sel.insertAdjacentElement('afterend', wrap);
            sel.addEventListener('change', function () { sync(); });
            if (typeof window.registerRiteVideoSync === 'function' && section) {
              window.registerRiteVideoSync(section, sync);
            }
            sync();
            if (typeof window.syncMassDefaultPins === 'function') window.syncMassDefaultPins(wrap);
          });
        }
        function restartAnim(el) { if (!el) return; el.classList.remove('mw-step-anim'); void el.offsetWidth; el.classList.add('mw-step-anim'); }
        var mwPrefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        function mwReveal(el) {
          if (!el) return;
          try { el.scrollIntoView({ behavior: mwPrefersReduced ? 'auto' : 'smooth', block: 'center' }); }
          catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
          if (mwPrefersReduced) return;
          el.classList.remove('emil-stagger-enter');
          void el.offsetWidth;
          el.classList.add('emil-stagger-enter');
          var done = function () { el.classList.remove('emil-stagger-enter'); el.removeEventListener('animationend', done); };
          el.addEventListener('animationend', done);
        }
        function mwAdvanceAfterPick(fromEl) {
          if (!fromEl || !fromEl.closest) return;
          var rite = fromEl.closest('.mw-rite');
          if (rite) {
            var next = rite.nextElementSibling;
            while (next && (next.nodeType !== 1 || next.hidden || !next.classList.contains('mw-rite'))) next = next.nextElementSibling;
            if (next) { mwReveal(next); return; }
          }
          var nb = $('mw-next');
          if (nb && !nb.hidden) mwReveal(nb);
        }
        function selVal(id) { var s = $(id); return !!(s && s.value); }
        function sanctusPicked() {
          if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) return true;
          return !!flowPage.querySelector('.mw-options[aria-label="Sanctus tune"] .mw-option[aria-checked="true"]:not([data-val="__video"])');
        }
        function ensureSanctusVideoOption() {
          var wrap = flowPage.querySelector('.mw-options[aria-label="Sanctus tune"]');
          if (!wrap) return;
          /* Remove legacy separate Video option card if present */
          Array.prototype.forEach.call(wrap.querySelectorAll('.mw-option[data-val="__video"], .mw-option.mw-option--video'), function (card) {
            var dead = card.closest('.mw-option-line') || card;
            dead.remove();
          });
          var section = 'sanctus';
          var defaultOpt = wrap.querySelector('.mw-option[data-val="default"]');
          if (defaultOpt) {
            var mediaRow = defaultOpt.querySelector('[data-mw-rite-media="1"]');
            if (!mediaRow) {
              mediaRow = document.createElement('div');
              mediaRow.className = 'mw-option__media mass-song-media-row';
              mediaRow.setAttribute('data-mw-media-row', 'sanctus::default');
              mediaRow.setAttribute('data-mw-rite-media', '1');
              mediaRow.setAttribute('data-mw-media-section', 'sanctus');
              mediaRow.setAttribute('data-mw-media-lang', 'default');
              defaultOpt.appendChild(mediaRow);
            }
          }
          function sync() {
            var onVideo = !!(window.massRiteVideoMode && window.massRiteVideoMode.sanctus);
            var anyChecked = !!wrap.querySelector('.mw-option[aria-checked="true"]:not([data-val="__video"])');
            if (!anyChecked) {
              var pinned = '';
              try {
                var raw = localStorage.getItem('mass_builder_pinned_defaults');
                var map = raw ? JSON.parse(raw) : {};
                if (map && typeof map === 'object' && map.sanctus_tune) pinned = String(map.sanctus_tune || '').trim();
              } catch (ePin) { /* ignore */ }
              var pick = pinned || 'default';
              var target = wrap.querySelector('.mw-option[data-val="' + pick + '"]')
                || wrap.querySelector('.mw-option[data-val="default"]');
              if (target) {
                Array.prototype.forEach.call(wrap.querySelectorAll('.mw-option'), function (c) {
                  var v = c.getAttribute('data-val');
                  if (v === '__video') return;
                  c.setAttribute('aria-checked', String(c === target));
                });
                if (onVideo) {
                  if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                  window.massRiteVideoLang.sanctus = target.getAttribute('data-val') || 'default';
                }
              }
            }
            if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
            syncInlineOptionLanguages(wrap.closest('.mw-rite') || wrap);
            refreshContinue();
          }
          var sanctusLine = defaultOpt && defaultOpt.closest('.mw-option-line');
          if (defaultOpt && sanctusLine && !sanctusLine.querySelector('.mw-default-pin')) {
            var sanctusPin = document.createElement('label');
            sanctusPin.className = 'mw-default-pin mw-default-pin--rite';
            sanctusPin.title = 'Use this choice as my default next time';
            sanctusPin.setAttribute('aria-label', 'Default');
            sanctusPin.innerHTML = riteDefaultPinHtml('sanctus_tune', 'default');
            sanctusPin.addEventListener('click', function (e) { e.stopPropagation(); });
            sanctusLine.appendChild(sanctusPin);
            scheduleRiteDefaultPinLabelHide(sanctusLine);
          }
          if (defaultOpt && defaultOpt.dataset.mwSanctusLangBound !== '1') {
            defaultOpt.dataset.mwSanctusLangBound = '1';
            defaultOpt.addEventListener('click', function (e) {
              if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], .mw-media-dd, .mw-rite-lang, .mw-rite-preview')) return;
              Array.prototype.forEach.call(wrap.querySelectorAll('.mw-option'), function (c) {
                c.setAttribute('aria-checked', String(c.getAttribute('data-val') === 'default'));
              });
              if (window.massRiteVideoMode && window.massRiteVideoMode.sanctus) {
                if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                window.massRiteVideoLang.sanctus = 'default';
              }
              sync();
              mwAdvanceAfterPick(wrap);
              if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
            });
          }
          window.registerRiteVideoSync(section, sync);
          sync();
        }
        var lastMissingOptions = [];
        var missingGuideQueue = [];
        var missingGuideCurrent = null;
        var missingGuideActive = false;
        var missingGuideBound = false;
        function riteOptionOk(selectId, section) {
          if (selVal(selectId)) return true;
          return !!(section && window.massRiteVideoMode && window.massRiteVideoMode[section]);
        }
        function collectMassMissingSongOptions() {
          var out = [];
          try {
            if (typeof lyricSongSlots === 'undefined' || !lyricSongSlots || typeof selectedLyricsSongs === 'undefined') return out;
            lyricSongSlots.forEach(function (slot) {
              var id = String((selectedLyricsSongs[slot.key] || '')).trim();
              if (id) return;
              out.push({
                id: 'song:' + slot.key,
                label: slot.custom ? (((slot.label || '').trim()) || 'Custom section') : (slot.label || slot.key),
                step: 5,
                reviewId: 'song:' + slot.key,
                songSlot: slot.key
              });
            });
          } catch (e) { /* optional */ }
          return out;
        }
        function massPlanSlotLabel(slot) {
          return slot.custom ? (((slot.label || '').trim()) || 'Custom section') : (slot.label || slot.key);
        }
        function massPlanSongTitle(id) {
          var title = String(id || '').trim();
          if (!title) return title;
          try {
            if (typeof lookupMassPlanSong === 'function') {
              var row = lookupMassPlanSong(title);
              if (row && row.title) return String(row.title).trim() || title;
            }
          } catch (e) { /* optional */ }
          return title;
        }
        function collectMassDuplicateSongOptions() {
          var out = [];
          try {
            if (typeof lyricSongSlots === 'undefined' || !lyricSongSlots || typeof selectedLyricsSongs === 'undefined') return out;
            var byId = {};
            lyricSongSlots.forEach(function (slot) {
              var id = String((selectedLyricsSongs[slot.key] || '')).trim();
              if (!id) return;
              if (!byId[id]) byId[id] = [];
              byId[id].push(slot);
            });
            Object.keys(byId).forEach(function (id) {
              var slots = byId[id];
              if (slots.length < 2) return;
              var songTitle = massPlanSongTitle(id);
              slots.forEach(function (slot) {
                var others = slots.filter(function (s) { return s.key !== slot.key; }).map(massPlanSlotLabel);
                out.push({
                  id: 'dup-song:' + slot.key + ':' + id,
                  kind: 'duplicate',
                  label: massPlanSlotLabel(slot) + ' — same song as ' + others.join(' & ') + ' (“' + songTitle + '”)',
                  step: 5,
                  reviewId: 'song:' + slot.key,
                  songSlot: slot.key
                });
              });
            });
          } catch (e) { /* optional */ }
          return out;
        }
        function collectMassMissingOptions() {
          var missing = [];
          function add(item) { missing.push(item); }
          var d = $('mass-date');
          if (!(d && d.value)) {
            add({ id: 'mass_date', label: 'Mass date', step: 1, reviewId: 'mass_date', fieldId: 'mass-date' });
          }
          var cel = $('celebrant');
          if (!(cel && cel.value && cel.value.trim())) {
            add({ id: 'celebrant', label: 'Celebrant', step: 1, reviewId: 'celebrant', fieldId: 'celebrant-display' });
          }
          if (!selVal('flow-penitential-choice')) {
            add({ id: 'penitential', label: 'Penitential Act', step: 2, reviewId: 'penitential', selectId: 'flow-penitential-choice' });
          }
          if (!riteOptionOk('flow-kyrie-choice', 'kyrie')) {
            add({ id: 'kyrie', label: 'Kyrie', step: 2, reviewId: 'kyrie', selectId: 'flow-kyrie-choice', mediaSlot: 'kyrie' });
          }
          if (!riteOptionOk('flow-gloria-choice', 'gloria')) {
            add({ id: 'gloria', label: 'Gloria', step: 2, reviewId: 'gloria', selectId: 'flow-gloria-choice', mediaSlot: 'gloria' });
          }
          if (!readingsLoaded()) {
            add({ id: 'readings', label: 'Liturgical readings', step: 3, reviewId: 'readings', targetId: 'btn-load-flow' });
          }
          if (!selVal('flow-creed-choice')) {
            add({ id: 'creed', label: 'Creed', step: 4, reviewId: 'creed', selectId: 'flow-creed-choice' });
          }
          if (!sanctusPicked()) {
            add({ id: 'sanctus', label: 'Sanctus', step: 4, reviewId: 'sanctus', mediaSlot: 'sanctus' });
          }
          if (!riteOptionOk('flow-our-father-choice', 'our_father')) {
            add({ id: 'our_father', label: 'Our Father', step: 4, reviewId: 'our_father', selectId: 'flow-our-father-choice', mediaSlot: 'our_father' });
          }
          if (!riteOptionOk('flow-lamb-choice', 'lamb_of_god')) {
            add({ id: 'lamb_of_god', label: 'Lamb of God', step: 4, reviewId: 'lamb_of_god', selectId: 'flow-lamb-choice', mediaSlot: 'lamb_of_god' });
          }
          collectMassMissingSongOptions().forEach(function (song) { add(song); });
          collectMassDuplicateSongOptions().forEach(function (dup) { add(dup); });
          return missing;
        }
        function clearReviewMissingHighlights() {
          Array.prototype.forEach.call(document.querySelectorAll('#mw-review-summary .is-missing-highlight'), function (el) {
            el.classList.remove('is-missing-highlight');
          });
        }
        function highlightReviewMissing(missing) {
          clearReviewMissingHighlights();
          if (!missing || !missing.length) return;
          missing.forEach(function (item) {
            var row = document.querySelector('#mw-review-summary [data-mw-review-item="' + item.reviewId + '"]');
            if (row) row.classList.add('is-missing-highlight');
            var sec = document.querySelector('#mw-review-summary [data-mw-review-go="' + item.step + '"]');
            if (sec) sec.classList.add('is-missing-highlight');
          });
        }
        function clearMissingTargetHighlight() {
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-missing-target'), function (el) {
            el.classList.remove('mw-missing-target');
          });
        }
        function resolveMissingTarget(item) {
          if (!item) return null;
          if (item.songSlot) {
            return document.querySelector('.mass-song-plan-card[data-slot-key="' + item.songSlot + '"]');
          }
          if (item.targetId) {
            var btn = $(item.targetId);
            return btn ? (btn.closest('.field') || btn) : null;
          }
          if (item.mediaSlot) {
            var rite = flowPage.querySelector('[data-mw-media-slot="' + item.mediaSlot + '"]');
            if (rite) return rite;
          }
          if (item.selectId) {
            var sel = $(item.selectId);
            if (sel) return sel.closest('.mw-rite') || sel.closest('.field') || sel;
          }
          if (item.fieldId) {
            var fieldEl = $(item.fieldId);
            return fieldEl ? (fieldEl.closest('.field') || fieldEl) : null;
          }
          return null;
        }
        function focusMissingOption(item) {
          clearMissingTargetHighlight();
          missingGuideCurrent = item;
          showStep(item.step);
          setTimeout(function () {
            var target = resolveMissingTarget(item);
            if (target) {
              target.classList.add('mw-missing-target');
              mwReveal(target);
            }
          }, 140);
        }
        function focusNextMissingInGuide() {
          if (!missingGuideQueue.length) {
            endMissingOptionsGuide(true);
            return;
          }
          focusMissingOption(missingGuideQueue.shift());
        }
        function isMissingItem(item) {
          if (!item) return false;
          return collectMassMissingOptions().some(function (m) { return m.id === item.id; });
        }
        function onMissingGuideProgress() {
          if (!missingGuideActive || !missingGuideCurrent) return;
          if (!isMissingItem(missingGuideCurrent)) {
            missingGuideCurrent = null;
            clearMissingTargetHighlight();
            refreshContinue();
            if (current === 7) fillReceipt();
            if (missingGuideQueue.length) {
              setTimeout(focusNextMissingInGuide, 320);
            } else {
              endMissingOptionsGuide(true);
            }
          }
        }
        function bindMissingGuideWatcher() {
          if (missingGuideBound) return;
          missingGuideBound = true;
          flowPage.addEventListener('change', onMissingGuideProgress, true);
          flowPage.addEventListener('click', function () {
            setTimeout(onMissingGuideProgress, 0);
          }, true);
          document.addEventListener('mw:preview', onMissingGuideProgress);
        }
        function endMissingOptionsGuide(success) {
          missingGuideActive = false;
          missingGuideQueue = [];
          missingGuideCurrent = null;
          clearMissingTargetHighlight();
          if (success) {
            lastMissingOptions = [];
            clearReviewMissingHighlights();
            if (current !== 7) showStep(7);
            fillReceipt();
          }
          refreshContinue();
        }
        function closeMassMissingOptionsModal(opts) {
          opts = opts || {};
          var modal = $('mw-missing-options-modal');
          if (modal) {
            modal.setAttribute('data-open', 'false');
            modal.setAttribute('aria-hidden', 'true');
          }
          if (opts.highlightReview !== false && lastMissingOptions.length) {
            if (current !== 7) showStep(7);
            setTimeout(function () {
              fillReceipt();
              highlightReviewMissing(lastMissingOptions);
            }, 80);
          }
        }
        function openMassMissingOptionsModal(missing) {
          lastMissingOptions = (missing || []).slice();
          var modal = $('mw-missing-options-modal');
          var list = $('mw-missing-options-list');
          var titleEl = $('mw-missing-options-title');
          var descEl = $('mw-missing-options-desc');
          if (!modal || !list) return;
          var hasDup = lastMissingOptions.some(function (item) { return item.kind === 'duplicate'; });
          var hasMissing = lastMissingOptions.some(function (item) { return item.kind !== 'duplicate'; });
          if (titleEl && descEl) {
            if (hasDup && !hasMissing) {
              titleEl.textContent = 'Duplicate songs';
              descEl.textContent = 'Each song can only appear once in the Mass plan. Change or clear the duplicates below.';
            } else if (hasDup && hasMissing) {
              titleEl.textContent = 'Fix before generating';
              descEl.textContent = 'Complete missing selections and resolve duplicate songs below.';
            } else {
              titleEl.textContent = 'Unselected options';
              descEl.textContent = 'Please pick options before you proceed.';
            }
          }
          list.innerHTML = lastMissingOptions.map(function (item) {
            return '<li>' + item.label + '<span class="mw-missing-options-list__step">Step ' + item.step + '</span></li>';
          }).join('');
          modal.setAttribute('data-open', 'true');
          modal.setAttribute('aria-hidden', 'false');
          var fixBtn = $('mw-missing-options-fix');
          if (fixBtn) fixBtn.focus();
        }
        function startMissingOptionsGuide() {
          if (!lastMissingOptions.length) return;
          missingGuideActive = true;
          missingGuideQueue = lastMissingOptions.slice();
          missingGuideCurrent = null;
          closeMassMissingOptionsModal({ highlightReview: false });
          clearReviewMissingHighlights();
          bindMissingGuideWatcher();
          focusNextMissingInGuide();
        }
        function bindMassMissingOptionsModal() {
          var modal = $('mw-missing-options-modal');
          if (!modal || modal.dataset.mwMissingBound === '1') return;
          modal.dataset.mwMissingBound = '1';
          var closeBtn = $('mw-missing-options-close');
          var fixBtn = $('mw-missing-options-fix');
          if (closeBtn) closeBtn.addEventListener('click', function () { closeMassMissingOptionsModal(); });
          if (fixBtn) fixBtn.addEventListener('click', startMissingOptionsGuide);
          modal.addEventListener('click', function (e) {
            if (e.target === modal) closeMassMissingOptionsModal();
          });
          document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (modal.getAttribute('data-open') !== 'true') return;
            closeMassMissingOptionsModal();
          });
        }
        function validateBeforeGenerate() {
          var missing = collectMassMissingOptions();
          if (!missing.length) return false;
          openMassMissingOptionsModal(missing);
          return true;
        }
        var STEP_DONE = {
          1: function () {
            var d = $('mass-date');
            var cel = $('celebrant');
            return !!(d && d.value) && !!(cel && cel.value && cel.value.trim());
          },
          2: function () {
            if (!selVal('flow-penitential-choice')) return false;
            var kOk = selVal('flow-kyrie-choice') || !!(window.massRiteVideoMode && window.massRiteVideoMode.kyrie);
            var gOk = selVal('flow-gloria-choice') || !!(window.massRiteVideoMode && window.massRiteVideoMode.gloria);
            return kOk && gOk;
          },
          3: function () { return readingsLoaded(); },
          4: function () {
            if (!selVal('flow-creed-choice') || !sanctusPicked()) return false;
            var oOk = selVal('flow-our-father-choice') || !!(window.massRiteVideoMode && window.massRiteVideoMode.our_father);
            var lOk = selVal('flow-lamb-choice') || !!(window.massRiteVideoMode && window.massRiteVideoMode.lamb_of_god);
            return oOk && lOk;
          },
          5: function () {
            return collectStepMissingOptions(5).length === 0;
          },
          7: function () { return collectMassMissingOptions().length === 0; }
        };
        function stepReady(n) { return STEP_DONE[n] ? !!STEP_DONE[n]() : true; }
        function refreshContinue() {
          var nb = $('mw-next'); if (nb) nb.classList.toggle('is-ready', stepReady(current));
          var g = $('mw-generate'); if (g) g.classList.toggle('is-ready', current === 7);
          if (current === 7 && collectMassMissingOptions().length === 0) clearReviewMissingHighlights();
          pruneMissingTargetHighlights();
          fillAside(current);
        }
        function flashHint(msg) {
          var h = document.querySelector('#mw-bookmark-panel .mw-bookmark__hint'); if (!h) return;
          var prev = h.getAttribute('data-base') || h.textContent;
          h.setAttribute('data-base', prev);
          h.textContent = msg; h.style.color = 'var(--accent)';
          setTimeout(function () { h.textContent = prev; h.style.color = ''; }, 1800);
        }
        function init() {
          if (flowPage.dataset.mwInit === '1') return; flowPage.dataset.mwInit = '1';
          document.body.classList.add('mw-on');
          if ($('mw-next')) $('mw-next').addEventListener('click', next);
          if ($('mw-back')) $('mw-back').addEventListener('click', back);
          var pendingSlideKinds = null;
          var pendingPartialIncludeAiPoster = null;
          var PARTIAL_POSTER_STYLES = [
            ["cinematic", "Cinematic"],
            ["realistic", "Realistic"],
            ["renaissance", "Renaissance"],
            ["stained_glass", "Stained glass"],
            ["modern", "Modern"]
          ];
          var SLIDE_KIND_GROUPS = [
            ["Introductory rites", [
              ["pre_mass", "Pre-Mass"],
              ["cover", "Mass cover (no AI)"],
              ["cover_ai", "Mass cover (AI)"],
              ["entrance", "Entrance hymn"],
              ["intro_rites", "Sign of the Cross"], ["penitential", "Penitential Act"],
              ["kyrie", "Kyrie"], ["gloria", "Gloria"], ["opening_prayer", "Opening prayer"]
            ]],
            ["Liturgy of the Word", [
              ["lotw_title", "LOTW title"], ["first_reading", "First Reading"],
              ["psalm", "Responsorial Psalm"], ["second_reading", "Second Reading"],
              ["gospel_acclamation", "Gospel Acclamation"], ["creed", "Creed"],
              ["prayer_faithful", "Prayer of the Faithful"]
            ]],
            ["Liturgy of the Eucharist", [
              ["offertory", "Offertory hymn"], ["lote_poster", "LOTE posters"],
              ["pray_brethren", "Pray, brethren"], ["preface", "Preface"],
              ["sanctus", "Sanctus"], ["mystery_of_faith", "Mystery of Faith"],
              ["great_amen", "Great Amen"], ["our_father", "Our Father"],
              ["sign_of_peace", "Sign of Peace"], ["lamb_of_god", "Lamb of God"],
              ["communion_rite", "Communion rite"], ["communion", "Communion hymns"],
              ["meditation", "Meditation / extras"], ["post_communion", "Post-communion"]
            ]],
            ["Close", [
              ["welcoming", "Welcoming newcomers"], ["collection", "Mass collection"],
              ["food_sponsors", "Food sponsors"], ["sponsorship_contact", "Sponsorship contact"],
              ["merienda", "Merienda location"], ["custom_announcements", "Custom announcements"],
              ["confession", "Confession / images"], ["final_blessing", "Final blessing"],
              ["recessional", "Recessional hymn"], ["dividers", "Section divider covers"]
            ]]
          ];
          function isSaGenerate() {
            return document.body.classList.contains("is-superadmin");
          }
          function triggerFullGenerate() {
            pendingSlideKinds = null;
            pendingPartialIncludeAiPoster = null;
            var g = $('btn-generate-flow'); if (g) g.click();
          }
          function triggerLeafletGenerate() {
            pendingSlideKinds = null;
            pendingPartialIncludeAiPoster = null;
            if (typeof window.runFullMassGenerate === 'function') {
              window.runFullMassGenerate({
                include_leaflet: true,
                leaflet_only: true,
                include_ai: false,
                openSlideshow: false,
                autoDownloadPptx: false,
                autoDownloadLeaflet: true,
                setStatus: typeof window.setFlowStatus === 'function' ? window.setFlowStatus : undefined,
              });
              return;
            }
            triggerFullGenerate();
          }
          function setGenMenuOpen(open) {
            var menu = $('mw-gen-menu');
            var btn = $('mw-generate');
            if (!menu || !btn) return;
            menu.hidden = !open;
            btn.setAttribute("aria-expanded", open ? "true" : "false");
          }
          function fillPartialGenList() {
            var host = $('mw-partial-gen-list');
            if (!host) return;
            if (host.dataset.built === "cover-ai-v1") return;
            host.dataset.built = "cover-ai-v1";
            var saved = [];
            try { saved = JSON.parse(sessionStorage.getItem("verbum:sa-slide-kinds") || "[]") || []; } catch (_e) { saved = []; }
            var savedSet = {};
            saved.forEach(function (id) { savedSet[id] = true; });
            host.innerHTML = SLIDE_KIND_GROUPS.map(function (group) {
              var boxes = group[1].map(function (item) {
                var checked = saved.length ? (savedSet[item[0]] ? " checked" : "") : " checked";
                var extra = item[0] === "cover_ai" ? " data-partial-cover-ai=\"1\"" : "";
                return "<label><input type=\"checkbox\" value=\"" + item[0] + "\"" + checked + extra + " /> " + item[1] + "</label>";
              }).join("");
              return "<div class=\"mw-partial-gen__group\"><h4>" + group[0] + "</h4>" + boxes + "</div>";
            }).join("");
          }
          function openPartialGenModal() {
            fillPartialGenList();
            var modal = $('mw-partial-gen-modal');
            if (!modal) return;
            modal.setAttribute("data-open", "true");
            modal.setAttribute("aria-hidden", "false");
          }
          function closePartialGenModal() {
            var modal = $('mw-partial-gen-modal');
            if (!modal) return;
            modal.removeAttribute("data-open");
            modal.setAttribute("aria-hidden", "true");
          }
          function closePartialPosterModal() {
            var modal = $('mw-partial-poster-modal');
            if (!modal) return;
            modal.removeAttribute("data-open");
            modal.setAttribute("aria-hidden", "true");
          }
          function selectedPartialKinds() {
            var host = $('mw-partial-gen-list');
            if (!host) return [];
            return Array.prototype.slice.call(host.querySelectorAll("input[type=checkbox]:checked"))
              .map(function (el) { return el.value; })
              .filter(Boolean);
          }
          function partialMassDate() {
            var el = $('mass-date') || $('flow-mass-date');
            return el && el.value ? String(el.value).trim() : "";
          }
          function currentPartialPosterStyle() {
            var sel = $('flow-openai-poster-style');
            var val = sel && sel.value ? String(sel.value) : "cinematic";
            return val === "auto" ? "cinematic" : val;
          }
          function applyPartialPosterStyle(styleId) {
            var sid = String(styleId || "cinematic").trim() || "cinematic";
            ["flow-openai-poster-style", "poster-openai-poster-style"].forEach(function (id) {
              var el = $(id);
              if (!el) return;
              el.value = sid;
              el.dispatchEvent(new Event("change", { bubbles: true }));
            });
            if (typeof window.setWeeklyPosterStyle === "function") {
              window.setWeeklyPosterStyle(sid);
            }
            var grid = $('mw-partial-poster-grid');
            if (grid) {
              grid.querySelectorAll("[data-partial-style]").forEach(function (btn) {
                var on = btn.getAttribute("data-partial-style") === sid;
                btn.classList.toggle("is-selected", on);
                btn.setAttribute("aria-selected", on ? "true" : "false");
              });
            }
          }
          function fillPartialPosterGrid(items) {
            var grid = $('mw-partial-poster-grid');
            var hint = $('mw-partial-poster-hint');
            if (!grid) return;
            var list = Array.isArray(items) && items.length
              ? items
              : PARTIAL_POSTER_STYLES.map(function (pair) {
                  return { id: pair[0], label: pair[1], ready: false, thumb_url: "", proxy_url: "" };
                });
            var pick = currentPartialPosterStyle();
            grid.innerHTML = list.map(function (item) {
              var id = String(item.id || "");
              var label = String(item.label || id || "Style");
              var ready = !!item.ready;
              var src = String(item.thumb_url || item.proxy_url || "");
              var img = ready && src
                ? ("<img src=\"" + src.replace(/\"/g, "&quot;") + "\" alt=\"\" loading=\"lazy\" />")
                : "<span class=\"mw-partial-poster__placeholder\" aria-hidden=\"true\"></span>";
              var selected = id === pick ? " is-selected" : "";
              return (
                "<button type=\"button\" class=\"mw-partial-poster__card" + selected + (ready ? "" : " is-pending") + "\" " +
                "role=\"option\" data-partial-style=\"" + id.replace(/\"/g, "") + "\" aria-selected=\"" + (id === pick ? "true" : "false") + "\">" +
                "<span class=\"mw-partial-poster__frame\">" + img + "</span>" +
                "<span class=\"mw-partial-poster__label\">" + label.replace(/</g, "&lt;") + "</span>" +
                (ready ? "" : "<span class=\"mw-partial-poster__badge\">Not ready</span>") +
                "</button>"
              );
            }).join("");
            grid.querySelectorAll("[data-partial-style]").forEach(function (btn) {
              btn.addEventListener("click", function () {
                applyPartialPosterStyle(btn.getAttribute("data-partial-style"));
              });
            });
            if (hint) {
              var readyCount = list.filter(function (it) { return !!it.ready; }).length;
              hint.textContent = readyCount
                ? ("Showing " + readyCount + " of " + list.length + " weekly styles for this Sunday.")
                : "Styles not generated yet — generate will use the shared weekly style when available.";
            }
            applyPartialPosterStyle(pick);
          }
          function openPartialPosterModal() {
            var modal = $('mw-partial-poster-modal');
            if (!modal) return;
            fillPartialPosterGrid(null);
            modal.setAttribute("data-open", "true");
            modal.setAttribute("aria-hidden", "false");
            var date = partialMassDate();
            if (!date) return;
            fetch("/api/weekly-style-posters?date=" + encodeURIComponent(date))
              .then(function (res) { return res.json(); })
              .then(function (data) {
                fillPartialPosterGrid(data && data.items ? data.items : null);
              })
              .catch(function () { /* keep fallback cards */ });
          }
          function beginPartialGenerate(kinds) {
            var includeAi = kinds.indexOf("cover_ai") >= 0;
            try { sessionStorage.setItem("verbum:sa-slide-kinds", JSON.stringify(kinds)); } catch (_e) {}
            try { sessionStorage.setItem("verbum:sa-partial-ai-poster", includeAi ? "1" : "0"); } catch (_e2) {}
            pendingSlideKinds = kinds;
            pendingPartialIncludeAiPoster = includeAi;
            closePartialPosterModal();
            closePartialGenModal();
            var g = $('btn-generate-flow'); if (g) g.click();
          }
          if ($('mw-generate')) $('mw-generate').addEventListener('click', function (e) {
            if (validateBeforeGenerate()) return;
            e.preventDefault();
            var menu = $('mw-gen-menu');
            setGenMenuOpen(menu ? menu.hidden : true);
          });
          if ($('mw-gen-menu')) $('mw-gen-menu').addEventListener('click', function (e) {
            var item = e.target.closest("[data-mw-gen-mode]");
            if (!item) return;
            setGenMenuOpen(false);
            if (validateBeforeGenerate()) return;
            var mode = item.getAttribute("data-mw-gen-mode");
            if (mode === "partial") {
              if (!isSaGenerate()) return;
              openPartialGenModal();
              return;
            }
            if (mode === "leaflet") {
              triggerLeafletGenerate();
              return;
            }
            triggerFullGenerate();
          });
          if ($('btn-mw-offline-leaflet')) $('btn-mw-offline-leaflet').addEventListener('click', function () {
            if (validateBeforeGenerate()) return;
            triggerLeafletGenerate();
          });
          document.addEventListener("click", function (e) {
            var wrap = $('mw-gen-wrap');
            if (!wrap || !wrap.contains || wrap.contains(e.target)) return;
            setGenMenuOpen(false);
          });
          if ($('mw-partial-gen-all')) $('mw-partial-gen-all').addEventListener('click', function () {
            var host = $('mw-partial-gen-list');
            if (!host) return;
            host.querySelectorAll("input[type=checkbox]").forEach(function (el) { el.checked = true; });
          });
          if ($('mw-partial-gen-none')) $('mw-partial-gen-none').addEventListener('click', function () {
            var host = $('mw-partial-gen-list');
            if (!host) return;
            host.querySelectorAll("input[type=checkbox]").forEach(function (el) { el.checked = false; });
          });
          if ($('mw-partial-gen-cancel')) $('mw-partial-gen-cancel').addEventListener('click', closePartialGenModal);
          if ($('mw-partial-gen-modal')) $('mw-partial-gen-modal').addEventListener('click', function (e) {
            if (e.target === $('mw-partial-gen-modal')) closePartialGenModal();
          });
          if ($('mw-partial-gen-go')) $('mw-partial-gen-go').addEventListener('click', function () {
            var kinds = selectedPartialKinds();
            if (!kinds.length) return;
            if (kinds.indexOf("cover_ai") >= 0) {
              var weeklyReady = typeof window.areWeeklyAiPostersReady === "function" && window.areWeeklyAiPostersReady();
              if (!weeklyReady) {
                // Fall back to non-AI cover when SA has not published the weekly set.
                kinds = kinds.filter(function (k) { return k !== "cover_ai"; });
                if (kinds.indexOf("cover") < 0) kinds.push("cover");
                if (typeof window.notify === "function") {
                  window.notify("AI posters aren't ready for this Sunday — generating non-AI cover.", "warn");
                }
                beginPartialGenerate(kinds);
                return;
              }
              closePartialGenModal();
              openPartialPosterModal();
              var posterModal = $('mw-partial-poster-modal');
              if (posterModal) posterModal.dataset.pendingKinds = JSON.stringify(kinds);
              return;
            }
            beginPartialGenerate(kinds);
          });
          if ($('mw-partial-poster-back')) $('mw-partial-poster-back').addEventListener('click', function () {
            closePartialPosterModal();
            openPartialGenModal();
          });
          if ($('mw-partial-poster-modal')) $('mw-partial-poster-modal').addEventListener('click', function (e) {
            if (e.target === $('mw-partial-poster-modal')) {
              closePartialPosterModal();
              openPartialGenModal();
            }
          });
          if ($('mw-partial-poster-go')) $('mw-partial-poster-go').addEventListener('click', function () {
            var posterModal = $('mw-partial-poster-modal');
            var kinds = [];
            try {
              kinds = JSON.parse((posterModal && posterModal.dataset.pendingKinds) || "[]") || [];
            } catch (_e) { kinds = []; }
            if (!kinds.length) kinds = selectedPartialKinds();
            if (!kinds.length) return;
            if (kinds.indexOf("cover_ai") < 0) kinds.push("cover_ai");
            beginPartialGenerate(kinds);
          });
          bindMassMissingOptionsModal();
          if ($('mw-present')) $('mw-present').addEventListener('click', function () {
            if (typeof window.reopenLastMassSlideshow === 'function') window.reopenLastMassSlideshow();
          });
          document.addEventListener('keydown', function (e) {
            if (!document.body.classList.contains('mw-on')) return;
            if (!flowPage || !flowPage.classList.contains('active')) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            var t = e.target;
            if (t) {
              var tag = (t.tagName || '').toLowerCase();
              if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
              if (t.closest && t.closest('[contenteditable="true"]')) return;
            }
            if (document.querySelector('.ui-overlay[aria-hidden="false"], .mw-modal:not([hidden]), #mass-slideshow.is-open, .driver-overlay, .driver-active-element')) return;
            if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
              var nb = $('mw-next');
              if (nb && !nb.hidden) { e.preventDefault(); next(); }
              return;
            }
            if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
              var bb = $('mw-back');
              if (bb && !bb.hidden && !bb.classList.contains('is-nav-out') && current > 1) {
                e.preventDefault();
                back();
              }
              return;
            }
            if (e.key === 'Enter') {
              var gen = $('mw-generate');
              if (gen && !gen.hidden && !gen.disabled) {
                e.preventDefault();
                gen.click();
              }
            }
          });
          var massLang = $('flow-mass-language');
          if (massLang && massLang.dataset.mwLangBound !== '1') {
            massLang.dataset.mwLangBound = '1';
            massLang.addEventListener('change', function () {
              var lang = massLang.value === 'tagalog' ? 'tagalog' : 'english';
              if (typeof window.persistMassLanguage === 'function') window.persistMassLanguage(lang);
              /* Prefer matching vernacular for Our Father / Kyrie — Creed stays user-chosen. */
              if ($('flow-our-father-choice')) {
                var ofSel = $('flow-our-father-choice');
                var hasLang = Array.prototype.some.call(ofSel.options, function (o) {
                  return o.value === lang && !o.disabled;
                });
                if (hasLang) ofSel.value = lang;
              }
              if ($('flow-kyrie-choice')) {
                var kSel = $('flow-kyrie-choice');
                var hasKyrie = Array.prototype.some.call(kSel.options, function (o) {
                  return o.value === lang && !o.disabled;
                });
                if (hasKyrie) kSel.value = lang;
              }
              applyMassLanguageOptionOrder(lang);
              syncVariantRiteLanguagesFromMass(lang);
              /* re-render mw option radios driven by hidden selects */
              if (typeof window.syncMassRiteOptionRadios === 'function') window.syncMassRiteOptionRadios();
              else {
                Array.prototype.forEach.call(document.querySelectorAll('[data-mw-tunes]'), function (sel) {
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                });
              }
              fillAside(1);
              var md = $('mass-date');
              if (md && md.value && typeof window.reloadFlowReadingsForLanguage === 'function') {
                window.reloadFlowReadingsForLanguage(md.value, lang);
              }
            });
          }
          progItems.forEach(function (it) { it.addEventListener('click', function () { var s = parseInt(it.getAttribute('data-mw-go'), 10); if (s) showStep(s); }); });
          bindReviewSummaryNavigation();
          Array.prototype.forEach.call(flowPage.querySelectorAll('[data-mw-text-preview]'), function (p) {
            if (p.dataset.mwTextBound === '1') return;
            p.dataset.mwTextBound = '1';
            p.addEventListener('click', function (e) {
              e.stopPropagation(); e.preventDefault();
              var key = p.getAttribute('data-mw-media-key');
              if (!key) {
                var opt = p.closest('[data-mw-media-key]');
                key = opt && opt.getAttribute('data-mw-media-key');
              }
              if (key && typeof window.openMassRiteTextPreview === 'function') window.openMassRiteTextPreview(key);
            });
          });
          if ($('mw-media-pick-close')) $('mw-media-pick-close').addEventListener('click', function () {
            if (typeof window.closeMassMediaPickModal === 'function') window.closeMassMediaPickModal();
          });
          var mpm = $('mw-media-pick-modal');
          if (mpm) mpm.addEventListener('click', function (e) {
            if (e.target === mpm && typeof window.closeMassMediaPickModal === 'function') window.closeMassMediaPickModal();
          });
          if ($('mw-media-pick-clear')) $('mw-media-pick-clear').addEventListener('click', function () {
            if (typeof window.clearMassMediaPickSelection === 'function') window.clearMassMediaPickSelection();
          });
          if ($('mw-media-pick-q')) $('mw-media-pick-q').addEventListener('input', function () {
            if (typeof window.renderMassMediaPickList === 'function') window.renderMassMediaPickList();
          });
          flowPage.addEventListener('click', function (e) {
            var previewBtn = e.target.closest('[data-mw-rite-preview-btn]');
            if (previewBtn && flowPage.contains(previewBtn)) {
              e.preventDefault();
              e.stopPropagation();
              var previewHost = previewBtn.closest('.mw-rite-preview');
              setRitePreviewOpen(previewHost, !(previewHost && previewHost.classList.contains('is-open')));
              return;
            }
            var previewAction = e.target.closest('.mw-rite-preview__action');
            if (previewAction && flowPage.contains(previewAction)) {
              var openHost = previewAction.closest('.mw-rite-preview.is-open');
              if (openHost) scheduleRitePreviewAutoHide(openHost);
            }
            if (!e.target.closest('.mw-rite-preview')) closeAllRitePreviews();
            var riteModeBtn = e.target.closest('[data-mass-rite-slide-mode-val]');
            if (riteModeBtn && flowPage.contains(riteModeBtn)) {
              e.preventDefault();
              e.stopPropagation();
              var rSec = riteModeBtn.getAttribute('data-mass-rite-slide-mode-section');
              var rLang = riteModeBtn.getAttribute('data-mass-rite-slide-mode-lang');
              var rMode = riteModeBtn.getAttribute('data-mass-rite-slide-mode-val');
              if (rSec && rLang && rMode && typeof window.chooseMassRiteSlideMode === 'function') {
                window.chooseMassRiteSlideMode(rSec, rLang, rMode);
              }
              return;
            }
            var ytClear = e.target.closest('[data-mw-clear-youtube]');
            if (ytClear && flowPage.contains(ytClear)) {
              e.preventDefault();
              e.stopPropagation();
              var ytClearSlot = ytClear.getAttribute('data-mw-media-slot');
              if (ytClearSlot && typeof window.clearMassYouTubeLink === 'function') {
                window.clearMassYouTubeLink(ytClearSlot);
              }
              return;
            }
            var ytLink = e.target.closest('[data-mw-link-youtube]');
            if (ytLink && flowPage.contains(ytLink)) {
              e.preventDefault();
              e.stopPropagation();
              var ytSlot = ytLink.getAttribute('data-mw-media-slot');
              if (ytSlot && typeof window.openMassMediaPickModal === 'function') {
                window.openMassMediaPickModal('audio', ytSlot, { youtubeOnly: true });
              }
              return;
            }
            var chip = e.target.closest('[data-mw-link-media]');
            if (chip && flowPage.contains(chip)) {
              e.preventDefault();
              e.stopPropagation();
              closeAllMediaDd();
              var kind = chip.getAttribute('data-mw-link-media');
              var slot = chip.getAttribute('data-mw-media-slot');
              if (kind && slot && typeof window.openMassMediaPickModal === 'function') {
                window.openMassMediaPickModal(kind, slot, chip.closest('.mw-media-dd--link') ? { fromTitle: true } : {});
              }
              return;
            }
            var audioPlay = e.target.closest('[data-mw-play-audio]');
            if (audioPlay && flowPage.contains(audioPlay)) {
              e.preventDefault();
              e.stopPropagation();
              closeAllMediaDd();
              var aSlot = audioPlay.getAttribute('data-mw-media-slot');
              if (aSlot && typeof window.playMassSectionAudio === 'function') window.playMassSectionAudio(aSlot, audioPlay);
              return;
            }
            var youtubePlay = e.target.closest('[data-mw-play-youtube]');
            if (youtubePlay && flowPage.contains(youtubePlay)) {
              e.preventDefault();
              e.stopPropagation();
              var ySlot = youtubePlay.getAttribute('data-mw-media-slot');
              if (ySlot && typeof window.playMassSectionYouTube === 'function') window.playMassSectionYouTube(ySlot, youtubePlay);
              return;
            }
            var videoPlay = e.target.closest('[data-mw-play-video]');
            if (videoPlay && flowPage.contains(videoPlay)) {
              e.preventDefault();
              e.stopPropagation();
              closeAllMediaDd();
              var vSlot = videoPlay.getAttribute('data-mw-media-slot');
              if (vSlot && typeof window.playMassSectionVideo === 'function') window.playMassSectionVideo(vSlot, videoPlay);
            }
          });
          if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
          window.openMwTextPreview = openPreview;
          window.closeMwTextPreview = closePreview;
          Array.prototype.forEach.call(flowPage.querySelectorAll('[data-mw-preview]'), function (b) {
            b.addEventListener('click', function () { openPreview(b.getAttribute('data-mw-preview-title') || 'Preview', b.getAttribute('data-mw-preview-text') || ''); });
          });
          if ($('mw-preview-close')) $('mw-preview-close').addEventListener('click', closePreview);
          var pm = $('mw-preview-modal'); if (pm) pm.addEventListener('click', function (e) { if (e.target === pm) closePreview(); });
          var bt = $('mw-bookmark-tab');
          if (bt) bt.addEventListener('click', function () {
            var bm = $('mw-bookmark'); if (!bm) return;
            var open = bm.getAttribute('data-open') === 'true';
            bm.setAttribute('data-open', String(!open)); bt.setAttribute('aria-expanded', String(!open));
          });
          Array.prototype.forEach.call(document.querySelectorAll('#mw-bookmark-panel [data-pick]'), function (sec) {
            sec.addEventListener('mouseup', function () {
              var sel = (window.getSelection ? window.getSelection().toString() : '').trim(); if (!sel) return;
              var which = sec.getAttribute('data-pick');
              var target = which === 'gospel' ? $('flow-gospel-custom') : $('flow-psalm-custom');
              if (target) { target.value = sel; target.dispatchEvent(new Event('input', { bubbles: true })); flashHint('Added to custom ' + which + ' text.'); }
            });
          });
          if ($('mw-pof-generate')) $('mw-pof-generate').addEventListener('click', function (e) { e.preventDefault(); });
          document.addEventListener('mw:preview-loading', beginMwMassContextLoading);
          document.addEventListener('mw:preview', function () {
            fillMwMassContext();
            if (current === 1) fillAside(1);
            if (current === 7) fillReceipt();
            refreshContinue();
          });
          document.addEventListener('mw:aside-refresh', function () { fillAside(current); });
          var massDateEl = $('mass-date');
          if (massDateEl && massDateEl.dataset.mwContextBound !== '1') {
            massDateEl.dataset.mwContextBound = '1';
            massDateEl.addEventListener('change', beginMwMassContextLoading);
          }
          buildChoiceCards();
          attachInlineOptionLanguages();
          applyMassLanguageOptionOrder();
          ensureKyrieTagalogPanel();
          ensureSanctusVideoOption();
          syncInlineOptionLanguages();
          bindMediaDropdowns(flowPage);
          scheduleRiteDefaultPinLabelHide(flowPage);
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-options[aria-label] .mw-option'), function (opt) {
            if (opt.getAttribute('data-val') === '__video' || opt.classList.contains('mw-option--video')) return;
            if (opt.dataset.mwWired === '1' || opt.dataset.mwSanctusLangBound === '1') return;
            if (opt.hasAttribute('data-val') && opt.closest('select[data-mw-tunes] + .mw-options')) return;
            opt.dataset.mwWired = '1';
            function pickStandalone() {
              closeAllRitePreviews();
              var group = opt.closest('[role="radiogroup"]');
              var section = group && group.getAttribute('data-mw-media-section');
              if (group) Array.prototype.forEach.call(group.querySelectorAll('.mw-option'), function (c) {
                if (c.getAttribute('data-val') === '__video') return;
                c.setAttribute('aria-checked', 'false');
              });
              opt.setAttribute('aria-checked', 'true');
              if (section && window.massRiteVideoMode && window.massRiteVideoMode[section]) {
                if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                window.massRiteVideoLang[section] = opt.getAttribute('data-val') || 'default';
              }
              if (section && typeof window.syncRiteVideoUi === 'function') window.syncRiteVideoUi(section);
              syncInlineOptionLanguages(group || opt);
              refreshContinue();
              mwAdvanceAfterPick(opt);
            }
            opt.addEventListener('click', function (e) { if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], select, .mw-video-lang-select, .mw-media-dd, .mw-rite-lang, .mw-rite-preview')) { e.preventDefault(); return; } pickStandalone(); });
            opt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickStandalone(); } });
          });
          flowPage.addEventListener('input', refreshContinue, true);
          flowPage.addEventListener('change', refreshContinue, true);
          showStep(1);
          window.MassWizard = {
            getStep: function () { return current; },
            setStep: function (n) {
              var s = parseInt(n, 10);
              if (s >= 1 && s <= 7) showStep(s);
              if (typeof window.scheduleMassBuilderDraftAutoSave === "function") window.scheduleMassBuilderDraftAutoSave();
            },
            getMissingOptions: function () { return collectMassMissingOptions(); },
            validateBeforeGenerate: validateBeforeGenerate,
            consumeSlideKinds: function () {
              var kinds = pendingSlideKinds;
              pendingSlideKinds = null;
              return kinds;
            },
            consumePartialIncludeAiPoster: function () {
              var v = pendingPartialIncludeAiPoster;
              pendingPartialIncludeAiPoster = null;
              return v;
            },
            hasProgress: function () {
              if (current > 1) return true;
              var cel = $('celebrant');
              var co = $('co-celebrant');
              if (cel && cel.value && cel.value.trim()) return true;
              if (co && co.value && co.value.trim()) return true;
              return false;
            }
          };
          setTimeout(function () {
            var fp = document.getElementById('flow-page');
            if (!fp || !fp.classList.contains('active')) return;
            if (typeof window.maybePromptDeckThemeOnStartup === 'function') {
              window.maybePromptDeckThemeOnStartup();
            }
          }, 0);
        }
        init();
      })();
