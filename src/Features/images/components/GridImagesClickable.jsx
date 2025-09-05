import { Box, ListItemButton } from "@mui/material";

export default function GridImagesClickable({
  images,
  selectedUrl,
  onClick,
  columns = 2,
  containerWidth,
}) {
  // const

  const gap = 8; // 8px

  // helpers

  const dim = (containerWidth - gap * (columns + 1)) / columns;

  // handlers

  function handleClick(image) {
    onClick(image);
  }
  // return

  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        flexWrap: "wrap",
        px: `${gap / 2}px`,
        //border: "1px solid red", // /!\ break the dim computation
      }}
    >
      {images.map((image) => {
        return (
          <Box
            key={image.url}
            sx={{
              px: `${gap / 2}px`,
              py: `${gap / 2}px`,
            }}
          >
            <ListItemButton
              selected={selectedUrl === image.url}
              onClick={() => handleClick(image)}
              sx={{
                width: dim,
                height: dim,
                border: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <img src={image.url} width={"100%"} />
            </ListItemButton>
          </Box>
        );
      })}
    </Box>
  );
}
