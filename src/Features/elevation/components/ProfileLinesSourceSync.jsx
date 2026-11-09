import useProfileLinesSourceSync from "Features/elevation/hooks/useProfileLinesSourceSync";

// Mount point of the profile lines ↔ source drawing sync — a component of its
// own so the live queries never re-render the layout.
export default function ProfileLinesSourceSync() {
  useProfileLinesSourceSync();

  // render

  return null;
}
