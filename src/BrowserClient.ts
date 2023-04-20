import Joi from "joi";
import puppeteer, { Browser, Page } from "puppeteer";
import { RawData, WebSocket } from "ws";

const JoiCustom = Joi.defaults(schema => schema.required());
const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export class BrowserClient {
    private destroyed = false;

    private static browser?: Browser;
    private static clients = new Set<BrowserClient>();

    private static readonly packetSchema = JoiCustom.object({
        type: JoiCustom.string(),
        data: JoiCustom.array()
    });

    private readonly packetTypeToHandler = new Map([
        ["navigate", {
            schema: [JoiCustom.string()],
            handler: this.navigate
        }]
    ].map((pair: any) => {
        pair[1].schema = JoiCustom.array().ordered(...pair[1].schema);
        pair[1].handler = pair[1].handler.bind(this);
        return pair;
    }) as [string, {
        schema: Joi.ArraySchema,
        handler: (...args: any[]) => any
    }][]);

    private pingInterval = setInterval(() => this.ping(), 5000);
    private pingPending = false;

    static async create(ws: WebSocket) {
        const messages: RawData[] = [];
        const preReceiveMessages = (message: RawData) => messages.push(message);
        ws.on("message", preReceiveMessages);
        // ASYNC STARTS HERE

        if (!BrowserClient.browser)
            BrowserClient.browser = await puppeteer.launch({ headless: false });
        
        const page = await BrowserClient.browser.newPage();

        // ASYNC ENDS HERE
        ws.off("message", preReceiveMessages);
        return new BrowserClient(ws, page, messages);
    }

    private constructor(private ws: WebSocket, private page: Page, messages: RawData[]) {
        BrowserClient.clients.add(this);

        page.on("close", () => this.destroy());
        ws.on("close", () => this.destroy());
        ws.on("message", data => this.handleEvent(data.toString()));
        for (const message of messages)
            ws.emit("message", message);

        this.sendEvent("page_created");
    }

    private ping() {
        if (this.pingPending)
            return this.destroy();
        
        this.ws.ping();
        this.pingPending = true;
        this.ws.once("pong", () => this.pingPending = false);
    }

    sendEvent(type: string, ...data: any[]) {
        this.ws.send(JSON.stringify({
            type,
            data
        }));
    }

    async handleEvent(data: string) {
        try {
            const packet = JSON.parse(data);
            JoiCustom.assert(packet, BrowserClient.packetSchema);

            const type = packet.type as string;
            const packetTypeData = this.packetTypeToHandler.get(type);
            if (!packetTypeData)
                throw new Error("Invalid packet type");
            
            JoiCustom.assert(packet.data, packetTypeData.schema);
            await packetTypeData.handler(...packet.data);
        } catch (e) {
            this.destroy(String(e));
        }
    }

    async navigate(url: string) {
        if (!url.match(urlRegex))
            url = `https://google.com/search?q=${encodeURIComponent(url)}`;
            
        await this.page.goto(url);
    }

    async destroy(message?: string) {
        if (this.destroyed)
            return;
        this.destroyed = true;
        
        clearInterval(this.pingInterval);
        if (message)
            this.ws.close(1001, message);
        else
            this.ws.close();
        await this.page?.close().catch(() => { });
        BrowserClient.clients.delete(this);

        if (!BrowserClient.clients.size) {
            await BrowserClient.browser?.close().catch(() => { });
            delete BrowserClient.browser;
        }
    }
}
