/* ============================================================
   退休者家政联盟 · 网站接收服务
   - 提供网站页面
   - 接收预约表单，保存到 data/bookings.json
   - 提供管理接口（admin.html 使用）
   启动：node server.js（或双击「启动网站.bat」）
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const PORT = Number(process.env.PORT) || 3000;
// 默认监听所有网卡（0.0.0.0），以便本地隧道和云平台都能访问
// 可通过环境变量 HOST 覆盖（例如 HOST=127.0.0.1 仅本机访问）
const HOST = process.env.HOST || '0.0.0.0';
// 后台访问密码：可用环境变量 ADMIN_PASS 指定，否则自动生成并保存到 data/admin-password.txt
function resolveAdminPass() {
  if (process.env.ADMIN_PASS) return process.env.ADMIN_PASS;
  const file = path.join(DATA_DIR, 'admin-password.txt');
  ensureData();
  try {
    const old = fs.readFileSync(file, 'utf8').trim();
    if (old) return old;
  } catch (e) {}
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  try { fs.writeFileSync(file, p, 'utf8'); } catch (e) {}
  return p;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------- 数据存取 ---------- */
function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, '[]\n', 'utf8');
  }
}

function readBookings() {
  ensureData();
  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

let writeQueue = Promise.resolve();
function writeBookings(list) {
  writeQueue = writeQueue.then(function () {
    ensureData();
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
  });
  return writeQueue;
}

function newId() {
  return 'B' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

const ADMIN_PASS = resolveAdminPass();

/* ---------- HTTP 工具 ---------- */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function checkAdmin(req, res) {
  const got = String(req.headers['x-admin-pass'] || '');
  if (got !== ADMIN_PASS) {
    sendJson(res, 401, { ok: false, error: '后台密码错误' });
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 1e6) { req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', function () { resolve(data); });
    req.on('error', reject);
  });
}

/* ---------- 静态文件 ---------- */
// 只允许公开的网页文件被访问；数据文件、脚本、配置一律拒绝
function isPublicFile(fp) {
  let rel = path.relative(ROOT, fp);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const norm = rel.split(path.sep).join('/');
  if (norm === '') return false;
  // 禁止任何 data 目录下的文件（预约数据、后台密码等）
  if (norm === 'data' || norm.startsWith('data/')) return false;
  // 禁止点文件/目录
  const parts = norm.split('/');
  if (parts.some(function (p) { return p.startsWith('.'); })) return false;
  // 只允许网页资源扩展名
  const ext = path.extname(norm).toLowerCase();
  const allowExt = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
  if (allowExt.indexOf(ext) === -1) return false;
  const base = parts[parts.length - 1].toLowerCase();
  // 禁止服务端代码和配置文件本身
  const denyBase = ['server.js', 'package.json', 'package-lock.json'];
  if (denyBase.indexOf(base) !== -1) return false;
  return true;
}

function serveStatic(req, res, pathname) {
  let p = pathname === '/' || pathname === '' ? '/index.html' : pathname;
  let fp = path.resolve(ROOT, '.' + p);
  // 无后缀地址自动尝试 .html（如 /admin -> admin.html）
  if (!path.extname(fp) && !fs.existsSync(fp)) {
    const alt = path.resolve(ROOT, '.' + p + '.html');
    if (fs.existsSync(alt)) fp = alt;
  }
  if (!isPublicFile(fp)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('页面不存在');
    return;
  }
  fs.readFile(fp, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('页面不存在');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream'
    });
    res.end(data);
  });
}

/* ---------- 主服务 ---------- */
const server = http.createServer(async function (req, res) {
  const u = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = decodeURIComponent(u.pathname);
  // 请求日志（方便观察隧道/访问情况）
  if (!/^\/(css|js|favicon\.ico)/.test(pathname)) {
    console.log('[' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '] ' + req.method + ' ' + pathname);
  }

  try {
    /* 1) 接收预约 */
    if (req.method === 'POST' && pathname === '/api/booking') {
      const body = await readBody(req);
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (e) { sendJson(res, 400, { ok: false, error: '数据格式错误' }); return; }
      const name = String(data.name || '').trim();
      const phone = String(data.phone || '').trim();
      const city = String(data.city || '').trim();
      const service = String(data.service || '').trim();
      if (!name || !phone || !city || !service) {
        sendJson(res, 400, { ok: false, error: '请填写完整信息' }); return;
      }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        sendJson(res, 400, { ok: false, error: '手机号格式不正确' }); return;
      }
      const item = {
        id: newId(),
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        name: name,
        phone: phone,
        city: city,
        service: service,
        note: String(data.note || '').trim(),
        status: 'new'
      };
      const list = readBookings();
      list.unshift(item);
      await writeBookings(list);
      console.log('\n📩 收到新预约！');
      console.log('   时间：' + item.time);
      console.log('   称呼：' + item.name);
      console.log('   电话：' + item.phone);
      console.log('   城市：' + item.city);
      console.log('   服务：' + item.service);
      if (item.note) console.log('   备注：' + item.note);
      console.log('   （已保存到 data/bookings.json，可在后台查看）\n');
      sendJson(res, 200, { ok: true, id: item.id });
      return;
    }

    /* 2) 查询预约列表（需后台密码） */
    if (req.method === 'GET' && pathname === '/api/bookings') {
      if (!checkAdmin(req, res)) return;
      sendJson(res, 200, { ok: true, bookings: readBookings() });
      return;
    }

    /* 3) 更新状态：POST /api/bookings/:id/status  {status: "done"|"new"}（需后台密码） */
    let m = pathname.match(/^\/api\/bookings\/([^\/]+)\/status$/);
    if (req.method === 'POST' && m) {
      if (!checkAdmin(req, res)) return;
      const id = m[1];
      const body = await readBody(req);
      let status = 'done';
      try { status = String(JSON.parse(body || '{}').status || 'done'); } catch (e) {}
      const list = readBookings();
      const item = list.find(function (b) { return b.id === id; });
      if (!item) { sendJson(res, 404, { ok: false, error: '记录不存在' }); return; }
      item.status = status === 'new' ? 'new' : 'done';
      await writeBookings(list);
      sendJson(res, 200, { ok: true });
      return;
    }

    /* 4) 删除：DELETE /api/bookings/:id（需后台密码） */
    m = pathname.match(/^\/api\/bookings\/([^\/]+)$/);
    if (req.method === 'DELETE' && m) {
      if (!checkAdmin(req, res)) return;
      const id = m[1];
      const list = readBookings();
      const next = list.filter(function (b) { return b.id !== id; });
      if (next.length === list.length) { sendJson(res, 404, { ok: false, error: '记录不存在' }); return; }
      await writeBookings(next);
      sendJson(res, 200, { ok: true });
      return;
    }

    /* 其余按静态文件处理 */
    serveStatic(req, res, pathname);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: '服务器错误' });
  }
});

server.listen(PORT, HOST, function () {
  const base = 'http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT;
  console.log('==================================================');
  console.log('  退休者家政联盟 · 网站接收服务已启动');
  console.log('  网站首页：' + base);
  console.log('  预约管理：' + base + '/admin');
  console.log('  后台密码：' + ADMIN_PASS + ' （登录后台时使用）');
  console.log('  数据文件：data/bookings.json');
  console.log('  收到新预约将在此窗口实时提醒');
  console.log('==================================================');
  console.log('按 Ctrl+C 停止服务');
  if (process.env.NO_OPEN !== '1') {
    const cp = require('child_process');
    try {
      if (process.platform === 'win32') {
        cp.spawn('cmd', ['/c', 'start', '', base], { detached: true, stdio: 'ignore' }).unref();
      } else if (process.platform === 'darwin') {
        cp.spawn('open', [base], { detached: true, stdio: 'ignore' }).unref();
      } else {
        cp.spawn('xdg-open', [base], { detached: true, stdio: 'ignore' }).unref();
      }
    } catch (e) {}
  }
});
