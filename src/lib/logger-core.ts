export type LogLevelName = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export const MAX_LOG_STRING_LENGTH = 500;

const MAX_LOG_DEPTH = 4;
const MAX_LOG_ARRAY_LENGTH = 25;
const FULL_STRING_KEYS = ["requestbodyraw", "responsebodyraw"];

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "doanhthu",
  "dongia",
  "email",
  "filename",
  "fullname",
  "giatri",
  "hoten",
  "luong",
  "matkhau",
  "password",
  "rawcontent",
  "rawdata",
  "rawexcel",
  "session",
  "sotien",
  "thanhtien",
  "tenfile",
  "token",
  "tthopdong",
];

export function levelForStatus(status: number): LogLevelName {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

export function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: limitString(error.name || "Error"),
      errorMessage: limitString(error.message),
      errorStack: error.stack ? limitString(error.stack) : undefined,
    };
  }

  if (isPlainRecord(error)) {
    const name = typeof error.name === "string" ? error.name : "UnknownError";
    const message = typeof error.message === "string" ? error.message : String(error);
    const stack = typeof error.stack === "string" ? error.stack : undefined;
    return {
      errorName: limitString(name),
      errorMessage: limitString(message),
      errorStack: stack ? limitString(stack) : undefined,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: limitString(String(error)),
  };
}

export function sanitizeLogFields(fields: LogFields): LogFields {
  return sanitizeRecord(fields, 0);
}

function sanitizeRecord(fields: LogFields, depth: number): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isSensitiveKey(key)) continue;

    const sanitized = sanitizeValue(key, value, depth);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return out;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string") return shouldPreserveFullString(key) ? value : limitString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return undefined;

  if (Array.isArray(value)) {
    if (depth >= MAX_LOG_DEPTH) return "[max_depth]";
    return value.slice(0, MAX_LOG_ARRAY_LENGTH).map((item) => sanitizeValue(key, item, depth + 1));
  }

  if (isPlainRecord(value)) {
    if (depth >= MAX_LOG_DEPTH) return "[max_depth]";
    return sanitizeRecord(value, depth + 1);
  }

  return limitString(String(value));
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function shouldPreserveFullString(key: string): boolean {
  return FULL_STRING_KEYS.includes(normalizeKey(key));
}

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isPlainRecord(value: unknown): value is LogFields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function limitString(value: string): string {
  if (value.length <= MAX_LOG_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_LOG_STRING_LENGTH)}...`;
}
