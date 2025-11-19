export default function getFixedDimsMeterFromString(fixedDims) {
  if (!fixedDims) return null;
  const [x, y] = fixedDims.split(";");
  return { x: parseFloat(x), y: parseFloat(y) };
}
