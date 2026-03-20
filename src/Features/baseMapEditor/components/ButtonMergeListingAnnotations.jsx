import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { Button } from "@mui/material";

import mergeAnnotationsOnImage from "../utils/mergeAnnotationsOnImage";

export default function ButtonMergeListingAnnotations({
  listingId,
  baseMap,
  onResult,
}) {
  // data

  const annotations = useAnnotationsV2({
    filterByListingId: listingId,
    filterByMainBaseMap: true,
    sortByOrderIndex: true,
    excludeBgAnnotations: true,
  });

  // handlers

  async function handleMerge(e) {
    e.stopPropagation();
    if (!annotations?.length || !baseMap) return;

    const imageUrl = baseMap.getUrl();
    const refSize = baseMap.getImageSize();
    const imageTransform = baseMap.getActiveVersionTransform();
    const meterByPx = baseMap.getMeterByPx();

    const result = await mergeAnnotationsOnImage({
      imageUrl,
      imageTransform,
      refSize,
      annotations,
      meterByPx,
      clipToImage: true,
    });

    if (result?.file && onResult) {
      onResult(result.file);
    }
  }

  // render

  return (
    <Button
      size="small"
      onClick={handleMerge}
      disabled={!annotations?.length}
      sx={{
        textTransform: "none",
        color: "orange",
        fontSize: "11px",
        fontWeight: 600,
        minWidth: "auto",
        px: 1,
        py: 0,
        lineHeight: 1.6,
      }}
    >
      Fusionner
    </Button>
  );
}
