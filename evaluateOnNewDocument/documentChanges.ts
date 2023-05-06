var nextId = 0;

const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        const targetId = mutation.target[_remoteBrowser_idSymbol];

        switch (mutation.type) {
            case "childList":
                addNodes:
                for (const node of mutation.addedNodes) {
                    if (targetId === undefined && !(node instanceof HTMLHtmlElement)) continue;
                    const prevSiblingId = mutation.previousSibling?.[_remoteBrowser_idSymbol] ?? null;

                    switch (node.nodeType) {
                        case Node.ELEMENT_NODE:
                            if (node instanceof HTMLScriptElement)
                                continue addNodes;
                            const element = node as HTMLElement;
                            _remoteBrowser_createElement(targetId ?? null, prevSiblingId, nextId, element.tagName, Object.fromEntries([...element.attributes].filter(x => !x.name.startsWith("on")).map(x => [x.name, x.nodeValue ?? ""])));
                            break;
                        case Node.TEXT_NODE:
                            if (targetId === undefined)
                                continue addNodes;
                            _remoteBrowser_createTextNode(targetId, prevSiblingId, nextId, node.nodeValue!);
                            break;
                        default:
                            continue addNodes;
                    }

                    _remoteBrowser_nodes.set(nextId, node);
                    node[_remoteBrowser_idSymbol] = nextId++;
                }

                for (const node of mutation.removedNodes) {
                    const id = node[_remoteBrowser_idSymbol];
                    if (!id) continue;
                    
                    _remoteBrowser_removeElement(id);
                    _remoteBrowser_nodes.delete(id);
                    delete node[_remoteBrowser_idSymbol];
                }

                break;
            case "attributes":
                if (targetId === undefined) break;
                
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
