export class PageAssetManager {
    static readonly route = "/page-assets/:pageId/:url";
    private storedAssets = new Map<string, {
        contentType: string,
        data: Buffer
    }>();

    constructor(
        private pageId: number,
        private pageUrl: string,
        private _remoteBrowser_fetch: (url: string, uploadUrl: string) => Promise<void>
    ) { }

    getAssetRoute(url: string) {
        return PageAssetManager.route
            .replace(":pageId", this.pageId.toString())
            .replace(":url", encodeURIComponent(url));
            //.replace(":url", encodeURIComponent(new URL(url, this.pageUrl).toString()));
    }

    async fetchAsset(url: string, uploadUrl: string) {
        await this._remoteBrowser_fetch(url, uploadUrl);
        
        const asset = this.storedAssets.get(url) ?? null;
        this.storedAssets.delete(url);
        return asset;
    }

    saveUploadedAsset(url: string, contentType: string, data: Buffer) {
        if (contentType.startsWith("text/css")) {
            data = Buffer.from(
                this.replaceCssLinks(data.toString())
            );
        }

        this.storedAssets.set(url, {
            contentType,
            data
        });
    }

    replaceCssLinks(text: string) {
        return text.replaceAll(/url\((.*?)\)/g, (_match, p1) => `url(${this.getAssetRoute(p1)})`);
    }
}
