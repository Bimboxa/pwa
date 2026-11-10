import usePathArraySync from "Features/pathArray/hooks/usePathArraySync";

// Mount point of the path array (« Calepinage ») ↔ source polyline sync — a
// component of its own so the live queries never re-render the layout.
export default function PathArraySync() {
  usePathArraySync();

  // render

  return null;
}
