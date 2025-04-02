export default function testIsPngImage(file) {
  console.log("testIsPngImage", file.type);
  //return file.type === "image/png";
  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg"
  );
}
