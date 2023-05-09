import { ServerConnection } from "./ServerConnection.js";
import { RemoteBrowserEventType, RemoteBrowserEvents } from "../../common/index.js";
import { AppContext } from "./AppContext.js";
import { config } from "./config.js";
import { RemotePage } from "./RemotePage.js";

new (class Main {
    static instance: Main;
    readonly searchParams = new URLSearchParams(location.search);

    connection: ServerConnection | null = null;
    readonly addressBarEl = AppContext.AddressBar.element;
    lastNavigateUrl: string | null = null;

    readonly eventMap: Partial<RemoteBrowserEvents> = {
        [RemoteBrowserEventType.UrlChanged]: this.onUrlChanged,
        [RemoteBrowserEventType.NewDocument]: this.onNewDocument,
        [RemoteBrowserEventType.CreateElement]: this.onCreateElement,
        [RemoteBrowserEventType.CreateTextNode]: this.onCreateTextNode,
        [RemoteBrowserEventType.UpdateElement]: this.onUpdateElement,
        [RemoteBrowserEventType.RemoveElement]: this.onRemoveElement,
    };

    readonly resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0]?.contentRect!;
        this.remotePage!.updateClientDimensions(width, height);
    });

    readonly elements = new Map<number, Node>();
    remotePage?: RemotePage;

    get frameWindow() {
        return AppContext.ContentFrame.element.contentWindow as typeof window;
    }
    get frameDocument() {
        return this.frameWindow.document;
    }

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

        for (const item of Object.entries(this.eventMap))
            this.connection!.eventReceiver.addEventListener(item[0], (ev: Event) => (item[1] as any).apply(this, (ev as CustomEvent).detail));
    
        this.remotePage = new RemotePage(this.connection!, this.frameWindow);
        AppContext.ContentFrame.element.addEventListener("load", () => this.connection?.resume());
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

        this.connection?.pause();
        AppContext.ContentFrame.clear();
        this.elements.clear();
    }

    onCreateElement(parentId: number | null, nextSiblingId: number | null, id: number, type: string, attributes: Record<string, string>) {
        let element: HTMLElement;
        switch (type) {
            case "HTML":
                element = this.frameDocument.documentElement;
                element.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.remotePage!.clickElement(e);
                }, {
                    capture: true
                });
                break;
            case "HEAD":
                element = this.frameDocument.head;
                break;
            case "BODY":
                element = this.frameDocument.body;
                if (this.searchParams.has("nocss")) {
                    element.appendChild(this.frameDocument.createElement("style")).textContent = `
                        * {
                            all: revert !important;
                        }
                    `;
                }
                break;
            default:
                element = this.elements.get(id) as HTMLElement ?? this.frameDocument.createElement(type);
                this.insertNode(parentId!, nextSiblingId, element);
        }

        while (element.attributes.length)
            element.removeAttribute(element.attributes[0]!.name);
        for (const [key, value] of Object.entries(attributes))
            element.setAttribute(key, value);
        element.setAttribute("data-rb-id", id.toString());
        element.setAttribute("data-rb-parent-id", parentId?.toString() ?? "null");
        element.setAttribute("data-rb-next-id", nextSiblingId?.toString() ?? "null");

        this.elements.set(id, element);
        element[idSymbol] = id;
    }

    onCreateTextNode(parentId: number, nextSiblingId: number | null, id: number, value: string) {
        const frameDocument = AppContext.ContentFrame.element.contentWindow!.document;
        const node = this.elements.get(id) ?? frameDocument.createTextNode(value) as unknown as HTMLElement;

        this.insertNode(parentId, nextSiblingId!, node);
        
        this.elements.set(id, node);
        node[idSymbol] = id;
    }

    private insertNode(parentId: number, nextSiblingId: number | null, node: Node) {
        const parent = this.elements.get(parentId)!;
        const next = this.elements.get(nextSiblingId!);
        parent.insertBefore(node, next ?? null);
    }

    onUpdateElement(id: number, attrKey: string, value: string | null) {
        const element = this.elements.get(id);
        if (!(element instanceof this.frameWindow.HTMLElement)) return;

        if (value)
            element.setAttribute(attrKey, value);
        else
            element.removeAttribute(attrKey);
    }

    onRemoveElement(id: number) {
        const node = this.elements.get(id);
        if (node) {
            this.elements.delete(id);
            node.parentNode?.removeChild(node);
            delete node[idSymbol];
        }
    }
});
