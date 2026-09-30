# Long video — "professional in one go" (2026-09-21)

What changed in the long-video (explainer) engine, and how to deploy it.

## The five changes

1. **Voice-accurate cuts** (`bridge/voice-align.mjs`, new). The finished narration — the owner's own recording, or
   our per-paragraph TTS — is transcribed with word timestamps through fal.ai Whisper (`fal-ai/whisper`, same
   `FAL_KEY` the Kling clips use; ~₹1 per 10-minute recording). The owner's text is laid over the transcript
   (text anchors when the alphabets match, word-count mapping when they don't — Hinglish typed in Latin comes back
   from Whisper in Devanagari), and every sentence boundary is snapped into the nearest real pause. The picture
   now changes on the word, not near it. Falls back to the old method (word share / silence detect) if the call fails.
2. **Film cuts** (`bridge/explainer-shots.mjs`). 0.4 s dissolve between every shot (the previous shot's last frame
   fades out over the new one — no 80-input xfade graph, frame-exact timeline untouched), six different camera
   moves that alternate (push in/out, towards left/right, drift), headings fade in/out and stay put when the same
   title carries across shots, title/closing cards breathe, the whole film fades from and to black, music fades
   in/out.
3. **Subtitles** (engine + `caption-engine.renderCuePngs`). Word-timed captions from the alignment (or spread by
   letter count where the transcript did not cover), burnt shot by shot in the same ffmpeg pass. 4–5 words a
   group, never across a sentence end, spoken word lit in the brand colour (or warm white when the brand colour is
   too dark). `captions: false` in the job input turns them off. None on word cards.
4. **One look per film** (`shotlist.understandScript` → `brief.look` → `explainer-picture.stillPrompt`). The script
   is read once and a single photographic look (light, palette, lens) is decided; every generated picture carries
   it. Picture budget raised from 5/min to 7/min (`explainer-beats.allocatePictures`), ceiling 64.
5. **Auto-QC before delivery** (`bridge/explainer-qc.mjs`, new). The finished mp4 is scanned for black stretches
   (blackdetect), a missing voice (astats RMS) and a wrong length (mvhd). Black windows are mapped back to shots,
   those shots are rebuilt and the film is encoded once more. Only then is it uploaded.

UI: the 3-way "AI pictures / Real footage / Words only" chooser is gone from `/poster/explainer` and
`/poster/text-video`; long videos are always the professional path. A Subtitles on/off toggle replaced it.
`api/media/explainer` accepts `captions`.

## Deploy

```
cd ~/Desktop/Wellwa\ Life/wellwa-cards && ./deploy.sh
```
Nothing new to install on the VPS: no whisper binary, no python — transcription is an HTTPS call. The worker
needs `FAL_KEY` in its env (it already has it for Kling). Verify after deploy:

- worker log shows `[align] own: N words` (own recording) or `heard K of N recorded paragraphs` (AI voice)
- `[qc] clean: black=0 silent=false length=…` before the upload line
- `[shots] the look: …` in the planner log

## Tested locally (no AI keys)

Full engine run, own-voice run, own-voice run with a mocked Whisper transcript, and a direct `buildShots` run with
photos + headings + cues: all rendered, QC clean, frames inspected (dissolve, heading fade, captions, camera moves).
Not yet run against the live fal endpoint — first real job on the VPS will tell; the fallback keeps the video
coming either way.

## Round 2 (same day, after the first live run 3a407aee)

The first live film came out as word cards: every per-shot ffmpeg render died under the worker's 900 MB memory cap.
Measured here: one shot with 25 subtitle cues as 25 overlay inputs peaked at **977 MB** (each overlay stage costs
~16–40 MB of frame buffers whatever the picture size). Fixes:

- **One caption track per shot** instead of one overlay per cue: `captionTrack()` writes the cue bands into a concat
  list with exact durations (transparent blank between them), so the subtitles are ONE small input. Peak is now
  **~470 MB** for the whole engine run, ~410 MB for the heaviest shot. `-threads 1 -thread_queue_size 4` on every
  still input as well.
- **No silent degrade to words.** A shot that fails with subtitles/heading is retried plain; a shot with no picture
  of its own uses the nearest picture of its paragraph, then the owner's own photo, then the nearest picture in
  the film. A word card is only for shots the planner asked for as text — or when the whole film has no picture.
- **Google refusals handled**: a 402 (balance) / 429 (quota) stops the picture round at once, the film waits
  2 then 3 minutes and asks again; if no picture at all can be made, the job stops with a clear message and the
  credits go back (`e.userMessage`, honoured by media-worker's runJob — one-line change there).
- Logs: `N shot(s) rendered without subtitles/heading`, `N shot(s) fell back to word cards`, ffmpeg's stderr tail.

App: `/api/media/jobs?kind=explainer` (long videos were being pushed off the page by twenty ads/reels), DELETE on a
finished job removes the video file(s) from the bucket and the row, and both pages have a Delete button.

## Round 3 — a recording is enough (text optional)

Upload a recording and leave the text empty: the worker transcribes it (the same Whisper pass that times the
subtitles), cuts sentences at breaths (≥0.45 s) and paragraphs at long pauses (≥0.9 s, or every ~40 words), and
runs the planner, headings and subtitles on that (`scriptFromTranscript` in explainer-engine.mjs). The transcript
is saved back on the job (`input.script`, `input.autoScript = true`). Text still helps for exact spellings.
Price now follows the recording's length when there is one (`audioSeconds`, measured in the browser); the API
accepts an empty script with `voiceUrl`.

## Round 4 — pictures that pass the first time, and a film that never loses its work

**Why pictures were rejected** (real log, 25 rejects): ~10 screens with readable UI ("phone displaying CRM"),
~8 people where none/one was ordered or posed, ~7 generic objects that did not carry the line. The order was the
problem, not the last line of the prompt. So:

- **One rulebook** (`PICTURE_RULES` in explainer-picture.mjs) read by the planner (writes orders against it), the
  ORDER CHECK (`reviewOrders` in shotlist.mjs: a code gate `sanitizeOrder` — "displaying/showing…", dashboards,
  groups — then a text model that rewrites any order that would not pass, 10 at a time, ~₹1 a film) and the
  picture check. Nothing passes the order and fails the picture for a rule the order never heard of.
- **Checker at a viewer's standard**: hard = collage, readable text (actually legible), defect, non-Indian person,
  posed group. Soft (kept as last resort) = posed, one person extra, "unsure" look. Abstract lines (`abstract`
  from the planner) pass on the right world (on_idea ≥ 1) instead of demanding the idea be photographed.
  Every rejection logs the rule it broke; the film's cost line tallies them (`rejects: readable text ×3 …`).
- **Imagen 4 Fast** (`imagen-4.0-fast-generate-001`, ~₹1.7 a picture, `predict` API) is the default image model
  for long videos (`EXPLAINER_IMG_MODEL` to change; falls back to `IMG_MODEL` Gemini automatically when the key
  cannot use Imagen). One picture per order, a second only on rejection (2 attempts, not 3).
- Stock orders → image orders (the long engine has no footage), pictures 4 in flight, 4 s breath on 503.
- Shots render ~2× faster: zoompan input 1.5× (was 2×), preset superfast, header/logo as bands, dissolve input
  limited to its own length. Measured 977 → ~330 MB peak, 30 s → 20 s for three shots.
- **Kept work** (`explainer-work.mjs`): recordings, transcripts, plan, every passed picture are copied to
  `ai-media/<owner>/work/<job>/` as they are made and restored when a retry starts with an empty folder. The plan
  is saved and reused, so cached pictures still belong to their shots.
- **Pause, not fail**: when the picture service refuses (balance/quota) or returns nothing, the job parks as
  `failed` with `error = "PAUSED: …"`, credits held, and the worker's `resumePaused` (every 10 min) re-queues it
  when Gemini answers a one-token probe; after 6 h it fails for real and refunds. "Continue now" in the app is
  free for a paused job; deleting a paused job refunds.
- `bridge/picture-test.mjs`: 12 real orders through order-check + picture check, prints pass rate, reasons, ₹,
  and public URLs of the kept pictures. Run it on the VPS before paying for a whole film:
  `ssh -i ~/.ssh/neuraledge_vps root@148.72.247.91 "cd /opt/neuraledge/app && node bridge/picture-test.mjs"`

## Round 5 — a camera that never stops (and never judders)

The owner read the early shots of the first film as still frames, and asked for a picture that keeps moving the
whole way through — "like a real film" — without ever looking overdone. Two faults were behind it:

- **The moves stopped at both ends.** Ease-in/ease-out brought every shot to a standstill at its head and tail —
  exactly where the eye looks for the cut — and a centred push left the subject in the middle motionless. A fixed
  7% (then 13%) of travel was a lurch on a 3.5 s shot and invisible again spread over 11 s.
- **zoompan judders.** It can only place its window on whole source pixels, so a slow drift moved on some frames
  and not on others. Measured frame-to-frame unevenness on a 17 px/s tilt: **0.61** (1.5× oversample), still
  0.18–0.49 at 4–8× (and 300–440 MB of frame for it).

What the camera does now (`framing`, `cameraFilter`, `windowFilter` in explainer-shots.mjs):

- **Constant speed, straight line** from a start framing to an end framing: 2.4% zoom a second (clamped 8.5–24%
  a shot), pans across their room at 6%/s (18–40%), so every shot moves at the same pace whatever its length.
- **Nothing stands still**: pushes start a hair in (1.04) and drift their window, so the middle of the frame moves
  8–20 px/s and the edges ≤ 45 px/s at 1080p; pans/tilts 22–33 px/s. Documentary pace, half of iMovie's default.
- **Seven moves in rotation**: push, pan-right, pull, push-left, tilt-down, push-right, pan-left. The second
  framing of the same picture is the opposite move a step closer (`tight`), so the cut reads as a detail.
- **perspective, not zoompan**: sub-pixel resampling (`eval=frame`, cubic), unevenness **0.01** on every move,
  no oversampled frame (peak RSS per shot unchanged, ~330 MB). It costs CPU: about 2× the shot stage of before
  (a 5-minute film pays ~2–4 extra minutes). `EXPLAINER_CAMERA=linear` in `.env.local` is a third cheaper and a
  touch softer if the server needs it.
- Cards (opening/closing/text) push 1.4%/s (5–12%), centred, so even the title breathes.
- Tests: `node bridge/.test/speed.mjs` prints on-screen px/s per move and length; `node bridge/.test/camera.mjs`
  renders every move on one picture into `/tmp/cam/out/` for a frame-by-frame look.

## Round 6 — the Scene Editor

A finished long video can now be changed without making it again. **Edit** on the video's card opens
`/poster/explainer/edit?id=<job>`: every paragraph with its words, every scene under it with its picture, heading,
camera move and subtitles.

What the owner can do:
- **Scene**: a new AI picture to their own words (frame + what is in it + what is happening; 1 credit, no judge —
  they asked for exactly this), their own photo, another picture from the film, or just the words; the heading;
  the camera move (auto or one of the seven); subtitles off on that scene.
- **Paragraph** (AI voice): rewrite the words → the AI says them again (1 credit) or "subtitles only" (free, the
  old recording stays); or "say it again" without changing a word.
- **Paragraph** (own recording): rewrite the words (subtitles only), or upload a new recording of that paragraph —
  it is cut into the original in that paragraph's place, the joined recording is kept with the work
  (`own-voice-e<n>.m4a`) and becomes the job's recording.
- **Title** on the first card.
Everything that does not buy AI work is free. Apply → the job goes back in the queue under the same id; the old
video keeps playing until the new cut is done.

How it works (`bridge/explainer-edit.mjs`, engine, `src/app/api/media/explainer/edit/route.ts`):
- Every build ends by writing **`scenes-<fmt>.json`** with the work — each shot as made (`buildShots` now returns
  `files.used` and writes a `.json` sidecar per shot) and each paragraph with its times. The editor reads it.
- The app writes **`edits.json`** next to the work, takes the credits (`explainer-edit`, ref `<job>:edit:<n>`),
  sets `input.edit = { n, credits }`, `cost = credits` (the video's own cost waits in `costOriginal`) and queues.
- The engine takes the paragraphs from the manifest (never re-split, so scene numbers stay put), fetches
  `edits.json` fresh, and **maps** the new lines to the finished film's lines (same words → same place → closest
  words, inside each paragraph): every matched line keeps its order, heading and picture. New pictures get new
  names (`img-<fmt>-<i>-e<n>.jpg`) so nothing another scene still shows is written over. AI-voice paragraphs are
  reused one by one (holes allowed now — the "unbroken run" rule is gone); a rewritten one is recorded again.
- **Only what changed is remade**: the shots stay on disk for a day after a build (`pruneFinished` drops the big
  intermediates only); an edit deletes just the touched shots (+ the shot after each, for its dissolve), or all
  of them when the timing moved (new words, a new recording, a new title).
- The edited video is uploaded under a new name (`-e<n>`), the old file removed once the row points on.
- **Nothing can lose the video**: an edit that fails, is stopped, times out, or gives up after a pause puts the row
  back to `done` with a note in `progress.text`, video untouched, and refunds only the edit's credits
  (`explainer-edit-refund`, ref `<job>:edit:<n>`) — engine catch, worker `runJob`, `requeueInterrupted`,
  `resumePaused` and the app's DELETE (Stop) all follow this rule.
- Test offline: `node bridge/.test/edit.mjs` (A first build, B a seeded film, C scene edits on the fast path,
  D a rewritten paragraph — asserts what was remade, carried over and charged).
