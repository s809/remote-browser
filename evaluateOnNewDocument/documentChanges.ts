var nextId = 0;

function setNodeId(node: Node) {
    _remoteBrowser_nodes.set(nextId, node);
    node[_remoteBrowser_idSymbol] = nextId;
    return nextId++;
}

function createDoctypeNode(node: DocumentType) {
    _remoteBrowser_createDoctype(node.name, node.publicId, node.systemId);
}

function createElement(parentId: number | null, nextSiblingId: number | null, element: HTMLElement) {
    if (element instanceof HTMLScriptElement)
        return;
    
    const id = setNodeId(element);
    _remoteBrowser_createElement(parentId, nextSiblingId, id, element.tagName, Object.fromEntries([...element.attributes].filter(x => !x.name.startsWith("on")).map(x => [x.name, x.nodeValue ?? ""])));

    for (const child of element.childNodes)
        createUnknownNode(id, null, child);
}

function createTextNode(parentId: number | null, nextSiblingId: number | null, node: Node) {
    if (parentId === null)
        return;
    
    _remoteBrowser_createTextNode(parentId, nextSiblingId, setNodeId(node), node.nodeValue!);
}

function createUnknownNode(parentId: number | null, nextSiblingId: number | null, node: Node) {
    if (_remoteBrowser_idSymbol in node) return;

    switch (node.nodeType) {
        case Node.DOCUMENT_TYPE_NODE:
            return createDoctypeNode(node as DocumentType)
        case Node.ELEMENT_NODE:
            return createElement(parentId, nextSiblingId, node as HTMLElement);
        case Node.TEXT_NODE:
            return createTextNode(parentId, nextSiblingId, node);
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
                    
                    const nodes = [...mutation.target.childNodes].filter(n => n[_remoteBrowser_idSymbol] || n === node);
                    const nextSibling = nodes.slice(nodes.indexOf(node as ChildNode))[1];

                    createUnknownNode(targetId, nextSibling?.[_remoteBrowser_idSymbol] ?? null, node);
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
