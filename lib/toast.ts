/**
 * Toast store — tiny event-based message queue.
 * Web-first: replaces window.alert via lib/dialog.ts showAlert.
 * Rendered by components/ToastHost.tsx (mounted in app/_layout.tsx).
 */

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: number;
    type: ToastType;
    message: string;
    title?: string;
}

type ToastListener = (toasts: Toast[]) => void;

const AUTO_DISMISS_MS = 3500;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<ToastListener>();

function notify() {
    // Copy so subscribers never mutate the store's array.
    const snapshot = [...toasts];
    listeners.forEach((listener) => listener(snapshot));
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribeToasts(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Current queue snapshot (for initial render). */
export function getToasts(): Toast[] {
    return [...toasts];
}

export function dismissToast(id: number): void {
    const before = toasts.length;
    toasts = toasts.filter((t) => t.id !== id);
    if (toasts.length !== before) notify();
}

/** Push a toast onto the queue; auto-dismisses after ~3.5s. */
export function showToast(message: string, type: ToastType = 'info', title?: string): void {
    const toast: Toast = { id: nextId++, type, message, title };
    toasts = [...toasts, toast];
    notify();
    setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
}
