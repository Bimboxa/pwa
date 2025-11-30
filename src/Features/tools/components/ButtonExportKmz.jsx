
import useAppConfig from "Features/appConfig/hooks/useAppConfig"
import useAnnotations from "Features/annotations/hooks/useAnnotations"
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap"
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage"

import { useSelector } from "react-redux"

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel"

import annotationsToKmzAsync from "Features/annotations/services/annotationsToKmzAsync"
import downloadBlob from "Features/files/utils/downloadBlob"

export default function ButtonExportKmz() {

    // strings

    const label = "Export KMZ";

    // data

const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
const mainBaseMap = useMainBaseMap();
const spriteImage = useAnnotationSpriteImage();
const appConfig = useAppConfig();

const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    withEntity: true,
    withLabel: true,
  });

  // helpers

  const markers = annotations?.filter((a) => a.type === "MARKER");

  // handlers

    async function handleExportClick() {
        console.log("debug_2011_mainBaseMap", markers);
        const kmz = await annotationsToKmzAsync({appConfig,annotations: markers,baseMap: mainBaseMap,spriteImage});
        downloadBlob(kmz, "annotations.kmz");
    }

    return (
        <ButtonActionInPanel
            label={label}
            onClick={handleExportClick}
            variant="download"
        />
    )
}