import { parseSettings } from "./notesAppListingSettings";

// Location lists take precedence: Krnet hides the locatable toggle for them
// without clearing its previously stored value.
export default function getNotesAppBusinessObjectType(
  settings,
  fallback = "STANDARD"
) {
  const parsed = parseSettings(settings);
  if (parsed.isLocationListing) return "LOCATIONS";
  if (parsed.isLocatable) return "PINNED_OBJECTS";
  return ["PINNED_OBJECTS", "LOCATIONS"].includes(fallback)
    ? "STANDARD"
    : fallback;
}
