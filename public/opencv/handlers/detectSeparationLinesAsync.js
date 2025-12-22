async function detectSeparationLinesAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        const { imageUrl, keepBest = false, origin, rotation = 0 } = payload ?? {};

        if (!imageUrl) {
            throw new Error("imageUrl is required");
        }

        const imageData = await loadImageDataFromUrl(imageUrl);
        const src = track(cv.matFromImageData(imageData));

        const imgWidth = src.cols;
        const imgHeight = src.rows;
        const center = { x: imgWidth / 2, y: imgHeight / 2 };

        // 1. PRE-PROCESS
        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const binary = track(new cv.Mat());
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

        const kernelSize = 3;
        const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize)));
        cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);

        const contours = track(new cv.MatVector());
        const hierarchy = track(new cv.Mat());
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);


        // ============================================================
        // 2. HELPER: ROTATION AROUND CENTER
        // ============================================================
        const rotatePoint = (x, y, angleRad) => {
            if (Math.abs(angleRad) < 1e-6) return { x, y };
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            const dx = x - center.x;
            const dy = y - center.y;

            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;

            return {
                x: rx + center.x,
                y: ry + center.y
            };
        };

        // ============================================================
        // 3. EXTRACTION LOGIC (STRICT ANGLE FILTER)
        // ============================================================

        const extractLinesForReferential = (contours, angleRad, suffix = "") => {
            const lines = [];
            const MIN_LENGTH = 40;
            const EDGE_MARGIN = 5;

            // STRICT THRESHOLD: 2 degrees tolerance.
            // This ensures that a wall at 1.5deg is NOT detected in the 0deg frame,
            // but IS detected in the 1.5deg frame (where it becomes 0deg).
            const ANGLE_THRESHOLD_DEG = 2.0;
            const ANGLE_THRESHOLD_RAD = ANGLE_THRESHOLD_DEG * Math.PI / 180;

            const correctionAngle = -angleRad;

            for (let i = 0; i < contours.size(); ++i) {
                let cnt = contours.get(i);

                let approx = track(new cv.Mat());
                let epsilon = 0.02 * cv.arcLength(cnt, true);
                cv.approxPolyDP(cnt, approx, epsilon, true);

                for (let j = 0; j < approx.rows; ++j) {
                    // Raw points
                    let p1Raw = { x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] };
                    let nextIndex = (j + 1) % approx.rows;
                    let p2Raw = { x: approx.data32S[nextIndex * 2], y: approx.data32S[nextIndex * 2 + 1] };

                    // 1. Straighten the points to the Local Referential
                    let p1 = rotatePoint(p1Raw.x, p1Raw.y, correctionAngle);
                    let p2 = rotatePoint(p2Raw.x, p2Raw.y, correctionAngle);

                    let dx = p2.x - p1.x;
                    let dy = p2.y - p1.y;
                    let length = Math.sqrt(dx * dx + dy * dy);

                    if (length < MIN_LENGTH) continue;

                    // 2. Calculate Strict Angle
                    // Math.atan2 returns angle in [-PI, PI]
                    let theta = Math.atan2(dy, dx);

                    // Normalize deviations from Horizontal (0 or PI) and Vertical (PI/2 or -PI/2)
                    let devH = Math.min(Math.abs(theta), Math.abs(theta - Math.PI), Math.abs(theta + Math.PI));
                    let devV = Math.min(Math.abs(theta - Math.PI / 2), Math.abs(theta + Math.PI / 2));

                    let isHorizontal = devH < ANGLE_THRESHOLD_RAD;
                    let isVertical = devV < ANGLE_THRESHOLD_RAD;

                    if (isHorizontal) {
                        // 3. "Return Average Line": Snap Y to the average of p1.y and p2.y
                        const avgY = Math.round((p1.y + p2.y) / 2);

                        // Check bounds (on straightened frame)
                        if (avgY <= EDGE_MARGIN || avgY >= imgHeight - EDGE_MARGIN) continue;

                        const snapP1 = { x: p1.x, y: avgY };
                        const snapP2 = { x: p2.x, y: avgY };

                        // Transform back to Original Frame
                        const finalP1 = rotatePoint(snapP1.x, snapP1.y, angleRad);
                        const finalP2 = rotatePoint(snapP2.x, snapP2.y, angleRad);

                        lines.push({
                            type: `horizontal${suffix}`,
                            length: length,
                            points: [finalP1, finalP2],
                            refAngle: angleRad
                        });

                    } else if (isVertical) {
                        // 3. "Return Average Line": Snap X to the average
                        const avgX = Math.round((p1.x + p2.x) / 2);

                        if (avgX <= EDGE_MARGIN || avgX >= imgWidth - EDGE_MARGIN) continue;

                        const snapP1 = { x: avgX, y: p1.y };
                        const snapP2 = { x: avgX, y: p2.y };

                        const finalP1 = rotatePoint(snapP1.x, snapP1.y, angleRad);
                        const finalP2 = rotatePoint(snapP2.x, snapP2.y, angleRad);

                        lines.push({
                            type: `vertical${suffix}`,
                            length: length,
                            points: [finalP1, finalP2],
                            refAngle: angleRad
                        });
                    }
                }
                cnt.delete();
            }
            return lines;
        };

        // --- Execute Detection ---

        // 1. Standard Reference (0 rad)
        const standardLines = extractLinesForReferential(contours, 0, "");

        // 2. Rotated Reference (Input rad)
        let rotatedLines = [];
        const isOrthogonal = Math.abs(rotation % (Math.PI / 2)) < 0.01;
        if (Math.abs(rotation) > 0.01 && !isOrthogonal) {
            rotatedLines = extractLinesForReferential(contours, rotation, "_with_rotation");
        }

        // ============================================================
        // 4. SELECTION: WINNER TAKES ALL
        // ============================================================

        let selectedLines = [];

        if (rotatedLines.length === 0) {
            selectedLines = standardLines;
        } else {
            const scoreStandard = standardLines.reduce((acc, l) => acc + l.length, 0);
            const scoreRotated = rotatedLines.reduce((acc, l) => acc + l.length, 0);

            if (origin === "debug") console.log(`[Scores] Standard: ${scoreStandard}, Rotated: ${scoreRotated}`);

            // With strict thresholding, if the image is rotated, scoreStandard should be close to 0
            // and scoreRotated should be high.
            selectedLines = (scoreRotated > scoreStandard) ? rotatedLines : standardLines;
        }

        // ============================================================
        // 5. POST-PROCESS: FILTER BEST & FUSE
        // ============================================================

        if (keepBest && selectedLines.length > 0) {
            let bestH = null;
            let bestV = null;
            let minDistH = Infinity;
            let minDistV = Infinity;

            const isRotatedResult = selectedLines[0].type.includes("_with_rotation");
            const hType = isRotatedResult ? "horizontal_with_rotation" : "horizontal";
            const vType = isRotatedResult ? "vertical_with_rotation" : "vertical";

            selectedLines.forEach(line => {
                const p1 = line.points[0];
                const p2 = line.points[1];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const dist = Math.sqrt(Math.pow(midX - center.x, 2) + Math.pow(midY - center.y, 2));

                if (line.type === hType) {
                    if (dist < minDistH) {
                        minDistH = dist;
                        bestH = line;
                    }
                } else if (line.type === vType) {
                    if (dist < minDistV) {
                        minDistV = dist;
                        bestV = line;
                    }
                }
            });

            let finalResult = [];
            let merged = false;

            if (bestH && bestV) {
                const angle = bestH.refAngle;
                const correctionAngle = -angle;

                const hP1_loc = rotatePoint(bestH.points[0].x, bestH.points[0].y, correctionAngle);
                const vP1_loc = rotatePoint(bestV.points[0].x, bestV.points[0].y, correctionAngle);

                const inter_loc = { x: vP1_loc.x, y: hP1_loc.y };
                const intersection = rotatePoint(inter_loc.x, inter_loc.y, angle);

                const getDist = (p, target) => Math.sqrt(Math.pow(p.x - target.x, 2) + Math.pow(p.y - target.y, 2));

                const distH1 = getDist(bestH.points[0], intersection);
                const distH2 = getDist(bestH.points[1], intersection);
                const distV1 = getDist(bestV.points[0], intersection);
                const distV2 = getDist(bestV.points[1], intersection);

                const CONNECTION_TOLERANCE = 20;
                const closeToH = Math.min(distH1, distH2) < CONNECTION_TOLERANCE;
                const closeToV = Math.min(distV1, distV2) < CONNECTION_TOLERANCE;

                if (closeToH && closeToV) {
                    const outerH = (distH1 > distH2) ? bestH.points[0] : bestH.points[1];
                    const outerV = (distV1 > distV2) ? bestV.points[0] : bestV.points[1];

                    finalResult = [{
                        type: isRotatedResult ? 'corner_with_rotation' : 'corner',
                        points: [outerH, intersection, outerV]
                    }];
                    merged = true;
                }
            }

            if (!merged) {
                if (bestH) finalResult.push(bestH);
                if (bestV) finalResult.push(bestV);
            }

            selectedLines = finalResult;
        }

        const cleanLines = selectedLines.map(({ refAngle, ...rest }) => rest);

        postMessage({
            msg,
            payload: {
                polylines: cleanLines,
            }
        });

    } catch (err) {
        let errorMessage = err;
        if (typeof err === "number" && cv.exceptionFromPtr) {
            errorMessage = cv.exceptionFromPtr(err).msg;
        } else if (err?.message) {
            errorMessage = err.message;
        }
        console.error("[opencv worker] detectSeparationLinesAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}