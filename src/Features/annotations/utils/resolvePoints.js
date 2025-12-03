export default function resolvePoints({ points, pointsIndex, imageSize }) {
    if (!points || !pointsIndex || !imageSize) return points;

    return points.map((point) => {
        const pointFromIndex = pointsIndex[point.id];
        if (pointFromIndex) {
            return {
                ...point,
                x: pointFromIndex.x * imageSize.width,
                y: pointFromIndex.y * imageSize.height,
                type: point?.type ?? "square"
            }
        } else {
            return point;
        }

    });
}

