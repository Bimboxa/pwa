import { useState } from "react";

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import useWorkPackageHours from "../hooks/useWorkPackageHours";
import usePlanningConsumedHours from "Features/planning/hooks/usePlanningConsumedHours";

import WorkPackageRow from "./WorkPackageRow";
import DialogWorkPackageForm from "./DialogWorkPackageForm";
import ButtonTogglePlanningPanel from "Features/planning/components/ButtonTogglePlanningPanel";

import { formatHours } from "../utils/hoursRatioConversions";

// "Work packages" tab of the PLANNING panel: the packages of the listing
// (linked annotations × derived tasks → hours), the planning panel toggle
// and the listing totals (consumed / budget).
export default function SectionWorkPackages({ listing }) {
  const {
    workPackages,
    annotationsByWorkPackageId,
    tasksByWorkPackageId,
    budgetByWorkPackageId,
    grandTotal,
  } = useWorkPackageHours({ listingId: listing.id });
  const { consumedByWorkPackageId, totalConsumed } = usePlanningConsumedHours({
    listingId: listing.id,
  });

  const [openCreate, setOpenCreate] = useState(false);

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          mt: -0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
          {`${workPackages.length} tâche${workPackages.length > 1 ? "s" : ""}`}
        </Typography>
        <ButtonTogglePlanningPanel />
      </Box>

      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0, p: 1 }}>
        <List dense disablePadding>
          {workPackages.map((wp) => (
            <WorkPackageRow
              key={wp.id}
              workPackage={wp}
              listing={listing}
              annotations={annotationsByWorkPackageId[wp.id] ?? []}
              tasks={tasksByWorkPackageId[wp.id] ?? []}
              budget={budgetByWorkPackageId[wp.id] ?? null}
              consumed={consumedByWorkPackageId[wp.id] ?? 0}
            />
          ))}
          {workPackages.length === 0 && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ pl: 2, py: 0.5, display: "block" }}
            >
              Aucune tâche. Créez-en une, puis liez-lui des annotations (mode
              liaison au clic, ou sélection multiple sur la carte).
            </Typography>
          )}
        </List>

        <ListItemButton
          onClick={() => setOpenCreate(true)}
          sx={{ pl: 2, color: "text.disabled" }}
        >
          <Add sx={{ fontSize: 20, mr: 1 }} color="disabled" />
          <ListItemText
            primary="Nouvelle tâche"
            slotProps={{
              primary: { variant: "body2", color: "text.disabled" },
            }}
          />
        </ListItemButton>

        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            mx: -1,
            mb: -1,
            px: 2,
            py: 0.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "panel.sectionBg",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Total
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {`${formatHours(totalConsumed, { withDays: false })} / ${formatHours(
              grandTotal
            )}`}
          </Typography>
        </Box>
      </Box>

      {openCreate && (
        <DialogWorkPackageForm
          open
          listing={listing}
          onClose={() => setOpenCreate(false)}
        />
      )}
    </Box>
  );
}
