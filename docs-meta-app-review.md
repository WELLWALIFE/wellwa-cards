# Meta App Review — Shubhora (App ID 1721735265593905)

## Why we need review
In Development mode only app admins/testers can connect. Going **Live** lets every Shubhora user connect their own Facebook Page / Instagram and auto-post their daily poster.

## Before submitting (owner tasks)
1. Business portfolio that is NOT ad-restricted (create a new one for "Wellwa Life India Pvt. Ltd." at business.facebook.com) and attach the app: App Dashboard → Settings → Basic → Business portfolio.
2. **Business verification** (Business Settings → Security Centre): GST certificate / PAN / utility bill + phone/email verification.
3. Data-deletion URL in App Settings → Basic: `https://neuraledge.me/privacy#delete` (page already explains deletion).
4. Switch App Mode to Live only after approval.

## Permissions to request (App Review → Permissions and Features → Request)
| Permission | Why (paste this) |
|---|---|
| pages_show_list | Lists the user's Pages so they can pick ONE Page for auto-posting. |
| pages_manage_posts | Publishes the user's own daily poster (photo) to the Page they selected. |
| pages_read_engagement | Reads the Page name/picture to show which Page is connected. |
| instagram_basic | Shows the Instagram professional account linked to the selected Page. |
| instagram_content_publish | Publishes the same daily poster to that Instagram account. |
| business_management | Required by Facebook Login for Business to list Pages under a portfolio. |
| ads_management, ads_read (Boost) | Creates a PAUSED Click-to-WhatsApp campaign from the poster in the user's own ad account; the user starts it in Ads Manager. |

## Screencast (I prepare; owner records on a phone)
1. Open Shubhora → Social → Facebook → "Connect Facebook Page" → Facebook login dialog → grant permissions.
2. Pick one Page from the list → shows "connected".
3. Tap "Post today's poster now" → open the Page in a browser → the poster is there.
4. Toggle "Auto-post every morning at 8" → explain the cron.
5. Instagram tab → same flow with a professional account.
Keep it under 3 minutes, English narration or captions.

## Test credentials for reviewers
Create a test user in App Roles → Test users, or give them a Shubhora login (mobile + password) in the submission notes, with a Page already owned by that test user.

## Notes field template
"Shubhora is a daily-poster app for small businesses in India. The user creates a profile, gets a personalised poster every day and can auto-publish it to the Facebook Page and Instagram account they choose. We only ever post the user's own generated poster to the user's own Page/Instagram. Tokens are stored server-side, never shared, and deleted when the user disconnects (Social → Remove) or deletes the account (https://neuraledge.me/privacy)."
