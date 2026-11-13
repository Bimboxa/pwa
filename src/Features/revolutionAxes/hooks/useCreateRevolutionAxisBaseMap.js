import { useState } from "react";
import { useDispatch } from "react-redux";

import db from "App/db/db";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import getBlankBaseMapGeometry, {
  getBlankBaseMapPrintZone,
} from "Features/baseMaps/utils/getBlankBaseMapGeometry";

import { AXIS_DEFAULT_HEIGHT_M } from "../constants/revolutionAxisPage";
import createRevolutionAxisPlacementService from "../services/createRevolutionAxisPlacementService";
import computeRevolutionAxisPageSetup from "../utils/computeRevolutionAxisPageSetup";
import pickVerticalBaseMapListing from "../utils/pickVerticalBaseMapListing";

// "Fond de plan" of a plan axis with no linked vertical base map yet: creates
// the coupe page on its own — blank A3 vertical base map whose scale and
// orientation hold the axis (computeRevolutionAxisPageSetup), the axis posed
// on it at the base point (createRevolutionAxisPlacementService, which also
// poses the page in 3D), then navigates to it and clears the selection. No
// click required.
//
// Returns { createForAxis(axis) → entity | null, creating }.
export default function useCreateRevolutionAxisBaseMap() {
  const dispatch = useDispatch();

  // data

  const createBaseMapFromImage = useCreateBaseMapFromImage();
  const listings = useProjectBaseMapListings();
  const { groups: verticalBaseMapGroups } = useVerticalBaseMapsByListing();

  // state

  const [creating, setCreating] = useState(false);

  // handlers

  async function createForAxis(axis) {
    if (!axis?.id || creating) return null;
    setCreating(true);
    try {
      const setup = computeRevolutionAxisPageSetup({
        radiusM: axis.radiusM,
        heightM: axis.height ?? AXIS_DEFAULT_HEIGHT_M,
      });
      const { pixelWidth, pixelHeight, meterByPx } =
        getBlankBaseMapGeometry(setup);
      const name = `Coupe ${axis.label ?? "Axe"}`;
      // Plan's own listing = fallback when no listing holds vertical maps.
      const planBaseMap = axis.baseMapId
        ? await db.baseMaps.get(axis.baseMapId)
        : null;
      const listing = pickVerticalBaseMapListing({
        listings,
        verticalBaseMapGroups,
        planListingId: planBaseMap?.listingId,
      });
      // selectOnCreate false: the placement is written first, the view
      // switches once the page is posed.
      const entity = await createBaseMapFromImage({
        whitePage: { width: pixelWidth, height: pixelHeight },
        name,
        listing,
        meterByPx,
        orientation: "VERTICAL",
        printZone: getBlankBaseMapPrintZone({
          ...setup,
          pixelWidth,
          pixelHeight,
        }),
        source: "revolutionAxis",
        selectOnCreate: false,
      });
      if (!entity?.id) return null;

      await createRevolutionAxisPlacementService({
        axisId: axis.id,
        baseMapId: entity.id,
        dispatch,
      });
      dispatch(setSelectedMainBaseMapId(entity.id));
      // End of the process: the plan axis it started from is not on the new
      // page, so it does not stay selected.
      dispatch(clearSelection());
      return entity;
    } catch (e) {
      console.error("[useCreateRevolutionAxisBaseMap] creation failed", e);
      return null;
    } finally {
      setCreating(false);
    }
  }

  return { createForAxis, creating };
}
