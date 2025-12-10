import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default function resolvePoints({ points, pointsIndex, imageSize }) {
    if (!points || !pointsIndex || !imageSize) return points;

    return points.map((point) => {
        const pointFromIndex = pointsIndex[point.id];
        const hasXorY = testObjectHasProp(point, "x") || testObjectHasProp(point, "y");
        if (pointFromIndex) {
            return {
                ...point,
                x: pointFromIndex.x * imageSize.width,
                y: pointFromIndex.y * imageSize.height,
                type: point?.type ?? "square"
            }
        } else if (hasXorY) {
            return {
                ...point,
                x: point.x * imageSize.width,
                y: point.y * imageSize.height,
                type: point?.type ?? "square"
            }
        } else {
            return point;
        }

    });
}

