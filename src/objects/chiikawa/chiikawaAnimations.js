// chiikawaAnimations.js

// ===============================
// === Base Frame Generators =====
// ===============================

// Standing/Idle = slower (200ms per frame)
const makeStandingFrames = (startFrame, count) => ({
    duration: count * 200,
    frames: Array.from({ length: count }, (_, i) => ({
        time: i * 200,
        frame: startFrame + i
    }))
});

// Walking / transitions / sequences = faster (100ms per frame)
const makeWalkingFrames = (startFrame, count) => {
    const ms = 100;
    return {
        duration: count * ms,
        frames: Array.from({ length: count }, (_, i) => ({
            time: i * ms,
            frame: startFrame + i
        }))
    };
};


// ===============================
// === CHIIKAWA MAIN ANIMATIONS ===
// ===============================

// STAND (frames 0–7)   → 8 frames
export const STAND_RIGHT = makeStandingFrames(0, 8);
export const STAND_LEFT   = STAND_RIGHT;


// WALK (frames 8–23) → 16 frames
export const WALK_RIGHT = makeWalkingFrames(8, 16);
export const WALK_LEFT  = WALK_RIGHT;


// ===============================
// === COMMAND ANIMATIONS ========
// ===============================

// SIT (frames 24–31) → 8 frames (The transition down to sitting pose)
export const SIT = makeWalkingFrames(24, 9);


// SIT_LOOP: Rapid loop between frames 30 and 31 (40ms per frame, 80ms total loop duration)
export const SIT_LOOP = {
    duration: 80, 
    frames: [
        { time: 0,   frame: 30 }, 
        { time: 40,  frame: 31 }  // Final sitting frame
    ]
};


// SIT_TO_STAND (frames 32–39) → 8 frames
export const SIT_TO_STAND = makeWalkingFrames(32, 8);


// CRY (frames 41–56) → 16 frames (New definition as requested)
export const CRY = makeWalkingFrames(40, 16);


// DANCE (frames 57–72) → 16 frames (New definition as requested)
export const DANCE = makeWalkingFrames(57, 15);