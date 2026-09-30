const QRCode = require('qrcode');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'salasfms.vercel.app').split(',')[0].trim();
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) ? forwardedHost : 'salasfms.vercel.app';
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol === 'http' || forwardedProtocol === 'https' ? forwardedProtocol : safeHost.startsWith('localhost:') ? 'http' : 'https';
  const svg = await QRCode.toString(`${protocol}://${safeHost}/aluno`, {
    type: 'svg', width: 420, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#12395b', light: '#ffffff' },
  });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (req.query?.download === '1') res.setHeader('Content-Disposition', 'attachment; filename="qr-portal-aluno.svg"');
  return res.status(200).end(svg);
};
