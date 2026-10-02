import { Box, Typography } from "@mui/material";

import useViewers from "../hooks/useViewers";

// Header of a module's default properties panel (empty selection): the
// module label as an italic overline, then a bold title (base map, scope…).
// `children` sits at the right end (e.g. a "more actions" button).
export default function HeaderPanelPropertiesModule({
  moduleKey,
  title,
  children,
}) {
  // data

  const viewers = useViewers();

  // helpers

  const moduleS = viewers.find((v) => v.key === moduleKey)?.label ?? "";

  // render

  return (
    <Box
      sx={{
        p: 0.5,
        pl: 2,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            fontSize: (theme) => theme.typography.caption.fontSize,
          }}
        >
          {moduleS}
        </Typography>
        <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}
