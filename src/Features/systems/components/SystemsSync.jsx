import useSystemsSync from "Features/systems/hooks/useSystemsSync";

// Mount point of the system instances ↔ source annotation sync — a component
// of its own so the live queries never re-render the layout.
export default function SystemsSync() {
  useSystemsSync();

  // render

  return null;
}
