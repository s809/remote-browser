import express from "express";
import { tinyws } from "tinyws";
import WebSocket from "ws";
import { BrowserClient } from "./BrowserClient";
import "source-map-support/register";

const port = 3000;

const app = express();
app.use(express.static("./public"));

app.use("/ws", tinyws(), async req => {
    const ws = await req.ws();
    await BrowserClient.create(ws);
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
