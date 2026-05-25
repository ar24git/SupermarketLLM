import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { ollamaService } from '../services/ollama';
import { recipeEngine } from '../services/recipeEngine';
import { Product, QueryResult } from '../types';
import {
  compareBasketByChain,
  getFacts,
  groupByProductType,
  listByCategoryTop,
  listTopCategories,
  queryHasIntent,
  searchProducts,
} from '../services/priceIndex';
import '../locales/i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  products?: Product[];
}

// One parsed line of an assistant message.
type ContentSegment =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'blank' }
  // Bullet/numbered item inside an INGREDIENTS-style section. Checkbox is shown
  // and we try to match the line text to a catalog product.
  | { kind: 'bullet'; text: string; matchedProduct: Product | null }
  // Bullet/numbered item OUTSIDE an ingredients section — cooking steps,
  // generic lists, multi-choice questions. Renders as plain text, no checkbox.
  | { kind: 'plainBullet'; text: string };

type ParseMode = 'ingredients' | 'other';

/**
 * Decide whether a heading switches us INTO or OUT OF an ingredients section.
 * Returns null for neutral subheadings ("For the meat sauce", "1. Prepare
 * Eggplant") so they don't accidentally flip the mode away from ingredients.
 */
function detectSectionMode(headingText: string): ParseMode | null {
  const h = headingText.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  // Explicit instructions / method / cooking section → checkboxes off.
  if (/(instruction|method|steps?|direction|preparation|cook|note|tip|οδηγι|μεθοδ|εκτελ|παρασκευ|βημα|σημει|μαγειρ)/.test(h)) {
    return 'other';
  }
  // Explicit ingredients / shopping list section → checkboxes on.
  if (/(ingredient|component|grocer|shopping list|what you('| wi)?ll need|προιοντ|συστατικ|υλικ|ψωνια|αγορα)/.test(h)) {
    return 'ingredients';
  }
  return null;
}

/**
 * Words too generic to be a reliable indicator of a match between query and
 * product name. If only these tokens overlapped we treat it as no-match.
 */
const MEANINGLESS_OVERLAP = new Set<string>([
  'large', 'small', 'medium', 'mini', 'mega', 'jumbo', 'big', 'little',
  'thick', 'thin', 'extra', 'classic', 'plain', 'lean', 'fresh', 'dried',
  'frozen', 'whole', 'sliced', 'chopped', 'minced', 'ground', 'organic',
  'with', 'for', 'and', 'the',
  // Greek diacritic-stripped equivalents that show up in product names
  'μεγαλο', 'μικρο', 'μετριο', 'πληρες', 'ελαφρυ',
]);

/**
 * True iff `query` and `productName` share at least one diacritic-stripped
 * token of >= 4 chars that isn't in MEANINGLESS_OVERLAP.
 */
function sharesMeaningfulToken(query: string, product: Product): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4 && !MEANINGLESS_OVERLAP.has(t));
  const qTokens = new Set(norm(query));
  if (qTokens.size === 0) return false;
  for (const tok of norm(`${product.name} ${product.nameGreek}`)) {
    if (qTokens.has(tok)) return true;
  }
  return false;
}

/**
 * Strip markdown emphasis/heading tokens for clean rendering.
 */
function stripMd(s: string): string {
  return s
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * Parse an assistant message into renderable segments. Bullet items try to
 * resolve to a real catalog product so we can wire a checkbox to them.
 *
 * Recognises:
 *   - "- item"  / "* item"  / "• item"
 *   - "1. item" / "2) item"
 *   - "### heading" / "#### heading"
 */
function parseAssistantContent(content: string): ContentSegment[] {
  const lines = content.split(/\r?\n/);
  const segments: ContentSegment[] = [];

  // Default mode: 'other' — no checkboxes anywhere. Only switches to
  // 'ingredients' when we see an explicit heading like "Ingredients" /
  // "Συστατικά" / "Υλικά". This keeps random LLM lists (multi-choice
  // questions, cooking steps, notes) from being treated as products.
  let mode: ParseMode = 'other';

  // Match a markdown heading:
  //   "### Title"  or  "#### 🧑‍🍳 Title"  — hash + optional emoji prefix
  //   "**Title**"  or  "🧑‍🍳 **Title**"  — bold, possibly with emoji prefix
  //   "**Title:**"                       — common LLM pattern
  // Captures the title text (group 1 for hash, group 2 for bold variant).
  const HASH_RE = /^\s*#{1,6}\s*(.+?)\s*$/;
  // Allow up to ~12 non-asterisk chars before the **bold** (covers emoji,
  // numbering, leading whitespace). Title must be the whole rest of the line.
  const BOLD_RE = /^\s*[^*\n]{0,12}\*\*([^*]+)\*\*\s*:?\s*$/;
  const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)/;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    if (line.trim() === '') {
      segments.push({ kind: 'blank' });
      continue;
    }

    const hashHeading = line.match(HASH_RE);
    const boldHeading = !hashHeading ? line.match(BOLD_RE) : null;
    const headingRaw = hashHeading?.[1] ?? boldHeading?.[1];
    if (headingRaw) {
      const headingText = stripMd(headingRaw).trim();
      const newMode = detectSectionMode(headingText);
      if (newMode) mode = newMode;
      segments.push({ kind: 'heading', text: headingText });
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const text = stripMd(bullet[1]).trim();

      if (mode !== 'ingredients') {
        // Outside an ingredients section — render as plain bullet, no checkbox.
        segments.push({ kind: 'plainBullet', text });
        continue;
      }

      // Ingredient mode: try to match the line to a catalog product.
      // Strip qty/units like "500 g (1 lb)", "1 tbsp", "1/2 tsp", and strip
      // bare leading integers like "2 large eggplants" -> "large eggplants".
      const searchText = text
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\d+[\d.,/\s-]*\s*(g|kg|ml|l|lb|oz|tsp|tbsp|cup|cups|stick|sticks|pinch|can|cans)\b/gi, ' ')
        .replace(/(^|\s)\d+(\s|$)/g, ' ')
        .replace(/[:,]/g, ' ')
        .trim();
      const queryForSearch = searchText || text;
      const found = searchProducts(queryForSearch, 1);
      const candidate = found[0]?.product ?? null;
      // Confidence check:
      //   - If the query matched a known productType / category (intent),
      //     trust the search engine — it found a real semantic match even if
      //     the English word doesn't lexically overlap with the Greek name
      //     (e.g. "eggplants" -> productType=eggplant -> "ΜΕΛΙΤΖΑΝΑ").
      //   - Otherwise require at least one meaningful shared token, so weak
      //     keyword-fallback matches like "large eggplants" -> "...LARGE
      //     4/12TEM" get rejected.
      const trusted = queryHasIntent(queryForSearch);
      const matchedProduct =
        candidate && (trusted || sharesMeaningfulToken(queryForSearch, candidate))
          ? candidate
          : null;
      segments.push({ kind: 'bullet', text, matchedProduct });
      continue;
    }

    segments.push({ kind: 'paragraph', text: stripMd(line) });
  }

  return segments;
}

/**
 * Renders the assistant's reply with bullet-list items as checkbox rows.
 * Each bullet is matched against the catalog; matches become tappable to
 * add/remove from the basket. Lines that don't match anything render as plain
 * text rows (still styled as bullets so the layout stays readable).
 */
function AssistantContent({
  content,
  basket,
  onToggleProduct,
  language,
}: {
  content: string;
  basket: Map<string, number>;
  onToggleProduct: (productId: string) => void;
  language: string;
}) {
  const segments = useMemo(() => parseAssistantContent(content), [content]);

  return (
    <View>
      {segments.map((seg, idx) => {
        if (seg.kind === 'blank') {
          return <View key={idx} style={styles.contentSpacer} />;
        }
        if (seg.kind === 'heading') {
          return (
            <Text key={idx} style={styles.contentHeading}>
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'paragraph') {
          return (
            <Text key={idx} style={styles.contentParagraph}>
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'plainBullet') {
          return (
            <View key={idx} style={styles.instructionRow}>
              <Text style={styles.instructionBullet}>•</Text>
              <Text style={styles.instructionText}>{seg.text}</Text>
            </View>
          );
        }
        // bullet (ingredient with checkbox)
        const p = seg.matchedProduct;
        const inBasket = p ? basket.has(p.id) : false;
        const disabled = !p;
        const matchName =
          p ? (language === 'el' ? p.nameGreek : p.name) : null;

        return (
          <TouchableOpacity
            key={idx}
            onPress={() => p && onToggleProduct(p.id)}
            disabled={disabled}
            activeOpacity={0.7}
            style={styles.bulletRow}
          >
            <View
              style={[
                styles.checkbox,
                inBasket && styles.checkboxChecked,
                disabled && styles.checkboxDisabled,
              ]}
            >
              {inBasket && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <View style={styles.bulletTextContainer}>
              <Text
                style={[
                  styles.bulletText,
                  disabled && styles.bulletTextDisabled,
                ]}
              >
                {seg.text}
              </Text>
              {matchName && matchName.toLowerCase() !== seg.text.toLowerCase() && (
                <Text style={styles.bulletMatchHint} numberOfLines={1}>
                  ↳ {matchName}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Modal: pick a top-level category, then multi-select products. Products are
 * grouped by productType under the selected category so users can scan an
 * eyeable list ("Milk", "Yogurt", "Cheese", ...) instead of one flat blob.
 */
function CreateBasketModal({
  visible,
  onClose,
  onAdd,
  language,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (productIds: string[]) => void;
  language: string;
  t: (key: string, opts?: any) => string;
}) {
  // Cached: top-level categories with counts.
  const topCategories = useMemo(() => listTopCategories(), []);
  const [selectedCat, setSelectedCat] = useState<string | null>(
    topCategories[0]?.name ?? null
  );
  // Selected productIds inside this modal session.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  // Free-text filter applied within the chosen category.
  const [filter, setFilter] = useState('');

  // Reset state when reopened.
  useEffect(() => {
    if (visible) {
      setSelection(new Set());
      setFilter('');
      setSelectedCat(topCategories[0]?.name ?? null);
    }
  }, [visible, topCategories]);

  const productsInCat = useMemo(() => {
    if (!selectedCat) return [];
    return listByCategoryTop(selectedCat, 500); // already sorted cheapest-first
  }, [selectedCat]);

  const filteredProducts = useMemo(() => {
    const q = filter
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    if (!q) return productsInCat;
    return productsInCat.filter((f) => {
      const hay = `${f.product.name} ${f.product.nameGreek}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      return hay.includes(q);
    });
  }, [productsInCat, filter]);

  const grouped = useMemo(() => groupByProductType(filteredProducts), [filteredProducts]);

  const toggle = (id: string) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('basketCreateTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>{t('basketClose')}</Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal pill row of top categories */}
          <View style={styles.catPillContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catPillRow}
            >
              {topCategories.map((c) => {
                const active = c.name === selectedCat;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => setSelectedCat(c.name)}
                    style={[styles.catPill, active && styles.catPillActive]}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        active && styles.catPillTextActive,
                      ]}
                    >
                      {c.name} ({c.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Filter input */}
          <View style={styles.filterRow}>
            <TextInput
              style={styles.filterInput}
              value={filter}
              onChangeText={setFilter}
              placeholder={t('basketCreateSearch')}
              placeholderTextColor="#999"
            />
          </View>

          {/* Products grouped by productType */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            {[...grouped.entries()]
              .filter(([type]) => type && type !== 'unknown')
              .map(([type, facts]) => (
                <View key={type}>
                  <Text style={styles.modalSectionTitle}>
                    {type} ({facts.length})
                  </Text>
                  {facts.slice(0, 40).map((f) => {
                    const checked = selection.has(f.product.id);
                    const name =
                      language === 'el' ? f.product.nameGreek : f.product.name;
                    const cheapest = f.cheapest;
                    return (
                      <TouchableOpacity
                        key={f.product.id}
                        onPress={() => toggle(f.product.id)}
                        activeOpacity={0.7}
                        style={styles.pickerRow}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            checked && styles.checkboxChecked,
                          ]}
                        >
                          {checked && (
                            <Text style={styles.checkboxMark}>✓</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.pickerRowName}
                            numberOfLines={2}
                          >
                            {name}
                          </Text>
                          {cheapest && (
                            <Text style={styles.pickerRowMeta}>
                              €{cheapest.price.toFixed(2)} ·{' '}
                              {f.storeCount}{' '}
                              {language === 'el' ? 'καταστήματα' : 'stores'}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Sticky footer: Add selected */}
          <View style={styles.createBasketFooter}>
            <TouchableOpacity
              disabled={selection.size === 0}
              onPress={() => onAdd([...selection])}
              style={[
                styles.createBasketCta,
                selection.size === 0 && styles.createBasketCtaDisabled,
              ]}
            >
              <Text style={styles.createBasketCtaText}>
                {selection.size === 0
                  ? t('basketCreateNoSelection')
                  : t('basketCreateAddSelected', { count: selection.size })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Type-your-list modal
// ----------------------------------------------------------------------------
// The user pastes a shopping list. We parse each line, run searchProducts on
// it, and classify the result into one of three buckets:
//
//   * 'confident' — exactly one candidate (or the candidate set collapses to
//     a single product). Auto-added to the basket on confirm, no UI needed
//     beyond a summary count.
//   * 'ambiguous' — multiple candidates. The user gets a short pick-one list
//     at the end (with skip option) before confirming.
//   * 'none'      — searchProducts returned nothing. Listed under "no good
//     matches" so the user knows what got skipped; not added.
//
// All decisions are made at the end — confidently-matched lines aren't shown
// individually, only counted. That keeps the review UI focused on the lines
// that genuinely need attention.
// ============================================================================

interface ParsedListLine {
  raw: string;
  qty: number;
  query: string;
}

type LineResult =
  | { kind: 'confident'; line: ParsedListLine; product: Product }
  | { kind: 'ambiguous'; line: ParsedListLine; candidates: Product[] }
  | { kind: 'none'; line: ParsedListLine };

/**
 * Parse a single input line into qty + search query. Strips bullet prefixes,
 * leading numerics (which become `qty`), and unit suffixes that would
 * otherwise pollute the search.
 *
 *   "- 2 milks 1L"        -> { qty: 2, query: 'milks' }
 *   "* feta cheese 400g"  -> { qty: 1, query: 'feta cheese' }
 *   "  3) olive oil"       -> { qty: 3, query: 'olive oil' }
 */
function parseListLine(raw: string): ParsedListLine | null {
  let s = raw.trim();
  if (!s) return null;

  // Strip bullet / ordinal prefix.
  s = s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');

  // Capture leading bare integer as qty (e.g. "2 milks").
  let qty = 1;
  const qtyMatch = s.match(/^(\d+)\s+(.+)$/);
  if (qtyMatch) {
    qty = Math.min(99, parseInt(qtyMatch[1], 10) || 1);
    s = qtyMatch[2];
  }

  // Strip parentheticals and trailing units like "1L", "500g", "12oz".
  s = s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+[\d.,/\s-]*\s*(g|kg|ml|l|lb|oz|tsp|tbsp|cup|cups|stick|sticks|pinch|can|cans)\b/gi, ' ')
    .replace(/[:,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return null;
  return { raw: raw.trim(), qty, query: s };
}

function classifyLine(line: ParsedListLine): LineResult {
  const candidates = searchProducts(line.query, 5).map((f) => f.product);
  if (candidates.length === 0) return { kind: 'none', line };
  if (candidates.length === 1) {
    return { kind: 'confident', line, product: candidates[0] };
  }
  // Multiple candidates — let the user choose. Cap at 4 to keep UI sane.
  return { kind: 'ambiguous', line, candidates: candidates.slice(0, 4) };
}

function TypeListModal({
  visible,
  onClose,
  onConfirm,
  language,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (items: { id: string; qty: number }[]) => void;
  language: string;
  t: (key: string, opts?: any) => string;
}) {
  // List of shopping-list lines. Each is its own input box; pressing Enter
  // appends a new empty row, Backspace on an empty row deletes it.
  const [items, setItems] = useState<string[]>(['']);
  const inputRefs = React.useRef<Array<TextInput | null>>([]);
  const [results, setResults] = useState<LineResult[] | null>(null);
  // For ambiguous AND no-match rows: result-index -> chosen productId | null (skip).
  const [picks, setPicks] = useState<Map<number, string | null>>(new Map());
  // Per-row free-text manual search query for 'none' results.
  const [manualSearches, setManualSearches] = useState<Map<number, string>>(new Map());

  // Reset on open.
  useEffect(() => {
    if (visible) {
      setItems(['']);
      setResults(null);
      setPicks(new Map());
      setManualSearches(new Map());
    }
  }, [visible]);

  const hasAnyItem = items.some((it) => it.trim().length > 0);

  const runMatch = () => {
    const parsed = items
      .map(parseListLine)
      .filter((l): l is ParsedListLine => l !== null);
    const r = parsed.map(classifyLine);
    setResults(r);
    const initialPicks = new Map<number, string | null>();
    r.forEach((res, i) => {
      if (res.kind === 'ambiguous') initialPicks.set(i, res.candidates[0].id);
    });
    setPicks(initialPicks);
  };

  // --- per-row list editing helpers ----------------------------------------

  const updateItem = (idx: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const addRowAfter = (idx: number) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, '');
      return next;
    });
    // Focus the new input on the next tick (after React re-renders).
    setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
  };

  const removeRow = (idx: number) => {
    if (items.length === 1) {
      // Keep at least one (cleared) row.
      setItems(['']);
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
    const focusIdx = Math.max(0, idx - 1);
    setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
  };

  const confident = useMemo(
    () => (results ?? []).filter((r): r is Extract<LineResult, { kind: 'confident' }> => r.kind === 'confident'),
    [results]
  );
  const ambiguous = useMemo(
    () =>
      (results ?? [])
        .map((r, i) => ({ r, i }))
        .filter(
          (x): x is { r: Extract<LineResult, { kind: 'ambiguous' }>; i: number } =>
            x.r.kind === 'ambiguous'
        ),
    [results]
  );
  const notFound = useMemo(
    () => (results ?? []).filter((r): r is Extract<LineResult, { kind: 'none' }> => r.kind === 'none'),
    [results]
  );

  // Indexed list of 'none' rows so we can render them and reference their
  // result-index for picks/manualSearches lookups.
  const notFoundIndexed = useMemo(
    () =>
      (results ?? [])
        .map((r, i) => ({ r, i }))
        .filter(
          (x): x is { r: Extract<LineResult, { kind: 'none' }>; i: number } =>
            x.r.kind === 'none'
        ),
    [results]
  );

  // Final count = auto + ambiguous picks + manually-resolved none picks.
  const finalCount = useMemo(() => {
    let n = confident.length;
    for (const { i } of ambiguous) {
      if (picks.get(i)) n += 1;
    }
    for (const { i } of notFoundIndexed) {
      if (picks.get(i)) n += 1;
    }
    return n;
  }, [confident, ambiguous, notFoundIndexed, picks]);

  const handleConfirm = () => {
    if (!results) return;
    const items: { id: string; qty: number }[] = [];
    results.forEach((r, i) => {
      if (r.kind === 'confident') {
        items.push({ id: r.product.id, qty: r.line.qty });
      } else if (r.kind === 'ambiguous' || r.kind === 'none') {
        const pickedId = picks.get(i);
        if (pickedId) items.push({ id: pickedId, qty: r.line.qty });
      }
    });
    onConfirm(items);
  };

  /** Get the user's typed manual-search candidates for a given 'none' row. */
  const manualCandidates = (resultIndex: number): Product[] => {
    const q = (manualSearches.get(resultIndex) ?? '').trim();
    if (q.length < 2) return [];
    return searchProducts(q, 4).map((f) => f.product);
  };

  const setManualSearch = (resultIndex: number, value: string) => {
    setManualSearches((prev) => {
      const next = new Map(prev);
      next.set(resultIndex, value);
      return next;
    });
    // Reset the pick when the search text changes, so a stale selection
    // doesn't sit on a no-longer-visible candidate.
    pickFor(resultIndex, null);
  };

  const pickFor = (resultIndex: number, productId: string | null) => {
    setPicks((prev) => {
      const next = new Map(prev);
      next.set(resultIndex, productId);
      return next;
    });
  };

  const productLabel = (p: Product) =>
    language === 'el' ? p.nameGreek : p.name;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('basketTypeListTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>{t('basketClose')}</Text>
            </TouchableOpacity>
          </View>

          {/* PHASE 1: edit list — one input box per item */}
          {results === null && (
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                {items.map((value, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemCheckbox} />
                    <TextInput
                      ref={(r) => {
                        inputRefs.current[idx] = r;
                      }}
                      value={value}
                      onChangeText={(v) => updateItem(idx, v)}
                      onSubmitEditing={() => addRowAfter(idx)}
                      onKeyPress={(e) => {
                        // Backspace on an empty row removes that row.
                        if (
                          (e.nativeEvent as any).key === 'Backspace' &&
                          value === ''
                        ) {
                          removeRow(idx);
                        }
                      }}
                      placeholder={
                        idx === 0
                          ? t('basketTypeListPlaceholder')
                          : ''
                      }
                      placeholderTextColor="#999"
                      style={styles.itemInput}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      autoCorrect={false}
                      autoCapitalize="none"
                      autoFocus={idx === 0 && items.length === 1}
                    />
                    {items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeRow(idx)}
                        style={styles.itemRemove}
                      >
                        <Text style={styles.itemRemoveText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => addRowAfter(items.length - 1)}
                  style={styles.itemAddRow}
                >
                  <Text style={styles.itemAddRowText}>
                    + {t('basketTypeListAddRow')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              <View style={styles.createBasketFooter}>
                <TouchableOpacity
                  onPress={runMatch}
                  disabled={!hasAnyItem}
                  style={[
                    styles.createBasketCta,
                    !hasAnyItem && styles.createBasketCtaDisabled,
                  ]}
                >
                  <Text style={styles.createBasketCtaText}>
                    {t('basketTypeListMatch')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PHASE 2: review results */}
          {results !== null && (
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Auto-matched (collapsed summary) */}
                {confident.length > 0 && (
                  <View style={styles.typeListSummary}>
                    <Text style={styles.typeListSummaryGood}>
                      ✓ {t('basketTypeListAutoAdded', { count: confident.length })}
                    </Text>
                    {confident.slice(0, 5).map((c, i) => (
                      <Text key={i} style={styles.typeListSummaryLine} numberOfLines={1}>
                        • {c.line.raw}
                        {c.line.qty > 1 ? `  ×${c.line.qty}` : ''}
                        {'  →  '}
                        {productLabel(c.product)}
                      </Text>
                    ))}
                    {confident.length > 5 && (
                      <Text style={styles.typeListSummaryLine}>
                        … +{confident.length - 5} more
                      </Text>
                    )}
                  </View>
                )}

                {/* Ambiguous — user must pick */}
                {ambiguous.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>
                      {t('basketTypeListNeedsReview', { count: ambiguous.length })}
                    </Text>
                    {ambiguous.map(({ r, i }) => {
                      const picked = picks.get(i);
                      return (
                        <View key={i} style={styles.typeListAmbCard}>
                          <Text style={styles.typeListAmbInput}>
                            {r.line.raw}
                            {r.line.qty > 1 ? `  (×${r.line.qty})` : ''}
                          </Text>
                          <Text style={styles.typeListPickHint}>
                            {t('basketTypeListPickOne')}
                          </Text>
                          {r.candidates.map((p) => {
                            const facts = getFacts(p.id);
                            const isSel = picked === p.id;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => pickFor(i, p.id)}
                                style={[
                                  styles.radioRow,
                                  isSel && styles.radioRowActive,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.radioDot,
                                    isSel && styles.radioDotActive,
                                  ]}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={styles.radioName}
                                    numberOfLines={2}
                                  >
                                    {productLabel(p)}
                                  </Text>
                                  {facts?.cheapest && (
                                    <Text style={styles.radioMeta}>
                                      €{facts.cheapest.price.toFixed(2)} @{' '}
                                      {language === 'el'
                                        ? facts.cheapest.store.nameGreek
                                        : facts.cheapest.store.name}
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                          {/* Skip option */}
                          <TouchableOpacity
                            onPress={() => pickFor(i, null)}
                            style={[
                              styles.radioRow,
                              picked === null && styles.radioRowSkipActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.radioDot,
                                picked === null && styles.radioDotSkip,
                              ]}
                            />
                            <Text style={styles.radioSkipText}>
                              {t('basketTypeListSkip')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                )}

                {/* No-match list — interactive: each row has its own search field */}
                {notFoundIndexed.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>
                      {t('basketTypeListNotFound', { count: notFoundIndexed.length })}
                    </Text>
                    {notFoundIndexed.map(({ r, i }) => {
                      const picked = picks.get(i);
                      const searchValue = manualSearches.get(i) ?? '';
                      const candidates = manualCandidates(i);
                      return (
                        <View key={i} style={styles.typeListAmbCard}>
                          <Text style={styles.typeListAmbInput}>
                            {r.line.raw}
                            {r.line.qty > 1 ? `  (×${r.line.qty})` : ''}
                          </Text>
                          <Text style={styles.typeListMissHint}>
                            {t('basketTypeListNoMatch')}
                          </Text>
                          <TextInput
                            value={searchValue}
                            onChangeText={(v) => setManualSearch(i, v)}
                            placeholder={t('basketTypeListManualSearch')}
                            placeholderTextColor="#999"
                            style={styles.manualSearchInput}
                            autoCorrect={false}
                            autoCapitalize="none"
                          />
                          {/* Candidate list (only rendered when user typed >=2 chars) */}
                          {candidates.length > 0 && (
                            <>
                              <Text style={styles.typeListPickHint}>
                                {t('basketTypeListPickOne')}
                              </Text>
                              {candidates.map((p) => {
                                const facts = getFacts(p.id);
                                const isSel = picked === p.id;
                                return (
                                  <TouchableOpacity
                                    key={p.id}
                                    onPress={() => pickFor(i, p.id)}
                                    style={[
                                      styles.radioRow,
                                      isSel && styles.radioRowActive,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.radioDot,
                                        isSel && styles.radioDotActive,
                                      ]}
                                    />
                                    <View style={{ flex: 1 }}>
                                      <Text
                                        style={styles.radioName}
                                        numberOfLines={2}
                                      >
                                        {productLabel(p)}
                                      </Text>
                                      {facts?.cheapest && (
                                        <Text style={styles.radioMeta}>
                                          €{facts.cheapest.price.toFixed(2)} @{' '}
                                          {language === 'el'
                                            ? facts.cheapest.store.nameGreek
                                            : facts.cheapest.store.name}
                                        </Text>
                                      )}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                              {/* Skip option appears once user has typed something */}
                              <TouchableOpacity
                                onPress={() => pickFor(i, null)}
                                style={[
                                  styles.radioRow,
                                  picked === null && styles.radioRowSkipActive,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.radioDot,
                                    picked === null && styles.radioDotSkip,
                                  ]}
                                />
                                <Text style={styles.radioSkipText}>
                                  {t('basketTypeListSkip')}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                          {searchValue.length >= 2 && candidates.length === 0 && (
                            <Text style={styles.typeListMissHint}>
                              — no results —
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                <View style={{ height: 8 }} />
                <TouchableOpacity
                  onPress={() => {
                    setResults(null);
                    setPicks(new Map());
                  }}
                  style={styles.typeListEditButton}
                >
                  <Text style={styles.typeListEditButtonText}>
                    ← {t('basketTypeListEdit')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.createBasketFooter}>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={finalCount === 0}
                  style={[
                    styles.createBasketCta,
                    finalCount === 0 && styles.createBasketCtaDisabled,
                  ]}
                >
                  <Text style={styles.createBasketCtaText}>
                    {t('basketTypeListConfirm', { count: finalCount })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ChatScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean | null>(null);
  // productId -> quantity (>=1). Single source of truth for the basket.
  const [basket, setBasket] = useState<Map<string, number>>(new Map());
  const [basketOpen, setBasketOpen] = useState(false);
  const [createBasketOpen, setCreateBasketOpen] = useState(false);
  const [typeListOpen, setTypeListOpen] = useState(false);
  // Which basket item, if any, is currently expanded to show per-store prices.
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [lastRecipe, setLastRecipe] = useState<any>(null); // Track last processed recipe

  const basketProductIds = useMemo(() => Array.from(basket.keys()), [basket]);
  const basketComparison = useMemo(
    () => compareBasketByChain(basket),
    [basket]
  );

  const toggleBasketItem = (id: string) => {
    setBasket((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, 1);
      return next;
    });
  };
  const setBasketQty = (id: string, qty: number) => {
    setBasket((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, Math.min(99, Math.floor(qty)));
      return next;
    });
  };
  const addManyToBasket = (ids: string[]) => {
    setBasket((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        if (!next.has(id)) next.set(id, 1);
      }
      return next;
    });
  };
  /** Add multiple items with explicit quantities. If an id is already in the
   *  basket, its quantity is summed (not replaced). */
  const addManyWithQty = (items: { id: string; qty: number }[]) => {
    setBasket((prev) => {
      const next = new Map(prev);
      for (const { id, qty } of items) {
        const q = Math.max(1, Math.floor(qty || 1));
        next.set(id, Math.min(99, (next.get(id) ?? 0) + q));
      }
      return next;
    });
  };
  const clearBasket = () => setBasket(new Map());

  // Check Ollama connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const connected = await ollamaService.checkConnection();
    setIsOllamaConnected(connected);
    // Only surface a popup when there's a problem — successful connection
    // doesn't need a visible status indicator.
    if (!connected) {
      Alert.alert(t('ollamaDisconnected'), t('ollamaHint'), [
        { text: t('retry'), onPress: checkConnection },
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result: QueryResult = await ollamaService.queryPrices(
        userMessage.content,
        i18n.language
      );

      // Replace loading message with actual response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: result.answer,
                isLoading: false,
                products: result.products,
              }
            : msg
        )
      );
    } catch (error) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: t('errorGeneric'), isLoading: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'el' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleRecipe = async (recipeText: string) => {
    // Process the recipe using the Recipe Engine
    const recipe = recipeEngine.processRecipe(recipeText);
    setLastRecipe(recipe);
    return recipe;
  };

  const handleSampleQuestion = (question: string) => {
    setInput(question);
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('chatTitle')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PriceTracker')}
            style={styles.priceTrackerButton}
          >
            <Text style={styles.priceTrackerButtonText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBasketOpen(true)}
            style={[
              styles.basketButton,
              basket.size > 0 && styles.basketButtonActive,
            ]}
          >
            <Text style={styles.basketButtonText}>
              🛒 {basket.size > 0 ? basket.size : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
            <Text style={styles.langButtonText}>
              {i18n.language === 'en' ? '🇬🇷 EL' : '🇬🇧 EN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.messagesContainer} 
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('tagline')}</Text>
              <Text style={styles.sampleTitle}>{t('sampleQuestions')}</Text>
              <TouchableOpacity 
                style={styles.sampleButton}
                onPress={() => handleSampleQuestion(t('sample1'))}
              >
                <Text style={styles.sampleButtonText}>🥛 {t('sample1')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sampleButton}
                onPress={() => handleSampleQuestion(t('sample2'))}
              >
                <Text style={styles.sampleButtonText}>🧀 {t('sample2')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sampleButton}
                onPress={() => handleSampleQuestion(t('sample3'))}
              >
                <Text style={styles.sampleButtonText}>🫒 {t('sample3')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {messages.map(msg => (
            <View key={msg.id}>
              <View
                style={[
                  styles.messageBubble,
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                ]}
              >
                {msg.isLoading ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : msg.role === 'user' ? (
                  <Text style={[styles.messageText, styles.userText]}>
                    {msg.content}
                  </Text>
                ) : (
                  <AssistantContent
                    content={msg.content}
                    basket={basket}
                    onToggleProduct={toggleBasketItem}
                    language={i18n.language}
                  />
                )}
              </View>

              {/* Add-to-basket chips for assistant messages that returned products */}
              {msg.role === 'assistant' && !msg.isLoading && msg.products && msg.products.length > 0 && (
                <View style={styles.chipsRow}>
                  {msg.products.map((p) => {
                    const inBasket = basket.has(p.id);
                    const displayName = i18n.language === 'el' ? p.nameGreek : p.name;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => toggleBasketItem(p.id)}
                        style={[styles.chip, inBasket && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, inBasket && styles.chipTextActive]}>
                          {inBasket ? '✓ ' : '+ '}
                          {displayName.length > 36 ? displayName.slice(0, 33) + '…' : displayName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('chatPlaceholder')}
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!input.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>{t('sendButton')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Basket modal: shows items + per-chain comparison */}
      <Modal
        visible={basketOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBasketOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🛒 {t('basket')} ({basket.size})
              </Text>
              <TouchableOpacity onPress={() => setBasketOpen(false)}>
                <Text style={styles.modalClose}>{t('basketClose')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Entry to "Create Basket" pickers, always visible */}
              <View style={styles.basketEntryRow}>
                <TouchableOpacity
                  onPress={() => setCreateBasketOpen(true)}
                  style={[styles.createBasketButton, { flex: 1 }]}
                >
                  <Text style={styles.createBasketButtonText}>
                    {t('basketCreate')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTypeListOpen(true)}
                  style={[styles.typeListButton, { flex: 1 }]}
                >
                  <Text style={styles.typeListButtonText}>
                    {t('basketTypeList')}
                  </Text>
                </TouchableOpacity>
              </View>

              {basket.size === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyTitle}>{t('basketEmpty')}</Text>
                  <Text style={styles.modalEmptyHint}>{t('basketHint')}</Text>
                </View>
              ) : (
                <>
                  {/* Basket items — tap a row to expand and see per-store prices */}
                  <Text style={styles.modalSectionTitle}>{t('basket')}</Text>
                  {basketProductIds.map((id) => {
                    const facts = getFacts(id);
                    if (!facts) return null;
                    const name =
                      i18n.language === 'el'
                        ? facts.product.nameGreek
                        : facts.product.name;
                    const isExpanded = expandedProductId === id;
                    const cheapestPrice = facts.cheapest?.price ?? null;
                    const qty = basket.get(id) ?? 1;
                    return (
                      <View key={id} style={styles.basketItem}>
                        <View style={styles.basketItemRow}>
                          <TouchableOpacity
                            style={styles.basketItemTapTarget}
                            onPress={() =>
                              setExpandedProductId((prev) =>
                                prev === id ? null : id
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={styles.basketItemChevron}>
                              {isExpanded ? '▾' : '▸'}
                            </Text>
                            <View style={styles.basketItemTextCol}>
                              <Text
                                style={styles.basketItemName}
                                numberOfLines={isExpanded ? 0 : 2}
                              >
                                {name}
                              </Text>
                              {cheapestPrice !== null && !isExpanded && (
                                <Text style={styles.basketItemMinPrice}>
                                  €{(cheapestPrice * qty).toFixed(2)}
                                  {qty > 1 ? ` (${qty} × €${cheapestPrice.toFixed(2)})` : ''}
                                  {' · '}
                                  {facts.storeCount}{' '}
                                  {i18n.language === 'el'
                                    ? 'καταστήματα'
                                    : 'stores'}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          {/* Quantity stepper */}
                          <View style={styles.qtyStepper}>
                            <TouchableOpacity
                              onPress={() => setBasketQty(id, qty - 1)}
                              style={styles.qtyButton}
                            >
                              <Text style={styles.qtyButtonText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{qty}</Text>
                            <TouchableOpacity
                              onPress={() => setBasketQty(id, qty + 1)}
                              style={styles.qtyButton}
                            >
                              <Text style={styles.qtyButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleBasketItem(id)}
                            style={styles.basketItemRemove}
                          >
                            <Text style={styles.basketItemRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>

                        {isExpanded && (
                          <View style={styles.basketItemPrices}>
                            {facts.sortedPrices.length === 0 ? (
                              <Text style={styles.basketEmptyHint}>
                                {i18n.language === 'el'
                                  ? 'Δεν υπάρχουν τιμές.'
                                  : 'No prices available.'}
                              </Text>
                            ) : (
                              facts.sortedPrices.map((sp, i) => {
                                const storeName =
                                  i18n.language === 'el'
                                    ? sp.store.nameGreek
                                    : sp.store.name;
                                const delta =
                                  cheapestPrice !== null
                                    ? sp.price - cheapestPrice
                                    : 0;
                                return (
                                  <View
                                    key={sp.store.id}
                                    style={[
                                      styles.priceRow,
                                      i === 0 && styles.priceRowBest,
                                    ]}
                                  >
                                    <Text style={styles.priceRowStore}>
                                      {i === 0 ? '🏆 ' : ''}
                                      {storeName}
                                    </Text>
                                    <View style={styles.priceRowRight}>
                                      <Text style={styles.priceRowAmount}>
                                        €{(sp.price * qty).toFixed(2)}
                                      </Text>
                                      {delta > 0 && (
                                        <Text style={styles.priceRowDelta}>
                                          +€{delta.toFixed(2)}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Chain comparison */}
                  <Text style={styles.modalSectionTitle}>
                    {t('basketCompare')}
                  </Text>
                  {basketComparison.length === 0 ? (
                    <Text style={styles.basketEmptyHint}>
                      {t('basketNoStores')}
                    </Text>
                  ) : (
                    basketComparison.map((chain, idx) => {
                      const storeName =
                        i18n.language === 'el'
                          ? chain.store.nameGreek
                          : chain.store.name;
                      return (
                        <View
                          key={chain.store.id}
                          style={[
                            styles.chainRow,
                            idx === 0 && styles.chainRowBest,
                          ]}
                        >
                          <View style={styles.chainRowLeft}>
                            <Text style={styles.chainRowName}>
                              {idx === 0 ? '🏆 ' : `${idx + 1}. `}
                              {storeName}
                            </Text>
                            <Text style={styles.chainRowMeta}>
                              {t('basketAvailableOf', {
                                available: chain.itemsAvailable,
                                total: basket.size,
                              })}
                              {chain.itemsMissing > 0
                                ? ` · ${t('basketMissing', {
                                    count: chain.itemsMissing,
                                  })}`
                                : ''}
                            </Text>
                          </View>
                          <Text style={styles.chainRowTotal}>
                            €{chain.total.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })
                  )}

                  <TouchableOpacity
                    onPress={clearBasket}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>
                      {t('basketClear')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Basket modal — pick a category, multi-select products */}
      <CreateBasketModal
        visible={createBasketOpen}
        onClose={() => setCreateBasketOpen(false)}
        onAdd={(ids) => {
          addManyToBasket(ids);
          setCreateBasketOpen(false);
        }}
        language={i18n.language}
        t={t}
      />

      {/* Type-your-list modal — parse pasted shopping list, resolve ambiguous lines */}
      <TypeListModal
        visible={typeListOpen}
        onClose={() => setTypeListOpen(false)}
        onConfirm={(items) => {
          addManyWithQty(items);
          setTypeListOpen(false);
        }}
        language={i18n.language}
        t={t}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  basketButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  basketButtonActive: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  basketButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  priceTrackerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff3e0',
    borderRadius: 16,
    marginRight: 8,
  },
  priceTrackerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65100',
  },
  // Assistant message: rich content (headings, paragraphs, checkbox bullets)
  contentHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
    marginTop: 6,
    marginBottom: 4,
  },
  contentParagraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#37474f',
    marginBottom: 2,
  },
  contentSpacer: {
    height: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingRight: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#90a4ae',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  checkboxDisabled: {
    borderColor: '#cfd8dc',
    backgroundColor: '#f5f5f5',
    borderStyle: 'dashed',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  bulletTextContainer: {
    flex: 1,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#212121',
  },
  bulletTextDisabled: {
    color: '#90a4ae',
  },
  bulletMatchHint: {
    fontSize: 11,
    color: '#558b2f',
    marginTop: 1,
  },
  // Instruction / cooking-step rows: no checkbox, just a subtle bullet dot.
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingLeft: 4,
  },
  instructionBullet: {
    fontSize: 14,
    color: '#90a4ae',
    width: 16,
    marginTop: 1,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#37474f',
  },
  // Per-message product chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    marginLeft: 4,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cfd8dc',
  },
  chipActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  chipText: {
    fontSize: 12,
    color: '#37474f',
  },
  chipTextActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  // Basket modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Use a fixed height so inner `flex: 1` containers (scroll body + sticky
    // footer) have room to flex. With maxHeight the card collapsed to its
    // natural content size, hiding the inputs / footer on Android.
    height: '85%',
    // Don't apply bottom padding here — it would shrink the inner content.
    // The footer adds its own safe-area aware padding.
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  modalClose: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalEmptyTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  modalEmptyHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  basketItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  basketItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  basketItemTapTarget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  basketItemChevron: {
    width: 14,
    fontSize: 12,
    color: '#90a4ae',
    marginTop: 2,
    marginRight: 4,
  },
  basketItemTextCol: {
    flex: 1,
  },
  basketItemName: {
    fontSize: 13,
    color: '#212121',
  },
  basketItemMinPrice: {
    fontSize: 11,
    color: '#558b2f',
    marginTop: 2,
  },
  basketItemPrices: {
    paddingLeft: 18,
    paddingBottom: 12,
    paddingRight: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#fafafa',
  },
  priceRowBest: {
    backgroundColor: '#e8f5e9',
  },
  priceRowStore: {
    fontSize: 13,
    color: '#212121',
    flex: 1,
  },
  priceRowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceRowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
  },
  priceRowDelta: {
    fontSize: 11,
    color: '#ef6c00',
    marginLeft: 6,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eceff1',
    borderRadius: 14,
    paddingHorizontal: 4,
    height: 28,
    marginLeft: 8,
  },
  qtyButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#37474f',
    lineHeight: 18,
  },
  qtyValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
  },
  basketItemRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  basketItemRemoveText: {
    color: '#c62828',
    fontWeight: '700',
  },
  basketEmptyHint: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#fafafa',
  },
  chainRowBest: {
    backgroundColor: '#e8f5e9',
  },
  chainRowLeft: {
    flex: 1,
  },
  chainRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  chainRowMeta: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  chainRowTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e7d32',
  },
  clearButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#ffebee',
  },
  clearButtonText: {
    color: '#c62828',
    fontSize: 14,
    fontWeight: '600',
  },
  // Create Basket button (inside basket modal)
  createBasketButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    marginBottom: 8,
  },
  createBasketButtonText: {
    color: '#1565c0',
    fontWeight: '700',
    fontSize: 14,
  },
  // Create Basket modal internals
  catPillContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    fontSize: 13,
    color: '#37474f',
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#fff',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#212121',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
  },
  pickerRowName: {
    fontSize: 13,
    color: '#212121',
  },
  pickerRowMeta: {
    fontSize: 11,
    color: '#558b2f',
    marginTop: 2,
  },
  createBasketFooter: {
    padding: 12,
    // Extra bottom padding so the CTA button isn't under Android's gesture
    // navigation indicator. iOS home-indicator is similar height.
    paddingBottom: Platform.OS === 'android' ? 24 : 28,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  createBasketCta: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2e7d32',
  },
  createBasketCtaDisabled: {
    backgroundColor: '#bdbdbd',
  },
  createBasketCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Type-your-list
  basketEntryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeListButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff8e1',
    alignItems: 'center',
  },
  typeListButtonText: {
    color: '#e65100',
    fontWeight: '700',
    fontSize: 14,
  },
  typeListInput: {
    minHeight: 200,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  // Per-row item list (Type-your-list phase 1)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#90a4ae',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  itemInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 14,
    color: '#212121',
  },
  itemRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  itemRemoveText: {
    color: '#90a4ae',
    fontSize: 14,
    fontWeight: '600',
  },
  itemAddRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  itemAddRowText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  typeListSummary: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  typeListSummaryGood: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  typeListSummaryLine: {
    color: '#37474f',
    fontSize: 12,
    marginVertical: 1,
  },
  typeListAmbCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  typeListAmbInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 2,
  },
  typeListPickHint: {
    fontSize: 11,
    color: '#9e9d24',
    marginBottom: 6,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 2,
  },
  radioRowActive: {
    backgroundColor: '#e3f2fd',
  },
  radioRowSkipActive: {
    backgroundColor: '#ffebee',
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#90a4ae',
    marginRight: 10,
  },
  radioDotActive: {
    borderColor: '#1976d2',
    backgroundColor: '#1976d2',
  },
  radioDotSkip: {
    borderColor: '#c62828',
    backgroundColor: '#c62828',
  },
  radioName: {
    fontSize: 13,
    color: '#212121',
  },
  radioMeta: {
    fontSize: 11,
    color: '#558b2f',
    marginTop: 1,
  },
  radioSkipText: {
    fontSize: 13,
    color: '#c62828',
    fontWeight: '600',
  },
  typeListMissRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    marginVertical: 2,
  },
  typeListMissText: {
    fontSize: 13,
    color: '#37474f',
  },
  typeListMissHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  manualSearchInput: {
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#ffd180',
  },
  typeListEditButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeListEditButtonText: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
  },
  sampleButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sampleButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4caf50',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
