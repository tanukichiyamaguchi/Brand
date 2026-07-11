/* =====================================================
   KATE stage LASH - Motion (GSAP + ScrollTrigger)
   演出の設計方針:
   - 初期非表示はJSでのみ行う（GSAP未読込時も全文が見える）
   - アニメ対象はtransform / opacity / clip-pathのみ
   - reveal系はonce:true、常時稼働はscrub最小限
   ===================================================== */
(function () {
    'use strict';

    if (typeof gsap === 'undefined') {
        // GSAP未読込: 何も隠していないため、静的表示のまま劣化なし
        return;
    }

    if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
    }

    var mm = gsap.matchMedia();

    // ==============================================
    // Reduced Motion: 全静止・最終状態を即時表示
    // ==============================================
    mm.add('(prefers-reduced-motion: reduce)', function () {
        document.querySelectorAll('.js-count').forEach(function (el) {
            el.textContent = el.dataset.end || el.textContent;
        });
    });

    // ==============================================
    // Motion有効
    // ==============================================
    mm.add('(prefers-reduced-motion: no-preference)', function () {
        initHeroTimeline();
        initSectionHeaders();
        initReveals();
        initCounters();
        initTableStagger();
        initTimelineSpine();
        initLashLines();
        initQuoteChars();
        initFinalCta();
        initParallax();
        initScrollProgress();
    });

    // ----------------------------------------------
    // hero入場タイムライン（プリローダー退場後に開始）
    // ----------------------------------------------
    function initHeroTimeline() {
        var heroEls = {
            tagline: document.querySelector('.hero-tagline'),
            titleLines: document.querySelectorAll('.hero-title-line'),
            cta: document.querySelector('.hero-cta'),
            scroll: document.querySelector('.hero-scroll')
        };
        if (!heroEls.titleLines.length) return;

        // 初期状態をJSで設定（CSSでは隠さない）
        gsap.set([heroEls.tagline, heroEls.cta, heroEls.scroll], { autoAlpha: 0, y: 16 });
        gsap.set(heroEls.titleLines, { autoAlpha: 0, y: 34, clipPath: 'inset(-15% 0 102% 0)' });

        function play() {
            var heroVideo = document.querySelector('.hero-video');
            var tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.9 } });
            // 映像がゆっくり据わる（シネマティックな入り）
            if (heroVideo) {
                tl.fromTo(heroVideo, { scale: 1.08 }, { scale: 1, duration: 3.0, ease: 'power2.out' }, 0);
            }
            tl.to(heroEls.tagline, { autoAlpha: 1, y: 0 }, 0.15)
              // 見出しは行ごとに幕が上がるマスクリベール
              .to(heroEls.titleLines, {
                  autoAlpha: 1, y: 0, clipPath: 'inset(-15% 0 -18% 0)',
                  duration: 1.15, ease: 'power4.out', stagger: 0.16
              }, 0.3)
              .set(heroEls.titleLines, { clearProps: 'clipPath' })
              .to(heroEls.cta, { autoAlpha: 1, y: 0 }, 0.85)
              .to(heroEls.scroll, { autoAlpha: 1, y: 0, duration: 0.6 }, 1.1);
        }

        if (document.body.classList.contains('no-scroll')) {
            // プリローダー表示中 → 退場イベントを待つ
            document.addEventListener('preloader:done', play, { once: true });
        } else {
            play();
        }
    }

    // ----------------------------------------------
    // セクション見出し: ラベルの字間が締まり、
    // 見出しが幕上げマスクで立ち上がる
    // ----------------------------------------------
    function initSectionHeaders() {
        if (typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll('.section-header').forEach(function (header) {
            var label = header.querySelector('.section-label');
            var title = header.querySelector('.section-title');
            if (!title) return;

            if (label) gsap.set(label, { autoAlpha: 0, y: 10, letterSpacing: '0.34em' });
            gsap.set(title, { autoAlpha: 0, y: 30, clipPath: 'inset(-15% 0 104% 0)' });

            ScrollTrigger.create({
                trigger: header,
                start: 'top 84%',
                once: true,
                onEnter: function () {
                    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
                    if (label) tl.to(label, { autoAlpha: 1, y: 0, letterSpacing: '0.2em', duration: 0.9 }, 0);
                    tl.to(title, {
                        autoAlpha: 1, y: 0, clipPath: 'inset(-15% 0 -15% 0)', duration: 1.1
                    }, 0.12)
                      .set(title, { clearProps: 'clipPath' });
                }
            });
        });
    }

    // ----------------------------------------------
    // 汎用reveal: data-animate="up|fade|clip|stagger"
    // ----------------------------------------------
    function initReveals() {
        if (typeof ScrollTrigger === 'undefined') return;

        // 上方向フェード（section-headerは専用演出に委譲）
        document.querySelectorAll('[data-animate="up"]').forEach(function (el) {
            if (el.classList.contains('section-header')) return;
            gsap.set(el, { autoAlpha: 0, y: 24 });
            ScrollTrigger.create({
                trigger: el,
                start: 'top 85%',
                once: true,
                onEnter: function () {
                    el.style.willChange = 'transform, opacity';
                    gsap.to(el, {
                        autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out',
                        onComplete: function () { el.style.willChange = 'auto'; }
                    });
                }
            });
        });

        // 単純フェード
        document.querySelectorAll('[data-animate="fade"]').forEach(function (el) {
            gsap.set(el, { autoAlpha: 0 });
            ScrollTrigger.create({
                trigger: el,
                start: 'top 85%',
                once: true,
                onEnter: function () {
                    gsap.to(el, { autoAlpha: 1, duration: 1.0, ease: 'power2.out' });
                }
            });
        });

        // 画像クリップリベール（幕が上がる）
        document.querySelectorAll('[data-animate="clip"]').forEach(function (wrap) {
            var img = wrap.querySelector('img');
            gsap.set(wrap, { clipPath: 'inset(0 0 100% 0)' });
            if (img) gsap.set(img, { scale: 1.12 });
            ScrollTrigger.create({
                trigger: wrap,
                start: 'top 82%',
                once: true,
                onEnter: function () {
                    gsap.to(wrap, { clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power4.inOut' });
                    if (img) gsap.to(img, { scale: 1, duration: 1.5, ease: 'power2.out' });
                }
            });
        });

        // 子要素stagger（カード群・リスト）
        document.querySelectorAll('[data-animate="stagger"]').forEach(function (parent) {
            var children = Array.prototype.slice.call(parent.children, 0, 8);
            if (!children.length) return;
            gsap.set(children, { autoAlpha: 0, y: 20 });
            ScrollTrigger.create({
                trigger: parent,
                start: 'top 82%',
                once: true,
                onEnter: function () {
                    gsap.to(children, {
                        autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.09
                    });
                }
            });
        });
    }

    // ----------------------------------------------
    // 数字カウントアップ（37日・380時間・4%）
    // ----------------------------------------------
    function initCounters() {
        if (typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll('.js-count').forEach(function (el) {
            var end = parseInt(el.dataset.end, 10);
            if (isNaN(end)) return;
            var obj = { v: 0 };
            ScrollTrigger.create({
                trigger: el,
                start: 'top 85%',
                once: true,
                onEnter: function () {
                    gsap.to(obj, {
                        v: end,
                        duration: 1.6,
                        ease: 'power2.out',
                        snap: { v: 1 },
                        onUpdate: function () { el.textContent = obj.v; },
                        onComplete: function () {
                            // 数字が着地した瞬間のわずかな弾み
                            var value = el.closest('.stat-value');
                            if (value) {
                                gsap.fromTo(value, { scale: 1 }, {
                                    scale: 1.06, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.inOut'
                                });
                            }
                        }
                    });
                }
            });
        });
    }

    // ----------------------------------------------
    // 比較テーブル行stagger + KATE列ハイライト
    // ----------------------------------------------
    function initTableStagger() {
        if (typeof ScrollTrigger === 'undefined') return;

        var table = document.querySelector('.comparison-table');
        if (!table) return;
        var rows = table.querySelectorAll('tbody tr');
        if (!rows.length) return;

        gsap.set(rows, { autoAlpha: 0, y: 20 });
        ScrollTrigger.create({
            trigger: table,
            start: 'top 80%',
            once: true,
            onEnter: function () {
                gsap.to(rows, {
                    autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.09,
                    onComplete: function () {
                        table.classList.add('is-revealed');
                    }
                });
            }
        });
    }

    // ----------------------------------------------
    // まつ育タイムラインの背骨線（scrub描画+ドット点灯）
    // ----------------------------------------------
    function initTimelineSpine() {
        if (typeof ScrollTrigger === 'undefined') return;

        var spine = document.querySelector('.timeline-spine');
        var timeline = document.querySelector('.continuity-timeline');
        if (!spine || !timeline) return;

        gsap.fromTo(spine, { scaleY: 0 }, {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: timeline,
                start: 'top 72%',
                end: 'bottom 62%',
                scrub: 0.6
            }
        });

        // 各項目は背骨の進行に合わせて点灯
        timeline.querySelectorAll('.timeline-item').forEach(function (item) {
            ScrollTrigger.create({
                trigger: item,
                start: 'top 70%',
                once: true,
                onEnter: function () { item.classList.add('is-active'); }
            });
        });
    }

    // ----------------------------------------------
    // ラッシュライン: まつ毛カーブがstroke描画される
    // ----------------------------------------------
    function initLashLines() {
        if (typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll('[data-lash]').forEach(function (wrap) {
            // final-ctaのlash-lineは専用タイムライン(initFinalCta)が所有
            if (wrap.closest('.final-cta')) return;
            var arc = wrap.querySelector('.lash-arc');
            var hairs = wrap.querySelectorAll('.lash-hair');
            if (!arc) return;

            var arcLen = arc.getTotalLength();
            gsap.set(arc, { strokeDasharray: arcLen, strokeDashoffset: arcLen });
            hairs.forEach(function (h) {
                var len = h.getTotalLength();
                gsap.set(h, { strokeDasharray: len, strokeDashoffset: len });
            });

            ScrollTrigger.create({
                trigger: wrap,
                start: 'top 82%',
                once: true,
                onEnter: function () {
                    var tl = gsap.timeline();
                    tl.to(arc, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' })
                      .to(hairs, {
                          strokeDashoffset: 0,
                          duration: 0.5,
                          ease: 'power2.out',
                          stagger: 0.08
                      }, '-=0.35');
                }
            });
        });
    }

    // ----------------------------------------------
    // 控えめなパララックス（scrub 2箇所のみ）
    // ----------------------------------------------
    function initParallax() {
        if (typeof ScrollTrigger === 'undefined') return;

        var heroVideoWrapper = document.querySelector('.hero-video-wrapper');
        if (heroVideoWrapper) {
            gsap.to(heroVideoWrapper, {
                yPercent: 12,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.hero',
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 0.6
                }
            });
        }

        var visualBreak = document.querySelector('.visual-break-intro .visual-break-image img');
        if (visualBreak) {
            gsap.to(visualBreak, {
                yPercent: -8,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.visual-break-intro',
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 0.6
                }
            });
        }
    }

    // ----------------------------------------------
    // visual-breakの一文: 1文字ずつのマスク立ち上がり
    // （GSAP実行時のみ分割 → 未読込時は元の全文表示）
    // ----------------------------------------------
    function initQuoteChars() {
        if (typeof ScrollTrigger === 'undefined') return;
        var quote = document.querySelector('.visual-break-quote');
        if (!quote || quote.dataset.charsReady) return;
        quote.dataset.charsReady = '1';

        var original = quote.textContent.replace(/\s+/g, '');
        quote.setAttribute('aria-label', original);

        var nodes = Array.prototype.slice.call(quote.childNodes);
        quote.textContent = '';
        nodes.forEach(function (node) {
            if (node.nodeType === 3) {
                node.textContent.split('').forEach(function (ch) {
                    if (!ch.trim()) return;
                    var outer = document.createElement('span');
                    outer.className = 'q-ch';
                    outer.setAttribute('aria-hidden', 'true');
                    var inner = document.createElement('span');
                    inner.className = 'q-ch-inner';
                    inner.textContent = ch;
                    outer.appendChild(inner);
                    quote.appendChild(outer);
                });
            } else if (node.nodeName === 'BR') {
                quote.appendChild(node);
            }
        });

        var chars = quote.querySelectorAll('.q-ch-inner');
        gsap.set(chars, { yPercent: 112 });
        ScrollTrigger.create({
            trigger: quote,
            start: 'top 80%',
            once: true,
            onEnter: function () {
                gsap.to(chars, {
                    yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.035
                });
            }
        });
    }

    // ----------------------------------------------
    // final-cta: lash描画→見出し→リスト→ボタンの単一タイムライン
    // ----------------------------------------------
    function initFinalCta() {
        if (typeof ScrollTrigger === 'undefined') return;
        var section = document.querySelector('.final-cta');
        if (!section) return;
        var title = section.querySelector('.final-cta-title');
        if (!title) return;
        var items = section.querySelectorAll('.final-cta-list li');
        var btn = section.querySelector('.btn');
        var note = section.querySelector('.final-cta-note');
        var lash = section.querySelector('[data-lash]');
        var arc = lash && lash.querySelector('.lash-arc');
        var hairs = lash ? lash.querySelectorAll('.lash-hair') : [];

        gsap.set(title, { autoAlpha: 0, y: 26, clipPath: 'inset(-15% 0 104% 0)' });
        if (items.length) gsap.set(items, { autoAlpha: 0, y: 18 });
        if (btn) gsap.set(btn, { autoAlpha: 0, y: 16 });
        if (note) gsap.set(note, { autoAlpha: 0 });
        if (arc) {
            var arcLen = arc.getTotalLength();
            gsap.set(arc, { strokeDasharray: arcLen, strokeDashoffset: arcLen });
            hairs.forEach(function (h) {
                var len = h.getTotalLength();
                gsap.set(h, { strokeDasharray: len, strokeDashoffset: len });
            });
        }

        ScrollTrigger.create({
            trigger: section,
            start: 'top 72%',
            once: true,
            onEnter: function () {
                var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
                if (arc) {
                    tl.to(arc, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
                      .to(hairs, {
                          strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08
                      }, 0.75);
                }
                tl.to(title, {
                    autoAlpha: 1, y: 0, clipPath: 'inset(-15% 0 -15% 0)',
                    duration: 1.05, ease: 'power4.out'
                }, arc ? 0.9 : 0)
                  .set(title, { clearProps: 'clipPath' });
                if (items.length) tl.to(items, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.5');
                if (btn) tl.to(btn, { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.35');
                if (note) tl.to(note, { autoAlpha: 1, duration: 0.6 }, '-=0.4');
            }
        });
    }

    // ----------------------------------------------
    // ページ最上部のスクロール進捗（シャンパンの金線）
    // ----------------------------------------------
    function initScrollProgress() {
        if (typeof ScrollTrigger === 'undefined') return;
        var bar = document.querySelector('.scroll-progress');
        if (!bar) return;

        gsap.to(bar, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
                start: 0,
                end: 'max',
                scrub: 0.4
            }
        });
    }
})();
