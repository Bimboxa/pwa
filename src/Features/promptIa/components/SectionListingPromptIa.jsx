import PropTypes from "prop-types";
import { Box, Switch, TextField, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { PROMPT_IA_INSTRUCTIONS_MAX_LENGTH } from "../utils/promptIaProcedure";

/**
 * « Prompt IA » section of the listing properties: enables the virtual
 * "Prompt IA" procedure of the listing's "Dessin auto" band
 * (listing.promptIaEnabled) and holds the free instructions handed to the AI
 * (listing.promptIaInstructions — pre-fills the description of the flow).
 *
 * `onChange(updates)` persists the partial listing updates.
 */
export default function SectionListingPromptIa({ listing, onChange }) {
  // strings

  const titleS = "Prompt IA";
  const hintS =
    "Ajoute la procédure « Prompt IA » à la section « Dessin auto » de la liste.";
  const instructionsS = "Consignes";
  const placeholderS =
    "Consignes transmises à l'IA. Exemple : ne traiter que la zone nord du plan…";

  // helpers

  const enabled = Boolean(listing?.promptIaEnabled);

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          {titleS}
        </Typography>
        <Switch
          size="small"
          checked={enabled}
          onChange={(e) => onChange({ promptIaEnabled: e.target.checked })}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{ display: "block", color: "text.secondary" }}
      >
        {hintS}
      </Typography>
      {enabled && (
        <TextField
          // per-listing instance: the uncontrolled value follows the listing
          key={`prompt-ia-${listing.id}`}
          size="small"
          label={instructionsS}
          placeholder={placeholderS}
          multiline
          minRows={3}
          fullWidth
          defaultValue={listing.promptIaInstructions ?? ""}
          onBlur={(e) =>
            onChange({ promptIaInstructions: e.target.value.trim() || null })
          }
          slotProps={{
            htmlInput: { maxLength: PROMPT_IA_INSTRUCTIONS_MAX_LENGTH },
          }}
          sx={{
            mt: 1.5,
            // same size as the panel's other fields (FieldTextV2: body2)
            "& .MuiInputBase-input, & .MuiInputLabel-root": {
              fontSize: (theme) => theme.typography.body2.fontSize,
            },
          }}
        />
      )}
    </WhiteSectionGeneric>
  );
}

SectionListingPromptIa.propTypes = {
  listing: PropTypes.shape({
    id: PropTypes.string.isRequired,
    promptIaEnabled: PropTypes.bool,
    promptIaInstructions: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};
