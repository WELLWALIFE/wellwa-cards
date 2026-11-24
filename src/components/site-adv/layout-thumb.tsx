// A small line sketch of every layout of every section of the Premium website (lib/site-advanced.ts *_IDS), for the design
// picker in the website editor (owner, 24 Nov 2026: a picture instead of a name — "Photo with a card over it" says little,
// the sketch says it at a glance). Pure SVG, no photos, no requests: the same sketch is right for every trade.
// A new id without a sketch here still shows — as a plain "title and lines" sketch — and missingThumbs() lists it.
import type { ReactElement } from "react";
import { VARIANT_IDS, type SectionKey } from "@/lib/site-advanced";

type S = readonly [string, ...(number | string)[]];
const W = 64;

// ---- the pieces a sketch is drawn from (the canvas is 64 x 40) ----
const P = (x: number, y: number, w: number, h: number): S => ["p", x, y, w, h];      // a photo
const D = (x: number, y: number, w: number, h: number): S => ["d", x, y, w, h];      // a dark field
const A = (x: number, y: number, w: number, h: number): S => ["a", x, y, w, h];      // a field in the site's colour
const C = (x: number, y: number, w: number, h: number): S => ["c", x, y, w, h];      // a card
const G = (x: number, y: number, w: number, h: number): S => ["g", x, y, w, h];      // glass over a photo or a dark field
const WH = (x: number, y: number, w: number, h: number): S => ["w", x, y, w, h];     // a light tile on a dark field
const K = (x: number, y: number, w: number, h: number): S => ["k", x, y, w, h];      // very large type, a number
const KW = (x: number, y: number, w: number, h: number): S => ["kw", x, y, w, h];
const OW = (x: number, y: number, w: number, h: number): S => ["ow", x, y, w, h];    // large type in outline, on dark
const H = (x: number, y: number, w: number): S => ["h", x, y, w];                    // a heading
const HW = (x: number, y: number, w: number): S => ["hw", x, y, w];
const L = (x: number, y: number, w: number): S => ["l", x, y, w];                    // a line of text
const LW = (x: number, y: number, w: number): S => ["lw", x, y, w];
const B = (x: number, y: number, w: number): S => ["b", x, y, w];                    // the main button
const BW = (x: number, y: number, w: number): S => ["bw", x, y, w];
const E = (x: number, y: number, w: number): S => ["e", x, y, w];                    // a second, outlined button
const R = (x: number, y: number, w: number): S => ["r", x, y, w];                    // a hairline
const RW = (x: number, y: number, w: number): S => ["rw", x, y, w];
const V = (x: number, y: number, h: number): S => ["v", x, y, h];                    // a hairline, upright
const X = (x: number, y: number, w: number): S => ["x", x, y, w];                    // dotted leaders
const O = (cx: number, cy: number, r: number): S => ["o", cx, cy, r];                // a round photo
const I = (cx: number, cy: number, r: number): S => ["i", cx, cy, r];                // an icon, an arrow
const U = (cx: number, cy: number, r: number): S => ["u", cx, cy, r];                // a dot in the site's colour
const Q = (cx: number, cy: number): S => ["q", cx, cy];                              // a small dot
const N = (x: number, y: number, w: number, h: number): S => ["n", x, y, w, h];      // an arched photo
const T = (x: number, y: number, w: number, h: number, deg: number): S => ["t", x, y, w, h, deg]; // a tilted print
const Z = (pts: string): S => ["z", pts];                                            // a photo cut on a slant
const Y = (cx: number, cy: number): S => ["y", cx, cy];                              // a play button
/** `n` lines of text under each other, the last one short. */
const lines = (x: number, y: number, w: number, n: number, gap = 3, white = false): S[] =>
  Array.from({ length: n }, (_, i) => (white ? LW : L)(x, y + i * gap, i === n - 1 ? Math.round(w * 0.6) : w));
const each = (n: number, f: (i: number) => S[]): S[] => Array.from({ length: n }, (_, i) => f(i)).flat();
const FULL = D(0, 0, W, 40);

const SKETCH: Record<SectionKey, Record<string, S[]>> = {
  hero: {
    "split-frame": [H(4, 11, 24), H(4, 16, 18), ...lines(4, 22, 22, 2), B(4, 30, 10), E(16, 30, 10), A(40, 8, 20, 28), P(37, 5, 20, 28)],
    "full-bleed": [P(0, 0, W, 40), D(0, 14, W, 26), HW(4, 18, 30), HW(4, 23, 22), BW(4, 28, 10), G(4, 34, 56, 4)],
    "editorial-marquee": [K(4, 4, 50, 4), K(4, 10, 34, 4), A(0, 17, W, 3), P(4, 23, 56, 17)],
    "glass-card": [P(0, 0, W, 40), G(4, 7, 28, 26), HW(7, 12, 20), ...lines(7, 18, 20, 2, 3, true), BW(7, 26, 9), G(40, 22, 9, 10), G(51, 22, 9, 10)],
    "stacked-poster": [FULL, HW(16, 5, 32), LW(20, 10, 24), BW(26, 14, 12), N(20, 22, 24, 18)],
    mosaic: [C(4, 4, 26, 18), H(7, 8, 18), L(7, 13, 14), B(7, 17, 8), P(32, 4, 14, 18), P(48, 4, 12, 8), A(48, 14, 12, 8), P(4, 24, 16, 12), D(22, 24, 18, 12), P(42, 24, 18, 12)],
    "video-first": [H(4, 4, 30), B(50, 3.5, 10), P(4, 11, 56, 26), Y(32, 24)],
    "centered-minimal": [N(27, 3, 10, 10), H(18, 17, 28), L(22, 22, 20), B(20, 27, 11), E(33, 27, 11), R(10, 35, 44)],
    diagonal: [H(4, 11, 20), ...lines(4, 17, 18, 2), B(4, 26, 10), Z("36,0 64,0 64,40 26,40")],
    masthead: [K(4, 4, 56, 7), R(4, 13.5, 56), L(4, 16, 30), P(4, 20, 56, 20)],
    "kinetic-type": [K(4, 6, 20, 5), O(29, 8.5, 3.5), K(35, 6, 25, 5), K(4, 15, 30, 5), O(40, 17.5, 3.5), K(46, 15, 14, 5), L(4, 26, 30), B(4, 31, 10)],
    "pinned-story": [C(2, 2, 60, 36), H(8, 8, 26), L(8, 13, 20), K(8, 19, 8, 5), K(20, 19, 8, 5), K(32, 19, 8, 5), B(8, 29, 10), Q(56, 14), Q(56, 19), U(56, 24, 1.2)],
    "parallax-collage": [P(4, 4, 14, 12), P(46, 3, 14, 14), P(6, 24, 16, 12), P(44, 24, 16, 13), H(20, 15, 24), L(24, 20, 16), B(27, 25, 10)],
    "product-spotlight": [H(4, 9, 22), L(4, 14, 18), K(4, 20, 9, 3), B(4, 28, 10), O(46, 19, 13), Q(42, 36), Q(46, 36), Q(50, 36)],
    storefront: [P(0, 0, W, 40), D(0, 18, W, 22), LW(22, 22, 20), HW(18, 26, 28), BW(26, 31, 12)],
  },
  trust: {
    strip: [R(4, 11, 56), ...each(4, (i) => [K(6 + i * 14, 15, 8, 4), L(6 + i * 14, 22, 10)]), R(4, 28, 56)],
    counters: [D(0, 7, W, 26), ...each(4, (i) => [KW(6 + i * 14, 13, 8, 7), LW(6 + i * 14, 24, 10)])],
    "icon-row": each(4, (i) => [I(10 + i * 14.5, 15, 3.5), L(5.5 + i * 14.5, 23, 9), L(6.5 + i * 14.5, 26, 7)]),
    ticker: [A(0, 15, W, 9), LW(-2, 19, 11), U(13, 19.6, 0.8), LW(17, 19, 13), LW(35, 19, 11), LW(51, 19, 16)],
    "split-cards": [H(4, 11, 20), H(4, 16, 14), ...lines(4, 22, 18, 2), ...each(4, (i) => [C(30 + (i % 2) * 16, 5 + Math.floor(i / 2) * 16, 14, 14), K(32 + (i % 2) * 16, 8 + Math.floor(i / 2) * 16, 6, 3), L(32 + (i % 2) * 16, 14 + Math.floor(i / 2) * 16, 9)])],
    bento: [A(4, 5, 26, 30), KW(8, 19, 13, 8), LW(8, 30, 14), D(32, 5, 13, 14), KW(34, 9, 6, 3), C(47, 5, 13, 14), K(49, 9, 6, 3), C(32, 21, 13, 14), K(34, 25, 6, 3), D(47, 21, 13, 14), KW(49, 25, 6, 3)],
    hairline: each(4, (i) => [C(4 + i * 14, 6, 14, 28), L(6 + i * 14, 9, 3), K(6 + i * 14, 24, 7, 4), L(6 + i * 14, 30, 9)]),
    "usp-bar": [R(4, 15, 56), ...each(4, (i) => [L(6 + i * 14, 19, 9)]), V(18, 17, 5), V(32, 17, 5), V(46, 17, 5), R(4, 24, 56)],
  },
  about: {
    "story-columns": [H(4, 6, 22), H(4, 11, 16), ...lines(32, 6, 13, 7), ...lines(47, 6, 13, 7), P(4, 20, 18, 15)],
    "overlap-card": [P(4, 4, 38, 30), C(30, 12, 30, 24), H(33, 16, 18), ...lines(33, 21, 23, 4)],
    "editorial-split": [H(4, 5, 16), ...lines(4, 11, 14, 4), H(26, 5, 34), P(26, 11, 34, 14), ...lines(26, 28, 34, 3)],
    "pull-quote": [K(29, 3, 6, 3), H(12, 9, 40), H(18, 14, 28), L(26, 19, 12), ...lines(8, 25, 22, 4), ...lines(34, 25, 22, 4)],
    "year-timeline": [V(8, 5, 30), ...each(3, (i) => [U(8, 8 + i * 11, 1.6), H(13, 7 + i * 11, 12), L(13, 11 + i * 11, 22)]), P(42, 4, 18, 32)],
    "owner-card": [P(4, 4, 22, 30), D(6, 27, 18, 5), LW(8, 28.9, 10), H(32, 6, 26), ...lines(32, 12, 26, 4), B(32, 28, 12)],
    "numbers-led": [K(4, 5, 12, 7), K(26, 5, 12, 7), K(48, 5, 12, 7), R(4, 16, 56), H(4, 20, 22), H(4, 25, 14), ...lines(32, 20, 28, 5)],
    "photo-collage": [P(4, 5, 18, 20), T(13, 16, 17, 18, 0), P(23, 3, 10, 10), H(36, 8, 22), ...lines(36, 14, 24, 6)],
    manifesto: [K(4, 4, 56, 5), K(4, 11, 40, 5), P(4, 20, 14, 16), ...lines(22, 22, 22, 5), P(48, 18, 12, 14)],
    chapters: [P(4, 5, 22, 30), ...each(3, (i) => [K(30, 6 + i * 11, 4, 4), H(37, 6 + i * 11, 16), L(37, 10.5 + i * 11, 23), L(37, 13.5 + i * 11, 16)])],
    "founder-letter": [P(4, 5, 20, 28), D(6, 26, 16, 5), LW(8, 27.9, 9), C(28, 4, 32, 32), ...lines(31, 8, 26, 6), K(31, 29, 11, 2.4)],
    "banner-columns": [P(0, 0, W, 20), C(8, 13, 48, 24), H(11, 17, 18), ...lines(11, 22, 19, 4), ...each(3, (i) => [K(35, 17 + i * 5.5, 2.4, 2.4), L(39.5, 17.6 + i * 5.5, 13)])],
  },
  services: {
    grid: each(6, (i) => { const x = 4 + (i % 3) * 19.5, y = 4 + Math.floor(i / 3) * 17; return [C(x, y, 17, 15), P(x, y, 17, 9), L(x + 2, y + 11.5, 10)]; }),
    "feature-cards": [C(4, 4, 56, 14), P(4, 4, 24, 14), H(31, 7, 18), L(31, 11.5, 22), B(31, 13.5, 8), ...each(2, (i) => [C(4 + i * 29, 21, 27, 15), P(4 + i * 29, 21, 27, 8), H(6 + i * 29, 31, 12), K(22 + i * 29, 30.8, 6, 2.4)])],
    "price-list": [H(4, 6, 14), L(4, 11, 12), ...each(4, (i) => [P(23, 4.5 + i * 8, 6, 6), H(32, 5.5 + i * 8, 13), L(32, 9 + i * 8, 10), K(49, 6 + i * 8, 5, 2.4), U(58.5, 7.3 + i * 8, 1.7), R(23, 11.5 + i * 8, 37)])],
    magazine: [P(4, 4, 27, 32), D(4, 27, 27, 9), LW(6, 31, 14), P(33, 4, 13, 15), P(48, 4, 12, 15), P(33, 21, 13, 15), P(48, 21, 12, 15)],
    scroller: [H(4, 4, 18), I(52, 5.2, 2), I(58, 5.2, 2), ...each(4, (i) => [P(4 + i * 18, 11, 16, 17), L(4 + i * 18, 30, 10)]), R(4, 36, 56), K(4, 35.6, 16, 1.2)],
    "category-tabs": [B(4, 4, 11), E(17, 4, 11), E(30, 4, 11), E(43, 4, 11), ...each(3, (i) => [C(4 + i * 19.5, 12, 17, 24), P(4 + i * 19.5, 12, 17, 14), L(6 + i * 19.5, 29, 10), K(6 + i * 19.5, 32, 5, 2)])],
    "menu-leaders": [H(22, 3.5, 20), ...each(10, (i) => { const x = 4 + (i % 2) * 31, y = 11 + Math.floor(i / 2) * 5.5; return [H(x, y, 9), X(x + 10.5, y + 1.6, 9.5), K(x + 21, y - 0.1, 4, 2.4)]; })],
    tiers: [C(4, 8, 17, 27), K(7, 12, 8, 4), ...lines(7, 19, 11, 3), E(7, 29, 11), C(23.5, 4, 17, 33), A(23.5, 4, 17, 3), K(26.5, 11, 8, 4), ...lines(26.5, 18, 11, 3), B(26.5, 30, 11), C(43, 8, 17, 27), K(46, 12, 8, 4), ...lines(46, 19, 11, 3), E(46, 29, 11)],
    "index-rows": [...each(4, (i) => [L(4, 6.5 + i * 8.5, 4), K(11, 5 + i * 8.5, 22 + (i % 2) * 6, 4), R(4, 11.5 + i * 8.5, 56)]), T(42, 9, 14, 17, 8)],
    "listing-rows": [P(4, 4, 36, 15), C(34, 6.5, 26, 10), H(37, 9, 14), L(37, 13, 18), P(24, 21, 36, 15), C(4, 23.5, 26, 10), H(7, 26, 14), L(7, 30, 18)],
    "shop-grid": [C(4, 4, 26, 5), I(7, 6.5, 1.3), B(34, 4.7, 7), E(43, 4.7, 7), E(52, 4.7, 8), ...each(4, (i) => [P(4 + i * 14.6, 13, 12.2, 14), L(4 + i * 14.6, 29, 9), K(4 + i * 14.6, 32.5, 5, 2)])],
    "rate-list": [C(4, 3.5, 56, 5), I(7, 6, 1.3), ...each(4, (i) => [L(4, 13.5 + i * 6.5, 3), H(10, 13 + i * 6.5, 16), L(28, 13.5 + i * 6.5, 8), K(40, 12.9 + i * 6.5, 6, 2.4), E(49, 12.2 + i * 6.5, 11), R(4, 17.2 + i * 6.5, 56)])],
    lookbook: each(4, (i) => [P(4 + i * 14.6, 4, 12.2, 26), L(4 + i * 14.6, 32, 9), K(4 + i * 14.6, 35, 5, 1.8)]),
    "edit-tiles": each(3, (i) => [P(4 + i * 19.5, 5, 17, 30), D(4 + i * 19.5, 27, 17, 8), HW(6 + i * 19.5, 30, 10)]),
  },
  gallery: {
    mosaic: [P(4, 4, 30, 32), P(36, 4, 12, 15), P(50, 4, 10, 15), P(36, 21, 12, 15), P(50, 21, 10, 15)],
    masonry: [P(4, 4, 17, 18), P(4, 24, 17, 12), P(23.5, 4, 17, 10), P(23.5, 16, 17, 20), P(43, 4, 17, 22), P(43, 28, 17, 8)],
    filmstrip: [D(0, 5, W, 30), WH(4, 9, 20, 18), WH(26, 9, 20, 18), WH(48, 9, 20, 18), RW(4, 31, 56), LW(4, 30.5, 18)],
    bento: [P(4, 4, 24, 20), P(30, 4, 14, 9), P(46, 4, 14, 9), P(30, 15, 30, 9), P(4, 26, 12, 10), P(18, 26, 20, 10), P(40, 26, 20, 10)],
    "album-tabs": [B(4, 4, 11), E(17, 4, 11), E(30, 4, 11), ...each(8, (i) => [P(4 + (i % 4) * 14.6, 12 + Math.floor(i / 4) * 13, 12.2, 11)])],
    "lightbox-grid": [...each(7, (i) => [P(4 + (i % 4) * 14.6, 5 + Math.floor(i / 4) * 16, 12.2, 14)]), D(47.8, 21, 12.2, 14), LW(51, 27.4, 6)],
    scrapbook: [T(5, 5, 15, 14, -5), T(24, 7, 15, 14, 4), T(43, 4, 15, 14, -3), T(8, 22, 15, 13, 3), T(28, 24, 15, 12, -4), T(46, 21, 14, 14, 5)],
    rooms: [C(4, 4, 56, 32), V(34, 4, 32), R(34, 20, 26), P(6, 6, 26, 22), L(6, 31, 12), P(36, 6, 22, 9), L(36, 17, 8), P(36, 22, 22, 9), L(36, 33, 8)],
    "pinned-reel": [P(-6, 7, 18, 22), P(15, 7, 23, 22), P(41, 7, 23, 22), R(4, 35, 56), K(22, 34.6, 16, 1.2)],
    stage: [P(4, 3, 56, 25), I(9, 15.5, 2.2), I(55, 15.5, 2.2), ...each(6, (i) => [P(4 + i * 9.6, 31, 8, 6)]), C(4, 31, 8, 6)],
    "portrait-row": each(4, (i) => [P(4 + i * 14.6, 5, 12.2, 30)]),
  },
  proof: {
    cards: [K(26, 3.5, 5, 3.5), A(33, 4.5, 9, 1.6), ...each(3, (i) => [C(4 + i * 19.5, 11, 17, 25), A(6 + i * 19.5, 14, 8, 1.4), ...lines(6 + i * 19.5, 19, 13, 3), H(6 + i * 19.5, 31, 8)])],
    "review-wall": [C(4, 4, 17, 14), ...lines(6, 7, 13, 3), C(4, 20, 17, 16), ...lines(6, 23, 13, 4), D(23.5, 4, 17, 20), ...lines(25.5, 7, 13, 5, 3, true), C(23.5, 26, 17, 10), ...lines(25.5, 29, 13, 2), C(43, 4, 17, 10), ...lines(45, 7, 13, 2), C(43, 16, 17, 20), ...lines(45, 19, 13, 5)],
    "testimonial-carousel": [K(29, 4, 6, 3), H(10, 11, 44), H(14, 16, 36), L(24, 22, 16), I(6, 15, 2.2), I(58, 15, 2.2), U(28, 31, 1), Q(32, 31), Q(36, 31)],
    "star-summary": [K(4, 5, 10, 8), A(4, 16, 14, 1.8), ...each(5, (i) => [R(4, 22.4 + i * 3, 18), K(4, 22 + i * 3, 15 - i * 3, 1.2)]), ...each(3, (i) => [C(28, 4 + i * 11, 32, 9), A(30.5, 6 + i * 11, 7, 1.2), L(30.5, 9.5 + i * 11, 24)])],
    "results-band": [D(0, 3, W, 34), ...each(3, (i) => [KW(6 + i * 20, 8, 10, 6), RW(6 + i * 20, 18, 14), ...lines(6 + i * 20, 22, 14, 3, 3, true)])],
    "clients-strip": [L(22, 4.5, 20), K(4, 10, 10, 2.5), K(18, 10, 12, 2.5), K(34, 10, 9, 2.5), K(47, 10, 13, 2.5), R(4, 16, 56), C(10, 20, 44, 16), A(14, 23, 9, 1.4), H(14, 26.5, 30), L(14, 31, 24)],
    receipt: [C(19, 2, 26, 36), H(24, 5, 16), X(22, 10, 20), ...each(4, (i) => [L(22, 12.5 + i * 4, 10), K(37, 12.3 + i * 4, 5, 1.6)]), X(22, 29, 20), H(22, 32, 8), K(35, 31, 7, 3.4)],
    "marquee-cards": [...each(4, (i) => [C(-6 + i * 20, 5, 18, 13), A(-4 + i * 20, 8, 7, 1.2), ...lines(-4 + i * 20, 11.5, 13, 2)]), ...each(4, (i) => [C(4 + i * 20, 22, 18, 13), A(6 + i * 20, 25, 7, 1.2), ...lines(6 + i * 20, 28.5, 13, 2)])],
    spotlight: [FULL, KW(4, 6, 5, 3), HW(4, 13, 30), HW(4, 18, 26), HW(4, 23, 18), LW(4, 30, 12), WH(42, 6, 18, 6), ...each(3, (i) => [G(42, 14 + i * 7, 18, 5.5)])],
  },
  process: {
    steps: each(4, (i) => [K(4 + i * 15, 8, 5, 5), H(4 + i * 15, 17, 10), L(4 + i * 15, 22, 11), L(4 + i * 15, 25, 8)]),
    "numbered-list": [H(4, 6, 14), L(4, 11, 10), ...each(3, (i) => [K(24, 5 + i * 11, 6, 6), H(34, 5.5 + i * 11, 16), L(34, 10 + i * 11, 24), R(24, 14 + i * 11, 36)])],
    "timeline-h": [R(4, 14, 56), ...each(4, (i) => [U(10 + i * 15, 14.2, 2.4), H(5 + i * 15, 21, 9), L(5 + i * 15, 25.5, 11), L(5 + i * 15, 28.5, 8)])],
    "icon-cards": each(3, (i) => [C(4 + i * 19.5, 6, 17, 28), I(9.5 + i * 19.5, 13, 3), H(6.5 + i * 19.5, 20, 11), L(6.5 + i * 19.5, 25, 12), L(6.5 + i * 19.5, 28, 9)]),
    "step-accordion": [C(4, 4, 56, 14), K(7, 6.5, 3.4, 3.4), H(14, 7, 20), L(14, 11.5, 38), L(14, 14.5, 28), ...each(3, (i) => [C(4, 20 + i * 6.3, 56, 5.2), K(7, 21 + i * 6.3, 3.2, 3.2), H(14, 21.5 + i * 6.3, 14 + i * 3)])],
    "stack-cards": [C(10, 3, 44, 20), C(7, 9, 50, 20), C(4, 15, 56, 21), K(8, 19, 5, 5), H(17, 19.5, 22), ...lines(17, 25, 36, 3)],
    "atelier-band": [P(0, 4, W, 32), D(0, 4, W, 32), HW(18, 12, 28), LW(12, 18, 40), BW(26, 24, 12)],
  },
  faq: {
    accordion: [C(4, 4, 56, 12), H(7, 6.5, 24), L(7, 11, 42), L(55, 7, 2.5), ...each(3, (i) => [C(4, 18 + i * 7, 56, 5.5), H(7, 19.7 + i * 7, 18 + i * 4), L(55, 20.2 + i * 7, 2.5)])],
    "numbered-accordion": [H(4, 6, 14), L(4, 11, 12), ...each(4, (i) => [L(24, 6.5 + i * 8, 3), H(30, 6 + i * 8, 18 + (i % 2) * 5), L(57, 6.5 + i * 8, 2.5), R(24, 11 + i * 8, 36)])],
    "two-column": each(4, (i) => { const x = 4 + (i % 2) * 29, y = 4 + Math.floor(i / 2) * 17; return [C(x, y, 27, 15), H(x + 2.5, y + 3, 16), L(x + 2.5, y + 7.5, 21), L(x + 2.5, y + 10.5, 14)]; }),
    searchable: [C(12, 4, 40, 6), I(16, 7, 1.4), L(20, 6.4, 14), ...each(3, (i) => [C(4, 14 + i * 8, 56, 6), H(7, 16 + i * 8, 20 + i * 5), L(55, 16.5 + i * 8, 2.5)])],
    "chat-bubble": [C(4, 4, 30, 7), L(7, 6.9, 22), A(28, 13, 32, 9), LW(31, 15.5, 24), LW(31, 18.5, 16), C(4, 24, 26, 7), L(7, 26.9, 18), A(34, 32.5, 26, 6), LW(37, 34.9, 18)],
    spotlight: [H(4, 6, 20), R(4, 11, 22), L(4, 14, 18), R(4, 18.5, 22), L(4, 21.5, 16), R(4, 26, 22), L(4, 29, 18), A(30, 4, 30, 32), HW(34, 9, 20), ...lines(34, 15, 22, 5, 3, true)],
    fold: [H(22, 5, 20), ...each(3, (i) => [R(16, 12 + i * 8, 32), H(16, 15 + i * 8, 16 + (i % 2) * 6), L(45.5, 15.5 + i * 8, 2.5)]), R(16, 36, 32)],
  },
  visit: {
    split: [H(4, 6, 20), ...lines(4, 12, 22, 3), B(4, 23, 10), E(16, 23, 10), L(4, 31, 18), L(4, 34, 14), P(34, 4, 26, 32), U(47, 19, 2.6)],
    "map-hours": [P(4, 4, 28, 20), U(18, 13.5, 2.6), L(4, 27, 22), L(4, 30, 16), B(4, 33.5, 10), C(36, 4, 24, 32), P(37.5, 15.2, 21, 4), ...each(6, (i) => [L(39, 8 + i * 4.5, 8), L(50, 8 + i * 4.5, 7)])],
    "hours-timeline": [H(4, 5, 16), R(4, 16, 34), ...each(7, (i) => [Q(6 + i * 5, 16.2)]), U(21, 16.2, 2.2), L(4, 22, 20), L(4, 25, 14), C(42, 4, 18, 32), U(51, 12.5, 2.6), L(45, 20, 12), L(45, 23, 9), B(45, 29, 12)],
    "address-poster": [FULL, KW(6, 6, 44, 5), KW(6, 13, 34, 5), KW(6, 20, 24, 5), G(6, 30, 12, 4), G(20, 30, 12, 4), G(34, 30, 12, 4)],
    "branch-list": [...each(3, (i) => [H(4, 5 + i * 9, 16), L(4, 9.5 + i * 9, 24), E(48, 5.2 + i * 9, 12), R(4, 13 + i * 9, 56)]), L(4, 33, 10), L(18, 33, 10), L(32, 33, 10)],
    "contact-desk": [K(4, 5, 28, 5), P(4, 14, 26, 13), U(17, 20.5, 2.2), L(4, 30, 18), L(4, 33, 12), C(36, 4, 24, 32), C(39, 7, 18, 4.5), C(39, 13.5, 18, 4.5), C(39, 20, 18, 6.5), B(39, 29.5, 18)],
  },
  cta: {
    band: [D(0, 8, W, 24), HW(16, 14, 32), LW(22, 19, 20), BW(25, 24, 14)],
    "wide-band": [A(0, 0, W, 40), KW(4, 6, 44, 5), KW(4, 13, 30, 5), RW(4, 23, 56), LW(4, 25.8, 16), RW(4, 29.5, 56), LW(4, 32.3, 14), RW(4, 36, 56)],
    "floating-card": [D(0, 27, W, 13), A(6, 6, 52, 27), HW(10, 12, 22), LW(10, 17, 18), BW(10, 23, 11), WH(40, 10, 14, 19)],
    "split-qr": [H(4, 10, 24), ...lines(4, 16, 22, 2), B(4, 25, 10), E(16, 25, 10), C(40, 6, 20, 28), K(44, 10, 4, 4), K(52, 10, 4, 4), K(44, 18, 4, 4), K(49.5, 15.5, 2, 2), K(52, 19, 2, 2), K(54.5, 21.5, 1.6, 1.6), L(45, 28.5, 10)],
    "sticky-ribbon": [H(16, 7, 32), L(20, 13, 24), B(26, 18, 12), D(0, 31, W, 7), LW(6, 33.9, 22), A(46, 32.5, 12, 4)],
    callback: [D(0, 3, W, 34), HW(4, 10, 22), ...lines(4, 16, 20, 2, 3, true), WH(34, 8, 26, 5), WH(34, 15, 26, 5), A(34, 23, 26, 5.5)],
  },
  footer: {
    columns: [FULL, KW(4, 6, 12, 3), LW(4, 12, 14), LW(4, 15, 10), WH(4, 20, 8, 8), LW(26, 7, 8), ...lines(26, 12, 12, 4, 3, true), LW(46, 7, 8), ...lines(46, 12, 12, 4, 3, true), RW(4, 33, 56), LW(4, 35.3, 20)],
    mega: [FULL, KW(4, 5, 12, 3), WH(4, 11, 3, 3), WH(9, 11, 3, 3), WH(14, 11, 3, 3), WH(4, 17, 8, 8), LW(26, 5.5, 8), ...lines(26, 10, 11, 4, 3, true), LW(44, 5.5, 8), ...lines(44, 10, 14, 4, 3, true), RW(4, 28.5, 56), LW(4, 31, 26), LW(36, 31, 24), LW(4, 35, 16)],
    minimal: [D(0, 10, W, 20), KW(4, 14.5, 10, 3), LW(24, 15.4, 6), LW(32, 15.4, 6), LW(40, 15.4, 6), WH(52, 14.5, 3, 3), WH(57, 14.5, 3, 3), RW(4, 21, 56), LW(4, 24, 30)],
    "big-wordmark": [FULL, ...lines(4, 5, 12, 3, 3, true), ...lines(24, 5, 12, 3, 3, true), ...lines(44, 5, 12, 3, 3, true), KW(4, 18, 56, 13), LW(4, 35, 16)],
    "link-grid": [FULL, ...each(4, (i) => { const x = 4 + (i % 2) * 29, y = 4 + Math.floor(i / 2) * 17; return [G(x, y, 27, 15), LW(x + 2.5, y + 3, 8), ...lines(x + 2.5, y + 7, 16, 2, 3, true)]; })],
    atelier: [FULL, A(0, 0, W, 5), LW(3, 1.9, 12), LW(20, 1.9, 10), LW(35, 1.9, 13), LW(53, 1.9, 9), OW(4, 9, 56, 11), ...lines(4, 25, 12, 3, 3, true), ...lines(24, 25, 12, 3, 3, true), ...lines(44, 25, 12, 3, 3, true)],
    hotline: [FULL, KW(4, 6, 48, 8), A(4, 19, 13, 4.5), G(19, 19, 13, 4.5), RW(4, 27, 56), LW(4, 30, 24), LW(4, 33, 16), LW(40, 30, 18), LW(40, 33, 12)],
  },
};

const PLAIN: S[] = [H(4, 7, 26), ...lines(4, 14, 40, 3), P(4, 25, 56, 11)];
/** Layout ids that have no sketch of their own yet (they show the plain one). */
export function missingThumbs(): string[] {
  return (Object.keys(VARIANT_IDS) as SectionKey[]).flatMap((k) => VARIANT_IDS[k].filter((id) => !SKETCH[k]?.[id]).map((id) => `${k}:${id}`));
}

// Fixed paper colours (not the app's theme tokens): a sketch is a small light page in both light and dark mode, or its dark
// fields would turn light and the white type on them would vanish. Only the accent follows the app.
const INK = "#14162b", MUTED = "#5b6075", BRAND = "var(--brand)", LINE = "#cfd4e8", SURF = "#ffffff", PAPER = "#eff1f9";
const n = (v: number | string) => Number(v);
function draw(s: S, i: number): ReactElement | null {
  const [t, a, b, c, d, e] = s;
  const edge = (w: number) => (n(w) >= W ? 0 : 1.2); // a field that runs edge to edge has square corners
  switch (t) {
    case "p": return <rect key={i} x={a} y={b} width={c} height={d} rx={edge(n(c))} fill={BRAND} fillOpacity={0.24} />;
    case "d": return <rect key={i} x={a} y={b} width={c} height={d} rx={edge(n(c))} fill={INK} fillOpacity={0.86} />;
    case "a": return <rect key={i} x={a} y={b} width={c} height={d} rx={edge(n(c))} fill={BRAND} />;
    case "c": return <rect key={i} x={a} y={b} width={c} height={d} rx={1.2} fill={SURF} stroke={LINE} strokeWidth={0.5} />;
    case "g": return <rect key={i} x={a} y={b} width={c} height={d} rx={1.2} fill="#fff" fillOpacity={0.26} />;
    case "w": return <rect key={i} x={a} y={b} width={c} height={d} rx={1} fill="#fff" fillOpacity={0.88} />;
    case "k": return <rect key={i} x={a} y={b} width={c} height={d} rx={0.6} fill={INK} fillOpacity={0.9} />;
    case "kw": return <rect key={i} x={a} y={b} width={c} height={d} rx={0.6} fill="#fff" />;
    case "ow": return <rect key={i} x={a} y={b} width={c} height={d} rx={0.6} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={0.6} />;
    case "h": return <rect key={i} x={a} y={b} width={c} height={2.3} rx={1.15} fill={INK} fillOpacity={0.82} />;
    case "hw": return <rect key={i} x={a} y={b} width={c} height={2.3} rx={1.15} fill="#fff" />;
    case "l": return <rect key={i} x={a} y={b} width={c} height={1.2} rx={0.6} fill={MUTED} fillOpacity={0.5} />;
    case "lw": return <rect key={i} x={a} y={b} width={c} height={1.2} rx={0.6} fill="#fff" fillOpacity={0.6} />;
    case "b": return <rect key={i} x={a} y={b} width={c} height={3.6} rx={1.8} fill={BRAND} />;
    case "bw": return <rect key={i} x={a} y={b} width={c} height={3.6} rx={1.8} fill="#fff" />;
    case "e": return <rect key={i} x={a} y={b} width={c} height={3.6} rx={1.8} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={0.5} />;
    case "r": return <rect key={i} x={a} y={b} width={c} height={0.4} fill={LINE} />;
    case "rw": return <rect key={i} x={a} y={b} width={c} height={0.4} fill="#fff" fillOpacity={0.35} />;
    case "v": return <rect key={i} x={a} y={b} width={0.4} height={c} fill={LINE} />;
    case "x": return <line key={i} x1={a} y1={b} x2={n(a) + n(c)} y2={b} stroke={MUTED} strokeOpacity={0.7} strokeWidth={0.5} strokeDasharray="0.6 1.1" />;
    case "o": return <circle key={i} cx={a} cy={b} r={c} fill={BRAND} fillOpacity={0.28} />;
    case "i": return <circle key={i} cx={a} cy={b} r={c} fill="none" stroke={MUTED} strokeOpacity={0.8} strokeWidth={0.6} />;
    case "u": return <circle key={i} cx={a} cy={b} r={c} fill={BRAND} />;
    case "q": return <circle key={i} cx={a} cy={b} r={1} fill={MUTED} fillOpacity={0.55} />;
    case "n": { const x = n(a), y = n(b), w = n(c), h = n(d), r = w / 2; return <path key={i} d={`M${x} ${y + h}V${y + r}a${r} ${r} 0 0 1 ${w} 0V${y + h}Z`} fill={BRAND} fillOpacity={0.34} />; }
    case "t": return <rect key={i} x={a} y={b} width={c} height={d} rx={0.8} fill="color-mix(in srgb, var(--brand) 26%, #ffffff)" stroke={SURF} strokeWidth={1} transform={`rotate(${n(e)} ${n(a) + n(c) / 2} ${n(b) + n(d) / 2})`} />;
    case "z": return <polygon key={i} points={String(a)} fill={BRAND} fillOpacity={0.24} />;
    case "y": return <g key={i}><circle cx={a} cy={b} r={4.2} fill="#fff" fillOpacity={0.9} /><path d={`M${n(a) - 1.3} ${n(b) - 2}l3.6 2-3.6 2Z`} fill={BRAND} /></g>;
    default: return null;
  }
}

/** The sketch of one layout. `k` is the section, `id` the layout id. Decorative: the tile's own text names the layout. */
export function LayoutThumb({ k, id, className }: { k: SectionKey; id: string; className?: string }) {
  const shapes = SKETCH[k]?.[id] ?? PLAIN;
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" focusable="false" className={className} style={{ display: "block", width: "100%", height: "auto", background: PAPER }}>
      {shapes.map(draw)}
    </svg>
  );
}
