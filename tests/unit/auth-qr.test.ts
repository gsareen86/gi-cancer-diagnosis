import { describe, expect, it } from "vitest";
import { authQrDataUrl } from "../../src/lib/auth-qr";
describe("Authenticator image rendering", () => {
  it("encodes SVG whitespace and colour fragments without losing the image", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" /></svg>\n';
    const url = authQrDataUrl(`data:image/svg+xml;utf-8,${svg}`);
    expect(url).not.toMatch(/[\s#]/);
    expect(decodeURIComponent(url.split(",")[1])).toBe(svg);
  });
  it("refuses remote image URLs rather than sending an authenticator image request elsewhere", () => {
    expect(() => authQrDataUrl("https://example.invalid/qr")).toThrow(
      "Authenticator image unavailable",
    );
  });
});
