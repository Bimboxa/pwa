async function getSeparationLinesAsync({ imageData, keepBest = false, rotation = 0 }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    let separationLines = [];
    let bestCorner = null; // Le résultat ajouté

    try {
        const src = track(cv.matFromImageData(imageData));

        const imgWidth = src.cols;
        const imgHeight = src.rows;
        const center = { x: imgWidth / 2, y: imgHeight / 2 };

        // 1. PRE-PROCESS
        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const binary = track(new cv.Mat());
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

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
        // 3. EXTRACTION LOGIC
        // ============================================================

        const extractLinesForReferential = (contours, angleRad, suffix = "") => {
            const lines = [];
            const MIN_LENGTH = 40;
            const EDGE_MARGIN = 5;

            const ANGLE_THRESHOLD_DEG = 2.0;
            const ANGLE_THRESHOLD_RAD = ANGLE_THRESHOLD_DEG * Math.PI / 180;

            const correctionAngle = -angleRad;

            for (let i = 0; i < contours.size(); ++i) {
                let cnt = contours.get(i);

                let approx = track(new cv.Mat());
                let epsilon = 0.02 * cv.arcLength(cnt, true);
                cv.approxPolyDP(cnt, approx, epsilon, true);

                for (let j = 0; j < approx.rows; ++j) {
                    let p1Raw = { x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] };
                    let nextIndex = (j + 1) % approx.rows;
                    let p2Raw = { x: approx.data32S[nextIndex * 2], y: approx.data32S[nextIndex * 2 + 1] };

                    let p1 = rotatePoint(p1Raw.x, p1Raw.y, correctionAngle);
                    let p2 = rotatePoint(p2Raw.x, p2Raw.y, correctionAngle);

                    let dx = p2.x - p1.x;
                    let dy = p2.y - p1.y;
                    let length = Math.sqrt(dx * dx + dy * dy);

                    if (length < MIN_LENGTH) continue;

                    let theta = Math.atan2(dy, dx);
                    let devH = Math.min(Math.abs(theta), Math.abs(theta - Math.PI), Math.abs(theta + Math.PI));
                    let devV = Math.min(Math.abs(theta - Math.PI / 2), Math.abs(theta + Math.PI / 2));

                    let isHorizontal = devH < ANGLE_THRESHOLD_RAD;
                    let isVertical = devV < ANGLE_THRESHOLD_RAD;

                    if (isHorizontal) {
                        const avgY = Math.round((p1.y + p2.y) / 2);
                        // Filtre strict : si trop près du bord dans le repère local, on ignore
                        if (avgY <= EDGE_MARGIN || avgY >= imgHeight - EDGE_MARGIN) continue;

                        const snapP1 = { x: p1.x, y: avgY };
                        const snapP2 = { x: p2.x, y: avgY };

                        const finalP1 = rotatePoint(snapP1.x, snapP1.y, angleRad);
                        const finalP2 = rotatePoint(snapP2.x, snapP2.y, angleRad);

                        lines.push({
                            type: `horizontal${suffix}`,
                            length: length,
                            points: [finalP1, finalP2],
                            refAngle: angleRad
                        });

                    } else if (isVertical) {
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

        const standardLines = extractLinesForReferential(contours, 0, "");

        let rotatedLines = [];
        const isOrthogonal = Math.abs(rotation % (Math.PI / 2)) < 0.01;
        if (Math.abs(rotation) > 0.01 && !isOrthogonal) {
            rotatedLines = extractLinesForReferential(contours, rotation, "_with_rotation");
        }

        // 4. SELECTION
        let selectedLines = [];
        if (rotatedLines.length === 0) {
            selectedLines = standardLines;
        } else {
            const scoreStandard = standardLines.reduce((acc, l) => acc + l.length, 0);
            const scoreRotated = rotatedLines.reduce((acc, l) => acc + l.length, 0);
            selectedLines = (scoreRotated > scoreStandard) ? rotatedLines : standardLines;
        }

        // 5. IDENTIFY BEST
        let bestH = null;
        let bestV = null;
        let minDistH = Infinity;
        let minDistV = Infinity;

        selectedLines.forEach(line => {
            line.isBest = false;
            const p1 = line.points[0];
            const p2 = line.points[1];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const dist = Math.sqrt(Math.pow(midX - center.x, 2) + Math.pow(midY - center.y, 2));

            if (line.type.includes("horizontal")) {
                if (dist < minDistH) {
                    minDistH = dist;
                    bestH = line;
                }
            } else if (line.type.includes("vertical")) {
                if (dist < minDistV) {
                    minDistV = dist;
                    bestV = line;
                }
            }
        });

        if (bestH) bestH.isBest = true;
        if (bestV) bestV.isBest = true;

        // ============================================================
        // [NOUVEAU] 5b. CALCULATE BEST CORNER / ENDPOINT
        // ============================================================

        // Helper pour savoir si un point touche le bord de l'image (avec tolérance)
        const isAtEdge = (p) => {
            const m = 10; // Marge de tolérance un peu plus large pour la détection "isAtEdge"
            return p.x < m || p.x > imgWidth - m || p.y < m || p.y > imgHeight - m;
        };

        // Helper distance
        const getDistSq = (p, target) => Math.pow(p.x - target.x, 2) + Math.pow(p.y - target.y, 2);

        if (bestH && bestV) {
            // --- CAS 1: INTERSECTION (Vrai Coin) ---
            const angle = bestH.refAngle;
            const correctionAngle = -angle;

            // On projette dans le repère local pour trouver l'intersection parfaite H/V
            const hP1_loc = rotatePoint(bestH.points[0].x, bestH.points[0].y, correctionAngle);
            const vP1_loc = rotatePoint(bestV.points[0].x, bestV.points[0].y, correctionAngle);

            // Intersection en local : x du Vertical, y de l'Horizontal
            const inter_loc = { x: vP1_loc.x, y: hP1_loc.y };

            // On remet dans le repère global
            const intersection = rotatePoint(inter_loc.x, inter_loc.y, angle);

            bestCorner = {
                point: intersection,
                type: 'intersection',
                direction: bestH.type.includes("rotation") ? 'corner_with_rotation' : 'corner'
            };

        } else if (bestH || bestV) {
            // --- CAS 2: EXTRÉMITÉ LIBRE (Mur qui s'arrête) ---
            const line = bestH || bestV; // La ligne active
            const [p1, p2] = line.points;

            const p1Edge = isAtEdge(p1);
            const p2Edge = isAtEdge(p2);

            let selectedPoint = null;

            if (p1Edge && !p2Edge) {
                selectedPoint = p2;
            } else if (!p1Edge && p2Edge) {
                selectedPoint = p1;
            } else if (!p1Edge && !p2Edge) {
                // Si aucun ne touche le bord (mur flottant), on prend le plus proche du centre
                // ou arbitrairement p1. Ici je prends le plus proche du centre visuel.
                const d1 = getDistSq(p1, center);
                const d2 = getDistSq(p2, center);
                selectedPoint = (d1 < d2) ? p1 : p2;
            }
            // Si (p1Edge && p2Edge), c'est une ligne qui traverse tout, pas de "coin/bout".

            if (selectedPoint) {
                bestCorner = {
                    point: selectedPoint,
                    type: 'endpoint',
                    direction: line.type // 'horizontal' ou 'vertical' (+suffixe)
                };
            }
        }

        // ============================================================
        // 6. FILTERING & MERGING
        // ============================================================

        if (keepBest) {
            let bestLines = selectedLines.filter(l => l.isBest);
            let finalResult = [];
            let merged = false;

            // Logique de fusion visuelle pour la polyline
            if (bestCorner && bestCorner.type === 'intersection') {
                const intersection = bestCorner.point;

                // Calculs de distance pour savoir quels points relier
                const getDist = (p, target) => Math.sqrt(getDistSq(p, target));

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
                        type: bestCorner.direction,
                        points: [outerH, intersection, outerV],
                        isBest: true
                    }];
                    merged = true;
                }
            }

            selectedLines = merged ? finalResult : bestLines;
        }

        separationLines = selectedLines.map(({ refAngle, ...rest }) => rest);

    } catch (err) {
        let errorMessage = err;
        if (typeof err === "number" && cv.exceptionFromPtr) {
            errorMessage = cv.exceptionFromPtr(err).msg;
        } else if (err?.message) {
            errorMessage = err.message;
        }
        console.error("[opencv worker] getSeparationLinesAsync failed", errorMessage);
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
        // On retourne un objet contenant les lignes ET le meilleur coin/bout
        return { separationLines, bestCorner };
    }
}