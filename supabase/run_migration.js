require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
    });

    try {
        await client.connect();
        console.log('Connected to Supabase DB');

        const sql = fs.readFileSync(
            require('path').join(__dirname, 'migration.sql'),
            'utf8'
        );
        await client.query(sql);
        console.log('Main migration complete!');

        const sql002 = fs.readFileSync(
            require('path').join(__dirname, 'migration_002_add_missing_columns.sql'),
            'utf8'
        );
        await client.query(sql002);
        console.log('Migration 002 complete!');

        const sql003 = fs.readFileSync(
            require('path').join(__dirname, 'migration_003_wiki_overrides.sql'),
            'utf8'
        );
        await client.query(sql003);
        console.log('Migration 003 complete!');

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
