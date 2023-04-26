import { EventType, RemoteBrowserEvents, ServerConnection } from "./ServerConnection.js";
import { AppContext } from "./AppContext.js";
import { config } from "./config.js";

new class Main {
    static instance: Main;

    connection: ServerConnection | null = null;
    addressBarEl = AppContext.AddressBar.element;
    lastNavigateUrl: string | null = null;

    eventMap: {
        [K in keyof RemoteBrowserEvents]: [K, RemoteBrowserEvents[K]]
    }[keyof RemoteBrowserEvents][] = [
        [EventType.PageCreated, this.onPageCreated]
    ];

    resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0]?.contentRect!;
        this.connection?.updateClientDimensions(width, height);
    });

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
            this.connection?.eventReceiver.addEventListener(item[0], (ev: Event) => (item[1] as Function).apply(this, (ev as CustomEvent).detail));
    }

    onPageCreated() {
        AppContext.displaying = true;

        const contentFrameSize = AppContext.ContentFrame.dimensions;
        this.connection?.updateClientDimensions(contentFrameSize.width, contentFrameSize.height);
        
        this.resizeObserver.observe(AppContext.ContentFrame.element);
    }
};
