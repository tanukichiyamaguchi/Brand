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
 *       lp_nav（すべてのページ内リンクで、移動先と押された場所つき）、index_open、faq_open（開いた時だけ）。
 *       どれも send_to で GA4（G-29VF3FWBLH）だけに送っていること（Google 広告へは送らない）
 *     と、Clarity へのカスタム タグ（このページの目印 lp=brand、押したボタンの種類、Google 広告・Meta 広告などから来た訪問）
 *     と、Clarity への API イベント（hotpepper_click・line_click はボタンを押すたびに1回、
 *     予約でも LINE でもないリンクでは送らない。menu_view は「13 メニュー・料金」を見た時だけ一度）
 *   - Meta ピクセル（データセット META_PIXEL_ID）のタグが入っていて、init と PageView が1回ずつ呼ばれること。
 *     ホットペッパーか LINE へのリンクを押すと Lead が送られること（1回のページ表示につき最初の1回だけ。
 *     content_name でボタンの種類、content_category でページを区別）。それ以外のリンクでは送らないこと
 *   - フッターからプライバシーポリシー（privacy.html）へリンクしていて、そのページが開け、横スクロールが出ないこと
 *     （Microsoft Clarity の説明と Microsoft のプライバシーに関する声明へのリンク、
 *       Meta ピクセルの説明と Meta プライバシーポリシーへのリンクがあること）
 * 問題が1件でもあれば終了コード1で終わる。
 *
 * 必要なもの: Node.js と Playwright（Chromium）。クラウド環境には導入済み。
 * 使い方    : node tools/check-tags.js
 * 外部への通信はすべて止めている。タグ本体は読み込まれないが、gtag()・clarity()・fbq() の呼び出しは
 * dataLayer・clarity.q・fbq.queue に残るので、それを見る。
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
/* js/measure.js が送るイベント。すべて GA4 だけに送る */
const MEASURE_EVENTS = ['scroll_depth', 'section_view', 'cta_click', 'lp_nav', 'index_open', 'faq_open'];
const GA4_ID = 'G-29VF3FWBLH';
/* Meta ピクセル：データセット「ケイト広告」と、Lead に付ける値 */
const META_PIXEL_ID = '2010357583154509';
const META_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const META_CATEGORY = 'womens_lp';
const META_NAME = { 'beauty.hotpepper.jp': 'hotpepper', 's.lmes.jp': 'line', 'lin.ee': 'line' };
/* 開いた URL のパラメータと、Clarity の traffic タグに付くはずの値 */
const TRAFFIC_CASES = [
    ['', []],
    ['?gclid=TEST', ['google_ads']],
    ['?gad_source=1&gbraid=TEST', ['google_ads']],
    ['?utm_source=ig&utm_medium=paid&utm_id=1&fbclid=TEST', ['meta_ads']],              /* Meta が自動で付ける形 */
    ['?utm_source=fb&utm_medium=paid_social&utm_campaign=x&fbclid=TEST', ['meta_ads']],  /* 手で付けた形 */
    ['?utm_source=Instagram&utm_medium=CPC', ['meta_ads']],                             /* 大文字・cpc */
    ['?fbclid=TEST', ['meta_other']],                                                   /* 投稿やプロフィールのリンクなど */
    ['?utm_source=ig&utm_medium=social&fbclid=TEST', ['meta_other']],                   /* 広告ではない utm */
    ['?utm_source=newsletter&utm_medium=paid', []],                                     /* Meta 以外 */
    ['?utm_source=google&utm_medium=cpc&gclid=TEST', ['google_ads']]
];

/* ページの中で実行する：計測イベントのうち、送り先が GA4 だけになっていないもの */
function wrongTargets(arg) {
    const all = window.__entries().filter(x => x[0] === 'event' && arg.names.includes(x[1]));
    return { total: all.length, bad: all.filter(x => !x[2] || x[2].send_to !== arg.id).map(x => x[1] + '（send_to: ' + ((x[2] && x[2].send_to) || 'なし') + '）') };
}

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
    window.__clarityEvents = name => window.__clarity().filter(x => x[0] === 'event' && x[1] === name).length;
    window.__fbq = () => (window.fbq && window.fbq.queue ? Array.prototype.map.call(window.fbq.queue, a => Array.prototype.slice.call(a)) : []);
    window.__leads = () => window.__fbq().filter(x => x[0] === 'track' && x[1] === 'Lead').map(x => x[2] || {});
}

/* ページの中で実行する：Meta ピクセルのタグと、開いた直後に呼ばれたもの */
function metaState(src) {
    return {
        fn: typeof window.fbq === 'function',
        src: Array.prototype.some.call(document.scripts, s => s.src === src),
        init: window.__fbq().filter(x => x[0] === 'init').map(x => x[1]),
        pageView: window.__fbq().filter(x => x[0] === 'track' && x[1] === 'PageView').length,
        leads: window.__leads().length
    };
}

/* ページの中で実行する：予約でも LINE でもないリンクをすべて押す（リンク本体と中の要素）。Lead が送られないことを見る */
function pressOtherLinks(names) {
    let pressed = 0;
    document.querySelectorAll('a[href]').forEach(a => {
        if (names[a.hostname]) { return; }
        const targets = [a];
        const inner = a.querySelector('*');
        if (inner) { targets.push(inner); }
        targets.forEach(t => t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        pressed += 1;
    });
    return { pressed, leads: window.__leads().length };
}

/* ページの中で実行する：予約と LINE のリンクをすべて押す（リンク本体と中の要素）。押した数と、送られた Lead を返す */
function pressCtaLinks(names) {
    let pressed = 0;
    document.querySelectorAll('a[href]').forEach(a => {
        if (!names[a.hostname]) { return; }
        const targets = [a];
        const inner = a.querySelector('*');
        if (inner) { targets.push(inner); }
        targets.forEach(t => t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        pressed += 1;
    });
    return { pressed, leads: window.__leads() };
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
            const clicks = tags.filter(x => x[0] === 'event' && /_click$/.test(x[1])).map(x => x[1]);
            const where = href + '（' + (t === a ? 'a' : t.tagName.toLowerCase()) + '）';
            if (type) {
                if (clicks.join() !== type + '_click') { out.bad.push('Clarity のイベントが違う: ' + where + ' → ' + (clicks.join(', ') || 'なし') + '（' + type + '_click が1回のはず）'); }
            } else if (clicks.length) {
                out.bad.push('予約でも LINE でもないリンクで Clarity のイベントを送った: ' + where + ' → ' + clicks.join(', '));
            }
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
            measure: Array.prototype.some.call(document.scripts, s => /\/js\/measure\.js$/.test(s.src)),
            lp: window.__clarity().filter(x => x[0] === 'set' && x[1] === 'lp').map(x => x[2])
        }), CLARITY_ID);
        console.log('Clarity: 関数=' + clarity.fn + '  タグ（' + CLARITY_ID + '）=' + clarity.src + '  measure.js=' + clarity.measure + '  lp タグ=' + (clarity.lp.join(', ') || 'なし'));
        if (!clarity.fn || !clarity.src) { problems.push('Microsoft Clarity のタグ（' + CLARITY_ID + '）が入っていない'); }
        if (!clarity.measure) { problems.push('js/measure.js が読み込まれていない'); }
        if (clarity.lp.join() !== 'brand') { problems.push('Clarity の lp タグが違う: ' + (clarity.lp.join(', ') || 'なし') + '（brand が1回のはず）'); }

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
        let menuViews = await page.evaluate(() => window.__clarityEvents('menu_view'));
        if (menuViews !== 0) { problems.push('通り過ぎただけなのに Clarity の menu_view を送った: ' + menuViews + ' 回'); }

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
        menuViews = await page.evaluate(() => window.__clarityEvents('menu_view'));
        console.log('Clarity menu_view（メニュー・料金を見た後）: ' + menuViews + ' 回');
        if (menuViews !== 1) { problems.push('Clarity の menu_view の回数が違う: ' + menuViews + ' 回（1回のはず）'); }

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
        const targets = await page.evaluate(wrongTargets, { names: MEASURE_EVENTS, id: GA4_ID });
        console.log('計測イベントの送り先: ' + targets.total + ' 件中、GA4 だけでないもの ' + targets.bad.length + ' 件');
        if (!targets.total) { problems.push('計測イベントが1件もない'); }
        [...new Set(targets.bad)].forEach(b => problems.push('GA4 だけに送っていない: ' + b));
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

    /* 4. 広告などから来た訪問に、Clarity の traffic タグを付ける（URL のパラメータごとに、付くはずの値） */
    for (const [query, expected] of TRAFFIC_CASES) {
        const { ctx, page } = await openPage(browser, base, base + 'index.html' + query, { width: 390, height: 844 }, true);
        await wait(200);
        const got = await page.evaluate(() => window.__clarity().filter(x => x[0] === 'set' && x[1] === 'traffic').map(x => x[2]));
        console.log('Clarity traffic タグ（' + (query || 'パラメータなし') + '）: ' + (got.join(', ') || 'なし'));
        if (got.join() !== expected.join()) { problems.push('Clarity の traffic タグが違う（' + (query || 'パラメータなし') + '）: ' + (got.join(', ') || 'なし') + '（' + (expected.join(', ') || 'なし') + ' のはず）'); }
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
            meta: /Meta ピクセル/.test(document.body.textContent) && !!document.querySelector('a[href="https://www.facebook.com/privacy/policy/"]'),
            scripts: document.scripts.length
        }));
        console.log('privacy.html ' + W + 'x' + H + '  status=' + res.status() + '  横スクロール=' + info.overflowX + '  メール=' + info.mail + '  戻るリンク=' + info.back + '  Clarityの説明=' + info.clarity + '  Metaの説明=' + info.meta + '  script=' + info.scripts);
        if (res.status() !== 200) { problems.push('privacy.html が開けない: ' + res.status()); }
        if (info.overflowX > 0) { problems.push('privacy.html に横スクロール（' + W + 'px）'); }
        if (!info.mail || !info.back) { problems.push('privacy.html のメールまたは戻るリンクがない'); }
        if (!info.clarity) { problems.push('privacy.html に Microsoft Clarity の説明かリンクがない'); }
        if (!info.meta) { problems.push('privacy.html に Meta ピクセルの説明かリンクがない'); }
        await c.close();
    }

    /* 6. Meta ピクセル：タグ、init と PageView、予約・LINE のリンクでの Lead（1回のページ表示につき最初の1回だけ） */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 390, height: 844 }, true);
        const meta = await page.evaluate(metaState, META_SRC);
        console.log('Meta ピクセル: 関数=' + meta.fn + '  タグ=' + meta.src + '  init=' + (meta.init.join(', ') || 'なし') + '  PageView=' + meta.pageView + ' 回  開いた直後の Lead=' + meta.leads + ' 件');
        if (!meta.fn || !meta.src) { problems.push('Meta ピクセルのタグが入っていない'); }
        if (meta.init.length !== 1 || meta.init[0] !== META_PIXEL_ID) { problems.push('Meta ピクセルの init が違う: ' + (meta.init.join(', ') || 'なし') + '（' + META_PIXEL_ID + ' が1回のはず）'); }
        if (meta.pageView !== 1) { problems.push('Meta ピクセルの PageView が ' + meta.pageView + ' 回（1回のはず）'); }
        if (meta.leads !== 0) { problems.push('ページを開いただけで Lead が送られた'); }

        /* 予約でも LINE でもないリンクでは送らない */
        const others = await page.evaluate(pressOtherLinks, META_NAME);
        console.log('Meta Lead（その他のリンク ' + others.pressed + ' 件を押した後）: ' + others.leads + ' 件');
        if (!others.pressed) { problems.push('Meta の検査で、その他のリンクが見つからない'); }
        if (others.leads !== 0) { problems.push('予約でも LINE でもないリンクで Lead が送られた: ' + others.leads + ' 件'); }
        errors.forEach(e => problems.push('JSエラー（Meta・その他のリンク）: ' + e));
        await ctx.close();
    }
    /* ホットペッパーのボタンを押すと Lead が1件。同じページ表示で続けて押しても増えない */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 390, height: 844 }, true);

        /* 画面に見えているホットペッパーのボタンを実際に押す */
        const button = page.locator('a[href*="beauty.hotpepper.jp"] >> visible=true').first();
        if (!(await button.count())) {
            problems.push('Meta の検査で、見えているホットペッパーのボタンがない');
        } else {
            await button.click();
            const got = await page.evaluate(() => window.__leads());
            console.log('Meta Lead（ホットペッパーのボタンを押した後）: ' + JSON.stringify(got));
            if (got.length !== 1 || got[0].content_name !== 'hotpepper' || got[0].content_category !== META_CATEGORY) { problems.push('ホットペッパーのボタンでの Lead が違う: ' + JSON.stringify(got)); }
        }

        /* 続けて、予約と LINE のリンクをすべて押しても増えない */
        const more = await page.evaluate(pressCtaLinks, META_NAME);
        console.log('Meta Lead（続けて予約・LINE のリンク ' + more.pressed + ' 件を押した後）: ' + more.leads.length + ' 件');
        if (more.leads.length !== 1) { problems.push('同じページ表示で Lead が ' + more.leads.length + ' 件送られた（1件のはず）'); }
        errors.forEach(e => problems.push('JSエラー（Meta）: ' + e));
        await ctx.close();
    }
    /* LINE のリンクを先に押した時は、content_name が line になる（リンクの中の要素を押す） */
    {
        const { ctx, page, errors } = await openPage(browser, base, base + 'index.html', { width: 390, height: 844 }, true);
        const got = await page.evaluate(() => {
            const a = document.querySelector('a[href*="s.lmes.jp"]');
            if (!a) { return null; }
            (a.querySelector('*') || a).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return window.__leads();
        });
        console.log('Meta Lead（LINE のリンクを先に押した後）: ' + JSON.stringify(got));
        if (!got) { problems.push('Meta の検査で、LINE のリンクが見つからない'); }
        else if (got.length !== 1 || got[0].content_name !== 'line' || got[0].content_category !== META_CATEGORY) { problems.push('LINE のリンクでの Lead が違う: ' + JSON.stringify(got)); }
        errors.forEach(e => problems.push('JSエラー（Meta・LINE）: ' + e));
        await ctx.close();
    }

    await browser.close();
    server.close();
    problems.forEach(p => console.log('  - ' + p));
    console.log(problems.length === 0 ? 'ALL CLEAR' : 'ISSUES: ' + problems.length);
    process.exit(problems.length === 0 ? 0 : 1);
})().catch(err => { console.error('FAILED', err); process.exit(1); });
