import { describe, expect, it } from "vitest";
import { captureRawBodyFields, encodeBody, encodingForBody } from "./raw-body-log";

describe("raw body logging", () => {
  it("chooses readable encoding for text bodies", () => {
    expect(encodingForBody("application/json; charset=utf-8")).toBe("utf8");
    expect(encodingForBody("text/plain")).toBe("utf8");
    expect(encodingForBody("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "base64"
    );
  });

  it("encodes full body bytes without truncation", () => {
    const text = "x".repeat(800);

    expect(encodeBody(new TextEncoder().encode(text), "utf8")).toBe(text);
    expect(encodeBody(new Uint8Array([0, 255]), "base64")).toBe("AP8=");
  });

  it("captures request body from a clone", async () => {
    const request = new Request("http://local.test/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    await expect(captureRawBodyFields(request, "request")).resolves.toMatchObject({
      requestContentType: "application/json",
      requestBodyBytes: 11,
      requestBodyEncoding: "utf8",
      requestBodyRaw: '{"ok":true}',
    });
    await expect(request.text()).resolves.toBe('{"ok":true}');
  });

  it("captures binary response body as base64", async () => {
    const response = new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    await expect(captureRawBodyFields(response, "response")).resolves.toMatchObject({
      responseContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      responseBodyBytes: 3,
      responseBodyEncoding: "base64",
      responseBodyRaw: "AQID",
    });
    await expect(response.arrayBuffer()).resolves.toHaveProperty("byteLength", 3);
  });

  it("marks empty bodies as utf8", async () => {
    await expect(captureRawBodyFields(new Request("http://local.test/api/test"), "request")).resolves.toMatchObject({
      requestBodyBytes: 0,
      requestBodyEncoding: "utf8",
      requestBodyRaw: "",
    });
  });
});
