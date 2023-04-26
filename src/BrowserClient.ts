import Joi from "joi";
import puppeteer, { Browser, Page } from "puppeteer";
import { RawData, WebSocket } from "ws";
import { RemoteBrowserEventType, RemoteBrowserEvents } from "../public/src/ServerConnection";

const JoiCustom = Joi.defaults(schema => schema.required());
const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export class BrowserClient {
    private destroyed = false;
    private pagePrepared = false;

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
        }],
        ["set_client_dimensions", {
            schema: [JoiCustom.number(), JoiCustom.number()],
            handler: this.setClientDimensions
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
            BrowserClient.browser = await puppeteer.launch({ headless: false, devtools: true });
        
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
        
        this.sendEvent(RemoteBrowserEventType.PageCreated);
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

    async navigate(url: string) {
        if (!url.match(urlRegex))
            url = `https://google.com/search?q=${encodeURIComponent(url)}`;
            
        if (!this.pagePrepared) {
            this.pagePrepared = true;

            await this.page.exposeFunction("_remoteBrowser_log", (...args: string[]) => console.log("Remote browser:", ...args));
            await this.page.exposeFunction("_remoteBrowser_createElement", (parentId: number, leftSiblingId: number, id: number, type: string, attributes: Record<string, string>) => this.sendEvent(RemoteBrowserEventType.CreateElement, parentId, leftSiblingId, id, type, attributes));
            await this.page.exposeFunction("_remoteBrowser_createTextNode", (parentId: number, leftSiblingId: number, id: number, value: string) => this.sendEvent(RemoteBrowserEventType.CreateTextNode, parentId, leftSiblingId, id, value));
            await this.page.exposeFunction("_remoteBrowser_updateElement", (id: number, attrKey: string, value: string) => this.sendEvent(RemoteBrowserEventType.UpdateElement, id, attrKey, value));
            await this.page.exposeFunction("_remoteBrowser_removeElement", (id: number) => this.sendEvent(RemoteBrowserEventType.RemoveElement, id));

            await this.page.evaluateOnNewDocument(`
                const idSymbol = Symbol("_remoteBrowser_id");
                var nextId = 0;

                const mutationObserver = new MutationObserver(mutations => {
                    for (const mutation of mutations) {
                        switch (mutation.type) {
                            case "childList":
                                addNodes:
                                for (const node of mutation.addedNodes) {
                                    if (!(idSymbol in mutation.target || node.tagName === "HTML")) continue;
                                    const prevSiblingId = mutation.previousSibling?.[idSymbol];

                                    switch (node.nodeType) {
                                        case Node.ELEMENT_NODE:
                                            if (node.tagName === "SCRIPT")
                                                continue addNodes;
                                            _remoteBrowser_createElement(mutation.target?.[idSymbol], prevSiblingId, nextId, node.tagName, Object.fromEntries([...node.attributes].filter(x => !x.name.startsWith("on")).map(x => [x.name, x.nodeValue])));
                                            break;
                                        case Node.TEXT_NODE:
                                            _remoteBrowser_createTextNode(mutation.target[idSymbol], prevSiblingId, nextId, node.nodeValue);
                                            break;
                                        default:
                                            continue addNodes;
                                    }

                                    node[idSymbol] = nextId++;
                                }

                                for (const node of mutation.removedNodes) {
                                    if (node[idSymbol])
                                        _remoteBrowser_removeElement(node[idSymbol]);
                                }

                                break;
                            case "attributes":
                                if (mutation.target[idSymbol])
                                    _remoteBrowser_updateElement(mutation.target[idSymbol], mutation.attributeName, mutation.target.getAttribute(mutation.attributeName));
                                break;
                        }
                    }
                });

                mutationObserver.observe(document, {
                    attributes: true,
                    childList: true,
                    subtree: true
                });
            `);
            await this.page.evaluateOnNewDocument(`
                var _interfaces = Object.getOwnPropertyNames(window).filter(function(i) {
                    return /^HTML/.test(i);
                }).map(function(i) {
                    return window[i];
                });

                for (var i = 0; i < _interfaces.length; i++) {
                    (function(original) {
                        _interfaces[i].prototype.addEventListener = function(type, listener, useCapture) {
                            _remoteBrowser_log("addEventListener " + type, listener, useCapture);

                            return original.apply(this, arguments);
                        }
                    })(_interfaces[i].prototype.addEventListener);
                }
            `);
        }
        
        await this.page.goto(url);
    }

    async setClientDimensions(width: number, height: number) {
        await this.page.setViewport({
            width,
            height
        });
    }
}
