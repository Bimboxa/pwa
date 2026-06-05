import {Box, Link as MuiLink, Typography} from "@mui/material";

export default function DocumentationOutline({headings, activeId, scrollRoot}) {
  if (!headings || headings.length === 0) {
    return (
      <Box
        sx={{
          width: 220,
          minWidth: 220,
          borderLeft: (t) => `1px solid ${t.palette.divider}`,
        }}
      />
    );
  }

  const handleClick = (e, id) => {
    e.preventDefault();
    const root = scrollRoot?.current;
    if (!root) return;
    const target = root.querySelector(`#${CSS.escape(id)}`);
    if (target) target.scrollIntoView({behavior: "smooth", block: "start"});
  };

  return (
    <Box
      component="aside"
      sx={{
        width: 220,
        minWidth: 220,
        borderLeft: (t) => `1px solid ${t.palette.divider}`,
        overflowY: "auto",
        p: 2,
      }}
    >
      <Typography
        variant="overline"
        sx={{color: "text.secondary", fontWeight: 600, display: "block", mb: 1}}
      >
        Plan de la page
      </Typography>
      <Box component="ul" sx={{listStyle: "none", p: 0, m: 0}}>
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <Box
              component="li"
              key={h.id}
              sx={{
                pl: h.depth === 3 ? 1.5 : 0,
                my: 0.25,
              }}
            >
              <MuiLink
                href={`#${h.id}`}
                onClick={(e) => handleClick(e, h.id)}
                underline="none"
                sx={{
                  display: "block",
                  fontSize: 13,
                  color: active ? "primary.main" : "text.secondary",
                  fontWeight: active ? 600 : 400,
                  borderLeft: (t) =>
                    `2px solid ${active ? t.palette.primary.main : "transparent"}`,
                  pl: 1,
                  py: 0.25,
                  "&:hover": {color: "primary.main"},
                }}
              >
                {h.text}
              </MuiLink>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
