import {RichTreeViewPro} from "@mui/x-tree-view-pro";

export default function TreeGeneric({items}) {
  return (
    <RichTreeViewPro items={items} getItemId={(item) => item.id ?? item.num} />
  );
}
