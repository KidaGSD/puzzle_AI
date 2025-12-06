import { UIEvent, UIEventType } from "../domain/models";

type Subscriber = (event: UIEvent) => void;

export interface EventBus {
  emit(event: UIEvent): void;
  emitType(type: UIEventType, payload: unknown): void;
  subscribe(handler: Subscriber): () => void;
  clear(): void;
}

export const createEventBus = (): EventBus => {
  const subscribers = new Set<Subscriber>();

  const emit = (event: UIEvent) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[eventBus emit]", event.type, "subs:", subscribers.size, event.payload);
    }
    subscribers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error("[eventBus handler error]", err);
      }
    });
  };

  const emitType = (type: UIEventType, payload: unknown) => {
    emit({ type, payload, timestamp: Date.now() });
  };

  const subscribe = (handler: Subscriber) => {
    subscribers.add(handler);
    return () => subscribers.delete(handler);
  };

  const clear = () => {
    subscribers.clear();
  };

  return { emit, emitType, subscribe, clear };
};
