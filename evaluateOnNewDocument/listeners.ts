const addedListeners = new Set();

for (const _interface of [Window, ...Object.values(window).filter(x => HTMLElement.isPrototypeOf(x))] as typeof EventTarget[]) {
    const original = _interface.prototype.addEventListener;
    _interface.prototype.addEventListener = function (type: string) {
        const result = original.apply(this, arguments as any);
        if (!addedListeners.has(type)) {
            _remoteBrowser_addEventListener(type);
            addedListeners.add(type);
        }
        return result;
    }
}
