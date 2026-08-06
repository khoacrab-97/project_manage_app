import { serializeError, type LogFields } from "./logger-core";

type BodySide = "request" | "response";
type BodySource = Request | Response;
type BodyEncoding = "utf8" | "base64";

export async function captureRawBodyFields(source: BodySource, side: BodySide): Promise<LogFields> {
  try {
    const contentType = source.headers.get("content-type") ?? "";
    const body = new Uint8Array(await source.clone().arrayBuffer());
    const encoding = body.byteLength === 0 ? "utf8" : encodingForBody(contentType);
    return {
      [`${side}ContentType`]: contentType || undefined,
      [`${side}BodyBytes`]: body.byteLength,
      [`${side}BodyEncoding`]: encoding,
      [`${side}BodyRaw`]: encodeBody(body, encoding),
    };
  } catch (error) {
    return {
      [`${side}BodyCaptureFailed`]: true,
      ...prefixFields(`${side}BodyCapture`, serializeError(error)),
    };
  }
}

export function encodeBody(body: Uint8Array, encoding: BodyEncoding): string {
  if (body.byteLength === 0) return "";
  if (encoding === "utf8") return new TextDecoder().decode(body);
  return Buffer.from(body).toString("base64");
}

export function encodingForBody(contentType: string): BodyEncoding {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("text/")) return "utf8";
  if (type === "application/json" || type.endsWith("+json")) return "utf8";
  if (type === "application/xml" || type.endsWith("+xml")) return "utf8";
  if (type === "application/javascript") return "utf8";
  if (type === "application/x-www-form-urlencoded") return "utf8";
  return "base64";
}

export async function captureServerActionRequestFields(args: unknown[]): Promise<LogFields> {
  return captureSerializedFields(args, "request", "application/json; kind=server-action-args");
}

export async function captureServerActionResponseFields(result: unknown): Promise<LogFields> {
  return captureSerializedFields(result, "response", "application/json; kind=server-action-result");
}

async function captureSerializedFields(value: unknown, side: BodySide, contentType: string): Promise<LogFields> {
  try {
    const raw = JSON.stringify(await serializeActionValue(value));
    return {
      [`${side}ContentType`]: contentType,
      [`${side}BodyBytes`]: new TextEncoder().encode(raw).byteLength,
      [`${side}BodyEncoding`]: "utf8",
      [`${side}BodyRaw`]: raw,
    };
  } catch (error) {
    return {
      [`${side}BodyCaptureFailed`]: true,
      ...prefixFields(`${side}BodyCapture`, serializeError(error)),
    };
  }
}

async function serializeActionValue(value: unknown, seen = new WeakSet<object>()): Promise<unknown> {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);

  if (isBlobLike(value)) {
    return {
      type: isFileLike(value) ? "File" : "Blob",
      name: fileName(value),
      contentType: value.type,
      size: value.size,
      bodyEncoding: "base64",
      bodyRaw: encodeBody(new Uint8Array(await value.arrayBuffer()), "base64"),
    };
  }

  if (value instanceof FormData) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, entryValue] of value.entries()) {
      entries.push([key, await serializeActionValue(entryValue, seen)]);
    }
    return { type: "FormData", entries };
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => serializeActionValue(item, seen)));
    }

    const out: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      out[key] = await serializeActionValue(entryValue, seen);
    }
    return out;
  }

  return String(value);
}

function isBlobLike(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isFileLike(value: Blob): boolean {
  return typeof File !== "undefined" && value instanceof File;
}

function fileName(value: Blob): string | undefined {
  const maybeFile = value as Blob & { name?: unknown };
  return typeof maybeFile.name === "string" ? maybeFile.name : undefined;
}

function prefixFields(prefix: string, fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[`${prefix}${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`] = value;
  }
  return out;
}
