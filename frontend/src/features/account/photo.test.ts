// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The profile photo: file checks, and the server action against a stand-in
 * Supabase client. The action must take the object path from the session,
 * refuse anything that is not a small JPEG, PNG or WebP by its real bytes,
 * and never trust a path, a type or an id sent by the browser.
 */
const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), from: vi.fn() }));
const auth = vi.hoisted(() => ({ updateUser: vi.fn() }));
const session = vi.hoisted(() => ({ configured: true, user: null as null | { id: string; avatarVersion: string | null } }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/server", () => ({
  authConfigured: () => session.configured,
  currentUser: async () => session.user,
  supabaseServer: async () => ({ auth, storage }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { photoAction, type PhotoFormState } from "./actions";
import { AVATAR_MAX_BYTES, avatarObjectPath, avatarUrl, sniffImageType } from "./avatar";

const IDLE: PhotoFormState = { status: "idle" };
const USER = "3f0c2a52-5d0e-4a8e-9a57-0c1d2e3f4a5b";
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

function upload(bytes: number[] | Uint8Array, name = "me.png", type = "image/png", extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("intent", "upload");
  form.set("photo", new File([Uint8Array.from(bytes)], name, { type }));
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return form;
}

beforeEach(() => {
  session.configured = true;
  session.user = { id: USER, avatarVersion: null };
  for (const fn of [storage.upload, storage.remove, storage.from, auth.updateUser, revalidatePath]) fn.mockReset();
  storage.from.mockReturnValue({ upload: storage.upload, remove: storage.remove });
  storage.upload.mockResolvedValue({ data: { path: "x" }, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  auth.updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("photo file checks", () => {
  it("recognises JPEG, PNG and WebP by their first bytes and nothing else", () => {
    expect(sniffImageType(Uint8Array.from(JPEG))).toBe("image/jpeg");
    expect(sniffImageType(Uint8Array.from(PNG))).toBe("image/png");
    expect(sniffImageType(Uint8Array.from(WEBP))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html><script>1</script>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WAVE"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("has one object per customer and an address without the customer's id", () => {
    expect(avatarObjectPath(USER)).toBe(`${USER}/avatar`);
    expect(avatarUrl("1794640000000")).toBe("/account/photo/1794640000000");
    expect(avatarUrl(null)).toBeNull();
  });
});

describe("photo action", () => {
  it("refuses while signed out or not connected, without touching storage", async () => {
    session.user = null;
    expect(await photoAction(IDLE, upload(PNG))).toMatchObject({ status: "error", message: expect.stringContaining("Sign in again") });
    session.configured = false;
    expect(await photoAction(IDLE, upload(PNG))).toMatchObject({ status: "error", message: expect.stringContaining("not connected") });
    expect(storage.from).not.toHaveBeenCalled();
  });

  it("uploads to the signed-in customer's own path, whatever the form claims", async () => {
    const result = await photoAction(IDLE, upload(PNG, "../../someone-else/avatar", "text/html", { path: "other/avatar", userId: "other" }));
    expect(result).toEqual({ status: "saved" });
    expect(storage.from).toHaveBeenCalledWith("avatars");
    expect(storage.upload).toHaveBeenCalledTimes(1);
    const [path, body, options] = storage.upload.mock.calls[0]!;
    expect(path).toBe(`${USER}/avatar`);
    expect([...(body as Uint8Array)]).toEqual(PNG);
    // The stored type is the one read from the bytes, not the one claimed.
    expect(options).toEqual({ contentType: "image/png", upsert: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { avatar_version: expect.stringMatching(/^\d{13}$/) } });
    expect(revalidatePath).toHaveBeenCalledWith("/account", "layout");
  });

  it("refuses a missing file, a file that is not an image and a file over 2 MB", async () => {
    const empty = new FormData();
    empty.set("intent", "upload");
    expect(await photoAction(IDLE, empty)).toEqual({ status: "error", message: "Choose a photo first." });
    expect(await photoAction(IDLE, upload([], "empty.png"))).toEqual({ status: "error", message: "Choose a photo first." });

    const html = [...new TextEncoder().encode("<!doctype html><script>alert(1)</script>")];
    expect(await photoAction(IDLE, upload(html, "photo.png", "image/png"))).toEqual({ status: "error", message: "Use a JPEG, PNG or WebP image." });

    const large = new Uint8Array(AVATAR_MAX_BYTES + 1);
    large.set(PNG);
    expect(await photoAction(IDLE, upload(large))).toEqual({ status: "error", message: "That photo is larger than 2 MB. Choose a smaller one." });

    expect(storage.upload).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("says so when storage refuses, logs the status only and leaves the profile alone", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    storage.upload.mockResolvedValueOnce({ data: null, error: { name: "StorageApiError", message: "Bucket not found", statusCode: "404" } });
    expect(await photoAction(IDLE, upload(JPEG, "family-name.jpg", "image/jpeg"))).toEqual({
      status: "error",
      message: "We could not save your photo. Please try again.",
    });
    expect(log).toHaveBeenCalledWith("account: photo upload refused by storage", { status: "404" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/family-name|Bucket/);
    expect(auth.updateUser).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("removes only the signed-in customer's own photo", async () => {
    session.user = { id: USER, avatarVersion: "1794640000000" };
    const form = new FormData();
    form.set("intent", "remove");
    form.set("path", "other/avatar");
    expect(await photoAction(IDLE, form)).toEqual({ status: "removed" });
    expect(storage.remove).toHaveBeenCalledWith([`${USER}/avatar`]);
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { avatar_version: null } });
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
