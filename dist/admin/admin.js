/* Mao Han admin: edit the website and add or remove products.
   The site is static (GitHub Pages). A fine-grained GitHub token with "Contents: read and write" on this one
   repository is stored in admin/key.json, encrypted with AES-GCM under a key derived from the admin ID and
   password together (PBKDF2-SHA256). After login the token lives only in this tab's memory. Saving writes the photos and
   dist/admin-products.js, or dist/site-content.json (contact details, every text, catalogue products, pictures, the
   catalogue PDF) plus any uploaded file, to the repository in one commit. The Pages workflow then publishes the site,
   applying site-content.json with scripts/apply-content.mjs. */
'use strict';
(() => {
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }   // never inside a frame
  const REPO = 'junaed9156/Jialan-Caps', BRANCH = 'main', ROOT = 'dist/';
  const API = 'https://api.github.com';
  const KEY_FILE = 'admin/key.json', DATA_FILE = 'admin-products.js', PHOTO_DIR = 'assets/admin/';
  const ITERATIONS = 600000, MIN_PASSWORD = 12, MIN_ID = 3, MAX_PHOTOS = 8;
  const $ = id => document.getElementById(id);
  const enc = new TextEncoder(), dec = new TextDecoder();
  let token = null;
  let photos = [];   // {file, url, finish, finishZh}
  let base = null;      // admin/content-base.json (published with the site): the original of every editable item
  let content = null;   // site-content.json as last read from the repository: the admin's edits

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
  // Key version 2 locks the token with the admin ID and the password together; version 1 used the password alone.
  const normId = id => String(id || '').normalize('NFC').trim().toLowerCase();
  const lockText = (id, password) => `${normId(id)}\u0000${password}`;
  async function seal(secret, id, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(lockText(id, password), salt, ITERATIONS);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
    return { v: 2, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: toB64(salt), iv: toB64(iv), data: toB64(data), saved: new Date().toISOString() };
  }
  async function unseal(box, id, password) {
    const key = await deriveKey(box.v >= 2 ? lockText(id, password) : password, fromB64(box.salt), box.iterations);
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
      const id = $('login-id').value, pw = $('login-password').value;
      if (normId(id).length < MIN_ID) { status('login-status', `Enter the admin ID (at least ${MIN_ID} characters). · 请输入管理员账号。`, 'bad'); return; }
      let t;
      try { t = await unseal(key, id, pw); }
      catch { failures++; try { sessionStorage.setItem('admin-failures', String(failures)); } catch { /* ignore */ } status('login-status', 'Wrong admin ID or password. · 账号或密码错误。', 'bad'); return; }
      await gh(`/repos/${REPO}`, {}, t).catch(err => { throw new Error(err.status === 401 ? 'The GitHub token has expired or was revoked. Run setup again with a new token. · GitHub 令牌已过期，请重新设置。' : err.message); });
      token = t; failures = 0; try { sessionStorage.removeItem('admin-failures'); } catch { /* ignore */ }
      $('login-password').value = '';
      status('login-status', '');
      show('admin-view'); refreshList(); loadContent();
      if (!(key.v >= 2)) {   // older key locked by the password alone: lock it with the ID typed now as well
        status('save-status', 'Saving your admin ID… · 正在保存管理员账号…');
        try {
          const box = await seal(t, id, pw);
          await commit('Admin: require admin ID and password', async () => [{ path: KEY_FILE, base64: textB64(JSON.stringify(box, null, 1) + '\n') }]);
          status('save-status', 'Admin ID saved. From now on log in with this ID and password (live in about 2 minutes). · 管理员账号已保存。', 'good');
        } catch (err) { status('save-status', `Could not save the admin ID: ${err.message}`, 'bad'); }
      }
    } catch (err) { status('login-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });
  $('show-setup').addEventListener('click', () => { show('setup-view'); status('setup-status', ''); });
  $('back-login').addEventListener('click', () => show('login-view'));
  $('logout').addEventListener('click', () => { token = null; photos = []; renderPhotos(); base = null; content = null; show('login-view'); });

  // Setup: check the token can write to this repository, then store it encrypted.
  $('setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('setup-token').value.trim(), id = $('setup-id').value, p1 = $('setup-password').value, p2 = $('setup-password2').value;
    if (normId(id).length < MIN_ID) return status('setup-status', `Use an admin ID of at least ${MIN_ID} characters. · 管理员账号至少 ${MIN_ID} 位。`, 'bad');
    if (p1.length < MIN_PASSWORD) return status('setup-status', `Use at least ${MIN_PASSWORD} characters. · 密码至少 ${MIN_PASSWORD} 位。`, 'bad');
    if (p1 !== p2) return status('setup-status', 'The passwords do not match. · 两次密码不一致。', 'bad');
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) return status('setup-status', 'That does not look like a GitHub token. · 令牌格式不正确。', 'bad');
    const btn = e.submitter || e.target.querySelector('button'); btn.disabled = true;
    try {
      status('setup-status', 'Checking the token… · 正在验证令牌…');
      const repo = await gh(`/repos/${REPO}`, {}, t);
      if (repo.permissions && !repo.permissions.push) throw new Error('This token cannot write to the repository. Give it "Contents: Read and write". · 令牌没有写入权限。');
      status('setup-status', 'Encrypting and saving… · 正在加密保存…');
      const box = await seal(t, id, p1);
      token = t;
      await commit('Admin: set up encrypted access key', async () => [{ path: KEY_FILE, base64: textB64(JSON.stringify(box, null, 1) + '\n') }]);
      ['setup-token', 'setup-id', 'setup-password', 'setup-password2'].forEach(id => { $(id).value = ''; });
      status('setup-status', '');
      show('admin-view'); refreshList(); loadContent();
      status('save-status', 'Setup saved. You are logged in. · 设置已保存，已登录。', 'good');
    } catch (err) { token = null; status('setup-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });

  $('password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('new-id').value, p1 = $('new-password').value, p2 = $('new-password2').value;
    if (normId(id).length < MIN_ID) return status('password-status', `Use an admin ID of at least ${MIN_ID} characters. · 管理员账号至少 ${MIN_ID} 位。`, 'bad');
    if (p1.length < MIN_PASSWORD) return status('password-status', `Use at least ${MIN_PASSWORD} characters. · 密码至少 ${MIN_PASSWORD} 位。`, 'bad');
    if (p1 !== p2) return status('password-status', 'The passwords do not match. · 两次密码不一致。', 'bad');
    const btn = e.submitter || e.target.querySelector('button'); btn.disabled = true;
    try {
      const box = await seal(token, id, p1);
      await commit('Admin: change admin ID and password', async () => [{ path: KEY_FILE, base64: textB64(JSON.stringify(box, null, 1) + '\n') }]);
      $('new-id').value = $('new-password').value = $('new-password2').value = '';
      status('password-status', 'ID and password changed. They work on the live site in about 2 minutes. · 账号和密码已修改，约 2 分钟后生效。', 'good');
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

  // =====================================================================================
  // Website content: contact details, catalogue PDF, every text, catalogue products, pictures.
  // Edits live in dist/site-content.json; only differences from the original are stored, so
  // "restore" simply removes an edit. The deploy applies them (scripts/apply-content.mjs).
  // =====================================================================================
  const CONTENT_FILE = 'site-content.json';
  const CONTACT = ['email', 'whatsapp', 'wechat', 'company_en', 'company_zh', 'address_en', 'address_zh'];
  const PRODUCT_FIELDS = ['name', 'name_zh', 'description', 'description_zh', 'badge', 'badge_zh'];
  const GROUPS = {
    head: 'Page title & search engines · 页面标题与搜索引擎', announcement: 'Top bar · 顶部栏', header: 'Header · 页头',
    'desktop-nav': 'Menu · 菜单', 'mobile-nav': 'Phone menu · 手机菜单', hero: 'Top of the page · 首屏', collection: 'Collection · 产品系列',
    'product-dialog': 'Product window · 产品详情窗口', studio: '3D studio · 3D 工作室', anatomy: 'Scroll story · 滚动展示',
    personalise: 'Made personal & About · 专属定制与关于我们', contact: 'Contact · 联系我们', 'enquiry-form': 'Enquiry form · 询价表单',
    'shortlist-dialog': 'Shortlist window · 收藏清单窗口', footer: 'Footer · 页脚', aside: 'Other · 其他',
  };
  const KINDS = { placeholder: 'Input hint · 输入提示', 'aria-label': 'Screen-reader label · 读屏标签', alt: 'Picture description · 图片说明', content: 'Search-engine text · 搜索引擎文字', title: 'Tooltip · 提示' };
  const groupName = g => GROUPS[g] || g;
  const emptyContent = () => ({ v: 1, contact: {}, text: {}, images: {}, products: { order: [], edits: {} } });
  function parseContent(text) {
    let c = {};
    try { c = JSON.parse(text || '{}') || {}; } catch { c = {}; }
    const e = emptyContent();
    return {
      ...e, ...c,
      contact: c.contact && typeof c.contact === 'object' ? c.contact : {},
      text: c.text && typeof c.text === 'object' ? c.text : {},
      images: c.images && typeof c.images === 'object' ? c.images : {},
      products: { order: Array.isArray(c.products?.order) ? c.products.order : [], edits: c.products?.edits && typeof c.products.edits === 'object' ? c.products.edits : {} },
    };
  }
  const stampName = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const unsafe = v => /[<>"\\]/.test(v);
  async function repoHas(path, ref) {
    try { await gh(`/repos/${REPO}/contents/${ROOT}${path}?ref=${encodeURIComponent(ref)}`); return true; }
    catch (e) { if (e.status === 404) return false; throw e; }
  }
  // An earlier admin upload that is no longer used is removed in the same commit.
  async function dropUpload(path, ref) {
    return typeof path === 'string' && /^assets\/site\/[\w-]+\.\w+$/.test(path) && await repoHas(path, ref) ? [{ path, delete: true }] : [];
  }
  // Read the latest edits, change them, and commit (with any uploaded files) in one go.
  async function saveContent(message, mutate, extra) {
    const saved = new Date().toISOString();
    let next;
    await commit(message, async head => {
      const cur = parseContent(await readRepoFile(CONTENT_FILE, head));
      const files = extra ? await extra(cur, head) : [];
      mutate(cur);
      cur.saved = saved;
      next = cur;
      return [...files, { path: CONTENT_FILE, base64: textB64(JSON.stringify(cur, null, 1) + '\n') }];
    });
    content = next;
    watchContent(saved);
  }
  let watching = 0;
  async function watchContent(saved) {
    const run = ++watching;
    status('content-status', 'Publishing… the website updates in about 2 minutes. · 发布中，约 2 分钟后网站更新。');
    for (let i = 0; i < 60 && run === watching; i++) {
      await sleep(10000);
      try {
        const live = await (await fetch(`../${CONTENT_FILE}?ts=${Date.now()}`, { cache: 'no-store' })).json();
        if (live.saved === saved && run === watching) {
          status('content-status', 'Live on the website now. Refresh the website to see it. · 已在网站上线，刷新网站即可查看。', 'good');
          return;
        }
      } catch { /* not published yet */ }
    }
    if (run === watching) status('content-status', 'Saved, but the website has not updated yet. Check again in a few minutes. · 已保存，网站尚未更新，请几分钟后再查看。', 'bad');
  }
  const guarded = (button, statusId, fn) => async () => {
    button.disabled = true;
    try { await fn(); } catch (err) { status(statusId, err.message, 'bad'); } finally { button.disabled = false; }
  };

  async function loadContent() {
    status('content-status', 'Loading the website content… · 正在加载网站内容…');
    base = null;
    try {
      const r = await fetch(`content-base.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) base = await r.json();
    } catch { /* not published yet */ }
    try { content = parseContent(await readRepoFile(CONTENT_FILE)); }
    catch (err) { status('content-status', err.message, 'bad'); return; }
    if (!base) {
      status('content-status', 'The list of editable items appears after the next website update (about 2 minutes). Reload this page then. · 可编辑内容列表将在下次网站更新后出现（约 2 分钟），届时请刷新本页。', 'bad');
      document.querySelectorAll('#tab-contact button, #tab-text button, #tab-catalogue button').forEach(b => { b.disabled = true; });
      return;
    }
    status('content-status', '');
    renderContact(); renderText(); renderCatalogue(); renderPictures();
  }

  // ---------- tabs ----------
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    document.querySelectorAll('#tabs [data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === b)));
    document.querySelectorAll('#admin-view > .tab').forEach(t => { t.hidden = t.id !== b.dataset.tab; });
  });

  // ---------- contact details ----------
  const contactValue = f => (typeof content.contact[f] === 'string' ? content.contact[f] : base.defaults[f]);
  function renderContact() {
    for (const f of CONTACT) $('c-' + f).value = contactValue(f);
    $('email-note').hidden = true;
    const pdf = content.catalogue || base.defaults.catalogue;
    $('pdf-current').href = '../' + pdf; $('pdf-current').textContent = pdf.split('/').pop();
    $('reset-pdf').disabled = !content.catalogue;
  }
  $('c-email').addEventListener('input', () => { $('email-note').hidden = $('c-email').value.trim() === contactValue('email'); });
  $('contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = {}; for (const f of CONTACT) v[f] = clean($('c-' + f).value, f.startsWith('address') || f.startsWith('company') ? 200 : 120);
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v.email)) return status('contact-status', 'Enter a valid email address. · 请输入有效的邮箱。', 'bad');
    if (!/^\+?[0-9][0-9 ()-]{5,24}$/.test(v.whatsapp) || v.whatsapp.replace(/\D/g, '').length < 7) return status('contact-status', 'Enter the WhatsApp number with its country code, e.g. +86 138 1295 0775. · 请输入带国家代码的 WhatsApp 号码。', 'bad');
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(v.wechat)) return status('contact-status', 'The WeChat ID may use letters, numbers, - and _ only. · 微信号只能包含字母、数字、- 和 _。', 'bad');
    if (!v.company_en || !v.address_en || !v.address_zh) return status('contact-status', 'Company name (English) and both addresses are required. · 请填写英文公司名称和中英文地址。', 'bad');
    if (CONTACT.some(f => unsafe(v[f]))) return status('contact-status', 'Please do not use < > " or \\ in these fields. · 请勿使用 < > " 或 \\。', 'bad');
    const btn = $('save-contact'); btn.disabled = true;
    try {
      status('contact-status', 'Saving… · 正在保存…');
      await saveContent('Admin: update contact details', cur => {
        cur.contact = {};
        for (const f of CONTACT) if (v[f] !== base.defaults[f]) cur.contact[f] = v[f];
      });
      renderContact();
      status('contact-status', 'Saved. Live in about 2 minutes. · 已保存，约 2 分钟后上线。', 'good');
    } catch (err) { status('contact-status', err.message, 'bad'); }
    finally { btn.disabled = false; }
  });
  $('reset-contact').addEventListener('click', guarded($('reset-contact'), 'contact-status', async () => {
    if (!confirm('Restore the original contact details? · 恢复原始联系方式？')) return;
    status('contact-status', 'Saving… · 正在保存…');
    await saveContent('Admin: restore original contact details', cur => { cur.contact = {}; });
    renderContact();
    status('contact-status', 'Original details restored. Live in about 2 minutes. · 已恢复，约 2 分钟后上线。', 'good');
  }));

  // ---------- catalogue PDF ----------
  const MAX_PDF = 80e6;
  $('pdf-file').addEventListener('change', () => {
    const f = $('pdf-file').files[0];
    const ok = f && /\.pdf$/i.test(f.name) && f.size <= MAX_PDF;
    $('save-pdf').disabled = !ok;
    status('pdf-status', f && !ok ? 'Choose a PDF file up to 80 MB. · 请选择 80 MB 以内的 PDF 文件。' : f ? `${f.name} · ${(f.size / 1e6).toFixed(1)} MB` : '', f && !ok ? 'bad' : '');
  });
  $('save-pdf').addEventListener('click', guarded($('save-pdf'), 'pdf-status', async () => {
    const f = $('pdf-file').files[0];
    if (!f) return;
    status('pdf-status', 'Reading the PDF… · 正在读取 PDF…');
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (dec.decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('This file is not a PDF. · 该文件不是 PDF。');
    const upload = { path: `assets/site/catalogue-${stampName()}.pdf`, base64: toB64(bytes) };   // kept across commit retries
    status('pdf-status', `Uploading ${(f.size / 1e6).toFixed(1)} MB… this can take a minute. · 正在上传，可能需要一分钟…`);
    await saveContent('Admin: replace the catalogue PDF', cur => { cur.catalogue = upload.path; }, async (cur, head) => [upload, ...await dropUpload(cur.catalogue, head)]);
    $('pdf-file').value = ''; $('save-pdf').disabled = true; renderContact();
    status('pdf-status', 'Uploaded. Every catalogue link opens the new PDF in about 2 minutes. · 已上传，约 2 分钟后所有目录链接将打开新 PDF。', 'good');
  }));
  $('reset-pdf').addEventListener('click', guarded($('reset-pdf'), 'pdf-status', async () => {
    if (!confirm('Go back to the original catalogue PDF? · 恢复原始目录 PDF？')) return;
    status('pdf-status', 'Saving… · 正在保存…');
    await saveContent('Admin: restore the original catalogue PDF', cur => { delete cur.catalogue; }, async (cur, head) => dropUpload(cur.catalogue, head));
    renderContact();
    status('pdf-status', 'The original PDF is back in about 2 minutes. · 约 2 分钟后恢复原始 PDF。', 'good');
  }));

  // ---------- website text ----------
  let textDraft = new Map();
  const textRows = new Map();
  function renderText() {
    textDraft = new Map(base.texts.map(t => {
      const e = content.text[t.key] || {};
      return [t.key, { en: typeof e.en === 'string' ? e.en : t.key, zh: typeof e.zh === 'string' ? e.zh : t.zh }];
    }));
    const groupSel = $('text-group');
    groupSel.length = 1;
    for (const g of [...new Set(base.texts.map(t => t.group))]) { const o = document.createElement('option'); o.value = g; o.textContent = groupName(g); groupSel.append(o); }
    const list = $('text-list'); list.textContent = ''; textRows.clear();
    let lastGroup = null;
    for (const t of base.texts) {
      if (t.group !== lastGroup) {
        const h = document.createElement('h3'); h.className = 'group'; h.dataset.group = t.group; h.textContent = groupName(t.group); list.append(h); lastGroup = t.group;
      }
      const row = document.createElement('div'); row.className = 'text-row'; row.dataset.group = t.group;
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = [KINDS[t.kind], t.count > 1 ? `appears ${t.count}× · 出现 ${t.count} 次` : '', t.keep ? 'brand name · 品牌名称' : ''].filter(Boolean).join(' · ');
      const d = textDraft.get(t.key);
      const area = (label, value, lang) => {
        const l = document.createElement('label'); l.textContent = label;
        const a = document.createElement('textarea'); a.value = value; a.lang = lang; a.rows = Math.min(6, Math.max(1, Math.ceil(value.length / 60)));
        a.maxLength = 2000; l.append(a); return [l, a];
      };
      const [l1, en] = area('English', d.en, 'en'), [l2, zh] = area('中文', d.zh, 'zh');
      if (t.zh === t.key) zh.placeholder = 'Same as English · 与英文相同';
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'reset'; reset.textContent = 'Original · 原文';
      const sync = () => {
        d.en = en.value; d.zh = zh.value;
        row.classList.toggle('changed', d.en !== t.key || d.zh !== t.zh);
        reset.hidden = !row.classList.contains('changed');
        countText();
      };
      en.addEventListener('input', sync); zh.addEventListener('input', sync);
      reset.addEventListener('click', () => { en.value = t.key; zh.value = t.zh; sync(); });
      row.append(meta, l1, l2, reset); list.append(row);
      textRows.set(t.key, { row, t, d });
      sync();
    }
    filterText();
  }
  function countText() {
    const n = [...textRows.values()].filter(r => r.row.classList.contains('changed')).length;
    $('text-count').textContent = `${n} changed · 已修改 ${n} 处`;
  }
  function filterText() {
    const q = $('text-search').value.trim().toLowerCase(), g = $('text-group').value, onlyChanged = $('text-edited').checked;
    const visibleGroups = new Set();
    for (const { row, t, d } of textRows.values()) {
      const hay = `${t.key}\n${t.zh}\n${d.en}\n${d.zh}`.toLowerCase();
      const show = (!q || hay.includes(q)) && (!g || t.group === g) && (!onlyChanged || row.classList.contains('changed'));
      row.hidden = !show;
      if (show) visibleGroups.add(t.group);
    }
    $('text-list').querySelectorAll('h3.group').forEach(h => { h.hidden = !visibleGroups.has(h.dataset.group); });
  }
  ['text-search', 'text-group', 'text-edited'].forEach(id => $(id).addEventListener(id === 'text-search' ? 'input' : 'change', filterText));
  $('save-text').addEventListener('click', guarded($('save-text'), 'text-status', async () => {
    const text = {};
    for (const { t, d } of textRows.values()) {
      const en = clean(d.en, 2000), zh = clean(d.zh, 2000), entry = {};
      if (en && en !== t.key) entry.en = en;
      if (zh && zh !== t.zh) entry.zh = zh;
      if (Object.keys(entry).length) text[t.key] = entry;
    }
    status('text-status', 'Saving… · 正在保存…');
    await saveContent(`Admin: update website text (${Object.keys(text).length} edits)`, cur => { cur.text = text; });
    status('text-status', 'Saved. Live in about 2 minutes. · 已保存，约 2 分钟后上线。', 'good');
  }));

  // ---------- catalogue products ----------
  let catOrder = [], catDraft = new Map();
  function renderCatalogue() {
    const byId = new Map(base.products.map(p => [p.id, p]));
    const saved = content.products.order.filter(id => byId.has(id));
    catOrder = [...saved, ...base.products.map(p => p.id).filter(id => !saved.includes(id))];
    catDraft = new Map(base.products.map(p => {
      const e = content.products.edits[p.id] || {}, d = { hidden: e.hidden === true };
      for (const f of PRODUCT_FIELDS) d[f] = typeof e[f] === 'string' ? e[f] : p[f] || '';
      return [p.id, d];
    }));
    drawCatalogue();
  }
  function drawCatalogue() {
    const byId = new Map(base.products.map(p => [p.id, p]));
    const list = $('catalogue-list'); list.textContent = '';
    catOrder.forEach((id, i) => {
      const p = byId.get(id), d = catDraft.get(id);
      const li = document.createElement('li'); li.classList.toggle('is-hidden', d.hidden);
      const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.src = `../${p.image}-400.webp`;
      const body = document.createElement('div'); body.className = 'body';
      const head = document.createElement('div'); head.className = 'head';
      const title = document.createElement('strong'); title.textContent = `${i + 1}. ${p.model}`;
      const hide = document.createElement('label'); hide.className = 'check';
      const hb = document.createElement('input'); hb.type = 'checkbox'; hb.checked = d.hidden;
      hb.addEventListener('change', () => { d.hidden = hb.checked; li.classList.toggle('is-hidden', d.hidden); countCatalogue(); });
      hide.append(hb, ' Hide from website · 在网站隐藏');
      const move = document.createElement('span'); move.className = 'move';
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.title = 'Move up · 上移'; up.disabled = i === 0;
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.title = 'Move down · 下移'; down.disabled = i === catOrder.length - 1;
      up.addEventListener('click', () => { [catOrder[i - 1], catOrder[i]] = [catOrder[i], catOrder[i - 1]]; drawCatalogue(); });
      down.addEventListener('click', () => { [catOrder[i + 1], catOrder[i]] = [catOrder[i], catOrder[i + 1]]; drawCatalogue(); });
      move.append(up, down);
      head.append(title, hide, move);
      const grid = document.createElement('div'); grid.className = 'grid';
      const field = (label, f, max, multi) => {
        const l = document.createElement('label'); l.textContent = label;
        const el = document.createElement(multi ? 'textarea' : 'input'); el.maxLength = max; el.value = d[f]; if (multi) el.rows = 3;
        el.addEventListener('input', () => { d[f] = el.value; countCatalogue(); });
        l.append(el); grid.append(l);
      };
      field('Name · 英文名称', 'name', 80); field('中文名称', 'name_zh', 80);
      field('Description · 英文描述', 'description', 600, true); field('中文描述', 'description_zh', 600, true);
      field('Label (e.g. NEW) · 英文标签', 'badge', 24); field('中文标签', 'badge_zh', 24);
      body.append(head, grid);
      li.append(img, body); list.append(li);
    });
    countCatalogue();
  }
  function catalogueEdits() {
    const edits = {};
    for (const p of base.products) {
      const d = catDraft.get(p.id), e = {};
      if (d.hidden) e.hidden = true;
      for (const [enF, zhF] of [['name', 'name_zh'], ['description', 'description_zh'], ['badge', 'badge_zh']]) {
        const en = clean(d[enF], 600), zh = clean(d[zhF], 600);
        const enChanged = en !== (p[enF] || ''), zhChanged = zh !== (p[zhF] || '');
        if (enChanged && en) e[enF] = en;
        // A changed English text keeps its Chinese explicitly, so the Chinese page never falls back to English.
        if ((zhChanged || enChanged) && zh) e[zhF] = zh;
      }
      if (Object.keys(e).length) edits[p.id] = e;
    }
    return edits;
  }
  function countCatalogue() {
    const n = Object.keys(catalogueEdits()).length, moved = catOrder.join() !== base.products.map(p => p.id).join();
    $('catalogue-count').textContent = `${n} product${n === 1 ? '' : 's'} changed${moved ? ', order changed' : ''} · 已修改 ${n} 个产品${moved ? '，排序已调整' : ''}`;
  }
  $('save-catalogue').addEventListener('click', guarded($('save-catalogue'), 'catalogue-status', async () => {
    const edits = catalogueEdits(), moved = catOrder.join() !== base.products.map(p => p.id).join();
    status('catalogue-status', 'Saving… · 正在保存…');
    await saveContent('Admin: update catalogue products', cur => { cur.products = { order: moved ? catOrder.slice() : [], edits }; });
    status('catalogue-status', 'Saved. Live in about 2 minutes. · 已保存，约 2 分钟后上线。', 'good');
  }));

  // ---------- pictures ----------
  function loadImage(src) {
    return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not open the picture. · 无法打开图片。')); i.src = src; });
  }
  async function fitPicture(file, target, fit, type) {
    const img = await decode(file);
    const W = target.naturalWidth, H = target.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (type !== 'image/png') { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
    const s = (fit === 'cover' ? Math.max : Math.min)(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const blob = await new Promise(r => c.toBlob(r, type, 0.88));
    if (!blob) throw new Error('This browser could not save the picture. · 浏览器无法保存图片。');
    return blob;
  }
  const justSaved = new Map();   // picture path → local preview, until the website has published it
  function renderPictures() {
    const list = $('picture-list'); list.textContent = '';
    for (const item of base.images) {
      const current = content.images[item.src] || item.src;
      const li = document.createElement('li');
      const fig = document.createElement('div'); fig.className = 'pic';
      const img = document.createElement('img'); img.alt = ''; img.src = justSaved.get(current) || '../' + current; fig.append(img);
      const body = document.createElement('div'); body.className = 'body';
      const title = document.createElement('strong'); title.textContent = item.label;
      const info = document.createElement('span'); info.className = 'muted small';
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
      const row = document.createElement('div'); row.className = 'row';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Save picture · 保存图片'; save.hidden = true;
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel · 取消'; cancel.hidden = true;
      const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Use the original · 恢复原图'; reset.hidden = !content.images[item.src];
      row.append(save, cancel, reset);
      body.append(title, info, input, row);
      li.append(fig, body); list.append(li);
      let original, pending = null;
      loadImage('../' + item.src).then(o => { original = o; info.textContent = `${o.naturalWidth} × ${o.naturalHeight} px${current !== item.src ? ' · replaced · 已替换' : ''}`; }).catch(() => { info.textContent = ''; });
      const ext = /\.png$/.test(item.src) ? 'png' : 'webp';
      input.addEventListener('change', async () => {
        const f = input.files[0];
        if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 20e6) { status('picture-status', 'Use a JPEG, PNG or WebP under 20 MB. · 请使用 20MB 以内的 JPG/PNG/WebP。', 'bad'); input.value = ''; return; }
        try {
          if (!original) original = await loadImage('../' + item.src);
          let type = ext === 'png' ? 'image/png' : 'image/webp';
          if (type === 'image/webp' && !(await webpSupported())) type = 'image/jpeg';
          const blob = await fitPicture(f, original, item.fit, type);
          if (pending) URL.revokeObjectURL(pending.url);
          pending = { blob, type, url: URL.createObjectURL(blob) };
          img.src = pending.url; save.hidden = cancel.hidden = false;
          status('picture-status', 'Preview ready. Press “Save picture” to publish it. · 预览已生成，点击“保存图片”发布。');
        } catch (err) { status('picture-status', err.message, 'bad'); }
      });
      cancel.addEventListener('click', () => { if (pending) URL.revokeObjectURL(pending.url); pending = null; input.value = ''; img.src = justSaved.get(current) || '../' + current; save.hidden = cancel.hidden = true; });
      save.addEventListener('click', guarded(save, 'picture-status', async () => {
        if (!pending) return;
        const slug = item.src.split('/').pop().replace(/\.\w+$/, '').replace(/[^\w-]/g, '');
        const upload = { path: `assets/site/${slug}-${stampName()}.${pending.type === 'image/png' ? 'png' : pending.type === 'image/webp' ? 'webp' : 'jpg'}`, base64: toB64(await pending.blob.arrayBuffer()) };
        status('picture-status', 'Saving… · 正在保存…');
        await saveContent(`Admin: replace picture ${item.src}`, cur => { cur.images[item.src] = upload.path; }, async (cur, head) => [upload, ...await dropUpload(cur.images[item.src], head)]);
        justSaved.set(upload.path, pending.url); pending = null; renderPictures();
        status('picture-status', 'Saved. Live in about 2 minutes. · 已保存，约 2 分钟后上线。', 'good');
      }));
      reset.addEventListener('click', guarded(reset, 'picture-status', async () => {
        if (!confirm('Use the original picture again? · 恢复原图？')) return;
        status('picture-status', 'Saving… · 正在保存…');
        await saveContent(`Admin: restore picture ${item.src}`, cur => { delete cur.images[item.src]; }, async (cur, head) => dropUpload(cur.images[item.src], head));
        renderPictures();
        status('picture-status', 'The original is back in about 2 minutes. · 约 2 分钟后恢复原图。', 'good');
      }));
    }
  }

  start();
})();
