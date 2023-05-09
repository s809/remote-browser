export const enum RemoteBrowserEventType {
    NewDocument = "new_document",
    UrlChanged = "url_changed",
    CreateElement = "create_element",
    CreateTextNode = "create_text_node",
    UpdateElement = "update_element",
    RemoveElement = "remove_element",
    AddEventListener = "add_event_listener",

    Navigate = "navigate",
    SetClientDimensions = "set_client_dimensions",
    ScrollElement = "scroll_element",
    ClickElement = "click_element"
}

export interface RemoteBrowserEvents {
    [RemoteBrowserEventType.NewDocument]: () => void;
    [RemoteBrowserEventType.UrlChanged]: (url: string) => void;
    [RemoteBrowserEventType.CreateElement]: (parentId: number | null, nextSiblingId: number | null, id: number, type: string, attributes: Record<string, string>) => void;
    [RemoteBrowserEventType.CreateTextNode]: (parentId: number, nextSiblingId: number | null, id: number, value: string) => void;
    [RemoteBrowserEventType.UpdateElement]: (id: number, attrKey: string, value: string | null) => void;
    [RemoteBrowserEventType.RemoveElement]: (id: number) => void;
    [RemoteBrowserEventType.AddEventListener]: (name: string) => void;

    [RemoteBrowserEventType.Navigate]: (value: string) => void;
    [RemoteBrowserEventType.SetClientDimensions]: (width: number, height: number) => void;
    [RemoteBrowserEventType.ScrollElement]: (id: number, x: number, y: number) => void;
    [RemoteBrowserEventType.ClickElement]: (id: number, x: number, y: number) => void;
}
