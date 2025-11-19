export class FrameIndexPattern {
    constructor(animationConfig, duration = 500, loop = true) {
        this.currentTime = 0;
        this.animationConfig = animationConfig;
        
        // Store duration and loop status
        this.duration = animationConfig.duration ?? duration;
        this.loop = loop;
        
        // Flag to check if the animation is finished (used only if loop is false)
        this.isFinished = false; 
    }

    get frame() {
        const {frames} = this.animationConfig;
        
        // Ensure we return the last frame if finished (non-looping)
        if (this.isFinished) {
            return frames[frames.length - 1].frame;
        }

        // Standard frame lookup
        for (let i = frames.length - 1; i >= 0; i--) {
            if (this.currentTime >= frames[i].time) {
                return frames[i].frame;
            }
        }
        
        return frames[0].frame; 
    }

    step(delta) {
        if (this.isFinished && !this.loop) {
            // Do nothing, hold the last frame
            return;
        }

        this.currentTime += delta;
        
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                // If looping, reset time
                this.currentTime = this.currentTime % this.duration; 
            } else {
                // If not looping, snap to the end and mark as finished
                this.currentTime = this.duration;
                this.isFinished = true;
            }
        }
    }

}