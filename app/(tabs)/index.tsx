import FeatureTile from '@/components/FeatureTile';
import { BPPicker } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Feature, features as defaultFeatures } from '@/constants/Features';
import { useAuth } from '@/context/AuthContext';
import { loadFromStorage } from '@/lib/supabase';
import { SyncBike, syncLoadBikes, syncLoadPreference, syncLoadTable, syncSavePreference } from '@/lib/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  offline: boolean;
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

async function loadHomeData(isAuthed: boolean): Promise<HomeData> {
  // Reuse cache when fresh (TTL) or when offline (no cloud reload per focus)
  if (homeCache && homeCache.offline === !isAuthed) {
    if (Date.now() - homeCache.ts < CACHE_TTL_MS || homeCache.offline) return homeCache;
  }

  const [tileOrder, rides, bikes, setups, primaryBikeId] = isAuthed
    ? await Promise.all([
        syncLoadPreference<string[]>('tile_order', TILE_ORDER_KEY),
        syncLoadTable<any>('rides', '@bikepro_rides'),
        syncLoadBikes(),
        syncLoadTable<{ id: string; name: string; createdAt: string }>('suspension_setups', '@bikepro_setups'),
        syncLoadPreference<string>('primary_bike', PRIMARY_BIKE_KEY),
      ])
    : await Promise.all([
        loadLocalPref<string[]>(TILE_ORDER_KEY),
        loadFromStorage<any>('@bikepro_rides'),
        loadFromStorage<SyncBike>('@bikepro_bikes'),
        loadFromStorage<{ id: string; name: string; createdAt: string }>('@bikepro_setups'),
        loadLocalPref<string>(PRIMARY_BIKE_KEY),
      ]);

  homeCache = { tileOrder, rides, bikes, setups, primaryBikeId, offline: !isAuthed, ts: Date.now() };
  return homeCache;
}

function primaryOf(bikes: SyncBike[], primaryId: string | null): SyncBike | undefined {
  return bikes.find(b => b.id === primaryId) ?? bikes[0];
}

function pressureSubtitle(bikes: SyncBike[], primaryId: string | null): string | null {
  const primary = primaryOf(bikes, primaryId);
  if (!primary) return null;
  const frontWheel = primary.components.find(c => c.type === 'wheel_front');
  // Semantic key 'pressure'; 'Druck' kept as fallback for unmigrated legacy data
  const pVal = frontWheel?.setupValues?.find(s => s.key === 'pressure' || s.key === 'Druck')?.value;
  return pVal ? `${primary.name}: ${pVal} VR` : null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [orderedFeatures, setOrderedFeatures] = useState<Feature[]>(defaultFeatures);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  // Widget Data State
  const [shredBadge, setShredBadge] = useState<string | null>(null);
  const [lastRideSub, setLastRideSub] = useState<string | null>(null);
  const [pressureSub, setPressureSub] = useState<string | null>(null);
  const [dialedSub, setDialedSub] = useState<string | null>(null);
  const [bikes, setBikes] = useState<SyncBike[]>([]);
  const [primaryBikeId, setPrimaryBikeId] = useState<string | null>(null);

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
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHomeData(!!user).then(d => { if (active) applyData(d); });
      return () => { active = false; };
    }, [user, applyData])
  );

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

        {/* Edit mode toggle */}
        <TouchableOpacity
          onPress={toggleEditMode}
          style={[styles.editBtn, editMode && styles.editBtnActive]}
        >
          <Text style={[styles.editBtnText, editMode && styles.editBtnTextActive]}>
            {editMode ? t('home.edit_done') : t('home.edit_sort')}
          </Text>
        </TouchableOpacity>

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
            <View key={feature.id} style={{ position: 'relative', width: '48%', marginBottom: theme.spacing.md }}>
              {editMode && selectedTile === index && (
                <View style={styles.moveButtons}>
                  <TouchableOpacity
                    onPress={() => moveTile(index, 'up')}
                    style={styles.moveBtn}
                  >
                    <Text style={styles.moveBtnText}>◀</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveTile(index, 'down')}
                    style={styles.moveBtn}
                  >
                    <Text style={styles.moveBtnText}>▶</Text>
                  </TouchableOpacity>
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
  editBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
  },
  editBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '20',
  },
  editBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  editBtnTextActive: {
    color: theme.colors.accent,
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
  moveBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
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
