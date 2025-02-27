export default function hexToRgb(hex, options) {
  // Remove the hash at the start if it's there
  hex = hex.replace(/^#/, "");

  // Parse the r, g, b values
  let bigint = parseInt(hex, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;

  if (options?.variant === "string") {
    return `rgb(${r}, ${g}, ${b})`;
  } else if (options?.variant === "gapi") {
    return {
      red: r / 255,
      green: g / 255,
      blue: b / 255,
    };
  } else {
    return [r, g, b];
  }
}
