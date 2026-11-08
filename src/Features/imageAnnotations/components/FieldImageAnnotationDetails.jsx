import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

export default function FieldImageAnnotationDetails({ annotation }) {
  // data
  const updateAnnotation = useUpdateAnnotation();

  // handlers
  function patch(changes) {
    return updateAnnotation({ id: annotation.id, ...changes });
  }

  // render
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldCheck
        label="Connecteur"
        value={Boolean(annotation.hasConnector)}
        onChange={(hasConnector) => patch({ hasConnector })}
        options={{ type: "switch", showAsField: true }}
      />
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
