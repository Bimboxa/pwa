
import useAppConfig from "Features/appConfig/hooks/useAppConfig"
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2"
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

const annotations = useAnnotationsV2({
    caller: "ButtonExportKmz",
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    withEntity: true,
  });

  // helpers

  // annotationsToKmzAsync reads the flat `label`; V2 only flattens template
  // props listed in overrideFields, so fall back to annotationTemplateProps.
  const markers = annotations
    ?.filter((a) => a.type === "MARKER")
    .map((a) => ({ ...a, label: a.label ?? a.annotationTemplateProps?.label }));

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