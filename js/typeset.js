/* =====================================================
   KATE stage LASH - Japanese Typesetting (BudouX)
   本文テキストに<wbr>を挿入し、文節単位の自然な改行を実現する。
   BudouX未読込・JS無効時は通常の折り返しになるだけで、内容は欠けない。
   ===================================================== */
(function () {
    'use strict';

    // BudouXで処理する本文系要素。見出しは <br> で手動制御するため対象外
    var TARGET_SELECTOR = [
        '.js-phrase',
        '.promise__body',
        '.step__ttl',
        '.step__txt',
        '.steps__list h3',
        '.steps__list p',
        '.benefits h3',
        '.benefits p',
        '.ratio__list span',
        '.checks li',
        '.chips li',
        '.mitem__hd h4',
        '.mopt span',
        '.qa__q > span:nth-child(2)',
        '.info dd',
        '.cycle__desc',
        '.care__lead',
        '.close__list li',
        '.close__note',
        '.assure',
        '.note-s',
        '.ba__pts span',
        '.coupon__go',
        '.foot__tag'
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
