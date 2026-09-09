import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setLinkingWorkPackageId } from "../businessObjectsSlice";

import {
  Box,
  Chip,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddLink, MoreHoriz } from "@mui/icons-material";

import useToggleWorkPackageSolo from "../hooks/useToggleWorkPackageSolo";

import MenuActionsWorkPackage from "./MenuActionsWorkPackage";
import formatConsumedVsBudget from "Features/planning/utils/formatConsumedVsBudget";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import { getBusinessObjectUnitLabel } from "../utils/getBusinessObjectQtyLabel";
import { formatHours } from "../utils/hoursRatioConversions";

// Row of a work package in the "Work packages" tab: colour, label, linked
// annotations count, consumed / budget hours, picking-mode toggle, menu;
// under it, the DERIVED tasks (per global layer) with their hours. Click =
// SOLO toggle (only the package's annotations stay displayed).
export default function WorkPackageRow({
  workPackage,
  listing,
  annotations = [],
  tasks = [],
  budget = null,
  consumed = 0,
}) {
  const dispatch = useDispatch();
  const selectedWorkPackageId = useSelector(
    (s) => s.businessObjects.selectedWorkPackageId
  );
  const linkingWorkPackageId = useSelector(
    (s) => s.businessObjects.linkingWorkPackageId
  );
  const toggleWorkPackageSolo = useToggleWorkPackageSolo();

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const isSelected = selectedWorkPackageId === workPackage.id;
  const isLinking = linkingWorkPackageId === workPackage.id;
  const { text: hoursS, diff } = formatConsumedVsBudget(consumed, budget);
  const hoursColor =
    diff == null || consumed === 0
      ? "text.secondary"
      : diff > 0
        ? "error.main"
        : "success.main";

  // handlers

  function handleClick() {
    toggleWorkPackageSolo(workPackage, annotations);
  }

  function handleLinkingClick(e) {
    e.stopPropagation();
    dispatch(setLinkingWorkPackageId(isLinking ? null : workPackage.id));
  }

  function handleMenuClick(e) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }

  // render

  return (
    <>
      <ListItemButton
        component="div"
        selected={isSelected}
        onClick={handleClick}
        sx={{
          pl: 2,
          bgcolor: "background.paper",
          "&:hover .work-package-actions": { visibility: "visible" },
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            minWidth: 12,
            borderRadius: "2px",
            bgcolor: workPackage.color,
            mr: 1,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {workPackage.label}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block", lineHeight: 1.2 }}
          >
            {annotations.length > 0
              ? `${annotations.length} annotation${annotations.length > 1 ? "s" : ""}`
              : "Aucune annotation liée"}
          </Typography>
        </Box>
        <Tooltip title="Heures consommées (planning) / budget (postes × quantités)">
          <Typography
            variant="caption"
            sx={{ ml: 0.5, whiteSpace: "nowrap", color: hoursColor }}
          >
            {hoursS}
          </Typography>
        </Tooltip>
        {tasks.length > 0 && (
          <Chip
            label={tasks.length}
            size="small"
            sx={{ ml: 0.5, height: 16, fontSize: "0.65rem" }}
          />
        )}
        <Box
          className="work-package-actions"
          sx={{
            visibility: isLinking ? "visible" : "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <IconButton
            size="small"
            onClick={handleLinkingClick}
            title={
              isLinking
                ? "Quitter le mode liaison"
                : "Lier des annotations au clic sur la carte"
            }
            color={isLinking ? "primary" : "default"}
          >
            <AddLink sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreHoriz sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </ListItemButton>

      {/* derived tasks */}
      {tasks.map((t) => (
        <Box
          key={t.businessObjectId}
          sx={{
            display: "flex",
            alignItems: "center",
            pl: 5.5,
            pr: 2,
            py: 0.25,
            bgcolor: "grey.50",
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{ flex: 1, minWidth: 0, color: "text.secondary" }}
          >
            {t.label}
            {t.qty != null &&
              ` · ${formatBusinessObjectNumber(t.qty, 1)} ${getBusinessObjectUnitLabel(t.unit)}`}
          </Typography>
          <Typography
            variant="caption"
            sx={{ ml: 1, whiteSpace: "nowrap", color: "text.secondary" }}
          >
            {t.hours != null
              ? formatHours(t.hours, { withDays: false })
              : "sans ratio"}
          </Typography>
        </Box>
      ))}

      {menuAnchor && (
        <MenuActionsWorkPackage
          anchorEl={menuAnchor}
          workPackage={workPackage}
          listing={listing}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </>
  );
}
