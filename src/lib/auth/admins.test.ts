import { describe, it, expect, afterEach } from "vitest";
import { getAdminEmails, isAdminEmail } from "./admins";

const ORIGINAL_ENV = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL_ENV;
});

describe("isAdminEmail", () => {
  it("rejects null, undefined and empty", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("matches default admins case-insensitively", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("admin@prime-atlas.io")).toBe(true);
    expect(isAdminEmail("ADMIN@PRIME-ATLAS.IO")).toBe(true);
    expect(isAdminEmail("random@user.com")).toBe(false);
  });

  it("honours the ADMIN_EMAILS env override", () => {
    process.env.ADMIN_EMAILS = "boss@example.com, second@example.com";
    expect(getAdminEmails()).toEqual(["boss@example.com", "second@example.com"]);
    expect(isAdminEmail("boss@example.com")).toBe(true);
    // Defaults no longer apply when the override is set
    expect(isAdminEmail("admin@prime-atlas.io")).toBe(false);
  });
});
