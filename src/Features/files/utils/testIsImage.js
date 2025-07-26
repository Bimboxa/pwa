export default function testIsImage(file) {
  if (!file || !file.type) return false;
  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    file.type === "image/gif"
  );
}
