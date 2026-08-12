import { Box, List, ListItemButton, Typography } from "@mui/material";

import { PDF_PAGE_DRAG_MIME } from "../utils/pdfPageDrag";

// One page thumbnail: clickable (select the page) AND draggable towards the
// 2D editor via NATIVE HTML5 DnD (instant drag, unlike the app-wide dnd-kit
// sensors and their 250 ms press-and-hold). The drop side lives in
// InteractionLayer, which creates a DETAIL annotation with folio = this page.
function DraggablePdfPageItem({
  resourceId,
  pageNumber,
  rotation,
  selected,
  pending,
  imageUrl,
  onClick,
}) {
  function handleDragStart(e) {
    e.dataTransfer.setData(
      PDF_PAGE_DRAG_MIME,
      JSON.stringify({ resourceId, pageNumber, rotation })
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div draggable onDragStart={handleDragStart} style={{ cursor: "grab" }}>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{ p: 1, display: "flex", justifyContent: "center" }}
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
              border: "1px dashed",
              borderColor: "text.disabled",
              borderRadius: 1,
              color: "text.secondary",
            }}
          >
            <Typography variant="h6" component="span" fontWeight="bold">
              {pageNumber}
            </Typography>
          </Box>
        ) : (
          <img
            width="100%"
            src={imageUrl}
            alt={`Page ${pageNumber}`}
            draggable={false}
            style={{
              display: "block",
              borderRadius: "4px",
              boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
            }}
          />
        )}
      </ListItemButton>
    </div>
  );
}

export default function ListDraggablePdfPages({
  resourceId,
  pageNumber,
  rotation,
  thumbnails,
  onPageNumberChange,
}) {
  // render

  return (
    <List sx={{ width: 1 }} disablePadding>
      {thumbnails.map(({ imageUrl, status }, index) => {
        const currentNum = index + 1;
        return (
          <DraggablePdfPageItem
            key={currentNum}
            resourceId={resourceId}
            pageNumber={currentNum}
            rotation={rotation}
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
