/*
 * Other list types
 *
 * - REPORTS
 * - ACTIONS
 * - MASTER_DATA
 */

import { Layers, FileDownload } from "@mui/icons-material";

const listTypes = [
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
