import {Typography, Box} from "@mui/material";

import TreeGeneric from "Features/tree/components/TreeGeneric";

import getNodeById from "Features/tree/utils/getNodeById";
import getSelectedNodesWithParents from "Features/tree/utils/getSelectedNodesWithParents";

export default function FieldTreeItemsVariantMobileOverview({
  label,
  value,
  tree,
}) {
  // helpers

  const text = value?.length > 0 ? `x${value?.length}` : "-";

  // helpers - items

  const items = getSelectedNodesWithParents(value, tree);

  return (
    <Box sx={{width: 1}}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{whiteSpace: "pre"}}
      >
        {label}
      </Typography>
      {/* <Typography sx={{whiteSpace: "pre-line"}}>{text}</Typography> */}
      <TreeGeneric items={items} expandAll={true} />
    </Box>
  );
}
