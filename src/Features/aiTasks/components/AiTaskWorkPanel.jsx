/* eslint-disable react/prop-types */
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AddLocationAlt, Close } from "@mui/icons-material";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import { mappedTemplate, templateType } from "../utils/aiTaskMappings";

export default function AiTaskWorkPanel({
  row,
  templates,
  destinationName,
  disabled,
  drawing,
  onChange,
  onExample,
}) {
  const template = mappedTemplate(row, templates);
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {destinationName || "Liste à choisir"}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <AnnotationTemplateIcon
            template={template ?? row}
            size={24}
            use3D={false}
          />
          <Typography variant="body2">
            {row.templateId === "new"
              ? row.label || "Nouveau modèle"
              : template?.label || "Modèle à choisir"}{" "}
            ·{" "}
            {(templateType(template) ?? row.type) === "STRIP"
              ? "stripe"
              : "polyline"}
          </Typography>
        </Stack>
      </Box>
      <Typography variant="subtitle2">
        Comment reconnaître cet ouvrage ?
      </Typography>
      <TextField
        multiline
        minRows={3}
        maxRows={4}
        fullWidth
        size="small"
        placeholder="Description : comment reconnaître cet ouvrage…"
        value={row.description ?? ""}
        disabled={disabled}
        inputProps={{
          "aria-label": "Description de l’ouvrage",
          maxLength: 2000,
        }}
        onChange={(e) => onChange({ description: e.target.value })}
        sx={{ mt: 1 }}
      />
      <Button
        size="small"
        startIcon={<AddLocationAlt />}
        disabled={disabled || drawing}
        onClick={onExample}
        sx={{ display: "flex", mt: 1 }}
      >
        {row.example ? "Redessiner l’exemple" : "Repérer un exemple"}
      </Button>
      {row.example && (
        <Box sx={{ position: "relative", mt: 0.5 }}>
          {row.preview ? (
            <Box
              component="img"
              src={row.preview}
              alt={`Exemple dessiné — ${row.detectionLabel}`}
              sx={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 180,
                borderRadius: 1,
              }}
            />
          ) : (
            <Typography variant="caption">
              Exemple enregistré ({row.example.points.length} points). Aperçu
              indisponible.
            </Typography>
          )}
          <IconButton
            size="small"
            disabled={disabled}
            aria-label="Retirer l’exemple"
            onClick={() => onChange({ example: null, preview: null })}
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              bgcolor: "background.paper",
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary">
        L’exemple aide à reconnaître l’ouvrage dans le PDF. Seules ses
        coordonnées sont envoyées à l’IA ; la vignette reste locale.
      </Typography>
    </Stack>
  );
}
