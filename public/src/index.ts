import { ServerConnection } from "./ServerConnection.js";
import { RemoteBrowserEventType, RemoteBrowserEvents } from "../../common/index.js";
import { AppContext } from "./AppContext.js";
import { config } from "./config.js";
import { RemotePage } from "./RemotePage.js";

type RemoteBrowserEventHandlerMap = {
    [K in keyof RemoteBrowserEvents]: [K, RemoteBrowserEvents[K]];
}[keyof RemoteBrowserEvents][];

new (class Main {
    static instance: Main;

    connection: ServerConnection | null = null;
    addressBarEl = AppContext.AddressBar.element;
    lastNavigateUrl: string | null = null;

    eventMap: RemoteBrowserEventHandlerMap = [
        [RemoteBrowserEventType.UrlChanged, this.onUrlChanged],
        [RemoteBrowserEventType.NewDocument, this.onNewDocument],
        [RemoteBrowserEventType.CreateElement, this.onCreateElement],
        [RemoteBrowserEventType.CreateTextNode, this.onCreateTextNode],
    ];

    resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0]?.contentRect!;
        this.remotePage!.updateClientDimensions(width, height);
    });

    elements = new Map<number, Node>();
    remotePage?: RemotePage;

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
        
        this.remotePage!.navigate(this.addressBarEl.value);
        this.lastNavigateUrl = null;
    }

    showFatalError(message: string) {
        this.connection = null;
        this.lastNavigateUrl = null;
        this.resizeObserver.unobserve(AppContext.ContentFrame.element);
        this.remotePage = undefined;

        alert(message);
        AppContext.AddressBar.progress = 100;
        AppContext.displaying = false;
    }

    async setupEvents() {
        this.connection!.addEventListener("close", ({ reason }) => this.showFatalError(reason.length ? reason : "Disconnected!"));

        for (const item of this.eventMap)
            this.connection!.eventReceiver.addEventListener(item[0], (ev: Event) => (item[1] as any).apply(this, (ev as CustomEvent).detail));
    
        this.remotePage = new RemotePage(this.connection!, AppContext.ContentFrame.element.contentWindow as any);
    }

    onUrlChanged(url: string) {
        this.addressBarEl.value = url;
        history.replaceState(null, "", `#${url}`);
    }

    onNewDocument() {
        if (!AppContext.displaying) {
            AppContext.displaying = true;

            const contentFrameSize = AppContext.ContentFrame.dimensions;
            this.remotePage!.updateClientDimensions(contentFrameSize.width, contentFrameSize.height);
        
            this.resizeObserver.observe(AppContext.ContentFrame.element);
        }

        AppContext.ContentFrame.clear();
        this.elements.clear();
    }

    onCreateElement(parentId: number | null, leftSiblingId: number | null, id: number, type: string, attributes: Record<string, string>) {
        const frameDocument = AppContext.ContentFrame.element.contentWindow!.document;

        let element: HTMLElement;
        switch (type) {
            case "HTML":
                element = frameDocument.documentElement;
                element.addEventListener("click", e => {
                    e.preventDefault();
                    this.remotePage!.clickElement(e);
                });
                break;
            case "HEAD":
                element = frameDocument.head;
                break;
            case "BODY":
                element = frameDocument.body;
                element.appendChild(frameDocument.createElement("style")).textContent = `
                    * {
                        all: revert !important;
                    }
                `;
                break;
            default:
                element = this.elements.get(id) as HTMLElement ?? frameDocument.createElement(type);
                this.insertNode(parentId!, leftSiblingId, element);
        }

        while (element.attributes.length)
            element.removeAttribute(element.attributes[0]!.name);
        for (const [key, value] of Object.entries(attributes))
            element.setAttribute(key, value);

        this.elements.set(id, element);
        element[idSymbol] = id;
    }

    onCreateTextNode(parentId: number, leftSiblingId: number | null, id: number, value: string) {
        const frameDocument = AppContext.ContentFrame.element.contentWindow!.document;
        const node = this.elements.get(id) ?? frameDocument.createTextNode(value) as unknown as HTMLElement;

        this.insertNode(parentId, leftSiblingId!, node);
        
        this.elements.set(id, node);
        node[idSymbol] = id;
    }

    private insertNode(parentId: number, leftSiblingId: number | null, node: Node) {
        const parent = this.elements.get(parentId)!;
        const next = (typeof leftSiblingId === "number" && this.elements.get(leftSiblingId)?.nextSibling) || parent.lastChild;
        parent.insertBefore(node, next ?? null);
    }
});
