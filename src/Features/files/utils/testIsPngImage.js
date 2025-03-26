export default function testIsPngImage(file) {
  console.log("testIsPngImage", file.type);
  return file.type === "image/png";
}
