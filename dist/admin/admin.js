/* Mao Han admin: add or remove products on the website.
   The site is static (GitHub Pages). A fine-grained GitHub token with "Contents: read and write" on this one
   repository is stored in admin/key.json, encrypted with AES-GCM under a key derived from the admin password
   (PBKDF2-SHA256). After login the token lives only in this tab's memory. Saving writes the photos and
   dist/admin-products.js to the repository in one commit; the Pages workflow then publishes the site. */
'use strict';
(() => {
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }   // never inside a frame
  const REPO = 'junaed9156/Jialan-Caps', BRANCH = 'main', ROOT = 'dist/';
  const API = 'https://api.github.com';
  const KEY_FILE = 'admin/key.json', DATA_FILE = 'admin-products.js', PHOTO_DIR = 'assets/admin/';
  const ITERATIONS = 600000, MIN_PASSWORD = 12, MAX_PHOTOS = 8;
  const $ = id => document.getElementById(id);
  const enc = new TextEncoder(), dec = new TextDecoder();
  let token = null;
  let photos = [];   // {file, url, finish, finishZh}

  // ---------- small helpers ----------
  function status(id, text, kind) { const el = $(id); el.textContent = text || ''; el.className = 'status' + (kind ? ' ' + kind : ''); }
  function show(view) { ['login-view', 'setup-view', 'admin-view'].forEach(v => { $(v).hidden = v !== view; }); $('logout').hidden = view !== 'admin-view'; }
  function toB64(bytes) {
    let s = ''; const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const fromB64 = s => Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0));
  const textB64 = s => toB64(enc.encode(s));
  const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- encryption of the GitHub token ----------
  async function deriveKey(password, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(secret, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ITERATIONS);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
    return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: toB64(salt), iv: toB64(iv), data: toB64(data), saved: new Date().toISOString() };
  }
  async function unseal(box, password) {
    const key = await deriveKey(password, fromB64(box.salt), box.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
    return dec.decode(plain);
  }

  // ---------- GitHub ----------
  async function gh(path, options = {}, auth = token) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (auth) headers.Authorization = `Bearer ${auth}`;
    if (options.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { ...options, headers, cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) {
      let msg = ''; try { msg = (await r.json()).message || ''; } catch { /* no body */ }
      const e = new Error(`GitHub ${r.status}${msg ? ': ' + msg : ''}`); e.status = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  async function readRepoFile(path, ref = BRANCH) {
    try {
      const f = await gh(`/repos/${REPO}/contents/${ROOT}${path}?ref=${encodeURIComponent(ref)}`);
      return dec.decode(fromB64(f.content));
    } catch (e) { if (e.status === 404) return null; throw e; }
  }
  // One commit with several files; `files` is rebuilt from the latest branch head on each attempt.
  async function commit(message, buildFiles) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
      const head = ref.object.sha;
      const base = await gh(`/repos/${REPO}/git/commits/${head}`);
      const files = await buildFiles(head);
      const tree = [];
      for (const f of files) {
        if (f.delete) { tree.push({ path: ROOT + f.path, mode: '100644', type: 'blob', sha: null }); continue; }
        const blob = f.blobSha ? { sha: f.blobSha } : await gh(`/repos/${REPO}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: f.base64, encoding: 'base64' }) });
        f.blobSha = blob.sha;   // reuse the uploaded blob if the commit has to be retried
        tree.push({ path: ROOT + f.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const t = await gh(`/repos/${REPO}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
      const c = await gh(`/repos/${REPO}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
      try { await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) }); return c.sha; }
      catch (e) { if (e.status !== 422 || attempt === 2) throw e; await sleep(800); }   // someone else pushed: rebuild on the new head
    }
  }

  // ---------- product data file ----------
  function parseData(text) {
    if (!text) return { products: [] };
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    const data = JSON.parse(text.slice(i, j + 1));
    if (!Array.isArray(data.products)) data.products = [];
    return data;
  }
  function renderData(data) {
    const json = JSON.stringify(data, null, 1).replace(/</g, '\\u003c').split('\u2028').join('\\u2028').split('\u2029').join('\\u2029');
    return `/* Products added on the admin page (admin/). The admin page rewrites this file. */\nwindow.MAOHAN_ADMIN = ${json};\n`;
  }
  async function loadData(ref) { return parseData(await readRepoFile(DATA_FILE, ref)); }

  // ---------- photos: flattened onto white, 800 px and 400 px WebP (JPEG where WebP encoding is unavailable) ----------
  async function decode(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  // Same style as the catalogue photos: the product is cropped from its background, centred on a white
  // square and scaled to 80 % of it, so every product tile looks alike.
  function framePhoto(img, size = 1000, fill = 0.8) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    // Rows and columns that hold more than a trace of non-white pixels belong to the product.
    const rows = new Uint32Array(h), cols = new Uint32Array(w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.min(px[i], px[i + 1], px[i + 2]) < 240) { rows[y]++; cols[x]++; }
    }
    const minRow = Math.max(2, w * 0.004), minCol = Math.max(2, h * 0.004);
    let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h - 1 && rows[y0] < minRow) y0++;
    while (y1 > y0 && rows[y1] < minRow) y1--;
    while (x0 < w - 1 && cols[x0] < minCol) x0++;
    while (x1 > x0 && cols[x1] < minCol) x1--;
    if (x1 - x0 < 8 || y1 - y0 < 8) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }   // nothing found: keep the whole photo
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.01);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, scale = size * fill / Math.max(cw, ch);
    const out = document.createElement('canvas'); out.width = out.height = size;
    const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, size, size); o.imageSmoothingQuality = 'high';
    o.drawImage(c, x0, y0, cw, ch, (size - cw * scale) / 2, (size - ch * scale) / 2, cw * scale, ch * scale);
    return out;
  }
  function encodeImage(framed, side, type) {
    const c = document.createElement('canvas'); c.width = c.height = side;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(framed, 0, 0, side, side);
    return new Promise(r => c.toBlob(r, type, 0.88));
  }
  async function webpSupported() {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
    return !!b && b.type === 'image/webp';
  }

  // ---------- views ----------
  async function loadKey() {
    const r = await fetch(`key.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) return r.json();
    const text = await readRepoFile(KEY_FILE).catch(() => null);   // just set up and not yet published
    return text ? JSON.parse(text) : null;
  }
  async function start() {
    const cats = (window.JIALAN && window.JIALAN.categories) || {};
    for (const [k, v] of Object.entries(cats)) { const o = document.createElement('option'); o.value = k; o.textContent = v; $('f-category').append(o); }
    let key = null;
    try { key = await loadKey(); } catch { /* offline */ }
    show(key ? 'login-view' : 'setup-view');
    if (!key) status('setup-status', 'No admin has been set up yet. · 尚未设置管理员。');
  }

  // Login, with growing pauses after wrong passwords.
  let failures = 0;
  try { failures = Number(sessionStorage.getItem('admin-failures')) || 0; } catch { /* storage unavailable */ }
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button'); btn.disabled = true;
    try {
      if (failures > 2) { const wait = Math.min(60, 2 ** (failures - 2)); status('login-status', `Please wait ${wait} s… · 请稍候`); await sleep(wait * 1000); }
      status('login-status', 'Checking… · 验证中…');
      const key = await loadKey();
      if (!key) { show('setup-view'); return; }
      let t;
      try { t = await unseal(key, $('login-password').value); }
      catch { failures++; try { sessionStorage.setItem('admin-failures', String(failures)); } catch { /* ignore */ } status('login-status', 'Wrong password. · 密码错误。', 'bad'); return; }
      await gh(`/repos/${REPO}`, {}, t).catch(err => { throw new Error(err.status === 401 ? 'The GitHub token has expired or was revoked. Run setup again with a new token. · GitHub 令牌已过期，请重新设置。' : err.message); });
      token = t; failures = 0; try { sessionStorage.removeItem('admin-failures'); } catch { /* ignore */ }
      $('login-password').value = '';
      status('login-status', '');
      show('admin-view'); refreshList();
    } catch (err) { status('login-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });
  $('show-setup').addEventListener('click', () => { show('setup-view'); status('setup-status', ''); });
  $('back-login').addEventListener('click', () => show('login-view'));
  $('logout').addEventListener('click', () => { token = null; photos = []; renderPhotos(); show('login-view'); });

  // Setup: check the token can write to this repository, then store it encrypted.
  $('setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('setup-token').value.trim(), p1 = $('setup-password').value, p2 = $('setup-password2').value;
    if (p1.length < MIN_PASSWORD) return status('setup-status', `Use at least ${MIN_PASSWORD} characters. · 密码至少 ${MIN_PASSWORD} 位。`, 'bad');
    if (p1 !== p2) return status('setup-status', 'The passwords do not match. · 两次密码不一致。', 'bad');
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) return status('setup-status', 'That does not look like a GitHub token. · 令牌格式不正确。', 'bad');
    const btn = e.submitter || e.target.querySelector('button'); btn.disabled = true;
    try {
      status('setup-status', 'Checking the token… · 正在验证令牌…');
      const repo = await gh(`/repos/${REPO}`, {}, t);
      if (repo.permissions && !repo.permissions.push) throw new Error('This token cannot write to the repository. Give it "Contents: Read and write". · 令牌没有写入权限。');
      status('setup-status', 'Encrypting and saving… · 正在加密保存…');
      const box = await seal(t, p1);
      token = t;
      await commit('Admin: set up encrypted access key', async () => [{ path: KEY_FILE, base64: textB64(JSON.stringify(box, null, 1) + '\n') }]);
      ['setup-token', 'setup-password', 'setup-password2'].forEach(id => { $(id).value = ''; });
      status('setup-status', '');
      show('admin-view'); refreshList();
      status('save-status', 'Setup saved. You are logged in. · 设置已保存，已登录。', 'good');
    } catch (err) { token = null; status('setup-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });

  $('password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const p1 = $('new-password').value, p2 = $('new-password2').value;
    if (p1.length < MIN_PASSWORD) return status('password-status', `Use at least ${MIN_PASSWORD} characters. · 密码至少 ${MIN_PASSWORD} 位。`, 'bad');
    if (p1 !== p2) return status('password-status', 'The passwords do not match. · 两次密码不一致。', 'bad');
    const btn = e.submitter || e.target.querySelector('button'); btn.disabled = true;
    try {
      const box = await seal(token, p1);
      await commit('Admin: change password', async () => [{ path: KEY_FILE, base64: textB64(JSON.stringify(box, null, 1) + '\n') }]);
      $('new-password').value = $('new-password2').value = '';
      status('password-status', 'Password changed. It works on the live site in about 2 minutes. · 密码已修改，约 2 分钟后生效。', 'good');
    } catch (err) { status('password-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });

  // ---------- photo picker ----------
  function renderPhotos() {
    const list = $('photo-list'); list.textContent = '';
    photos.forEach((p, i) => {
      const li = document.createElement('li');
      const img = document.createElement('img'); img.src = p.url; img.alt = '';
      const l1 = document.createElement('label'); l1.textContent = `Colour / finish ${i + 1} · 颜色`;
      const in1 = document.createElement('input'); in1.maxLength = 50; in1.placeholder = i === 0 ? 'Glossy gold' : ''; in1.value = p.finish;
      in1.addEventListener('input', () => { p.finish = in1.value; }); l1.append(in1);
      const l2 = document.createElement('label'); l2.textContent = '中文颜色';
      const in2 = document.createElement('input'); in2.maxLength = 50; in2.placeholder = i === 0 ? '亮金' : ''; in2.value = p.finishZh;
      in2.addEventListener('input', () => { p.finishZh = in2.value; }); l2.append(in2);
      const row = document.createElement('div'); row.className = 'row';
      const first = document.createElement('button'); first.type = 'button'; first.textContent = i === 0 ? 'Main photo · 主图' : 'Make main · 设为主图'; first.disabled = i === 0;
      first.addEventListener('click', () => { photos.unshift(photos.splice(i, 1)[0]); renderPhotos(); });
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Remove · 删除';
      del.addEventListener('click', () => { URL.revokeObjectURL(p.url); photos.splice(i, 1); renderPhotos(); });
      row.append(first, del);
      li.append(img, l1, l2, row); list.append(li);
    });
  }
  $('f-photos').addEventListener('change', e => {
    for (const file of e.target.files) {
      if (photos.length >= MAX_PHOTOS) { status('save-status', `Up to ${MAX_PHOTOS} photos. · 最多 ${MAX_PHOTOS} 张。`, 'bad'); break; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20e6) { status('save-status', `${file.name}: use a JPEG, PNG or WebP under 20 MB. · 请使用 20MB 以内的 JPG/PNG/WebP。`, 'bad'); continue; }
      photos.push({ file, url: URL.createObjectURL(file), finish: '', finishZh: '' });
    }
    e.target.value = ''; renderPhotos();
  });

  // ---------- save a product ----------
  $('product-form').addEventListener('submit', async e => {
    e.preventDefault();
    const model = clean($('f-model').value, 40), name = clean($('f-name').value, 80), category = $('f-category').value;
    if (!model || !name) return status('save-status', 'Model and English name are required. · 请填写型号和英文名称。', 'bad');
    if (!photos.length) return status('save-status', 'Add at least one photo. · 请至少添加一张图片。', 'bad');
    if (!(category in ((window.JIALAN && window.JIALAN.categories) || {}))) return status('save-status', 'Choose a category. · 请选择类别。', 'bad');
    const btn = $('save-product'); btn.disabled = true;
    try {
      const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const type = (await webpSupported()) ? 'image/webp' : 'image/jpeg', ext = type === 'image/webp' ? 'webp' : 'jpg';
      const files = [], images = [];
      for (let i = 0; i < photos.length; i++) {
        status('save-status', `Preparing photo ${i + 1} of ${photos.length}… · 正在处理图片…`);
        const img = await decode(photos[i].file);
        const framed = framePhoto(img);
        const base = `${PHOTO_DIR}${id}-${i + 1}`;
        for (const size of [800, 400]) {
          const blob = await encodeImage(framed, size, type);
          files.push({ path: `${base}-${size}.${ext}`, base64: toB64(await blob.arrayBuffer()) });
        }
        images.push(base);
      }
      const finishes = photos.map((p, i) => clean(p.finish, 50) || (photos.length > 1 ? `Photo ${i + 1}` : 'Standard'));
      const finishesZh = photos.map(p => clean(p.finishZh, 50));
      const product = {
        id, model, name, category, images, imageExt: ext, finishes,
        name_zh: clean($('f-name-zh').value, 80) || undefined,
        description: clean($('f-desc').value, 600) || undefined,
        description_zh: clean($('f-desc-zh').value, 600) || undefined,
        material: clean($('f-material').value, 80) || undefined,
        material_zh: clean($('f-material-zh').value, 80) || undefined,
        size: clean($('f-size').value, 60) || undefined,
        neck: clean($('f-neck').value, 40) || undefined,
        weight: clean($('f-weight').value, 40) || undefined,
        badge: clean($('f-badge').value, 24).toUpperCase() || undefined,
        finishes_zh: finishesZh.some(Boolean) ? finishesZh : undefined,
        added: new Date().toISOString().slice(0, 10),
      };
      status('save-status', 'Saving to the website… · 正在保存…');
      await commit(`Admin: add product ${model}`, async head => {
        const data = await loadData(head);
        data.products = data.products.filter(p => p.id !== id);
        data.products.unshift(product);
        return [...files, { path: DATA_FILE, base64: textB64(renderData(data)) }];
      });
      photos.forEach(p => URL.revokeObjectURL(p.url)); photos = []; renderPhotos();
      $('product-form').reset();
      status('save-status', `Saved. ${model} will appear on the website in about 1–2 minutes. · 已保存，约 1–2 分钟后在网站显示。`, 'good');
      refreshList(); watchLive(id, true);
    } catch (err) { status('save-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });

  // ---------- list and delete ----------
  async function refreshList() {
    const list = $('product-list'); list.textContent = '';
    let data;
    try { data = await loadData(); } catch (err) { $('empty-list').hidden = false; $('empty-list').textContent = err.message; return; }
    $('empty-list').hidden = data.products.length > 0;
    for (const p of data.products) {
      const li = document.createElement('li');
      const img = document.createElement('img'); img.alt = ''; img.src = `../${p.images[0]}-400.${p.imageExt || 'webp'}`;
      img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });   // not published yet
      const info = document.createElement('div'); info.className = 'info';
      const s = document.createElement('strong'); s.textContent = `${p.model} — ${p.name}${p.name_zh ? ' · ' + p.name_zh : ''}`;
      const sp = document.createElement('span'); sp.textContent = `${p.category} · ${p.finishes.join(', ')} · ${p.added || ''}`;
      info.append(s, sp);
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete · 删除';
      del.addEventListener('click', () => removeProduct(p, del));
      li.append(img, info, del); list.append(li);
    }
  }
  async function removeProduct(p, btn) {
    if (!confirm(`Delete ${p.model} from the website? · 确定从网站删除 ${p.model}？`)) return;
    btn.disabled = true;
    try {
      await commit(`Admin: remove product ${p.model}`, async head => {
        const data = await loadData(head);
        const target = data.products.find(x => x.id === p.id);
        data.products = data.products.filter(x => x.id !== p.id);
        const files = [{ path: DATA_FILE, base64: textB64(renderData(data)) }];
        if (target) for (const base of target.images) for (const size of [800, 400]) files.push({ path: `${base}-${size}.${target.imageExt || 'webp'}`, delete: true });
        return files;
      });
      status('save-status', `${p.model} deleted. The website updates in about 1–2 minutes. · 已删除，约 1–2 分钟后更新。`, 'good');
      refreshList(); watchLive(p.id, false);
    } catch (err) { status('save-status', err.message, 'bad'); btn.disabled = false; }
  }

  // Tell the admin when the change is visible on the published site.
  async function watchLive(id, present) {
    for (let i = 0; i < 40; i++) {
      await sleep(10000);
      try {
        const text = await (await fetch(`../${DATA_FILE}?ts=${Date.now()}`, { cache: 'no-store' })).text();
        if (text.includes(`"${id}"`) === present) { status('save-status', present ? 'Live on the website now. · 已在网站上线。' : 'Removed from the website. · 已从网站移除。', 'good'); refreshList(); return; }
      } catch { /* keep waiting */ }
    }
  }

  start();
})();
