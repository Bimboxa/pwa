import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import {
  triggerWorkPackagesUpdate,
  triggerRelsWorkPackageAnnotationUpdate,
} from "../businessObjectsSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import { triggerPlanningUpdate } from "Features/planning/planningSlice";

import migrateWorkZonesToWorkPackagesService from "../services/migrateWorkZonesToWorkPackagesService";

// App init: converts the legacy v34 work zones into work packages once
// (no-op on a clean database).
export default function useInitMigrateWorkZones() {
  const dispatch = useDispatch();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const { migrated } = await migrateWorkZonesToWorkPackagesService();
        if (migrated > 0) {
          dispatch(triggerWorkPackagesUpdate());
          dispatch(triggerRelsWorkPackageAnnotationUpdate());
          dispatch(triggerAnnotationsUpdate());
          dispatch(triggerAnnotationTemplatesUpdate());
          dispatch(triggerPlanningUpdate());
          console.log(
            `[migrateWorkZones] ${migrated} work zone(s) → work packages`
          );
        }
      } catch (e) {
        console.error("[migrateWorkZones]", e);
      }
    })();
  }, [dispatch]);
}
