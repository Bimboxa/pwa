async function calculateOverlayTransformAsync({ msg, payload }) {
  try {
    const { mainImageUrl, detailImageUrl } = payload;

    if (!mainImageUrl || !detailImageUrl) {
      throw new Error("mainImageUrl and detailImageUrl are required");
    }

    // 1. Load Images
    const mainImageData = await loadImageDataFromUrl(mainImageUrl);
    const detailImageData = await loadImageDataFromUrl(detailImageUrl);

    const matMain = cv.matFromImageData(mainImageData);
    const matDetail = cv.matFromImageData(detailImageData);

    // 2. Convert to Grayscale
    const matMainGray = new cv.Mat();
    const matDetailGray = new cv.Mat();
    cv.cvtColor(matMain, matMainGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(matDetail, matDetailGray, cv.COLOR_RGBA2GRAY);

    // 3. Detect Features (ORB)
    // We use a high number of features to catch small details in the roof
    const orb = new cv.ORB(5000);
    const keypointsMain = new cv.KeyPointVector();
    const keypointsDetail = new cv.KeyPointVector();
    const descriptorsMain = new cv.Mat();
    const descriptorsDetail = new cv.Mat();

    orb.detectAndCompute(
      matMainGray,
      new cv.Mat(),
      keypointsMain,
      descriptorsMain
    );
    orb.detectAndCompute(
      matDetailGray,
      new cv.Mat(),
      keypointsDetail,
      descriptorsDetail
    );

    // Clean up gray mats early
    matMainGray.delete();
    matDetailGray.delete();

    if (descriptorsMain.empty() || descriptorsDetail.empty()) {
      matMain.delete();
      matDetail.delete();
      orb.delete();
      keypointsMain.delete();
      keypointsDetail.delete();
      descriptorsMain.delete();
      descriptorsDetail.delete();
      throw new Error(
        "Could not detect features. Images might be too plain or blurry."
      );
    }

    // 4. Match Features (Brute Force with Hamming distance for ORB)
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    bf.match(descriptorsDetail, descriptorsMain, matches);

    // 5. Find "Consensus" Translation
    // Since we know Scale=1 and Rotation=0, every correct match must represent
    // roughly the same translation vector (dx, dy).

    const deltas = [];
    for (let i = 0; i < matches.size(); i++) {
      const m = matches.get(i);
      const kpDetail = keypointsDetail.get(m.queryIdx);
      const kpMain = keypointsMain.get(m.trainIdx);

      // Calculate vector from Detail to Main
      const dx = kpMain.pt.x - kpDetail.pt.x;
      const dy = kpMain.pt.y - kpDetail.pt.y;
      deltas.push({ dx, dy, distance: m.distance });
    }

    // Sort matches by quality (distance)
    deltas.sort((a, b) => a.distance - b.distance);

    // Take top 30% of matches to remove noise
    const topMatches = deltas.slice(
      0,
      Math.max(10, Math.floor(deltas.length * 0.3))
    );

    if (topMatches.length < 2) {
      // Cleanup
      matMain.delete();
      matDetail.delete();
      orb.delete();
      bf.delete();
      matches.delete();
      keypointsMain.delete();
      keypointsDetail.delete();
      descriptorsMain.delete();
      descriptorsDetail.delete();
      throw new Error(
        "No matching features found. These images likely do not overlap."
      );
    }

    // Filter Outliers using basic Binning/Clustering
    // We group matches that suggest similar translations.
    const tolerance = 5; // Pixels tolerance
    let bestCluster = [];

    for (let i = 0; i < topMatches.length; i++) {
      const pivot = topMatches[i];
      const cluster = [];
      for (let j = 0; j < topMatches.length; j++) {
        const candidate = topMatches[j];
        // Check if candidate dx/dy is close to pivot
        if (
          Math.abs(candidate.dx - pivot.dx) < tolerance &&
          Math.abs(candidate.dy - pivot.dy) < tolerance
        ) {
          cluster.push(candidate);
        }
      }
      if (cluster.length > bestCluster.length) {
        bestCluster = cluster;
      }
    }

    if (bestCluster.length < 3) {
      matMain.delete();
      matDetail.delete();
      orb.delete();
      bf.delete();
      matches.delete();
      keypointsMain.delete();
      keypointsDetail.delete();
      descriptorsMain.delete();
      descriptorsDetail.delete();
      throw new Error(
        "Matches found, but they are inconsistent. (Score too low)"
      );
    }

    // Average the dx/dy of the best cluster
    let sumDx = 0,
      sumDy = 0;
    bestCluster.forEach((m) => {
      sumDx += m.dx;
      sumDy += m.dy;
    });

    const tx = Math.round(sumDx / bestCluster.length);
    const ty = Math.round(sumDy / bestCluster.length);

    // 6. Generate Visual Overlay (Union Canvas)
    const mainW = matMain.cols;
    const mainH = matMain.rows;
    const detailW = matDetail.cols;
    const detailH = matDetail.rows;

    // Calculate bounding box for the Union
    const minX = Math.min(0, tx);
    const minY = Math.min(0, ty);
    const maxX = Math.max(mainW, tx + detailW);
    const maxY = Math.max(mainH, ty + detailH);

    const finalWidth = maxX - minX;
    const finalHeight = maxY - minY;

    const finalMat = new cv.Mat.zeros(finalHeight, finalWidth, cv.CV_8UC4);

    // Offsets to shift negative coordinates to positive
    const offsetX = -minX;
    const offsetY = -minY;

    // Draw Main Image
    const mainRect = new cv.Rect(offsetX, offsetY, mainW, mainH);
    const mainDst = finalMat.roi(mainRect);
    matMain.copyTo(mainDst);
    mainDst.delete();

    // Draw Detail Image
    const detailRect = new cv.Rect(
      offsetX + tx,
      offsetY + ty,
      detailW,
      detailH
    );
    const detailDst = finalMat.roi(detailRect);
    matDetail.copyTo(detailDst);
    detailDst.delete();

    // 7. Export
    let overlayImageBase64 = null;
    try {
      const imgData = new ImageData(
        new Uint8ClampedArray(finalMat.data),
        finalMat.cols,
        finalMat.rows
      );
      const canvas = new OffscreenCanvas(finalWidth, finalHeight);
      const ctx = canvas.getContext("2d");
      ctx.putImageData(imgData, 0, 0);

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const buffer = await blob.arrayBuffer();

      let binary = "";
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + chunkSize)
        );
      }
      overlayImageBase64 = btoa(binary);
    } catch (e) {
      console.error("Generation failed", e);
    }

    // Cleanup
    matMain.delete();
    matDetail.delete();
    orb.delete();
    bf.delete();
    matches.delete();
    keypointsMain.delete();
    keypointsDetail.delete();
    descriptorsMain.delete();
    descriptorsDetail.delete();
    finalMat.delete();

    postMessage({
      msg,
      payload: {
        overlayImageBase64,
        transform: {
          scale: 1,
          rotation: 0,
          translation: { x: tx, y: ty },
          union: { width: finalWidth, height: finalHeight },
        },
        matchCount: bestCluster.length,
      },
    });
  } catch (error) {
    console.error("[opencv worker] failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
