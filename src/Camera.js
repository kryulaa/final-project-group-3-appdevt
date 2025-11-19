import { Vector2 } from "./Vector2.js";

export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.position = new Vector2(0, 0);
  }

  follow(target) {
    this.position.x = target.x - this.canvasWidth / 2 + target.w / 2;
    this.position.y = target.y - this.canvasHeight / 2 + target.h / 2;
  }
}
