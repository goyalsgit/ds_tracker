export type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

export function getDbClient(): DbClient {
  throw new Error(
    "Database client not configured. Set DATABASE_URL and add a real client implementation."
  );
}
