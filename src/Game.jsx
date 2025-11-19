import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// --- HELPER FUNCTIONS ---
const lerp = (start, end, t) => start + (end - start) * t;

const getDistance = (p1, p2) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

// --- CONFIGURATION ---
const WORLD_SIZE = 3000; 
const PORTAL_BOX = { x: 1400, y: 1400, w: 200, h: 200 }; 
const EXIT_BOX = { x: 100, y: 300, w: 100, h: 100 }; 

const COUNTDOWN_SECONDS = 10; 
const MATCH_DURATION_SECONDS = 120;
const TAG_DISTANCE = 50;

export default function Game({ session }) {
  const canvasRef = useRef(null);
  const myId = session.user.id; 

  // Game State Refs
  const playersRef = useRef({}); 
  const keysRef = useRef({});
  const screenRef = useRef({ w: 1280, h: 720 }); 

  // Logic State
  const gameState = useRef({
    portalTimer: COUNTDOWN_SECONDS,
    playersInPortal: 0,
    portalCandidate: '',
    myLobby: 'main', 
    matchEndTime: null, 
    isActive: false,
    winner: null 
  });

  const resetTimerRef = useRef(null);

  // Define Click Handler for "Return Now" button
  const handleCanvasClick = async (e) => {
      // Only active if game is over
      if (gameState.current.winner) {
          console.log("Manual reset triggered");
          await supabase.rpc('return_to_lobby');
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // --- 1. RESIZE HANDLER ---
    const handleResize = () => {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
        screenRef.current = { w: width, h: height };
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // --- 2. DATABASE SETUP ---
    const init = async () => {
        // Force local player to main lobby on load
        await supabase.from('players').update({
            lobby_id: 'main', x: 400, y: 300, is_it: false, status: 'alive'
        }).eq('id', myId);
        gameState.current.myLobby = 'main';

        // Load Players
        const { data: pData } = await supabase.from('players').select('*, profiles(username)');
        if (pData) pData.forEach(p => updateLocalPlayer(p));

        // Load Game State
        const { data: gData } = await supabase.from('game_state').select('*').eq('id', 1).single();
        if (gData) updateGameState(gData);
    };

    const updateLocalPlayer = (p) => {
        const name = p.profiles?.username || 'Unknown';
        if (!playersRef.current[p.id]) {
            playersRef.current[p.id] = {
                id: p.id,
                x: p.x, y: p.y, targetX: p.x, targetY: p.y,
                name: name, is_it: p.is_it, lobby_id: p.lobby_id || 'main',
                status: p.status || 'alive', isMe: p.id === myId
            };
        } else {
            const existing = playersRef.current[p.id];
            existing.is_it = p.is_it;
            existing.lobby_id = p.lobby_id;
            existing.status = p.status;
            if (!existing.isMe) {
                existing.targetX = p.x;
                existing.targetY = p.y;
            }
            if (existing.isMe) gameState.current.myLobby = p.lobby_id;
        }
    };

    const updateGameState = (data) => {
        if (!data) return;
        
        if (data.match_start_time) {
            gameState.current.matchEndTime = new Date(data.match_start_time).getTime() + (MATCH_DURATION_SECONDS * 1000);
        } else {
            gameState.current.matchEndTime = null;
        }
        
        gameState.current.isActive = data.is_active;
        gameState.current.winner = data.winner;

        // === WINNER RESET LOGIC ===
        if (data.winner) {
            if (!resetTimerRef.current) {
                console.log("Game Over! Winner:", data.winner);
                // Auto-reset after 5 seconds
                resetTimerRef.current = setTimeout(async () => {
                     console.log("Executing Auto-Reset...");
                     const { error } = await supabase.rpc('return_to_lobby');
                     if (error) console.error("Auto-Reset Error:", error);
                     resetTimerRef.current = null; 
                }, 5000);
            }
        } else {
            // If winner is cleared (game reset), kill any pending timers
            if (resetTimerRef.current) {
                console.log("Game reset detected, cancelling local timer.");
                clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
        }
    };

    // --- 3. RPC CALLS ---
    const startMatch = async (ids) => { await supabase.rpc('start_dungeon_match', { player_ids: ids }); };
    
    const tagPlayer = async (vid) => { 
        if (playersRef.current[vid]) playersRef.current[vid].status = 'dead';
        await supabase.rpc('tag_player', { victim_id: vid }); 
    };
    
    const leaveDungeon = async () => {
        await supabase.from('players').update({ lobby_id: 'main', x: 1400, y: 1500, is_it: false, status: 'alive' }).eq('id', myId);
    };
    
    const triggerSurvivorWin = async () => {
        await supabase.rpc('trigger_survivor_win');
    };

    // --- 4. SUBSCRIPTIONS ---
    init();
    
    const playerChannel = supabase.channel('players_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, 
        (payload) => {
            if (payload.eventType === 'DELETE') delete playersRef.current[payload.old.id];
            else updateLocalPlayer(payload.new);
        })
      .subscribe();

    const gameChannel = supabase.channel('game_state_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, 
        (payload) => updateGameState(payload.new))
      .subscribe();

    // --- 5. INPUTS ---
    const handleKeyDown = (e) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // --- 6. DRAWING ---
    const drawPlayer = (ctx, p) => {
        const isDead = p.status === 'dead';
        ctx.globalAlpha = isDead ? 0.5 : 1.0;
        let bodyColor = p.isMe ? '#7bc7a9' : '#ffaaa5'; 
        if (p.is_it) bodyColor = '#d32f2f'; 
        if (isDead) bodyColor = '#888888'; 
        let outlineColor = p.is_it ? '#ffd700' : 'white';

        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 20, 20, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = outlineColor; ctx.lineWidth = p.is_it ? 5 : 4; ctx.stroke();
        
        ctx.fillStyle = "#333"; ctx.beginPath();
        if (isDead) {
            ctx.font = "20px Arial"; ctx.fillText("x  x", p.x - 15, p.y + 5);
        } else if (p.is_it) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.3); ctx.fillRect(-10, -8, 6, 12); ctx.rotate(-0.6); ctx.fillRect(4, -8, 6, 12); ctx.restore();
        } else {
            ctx.arc(p.x - 8, p.y - 2, 3, 0, Math.PI*2); ctx.arc(p.x + 8, p.y - 2, 3, 0, Math.PI*2); ctx.fill();
        }

        ctx.fillStyle = isDead ? "#aaa" : (p.is_it ? "#ff4444" : "#333");
        if (gameState.current.myLobby === 'dungeon') ctx.fillStyle = "white";
        ctx.font = "bold 14px Comic Sans MS"; ctx.textAlign = "center";
        let label = p.name; if (p.is_it) label += " (IT)";
        ctx.fillText(label, p.x, p.y - 35);
        ctx.globalAlpha = 1.0;
    };

    const drawScene = (lobby, player) => {
        const vw = screenRef.current.w;
        const vh = screenRef.current.h;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let camX = 0, camY = 0;
        if (player) {
            camX = (vw / 2) - player.x;
            camY = (vh / 2) - player.y;
            camX = Math.min(0, Math.max(camX, vw - WORLD_SIZE));
            camY = Math.min(0, Math.max(camY, vh - WORLD_SIZE));
        }

        ctx.save();
        ctx.translate(camX, camY);

        // World
        if (lobby === 'main') {
            ctx.fillStyle = "#a8e6cf"; ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
            ctx.strokeStyle = "#5aa78a"; ctx.lineWidth = 20; ctx.strokeRect(0,0,WORLD_SIZE,WORLD_SIZE);
            ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
            for(let i=0; i<WORLD_SIZE; i+=100) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, WORLD_SIZE); ctx.stroke(); }
            for(let i=0; i<WORLD_SIZE; i+=100) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(WORLD_SIZE, i); ctx.stroke(); }

            ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(PORTAL_BOX.x, PORTAL_BOX.y, PORTAL_BOX.w, PORTAL_BOX.h);
            ctx.strokeStyle = "white"; ctx.lineWidth = 5; ctx.strokeRect(PORTAL_BOX.x, PORTAL_BOX.y, PORTAL_BOX.w, PORTAL_BOX.h);
            
            ctx.fillStyle = "#555"; ctx.font = "20px monospace"; ctx.textAlign = "center";
            ctx.fillText("Dungeon Queue", PORTAL_BOX.x + 100, PORTAL_BOX.y - 20);
            ctx.fillText(`${gameState.current.playersInPortal} Players`, PORTAL_BOX.x + 100, PORTAL_BOX.y + 100);
            if (gameState.current.playersInPortal > 0) {
                ctx.fillStyle = "#ff4444"; ctx.font = "bold 40px monospace";
                ctx.fillText(`${Math.ceil(gameState.current.portalTimer)}`, PORTAL_BOX.x + 100, PORTAL_BOX.y + 150);
            }
        } else {
            ctx.fillStyle = "#2b2b2b"; ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
            ctx.fillStyle = "rgba(100, 255, 100, 0.3)"; ctx.fillRect(EXIT_BOX.x, EXIT_BOX.y, EXIT_BOX.w, EXIT_BOX.h);
            ctx.fillStyle = "white"; ctx.fillText("EXIT", EXIT_BOX.x + 50, EXIT_BOX.y + 60);
        }

        Object.values(playersRef.current).forEach(p => {
            if (p.lobby_id === lobby) drawPlayer(ctx, p);
        });

        ctx.restore();

        // Vignette
        if (lobby === 'dungeon' && gameState.current.isActive && player && player.is_it && player.status === 'alive') {
            const cx = vw / 2; const cy = vh / 2;
            const pulse = Math.sin(Date.now() / 200) * 10;
            const visionRadius = 250 + pulse;
            const gradient = ctx.createRadialGradient(cx, cy, visionRadius * 0.6, cx, cy, visionRadius);
            gradient.addColorStop(0, "rgba(0, 0, 0, 0)");     
            gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.9)"); 
            gradient.addColorStop(1, "rgba(0, 0, 0, 1)");     
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, vw, vh);
            ctx.fillStyle = "rgba(255, 0, 0, 0.7)"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
            ctx.fillText("HUNT THEM", cx, cy + visionRadius + 30);
        }

        // UI
        if (lobby === 'dungeon') {
            const winner = gameState.current.winner;
            if (winner) {
                ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, vw, vh);
                ctx.font = "bold 80px Comic Sans MS"; ctx.textAlign = "center";
                if (winner === 'it') { ctx.fillStyle = "#ff4444"; ctx.fillText("IT WINS!", vw/2, vh/2); } 
                else { ctx.fillStyle = "#a8e6cf"; ctx.fillText("SURVIVORS WIN!", vw/2, vh/2); }
                ctx.fillStyle = "white"; ctx.font = "20px monospace"; 
                ctx.fillText("Returning to lobby in 5s...", vw/2, vh/2 + 60);
                ctx.font = "16px monospace"; 
                ctx.fillText("(Click screen to return immediately)", vw/2, vh/2 + 90);
            } 
            else if (gameState.current.matchEndTime) {
                const timeLeft = Math.max(0, Math.ceil((gameState.current.matchEndTime - Date.now()) / 1000));
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(vw/2 - 100, 20, 200, 60);
                ctx.fillStyle = timeLeft < 30 ? "#ff4444" : "white"; ctx.font = "bold 40px monospace"; ctx.textAlign = "center";
                const mins = Math.floor(timeLeft / 60); const secs = timeLeft % 60;
                ctx.fillText(`${mins}:${secs < 10 ? '0' : ''}${secs}`, vw/2, 65);

                if (player && player.status === 'dead') {
                    ctx.fillStyle = "rgba(255, 0, 0, 0.2)"; ctx.fillRect(0, 0, vw, vh);
                    ctx.fillStyle = "white"; ctx.font = "bold 50px Comic Sans MS"; ctx.textAlign = "center";
                    ctx.fillText("YOU DIED", vw/2, vh/2);
                }
            }
        } else {
            ctx.fillStyle = "white"; ctx.font = "20px Comic Sans MS"; ctx.textAlign = "left";
            ctx.fillText("World Map (Portal at 1400, 1400)", 20, 40);
        }
    };

    // --- 7. GAME LOOP ---
    let lastSync = 0;
    let lastTime = performance.now();

    const gameLoop = (timestamp) => {
      try {
          const deltaTime = (timestamp - lastTime) / 1000;
          lastTime = timestamp;

          const myPlayer = playersRef.current[myId];
          const currentLobby = gameState.current.myLobby;

          if (currentLobby === 'main') {
            const playersInPortal = Object.values(playersRef.current).filter(p => 
                p.lobby_id === 'main' &&
                p.x > PORTAL_BOX.x && p.x < PORTAL_BOX.x + PORTAL_BOX.w &&
                p.y > PORTAL_BOX.y && p.y < PORTAL_BOX.y + PORTAL_BOX.h
            );
            gameState.current.playersInPortal = playersInPortal.length;
            if (playersInPortal.length > 0) {
                playersInPortal.sort((a, b) => a.id.localeCompare(b.id));
                gameState.current.portalTimer -= deltaTime;
                if (gameState.current.portalTimer <= 0) {
                    gameState.current.portalTimer = 10;
                    if (playersInPortal[0].isMe) startMatch(playersInPortal.map(p => p.id));
                }
            } else {
                gameState.current.portalTimer = 10;
            }
          }

          if (currentLobby === 'dungeon' && gameState.current.isActive && !gameState.current.winner) {
             if (gameState.current.matchEndTime && Date.now() >= gameState.current.matchEndTime) {
                 if (myPlayer && myPlayer.is_it) triggerSurvivorWin();
             }
             if (myPlayer && myPlayer.is_it && myPlayer.status === 'alive') {
                 Object.values(playersRef.current).forEach(other => {
                     if (other.id !== myId && other.lobby_id === 'dungeon' && !other.is_it && other.status === 'alive') {
                         if (getDistance(myPlayer, other) < TAG_DISTANCE) tagPlayer(other.id);
                     }
                 });
             }
             if (myPlayer && myPlayer.x > EXIT_BOX.x && myPlayer.x < EXIT_BOX.x + EXIT_BOX.w && myPlayer.y > EXIT_BOX.y && myPlayer.y < EXIT_BOX.y + EXIT_BOX.h) {
                 leaveDungeon();
             }
          }

          if (myPlayer) {
            let speed = (myPlayer.is_it && myPlayer.status === 'alive') ? 8 : 6;
            let moved = false;
            if (keysRef.current['ArrowUp'] || keysRef.current['w']) { myPlayer.y -= speed; moved = true; }
            if (keysRef.current['ArrowDown'] || keysRef.current['s']) { myPlayer.y += speed; moved = true; }
            if (keysRef.current['ArrowLeft'] || keysRef.current['a']) { myPlayer.x -= speed; moved = true; }
            if (keysRef.current['ArrowRight'] || keysRef.current['d']) { myPlayer.x += speed; moved = true; }

            myPlayer.x = Math.max(25, Math.min(WORLD_SIZE - 25, myPlayer.x));
            myPlayer.y = Math.max(25, Math.min(WORLD_SIZE - 25, myPlayer.y));
            
            if (moved && timestamp - lastSync > 50) {
              supabase.from('players').update({ x: myPlayer.x, y: myPlayer.y }).eq('id', myId).then();
              lastSync = timestamp;
            }
          }

          Object.values(playersRef.current).forEach(p => {
            if (!p.isMe) { p.x = lerp(p.x, p.targetX, 0.1); p.y = lerp(p.y, p.targetY, 0.1); }
          });

          drawScene(currentLobby, myPlayer);
      } catch (err) {
          console.error(err);
      }
      animationFrameId = window.requestAnimationFrame(gameLoop);
    };

    animationFrameId = window.requestAnimationFrame(gameLoop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(gameChannel);
      if(resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [myId]);

  return (
    <canvas 
      ref={canvasRef} 
      id="game-canvas"
      tabIndex="0" 
      onClick={handleCanvasClick}
      style={{outline: 'none', display: 'block', cursor: gameState.current.winner ? 'pointer' : 'default'}}
    />
  );
}