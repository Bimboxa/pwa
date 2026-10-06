import { Box } from "@mui/material";
import { Folder, FolderOpen } from "@mui/icons-material";

import AvatarListing from "Features/listings/components/AvatarListing";

// Identity mark at the left of a listing row of the SCOPE module (and of the
// folded selector button): what kind of listing this is, at a glance.
// - BASE_MAP: a folder — a base map listing is a folder of plans. Same icons
//   and color as the folder rows of the Fonds de plan module (BaseMapTreeItem):
//   FolderOpen for the selected listing, Folder otherwise.
// - LOCATED_ENTITY: the listing's initials avatar (AvatarListing), the same
//   mark as the Dessin panel, so the annotation listing is recognized across
//   modules.
// - other families: the family icon (the one the section header used to show).
export default function ListingFamilyAvatar({
  listing,
  familyType,
  familyIcon,
  selected = false,
  hidden = false,
  linked = false,
  size = 24,
}) {
  // helpers

  const variant = selected ? "selected" : hidden ? "muted" : "visible";

  // render

  if (familyType === "LOCATED_ENTITY") {
    return (
      <AvatarListing
        listing={listing}
        size={size}
        variant={variant}
        linked={linked}
      />
    );
  }

  const isFolder = familyType === "BASE_MAP";
  const icon = isFolder ? (
    selected ? (
      <FolderOpen color="action" />
    ) : (
      <Folder color="action" />
    )
  ) : (
    familyIcon
  );
  if (!icon) return null;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: selected ? "secondary.main" : "text.secondary",
        opacity: hidden ? 0.5 : 1,
        // The folder keeps the module's default icon size; the other family
        // icons scale with the box.
        ...(!isFolder && { "& svg": { fontSize: Math.round(size * 0.85) } }),
      }}
    >
      {icon}
    </Box>
  );
}
