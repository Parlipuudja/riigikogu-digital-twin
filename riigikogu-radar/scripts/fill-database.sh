#!/bin/bash
# Fill database to 80% capacity with historical data
# Run in background: nohup ./scripts/fill-database.sh > fill-db.log 2>&1 &

cd /home/ubuntu/riigikogu-radar/riigikogu-radar

echo "=== Starting database fill process ==="
echo "Target: 80% capacity (~410 MB)"
date

# Sync remaining voting years
for year in 2020 2019; do
    echo ""
    echo "=== Syncing votings for $year ==="
    npx tsx scripts/sync-api.ts votings --year=$year
done

# Sync stenograms (larger files, lower priority)
for year in 2022 2021 2020 2019; do
    echo ""
    echo "=== Syncing stenograms for $year ==="
    npx tsx scripts/sync-api.ts stenograms --year=$year
done

# Generate embeddings for new data
echo ""
echo "=== Generating embeddings ==="
npx tsx scripts/generate-embeddings.ts

# Final status
echo ""
echo "=== Final database status ==="
npx tsx scripts/db-stats.ts
date
echo "=== Database fill complete ==="
