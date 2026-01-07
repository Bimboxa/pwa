async function detectMainRectangleAsync({ imageData, rotation = 0, margin = 10 }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    let finalResult = { found: false };

    try {
        const src = track(cv.matFromImageData(imageData));
        const imgWidth = src.cols;
        const imgHeight = src.rows;

        // ============================================================
        // A. HELPER D'ANALYSE
        // ============================================================
        const findBestRectInBinary = (binaryMat) => {
            const contours = track(new cv.MatVector());
            const hierarchy = track(new cv.Mat());

            cv.findContours(binaryMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let maxArea = 0;
            let best = null;
            const ANGLE_TOLERANCE = 2.5;

            const isTouchingBorder = (pt) => {
                return pt.x < margin || pt.x > imgWidth - margin || pt.y < margin || pt.y > imgHeight - margin;
            };

            const isAngleValid = (rectAngle) => {
                const getDeviation = (target) => {
                    let diff = Math.abs(rectAngle - target) % 90;
                    if (diff > 45) diff = 90 - diff;
                    return diff;
                };
                return getDeviation(0) < ANGLE_TOLERANCE || getDeviation(rotation) < ANGLE_TOLERANCE;
            };

            for (let i = 0; i < contours.size(); ++i) {
                let cnt = contours.get(i);
                const area = cv.contourArea(cnt);

                if (area < 1000) continue;

                const rotatedRect = cv.minAreaRect(cnt);
                const vertices = getRotatedRectVertices(rotatedRect);

                let touchesBorder = false;
                for (let p of vertices) {
                    if (isTouchingBorder(p)) {
                        touchesBorder = true;
                        break;
                    }
                }
                if (touchesBorder) continue;
                if (!isAngleValid(rotatedRect.angle)) continue;

                if (area > maxArea) {
                    maxArea = area;
                    best = { rect: rotatedRect, points: vertices, area: area };
                }
            }
            return best;
        };

        // ============================================================
        // PREPARATION DES IMAGES BINAIRES DE BASE
        // ============================================================

        // --- 1. Base Otsu ---
        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        const blurred = track(new cv.Mat());
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        const binaryOtsu = track(new cv.Mat());
        cv.threshold(blurred, binaryOtsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

        // --- 2. Base Color Filter ---
        const srcRGB = track(new cv.Mat());
        cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);
        const hsv = track(new cv.Mat());
        cv.cvtColor(srcRGB, hsv, cv.COLOR_RGB2HSV);

        const centerX = Math.floor(imgWidth / 2);
        const centerY = Math.floor(imgHeight / 2);
        const centerPixel = hsv.ucharPtr(centerY, centerX);

        const h = centerPixel[0];
        const s = centerPixel[1];
        const v = centerPixel[2];
        const toleranceH = 10;
        const toleranceSV = 40;

        const lowScalar = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.max(0, h - toleranceH), Math.max(0, s - toleranceSV), Math.max(0, v - toleranceSV), 0]);
        const highScalar = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.min(180, h + toleranceH), Math.min(255, s + toleranceSV), Math.min(255, v + toleranceSV), 255]);

        const binaryColor = track(new cv.Mat());
        cv.inRange(hsv, lowScalar, highScalar, binaryColor);
        lowScalar.delete(); highScalar.delete();


        // ============================================================
        // CASCADE DE DÉTECTION
        // ============================================================

        let winner = null;
        let methodUsed = '';

        // --- ETAPE 1 & 2 : DÉTECTION BRUTE (Otsu vs Color) ---
        const resOtsu = findBestRectInBinary(binaryOtsu);
        const resColor = findBestRectInBinary(binaryColor);

        const areaOtsu = resOtsu ? resOtsu.area : 0;
        const areaColor = resColor ? resColor.area : 0;

        if (areaColor > 0 || areaOtsu > 0) {
            if (areaColor > areaOtsu) {
                winner = resColor;
                methodUsed = 'color_raw';
            } else {
                winner = resOtsu;
                methodUsed = 'otsu_raw';
            }
        }

        // --- ETAPE 3 : SI RIEN -> MORPH 10px (Suppression petits traits) ---
        if (!winner) {
            // MORPH_OPEN = Erosion suivi de Dilation (supprime le bruit blanc sur fond noir)
            const kernel10 = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(10, 10)));
            const morph10 = track(new cv.Mat());

            // On applique sur Otsu qui est généralement plus fiable structurellement
            cv.morphologyEx(binaryOtsu, morph10, cv.MORPH_OPEN, kernel10);

            const resMorph10 = findBestRectInBinary(morph10);
            if (resMorph10) {
                winner = resMorph10;
                methodUsed = 'otsu_morph_10px';
            }
        }

        // --- ETAPE 4 : SI TOUJOURS RIEN -> MORPH 20px (Agressif) ---
        if (!winner) {
            const kernel20 = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(20, 20)));
            const morph20 = track(new cv.Mat());

            cv.morphologyEx(binaryOtsu, morph20, cv.MORPH_OPEN, kernel20);

            const resMorph20 = findBestRectInBinary(morph20);
            if (resMorph20) {
                winner = resMorph20;
                methodUsed = 'otsu_morph_20px';
            }
        }


        // ============================================================
        // FINALISATION
        // ============================================================
        if (winner) {
            const r = winner.rect;
            let width = r.size.width;
            let height = r.size.height;
            let angle = r.angle;

            let diffRot = Math.abs(angle - rotation) % 90;
            if (diffRot > 45) diffRot = 90 - diffRot;

            const ANGLE_TOLERANCE = 2.5;
            const isMatchRotation = diffRot < ANGLE_TOLERANCE;
            const finalAngle = isMatchRotation ? rotation : 0;

            finalResult = {
                found: true,
                center: r.center,
                size: { width, height },
                angle: finalAngle,
                rawAngle: r.angle,
                points: winner.points,
                area: winner.area,
                method: methodUsed
            };
        }

    } catch (err) {
        let errorMessage = err;
        if (typeof err === "number" && cv.exceptionFromPtr) {
            errorMessage = cv.exceptionFromPtr(err).msg;
        } else if (err?.message) {
            errorMessage = err.message;
        }
        console.error("[opencv worker] detectMainRectangleAsync failed", errorMessage);
        throw new Error(errorMessage);
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }

    return finalResult;
}

// HELPER (Inchangé)
function getRotatedRectVertices(rotatedRect) {
    const { center, size, angle } = rotatedRect;
    const { x: cx, y: cy } = center;
    const { width: w, height: h } = size;
    const angleRad = (angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const hw = w / 2;
    const hh = h / 2;
    const corners = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
    return corners.map(p => ({ x: cx + (p.x * cos - p.y * sin), y: cy + (p.x * sin + p.y * cos) }));
}