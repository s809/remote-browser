import { ExposedFunctions } from "./index.js";

declare global {
    const _remoteBrowser_idSymbol: unique symbol;
    interface Node {
        [_remoteBrowser_idSymbol]?: number;
    }

    var _remoteBrowser_nodes: Map<number, Node>;

    const _remoteBrowser_log: ExposedFunctions["_remoteBrowser_log"]
    const _remoteBrowser_close: ExposedFunctions["_remoteBrowser_close"];
    const _remoteBrowser_createElement: ExposedFunctions["_remoteBrowser_createElement"];
    const _remoteBrowser_createTextNode: ExposedFunctions["_remoteBrowser_createTextNode"];
    const _remoteBrowser_updateElement: ExposedFunctions["_remoteBrowser_updateElement"];
    const _remoteBrowser_removeElement: ExposedFunctions["_remoteBrowser_removeElement"];
    const _remoteBrowser_addEventListener: ExposedFunctions["_remoteBrowser_addEventListener"];
    const _remoteBrowser_onNavigated: ExposedFunctions["_remoteBrowser_onNavigated"];
}

Object.assign(window, {
    _remoteBrowser_idSymbol: Symbol("_remoteBrowser_idSymbol"),
    _remoteBrowser_nodes: new Map()
});
