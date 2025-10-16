export default function sanitizeName(name) {
  return name
    .replace(/[^a-z0-9]/gi, "_") // Replace non-alphanumeric with underscore
    .toLowerCase();
}
