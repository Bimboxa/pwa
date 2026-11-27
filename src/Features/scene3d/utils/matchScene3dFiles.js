// Sorts the files picked for a scan import: the mesh (.ply) and its
// texture atlases, matched by file name with the `TextureFile` lines of the
// PLY header (case-insensitive, folders ignored).

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const LAS_EXTENSIONS = ["laz", "las"];

function getBaseName(name) {
  return String(name ?? "")
    .split(/[\\/]/)
    .pop()
    .toLowerCase();
}

function getExtension(name) {
  const base = getBaseName(name);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1);
}

// → {plyFile, lasFile, glbFile, imageFiles, ignoredFiles} — lasFile: a LAS /
// LAZ point cloud (converted to PLY at import); glbFile: a model kept as is
// (GLB scene). One source only: the PLY wins, then the LAS / LAZ, then the GLB.
export function sortScene3dFiles(files) {
  const list = Array.from(files ?? []);
  const plyFiles = list.filter((file) => getExtension(file.name) === "ply");
  const lasFiles = list.filter((file) =>
    LAS_EXTENSIONS.includes(getExtension(file.name))
  );
  const glbFiles = list.filter((file) => getExtension(file.name) === "glb");
  const imageFiles = list.filter((file) =>
    IMAGE_EXTENSIONS.includes(getExtension(file.name))
  );
  const plyFile = plyFiles[0] ?? null;
  const lasFile = plyFile ? null : (lasFiles[0] ?? null);
  const glbFile = plyFile || lasFile ? null : (glbFiles[0] ?? null);
  const ignoredFiles = list.filter(
    (file) =>
      file !== plyFile &&
      file !== lasFile &&
      file !== glbFile &&
      !imageFiles.includes(file)
  );
  return { plyFile, lasFile, glbFile, imageFiles, ignoredFiles };
}

// → {textureFiles: (File | null)[] (same order as textureNames), missingNames}
export default function matchScene3dFiles(textureNames, imageFiles) {
  const byName = new Map(
    (imageFiles ?? []).map((file) => [getBaseName(file.name), file])
  );
  const textureFiles = (textureNames ?? []).map(
    (name) => byName.get(getBaseName(name)) ?? null
  );
  const missingNames = (textureNames ?? []).filter(
    (_, index) => !textureFiles[index]
  );
  return { textureFiles, missingNames };
}
