import { computeEquityGen, estimateOuterSteps, type EquityComputeInput } from '../poker/equity';
import type { EquityResultData } from '../poker/types';

export interface EquityRequestMessage {
  requestId: number;
  input: EquityComputeInput;
}

export type EquityResponseMessage =
  | { type: 'progress'; requestId: number; processedOuter: number; totalOuter: number }
  | { type: 'done'; requestId: number; result: EquityResultData }
  | { type: 'error'; requestId: number; message: string };

let activeRequestId = -1;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function runComputation(requestId: number, input: EquityComputeInput): Promise<void> {
  try {
    const gen = computeEquityGen(input);
    let step = gen.next();
    while (!step.done) {
      if (activeRequestId !== requestId) return;
      const { processedOuter, totalOuter } = step.value;
      self.postMessage({ type: 'progress', requestId, processedOuter, totalOuter } satisfies EquityResponseMessage);
      await yieldToEventLoop();
      if (activeRequestId !== requestId) return;
      step = gen.next();
    }
    self.postMessage({ type: 'done', requestId, result: step.value } satisfies EquityResponseMessage);
  } catch (err) {
    self.postMessage({
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    } satisfies EquityResponseMessage);
  }
}

self.onmessage = (event: MessageEvent<EquityRequestMessage>) => {
  const { requestId, input } = event.data;
  activeRequestId = requestId;
  // Cheap upfront sanity check so a malformed request fails fast instead of hanging.
  estimateOuterSteps(input);
  void runComputation(requestId, input);
};
