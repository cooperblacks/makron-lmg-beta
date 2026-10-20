import { env, pipeline, TextStreamer } from '@huggingface/transformers';

// Configure transformers environment
env.allowLocalModels = false;
env.useBrowserCache = true;

let currentGenerator: any = null;
let currentModelId: string | null = null;
let isLoadingInProgress = false;
let isAborted = false;

// Per-file progress tracker to avoid progress rubber-banding
const fileProgressMap: Record<string, number> = {};
let maxMonotonicProgress = 0;

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, data } = e.data;

  if (type === 'CHECK_HARDWARE') {
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    self.postMessage({ type: 'HARDWARE_INFO', data: { hasWebGPU } });
    return;
  }

  if (type === 'ABORT') {
    isAborted = true;
    return;
  }

  if (type === 'LOAD_MODEL') {
    const { modelId, device = 'wasm', dtype = 'q4', hfToken } = data;

    // Guard: if already loaded and cached, respond immediately
    if (currentGenerator && currentModelId === modelId) {
      self.postMessage({ type: 'LOAD_COMPLETE', data: { modelId, cached: true } });
      return;
    }

    // Guard: if already loading this exact model, do not re-run in parallel
    if (isLoadingInProgress && currentModelId === modelId) {
      return;
    }

    isLoadingInProgress = true;
    currentModelId = modelId;
    maxMonotonicProgress = 0;
    Object.keys(fileProgressMap).forEach((k) => delete fileProgressMap[k]);

    try {
      if (hfToken) {
        (env as any).token = hfToken;
      }

      self.postMessage({
        type: 'PROGRESS',
        data: { status: 'init', file: modelId, progress: 0, text: 'Initializing pipeline...' },
      });

      // Cleanup old pipeline if any
      if (currentGenerator && typeof currentGenerator.dispose === 'function') {
        try {
          await currentGenerator.dispose();
        } catch {
          // ignore
        }
      }

      const pipelineOptions: any = {
        device: device === 'webgpu' ? 'webgpu' : 'wasm',
        dtype: dtype || 'q4',
        progress_callback: (progressData: any) => {
          const file = progressData.file || 'weights';
          const fileP = typeof progressData.progress === 'number' ? Math.round(progressData.progress) : 0;
          fileProgressMap[file] = fileP;

          // Compute aggregate progress across seen files
          const values = Object.values(fileProgressMap);
          const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : fileP;
          maxMonotonicProgress = Math.max(maxMonotonicProgress, avg);

          self.postMessage({
            type: 'PROGRESS',
            data: {
              status: progressData.status || 'progress',
              file,
              progress: Math.min(99, maxMonotonicProgress),
              loaded: progressData.loaded || 0,
              total: progressData.total || 0,
            },
          });
        },
      };

      if (hfToken) {
        pipelineOptions.token = hfToken;
      }

      currentGenerator = await pipeline('text-generation', modelId, pipelineOptions);

      isLoadingInProgress = false;
      currentModelId = modelId;
      self.postMessage({ type: 'LOAD_COMPLETE', data: { modelId } });
    } catch (err: any) {
      isLoadingInProgress = false;
      console.error('Worker model load failed:', err);
      let errorMsg = err.message || String(err);
      if (errorMsg.includes('Unauthorized access to file')) {
        errorMsg = `Unauthorized access to "${modelId}". The repository may require an ONNX suffix (e.g. "onnx-community/SmolLM2-135M-Instruct-ONNX") or a Hugging Face Access Token.`;
      }

      self.postMessage({
        type: 'LOAD_ERROR',
        data: {
          modelId,
          error: errorMsg,
          possibleWebGpuIssue: device === 'webgpu',
        },
      });
    }
    return;
  }

  if (type === 'GENERATE') {
    const { id, prompt, messages, max_new_tokens = 512, temperature = 0.3 } = data;
    isAborted = false;

    if (!currentGenerator) {
      self.postMessage({
        type: 'GENERATE_ERROR',
        data: { id, error: 'No model loaded. Please load a model first.' },
      });
      return;
    }

    try {
      // Custom token callback
      const streamer = new TextStreamer(currentGenerator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token: string) => {
          if (isAborted) {
            throw new Error('GENERATION_ABORTED');
          }
          self.postMessage({
            type: 'TOKEN',
            data: { id, token },
          });
        },
      });

      // Format input messages or raw prompt
      const input = messages && messages.length > 0 ? messages : prompt;

      const output = await currentGenerator(input, {
        max_new_tokens,
        temperature,
        top_p: 0.9,
        do_sample: temperature > 0.05,
        streamer,
        return_full_text: false,
      });

      let fullText = '';
      if (Array.isArray(output) && output.length > 0) {
        if (typeof output[0] === 'object' && output[0].generated_text) {
          const gen = output[0].generated_text;
          if (Array.isArray(gen)) {
            const lastMsg = gen[gen.length - 1];
            fullText = lastMsg.content || '';
          } else {
            fullText = String(gen);
          }
        } else {
          fullText = String(output[0]);
        }
      }

      self.postMessage({
        type: 'GENERATE_COMPLETE',
        data: { id, fullText },
      });
    } catch (err: any) {
      if (err.message === 'GENERATION_ABORTED' || isAborted) {
        self.postMessage({
          type: 'GENERATE_CANCELLED',
          data: { id },
        });
      } else {
        self.postMessage({
          type: 'GENERATE_ERROR',
          data: { id, error: err.message || String(err) },
        });
      }
    }
  }
});
