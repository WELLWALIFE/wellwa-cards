// Credits for the AI website (owner's rule 1 credit ≈ ₹10). Shared by the server (charging) and the page (showing the price).
// Templates are free. Every AI build is charged again, so the price shown is per build.
export const SITE_TEXT_CREDITS = 5;   // AI writes every page of the website
export const SITE_PHOTO_CREDITS = 5;  // each AI photo, same as a photoshoot photo
export const SITE_MAX_PHOTOS = 6;     // hero, about and up to 4 section photos
export const siteAiCost = (photos: number) => SITE_TEXT_CREDITS + SITE_PHOTO_CREDITS * Math.max(0, Math.min(SITE_MAX_PHOTOS, photos));

// AI card: the AI writes the whole card; photos are the cover banner and an "about" photo.
export const CARD_TEXT_CREDITS = 3;
export const CARD_MAX_PHOTOS = 2;
export const cardAiCost = (photos: number) => CARD_TEXT_CREDITS + SITE_PHOTO_CREDITS * Math.max(0, Math.min(CARD_MAX_PHOTOS, photos));

/** Free credits a new account gets once. 0 (owner's call, 25 Sep 2026): the free account is the card only — no AI
 *  credits. /api/welcome still records the welcome (0 credits) so the welcome mail goes once. */
export const WELCOME_CREDITS = 0;
