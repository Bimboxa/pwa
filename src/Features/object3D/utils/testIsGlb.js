export default function testIsGlb(file) {
  if (!file) return false;
  if (file.type === "model/gltf-binary") return true;
  const name = file.name || "";
  return name.toLowerCase().endsWith(".glb");
}
