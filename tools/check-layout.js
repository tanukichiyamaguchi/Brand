#!/usr/bin/env node
/**
 * LPの崩れ検査。11種類の画面幅でページを最後までスクロールし、次を数える。
 *   - 横スクロールの発生／LPカラムからはみ出した要素
 *   - 現れる演出（.rv / [data-io]）が発火しないまま残った要素、見えないまま残った文字
 *   - 1行のはずのラベルの折り返し、重なってはいけない部品同士の重なり
 *   - 読み込めなかった画像（ビフォーアフターの2枚は「読み込まれないまま」も含む）、JavaScriptのエラー
 * 問題が1件でもあれば終了コード1で終わる。
 *
 * 必要なもの: Node.js と Playwright（Chromium）。クラウド環境には導入済み。
 * 使い方    : node tools/check-layout.js            … 全画面幅
 *             node tools/check-layout.js 320,390    … 幅を指定
 * 外部への通信（計測タグ・地図・予約サイト）は検査中は止めている。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const VIEWPORTS = [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], [600, 900], [768, 1024], [1024, 768], [1366, 800], [1920, 1080]];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;

function serve() {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ブラウザの中で実行する検査本体 */
function inspect() {
    const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, wide: [], hidden: [], notIn: [], layout: [], images: [] };
    const lp = document.querySelector('.lp').getBoundingClientRect();
    const SCROLLERS = '.tags, .ticker, .feed, .gcar__track, .vcar__track, .isheet, .dock, .side';
    /* .fv__kb / .fv__img はズーム演出で枠より大きくなるが .fv__zoom（overflow:hidden）で切り取られる。
       測る瞬間の拡大率で結果が変わるため、はみ出しの判定からは外す（横スクロールの有無は別に見ている） */
    const DECOR = '.ring, .glint, .sr, .skip, .must__glow, .lash, .fv__kb, .fv__img, svg, svg *';
    const name = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');

    document.querySelectorAll('.lp *').forEach(el => {
        if (el.closest(SCROLLERS) || el.matches(DECOR)) { return; }
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) { return; }
        if (b.right > lp.right + 1.5 || b.left < lp.left - 1.5) { out.wide.push(name(el)); }
    });

    document.querySelectorAll('.rv, [data-io]').forEach(el => { if (!el.classList.contains('is-in')) { out.notIn.push(name(el)); } });

    const walker = document.createTreeWalker(document.querySelector('.lp'), NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
        const t = walker.currentNode;
        if (!t.textContent.trim()) { continue; }
        const el = t.parentElement;
        if (!el || el.closest('.sr, .skip, [hidden], script, style, .isheet') || el.matches('[data-type-done]')) { continue; }
        if (el.closest('.band') && window.innerWidth < 360) { continue; }   /* 狭い画面では意図的に隠している */
        let opacity = 1; let visible = true; let node = el;
        while (node && node !== document.body) {
            const cs = getComputedStyle(node);
            opacity *= parseFloat(cs.opacity);
            if (cs.visibility === 'hidden' || cs.display === 'none') { visible = false; }
            node = node.parentElement;
        }
        if ((opacity < 0.2 || !visible) && !seen.has(el)) { seen.add(el); out.hidden.push(name(el) + ' "' + t.textContent.trim().slice(0, 14) + '"'); }
    }

    const textRect = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const lineCount = el => {   /* 文字サイズが混ざった行も1行と数えるよう、縦の重なりで行をまとめる */
        const r = document.createRange(); r.selectNodeContents(el); const lines = [];
        for (const q of r.getClientRects()) {
            if (q.width <= 1 || q.height <= 1) { continue; }
            const line = lines.find(l => Math.min(l.b, q.bottom) - Math.max(l.t, q.top) > 0.4 * Math.min(l.b - l.t, q.height));
            if (line) { line.t = Math.min(line.t, q.top); line.b = Math.max(line.b, q.bottom); } else { lines.push({ t: q.top, b: q.bottom }); }
        }
        return lines.length;
    };
    const hit = (A, B) => !(A.right <= B.left + 1 || B.right <= A.left + 1 || A.bottom <= B.top + 1 || B.bottom <= A.top + 1);
    const box = sel => { const el = document.querySelector(sel); return el && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect() : null; };

    [['.k3__gauge', '.k3__rows'], ['.k5__dial', '.k5__chips'], ['.k1__keep', '.seal'], ['.k1__bars', '.k1__keep'], ['.k4__grid', '.k4__num'],
        ['.serum__img', '.serum__txt'], ['.hd__bar .logo', '.hd__act'], ['.band .logo', '.band small'], ['.note', '.fv__label'],
        ['.k0__num', '.k0 .seal'], ['.ba__lbl--a', '.ba__lbl--b'], ['.fv__stamp', '.note']].forEach(([x, y]) => {
        const A = box(x); const B = box(y);
        if (A && B && hit(A, B)) { out.layout.push('重なり ' + x + ' × ' + y); }
    });
    const disc = box('.duo__c');
    if (disc) {
        ['.duo__a', '.duo__b'].forEach(sel => { const el = document.querySelector(sel); if (el && hit(textRect(el), disc)) { out.layout.push('重なり .duo__c × ' + sel + ' の文字'); } });
    }
    const stamp = box('.fv__stamp');   /* クーポンの印が見出しの文字にかからないこと */
    if (stamp) {
        document.querySelectorAll('.fv__h1 .ln > span').forEach(el => { if (hit(textRect(el), stamp)) { out.layout.push('重なり .fv__stamp × 見出し "' + el.textContent.trim().slice(0, 6) + '"'); } });
    }
    document.querySelectorAll('.coupon').forEach(el => {
        const body = el.querySelector('.coupon__body'); const arrow = el.querySelector('.coupon__arrow');
        if (body && arrow && textRect(body).right > arrow.getBoundingClientRect().left - 2) { out.layout.push('重なり クーポン券の文字 × 矢印'); }
    });
    document.querySelectorAll('.dock__btn > span, .hd__cta, .coupon__body small, .coupon__body b, .stamp small, .stamp b, .offer__ttl, .offer__list span, .offer__list b, .ba__lbl, .ba__hint, .usp__lead, .k0__num b, .k0__row > span:first-child, .gain__so, .mitem__badge, .feed__badge, .koma__cap, .step__when, .index__ttl, .btn__txt, .bar, .k5__chips span, .k3__row, .serum__name, .gcard__tag').forEach(el => {
        if (!el.offsetParent) { return; }
        const allowed = el.matches('.dock__btn > span, .btn__txt, .serum__name') ? 2 : 1;
        const n = lineCount(el);
        if (n > allowed) { out.layout.push('折り返し ' + name(el) + ' ' + n + '行 "' + el.textContent.trim().slice(0, 10) + '"'); }
    });
    document.querySelectorAll('.steps__list h3, .benefits h3, .gcard__jp').forEach(el => {
        const n = lineCount(el);
        if (n > 2) { out.layout.push('語の途中で改行 ' + name(el) + ' ' + n + '行 "' + el.textContent.slice(0, 10) + '"'); }
    });
    document.querySelectorAll('.btn').forEach(el => {
        if (el.closest('.isheet, .side')) { return; }
        const b = el.getBoundingClientRect(); const t = el.querySelector('.btn__txt'); const a = el.querySelector('.btn__arrow');
        if (!b.width || !t) { return; }
        const tb = t.getBoundingClientRect(); const limit = a ? a.getBoundingClientRect().left - 4 : b.right - 10;
        if (tb.left < b.left + 8 || tb.right > limit) { out.layout.push('ボタンの文字がはみ出し "' + t.textContent.trim().slice(0, 10) + '"'); }
    });
    document.querySelectorAll('img').forEach(i => { if (i.complete && i.naturalWidth === 0) { out.images.push(i.getAttribute('src')); } });
    document.querySelectorAll('.ba__img').forEach(i => { if (!i.complete) { out.images.push(i.getAttribute('src') + '（読み込まれていない）'); } });
    return out;
}

(async () => {
    const server = await serve();
    const url = 'http://127.0.0.1:' + server.address().port + '/index.html';
    const args = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost', '--ignore-certificate-errors'] : [];
    const browser = await chromium.launch({ args });
    let total = 0;
    for (const [W, H] of VIEWPORTS) {
        if (only && !only.includes(W)) { continue; }
        const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 800, hasTouch: W < 800 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
        await page.route(/googletagmanager|google-analytics|maps\.google|hotpepper/, r => r.abort());
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += Math.round(H * 0.5)) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(170); }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(5500);   /* 最後に発火した演出が終わるまで待つ */
        const r = await page.evaluate(inspect);
        const count = (r.overflowX > 0 ? 1 : 0) + r.wide.length + r.hidden.length + r.notIn.length + r.layout.length + r.images.length + errors.length;
        total += count;
        console.log(`${W}x${H}  高さ=${height}  横スクロール=${r.overflowX}  はみ出し=${r.wide.length} 非表示=${r.hidden.length} 未発火=${r.notIn.length} 折返し・重なり=${r.layout.length} 画像切れ=${r.images.length} JSエラー=${errors.length}`);
        for (const key of ['wide', 'hidden', 'notIn', 'layout', 'images']) {
            if (r[key].length) { console.log('   ' + key + ': ' + [...new Set(r[key])].slice(0, 8).join(' | ')); }
        }
        if (errors.length) { console.log('   errors: ' + errors.slice(0, 3).join(' | ')); }
        await ctx.close();
    }
    await browser.close();
    server.close();
    console.log(total === 0 ? 'ALL CLEAR' : 'ISSUES: ' + total);
    process.exit(total === 0 ? 0 : 1);
})().catch(err => { console.error('FAILED', err); process.exit(1); });
