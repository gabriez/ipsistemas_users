const isSqlite = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.DB_TYPE === "sqlite";

export const timestampColumnType = isSqlite ? "datetime" : "timestamptz";
