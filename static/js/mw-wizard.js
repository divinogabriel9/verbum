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
          var s2 = asideRow('Penitential Act', selText('flow-penitential-choice') || '—', 'penitential');
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
          var s4 = asideRow('Creed', selText('flow-creed-choice') || '—', 'creed');
          s4 += asideRow('Sanctus', sanctusLabel() || '—', 'sanctus');
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
          var aiOn = $('flow-use-ai-poster') && $('flow-use-ai-poster').checked;
          s6 += asideRow('AI poster art', aiOn ? 'On' : 'Off');
          if (aiOn) {
            var styleEl = $('flow-openai-poster-style');
            if (styleEl && styleEl.value) s6 += asideRow('AI style', selText('flow-openai-poster-style') || styleEl.value);
          }
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
            return 'Video · Holy, Holy, Holy (default)';
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
            rows.push(asideRow('Penitential Act', selText('flow-penitential-choice')));
            rows.push(asideRow('Kyrie', riteVideoAsideLabel('kyrie', 'flow-kyrie-choice')));
            rows.push(asideRow('Gloria', riteVideoAsideLabel('gloria', 'flow-gloria-choice')));
          } else if (n === 4) {
            rows.push(asideRow('Creed', selText('flow-creed-choice')));
            rows.push(asideRow('Sanctus', sanctusLabel()));
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
          return true;
        }
        function shake(el) {
          if (!el) return; var i = 0; var seq = [-4, 4, -3, 3, 0];
          (function s() { if (i >= seq.length) { el.style.transform = ''; return; } el.style.transform = 'translateX(' + seq[i++] + 'px)'; setTimeout(s, 55); })();
        }
        function next() {
          if (current === 1) { if (!validStep1()) { shake($('mw-next')); return; } ensureReadings(); }
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
        function riteAudioPlayHtml(mediaKey) {
          return '<button type="button" class="mw-option__text" data-mw-play-audio data-mw-media-slot="' + escapeAttr(mediaKey) + '" aria-label="Play audio preview" title="Play audio preview">▶</button>';
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
          var host = trigger.closest('.mw-media-dd, .mw-kyrie-dd');
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
        function setMediaDdOpen(dd, open) {
          if (!dd) return;
          if (open) {
            closeAllMediaDd(dd);
            setKyrieTagalogMenuOpen(false);
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
          if (open) closeAllMediaDd();
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
          var wrap = kyrieSel.nextElementSibling;
          var tagalogCard = wrap && wrap.classList && wrap.classList.contains('mw-options')
            ? wrap.querySelector('.mw-option[data-val="tagalog"]')
            : null;
          var row = tagalogCard && tagalogCard.querySelector(':scope > .mw-option__row');
          var label = row && row.querySelector('.mw-option__label');
          if (label) label.insertAdjacentElement('afterend', panel);
          else if (row && panel.parentElement !== row) row.appendChild(panel);
          else if (tagalogCard && panel.parentElement !== tagalogCard) tagalogCard.appendChild(panel);
          if (row) {
            var textBtn = row.querySelector(':scope > [data-mw-text-preview]');
            var audioPlay = row.querySelector(':scope > [data-mw-play-audio]');
            if (textBtn) row.appendChild(textBtn);
            if (audioPlay) row.appendChild(audioPlay);
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
            });
            document.addEventListener('keydown', function (e) {
              if (e.key === 'Escape') {
                setKyrieTagalogMenuOpen(false);
                closeAllMediaDd();
              }
            });
          }
          refreshKyrieTagalogPanel();
        }
        function buildChoiceCards() {
          Array.prototype.forEach.call(flowPage.querySelectorAll('select[data-mw-tunes]'), function (sel) {
            if (sel.dataset.mwCards === '1') return; sel.dataset.mwCards = '1';
            var section = sel.getAttribute('data-mw-media-section') || '';
            var textOnly = section === 'penitential' || section === 'creed';
            var mediaRite = section === 'kyrie' || section === 'gloria' || section === 'our_father' || section === 'lamb_of_god';
            var wrap = document.createElement('div'); wrap.className = 'mw-options'; wrap.setAttribute('role', 'radiogroup');
            if (section) wrap.setAttribute('data-mw-media-section', section);
            var opts = Array.prototype.slice.call(sel.options).filter(function (o) { return o.value && !o.disabled; });
            sel.selectedIndex = -1;
            function videoModeOn() {
              return !!(window.massRiteVideoMode && window.massRiteVideoMode[section]);
            }
            function videoLang() {
              var map = window.massRiteVideoLang || {};
              return map[section] || (opts[0] && opts[0].value) || '';
            }
            function sync() {
              Array.prototype.forEach.call(wrap.querySelectorAll('.mw-option'), function (c) {
                var v = c.getAttribute('data-val');
                c.setAttribute('aria-checked', String(!!sel.value && sel.value === v));
              });
              if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
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
              sync();
              mwAdvanceAfterPick(wrap);
              if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
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
              var action = (!isOmit && (textOnly || mediaRite || mediaKey))
                ? ('<span class="mw-option__text" data-mw-text-preview role="button" tabindex="0" aria-label="Text preview" title="Text preview from slides">Aa</span>')
                : '';
              var playDd = (!isOmit && mediaRite && mediaKey) ? riteAudioPlayHtml(mediaKey) : '';
              var labelHtml = (!isOmit && mediaRite && mediaKey) ? riteLabelLinkHtml(mediaKey) : '<span class="mw-option__label"></span>';
              item.innerHTML =
                '<div class="mw-option__row">' +
                  '<span class="mw-option__check" aria-hidden="true"></span>' +
                  labelHtml +
                  action +
                  playDd +
                '</div>' +
                (!isOmit && mediaRite && mediaKey
                  ? ('<div class="mw-option__media mass-song-media-row" data-mw-media-row="' + escapeAttr(mediaKey) +
                     '" data-mw-rite-media="1" data-mw-media-section="' + escapeAttr(section) +
                     '" data-mw-media-lang="' + escapeAttr(o.value) + '"></div>')
                  : '');
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
                if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], .mw-kyrie-tagalog, .mw-kyrie-dd, .mw-media-dd')) return;
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
            if (typeof window.registerRiteVideoSync === 'function') window.registerRiteVideoSync(section, sync);
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
              if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], .mw-media-dd')) return;
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
          1: function () { var d = $('mass-date'); return !!(d && d.value); },
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
          7: function () { return collectMassMissingOptions().length === 0; }
        };
        function stepReady(n) { return STEP_DONE[n] ? !!STEP_DONE[n]() : true; }
        function refreshContinue() {
          var nb = $('mw-next'); if (nb) nb.classList.toggle('is-ready', stepReady(current));
          var g = $('mw-generate'); if (g) g.classList.toggle('is-ready', current === 7);
          if (current === 7 && collectMassMissingOptions().length === 0) clearReviewMissingHighlights();
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
          var SLIDE_KIND_GROUPS = [
            ["Introductory rites", [
              ["pre_mass", "Pre-Mass"], ["cover", "Mass cover"], ["entrance", "Entrance hymn"],
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
            var g = $('btn-generate-flow'); if (g) g.click();
          }
          function triggerLeafletGenerate() {
            pendingSlideKinds = null;
            if (typeof window.runFullMassGenerate === 'function') {
              window.runFullMassGenerate({
                include_leaflet: true,
                leaflet_only: true,
                include_ai: false,
                openSlideshow: false,
                autoDownloadPptx: false,
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
            if (!host || host.dataset.built === "1") return;
            host.dataset.built = "1";
            var saved = [];
            try { saved = JSON.parse(sessionStorage.getItem("verbum:sa-slide-kinds") || "[]") || []; } catch (_e) { saved = []; }
            var savedSet = {};
            saved.forEach(function (id) { savedSet[id] = true; });
            host.innerHTML = SLIDE_KIND_GROUPS.map(function (group) {
              var boxes = group[1].map(function (item) {
                var checked = saved.length ? (savedSet[item[0]] ? " checked" : "") : " checked";
                return "<label><input type=\"checkbox\" value=\"" + item[0] + "\"" + checked + " /> " + item[1] + "</label>";
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
          function selectedPartialKinds() {
            var host = $('mw-partial-gen-list');
            if (!host) return [];
            return Array.prototype.slice.call(host.querySelectorAll("input[type=checkbox]:checked"))
              .map(function (el) { return el.value; })
              .filter(Boolean);
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
            try { sessionStorage.setItem("verbum:sa-slide-kinds", JSON.stringify(kinds)); } catch (_e) {}
            pendingSlideKinds = kinds;
            closePartialGenModal();
            var g = $('btn-generate-flow'); if (g) g.click();
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
          applyMassLanguageOptionOrder();
          ensureKyrieTagalogPanel();
          ensureSanctusVideoOption();
          bindMediaDropdowns(flowPage);
          scheduleRiteDefaultPinLabelHide(flowPage);
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-options[aria-label] .mw-option'), function (opt) {
            if (opt.getAttribute('data-val') === '__video' || opt.classList.contains('mw-option--video')) return;
            if (opt.dataset.mwWired === '1' || opt.dataset.mwSanctusLangBound === '1') return;
            if (opt.hasAttribute('data-val') && opt.closest('select[data-mw-tunes] + .mw-options')) return;
            opt.dataset.mwWired = '1';
            function pickStandalone() {
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
              refreshContinue();
              mwAdvanceAfterPick(opt);
            }
            opt.addEventListener('click', function (e) { if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], select, .mw-video-lang-select, .mw-media-dd')) { e.preventDefault(); return; } pickStandalone(); });
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
