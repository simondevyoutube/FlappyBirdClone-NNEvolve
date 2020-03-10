export const pipe = (function() {


  class _PipePairObject {
    constructor(config) {
      this._config = config;
      const height = config.config_height * (0.25 + 0.5 * Math.random());
      this._sprite1 = config.scene.add.sprite(config.x, height + config.spacing * 0.5, 'pipe');
      this._sprite1.displayOriginX = 0;
      this._sprite1.displayOriginY = 0;
  
      this._sprite2 = config.scene.add.sprite(config.x, height - config.spacing * 0.5, 'pipe');
      this._sprite2.displayOriginX = 0;
      this._sprite2.displayOriginY = 0;
      this._sprite2.displayHeight = -1 * this._sprite2.height;
    }
  
    Destroy() {
      this._sprite1.destroy();
      this._sprite2.destroy();
    }
  
    Update(timeElapsed) {
      this._sprite1.x += timeElapsed * this._config.speed;
      this._sprite2.x += timeElapsed * this._config.speed;
    }
  
    Intersects(aabb) {
      const b1 = this._sprite1.getBounds();
      const b2 = this._sprite2.getBounds();
      b2.y -= this._sprite2.height;
      return (
          Phaser.Geom.Intersects.RectangleToRectangle(b1, aabb) ||
          Phaser.Geom.Intersects.RectangleToRectangle(b2, aabb));
    }
  
    Reset(x) {
      const height = this._config.config_height * (0.25 + 0.5 * Math.random());
      this._sprite1.x = x;
      this._sprite1.y = height + this._config.spacing * 0.5;
      this._sprite2.x = x;
      this._sprite2.y = height - this._config.spacing * 0.5;
    }
  
    get X() {
      return this._sprite1.x;
    }
  
    get Width() {
      return this._sprite1.width;
    }
  }

  return {
    PipePairObject: _PipePairObject
  };
})();