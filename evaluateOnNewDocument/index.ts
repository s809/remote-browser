import { Page } from "puppeteer";

declare global {
    const _remoteBrowser_inMainFrame: boolean;

    const _remoteBrowser_idSymbol: unique symbol;
    interface Node {
        [_remoteBrowser_idSymbol]?: number;
    }

    var _remoteBrowser_nodes: Map<number, Node>;

    const _remoteBrowser_log: ExposedFunctions["_remoteBrowser_log"]
    const _remoteBrowser_close: ExposedFunctions["_remoteBrowser_close"];

    const _remoteBrowser_createDoctype: ExposedFunctions["_remoteBrowser_createDoctype"];
    const _remoteBrowser_createElement: ExposedFunctions["_remoteBrowser_createElement"];
    const _remoteBrowser_createTextNode: ExposedFunctions["_remoteBrowser_createTextNode"];
    const _remoteBrowser_updateElement: ExposedFunctions["_remoteBrowser_updateElement"];
    const _remoteBrowser_removeElement: ExposedFunctions["_remoteBrowser_removeElement"];
    const _remoteBrowser_addEventListener: ExposedFunctions["_remoteBrowser_addEventListener"];

    const _remoteBrowser_onNavigated: ExposedFunctions["_remoteBrowser_onNavigated"];
    const _remoteBrowser_onBeforeUnload: ExposedFunctions["_remoteBrowser_onBeforeUnload"]
}

export interface ExposedFunctions {
    _remoteBrowser_log(...args: any[]): void;
    _remoteBrowser_close(message: string): void;

    _remoteBrowser_createDoctype(name: string, publicId: string, systemId: string): void;
    _remoteBrowser_createElement(parentId: number | null, nextSiblingId: number | null, id: number, type: string, attributes: Record<string, string>): void;
    _remoteBrowser_createTextNode(parentId: number, nextSiblingId: number | null, id: number, value: string): void;
    _remoteBrowser_updateElement(id: number, attrKey: string, value: string | null): void;
    _remoteBrowser_removeElement(id: number): void;
    _remoteBrowser_addEventListener(name: string): void;

    _remoteBrowser_onNavigated(): void;
    _remoteBrowser_onBeforeUnload(): void;
}

export async function exposeFunctions(page: Page, items: ExposedFunctions) {
    for (const [key, value] of Object.entries(items))
        await page.exposeFunction(key, value);
}
