import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { SECTIONS, getSectionCountdown } from "../data/startingSections";

// Horizontal band of the sections of the starting dialog, numbered as a
// rocket countdown (4 · 3 · 2 · 1) so the user takes them in order. The
// selected step is filled orange; the steps already passed are outlined
// orange, the ones ahead are grey.
export default function StepperStartingSections({ sectionKey, onSelect }) {
  // helpers

  const selectedIndex = SECTIONS.findIndex((s) => s.key === sectionKey);

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {SECTIONS.map((section, index) => {
        const selected = index === selectedIndex;
        const passed = index < selectedIndex;
        const countdown = getSectionCountdown(section.key);
        return (
          <Box key={section.key} sx={{ display: "flex", alignItems: "center" }}>
            {index > 0 && (
              <Box
                sx={{
                  width: 28,
                  height: 2,
                  mx: 0.5,
                  borderRadius: 1,
                  bgcolor: (theme) =>
                    index <= selectedIndex
                      ? theme.palette.secondary.main
                      : alpha(theme.palette.text.primary, 0.15),
                }}
              />
            )}
            <ButtonBase
              onClick={() => onSelect(section.key)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                bgcolor: selected ? "white" : "transparent",
                boxShadow: selected ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                "&:hover": { bgcolor: alpha("#ffffff", 0.7) },
              }}
            >
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "2px solid",
                  borderColor: (theme) =>
                    selected || passed
                      ? theme.palette.secondary.main
                      : alpha(theme.palette.text.primary, 0.25),
                  bgcolor: selected ? "secondary.main" : "transparent",
                  color: selected
                    ? "white"
                    : passed
                      ? "secondary.main"
                      : "text.secondary",
                }}
              >
                {countdown}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: selected ? 700 : 500,
                  color: selected ? "text.primary" : "text.secondary",
                  whiteSpace: "nowrap",
                }}
              >
                {section.label}
              </Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
