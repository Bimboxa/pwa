import useZonesTree from "Features/zones/hooks/useZonesTree";
import useCreateOrUpdateZonesTree from "Features/zones/hooks/useCreateOrUpdateZonesTree";
import manageTree from "Features/tree/utils/manageTree";

export default function useProcessAnswer() {
  const createOrUpdateZoneTree = useCreateOrUpdateZonesTree();

  let {value: tree} = useZonesTree();

  const processAnswer = (message) => {
    if (!message) return;
    const {tool_calls} = message;
    if (tool_calls?.length > 0) {
      tool_calls.forEach((tool_call) => {
        const name = tool_call.function.name;
        const args = JSON.parse(tool_call.function.arguments);

        if (name === "manage_zones_tree") {
          console.log("[processAnswer] start with", tree);
          const result = manageTree(tree, args);
          tree = result.tree;
          console.log("[processAnswer] ends with", tree);
        }
      });
      createOrUpdateZoneTree({zonesTree: tree}, {updateSyncFile: true});
    }
  };

  return processAnswer;
}
