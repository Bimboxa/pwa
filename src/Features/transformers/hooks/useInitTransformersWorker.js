import { useEffect, useRef } from "react";

import { useDispatch } from "react-redux";
import { setReady, setDisabled, addProgressItem, updateProgressItem, removeProgressItem, setOutput } from "../transformersSlice";

export default function useInitTransformersWorker() {

    const workerRef = useRef();
    const dispatch = useDispatch();



    useEffect(() => {

        // Create the worker if it does not yet exist.
        workerRef.current ??= new Worker(new URL('../transformersWorker.js', import.meta.url), {
            type: 'module'
        });

        // Create a callback function for messages from the worker thread.
        const onMessageReceived = (e) => {
            let item;
            switch (e.data.status) {
                case 'initiate':
                    console.log('initiate worker', e.data);
                    // Model file start load: add a new progress item to the list.
                    dispatch(setReady(false));
                    dispatch(addProgressItem(e.data));
                    break;

                case 'progress':
                    // Model file progress: update one of the progress items.
                    item = { file: e.data.file, progress: e.data.progress }
                    dispatch(updateProgressItem(item))
                    break;

                case 'done':
                    item = { file: e.data.file }
                    dispatch(removeProgressItem(item))
                    break;

                case 'ready':
                    // Pipeline ready: the worker is ready to accept messages.
                    dispatch(setReady(true));
                    break;

                case 'update':
                    // Generation update: update the output text.
                    dispatch(setOutput(e.data.output));
                    break;

                case 'complete':
                    // Generation complete: re-enable the "Translate" button
                    dispatch(setOutput(e.data.output));
                    dispatch(setDisabled(false));
                    break;
            }
        };

        // Attach the callback function as an event listener.
        workerRef.current.addEventListener('message', onMessageReceived);

        // Define a cleanup function for when the component is unmounted.
        return () => workerRef.current.removeEventListener('message', onMessageReceived);

    })

    return workerRef.current
}