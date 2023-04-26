interface ServerConnectionEventMap {
    "close": CloseEvent;
    "": Event;
}

export const enum EventType {
    PageCreated = "page_created",
    CreateElement = "create_element",
    CreateTextNode = "create_text_node",
    UpdateElement = "update_element",
    RemoveElement = "remove_element",

    Navigate = "navigate",
    SetClientDimensions = "set_client_dimensions",
    SetElementScroll = "set_element_scroll"
}

export interface RemoteBrowserEvents {
    [EventType.PageCreated]: () => void;
    [EventType.CreateElement]: (parentId: number, leftSiblingId: number, id: number, type: string, attributes: Record<string, string>) => void;
    [EventType.CreateTextNode]: (parentId: number, leftSiblingId: number, id: number, value: string) => void;
    [EventType.UpdateElement]: (id: number, attrKey: string, value: string) => void;
    [EventType.RemoveElement]: (id: number) => void;

    [EventType.Navigate]: (value: string) => void;
    [EventType.SetClientDimensions]: (width: number, height: number) => void;
    [EventType.SetElementScroll]: (id: number, x: number, y: number) => void;
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

    sendEvent<EventName extends keyof RemoteBrowserEvents>(type: EventName, ...data: Parameters<RemoteBrowserEvents[EventName]>): void {
        this.ws.send(JSON.stringify({
            type,
            data
        }));
    }

    navigate(value: string) {
        this.sendEvent(EventType.Navigate, value);
    }

    updateClientDimensions(width: number, height: number) {
        this.sendEvent(EventType.SetClientDimensions, width, height);
    }

    updateClientScroll(el: HTMLElement) {
        const { x, y } = el.getBoundingClientRect();
        this.sendEvent(EventType.SetElementScroll, parseInt(el.dataset["id"]!), x, y);
    }
}
