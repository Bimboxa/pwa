function imageProcessing({ msg, payload }) {
  const img = cv.matFromImageData(payload);
  let result = new cv.Mat();

  // This converts the image to a greyscale.
  cv.cvtColor(img, result, cv.COLOR_BGR2GRAY);
  postMessage({ msg, payload: imageDataFromMat(result) });
}

