import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {Button} from "@mui/material";

import {DOCUMENTATION_ROOT} from "../constants/documentationRoutes";
import useDocumentationConfig from "../hooks/useDocumentationConfig";

export default function ButtonDocumentation() {
  const documentation = useDocumentationConfig();

  if (!documentation?.enabled) return null;

  return (
    <Button
      component="a"
      href={DOCUMENTATION_ROOT}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      startIcon={<ArrowForwardIcon fontSize="small" />}
      sx={{
        textTransform: "none",
        color: "text.primary",
        fontWeight: 500,
      }}
    >
      documentation
    </Button>
  );
}
