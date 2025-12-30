import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setOpenBaseMapCreator } from "../baseMapCreatorSlice";

import useCreateBaseMaps from "../hooks/useCreateBaseMaps";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";

export default function ButtonCreateBaseMaps() {
    const dispatch = useDispatch();

    // data

    const createBaseMaps = useCreateBaseMaps();
    const tempBaseMaps = useSelector((s) => s.baseMapCreator.tempBaseMaps);

    // state

    const [loading, setLoading] = useState(false);

    // handlers

    async function handleCreateClick() {
        setLoading(true);
        await createBaseMaps(tempBaseMaps);
        setLoading(false);
        dispatch(setOpenBaseMapCreator(false));
        dispatch(setShowCreateBaseMapSection(false));
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