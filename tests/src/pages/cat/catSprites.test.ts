import { describe, expect, it } from "vitest";
import { CAT_SPRITE_CONFIGS } from "../../../../src/pages/cat/catSprites";

describe("cat sprite configuration", () => {
  it("renders sit.png as a two-frame spritesheet", () => {
    expect(CAT_SPRITE_CONFIGS.sit).toMatchObject({
      src: "/assets/sit.png",
      frames: 2,
    });
  });
});
