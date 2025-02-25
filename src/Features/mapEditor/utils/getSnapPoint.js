export default function getSnapPoint(mousePosition, lastPosition) {
  const nextPoint = {...mousePosition};

  const dx = mousePosition.x - lastPosition.x;
  const dy = mousePosition.y - lastPosition.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const angleAbs = Math.abs(angle);

  if (angleAbs < 45 || angleAbs > 135) {
    // snap to horizontal axis
    nextPoint.y = lastPosition.y;
  } else if (angleAbs >= 45 && angleAbs <= 135) {
    // snap to vertical axis
    nextPoint.x = lastPosition.x;
  }

  return nextPoint;
}
