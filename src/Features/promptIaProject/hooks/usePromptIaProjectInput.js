import { useState } from "react";

import buildPromptIaProjectZip from "../services/buildPromptIaProjectZip";
import readDroppedEntries from "../utils/readDroppedEntries";
import expandZipFiles, { mergeEntries } from "../utils/expandZipFiles";

const MAX_DESCRIPTION_LENGTH = 4000;

// Input side of the project « Prompt IA »: the description, the dropped
// files (folders and zips expanded) and the zip handed to the AI chat.
// `downloaded` is reset by any change: it describes the current input.
export default function usePromptIaProjectInput({ project }) {
  // state

  const [entries, setEntries] = useState([]);
  const [description, setDescriptionState] = useState("");
  const [reading, setReading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [downloaded, setDownloaded] = useState(null);

  // helpers

  const canDownload = Boolean(description.trim()) && !reading && !building;

  async function addEntries(readEntries) {
    setReading(true);
    setError(null);
    try {
      const added = await expandZipFiles(await readEntries);
      setEntries((current) => mergeEntries(current, added));
      setDownloaded(null);
    } catch (e) {
      console.error("[promptIaProject] read failed", e);
      setError(`Lecture impossible : ${e?.message ?? String(e)}`);
    } finally {
      setReading(false);
    }
  }

  // handlers

  function setDescription(text) {
    setDescriptionState(text.slice(0, MAX_DESCRIPTION_LENGTH));
    setDownloaded(null);
  }

  function addFromDrop(dataTransfer) {
    // the entries must be read before the first await
    addEntries(readDroppedEntries(dataTransfer));
  }

  function addFiles(files) {
    addEntries(files.map((file) => ({ path: file.name, file })));
  }

  function remove(path) {
    setEntries((current) => current.filter((e) => e.path !== path));
    setDownloaded(null);
  }

  async function download() {
    if (!canDownload) return;
    setBuilding(true);
    setError(null);
    try {
      setDownloaded(
        await buildPromptIaProjectZip({ project, description, entries })
      );
    } catch (e) {
      console.error("[promptIaProject] zip failed", e);
      setError(`Zip impossible : ${e?.message ?? String(e)}`);
    } finally {
      setBuilding(false);
    }
  }

  return {
    entries,
    description,
    setDescription,
    maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
    reading,
    building,
    error,
    downloaded,
    canDownload,
    addFromDrop,
    addFiles,
    remove,
    download,
  };
}
