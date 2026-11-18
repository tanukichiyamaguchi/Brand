#!/usr/bin/env node
/**
 * 計測タグの検査。ページをローカルで開き、次を確かめる。
 *   - Google タグ（gtag.js）に GA4（G-29VF3FWBLH）と Google 広告（AW-18561212683）の config があること
 *   - ホットペッパーへのリンクを押すと「ホットペッパー予約ボタン（広告タグ）」、LINE へのリンクを押すと
 *     「LINEボタン（広告タグ）」のコンバージョンが、ちょうど1回ずつ dataLayer に積まれること
 *     （リンクの中の文字やアイコンを押した場合と、画面に見えているボタンを実際に押した場合も見る）
 *   - それ以外のリンクでは、コンバージョンが積まれないこと
 *   - フッターからプライバシーポリシー（privacy.html）へリンクしていて、そのページが開け、横スクロールが出ないこと
 * 問題が1件でもあれば終了コード1で終わる。
 *
 * 必要なもの: Node.js と Playwright（Chromium）。クラウド環境には導入済み。
 * 使い方    : node tools/check-tags.js
 * 外部への通信はすべて止めている。タグ本体は読み込まれないが、gtag() の呼び出しは dataLayer に残るので、それを見る。
 * リンク先へは移動しない（押した時の移動は検査用に止めている）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const CONFIGS = ['G-29VF3FWBLH', 'AW-18561212683'];
const SEND_TO = {
    'beauty.hotpepper.jp': 'AW-18561212683/3yEOCLPtw7odEIvC1pJF',
    'lin.ee': 'AW-18561212683/19mHCLbtw7odEIvC1pJF'
};

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

/* ページの中で実行する：dataLayer の中身と、押した後に積まれたコンバージョン */
function setUp() {
    window.addEventListener('click', e => e.preventDefault(), true);   /* リンク先へ移動させない */
    window.__entries = () => Array.prototype.map.call(window.dataLayer, x => Array.prototype.slice.call(x));
    window.__sentSince = from => window.__entries().slice(from)
        .filter(x => x[0] === 'event' && x[1] === 'conversion')
        .map(x => (x[2] && x[2].send_to) || '(send_to なし)');
}

function pressEveryLink(sendTo) {
    const out = { configs: window.__entries().filter(x => x[0] === 'config').map(x => x[1]), counted: {}, bad: [] };
    document.querySelectorAll('a[href]').forEach(a => {
        const expected = sendTo[a.hostname] || null;
        const targets = [a];
        const inner = a.querySelector('*');
        if (inner) { targets.push(inner); }
        targets.forEach(t => {
            const from = window.dataLayer.length;
            t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            const got = window.__sentSince(from);
            const ok = expected ? (got.length === 1 && got[0] === expected) : got.length === 0;
            if (!ok) { out.bad.push((a.getAttribute('href') || '') + '（' + (t === a ? 'a' : t.tagName.toLowerCase()) + '）→ ' + (got.join(', ') || 'なし')); }
        });
        if (expected) { out.counted[a.hostname] = (out.counted[a.hostname] || 0) + 1; }
    });
    return out;
}

(async () => {
    const server = await serve();
    const base = 'http://127.0.0.1:' + server.address().port + '/';
    const browser = await chromium.launch();
    const problems = [];

    /* 1. トップページ */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route(url => !url.href.startsWith(base), r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.goto(base + 'index.html', { waitUntil: 'load' });
    await page.evaluate(setUp);

    const r = await page.evaluate(pressEveryLink, SEND_TO);
    for (const id of CONFIGS) {
        if (!r.configs.includes(id)) { problems.push('config がない: ' + id); }
    }
    for (const host of Object.keys(SEND_TO)) {
        if (!r.counted[host]) { problems.push('リンクが見つからない: ' + host); }
    }
    r.bad.forEach(b => problems.push('コンバージョンの送り方が違う: ' + b));
    console.log('config: ' + r.configs.join(', '));
    console.log('押したリンク: ホットペッパー ' + (r.counted['beauty.hotpepper.jp'] || 0) + ' 件 / LINE ' + (r.counted['lin.ee'] || 0) + ' 件（それぞれリンク本体と中の要素）・その他のリンク（送らないこと）');

    /* 実際の操作に近い形で、画面に見えているボタンを1つずつ押す */
    for (const host of Object.keys(SEND_TO)) {
        const button = page.locator('a[href*="' + host + '"] >> visible=true').first();
        if (!(await button.count())) { problems.push('見えているボタンがない: ' + host); continue; }
        const from = await page.evaluate(() => window.dataLayer.length);
        await button.click();
        const got = await page.evaluate(f => window.__sentSince(f), from);
        const label = await button.evaluate(a => (a.className || a.tagName) + '「' + a.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + '」');
        console.log('実際に押したボタン: ' + label + ' → ' + (got.join(', ') || 'なし'));
        if (got.length !== 1 || got[0] !== SEND_TO[host]) { problems.push('実際に押した時の送り方が違う: ' + host + ' → ' + (got.join(', ') || 'なし')); }
    }

    const footerLink = await page.evaluate(() => !!document.querySelector('.foot__links a[href="privacy.html"]'));
    if (!footerLink) { problems.push('フッターにプライバシーポリシーへのリンクがない'); }
    errors.forEach(e => problems.push('JSエラー（トップ）: ' + e));
    await ctx.close();

    /* 2. プライバシーポリシー */
    for (const [W, H] of [[320, 568], [390, 844], [1366, 800]]) {
        const c = await browser.newContext({ viewport: { width: W, height: H } });
        await c.route(url => !url.href.startsWith(base), r2 => r2.abort());
        const p = await c.newPage();
        const res = await p.goto(base + 'privacy.html', { waitUntil: 'load' });
        const info = await p.evaluate(() => ({
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            mail: !!document.querySelector('a[href="mailto:katestagelash2026@gmail.com"]'),
            back: !!document.querySelector('a[href="./"]'),
            scripts: document.scripts.length
        }));
        console.log('privacy.html ' + W + 'x' + H + '  status=' + res.status() + '  横スクロール=' + info.overflowX + '  メール=' + info.mail + '  戻るリンク=' + info.back + '  script=' + info.scripts);
        if (res.status() !== 200) { problems.push('privacy.html が開けない: ' + res.status()); }
        if (info.overflowX > 0) { problems.push('privacy.html に横スクロール（' + W + 'px）'); }
        if (!info.mail || !info.back) { problems.push('privacy.html のメールまたは戻るリンクがない'); }
        await c.close();
    }

    await browser.close();
    server.close();
    problems.forEach(p => console.log('  - ' + p));
    console.log(problems.length === 0 ? 'ALL CLEAR' : 'ISSUES: ' + problems.length);
    process.exit(problems.length === 0 ? 0 : 1);
})().catch(err => { console.error('FAILED', err); process.exit(1); });
