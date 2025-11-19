import { Vector2 } from "./Vector2";

export class Sprite {
  constructor({
    resource,
    frameSize = new Vector2(32, 32),
    hFrames = 1,
    vFrames = 1,
    scale = 1,
    position = new Vector2(0, 0),
    animations = null,
  }) {
    this.resource = resource;        // image resource
    this.frameSize = frameSize;      // size of a single frame
    this.hFrames = hFrames;
    this.vFrames = vFrames;
    this.scale = scale;
    this.position = position;
    this.animations = animations;    // Animations object
    this.frame = 0;                  // current frame index
    this.frameMap = new Map();       // maps frame index → sheet coords

    this.buildFrameMap();
  }

  // Build frameMap from sprite sheet layout
  buildFrameMap() {
    let frameCount = 0;
    for (let v = 0; v < this.vFrames; v++) {
      for (let h = 0; h < this.hFrames; h++) {
        this.frameMap.set(
          frameCount,
          new Vector2(this.frameSize.x * h, this.frameSize.y * v)
        );
        frameCount++;
      }
    }
  }

  // Advance animation (must call every update)
  step(delta) {
    if (!this.animations) return;

    this.animations.step(delta);
    this.frame = this.animations.frame;
  }

  // Draw the sprite at x,y (mirrored automatically handled outside)
  drawImage(ctx, x, y) {
    if (!this.resource?.isLoaded) return;

    const frameCoord = this.frameMap.get(this.frame) ?? new Vector2(0, 0);

    ctx.drawImage(
      this.resource.image,
      frameCoord.x,
      frameCoord.y,
      this.frameSize.x,
      this.frameSize.y,
      x,
      y,
      this.frameSize.x * this.scale,
      this.frameSize.y * this.scale
    );
  }

  // Optional: draw mirrored horizontally
  drawMirrored(ctx, x, y) {
    ctx.save();
    ctx.translate(x + this.frameSize.x * this.scale, y);
    ctx.scale(-1, 1);
    this.drawImage(ctx, 0, 0);
    ctx.restore();
  }
}
