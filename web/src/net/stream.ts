import type { ClientModel } from "../model";

/** Conecta no SSE do hub. O EventSource reconecta sozinho; cada novo snapshot substitui o estado. */
export function connect(url: string, model: ClientModel, onStatus: (online: boolean) => void): () => void {
  const es = new EventSource(url);
  es.addEventListener("snapshot", (e) => {
    model.applySnapshot(JSON.parse((e as MessageEvent).data));
    onStatus(true);
  });
  es.addEventListener("delta", (e) => model.applyDelta(JSON.parse((e as MessageEvent).data)));
  es.onerror = () => onStatus(false);
  return () => es.close();
}
