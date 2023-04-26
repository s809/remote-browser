import { RemoteBrowserEventType, RemoteBrowserEvents, ServerConnection } from "./ServerConnection.js";
import { AppContext } from "./AppContext.js";
import { config } from "./config.js";

type RemoteBrowserEventHandlerMap = {
    [K in keyof RemoteBrowserEvents]: [K, RemoteBrowserEvents[K]];
}[keyof RemoteBrowserEvents][];

new class Main {
    static instance: Main;

    connection: ServerConnection | null = null;
    addressBarEl = AppContext.AddressBar.element;
    lastNavigateUrl: string | null = null;

    eventMap: RemoteBrowserEventHandlerMap = [
        [RemoteBrowserEventType.PageCreated, this.onPageCreated],
        [RemoteBrowserEventType.CreateElement, this.onCreateElement],
        [RemoteBrowserEventType.CreateTextNode, this.onCreateTextNode],
    ];

    resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0]?.contentRect!;
        this.connection?.updateClientDimensions(width, height);
    });

    idSymbol = Symbol("remoteBrowser_id");
    elements = new Map<number, Node>();

    constructor() {
        Main.instance = this;

        this.addressBarEl.addEventListener("keydown", e => {
            if (e.key === "Enter")
                this.navigate();
        });

        if (window.location.hash.length) {
            this.addressBarEl.value = decodeURI(window.location.hash.slice(1));
            this.navigate();
        }
    }

    async navigate() {
        if (!this.addressBarEl.value.trim().length) return;

        AppContext.AddressBar.progress = 10;
        history.replaceState(null, "", `#${this.addressBarEl.value}`);

        if (this.lastNavigateUrl) {
            this.lastNavigateUrl = this.addressBarEl.value;
            return;
        } else {
            this.lastNavigateUrl = this.addressBarEl.value;
        }

        try {
            if (!this.connection) {
                this.addressBarEl.disabled = true;
                this.connection = await ServerConnection.create(config.wsUrl);
                this.setupEvents();
            }
        } catch (e) {
            this.showFatalError("Failed to connect!");
            return;
        } finally {
            this.addressBarEl.disabled = false;
        }

        this.connection.navigate(this.addressBarEl.value);
    }

    showFatalError(message: string) {
        this.connection = null;
        this.lastNavigateUrl = null;
        this.resizeObserver.unobserve(AppContext.ContentFrame.element);

        alert(message);
        AppContext.AddressBar.progress = 100;
        AppContext.displaying = false;
    }

    async setupEvents() {
        this.connection?.addEventListener("close", ({ reason }) => this.showFatalError(reason.length ? reason : "Disconnected!"));

        for (const item of this.eventMap)
            this.connection?.eventReceiver.addEventListener(item[0], (ev: Event) => (item[1] as any).apply(this, (ev as CustomEvent).detail));
    }

    onPageCreated() {
        AppContext.displaying = true;

        const contentFrameSize = AppContext.ContentFrame.dimensions;
        this.connection?.updateClientDimensions(contentFrameSize.width, contentFrameSize.height);
        
        this.resizeObserver.observe(AppContext.ContentFrame.element);
    }

    onCreateElement(parentId: number, leftSiblingId: number, id: number, type: string, attributes: Record<string, string>) {
        const frameDocument = AppContext.ContentFrame.element.contentWindow!.document;

        let element: HTMLElement;
        switch (type) {
            case "HTML":
                element = frameDocument.documentElement;
                break;
            case "HEAD":
                element = frameDocument.head;
                break;
            case "BODY":
                element = frameDocument.body;
                break;
            default:
                element = this.elements.get(id) as HTMLElement ?? frameDocument.createElement(type);

                while (element.attributes.length)
                    element.removeAttribute(element.attributes[0]!.name);
                for (const [key, value] of Object.entries(attributes))
                    element.setAttribute(key, value);
                
                const next = this.elements.get(leftSiblingId)?.nextSibling ?? this.elements.get(parentId)!.lastChild;
                this.elements.get(parentId)!.insertBefore(element, next ?? null);
        }

        this.elements.set(id, element);
        (element as any)[this.idSymbol] = id;
    }

    onCreateTextNode(parentId: number, leftSiblingId: number, id: number, value: string) {
        const frameDocument = AppContext.ContentFrame.element.contentWindow!.document;
        const node = this.elements.get(id) ?? frameDocument.createTextNode(value) as unknown as HTMLElement;

        const next = this.elements.get(leftSiblingId)?.nextSibling ?? this.elements.get(parentId)!.lastChild;
        this.elements.get(parentId)!.insertBefore(node, next ?? null);
        
        this.elements.set(id, node);
        (node as any)[this.idSymbol] = id;
    }
};
