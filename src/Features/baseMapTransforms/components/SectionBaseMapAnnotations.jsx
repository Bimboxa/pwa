import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setShowAnnotations } from "Features/baseMapEditor/baseMapEditorSlice";

import { Box, Button, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";

import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";

import mergeAnnotationsOnImage from "Features/baseMapEditor/utils/mergeAnnotationsOnImage";

// ---------------------------------------------------------------------------
// SectionBaseMapAnnotations — "Annotations" card of the Transformations panel:
// the same "Afficher les annotations" switch as the Fond de plan left panel
// (baseMapEditor.showAnnotations) + a "Fusionner" button that rasterizes the
// annotations currently visible in the 2D editor onto the active version
// image and creates a new active version right away (no compare dialog).
// ---------------------------------------------------------------------------

export default function SectionBaseMapAnnotations({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Annotations";
  const descriptionS =
    "Afficher les annotations du projet sur le fond de plan, puis les " +
    "fusionner dans une nouvelle version de l'image";
  const showAnnotationsS = "Afficher les annotations";
  const mergeS = "Fusionner";
  const mergeLabelS = "Fusion annotations";

  // data

  const showAnnotations = useSelector((s) => s.baseMapEditor.showAnnotations);
  const annotations = useVisibleAnnotations();
  const createVersion = useCreateBaseMapVersion();

  // state

  const [merging, setMerging] = useState(false);

  // handlers

  async function handleMerge() {
    if (!annotations?.length || !baseMap) return;
    setMerging(true);
    try {
      const result = await mergeAnnotationsOnImage({
        imageUrl: baseMap.getUrl(),
        imageTransform: baseMap.getActiveVersionTransform(),
        refSize: baseMap.getImageSize(),
        annotations,
        meterByPx: baseMap.getMeterByPx(),
      });
      if (!result?.file) return;
      // The util grows the canvas to the annotations bbox and returns the
      // matching placement in the reference frame: keep it as is.
      await createVersion(baseMap.id, result.file, {
        label: mergeLabelS,
        transform: result.transform,
      });
      // Avoid drawing the vector annotations twice over the merged image.
      dispatch(setShowAnnotations(false));
    } finally {
      setMerging(false);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {titleS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {descriptionS}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <SwitchGeneric
          label={showAnnotationsS}
          checked={showAnnotations}
          onChange={(checked) => dispatch(setShowAnnotations(checked))}
        />
      </Box>
      <Button
        fullWidth
        size="small"
        variant="outlined"
        loading={merging}
        disabled={!annotations?.length}
        onClick={handleMerge}
        sx={{ mt: 1 }}
      >
        {mergeS}
      </Button>
    </WhiteSectionGeneric>
  );
}
