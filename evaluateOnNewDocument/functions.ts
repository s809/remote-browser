declare global {
    function _remoteBrowser_clickElement(id: number, relX: number, relY: number): void;
    function _remoteBrowser_fetch(url: string, uploadUrl: string): Promise<void>;
}

window._remoteBrowser_clickElement = (id: number, relX: number, relY: number) => {
    const element = _remoteBrowser_nodes.get(id);
    if (!(element instanceof HTMLElement)) return;

    element.dispatchEvent(new MouseEvent("click", {
        clientX: element.offsetLeft + relX,
        clientY: element.offsetTop + relY,
        bubbles: true
    }));
}

window._remoteBrowser_fetch = async (url: string, uploadUrl: string) => {
    try {
        const data = await fetch(url, {
            cache: "force-cache"
        });

        const contentType = data.headers.get("content-type");
        if (!contentType) return;

        await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "Content-Type": contentType
            },
            body: await data.arrayBuffer(),
        });
    } catch (e) {
        _remoteBrowser_log((e as Error).stack);
    }
}
