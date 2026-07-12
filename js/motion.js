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

    // モバイルでは「ブロック丸ごと」ではなく中身を1つずつ見せる。
    // 背の高いコンテナ（2〜3画面ぶん）はコンテナreveal対象から外し、
    // 内側のアイテムが視界に入るたびに立ち上がる。
    // ※ mm.addのコールバックは同期実行されるため、必ずこの定義を先に置く
    var SPLIT_CONTAINERS = [
        '.continuity-philosophy', '.continuity-serum', '.continuity-cycle',
        '.menu-category', '.faq-list', '.set-recommend-content',
        '.eyebrow-golden', '.eyebrow-bone', '.eyebrow-wax', '.eyebrow-domestic',
        '.flow-steps'
    ].join(', ');

    var MOBILE_ITEMS = [
        '.continuity-philosophy-title', '.philosophy-item',
        '.continuity-serum-title', '.continuity-serum-price', '.continuity-serum-desc',
        '.continuity-serum-features li', '.continuity-serum-image',
        '.continuity-cycle-title', '.continuity-cycle-desc', '.timeline-item',
        '.menu-category-title', '.menu-item',
        '.faq-item',
        '.set-benefit', '.set-recommend-cta',
        '.eyebrow-golden-title', '.eyebrow-golden-text > p', '.eyebrow-golden-points li', '.eyebrow-golden-image',
        '.eyebrow-promises li',
        '.eyebrow-bone-title', '.eyebrow-bone-desc', '.bone-type', '.eyebrow-bone-note',
        '.eyebrow-wax-title', '.eyebrow-wax-text > p', '.eyebrow-wax-image', '.wax-benefit',
        '.eyebrow-domestic-title', '.eyebrow-domestic-desc', '.domestic-point',
        '.flow-step'
    ].join(', ');

    // ==============================================
    // 幅×モーション設定をgsap.matchMediaの条件で管理
    // （回転などでブレークポイントを跨いだら自動で作り直す）
    // ==============================================
    mm.add({
        reduce: '(prefers-reduced-motion: reduce)',
        mobileW: '(max-width: 768px)'
    }, function (ctx) {
        var c = ctx.conditions;

        if (c.reduce) {
            // 全静止・最終状態を即時表示
            document.querySelectorAll('.js-count').forEach(function (el) {
                el.textContent = el.dataset.end || el.textContent;
            });
            return;
        }

        // モバイルは「発火を遅く・動きを大きく・アイテム単位で逐次」
        var P = c.mobileW ? {
            mobile: true,
            upStart: 'top 86%',  upY: 32, upDur: 0.95,
            headerStart: 'top 86%', titleY: 36, titleDur: 1.2,
            clipStart: 'top 84%', clipDur: 1.3,
            staggerStart: 'top 84%', staggerGap: 0.12,
            itemStart: 'top 88%', itemY: 28, itemDur: 0.85,
            countStart: 'top 80%', countDur: 2.0,
            tableStart: 'top 88%',
            lashStart: 'top 84%', lashDur: 1.5,
            quoteStart: 'top 82%', quoteStagger: 0.05,
            finalStart: 'top 76%'
        } : {
            mobile: false,
            upStart: 'top 85%',  upY: 24, upDur: 0.8,
            headerStart: 'top 84%', titleY: 30, titleDur: 1.1,
            clipStart: 'top 82%', clipDur: 1.1,
            staggerStart: 'top 82%', staggerGap: 0.09,
            itemStart: 'top 88%', itemY: 24, itemDur: 0.8,
            countStart: 'top 85%', countDur: 1.6,
            tableStart: 'top 80%',
            lashStart: 'top 82%', lashDur: 1.2,
            quoteStart: 'top 80%', quoteStagger: 0.035,
            finalStart: 'top 72%'
        };

        // heroの入場は初回のみ（回転での再生を防ぐ。revertで表示状態には戻る）
        if (!initHeroTimeline._done) {
            initHeroTimeline();
            initHeroTimeline._done = true;
        }
        initSectionHeaders(P);
        initReveals(P);
        initMobileItems(P);
        initCounters(P);
        initTableStagger(P);
        initTimelineSpine();
        initLashLines(P);
        initQuoteChars(P);
        initFinalCta(P);
        initParallax();
        initScrollProgress();
    });

    function initMobileItems(P) {
        if (!P.mobile || typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll(MOBILE_ITEMS).forEach(function (el) {
            gsap.set(el, { autoAlpha: 0, y: P.itemY });
            ScrollTrigger.create({
                trigger: el,
                start: P.itemStart,
                once: true,
                onEnter: function () {
                    gsap.to(el, { autoAlpha: 1, y: 0, duration: P.itemDur, ease: 'power3.out' });
                }
            });
        });
    }

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
    function initSectionHeaders(P) {
        if (typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll('.section-header').forEach(function (header) {
            var label = header.querySelector('.section-label');
            var title = header.querySelector('.section-title');
            if (!title) return;

            if (label) gsap.set(label, { autoAlpha: 0, y: 10, letterSpacing: '0.34em' });
            gsap.set(title, { autoAlpha: 0, y: P.titleY, clipPath: 'inset(-15% 0 104% 0)' });

            ScrollTrigger.create({
                trigger: header,
                start: P.headerStart,
                once: true,
                onEnter: function () {
                    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
                    if (label) tl.to(label, { autoAlpha: 1, y: 0, letterSpacing: '0.2em', duration: 0.9 }, 0);
                    tl.to(title, {
                        autoAlpha: 1, y: 0, clipPath: 'inset(-15% 0 -15% 0)', duration: P.titleDur
                    }, 0.12)
                      .set(title, { clearProps: 'clipPath' });
                }
            });
        });
    }

    // ----------------------------------------------
    // 汎用reveal: data-animate="up|fade|clip|stagger"
    // ----------------------------------------------
    function initReveals(P) {
        if (typeof ScrollTrigger === 'undefined') return;

        // 上方向フェード（section-headerは専用演出、
        // モバイルでは背の高いコンテナをアイテム分解に委譲）
        document.querySelectorAll('[data-animate="up"]').forEach(function (el) {
            if (el.classList.contains('section-header')) return;
            if (P.mobile && el.matches(SPLIT_CONTAINERS)) return;
            gsap.set(el, { autoAlpha: 0, y: P.upY });
            ScrollTrigger.create({
                trigger: el,
                start: P.upStart,
                once: true,
                onEnter: function () {
                    el.style.willChange = 'transform, opacity';
                    gsap.to(el, {
                        autoAlpha: 1, y: 0, duration: P.upDur, ease: 'power3.out',
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
                start: P.upStart,
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
                start: P.clipStart,
                once: true,
                onEnter: function () {
                    gsap.to(wrap, { clipPath: 'inset(0 0 0% 0)', duration: P.clipDur, ease: 'power4.inOut' });
                    if (img) gsap.to(img, { scale: 1, duration: P.clipDur + 0.4, ease: 'power2.out' });
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
                start: P.staggerStart,
                once: true,
                onEnter: function () {
                    gsap.to(children, {
                        autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: P.staggerGap
                    });
                }
            });
        });
    }

    // ----------------------------------------------
    // 数字カウントアップ（37日・380時間・4%）
    // ----------------------------------------------
    function initCounters(P) {
        if (typeof ScrollTrigger === 'undefined') return;

        document.querySelectorAll('.js-count').forEach(function (el) {
            var end = parseInt(el.dataset.end, 10);
            if (isNaN(end)) return;
            var obj = { v: 0 };
            ScrollTrigger.create({
                trigger: el,
                start: P.countStart,
                once: true,
                onEnter: function () {
                    gsap.to(obj, {
                        v: end,
                        duration: P.countDur,
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
    function initTableStagger(P) {
        if (typeof ScrollTrigger === 'undefined') return;

        var table = document.querySelector('.comparison-table');
        if (!table) return;
        var rows = table.querySelectorAll('tbody tr');
        if (!rows.length) return;

        gsap.set(rows, { autoAlpha: 0, y: 20 });

        if (P.mobile) {
            // モバイル: テーブルは1.5画面ぶんあるため、行ごとに視界に入った時点で立ち上げる
            var remaining = rows.length;
            rows.forEach(function (row) {
                ScrollTrigger.create({
                    trigger: row,
                    start: P.tableStart,
                    once: true,
                    onEnter: function () {
                        gsap.to(row, {
                            autoAlpha: 1, y: 0, duration: 0.75, ease: 'power3.out',
                            onComplete: function () {
                                remaining -= 1;
                                if (remaining === 0) table.classList.add('is-revealed');
                            }
                        });
                    }
                });
            });
            return;
        }

        ScrollTrigger.create({
            trigger: table,
            start: P.tableStart,
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
    function initLashLines(P) {
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
                start: P.lashStart,
                once: true,
                onEnter: function () {
                    var tl = gsap.timeline();
                    tl.to(arc, { strokeDashoffset: 0, duration: P.lashDur, ease: 'power2.inOut' })
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
    function initQuoteChars(P) {
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
            start: P.quoteStart,
            once: true,
            onEnter: function () {
                gsap.to(chars, {
                    yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: P.quoteStagger
                });
            }
        });
    }

    // ----------------------------------------------
    // final-cta: lash描画→見出し→リスト→ボタンの単一タイムライン
    // ----------------------------------------------
    function initFinalCta(P) {
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
            start: P.finalStart,
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
