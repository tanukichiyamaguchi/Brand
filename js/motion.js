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
        initReveals();
        initCounters();
        initTableStagger();
        initTimelineSpine();
        initLashLines();
        initParallax();
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
        gsap.set(heroEls.titleLines, { autoAlpha: 0, y: 28 });

        function play() {
            var tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.9 } });
            tl.to(heroEls.tagline, { autoAlpha: 1, y: 0 }, 0.15)
              .to(heroEls.titleLines, { autoAlpha: 1, y: 0, stagger: 0.14 }, 0.3)
              .to(heroEls.cta, { autoAlpha: 1, y: 0 }, 0.7)
              .to(heroEls.scroll, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.95);
        }

        if (document.body.classList.contains('no-scroll')) {
            // プリローダー表示中 → 退場イベントを待つ
            document.addEventListener('preloader:done', play, { once: true });
        } else {
            play();
        }
    }

    // ----------------------------------------------
    // 汎用reveal: data-animate="up|fade|clip|stagger"
    // ----------------------------------------------
    function initReveals() {
        if (typeof ScrollTrigger === 'undefined') return;

        // 上方向フェード
        document.querySelectorAll('[data-animate="up"]').forEach(function (el) {
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
                        onUpdate: function () { el.textContent = obj.v; }
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
})();
