// Load utility functions and handlers
self.importScripts("./utils/workerUtils.js");
self.importScripts("./handlers/getPixelsCountByColorAsync.js");
self.importScripts("./handlers/imageProcessing.js");
self.importScripts("./handlers/highlightDifferences.js");
self.importScripts("./handlers/findPattern.js");
self.importScripts("./handlers/getPixelColorAsync.js");
/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = function (e) {
  switch (e.data.msg) {
    case "load": {
      // Import Webassembly script
      self.importScripts("./opencv.js");
      //self.importScripts("./opencv_3_4_custom_O3.js");
      waitForOpencv(function (success) {
        if (success) postMessage({ msg: e.data.msg });
        else throw new Error("Error on loading OpenCV");
      });
      break;
    }
    case "getPixelsCountByColorAsync":
      return handleGetPixelsCountByColorAsync(e.data);

    case "imageProcessing":
      return imageProcessing(e.data);

    case "highlightDifferences":
      return highlightDifferences(e.data);

    case "findPattern":
      return findPattern(e.data);

    case "getPixelColorAsync":
      return getPixelColorAsync(e.data);

    default:
      break;
  }
};
