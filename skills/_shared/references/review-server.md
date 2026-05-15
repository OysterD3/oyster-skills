# Review server lifecycle

`skills/brainstorming/scripts/review-server.mjs` is shared by every skill that produces a review HTML. Two jobs:

- Serves the project tree at `http://localhost:7681/` — handy URL, **not required** for the brainstorming artifact (it's self-contained). The other skills still serve their HTML this way.
- Persists inline comments to `<htmlpath>.comments.json` via `/api/comments`.

Without the server: artifacts still render (where self-contained), comments are disabled (banner shows). Start the server for comments; tunnel it with cloudflared for remote reviewers.

## Launching

Check first:

```bash
curl -sf http://localhost:7681/api/health > /dev/null 2>&1 && echo "already running" || echo "needs start"
```

If `needs start`, background-launch (`run_in_background: true`):

```bash
node ~/.claude/skills/brainstorming/scripts/review-server.mjs
```

Wait ~1s, re-check health. Reuse if already running.

Hand the user the URL, not the path:

> Review at **http://localhost:7681/docs/<area>/<file>.html**. Select any text and click "💬 Comment" to leave feedback.

## Shutting down

On approval / hand-off to the next skill:

```bash
curl -sf -X POST http://localhost:7681/api/shutdown > /dev/null
```

No idle auto-shutdown — sessions aren't killed if the user steps away. If the next skill needs the server, it relaunches in ~1s.

## Sharing remotely

Expose via [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) — no account, random `*.trycloudflare.com` URL, no interstitial:

```bash
brew install cloudflared                              # one-time
cloudflared tunnel --url http://localhost:7681        # leaves running; Ctrl-C to stop
```

Share `https://<random>.trycloudflare.com/docs/<area>/<file>.html`. Remote reviewers can leave comments (the tunnel forwards POSTs to your local server).

**Caveat:** the review server has unauthenticated POST endpoints. The URL is unguessable, but anyone with it can write/delete comments. Don't leave a tunnel running unattended.
