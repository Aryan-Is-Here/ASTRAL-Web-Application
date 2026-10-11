import { render, screen } from "@testing-library/react";
import { PcBadge } from "./ui";

describe("PcBadge", () => {
  it("shows no risk band when Pc was not computed, whatever the geometry", () => {
    render(<PcBadge status="INSUFFICIENT_DATA_FOR_PC" value={null} />);
    const b = screen.getByText(/insufficient data/i);
    expect(b.className).not.toMatch(/alert|warn/);
  });
  it("labels computed bands with text, not colour alone", () => {
    render(<PcBadge status="COMPUTED" value={3e-4} />);
    expect(screen.getByText("Pc ≥ 1e-4")).toHaveClass("alert");
  });
});
