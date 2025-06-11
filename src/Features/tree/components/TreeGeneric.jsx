import {RichTreeViewPro} from "@mui/x-tree-view-pro";
import TreeItemGeneric from "./TreeItemGeneric";

import getAllNodesIds from "Features/tree/utils/getAllNodesIds";

export default function TreeGeneric({items, expandAll}) {
  const props = {};

  if (expandAll) props.expandedItems = getAllNodesIds(items);

  console.log("props", props);

  // handlers

  function handleMoreClick(item) {
    console.log("More clicked for item:", item);
  }
  return (
    <RichTreeViewPro
      {...props}
      items={items}
      getItemId={(item) => item.id ?? item.num}
      slots={{item: TreeItemGeneric}}
      slotProps={{
        item: {
          onMoreClick: handleMoreClick,
        },
      }}
    />
  );
}
