# Posting diary entries from OpenClaw (or any HTTP client)

The diary accepts new entries via a simple HTTP API on the Cloudflare Worker.
A dedicated **POST-only token** lets an external agent (e.g. [OpenClaw](https://openclaw.ai/))
create entries **without** the admin password — it can post, but cannot edit or delete.

> Status: integration is **configured but not yet wired into OpenClaw** (parked 2026-06-29).
> The token exists; the system prompt below just needs to be pasted into OpenClaw when you're ready.

## Endpoint

`POST https://diary.hihihi198.workers.dev/api/entries`

| Header | Value |
| --- | --- |
| `x-post-token` | `<TOKEN>` |
| `content-type` | `application/json` |

Body (JSON):
- `body` — **required**, Markdown supported.
- `date` — optional, `YYYY-MM-DD` (defaults to today).
- `tags` — optional, array of strings.

Responses: `201` created · `400` missing/empty body · `401` bad or missing token.

The token lives in the Cloudflare Worker secret `POST_TOKEN` and, on your machine,
at `~/.diary-post-token` (view with `cat ~/.diary-post-token`).

## Quick test

```sh
curl -X POST https://diary.hihihi198.workers.dev/api/entries \
  -H "x-post-token: $(cat ~/.diary-post-token)" \
  -H "content-type: application/json" \
  --data '{"body":"Hello from an external client."}'
```

A `201` and the entry appearing on https://hihihi198.github.io/diary/ means it works.

## OpenClaw setup

Paste this into OpenClaw's system prompt / agent instructions, replacing `<TOKEN>`
with the value from `~/.diary-post-token`:

```
You can post to my diary. When I ask to "post to my diary", "jot this down",
"log a diary entry", etc., send an HTTP POST:

  POST https://diary.hihihi198.workers.dev/api/entries
  Headers:
    x-post-token: <TOKEN>
    content-type: application/json
  Body (JSON): {"date":"YYYY-MM-DD","body":"<text, Markdown ok>","tags":["tag"]}

- body is required. date is optional (default: today). tags is optional.
- Use my wording as-is for the body.
- 201 = posted (appears at https://hihihi198.github.io/diary/); 401 = bad token; 400 = missing body.
- You can only create entries, not edit or delete.
```

Then in your chat app: *"post to my diary: <text>"*.

## Rotate the token

```sh
NEW=$(openssl rand -hex 24)
printf '%s' "$NEW" | CLOUDFLARE_API_TOKEN="$(cat ~/.cloudflare-api-token)" \
  worker/node_modules/.bin/wrangler secret put POST_TOKEN --config worker/wrangler.toml
printf '%s' "$NEW" > ~/.diary-post-token && chmod 600 ~/.diary-post-token
```

Then update OpenClaw's config with the new value.

## Notes

- The token is **POST-only**: it can create entries but never edit or delete (those need the admin password).
- OpenClaw calls the API server-side, so **CORS does not apply** (it's not a browser request).
- Token implementation: `worker/src/index.ts` — `canPost()` accepts the admin password (`x-admin-password`) or the token (`x-post-token`); `PUT`/`DELETE`/`/api/auth` stay admin-only.
