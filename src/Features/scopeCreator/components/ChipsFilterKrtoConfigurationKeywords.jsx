import { Box, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

const selectedSx = {
  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
  color: "secondary.main",
  fontWeight: 500,
  border: "1px solid",
  borderColor: (theme) => alpha(theme.palette.secondary.main, 0.5),
  "&:hover": {
    bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.2),
  },
};

// singleSelect: one keyword max per family (clicking the selected chip clears it)
export default function ChipsFilterKrtoConfigurationKeywords({
  keywordFamilies,
  items,
  selectedKeywordsByFamily,
  onChange,
  singleSelect,
}) {
  // helpers — union of the keywords present in the items, per family

  const keywordsByFamily = {};
  for (const family of keywordFamilies ?? []) {
    const keywords = [];
    for (const item of items ?? []) {
      for (const keyword of item.keywords?.[family.key] ?? []) {
        if (!keywords.includes(keyword)) keywords.push(keyword);
      }
    }
    keywordsByFamily[family.key] = keywords;
  }

  // handlers

  function handleToggle(familyKey, keyword) {
    const current = selectedKeywordsByFamily?.[familyKey] ?? [];
    let next;
    if (singleSelect) {
      next = current.includes(keyword) ? [] : [keyword];
    } else {
      next = current.includes(keyword)
        ? current.filter((k) => k !== keyword)
        : [...current, keyword];
    }
    onChange({ ...selectedKeywordsByFamily, [familyKey]: next });
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {keywordFamilies?.map((family) => {
        const keywords = keywordsByFamily[family.key];
        if (!keywords?.length) return null;
        return (
          <Box
            key={family.key}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", minWidth: 56 }}
            >
              {family.label}
            </Typography>
            {keywords.map((keyword) => {
              const selected = (
                selectedKeywordsByFamily?.[family.key] ?? []
              ).includes(keyword);
              return (
                <Chip
                  key={keyword}
                  label={keyword}
                  size="small"
                  clickable
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => handleToggle(family.key, keyword)}
                  sx={selected ? selectedSx : { color: "text.secondary" }}
                />
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
