import { ServerConnection } from "./ServerConnection.js";
import { AppContext } from "./AppContext.js";
import { config } from "./config.js";

var connection: ServerConnection | null = null;

const addressBarEl = AppContext.AddressBar.element;
addressBarEl.addEventListener("keydown", e => {
    if (e.key === "Enter")
        navigate();
});

var lastNavigateUrl: string | null;
async function navigate() {
    if (!addressBarEl.value.trim().length) return;

    AppContext.AddressBar.progress = 10;
    history.replaceState(null, "", `#${addressBarEl.value}`);

    if (lastNavigateUrl) {
        lastNavigateUrl = addressBarEl.value;
        return;
    } else {
        lastNavigateUrl = addressBarEl.value;
    }

    try {
        if (!connection) {
            addressBarEl.disabled = true;
            connection = await ServerConnection.create(config.wsUrl);
            setupEvents();
        }
    } catch (e) {
        showFatalError("Failed to connect!");
        return;
    } finally {
        addressBarEl.disabled = false;
    }

    connection.sendEvent("navigate", addressBarEl.value);
}

function showFatalError(message: string) {
    connection = null;
    lastNavigateUrl = null;
    alert(message);
    AppContext.AddressBar.progress = 100;
    AppContext.displaying = false;
}

async function setupEvents() {
    connection?.addEventListener("close", ({ reason }) => showFatalError(reason.length ? reason : "Disconnected!"));

    connection?.eventReceiver.addEventListener("page_created", () => {
        AppContext.displaying = true;
    });

    connection?.eventReceiver.addEventListener("", () => {

    });
}

if (window.location.hash.length) {
    addressBarEl.value = decodeURI(window.location.hash.slice(1));
    navigate();
}
