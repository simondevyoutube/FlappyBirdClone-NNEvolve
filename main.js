import {ffnet} from "./ffnet.js";
import {population} from "./population.js"

const _GRAVITY = 900;
const _TERMINAL_VELOCITY = 400;
const _MAX_UPWARDS_VELOCITY = -300;
const _UPWARDS_ACCELERATION = -450;
const _PIPE_SPACING_Y = 100;
const _PIPE_SPACING_X = 200;
const _TREADMILL_SPEED = -125;

const _CONFIG_WIDTH = 960;
const _CONFIG_HEIGHT = 540;
const _GROUND_Y = _CONFIG_HEIGHT;
const _BIRD_POS_X = 50;


class PipePairObject {
  constructor(scene, x) {
    const height = _CONFIG_HEIGHT * (0.25 + 0.5 * Math.random());
    this._sprite1 = scene.add.sprite(x, height + _PIPE_SPACING_Y * 0.5, 'pipe');
    this._sprite1.displayOriginX = 0;
    this._sprite1.displayOriginY = 0;

    this._sprite2 = scene.add.sprite(x, height - _PIPE_SPACING_Y * 0.5, 'pipe');
    this._sprite2.displayOriginX = 0;
    this._sprite2.displayOriginY = 0;
    this._sprite2.displayHeight = -1 * this._sprite2.height;
  }

  Destroy() {
    this._sprite1.destroy();
    this._sprite2.destroy();
  }

  Update(timeElapsed) {
    this._sprite1.x += timeElapsed * _TREADMILL_SPEED;
    this._sprite2.x += timeElapsed * _TREADMILL_SPEED;
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
    const height = _CONFIG_HEIGHT * (0.25 + 0.5 * Math.random());
    this._sprite1.x = x;
    this._sprite1.y = height + _PIPE_SPACING_Y * 0.5;
    this._sprite2.x = x;
    this._sprite2.y = height - _PIPE_SPACING_Y * 0.5;
  }

  get X() {
    return this._sprite1.x;
  }

  get Width() {
    return this._sprite1.width;
  }
}

class FlappyBirdObject {
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
        this._velocity, _MAX_UPWARDS_VELOCITY), _TERMINAL_VELOCITY);
    this._sprite.y += this._velocity * params.timeElapsed;
    this._spriteTint.y += this._velocity * params.timeElapsed;

    const v = new Phaser.Math.Vector2(
        -1 * _TREADMILL_SPEED * params.timeElapsed, 0);
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
    this._velocity += _GRAVITY * timeElapsed;
  }
}

class FlappyBird_Manual extends FlappyBirdObject {
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

class FlappyBird_NeuralNet extends FlappyBirdObject {
  constructor(scene, populationEntity, params) {
    super(scene);

    this._model = new ffnet.FFNeuralNetwork(params.shapes);
    this._model.fromArray(populationEntity.genotype);
    this._populationEntity = populationEntity;
    this._spriteTint.setTint(params.tint);
  }

  Update(params) {
    function _PipeParams(bird, pipe) {
      const distToPipe = (
          (pipe.X + pipe.Width) - bird.Bounds.left) / _CONFIG_WIDTH;
      const distToPipeB = (
          (pipe._sprite1.y - bird.Bounds.bottom) / _CONFIG_HEIGHT) * 0.5 + 0.5;
      const distToPipeT = (
          (pipe._sprite2.y - bird.Bounds.top) / _CONFIG_HEIGHT) * 0.5 + 0.5;
      return [distToPipe, distToPipeB, distToPipeT];
    }

    function _Params(bird, pipes) {
      const inputs = pipes.map(p => _PipeParams(bird, p)).flat();

      inputs.push((bird._velocity / _GRAVITY) * 0.5 + 0.5);

      return inputs;
    }

    const inputs = _Params(this, params.nearestPipes);
    const decision = this._model.predict(inputs);

    if (decision > 0.5) {
      this._velocity += _UPWARDS_ACCELERATION;
    }

    super.Update(params);

    if (!this.Dead) {
      this._populationEntity.fitness += params.timeElapsed;
    }
  }
}

class FlappyBirdGame {
  constructor() {
    this._game = this._CreateGame();
    this._previousFrame = null;
    this._gameOver = true;

    this._statsText1 = null;
    this._statsText2 = null;
    this._gameOverText = null;
    this._pipes = [];
    this._birds = [];

    this._InitPopulations();
  }

  _InitPopulations() {
    const NN_DEF1 = [
        {size: 7},
        {size: 5, activation: ffnet.relu},
        {size: 1, activation: ffnet.sigmoid}
    ];

    const NN_DEF2 = [
        {size: 7},
        {size: 12, activation: ffnet.relu},
        {size: 1, activation: ffnet.sigmoid}
    ];

    const NN_DEF3 = [
        {size: 7},
        {size: 8, activation: ffnet.relu},
        {size: 8, activation: ffnet.relu},
        {size: 1, activation: ffnet.sigmoid}
    ];

    this._populations = [
      this._CreatePopulation(64, NN_DEF1, 0xFF0000),
      this._CreatePopulation(64, NN_DEF2, 0x0000FF),
      this._CreatePopulation(64, NN_DEF3, 0x00FF00),
    ];
  }

  _CreatePopulation(sz, shapes, colour) {
    const t = new ffnet.FFNeuralNetwork(shapes);

    const params = {
      population_size: sz,
      genotype: {
        size: t.toArray().length,
      },
      mutation: {
        magnitude: 0.5,
        odds: 0.1,
        decay: 0,
      },
      breed: {
        selectionCutoff: 0.2,
        immortalityCutoff: 0.05,
        childrenPercentage: 0.5,
      },
      shapes: shapes,
      tint: colour,
    };

    return new population.Population(params);
  }

  _Destroy() {
    for (let b of this._birds) {
      b.Destroy();
    }
    for (let p of this._pipes) {
      p.Destroy();
    }
    this._statsText1.destroy();
    this._statsText2.destroy();
    if (this._gameOverText !== null) {
      this._gameOverText.destroy();
    }
    this._birds = [];
    this._pipes = [];
    this._previousFrame = null;
  }

  _Init() {
    for (let i = 0; i < 5; i+=1) {
      this._pipes.push(
          new PipePairObject(this._scene, 500 + i * _PIPE_SPACING_X));
    }

    this._gameOver = false;
    this._stats = {
      alive: 0,
      score: 0,
    };

    const style = {
      font: "40px Roboto",
      fill: "#FFFFFF",
      align: "right",
      fixedWidth: 210,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000",
        blur: 2,
        fill: true
      }
    };
    this._statsText1 = this._scene.add.text(0, 0, '', style);

    style.align = 'left';
    this._statsText2 = this._scene.add.text(
        this._statsText1.width + 10, 0, '', style);

    this._birds = [];
    for (let curPop of this._populations) {
      curPop.Step();

      this._birds.push(...curPop._population.map(
          p => new FlappyBird_NeuralNet(
              this._scene, p, curPop._params)));
    }
  }

  _CreateGame() {
    const self = this;
    const config = {
        type: Phaser.AUTO,
        scene: {
            preload: function() { self._OnPreload(this); },
            create: function() { self._OnCreate(this); },
            update: function() { self._OnUpdate(this); },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: _CONFIG_WIDTH,
          height: _CONFIG_HEIGHT
        }
    };

    return new Phaser.Game(config);
  }

  _OnPreload(scene) {
    this._scene = scene;
    this._scene.load.image('sky', 'assets/sky.png');
    this._scene.load.image('bird', 'assets/bird.png');
    this._scene.load.image('bird-colour', 'assets/bird-colour.png');
    this._scene.load.image('pipe', 'assets/pipe.png');
  }

  _OnCreate(scene) {
    const s = this._scene.add.image(0, 0, 'sky');
    s.displayOriginX = 0;
    s.displayOriginY = 0;
    s.displayWidth = _CONFIG_WIDTH;
    s.displayHeight = _CONFIG_HEIGHT;

    this._keys = {
      up: this._scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      f: this._scene.input.keyboard.addKey('F'),
      r: this._scene.input.keyboard.addKey('R'),
    }

    this._keys.f.on('down', function () {
      if (this._scene.scale.isFullscreen) {
        this._scene.scale.stopFullscreen();
      } else {
        this._scene.scale.startFullscreen();
      }
    }, this);

    this._keys.r.on('down', function () {
      this._Destroy();
      this._Init();
    }, this);

    this._Init();
  }

  _OnUpdate(scene) {
    if (this._gameOver) {
      this._DrawStats();
      return;
    }

    const currentFrame = scene.time.now;
    if (this._previousFrame == null) {
      this._previousFrame = currentFrame;
    }

    const timeElapsedInS = Math.min(
        (currentFrame - this._previousFrame) / 1000.0, 1.0 / 30.0);

    this._UpdateBirds(timeElapsedInS);
    this._UpdatePipes(timeElapsedInS);
    this._CheckGameOver();
    this._DrawStats();

    this._previousFrame = currentFrame;
  }

  _CheckGameOver() {
    const results = this._birds.map(b => this._IsBirdOutOfBounds(b));

    this._stats.alive = results.reduce((t, r) => (r ? t: t + 1), 0);

    if (results.every(b => b)) {
      this._GameOver();
    }
  }

  _IsBirdOutOfBounds(bird) {
    const birdAABB = bird.Bounds;
    birdAABB.top += 10;
    birdAABB.bottom -= 10;
    birdAABB.left += 10;
    birdAABB.right -= 10;

    if (bird.Dead) {
      return true;
    }

    if (birdAABB.bottom >= _GROUND_Y || birdAABB.top <= 0) {
      bird.Dead = true;
      return true;
    }

    for (const p of this._pipes) {
      if (p.Intersects(birdAABB)) {
        bird.Dead = true;
        return true;
      }
    }
    return false;
  }

  _GetNearestPipes() {
    let index = 0;
    if (this._pipes[0].X + this._pipes[0].Width <= _BIRD_POS_X) {
      index = 1;
    }
    return this._pipes.slice(index, 2);
  }

  _UpdateBirds(timeElapsed) {
    const params = {
        timeElapsed: timeElapsed,
        keys: {up: Phaser.Input.Keyboard.JustDown(this._keys.up)},
        nearestPipes: this._GetNearestPipes(),
    };

    for (let b of this._birds) {
      b.Update(params);
    }
  }

  _UpdatePipes(timeElapsed) {
    const oldPipeX = this._pipes[0].X + this._pipes[0].Width;

    for (const p of this._pipes) {
      p.Update(timeElapsed);
    }

    const newPipeX = this._pipes[0].X + this._pipes[0].Width;

    if (oldPipeX > _BIRD_POS_X && newPipeX <= _BIRD_POS_X) {
      this._stats.score += 1;
    }

    if ((this._pipes[0].X + this._pipes[0].Width) <= 0) {
      const p = this._pipes.shift();
      p.Reset(this._pipes[this._pipes.length - 1].X + _PIPE_SPACING_X);
      this._pipes.push(p);
    }
  }

  _GameOver() {
    const text = "GAME OVER";
    const style = {
      font: "100px Roboto",
      fill: "#FFFFFF",
      align: "center",
      fixedWidth: _CONFIG_WIDTH,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000",
        blur: 2,
        fill: true
      }
    };

    this._gameOverText = this._scene.add.text(
        0, _CONFIG_HEIGHT * 0.25, text, style);
    this._gameOver = true;

    setTimeout(() => {
      this._Destroy();
      this._Init();
    }, 2000);
  }

  _DrawStats() {
    function _Line(t, s) {
      return t + ': ' + s + '\n';
    }

    const text1 = 'Generation:\n' + 'Score:\n' + 'Alive:\n';
    this._statsText1.text = text1;

    const text2 = (
        this._populations[0]._generations + '\n' +
        this._stats.score + '\n' +
        this._stats.alive + '\n');
    this._statsText2.text = text2;
  }
}

const _GAME = new FlappyBirdGame();
