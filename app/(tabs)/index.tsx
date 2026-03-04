import FeatureTile from '@/components/FeatureTile';
import { theme } from '@/constants/Colors';
import { Feature, features as defaultFeatures } from '@/constants/Features';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const TILE_ORDER_KEY = '@bikepro_tile_order';

export default function HomeScreen() {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [orderedFeatures, setOrderedFeatures] = useState<Feature[]>(defaultFeatures);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  // Load saved tile order
  useEffect(() => {
    AsyncStorage.getItem(TILE_ORDER_KEY).then((data) => {
      if (data) {
        const order: string[] = JSON.parse(data);
        // Reorder based on saved IDs, append any new features at the end
        const reordered: Feature[] = [];
        order.forEach((id) => {
          const feature = defaultFeatures.find((f) => f.id === id);
          if (feature) reordered.push(feature);
        });
        // Add any features not in the saved order (new ones)
        defaultFeatures.forEach((f) => {
          if (!reordered.find((r) => r.id === f.id)) reordered.push(f);
        });
        setOrderedFeatures(reordered);
      }
    });
  }, []);

  const saveOrder = useCallback(async (features: Feature[]) => {
    const order = features.map((f) => f.id);
    await AsyncStorage.setItem(TILE_ORDER_KEY, JSON.stringify(order));
  }, []);

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
      router.push(route as any);
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
          <Text style={styles.tagline}>Dein All-in-One MTB Hub</Text>
        </View>

        {/* Edit mode toggle */}
        <TouchableOpacity
          onPress={toggleEditMode}
          style={[styles.editBtn, editMode && styles.editBtnActive]}
        >
          <Text style={[styles.editBtnText, editMode && styles.editBtnTextActive]}>
            {editMode ? '✓ Fertig' : '✏️ Sortieren'}
          </Text>
        </TouchableOpacity>

        {/* Edit mode instructions */}
        {editMode && (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              Tippe auf zwei Tiles um sie zu tauschen, oder nutze ▲ ▼ zum Verschieben
            </Text>
          </View>
        )}

        {/* Feature grid */}
        <View style={styles.grid}>
          {orderedFeatures.map((feature, index) => (
            <View key={feature.id} style={{ position: 'relative' }}>
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
                />
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Shred hard. Ride smart. 🤙
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
