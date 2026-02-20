/**
 * Apply a delta position to an annotation, returning a new annotation object
 * with transformed geometry. Pure function, no React dependencies.
 *
 * Handles all annotation types: MARKER, POINT, LABEL, POLYLINE, POLYGON, IMAGE, RECTANGLE
 * Handles partTypes: MOVE (default), TARGET, LABEL_BOX, ROTATE, RESIZE_*
 *
 * @param {Object} annotation - The annotation to transform
 * @param {Object} deltaPos - { x, y } delta to apply
 * @param {string|null} partType - e.g. "TARGET", "LABEL_BOX", "RESIZE_SE", "ROTATE", or null for move
 * @returns {Object} A new annotation object with transformed coordinates
 */
export default function applyDeltaPosToAnnotation(annotation, deltaPos, partType) {
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

    // POLYLINE / POLYGON
    if (_annotation.type === "POLYLINE" || _annotation.type === "POLYGON") {
        _annotation.points = _annotation.points.map(pt => ({
            ...pt,
            x: pt.x + deltaPos.x,
            y: pt.y + deltaPos.y
        }));
    }

    return _annotation;
}
