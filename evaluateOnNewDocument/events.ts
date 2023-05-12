if (_remoteBrowser_inMainFrame) {
    _remoteBrowser_onNavigated();

    window.addEventListener("beforeunload", () => {
        _remoteBrowser_onBeforeUnload();
    });
}
