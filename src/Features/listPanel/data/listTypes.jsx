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
    key: "BASE_MAP_VIEWS",
    label: "Plans",
    icon: <Map />,
  },
];

export default listTypes;
