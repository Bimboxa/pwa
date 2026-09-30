import { useState } from "react";

import readPromptIaProjectOutputZip from "../services/readPromptIaProjectOutputZip";

// Output side of the project « Prompt IA »: the zip the AI chat gave back,
// read and validated. `onLoaded(data)` fires once a zip is accepted.
export default function usePromptIaProjectOutput({ onLoaded }) {
  // state

  const [reading, setReading] = useState(false);
  const [output, setOutput] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  // handlers

  async function loadZip(file) {
    if (!file) return;
    setReading(true);
    setError(null);
    setOutput(null);
    setFileName(file.name);
    try {
      const read = await readPromptIaProjectOutputZip(file);
      if (!read.ok) {
        setError(read.error);
        return;
      }
      setOutput(read);
      onLoaded?.(read.data);
    } catch (e) {
      console.error("[promptIaProject] output zip failed", e);
      setError(`Zip illisible : ${e?.message ?? String(e)}`);
    } finally {
      setReading(false);
    }
  }

  return { reading, output, fileName, error, loadZip };
}
