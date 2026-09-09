import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { triggerPlanningUpdate, setSelectedSlotId } from "../planningSlice";

import * as services from "../services/planningServices";

// Bound write actions of the planning: each call runs its service then
// dispatches ONE triggerPlanningUpdate (the hooks re-query on the tick).
export default function usePlanningActions() {
  const dispatch = useDispatch();

  return useMemo(() => {
    const wrap =
      (fn) =>
      async (...args) => {
        const result = await fn(...args);
        dispatch(triggerPlanningUpdate());
        return result;
      };
    return {
      createPlanning: wrap(services.createPlanningService),
      updatePlanning: wrap(services.updatePlanningService),
      createResource: wrap(services.createPlanningResourceService),
      updateResource: wrap(services.updatePlanningResourceService),
      moveResource: wrap(services.movePlanningResourceService),
      deleteResource: wrap(services.deletePlanningResourceService),
      createSlot: wrap(services.createPlanningSlotService),
      updateSlot: wrap(services.updatePlanningSlotService),
      deleteSlot: wrap(async (slotId) => {
        await services.deletePlanningSlotService(slotId);
        dispatch(setSelectedSlotId(null));
      }),
    };
  }, [dispatch]);
}
