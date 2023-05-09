import Joi from "joi";
import puppeteer, { Browser, Page } from "puppeteer";
import { RawData, WebSocket } from "ws";
import { RemoteBrowserEventType, RemoteBrowserEvents } from "../common";
import { exposeFunctions } from "../evaluateOnNewDocument";
import { readdirSync, readFileSync } from "fs";
import { posix as path } from "path";
import { parseSrcset, stringifySrcset } from "srcset";
import { PageAssetManager } from "./PageAssetManager";

const JoiCustom = Joi.defaults(schema => schema.required());
const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export class BrowserClient {
    static readonly clients = new Map<number, BrowserClient>();
    private static lastId = 0;
    private readonly id = BrowserClient.lastId++;

    private destroyed = false;
    private pagePrepared = false;

    private static browser?: Browser;
    pageAssetManager!: PageAssetManager;

    private static evaluateOnNewDocumentFiles: string[] = [];

    private static readonly packetSchema = JoiCustom.object({
        type: JoiCustom.string(),
        data: JoiCustom.array()
    });

    private readonly packetTypeToHandler = new Map([
        [RemoteBrowserEventType.Navigate, {
            schema: [JoiCustom.string()],
            handler: this.navigate
        }],
        [RemoteBrowserEventType.SetClientDimensions, {
            schema: [JoiCustom.number(), JoiCustom.number()],
            handler: this.setClientDimensions
        }],
        [RemoteBrowserEventType.ClickElement, {
            schema: [JoiCustom.number(), JoiCustom.number(), JoiCustom.number()],
            handler: this.createProxiedFunction("_remoteBrowser_clickElement")
        }],
        [RemoteBrowserEventType.ScrollElement, {
            schema: [JoiCustom.number(), JoiCustom.number(), JoiCustom.number()],
            handler: this.createProxiedFunction("_remoteBrowser_scrollElement")
        }]
    ].map((pair: any) => {
        pair[1].schema = JoiCustom.array().ordered(...pair[1].schema);
        pair[1].handler = pair[1].handler.bind(this);
        return pair;
    }) as [string, {
        schema: Joi.ArraySchema,
        handler: Function
    }][]);

    private pingInterval = setInterval(() => this.ping(), 5000);
    private pingPending = false;

    static {
        const basePath = "./build/evaluateOnNewDocument";
        for (const name of readdirSync(basePath)
            .filter(f => f.endsWith(".js") && f !== "index.js")
            .sort((a, b) => a.localeCompare(b))
        ) {
            this.evaluateOnNewDocumentFiles.push(
                readFileSync(path.join(basePath, name), "utf8").replace("export {};\n", "")
            );
        }
    }

    static async create(ws: WebSocket) {
        const messages: RawData[] = [];
        const preReceiveMessages = (message: RawData) => messages.push(message);
        ws.on("message", preReceiveMessages);
        // ASYNC STARTS HERE

        let newBrowser = false;
        if (!BrowserClient.browser) {
            BrowserClient.browser = await puppeteer.launch({
                args: [
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins",
                    "--disable-site-isolation-trials",
                    "--disable-features=BlockInsecurePrivateNetworkRequests"
                ],
                headless: false,
                devtools: true
            });
            newBrowser = true;
        }
        
        const page = await BrowserClient.browser.newPage();
        page.setDefaultTimeout(0);
        
        if (newBrowser) {
            const pages = await BrowserClient.browser.pages();
            if (pages.length > 1)
                await pages[0]!.close();
        }
        
        // ASYNC ENDS HERE
        ws.off("message", preReceiveMessages);
        return new BrowserClient(ws, page, messages);
    }

    private constructor(private ws: WebSocket, private page: Page, messages: RawData[]) {
        BrowserClient.clients.set(this.id, this);

        page.on("close", () => this.destroy());
        ws.on("close", () => this.destroy());

        ws.on("message", data => this.handleEvent(data.toString()));
        for (const message of messages)
            ws.emit("message", message);
    }

    private ping() {
        if (this.pingPending)
            return this.destroy();
        
        this.ws.ping();
        this.pingPending = true;
        this.ws.once("pong", () => this.pingPending = false);
    }

    sendEvent<EventName extends keyof RemoteBrowserEvents>(type: EventName, ...data: Parameters<RemoteBrowserEvents[EventName]>): void {
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
                throw new Error(`Invalid packet type: ${type}`);
            
            JoiCustom.assert(packet.data, packetTypeData.schema);
            await packetTypeData.handler(...packet.data);
        } catch (e) {
            this.destroy(String(e));
        }
    }

    destroy(message?: string) {
        if (this.destroyed)
            return;
        this.destroyed = true;

        clearInterval(this.pingInterval);
        if (message)
            this.ws.close(1001, message);
        else
            this.ws.close();
        this.page?.close().catch(() => { });
        BrowserClient.clients.delete(this.id);

        if (!BrowserClient.clients.size) {
            const browser = BrowserClient.browser;
            delete BrowserClient.browser;
            browser?.close().catch(() => { });
        }
    }

    async navigate(url: string) {
        if (!url.match(urlRegex))
            url = `https://google.com/search?q=${encodeURIComponent(url)}`;
            
        if (!this.pagePrepared) {
            this.pagePrepared = true;

            const convertUrls = (key: string, value: string) => {
                if (!value.length) return value;

                switch (key) {
                    case "href":
                    case "src":
                        return this.pageAssetManager.getAssetRoute(value);
                    case "srcset":
                        return stringifySrcset(parseSrcset(value).map(item => ({
                             ...item, 
                            url: this.pageAssetManager.getAssetRoute(item.url)
                        })));
                    case "style":
                    case "_textNode":
                        return this.pageAssetManager.replaceCssLinks(value);
                    default:
                        return value;
                }
            }

            await exposeFunctions(this.page, {
                _remoteBrowser_log: (...args: any) => console.log("Remote browser:", ...args),
                _remoteBrowser_createElement: (parentId, nextSiblingId, id, type, attributes) => {
                    for (const [key, value] of Object.entries(attributes)) {
                        if (key.startsWith("on"))
                            delete attributes[key];
                        else
                            attributes[key] = convertUrls(key, value);
                    }

                    if (["IFRAME", "EMBED", "OBJECT"].includes(type)) {
                        if (attributes["src"])
                            attributes["src"] = `/notsupported.html#${type.toLowerCase()}`;
                        if (attributes["data"])
                            attributes["data"] = `/notsupported.html#${type.toLowerCase()}`;
                    }
                    
                    this.sendEvent(RemoteBrowserEventType.CreateElement, parentId, nextSiblingId, id, type, attributes);
                },
                _remoteBrowser_createTextNode: (parentId, nextSiblingId, id, value) => this.sendEvent(RemoteBrowserEventType.CreateTextNode, parentId, nextSiblingId, id, convertUrls("_textNode", value)),
                _remoteBrowser_updateElement: (id, attrKey, value) => {
                    if (value)
                        value = convertUrls(attrKey, value);

                    if (!attrKey.startsWith("on"))
                        this.sendEvent(RemoteBrowserEventType.UpdateElement, id, attrKey, value);
                },
                _remoteBrowser_removeElement: id => this.sendEvent(RemoteBrowserEventType.RemoveElement, id),
                _remoteBrowser_close: message => this.destroy(message),
                _remoteBrowser_addEventListener: name => this.sendEvent(RemoteBrowserEventType.AddEventListener, name),
                _remoteBrowser_onNavigated: () => this.onNavigated()
            });

            for (const file of BrowserClient.evaluateOnNewDocumentFiles)
                await this.page.evaluateOnNewDocument(file);
        }
        
        await this.page.goto(url);
    }

    async setClientDimensions(width: number, height: number) {
        await this.page.setViewport({
            width,
            height
        });
    }

    onNavigated() {
        this.sendEvent(RemoteBrowserEventType.UrlChanged, this.page.mainFrame().url());
        this.sendEvent(RemoteBrowserEventType.NewDocument);
        this.pageAssetManager = new PageAssetManager(this.id, this.page.url(), this.createProxiedFunction("_remoteBrowser_fetch") as any);
    }

    createProxiedFunction(name: string) {
        return (...args: any[]) => this.page.evaluate(`${name}(...JSON.parse(decodeURIComponent("${encodeURIComponent(JSON.stringify(args))}")))`);
    }
}
