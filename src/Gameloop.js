export class Gameloop {
    constructor(update, render) {
        this.lastFrameTime = 0;
        this.accumulatedTime = 0;
        this.timeStep = 1000 / 60; // Targeting 60 FPS
        this.update = update; // can be async
        this.render = render;
        this.rafId = null; // Animation frame ID
        this.isRunning = false; // To track if the loop is running
        this.runningUpdate = false; // To track if async update is in progress
    }

    mainloop = async (timestamp) => {
        if (!this.isRunning) return; // Exit if not running
        let deltaTime = timestamp - this.lastFrameTime; // Calculate time since last frame
        this.lastFrameTime = timestamp; // Update the last frame time
        this.accumulatedTime += deltaTime; // Accumulate the elapsed time

        // Only run one async update at a time
        if (!this.runningUpdate) {
            this.runningUpdate = true; // Set the running update flag
            while (this.accumulatedTime >= this.timeStep) {
                await this.update(this.timeStep); // Call the update function
                this.accumulatedTime -= this.timeStep; // Reduce the accumulated time
            }
            this.runningUpdate = false; // Reset the running update flag
        }
        this.render(); // Call the render function
        this.rafId = requestAnimationFrame(this.mainloop); // Request the next frame
    }

    start() {
        if (this.isRunning) return; // Prevent starting if already running
        this.isRunning = true; // Set running flag
        this.lastFrameTime = performance.now(); // Get current time
        this.rafId = requestAnimationFrame(this.mainloop); // Start the loop
    }

    stop() {
        if (this.rafId) cancelAnimationFrame(this.rafId); // Cancel the animation frame
        this.isRunning = false; // Reset running flag
    }
}