import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2"
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap"

import { useDispatch, useSelector } from "react-redux"

import { setTempAnnotations } from "Features/annotations/annotationsSlice"

import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel"

import getAutoLayoutLabels from "Features/annotations/utils/getAutoLayoutLabels"

export default function ButtonAutoLayoutLabels({ basePose }) {

    const dispatch = useDispatch();

    // strings

    const label = "Positions auto des étiquettes";

    // data

    const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
    const mainBaseMap = useMainBaseMap();

    const annotations = useAnnotationsV2({
        addDemoAnnotations: false,
        filterByBaseMapId: mainBaseMap?.id,
        excludeListingsIds: hiddenListingsIds,
        withEntity: true,
        withLabel: true,
    });

    // helpers

    const labels = annotations?.filter((a) => a.type === "LABEL");

    // handlers

    async function handleExportClick() {
        console.log("debug_2011_mainBaseMap", labels);
        const autoLayoutLabels = getAutoLayoutLabels(labels, mainBaseMap?.image?.imageSize, {}, basePose?.k);
        dispatch(setTempAnnotations(autoLayoutLabels));
    }

    return (
        <ButtonActionInPanel
            label={label}
            onClick={handleExportClick}
        //variant="download"
        />
    )
}