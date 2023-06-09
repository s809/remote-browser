import { RemoteBrowserEventType } from "../../common/index.js";
import { ServerConnection } from "./ServerConnection.js";

(window as any).idSymbol = Symbol("remoteBrowser_id");
declare global {
    const idSymbol: unique symbol;
    interface Node {
        [idSymbol]?: number;
    }
}

export class RemotePage {
    constructor(private connection: ServerConnection, private window: typeof global) { }

    navigate(value: string) {
        this.connection.sendEvent(RemoteBrowserEventType.Navigate, value);
    }

    updateClientDimensions(width: number, height: number) {
        this.connection.sendEvent(RemoteBrowserEventType.SetClientDimensions, width, height);
    }

    updateElementScroll(el: HTMLElement | Document) {
        if (el === this.window.document) 
            return this.connection.sendEvent(RemoteBrowserEventType.ScrollElement, 0, this.window.scrollX, this.window.scrollY);

        if (!el[idSymbol] || !(el instanceof this.window.HTMLElement)) return;
        this.connection.sendEvent(RemoteBrowserEventType.ScrollElement, (el as any)[idSymbol], el.scrollLeft, el.scrollTop);
    }

    clickElement(e: MouseEvent) {
        if (!(e.target instanceof this.window.HTMLElement) || !e.target[idSymbol]) return;
        this.connection.sendEvent(RemoteBrowserEventType.ClickElement, e.target[idSymbol], e.offsetX, e.offsetY);
    }
}
