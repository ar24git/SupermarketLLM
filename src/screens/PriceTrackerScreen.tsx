import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { products } from '../data/superMarkets';
import {
  allStores,
  getFacts,
  listTopCategories,
  ProductFacts,
} from '../services/priceIndex';
import { Store } from '../types';

// ============================================================================
// Stats computed once at module load — the catalog is static at runtime so we
// don't need to recompute these per render.
// ============================================================================

interface ChainStat {
  store: Store;
  /** Number of products where this chain offers the lowest price. */
  wins: number;
  /** Average price across all products this chain carries. */
  avgPrice: number;
  /** Number of distinct products carried by this chain. */
  productsStocked: number;
}

interface DealRow {
  facts: ProductFacts;
  /** priciest - cheapest (€). */
  spread: number;
  /** spread / cheapest * 100. */
  spreadPercent: number;
}

interface OverallStats {
  totalProducts: number;
  totalChains: number;
  totalPriceEntries: number;
  avgPrice: number;
}

const allFacts: ProductFacts[] = products
  .map((p) => getFacts(p.id))
  .filter((f): f is ProductFacts => f !== undefined && f.sortedPrices.length > 0);

const overallStats: OverallStats = (() => {
  let totalPriceEntries = 0;
  let priceSum = 0;
  for (const f of allFacts) {
    totalPriceEntries += f.storeCount;
    for (const sp of f.sortedPrices) priceSum += sp.price;
  }
  return {
    totalProducts: allFacts.length,
    totalChains: allStores.length,
    totalPriceEntries,
    avgPrice: totalPriceEntries ? priceSum / totalPriceEntries : 0,
  };
})();

const chainStats: ChainStat[] = (() => {
  const wins = new Map<string, number>();
  const sums = new Map<string, { sum: number; count: number }>();
  for (const s of allStores) {
    wins.set(s.id, 0);
    sums.set(s.id, { sum: 0, count: 0 });
  }
  for (const f of allFacts) {
    if (f.cheapest) wins.set(f.cheapest.store.id, (wins.get(f.cheapest.store.id) ?? 0) + 1);
    for (const sp of f.sortedPrices) {
      const e = sums.get(sp.store.id);
      if (e) {
        e.sum += sp.price;
        e.count += 1;
      }
    }
  }
  return allStores
    .map((store) => {
      const e = sums.get(store.id)!;
      return {
        store,
        wins: wins.get(store.id) ?? 0,
        avgPrice: e.count ? e.sum / e.count : 0,
        productsStocked: e.count,
      };
    })
    .sort((a, b) => b.wins - a.wins);
})();

const topDeals: DealRow[] = (() => {
  return allFacts
    .filter((f) => f.sortedPrices.length >= 2 && f.cheapest && f.priciest)
    .map((f) => {
      const spread = f.priciest!.price - f.cheapest!.price;
      const spreadPercent = (spread / f.cheapest!.price) * 100;
      return { facts: f, spread, spreadPercent };
    })
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 50);
})();

const topCategories = listTopCategories();

// ============================================================================
// Helpers
// ============================================================================

function stripDiacritics(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Average price of all products in a top-level category, per chain. */
function averagesForCategory(category: string): ChainStat[] {
  const inCat = allFacts.filter(
    (f) => f.enriched?.categoryClean?.startsWith(category + '/')
  );
  const sums = new Map<string, { sum: number; count: number; wins: number }>();
  for (const s of allStores) sums.set(s.id, { sum: 0, count: 0, wins: 0 });
  for (const f of inCat) {
    if (f.cheapest) {
      const e = sums.get(f.cheapest.store.id);
      if (e) e.wins += 1;
    }
    for (const sp of f.sortedPrices) {
      const e = sums.get(sp.store.id);
      if (e) {
        e.sum += sp.price;
        e.count += 1;
      }
    }
  }
  return allStores
    .map((store) => {
      const e = sums.get(store.id)!;
      return {
        store,
        wins: e.wins,
        avgPrice: e.count ? e.sum / e.count : 0,
        productsStocked: e.count,
      };
    })
    .filter((s) => s.productsStocked > 0)
    .sort((a, b) => a.avgPrice - b.avgPrice);
}

// ============================================================================
// Screen
// ============================================================================

export default function PriceTrackerScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const storeName = (s: Store) => (lang === 'el' ? s.nameGreek : s.name);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null); // null = All
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats relevant to the current category filter (or overall if null).
  const currentChainStats = useMemo(
    () => (category ? averagesForCategory(category) : chainStats),
    [category]
  );

  // Apply search + category to the full table.
  const filteredFacts = useMemo(() => {
    const q = stripDiacritics(search.trim());
    return allFacts
      .filter((f) => {
        if (category && !f.enriched?.categoryClean?.startsWith(category + '/')) {
          return false;
        }
        if (q.length === 0) return true;
        const hay = stripDiacritics(`${f.product.name} ${f.product.nameGreek}`);
        return hay.includes(q);
      })
      .sort((a, b) => (a.cheapest?.price ?? 0) - (b.cheapest?.price ?? 0));
  }, [search, category]);

  const filteredDeals = useMemo(() => {
    if (!category) return topDeals.slice(0, 10);
    return topDeals
      .filter((d) =>
        d.facts.enriched?.categoryClean?.startsWith(category + '/')
      )
      .slice(0, 10);
  }, [category]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📊 {t('priceTracker.title')}</Text>
          <Text style={styles.subtitle}>{t('priceTracker.subtitle')}</Text>
        </View>

        {/* Overview stats */}
        <View style={styles.statsGrid}>
          <StatCard
            label={t('priceTracker.totalProducts')}
            value={overallStats.totalProducts.toLocaleString()}
          />
          <StatCard
            label={t('priceTracker.totalChains')}
            value={overallStats.totalChains.toString()}
          />
          <StatCard
            label={t('priceTracker.totalPrices')}
            value={overallStats.totalPriceEntries.toLocaleString()}
          />
          <StatCard
            label={t('priceTracker.avgPrice')}
            value={`€${overallStats.avgPrice.toFixed(2)}`}
          />
        </View>

        {/* Category pills */}
        <View style={styles.catPillContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catPillRow}
          >
            <FilterPill
              label={t('priceTracker.all')}
              active={category === null}
              onPress={() => setCategory(null)}
            />
            {topCategories.map((c) => (
              <FilterPill
                key={c.name}
                label={`${c.name} (${c.count})`}
                active={category === c.name}
                onPress={() => setCategory(c.name)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Chain leaderboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🏆 {category
              ? `${t('priceTracker.chainAvgInCategory')} — ${category}`
              : t('priceTracker.chainLeaderboard')}
          </Text>
          <Text style={styles.sectionHint}>
            {category
              ? t('priceTracker.chainAvgHint')
              : t('priceTracker.chainLeaderboardHint')}
          </Text>
          <View style={styles.chainList}>
            {currentChainStats.map((cs, i) => {
              // When in category view, sort by avg price (lower is better).
              // When in overview, sort by wins.
              const metric = category ? cs.avgPrice : cs.wins;
              const maxMetric = category
                ? Math.max(...currentChainStats.map((x) => x.avgPrice), 0.01)
                : Math.max(...currentChainStats.map((x) => x.wins), 1);
              // For avg-price view, invert so "lower is better" shows as longer bar.
              const widthPct = category
                ? Math.max(8, 100 - (cs.avgPrice / maxMetric) * 80)
                : (cs.wins / maxMetric) * 100;
              return (
                <View key={cs.store.id} style={styles.chainRow}>
                  <View style={styles.chainLabelCol}>
                    <Text style={styles.chainRank}>
                      {i === 0 ? '🏆 ' : `${i + 1}. `}
                      {storeName(cs.store)}
                    </Text>
                    <Text style={styles.chainMeta}>
                      {category
                        ? t('priceTracker.avgIn', {
                            count: cs.productsStocked,
                          })
                        : t('priceTracker.winsIn', {
                            wins: cs.wins,
                            stocked: cs.productsStocked,
                          })}
                    </Text>
                  </View>
                  <View style={styles.chainBarTrack}>
                    <View
                      style={[
                        styles.chainBarFill,
                        {
                          width: `${widthPct}%`,
                          backgroundColor: i === 0 ? '#4caf50' : '#90caf9',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chainMetricValue}>
                    {category ? `€${cs.avgPrice.toFixed(2)}` : cs.wins}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top deals — biggest price spread */}
        {filteredDeals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              💰 {t('priceTracker.topDeals')}
            </Text>
            <Text style={styles.sectionHint}>
              {t('priceTracker.topDealsHint')}
            </Text>
            {filteredDeals.map((d) => {
              const p = d.facts;
              const name = lang === 'el' ? p.product.nameGreek : p.product.name;
              return (
                <View key={p.product.id} style={styles.dealRow}>
                  <View style={styles.dealTextCol}>
                    <Text style={styles.dealName} numberOfLines={2}>
                      {name}
                    </Text>
                    <Text style={styles.dealSubtext}>
                      €{p.cheapest!.price.toFixed(2)} @ {storeName(p.cheapest!.store)}
                      {'  ·  '}
                      €{p.priciest!.price.toFixed(2)} @ {storeName(p.priciest!.store)}
                    </Text>
                  </View>
                  <View style={styles.dealSavingsCol}>
                    <Text style={styles.dealSavings}>
                      −€{d.spread.toFixed(2)}
                    </Text>
                    <Text style={styles.dealSavingsPct}>
                      −{d.spreadPercent.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Search + full table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔍 {t('priceTracker.fullPriceTable')}
          </Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('priceTracker.searchPlaceholder')}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          <Text style={styles.tableSummary}>
            {t('priceTracker.showingResults', { count: filteredFacts.length })}
          </Text>
          {filteredFacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('priceTracker.noResults')}</Text>
            </View>
          ) : (
            filteredFacts.slice(0, 100).map((f) => {
              const name = lang === 'el' ? f.product.nameGreek : f.product.name;
              const isExpanded = expandedId === f.product.id;
              const spread = f.priciest && f.cheapest ? f.priciest.price - f.cheapest.price : 0;
              return (
                <View key={f.product.id} style={styles.productCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedId((prev) => (prev === f.product.id ? null : f.product.id))
                    }
                    style={styles.productRow}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.productChevron}>{isExpanded ? '▾' : '▸'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {name}
                      </Text>
                      <Text style={styles.productSubtext}>
                        €{f.cheapest!.price.toFixed(2)} @ {storeName(f.cheapest!.store)}
                        {'  ·  '}
                        {f.storeCount} {t('priceTracker.stores')}
                        {spread > 0 && `  ·  ${t('priceTracker.spread')} €${spread.toFixed(2)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.productPrices}>
                      {f.sortedPrices.map((sp, i) => {
                        const delta = sp.price - f.cheapest!.price;
                        return (
                          <View
                            key={sp.store.id}
                            style={[
                              styles.priceLine,
                              i === 0 && styles.priceLineBest,
                            ]}
                          >
                            <Text style={styles.priceLineStore}>
                              {i === 0 ? '🏆 ' : ''}
                              {storeName(sp.store)}
                            </Text>
                            <View style={styles.priceLineRight}>
                              <Text style={styles.priceLineAmount}>
                                €{sp.price.toFixed(2)}
                              </Text>
                              {delta > 0 && (
                                <Text style={styles.priceLineDelta}>
                                  +€{delta.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
          {filteredFacts.length > 100 && (
            <Text style={styles.tableMore}>
              + {filteredFacts.length - 100} {t('priceTracker.more')}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.catPill, active && styles.catPillActive]}
      onPress={onPress}
    >
      <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#1976d2',
    padding: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  // Category pills
  catPillContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  catPillRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eceff1',
    marginRight: 6,
  },
  catPillActive: {
    backgroundColor: '#1976d2',
  },
  catPillText: {
    fontSize: 12,
    color: '#37474f',
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#fff',
  },
  // Sections
  section: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 11,
    color: '#777',
    marginBottom: 10,
  },
  // Chain leaderboard
  chainList: {
    gap: 8,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chainLabelCol: {
    flexBasis: 130,
  },
  chainRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212121',
  },
  chainMeta: {
    fontSize: 10,
    color: '#777',
  },
  chainBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: '#eceff1',
    borderRadius: 7,
    overflow: 'hidden',
  },
  chainBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  chainMetricValue: {
    width: 56,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
  },
  // Deal rows
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dealTextCol: {
    flex: 1,
    marginRight: 8,
  },
  dealName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  dealSubtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  dealSavingsCol: {
    alignItems: 'flex-end',
  },
  dealSavings: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e7d32',
  },
  dealSavingsPct: {
    fontSize: 11,
    color: '#388e3c',
  },
  // Search + table
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#212121',
    marginBottom: 8,
  },
  tableSummary: {
    fontSize: 11,
    color: '#777',
    marginBottom: 8,
  },
  productCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  productChevron: {
    width: 16,
    fontSize: 12,
    color: '#90a4ae',
    marginTop: 1,
  },
  productName: {
    fontSize: 13,
    color: '#212121',
  },
  productSubtext: {
    fontSize: 11,
    color: '#558b2f',
    marginTop: 2,
  },
  productPrices: {
    paddingLeft: 16,
    paddingBottom: 10,
    paddingRight: 4,
  },
  priceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 3,
    backgroundColor: '#fafafa',
  },
  priceLineBest: {
    backgroundColor: '#e8f5e9',
  },
  priceLineStore: {
    fontSize: 12,
    color: '#212121',
    flex: 1,
  },
  priceLineRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceLineAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
  },
  priceLineDelta: {
    fontSize: 11,
    color: '#ef6c00',
    marginLeft: 6,
  },
  tableMore: {
    textAlign: 'center',
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 8,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 13,
  },
});
