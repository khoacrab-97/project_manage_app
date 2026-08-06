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

function prefixFields(prefix: string, fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[`${prefix}${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`] = value;
  }
  return out;
}
