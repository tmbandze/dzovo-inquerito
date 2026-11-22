// Gera o cartaz do inquérito (PNG para WhatsApp) com o código QR.
// Uso:  npm run cartaz
// Cria cartaz-inquerito.png (e cartaz-inquerito.html, usado para o desenhar).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import QRCode from 'qrcode'

const URL_INQUERITO = 'https://tmbandze.github.io/dzovo-inquerito/'
const LINK_VISIVEL = 'tmbandze.github.io/dzovo-inquerito'

const qr = await QRCode.toString(URL_INQUERITO, {
  type: 'svg', errorCorrectionLevel: 'H', margin: 0, color: { dark: '#1c3a63', light: '#ffffff' },
})
const emblema = 'data:image/png;base64,' + readFileSync('public/emblema.png').toString('base64')

const icon = {
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
}
const svg = (p, s = 34) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`

const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --navy:#1c3a63; --navy-dark:#132a49; --navy-soft:#e9f0f8; --orange:#f57c00; --ink:#172433; --muted:#5a6779; }
  * { box-sizing:border-box; margin:0; }
  html, body { width:1080px; height:1350px; background:#fff; }
  body { font-family:Inter, system-ui, sans-serif; color:var(--ink); overflow:hidden; }
  .poster { position:relative; width:1080px; height:1350px; display:flex; flex-direction:column; align-items:center; }

  .top { width:100%; padding:40px 64px 120px; background:linear-gradient(160deg, var(--navy) 0%, var(--navy-dark) 100%); color:#fff; text-align:center; position:relative; overflow:hidden; }
  .top::before, .top::after { content:''; position:absolute; border-radius:50%; background:rgba(255,255,255,.05); }
  .top::before { width:520px; height:520px; left:-200px; top:-260px; }
  .top::after { width:420px; height:420px; right:-150px; bottom:-230px; }
  .brand { display:flex; align-items:center; justify-content:center; gap:18px; position:relative; }
  .brand .logo { width:92px; height:92px; border-radius:50%; background:#fff; display:grid; place-items:center; }
  .brand img { width:74px; }
  .brand b { display:block; font-family:Poppins; font-size:34px; letter-spacing:3px; text-align:left; }
  .brand small { display:block; font-size:19px; opacity:.8; text-align:left; letter-spacing:.5px; }
  .tag { display:inline-block; margin-top:40px; padding:9px 24px; border-radius:40px; background:var(--orange); font-weight:700; font-size:22px; letter-spacing:1.5px; text-transform:uppercase; position:relative; }
  h1 { margin-top:18px; font-family:Poppins; font-weight:800; font-size:80px; line-height:1.02; letter-spacing:-1px; position:relative; }
  .sub { margin:18px auto 0; max-width:840px; font-size:28px; line-height:1.4; opacity:.92; position:relative; }

  .card { margin-top:-90px; width:640px; padding:30px 30px 24px; border-radius:36px; background:#fff; box-shadow:0 24px 60px rgba(19,42,73,.22); text-align:center; position:relative; }
  .qr { width:500px; height:500px; margin:0 auto; padding:20px; border:5px solid var(--orange); border-radius:26px; }
  .qr svg { width:100%; height:100%; display:block; }
  .scan { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:20px; color:var(--navy); font-family:Poppins; font-weight:700; font-size:30px; }
  .scan svg { color:var(--orange); }
  .link { margin-top:8px; color:var(--muted); font-size:21px; white-space:nowrap; }
  .link b { color:var(--navy); font-weight:600; }

  .facts { display:flex; gap:20px; margin-top:32px; }
  .fact { display:flex; align-items:center; gap:12px; padding:16px 24px; border-radius:20px; background:var(--navy-soft); color:var(--navy); font-weight:600; font-size:24px; }
  .fact svg { color:var(--orange); flex:none; }

  .foot { margin-top:auto; width:100%; padding:26px 64px 34px; text-align:center; }
  .foot p { font-size:24px; color:var(--muted); line-height:1.45; }
  .foot strong { color:var(--navy); }
  .foot .en { margin-top:6px; font-size:20px; font-style:italic; }
</style></head>
<body><div class="poster">
  <section class="top">
    <div class="brand">
      <span class="logo"><img src="${emblema}" alt=""></span>
      <span><b>COLÉGIO DZOVO</b><small>Escola Primária · Primary School</small></span>
    </div>
    <span class="tag">Inquérito aos Encarregados de Educação</span>
    <h1>A sua opinião conta!</h1>
    <p class="sub">Ajude-nos a melhorar a escola do seu educando. Partilhe connosco o que está bem e o que podemos fazer melhor.</p>
  </section>

  <div class="card">
    <div class="qr">${qr}</div>
    <div class="scan">${svg(icon.camera, 36)} Aponte a câmara do telemóvel</div>
    <div class="link">ou toque no link: <b>${LINK_VISIVEL}</b></div>
  </div>

  <div class="facts">
    <span class="fact">${svg(icon.lock)} Anónimo</span>
    <span class="fact">${svg(icon.clock)} Cerca de 12 minutos</span>
    <span class="fact">${svg(icon.phone)} Português ou English</span>
  </div>

  <footer class="foot">
    <p>Se tem mais do que um educando na escola, <strong>responda uma vez por cada um.</strong><br>Obrigado pela sua participação!</p>
    <p class="en">Parent satisfaction survey · also available in English</p>
  </footer>
</div></body></html>`

writeFileSync('cartaz-inquerito.html', html)

const chromes = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)
const chrome = chromes.find((c) => existsSync(c))
if (!chrome) {
  console.log('Chrome não encontrado: abre cartaz-inquerito.html e tira uma captura de ecrã (1080×1350).')
  process.exit(0)
}
execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1.5',
  '--window-size=1080,1350', '--virtual-time-budget=8000',
  `--screenshot=${resolve('cartaz-inquerito.png')}`, 'file:///' + resolve('cartaz-inquerito.html').replace(/\\/g, '/'),
], { stdio: 'ignore' })
console.log('Criado cartaz-inquerito.png para', URL_INQUERITO)
