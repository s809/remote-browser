import { RemoteBrowserEvents } from "../../common/index.js";

interface ServerConnectionEventMap {
    "close": CloseEvent;
    "": Event;
}

export class ServerConnection extends EventTarget {
    readonly eventReceiver = new EventTarget();
    private ws: WebSocket;

    private paused = false;
    private queue: string[] = [];

    static async create(url: string | URL): Promise<ServerConnection> {
        const ws = new WebSocket(url);
        return new Promise((resolve, reject) => {
            ws.addEventListener("open", () => resolve(new ServerConnection(ws)));
            ws.addEventListener("close", () => reject());
        });
    }

    constructor(ws: WebSocket) {
        super();
        this.ws = ws;

        ws.addEventListener("close", event => this.dispatchEvent(new (event.constructor as typeof Event)(event.type, event)));
        ws.addEventListener("message", e => {
            if (this.paused || this.queue.length)
                this.queue.push(e.data);
            else
                this.evaluateMessage(e.data);
        });
    }

    evaluateMessage(message: string) {
        const { type, data } = JSON.parse(message);
        this.eventReceiver.dispatchEvent(new CustomEvent(type, {
            detail: data
        }));
    }

    override addEventListener<K extends keyof ServerConnectionEventMap>(type: K, listener: (this: ServerConnection, ev: ServerConnectionEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, listener, options);
    }

    sendEvent<EventName extends keyof RemoteBrowserEvents>(type: EventName, ...data: Parameters<RemoteBrowserEvents[EventName]>): void {
        this.ws.send(JSON.stringify({
            type,
            data
        }));
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;

        let message;
        while (message = this.queue.shift()) {
            this.evaluateMessage(message);
            if (this.paused) return;
        }
    }
}
