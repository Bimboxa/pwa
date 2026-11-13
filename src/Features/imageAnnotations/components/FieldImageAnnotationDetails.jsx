import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

// Photo position: the numbered badge (anchor) positions the photo, drawn
// with its top-left corner on it. A photo dragged away from its badge
// (`hasConnector`) is joined to it by a link line; the reset pins it back
// (the stored bbox origin is then ignored: see getImageEffectiveBbox).
export default function FieldImageAnnotationDetails({ annotation }) {
  // strings
  const resetS = "Réinitialiser la position de la photo";
  const resetHelperS =
    "La photo a été déplacée : elle revient sur sa pastille, le trait de liaison disparaît.";

  // data
  const updateAnnotation = useUpdateAnnotation();

  // helpers
  const detached = Boolean(annotation.hasConnector) && !annotation.isObject2D;

  // handlers
  function patch(changes) {
    return updateAnnotation({ id: annotation.id, ...changes });
  }

  // render
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {detached && (
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FilterCenterFocusIcon />}
              onClick={() => patch({ hasConnector: false })}
              sx={{ alignSelf: "flex-start", textTransform: "none" }}
            >
              {resetS}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {resetHelperS}
            </Typography>
          </Box>
        </WhiteSectionGeneric>
      )}
      <FieldTextV2
        label="Description de l’image"
        value={annotation.labelDescription ?? ""}
        onChange={(labelDescription) => patch({ labelDescription })}
        options={{
          multiline: true,
          showAsSection: true,
          showLabel: false,
          fullWidth: true,
          changeOnBlur: true,
          hideMic: true,
        }}
      />
      <WhiteSectionGeneric>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            Orientation 3D
          </Typography>
          <ToggleButtonGroup
            value={annotation.imageOrientation3d ?? "VERTICAL"}
            exclusive
            onChange={(_event, imageOrientation3d) => {
              if (imageOrientation3d !== null) patch({ imageOrientation3d });
            }}
            size="small"
            aria-label="Orientation en 3D"
            sx={toggleGroupSx}
          >
            <ToggleButton value="VERTICAL" title="Face à la caméra">
              Verticale
            </ToggleButton>
            <ToggleButton value="HORIZONTAL" title="Parallèle au plan">
              Horizontale
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </WhiteSectionGeneric>
    </Box>
  );
}
