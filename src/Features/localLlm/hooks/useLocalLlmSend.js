import { useDispatch, useSelector } from "react-redux";

import {
  addUserMessage,
  appendToLastAssistantMessage,
  endStreaming,
} from "../localLlmSlice";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { promptOneShot, promptStreaming } from "../services/geminiNanoService";
import {
  getToolByAction,
  buildRouterConstraint,
  buildToolConstraint,
} from "../tools";
import buildRouterPrompt from "../tools/buildRouterPrompt";
import buildPromptContext from "../utils/buildPromptContext";

export default function useLocalLlmSend() {
  const dispatch = useDispatch();

  // strings

  const errorS = "Une erreur est survenue lors de la génération de la réponse.";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // project-wide: the model can target a template of any listing — the
  // created annotation is then assigned to that template's listing
  const templates = useAnnotationTemplates();
  const createAnnotation = useCreateAnnotation();
  const baseMap = useMainBaseMap();

  // main

  const send = async (text) => {
    dispatch(addUserMessage(text));
    try {
      // step 1 - orchestrator: route the prompt to an action

      const routing = await promptOneShot(text, {
        systemPrompt: buildRouterPrompt(),
        responseConstraint: buildRouterConstraint(),
      });
      console.log("[localLlm] router action:", routing?.action);
      const tool = getToolByAction(routing?.action);

      // step 2a - no tool: conversational reply, streamed on the chat session

      if (!tool) {
        await promptStreaming(text, {
          onChunk: (chunk) => dispatch(appendToLastAssistantMessage(chunk)),
        });
        return;
      }

      // step 2b - tool: generate args guided by the tool's skill, then execute

      const contextJson = await buildPromptContext({
        listingId,
        baseMapId,
        templates,
      });

      const result = await promptOneShot(
        `${text}\n\nCONTEXTE DES DONNÉES:\n${contextJson}`,
        {
          systemPrompt: tool.skill,
          responseConstraint: buildToolConstraint(tool),
        }
      );

      console.log(`[localLlm] ${tool.name} args:`, result?.[tool.argsKey]);

      if (result?.message) {
        dispatch(appendToLastAssistantMessage(result.message));
      }

      const summary = await tool.execute(result?.[tool.argsKey], {
        projectId,
        listingId,
        baseMapId,
        baseMap,
        templates: templates ?? [],
        createAnnotation,
        dispatch,
        userText: text,
      });
      dispatch(
        appendToLastAssistantMessage((result?.message ? "\n\n" : "") + summary)
      );
    } catch (err) {
      console.error("[localLlm] prompt failed", err);
      dispatch(appendToLastAssistantMessage(errorS));
    } finally {
      dispatch(endStreaming());
    }
  };

  return send;
}
