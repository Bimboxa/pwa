import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

// Search results of searchPdfPages: one row per matching page, snippet with
// the matched text highlighted. Click jumps the page picker to the page.
export default function ListPdfSearchResults({
  results,
  selectedPageNumber,
  onResultClick,
}) {
  // strings

  const pageS = "Page";
  const occurrencesS = "occurrences";

  // render

  return (
    <List dense disablePadding>
      {results.map(({ pageNumber, snippet, matchStart, matchEnd, count }) => (
        <ListItemButton
          key={pageNumber}
          divider
          selected={pageNumber === selectedPageNumber}
          onClick={() => onResultClick(pageNumber)}
          sx={{ alignItems: "flex-start" }}
        >
          <ListItemText
            primary={
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                {`${pageS} ${pageNumber}`}
                {count > 1 && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {` · ${count} ${occurrencesS}`}
                  </Typography>
                )}
              </Typography>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {snippet.slice(0, matchStart)}
                <Box
                  component="mark"
                  sx={{ bgcolor: "warning.light", color: "inherit" }}
                >
                  {snippet.slice(matchStart, matchEnd)}
                </Box>
                {snippet.slice(matchEnd)}
              </Typography>
            }
          />
        </ListItemButton>
      ))}
    </List>
  );
}
