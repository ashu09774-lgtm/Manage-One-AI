import mysql from "mysql2/promise"

declare global {
  var manageOneDbPool: mysql.Pool | undefined
}

export const db =
  globalThis.manageOneDbPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "taskflow_auth",
    waitForConnections: true,
    connectionLimit: 10,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.manageOneDbPool = db
}

