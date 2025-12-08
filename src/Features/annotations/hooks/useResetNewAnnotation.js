import { useDispatch } from "react-redux";

import { setNewAnnotation } from "../annotationsSlice";
import theme from "Styles/theme";

export default function useResetNewAnnotation() {
    const dispatch = useDispatch();

    function reset() {
        dispatch(setNewAnnotation({
            fillColor: theme.palette.secondary.main,
            strokeColor: theme.palette.secondary.main,
        }));
    }

    return reset;
}