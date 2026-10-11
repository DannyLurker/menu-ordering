// Contract tests for the API error shape (spec 0004). Every gate and
// route builds errors through here, so the shape is pinned once.
import { describe, expect, it } from "vitest";
import {
  GENERIC_CREDENTIALS_MESSAGE,
  GENERIC_LOCKED_MESSAGE,
  GENERIC_PIN_MESSAGE,
  apiError,
} from "./api-error";

describe("apiError", () => {
  it("returns the status with a code plus message body", async () => {
    const res = apiError("FORBIDDEN", "Your role cannot use this.", 403);
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: { code: "FORBIDDEN", message: "Your role cannot use this." } });
  });

  it("keeps generic messages free of account detail", () => {
    for (const message of [GENERIC_CREDENTIALS_MESSAGE, GENERIC_LOCKED_MESSAGE, GENERIC_PIN_MESSAGE]) {
      expect(message).not.toMatch(/@/);
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
