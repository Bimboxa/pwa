export default function toggleSelectedNode(selectedNode, selectedNodes) {

    const ids = selectedNodes.map(node => node.nodeId);

    const id = selectedNode.nodeId;

    if (ids.includes(id)) {
        return selectedNodes.filter(node => node.nodeId !== id);
    } else {
        return [...selectedNodes, selectedNode];
    }
}