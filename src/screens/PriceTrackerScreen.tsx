import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
// @ts-ignore - Chart components work at runtime despite type issues
import {
  BarChart,
  PieChart,
} from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';

// Top 100 Common Items Index - Greek Market Items
const commonItems = [
  // Ψωμί και Ζαχαροπλαστικά
  { id: 1, name: 'Λευκό ψωμί', category: 'Ψωμί' },
  { id: 2, name: 'Ολικής αλέσεως ψωμί', category: 'Ψωμί' },
  { id: 3, name: 'Σούρ ντου', category: 'Ψωμί' },
  { id: 4, name: 'Μπαγκέτα', category: 'Ψωμί' },
  { id: 5, name: 'Κρουασάν', category: 'Ζαχαροπλαστικά' },
  { id: 6, name: 'Παγωτό κακάο', category: 'Ζαχαροπλαστικά' },
  { id: 7, name: 'Τσιαμπούρι', category: 'Ψωμί' },
  { id: 8, name: 'Ρύζι', category: 'Ψωμί' },
  { id: 9, name: 'Πολυδαπέδο ψωμί', category: 'Ψωμί' },
  { id: 10, name: 'Ψωμί τοστ', category: 'Ψωμί' },
  
  // Γαλακτοκομικά
  { id: 11, name: 'Ολοκατεργασμένο γάλα', category: 'Γαλακτοκομικά' },
  { id: 12, name: 'Αποσταγμένο γάλα', category: 'Γαλακτοκομικά' },
  { id: 13, name: 'Γκρίκ γιαούρτι', category: 'Γαλακτοκομικά' },
  { id: 14, name: 'Φυσικό γιαούρτι', category: 'Γαλακτοκομικά' },
  { id: 15, name: 'Βούτυρο', category: 'Γαλακτοκομικά' },
  { id: 16, name: 'Τυρί τσίζ', category: 'Γαλακτοκομικά' },
  { id: 17, name: 'Φέτα', category: 'Γαλακτοκομικά' },
  { id: 18, name: 'Μοτσαρέλα', category: 'Γαλακτοκομικά' },
  { id: 19, name: 'Αυγά (12άρι)', category: 'Γαλακτοκομικά' },
  { id: 20, name: 'Κουραμπιές τυρί', category: 'Γαλακτοκομικά' },
  
  // Κρέας και Πουλερικά
  { id: 21, name: 'Στήθος κοτόπουλου', category: 'Κρέας' },
  { id: 22, name: 'Χοιρινό κρέας', category: 'Κρέας' },
  { id: 23, name: 'Χοιρινά ραντιέρα', category: 'Κρέας' },
  { id: 24, name: 'Σαουσίσια', category: 'Κρέας' },
  { id: 25, name: 'Μπέικον', category: 'Κρέας' },
  { id: 26, name: 'Αρνίσια ραντιέρα', category: 'Κρέας' },
  { id: 27, name: 'Ινδικό στήθος', category: 'Κρέας' },
  { id: 28, name: 'Βοδινό ραντιέρα', category: 'Κρέας' },
  { id: 29, name: 'Χαμόνι', category: 'Κρέας' },
  { id: 30, name: 'Πάτσα', category: 'Κρέας' },
  
  // Ψάρι και Θαλασσινά
  { id: 31, name: 'Ψαρί σομίνα', category: 'Ψάρι' },
  { id: 32, name: 'Καντάτο ψαρί', category: 'Ψάρι' },
  { id: 33, name: 'Γαρίδες', category: 'Θαλασσινά' },
  { id: 34, name: 'Κωδονίτσα', category: 'Ψάρι' },
  { id: 35, name: 'Σαρδέλες σε λάδι', category: 'Ψάρι' },
  { id: 36, name: 'Μακρελί', category: 'Ψάρι' },
  { id: 37, name: 'Μύτιλα', category: 'Θαλασσινά' },
  { id: 38, name: 'Καλαμάρι', category: 'Θαλασσινά' },
  { id: 39, name: 'Χταπόδι', category: 'Θαλασσινά' },
  { id: 40, name: 'Λαγιάδα', category: 'Ψάρι' },
  
  // Φρούτα
  { id: 41, name: 'Μήλα (1κg)', category: 'Φρούτα' },
  { id: 42, name: 'Καρπούζι (1κg)', category: 'Φρούτα' },
  { id: 43, name: 'Πορτοκάλια (1κg)', category: 'Φρούτα' },
  { id: 44, name: 'Σταφύλια', category: 'Φρούτα' },
  { id: 45, name: 'Φράουλες', category: 'Φρούτα' },
  { id: 46, name: 'Μορφίτσες', category: 'Φρούτα' },
  { id: 47, name: 'Καρπούζι', category: 'Φρούτα' },
  { id: 48, name: 'Ανανάς', category: 'Φρούτα' },
  { id: 49, name: 'Μάνγκο', category: 'Φρούτα' },
  { id: 50, name: 'Αχλάδια', category: 'Φρούτα' },
  
  // Λαχανικά
  { id: 51, name: 'Πατάτες (1κg)', category: 'Λαχανικά' },
  { id: 52, name: 'Καρότα (1κg)', category: 'Λαχανικά' },
  { id: 53, name: 'Ντομάτες (1κg)', category: 'Λαχανικά' },
  { id: 54, name: 'Κρεμύδια (1κg)', category: 'Λαχανικά' },
  { id: 55, name: 'Χόρτα', category: 'Λαχανικά' },
  { id: 56, name: 'Αγγούρι', category: 'Λαχανικά' },
  { id: 57, name: 'Πιπεριές', category: 'Λαχανικά' },
  { id: 58, name: 'Μπρόκολο', category: 'Λαχανικά' },
  { id: 59, name: 'Σπανάκι', category: 'Λαχανικά' },
  { id: 60, name: 'Μαντζαράκια', category: 'Λαχανικά' },
  
  // Αποθήκευση
  { id: 61, name: 'Ρύζι (1κg)', category: 'Αποθήκη' },
  { id: 62, name: 'Μακaronία', category: 'Αποθήκη' },
  { id: 63, name: 'Ελαιόλαδο', category: 'Αποθήκη' },
  { id: 64, name: 'Ηλιόσπορο', category: 'Αποθήκη' },
  { id: 65, name: 'Αλεύρι', category: 'Αποθήκη' },
  { id: 66, name: 'Ζάχαρη', category: 'Αποθήκη' },
  { id: 67, name: 'Καφές', category: 'Αποθήκη' },
  { id: 68, name: 'Τσάι', category: 'Αποθήκη' },
  { id: 69, name: 'Αρακάς', category: 'Αποθήκη' },
  { id: 70, name: 'Μέλι', category: 'Αποθήκη' },
  
  // Συντηρημένα
  { id: 71, name: 'Παστώτι ντομάτας', category: 'Συντηρημένα' },
  { id: 72, name: 'Φάκες συντηρημένες', category: 'Συντηρημένα' },
  { id: 73, name: 'Κοκκινές ντομάτες', category: 'Συντηρημένα' },
  { id: 74, name: 'Ψωμί συντηρημένο', category: 'Συντηρημένα' },
  { id: 75, name: 'Ψαρί σε λάδι', category: 'Συντηρημένα' },
  { id: 76, name: 'Σαρδέλες σε λάδι', category: 'Συντηρημένα' },
  { id: 77, name: 'Χορταρικά συντηρημένα', category: 'Συντηρημένα' },
  { id: 78, name: 'Φάσελη συντηρημένες', category: 'Συντηρημένα' },
  { id: 79, name: 'Μπικόνι συντηρημένο', category: 'Συντηρημένα' },
  { id: 80, name: 'Συμπυκνωμένο γάλα', category: 'Συντηρημένα' },
  
  // Ποτά
  { id: 81, name: 'Ελληνικό νερό (1.5L)', category: 'Ποτά' },
  { id: 82, name: 'Νεκτάρ πορτοκάλι', category: 'Ποτά' },
  { id: 83, name: 'Κολά', category: 'Ποτά' },
  { id: 84, name: 'Λεμονάδα', category: 'Ποτά' },
  { id: 85, name: 'Ενεργειακό ποτό', category: 'Ποτά' },
  { id: 86, name: 'Νεκτάρ αχλαδιού', category: 'Ποτά' },
  { id: 87, name: 'Αναερόβιο νερό', category: 'Ποτά' },
  { id: 88, name: 'Κόκκινο κρασί', category: 'Ποτά' },
  { id: 89, name: 'Λευκό κρασί', category: 'Ποτά' },
  { id: 90, name: 'Μπύρα', category: 'Ποτά' },
  
  // Γλυκά και Σνακ
  { id: 91, name: 'Σοκολάτα', category: 'Γλυκά' },
  { id: 92, name: 'Ψηλάφια', category: 'Σνακ' },
  { id: 93, name: 'Μπισκότα', category: 'Γλυκά' },
  { id: 94, name: 'Κράκερ', category: 'Σνακ' },
  { id: 95, name: 'Μαλακός', category: 'Σνακ' },
  { id: 96, name: 'Γρανόλα μπαρ', category: 'Σνακ' },
  { id: 97, name: 'Παγωτό', category: 'Γλυκά' },
  { id: 98, name: 'Ποπκόρν', category: 'Σνακ' },
  { id: 99, name: 'Ξηροί καρποί', category: 'Σνακ' },
  { id: 100, name: 'Νουτκάκι', category: 'Γλυκά' },
];

// Supermarket data
const supermarkets = [
  { id: 'carrefour', name: 'Carrefour', color: '#1e88e5' },
  { id: 'makro', name: 'Makro', color: '#43a047' },
  { id: 'bazaar', name: 'Bazaar', color: '#e53935' },
  { id: 'green', name: 'Green Market', color: '#8e24aa' },
];

// Price data structure with current and previous prices for change tracking
interface PriceEntry {
  currentPrice: number;
  previousPrice: number;
  change: number;
  changePercent: number;
}

interface ItemData {
  id: number;
  name: string;
  category: string;
  storePrices: Record<string, PriceEntry>;
}

// Generate realistic Greek prices
function generatePriceData(): ItemData[] {
  return commonItems.map((item, index) => {
    // Base price based on category
    let basePrice = 2;
    if (item.category === 'Φρούτα' || item.category === 'Λαχανικά') basePrice = 1.5;
    else if (item.category === 'Ψωμί') basePrice = 1.8;
    else if (item.category === 'Κρέας') basePrice = 12;
    else if (item.category === 'Ψάρι') basePrice = 10;
    else if (item.category === 'Αποθήκη') basePrice = 3;
    else if (item.category === 'Ποτά') basePrice = 2;
    else if (item.category === 'Γαλακτοκομικά') basePrice = 4;
    else if (item.category === 'Ζαχαροπλαστικά') basePrice = 3;
    else if (item.category === 'Σνακ' || item.category === 'Γλυκά') basePrice = 2.5;

    const storePrices: Record<string, PriceEntry> = {};
    
    supermarkets.forEach((store, storeIndex) => {
      // Generate price with store-specific variance
      const variance = 0.8 + (storeIndex * 0.05) + (Math.random() * 0.3);
      const currentPrice = parseFloat((basePrice * variance).toFixed(2));
      
      // Previous price (5-10% different for change tracking)
      const prevVariance = variance * (0.9 + Math.random() * 0.2);
      const previousPrice = parseFloat((basePrice * prevVariance).toFixed(2));
      
      const change = currentPrice - previousPrice;
      const changePercent = parseFloat(((change / previousPrice) * 100).toFixed(2));
      
      storePrices[store.id] = {
        currentPrice,
        previousPrice,
        change,
        changePercent,
      };
    });

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      storePrices,
    };
  });
}

// Get top items for charts
function getTopItems(items: ItemData[], count: number = 15) {
  return items.slice(0, count).map((item) => ({
    name: item.name,
    category: item.category,
    carrefour: item.storePrices.carrefour.currentPrice,
    makro: item.storePrices.makro.currentPrice,
    bazaar: item.storePrices.bazaar.currentPrice,
    green: item.storePrices.green.currentPrice,
  }));
}

// Calculate category breakdown
function getCategoryBreakdown(items: ItemData[]) {
  const categories: Record<string, { items: number; total: number }> = {};
  
  items.forEach((item) => {
    if (!categories[item.category]) {
      categories[item.category] = { items: 0, total: 0 };
    }
    categories[item.category].items++;
    categories[item.category].total += item.storePrices.carrefour.currentPrice;
  });

  return Object.keys(categories).map((cat) => ({
    name: cat,
    count: categories[cat].items,
    avgPrice: parseFloat((categories[cat].total / categories[cat].items).toFixed(2)),
  }));
}

// Calculate price change distribution
function getPriceChangeDistribution(items: ItemData[]) {
  let priceIncreases = 0;
  let priceDecreases = 0;
  let stablePrices = 0;

  items.forEach((item) => {
    const change = item.storePrices.carrefour.changePercent;
    if (change > 2) priceIncreases++;
    else if (change < -2) priceDecreases++;
    else stablePrices++;
  });

  return { priceIncreases, priceDecreases, stablePrices };
}

// Calculate store statistics
function getStoreStats(items: ItemData[]) {
  let bestStore = supermarkets[0];
  let worstStore = supermarkets[0];
  let bestTotal = Infinity;
  let worstTotal = -Infinity;

  supermarkets.forEach((store) => {
    const total = items.reduce(
      (sum, item) => sum + item.storePrices[store.id].currentPrice,
      0
    );
    if (total < bestTotal) {
      bestTotal = total;
      bestStore = store;
    }
    if (total > worstTotal) {
      worstTotal = total;
      worstStore = store;
    }
  });

  return {
    bestStore,
    worstStore,
    avgBestPrice: parseFloat((bestTotal / items.length).toFixed(2)),
    avgWorstPrice: parseFloat((worstTotal / items.length).toFixed(2)),
  };
}

// Price Tracker Screen Component
export default function PriceTrackerScreen() {
  const { t } = useTranslation();
  const [priceData, setPriceData] = useState<ItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Generate data on mount
  const generateData = () => {
    setIsLoading(true);
    const data = generatePriceData();
    setPriceData(data);
    setIsLoading(false);
  };

  React.useEffect(() => {
    generateData();
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = priceData;
    
    // Filter by category
    if (filterCategory !== 'all') {
      items = items.filter((item) => item.category === filterCategory);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [priceData, filterCategory, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (priceData.length === 0) return null;
    
    const distribution = getPriceChangeDistribution(priceData);
    const storeStats = getStoreStats(priceData);
    
    return {
      totalItems: priceData.length,
      ...distribution,
      ...storeStats,
    };
  }, [priceData]);

  // Chart data
  const chartData = useMemo(() => {
    if (priceData.length === 0) return null;
    
    const topItems = getTopItems(priceData, 15);
    const categoryData = getCategoryBreakdown(priceData);
    const distribution = getPriceChangeDistribution(priceData);
    
    // Price comparison chart data (BarChart)
    const priceComparisonData = {
      labels: topItems.map((i) => i.name.substring(0, 6)),
      datasets: supermarkets.map((store) => ({
        data: topItems.map((item) => (item as any)[store.id] as number),
        color: () => store.color,
      })),
    };

    // Category bar chart data
    const categoryDataForChart = {
      labels: categoryData.map((c) => c.name),
      datasets: [
        {
          data: categoryData.map((c) => c.avgPrice),
          color: () => '#667eea',
        },
        {
          data: categoryData.map((c) => c.count),
          color: () => '#f3f4f6',
        },
      ],
    };

    // Pie chart data for price distribution
    const pieChartData = [
      { name: '↑', count: distribution.priceIncreases, color: '#ef4444' },
      { name: '↓', count: distribution.priceDecreases, color: '#10b981' },
      { name: '→', count: distribution.stablePrices, color: '#6b7280' },
    ];

    // Store comparison radar data
    const radarData = supermarkets.map((store) => {
      const total = priceData.reduce(
        (sum, item) => sum + item.storePrices[store.id].currentPrice,
        0
      );
      return parseFloat((total / priceData.length).toFixed(2));
    });

    return {
      priceComparison: priceComparisonData,
      category: categoryDataForChart,
      pie: pieChartData,
      radar: radarData,
    };
  }, [priceData]);

  // Render price table rows
  const renderPriceTable = () => {
    if (filteredItems.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('priceTracker.noResults')}</Text>
        </View>
      );
    }

    return filteredItems.map((item) => {
      // Get best store
      const bestStore = supermarkets.reduce((best, store) =>
        item.storePrices[store.id].currentPrice <
        item.storePrices[best.id].currentPrice
          ? store
          : best,
        supermarkets[0]
      );

      const change = item.storePrices.carrefour.change;
      const changePercent = Math.abs(item.storePrices.carrefour.changePercent);
      const changeColor =
        change > 0 ? '#ef4444' : change < 0 ? '#10b981' : '#6b7280';
      const changeSymbol = change > 0 ? '▲' : change < 0 ? '▼' : '•';

      return (
        <View key={item.id} style={styles.priceRow}>
          <View style={styles.priceCell}>
            <Text style={styles.priceItemName}>{item.name}</Text>
            <Text style={styles.priceCategory}>{item.category}</Text>
          </View>
          
          {supermarkets.map((store) => (
            <View key={store.id} style={styles.priceCell}>
              <Text style={styles.priceValue}>
                €{item.storePrices[store.id].currentPrice.toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View style={styles.priceCell}>
            <Text style={[styles.bestStore, { color: bestStore.color }]}>
              {bestStore.name}
            </Text>
          </View>
          
          <View style={styles.priceCell}>
            <Text style={[styles.priceChange, { color: changeColor }]}>
              {changeSymbol} {changePercent.toFixed(1)}%
            </Text>
          </View>
        </View>
      );
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🛒 {t('priceTracker.title')}</Text>
        <Text style={styles.subtitle}>{t('priceTracker.subtitle')}</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchLabel}>{t('priceTracker.search')}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('priceTracker.searchPlaceholder')}
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterButton
            label={t('priceTracker.all')}
            isActive={filterCategory === 'all'}
            onPress={() => setFilterCategory('all')}
          />
          {Array.from(new Set(priceData.map((i) => i.category))).map(
            (category) => (
              <FilterButton
                key={category}
                label={category}
                isActive={filterCategory === category}
                onPress={() => setFilterCategory(category)}
              />
            )
          )}
        </ScrollView>
      </View>

      {/* Statistics Cards */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatCard
            label={t('priceTracker.totalItems')}
            value={stats.totalItems.toString()}
          />
          <StatCard
            label={t('priceTracker.priceIncreases')}
            value={stats.priceIncreases.toString()}
            highlight
            color="#ef4444"
          />
          <StatCard
            label={t('priceTracker.priceDecreases')}
            value={stats.priceDecreases.toString()}
            highlight
            color="#10b981"
          />
          <StatCard
            label={t('priceTracker.stablePrices')}
            value={stats.stablePrices.toString()}
          />
          <StatCard
            label={t('priceTracker.bestStore')}
            value={stats.bestStore.name}
            highlight
            color={stats.bestStore.color}
            subValue={`Avg: €${stats.avgBestPrice}`}
          />
          <StatCard
            label={t('priceTracker.worstStore')}
            value={stats.worstStore.name}
            highlight
            color={stats.worstStore.color}
            subValue={`Avg: €${stats.avgWorstPrice}`}
          />
        </View>
      )}

      {/* Charts */}
      {chartData && (
        <View style={styles.chartsContainer}>
          {/* Price Comparison Bar Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {t('priceTracker.top15Comparison')}
            </Text>
            <BarChart
              style={styles.chart}
              data={chartData.priceComparison}
              width={Dimensions.get('window').width - 32}
              height={220}
              fromZero={true}
              chartConfig={{
                backgroundGradientFrom: '#f8f9fa',
                backgroundGradientTo: '#f8f9fa',
                color: (opacity = 1) => '#667eea',
                labelColor: (opacity = 1) => '#666',
                yAxisLabel: '',
                yAxisSuffix: '',
              }}
            />
          </View>

          {/* Category Breakdown */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {t('priceTracker.categoryBreakdown')}
            </Text>
            <BarChart
              style={styles.chart}
              data={chartData.category}
              width={Dimensions.get('window').width - 32}
              height={220}
              fromZero={true}
              chartConfig={{
                backgroundGradientFrom: '#f8f9fa',
                backgroundGradientTo: '#f8f9fa',
                color: () => '#667eea',
                labelColor: (opacity = 1) => '#666',
                yAxisLabel: '',
                yAxisSuffix: '',
              }}
            />
          </View>

          {/* Price Change Distribution */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {t('priceTracker.priceDistribution')}
            </Text>
            <PieChart
              style={styles.chart}
              data={chartData.pie}
              width={Dimensions.get('window').width - 32}
              height={220}
              chartConfig={{
                color: () => '#667eea',
                backgroundColor: 'transparent',
                paddingLeft: '0',
              }}
              accessor="count"
            />
          </View>
        </View>
      )}

      {/* Price Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>
          {t('priceTracker.fullPriceTable')}
        </Text>
        <View style={styles.tableHeader}>
          <Text style={styles.headerCell}>{t('priceTracker.item')}</Text>
          <Text style={styles.headerCell}>{t('priceTracker.category')}</Text>
          {supermarkets.map((store) => (
            <Text key={store.id} style={styles.headerCell}>
              {store.name.substring(0, 8)}
            </Text>
          ))}
          <Text style={styles.headerCell}>{t('priceTracker.bestStore')}</Text>
          <Text style={styles.headerCell}>{t('priceTracker.change')}</Text>
        </View>
        {renderPriceTable()}
      </View>
    </ScrollView>
  );
}

// Helper Components
function FilterButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  color = '#667eea',
  subValue,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
  subValue?: string;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color }]}>{value}</Text>
      {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  searchContainer: {
    padding: 16,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterContainer: {
    padding: 12,
  },
  filterButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#667eea',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statCardHighlight: {
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statSubValue: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  chartsContainer: {
    padding: 12,
    gap: 16,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  priceCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceItemName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  priceCategory: {
    fontSize: 10,
    color: '#999',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  bestStore: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceChange: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
