export default function screenToWorld(screenX, screenY, svgElement, cameraMatrix) {
    const rect = svgElement.getBoundingClientRect();
    const { x, y, k } = cameraMatrix;
    return {
        x: (screenX - rect.left - x) / k,
        y: (screenY - rect.top - y) / k
    };
}