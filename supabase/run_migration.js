// Load env: prefer supabase/.env (next to this script), fall back to project-root .env
const path = require('path');
const fs = require('fs');

const localEnv = path.join(__dirname, '.env');
const rootEnv = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(localEnv) ? localEnv : rootEnv });

const { Client } = require('pg');

const MIGRATIONS = [
    'migration.sql',
    'migration_002_add_missing_columns.sql',
    'migration_003_wiki_overrides.sql',
    'migration_004_add_max_clicks.sql',
    'migration_005_suspension_modes.sql',
    'migration_006_rls_is_active.sql',
    'migration_007_park_status.sql',
    'migration_008_rls_hardening.sql',
];

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        // Supabase (pooler) uses a cert chain Node does not trust by default —
        // the connection itself is still TLS-encrypted.
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
    });

    try {
        await client.connect();
        console.log('Connected to Supabase DB');

        // Track applied migrations so re-runs skip them
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT now()
            )
        `);
        // Bookkeeping table must not be publicly readable (Security Advisor)
        await client.query('ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY');
        const applied = await client.query('SELECT filename FROM public.schema_migrations');
        const done = new Set(applied.rows.map(r => r.filename));

        for (const file of MIGRATIONS) {
            if (done.has(file)) {
                console.log(`${file} already applied — skipped`);
                continue;
            }
            const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
            try {
                await client.query(sql);
            } catch (err) {
                // 42P07 duplicate_table / 42710 duplicate_object: ran before tracking existed
                if (err.code === '42P07' || err.code === '42710' || /already exists/.test(err.message)) {
                    console.log(`${file} already applied (legacy) — marked as done`);
                } else {
                    throw err;
                }
            }
            await client.query('INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
            console.log(`${file} complete!`);
        }

        const res = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
        );
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

migrate();
