import { useMemo } from "react";
import { useSelector } from "react-redux";

export default function useSelectedNodes() {
    const selectedItems = useSelector((state) => state.selection.selectedItems);

    return useMemo(() => {
        // ANNOTATION_LABEL items are map nodes too (nodeId "label::<id>"):
        // they drag / hide / live-copy like any node, only their panel differs.
        const nodes = selectedItems.filter(
            (item) => item.type === "NODE" || item.type === "ANNOTATION_LABEL"
        );
        const node = nodes.length > 0 ? nodes[0] : null;
        return { nodes, node };
    }, [selectedItems]);
}