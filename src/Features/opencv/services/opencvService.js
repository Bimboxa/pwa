class CV {
  constructor() {
    this._requestId = 0;
    this._status = {};
    this.worker = null;
    this.loadedPromise = null;
    this.isLoaded = false;
  }

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

    // Create a unique ID for this request to allow parallel calls
    const requestId = `${msg}_${this._requestId++}`;

    this._status[requestId] = ["loading"];

    // We send 'cmd' as the target handler and 'msg' as the unique tracker
    this.worker.postMessage({
      ...event,
      msg: requestId,
      cmd: msg
    });

    return new Promise((res, rej) => {
      let checkCount = 0;
      const interval = setInterval(() => {
        const status = this._status[requestId];
        if (!status) {
          // Safety: should not happen unless someone deleted it
          clearInterval(interval);
          rej(new Error(`Request status lost for ${requestId}`));
          return;
        }

        if (status[0] === "done") res(status[1]);
        if (status[0] === "error") rej(status[1]);

        if (status[0] !== "loading") {
          delete this._status[requestId];
          clearInterval(interval);
        } else {
          checkCount++;
          // Safety timeout: 10 seconds
          if (checkCount > 200) {
            delete this._status[requestId];
            clearInterval(interval);
            rej(new Error(`OpenCV Request Timeout for ${requestId}`));
          }
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

    const baseUrl =
      (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
    const normalizedBaseUrl = baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`;
    const workerUrl = new URL(
      `${normalizedBaseUrl}opencv/cv.worker.js`,
      typeof window !== "undefined" ? window.location.origin : ""
    );

    this._status = {};

    try {
      this.worker = new Worker(workerUrl, { name: "opencv-worker" });
    } catch (error) {
      console.error("[opencv worker] failed to init", error);
      this._resetWorkerState();
      return Promise.reject(error);
    }

    this.worker.onmessage = (e) => {
      const data = e?.data || {};
      const msgId = data?.msg;
      if (!msgId || !this._status[msgId]) return;
      this._status[msgId] = [
        data?.error ? "error" : "done",
        data?.payload ?? data,
      ];
    };

    this.worker.onerror = (e) => {
      console.error(
        "[opencv worker] error",
        e?.message ?? e,
        e?.filename,
        e?.lineno,
        e?.colno
      );
      Object.keys(this._status).forEach((key) => {
        if (this._status[key]?.[0] === "loading") {
          this._status[key] = ["error", e];
        }
      });
      this._resetWorkerState();
    };

    this.loadedPromise = this._dispatch({ msg: "load" })
      .then((result) => {
        this.isLoaded = true;
        return result;
      })
      .catch((error) => {
        this._resetWorkerState();
        throw error;
      });

    return this.loadedPromise;
  }

  _resetWorkerState() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (err) {
        console.warn("[opencv worker] terminate failed", err);
      }
    }
    this.worker = null;
    this.loadedPromise = null;
    this.isLoaded = false;
    this._status = {};
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
  detectContoursAsync(payload) {
    return this._dispatch({
      msg: "detectContoursAsync",
      payload,
    });
  }
  detectSeparationLinesAsync(payload) {
    return this._dispatch({
      msg: "detectSeparationLinesAsync",
      payload,
    });
  }
  detectShapesAsync(payload) {
    return this._dispatch({
      msg: "detectShapesAsync",
      payload,
    });
  }
  extractPolygonsFromMaskAsync(payload) {
    return this._dispatch({
      msg: "extractPolygonsFromMaskAsync",
      payload,
    });
  }
  detectStraightLineAsync(payload) {
    return this._dispatch({
      msg: "detectStraightLineAsync",
      payload,
    });
  }
}

// Export the same instant everywhere
const cv = new CV();

export default cv;
