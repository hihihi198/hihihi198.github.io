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
}

const SITE_ORIGIN = 'https://hihihi198.github.io';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diary · New entry</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 2.5rem auto; padding: 0 1.25rem; color: #1f2328; background: #fff; }
  h1 { font-size: 1.2rem; margin: 0 0 1.5rem; }
  label { display: block; font-size: 0.8rem; color: #6b7280; margin: 0.9rem 0 0.25rem; }
  input, textarea { width: 100%; font: inherit; padding: 0.55rem; border: 1px solid #d7dbe0; border-radius: 8px; background: #fff; color: #1f2328; box-sizing: border-box; }
  textarea { min-height: 160px; resize: vertical; }
  button { margin-top: 1.2rem; padding: 0.6rem 1.3rem; border: none; border-radius: 8px; background: #4f46e5; color: #fff; font: inherit; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  #msg { margin-top: 1rem; font-size: 0.92rem; min-height: 1.2em; }
  .ok { color: #047857; } .err { color: #b91c1c; }
  #msg a { color: #4f46e5; }
</style>
</head>
<body>
<h1>New diary entry</h1>
<form id="f">
  <label for="date">Date</label>
  <input id="date" type="date" required>
  <label for="tags">Tags (comma-separated, optional)</label>
  <input id="tags" type="text" placeholder="note, idea">
  <label for="body">Entry (Markdown)</label>
  <textarea id="body" required></textarea>
  <label for="pw">Password</label>
  <input id="pw" type="password" required autocomplete="current-password">
  <button type="submit">Post</button>
</form>
<div id="msg"></div>
<script>
  document.getElementById('date').value = new Date().toISOString().slice(0,10);
  var pw = document.getElementById('pw');
  pw.value = sessionStorage.getItem('diaryPw') || '';
  var form = document.getElementById('f');
  var msg = document.getElementById('msg');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    msg.textContent = ''; msg.className = '';
    var body = document.getElementById('body').value.trim();
    var date = document.getElementById('date').value;
    var tags = document.getElementById('tags').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
    var password = pw.value;
    var btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      var res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ date: date, body: body, tags: tags })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      sessionStorage.setItem('diaryPw', password);
      msg.className = 'ok';
      msg.innerHTML = 'Posted — <a href="https://hihihi198.github.io/diary/">view it</a>.';
      document.getElementById('body').value = '';
      document.getElementById('tags').value = '';
    } catch (err) {
      msg.className = 'err';
      msg.textContent = 'Error: ' + err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Post';
    }
  });
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin page
    if (url.pathname === '/' && method === 'GET') {
      return new Response(ADMIN_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // Public read (consumed by the diary feed on github.io)
    if (url.pathname === '/api/entries' && method === 'GET') {
      const entries = await listEntries(env);
      return json(entries.map(publicView));
    }

    // Authenticated write
    if (url.pathname === '/api/entries' && method === 'POST') {
      if (!(await verify(request.headers.get('x-admin-password') ?? '', env.ADMIN_PASSWORD ?? ''))) {
        return json({ error: 'unauthorized' }, 401);
      }
      let payload: any;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      const text = String(payload?.body ?? '').trim();
      if (!text) return json({ error: 'body is required' }, 400);
      const dateInput = String(payload?.date ?? new Date().toISOString().slice(0, 10));
      const date = new Date(dateInput + 'T00:00:00.000Z');
      if (Number.isNaN(date.getTime())) return json({ error: 'invalid date' }, 400);
      const tags = Array.isArray(payload?.tags)
        ? payload.tags.filter((t: unknown): t is string => typeof t === 'string')
        : [];
      const id = await nextId(env, date.toISOString().slice(0, 10));
      const now = new Date();
      const entry: Entry = {
        id,
        date: date.toISOString(),
        body: text,
        bodyHtml: String(marked.parse(text)),
        tags,
        createdAt: now.toISOString(),
      };
      await env.DIARY.put('entry:' + id, JSON.stringify(entry));
      return json(publicView(entry), 201);
    }

    return json({ error: 'not found' }, 404);
  },
};
