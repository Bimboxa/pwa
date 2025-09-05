/** Render an image as SVG <image> */

export default function NodeSvgImage({ src, width, height }) {
  if (!src || !width || !height) return null;

  return (
    <image
      href={src}
      x={0}
      y={0}
      width={width}
      height={height}
      preserveAspectRatio="none"
    />
  );
}
