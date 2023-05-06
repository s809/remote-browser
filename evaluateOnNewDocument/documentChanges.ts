var nextId = 0;

function setNodeId(node: Node) {
    _remoteBrowser_nodes.set(nextId, node);
    node[_remoteBrowser_idSymbol] = nextId;
    return nextId++;
}

function createElement(parentId: number | null, prevSiblingId: number | null, element: HTMLElement) {
    if (element instanceof HTMLScriptElement)
        return null;
    
    const id = setNodeId(element);
    _remoteBrowser_createElement(parentId, prevSiblingId, id, element.tagName, Object.fromEntries([...element.attributes].filter(x => !x.name.startsWith("on")).map(x => [x.name, x.nodeValue ?? ""])));

    let lastChildId: number | null = null;
    for (const child of element.childNodes)
        lastChildId = createUnknownNode(id, lastChildId, child);

    return id;
}

function createTextNode(parentId: number | null, prevSiblingId: number | null, node: Node) {
    if (parentId === null)
        return null;
    
    const id = setNodeId(node);
    _remoteBrowser_createTextNode(parentId, prevSiblingId, id, node.nodeValue!);
    return id;
}

function createUnknownNode(parentId: number | null, prevSiblingId: number | null, node: Node) {
    if (_remoteBrowser_idSymbol in node) return null;

    switch (node.nodeType) {
        case Node.ELEMENT_NODE:
            return createElement(parentId, prevSiblingId, node as HTMLElement);
        case Node.TEXT_NODE:
            return createTextNode(parentId, prevSiblingId, node);
        default:
            return null;
    }
}

function removeNode(node: Node) {
    const id = node[_remoteBrowser_idSymbol];
    if (!id) return;

    _remoteBrowser_removeElement(id);
    _remoteBrowser_nodes.delete(id);
    delete node[_remoteBrowser_idSymbol];

    for (const child of node.childNodes)
        removeNode(child);
}

const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        const targetId = mutation.target[_remoteBrowser_idSymbol] ?? null;

        switch (mutation.type) {
            case "childList":
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLHtmlElement) {
                        createUnknownNode(null, null, node);
                        continue;
                    }
                    
                    const prevSiblingId = [...mutation.target.childNodes]
                        .filter(n => n[_remoteBrowser_idSymbol] || n === node)
                        .find((_n, i, list) => list[i + 1] === node)
                        ?.[_remoteBrowser_idSymbol]
                        ?? null;
                    createUnknownNode(targetId, prevSiblingId, node);
                }

                for (const node of mutation.removedNodes) {
                    removeNode(node);
                }

                break;
            case "attributes":
                if (targetId === null) break;
                
                switch (mutation.target.nodeType) {
                    case Node.ELEMENT_NODE:
                        _remoteBrowser_updateElement(targetId, mutation.attributeName!, (mutation.target as HTMLElement).getAttribute(mutation.attributeName!));
                        break;
                    case Node.TEXT_NODE:
                        _remoteBrowser_close("Attribute mutation on text node");
                        break;
                    default:
                        break;
                }
                break;
        }
    }
});

if (_remoteBrowser_inMainFrame) {
    mutationObserver.observe(document, {
        attributes: true,
        childList: true,
        subtree: true
    });
}
