declare global {
    function _remoteBrowser_clickElement(id: number, relX: number, relY: number): void;
}

window._remoteBrowser_clickElement = (id: number, relX: number, relY: number) => {
    const element = _remoteBrowser_nodes.get(id);
    if (!(element instanceof HTMLElement)) return;

    element.dispatchEvent(new MouseEvent("click", {
        clientX: element.offsetLeft + relX,
        clientY: element.offsetTop + relY
    }));
}
