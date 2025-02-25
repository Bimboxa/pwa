export default function getPointsFlatArray(points, options) {
  // options

  const scaleBy = options.scaleBy || 1;

  // main
  return points.reduce((acc, point) => {
    acc.push(point.x * scaleBy, point.y * scaleBy);
    return acc;
  }, []);
}
