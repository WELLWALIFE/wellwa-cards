# Live model / endpoint checks (append a line per paid verification)

| Date | Model / endpoint | Call | Result |
|---|---|---|---|
| 2026-09-17 | `gemini-3.5-flash` (PLAN_MODEL / JUDGE_MODEL) | JSON generateContent | 200 OK. `gemini-2.5-flash` is 404 (retired for this key) — do not use as fallback. |
| 2026-09-17 | `gemini-3.5-flash` vision, T1 facts draft, 4 photos @1024 px | JSON mode, temp 0.2 | 7.4 s, named the flexible hose as the output, no tap/sink in positives. |
| 2026-09-17 | `gemini-3.5-flash` judge Call A + A2 | 1536 px candidate + 2 refs + crop | 11–15 s per still. Faucet frame → fail (tap visible, invented spout); 3 good stills → pass. |
| 2026-09-17 | `gemini-2.5-flash-image` (IMG_MODEL) with `imageConfig.aspectRatio 9:16`, 2 refs | new T3-A prompt | 12 s, product faithful, no tap/sink, water from the hose into the glass. NOTE: Google lists this model for shutdown on 2026-10-02 → verify `gemini-3.1-flash-image-preview` in PR3 and switch via env `IMG_MODEL`. |
| 2026-09-17 | `gemini-3.1-flash-image-preview` (IMG_MODEL) 9:16, 2 refs, T3-A prompt | one still | 13.6 s, ONE hose on the first attempt, sharper product than 2.5; invented words on the display → builder now forbids invented screen content. Set as `IMG_MODEL` on the VPS (2.5 shuts down 2026-10-02). ≈$0.067/image. |
| — | fal `kling-video/v2.5-turbo/pro/image-to-video` | in production | unchanged. `KLING_NEXT` not verified yet. |

Judge rules calibrated on the owner's real photos: an invented part (extra spout) or a different body/colour is critical; a missing detail or texture difference (smooth vs ribbed hose) is a cosmetic note.
