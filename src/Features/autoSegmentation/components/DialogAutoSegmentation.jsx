import {Dialog, DialogTitle} from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function DialogAutoSegmentation({open, onClose}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Segmentation automatique</DialogTitle>
      <BoxCenter>
        <p>TODO</p>
      </BoxCenter>
    </Dialog>
  );
}
