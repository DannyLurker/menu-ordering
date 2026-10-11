// Unit tests for the clipboard helpers (spec 0008 desk surface). The link
// builder is pure and pinned here; the clipboard write itself needs a
// browser and stays with the verify manual steps.
import { describe, expect, it } from "vitest";
import { guestSetupLink } from "./copy-text";

describe("guestSetupLink", () => {
  it("builds the guest setup URL for the stay", () => {
    expect(guestSetupLink("http://localhost:3000", "stay-1")).toBe(
      "http://localhost:3000/guest/setup?stay=stay-1",
    );
  });

  it("trims a trailing slash and encodes the stay id", () => {
    expect(guestSetupLink("https://hotel.example/", "a b/c")).toBe(
      "https://hotel.example/guest/setup?stay=a%20b%2Fc",
    );
  });
});
