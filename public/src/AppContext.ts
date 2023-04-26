
const progressValues = [0, 10, 70, 100];

export const AppContext = new class AppContext {
    #navbar = document.querySelector(".toolbar-navigation") as HTMLDivElement;

    #displaying = false;
    get displaying() {
        return this.#displaying;
    }

    set displaying(value: boolean) {
        if (this.#displaying === value) return;
        this.#displaying = value;

        if (value) {
            this.#navbar.hidden = false;
            this.ContentFrame.idle = false;
        } else {
            this.#navbar.hidden = true;
            this.ContentFrame.idle = true;
        }
    }

    AddressBar = new class AddressBar {
        #element = document.querySelector(".address-bar") as HTMLInputElement;
        get element() {
            return this.#element;
        }
        
        #progress = 0;
        #progressClassName?: string;
        get progress() {
            return this.#progress;
        }
        set progress(value) {
            if (this.#progress === value) return;

            if (!progressValues.includes(value))
                throw new Error(`Invalid progress value. Allowed: ${progressValues.join(", ")}`);
            if (value < this.#progress)
                this.#progress = 0;

            if (this.#progressClassName)
                this.#element.classList.remove(this.#progressClassName);
            this.#progressClassName = `progress-${this.#progress}-${value}`;
            this.#element.classList.add(this.#progressClassName);

            this.#progress = value;
        }
    }

    ContentFrame = new class ContentFrame {
        #element = document.querySelector(".content-frame") as HTMLIFrameElement;
        get element() {
            return this.#element;
        }
        
        set idle(value: boolean) {
            if (value)
                this.#element.classList.add("content-frame-idle");
            else
                this.#element.classList.remove("content-frame-idle");
        }

        get dimensions() {
            return {
                width: this.#element.offsetWidth,
                height: this.#element.offsetHeight
            }
        }
    }
}
