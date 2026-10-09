import FeatureTile from '@/components/FeatureTile';
import { BPButton, BPCard, BPPicker, screenContentStyle } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Feature, features as defaultFeatures } from '@/constants/Features';
import { useAuth } from '@/context/AuthContext';
import { loadFromStorage } from '@/lib/supabase';
import { SyncBike, syncLoadBikes, syncLoadPreference, syncLoadTable, syncSavePreference } from '@/lib/sync';
import { computeBikePaceKmPerDay, dueWeeks, formatForecast } from '@/lib/wearForecast';
import { useRefreshOnForeground } from '@/lib/useRefreshOnForeground';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DimensionValue,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

const TILE_ORDER_KEY = '@bikepro_tile_order';
const PRIMARY_BIKE_KEY = '@bikepro_primary_bike';
const CACHE_TTL_MS = 30_000;

interface HomeData {
  tileOrder: string[] | null;
  rides: any[];
  bikes: SyncBike[];
  setups: { id: string; name: string; createdAt: string }[];
  primaryBikeId: string | null;
  parkFavorites: string[] | null;
  offline: boolean;
  userId: string | null;
  ts: number;
}

// Cache across focus events: avoids 3 full table downloads + repeated
// getSession calls on every tab focus. Offline mode loads once per session.
let homeCache: HomeData | null = null;

async function loadLocalPref<T>(key: string): Promise<T | null> {
  try {
    const d = await AsyncStorage.getItem(key);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

async function loadHomeData(isAuthed: boolean, userId: string | null): Promise<HomeData> {
  // Reuse cache when fresh (TTL) or when offline (no cloud reload per focus);
  // never reuse across different users.
  if (homeCache && homeCache.offline === !isAuthed && homeCache.userId === userId) {
    if (Date.now() - homeCache.ts < CACHE_TTL_MS || homeCache.offline) return homeCache;
  }

  const [tileOrder, rides, bikes, setups, primaryBikeId, parkFavorites] = isAuthed
    ? await Promise.all([
        syncLoadPreference<string[]>('tile_order', TILE_ORDER_KEY),
        syncLoadTable<any>('rides', '@bikepro_rides'),
        syncLoadBikes(),
        syncLoadTable<{ id: string; name: string; createdAt: string }>('suspension_setups', '@bikepro_setups'),
        syncLoadPreference<string>('primary_bike', PRIMARY_BIKE_KEY),
        syncLoadPreference<string[]>('park_favorites', '@bikepro_park_favorites'),
      ])
    : await Promise.all([
        loadLocalPref<string[]>(TILE_ORDER_KEY),
        loadFromStorage<any>('@bikepro_rides'),
        // syncLoadBikes works offline via the local cache and applies the
        // legacy setup-key migration (no raw loadFromStorage here)
        syncLoadBikes(),
        loadFromStorage<{ id: string; name: string; createdAt: string }>('@bikepro_setups'),
        loadLocalPref<string>(PRIMARY_BIKE_KEY),
        loadLocalPref<string[]>('@bikepro_park_favorites'),
      ]);

  homeCache = { tileOrder, rides, bikes, setups, primaryBikeId, parkFavorites, offline: !isAuthed, userId, ts: Date.now() };
  return homeCache;
}

function primaryOf(bikes: SyncBike[], primaryId: string | null): SyncBike | undefined {
  return bikes.find(b => b.id === primaryId) ?? bikes[0];
}

function pressureSubtitle(bikes: SyncBike[], primaryId: string | null): string | null {
  const primary = primaryOf(bikes, primaryId);
  if (!primary) return null;
  const frontWheel = primary.components.find(c => c.type === 'wheel_front');
  // Semantic key 'pressure' (legacy keys are migrated on load via syncLoadBikes)
  const pVal = frontWheel?.setupValues?.find(s => s.key === 'pressure')?.value;
  return pVal ? `${primary.name}: ${pVal} VR` : null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [orderedFeatures, setOrderedFeatures] = useState<Feature[]>(defaultFeatures);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  // Widget Data State
  const [shredBadge, setShredBadge] = useState<string | null>(null);
  const [shredSub, setShredSub] = useState<string | null>(null);
  const [lastRideSub, setLastRideSub] = useState<string | null>(null);
  const [parkFavSub, setParkFavSub] = useState<string | null>(null);
  const [pressureSub, setPressureSub] = useState<string | null>(null);
  const [dialedSub, setDialedSub] = useState<string | null>(null);
  const [bikes, setBikes] = useState<SyncBike[]>([]);
  const [primaryBikeId, setPrimaryBikeId] = useState<string | null>(null);
  const [rideCount, setRideCount] = useState(0);
  const [setupCount, setSetupCount] = useState(0);

  // Responsive grid: 2 columns on phones, 3 on tablets, 4 on wide desktop
  const { width: windowWidth } = useWindowDimensions();
  const columns = windowWidth < 600 ? 2 : windowWidth <= 1000 ? 3 : 4;
  const tileWidth: DimensionValue = columns === 2 ? '48%' : columns === 3 ? '32%' : '23.5%';

  const applyData = useCallback((d: HomeData) => {
    // Tile order
    if (d.tileOrder) {
      const reordered: Feature[] = [];
      d.tileOrder.forEach((id) => {
        const feature = defaultFeatures.find((f) => f.id === id);
        if (feature) reordered.push(feature);
      });
      defaultFeatures.forEach((f) => {
        if (!reordered.find((r) => r.id === f.id)) reordered.push(f);
      });
      setOrderedFeatures(reordered);
    }

    // Last ride subtitle (guard against empty/invalid date and missing distance)
    if (d.rides.length > 0) {
      const last = [...d.rides].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const parsed = new Date(last.date);
      const dateStr = last.date && !isNaN(parsed.getTime()) ? parsed.toLocaleDateString() : null;
      const dist = last.distanceKm ?? last.distance;
      setLastRideSub(dateStr ? t('home.last_ride', { date: dateStr, dist: dist ? ` (${dist}km)` : '' }) : null);
    } else {
      setLastRideSub(null);
    }

    // Shred Check badge
    let overdue = 0;
    d.bikes.forEach(b => {
      b.components.forEach(c => {
        c.wearItems?.forEach(w => {
          if (w.currentKm >= w.serviceIntervalKm) overdue++;
        });
      });
    });
    setShredBadge(overdue > 0 ? t('home.overdue_badge', { count: overdue }) : null);

    // Shred Check subtitle: next upcoming service (from Ride-Log pace)
    const pace = computeBikePaceKmPerDay(d.rides ?? []);
    let nextLabel: string | null = null;
    let nextWeeks = Infinity;
    for (const b of d.bikes) {
      const p = pace[b.id] ?? 0;
      for (const c of b.components) {
        for (const w of c.wearItems ?? []) {
          const weeks = dueWeeks(w.serviceIntervalKm - w.currentKm, p);
          if (weeks !== null && weeks < nextWeeks) {
            nextWeeks = weeks;
            nextLabel = w.label;
          }
        }
      }
    }
    setShredSub(nextLabel
      ? `${t('home.next_service')}: ${nextLabel} · ${formatForecast(t, i18n.language, nextWeeks)}`
      : null);

    // Pressure Bot preview (primary bike front pressure)
    setPressureSub(pressureSubtitle(d.bikes, d.primaryBikeId));

    // Dialed In subtitle
    if (d.setups.length > 0) {
      const last = [...d.setups].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      setDialedSub(t('home.current_setup', { name: last.name }));
    } else {
      setDialedSub(null);
    }

    setBikes(d.bikes);
    setPrimaryBikeId(d.primaryBikeId);
    setRideCount(d.rides.length);
    setSetupCount(d.setups.length);
    setParkFavSub(d.parkFavorites && d.parkFavorites.length > 0
      ? t('home.park_favorites', { count: d.parkFavorites.length })
      : null);
  }, [t, i18n]);

  const refreshHome = useCallback(() => {
    loadHomeData(!!user, user?.id ?? null).then(d => applyData(d)).catch(() => {});
  }, [user, applyData]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHomeData(!!user, user?.id ?? null).then(d => { if (active) applyData(d); });
      return () => { active = false; };
    }, [user, applyData])
  );

  // Pull newer cloud data when the app/tab becomes visible again
  useRefreshOnForeground(refreshHome);

  const saveOrder = useCallback(async (features: Feature[]) => {
    const order = features.map((f) => f.id);
    if (homeCache) homeCache.tileOrder = order;
    await syncSavePreference('tile_order', TILE_ORDER_KEY, order);
  }, []);

  const handleSetPrimaryBike = useCallback((bikeId: string) => {
    setPrimaryBikeId(bikeId);
    if (homeCache) homeCache.primaryBikeId = bikeId;
    setPressureSub(pressureSubtitle(bikes, bikeId));
    syncSavePreference('primary_bike', PRIMARY_BIKE_KEY, bikeId);
  }, [bikes]);

  const handleTilePress = (route: string, ready: boolean, index: number) => {
    if (editMode) {
      if (selectedTile === null) {
        // First tap: select this tile
        setSelectedTile(index);
      } else if (selectedTile === index) {
        // Second tap on same: deselect
        setSelectedTile(null);
      } else {
        // Swap the two tiles
        const updated = [...orderedFeatures];
        const temp = updated[selectedTile];
        updated[selectedTile] = updated[index];
        updated[index] = temp;
        setOrderedFeatures(updated);
        saveOrder(updated);
        setSelectedTile(null);
      }
      return;
    }
    if (ready) {
      router.push(route as Href);
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    setSelectedTile(null);
  };

  const moveTile = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= orderedFeatures.length) return;
    const updated = [...orderedFeatures];
    const temp = updated[fromIndex];
    updated[fromIndex] = updated[toIndex];
    updated[toIndex] = temp;
    setOrderedFeatures(updated);
    saveOrder(updated);
    setSelectedTile(toIndex);
  };

  // Onboarding checklist (hides once every step is done)
  const onboardingSteps = [
    { id: 'bike', icon: '🚵', label: t('home.onboarding_bike'), done: bikes.length > 0, route: '/(features)/component-tracker' as Href },
    { id: 'components', icon: '🔩', label: t('home.onboarding_components'), done: bikes.some(b => b.components.length > 0), route: '/(features)/component-tracker' as Href },
    { id: 'setup', icon: '⚙️', label: t('home.onboarding_setup'), done: setupCount > 0, route: '/(features)/dialed-in' as Href },
    { id: 'ride', icon: '📖', label: t('home.onboarding_ride'), done: rideCount > 0, route: '/(features)/ride-log' as Href },
  ];
  const onboardingDone = onboardingSteps.every(s => s.done);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.header}>
          <Text style={styles.logoEmoji}>🚵</Text>
          <Text style={styles.logoText}>BikePro</Text>
          <Text style={styles.tagline}>{t('home.tagline')}</Text>
        </View>

        {/* Onboarding checklist */}
        {!onboardingDone && (
          <BPCard accentColor={theme.colors.accent} style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>🚀 {t('home.onboarding_title')}</Text>
            <Text style={styles.onboardingSubtitle}>{t('home.onboarding_subtitle')}</Text>
            {onboardingSteps.map(step => (
              <TouchableOpacity
                key={step.id}
                style={styles.onboardingStep}
                onPress={() => router.push(step.route)}
              >
                <Text style={styles.onboardingCheck}>{step.done ? '✅' : '⬜'}</Text>
                <Text style={[styles.onboardingLabel, step.done && styles.onboardingLabelDone]}>
                  {step.icon} {step.label}
                </Text>
                {!step.done && <Text style={styles.onboardingArrow}>→</Text>}
              </TouchableOpacity>
            ))}
          </BPCard>
        )}

        {/* Edit mode toggle */}
        <BPButton
          title={editMode ? t('home.edit_done') : t('home.edit_sort')}
          onPress={toggleEditMode}
          variant="secondary"
          size="sm"
          color={editMode ? theme.colors.accent : theme.colors.textSecondary}
          style={styles.editBtn}
        />

        {/* Edit mode instructions */}
        {editMode && (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              {t('home.edit_hint')}
            </Text>
          </View>
        )}

        {/* Primary bike picker (only when more than one bike exists) */}
        {bikes.length > 1 && (
          <BPPicker
            label={t('home.primary_bike')}
            options={bikes.map(b => ({ label: b.name, value: b.id }))}
            value={primaryOf(bikes, primaryBikeId)?.id ?? ''}
            onValueChange={handleSetPrimaryBike}
            containerStyle={{ marginBottom: theme.spacing.md }}
          />
        )}

        {/* Feature grid */}
        <View style={styles.grid}>
          {orderedFeatures.map((feature, index) => (
            <View key={feature.id} style={{ position: 'relative', width: tileWidth, marginBottom: theme.spacing.md }}>
              {editMode && selectedTile === index && (
                <View style={styles.moveButtons}>
                  <BPButton
                    title="◀"
                    onPress={() => moveTile(index, 'up')}
                    variant="secondary"
                    size="sm"
                  />
                  <BPButton
                    title="▶"
                    onPress={() => moveTile(index, 'down')}
                    variant="secondary"
                    size="sm"
                  />
                </View>
              )}
              <View style={[
                editMode && styles.tileDraggable,
                editMode && selectedTile === index && styles.tileSelected,
              ]}>
                <FeatureTile
                  feature={feature}
                  index={index}
                  onPress={() => handleTilePress(feature.route, feature.ready, index)}
                  dynamicSubtitle={
                    feature.id === 'park-picker' && parkFavSub ? parkFavSub :
                      feature.id === 'shred-check' && shredSub ? shredSub :
                        feature.id === 'ride-log' && lastRideSub ? lastRideSub :
                          feature.id === 'pressure-bot' && pressureSub ? pressureSub :
                            feature.id === 'dialed-in' && dialedSub ? dialedSub :
                              undefined
                  }
                  badgeLabel={
                    feature.id === 'shred-check' && shredBadge ? shredBadge : undefined
                  }
                />
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('home.footer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    ...screenContentStyle,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  logoEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  logoText: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tagline: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: theme.spacing.xs,
    letterSpacing: 1,
  },
  onboardingCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  onboardingTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  onboardingSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
  },
  onboardingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40',
  },
  onboardingCheck: {
    fontSize: 14,
  },
  onboardingLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  onboardingLabelDone: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  onboardingArrow: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.md,
  },
  editHint: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '40',
  },
  editHintText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileDraggable: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: theme.radius.lg,
    borderStyle: 'dashed',
  },
  tileSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '10',
  },
  moveButtons: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
