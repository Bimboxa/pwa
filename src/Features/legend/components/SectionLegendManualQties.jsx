import { useEffect, useRef, useState } from "react";

import { Box, InputBase, Typography } from "@mui/material";

// Shared "Quantités manuelles" rows, used by the portfolio legend panel and
// the capture/POV legend section. One line per legend item: label, manual qty
// input (placeholder = computed value) and deviation (%) vs the computed qty.
//
// Props:
// - rows: [{ id, label, computedValue, unit, computedLabel }]
// - hardCodedQtiesById: { [templateId]: number }
// - onChange(templateId, valueOrNull) — null clears the override.

export default function SectionLegendManualQties({
  rows = [],
  hardCodedQtiesById,
  onChange,
}) {
  if (!rows.length)
    return (
      <Typography variant="caption" color="text.secondary">
        Aucun élément de légende.
      </Typography>
    );

  // The deviation column is only reserved once at least one row is
  // overridden — otherwise the inputs sit flush to the right edge.
  const showDeviation = rows.some((row) =>
    Number.isFinite(hardCodedQtiesById?.[row.id])
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {rows.map((row) => (
        <RowManualQty
          key={row.id}
          row={row}
          value={hardCodedQtiesById?.[row.id]}
          onChange={(v) => onChange(row.id, v)}
          showDeviation={showDeviation}
        />
      ))}
    </Box>
  );
}

function RowManualQty({ row, value, onChange, showDeviation }) {
  const { label, computedValue, unit, computedLabel } = row;

  // state

  const manualQty = Number.isFinite(value) ? value : null;
  const [localValue, setLocalValue] = useState(manualQty ?? "");
  const debounceTimer = useRef(null);
  const lastCommittedRef = useRef(manualQty);

  // Sync from the prop only when it diverges from what this row committed —
  // otherwise the debounced round-trip would clobber in-progress typing.
  useEffect(() => {
    if (manualQty === lastCommittedRef.current) return;
    lastCommittedRef.current = manualQty;
    setLocalValue(manualQty ?? "");
  }, [manualQty]);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // helpers

  let deviationLabel = "";
  if (
    manualQty != null &&
    Number.isFinite(computedValue) &&
    computedValue !== 0
  ) {
    const pct = ((manualQty - computedValue) / computedValue) * 100;
    deviationLabel = `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)} %`;
  } else if (manualQty != null) {
    deviationLabel = "—";
  }

  // handlers

  function handleChange(e) {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const str = String(newValue).replace(",", ".").trim();
      if (str === "") {
        lastCommittedRef.current = null;
        onChange(null);
        return;
      }
      const num = parseFloat(str);
      if (Number.isFinite(num)) {
        lastCommittedRef.current = num;
        onChange(num);
      }
    }, 400);
  }

  function handleKeyDown(e) {
    // Keep Backspace/Delete from triggering editor shortcuts.
    if (e.key === "Backspace" || e.key === "Delete") e.stopPropagation();
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography
        variant="caption"
        noWrap
        title={`${label} — calculé : ${computedLabel || "-"}`}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {label}
      </Typography>
      <InputBase
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={
          Number.isFinite(computedValue) ? String(computedValue) : "-"
        }
        sx={{
          width: 64,
          "& .MuiInputBase-input": {
            fontSize: 12,
            textAlign: "right",
            bgcolor: "background.default",
            borderRadius: 1,
            px: 0.5,
            py: 0.25,
          },
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ width: 22, flexShrink: 0 }}
      >
        {unit}
      </Typography>
      {showDeviation && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ width: 52, flexShrink: 0, textAlign: "right" }}
        >
          {deviationLabel}
        </Typography>
      )}
    </Box>
  );
}
