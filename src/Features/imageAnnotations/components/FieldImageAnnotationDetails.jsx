import { useEffect, useState } from "react";

import {
  Box,
  Button,
  IconButton,
  InputBase,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import {
  numberInputSx,
  toggleGroupSx,
} from "Features/annotations/constants/fieldSx";

import FieldImageConnectorStyle from "./FieldImageConnectorStyle";
import getImageConnectorConfig, {
  IMAGE_NUMBER_MAX_LENGTH,
  getImageManualNumber,
  hasOwnImageConnectorValue,
} from "../utils/getImageConnectorConfig";

// Photo position: the numbered badge (anchor) positions the photo, drawn
// with its top-left corner on it. A photo dragged away from its badge
// (`hasConnector`) is joined to it by a link line; the reset pins it back
// (the stored bbox origin is then ignored: see getImageEffectiveBbox).
// Photos only (not « Objet 2D »): manual display number (empty = automatic
// rank) and link line style, which overrides the template default until
// reset (see getImageConnectorConfig).
export default function FieldImageAnnotationDetails({ annotation }) {
  // strings
  const resetS = "Réinitialiser la position de la photo";
  const resetHelperS =
    "La photo a été déplacée : elle revient sur sa pastille, le trait de liaison disparaît.";
  const numberS = "Numéro";
  const numberPlaceholderS = "Auto";
  const resetConnectorS = "Revenir au style du modèle";

  // data
  const updateAnnotation = useUpdateAnnotation();

  // state
  const manualNumber = getImageManualNumber(annotation) ?? "";
  const [numberDraft, setNumberDraft] = useState(manualNumber);
  useEffect(() => {
    setNumberDraft(manualNumber);
  }, [manualNumber, annotation.id]);

  // helpers
  const isPhoto = !annotation.isObject2D;
  const detached = Boolean(annotation.hasConnector) && isPhoto;
  const connector = getImageConnectorConfig(annotation);
  const hasOwnConnector = hasOwnImageConnectorValue(annotation);

  // handlers
  function patch(changes) {
    return updateAnnotation({ id: annotation.id, ...changes });
  }

  function commitNumber() {
    const next = numberDraft.trim();
    if (next === manualNumber) return;
    patch({ imageNumber: next || null });
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
      {isPhoto && (
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
              {numberS}
            </Typography>
            <InputBase
              value={numberDraft}
              placeholder={numberPlaceholderS}
              onChange={(event) => setNumberDraft(event.target.value)}
              onBlur={commitNumber}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") event.target.blur();
              }}
              inputProps={{
                maxLength: IMAGE_NUMBER_MAX_LENGTH,
                "aria-label": numberS,
              }}
              sx={numberInputSx}
            />
          </Box>
        </WhiteSectionGeneric>
      )}
      {isPhoto && (
        <FieldImageConnectorStyle
          color={connector.color}
          end={connector.end}
          onChange={patch}
          endAction={
            hasOwnConnector && (
              <IconButton
                size="small"
                title={resetConnectorS}
                aria-label={resetConnectorS}
                onClick={() =>
                  patch({ imageConnectorColor: null, imageConnectorEnd: null })
                }
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
            )
          }
        />
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
