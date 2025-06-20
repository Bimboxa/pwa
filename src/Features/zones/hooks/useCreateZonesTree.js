import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import exampleZones from "../data/exampleZones.md?raw";
import parseMarkdownToTreeZones from "../utils/parseMarkdownToTreeZones";

export default function useCreateZonesTree(options) {
  // options

  const createExample = options?.createExample;

  // data

  const createEntity = useCreateEntity();

  const create = async (zonesTree, options2) => {
    const data = {
      zonesTree: createExample
        ? parseMarkdownToTreeZones(exampleZones)
        : zonesTree,
    };

    await createEntity(data, options2);
  };

  return create;
}
