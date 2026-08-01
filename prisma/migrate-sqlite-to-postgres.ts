/**
 * Import một lần từ SQLite backup sang Postgres.
 *
 * Dùng khi cutover từ Railway Volume SQLite sang Railway Postgres:
 *   OLD_SQLITE_PATH=./backups/pre-postgres-cutover.db \
 *   DATABASE_URL=<postgres-public-url> \
 *   npx tsx prisma/migrate-sqlite-to-postgres.ts
 *
 * Mặc định script chỉ chạy khi Postgres còn trống. Muốn chạy lại để ghi đè:
 *   IMPORT_OVERWRITE=1 ...
 */
import Database from "better-sqlite3";
import "dotenv/config";
import { Client } from "pg";

const SQLITE_PATH = process.env.OLD_SQLITE_PATH ?? "./backups/pre-postgres-cutover.db";
const POSTGRES_URL = process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error("Chua cau hinh DATABASE_URL Postgres.");
  process.exit(1);
}

const TABLES = [
  "Project",
  "User",
  "CostRevenueCode",
  "DoiDA",
  "PeriodLock",
  "Alert",
  "MenuBiAn",
  "NgayLe",
  "ImportBatch",
  "CodeCrosswalk",
  "PlanLine",
  "TransactionStaging",
  "ImportError",
  "Transaction",
  "AuditLog",
  "Session",
  "UserProject",
  "BOQLine",
  "BOQCot",
  "BOQThucHien",
  "BOQGiaTriCot",
  "BillThang",
  "CongNhan",
  "CongTrinhChamCong",
  "PhanCongNgay",
  "ChamCong",
] as const;

const WIPE_ORDER = [...TABLES].reverse();

type TableName = (typeof TABLES)[number];
type Row = Record<string, unknown>;

function q(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

function sourceRows(sqlite: Database.Database, table: TableName): Row[] {
  const order =
    table === "CostRevenueCode"
      ? ' ORDER BY CASE WHEN "maCha" IS NULL THEN 0 ELSE 1 END, "thuTuHienThi"'
      : "";
  return sqlite.prepare(`SELECT * FROM ${q(table)}${order}`).all() as Row[];
}

function sourceColumns(sqlite: Database.Database, table: TableName) {
  return sqlite.prepare(`PRAGMA table_info(${q(table)})`).all() as Array<{ name: string; type: string }>;
}

function normalize(row: Row, columns: Array<{ name: string; type: string }>) {
  return columns.map((c) => {
    const v = row[c.name];
    if (v === null || v === undefined) return null;
    if (c.type.toUpperCase() === "BOOLEAN") return Boolean(v);
    return v;
  });
}

async function targetCount(pg: Client, table: TableName) {
  const res = await pg.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${q(table)}`);
  return Number(res.rows[0].count);
}

async function insertRows(
  pg: Client,
  table: TableName,
  columns: Array<{ name: string; type: string }>,
  rows: Row[]
) {
  if (rows.length === 0) return;
  const names = columns.map((c) => q(c.name)).join(", ");
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders = batch.map((row, rowIndex) => {
      const vals = normalize(row, columns);
      values.push(...vals);
      const base = rowIndex * columns.length;
      return `(${columns.map((_, colIndex) => `$${base + colIndex + 1}`).join(", ")})`;
    });
    await pg.query(`INSERT INTO ${q(table)} (${names}) VALUES ${placeholders.join(", ")}`, values);
  }
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Client({ connectionString: POSTGRES_URL });
  await pg.connect();

  try {
    let totalExisting = 0;
    for (const table of TABLES) {
      totalExisting += await targetCount(pg, table);
    }
    if (totalExisting > 0) {
      if (process.env.IMPORT_OVERWRITE !== "1") {
        throw new Error(
          `Postgres da co ${totalExisting} dong. Dat IMPORT_OVERWRITE=1 neu muon xoa va import lai.`
        );
      }
      for (const table of WIPE_ORDER) {
        await pg.query(`TRUNCATE TABLE ${q(table)} CASCADE`);
      }
    }

    const expected = new Map<TableName, number>();
    const actual = new Map<TableName, number>();

    await pg.query("BEGIN");
    for (const table of TABLES) {
      const columns = sourceColumns(sqlite, table);
      const rows = sourceRows(sqlite, table);
      expected.set(table, rows.length);
      await insertRows(pg, table, columns, rows);
      actual.set(table, await targetCount(pg, table));
      console.log(`${table}: ${rows.length}`);
    }
    await pg.query("COMMIT");

    let mismatch = 0;
    for (const table of TABLES) {
      if (expected.get(table) !== actual.get(table)) {
        mismatch++;
        console.error(`LECH ${table}: SQLite=${expected.get(table)} Postgres=${actual.get(table)}`);
      }
    }
    if (mismatch > 0) {
      throw new Error(`Import xong nhung co ${mismatch} bang lech so dong.`);
    }
  } catch (e) {
    await pg.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
