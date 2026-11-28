@AGENTS.md

New session? Read docs/HANDOFF.md first: owner, paths, branch, deploy, what exists, what is open.

## Where the project lives (since 28 Nov 2026)
The real project is `C:\Projects\wellwa-cards` (WSL: `/mnt/c/Projects/wellwa-cards`), branch `claude/dreamy-faraday-0864zl`.
`~/wellwa-cards` (inside Ubuntu) and `D:\wellwa-cards` are old copies — do not work or deploy from them.

## Deploy — ONLY after the owner says yes ("haan" / "deploy karo") for this deploy
```
wsl -e bash -lc "cd /mnt/c/Projects/wellwa-cards && bash deploy.sh"
```
Then commit and push. deploy.sh builds LOCALLY first (`npm run build`), so this folder needs, once:
- `node_modules`: `npm ci` in this folder;
- `.env.local`: the owner copies it here himself — Claude never copies, prints or reads it. Without it the build has no
  NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / RAZORPAY_KEY_ID and the live site breaks. If it is missing, stop and ask.
