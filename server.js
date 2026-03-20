import { createServer } from 'http';
import { readFile, access } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { constants } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data', 'geo');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

async function handleGeo(code) {
  if (!code || !/^\d{6}$/.test(code)) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'invalid code' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const filePath = join(DATA_DIR, `${code}.json`);

  try {
    await access(filePath, constants.R_OK);
    const data = await readFile(filePath, 'utf-8');
    return {
      status: 200,
      body: data,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch {
    // 本地不存在，回退 DataV API
    try {
      const res = await fetch(
        `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`,
        {
          headers: {
            'Referer': 'https://datav.aliyun.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.text();
      return {
        status: 200,
        body: data,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      };
    } catch(e) {
      return {
        status: 502,
        body: JSON.stringify({ error: e.message }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  }
}

async function serveStatic(urlPath) {
  let filePath = join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = await readFile(filePath);
    return {
      status: 200,
      body: data,
      headers: { 'Content-Type': contentType }
    };
  } catch {
    if (urlPath !== '/' && !ext) {
      return serveStatic('/');
    }
    return {
      status: 404,
      body: 'Not Found',
      headers: { 'Content-Type': 'text/plain' }
    };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/geo') {
    const result = await handleGeo(url.searchParams.get('code'));
    res.writeHead(result.status, result.headers);
    res.end(result.body);
    return;
  }

  const result = await serveStatic(url.pathname);
  res.writeHead(result.status, result.headers);
  res.end(result.body);
});

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('周末自驾逃离计划 - 服务器已启动');
  console.log('='.repeat(50));
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  数据目录: ${DATA_DIR}`);
  console.log('='.repeat(50));
  console.log('');
  console.log('提示: 首次运行请执行 npm run download 下载数据');
  console.log('');
});
