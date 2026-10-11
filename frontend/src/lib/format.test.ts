import { km, sci, untilTca } from "./format";

describe("format", () => {
  it("never renders a zero probability as a bare zero", () => {
    expect(sci(0)).toBe("< 1e-300");
    expect(sci(null)).toBe("—");
    expect(sci(3.1e-4, 1)).toBe("3.1e-4");
  });
  it("formats distances and countdowns", () => {
    expect(km(0.21449)).toBe("0.214 km");
    expect(km(undefined)).toBe("—");
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(untilTca("2026-01-01T04:12:08Z", now)).toBe("T−04:12:08");
    expect(untilTca("2025-12-31T23:59:00Z", now)).toBe("T+00:01:00");
  });
});
