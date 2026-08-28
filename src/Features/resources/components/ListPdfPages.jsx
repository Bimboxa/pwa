import { alpha, Box, List, ListItemButton, Typography } from "@mui/material";

// One page thumbnail, clickable to select the page in the viewer.
function PdfPageItem({ pageNumber, selected, pending, imageUrl, onClick }) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        p: 1,
        display: "flex",
        justifyContent: "center",
        "&.Mui-selected": {
          bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.2),
          },
        },
      }}
    >
      {pending ? (
        <Box
          sx={{
            width: "100%",
            aspectRatio: "210 / 297",
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            border: selected ? "2px solid" : "1px dashed",
            borderColor: selected ? "secondary.main" : "text.disabled",
            borderRadius: 1,
            color: "text.secondary",
          }}
        >
          <Typography variant="h6" component="span" fontWeight="bold">
            {pageNumber}
          </Typography>
        </Box>
      ) : (
        <Box
          component="img"
          width="100%"
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          draggable={false}
          sx={{
            display: "block",
            borderRadius: "4px",
            boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
            border: "2px solid",
            borderColor: selected ? "secondary.main" : "transparent",
          }}
        />
      )}
    </ListItemButton>
  );
}

export default function ListPdfPages({
  pageNumber,
  thumbnails,
  onPageNumberChange,
}) {
  // render

  return (
    <List sx={{ width: 1 }} disablePadding>
      {thumbnails.map(({ imageUrl, status }, index) => {
        const currentNum = index + 1;
        return (
          <PdfPageItem
            key={currentNum}
            pageNumber={currentNum}
            selected={pageNumber === currentNum}
            pending={status === "pending"}
            imageUrl={imageUrl}
            onClick={() => onPageNumberChange(currentNum)}
          />
        );
      })}
    </List>
  );
}
