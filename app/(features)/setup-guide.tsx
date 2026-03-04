/**
 * F10: Setup Guide — MTB Setup Wiki
 * Agent Manifest: f10_setup_guide.md
 *
 * Umfassendes Wiki mit Fachbegriffen, Anleitungen, empfohlenen Werten.
 * Kategorien: Cockpit, Fahrwerk, Bremsen, Antrieb, Laufräder, Geometrie, Ergonomie
 * Daten: Statische JSON-Struktur, lokal gebündelt
 */
import { BPCard } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#7C4DFF';

// --- Wiki Data Structure ---
interface WikiArticle {
    id: string;
    title: string;
    category: string;
    tags: string[];
    summary: string;
    content: string; // multi-line detail
    values?: string; // recommended values
    tip?: string;
}

interface WikiCategory {
    id: string;
    emoji: string;
    title: string;
    description: string;
}

export default function SetupGuideScreen() {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

    const categories: WikiCategory[] = [
        { id: 'cockpit', emoji: '🔩', title: t('setup_guide.cat_cockpit'), description: t('setup_guide.cat_cockpit_desc') },
        { id: 'fahrwerk', emoji: '🔱', title: t('setup_guide.cat_suspension'), description: t('setup_guide.cat_suspension_desc') },
        { id: 'bremsen', emoji: '🛑', title: t('setup_guide.cat_brakes'), description: t('setup_guide.cat_brakes_desc') },
        { id: 'antrieb', emoji: '⛓️', title: t('setup_guide.cat_drivetrain'), description: t('setup_guide.cat_drivetrain_desc') },
        { id: 'laufraeder', emoji: '🛞', title: t('setup_guide.cat_wheels'), description: t('setup_guide.cat_wheels_desc') },
        { id: 'geometrie', emoji: '📐', title: t('setup_guide.cat_geometry'), description: t('setup_guide.cat_geometry_desc') },
        { id: 'ergonomie', emoji: '🪑', title: t('setup_guide.cat_ergonomics'), description: t('setup_guide.cat_ergonomics_desc') },
    ];

    const articles: WikiArticle[] = [
        // --- Cockpit ---
        {
            id: 'backsweep',
            title: t('setup_guide.art_backsweep_title'),
            category: 'cockpit',
            tags: ['lenker', 'ergonomie', 'winkel', 'handlebars'],
            summary: t('setup_guide.art_backsweep_summary'),
            content: t('setup_guide.art_backsweep_content'),
            values: t('setup_guide.art_backsweep_values'),
            tip: t('setup_guide.art_backsweep_tip'),
        },
        // --- Fahrwerk ---
        {
            id: 'sag',
            title: t('setup_guide.art_sag_title'),
            category: 'fahrwerk',
            tags: ['gabel', 'dämpfer', 'setup', 'federweg', 'sag'],
            summary: t('setup_guide.art_sag_summary'),
            content: t('setup_guide.art_sag_content'),
            values: t('setup_guide.art_sag_values'),
            tip: t('setup_guide.art_sag_tip'),
        },
        {
            id: 'rebound',
            title: t('setup_guide.art_rebound_title'),
            category: 'fahrwerk',
            tags: ['gabel', 'dämpfer', 'setup', 'klicks', 'rebound'],
            summary: t('setup_guide.art_rebound_summary'),
            content: t('setup_guide.art_rebound_content'),
            values: t('setup_guide.art_rebound_values'),
            tip: t('setup_guide.art_rebound_tip'),
        },
        {
            id: 'compression',
            title: t('setup_guide.art_compression_title'),
            category: 'fahrwerk',
            tags: ['gabel', 'dämpfer', 'setup', 'klicks', 'hsc', 'lsc', 'compression'],
            summary: t('setup_guide.art_compression_summary'),
            content: t('setup_guide.art_compression_content'),
            values: t('setup_guide.art_compression_values'),
        },
        {
            id: 'tokens',
            title: t('setup_guide.art_tokens_title'),
            category: 'fahrwerk',
            tags: ['gabel', 'dämpfer', 'luftkammer', 'progression', 'tokens'],
            summary: t('setup_guide.art_tokens_summary'),
            content: t('setup_guide.art_tokens_content'),
            values: t('setup_guide.art_tokens_values'),
            tip: t('setup_guide.art_tokens_tip'),
        },
        // --- Bremsen ---
        {
            id: 'bremsscheiben',
            title: t('setup_guide.art_bremsscheiben_title'),
            category: 'bremsen',
            tags: ['bremse', 'scheibe', 'mm', 'rotors'],
            summary: t('setup_guide.art_bremsscheiben_summary'),
            content: t('setup_guide.art_bremsscheiben_content'),
            values: t('setup_guide.art_bremsscheiben_values'),
        },
        {
            id: 'bremsbelag',
            title: t('setup_guide.art_bremsbelag_title'),
            category: 'bremsen',
            tags: ['bremse', 'belag', 'sinter', 'organisch', 'pads'],
            summary: t('setup_guide.art_bremsbelag_summary'),
            content: t('setup_guide.art_bremsbelag_content'),
            tip: t('setup_guide.art_bremsbelag_tip'),
        },
        // --- Laufräder ---
        {
            id: 'tubeless',
            title: t('setup_guide.art_tubeless_title'),
            category: 'laufraeder',
            tags: ['tubeless', 'reifen', 'dichtmilch', 'sealant'],
            summary: t('setup_guide.art_tubeless_summary'),
            content: t('setup_guide.art_tubeless_content'),
            values: t('setup_guide.art_tubeless_values'),
            tip: t('setup_guide.art_tubeless_tip'),
        },
        {
            id: 'reifendruck_grundlagen',
            title: t('setup_guide.art_druck_title'),
            category: 'laufraeder',
            tags: ['reifen', 'druck', 'bar', 'psi', 'pressure'],
            summary: t('setup_guide.art_druck_summary'),
            content: t('setup_guide.art_druck_content'),
            values: t('setup_guide.art_druck_values'),
            tip: t('setup_guide.art_druck_tip'),
        },
        // --- Geometrie ---
        {
            id: 'reach',
            title: t('setup_guide.art_reach_title'),
            category: 'geometrie',
            tags: ['geometrie', 'reach', 'rahmengröße'],
            summary: t('setup_guide.art_reach_summary'),
            content: t('setup_guide.art_reach_content'),
            values: t('setup_guide.art_reach_values'),
            tip: t('setup_guide.art_reach_tip'),
        },
        // --- Ergonomie ---
        {
            id: 'sattelhoehe',
            title: t('setup_guide.art_sattelhoehe_title'),
            category: 'ergonomie',
            tags: ['sattel', 'höhe', 'dropper', 'saddle'],
            summary: t('setup_guide.art_sattelhoehe_summary'),
            content: t('setup_guide.art_sattelhoehe_content'),
            values: t('setup_guide.art_sattelhoehe_values'),
            tip: t('setup_guide.art_sattelhoehe_tip'),
        },
        {
            id: 'koerperposition',
            title: t('setup_guide.art_pos_title'),
            category: 'ergonomie',
            tags: ['technik', 'position', 'grundhaltung', 'attack position'],
            summary: t('setup_guide.art_pos_summary'),
            content: t('setup_guide.art_pos_content'),
            tip: t('setup_guide.art_pos_tip'),
        },
    ];

    const filteredArticles = useMemo(() => {
        let result = articles;
        if (selectedCategory) {
            result = result.filter((a) => a.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    a.summary.toLowerCase().includes(q) ||
                    a.tags.some((t) => t.includes(q))
            );
        }
        return result;
    }, [selectedCategory, searchQuery]);

    const toggleArticle = (id: string) => {
        setExpandedArticle(expandedArticle === id ? null : id);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('setup_guide.title'),
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Search bar */}
                <View style={styles.searchWrap}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('setup_guide.search_placeholder')}
                        placeholderTextColor={theme.colors.textMuted}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            if (text.trim()) setSelectedCategory(null);
                        }}
                        selectionColor={ACCENT}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={styles.clearBtn}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category grid */}
                {!selectedCategory && !searchQuery && (
                    <View style={styles.categoryGrid}>
                        {categories.map((cat) => {
                            const count = articles.filter(a => a.category === cat.id).length;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={styles.categoryCard}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                                    <Text style={styles.catTitle}>{cat.title}</Text>
                                    <Text style={styles.catDesc}>{cat.description}</Text>
                                    <Text style={styles.catCount}>{t('setup_guide.articles_count', { count })}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Category header with back */}
                {selectedCategory && (
                    <View style={styles.catHeaderRow}>
                        <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                            <Text style={[styles.backBtn, { color: ACCENT }]}>{t('setup_guide.categories_back')}</Text>
                        </TouchableOpacity>
                        <Text style={styles.catHeaderTitle}>
                            {categories.find(c => c.id === selectedCategory)?.emoji}{' '}
                            {categories.find(c => c.id === selectedCategory)?.title}
                        </Text>
                    </View>
                )}

                {/* Articles */}
                {filteredArticles.map((article) => {
                    const expanded = expandedArticle === article.id;
                    return (
                        <TouchableOpacity
                            key={article.id}
                            onPress={() => toggleArticle(article.id)}
                            activeOpacity={0.85}
                        >
                            <BPCard style={[styles.articleCard, expanded ? styles.articleExpanded : undefined]}>
                                <View style={styles.articleHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.articleTitle}>{article.title}</Text>
                                        <Text style={styles.articleSummary}>{article.summary}</Text>
                                    </View>
                                    <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
                                </View>

                                {expanded && (
                                    <View style={styles.articleBody}>
                                        <Text style={styles.bodyText}>{article.content}</Text>

                                        {article.values && (
                                            <View style={[styles.infoBox, { borderColor: ACCENT + '40' }]}>
                                                <Text style={styles.infoLabel}>{t('setup_guide.recommended_values')}</Text>
                                                <Text style={[styles.infoValue, { color: ACCENT }]}>
                                                    {article.values}
                                                </Text>
                                            </View>
                                        )}

                                        {article.tip && (
                                            <View style={[styles.infoBox, { borderColor: theme.colors.accentLime + '40' }]}>
                                                <Text style={styles.infoLabel}>{t('setup_guide.tip')}</Text>
                                                <Text style={[styles.infoValue, { color: theme.colors.accentLime }]}>
                                                    {article.tip}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.tagRow}>
                                            {article.tags.map((tag) => (
                                                <View key={tag} style={styles.tagChip}>
                                                    <Text style={styles.tagText}>#{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </BPCard>
                        </TouchableOpacity>
                    );
                })}

                {filteredArticles.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📚</Text>
                        <Text style={styles.emptyTitle}>{t('setup_guide.no_articles')}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },

    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.lg,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 15,
        paddingVertical: 14,
    },
    clearBtn: { color: theme.colors.textMuted, fontSize: 16, padding: 4 },

    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
    },
    categoryCard: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    catEmoji: { fontSize: 28, marginBottom: 6 },
    catTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    catDesc: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
    catCount: { color: ACCENT, fontSize: 10, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },

    catHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
    backBtn: { fontSize: 14, fontWeight: '700' },
    catHeaderTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },

    articleCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md },
    articleExpanded: { borderColor: ACCENT + '40', borderWidth: 1 },
    articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    articleTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
    articleSummary: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
    expandIcon: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },

    articleBody: { marginTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
    bodyText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
    infoBox: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginTop: theme.spacing.sm, borderWidth: 1 },
    infoLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    infoValue: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.md },
    tagChip: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
});
