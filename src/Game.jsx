import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { resources } from './Resources.js';
import { Gameloop } from './Gameloop.js';
import { Input } from './Input.js'; 
import { Vector2 } from './Vector2.js';
import { Camera } from './Camera.js';
import { Sprite } from './Sprite.js';
import { Animations } from './Animations.js';
import { FrameIndexPattern } from './FrameIndexPattern.js';

// --- 1. IMPORTS FROM CHIIKAWA ANIMATIONS ---
import { 
    STAND_RIGHT, WALK_RIGHT, WALK_LEFT, STAND_LEFT, 
    CRY, DANCE, SIT, SIT_LOOP, SIT_TO_STAND 
} from './objects/chiikawa/chiikawaAnimations';

// --- 2. IMPORTS FROM ANOKO ANIMATIONS ---
import { 
    ANOKO_STAND, ANOKO_WALK 
} from './objects/anoko/anokoAnimations';

// --- HELPER FUNCTIONS ---
const getDistance = (p1, p2) => {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

// --- CONFIGURATION ---
const WORLD_SIZE = 900; 
const PORTAL_BOX = { x: 50, y: 50, w: 100, h: 100 }; 

const COUNTDOWN_SECONDS = 10;
const MIN_PLAYERS_TO_START = 3; 
const MATCH_DURATION_SECONDS = 120;
const HEADSTART_SECONDS = 10; 
const TAG_DISTANCE = 80; 
const PLAYER_TIMEOUT_MS = 5000; 

// --- ZOOM CONFIGURATION ---
const VIEW_WIDTH = 854; 
const VIEW_HEIGHT = 480;

const VALID_ANIMATIONS = [
    "standRight", "walkRight", "standLeft", "walkLeft", 
    "cry", "dance", "sit", "sitLoop", "sitToStand"
];

const COMMAND_MAP = {
    "/cry": "cry",
    "/dance": "dance",
    "/sit": "sit", 
    "/stand": "sitToStand",
};

// ---------------------------
// CHAT BUBBLE CLASS
// ---------------------------
class ChatBubble {
    constructor() {
        this.message = "";
        this.isTyping = false;
        this.timer = 0;
        this.duration = 5000;
        this.maxWidth = 150;
    }

    startTyping() {
        this.isTyping = true;
        this.message = "";
        this.timer = 0;
    }

    sendMessage() {
        this.isTyping = false;
    }

    handleKey(key) {
        if (!this.isTyping) return;
        if (key === "Backspace") this.message = this.message.slice(0, -1);
        else if (key.length === 1 && this.message.length < 50) this.message += key;
    }

    setMessage(message) {
        if (this.message !== message) {
            this.message = message;
            this.timer = 0;      
            this.isTyping = false;
        }
    }

    setTypingStatus(status) {
        if (this.isTyping !== status) {
            this.isTyping = status;
            if (status) {
                this.message = "";
                this.timer = 0;
            }
            if (!status && this.message.length === 0) {
                 this.message = "";
                 this.timer = 0;
            }
        }
    }

    update(delta) {
        if (!this.isTyping && this.message.length > 0) {
            this.timer += delta;
            if (this.timer >= this.duration) {
                this.message = "";
                this.timer = 0;
            }
        }
    }

    draw(ctx, x, y, nameHeight = 8) {
        let displayMessage = this.message;
        let showTypingAnimation = this.isTyping;

        if (displayMessage.length === 0 && !showTypingAnimation) return;

        const paddingX = 8;
        const paddingY = 4;
        const radius = 5;

        ctx.save();
        ctx.font = "10px Arial";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.imageSmoothingEnabled = true;

        let displayText = displayMessage;
        
        if (showTypingAnimation) {
            const dotCount = Math.floor((Date.now() / 500) % 4);
            displayText += ".".repeat(dotCount);
        }

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

        let textWidth = 0;
        lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > textWidth) textWidth = w;
        });
        
        const bubbleWidth = textWidth + paddingX * 2;
        const bubbleHeight = lines.length * 12 + paddingY * 2;

        const verticalOffset = 3; 
        const bx = Math.round(x - bubbleWidth / 2);
        const by = Math.round(y - nameHeight - bubbleHeight + verticalOffset); 

        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, radius);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "black";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + paddingX, by + paddingY + i * 12);
        }

        ctx.restore();
    }
}

// --- ANIMATION CREATORS ---

function createChiikawaAnimations() {
    return new Animations({
        standRight: new FrameIndexPattern(STAND_RIGHT),
        walkRight: new FrameIndexPattern(WALK_RIGHT),
        standLeft: new FrameIndexPattern(STAND_LEFT),
        walkLeft: new FrameIndexPattern(WALK_LEFT), 
        cry: new FrameIndexPattern(CRY),
        dance: new FrameIndexPattern(DANCE), 
        sit: new FrameIndexPattern(SIT),
        sitLoop: new FrameIndexPattern(SIT_LOOP), 
        sitToStand: new FrameIndexPattern(SIT_TO_STAND), 
    });
}

function createAnokoAnimations() {
    return new Animations({
        standRight: new FrameIndexPattern(ANOKO_STAND),
        walkRight: new FrameIndexPattern(ANOKO_WALK),
        standLeft: new FrameIndexPattern(ANOKO_STAND),
        walkLeft: new FrameIndexPattern(ANOKO_WALK), 
        
        cry: new FrameIndexPattern(ANOKO_STAND),
        dance: new FrameIndexPattern(ANOKO_WALK), 
        sit: new FrameIndexPattern(ANOKO_STAND),
        sitLoop: new FrameIndexPattern(ANOKO_STAND), 
        sitToStand: new FrameIndexPattern(ANOKO_STAND), 
    });
}

export default function Game({ session }) {
    const canvasRef = useRef(null);
    const myId = session.user.id; 

    // --- ENGINE REFS ---
    const engineRef = useRef({
        input: new Input(),
        camera: new Camera(VIEW_WIDTH, VIEW_HEIGHT),
        loop: null,
        players: {}, 
        gameState: {
            portalTimer: COUNTDOWN_SECONDS,
            playersInPortal: 0,
            myLobby: 'main',
            matchEndTime: null,
            isActive: false,
            winner: null,
            isStarting: false 
        },
        localState: {
            lastDirection: "RIGHT",
            currentCommandAnimation: null,
            commandAnimationTime: 0,
            spectatorPos: new Vector2(0, 0) 
        }
    });

    const resetTimerRef = useRef(null);

    // --- SPRITE CREATION ---

    const createChiikawaSprite = () => {
        const s = new Sprite({
            resource: resources.images.chiikawa,
            frameSize: new Vector2(64, 64),
            hFrames: 7, vFrames: 11, scale: 1, animations: null 
        });
        s.animations = createChiikawaAnimations();
        return s;
    };

    const createAnokoSprite = () => {
        // Fallback checks to ensure visibility
        if (!resources.images.anoko) {
            console.warn("Anoko image missing! Falling back.");
            const s = createChiikawaSprite();
            s.scale = 3; 
            return s;
        }
        
        if (resources.images.anoko.isLoaded && resources.images.anoko.image.width < 200) {
             console.warn("Anoko image dimensions suspicious. Falling back.");
             const s = createChiikawaSprite();
             s.scale = 3; 
             return s;
        }

        const s = new Sprite({
            resource: resources.images.anoko, 
            frameSize: new Vector2(200, 200),
            hFrames: 6, 
            vFrames: 1, 
            scale: 1, 
            animations: null 
        });
        s.animations = createAnokoAnimations();
        return s;
    };

    const tagPlayer = async (victimId) => {
        if(engineRef.current.players[victimId]) engineRef.current.players[victimId].status = 'dead';
        await supabase.rpc('tag_player', { victim_id: victimId });
    };

    const triggerSurvivorWin = async () => {
        console.log("Triggering Survivor Win");
        await supabase.rpc('trigger_survivor_win');
    };

    const triggerItWin = async () => {
        console.log("Triggering IT Win");
        await supabase.from('game_state').update({ winner: 'it' }).eq('id', 1);
    };

    const leaveDungeon = async () => {
        await supabase.from('players').update({ 
            lobby_id: 'main', x: 400, y: 300, is_it: false, status: 'alive' 
        }).eq('id', myId);
    };

    const getRandomPosition = () => {
        const padding = 100;
        return {
            x: Math.floor(Math.random() * (WORLD_SIZE - padding * 2)) + padding,
            y: Math.floor(Math.random() * (WORLD_SIZE - padding * 2)) + padding
        };
    };

    const handleLobbyTransition = async (newLobby, isIt) => {
        if (newLobby === 'dungeon') {
            if (!isIt) {
                const pos = getRandomPosition();
                engineRef.current.players[myId].pos.x = pos.x;
                engineRef.current.players[myId].pos.y = pos.y;
                await supabase.from('players').update({ x: pos.x, y: pos.y }).eq('id', myId);
            } else {
                 await supabase.from('players').update({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }).eq('id', myId);
                 engineRef.current.players[myId].pos.x = WORLD_SIZE / 2;
                 engineRef.current.players[myId].pos.y = WORLD_SIZE / 2;
            }
        }
    };

    const handleCanvasClick = async () => {
        if (engineRef.current.gameState.winner) {
            await supabase.rpc('return_to_lobby'); 
        }
    };

    const checkDungeonDisconnectWin = () => {
        const gs = engineRef.current.gameState;
        if (!gs.isActive || gs.winner) return;

        const players = Object.values(engineRef.current.players);
        const dungeonPlayers = players.filter(p => p.lobby_id === 'dungeon' && p.status === 'alive');

        const itExists = dungeonPlayers.some(p => p.is_it);
        
        // IT Disconnected -> Survivors Win
        if (!itExists && dungeonPlayers.length > 0) {
            triggerSurvivorWin();
            return;
        }
        
        // Survivors Disconnected -> IT Wins
        const survivorsExist = dungeonPlayers.some(p => !p.is_it);
        if (itExists && !survivorsExist) {
            triggerItWin();
            return;
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const engine = engineRef.current;

        const handleResize = () => {
            canvas.width = VIEW_WIDTH;
            canvas.height = VIEW_HEIGHT;
            const scaleX = window.innerWidth / VIEW_WIDTH;
            const scaleY = window.innerHeight / VIEW_HEIGHT;
            const scale = Math.max(scaleX, scaleY); 
            canvas.style.width = `${VIEW_WIDTH * scale}px`;
            canvas.style.height = `${VIEW_HEIGHT * scale}px`;
            ctx.imageSmoothingEnabled = false;
            engine.camera.canvasWidth = VIEW_WIDTH;
            engine.camera.canvasHeight = VIEW_HEIGHT;
        };
        window.addEventListener('resize', handleResize);
        handleResize(); 

        const init = async () => {
            await supabase.from('players').update({
                lobby_id: 'main', x: 400, y: 300, is_it: false, status: 'alive',
                last_seen_at: new Date().toISOString()
            }).eq('id', myId);

            const { data: pData } = await supabase.from('players').select('*, profiles(username)');
            if (pData) pData.forEach(p => updatePlayerState(p));

            const { data: gData } = await supabase.from('game_state').select('*').eq('id', 1).single();
            if (gData) updateGlobalState(gData);
        };

        // --- FIXED UPDATE PLAYER STATE ---
        const updatePlayerState = (p) => {
            const name = p.profiles?.username || 'Unknown';
            const lastSeenTime = new Date(p.last_seen_at).getTime();

            if (!engine.players[p.id]) {
                const newSprite = p.is_it ? createAnokoSprite() : createChiikawaSprite();
                engine.players[p.id] = {
                    id: p.id,
                    pos: new Vector2(p.x, p.y),
                    targetPos: new Vector2(p.x, p.y), 
                    sprite: newSprite,
                    shadow: resources.images.chiikawa_shadow, 
                    chatBubble: new ChatBubble(),
                    name: name,
                    is_it: p.is_it,
                    lobby_id: p.lobby_id || 'main',
                    status: p.status || 'alive',
                    facing: p.facing || 'RIGHT',
                    isMe: p.id === myId,
                    commandAnimation: p.command_animation,
                    lastSeen: lastSeenTime 
                };
                if (p.id === myId) {
                    engine.localState.spectatorPos.x = p.x;
                    engine.localState.spectatorPos.y = p.y;
                } else {
                    engine.players[p.id].chatBubble.setTypingStatus(p.is_typing);
                }
            } else {
                const player = engine.players[p.id];
                
                // Sprite Swap if role changes
                if (player.is_it !== p.is_it) {
                    player.sprite = p.is_it ? createAnokoSprite() : createChiikawaSprite();
                }
                
                // --- CRITICAL FIX: Update local player object properties ---
                player.lobby_id = p.lobby_id; // Update for EVERYONE including me
                player.is_it = p.is_it;
                player.status = p.status;
                player.commandAnimation = p.command_animation;
                player.lastSeen = lastSeenTime; 
                
                if (!player.isMe) {
                    player.targetPos.x = p.x;
                    player.targetPos.y = p.y;
                    player.facing = p.facing;
                    player.chatBubble.setTypingStatus(p.is_typing);
                } else {
                    // Local Player Transition Logic
                    if (engine.gameState.myLobby !== p.lobby_id) {
                        handleLobbyTransition(p.lobby_id, p.is_it);
                        engine.gameState.isStarting = false; 
                        engine.gameState.portalTimer = COUNTDOWN_SECONDS; 
                    }
                    engine.gameState.myLobby = p.lobby_id;
                }
            }
        };

        const updateGlobalState = (data) => {
            if (!data) return;
            const gs = engine.gameState;
            if (data.match_start_time) {
                gs.matchEndTime = new Date(data.match_start_time).getTime() + (MATCH_DURATION_SECONDS * 1000);
            } else {
                gs.matchEndTime = null;
            }
            gs.isActive = data.is_active;
            gs.winner = data.winner;

            if (data.winner && !resetTimerRef.current) {
                resetTimerRef.current = setTimeout(async () => {
                    await supabase.rpc('return_to_lobby');
                    resetTimerRef.current = null; 
                }, 5000);
            } else if (!data.winner && resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
        };

        const handleKeyDown = (e) => {
            const myPlayer = engine.players[myId];
            if (!myPlayer) return;
            const chatBubble = myPlayer.chatBubble;
            const input = engine.input;

            if (e.key === "Enter") {
                if (!chatBubble.isTyping) {
                    chatBubble.startTyping(); 
                } else {
                    if (chatBubble.message.length === 0) {
                         chatBubble.sendMessage(); 
                         e.preventDefault(); return;
                    }
                    const commandKey = chatBubble.message.toLowerCase();
                    let commandAnimation = COMMAND_MAP[commandKey];
                    if (commandAnimation) {
                        chatBubble.setMessage(chatBubble.message); 
                        engine.localState.currentCommandAnimation = commandAnimation;
                        engine.localState.commandAnimationTime = 0; 
                        chatBubble.message = ""; 
                        chatBubble.sendMessage();
                    } else {
                        supabase.from("chat").insert([{ player_id: myId, message: chatBubble.message }]).then(({ error }) => { if(error) console.error(error); });
                        chatBubble.sendMessage(); 
                    }
                }
                e.preventDefault(); return;
            }
            if (chatBubble.isTyping) {
                chatBubble.handleKey(e.key);
                e.preventDefault(); return;
            }
            input.pressKey?.(e.key);
        };

        const handleKeyUp = (e) => {
            engine.input.releaseKey?.(e.key);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        let lastSync = 0;
        
        const update = (delta) => {
            const now = Date.now();
            const myPlayer = engine.players[myId];
            const lobby = engine.gameState.myLobby;
            const input = engine.input;

            // Disconnect Logic
            Object.keys(engine.players).forEach(key => {
                const p = engine.players[key];
                if (!p.isMe) {
                    if (now - p.lastSeen > PLAYER_TIMEOUT_MS) {
                        delete engine.players[key];
                        checkDungeonDisconnectWin();
                    }
                }
            });
            
            if (myPlayer) {
                const chatBubble = myPlayer.chatBubble;
                const localState = engine.localState;
                const isDead = myPlayer.status === 'dead';

                let isHeadstart = false;
                if (lobby === 'dungeon' && engine.gameState.isActive && engine.gameState.matchEndTime) {
                    const timeLeft = (engine.gameState.matchEndTime - Date.now()) / 1000;
                    const timeElapsed = MATCH_DURATION_SECONDS - timeLeft;
                    if (timeElapsed < HEADSTART_SECONDS) {
                        isHeadstart = true;
                    }
                }

                if (!isDead) {
                    localState.spectatorPos.x = myPlayer.pos.x;
                    localState.spectatorPos.y = myPlayer.pos.y;

                    const speed = (myPlayer.is_it) ? 4 : 3; 
                    const isTransitioning = localState.currentCommandAnimation === "sitToStand" || localState.currentCommandAnimation === "sit";
                    const isSittingLoop = localState.currentCommandAnimation === "sitLoop"; 

                    let dx = 0;
                    let dy = 0;

                    const movementBlocked = chatBubble.isTyping || isTransitioning || isSittingLoop || (isHeadstart && myPlayer.is_it);

                    if (!movementBlocked) {
                        if (input.heldDirections.includes("UP")) dy -= speed;
                        if (input.heldDirections.includes("DOWN")) dy += speed;
                        if (input.heldDirections.includes("LEFT")) { dx -= speed; localState.lastDirection = "LEFT"; }
                        if (input.heldDirections.includes("RIGHT")) { dx += speed; localState.lastDirection = "RIGHT"; }
                    } 
                    else if (isSittingLoop && !chatBubble.isTyping) { 
                        if (input.heldDirections.length > 0) {
                            localState.currentCommandAnimation = "sitToStand"; 
                            localState.commandAnimationTime = 0; 
                        }
                    }

                    if (dx !== 0 && dy !== 0) {
                        const f = 1 / Math.sqrt(2);
                        dx *= f; dy *= f;
                    }

                    const isMoving = (dx !== 0 || dy !== 0);

                    if (localState.currentCommandAnimation && !isSittingLoop && !isTransitioning && isMoving) {
                        localState.currentCommandAnimation = null;
                        localState.commandAnimationTime = 0;
                    }

                    myPlayer.pos.x += dx;
                    myPlayer.pos.y += dy;
                    myPlayer.pos.x = Math.max(25, Math.min(WORLD_SIZE - 25, myPlayer.pos.x));
                    myPlayer.pos.y = Math.max(25, Math.min(WORLD_SIZE - 25, myPlayer.pos.y));

                    if (localState.currentCommandAnimation) {
                        localState.commandAnimationTime += delta;
                        let duration = Infinity;
                        if (localState.currentCommandAnimation === "sitToStand" || localState.currentCommandAnimation === "sit") duration = 800;
                        else if (localState.currentCommandAnimation === "cry" || localState.currentCommandAnimation === "dance") duration = 1600; 

                        if (duration !== Infinity && localState.commandAnimationTime >= duration) {
                            if (localState.currentCommandAnimation === "sit") {
                                localState.currentCommandAnimation = "sitLoop"; 
                                localState.commandAnimationTime = 0;
                            } else { 
                                localState.currentCommandAnimation = null;
                                localState.commandAnimationTime = 0;
                            }
                        }
                    }

                    myPlayer.facing = localState.lastDirection;
                    
                    if (localState.currentCommandAnimation) {
                        myPlayer.sprite.animations.play(localState.currentCommandAnimation);
                    } else {
                        myPlayer.sprite.animations.play((dx !== 0 || dy !== 0)
                            ? (localState.lastDirection === "LEFT" ? "walkLeft" : "walkRight")
                            : (localState.lastDirection === "LEFT" ? "standLeft" : "standRight"));
                    }
                    
                    if (now - lastSync > 50) { 
                        supabase.from('players').update({ 
                            x: Math.round(myPlayer.pos.x), 
                            y: Math.round(myPlayer.pos.y),
                            facing: localState.lastDirection,
                            is_typing: chatBubble.isTyping,
                            command_animation: localState.currentCommandAnimation,
                            last_seen_at: new Date().toISOString()
                        }).eq('id', myId).then(() => {}); 
                        lastSync = now;
                    }
                    
                    engine.camera.follow({ x: myPlayer.pos.x, y: myPlayer.pos.y, w: 64, h: 64 });
                } 
                else {
                    const ghostSpeed = 5;
                    let dx = 0;
                    let dy = 0;
                    if (!chatBubble.isTyping) {
                        if (input.heldDirections.includes("UP")) dy -= ghostSpeed;
                        if (input.heldDirections.includes("DOWN")) dy += ghostSpeed;
                        if (input.heldDirections.includes("LEFT")) dx -= ghostSpeed;
                        if (input.heldDirections.includes("RIGHT")) dx += ghostSpeed;
                    }
                    localState.spectatorPos.x += dx;
                    localState.spectatorPos.y += dy;
                    localState.spectatorPos.x = Math.max(0, Math.min(WORLD_SIZE, localState.spectatorPos.x));
                    localState.spectatorPos.y = Math.max(0, Math.min(WORLD_SIZE, localState.spectatorPos.y));
                    myPlayer.sprite.animations.play('cry');
                    engine.camera.follow({ x: localState.spectatorPos.x, y: localState.spectatorPos.y, w: 0, h: 0 });
                }

                myPlayer.chatBubble.update(delta);
                myPlayer.sprite.step(delta);

                if (lobby === 'dungeon' && engine.gameState.isActive && !engine.gameState.winner) {
                    if (myPlayer.is_it && myPlayer.status === 'alive' && !isHeadstart) {
                        Object.values(engine.players).forEach(other => {
                            if (other.id !== myId && other.lobby_id === 'dungeon' && !other.is_it && other.status === 'alive') {
                                if (getDistance(myPlayer.pos, other.pos) < TAG_DISTANCE) {
                                    tagPlayer(other.id);
                                }
                            }
                        });
                    }
                }
            }

            Object.values(engine.players).forEach(p => {
                if (!p.isMe) {
                    const dx = p.targetPos.x - p.pos.x;
                    const dy = p.targetPos.y - p.pos.y;
                    p.pos.x += dx * 0.1; 
                    p.pos.y += dy * 0.1;

                    const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
                    const facing = (p.facing || 'RIGHT').toUpperCase();

                    if (p.status === 'dead') {
                        p.sprite.animations.play('cry'); 
                    }
                    else if (p.commandAnimation && VALID_ANIMATIONS.includes(p.commandAnimation)) {
                        p.sprite.animations.play(p.commandAnimation);
                    } else if (moving) {
                        p.sprite.animations.play(facing === "LEFT" ? "walkLeft" : "walkRight");
                    } else {
                        p.sprite.animations.play(facing === "LEFT" ? "standLeft" : "standRight");
                    }
                    
                    p.sprite.step(delta);
                    p.chatBubble.update(delta);
                }
            });

            if (lobby === 'main') {
                const inPortal = Object.values(engine.players).filter(p => 
                    p.lobby_id === 'main' &&
                    p.pos.x > PORTAL_BOX.x && p.pos.x < PORTAL_BOX.x + PORTAL_BOX.w &&
                    p.pos.y > PORTAL_BOX.y && p.pos.y < PORTAL_BOX.y + PORTAL_BOX.h
                );

                engine.gameState.playersInPortal = inPortal.length;
                
                if (inPortal.length >= MIN_PLAYERS_TO_START) {
                    inPortal.sort((a, b) => a.id.localeCompare(b.id));
                    
                    if (!engine.gameState.isStarting) {
                        engine.gameState.portalTimer -= (delta / 1000);
                        if (engine.gameState.portalTimer <= 0) {
                            engine.gameState.isStarting = true; 
                            engine.gameState.portalTimer = 0;
                            if (inPortal[0].isMe) {
                                supabase.rpc('start_dungeon_match', { player_ids: inPortal.map(p => p.id) })
                                    .then(({ error }) => { 
                                        if (error) {
                                            console.error(error);
                                            engine.gameState.isStarting = false; 
                                        }
                                    });
                            }
                        }
                    }
                } else {
                    engine.gameState.portalTimer = COUNTDOWN_SECONDS;
                    engine.gameState.isStarting = false;
                }
            }
            
            // --- TIMER WIN LOGIC ---
            if (lobby === 'dungeon' && engine.gameState.isActive && engine.gameState.matchEndTime) {
                if (Date.now() >= engine.gameState.matchEndTime && !engine.gameState.winner) {
                    // Trigger Survivor Win if time runs out
                    if (myPlayer && myPlayer.is_it) {
                        triggerSurvivorWin();
                    }
                }
            }
        };

        const render = () => {
            const lobby = engine.gameState.myLobby;
            const myPlayer = engine.players[myId];
            const vw = engine.camera.canvasWidth;
            const vh = engine.camera.canvasHeight;

            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            let camX, camY;

            if (lobby === 'dungeon' && myPlayer && myPlayer.is_it) {
                camX = engine.camera.position.x;
                camY = engine.camera.position.y;
            } else {
                camX = Math.max(0, Math.min(engine.camera.position.x, WORLD_SIZE - vw));
                camY = Math.max(0, Math.min(engine.camera.position.y, WORLD_SIZE - vh));
            }

            ctx.save();
            ctx.translate(-camX, -camY);

            if (lobby === 'main') {
                if (resources.images.island && resources.images.island.isLoaded) {
                    const pat = ctx.createPattern(resources.images.island.image, "repeat");
                    ctx.fillStyle = pat;
                } else { ctx.fillStyle = "#a8e6cf"; }
                ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
                ctx.strokeStyle = "#5aa78a"; ctx.lineWidth = 20; ctx.strokeRect(0,0,WORLD_SIZE,WORLD_SIZE);
                
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(PORTAL_BOX.x, PORTAL_BOX.y, PORTAL_BOX.w, PORTAL_BOX.h);
                ctx.strokeStyle = "white"; ctx.lineWidth = 5; ctx.strokeRect(PORTAL_BOX.x, PORTAL_BOX.y, PORTAL_BOX.w, PORTAL_BOX.h);
                
                const centerX = PORTAL_BOX.x + PORTAL_BOX.w / 2;
                const centerY = PORTAL_BOX.y + PORTAL_BOX.h / 2;
                ctx.fillStyle = "#555"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
                ctx.fillText("Dungeon Queue", centerX, centerY - 15);
                const count = engine.gameState.playersInPortal;
                
                // --- UPDATED QUEUE TEXT: "Need X more" ---
                if (count < MIN_PLAYERS_TO_START) {
                    ctx.font = "bold 14px monospace";
                    const needed = MIN_PLAYERS_TO_START - count;
                    const s = needed === 1 ? "" : "s";
                    ctx.fillText(`Need ${needed} more to start`, centerX, centerY + 15);
                } else {
                     ctx.fillStyle = "#ff4444"; ctx.font = "bold 24px monospace";
                     const text = engine.gameState.portalTimer <= 0 ? "GO!" : Math.ceil(engine.gameState.portalTimer);
                     ctx.fillText(text, centerX, centerY + 15);
                }
            } else {
                if (resources.images.island && resources.images.island.isLoaded) {
                    const pat = ctx.createPattern(resources.images.island.image, "repeat");
                    ctx.fillStyle = pat;
                } else { ctx.fillStyle = "#2b2b2b"; }
                
                ctx.fillRect(camX, camY, vw, vh);
                ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; 
                ctx.fillRect(camX, camY, vw, vh);

                ctx.strokeStyle = "#ff3333"; 
                ctx.lineWidth = 8; 
                ctx.setLineDash([20, 20]); 
                ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
                ctx.setLineDash([]);
            }

            const entitiesToDraw = [];
            Object.values(engine.players).forEach(p => {
                if (p.lobby_id === lobby) {
                    const halfW = p.sprite.frameSize.x / 2;
                    const halfH = p.sprite.frameSize.y / 2;
                    entitiesToDraw.push({
                        y: p.pos.y,
                        drawX: p.pos.x - halfW, 
                        drawY: p.pos.y - halfH, 
                        player: p
                    });
                }
            });
            entitiesToDraw.sort((a, b) => a.y - b.y);

            entitiesToDraw.forEach(ent => {
                const { player, drawX, drawY } = ent;
                const isDead = player.status === 'dead';
                ctx.globalAlpha = isDead ? 0.5 : 1.0;

                if (player.shadow && player.shadow.isLoaded) {
                    ctx.drawImage(player.shadow.image, player.pos.x - 32, player.pos.y + -22.5, 64, 32);
                }
                if (player.is_it) {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
                    ctx.beginPath(); ctx.arc(player.pos.x, player.pos.y, 35, 0, Math.PI*2); ctx.fill(); 

                    // --- VISIBILITY SAFEGUARD ---
                    // Draws a red circle around self if IT, ensuring you see yourself even if sprite is bugged
                    if (player.isMe) {
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                }

                ctx.save();
                const facing = (player.facing || 'RIGHT').toUpperCase();
                if (facing === "LEFT") {
                    ctx.translate(drawX + player.sprite.frameSize.x, 0);
                    ctx.scale(-1, 1);
                    player.sprite.drawImage(ctx, 0, drawY - 18); 
                } else {
                    player.sprite.drawImage(ctx, drawX, drawY - 18);
                }
                ctx.restore();

                if (player.is_it && player.sprite.frameSize.x < 100) {
                    ctx.save(); ctx.translate(player.pos.x, player.pos.y - 25); 
                    ctx.fillStyle = "#333";
                    ctx.rotate(0.2); ctx.fillRect(-8, -5, 5, 8); 
                    ctx.rotate(-0.4); ctx.fillRect(4, -5, 5, 8); 
                    ctx.restore();
                }

                ctx.textAlign = 'center'; ctx.font = 'bold 10px monospace';
                const nameY = drawY - 10; 
                ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
                ctx.strokeText(player.name, player.pos.x, nameY);
                ctx.fillStyle = (lobby === 'dungeon') ? "white" : (player.is_it ? "#ff4444" : "white");
                ctx.fillText(player.name, player.pos.x, nameY);
                player.chatBubble.draw(ctx, player.pos.x, nameY, 8);
                ctx.globalAlpha = 1.0;
            });
            ctx.restore();

            if (lobby === 'dungeon' && engine.gameState.isActive && myPlayer && myPlayer.is_it && myPlayer.status === 'alive') {
                let isHeadstart = false;
                let timeElapsed = 0;
                if(engine.gameState.matchEndTime) {
                    const timeLeft = (engine.gameState.matchEndTime - Date.now()) / 1000;
                    timeElapsed = MATCH_DURATION_SECONDS - timeLeft;
                    if(timeElapsed < HEADSTART_SECONDS) isHeadstart = true;
                }

                if (isHeadstart) {
                    ctx.fillStyle = "black"; ctx.fillRect(0, 0, vw, vh); 
                    ctx.fillStyle = "red"; ctx.font = "bold 30px monospace"; ctx.textAlign = "center";
                    ctx.fillText("WAKING UP...", vw/2, vh/2 - 20);
                    const remainingWait = Math.ceil(HEADSTART_SECONDS - timeElapsed);
                    ctx.fillStyle = "white"; ctx.fillText(remainingWait, vw/2, vh/2 + 30);
                    ctx.font = "16px monospace"; ctx.fillText("Survivors are hiding.", vw/2, vh/2 + 60);
                } else {
                    const cx = vw / 2; const cy = vh / 2;
                    const visionRadius = 250 + Math.sin(Date.now() / 200) * 10;
                    const gradient = ctx.createRadialGradient(cx, cy, visionRadius * 0.6, cx, cy, visionRadius);
                    gradient.addColorStop(0, "rgba(0, 0, 0, 0)"); 
                    gradient.addColorStop(1, "rgba(0, 0, 0, 1)"); 
                    ctx.fillStyle = gradient; ctx.fillRect(0, 0, vw, vh);
                    ctx.fillStyle = "rgba(255, 0, 0, 0.7)"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
                    ctx.fillText("HUNT THEM", cx, cy + visionRadius + 30);

                    const pX = myPlayer.pos.x; const pY = myPlayer.pos.y;
                    if (pX < 25 || pX > WORLD_SIZE - 25 || pY < 25 || pY > WORLD_SIZE - 25) {
                         if (Date.now() % 500 < 250) { 
                             ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                             ctx.fillRect(0, 0, vw, vh);
                             ctx.fillStyle = "red"; 
                             ctx.font = "bold 40px monospace";
                             ctx.fillText("OUT OF ZONE", vw/2, vh/2);
                         }
                    }
                }
            }

            if (lobby === 'dungeon') {
                const winner = engine.gameState.winner;
                if (winner) {
                    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, vw, vh);
                    ctx.font = "bold 60px Comic Sans MS"; ctx.textAlign = "center";
                    if (winner === 'it') { ctx.fillStyle = "#ff4444"; ctx.fillText("IT WINS!", vw/2, vh/2); } 
                    else { ctx.fillStyle = "#a8e6cf"; ctx.fillText("SURVIVORS WIN!", vw/2, vh/2); }
                    ctx.fillStyle = "white"; ctx.font = "20px monospace"; ctx.fillText("Returning to lobby in 5s...", vw/2, vh/2 + 60);
                    ctx.font = "16px monospace"; ctx.fillText("(Click screen to return immediately)", vw/2, vh/2 + 90);
                } else if (engine.gameState.matchEndTime) {
                    const timeLeft = Math.max(0, Math.ceil((engine.gameState.matchEndTime - Date.now()) / 1000));
                    ctx.textAlign = "center";
                    const mins = Math.floor(timeLeft / 60); const secs = timeLeft % 60;
                    const timeText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                    ctx.font = "bold 40px monospace"; ctx.lineWidth = 4; ctx.strokeStyle = "black";
                    ctx.strokeText(timeText, vw/2, 65); 
                    ctx.fillStyle = timeLeft < 30 ? "#ff4444" : "white"; ctx.fillText(timeText, vw/2, 65); 
                    
                    if (myPlayer && myPlayer.status === 'dead') {
                        ctx.fillStyle = "rgba(255, 0, 0, 0.2)"; ctx.fillRect(0, 0, vw, vh);
                        ctx.fillStyle = "white"; ctx.font = "bold 50px Comic Sans MS"; ctx.textAlign = "center";
                        ctx.fillText("YOU DIED", vw/2, vh/2 - 20);
                        ctx.font = "20px monospace"; ctx.fillText("(Spectator Mode Active)", vw/2, vh/2 + 20);
                    }
                }
            }
        };

        engine.loop = new Gameloop(update, render);
        engine.loop.start();
        init();
        
        const handleUnload = () => {
            const url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/players?id=eq.${myId}`;
            navigator.sendBeacon(url, new Blob([], { type: 'application/json' })); 
        };
        window.addEventListener("beforeunload", handleUnload);

        const playerChannel = supabase.channel('players_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    delete engine.players[payload.old.id];
                    checkDungeonDisconnectWin();
                }
                else updatePlayerState(payload.new);
            }).subscribe();

        const gameChannel = supabase.channel('game_state_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, (payload) => {
                updateGlobalState(payload.new);
            }).subscribe();

        const chatChannel = supabase.channel('chat_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, (payload) => {
                const msg = payload.new;
                if (engine.players[msg.player_id]) {
                    engine.players[msg.player_id].chatBubble.setMessage(msg.message);
                }
            }).subscribe();

        return () => {
            engine.loop.stop();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener("beforeunload", handleUnload);
            supabase.from('players').delete().eq('id', myId).then(() => {});
            supabase.removeChannel(playerChannel);
            supabase.removeChannel(gameChannel);
            supabase.removeChannel(chatChannel);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, [myId]);

    return (
        <canvas 
            ref={canvasRef} 
            id="game-canvas"
            tabIndex="0" 
            onClick={handleCanvasClick}
            style={{outline: 'none', display: 'block', cursor: engineRef.current.gameState.winner ? 'pointer' : 'default'}}
        />
    );
}