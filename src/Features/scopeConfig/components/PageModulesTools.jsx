import { Box } from "@mui/material";

import PageConfigLayout from "./PageConfigLayout";
import SectionModulesConfig from "./SectionModulesConfig";
import SectionToolsConfig from "./SectionToolsConfig";
import SectionThreedConfig from "./SectionThreedConfig";

// "Généralités > Modules & outils" page: three white sections — the modules
// of the left band, the tools of the right band, and the 3D editor, which
// sits under the modules (a single row, it would waste a column of its own).
// The two band sections share the same layout: one row per item, drag handle
// and icon on the left, activation switch on the right.
export default function PageModulesTools({ modules, tools, onSelect }) {
  // strings

  const titleS = "Modules & outils";
  const helperS =
    "Activez ou désactivez les modules et les outils, et glissez leur poignée pour les réordonner.";

  // handlers

  // The per-row "Paramétrer" button jumps to the item's own page of the nav
  // column; the 3D row jumps to the "Éditeur 3D" page.
  function handleOpenModule(key) {
    onSelect({ type: "MODULE", key });
  }

  function handleOpenTool(key) {
    onSelect({ type: "TOOL", key });
  }

  function handleOpen3dEditor() {
    onSelect({ type: "EDITOR", key: "EDITOR_3D" });
  }

  // render

  return (
    <PageConfigLayout title={titleS} subtitle={helperS}>
      <SectionModulesConfig
        modules={modules}
        onOpenSettings={handleOpenModule}
      />
      <SectionToolsConfig tools={tools} onOpenSettings={handleOpenTool} />
      {/* forced back to the first column: auto-placement never goes
          backwards, so it lands under the modules on the next row */}
      <Box sx={{ gridColumn: { md: "1" } }}>
        <SectionThreedConfig onOpenSettings={handleOpen3dEditor} />
      </Box>
    </PageConfigLayout>
  );
}
