import { useMemo } from "react";

import {
  Checkbox,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useGlobalLayers from "Features/layers/hooks/useGlobalLayers";

import buildBusinessObjectsTree from "../utils/buildBusinessObjectsTree";
import { formatHoursRatio } from "../utils/hoursRatioConversions";

// Tasks ("postes de travail") a work package covers: checklist of the
// listing's tasks (tree order, titles excluded), with their ratio and their
// global layer. `value` is the stored workStationIds; an EMPTY selection
// means "every task applies" (the derived default) — the caption says so.
export default function SectionWorkPackageTasksPicker({
  listingId,
  value,
  onChange,
  maxHeight = 240,
}) {
  const { value: businessObjects } = useBusinessObjects({ listingId });
  const globalLayers = useGlobalLayers();

  const tasks = useMemo(
    () =>
      buildBusinessObjectsTree(businessObjects ?? []).filter(
        ({ businessObject }) => !businessObject.isTitle
      ),
    [businessObjects]
  );
  const layerNameById = useMemo(() => {
    const byId = {};
    globalLayers.forEach((l) => {
      byId[l.id] = l.name;
    });
    return byId;
  }, [globalLayers]);

  const selected = Array.isArray(value) ? value : [];

  function handleToggle(id) {
    onChange(
      selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id]
    );
  }

  if (tasks.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
        Aucun poste de travail dans cette liste.
      </Typography>
    );
  }

  return (
    <>
      <List dense disablePadding sx={{ maxHeight, overflow: "auto" }}>
        {tasks.map(({ businessObject, depth }) => {
          const layerName = businessObject.globalLayerId
            ? (layerNameById[businessObject.globalLayerId] ?? "calque supprimé")
            : null;
          const ratio = formatHoursRatio(businessObject);
          return (
            <ListItemButton
              key={businessObject.id}
              dense
              onClick={() => handleToggle(businessObject.id)}
              sx={{ pl: 0.5 + depth * 2 }}
            >
              <Checkbox
                size="small"
                edge="start"
                checked={selected.includes(businessObject.id)}
                tabIndex={-1}
                disableRipple
                sx={{ p: 0.5, mr: 0.5 }}
              />
              <ListItemText
                primary={businessObject.label}
                secondary={[ratio ?? "sans ratio", layerName]
                  .filter(Boolean)
                  .join(" · ")}
                slotProps={{
                  primary: { variant: "body2", noWrap: true },
                  secondary: { variant: "caption", noWrap: true },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
      {selected.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Aucun poste coché : tous les postes de la liste s&apos;appliquent.
        </Typography>
      )}
    </>
  );
}
