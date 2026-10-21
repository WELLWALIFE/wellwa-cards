# Shubhora — Meta App Review pack (route A: users' own Facebook Page, Instagram and ad account)

App: **Shubhora** · App ID 1721735265593905 · Live since 26 Sep 2026 · Business portfolio: Wellwa Life India Pvt Ltd (verified 19 Oct 2026)
Login type: Facebook Login for Business, configuration "Shubhora Connect" (ID 1068062606095727), user access token.

What the app does with Meta (one sentence for every form that asks): *Shubhora makes daily posters, videos and a digital card for small Indian businesses. After the owner connects their own Facebook Page and Instagram account, the app posts those posters for them, shows their customers' comments and reviews in one inbox so they can reply, and lets them run a simple local ad from their own ad account.*

---

## Part 1 — Dashboard clicks (owner does these; each is one minute)

1. **App settings → Basic**: icon is uploaded — scroll to the bottom, **Save changes**. The red "ineligible for submission" box must disappear.
2. **Use cases → Add use cases** → tick **"Create & manage ads with Marketing API"** → Save. (This makes `ads_management` and `ads_read` available.)
3. **Use cases → Manage everything on your Page → Customize**: make sure these are added (click "Add" next to each if not): `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement`. **Remove `business_management`** if it is listed (the app no longer uses it; Meta rejects it most often).
4. **Use cases → Manage messaging & content on Instagram → Customize**: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments` added.
5. **Use cases → Create & manage ads with Marketing API → Customize**: add `ads_management`, `ads_read`.
6. **Facebook Login for Business → Configurations → Shubhora Connect → Edit** → Next, Next, Next → Permissions dropdown: **tick `ads_management` and `ads_read`, untick `business_management`** → Save.
7. **App roles → Roles**: nothing to add.
8. **Review → App Review → Requests**: the list should now show the 10 permissions below (delete `business_management` with the bin icon if it is still there; `public_profile` can stay — it is standard access and needs no video). Press **Next**, then fill each permission from Part 3, attach the screencasts from Part 4, answer Part 5, **Submit**.

Server side (owner, after Meta approves — nothing to change before): no code change is needed; `SCOPES` in `src/lib/social-server.ts` already lists exactly these permissions. Existing users must press **Disconnect → Connect** once in Shubhora → Social so the new permissions are granted.

---

## Part 2 — Test access for the reviewer (fill in the "Testing instructions" box)

Create a Shubhora test login first (Super Admin → Users → create; plan Business, or a real paid account), e.g. username `metareview`, and a Facebook Page + Instagram Business account that the reviewer can use. Meta reviewers usually log in with **their own** Facebook test user, so the important part is the Shubhora login.

Paste (replace the two placeholders):

```
Shubhora is a web app (PWA) for small Indian businesses: https://shubhora.com
Test login: https://shubhora.com/login — username: metareview — password: <PASSWORD>
Language: the app opens in Hindi; tap "EN" at the top right for English.

1. Log in, open the menu → "Social" (https://shubhora.com/poster/social).
2. On the Facebook tab tap "Connect Facebook" → Facebook Login for Business dialog → allow → pick one Page.
   The Instagram tab lists the Instagram Business account linked to that Page → pick it.
3. Open "Today's poster" (https://shubhora.com/poster) → under the poster tap "Post to Facebook" / "Post to Instagram".
   The post appears on the Page / Instagram account within a few seconds; "History" on the Social screen lists it.
4. Social → "Reviews" tab: comments on the Page's posts, Page reviews and Instagram comments appear in one list; tap
   "Reply" (or "AI draft" then "Send") — the reply is posted under the comment.
5. Menu → "Ads" (https://shubhora.com/poster/ads): pick a poster → goal → area → budget → words → "Save (paused)".
   A PAUSED campaign is created on the user's own ad account; "My ads" shows spend / reach / clicks and Start / Pause.
Nothing is posted or spent without the user tapping the button; every campaign is created PAUSED unless "Start now" is tapped.
Disconnect: Social → account row → bin icon (revokes the token and deletes it from our database).
Data deletion: https://shubhora.com/privacy (deletion instructions) and the deauthorize / data-deletion callbacks.
```

---

## Part 3 — "How will your app use this permission?" (one box per permission, paste as is)

**pages_show_list**
```
Used once, right after Facebook Login, to show the person the list of Facebook Pages they manage so they can pick the ONE Page Shubhora will post to. We store only the chosen Page's id, name, picture and Page access token. Shown in the screencast at the "pick a Page" step. Without it the user cannot choose which Page the app should post to.
```

**pages_manage_posts**
```
Publishes the user's own daily poster (image or short video made in Shubhora) to the Page they picked, only when they tap "Post to Facebook" under that poster, or when they have switched on "Auto-post today's poster" for that Page (an explicit toggle they can switch off any time). The app never posts anything the user did not create and never edits or deletes posts it did not make. Screencast: poster → "Post to Facebook" → the post on the Page.
```

**pages_read_engagement**
```
Reads the Page's own posts and basic Page data (name, picture, follower count) to (a) show the user which posters were already posted and when ("History" on the Social screen, with the "already posted" guard that stops double posting) and (b) show reach/likes of the app's own posts on that History list. No follower-level data is stored. Screencast: Social → History list with the posted item and its numbers.
```

**pages_read_user_content**
```
Reads the comments that customers write under the Page's posts and the Page's reviews/recommendations, so the business owner can see them in Shubhora's "Reviews" inbox and reply from there (small shops rarely open Facebook; missed comments are lost customers). We cache comment text, author name and time for 30 days only to show the list; nothing is analysed or shared. Screencast: Social → Reviews tab → the list of Page comments and reviews.
```

**pages_manage_engagement**
```
Lets the business owner reply to a customer's comment on their own Page post from the Shubhora "Reviews" inbox — they write the reply (or accept an AI-drafted reply after reading it) and tap "Send"; the reply is posted as the Page. Nothing is sent automatically unless the owner switches on "Auto-reply thanks" for that account, which posts a short thank-you to positive comments and can be switched off any time. Used only for comments on the user's own Page. Screencast: Reviews tab → Reply → the reply visible under the comment on Facebook.
```

**instagram_basic**
```
After the Page is connected, reads the Instagram Business account linked to that Page (id, username, profile picture) so the user can pick it, and reads the account's own media list to mark which posters were already published ("History", double-post guard). Screencast: Social → Instagram tab → pick account → History.
```

**instagram_content_publish**
```
Publishes the user's own poster (image or short video made in Shubhora) to their Instagram Business account only when they tap "Post to Instagram" under that poster or have switched on "Auto-post today's poster" for Instagram. We use /media then /media_publish with the poster's public URL and the caption the user sees on screen. Screencast: poster → "Post to Instagram" → the post on Instagram.
```

**instagram_manage_comments**
```
Reads comments on the user's own Instagram posts into the same "Reviews" inbox and lets the owner reply to them from Shubhora (written by the owner, or an AI draft they read and send). Only the user's own account's comments. Screencast: Reviews tab → Instagram comment → Reply → reply visible on Instagram.
```

**ads_management**
```
Lets the business owner create and control a simple local ad for their own business from inside Shubhora, on their OWN ad account: the app creates a campaign, ad set, creative and ad (click-to-WhatsApp, call, or website visit) with the poster they pick, the area, age range and daily budget they choose. Every campaign is created PAUSED with a daily budget and an end date; it only spends after the owner taps "Start" (in Shubhora or in Ads Manager). Start/Pause from the app changes the campaign status. We never create ads on other people's accounts. Screencast: Ads → 5 steps → "Save (paused)" → "My ads" → Start / Pause → the same campaign in Ads Manager.
```

**ads_read**
```
Reads the list of the user's ad accounts (so they can choose the one to use), Meta's delivery estimate for the chosen audience (shown as "about N people a day"), and the spend, reach, clicks and status of the campaigns the app created, to show them in "My ads". Read only; no insights are stored beyond the campaign ids we created. Screencast: Ads → ad-account picker and the "My ads" numbers.
```

**public_profile** — standard access, no text needed; if the form asks: `Shown as the name and picture on the Connections screen so the user knows which Facebook login is connected.`

---

## Part 4 — Screencasts (owner records with QuickTime: File → New Screen Recording; phone-size browser window is fine)

Meta wants to SEE each permission used, with the Facebook login dialog in the video. One video per group is accepted; keep each under 3 minutes, no music, show the whole screen, English UI ("EN" toggle) is safer. Upload the same video to every permission in its group.

**Video 1 — connect + publish** (pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish)
1. shubhora.com/login → log in as the test user.
2. Menu → Social → Facebook tab → read the consent note → "Connect Facebook".
3. Facebook Login for Business dialog: show the permission list, Allow, pick the Page, finish. Back in Shubhora the Page card shows.
4. Instagram tab → the linked Instagram account appears → pick it.
5. Menu → Today's poster → "Post to Facebook" → wait for the tick → open facebook.com/<page> in a new tab, show the post.
6. Back → "Post to Instagram" → tick → open instagram.com/<account>, show the post.
7. Social → History: both posts listed.

**Video 2 — reviews inbox** (pages_read_user_content, pages_manage_engagement, instagram_manage_comments)
Before recording: from another Facebook account, write one comment under the Page post and one under the Instagram post, and leave a Page review.
1. Log in → Social → Reviews tab: the Facebook comment, the review and the Instagram comment are listed.
2. Tap Reply on the Facebook comment → type a reply → Send → open the post on Facebook, show the reply.
3. Same for the Instagram comment → show the reply on Instagram.
4. Show the "Auto-reply thanks" toggle and switch it OFF (so the reviewer sees it is optional).

**Video 3 — ads** (ads_management, ads_read)
Needs the test Facebook user to have an ad account with a payment method (it will not be charged: the campaign stays paused).
1. Log in → Menu → Ads. The ad-account bar lists the accounts and the chosen one (ads_read).
2. Step 1 pick a poster → Step 2 goal "WhatsApp messages" → Step 3 city, radius, age → the "about N people a day" estimate appears (ads_read) → Step 4 budget ₹200/day, 5 days → Step 5 words → "Save (paused)".
3. "My ads" tab: the campaign with status Paused, spend ₹0 (ads_read). Tap Start → status Active → tap Pause.
4. Open adsmanager.facebook.com in a new tab: the same campaign, paused, with the daily budget and end date (ads_management).

Upload: App Review → each permission → "Add screencast" → pick the video for its group.

---

## Part 5 — The other questions in the form

- **Is this app used by a business other than yours?** Yes — our customers (small businesses) connect their own Pages/Instagram/ad accounts. → "Tech Provider" questions: we act on behalf of our customers; data is used only to provide the service to that customer.
- **Data handling / Data Use Checkup**: data accessed: Page list, Page token, Instagram account id, posts the app made, comments & reviews text (cached 30 days), ad accounts list, campaign ids and their insights. Not sold, not shared, not used for advertising to the user; deleted on Disconnect, on account deletion, and via the deauthorize/deletion callbacks.
- **Privacy policy**: https://shubhora.com/privacy · **Terms**: https://shubhora.com/terms · **Data deletion**: https://shubhora.com/privacy (deletion instructions) + `/api/social/deletion` callback.
- **Platform**: Website (shubhora.com). The app is a PWA — not an iOS/Android store app.
- **Business verification**: already Verified (Wellwa Life India Pvt Ltd).

---

## Part 6 — What usually gets rejected, and the fix

- Video does not show the Facebook login dialog → always start the video before "Connect".
- Reviewer cannot log in → the test login must work on the day; do not change its password during review (3–7 days, sometimes 2 weeks).
- "We could not see the permission in use" → the video must show the RESULT on Facebook/Instagram (the post, the reply, the campaign in Ads Manager), not only Shubhora's screen.
- `business_management` asked but not used → remove it (done in Part 1).
- ads_management: Meta also checks the Marketing API access level (Use cases → Marketing API → "Standard access" needs this same review) and that the campaign has a budget and end date — ours always does.

If a permission is rejected, only that permission is rejected: fix the video/text and resubmit it alone; the approved ones stay approved.
