import useComponentsSync from "Features/annotationComponents/hooks/useComponentsSync";

// Mount point of the components ↔ source annotation sync — a component of its
// own so the live queries never re-render the layout.
export default function ComponentsSync() {
  useComponentsSync();

  // render

  return null;
}
