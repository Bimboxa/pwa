import { useDispatch } from "react-redux";

import { setNewEntity } from "Features/entities/entitiesSlice";

import useNewEntity from "Features/entities/hooks/useNewEntity";


import FieldTextV2 from "Features/form/components/FieldTextV2";



export default function FieldNewEntityLabel() {

    const dispatch = useDispatch();

    // data

    const newEntity = useNewEntity();

    // handlers

    function handleChange(text) {
        dispatch(setNewEntity({ ...newEntity, label: text }));
    }

    return <FieldTextV2
        label="Libellé de la forme 2D"
        value={newEntity?.label}
        onChange={handleChange}
        options={{ showAsLabelAndField: true }}
    />
}