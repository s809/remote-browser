import express from "express";
import WebSocket from "ws";
import { BrowserClient } from "./BrowserClient";
import expressWs from "@wll8/express-ws";
import "source-map-support/register";

const port = 3000;

const app = expressWs(express()).app;
app.use(express.static("./public"));

app.ws("/ws", async ws => {
    await BrowserClient.create(ws);
});

app.get("/page-assets/:url", async (req, res) => {
    const url = decodeURIComponent(req.params.url);
    const item = BrowserClient.responseCache.get(url);
    if (!item)
        return res.sendStatus(404);
    
    res.contentType(item.type);
    res.send(await item.buffer);
});

app.listen(port, () => {
    console.log("Server is started at port", port);
});

declare global {
    namespace Express {
        export interface Request {
            ws: () => Promise<WebSocket>
        }
    }
}
