export default function getPolylinePointsFromRectangle(points, orthoSnapAngleOffset = 0) {
    const pointA = points[0]
    const pointC = points[1]

    if (orthoSnapAngleOffset === 0) {
        // Axis-aligned rectangle (original behavior)
        const pointB = { x: pointC.x, y: pointA.y }
        const pointD = { x: pointA.x, y: pointC.y }
        return [pointA, pointB, pointC, pointD]
    }

    // Rotated rectangle: project diagonal onto ortho snap grid axes
    // Snap grid primary axis is at -offset in screen coords (Y down)
    const theta = (-orthoSnapAngleOffset * Math.PI) / 180;
    const ax1 = { x: Math.cos(theta), y: Math.sin(theta) };
    const ax2 = { x: -Math.sin(theta), y: Math.cos(theta) };

    const dx = pointC.x - pointA.x;
    const dy = pointC.y - pointA.y;

    const d1 = dx * ax1.x + dy * ax1.y;
    const d2 = dx * ax2.x + dy * ax2.y;

    const pointB = { x: pointA.x + d1 * ax1.x, y: pointA.y + d1 * ax1.y };
    const pointD = { x: pointA.x + d2 * ax2.x, y: pointA.y + d2 * ax2.y };

    return [pointA, pointB, pointC, pointD]
}