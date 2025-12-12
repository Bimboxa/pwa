import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonExportKmz from "./ButtonExportKmz";
import ButtonAutoLayoutLabels from "./ButtonAutoLayoutLabels";

export default function PanelTools() {
    return (
        <BoxFlexVStretch>
            <ButtonExportKmz />
            <ButtonAutoLayoutLabels />
        </BoxFlexVStretch>
    )
}