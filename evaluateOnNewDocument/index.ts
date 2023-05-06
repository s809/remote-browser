import { Page } from "puppeteer";

export interface ExposedFunctions {
    _remoteBrowser_log(...args: any[]): void;
    _remoteBrowser_close(message: string): void;
    _remoteBrowser_createElement(parentId: number | null, leftSiblingId: number | null, id: number, type: string, attributes: Record<string, string>): void;
    _remoteBrowser_createTextNode(parentId: number, leftSiblingId: number | null, id: number, value: string): void;
    _remoteBrowser_updateElement(id: number, attrKey: string, value: string | null): void;
    _remoteBrowser_removeElement(id: number): void;
    _remoteBrowser_addEventListener(name: string): void;
    _remoteBrowser_onNavigated(): void;
}

export async function exposeFunctions(page: Page, items: ExposedFunctions) {
    for (const [key, value] of Object.entries(items))
        await page.exposeFunction(key, value);
}
