// ===============================
// === Base Frame Generators =====
// ===============================

const makeStandingFrames = (startFrame, count) => ({
    duration: count * 200,
    frames: Array.from({ length: count }, (_, i) => ({
        time: i * 200,
        frame: startFrame + i
    }))
});

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
// === ANOKO ANIMATIONS ==========
// ===============================

// IDLE (frames 0–2)
export const ANOKO_STAND = makeStandingFrames(0, 3);

// WALK (frames 3–5)
export const ANOKO_WALK = makeWalkingFrames(3, 3);