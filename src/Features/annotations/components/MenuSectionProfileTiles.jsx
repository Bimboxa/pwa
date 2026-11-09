import PropTypes from "prop-types";

import { Box, ButtonBase, ListSubheader, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import ProfileThumbnail from "./ProfileThumbnail";

// « Profils » section of the « Forme par défaut » menu (Shape3DSelector /
// Shape3DBatchSelector): the scope's profile drawings (useProfileAnnotations)
// as a grid of tiles — thumbnail above, name below. A tile behaves like a
// check box: `stateOf(id)` is "all" (every target carries the profile),
// "some" (part of a multi-selection) or "none"; `onToggle(id)` applies or
// removes it (toggleProfileSourceOnAnnotationsService).
//
// Invoked as a plain function (no hooks inside) so the returned ARRAY lands
// directly among the MUI Menu children, like the other sections — a wrapping
// element or Fragment would hide the items from the MenuList.
export default function MenuSectionProfileTiles({
  profiles,
  stateOf,
  onToggle,
  disabled = false,
}) {
  // strings

  const titleS = "Profils";

  // render

  return [
    <ListSubheader
      key="profiles-header"
      sx={{ lineHeight: "32px", fontWeight: "bold" }}
    >
      {titleS}
    </ListSubheader>,
    <Box
      key="profiles-grid"
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 0.5,
        width: 240,
        px: 1,
        pb: 1,
      }}
    >
      {profiles.map((profile) => {
        const state = stateOf(profile.id);
        const selected = state === "all";
        const partial = state === "some";
        return (
          <ButtonBase
            key={profile.id}
            onClick={() => onToggle(profile.id)}
            disabled={disabled}
            title={profile.label}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              p: 0.75,
              borderRadius: 1,
              border: "1px dashed",
              borderColor: partial ? "secondary.main" : "transparent",
              color: selected ? "secondary.main" : "text.secondary",
              bgcolor: selected
                ? (theme) => alpha(theme.palette.secondary.main, 0.12)
                : "transparent",
              "&:hover": {
                bgcolor: selected
                  ? (theme) => alpha(theme.palette.secondary.main, 0.18)
                  : "action.hover",
              },
            }}
          >
            <ProfileThumbnail drawing={profile.drawing} size={48} />
            <Typography
              variant="caption"
              sx={{
                fontSize: 10.5,
                lineHeight: 1.2,
                textAlign: "center",
                color: "inherit",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {profile.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>,
  ];
}

MenuSectionProfileTiles.propTypes = {
  profiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
      drawing: PropTypes.object,
    })
  ).isRequired,
  stateOf: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
