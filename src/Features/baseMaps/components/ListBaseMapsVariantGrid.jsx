export default function ListBaseMapsVariantGrid({
  baseMaps,
  selection,
  onClick,
}) {
  return (
    <Grid container spacing={2}>
      {baseMaps.map((baseMap) => {
        return (
          <Grid size={6}>
            <Box sx={{ width: 1, height: "50px" }}>
              <Typography>{baseMap.name}</Typography>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
