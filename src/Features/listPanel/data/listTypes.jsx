/*
 * Other list types
 *
 * - REPORTS
 * - ACTIONS
 * - MASTER_DATA
 * - LAYERS
 */

import {
  Layers,
  FileDownload,
  Image,
  Category,
  Map,
} from "@mui/icons-material";

const listTypes = [
  {
    key: "BASE_MAP_VIEWS",
    label: "Plans",
    icon: <Map />,
  },
  {
    key: "BASE_MAPS",
    label: "Fonds de plan",
    icon: <Image />,
  },
  {
    key: "LOCATED_ENTITIES",
    label: "Annotations",
    icon: <Category />,
  },
  {
    key: "LAYERS",
    label: "Calques",
    icon: <Layers />,
  },
  {
    key: "EXPORTS",
    label: "Exports",
    icon: <FileDownload />,
  },
];

export default listTypes;
