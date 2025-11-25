class CV {
  /**
   * We will use this method privately to communicate with the worker and
   * return a promise with the result of the event. This way we can call
   * the worker asynchronously.
   */
  _dispatch(event) {
    if (!this.worker) {
      throw new Error("OpenCV worker not loaded");
    }

    const { msg } = event;
    if (!msg) {
      throw new Error("Missing message key");
    }

    this._status[msg] = ["loading"];
    this.worker.postMessage(event);

    return new Promise((res, rej) => {
      const interval = setInterval(() => {
        const status = this._status[msg];
        if (!status) {
          return;
        }

        if (status[0] === "done") res(status[1]);
        if (status[0] === "error") rej(status[1]);

        if (status[0] !== "loading") {
          delete this._status[msg];
          clearInterval(interval);
        }
      }, 50);
    });
  }

  /**
   * First, we will load the worker and capture the onmessage
   * and onerror events to always know the status of the event
   * we have triggered.
   *
   * Then, we are going to call the 'load' event, as we've just
   * implemented it so that the worker can capture it.
   */
  load() {
    if (this.loadedPromise) {
      return this.loadedPromise;
    }

    this._status = {};
    this.worker = new Worker("../../../opencv/cv.worker.js"); // load worker

    this.worker.onmessage = (e) => {
      const data = e?.data || {};
      const msg = data?.msg;
      if (!msg || !this._status[msg]) return;
      this._status[msg] = [
        data?.error ? "error" : "done",
        data?.payload ?? data,
      ];
    };

    this.worker.onerror = (e) => {
      console.error("[opencv worker] error", e);
      Object.keys(this._status).forEach((key) => {
        if (this._status[key]?.[0] === "loading") {
          this._status[key] = ["error", e];
        }
      });
    };

    this.loadedPromise = this._dispatch({ msg: "load" }).then((result) => {
      this.isLoaded = true;
      return result;
    });

    return this.loadedPromise;
  }

  getPixelColorAsync(payload) {
    return this._dispatch({ msg: "getPixelColorAsync", payload });
  }
  getWhiteContoursAsync(payload) {
    return this._dispatch({ msg: "getWhiteContoursAsync", payload });
  }
  removeTextAsync(payload) {
    return this._dispatch({ msg: "removeTextAsync", payload });
  }
  removeColoredContentAsync(payload) {
    return this._dispatch({ msg: "removeColoredContentAsync", payload });
  }
  keepColoredContentAsync(payload) {
    return this._dispatch({ msg: "keepColoredContentAsync", payload });
  }
  calculateOverlayTransformAsync(payload) {
    return this._dispatch({ msg: "calculateOverlayTransformAsync", payload });
  }
  getPixelsCountByColorAsync(payload) {
    return this._dispatch({ msg: "getPixelsCountByColorAsync", payload });
  }
  imageProcessing(payload) {
    return this._dispatch({ msg: "imageProcessing", payload });
  }
  highlightDifferences(payload) {
    console.log("Dispatch highlightDifferences", payload);
    return this._dispatch({ msg: "highlightDifferences", payload });
  }
  findPattern(payload) {
    return this._dispatch({ msg: "findPattern", payload });
  }
  opencvDebugAsync(payload) {
    return this._dispatch({ msg: "opencvDebugAsync", payload });
  }
  fillHatchAsync(payload) {
    return this._dispatch({ msg: "fillHatchAsync", payload });
  }
  removeThinRegionsAsync(payload) {
    return this._dispatch({ msg: "removeThinRegionsAsync", payload });
  }
  detectLinesAsync(payload) {
    return this._dispatch({ msg: "detectLinesAsync", payload });
  }
  detectTextAsync(payload) {
    return this._dispatch({ msg: "detectTextAsync", payload });
  }
  getHorizontalAndVerticalLinesAsync(payload) {
    return this._dispatch({
      msg: "getHorizontalAndVerticalLinesAsync",
      payload,
    });
  }
}

// Export the same instant everywhere
const cv = new CV();

export default cv;
