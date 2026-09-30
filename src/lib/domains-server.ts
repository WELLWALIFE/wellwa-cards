import "server-only";
// Custom domains: shared checks for the domain API, the connect wizard and the background job that finishes the
// setup by itself. We never touch the customer's registrar account — they add one or two DNS records, and we detect
// their DNS provider to show the exact steps, watch DNS, then issue the certificate and switch the site live.
import { Resolver } from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const run = promisify(execFile);
export const SERVER_IP = process.env.NEURALEDGE_SERVER_IP ?? "148.72.247.91";
const CERT_SCRIPT = "/opt/neuraledge/bin/add-domain.sh";
const BLOCKED = /(^|\.)(neuraledge\.me|shubhora\.com|localhost)$/i;

export function cleanDomain(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
}
export function validDomain(d: string, platformHost: string): string | null {
  if (!d) return "Enter a domain, e.g. yourbusiness.com";
  if (d.length > 253) return "That domain is too long.";
  if (BLOCKED.test(d)) return `Pick a domain you own — ${platformHost} links are already free.`;
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return "That doesn't look like a valid domain name.";
  return null;
}

// Two-part endings (shop.co.in → root is shop.co.in, not co.in).
const SECOND_LEVEL = new Set(["co.in", "net.in", "org.in", "firm.in", "gen.in", "ind.in", "ac.in", "edu.in", "co.uk", "org.uk", "com.au", "net.au", "co.nz", "com.sg", "com.my", "co.za", "com.br"]);
/** The registered domain: www.shop.co.in → shop.co.in, card.example.com → example.com. */
export function registeredDomain(d: string): string {
  const parts = d.split(".");
  const last2 = parts.slice(-2).join(".");
  return parts.slice(SECOND_LEVEL.has(last2) ? -3 : -2).join(".");
}
/** A bare domain (example.com) also gets www; a subdomain (card.example.com) is connected alone. */
export const hostsFor = (d: string) => (registeredDomain(d) === d ? [d, `www.${d}`] : d.startsWith("www.") && registeredDomain(d) === d.slice(4) ? [d.slice(4), d] : [d]);

/** Is this host already a website on this server (a cPanel account such as wellwalife.com)? Then no card may take it. */
export async function servedElsewhere(host: string): Promise<boolean> {
  try {
    const list = (await readFile("/etc/userdomains", "utf8")).split("\n").map((l) => l.split(":")[0].trim().toLowerCase());
    const bare = host.replace(/^www\./, "");
    return list.includes(host) || list.includes(bare);
  } catch { return false; }   // not on the server (local dev): the certificate script checks again anyway
}

// Public resolvers, so the answer is fresh and not the server's own cache.
const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

export async function addressesOf(host: string): Promise<string[]> {
  try { return await resolver.resolve4(host); } catch { /* try CNAME */ }
  try {
    const c = await resolver.resolveCname(host);
    return (await Promise.all(c.map((x) => resolver.resolve4(x).catch(() => [] as string[])))).flat();
  } catch { return []; }
}

export type Provider = { key: string; name: string; dnsUrl: string; steps: string[] };
const PROVIDERS: { match: RegExp; key: string; name: string; url: (d: string) => string; steps: string[] }[] = [
  { match: /domaincontrol\.com/, key: "godaddy", name: "GoDaddy", url: (d) => `https://dcc.godaddy.com/control/dnsmanagement?domainName=${d}`,
    steps: ["Open GoDaddy → My Products → your domain → DNS.", "In the list, edit the record of type A with name @ and put the value below. Delete any other A record named @.", "Edit (or add) the CNAME record with name www and value @ (or your domain). Save."] },
  { match: /dns-parking\.com|hostinger/, key: "hostinger", name: "Hostinger", url: (d) => `https://hpanel.hostinger.com/domain/${d}/dns`,
    steps: ["Open Hostinger hPanel → Domains → your domain → DNS / Nameservers.", "Edit the A record with name @ to the value below (delete other A records for @).", "Edit the CNAME record www so it points to your domain. Save."] },
  { match: /bigrock|resellerclub|rc-dns|dnsbackup/, key: "bigrock", name: "BigRock / ResellerClub", url: () => "https://manage.bigrock.in/customer",
    steps: ["Log in to BigRock → Manage Orders → your domain → DNS Management → Manage DNS.", "Under A Records, set the record for your domain (blank / @) to the value below.", "Under CNAME Records, add www pointing to your domain. Save."] },
  { match: /registrar-servers\.com/, key: "namecheap", name: "Namecheap", url: (d) => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${d}/advancedns`,
    steps: ["Open Namecheap → Domain List → Manage → Advanced DNS.", "Add or edit an A Record with host @ and the value below. Remove any URL Redirect or parking record for @.", "Add a CNAME Record with host www and value your domain. Save all changes."] },
  { match: /cloudflare\.com/, key: "cloudflare", name: "Cloudflare", url: () => "https://dash.cloudflare.com/",
    steps: ["Open Cloudflare → your domain → DNS → Records.", "Edit the A record for @ to the value below and switch Proxy status to “DNS only” (grey cloud).", "Edit the CNAME www → your domain, also “DNS only”. Save."] },
  { match: /googledomains\.com|squarespace/, key: "squarespace", name: "Squarespace Domains", url: (d) => `https://account.squarespace.com/domains/managed/${d}/dns/dns-settings`,
    steps: ["Open Squarespace Domains → your domain → DNS → DNS Settings.", "Under Custom records, add an A record with host @ and the value below (remove default Squarespace records for @).", "Add a CNAME record with host www and data your domain. Save."] },
  { match: /wixdns\.net/, key: "wix", name: "Wix", url: () => "https://manage.wix.com/account/domains",
    steps: ["Open Wix → Domains → your domain → ⋯ → Manage DNS records.", "Edit the A record (Host Name: your domain) to the value below.", "Edit the CNAME www to point to your domain. Save."] },
  { match: /awsdns/, key: "route53", name: "Amazon Route 53", url: () => "https://console.aws.amazon.com/route53/v2/hostedzones",
    steps: ["Open Route 53 → Hosted zones → your domain.", "Edit the A record for the root to the value below (Simple routing).", "Create a CNAME record www → your domain. Save."] },
  { match: /zoho/, key: "zoho", name: "Zoho", url: () => "https://domains.zoho.in/",
    steps: ["Open Zoho → Domains → your domain → DNS Manager.", "Edit the A record for @ to the value below.", "Add a CNAME record www → your domain. Save."] },
];

export async function providerOf(domain: string): Promise<Provider> {
  let ns: string[] = [];
  try { ns = (await resolver.resolveNs(registeredDomain(domain))).map((x) => x.toLowerCase()); } catch { /* unknown */ }
  const hit = PROVIDERS.find((p) => ns.some((n) => p.match.test(n)));
  if (hit) return { key: hit.key, name: hit.name, dnsUrl: hit.url(registeredDomain(domain)), steps: hit.steps };
  return { key: "other", name: ns[0] ? ns[0].split(".").slice(-2).join(".") : "your domain company", dnsUrl: "",
    steps: ["Log in where you bought the domain and open its DNS settings (sometimes called DNS Management or Zone Editor).", "Set the A record for @ (the bare domain) to the value below and delete other A records for @.", "Add a CNAME record www pointing to your domain. Save."] };
}

export type RecordStatus = { host: string; type: "A" | "CNAME"; name: string; value: string; current: string[]; ok: boolean };
/** What each host needs and what DNS says now. */
export async function dnsStatus(domain: string): Promise<{ provider: Provider; records: RecordStatus[]; ready: boolean }> {
  const hosts = hostsFor(domain);
  const root = hosts[0];
  const [provider, ...current] = await Promise.all([providerOf(root), ...hosts.map(addressesOf)]);
  const records: RecordStatus[] = hosts.map((h, i) => {
    const isWww = h.startsWith("www.") && hosts.length > 1;
    const bare = registeredDomain(h) === h;
    return {
      host: h, type: isWww ? "CNAME" : "A",
      name: isWww ? "www" : bare ? "@" : h.slice(0, -(registeredDomain(h).length + 1)),
      value: isWww ? root : SERVER_IP,
      current: current[i], ok: current[i].length > 0 && current[i].every((ip) => ip === SERVER_IP),
    };
  });
  return { provider, records, ready: records[0].ok };
}

/** Issue the certificate and publish the vhost (idempotent). */
export async function issueCertificate(host: string): Promise<{ ok: boolean; error?: string }> {
  try { await run("sudo", ["-n", CERT_SCRIPT, host], { timeout: 150_000 }); return { ok: true }; }
  catch (e) { return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }; }
}
