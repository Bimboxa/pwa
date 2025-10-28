export default function getImageAnnotationPropsFromFileName(fileName) {
  if (!fileName) return {};

  // Remove file extension
  const nameWithoutExt = fileName.replace(
    /\.(png|jpg|jpeg|gif|webp|svg)$/i,
    ""
  );

  // Find last dash (possibly surrounded by whitespace)
  // Match pattern: "text - scale" or "text-scale" or "text - scale"
  const dashMatch = nameWithoutExt.match(/^(.*?)\s*-\s*([^-]+)$/);

  if (!dashMatch) {
    // No dash found, use entire filename as label
    return {
      label: nameWithoutExt,
      meterByPx: null,
    };
  }

  const label = dashMatch[1].trim();
  const scaleStr = dashMatch[2].trim();

  // Parse scale string (e.g., "1cm", "150m", "1mm")
  // Extract number and unit
  const match = scaleStr.match(/^(\d+(?:\.\d+)?)(mm|cm|m)$/i);

  let meterByPx = null;

  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    // Convert to meters per pixel
    switch (unit) {
      case "mm":
        meterByPx = value / 1000; // millimeters to meters
        break;
      case "cm":
        meterByPx = value / 100; // centimeters to meters
        break;
      case "m":
        meterByPx = value; // already in meters
        break;
    }
  }

  return {
    label: label || null,
    meterByPx: meterByPx,
  };
}
