-- Migration 003: Wiki Overrides Table

CREATE TABLE IF NOT EXISTS public.wiki_overrides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    article_id TEXT NOT NULL,
    locale TEXT NOT NULL,
    title TEXT,
    summary TEXT,
    content TEXT,
    values_text TEXT,
    tip TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(article_id, locale)
);

ALTER TABLE public.wiki_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wiki overrides are viewable by everyone"
    ON public.wiki_overrides FOR SELECT
    USING (true);

CREATE POLICY "Wiki overrides can be modified by admins"
    ON public.wiki_overrides FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());
