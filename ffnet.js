export const ffnet = (function() {

  function dot(a, b) {
    let r = 0;
    for (let i = 0; i < a.length; i++) {
      r += a[i] * b[i];
    }
    return r;
  }

  function add(a, b) {
    return a.map((v1, i) => v1 + b[i]);
  }


  return {
    sigmoid: function (z) {
      return z.map(v => 1.0 / (1.0 + Math.exp(-v)));
    },

    relu: function (z) {
      return z.map(v => Math.max(v, 0));
    },

    FFNeuralNetwork: class {
      constructor(shapes) {
        function _InitRandomArray(sz) {
          return [...Array(sz)].map(_ => Math.random() * 2 - 1);
        }

        this._shapes = shapes;
        this._biases = shapes.slice(1).map(x => _InitRandomArray(x.size));
        this._weights = [];
        for (let i = 1; i < shapes.length; i++) {
          this._weights.push(
              [...Array(shapes[i].size)].map(_=>_InitRandomArray(shapes[i-1].size)));
        }
      }

      predict(inputs) {
        let X = inputs;
        for (let i = 0; i < this._weights.length; i++) {
          const layer_weights = this._weights[i];
          const layer_bias = this._biases[i];
          // z = wx + b
          const z = add(layer_weights.map(w => dot(X, w)), layer_bias);
          // a = σ(z)
          const a = this._shapes[i+1].activation(z);
          // The output from the layer becomes the input to the next.
          X = a;
        }
        return X;
      }

      toArray() {
        return [...this._biases.flat()].concat(
            [...this._weights.flat().flat()]);
      }

      fromArray(values) {
        const arr = [...values];
        let i = 0;
        for (let b of this._biases) {
          b.splice(0, b.length, ...arr.splice(0, b.length));
        }
        for (let w of this._weights) {
          for (let w1 of w) {
            w1.splice(0, w1.length, ...arr.splice(0, w1.length));
          }
        }
      }
    }
  };
})();
