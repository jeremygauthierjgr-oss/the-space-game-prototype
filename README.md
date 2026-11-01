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

const world = {
  minerals: 1800,
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
  summary: '',
  spawnTimer: 0,
  selectedBuilding: null,
};

const buildingPrice = {
  relay: 20,
  miner: 45,
  solar: 200,
  laser: 100,
  missile: 400,
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
    const d = Math.hypot(x - building.x, y - building.y);
    if (d < bestDistance) {
      best = building;
      bestDistance = d;
    }
  }

  return best;
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

function addAsteroids() {
  for (let i = 0; i < 24; i++) {
    world.asteroids.push({
      x: randomBetween(80, canvas.width - 90),
      y: randomBetween(150, canvas.height - 90),
      radius: randomBetween(22, 42),
      resource: randomBetween(180, 620),
      empty: false,
      color: '#76f0b2',
      glow: 'rgba(118, 240, 178, 0.2)',
    });
  }
}

function addInitialBuildings() {
  world.buildings.push({
    type: 'relay',
    x: 260,
    y: 220,
    radius: 13,
    health: 100,
    maxHealth: 100,
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: 0,
    range: 0,
    damage: 0,
  });

  world.buildings.push({
    type: 'relay',
    x: 430,
    y: 290,
    radius: 13,
    health: 100,
    maxHealth: 100,
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: 0,
    range: 0,
    damage: 0,
  });
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
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomBetween(-30, canvas.width + 30);
    y = -40;
  } else if (side === 1) {
    x = canvas.width + 40;
    y = randomBetween(-30, canvas.height + 30);
  } else if (side === 2) {
    x = randomBetween(-30, canvas.width + 30);
    y = canvas.height + 40;
  } else {
    x = -40;
    y = randomBetween(-30, canvas.height + 30);
  }

  world.enemies.push({
    x,
    y,
    radius: 10,
    speed: randomBetween(0.8, 1.4),
    hp: 30,
    maxHp: 30,
    color: '#ff6e6e',
  });
}

function getSelectedInfoText(building) {
  const data = {
    relay: 'Relais — étend le réseau et relie les bâtiments.',
    miner: 'Mineur — extrait les ressources de l’astéroïde le plus proche.',
    solar: 'Solar Station — produit de l’énergie pour le réseau.',
    laser: 'Basic Laser — défense courte portée et tir précis.',
    missile: 'Missile Launcher — tir longue portée, dégâts importants.',
  };
  return data[building.type] || 'Bâtiment';
}

function updateInfoPanel() {
  const selected = world.selectedBuilding;
  if (!selected) {
    infoPanel.innerHTML = '<h3>Info</h3><p>Sélectionnez un bâtiment pour voir ses stats.</p>';
    return;
  }

  infoPanel.innerHTML = `
    <h3>${selected.type}</h3>
    <p>Vie : ${selected.health}/${selected.maxHealth || 100}</p>
    <p>Type : ${selected.type}</p>
    <p>Niveau : ${selected.level}</p>
    <p>${getSelectedInfoText(selected)}</p>
  `;
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
    maxHealth: 100,
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: type === 'solar' ? 0 : (type === 'laser' ? 1 : type === 'missile' ? 2 : 0),
    range: type === 'laser' ? 120 : type === 'missile' ? 260 : 0,
    damage: type === 'laser' ? 30 : type === 'missile' ? 90 : 0,
  };

  world.buildings.push(building);
  world.selectedBuilding = building;
  updateInfoPanel();
  updateHUD();
}

function maybeAssignMinerTarget(building) {
  if (building.type !== 'miner') return;

  const asteroid = nearestAsteroid(building.x, building.y);
  if (!asteroid || asteroid.empty) {
    building.targetAsteroid = null;
    return;
  }

  const d = Math.hypot(building.x - asteroid.x, building.y - asteroid.y);
  if (d <= 65) {
    building.targetAsteroid = asteroid;
  } else {
    building.targetAsteroid = null;
  }
}

function updateMining(dt) {
  let total = 0;

  for (const building of world.buildings) {
    if (building.type !== 'miner') continue;

    maybeAssignMinerTarget(building);
    if (!building.targetAsteroid || building.targetAsteroid.empty) continue;

    building.cooldown -= dt;
    if (building.cooldown <= 0) {
      const gain = Math.min(80, building.targetAsteroid.resource);
      world.minerals += gain;
      building.targetAsteroid.resource -= gain;
      total += gain;

      if (building.targetAsteroid.resource <= 0) {
        building.targetAsteroid.empty = true;
        building.targetAsteroid.color = '#8b939c';
      }

      building.cooldown = 1.0;
    }
  }

  world.mineralsPerMinute = total * 60;
}

function updateSolarProduction(dt) {
  let production = 0;
  for (const building of world.buildings) {
    if (building.type === 'solar' && building.connected) {
      production += 7;
    }
  }

  world.energy = Math.min(world.maxEnergy, world.energy + production * dt);
}

function updateLasersAndMissiles(dt) {
  for (const building of world.buildings) {
    if (building.type === 'laser') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        const target = getClosestEnemy(building.x, building.y, building.range || 120);
        if (!target) continue;

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

    if (building.type === 'missile') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        const target = getClosestEnemy(building.x, building.y, building.range || 260);
        if (!target) continue;

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
}

function updateEnemies(dt) {
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const enemy = world.enemies[i];
    const targetBuilding = getClosestBuilding(enemy.x, enemy.y) || { x: canvas.width / 2, y: canvas.height / 2 };
    const dx = targetBuilding.x - enemy.x;
    const dy = targetBuilding.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / len) * enemy.speed * 60 * dt;
    enemy.y += (dy / len) * enemy.speed * 60 * dt;

    if (targetBuilding && Math.hypot(enemy.x - targetBuilding.x, enemy.y - targetBuilding.y) < 18) {
      targetBuilding.health -= 10;
      world.enemies.splice(i, 1);

      if (targetBuilding.health <= 0) {
        world.buildings = world.buildings.filter((building) => building !== targetBuilding);
      }
      continue;
    }

    if (enemy.hp <= 0) {
      world.enemies.splice(i, 1);
      world.minerals += 15;
    }
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

  ctx.fillStyle = 'rgba(84, 94, 160, 0.12)';
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

function drawBuildings() {
  for (const building of world.buildings) {
    ctx.beginPath();
    ctx.fillStyle = '#101826';
    ctx.arc(building.x, building.y, building.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    const colors = {
      relay: '#66c4ff',
      miner: '#79f7b9',
      solar: '#ffd769',
      laser: '#ff9a67',
      missile: '#ff5d7d',
    };

    ctx.beginPath();
    ctx.fillStyle = colors[building.type] || '#8cc8ff';
    ctx.arc(building.x, building.y, building.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    if (world.selectedBuilding === building) {
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.arc(building.x, building.y, building.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawEnemies() {
  for (const enemy of world.enemies) {
    ctx.beginPath();
    ctx.fillStyle = enemy.color;
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
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
  for (let i = 0; i < world.buildings.length; i++) {
    const a = world.buildings[i];
    for (let j = i + 1; j < world.buildings.length; j++) {
      const b = world.buildings[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 180) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(96, 192, 255, 0.38)';
        ctx.lineWidth = 1.2;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

function render() {
  renderBackground();
  drawNetwork();
  drawAsteroids();
  drawBuildings();
  drawLasers();
  drawProjectiles();
  drawEnemies();
}

function tick(timestamp) {
  const dt = Math.min(0.033, (timestamp - world.lastTime) / 1000 || 0.016);
  world.lastTime = timestamp;

  if (!world.paused) {
    world.time += dt;
    world.spawnTimer += dt;

    updateSolarProduction(dt);
    updateMining(dt);
    updateLasersAndMissiles(dt);
    updateProjectiles(dt);
    updateLasers(dt);
    updateEnemies(dt);
    updateHUD();

    if (world.spawnTimer > 2.5) {
      world.spawnTimer = 0;
      spawnEnemy();
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

  let selected = null;
  for (const building of world.buildings) {
    const d = Math.hypot(building.x - point.x, building.y - point.y);
    if (d <= building.radius + 8) {
      selected = building;
      break;
    }
  }

  world.selectedBuilding = selected;
  updateInfoPanel();
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

addAsteroids();
addInitialBuildings();
world.selectedBuilding = world.buildings[0];
updateHUD();
updateInfoPanel();
requestAnimationFrame(tick);

