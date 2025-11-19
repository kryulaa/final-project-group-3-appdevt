export class ChatBubble {
    constructor() {
        this.message = "";
        this.isTyping = false;
        this.timer = 0;
        this.duration = 5000; // visible for 5s
        this.maxWidth = 150;   // max bubble width for wrapping
        // Add a placeholder to store the external local reference
        this.isLocalPlayer = false; 
    }

    startTyping() {
        this.isTyping = true;
        this.message = "";
        this.timer = 0;
    }

    sendMessage() {
        this.isTyping = false;
        this.timer = 0; // reset timer to start countdown
    }

    handleKey(key) {
        if (!this.isTyping) return;
        if (key === "Backspace") this.message = this.message.slice(0, -1);
        else if (key.length === 1) this.message += key;
    }

    setMessage(message) {
        this.message = message;
        this.timer = 0;       // start counting for display duration
        this.isTyping = false;
    }

    update(delta) {
        // Only start countdown after typing finished or message set
        if (!this.isTyping && this.message.length > 0) {
            this.timer += delta;
            if (this.timer >= this.duration) {
                this.message = "";
                this.timer = 0;
            }
        }
    }

    draw(ctx, x, y, nameHeight = 14, spriteHeight = 64) {
        let displayMessage = this.message;
        let showTypingAnimation = false;
        
        // --- NEW LOGIC FOR TYPING ANIMATION CONTROL ---
        if (this.isTyping) {
            // 1. Local Player (or if you can't distinguish, default to always showing): 
            // The local player always sees the typing progress.
            if (this.isLocalPlayer) {
                showTypingAnimation = true;
            }
            // 2. Remote Players: Only show typing if there is NO message currently visible.
            else if (displayMessage.length === 0) {
                showTypingAnimation = true;
            }
            
            // If the typing animation is active, we should use the typing buffer content, 
            // not the message content, especially for remote players.
            // For remote players, displayMessage is already "" when showTypingAnimation is true.
            if (!this.isLocalPlayer) {
                 displayMessage = ""; 
            }
        }
        // --- END NEW LOGIC ---

        if (displayMessage.length === 0 && !showTypingAnimation) return;

        const paddingX = 8;
        const paddingY = 4;
        const radius = 5;

        ctx.save();
        ctx.font = "10px Arial";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.imageSmoothingEnabled = true;

        // Apply typing animation (dots) to the displayed text
        let displayText = displayMessage;
        if (showTypingAnimation) {
            const dotCount = Math.floor((Date.now() / 500) % 4);
            if (displayText.length === 0) {
                // If message is empty (remote player typing), just show dots
                displayText = ".".repeat(dotCount);
            } else {
                // If message is present (local player typing), append dots to what they've written
                displayText += ".".repeat(dotCount);
            }
        }

        // Wrap long text
        const words = displayText.split(" ");
        const lines = [];
        let currentLine = "";
        for (let word of words) {
            const testLine = currentLine ? currentLine + " " + word : word;
            if (ctx.measureText(testLine).width > this.maxWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        // Bubble size
        let textWidth = 0;
        lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > textWidth) textWidth = w;
        });
        const bubbleWidth = textWidth + paddingX * 2;
        const bubbleHeight = lines.length * 12 + paddingY * 2;

        // Bubble position above player
        const bx = Math.round(x - bubbleWidth / 2);
        const by = Math.round(y - spriteHeight - nameHeight - bubbleHeight - 5);

        // Draw bubble
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, radius);
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = "black";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + paddingX, by + paddingY + i * 12);
        }

        ctx.restore();
    }
}