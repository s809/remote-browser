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
    SetElementScroll = "set_element_scroll",
    ClickElement = "click_element"
}

export interface RemoteBrowserEvents {
    [RemoteBrowserEventType.NewDocument]: () => void;
    [RemoteBrowserEventType.UrlChanged]: (url: string) => void;
    [RemoteBrowserEventType.CreateElement]: (parentId: number | null, leftSiblingId: number | null, id: number, type: string, attributes: Record<string, string>) => void;
    [RemoteBrowserEventType.CreateTextNode]: (parentId: number, leftSiblingId: number | null, id: number, value: string) => void;
    [RemoteBrowserEventType.UpdateElement]: (id: number, attrKey: string, value: string | null) => void;
    [RemoteBrowserEventType.RemoveElement]: (id: number) => void;
    [RemoteBrowserEventType.AddEventListener]: (name: string) => void;

    [RemoteBrowserEventType.Navigate]: (value: string) => void;
    [RemoteBrowserEventType.SetClientDimensions]: (width: number, height: number) => void;
    [RemoteBrowserEventType.SetElementScroll]: (id: number, x: number, y: number) => void;
    [RemoteBrowserEventType.ClickElement]: (id: number, x: number, y: number) => void;
}
