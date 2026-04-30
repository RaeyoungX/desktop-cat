import { describe, expect, it } from "vitest";
import { alertTargetForCursor, fixedFrameForState, groundAfterDrag, nextState } from "../../../../src/pages/cat/catMotion";

describe("cat motion rules", () => {
  it("uses weighted wander states from walk", () => {
    expect(nextState("walk", 0.01)).toBe("sit");
    expect(nextState("walk", 0.5)).toBe("loaf");
    expect(nextState("walk", 0.66)).toBe("peek");
    expect(nextState("walk", 0.82)).toBe("walk");
  });

  it("chooses one stable sit frame instead of cycling forever", () => {
    expect(fixedFrameForState("sit", 0.1)).toBe(0);
    expect(fixedFrameForState("sit", 0.9)).toBe(1);
    expect(fixedFrameForState("walk", 0.9)).toBeNull();
  });

  it("moves alert target near the cursor and keeps it inside the usable screen", () => {
    expect(alertTargetForCursor(
      { x: 500, y: 700 },
      { screenW: 1440, screenH: 900, originX: 0, originY: 0 },
    )).toEqual({ x: 420, y: 620 });

    expect(alertTargetForCursor(
      { x: 9999, y: 9999 },
      { screenW: 1440, screenH: 900, originX: 0, originY: 0 },
    )).toEqual({ x: 1280, y: 740 });
  });

  it("uses the dragged location as the new walking ground", () => {
    expect(groundAfterDrag(450, 900)).toBe(450);
    expect(groundAfterDrag(9999, 900)).toBe(690);
    expect(groundAfterDrag(-20, 900)).toBe(0);
  });
});
