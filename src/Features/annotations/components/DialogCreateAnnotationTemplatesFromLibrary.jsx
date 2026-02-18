import { useState } from "react";

import useCreateAnnotationTemplatesFromLibrary from "../hooks/useCreateAnnotationTemplatesFromLibrary";
import useAnnotationTemplatesFromLibrary from "../hooks/useAnnotationTemplatesFromLibrary";

import { DialogTitle, Box, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectAnnotationTemplates from "./SectionSelectAnnotationTemplates";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function DialogCreateAnnotationTemplatesFromLibrary({
  open,
  onClose,
}) {
  // strings

  const titleS = "Sélectionnez les modèles à ajouter";
  const createS = "Ajouter la sélection";
  const libraryS = "Bibliothèque";

  // state

  const [selection, setSelection] = useState([]);
  const [group, setGroup] = useState("")

  // data

  const annotationTemplates = useAnnotationTemplatesFromLibrary({
    addId: true,
  });

  let filteredAnnotationTemplates = annotationTemplates?.filter(t => t.group === group || !group) ?? []

  filteredAnnotationTemplates = filteredAnnotationTemplates.sort((a, b) => a.label.localeCompare(b.label))

  const createAnnotationTemplatesFromLibrary =
    useCreateAnnotationTemplatesFromLibrary();

  // helpers

  const label = createS + " (" + selection.length + ")";

  // helpers - groups

  const groups = [...new Set(annotationTemplates?.map(t => t.group))].sort()

  let groupsItems = groups.map(g => ({ id: g, label: g }))

  // handlers

  function handleSelectionChange(selection) {
    console.log("selection", selection);
    setSelection(selection);
  }

  async function handleCreate() {
    const templates = annotationTemplates.filter((template) =>
      selection.includes(template.id)
    );
    await createAnnotationTemplatesFromLibrary(templates);
    onClose();
  }

  function handleGroupChange(g) {
    setGroup(g.label)
    setSelection([])
  }

  return (
    <DialogGeneric open={open} onClose={onClose} vh="75">
      <DialogTitle>{titleS}</DialogTitle>

      <BoxFlexVStretch>
        <Box sx={{ display: "flex", bgcolor: "background.default", p: 1, height: 1, gap: 2 }}>

          <Box sx={{ width: 300, p: 1 }}>
            <Typography variant="body2" color='text.secondary' sx={{ mb: 2 }}>{libraryS}</Typography>
            <Box sx={{ bgcolor: "white", borderRadius: 1 }}>
              <ListItemsGeneric items={groupsItems} onClick={handleGroupChange} selection={group ? [group] : []} />
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <BoxFlexVStretch sx={{ width: 400 }}>
              <SectionSelectAnnotationTemplates
                annotationTemplates={filteredAnnotationTemplates}
                selection={selection}
                onChange={handleSelectionChange}
              />
            </BoxFlexVStretch>
            <ButtonInPanelV2
              label={label}
              onClick={handleCreate}
              variant="contained"
              color="secondary"
              disabled={selection.length === 0}
            />
          </Box>

        </Box>
      </BoxFlexVStretch>


    </DialogGeneric>
  );
}
