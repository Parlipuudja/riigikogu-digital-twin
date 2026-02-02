import { MongoClient, Db, Collection, Document, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/riigikogu";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Get the MongoDB client instance with connection caching
 */
export async function getClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false, // Allow $vectorSearch aggregation
      deprecationErrors: true,
    },
  });
  await client.connect();

  return client;
}

/**
 * Get the database instance
 */
export async function getDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  const mongoClient = await getClient();
  db = mongoClient.db();

  return db;
}

/**
 * Get a typed collection by name
 */
export async function getCollection<T extends Document>(
  name: string
): Promise<Collection<T>> {
  const database = await getDatabase();
  return database.collection<T>(name);
}

/**
 * Health check for the database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the database connection
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Get database statistics including size information
 */
export async function getDbStats(): Promise<{
  dataSize: number;
  storageSize: number;
  indexSize: number;
  totalSize: number;
  collections: { name: string; count: number; size: number }[];
}> {
  const database = await getDatabase();
  const stats = await database.command({ dbStats: 1 });

  const collectionNames = await database.listCollections().toArray();
  const collections: { name: string; count: number; size: number }[] = [];

  for (const col of collectionNames) {
    try {
      const colStats = await database.command({ collStats: col.name });
      collections.push({
        name: col.name,
        count: colStats.count || 0,
        size: colStats.size || 0,
      });
    } catch {
      collections.push({ name: col.name, count: 0, size: 0 });
    }
  }

  return {
    dataSize: stats.dataSize || 0,
    storageSize: stats.storageSize || 0,
    indexSize: stats.indexSize || 0,
    totalSize: (stats.dataSize || 0) + (stats.indexSize || 0),
    collections: collections.sort((a, b) => b.size - a.size),
  };
}
