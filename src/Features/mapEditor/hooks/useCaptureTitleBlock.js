import { useSelector } from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import useDataMapping from "Features/appConfig/hooks/useDataMapping";
import usePovLogoUrl from "Features/pov/hooks/usePovLogoUrl";
import useMainBaseMap from "./useMainBaseMap";
import useCaptureAspectRatio from "./useCaptureAspectRatio";
import useCapturePageFormat from "./useCapturePageFormat";
import useCaptureFrameImageRect from "./useCaptureFrameImageRect";

import getTitleBlockValuesWithPrefill from "Features/titleBlocks/utils/getTitleBlockValuesWithPrefill";
import getCaptureScaleLabel from "../utils/getCaptureScaleLabel";
import { getPdfPageSize } from "../utils/captureMapAsPng";

// Everything the capture frame cartouche needs (CAPTURE mode of
// computeTitleBlockLayout): manifest (org default, or the key stored on the
// scope), field values persisted on `scope.metadata.titleBlock.values` with
// data-mapping prefills, logo (scope override, else the POV / portfolio
// default logo), live bindings and the exported page dimensions in pt.
// `hostViewerKey` = capture host ("MAP" | "BASE_MAPS" | "THREED"...): the
// printed scale is only known on the 2D map hosts.
export default function useCaptureTitleBlock(hostViewerKey) {
  // data

  const { value: scope } = useSelectedScope();
  const { value: project } = useSelectedProject();
  const manifest = useTitleBlockManifest(scope);
  const { object: dataMapping } = useDataMapping();
  const povLogoUrl = usePovLogoUrl();
  const baseMap = useMainBaseMap();
  const captureTitleText = useSelector((s) => s.mapEditor.captureTitleText);
  const aspectRatio = useCaptureAspectRatio();
  const { format } = useCapturePageFormat();
  const frameImageRect = useCaptureFrameImageRect(hostViewerKey);

  // helpers

  const metadata = scope?.metadata || {};
  const values = getTitleBlockValuesWithPrefill(
    manifest,
    metadata,
    dataMapping
  );
  const logoUrl =
    (typeof metadata.logo === "string" && metadata.logo) || povLogoUrl || null;

  const printZone = baseMap?.getPrintZone?.() ?? null;
  const scaleLabel = getCaptureScaleLabel({ frameImageRect, printZone });

  const bindings = {
    "project.name": project?.name || "",
    "page.title": captureTitleText || "",
    "page.format": format || "",
    "page.scale": scaleLabel,
  };

  const { pageWidth, pageHeight } = getPdfPageSize(aspectRatio, format);
  const pageDims = { width: pageWidth, height: pageHeight };

  return {
    scope,
    manifest,
    metadata,
    values,
    logoUrl,
    defaultLogoUrl: povLogoUrl || null,
    bindings,
    pageDims,
  };
}
