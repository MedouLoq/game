// ==== CONFIG & GAME STATE ====

const CONFIG = {
    SPACESHIP_SIZE: 60,
    COINS_TO_ADVANCE: 15,
    INITIAL_TIMER: 120,
    TRANSITION_DURATION: 2000,
    SHOOTING_INTERVAL: 800,
    MAX_POWERUPS: 3,
    BOSS_HEALTH: 10,
    MOBILE_CONTROLS_SIZE: 50,
    STAR_COUNT: 150,          // Number of stars for background
    EXPLOSION_DURATION: 12000   // Explosion animation lasts 12 seconds
};


let gameState = {
    status: 'loading', // loading, start, playing, paused, gameOver
    level: 1,
    timer: CONFIG.INITIAL_TIMER,
    score: 0,
    paused: false,
    gameOver: false,
    lastShotTime: 0,
    explosion: null // Will store explosion effect when needed
};

// ==== ASSET MANAGEMENT ====

const assets = {
    images: {
        spaceship: null,
        asteroid1: null,
        asteroid2: null,
        background: null,
        collectible: null,
        shield: null,
        boss: null
    },
    sounds: {
        music: null,
        collect: null,
        crash: null
    },
    loaded: 0,
    total: 0
};

// ==== GAME OBJECTS ====

// Player object (defined later in setupGame)
let player;

// Arrays to hold game objects
let asteroids = [];
let collectibles = [];
let powerups = [];
let bullets = [];
let bosses = [];

// Starfield for background
let stars = [];

// ==== UI ELEMENTS & TOUCH CONTROLS ====

let playButton, helpButton, menuButton;

let touchControls = {
    up: { x: 50, y: window.innerHeight - 150, pressed: false },
    down: { x: 50, y: window.innerHeight - 50, pressed: false },
    left: { x: 50, y: window.innerHeight - 100, pressed: false },
    right: { x: 150, y: window.innerHeight - 100, pressed: false },
    shoot: { x: window.innerWidth - 100, y: window.innerHeight - 100, pressed: false }
};

// ==== PRELOAD ASSETS ====

function preload() {
    // List of image assets
    const imageAssets = [
        { name: 'spaceship', path: 'assets/images/kh.jpg' },
        { name: 'speed', path: 'assets/images/speed.png' },
        { name: 'asteroid1', path: 'assets/images/asteroid.png' },
        { name: 'asteroid2', path: 'assets/images/asteroid2.png' },
        { name: 'background', path: 'assets/images/galaxy_background.jpg' },
        { name: 'collectible', path: 'assets/images/collectible.png' },
        { name: 'shield', path: 'assets/images/shield.png' },
        { name: 'boss', path: 'assets/images/evilspaceship.png' },
        { name: 'explosion', path: 'assets/images/loq.jpg' }
    ];

    // List of sound assets
    const soundAssets = [
        { name: 'music', path: 'assets/sounds/space_music.mp3' },
        { name: 'collect', path: 'assets/sounds/collect.mp3' },
        { name: 'crash', path: 'assets/sounds/crash.m4a' }
    ];

    assets.total = imageAssets.length + soundAssets.length;

    // Load images
    imageAssets.forEach(asset => {
        assets.images[asset.name] = loadImage(asset.path, assetLoaded, loadingError);
    });

    // Load sounds
    soundAssets.forEach(asset => {
        assets.sounds[asset.name] = loadSound(asset.path, () => {
            assetLoaded();
            if (asset.name === 'music') {
                assets.sounds.music.setVolume(0.1);
            }
        }, loadingError);
    });
}

function assetLoaded() {
    assets.loaded++;
    console.log(`Asset loaded: ${assets.loaded}/${assets.total}`);
    if (assets.loaded === assets.total) {
        console.log('All assets loaded');
        gameState.status = 'start';
        assets.sounds.music.loop();
    }
}

function loadingError(err) {
    console.error("Error loading asset:", err);
}

// ==== SETUP & UI BUTTONS ====

class Star {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = random(width);
        this.y = random(height);
        this.size = random(1, 3);
        this.speed = random(0.5, 2);
    }
    update() {
        this.x -= this.speed;
        if (this.x < 0) {
            this.x = width;
            this.y = random(height);
        }
    }
    draw() {
        noStroke();
        fill(255);
        ellipse(this.x, this.y, this.size);
    }
}

// ==== GLOBAL VARIABLES ====

  // star array now only holds Star instances

// ==== SETUP ==== 

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);
    imageMode(CENTER);
    textAlign(CENTER, CENTER);
    rectMode(CENTER);

    // Initialize starfield using Star class (ONLY once!)
    for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
        stars.push(new Star());
    }

    createGameButtons();
    setupGame();
}

function createGameButtons() {
    playButton = createButton('Play');
    helpButton = createButton('Help');
    menuButton = createButton('Menu');

    styleButton(playButton, '#4CAF50');
    styleButton(helpButton, '#FFC107');
    styleButton(menuButton, '#2196F3');

    repositionButtons();

    playButton.mousePressed(startGame);
    helpButton.mousePressed(showHelp);
    menuButton.mousePressed(showMenu);

    menuButton.hide();
}

function styleButton(button, colorVal) {
    button.class('game-button');
    button.style('background-color', colorVal);
    button.style('color', 'white');
    button.style('padding', '10px 20px');
    button.style('border', 'none');
    button.style('border-radius', '5px');
    button.style('font-size', '16px');
    button.style('cursor', 'pointer');
    button.style('transition', 'all 0.3s ease');
}

function repositionButtons() {
    let centerX = width / 2;
    let centerY = height / 2;
    playButton.position(centerX - 100, centerY);
    helpButton.position(centerX + 20, centerY);
    menuButton.position(20, 20);
}

function drawStarfield() {
    for (let star of stars) {
        star.update();
        star.draw();
    }
}

// ==== GAME SETUP & OBJECT CLASSES ====

function setupGame() {
    // Define player object with movement and drawing methods
    player = {
        x: width / 2,
        y: height / 2,
        size: CONFIG.SPACESHIP_SIZE,
        speed: 5,
        isShielded: false,
        speedBoost: false,
        update() {
            this.handleInput();
            this.constrain();
        },
        handleInput() {
            let moveSpeed = this.speed;
            if (this.speedBoost) moveSpeed *= 1.5;
            if (keyIsDown(LEFT_ARROW) || touchControls.left.pressed) this.x -= moveSpeed;
            if (keyIsDown(RIGHT_ARROW) || touchControls.right.pressed) this.x += moveSpeed;
            if (keyIsDown(UP_ARROW) || touchControls.up.pressed) this.y -= moveSpeed;
            if (keyIsDown(DOWN_ARROW) || touchControls.down.pressed) this.y += moveSpeed;
        },
        constrain() {
            this.x = constrain(this.x, this.size / 2, width - this.size / 2);
            this.y = constrain(this.y, this.size / 2, height - this.size / 2);
        },
        draw() {
            push();
            translate(this.x, this.y);
            for (let star of stars) {
                star.update();
                star.draw();
            }
            if (this.isShielded) {
                noFill();
                stroke(0, 150, 255, 150);
                strokeWeight(4);
                ellipse(0, 0, this.size * 1.4);
                noStroke();
            }
            image(assets.images.spaceship, 0, 0, this.size, this.size);
            pop();
        }
    };

    // Reset game objects
    resetGame();
}

// ==== OBJECT CLASSES ====

const STAR_COUNT = 150;

// Asteroid
class Asteroid {
    constructor() {
        this.reset();
        this.speed = random(1, 3);
        this.type = random() < 0.5 ? 1 : 2;
    }
    reset() {
        this.x = random(width, width + 200);
        this.y = random(0, height);
        this.size = random(30, 80);
    }
    update() {
        this.x -= this.speed;
        if (this.x < -this.size) this.reset();
    }
    draw() {
        if (this.type === 1) {
            image(assets.images.asteroid1, this.x, this.y, this.size, this.size);
        } else {
            image(assets.images.asteroid2, this.x, this.y, this.size, this.size);
        }
    }
}

// Collectible (coin)
class Collectible {
    constructor() {
        this.x = random(width, width + 200);
        this.y = random(0, height);
        this.size = 30;
        this.speed = 2;
    }
    update() {
        this.x -= this.speed;
        if (this.x < -this.size) {
            this.x = random(width, width + 200);
            this.y = random(0, height);
        }
    }
    draw() {
        image(assets.images.collectible, this.x, this.y, this.size, this.size);
    }
}

// Powerup (shield or speed)
class Powerup {
    constructor(type) {
        this.x = random(width, width + 200);
        this.y = random(0, height);
        this.size = 40;
        this.speed = 2.5;
        this.type = type; // 'shield' or 'speed'
        this.duration = 5000; // effect lasts 5 seconds
    }
    update() {
        this.x -= this.speed;
        if (this.x < -this.size) {
            this.x = random(width, width + 200);
            this.y = random(0, height);
        }
    }
    draw() {
        push();
        if (this.type === 'shield') {
            image(assets.images.shield, this.x, this.y, this.size, this.size);
        } else if (this.type === 'speed') {
            tint(255, 200, 0); // tint for visibility
            image(assets.images.spaceship, this.x, this.y, this.size, this.size);
            noTint();
        }
        pop();
    }
}

// Bullet
class Bullet {
    constructor(x, y, speed, owner = 'player') {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.speed = speed;
        this.owner = owner;
    }
    update() {
        this.x += this.speed;
    }
    draw() {
        push();
        noStroke();
        fill(this.owner === 'player' ? 255 : color(255, 0, 0));
        ellipse(this.x, this.y, this.size);
        pop();
    }
}

// Boss
class Boss {
    constructor() {
        this.x = width - 100;
        this.y = height / 2;
        this.size = 80;
        this.health = CONFIG.BOSS_HEALTH;
        this.speed = 2;
        this.lastShot = 0;
    }
    update() {
        this.y += this.speed;
        if (this.y > height - this.size / 2 || this.y < this.size / 2) {
            this.speed *= -1;
        }
        if (millis() - this.lastShot > CONFIG.SHOOTING_INTERVAL) {
            bullets.push(new Bullet(this.x - this.size / 2, this.y, -4, 'boss'));
            this.lastShot = millis();
        }
    }
    draw() {
        image(assets.images.boss, this.x, this.y, this.size, this.size);
        push();
        fill(255);
        textSize(16);
        text(`HP: ${this.health}`, this.x, this.y - this.size / 2 - 10);
        pop();
    }
}

// Explosion effect class (lasts 12 sec)
// Explosion effect class (lasts 12 sec)
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.startTime = millis();
    }
    draw() {
        let progress = (millis() - this.startTime) / CONFIG.EXPLOSION_DURATION;
        let alpha = map(progress, 0, 1, 255, 0);
        let size = map(progress, 0, 1, player.size, player.size * 3);
        // If you want to tint the image based on the explosion progress:
        push();
        noStroke();
        tint(255, alpha); // Apply the alpha value
        image(assets.images.explosion, this.x, this.y, size, size);
        pop();
    }
    finished() {
        return (millis() - this.startTime) > CONFIG.EXPLOSION_DURATION;
    }
}


// ==== DRAW & UPDATE LOOP ====

function draw() {
    switch (gameState.status) {
        case 'loading': drawLoadingScreen(); break;
        case 'start': drawStartScreen(); break;
        case 'playing': drawGameScreen(); break;
        case 'paused': drawPausedScreen(); break;
        case 'gameOver': drawGameOverScreen(); break;
    }
}

function drawLoadingScreen() {
    background(0);
    fill(255);
    textSize(32);
    text(`Loading... ${assets.loaded}/${assets.total}`, width / 2, height / 2);
    playButton.hide();
    helpButton.hide();
    menuButton.hide();
}

function drawStartScreen() {
    // Draw starfield background first
    background(0);
    drawStarfield();
    image(assets.images.background, width / 2, height / 2, width, height);
    push();
    fill(255);
    textSize(48);
    text("SPACE GAME", width / 2, height / 3);
    textSize(24);
    text("Use arrow keys or touch controls to move and shoot.\nCollect coins, grab powerups (shield & speed), avoid asteroids,\nand defeat bosses.", width / 2, height / 3 + 80);
    pop();
    playButton.show();
    helpButton.show();
    menuButton.hide();
}

function drawGameScreen() {
    if (!gameState.paused) updateGame();
    // Draw starfield so it always remains in the background
    drawStarfield();
    drawGameElements();
    drawHUD();
    if (isTouchDevice()) drawTouchControls();
    // Draw explosion effect on top (if active)
    if (gameState.explosion) {
        gameState.explosion.draw();
        if (gameState.explosion.finished()) {
            gameState.explosion = null;
            gameState.status = 'gameOver';
        }
    }
}

function updateGame() {
    if (gameState.timer > 0) {
        gameState.timer -= deltaTime / 1000;
        if (gameState.timer <= 0) {
            gameState.timer = 0;
            gameState.status = 'gameOver';
        }
    }
    player.update();
    if (touchControls.shoot.pressed && millis() - gameState.lastShotTime > CONFIG.SHOOTING_INTERVAL) {
        shootBullet();
        gameState.lastShotTime = millis();
    }
    asteroids.forEach(a => a.update());
    collectibles.forEach(c => c.update());
    powerups.forEach(p => p.update());
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].x < -20 || bullets[i].x > width + 20) {
            bullets.splice(i, 1);
        }
    }
    bosses.forEach(boss => boss.update());
    checkCollisions();
    // Spawn new powerups if below maximum
    if (powerups.length < CONFIG.MAX_POWERUPS && random() < 0.01) {
        let type = random(['shield', 'speed']);
        powerups.push(new Powerup(type));
    }
    // Ensure collectibles (coins) are continuously spawned
    if (collectibles.length < 5) {
        for (let i = collectibles.length; i < 5; i++) {
            collectibles.push(new Collectible());
        }
    }

    // ---- Level Advancement Logic ----
    // Check if the score has reached the threshold to advance
    // ---- Level Advancement Logic ----
    if (gameState.score >= CONFIG.COINS_TO_ADVANCE * gameState.level) {
        gameState.level++;
        console.log("Advanced to level " + gameState.level);

        // Increase the timer for the next level (optional)
        gameState.timer += 30;

        // Spawn additional asteroids for increased difficulty
        for (let i = 0; i < 2; i++) {
            asteroids.push(new Asteroid());
        }

        // Spawn a boss when reaching level 2 or higher (you can adjust when bosses appear)
        if (gameState.level >= 2 && bosses.length === 0) {
            bosses.push(new Boss());
            console.log("Boss spawned!");
        }
    }

}



function drawGameElements() {
    image(assets.images.background, width / 2, height / 2, width, height);
    asteroids.forEach(a => a.draw());
    collectibles.forEach(c => c.draw());
    powerups.forEach(p => p.draw());
    bosses.forEach(boss => boss.draw());
    bullets.forEach(b => b.draw());
    player.draw();
}

function drawHUD() {
    push();
    fill(255);
    textSize(20);
    textAlign(LEFT, TOP);
    text(`Level: ${gameState.level}`, 20, 20);
    text(`Score: ${gameState.score}`, 20, 50);
    text(`Time: ${Math.ceil(gameState.timer)}`, 20, 80);
    pop();
}

function drawStarfield() {
    push();
    noStroke();
    fill(255);
    stars.forEach(star => {
        ellipse(star.x, star.y, star.size);
    });
    pop();
}

function drawTouchControls() {
    const size = CONFIG.MOBILE_CONTROLS_SIZE;
    const alpha = 100;
    drawTouchControl(touchControls.up.x, touchControls.up.y, size, `rgba(0,0,255,${alpha / 255})`, '▲');
    drawTouchControl(touchControls.down.x, touchControls.down.y, size, `rgba(0,0,255,${alpha / 255})`, '▼');
    drawTouchControl(touchControls.left.x, touchControls.left.y, size, `rgba(0,0,255,${alpha / 255})`, '◀');
    drawTouchControl(touchControls.right.x, touchControls.right.y, size, `rgba(0,0,255,${alpha / 255})`, '▶');
    drawTouchControl(touchControls.shoot.x, touchControls.shoot.y, size, `rgba(255,0,0,${alpha / 255})`, '◉');
}

function drawTouchControl(x, y, size, col, symbol) {
    push();
    fill(col);
    noStroke();
    ellipse(x, y, size, size);
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text(symbol, x, y);
    pop();
}

function drawPausedScreen() {
    background(100, 100, 100, 200);
    fill(255);
    textSize(32);
    text("PAUSED", width / 2, height / 2);
}

function drawGameOverScreen() {
    background(0, 0, 0, 200);
    push();
    fill(255, 0, 0);
    textSize(48);
    text("GAME OVER", width / 2, height / 2);
    pop();
}

// ==== TOUCH & KEYBOARD INPUTS ====

function touchStarted() {
    if (gameState.status === 'playing') {
        if (touches.length > 0) {
            checkTouchControls(touches[0].x, touches[0].y, true);
        }
    }
    return false;
}

function touchEnded() {
    if (gameState.status === 'playing') {
        Object.values(touchControls).forEach(ctrl => ctrl.pressed = false);
    }
    return false;
}

function checkTouchControls(x, y, pressed) {
    const tol = CONFIG.MOBILE_CONTROLS_SIZE / 2;
    if (dist(x, y, touchControls.up.x, touchControls.up.y) < tol) touchControls.up.pressed = pressed;
    if (dist(x, y, touchControls.down.x, touchControls.down.y) < tol) touchControls.down.pressed = pressed;
    if (dist(x, y, touchControls.left.x, touchControls.left.y) < tol) touchControls.left.pressed = pressed;
    if (dist(x, y, touchControls.right.x, touchControls.right.y) < tol) touchControls.right.pressed = pressed;
    if (dist(x, y, touchControls.shoot.x, touchControls.shoot.y) < tol) touchControls.shoot.pressed = pressed;
}

function keyPressed() {
    if (keyCode === ESCAPE) togglePause();
    if (keyCode === 32 && gameState.status === 'playing') {
        shootBullet();
    }
}

function togglePause() {
    gameState.paused = !gameState.paused;
    if (gameState.paused) noLoop();
    else loop();
}

// ==== SHOOTING & POWERUP EFFECTS ====

function shootBullet() {
    if (millis() - gameState.lastShotTime > CONFIG.SHOOTING_INTERVAL) {
        bullets.push(new Bullet(player.x + player.size / 2, player.y, 6, 'player'));
        gameState.lastShotTime = millis();
    }
}

function applyPowerup(type) {
    if (type === 'shield') {
        player.isShielded = true;
        setTimeout(() => player.isShielded = false, 5000);
    } else if (type === 'speed') {
        player.speedBoost = true;
        setTimeout(() => player.speedBoost = false, 5000);
    }
}

// ==== COLLISION DETECTION & GAME LOGIC ====

function checkCollisions() {
    // Check collision with asteroids: if hit and not shielded, trigger explosion then game over
    asteroids.forEach((a) => {
        if (dist(player.x, player.y, a.x, a.y) < (player.size + a.size) / 2) {
            if (!player.isShielded && !gameState.explosion) {
                assets.sounds.crash.play();
                gameState.explosion = new Explosion(player.x, player.y);
            }
        }
    });
    // Check collision with collectibles (coins)
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let c = collectibles[i];
        if (dist(player.x, player.y, c.x, c.y) < (player.size + c.size) / 2) {
            gameState.score += 1;
            assets.sounds.collect.play();
            collectibles.splice(i, 1);
        }
    }
    // Check collision with powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i];
        if (dist(player.x, player.y, p.x, p.y) < (player.size + p.size) / 2) {
            applyPowerup(p.type);
            powerups.splice(i, 1);
        }
    }
    // Check collision for player bullets vs bosses
    bosses.forEach((boss) => {
        bullets.forEach((b, bi) => {
            if (b.owner === 'player' && dist(b.x, b.y, boss.x, boss.y) < (boss.size + b.size) / 2) {
                boss.health -= 1;
                bullets.splice(bi, 1);
                if (boss.health <= 0) {
                    gameState.score += 10;
                    bosses.splice(bosses.indexOf(boss), 1);
                }
            }
        });
    });
}

// ==== WINDOW RESIZE & MOBILE DETECTION ====

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    repositionButtons();
    updateTouchControlPositions();
}

function updateTouchControlPositions() {
    const margin = 20;
    touchControls.up.y = height - 150;
    touchControls.down.y = height - 50;
    touchControls.left.y = height - 100;
    touchControls.right.y = height - 100;
    touchControls.shoot.x = width - margin - CONFIG.MOBILE_CONTROLS_SIZE;
    touchControls.shoot.y = height - margin - CONFIG.MOBILE_CONTROLS_SIZE;
}

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ==== GAME STATE CONTROL FUNCTIONS ====

function startGame() {
    if (gameState.status !== 'start') return;
    gameState.status = 'playing';
    resetGame();
    playButton.hide();
    helpButton.hide();
    menuButton.show();
}

function showHelp() {
    alert("Controls:\n- Use arrow keys or on-screen buttons to move\n- Press SPACE (or tap shoot) to fire\n- Collect coins, grab powerups (shield & speed) and avoid asteroids");
}

function showMenu() {
    gameState.status = 'start';
    resetGame();
    playButton.show();
    helpButton.show();
    menuButton.hide();
}

function resetGame() {
    gameState.level = 1;
    gameState.timer = CONFIG.INITIAL_TIMER;
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.explosion = null;
    player.x = width / 2;
    player.y = height / 2;
    asteroids = [];
    collectibles = [];
    powerups = [];
    bullets = [];
    bosses = [];

    // Populate initial asteroids, collectibles, and one random powerup
    for (let i = 0; i < 5; i++) {
        asteroids.push(new Asteroid());
    }
    for (let i = 0; i < 3; i++) {
        collectibles.push(new Collectible());
    }
    if (powerups.length < CONFIG.MAX_POWERUPS) {
        let type = random(['shield', 'speed']);
        powerups.push(new Powerup(type));
    }
}

// ==== END OF CODE ====
