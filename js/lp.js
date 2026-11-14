/**
 * KATE stage LASH — LP の動き
 * 方針: 枠は動かさず「枠の中」だけを動かす。発火は一度きり。
 *       <head> で html に付けた .js は、ここが起動できなかった場合に5秒で外れる（全文表示に戻る）。
 */
(function () {
    'use strict';

    var doc = document;
    var root = doc.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function safely(name, fn) {
        try { fn(); } catch (err) { if (window.console) { console.error('[lp] ' + name, err); } }
    }

    /* ---------- 流れる帯（タグ／ティッカー）: 中身を2周ぶん並べて -50% まで送る ---------- */
    function initMarquees() {
        function fill(track, labels, repeat) {
            var frag = doc.createDocumentFragment();
            for (var r = 0; r < repeat * 2; r++) {
                labels.forEach(function (label) {
                    var s = doc.createElement('span');
                    s.textContent = label;
                    frag.appendChild(s);
                });
            }
            track.textContent = '';
            track.appendChild(frag);
        }
        $$('[data-ticker]').forEach(function (t) { fill(t, [t.getAttribute('data-ticker')], 8); });
        $$('[data-tags]').forEach(function (t) { fill(t, t.getAttribute('data-tags').split('|'), 1); });
        $$('[data-dup]').forEach(function (row) {
            Array.prototype.slice.call(row.children).forEach(function (chip) { row.appendChild(chip.cloneNode(true)); });
        });
    }

    /* ---------- 見出しを1文字ずつに分ける（読み上げ用の原文は別に残す） ---------- */
    function initSplit() {
        $$('[data-split]').forEach(function (el) {
            var plain = el.textContent.replace(/\s+/g, '');
            var holder = doc.createElement('span');
            holder.setAttribute('aria-hidden', 'true');
            while (el.firstChild) { holder.appendChild(el.firstChild); }
            var index = 0;
            (function walk(node) {
                Array.prototype.slice.call(node.childNodes).forEach(function (child) {
                    if (child.nodeType === 3) {
                        var frag = doc.createDocumentFragment();
                        Array.from(child.textContent.replace(/\s+/g, '')).forEach(function (ch) {
                            var s = doc.createElement('span');
                            s.className = 'ch';
                            s.textContent = ch;
                            s.style.setProperty('--i', index++);
                            frag.appendChild(s);
                        });
                        node.replaceChild(frag, child);
                    } else if (child.nodeType === 1) {
                        walk(child);
                    }
                });
            })(holder);
            var sr = doc.createElement('span');
            sr.className = 'sr';
            sr.textContent = plain;
            el.appendChild(sr);
            el.appendChild(holder);
        });
    }

    /* ---------- 採用率のコマ: 100個の点を並べ、4つだけ印を付ける ---------- */
    function initDots() {
        $$('[data-dots]').forEach(function (grid) {
            var total = parseInt(grid.getAttribute('data-dots'), 10) || 0;
            var picks = (grid.getAttribute('data-pick') || '').split(',').map(Number);
            var frag = doc.createDocumentFragment();
            for (var n = 0; n < total; n++) {
                var dot = doc.createElement('i');
                var order = picks.indexOf(n);
                if (order !== -1) {
                    dot.className = 'is-pick';
                    dot.style.setProperty('--k', order);
                }
                frag.appendChild(dot);
            }
            grid.appendChild(frag);
        });
    }

    /* ---------- 数字のカウントアップ ---------- */
    function countUp(el) {
        if (reduce || el.getAttribute('data-counted')) { return; }
        el.setAttribute('data-counted', '1');
        var target = parseFloat(el.getAttribute('data-count'));
        var duration = 1500;
        var start = null;
        function frame(now) {
            if (start === null) { start = now; }
            var k = clamp((now - start) / duration, 0, 1);
            var eased = 1 - Math.pow(1 - k, 3);
            el.textContent = String(Math.round(target * eased));
            if (k < 1) { requestAnimationFrame(frame); } else { el.textContent = String(target); }
        }
        el.textContent = '0';
        requestAnimationFrame(frame);
    }

    /* ---------- スクロールで現れる ----------
       .rv は上端が少し入った時、data-io="0.5" などは指定した割合まで見えた時に一度だけ発火する */
    function initReveal() {
        var targets = $$('.rv, [data-io]');
        $$('[data-io]').forEach(function (list) {
            Array.prototype.slice.call(list.children).forEach(function (child, i) {
                child.style.setProperty('--i', i);
            });
        });

        function show(el) {
            el.classList.add('is-in');
            $$('[data-count]', el).forEach(countUp);
            if (el.classList.contains('must__seq')) {
                var must = el.closest('.must');
                if (must) { must.classList.add('is-lit'); }
            }
        }

        if (!('IntersectionObserver' in window)) {
            targets.forEach(show);
            return;
        }

        var observers = {};
        function observerFor(threshold) {
            var key = String(threshold);
            if (!observers[key]) {
                observers[key] = new IntersectionObserver(function (entries, io) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting) { return; }
                        show(entry.target);
                        io.unobserve(entry.target);
                    });
                }, { rootMargin: threshold > 0.2 ? '0px' : '0px 0px -8% 0px', threshold: threshold });
            }
            return observers[key];
        }

        targets.forEach(function (el) {
            var wanted = parseFloat(el.getAttribute('data-io'));
            var threshold = isNaN(wanted) ? 0.12 : wanted;
            /* 背の高い要素は、指定の割合が画面に収まらないことがあるので上限を設ける */
            var h = el.getBoundingClientRect().height || 1;
            var reachable = (window.innerHeight * 0.8) / h;
            observerFor(Math.round(Math.min(threshold, reachable) * 100) / 100).observe(el);
        });
    }

    /* ---------- ファーストビューのデザインノート: 打ち終えた瞬間に「目元」へ光を走らせる ---------- */
    function initTyping() {
        var line = $('[data-type]');
        var fv = $('.fv');
        if (!line || !fv || reduce) { return; }
        var done = $('[data-type-done]', line.parentNode);
        var full = line.getAttribute('data-type');
        var chars = Array.from(full);
        var visible = true;
        var timer = null;

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible && timer === null) { cycle(); }
            }).observe(fv);
        }

        function later(fn, ms) { timer = setTimeout(fn, ms); }

        function cycle() {
            if (!visible) { timer = null; return; }
            var i = 0;
            line.textContent = '';
            if (done) { done.style.visibility = 'hidden'; }
            (function tick() {
                line.textContent = chars.slice(0, ++i).join('');
                if (i < chars.length) { later(tick, 90); return; }
                later(function () {
                    if (done) { done.style.visibility = 'visible'; }
                    fv.classList.add('is-done');
                    later(function () {
                        fv.classList.remove('is-done');
                        later(cycle, 4200);
                    }, 1600);
                }, 520);
            })();
        }

        line.textContent = '';
        if (done) { done.style.visibility = 'hidden'; }
        later(cycle, 2500);

        /* 写真に触れると、その場でもう一度「目元」が光る */
        var stage = $('.fv__stage', fv);
        if (stage) {
            stage.addEventListener('click', function () {
                fv.classList.remove('is-done');
                void fv.offsetWidth;
                fv.classList.add('is-done');
                setTimeout(function () { fv.classList.remove('is-done'); }, 1600);
            });
        }
    }

    /* ---------- 山場の瞳: 触れるとリングが応える ---------- */
    function initTapPulse() {
        var stage = $('.must__stage');
        if (!stage || reduce) { return; }
        stage.addEventListener('click', function () {
            stage.classList.remove('is-tap');
            void stage.offsetWidth;
            stage.classList.add('is-tap');
            setTimeout(function () { stage.classList.remove('is-tap'); }, 1300);
        });
    }

    /* ---------- カルーセル（横スクロール＋スナップ。中央のカードを現在地とする） ---------- */
    function initCarousel(rootEl, options) {
        if (!rootEl) { return; }
        var track = $('.gcar__track, .vcar__track', rootEl);
        var dots = $('.dots', rootEl);
        if (!track || !dots) { return; }
        var cards = Array.prototype.slice.call(track.children);
        var current = 0;
        var timer = null;
        var visible = false;
        var touched = false;

        function centerOf(i) {
            var card = cards[i];
            return card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
        }
        function go(i) {
            current = (i + cards.length) % cards.length;
            track.scrollTo({ left: centerOf(current), behavior: reduce ? 'auto' : 'smooth' });
        }
        function mark() {
            var mid = track.scrollLeft + track.clientWidth / 2;
            var best = 0;
            var bestDistance = Infinity;
            cards.forEach(function (card, i) {
                var d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
                if (d < bestDistance) { bestDistance = d; best = i; }
            });
            current = best;
            cards.forEach(function (card, i) { card.classList.toggle('is-active', i === best); });
            Array.prototype.slice.call(dots.children).forEach(function (dot, i) {
                dot.setAttribute('aria-current', i === best ? 'true' : 'false');
            });
        }
        function stopAuto() { touched = true; clearInterval(timer); }

        cards.forEach(function (card, i) {
            if (options.pick) {
                card.addEventListener('click', function () { stopAuto(); go(i); });
            }
            var dot = doc.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', (i + 1) + '枚目を表示');
            dot.addEventListener('click', function () { stopAuto(); go(i); });
            dots.appendChild(dot);
        });
        $$('[data-dir]', rootEl).forEach(function (button) {
            button.addEventListener('click', function () {
                stopAuto();
                go(current + parseInt(button.getAttribute('data-dir'), 10));
            });
        });

        var raf = 0;
        track.addEventListener('scroll', function () {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(mark);
        }, { passive: true });
        ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (type) {
            track.addEventListener(type, stopAuto, { passive: true });
        });
        window.addEventListener('resize', function () { track.scrollTo({ left: centerOf(current) }); });

        /* 自動送りは写真のカルーセルだけ。触れた時点で止め、以後は利用者の操作に任せる */
        if (options.auto && !reduce && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.6 }).observe(rootEl);
            timer = setInterval(function () {
                if (!touched && visible && !doc.hidden) { go(current + 1); }
            }, options.auto);
        }

        /* 初めて見えた時に少しだけ送って戻し、横に続きがあることを伝える */
        if (options.nudge && !reduce && 'IntersectionObserver' in window) {
            var nudged = new IntersectionObserver(function (entries) {
                if (!entries[0].isIntersecting) { return; }
                nudged.disconnect();
                setTimeout(function () {
                    if (touched) { return; }
                    track.scrollBy({ left: 72, behavior: 'smooth' });
                    setTimeout(function () { if (!touched) { go(0); } }, 650);
                }, 700);
            }, { threshold: 0.7 });
            nudged.observe(track);
        }

        requestAnimationFrame(function () {
            track.scrollTo({ left: centerOf(0) });
            mark();
        });
    }

    /* ---------- スクロール連動: 金のレール／5つの丸／追従CTA／目次の現在地 ---------- */
    function initScrollLinked() {
        var railSteps = $('.rail__steps');
        var railLine = $('.rail__line');
        var steps = $$('.step');
        var promises = $$('[data-promise]');
        var fiveDots = $$('.five__list span');
        var fv = $('.fv');
        var closing = $('#reserve');
        var dock = $('#dock');
        var links = $$('#index a');
        var sections = links.map(function (a) { return $(a.getAttribute('href')); });

        function update() {
            var vh = window.innerHeight;

            if (railSteps && railLine) {
                var r = railSteps.getBoundingClientRect();
                railLine.style.setProperty('--p', clamp((vh * 0.62 - r.top) / r.height, 0, 1).toFixed(3));
                steps.forEach(function (step) {
                    step.classList.toggle('is-lit', step.getBoundingClientRect().top < vh * 0.62);
                });
            }

            var seen = -1;
            promises.forEach(function (p, i) { if (p.getBoundingClientRect().top < vh * 0.72) { seen = i; } });
            fiveDots.forEach(function (dot, i) { dot.classList.toggle('is-on', i <= seen); });

            if (dock && fv && closing) {
                dock.classList.toggle('is-on', fv.getBoundingClientRect().bottom < 0 && closing.getBoundingClientRect().top > vh * 0.72);
            }

            var currentIndex = 0;
            sections.forEach(function (section, i) {
                if (section && section.getBoundingClientRect().top < vh * 0.42) { currentIndex = i; }
            });
            links.forEach(function (a, i) {
                var on = i === currentIndex;
                a.classList.toggle('is-current', on);
                if (on) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
            });
        }

        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) { return; }
            ticking = true;
            requestAnimationFrame(function () { update(); ticking = false; });
        }, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ---------- よくあるご質問（開くのは一つだけ） ---------- */
    function initFaq() {
        var items = $$('.qa');
        items.forEach(function (item) {
            var button = $('.qa__q', item);
            if (!button) { return; }
            button.addEventListener('click', function () {
                var willOpen = !item.classList.contains('is-open');
                items.forEach(function (other) {
                    other.classList.remove('is-open');
                    var b = $('.qa__q', other);
                    if (b) { b.setAttribute('aria-expanded', 'false'); }
                });
                if (willOpen) {
                    item.classList.add('is-open');
                    button.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }

    /* ---------- 目次シート（スマホ・タブレット） ---------- */
    function initIndexSheet() {
        var sheet = $('#indexSheet');
        var source = $('#index');
        if (!sheet || !source) { return; }
        var list = $('.index--sheet', sheet);
        var openers = $$('[data-index-open]');
        var closeButton = $('[data-index-close]', sheet);
        var lastOpener = null;
        var hideTimer = null;

        $$('a', source).forEach(function (a) {
            var li = doc.createElement('li');
            var link = doc.createElement('a');
            link.href = a.getAttribute('href');
            link.textContent = a.textContent;
            li.appendChild(link);
            list.appendChild(li);
        });

        function setExpanded(value) {
            openers.forEach(function (o) { o.setAttribute('aria-expanded', value ? 'true' : 'false'); });
        }
        function open(opener) {
            clearTimeout(hideTimer);
            lastOpener = opener;
            sheet.hidden = false;
            void sheet.offsetWidth;
            sheet.classList.add('is-open');
            doc.body.style.overflow = 'hidden';
            setExpanded(true);
            if (closeButton) { closeButton.focus(); }
        }
        function close() {
            if (sheet.hidden) { return; }
            sheet.classList.remove('is-open');
            doc.body.style.overflow = '';
            setExpanded(false);
            hideTimer = setTimeout(function () { sheet.hidden = true; }, reduce ? 0 : 500);
            if (lastOpener) { lastOpener.focus(); }
        }

        openers.forEach(function (opener) {
            opener.addEventListener('click', function () { open(opener); });
        });
        if (closeButton) { closeButton.addEventListener('click', close); }
        sheet.addEventListener('click', function (event) {
            if (event.target === sheet || event.target.closest('a')) { close(); }
        });
        doc.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') { close(); }
        });
    }

    /* ---------- コピーライトの年 ---------- */
    function initCopyright() {
        var el = $('.copyright');
        if (el) { el.innerHTML = el.innerHTML.replace(/\d{4}/, String(new Date().getFullYear())); }
    }

    function init() {
        safely('marquees', initMarquees);
        safely('split', initSplit);
        safely('dots', initDots);
        try {
            initReveal();
            clearTimeout(window.__lpGuard);
        } catch (err) {
            /* 現れる演出が組めなかった時は、隠さずに全文を見せる */
            root.classList.remove('js');
            if (window.console) { console.error('[lp] reveal', err); }
        }
        safely('typing', initTyping);
        safely('tap', initTapPulse);
        safely('gallery', function () { initCarousel($('[data-carousel="gallery"]'), { auto: 3600, pick: true }); });
        safely('voice', function () { initCarousel($('[data-carousel="voice"]'), { auto: 0, nudge: true }); });
        safely('scroll', initScrollLinked);
        safely('faq', initFaq);
        safely('index', initIndexSheet);
        safely('copyright', initCopyright);
    }

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
