import { Box, Typography } from "@mui/material";

import useResources from "Features/resources/hooks/useResources";
import ListResources from "Features/resources/components/ListResources";

// Step 1 of the folio dialog: pick a project resource. All resources are
// listed; only PDFs are selectable (other folio types may come later).
export default function SectionSelectFolioResource({ onResourceSelect }) {
  // strings

  const pdfOnlyS =
    "Seules les ressources PDF sont prises en charge pour le moment.";
  const noResourceS = "Aucune ressource dans le projet.";

  // data

  const resources = useResources();

  // render

  return (
    <Box
      sx={{
        width: 1,
        flexGrow: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ px: 2, py: 1 }}
      >
        {pdfOnlyS}
      </Typography>

      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}>
        {resources.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {noResourceS}
          </Typography>
        ) : (
          <ListResources
            resources={resources}
            onResourceClick={onResourceSelect}
            isResourceDisabled={(resource) => resource.fileType !== "PDF"}
          />
        )}
      </Box>
    </Box>
  );
}
