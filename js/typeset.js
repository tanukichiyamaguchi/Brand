/* =====================================================
   KATE stage LASH - Japanese Typesetting (BudouX)
   本文テキストに<wbr>を挿入し、文節単位の自然な改行を実現する。
   BudouX未読込・JS無効時はCSSのoverflow-wrap: break-wordで劣化なし。
   ===================================================== */
(function () {
    'use strict';

    // BudouXで処理する本文系要素（見出しは手動.u-phraseで制御するため対象外）
    var TARGET_SELECTOR = [
        '.js-phrase',
        '.section-subtitle',
        '.introduction-text p',
        '.introduction-lead',
        '.feature-text',
        '.comparison-table td',
        '.comparison-message p',
        '.philosophy-desc',
        '.continuity-serum-desc',
        '.continuity-serum-features span:last-child',
        '.continuity-cycle-desc',
        '.continuity-cta-text',
        '.timeline-content p',
        '.eyebrow-golden-desc',
        '.eyebrow-golden-text > p',
        '.eyebrow-golden-note',
        '.eyebrow-bone-desc',
        '.eyebrow-bone-note',
        '.bone-type p',
        '.eyebrow-wax-text > p',
        '.wax-benefit p',
        '.eyebrow-domestic-desc',
        '.domestic-point p',
        '.set-recommend-lead',
        '.set-benefit-content p',
        '.set-recommend-cta-text',
        '.flow-step-text',
        '.testimonial-text',
        '.menu-item-description',
        '.menu-cta-text',
        '.faq-answer p',
        '.final-cta-text',
        '.footer-tagline'
    ].join(', ');

    // 行頭に来てはいけない文字（BudouX出力への安全弁）
    var KINSOKU_HEAD = '、。，．・：；？！ゝゞ々ー」』）〉》〕｝】';

    function mergeKinsoku(segments) {
        var merged = [];
        segments.forEach(function (seg) {
            if (merged.length > 0 && KINSOKU_HEAD.indexOf(seg.charAt(0)) !== -1) {
                merged[merged.length - 1] += seg;
            } else {
                merged.push(seg);
            }
        });
        return merged;
    }

    function walkTextNodes(node, callback) {
        // 子要素(<strong>等)を保持したままテキストノードだけを処理する
        var children = Array.prototype.slice.call(node.childNodes);
        children.forEach(function (child) {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent.trim().length > 1) {
                    callback(child);
                }
            } else if (child.nodeType === Node.ELEMENT_NODE &&
                       child.tagName !== 'BR' && child.tagName !== 'WBR' &&
                       !child.classList.contains('u-nobr')) {
                walkTextNodes(child, callback);
            }
        });
    }

    function typeset() {
        if (typeof budoux === 'undefined') {
            return;
        }
        var parser = budoux.loadDefaultJapaneseParser();
        var targets = document.querySelectorAll(TARGET_SELECTOR);

        targets.forEach(function (el) {
            if (el.classList.contains('is-typeset')) {
                return;
            }
            walkTextNodes(el, function (textNode) {
                var segments = mergeKinsoku(parser.parse(textNode.textContent));
                if (segments.length < 2) {
                    return;
                }
                var frag = document.createDocumentFragment();
                segments.forEach(function (seg, i) {
                    if (i > 0) {
                        frag.appendChild(document.createElement('wbr'));
                    }
                    frag.appendChild(document.createTextNode(seg));
                });
                textNode.parentNode.replaceChild(frag, textNode);
            });
            el.classList.add('is-typeset');
        });

        document.documentElement.classList.add('typeset-done');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', typeset);
    } else {
        typeset();
    }
})();
