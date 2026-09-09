import { useMemo } from "react";
import { useSelector } from "react-redux";

import usePlanningOfListing from "./usePlanningOfListing";
import usePlanningSlots from "./usePlanningSlots";
import useWorkPackages from "Features/businessObjects/hooks/useWorkPackages";
import useRelsWorkPackageAnnotation from "Features/businessObjects/hooks/useRelsWorkPackageAnnotation";

import getWorkPackagePlayStatusById from "../utils/getWorkPackagePlayStatusById";

const EMPTY = {
  statusByWorkPackageId: new Map(),
  workPackageIdByAnnotationId: new Map(),
};

// Play mode of the active PLANNING listing: Map(workPackageId → status) at
// the play step + Map(annotationId → workPackageId) of the linked
// annotations. Stable EMPTY maps while off (nothing queried); content-keyed
// so useAnnotationsV2's processed memo only re-runs on a real change.
export default function useWorkPackagePlayStatus() {
  const playActive = useSelector((s) => s.planning.playActive);
  const playStep = useSelector((s) => s.planning.playStep);
  const listingId = useSelector((s) =>
    playActive ? (s.businessObjects.selectedListingId ?? null) : null
  );

  const { value: planning } = usePlanningOfListing({ listingId });
  const { value: slots } = usePlanningSlots({ planningId: planning?.id });
  const { value: workPackages } = useWorkPackages({ listingId });
  const { value: rels } = useRelsWorkPackageAnnotation({ listingId });

  const key = useMemo(() => {
    if (!playActive) return "";
    const statusById = getWorkPackagePlayStatusById(
      workPackages,
      slots,
      playStep
    );
    const statusKey = Object.keys(statusById)
      .sort()
      .map((id) => `${id}:${statusById[id]}`)
      .join("|");
    const relsKey = rels
      .map((r) => `${r.annotationId}>${r.workPackageId}`)
      .sort()
      .join("|");
    return `${statusKey}#${relsKey}`;
  }, [playActive, workPackages, slots, playStep, rels]);

  return useMemo(() => {
    if (!key) return EMPTY;
    const [statusKey, relsKey] = key.split("#");
    const statusByWorkPackageId = new Map(
      statusKey
        .split("|")
        .filter(Boolean)
        .map((pair) => pair.split(":"))
    );
    const workPackageIdByAnnotationId = new Map(
      relsKey
        .split("|")
        .filter(Boolean)
        .map((pair) => pair.split(">"))
    );
    return statusByWorkPackageId.size > 0
      ? { statusByWorkPackageId, workPackageIdByAnnotationId }
      : EMPTY;
  }, [key]);
}
