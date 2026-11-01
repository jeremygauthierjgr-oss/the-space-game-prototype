const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const mineralsText = document.getElementById('mineralsText');
const mpmText = document.getElementById('mpmText');
const energyText = document.getElementById('energyText');
const quotaBar = document.getElementById('quotaBar');
const quotaText = document.getElementById('quotaText');
const timeText = document.getElementById('timeText');
const infoPanel = document.getElementById('infoPanel');
const buildBtn = document.getElementById('buildBtn');
const pauseBtn = document.getElementById('pauseBtn');
const upgradeCoreBtn = document.getElementById('upgradeCoreBtn');

const coreUpgradeCosts = [0, 180, 500, 1200];

const world = {
  minerals: 2500,
  quota: 40000,
  energy: 4,
  maxEnergy: 100,
  mineralsPerMinute: 0,
  time: 0,
  paused: false,
  buildMode: true,
  selectedType: 'relay',
  lastTime: 0,
  asteroids: [],
  buildings: [],
  enemies: [],
  projectiles: [],
  lasers: [],
  currentWave: 0,
  waveTimer: 8,
  alerts: [],
  core: {
    type: 'core',
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 22,
    health: 250,
    maxHealth: 250,
    level: 1,
    buildProgress: 100,
    active: true,
  },
  selectedEntity: null,
};

const buildingPrice = {
  relay: 20,
  miner: 45,
  solar: 200,
  laser: 100,
  missile: 400,
};

const buildingBuildTime = {
  relay: 4,
  miner: 5,
  solar: 7,
  laser: 7,
  missile: 9,
};

const upgradeCosts = {
  relay: 60,
  miner: 80,
  solar: 120,
  laser: 100,
  missile: 180,
};

const buildingStats = {
  relay: { hp: 100, range: 0, damage: 0 },
  miner: { hp: 100, range: 65, damage: 0 },
  solar: { hp: 110, range: 0, damage: 0 },
  laser: { hp: 100, range: 120, damage: 30 },
  missile: { hp: 110, range: 260, damage: 90 },
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function canvasPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function nearestAsteroid(x, y) {
  let best = null;
  let bestDist = Infinity;

  for (const asteroid of world.asteroids) {
    if (asteroid.empty) continue;
    const d = Math.hypot(x - asteroid.x, y - asteroid.y);
    if (d < bestDist) {
      bestDist = d;
      best = asteroid;
    }
  }

  return best;
}

function getClosestEnemy(x, y, range) {
  let best = null;
  let bestDistance = Infinity;

  for (const enemy of world.enemies) {
    const d = Math.hypot(x - enemy.x, y - enemy.y);
    if (d <= range && d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }

  return best;
}

function getClosestBuilding(x, y) {
  let best = null;
  let bestDistance = Infinity;

  for (const building of world.buildings) {
    if (!building.active || !building.connected) continue;
    const d = Math.hypot(x - building.x, y - building.y);
    if (d < bestDistance) {
      best = building;
      bestDistance = d;
    }
  }

  return best;
}

function getConnectedNodes() {
  const queue = [{ x: world.core.x, y: world.core.y }];
  const visited = new Set();
  const connected = new Set();

  while (queue.length) {
    const current = queue.shift();
    const key = `${current.x}|${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    connected.add(key);

    for (const building of world.buildings) {
      if (!building.active) continue;
      const dist = Math.hypot(current.x - building.x, current.y - building.y);
      if (dist <= 180 && !visited.has(`${building.x}|${building.y}`)) {
        queue.push({ x: building.x, y: building.y });
      }
    }
  }

  return connected;
}

function updateConnections() {
  const connected = getConnectedNodes();
  for (const building of world.buildings) {
    building.connected = connected.has(`${building.x}|${building.y}`);
  }
}

function addAsteroids() {
  for (let i = 0; i < 16; i++) {
    world.asteroids.push({
      x: randomBetween(100, canvas.width - 100),
      y: randomBetween(140, canvas.height - 100),
      radius: randomBetween(26, 42),
      resource: randomBetween(1200, 5000),
      empty: false,
      color: '#76f0b2',
    });
  }
}

function pushAlert(text) {
  world.alerts.push({ text, ttl: 2.5 });
}

function updateHUD() {
  mineralsText.textContent = Math.floor(world.minerals);
  mpmText.textContent = world.mineralsPerMinute;

  const energyPercent = Math.max(0, Math.min(100, (world.energy / world.maxEnergy) * 100));
  energyText.textContent = `${Math.floor(world.energy)} / ${energyPercent.toFixed(0)}%`;

  const quotaRatio = Math.min(100, (world.minerals / world.quota) * 100);
  quotaBar.style.width = `${quotaRatio}%`;
  quotaText.textContent = `${Math.floor(world.minerals)} / ${world.quota}`;
  timeText.textContent = formatTime(world.time);

  const cost = getCoreUpgradeCost();
  upgradeCoreBtn.textContent = `Upgrade Core (${cost})`;
}

function getSelectedInfoText(entity) {
  if (entity.type === 'core') {
    return 'Cœur du réseau — améliore la vitesse de construction et la capacité énergétique.';
  }

  const data = {
    relay: 'Relais — étend le réseau et relie les bâtiments.',
    miner: 'Mineur — extrait les ressources de l’astéroïde le plus proche.',
    solar: 'Solar Station — produit de l’énergie pour le réseau.',
    laser: 'Basic Laser — défense courte portée et tir précis.',
    missile: 'Missile Launcher — tir longue portée, dégâts importants.',
  };

  return data[entity.type] || 'Bâtiment';
}

function updateInfoPanel() {
  const selected = world.selectedEntity;
  if (!selected) {
    infoPanel.innerHTML = '<h3>Info</h3><p>Sélectionnez un bâtiment ou le cœur du réseau.</p>';
    return;
  }

  if (selected.type === 'core') {
    infoPanel.innerHTML = `
      <h3>Core</h3>
      <p>Vie : ${selected.health}/${selected.maxHealth}</p>
      <p>Niveau : ${selected.level}</p>
      <p>Coût upgrade : ${getCoreUpgradeCost()}</p>
      <p>${getSelectedInfoText(selected)}</p>
    `;
    return;
  }

  const progress = selected.active ? 'En ligne' : `${Math.min(100, Math.round((selected.buildProgress / selected.buildTime) * 100))}%`;

  infoPanel.innerHTML = `
    <h3>${selected.type}</h3>
    <p>Vie : ${selected.health}/${selected.maxHealth}</p>
    <p>Construction : ${progress}</p>
    <p>Connecté : ${selected.connected ? 'oui' : 'non'}</p>
    <p>Amélioration : niveau ${selected.level}</p>
    <p>${getSelectedInfoText(selected)}</p>
  `;
}

function getCoreUpgradeCost() {
  return coreUpgradeCosts[world.core.level] ?? 1200;
}

function upgradeCore() {
  const cost = getCoreUpgradeCost();
  if (world.minerals < cost) return;
  world.minerals -= cost;
  world.core.level += 1;
  world.maxEnergy += 30;
  world.energy = Math.min(world.maxEnergy, world.energy + 15);
  world.selectedEntity = world.core;
  updateInfoPanel();
  updateHUD();
}

function canUpgradeBuilding(building) {
  return building.level < 3 && world.minerals >= (upgradeCosts[building.type] || 100);
}

function upgradeBuilding(building) {
  const cost = upgradeCosts[building.type] || 100;
  if (!building || !canUpgradeBuilding(building)) return;

  world.minerals -= cost;
  building.level += 1;
  building.range = Math.max(building.range, Math.round(building.range * 1.2));
  building.damage = Math.round(building.damage * 1.3);
  building.maxHealth = Math.round(building.maxHealth * 1.15);
  building.health = building.maxHealth;
  updateInfoPanel();
  updateHUD();
}

function recycleBuilding(building) {
  if (!building) return;
  const gain = Math.round((building.maxHealth * 0.35) + (building.level * 10));
  world.minerals += gain;
  world.buildings = world.buildings.filter((b) => b !== building);
  world.selectedEntity = world.core;
  updateInfoPanel();
  updateHUD();
}

function placeBuilding(x, y, type) {
  const price = buildingPrice[type];
  if (!price || world.minerals < price) return;

  for (const building of world.buildings) {
    const d = Math.hypot(building.x - x, building.y - y);
    if (d < building.radius + 18) {
      return;
    }
  }

  world.minerals -= price;

  const building = {
    type,
    x,
    y,
    radius: 14,
    health: 100,
    maxHealth: buildingStats[type].hp || 100,
    active: false,
    buildProgress: 0,
    buildTime: buildingBuildTime[type] || 6,
    connected: false,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: type === 'solar' ? 0 : type === 'laser' ? 1 : type === 'missile' ? 2 : 0,
    range: buildingStats[type].range || 0,
    damage: buildingStats[type].damage || 0,
  };

  world.buildings.push(building);
  world.selectedEntity = building;
  updateInfoPanel();
  updateHUD();
}

function spawnWave() {
  world.currentWave += 1;
  const side = ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)];
  const count = 5 + world.currentWave * 2;

  pushAlert(`Wave ${world.currentWave} incoming from ${side}`);

  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;

    if (side === 'left') {
      x = -40;
      y = randomBetween(20, canvas.height - 20);
    } else if (side === 'right') {
      x = canvas.width + 40;
      y = randomBetween(20, canvas.height - 20);
    } else if (side === 'top') {
      x = randomBetween(20, canvas.width - 20);
      y = -40;
    } else {
      x = randomBetween(20, canvas.width - 20);
      y = canvas.height + 40;
    }

    world.enemies.push({
      x,
      y,
      radius: 11,
      speed: 0.8 + world.currentWave * 0.1 + Math.random() * 0.5,
      hp: 26 + world.currentWave * 4,
      maxHp: 26 + world.currentWave * 4,
      color: '#ff6e6e',
      damage: 8,
      type: 'fighter',
    });
  }

  world.waveTimer = Math.max(10, 20 - world.currentWave * 1.2);
}

function updateBuildings(dt) {
  for (const building of world.buildings) {
    if (!building.active) {
      building.buildProgress += dt * (1 + world.core.level * 0.35);
      if (building.buildProgress >= building.buildTime) {
        building.active = true;
        building.buildProgress = building.buildTime;
      }
    }
  }
}

function updateMining(dt) {
  let total = 0;

  for (const building of world.buildings) {
    if (!building.active || building.type !== 'miner' || !building.connected) continue;

    if (!building.targetAsteroid || building.targetAsteroid.empty) {
      building.targetAsteroid = nearestAsteroid(building.x, building.y);
    }

    if (!building.targetAsteroid || building.targetAsteroid.empty) continue;

    const d = Math.hypot(building.x - building.targetAsteroid.x, building.y - building.targetAsteroid.y);
    if (d > 65) {
      building.targetAsteroid = null;
      continue;
    }

    building.cooldown -= dt;
    if (building.cooldown <= 0) {
      const gain = Math.min(60, building.targetAsteroid.resource);
      world.minerals += gain;
      building.targetAsteroid.resource -= gain;
      total += gain;

      if (building.targetAsteroid.resource <= 0) {
        building.targetAsteroid.empty = true;
        building.targetAsteroid.color = '#8b939c';
      }

      building.cooldown = 1.15;
    }
  }

  world.mineralsPerMinute = Math.round(total * 60);
}

function updateEnergy(dt) {
  let production = 0;
  for (const building of world.buildings) {
    if (building.active && building.type === 'solar' && building.connected) production += 7;
  }

  world.energy = Math.min(world.maxEnergy, world.energy + production * dt);
}

function updateProjectiles(dt) {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    if (!p.target || p.target.hp <= 0) {
      world.projectiles.splice(i, 1);
      continue;
    }

    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;

    p.x += (dx / len) * p.speed * dt;
    p.y += (dy / len) * p.speed * dt;

    if (Math.hypot(p.x - p.target.x, p.y - p.target.y) < p.radius + p.target.radius + 2) {
      p.target.hp -= p.damage;
      world.projectiles.splice(i, 1);
    }
  }
}

function updateLasers(dt) {
  for (let i = world.lasers.length - 1; i >= 0; i--) {
    world.lasers[i].life -= dt;
    if (world.lasers[i].life <= 0) {
      world.lasers.splice(i, 1);
    }
  }

  for (let i = world.alerts.length - 1; i >= 0; i--) {
    world.alerts[i].ttl -= dt;
    if (world.alerts[i].ttl <= 0) {
      world.alerts.splice(i, 1);
    }
  }
}

function updateDefenses(dt) {
  for (const building of world.buildings) {
    if (!building.active || !building.connected) continue;

    if (building.type === 'laser') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        const target = getClosestEnemy(building.x, building.y, building.range || 120);
        if (target) {
          target.hp -= building.damage;
          world.lasers.push({
            fromX: building.x,
            fromY: building.y,
            toX: target.x,
            toY: target.y,
            life: 0.12,
            color: '#ffe07a',
          });
          building.cooldown = 0.55;
        }
      }
    }

    if (building.type === 'missile') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        const target = getClosestEnemy(building.x, building.y, building.range || 260);
        if (target) {
          world.projectiles.push({
            x: building.x,
            y: building.y,
            target,
            speed: 220,
            radius: 5,
            damage: 90,
            color: '#ff5d7d',
          });
          building.cooldown = 2.2;
        }
      }
    }
  }
}

function getEnemyTarget(enemy) {
  let bestTarget = world.core;
  let bestDistance = Math.hypot(enemy.x - world.core.x, enemy.y - world.core.y);

  for (const building of world.buildings) {
    if (!building.active || !building.connected) continue;
    const d = Math.hypot(enemy.x - building.x, enemy.y - building.y);
    if (d < bestDistance) {
      bestTarget = building;
      bestDistance = d;
    }
  }

  return bestTarget;
}

function updateEnemies(dt) {
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const enemy = world.enemies[i];
    const target = getEnemyTarget(enemy);

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / len) * enemy.speed * 60 * dt;
    enemy.y += (dy / len) * enemy.speed * 60 * dt;

    const hitDist = target.radius + enemy.radius + 6;
    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) < hitDist) {
      target.health -= enemy.damage;
      world.enemies.splice(i, 1);
      continue;
    }

    if (enemy.hp <= 0) {
      world.enemies.splice(i, 1);
      world.minerals += 15;
    }
  }

  for (const building of world.buildings) {
    if (building.health <= 0) {
      building.active = false;
      building.connected = false;
    }
  }

  if (world.core.health <= 0) {
    world.core.health = world.core.maxHealth;
  }
}

function drawDiamond(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawHexagon(x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawTriangle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x - r, y + r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawSquare(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.rect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawOctagon(x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function renderBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 180; i++) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53) % canvas.height;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = 'rgba(84,94,160,0.12)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAsteroids() {
  for (const asteroid of world.asteroids) {
    ctx.beginPath();
    ctx.fillStyle = asteroid.empty ? '#8e929a' : asteroid.color;
    ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
  }
}

function drawCore() {
  drawOctagon(world.core.x, world.core.y, world.core.radius, '#6ec6ff', '#dff6ff');
}

function drawBuildings() {
  for (const building of world.buildings) {
    const colors = {
      relay: '#66c4ff',
      miner: '#79f7b9',
      solar: '#ffd769',
      laser: '#ff9a67',
      missile: '#ff5d7d',
    };

    ctx.beginPath();
    ctx.fillStyle = building.connected ? '#0e1730' : '#1a1a1a';
    ctx.arc(building.x, building.y, building.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    if (building.type === 'relay') {
      drawDiamond(building.x, building.y, building.radius * 0.85, colors[building.type], '#dfeeff');
    } else if (building.type === 'miner') {
      drawDiamond(building.x, building.y, building.radius * 0.82, colors[building.type], '#ddffef');
      ctx.beginPath();
      ctx.moveTo(building.x, building.y - 10);
      ctx.lineTo(building.x + 4, building.y + 10);
      ctx.lineTo(building.x - 4, building.y + 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10,30,20,0.5)';
      ctx.fill();
    } else if (building.type === 'solar') {
      drawHexagon(building.x, building.y, building.radius * 0.85, colors[building.type], '#fff1bf');
    } else if (building.type === 'laser') {
      drawTriangle(building.x, building.y + 4, building.radius * 0.85, colors[building.type], '#fff0d6');
    } else if (building.type === 'missile') {
      drawSquare(building.x, building.y, building.radius * 0.8, colors[building.type], '#ffd5df');
    }

    if (!building.active) {
      const ratio = Math.min(1, building.buildProgress / building.buildTime);
      const barX = building.x - 18;
      const barY = building.y - building.radius - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(barX, barY, 36, 6);
      ctx.fillStyle = '#73f7b9';
      ctx.fillRect(barX, barY, 36 * ratio, 6);
    }

    if (world.selectedEntity === building) {
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.arc(building.x, building.y, building.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawEnemyShape(enemy) {
  const r = enemy.radius;
  ctx.beginPath();
  ctx.moveTo(enemy.x, enemy.y - r);
  ctx.lineTo(enemy.x + r * 0.9, enemy.y);
  ctx.lineTo(enemy.x, enemy.y + r * 1.05);
  ctx.lineTo(enemy.x - r * 0.9, enemy.y);
  ctx.closePath();
  ctx.fillStyle = enemy.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();
}

function drawEnemies() {
  for (const enemy of world.enemies) {
    drawEnemyShape(enemy);
  }
}

function drawProjectiles() {
  for (const p of world.projectiles) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLasers() {
  for (const l of world.lasers) {
    ctx.beginPath();
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 2;
    ctx.moveTo(l.fromX, l.fromY);
    ctx.lineTo(l.toX, l.toY);
    ctx.stroke();
  }
}

function drawNetwork() {
  const connected = getConnectedNodes();
  for (const building of world.buildings) {
    if (!building.active || !building.connected) continue;
    if (!connected.has(`${building.x}|${building.y}`)) continue;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(96, 192, 255, 0.38)';
    ctx.lineWidth = 1.2;
    ctx.moveTo(world.core.x, world.core.y);
    ctx.lineTo(building.x, building.y);
    ctx.stroke();
  }

  for (let i = 0; i < world.buildings.length; i++) {
    for (let j = i + 1; j < world.buildings.length; j++) {
      const a = world.buildings[i];
      const b = world.buildings[j];
      if (!a.active || !b.active) continue;
      if (a.connected && b.connected) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 180) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(96, 192, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }
}

function drawAlerts() {
  for (let i = 0; i < world.alerts.length; i++) {
    const alert = world.alerts[i];
    const alpha = Math.min(1, alert.ttl / 2.5);
    ctx.fillStyle = `rgba(255, 140, 70, ${alpha})`;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(alert.text, 18, 115 + i * 22);
  }
}

function render() {
  renderBackground();
  drawNetwork();
  drawAsteroids();
  drawCore();
  drawBuildings();
  drawLasers();
  drawProjectiles();
  drawEnemies();
  drawAlerts();
}

function tick(timestamp) {
  const dt = Math.min(0.033, (timestamp - world.lastTime) / 1000 || 0.016);
  world.lastTime = timestamp;

  if (!world.paused) {
    world.time += dt;
    world.waveTimer -= dt;

    updateConnections();
    updateBuildings(dt);
    updateMining(dt);
    updateEnergy(dt);
    updateDefenses(dt);
    updateProjectiles(dt);
    updateLasers(dt);
    updateEnemies(dt);
    updateHUD();
    updateInfoPanel();

    if (world.waveTimer <= 0) {
      spawnWave();
    }
  }

  render();
  requestAnimationFrame(tick);
}

canvas.addEventListener('click', (event) => {
  const point = canvasPointFromEvent(event);

  if (world.buildMode) {
    placeBuilding(point.x, point.y, world.selectedType);
    return;
  }

  const dCore = Math.hypot(point.x - world.core.x, point.y - world.core.y);
  if (dCore <= world.core.radius + 8) {
    world.selectedEntity = world.core;
    updateInfoPanel();
    return;
  }

  for (const building of world.buildings) {
    const d = Math.hypot(building.x - point.x, building.y - point.y);
    if (d <= building.radius + 8) {
      world.selectedEntity = building;
      updateInfoPanel();
      return;
    }
  }
});

document.querySelectorAll('.build-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.build-item').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');
    world.selectedType = item.dataset.type;
    world.buildMode = true;
    buildBtn.textContent = `Pose: ${world.selectedType}`;
  });
});

buildBtn.addEventListener('click', () => {
  world.buildMode = !world.buildMode;
  buildBtn.textContent = world.buildMode ? `Pose: ${world.selectedType}` : 'Sélection';
});

pauseBtn.addEventListener('click', () => {
  world.paused = !world.paused;
  pauseBtn.textContent = world.paused ? 'Reprendre' : 'Pause';
});

upgradeCoreBtn.addEventListener('click', () => {
  upgradeCore();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const point = canvasPointFromEvent(event);
  const building = world.buildings.find((b) => Math.hypot(b.x - point.x, b.y - point.y) <= b.radius + 8);
  if (building) {
    if (canUpgradeBuilding(building)) {
      upgradeBuilding(building);
    } else {
      recycleBuilding(building);
    }
  }
});

addAsteroids();
world.selectedEntity = world.core;
updateHUD();
updateInfoPanel();
requestAnimationFrame(tick);
