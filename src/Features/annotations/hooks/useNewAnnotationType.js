import { useSelector } from "react-redux";

export default function useNewAnnotationType() {
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    return newAnnotation?.type;
}