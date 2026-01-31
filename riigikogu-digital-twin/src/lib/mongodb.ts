import { MongoClient, Db, Collection, Document, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/riigikogu';

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
