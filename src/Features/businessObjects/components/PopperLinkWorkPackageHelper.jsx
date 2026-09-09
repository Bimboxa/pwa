import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Paper, Box, Typography } from "@mui/material";
import { AddLink as LinkIcon } from "@mui/icons-material";

import db from "App/db/db";

import useRelsWorkPackageAnnotation from "../hooks/useRelsWorkPackageAnnotation";

// Floating helper shown while the work-package link mode is active (same
// pattern as PopperLinkBusinessObjectHelper): the armed package, an
// instruction, the live count of linked annotations, Escape to exit.
// Mounted unconditionally in MainMapEditorV3 — self-guards on the flag.
export default function PopperLinkWorkPackageHelper() {
  const linkingWorkPackageId = useSelector(
    (s) => s.businessObjects.linkingWorkPackageId
  );
  const workPackagesUpdatedAt = useSelector(
    (s) => s.businessObjects.workPackagesUpdatedAt
  );
  const workPackage = useLiveQuery(async () => {
    if (!linkingWorkPackageId) return null;
    const w = await db.workPackages.get(linkingWorkPackageId);
    return w && !w.deletedAt ? w : null;
  }, [linkingWorkPackageId, workPackagesUpdatedAt]);
  const { value: rels } = useRelsWorkPackageAnnotation({
    workPackageId: linkingWorkPackageId,
  });

  if (!linkingWorkPackageId || !workPackage) return null;

  return (
    <Paper
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        zIndex: 10001,
        pointerEvents: "none",
      }}
    >
      <LinkIcon fontSize="small" color="primary" />
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "2px",
          bgcolor: workPackage.color,
          flexShrink: 0,
        }}
      />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {workPackage.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`Cliquez les annotations à lier · ${rels.length} liée${
            rels.length > 1 ? "s" : ""
          } · Échap pour sortir`}
        </Typography>
      </Box>
    </Paper>
  );
}
