/* eslint-disable react/prop-types */
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Alert, Box, Button } from "@mui/material";
import Scan3dHeader from "./Scan3dHeader";
import {
  getScanPanelHost,
  subscribeScanPanelHost,
} from "../services/scanPanelHost";

// Errors belong to the tool drawer, even if its lazy controller cannot render.
export default function ScanPanelError({ children, onRetry }) {
  const host = useSyncExternalStore(subscribeScanPanelHost, getScanPanelHost);
  if (!host) return null;
  return createPortal(
    <>
      <Scan3dHeader />
      <Box sx={{ p: 1.5 }}>
        <Alert
          severity="error"
          action={
            <Button size="small" color="inherit" onClick={onRetry}>
              Réessayer
            </Button>
          }
        >
          {children}
        </Alert>
      </Box>
    </>,
    host
  );
}
