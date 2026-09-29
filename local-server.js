const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const reservationsHandler = require('./api/reservations');

const port = Number(process.env.PORT || 3000);
const root = __dirname;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/reservations')) {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', async () => {
      try {
        request.body = body ? JSON.parse(body) : {};
      } catch {
        request.body = body;
      }
      const parsedUrl = new URL(request.url, `http://localhost:${port}`);
      request.query = Object.fromEntries(parsedUrl.searchParams.entries());

      response.status = (code) => {
        response.statusCode = code;
        return response;
      };
      response.json = (data) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(data));
        return response;
      };

      try {
        await reservationsHandler(request, response);
      } catch (err) {
        console.error('API Error:', err);
        response.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    });
    return;
  }

  const requestPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Acesso negado');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // Check if trying /aluno without .html
      if (safePath === 'aluno') {
        const alunoPath = path.join(root, 'aluno.html');
        if (fs.existsSync(alunoPath)) {
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(fs.readFileSync(alunoPath));
          return;
        }
      }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Página não encontrada');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
});

server.listen(port, () => {
  console.log(`Sistema disponível em http://localhost:${port}`);
});
