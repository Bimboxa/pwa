export default function getSegmentAngle(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    return Math.atan2(dy, dx);
}