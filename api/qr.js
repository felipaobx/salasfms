const QRCode = require('qrcode');
const fs = require('node:fs');
const path = require('node:path');

function createPoster(qrSvg) {
  const logoPath = path.join(process.cwd(), 'assets', 'fms-logo.png');
  const logoData = fs.readFileSync(logoPath).toString('base64');
  const posterQr = qrSvg.replace('<svg', '<svg x="240" y="610"');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#12395b" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#eef7fb"/>
  <circle cx="1005" cy="85" r="150" fill="#78be49" opacity="0.16"/>
  <circle cx="35" cy="1270" r="180" fill="#087abd" opacity="0.10"/>
  <rect x="55" y="45" width="970" height="1260" rx="44" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="55" y="45" width="970" height="18" rx="9" fill="#087abd"/>
  <image href="data:image/png;base64,${logoData}" x="140" y="100" width="800" height="311" preserveAspectRatio="xMidYMid meet"/>
  <text x="540" y="485" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#12395b">Reserve sua sala de tutoria</text>
  <text x="540" y="542" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#65a83d">por aqui</text>
  <rect x="205" y="575" width="670" height="670" rx="38" fill="#ffffff" stroke="#d9e9f1" stroke-width="4"/>
  ${posterQr}
  <text x="540" y="1280" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="600" fill="#587083">Aponte a câmera do celular para o QR Code</text>
</svg>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'salasfms.vercel.app').split(',')[0].trim();
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) ? forwardedHost : 'salasfms.vercel.app';
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol === 'http' || forwardedProtocol === 'https' ? forwardedProtocol : safeHost.startsWith('localhost:') ? 'http' : 'https';
  const isDownload = req.query?.download === '1';
  const isPoster = isDownload || req.query?.poster === '1';
  const svg = await QRCode.toString(`${protocol}://${safeHost}/aluno`, {
    type: 'svg', width: isPoster ? 600 : 420, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#12395b', light: '#ffffff' },
  });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (isDownload) {
    res.setHeader('Content-Disposition', 'attachment; filename="cartaz-reserva-sala.svg"');
  }
  return res.status(200).end(isPoster ? createPoster(svg) : svg);
};
