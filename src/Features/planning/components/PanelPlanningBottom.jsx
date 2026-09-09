import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import usePlanningOfListing from "../hooks/usePlanningOfListing";
import useEnsurePlanning from "../hooks/useEnsurePlanning";
import usePlanningPanelResize from "../hooks/usePlanningPanelResize";
import usePlanningConsumedHours from "../hooks/usePlanningConsumedHours";
import useWorkPackageHours from "Features/businessObjects/hooks/useWorkPackageHours";

import PlanningPanelHeader from "./PlanningPanelHeader";
import PlanningGrid from "./PlanningGrid";

import { PANEL_HANDLE_HEIGHT } from "../constants/planningDefaults";

// Bottom panel of the PLANNING module: the time planning (Gantt) of the
// active listing, OVERLAYING the 2D / 3D editor (the editor keeps its size).
// zIndex 5: above the editors' stacking contexts (PanelShowable transforms),
// below the hover left drawer (20). Resizable from its top handle.
export default function PanelPlanningBottom() {
  const panelOpen = useSelector((s) => s.planning.panelOpen);
  const listingId = useSelector((s) => s.businessObjects.selectedListingId);
  const listing = useSelector((s) =>
    listingId ? (s.listings.listingsById?.[listingId] ?? null) : null
  );

  const { value: planning, loading } = usePlanningOfListing({
    listingId: panelOpen ? listingId : null,
  });
  useEnsurePlanning({ listing, planning, loading, enabled: panelOpen });

  const { height, onMouseDown, onDoubleClick } = usePlanningPanelResize();
  const { workPackages, budgetByWorkPackageId, grandTotal } =
    useWorkPackageHours({
      listingId: panelOpen ? listingId : null,
    });
  const { consumedByWorkPackageId, totalConsumed } = usePlanningConsumedHours({
    listingId: panelOpen ? listingId : null,
  });

  if (!panelOpen || !listing) return null;

  return (
    <Box
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: 6,
      }}
    >
      {/* resize handle */}
      <Box
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        sx={{
          height: PANEL_HANDLE_HEIGHT,
          minHeight: PANEL_HANDLE_HEIGHT,
          cursor: "ns-resize",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&:hover": { bgcolor: "action.selected" },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            borderRadius: 2,
            bgcolor: "text.disabled",
          }}
        />
      </Box>
      <PlanningPanelHeader
        planning={planning}
        totalConsumed={totalConsumed}
        totalBudget={grandTotal}
      />
      {planning && (
        <PlanningGrid
          planning={planning}
          workPackages={workPackages}
          budgetByWorkPackageId={budgetByWorkPackageId}
          consumedByWorkPackageId={consumedByWorkPackageId}
        />
      )}
    </Box>
  );
}
