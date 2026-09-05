/* Mass Builder wizard controller — extracted from templates/index.html */
      (function () {
        function $(id) { return document.getElementById(id); }
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
          6: { title: 'Additional Details', sub: 'Stewardship, slide theme, posters, and AI imagery.' },
          7: { title: 'Review & Generate', sub: 'Full summary of your Mass — confirm, then build your deck.' }
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
                songRows += asideRow(typeof receiptSlotShortLabel === 'function' ? receiptSlotShortLabel(song) : song.label, song.title || song.id || '—', 'song:' + song.slotKey);
              });
            } catch (e) { /* optional */ }
          }
          if (!songRows) {
            var sc = $('flow-song-count'), st = $('mass-summary-song-total');
            songRows = asideRow('Songs', (sc ? sc.textContent : '0') + ' / ' + (st ? st.textContent : '5') + ' selected');
          }
          var hymnLayout = document.querySelector('input[name="flow-hymn-layout"]:checked');
          if (hymnLayout) songRows += asideRow('Hymn layout', hymnLayout.value === 'single' ? '1 verse / slide' : '2 verses / slide');
          sections.push(reviewSection('Music ministry', 'Step 5', songRows, { multi: true, step: 5 }));
          var themeName = $('mw-deck-theme-name');
          var s6 = asideRow('Slide theme', themeName ? themeName.textContent.trim() : selText('flow-deck-theme'));
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
          host.innerHTML =
            '<div class="mw-review-total"><span>Estimated slides</span><strong>' + slides + '</strong></div>' +
            sections.join('');
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
          if (legend) legend.hidden = n !== 2 && n !== 4;
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
          if ($('mw-back')) $('mw-back').hidden = n === 1;
          if ($('mw-next')) $('mw-next').hidden = n === 7;
          if ($('mw-generate')) $('mw-generate').hidden = n !== 7;
          if ($('mw-present')) $('mw-present').hidden = n !== 7 || !window.__massPresentAvailable;
          if (typeof window.syncMassPresentAgainUi === 'function') window.syncMassPresentAgainUi();
          var practiceShareNav = $('btn-practice-share-wizard');
          if (practiceShareNav) practiceShareNav.hidden = n !== 5;
          if (n === 3) { ensureReadings(); }
          if (n === 5 && typeof window.refreshMassMusicSongPlan === "function") {
            window.refreshMassMusicSongPlan({ force: true }).catch(function () {});
          }
          if (n === 6 && typeof window.ensureCollectionDefaultDate === "function") {
            window.ensureCollectionDefaultDate();
          }
          if (n === 7) { fillReceipt(); }
          fillAside(n);
          var canvas = document.querySelector('#mw-wizard .mw-step-canvas');
          var wiz = $('mw-wizard');
          if (canvas) {
            canvas.classList.toggle('is-readings-step', n === 3);
            canvas.classList.toggle('is-extras-step', n === 6);
            canvas.classList.toggle('is-music-step', n === 5);
            canvas.classList.toggle('is-review-step', n === 7);
          }
          if (wiz) {
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
            function escapeAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
            function videoModeOn() {
              return !!(window.massRiteVideoMode && window.massRiteVideoMode[section]);
            }
            function videoLang() {
              var map = window.massRiteVideoLang || {};
              return map[section] || (opts[0] && opts[0].value) || '';
            }
            function sync() {
              Array.prototype.forEach.call(wrap.querySelectorAll(':scope > .mw-option'), function (c) {
                var v = c.getAttribute('data-val');
                c.setAttribute('aria-checked', String(!!sel.value && sel.value === v));
              });
              if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
            }
            function pickLang(val) {
              sel.value = val;
              if (window.massRiteVideoMode && window.massRiteVideoMode[section]) {
                if (!window.massRiteVideoLang) window.massRiteVideoLang = {};
                window.massRiteVideoLang[section] = val;
              }
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              sync();
              mwAdvanceAfterPick(wrap);
              if (typeof window.scheduleMassBuilderDraftAutoSave === 'function') window.scheduleMassBuilderDraftAutoSave();
            }
            opts.forEach(function (o) {
              var mediaKey = section && typeof window.massMediaKey === 'function'
                ? window.massMediaKey(section, o.value)
                : (section ? (section + '::' + o.value) : '');
              var item = document.createElement('div'); item.className = 'mw-option';
              item.setAttribute('role', 'radio'); item.setAttribute('tabindex', '0'); item.setAttribute('data-val', o.value);
              item.setAttribute('aria-checked', 'false');
              if (mediaKey) item.setAttribute('data-mw-media-key', mediaKey);
              var action = (textOnly || mediaRite || mediaKey)
                ? ('<span class="mw-option__text" data-mw-text-preview role="button" tabindex="0" aria-label="Text preview" title="Text preview from slides">Aa</span>')
                : '';
              item.innerHTML =
                '<div class="mw-option__row">' +
                  '<span class="mw-option__check" aria-hidden="true"></span>' +
                  '<span class="mw-option__label"></span>' +
                  action +
                '</div>' +
                (mediaRite && mediaKey
                  ? ('<div class="mw-option__media mass-song-media-row" data-mw-media-row="' + escapeAttr(mediaKey) +
                     '" data-mw-rite-media="1" data-mw-media-section="' + escapeAttr(section) +
                     '" data-mw-media-lang="' + escapeAttr(o.value) + '"></div>')
                  : '');
              item.querySelector('.mw-option__label').textContent = o.textContent;
              var pinKey = sel.id || (section ? ('flow-' + section.replace(/_/g, '-') + '-choice') : '');
              if (pinKey) {
                var pin = document.createElement('label');
                pin.className = 'mw-default-pin';
                pin.title = 'Use this choice as my default next time';
                pin.innerHTML = '<input type="checkbox" class="mw-default-pin__input" data-mw-default-key="' + escapeAttr(pinKey) + '" data-mw-default-value="' + escapeAttr(o.value) + '" /><span class="mw-default-pin__text">Default</span>';
                pin.addEventListener('click', function (e) { e.stopPropagation(); });
                item.querySelector('.mw-option__row').appendChild(pin);
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
                if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val]')) return;
                pickLang(o.value);
              });
              item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickLang(o.value); } });
              wrap.appendChild(item);
            });
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
          Array.prototype.forEach.call(wrap.querySelectorAll(':scope > .mw-option[data-val="__video"], :scope > .mw-option.mw-option--video'), function (card) {
            card.remove();
          });
          var section = 'sanctus';
          var defaultOpt = wrap.querySelector(':scope > .mw-option[data-val="default"]');
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
            Array.prototype.forEach.call(wrap.querySelectorAll(':scope > .mw-option'), function (c) {
              var v = c.getAttribute('data-val');
              if (v === '__video') return;
              /* Sanctus stays selected when picked; video mode does not uncheck it */
              if (c.getAttribute('aria-checked') !== 'true' && !onVideo) {
                /* leave unchecked until user picks */
              }
            });
            if (typeof window.refreshMassSectionMediaUi === 'function') window.refreshMassSectionMediaUi();
            refreshContinue();
          }
          if (defaultOpt && !defaultOpt.querySelector('.mw-default-pin')) {
            var sanctusPin = document.createElement('label');
            sanctusPin.className = 'mw-default-pin';
            sanctusPin.title = 'Use this choice as my default next time';
            sanctusPin.innerHTML = '<input type="checkbox" class="mw-default-pin__input" data-mw-default-key="sanctus_tune" data-mw-default-value="default" /><span class="mw-default-pin__text">Default</span>';
            sanctusPin.addEventListener('click', function (e) { e.stopPropagation(); });
            var sanctusRow = defaultOpt.querySelector('.mw-option__row');
            if (sanctusRow) sanctusRow.appendChild(sanctusPin);
          }
          if (defaultOpt && defaultOpt.dataset.mwSanctusLangBound !== '1') {
            defaultOpt.dataset.mwSanctusLangBound = '1';
            defaultOpt.addEventListener('click', function (e) {
              if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val]')) return;
              Array.prototype.forEach.call(wrap.querySelectorAll(':scope > .mw-option'), function (c) {
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
          if ($('mw-generate')) $('mw-generate').addEventListener('click', function () {
            if (validateBeforeGenerate()) return;
            var g = $('btn-generate-flow'); if (g) g.click();
          });
          bindMassMissingOptionsModal();
          if ($('mw-present')) $('mw-present').addEventListener('click', function () {
            if (typeof window.reopenLastMassSlideshow === 'function') window.reopenLastMassSlideshow();
          });
          var massLang = $('flow-mass-language');
          if (massLang && massLang.dataset.mwLangBound !== '1') {
            massLang.dataset.mwLangBound = '1';
            massLang.addEventListener('change', function () {
              var lang = massLang.value === 'tagalog' ? 'tagalog' : 'english';
              if (lang === 'tagalog') {
                if ($('flow-creed-choice')) $('flow-creed-choice').value = 'apostles';
                if ($('flow-our-father-choice')) $('flow-our-father-choice').value = 'tagalog';
              } else {
                if ($('flow-creed-choice')) $('flow-creed-choice').value = 'nicene';
                if ($('flow-our-father-choice')) $('flow-our-father-choice').value = 'english';
              }
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
                window.reloadFlowReadingsForLanguage(md.value);
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
              var kind = chip.getAttribute('data-mw-link-media');
              var slot = chip.getAttribute('data-mw-media-slot');
              if (kind && slot && typeof window.openMassMediaPickModal === 'function') {
                window.openMassMediaPickModal(kind, slot);
              }
              return;
            }
            var audioPlay = e.target.closest('[data-mw-play-audio]');
            if (audioPlay && flowPage.contains(audioPlay)) {
              e.preventDefault();
              e.stopPropagation();
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
          document.addEventListener('mw:preview', function () { if (current === 7) fillReceipt(); refreshContinue(); });
          document.addEventListener('mw:aside-refresh', function () { if (current === 6) fillAside(6); });
          buildChoiceCards();
          ensureSanctusVideoOption();
          Array.prototype.forEach.call(flowPage.querySelectorAll('.mw-options[aria-label] .mw-option'), function (opt) {
            if (opt.getAttribute('data-val') === '__video' || opt.classList.contains('mw-option--video')) return;
            if (opt.dataset.mwWired === '1' || opt.dataset.mwSanctusLangBound === '1') return;
            if (opt.hasAttribute('data-val') && opt.closest('select[data-mw-tunes] + .mw-options')) return;
            opt.dataset.mwWired = '1';
            function pickStandalone() {
              var group = opt.closest('[role="radiogroup"]');
              var section = group && group.getAttribute('data-mw-media-section');
              if (group) Array.prototype.forEach.call(group.querySelectorAll(':scope > .mw-option'), function (c) {
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
            opt.addEventListener('click', function (e) { if (e.target.closest('[data-mw-text-preview], [data-mw-play-audio], [data-mw-play-youtube], [data-mw-play-video], [data-mw-link-media], [data-mw-link-youtube], [data-mw-clear-youtube], [data-mass-rite-slide-mode-val], select, .mw-video-lang-select')) { e.preventDefault(); return; } pickStandalone(); });
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
