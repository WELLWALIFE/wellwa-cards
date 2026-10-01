// What a website for ONE trade must contain — the knowledge an agency's copywriter brings to a sweet shop, a
// clinic or an electrician, written down once per trade so every card of that trade comes out complete in one
// build (owner's call, 1 Oct 2026: "site khaali khaali na lage aur perfect lage").
//
// Two uses, same data:
//   1. the AI brief (card-ai.ts) — the trade's own words for what to explain, which services, which questions;
//      the AI adapts them to the facts of THIS business and the card language;
//   2. the composer and the audit (card-compose.ts, card-audit.ts) — when the AI gives too little, or something
//      generic ("Connect with us"), the seeds below fill the gap in code, so no section is ever thin or empty.
//
// Rules for the data: plain Indian English and natural Hindi (Devanagari), no numbers, no prices, no awards, no
// guarantees, no health / cure / income claims — everything here must be true of any decent business of the
// trade, because it is used when we know nothing else.
//
// Isomorphic: no 'use client', no 'server-only'.

/** A service / step row: name and one line of what the customer gets, in both languages. */
export type TradeLine = { en: string; hi: string; desc: string; descHi: string };
/** A why-us point: at most 6 words, no numbers. */
export type TradePoint = { en: string; hi: string };
/** A question a new customer asks, with a safe general answer (used only when the facts give none). */
export type TradeFaq = { q: string; qHi: string; a: string; aHi: string };

export type TradeData = {
  /** 2-4 things the about text must explain for this trade, as short English phrases the AI is told to cover,
   *  e.g. "what you sell (sweets, namkeen, gift hampers)", "freshness — made fresh daily", "orders for weddings,
   *  festivals and bulk". */
  explain: string[];
  /** 6-8 services this trade usually offers. For a shop: what it does beyond selling (bulk orders, gifting,
   *  delivery, custom orders); for a service trade: the actual services; for a professional: the kinds of work. */
  services: TradeLine[];
  /** 6-8 reasons customers choose a good business of this trade — concrete, no numbers. */
  whyUs: TradePoint[];
  /** 3-4 steps a new customer goes through, in order (first contact → … → the result). */
  steps: TradeLine[];
  /** 6-8 questions a new customer of this trade asks, with general answers. */
  faq: TradeFaq[];
  /** Words / phrases that are too generic to stand in this trade's sections; an item that is only this is dropped
   *  and replaced by a seed (e.g. "Connect with us", "Explore options", "Quality products"). Lower case. */
  generic?: string[];
};
