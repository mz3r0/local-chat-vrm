# Mini Log

_In chronological order_

After 'finishing' and before publishing on GitHub Pages, I was trying to get the model to stop
adding emojis in its responses. I noticed that the harder I tried to emphasize against using them,
the more they appeared. It may have to do with the number of references to 'emoji' or the like.
In any case, a programmatic solution was more realistic and fast to code.

As a side note, to test cycling through the various emotions, I used the following prompt:

> Can you cycle through some emotions?

The answer I got was:

> [neutral] Sure, I can do that! [happy] That sounds fun! [angry] Okay... maybe not *that* fun. [sad] I hope it's not boring. [happy] Alright, let's try again!


## The muffled audio problem

After setting up GitHub pages, I tested the website on 2 devices, one "good" and one "bad".

**The Kokoro TTS model was generating some muffled low-volume audio on the bad device.**

I looked into it deeply because at the time of writing I'm still new to JS. I tried console logging
a bunch of objects, and used GitHub Copilot to the point of exhausting the monthly quota. (I've
never felt the need to use GitHub Copilot before this.) The experience was educational, I have to say.

Side note: Most of the text refers to this file: `src\features\voices\kokoroTtsWorker.ts`

During testing, I prompted the model to speak only a single sentnece.
I noticed that using a shorter prompt was more effective, such as:
- `I'm testing something, please only say "May the force be with you"`

Using a longer prompt caused the model to occasionally add comments and misobeying (using default temp & topK):
- `I'm testing something, please only say "May the force be with you, my young apprentice."`

In retrospect, I should've also tested a plain `Please repeat "XYZ"`.

Focusing on the problem, both devices used `webgpu` automatically. The number precision used (q8 vs fp32)
didn't seem to matter.

It was clear though, that something was up in audio-processing parts of the code.

"Good" device data:
```
kokoroTts.ts:37 kokoro: complete
{
  sampling_rate: 24000,
  length: 43200,
  blobSize: 172844
}
lipSync.ts:38 LipSync: decoded audio
{
  sampleRate: 44100,
  numberOfChannels: 1,
  length: 79380,
  duration: 1.8
}
```

"Bad" device data:
```
kokoroTts.ts:37 kokoro: complete
{
  sampling_rate: 24000,
  length: 43200,
  blobSize: 172844
}
lipSync.ts:38 LipSync: decoded audio
{
  sampleRate: 48000,
  numberOfChannels: 1,
  length: 86400,
  duration: 1.8
}
```

Copilot suggested these logs confirm the root cause: Kokoro generates at 24 kHz and the browser
decoder/resampler is producing different decoded sample rates on different machines
(24k→44.1k vs 24k→48k). Because each browser/device applies its own decoder resampler, the
result can sound different.

It suggested doing client-side resampling: transfer raw Float32 waveform from the worker to the
main thread, then resample on the main thread via WebAudio's OfflineAudioContext (deterministic on
the client). This removes the browser decoder's resampler from the critical path.

Disclaimer: I don't fully understand the above, nor had the time to dig into it. What I did try was
a normalization/amplification based on RMS because the Kokoro worker stats in the final merged
waveform differed:
- Muffled device: stats.rms ≈ 0.0129, max ≈ 0.062, min ≈ -0.072
- Good device: stats.rms ≈ 0.0725, max ≈ 0.44, min ≈ -0.525

This amplification only made the bad audio louder.
In that moment, I lost my hopes and wanted to call it a night.

I accepted a solution based on `OfflineAudioContext` or `AudioContext.createBuffer` which sounded confident:

> Why this should fix the muffled audio
> 
> The resampling is done via the WebAudio OfflineAudioContext API, which gives consistent resampling behavior across devices (avoids device/browser-specific decoder resamplers).
> 
> We only resample when the rates differ, so the working device (44100) will resample 24000→44100 and the muffled device (48000) will resample 24000→48000 via the same client-side code path — but the OfflineAudioContext resampler will be consistent.

Fun fact: It didn't

The next day I tried setting the device to `"cpu"`, but as I learned, the CPU backend is typically
for native environments (Node, Python, etc.), not WebAssembly or WebGPU. Inside a web worker,
execution is isolated from the main thread and can’t directly use the WebAudio API pipeline in
the same way. The choice has to be between either `"wasm"` (pure CPU WebAssembly execution) or
`"webgpu"` (GPU acceleration).

I then tried what I should have from the beginning; forcing wasm. The audio was now crystal clear,
as it was meant to be. It has to be an AMD related issue, I'm highly confident of it. I'm unsure of
whether it's a driver or the specific hardware, but a quick search hints to it.

> The muffled or low-RMS audio behavior you’re describing on AMD hardware is most likely due to floating-point precision and sample quantization differences in how WebGPU handles compute shaders on AMD drivers. Specifically:
>
> AMD WebGPU implementations (particularly through Dawn or wgpu layers) may use mixed-precision math (fp16 or fp32 fused multiply-adds) differently than NVIDIA or Intel.
>
> If the Kokoro TTS model uses WebGPU compute kernels for mel spectrogram generation or vocoding (as most modern TTS models do), the intermediate output amplitudes can be subtly off, leading to a lower RMS and slightly longer (zero-padded) waveforms.
>
> This can manifest as muffled or quieter output because normalization or post-vocoder scaling expects slightly different dynamic range.

I'm unsure whether the last bit is a hallucination, but it sounds.. reasonable.

In the end, I couldn't pinpoint the exact cause. At least I found how to avoid it. More testing is needed, perhaps there are AMD-based systems that don't have this issue.

---

## Extras

**On q8 vs fp32**

What changes: q8 is an 8-bit quantized format (weights are quantized + dequantized at runtime).
f32 keeps full single-precision floating point. Quantization reduces model size and memory bandwidth
and usually speeds inference, but trades off numeric precision.

**On audio quality when q8 is used**

Audio quality: for many TTS/vocoder models, q8 often produces nearly identical perceptual quality,
but subtle artifacts (slightly different timbre, tiny RMS/phase differences) can appear depending
on the model and vocoder sensitivity. The only reliable way to know is an A/B test on your model and inputs.

**On performance with WASM & q8**

ML/browser infra authors and communities have documented that AMD support often requires extra engineering
(ROCm/Vulkan/driver quirks) compared to other vendors — you’ll see multiple reports of AMD being the
trickiest platform for inference/compute in browser/desktop stacks. Provided [source](https://blog.mlc.ai/2023/08/09/Making-AMD-GPUs-competitive-for-LLM-inference)

### Vendor-specific check

I tried the following code right after this line `const adapter = await navigator.gpu.requestAdapter();`
in the file `kokoroTtsWorker.ts`.

```js
    const info = adapter.info || {};
    console.log("Vendor:", info.vendor);
    console.log("Architecture:", info.architecture);
    console.log("Device:", info.device);
    console.log("Description:", info.description);
```

The output was:

> Vendor: amd
> 
> Architecture: gcn-5
> 
> Device: 
> 
> Description:

Note: I saved the entire `info` object with `enable-webgpu-developer-features` flag enabled, just in case.

The "bad" device I used has 8GB of RAM, when 16GB is recommended for Google's Built-in AI APIs.

While the app is somewhat stable when ran in isolation, the lag is real when there are open tabs and
VSCode is running. In such cases, I did get multiple interruptions that produced these logs:

```
THREE.WebGLRenderer: Context Lost.
2chunk-TDYYZF5M.js?v=ec4d0a43:39729
THREE.WebGLRenderer: Context Restored.
```

I'm putting this here for reference, even though it looks like a not-enough-RAM issue.
