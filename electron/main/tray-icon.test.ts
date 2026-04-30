import { describe, expect, it } from "vitest";
import { getTrayIconSize } from "./tray-icon";

describe("tray icon sizing", () => {
  it("uses a compact menu bar size on macOS", () => {
    expect(getTrayIconSize("darwin")).toBe(18);
  });

  it("uses the normal tray size on Windows and Linux", () => {
    expect(getTrayIconSize("win32")).toBe(24);
    expect(getTrayIconSize("linux")).toBe(24);
  });
});
