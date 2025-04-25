export default function getParentPath(path) {
  // edge case
  if (!path) return;

  // helpers
  const pathArray = path.split("/");
  const parentPath = pathArray.slice(0, -1).join("/");

  // main
  return parentPath;
}
