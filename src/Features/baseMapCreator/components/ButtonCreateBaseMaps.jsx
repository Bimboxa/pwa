import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setOpenBaseMapCreator, clearSourceContainer } from "../baseMapCreatorSlice";

import useCreateBaseMaps from "../hooks/useCreateBaseMaps";
import useLinkBaseMapToContainer from "../hooks/useLinkBaseMapToContainer";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setShowCreateBaseMapSection, setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

export default function ButtonCreateBaseMaps() {
    const dispatch = useDispatch();

    // data

    const createBaseMaps = useCreateBaseMaps();
    const linkBaseMapToContainer = useLinkBaseMapToContainer();
    const tempBaseMaps = useSelector((s) => s.baseMapCreator.tempBaseMaps);
    const sourceContainerId = useSelector((s) => s.baseMapCreator.sourceContainerId);

    // state

    const [loading, setLoading] = useState(false);

    // handlers

    async function handleCreateClick() {
        setLoading(true);
        const baseMaps = await createBaseMaps(tempBaseMaps);
        setLoading(false);
        dispatch(setOpenBaseMapCreator(false));
        dispatch(setShowCreateBaseMapSection(false));

        const baseMap0 = baseMaps?.[0];
        if (baseMap0) {
            dispatch(setSelectedMainBaseMapId(baseMap0.id));
        }

        if (sourceContainerId && baseMap0) {
            await linkBaseMapToContainer(baseMap0.id);
            dispatch(clearSourceContainer());
        }
    }

    // helpers

    const disabled = !tempBaseMaps.length;

    return (
        <ButtonGeneric
            size="small"
            label="Créer les fonds de plans"
            onClick={handleCreateClick}
            variant="contained"
            color="secondary"
            disabled={disabled}
            loading={loading}
        />
    );
}
