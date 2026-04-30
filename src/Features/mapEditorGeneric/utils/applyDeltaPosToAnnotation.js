/**
 * Apply a delta position to an annotation, returning a new annotation object
 * with transformed geometry. Pure function, no React dependencies.
 *
 * Handles all annotation types: MARKER, POINT, LABEL, POLYLINE, POLYGON, STRIP, IMAGE, RECTANGLE
 * Handles partTypes: MOVE (default), TARGET, LABEL_BOX, ROTATE, RESIZE_*
 *
 * @param {Object} annotation - The annotation to transform
 * @param {Object} deltaPos - { x, y } delta to apply
 * @param {string|null} partType - e.g. "TARGET", "LABEL_BOX", "RESIZE_SE", "ROTATE", or null for move
 * @param {Object} [wrapperBbox] - Optional bbox for wrapper resize/rotate on point-based types { x, y, width, height }
 * @returns {Object} A new annotation object with transformed coordinates
 */
export default function applyDeltaPosToAnnotation(annotation, deltaPos, partType, wrapperBbox) {
    if (!deltaPos || !annotation) return annotation;

    const _annotation = { ...annotation };

    // IMAGE — resize avec aspect ratio contraint
    if (_annotation.type === "IMAGE") {
        const currentBBox = _annotation.bbox || { x: 0, y: 0, width: 100, height: 100 };
        const currentRotation = _annotation.rotation || 0;

        if (partType === "ROTATE") {
            _annotation.rotation = (currentRotation + deltaPos.x) % 360;
        }

        else if (partType && partType.startsWith("RESIZE_")) {
            const handle = partType.replace("RESIZE_", "");
            const aspectRatio = currentBBox.width / currentBBox.height;

            let nx = currentBBox.x;
            let ny = currentBBox.y;
            let nw = currentBBox.width;
            let nh = currentBBox.height;

            if (handle === "SE") {
                nw = currentBBox.width + deltaPos.x;
                nh = nw / aspectRatio;
            }
            else if (handle === "SW") {
                nw = currentBBox.width - deltaPos.x;
                nh = nw / aspectRatio;
                nx = currentBBox.x + (currentBBox.width - nw);
            }
            else if (handle === "NE") {
                nw = currentBBox.width + deltaPos.x;
                nh = nw / aspectRatio;
                ny = currentBBox.y + (currentBBox.height - nh);
            }
            else if (handle === "NW") {
                nw = currentBBox.width - deltaPos.x;
                nh = nw / aspectRatio;
                nx = currentBBox.x + (currentBBox.width - nw);
                ny = currentBBox.y + (currentBBox.height - nh);
            }

            if (nw < 20) {
                nw = 20;
                nh = nw / aspectRatio;
                if (handle.includes("W")) nx = currentBBox.x + (currentBBox.width - 20);
                if (handle.includes("N")) ny = currentBBox.y + (currentBBox.height - (20 / aspectRatio));
            }

            _annotation.bbox = { x: nx, y: ny, width: nw, height: nh };
        }

        else {
            _annotation.bbox = {
                ...currentBBox,
                x: currentBBox.x + deltaPos.x,
                y: currentBBox.y + deltaPos.y
            };
        }
    }

    // RECTANGLE — resize libre par dimension (pas d'aspect ratio)
    // Les dimensions contraintes par le template sont ignorées (verrouillées par le template)
    if (_annotation.type === "RECTANGLE") {
        const currentBBox = _annotation.bbox || { x: 0, y: 0, width: 100, height: 100 };
        const currentRotation = _annotation.rotation || 0;

        // Contraintes template
        const templateSize = _annotation.annotationTemplateProps?.size;
        const lockedWidth = templateSize?.width != null;
        const lockedHeight = templateSize?.height != null;

        if (partType === "ROTATE") {
            _annotation.rotation = (currentRotation + deltaPos.x) % 360;
        }

        else if (partType && partType.startsWith("RESIZE_")) {
            const handle = partType.replace("RESIZE_", "");

            let nx = currentBBox.x;
            let ny = currentBBox.y;
            let nw = currentBBox.width;
            let nh = currentBBox.height;

            // Appliquer les deltas librement par dimension
            const dx = lockedWidth ? 0 : deltaPos.x;
            const dy = lockedHeight ? 0 : deltaPos.y;

            if (handle === "SE") {
                nw = currentBBox.width + dx;
                nh = currentBBox.height + dy;
            }
            else if (handle === "SW") {
                nw = currentBBox.width - dx;
                nh = currentBBox.height + dy;
                nx = currentBBox.x + dx;
            }
            else if (handle === "NE") {
                nw = currentBBox.width + dx;
                nh = currentBBox.height - dy;
                ny = currentBBox.y + dy;
            }
            else if (handle === "NW") {
                nw = currentBBox.width - dx;
                nh = currentBBox.height - dy;
                nx = currentBBox.x + dx;
                ny = currentBBox.y + dy;
            }

            // Sécurité min 20px
            if (nw < 20) {
                nw = 20;
                if (handle.includes("W")) nx = currentBBox.x + (currentBBox.width - 20);
            }
            if (nh < 20) {
                nh = 20;
                if (handle.includes("N")) ny = currentBBox.y + (currentBBox.height - 20);
            }

            _annotation.bbox = { x: nx, y: ny, width: nw, height: nh };
        }

        else {
            _annotation.bbox = {
                ...currentBBox,
                x: currentBBox.x + deltaPos.x,
                y: currentBBox.y + deltaPos.y
            };
        }
    }

    // OBJECT_3D — move + rotate only (no resize per spec)
    if (_annotation.type === "OBJECT_3D") {
        const currentBBox = _annotation.bbox || { x: 0, y: 0, width: 100, height: 100 };
        const currentRotation = _annotation.rotation || 0;

        if (partType === "ROTATE") {
            _annotation.rotation = (currentRotation + deltaPos.x) % 360;
        } else {
            _annotation.bbox = {
                ...currentBBox,
                x: currentBBox.x + deltaPos.x,
                y: currentBBox.y + deltaPos.y,
            };
        }
    }

    // MARKER / POINT
    if (_annotation.type === "MARKER" || _annotation.type === "POINT") {
        _annotation.point = {
            x: _annotation.point.x + deltaPos.x,
            y: _annotation.point.y + deltaPos.y
        };
    }

    // LABEL
    if (_annotation.type === "LABEL") {
        if (partType === 'TARGET') {
            _annotation.targetPoint = {
                x: _annotation.targetPoint.x + deltaPos.x,
                y: _annotation.targetPoint.y + deltaPos.y
            };
        }
        else if (partType === 'LABEL_BOX') {
            _annotation.labelPoint = {
                x: _annotation.labelPoint.x + deltaPos.x,
                y: _annotation.labelPoint.y + deltaPos.y
            };
        }
        else {
            _annotation.targetPoint = {
                x: _annotation.targetPoint.x + deltaPos.x,
                y: _annotation.targetPoint.y + deltaPos.y
            };
            _annotation.labelPoint = {
                x: _annotation.labelPoint.x + deltaPos.x,
                y: _annotation.labelPoint.y + deltaPos.y
            };
        }
    }

    // POLYLINE / POLYGON / STRIP
    if (_annotation.type === "POLYLINE" || _annotation.type === "POLYGON" || _annotation.type === "STRIP") {

        const transformPoints = (points) => {
            if (!points) return points;

            // RESIZE with wrapper bbox
            if (partType?.startsWith("RESIZE_") && wrapperBbox) {
                const handle = partType.replace("RESIZE_", "");
                const { x: bx, y: by, width: bw, height: bh } = wrapperBbox;

                let anchorX, anchorY;
                if (handle === "SE") { anchorX = bx; anchorY = by; }
                else if (handle === "SW") { anchorX = bx + bw; anchorY = by; }
                else if (handle === "NE") { anchorX = bx; anchorY = by + bh; }
                else if (handle === "NW") { anchorX = bx + bw; anchorY = by + bh; }
                else return points;

                let newW = bw, newH = bh;
                if (handle === "SE") { newW = bw + deltaPos.x; newH = bh + deltaPos.y; }
                else if (handle === "SW") { newW = bw - deltaPos.x; newH = bh + deltaPos.y; }
                else if (handle === "NE") { newW = bw + deltaPos.x; newH = bh - deltaPos.y; }
                else if (handle === "NW") { newW = bw - deltaPos.x; newH = bh - deltaPos.y; }

                if (Math.abs(newW) < 20) newW = 20 * Math.sign(newW || 1);
                if (Math.abs(newH) < 20) newH = 20 * Math.sign(newH || 1);

                const scaleX = bw > 0 ? newW / bw : 1;
                const scaleY = bh > 0 ? newH / bh : 1;

                return points.map(pt => ({
                    ...pt,
                    x: anchorX + (pt.x - anchorX) * scaleX,
                    y: anchorY + (pt.y - anchorY) * scaleY,
                }));
            }

            // ROTATE with wrapper bbox
            if (partType === "ROTATE" && wrapperBbox) {
                const { x: bx, y: by, width: bw, height: bh } = wrapperBbox;
                const centerX = bx + bw / 2;
                const centerY = by + bh / 2;
                const angleDeg = deltaPos.x;
                const angleRad = (angleDeg * Math.PI) / 180;
                const cos = Math.cos(angleRad);
                const sin = Math.sin(angleRad);

                return points.map(pt => {
                    const dx = pt.x - centerX;
                    const dy = pt.y - centerY;
                    return {
                        ...pt,
                        x: centerX + dx * cos - dy * sin,
                        y: centerY + dx * sin + dy * cos,
                    };
                });
            }

            // MOVE (default)
            return points.map(pt => ({
                ...pt,
                x: pt.x + deltaPos.x,
                y: pt.y + deltaPos.y,
            }));
        };

        _annotation.points = transformPoints(_annotation.points);

        if (_annotation.cuts) {
            _annotation.cuts = _annotation.cuts.map(cut => ({
                ...cut,
                points: transformPoints(cut.points),
            }));
        }
    }

    return _annotation;
}
