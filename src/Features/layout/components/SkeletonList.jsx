import {Skeleton, Stack} from "@mui/material";

export default function SkeletonList() {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rectangular" height={100} />
      <Skeleton variant="rectangular" height={100} />
      <Skeleton variant="rectangular" height={100} />
    </Stack>
  );
}
