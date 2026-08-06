import { describe, expect, it } from "vitest";
import {
  MAX_LOG_STRING_LENGTH,
  levelForStatus,
  sanitizeLogFields,
  serializeError,
  shouldLogProxyRequest,
} from "./logger-core";

describe("logger core", () => {
  it("maps http status to log levels", () => {
    expect(levelForStatus(200)).toBe("info");
    expect(levelForStatus(399)).toBe("info");
    expect(levelForStatus(400)).toBe("warn");
    expect(levelForStatus(499)).toBe("warn");
    expect(levelForStatus(500)).toBe("error");
  });

  it("drops sensitive keys recursively", () => {
    expect(
      sanitizeLogFields({
        event: "test_event",
        password: "secret",
        sessionToken: "secret",
        email: "user@example.com",
        profile: { hoTen: "Nguyen Van A", projectCode: "CT01" },
        projectCode: "CT01",
      })
    ).toEqual({
      event: "test_event",
      profile: { projectCode: "CT01" },
      projectCode: "CT01",
    });
  });

  it("limits long strings", () => {
    const longValue = "x".repeat(MAX_LOG_STRING_LENGTH + 20);

    expect(sanitizeLogFields({ message: longValue }).message).toBe(
      `${"x".repeat(MAX_LOG_STRING_LENGTH)}...`
    );
  });

  it("serializes errors", () => {
    const error = new Error("broken");
    error.stack = "stack details";

    expect(serializeError(error)).toEqual({
      errorName: "Error",
      errorMessage: "broken",
      errorStack: "stack details",
    });
  });

  it("logs page traffic from proxy", () => {
    expect(
      shouldLogProxyRequest({
        method: "GET",
        pathname: "/cong-trinh",
        headers: new Headers(),
      })
    ).toBe(true);
    expect(
      shouldLogProxyRequest({
        method: "POST",
        pathname: "/cong-trinh/HL-00105",
        headers: new Headers(),
      })
    ).toBe(true);
  });

  it("skips api, static, prefetch, and non-page methods in proxy", () => {
    expect(
      shouldLogProxyRequest({
        method: "GET",
        pathname: "/api/mau-boq",
        headers: new Headers(),
      })
    ).toBe(false);
    expect(
      shouldLogProxyRequest({
        method: "GET",
        pathname: "/_next/static/chunks/app.js",
        headers: new Headers(),
      })
    ).toBe(false);
    expect(
      shouldLogProxyRequest({
        method: "GET",
        pathname: "/cong-trinh",
        headers: new Headers({ "next-router-prefetch": "1" }),
      })
    ).toBe(false);
    expect(
      shouldLogProxyRequest({
        method: "HEAD",
        pathname: "/cong-trinh",
        headers: new Headers(),
      })
    ).toBe(false);
  });
});
