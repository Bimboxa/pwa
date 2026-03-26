import { useMemo } from "react";
import { useSelector } from "react-redux";

export default function useSelectedNodes() {
    const selectedItems = useSelector((state) => state.selection.selectedItems);

    return useMemo(() => {
        const nodes = selectedItems.filter(item => item.type === "NODE");
        const node = nodes.length > 0 ? nodes[0] : null;
        return { nodes, node };
    }, [selectedItems]);
}