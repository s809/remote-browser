var inMainFrame;
try {
    inMainFrame = window.self === window.top;
    console.log("Is main frame:", inMainFrame);
} catch (e) {
    inMainFrame = false;
}

Object.assign(window, {
    _remoteBrowser_inMainFrame: inMainFrame,
    _remoteBrowser_idSymbol: Symbol("_remoteBrowser_idSymbol"),
    _remoteBrowser_nodes: new Map()
});
