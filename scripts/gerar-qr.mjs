// Gera o código QR do inquérito em PNG (para impressão) e SVG.
// Uso:  npm run qr -- https://utilizador.github.io/dzovo-inquerito/
import QRCode from 'qrcode'

const url = process.argv[2]
if (!url || !/^https?:\/\//.test(url)) {
  console.error('Indica o endereço do inquérito. Ex.: npm run qr -- https://utilizador.github.io/dzovo-inquerito/')
  process.exit(1)
}

const opts = { errorCorrectionLevel: 'H', margin: 2, color: { dark: '#1c3a63', light: '#ffffff' } }
await QRCode.toFile('qr-inquerito.png', url, { ...opts, width: 1200 })
await QRCode.toFile('qr-inquerito.svg', url, { ...opts, type: 'svg' })
console.log('Criados qr-inquerito.png e qr-inquerito.svg para', url)
