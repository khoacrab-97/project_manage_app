import { describe, expect, it } from "vitest";
import {
  MAX_LOG_STRING_LENGTH,
  levelForStatus,
  sanitizeLogFields,
  serializeError,
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

  it("keeps raw api body fields untruncated", () => {
    const longValue = "x".repeat(MAX_LOG_STRING_LENGTH + 20);

    expect(sanitizeLogFields({ requestBodyRaw: longValue }).requestBodyRaw).toBe(longValue);
    expect(sanitizeLogFields({ responseBodyRaw: longValue }).responseBodyRaw).toBe(longValue);
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
});
