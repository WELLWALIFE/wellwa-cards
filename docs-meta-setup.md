# Facebook / Instagram connect — Meta app setup (one time, ~15 min)

1. https://developers.facebook.com → My Apps → Create App → type **Business** → name "Aaj Ka Poster" (or the final app name).
2. App Dashboard → Add product → **Facebook Login** → Settings → Valid OAuth Redirect URIs:
   `https://neuraledge.me/api/social/callback`
3. App Settings → Basic → copy **App ID** and **App Secret**. Also fill Privacy Policy URL: `https://neuraledge.me/privacy`, App Domains: `neuraledge.me`.
4. App Roles → Testers → add your own Facebook account (in Development mode only admins/testers can connect; that is enough for you to use it today).
5. On the VPS, add to `/opt/neuraledge/app/.env.local`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```
   then `pm2 restart neuraledge-app`.
6. For the public (all customers): App Review → request `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`, then switch the app to **Live**. Meta asks for a screen recording of the connect + post flow.

Instagram needs: a **Professional (Business/Creator) Instagram account linked to a Facebook Page**. Personal IG accounts cannot be posted to via API.
