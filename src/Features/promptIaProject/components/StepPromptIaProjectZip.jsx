import { Alert } from "@mui/material";

import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";

export default function StepPromptIaProjectZip({ input }) {
  // strings

  const missingDescriptionS =
    "Décrivez les scopes à créer à l’étape « Contexte » pour préparer le zip.";

  // helpers

  const { downloaded } = input;
  const missingDescription = !input.description.trim();

  // render

  return (
    <SectionPromptIaZipDownload
      onDownload={input.download}
      disabled={!input.canDownload}
      building={input.building}
      built={downloaded}
    >
      {missingDescription && (
        <Alert severity="info">{missingDescriptionS}</Alert>
      )}
      {downloaded?.unreadablePdfs?.length > 0 && (
        <Alert severity="warning">
          {`PDF illisible(s), joint(s) tel(s) quel(s) : ${downloaded.unreadablePdfs.join(", ")}`}
        </Alert>
      )}
      {Boolean(input.error) && <Alert severity="error">{input.error}</Alert>}
    </SectionPromptIaZipDownload>
  );
}
