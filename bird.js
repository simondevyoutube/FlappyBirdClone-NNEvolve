import {ffnet} from "./ffnet.js";


export const bird = (function() {

  const _BIRD_POS_X = 50;

  class _FlappyBirdObject {
    constructor(scene) {
      this._scene = scene;
      this._sprite = scene.add.sprite(_BIRD_POS_X, 100, 'bird');
      this._spriteTint = scene.add.sprite(_BIRD_POS_X, 100, 'bird-colour');
      this._velocity = 0;
      this._dead = false;
    }

    Destroy() {
      this._sprite.destroy();
    }

    Update(params) {
      if (this._dead) {
        return;
      }

      this._ApplyGravity(params.timeElapsed)
      this._velocity = Math.min(Math.max(
          this._velocity, this._config.max_upwards_velocity), this._config.terminal_velocity);
      this._sprite.y += this._velocity * params.timeElapsed;
      this._spriteTint.y += this._velocity * params.timeElapsed;

      const v = new Phaser.Math.Vector2(
          -1 * this._config.treadmill_speed * params.timeElapsed, 0);
      v.add(new Phaser.Math.Vector2(0, this._velocity));
      v.normalize();

      const rad = Math.atan2(v.y, v.x);
      const deg = (180.0 / Math.PI) * rad;

      this._sprite.angle = deg * 0.75;
      this._spriteTint.angle = deg * 0.75;
    }

    get Dead() {
      return this._dead;
    }

    set Dead(d) {
      this._dead = d;

      this._scene.tweens.add({
          targets: this._sprite,
          props: {
              alpha: { value: 0.0, duration: 500, ease: 'Sine.easeInOut' },
          },
      });
      this._scene.tweens.add({
          targets: this._spriteTint,
          props: {
              alpha: { value: 0.0, duration: 500, ease: 'Sine.easeInOut' },
          },
      });
    }

    set Alpha(a) {
      this._sprite.alpha = a;
      this._spriteTint.alpha = a;
    }

    get Bounds() {
      return this._sprite.getBounds();
    }

    _ApplyGravity(timeElapsed) {
      this._velocity += this._config.gravity * timeElapsed;
    }
  }

  class FlappyBird_Manual extends _FlappyBirdObject {
    constructor(scene) {
      super(scene);

      this._frameInputs = [];
    }

    Update(params) {
      this._HandleInput(params);

      super.Update(params);
    }

    _HandleInput(params) {
      if (!params.keys.up) {
        return;
      }

      this._velocity += _UPWARDS_ACCELERATION;
    }
  }

  class FlappyBird_NeuralNet extends _FlappyBirdObject {
    constructor(config) {
      super(config.scene);

      this._model = new ffnet.FFNeuralNetwork(config.pop_params.shapes);
      this._model.fromArray(config.pop_entity.genotype);
      this._populationEntity = config.pop_entity;
      this._spriteTint.setTint(config.pop_params.tint);
      this._config = config;
    }

    Update(params) {
      function _PipeParams(bird, pipe) {
        const distToPipe = (
            (pipe.X + pipe.Width) - bird.Bounds.left) / bird._config.config_width;
        const distToPipeB = (
            (pipe._sprite1.y - bird.Bounds.bottom) / bird._config.config_height) * 0.5 + 0.5;
        const distToPipeT = (
            (pipe._sprite2.y - bird.Bounds.top) / bird._config.config_height) * 0.5 + 0.5;
        return [distToPipe, distToPipeB, distToPipeT];
      }

      function _Params(bird, pipes) {
        const inputs = pipes.map(p => _PipeParams(bird, p)).flat();

        inputs.push((bird._velocity / bird._config.gravity) * 0.5 + 0.5);

        return inputs;
      }

      const inputs = _Params(this, params.nearestPipes);
      const decision = this._model.predict(inputs);

      if (decision > 0.5) {
        this._velocity += this._config.acceleration;
      }

      super.Update(params);

      if (!this.Dead) {
        this._populationEntity.fitness += params.timeElapsed;
      }
    }
  }

  return {
    FlappyBird_Manual: FlappyBird_Manual,
    FlappyBird_NeuralNet: FlappyBird_NeuralNet
  };
})();