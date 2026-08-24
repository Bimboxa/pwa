import { useDispatch, useSelector } from "react-redux";

import { setTemplateFilter } from "Features/panelDrawing/panelDrawingSlice";

import { Box } from "@mui/material";

// ---------------------------------------------------------------------------
// ChipsTemplateVisibilityFilter — Tous / Visibles / Masqués chips filtering
// the template rows on their `hidden` flag. `disabled` greys them out when
// the filter is meaningless (no template in the listing).
// ---------------------------------------------------------------------------

const FILTERS = [
  { key: "ALL", label: "Tous" },
  { key: "VISIBLE", label: "Visibles" },
  { key: "HIDDEN", label: "Masqués" },
];

export default function ChipsTemplateVisibilityFilter({ disabled }) {
  const dispatch = useDispatch();

  // data

  const templateFilter = useSelector((s) => s.panelDrawing.templateFilter);

  // render

  return (
    <Box sx={{ display: "flex", gap: 0.75, px: 1.5, pb: 1 }}>
      {FILTERS.map(({ key, label }) => {
        const selected = !disabled && key === templateFilter;
        return (
          <Box
            key={key}
            component="button"
            disabled={disabled}
            onClick={() => dispatch(setTemplateFilter(key))}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 4,
              border: "1px solid",
              cursor: disabled ? "default" : "pointer",
              fontFamily: "inherit",
              fontSize: "0.8125rem",
              fontWeight: 500,
              bgcolor: selected ? "grey.900" : "background.paper",
              color: disabled
                ? "text.disabled"
                : selected
                  ? "common.white"
                  : "text.secondary",
              borderColor: selected ? "grey.900" : "divider",
              "&:hover": disabled
                ? {}
                : { bgcolor: selected ? "grey.900" : "action.hover" },
            }}
          >
            {label}
          </Box>
        );
      })}
    </Box>
  );
}
