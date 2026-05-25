#!/usr/bin/env bash
#
# Refresh price data and archive the previous day under data/snapshots/.
#
# Flow:
#   1. Read the date of the existing data (enrichedAt from products-enriched.json)
#   2. Copy the existing scraped-data.json + products-enriched.json into
#      data/snapshots/<previous-date>/ as a permanent record
#   3. Re-run the crawler (parallel, 4 workers) — overwrites the live files
#   4. Re-run the cloud enrichment (Ollama Cloud) — overwrites products-enriched.json
#   5. Print a summary
#
# Run with: bash scripts/snapshot.sh
#
# Ollama Cloud credentials are read from scripts/enrich/.env (already gitignored).

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SCRAPED_FILE="scripts/crawler/data/scraped-data.json"
ENRICHED_FILE="src/data/products-enriched.json"
SUPERMARKETS_TS="src/data/superMarkets.ts"

if [ ! -f "$ENRICHED_FILE" ]; then
  echo "❌ $ENRICHED_FILE not found — nothing to archive. Run the crawler/enrich first."
  exit 1
fi

# ---- 1. Archive previous data ----------------------------------------------
PREV_DATE=$(python3 -c "import json; print(json.load(open('$ENRICHED_FILE')).get('enrichedAt','unknown'))")
SNAPSHOT_DIR="data/snapshots/$PREV_DATE"

if [ -d "$SNAPSHOT_DIR" ]; then
  echo "ℹ️  Snapshot for $PREV_DATE already exists at $SNAPSHOT_DIR — overwriting."
fi
mkdir -p "$SNAPSHOT_DIR"

echo "📦 Archiving previous data (dated $PREV_DATE) → $SNAPSHOT_DIR/"
cp "$ENRICHED_FILE" "$SNAPSHOT_DIR/products-enriched.json"
[ -f "$SCRAPED_FILE" ] && cp "$SCRAPED_FILE" "$SNAPSHOT_DIR/scraped-data.json"
[ -f "$SUPERMARKETS_TS" ] && cp "$SUPERMARKETS_TS" "$SNAPSHOT_DIR/superMarkets.ts"

# ---- 2. Wipe resume files so we don't pick up stale partials ---------------
rm -f scripts/crawler/data/progress.jsonl
rm -f scripts/enrich/data/enriched.jsonl

# ---- 3. Re-crawl -----------------------------------------------------------
echo ""
echo "🕷  Crawling fresh prices from e-katanalotis (parallel, 4 workers)…"
echo "    This takes ~2–3 hours."
( cd scripts/crawler && npx tsx src/index.ts --mode basket --concurrency 4 )

# ---- 4. Re-enrich via Ollama Cloud ----------------------------------------
echo ""
echo "🤖 Enriching products via Ollama Cloud (qwen3-coder-next:cloud)…"
echo "    This takes ~30 minutes."

# Load Ollama Cloud env if present.
if [ -f scripts/enrich/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . scripts/enrich/.env
  set +a
fi
( cd scripts/enrich && npm run enrich )

# ---- 5. Summary ------------------------------------------------------------
NEW_DATE=$(python3 -c "import json; print(json.load(open('$ENRICHED_FILE')).get('enrichedAt','unknown'))")
echo ""
echo "✅ Done."
echo "   Previous snapshot:  $SNAPSHOT_DIR (dated $PREV_DATE)"
echo "   Current data:       $ENRICHED_FILE (dated $NEW_DATE)"
echo ""
echo "   Snapshots on disk:"
ls -1 data/snapshots/ 2>/dev/null | sed 's/^/     - /'
