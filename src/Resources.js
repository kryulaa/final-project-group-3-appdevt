class Resources {
    constructor() {
        this.toLoad = {
            island: '/sprites/island.png',
            water: '/sprites/water.png',
            chiikawa: '/sprites/chiikawa.png',
                chiikawa_shadow: '/sprites/chiikawa_shadow.png',
        };
    
        this.images = {};

        Object.keys(this.toLoad).forEach((key) => {
            const img = new Image();
            img.src = this.toLoad[key];
            this.images[key] = {
                image: img,
                isloaded: false,
            }
            img.onload = () => {
                this.images[key].isLoaded = true;
            };
        });
    }
}

export const resources = new Resources();