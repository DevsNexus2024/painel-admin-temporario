// Servidor simples para servir SPA - Fallback quando outras soluções não funcionarem
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

const server = createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = join(__dirname, 'dist', url === '/' ? 'index.html' : url);

  // Se arquivo existe, servir ele
  if (existsSync(filePath) && !filePath.endsWith('/')) {
    const ext = filePath.split('.').pop();
    const contentType = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
    }[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end('Erro ao ler arquivo');
    }
  } else {
    // Redirecionar tudo para index.html (SPA routing)
    const indexPath = join(__dirname, 'dist', 'index.html');
    try {
      const content = readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch (err) {
      res.writeHead(404);
      res.end('Arquivo não encontrado');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

