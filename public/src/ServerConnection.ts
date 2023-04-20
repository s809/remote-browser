
interface ServerConnectionEventMap {
    "close": CloseEvent;
    "": Event;
}


export class ServerConnection extends EventTarget {
    readonly eventReceiver = new EventTarget();
    private ws: WebSocket;

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
            const { type, data } = JSON.parse(e.data);
            this.eventReceiver.dispatchEvent(new CustomEvent(type, {
                detail: data
            }));
        });
    }

    override addEventListener<K extends keyof ServerConnectionEventMap>(type: K, listener: (this: ServerConnection, ev: ServerConnectionEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, listener, options);
    }

    sendEvent(type: string, ...data: any[]) {
        this.ws.send(JSON.stringify({
            type,
            data
        }));
    }
}
