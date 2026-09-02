import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/*
 * Left vertical nav of the configuration selector. Two sections (USAGE = the
 * "type" keyword family, OUVRAGE = the "ouvrage" family) with per-entry
 * counts, acting as COMBINED filters: one selection per section (AND).
 * "Toutes" clears the usage filter; clicking an active entry deselects it.
 * activeFilter = { type: keyword|null, ouvrage: keyword|null }.
 */
export default function MenuKrtoConfigurationsFilter({
  items,
  activeFilter,
  onChange,
}) {
  // strings

  const usageS = "Usage";
  const ouvrageS = "Ouvrage";
  const allS = "Toutes";

  // helpers

  const _items = items ?? [];

  function getKeywords(familyKey) {
    const keywords = [];
    for (const item of _items) {
      for (const keyword of item.keywords?.[familyKey] ?? []) {
        if (!keywords.includes(keyword)) keywords.push(keyword);
      }
    }
    return keywords;
  }

  function getCount(familyKey, keyword) {
    return _items.filter((item) =>
      (item.keywords?.[familyKey] ?? []).includes(keyword)
    ).length;
  }

  const sections = [
    { key: "type", label: usageS },
    { key: "ouvrage", label: ouvrageS },
  ];

  // render

  function renderRow({ key, label, count, active, onClick }) {
    return (
      <ButtonBase
        key={key}
        onClick={onClick}
        sx={{
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderRadius: 1.5,
          textAlign: "left",
          ...(active && {
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
          }),
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: active ? 600 : 400,
            color: active ? "secondary.main" : "text.primary",
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: active ? "secondary.main" : "text.secondary" }}
        >
          {count}
        </Typography>
      </ButtonBase>
    );
  }

  return (
    <Box
      sx={{
        width: 210,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
        overflow: "auto",
      }}
    >
      <Typography
        variant="overline"
        sx={{ px: 1.5, color: "text.secondary", letterSpacing: "0.15em" }}
      >
        {usageS}
      </Typography>
      {renderRow({
        key: "__ALL__",
        label: allS,
        count: _items.length,
        active: !activeFilter?.type,
        onClick: () => onChange({ ...activeFilter, type: null }),
      })}
      {sections.map((section) => (
        <Box
          key={section.key}
          sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
        >
          {section.key !== "type" && (
            <Typography
              variant="overline"
              sx={{
                px: 1.5,
                mt: 2,
                color: "text.secondary",
                letterSpacing: "0.15em",
              }}
            >
              {section.label}
            </Typography>
          )}
          {getKeywords(section.key).map((keyword) =>
            renderRow({
              key: `${section.key}:${keyword}`,
              label: keyword,
              count: getCount(section.key, keyword),
              active: activeFilter?.[section.key] === keyword,
              onClick: () =>
                onChange({
                  ...activeFilter,
                  // clicking the active entry deselects it
                  [section.key]:
                    activeFilter?.[section.key] === keyword ? null : keyword,
                }),
            })
          )}
        </Box>
      ))}
    </Box>
  );
}
