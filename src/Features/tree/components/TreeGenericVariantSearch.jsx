import {useState} from "react";

import {RichTreeViewPro} from "@mui/x-tree-view-pro";

import SectionSearch from "./SectionSearch";
import TreeItemGeneric from "./TreeItemGeneric";

import getAllNodesIds from "Features/tree/utils/getAllNodesIds";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function TreeGenericVariantSearch({items, expandAll}) {
  // state

  const [searchText, setSearchText] = useState("");
  const onSearchChange = (text) => {
    setSearchText(text);
  };

  // helpers

  const props = {};

  if (expandAll) props.expandedItems = getAllNodesIds(items);

  console.log("props", props);
  return (
    <BoxFlexVStretch>
      <SectionSearch searchText={searchText} onChange={onSearchChange} />
      <BoxFlexVStretch sx={{width: 1, p: 1}}>
        <RichTreeViewPro
          {...props}
          items={items}
          getItemId={(item) => item.id ?? item.num}
          slots={{item: TreeItemGeneric}}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
