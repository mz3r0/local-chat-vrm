import { useCallback, useState } from "react";
import { Message } from "../messages/messages";
import { option_input, option_output } from "../constants/options";

declare global {
  interface Window {
    LanguageModel: {
      availability: (
        props: {
          expectedInputs: { type: "image" | "audio" }[];
        } | void
      ) => Promise<"available" | "downloadable" | "unavailable">;
      create: (options?: {
        expectedInputs?: { type: string; languages?: string[] }[];
        expectedOutputs?: { type: string; languages?: string[] }[];
        temperature?: number;
        topK?: number;
        initialPrompts?: {
          role: "system" | "user" | "assistant";
          content: string;
        }[];
        // Allow additional properties
        [key: string]: any;
      }) => Promise<GeminiNanoSession>;
    };
  }
}

export type GeminiNanoSession = {
  prompt: (
    prompt: string | ({ role: "user", content: { type: "text" | "audio", value: AudioBuffer | Blob | string}[] })[]
  ) => Promise<string>;
  promptStreaming: (
    prompt: string | ({ type: string; content: AudioBuffer } | string)[]
  ) => AsyncGenerator<string, void, undefined>;
};

export const useGeminiNanoChat = () => {
  const [session, setSession] = useState<GeminiNanoSession | null>(null);

  const load = useCallback(async (systemPrompt: string) => {
    if ((await window.LanguageModel.availability()) !== "available") {
      throw Error("Gemini Nano is not ready");
    }

    const options = systemPrompt
      ? {
          initialPrompts: [{ role: "system" as const, content: systemPrompt }],
        }
      : {};
    setSession(await window.LanguageModel.create({
      ...options,
      ...option_input,
      ...option_output,
    }));
  }, []);

  const getChatResponseStream = useCallback(
    async (messageLog: Message[]) => {
      if (session === null) {
        throw Error("Gemini Nano is not loaded");
      }

      const prompt = messageLog[messageLog.length - 1].content;
      const promptStreaming = session.promptStreaming(prompt);

      const stream = new ReadableStream({
        async start(controller: ReadableStreamDefaultController) {
          try {
            for await (const chunk of promptStreaming) {
              // Remove non-ASCII characters (including emoji)
              const cleanedChunk = typeof chunk === "string"
                ? chunk.replace(/[^\x00-\x7F]+/g, "")
                : chunk;
                
              // console.log("-");
              // console.log(chunk);
              // console.log(cleanedChunk);
              controller.enqueue(cleanedChunk.replace(/\[/g, ' [')
              .replace(/\](?=\S)/g, '] ')
              .replace(/\s+/g, ' '));
            }
          } catch (error) {
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });

      return stream;
    },
    [session]
  );

  return { load, getChatResponseStream };
};
