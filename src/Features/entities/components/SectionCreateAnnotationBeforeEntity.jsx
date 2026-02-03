import { useSelector, useDispatch } from "react-redux";

import { setCreateAnnotationBeforeEntity } from "../entitiesSlice";

import FieldCheck from "Features/form/components/FieldCheck";


export default function SectionCreateAnnotationBeforeEntity() {

    const dispatch = useDispatch()

    // strings

    const label = "Localiser à la création";

    // data

    const check = useSelector(s => s.entities.createAnnotationBeforeEntity)

    // handlers

    function handleCheckChange() {
        dispatch(setCreateAnnotationBeforeEntity(!check))
    }
    return (
        <FieldCheck value={check} onChange={handleCheckChange} label={label} />
    );
}