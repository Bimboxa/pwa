
import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelEditBaseMap from "./PanelEditBaseMap";

export default function DialogEditBaseMap({ open, onClose }) {
    return <DialogGeneric open={open} onClose={onClose}>
        <PanelEditBaseMap />
    </DialogGeneric>
}