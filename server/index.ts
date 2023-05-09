import express from "express";
import { BrowserClient } from "./BrowserClient";
import expressWs from "@wll8/express-ws";
import "source-map-support/register";
import { PageAssetManager } from "./PageAssetManager";
import bodyParser from "body-parser";

const port = 3000;

const app = expressWs(express()).app;
app.use(express.static("./public"));
app.use(bodyParser.raw({
    type: "*/*",
    limit: "100mb"
}));

const assetRequests = new Map<number, PageAssetManager>();

app.ws("/ws", async ws => {
    await BrowserClient.create(ws);
});

app.get(PageAssetManager.route, async (req, res) => {
    const url = decodeURIComponent(req.params.url);
    
    const pageAssetManager = BrowserClient.clients.get(parseInt(req.params.pageId))?.pageAssetManager;
    if (!pageAssetManager)
        return res.sendStatus(404);
    
    const nonce = randomInteger(0, 32767);
    assetRequests.set(nonce, pageAssetManager);

    const asset = await pageAssetManager.fetchAsset(url, `http://127.0.0.1:${port}${pageAssetManager.getAssetRoute(url)}?nonce=${nonce}`);
    assetRequests.delete(nonce);
    if (!asset)
        return res.sendStatus(500);
    
    res.contentType(asset.contentType).send(asset.data);
});

app.post(PageAssetManager.route, async (req, res) => {
    const pageAssetManager = assetRequests.get(parseInt(req.query["nonce"] as any));
    if (!pageAssetManager || !req.headers["content-type"])
        return res.sendStatus(400);
    
    pageAssetManager.saveUploadedAsset(req.params.url, req.headers["content-type"], req.body);
    res.sendStatus(204);
});

app.listen(port, () => {
    console.log("Server is started at port", port);
});

function randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
