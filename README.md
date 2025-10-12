# LocalChatVRM

LocalChatVRM was used for a demo exhibition at Google I/O 2025. **The original repository is archived.**

The live version on GitHub pages wasn't usable for me prior to creating a fork.
I decided to experiment with it locally, and restore functionality only for text inputs.
Later, I noticed a muffled audio issue on a device used to test the new working [live version](https://mz3r0.github.io/local-chat-vrm).

In the following sections I relate my experience with this LocalChatVRM.
Coming from a Python background, it was an important first-time real exposure to TypeScript, especially thanks to AI.

---

LocalChatVRM is a demo application that allows you to easily converse with 3D characters in your browser. Based on [ChatVRM](https://github.com/pixiv/ChatVRM) [^1], it operates locally in the browser by utilizing Chrome Built-in AI and Kokoro.js.

You can import VRM files to adjust the voice to match the character and generate responses that include emotional expressions.

The main features of LocalChatVRM utilize the following technologies:

- User voice recognition
    - Chrome Built-in AI Multimodality APIs
- Response generation
    - [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in)
- Speech synthesis
    - [Kokoro](https://github.com/hexgrad/kokoro)
- 3D character display
    - [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)

## Demo

A live demo is available on GitHub Pages. Please note that it will only function correctly in environments where the Chrome Built-in AI Multimodality APIs are supported.

https://mz3r0.github.io/local-chat-vrm/

## Execution

Clone or download this repository.

Install the necessary packages: `npm install`

Once finished, start the development web server: `npm run dev`

The app should start running at: [http://localhost:5173](http://localhost:5173)

-----

## Chrome Built-in AI APIs

LocalChatVRM uses Chrome Built-in AI APIs for text generation.

Configuration of Google Chrome is required to use Chrome Built-in AI. Please refer to the following link for setup instructions:

https://developer.chrome.com/docs/ai/get-started

As a TLDR, esnure that Chrome uses the latest version, and enable the following flags:
- chrome://flags/#optimization-guide-on-device-model
- chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
- chrome://flags/#prompt-api-for-gemini-nano

> Note: I ran into an issue during testing the above on a fresh install. Will update once I've confirmed the minimum setup reequired.

## Chrome Built-in AI Multimodality APIs

LocalChatVRM uses Chrome Built-in AI Multimodality APIs for voice recognition.

As of May 19, 2025, Chrome Built-in AI Multimodality APIs are only available in limited environments.

In environments where Chrome Built-in AI Multimodality APIs are not available, you can use the SpeechSynthesis API by making the following modification:

Assign `"SpeechSynthesis"` to `DEFAULT_TRANSCRIPTION_ENGINE` in `src/features/transcription/transcription.ts`.

```typescript
export const DEFAULT_TRANSCRIPTION_ENGINE: TranscriptionEngine = "SpeechSynthesis";
```

[^1]: Licensed under the [MIT License](https://github.com/pixiv/ChatVRM/blob/main/LICENSE). Copyright (c) pixiv 2023
