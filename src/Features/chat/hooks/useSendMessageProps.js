import toolsZones from "Features/zones/ai/toolsZones";
import getContextContentManageZonesTree from "Features/zones/ai/getContextContentManageZonesTree";
import useZonesTree from "Features/zones/hooks/useZonesTree";

export default function useSendMessageProps() {
  // data

  const {value: zonesTree} = useZonesTree();

  // context

  const contextContent = getContextContentManageZonesTree(zonesTree);

  // tools

  const tools = toolsZones;

  // result

  return {
    contextContent,
    tools,
    store: true,
  };
}
