import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import FieldBaseMapAnnotations from "Features/baseMaps/components/FieldBaseMapAnnotations";

export default function TabBaseMapInfo({ baseMap }) {

    return <BoxFlexVStretch>
        <FieldBaseMapAnnotations baseMap={baseMap} />
    </BoxFlexVStretch>
}