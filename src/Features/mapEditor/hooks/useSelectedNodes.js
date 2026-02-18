import { useSelector } from "react-redux";

export default function useSelectedNodes() {
    const selectedItems = useSelector((state) => state.selection.selectedItems)
    const nodes = selectedItems.filter(item => item.type === "NODE");
    const node = selectedItems.length > 0 ? nodes[0] : null;

    return { nodes, node }
    //const selectedNodes = selectedItems;
}