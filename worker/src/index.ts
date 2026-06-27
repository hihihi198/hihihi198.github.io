import { marked } from 'marked';

interface Env {
  DIARY: KVNamespace;
  ADMIN_PASSWORD: string;
}

interface Entry {
  id: string;
  date: string; // ISO, normalized to UTC midnight for sorting
  body: string; // markdown source
  bodyHtml: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt?: string; // ISO
}

const SITE_ORIGIN = 'https://hihihi198.github.io';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-admin-password',
  Vary: 'Origin',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}

// Constant-time-ish comparison via SHA-256 digests.
async function verify(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ah = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(a)));
  const bh = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(b)));
  let diff = ah.length ^ bh.length;
  for (let i = 0; i < ah.length && i < bh.length; i++) diff |= ah[i] ^ bh[i];
  return diff === 0;
}

function authorized(request: Request, env: Env): Promise<boolean> {
  return verify(request.headers.get('x-admin-password') ?? '', env.ADMIN_PASSWORD ?? '');
}

type Parsed =
  | { ok: true; text: string; date: Date; tags: string[] }
  | { ok: false; error: string };

function parseEntryInput(payload: any): Parsed {
  const text = String(payload?.body ?? '').trim();
  if (!text) return { ok: false, error: 'body is required' };
  const dateInput = String(payload?.date ?? new Date().toISOString().slice(0, 10));
  const date = new Date(dateInput + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime())) return { ok: false, error: 'invalid date' };
  const tags = Array.isArray(payload?.tags)
    ? payload.tags.filter((t: unknown): t is string => typeof t === 'string')
    : [];
  return { ok: true, text, date, tags };
}

// Date-based id; append -2, -3, … on collision so multiple same-day posts work.
async function nextId(env: Env, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  while (await env.DIARY.get(`entry:${candidate}`)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function listEntries(env: Env): Promise<Entry[]> {
  const listed = await env.DIARY.list({ prefix: 'entry:' });
  const entries: Entry[] = [];
  for (const key of listed.keys) {
    const raw = await env.DIARY.get(key.name);
    if (!raw) continue;
    try {
      entries.push(JSON.parse(raw) as Entry);
    } catch {
      // skip malformed
    }
  }
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
  return entries;
}

function publicView(e: Entry) {
  return { id: e.id, date: e.date, bodyHtml: e.bodyHtml, tags: e.tags };
}
function fullView(e: Entry) {
  return { id: e.id, date: e.date, body: e.body, bodyHtml: e.bodyHtml, tags: e.tags };
}

const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diary · Admin</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; max-width: 620px; margin: 2rem auto; padding: 0 1.25rem; color: #1f2328; background: #fff; line-height: 1.5; }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.75rem; color: #6b7280; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0 0; }
  label { display: block; font-size: 0.8rem; color: #6b7280; margin: 0.9rem 0 0.25rem; }
  input, textarea { width: 100%; font: inherit; padding: 0.55rem; border: 1px solid #d7dbe0; border-radius: 8px; background: #fff; color: #1f2328; box-sizing: border-box; }
  textarea { min-height: 150px; resize: vertical; }
  .actions { margin-top: 1.1rem; display: flex; gap: 0.6rem; }
  button { padding: 0.55rem 1.2rem; border: none; border-radius: 8px; background: #4f46e5; color: #fff; font: inherit; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  button.secondary { background: #e5e7eb; color: #1f2328; }
  button.danger { background: #b91c1c; }
  button.small { padding: 0.3rem 0.7rem; font-size: 0.85rem; }
  #msg { margin-top: 1rem; font-size: 0.92rem; min-height: 1.2em; }
  #msg a { color: #4f46e5; }
  .ok { color: #047857; } .err { color: #b91c1c; }
  .muted { color: #9aa1ad; font-size: 0.9rem; }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 0; border-bottom: 1px solid #eef0f3; }
  .row-main { flex: 1; min-width: 0; }
  .row-date { font-weight: 600; font-size: 0.85rem; color: #374151; }
  .row-snip { color: #6b7280; font-size: 0.85rem; }
  .row-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
</style>
</head>
<body>
<h1 id="title">New diary entry</h1>
<form id="f">
  <label for="date">Date</label>
  <input id="date" type="date" required>
  <label for="tags">Tags (comma-separated, optional)</label>
  <input id="tags" type="text" placeholder="note, idea">
  <label for="body">Entry (Markdown)</label>
  <textarea id="body" required></textarea>
  <label for="pw">Password</label>
  <input id="pw" type="password" required autocomplete="current-password">
  <div class="actions">
    <button type="submit" id="save">Post</button>
    <button type="button" id="cancel" class="secondary" hidden>Cancel</button>
  </div>
</form>
<div id="msg"></div>
<hr>
<h2>All entries</h2>
<div id="list"><p class="muted">Loading…</p></div>
<script>
  var pw = document.getElementById('pw');
  pw.value = sessionStorage.getItem('diaryPw') || '';
  var form = document.getElementById('f');
  var msg = document.getElementById('msg');
  var titleEl = document.getElementById('title');
  var saveBtn = document.getElementById('save');
  var cancelBtn = document.getElementById('cancel');
  var listEl = document.getElementById('list');
  var dateEl = document.getElementById('date');
  var tagsEl = document.getElementById('tags');
  var bodyEl = document.getElementById('body');
  var editingId = null;

  function setMsg(html, kind) { msg.innerHTML = html || ''; msg.className = kind || ''; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  async function loadList() {
    try {
      var res = await fetch('/api/entries');
      var entries = await res.json();
      if (!entries.length) { listEl.innerHTML = '<p class="muted">No entries yet.</p>'; return; }
      var html = '';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var snippet = String(e.bodyHtml).replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 90);
        html += '<div class="row" data-id="' + escapeHtml(e.id) + '">'
          + '<div class="row-main"><span class="row-date">' + fmtDate(e.date) + '</span> '
          + '<span class="row-snip">' + escapeHtml(snippet) + '</span></div>'
          + '<div class="row-actions">'
          + '<button type="button" class="small secondary editbtn">Edit</button>'
          + '<button type="button" class="small danger delbtn">Delete</button>'
          + '</div></div>';
      }
      listEl.innerHTML = html;
    } catch (err) {
      listEl.innerHTML = '<p class="muted">Couldn’t load entries.</p>';
    }
  }

  listEl.addEventListener('click', function (ev) {
    var t = ev.target;
    var row = t.closest ? t.closest('.row') : null;
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (t.classList.contains('editbtn')) startEdit(id);
    else if (t.classList.contains('delbtn')) delEntry(id);
  });

  async function startEdit(id) {
    try {
      var res = await fetch('/api/entries/' + encodeURIComponent(id));
      if (!res.ok) throw new Error('not found');
      var e = await res.json();
      editingId = id;
      dateEl.value = e.date.slice(0, 10);
      tagsEl.value = (e.tags || []).join(', ');
      bodyEl.value = e.body;
      titleEl.textContent = 'Edit entry';
      saveBtn.textContent = 'Update';
      cancelBtn.hidden = false;
      form.scrollIntoView({ behavior: 'smooth' });
      setMsg('Editing entry from <b>' + fmtDate(e.date) + '</b>.', '');
    } catch (err) {
      setMsg('Could not load entry.', 'err');
    }
  }

  function resetForm() {
    editingId = null;
    titleEl.textContent = 'New diary entry';
    saveBtn.textContent = 'Post';
    cancelBtn.hidden = true;
    bodyEl.value = '';
    tagsEl.value = '';
    dateEl.value = new Date().toISOString().slice(0, 10);
  }
  cancelBtn.addEventListener('click', function () { resetForm(); setMsg(''); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setMsg('');
    var text = bodyEl.value.trim();
    if (!text) { setMsg('Entry is empty.', 'err'); return; }
    var password = pw.value;
    if (!password) { setMsg('Password required.', 'err'); return; }
    var payload = JSON.stringify({
      date: dateEl.value,
      body: text,
      tags: tagsEl.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    });
    var url = '/api/entries' + (editingId ? '/' + encodeURIComponent(editingId) : '');
    var method = editingId ? 'PUT' : 'POST';
    saveBtn.disabled = true; var prev = saveBtn.textContent; saveBtn.textContent = 'Saving…';
    try {
      var res = await fetch(url, { method: method, headers: { 'content-type': 'application/json', 'x-admin-password': password }, body: payload });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      sessionStorage.setItem('diaryPw', password);
      setMsg((editingId ? 'Updated' : 'Posted') + ' — <a href="https://hihihi198.github.io/diary/">view it</a>.', 'ok');
      resetForm();
      loadList();
    } catch (err) {
      setMsg('Error: ' + escapeHtml(err.message), 'err');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = prev;
    }
  });

  async function delEntry(id) {
    var password = pw.value;
    if (!password) { setMsg('Password required to delete.', 'err'); return; }
    if (!confirm('Delete this entry permanently?')) return;
    try {
      var res = await fetch('/api/entries/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'x-admin-password': password } });
      if (!res.ok) { var d = await res.json().catch(function () { return {}; }); throw new Error(d.error || 'failed'); }
      if (editingId === id) resetForm();
      setMsg('Deleted.', 'ok');
      loadList();
    } catch (err) {
      setMsg('Delete failed: ' + escapeHtml(err.message), 'err');
    }
  }

  dateEl.value = new Date().toISOString().slice(0, 10);
  loadList();
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const parts = url.pathname.split('/').filter(Boolean);

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin page
    if (parts.length === 0 && method === 'GET') {
      return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    // Password check — used by the diary page to verify before revealing edit mode.
    if (parts[0] === 'api' && parts[1] === 'auth' && parts.length === 2 && method === 'GET') {
      return (await authorized(request, env)) ? json({ ok: true }) : json({ error: 'unauthorized' }, 401);
    }

    if (parts[0] === 'api' && parts[1] === 'entries') {
      // Collection: list / create
      if (parts.length === 2) {
        if (method === 'GET') {
          return json((await listEntries(env)).map(publicView));
        }
        if (method === 'POST') {
          if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
          let payload: any;
          try {
            payload = await request.json();
          } catch {
            return json({ error: 'invalid json' }, 400);
          }
          const parsed = parseEntryInput(payload);
          if (!parsed.ok) return json({ error: parsed.error }, 400);
          const id = await nextId(env, parsed.date.toISOString().slice(0, 10));
          const now = new Date().toISOString();
          const entry: Entry = {
            id,
            date: parsed.date.toISOString(),
            body: parsed.text,
            bodyHtml: String(marked.parse(parsed.text)),
            tags: parsed.tags,
            createdAt: now,
            updatedAt: now,
          };
          await env.DIARY.put('entry:' + id, JSON.stringify(entry));
          return json(publicView(entry), 201);
        }
      }

      // Single entry: read / update / delete
      if (parts.length === 3) {
        const id = decodeURIComponent(parts[2]);
        const key = 'entry:' + id;
        if (method === 'GET') {
          const raw = await env.DIARY.get(key);
          if (!raw) return json({ error: 'not found' }, 404);
          try {
            return json(fullView(JSON.parse(raw) as Entry));
          } catch {
            return json({ error: 'not found' }, 404);
          }
        }
        if (method === 'PUT') {
          if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
          const raw = await env.DIARY.get(key);
          if (!raw) return json({ error: 'not found' }, 404);
          const existing = JSON.parse(raw) as Entry;
          let payload: any;
          try {
            payload = await request.json();
          } catch {
            return json({ error: 'invalid json' }, 400);
          }
          const parsed = parseEntryInput(payload);
          if (!parsed.ok) return json({ error: parsed.error }, 400);
          const updated: Entry = {
            ...existing,
            date: parsed.date.toISOString(),
            body: parsed.text,
            bodyHtml: String(marked.parse(parsed.text)),
            tags: parsed.tags,
            updatedAt: new Date().toISOString(),
          };
          await env.DIARY.put(key, JSON.stringify(updated));
          return json(publicView(updated));
        }
        if (method === 'DELETE') {
          if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
          await env.DIARY.delete(key);
          return json({ ok: true });
        }
      }
    }

    return json({ error: 'not found' }, 404);
  },
};
