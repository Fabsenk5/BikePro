/**
 * BikePro — Daily bikepark lift-status scraper.
 *
 * Runs in GitHub Actions (see .github/workflows/scrape-park-status.yml) at
 * 7:00 local time. For each park it fetches the homepage and applies keyword
 * heuristics to classify the lift status. Results are upserted into the
 * Supabase `park_status` table (public read, service-role write).
 *
 * Uses only Node 18+ built-ins (global fetch) — no npm dependencies.
 *
 * Env:
 *   SUPABASE_URL             e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = path.join(__dirname, 'park_sources.json');

const STATUS_OPEN = 'open';
const STATUS_PARTIAL = 'partial';
const STATUS_CLOSED = 'closed';
const STATUS_UNKNOWN = 'unknown';

// Positive signals (in priority order). A park is "open" when the page
// contains an opening signal and no closing signal within its near context.
const OPEN_SIGNALS = [
    /bikepark[^<>]{0,120}(geöffnet|geoeffnet|offen)/i,
    /(lifte?|bahn(en)?|seilbahn)[^<>]{0,80}(in betrieb|inbetrieb|öffnet|geöffnet|geoeffnet|offen)/i,
    /(lift|bike park|bikepark)[^<>]{0,80}(open|in operation|running)/i,
    /saison(?:s)?(start|beginn)[^<>]{0,80}(heute|jetzt|wochenende)?/i,
    /(sommer|bike)-?saison[^<>]{0,80}(läuft|laeuft|gestartet|eröffnet|geoeffnet)/i,
    /(täglich|taeglich|tägl\.|tgl\.)[^<>]{0,60}(geöffnet|geoeffnet|offen)/i,
];

const CLOSED_SIGNALS = [
    /bikepark[^<>]{0,120}(geschlossen|gesperrt)/i,
    /(lift|bahn|anlage|seilbahn)[^<>]{0,60}(außer betrieb|ausser betrieb|nicht in betrieb|gesperrt|geschlossen)/i,
    /(saisonende|saison ende|saison beendet|closed for (the )?season)/i,
    /(lift|bahn)[^<>]{0,60}(defekt|stoerung|störung)/i,
];

// Ski/winter contexts must not count as a bike-park closure (ski lifts are
// closed in summer — that is normal, not the park's status).
const SKI_CONTEXT = /(skibetrieb|winterbetrieb|skisaison|ski s?aison|wintersaison|skilift|ski-?lift|piste|abfahrt(s)?trocken)/i;

// Pages that consistently answer "closed for season" once the season ended.
const SEASON_END_SIGNALS = [
    /saison (2026|20\d{2})(\s|.){0,40}(beendet|vorbei|endet|startet (wieder|erst))/i,
    /(ende|end) der (bike-?)?saison/i,
];

const CONCURRENCY = 5;
const TIMEOUT_MS = 9000;

async function fetchHtml(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'user-agent': 'Mozilla/5.0 (compatible; BikeProStatusBot/1.0; +https://github.com/Fabsenk5/BikePro)',
                accept: 'text/html,application/xhtml+xml',
                'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
            },
        });
        if (!res.ok) return null;
        const text = await res.text();
        // Strip tags/scripts/styles for keyword matching
        return text
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 300_000);
    } catch (e) {
        console.warn(`  fetch failed (${e.name}${e.message ? ': ' + e.message : ''})`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function classify(html) {
    const low = html.toLowerCase();
    const isSkiContext = SKI_CONTEXT.test(low);

    let openSignals = 0;
    for (const re of OPEN_SIGNALS) {
        if (re.test(low)) openSignals += 1;
    }

    let closedMatch = null;
    for (const re of CLOSED_SIGNALS) {
        if (re.test(low)) { closedMatch = re; break; }
    }
    let seasonEndMatch = null;
    for (const re of SEASON_END_SIGNALS) {
        if (re.test(low)) { seasonEndMatch = re; break; }
    }

    // Ski/winter pages are full of "geschlossen" for ski lifts — ignore those.
    if (closedMatch && isSkiContext && openSignals === 0) {
        return { status: STATUS_UNKNOWN, note: 'closed signal in ski context' };
    }
    if (seasonEndMatch && isSkiContext && openSignals === 0) {
        return { status: STATUS_UNKNOWN, note: 'season-end signal in ski context' };
    }

    if (closedMatch || seasonEndMatch) {
        // A page that says "open" AND "closed" somewhere is at best partial.
        if (openSignals > 0) {
            return { status: STATUS_PARTIAL, note: `closed signal (${closedMatch ?? seasonEndMatch}) + ${openSignals} opening signals` };
        }
        return { status: STATUS_CLOSED, note: (closedMatch ?? seasonEndMatch).toString() };
    }

    if (openSignals >= 2) return { status: STATUS_OPEN, note: `${openSignals} opening signals` };
    if (openSignals === 1) return { status: STATUS_PARTIAL, note: `1 opening signal (${OPEN_SIGNALS.filter(re => re.test(low))[0].toString()})` };
    return { status: STATUS_UNKNOWN, note: 'no signals found' };
}

async function scrapePark(park) {
    const html = await fetchHtml(park.website);
    if (html === null) {
        return { parkId: park.id, status: STATUS_UNKNOWN, note: 'fetch failed' };
    }
    const { status, note } = classify(html);
    return { parkId: park.id, status, note };
}

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const parks = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
    console.log(`Scraping ${parks.length} parks...`);

    const results = [];
    for (let i = 0; i < parks.length; i += CONCURRENCY) {
        const batch = parks.slice(i, i + CONCURRENCY);
        results.push(...(await Promise.all(batch.map(scrapePark))));
    }

    const summary = results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});
    console.log('Results:', summary);

    // Upsert into Supabase via REST (service role bypasses RLS)
    const checkedAt = new Date().toISOString();
    const rows = results.map(r => ({
        park_id: r.parkId,
        status: r.status,
        note: r.note.slice(0, 300),
        checked_at: checkedAt,
    }));

    const res = await fetch(`${supabaseUrl}/rest/v1/park_status`, {
        method: 'POST',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error(`Upsert failed (${res.status}):`, body.slice(0, 500));
        process.exit(1);
    }
    console.log('Upsert OK');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
