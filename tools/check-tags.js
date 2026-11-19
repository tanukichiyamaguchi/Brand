#!/usr/bin/env node
/**
 * 計測タグの検査。ページをローカルで開き、次を確かめる。
 *   - Google タグ（gtag.js）に GA4（G-29VF3FWBLH）と Google 広告（AW-18561212683）の config があること
 *   - ホットペッパーへのリンクを押すと「ホットペッパー予約ボタン（広告タグ）」、LINE へのリンク（エルメの流入経路 s.lmes.jp）を
 *     押すと「LINEボタン（広告タグ）」のコンバージョンが、ちょうど1回ずつ dataLayer に積まれること
 *   - LINE のリンクがすべてエルメの流入経路を通っていること（直接の友だち追加リンク lin.ee が残っていないこと）
 *     （リンクの中の文字やアイコンを押した場合と、画面に見えているボタンを実際に押した場合も見る）
 *   - それ以外のリンクでは、コンバージョンが積まれないこと
 *   - Microsoft Clarity のタグ（プロジェクト CLARITY_ID）が入っていること
 *   - js/measure.js の GA4 イベントが、決めたとおりに送られること
 *       scroll_depth（10/25/50/75/90/100% を一度ずつ）、section_view（1秒とどまったセクションだけ・一度ずつ。
 *       目次で一気に飛んだ時に通り過ぎたセクションは数えない）、cta_click（すべての予約ボタンで、種類と押された場所つき）、
 *       lp_nav（すべてのページ内リンクで、移動先と押された場所つき）、index_open、faq_open（開いた時だけ）
 *     と、Clarity へのカスタム タグ（押したボタンの種類、Google 広告から来た訪問）
 *   - フッターからプライバシーポリシー（privacy.html）へリンクしていて、そのページが開け、横スクロールが出ないこと
 *     （Microsoft Clarity の説明と Microsoft のプライバシーに関する声明へのリンクがあること）
 * 問題が1件でもあれば終了コード1で終わる。
 *
 * 必要なもの: Node.js と Playwright（Chromium）。クラウド環境には導入済み。
 * 使い方    : node tools/check-tags.js
 * 外部への通信はすべて止めている。タグ本体は読み込まれないが、gtag() と clarity() の呼び出しは
 * dataLayer と clarity.q に残るので、それを見る。
 * リンク先へは移動しない（押した時の移動は検査用に止めている）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
const CONFIGS = ['G-29VF3FWBLH', 'AW-18561212683'];
const CLARITY_ID = 'zfv01oyk04';
const SEND_TO = {
    'beauty.hotpepper.jp': 'AW-18561212683/3yEOCLPtw7odEIvC1pJF',
    's.lmes.jp': 'AW-18561212683/19mHCLbtw7odEIvC1pJF',
    'lin.ee': 'AW-18561212683/19mHCLbtw7odEIvC1pJF'
};
const CTA_TYPE = { 'beauty.hotpepper.jp': 'hotpepper', 's.lmes.jp': 'line', 'lin.ee': 'line' };
/* ボタンの種類ごとのリンク先。種類ごとに、ページに1つ以上あることを確かめる */
const GROUPS = {
    'ホットペッパー': ['beauty.hotpepper.jp'],
    'LINE': ['s.lmes.jp']
};
/* LP の LINE ボタンはすべてエルメの流入経路（s.lmes.jp）を通す。直接の友だち追加リンクが残っていたら問題にする */
const NOT_ALLOWED = { 'lin.ee': 'エルメを経由しない LINE リンク（lin.ee）' };
const SCROLL_MARKS = [10, 25, 50, 75, 90, 100];
/* js/measure.js のセクション名（ページ上の順番） */
const SECTIONS = [
    ['.fv', '01 ファーストビュー'], ['#about', '02 サロンについて'], ['#method', '03 独自技術（持ち約2倍）'],
    ['#ba', '04 ビフォーアフター'], ['#gallery', '05 施術事例'], ['#commitment', '06 なぜ仕上がりが違うのか'],
    ['.promises', '07 5つのこだわり'], ['.must', '08 目元が変われば世界が変わる'], ['#voice', '09 お客様の声'],
    ['#continuity', '10 まつ育'], ['#eyebrow', '11 眉毛スタイリング'], ['#set-recommend', '12 眉とまつ毛のセット'],
    ['#menu', '13 メニュー・料金'], ['#first-visit', '14 初めての方限定メニュー'], ['#flow', '15 施術の流れ'],
    ['#faq', '16 よくあるご質問'], ['#access', '17 サロン情報・地図'], ['#reserve', '18 ご予約（ページ最後）'],
    ['.foot', '19 フッター']
];
const LABELS = SECTIONS.map(s => s[1]);
const PLACES = ['下部固定ボタン', '目次シート', 'PC左パネル', 'PC目次', 'ヘッダー', 'スキップリンク'];

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

/* ページの中で実行する：dataLayer・clarity.q の中身と、押した後に積まれたもの */
function setUp() {
    window.addEventListener('click', e => e.preventDefault(), true);   /* リンク先へ移動させない */
    window.__entries = () => Array.prototype.map.call(window.dataLayer, x => Array.prototype.slice.call(x));
    window.__sentSince = from => window.__entries().slice(from)
        .filter(x => x[0] === 'event' && x[1] === 'conversion')
        .map(x => (x[2] && x[2].send_to) || '(send_to なし)');
    window.__events = (name, from) => window.__entries().slice(from || 0)
        .filter(x => x[0] === 'event' && x[1] === name).map(x => x[2] || {});
    window.__clarity = () => (window.clarity && window.clarity.q ? Array.prototype.map.call(window.clarity.q, a => Array.prototype.slice.call(a)) : []);
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

/* 予約ボタンとページ内リンクを1つずつ押し、cta_click / lp_nav の中身を集める（押すのはリンク本体と中の要素） */
function pressForMeasure(arg) {
    const out = { cta: [], nav: [], bad: [] };
    const labelOk = v => arg.labels.includes(v) || arg.places.includes(v);
    document.querySelectorAll('a[href]').forEach(a => {
        const type = arg.ctaType[a.hostname] || null;
        const href = a.getAttribute('href') || '';
        const isNav = href.charAt(0) === '#' && href.length > 1;
        const targets = [a];
        const inner = a.querySelector('*');
        if (inner) { targets.push(inner); }
        targets.forEach(t => {
            const from = window.dataLayer.length;
            const qFrom = window.__clarity().length;
            t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            const cta = window.__events('cta_click', from);
            const nav = window.__events('lp_nav', from);
            const tags = window.__clarity().slice(qFrom);
            const where = href + '（' + (t === a ? 'a' : t.tagName.toLowerCase()) + '）';
            if (type) {
                const e = cta[0] || {};
                if (cta.length !== 1 || nav.length !== 0) { out.bad.push('cta_click の数が違う: ' + where + ' → cta ' + cta.length + ' / nav ' + nav.length); return; }
                if (e.cta_type !== type) { out.bad.push('cta_type が違う: ' + where + ' → ' + e.cta_type); }
                if (!labelOk(e.lp_section)) { out.bad.push('押された場所が分からない: ' + where + ' → ' + e.lp_section); }
                if (!e.link_text) { out.bad.push('link_text が空: ' + where); }
                if (e.link_url !== a.href) { out.bad.push('link_url が違う: ' + where); }
                if (!tags.some(x => x[0] === 'set' && x[1] === 'cta' && x[2] === type)) { out.bad.push('Clarity の cta タグがない: ' + where); }
                if (t === a) { out.cta.push(type + '｜' + e.lp_section); }
            } else if (isNav) {
                const e = nav[0] || {};
                if (nav.length !== 1 || cta.length !== 0) { out.bad.push('lp_nav の数が違う: ' + where + ' → nav ' + nav.length + ' / cta ' + cta.length); return; }
                if (!(labelOk(e.nav_to) || e.nav_to === arg.top)) { out.bad.push('移動先が分からない: ' + where + ' → ' + e.nav_to); }
                if (!labelOk(e.lp_section)) { out.bad.push('押された場所が分からない: ' + where + ' → ' + e.lp_section); }
                if (t === a) { out.nav.push(e.nav_to + '｜' + e.lp_section); }
            } else if (cta.length || nav.length) {
                out.bad.push('送らないはずのリンクで送った: ' + where);
            }
        });
    });
    return out;
}

const countBy = list => list.reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {});
const wait = ms => new Promise(r => setTimeout(r, ms));

async function openPage(browser, base, url, viewport, mobile) {
    const ctx = await browser.newContext({ viewport, isMobile: !!mobile, hasTouch: !!mobile });
    await ctx.route(u => !u.href.startsWith(base), r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(setUp);
    return { ctx, page, errors };
}

(async () => {
    const server = await serve();
    const base = 'http://127.0.0.1:' + server.address().port + '/';
    const browser = await chromium.launch();
    const problems = [];

    /* 1. トップページ：Google 広告のコンバージョン */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 390, height: 844 }, true);
        const r = await page.evaluate(pressEveryLink, SEND_TO);
        for (const id of CONFIGS) {
            if (!r.configs.includes(id)) { problems.push('config がない: ' + id); }
        }
        const countOf = hosts => hosts.reduce((n, h) => n + (r.counted[h] || 0), 0);
        for (const [name, hosts] of Object.entries(GROUPS)) {
            if (!countOf(hosts)) { problems.push('リンクが見つからない: ' + name + '（' + hosts.join(' / ') + '）'); }
        }
        for (const [host, label] of Object.entries(NOT_ALLOWED)) {
            if (r.counted[host]) { problems.push(label + 'が ' + r.counted[host] + ' 件ある'); }
        }
        r.bad.forEach(b => problems.push('コンバージョンの送り方が違う: ' + b));
        console.log('config: ' + r.configs.join(', '));
        console.log('押したリンク: ' + Object.entries(GROUPS).map(([name, hosts]) => name + ' ' + countOf(hosts) + ' 件（' + hosts.map(h => h + ' ' + (r.counted[h] || 0)).join('、') + '）').join(' / ') + '（それぞれリンク本体と中の要素）・その他のリンク（送らないこと）');

        /* 実際の操作に近い形で、画面に見えているボタンを種類ごとに1つ押す */
        for (const [name, hosts] of Object.entries(GROUPS)) {
            const button = page.locator(hosts.map(h => 'a[href*="' + h + '"]').join(', ') + ' >> visible=true').first();
            if (!(await button.count())) { problems.push('見えているボタンがない: ' + name); continue; }
            const from = await page.evaluate(() => window.dataLayer.length);
            await button.click();
            const got = await page.evaluate(f => window.__sentSince(f), from);
            const info = await button.evaluate(a => ({ host: a.hostname, label: (a.className || a.tagName) + '「' + a.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + '」' }));
            console.log('実際に押したボタン: ' + info.label + '（' + info.host + '）→ ' + (got.join(', ') || 'なし'));
            if (got.length !== 1 || got[0] !== SEND_TO[info.host]) { problems.push('実際に押した時の送り方が違う: ' + name + ' → ' + (got.join(', ') || 'なし')); }
        }

        const footerLink = await page.evaluate(() => !!document.querySelector('.foot__links a[href="privacy.html"]'));
        if (!footerLink) { problems.push('フッターにプライバシーポリシーへのリンクがない'); }
        errors.forEach(e => problems.push('JSエラー（トップ）: ' + e));
        await ctx.close();
    }

    /* 2. Microsoft Clarity のタグと、js/measure.js の GA4 イベント（スマホ幅） */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 390, height: 844 }, true);
        const clarity = await page.evaluate(id => ({
            fn: typeof window.clarity === 'function',
            src: Array.prototype.some.call(document.scripts, s => s.src === 'https://www.clarity.ms/tag/' + id),
            measure: Array.prototype.some.call(document.scripts, s => /\/js\/measure\.js$/.test(s.src))
        }), CLARITY_ID);
        console.log('Clarity: 関数=' + clarity.fn + '  タグ（' + CLARITY_ID + '）=' + clarity.src + '  measure.js=' + clarity.measure);
        if (!clarity.fn || !clarity.src) { problems.push('Microsoft Clarity のタグ（' + CLARITY_ID + '）が入っていない'); }
        if (!clarity.measure) { problems.push('js/measure.js が読み込まれていない'); }

        /* 開いた直後：ファーストビューだけが「見た」になる。スクロールはまだ送らない */
        await wait(1500);
        let seen = await page.evaluate(() => window.__events('section_view').map(e => e.lp_section));
        let depth = await page.evaluate(() => window.__events('scroll_depth').map(e => e.percent_scrolled));
        console.log('開いた直後: section_view=' + (seen.join('、') || 'なし') + '  scroll_depth=' + (depth.join('、') || 'なし'));
        if (seen.join() !== '01 ファーストビュー') { problems.push('開いた直後の section_view が違う: ' + (seen.join('、') || 'なし')); }
        if (depth.length) { problems.push('開いた直後に scroll_depth が送られた: ' + depth.join('、')); }

        /* 目次で飛んだ時のように、上から一番下まで 0.8 秒で通り過ぎる：
           途中のセクションは数えず、スクロールは 10〜100% が一度ずつ */
        await page.evaluate(async () => {
            const end = document.documentElement.scrollHeight;
            for (let i = 1; i <= 40; i++) {
                window.scrollTo({ top: end * i / 40, behavior: 'instant' });
                await new Promise(r => setTimeout(r, 20));
            }
        });
        await wait(1600);
        seen = await page.evaluate(() => window.__events('section_view').map(e => e.lp_section));
        depth = await page.evaluate(() => window.__events('scroll_depth').map(e => e.percent_scrolled));
        console.log('上から下まで通り過ぎた後: section_view=' + seen.join('、') + '  scroll_depth=' + depth.join('、'));
        if (depth.join() !== SCROLL_MARKS.join()) { problems.push('scroll_depth が違う: ' + depth.join('、') + '（' + SCROLL_MARKS.join('、') + ' のはず）'); }
        const passed = seen.filter(l => l !== '01 ファーストビュー' && l < '17');
        if (passed.length) { problems.push('通り過ぎただけのセクションを数えた: ' + passed.join('、')); }
        if (!seen.includes('19 フッター')) { problems.push('一番下でフッターが数えられていない'); }

        /* セクションを1つずつ画面の中央に置いて 1.2 秒待つ：すべて一度ずつ数えられる */
        for (const [sel, label] of SECTIONS) {
            await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
            await wait(1200);
            const got = await page.evaluate(l => window.__events('section_view').filter(e => e.lp_section === l).length, label);
            if (got !== 1) { problems.push('section_view の回数が違う: ' + label + ' → ' + got + ' 回'); }
        }
        seen = await page.evaluate(() => window.__events('section_view').map(e => e.lp_section));
        const unknown = seen.filter(l => !LABELS.includes(l));
        if (unknown.length) { problems.push('知らないセクション名: ' + unknown.join('、')); }
        depth = await page.evaluate(() => window.__events('scroll_depth').map(e => e.percent_scrolled));
        if (depth.join() !== SCROLL_MARKS.join()) { problems.push('上下に動かした後に scroll_depth が増えた: ' + depth.join('、')); }
        console.log('セクションを順に見た後: section_view ' + seen.length + ' 件（' + LABELS.length + ' セクション）');

        /* よくあるご質問：開いた時だけ、質問文つきで送る */
        await page.evaluate(() => document.querySelector('#faq').scrollIntoView({ block: 'start', behavior: 'instant' }));
        const q = page.locator('.qa__q');
        const f0 = await page.evaluate(() => window.dataLayer.length);
        await q.nth(0).click();
        await q.nth(0).click();
        await q.nth(1).click();
        const faq = await page.evaluate(f => window.__events('faq_open', f).map(e => e.faq_question), f0);
        console.log('faq_open: ' + faq.join(' / '));
        if (faq.join('|') !== '眉毛とまつ毛を同時に施術できますか？|眉毛WAXは痛いですか？') { problems.push('faq_open が違う（開く→閉じる→次を開く）: ' + faq.join(' / ')); }

        /* 目次シート：開いた場所と、選んだ移動先 */
        await page.evaluate(() => document.querySelector('#voice').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await wait(400);
        const i0 = await page.evaluate(() => window.dataLayer.length);
        await page.locator('.dock__idx').click();
        await wait(300);
        await page.locator('.index--sheet a[href="#menu"]').click();
        const idx = await page.evaluate(f => ({ open: window.__events('index_open', f), nav: window.__events('lp_nav', f) }), i0);
        console.log('目次シート: index_open=' + idx.open.map(e => e.lp_section).join('、') + '  lp_nav=' + idx.nav.map(e => e.nav_to + '（' + e.lp_section + '）').join('、'));
        if (idx.open.length !== 1 || idx.open[0].lp_section !== '下部固定ボタン') { problems.push('index_open が違う: ' + JSON.stringify(idx.open)); }
        if (idx.nav.length !== 1 || idx.nav[0].nav_to !== '13 メニュー・料金' || idx.nav[0].lp_section !== '目次シート') { problems.push('目次シートからの lp_nav が違う: ' + JSON.stringify(idx.nav)); }

        /* すべての予約ボタンとページ内リンク */
        const m = await page.evaluate(pressForMeasure, { ctaType: CTA_TYPE, labels: LABELS, places: PLACES, top: '00 ページの先頭' });
        m.bad.forEach(b => problems.push(b));
        const ctaCount = countBy(m.cta);
        console.log('cta_click（種類｜押された場所）: ' + Object.entries(ctaCount).map(([k, n]) => k + (n > 1 ? ' ×' + n : '')).join('、'));
        console.log('lp_nav（移動先｜押された場所）: ' + m.nav.length + ' 件');
        errors.forEach(e => problems.push('JSエラー（計測・スマホ）: ' + e));
        await ctx.close();
    }

    /* 3. PC幅：左パネルのボタンと右の目次 */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 1366, height: 800 }, false);
        const p0 = await page.evaluate(() => window.dataLayer.length);
        await page.locator('.side--l a.btn--book').click();
        await page.locator('.side--r a[href="#faq"]').click();
        const pc = await page.evaluate(f => ({ cta: window.__events('cta_click', f), nav: window.__events('lp_nav', f) }), p0);
        console.log('PC: cta_click=' + pc.cta.map(e => e.cta_type + '（' + e.lp_section + '）').join('、') + '  lp_nav=' + pc.nav.map(e => e.nav_to + '（' + e.lp_section + '）').join('、'));
        if (pc.cta.length !== 1 || pc.cta[0].lp_section !== 'PC左パネル' || pc.cta[0].cta_type !== 'hotpepper') { problems.push('PC左パネルの cta_click が違う: ' + JSON.stringify(pc.cta)); }
        if (pc.nav.length !== 1 || pc.nav[0].nav_to !== '16 よくあるご質問' || pc.nav[0].lp_section !== 'PC目次') { problems.push('PC目次の lp_nav が違う: ' + JSON.stringify(pc.nav)); }
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await wait(1600);
        const bottom = await page.evaluate(() => window.__events('section_view').map(e => e.lp_section));
        if (!bottom.includes('19 フッター')) { problems.push('PC幅の一番下でフッターが数えられていない: ' + bottom.join('、')); }
        errors.forEach(e => problems.push('JSエラー（計測・PC）: ' + e));
        await ctx.close();
    }

    /* 4. Google 広告のクリックから来た訪問だけ、Clarity に目印を付ける */
    for (const [query, expected] of [['?gclid=TEST', true], ['', false]]) {
        const { ctx, page } = await openPage(browser, base, base + 'index.html' + query, { width: 390, height: 844 }, true);
        await wait(200);
        const has = await page.evaluate(() => window.__clarity().some(x => x[0] === 'set' && x[1] === 'traffic' && x[2] === 'google_ads'));
        console.log('Clarity traffic タグ（' + (query || 'パラメータなし') + '）: ' + has);
        if (has !== expected) { problems.push('Clarity の traffic タグが違う（' + (query || 'パラメータなし') + '）: ' + has); }
        await ctx.close();
    }

    /* 5. プライバシーポリシー */
    for (const [W, H] of [[320, 568], [390, 844], [1366, 800]]) {
        const c = await browser.newContext({ viewport: { width: W, height: H } });
        await c.route(url => !url.href.startsWith(base), r2 => r2.abort());
        const p = await c.newPage();
        const res = await p.goto(base + 'privacy.html', { waitUntil: 'load' });
        const info = await p.evaluate(() => ({
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            mail: !!document.querySelector('a[href="mailto:katestagelash2026@gmail.com"]'),
            back: !!document.querySelector('a[href="./"]'),
            clarity: /Microsoft Clarity/.test(document.body.textContent) && !!document.querySelector('a[href="https://www.microsoft.com/privacy/privacystatement"]'),
            scripts: document.scripts.length
        }));
        console.log('privacy.html ' + W + 'x' + H + '  status=' + res.status() + '  横スクロール=' + info.overflowX + '  メール=' + info.mail + '  戻るリンク=' + info.back + '  Clarityの説明=' + info.clarity + '  script=' + info.scripts);
        if (res.status() !== 200) { problems.push('privacy.html が開けない: ' + res.status()); }
        if (info.overflowX > 0) { problems.push('privacy.html に横スクロール（' + W + 'px）'); }
        if (!info.mail || !info.back) { problems.push('privacy.html のメールまたは戻るリンクがない'); }
        if (!info.clarity) { problems.push('privacy.html に Microsoft Clarity の説明かリンクがない'); }
        await c.close();
    }

    await browser.close();
    server.close();
    problems.forEach(p => console.log('  - ' + p));
    console.log(problems.length === 0 ? 'ALL CLEAR' : 'ISSUES: ' + problems.length);
    process.exit(problems.length === 0 ? 0 : 1);
})().catch(err => { console.error('FAILED', err); process.exit(1); });
