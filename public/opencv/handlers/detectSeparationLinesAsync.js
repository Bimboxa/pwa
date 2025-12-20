async function detectSeparationLinesAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        const { imageUrl, keepBest = false, origin } = payload ?? {};

        if (!imageUrl) {
            throw new Error("imageUrl is required");
        }

        const imageData = await loadImageDataFromUrl(imageUrl);

        const src = track(cv.matFromImageData(imageData));

        // Récupération explicite des dimensions pour le filtrage des bords
        const imgWidth = src.cols;
        const imgHeight = src.rows;
        const centerX = imgWidth / 2;
        const centerY = imgHeight / 2;

        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // 1. Binarisation & Contraste
        const binary = track(new cv.Mat());
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

        // 2. Pré-traitement Morphologique
        const kernelSize = 3;
        const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize)));
        cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);

        // 3. Contours
        const contours = track(new cv.MatVector());
        const hierarchy = track(new cv.Mat());
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let detectedLines = [];

        const MIN_LENGTH = 40;
        const ANGLE_TOLERANCE = 10;

        // --- AMÉLIORATION : Marge pour ignorer les contours du cadre de l'image ---
        const EDGE_MARGIN = 5;

        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let approx = track(new cv.Mat());
            let epsilon = 0.02 * cv.arcLength(cnt, true);
            cv.approxPolyDP(cnt, approx, epsilon, true);

            for (let j = 0; j < approx.rows; ++j) {
                let p1 = { x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] };
                let nextIndex = (j + 1) % approx.rows;
                let p2 = { x: approx.data32S[nextIndex * 2], y: approx.data32S[nextIndex * 2 + 1] };

                let dx = Math.abs(p1.x - p2.x);
                let dy = Math.abs(p1.y - p2.y);
                let length = Math.sqrt(dx * dx + dy * dy);

                if (length < MIN_LENGTH) continue;

                let isHorizontal = dy < ANGLE_TOLERANCE || (dx > dy * 5);
                let isVertical = dx < ANGLE_TOLERANCE || (dy > dx * 5);

                if (isHorizontal) {
                    const avgY = Math.round((p1.y + p2.y) / 2);

                    // --- FILTRE BORDS HORIZONTAUX ---
                    // Si la ligne est collée en haut (0) ou en bas (height), on l'ignore
                    if (avgY <= EDGE_MARGIN || avgY >= imgHeight - EDGE_MARGIN) {
                        continue;
                    }

                    detectedLines.push({
                        type: 'horizontal',
                        length: length,
                        points: [{ x: p1.x, y: avgY }, { x: p2.x, y: avgY }]
                    });
                } else if (isVertical) {
                    const avgX = Math.round((p1.x + p2.x) / 2);

                    // --- FILTRE BORDS VERTICAUX ---
                    // Si la ligne est collée à gauche (0) ou à droite (width), on l'ignore
                    if (avgX <= EDGE_MARGIN || avgX >= imgWidth - EDGE_MARGIN) {
                        continue;
                    }

                    detectedLines.push({
                        type: 'vertical',
                        length: length,
                        points: [{ x: avgX, y: p1.y }, { x: avgX, y: p2.y }]
                    });
                }
            }
            cnt.delete();
        }

        // --- FILTRAGE "keepBest" AMÉLIORÉ ---
        if (keepBest && detectedLines.length > 0) {
            let bestH = null;
            let bestV = null;
            let minDistH = Infinity;
            let minDistV = Infinity;

            detectedLines.forEach(line => {
                const p1 = line.points[0];
                const p2 = line.points[1];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                const dist = Math.sqrt(Math.pow(midX - centerX, 2) + Math.pow(midY - centerY, 2));

                if (line.type === 'horizontal') {
                    if (dist < minDistH) {
                        minDistH = dist;
                        bestH = line;
                    }
                } else if (line.type === 'vertical') {
                    if (dist < minDistV) {
                        minDistV = dist;
                        bestV = line;
                    }
                }
            });

            let finalLines = [];

            if (bestH && bestV) {
                const intersection = { x: bestV.points[0].x, y: bestH.points[0].y };

                const hP1 = bestH.points[0];
                const hP2 = bestH.points[1];
                const distToHP1 = Math.abs(hP1.x - intersection.x);
                const distToHP2 = Math.abs(hP2.x - intersection.x);

                const vP1 = bestV.points[0];
                const vP2 = bestV.points[1];
                const distToVP1 = Math.abs(vP1.y - intersection.y);
                const distToVP2 = Math.abs(vP2.y - intersection.y);

                const CONNECTION_TOLERANCE = 20;
                const closeToH = Math.min(distToHP1, distToHP2) < CONNECTION_TOLERANCE;
                const closeToV = Math.min(distToVP1, distToVP2) < CONNECTION_TOLERANCE;

                if (closeToH && closeToV) {
                    const outerH = (distToHP1 > distToHP2) ? hP1 : hP2;
                    const outerV = (distToVP1 > distToVP2) ? vP1 : vP2;

                    finalLines = [{
                        type: 'corner',
                        points: [outerH, intersection, outerV]
                    }];
                } else {
                    finalLines = [bestH, bestV];
                }
            } else {
                if (bestH) finalLines.push(bestH);
                if (bestV) finalLines.push(bestV);
            }

            detectedLines = finalLines;
        }

        if (origin === "debug") console.log("[detectSeparationLinesAsync] detectedLines", detectedLines);

        postMessage({
            msg,
            payload: {
                polylines: detectedLines,
            }
        });

    } catch (err) {
        let errorMessage = err;
        if (typeof err === "number") {
            try {
                if (cv.exceptionFromPtr) errorMessage = cv.exceptionFromPtr(err).msg;
            } catch (e) {
                errorMessage = `Unknown C++ Exception Pointer: ${err}`;
            }
        } else if (err?.message) {
            errorMessage = err.message;
        }
        console.error("[opencv worker] detectSeparationLinesAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}