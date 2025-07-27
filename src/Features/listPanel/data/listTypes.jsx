/*
 * Other list types
 *
 * - REPORTS
 * - ACTIONS
 * - MASTER_DATA
 */

import { Layers, FileDownload, Image } from "@mui/icons-material";

const listTypes = [
  {
    key: "BASE_MAPS",
    label: "Fonds de plan",
    icon: <Image />,
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
