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
  particles: []
};

const buildingPrice = {
  relay: 20,
  miner: 45,
  solar: 200,
  laser: 100,
  missile: 400
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function addAsteroids() {
  for (let i = 0; i < 24; i++) {
    world.asteroids.push({
      x: randomBetween(80, canvas.width - 90),
      y: randomBetween(150, canvas.height - 100),
      radius: randomBetween(24, 42),
      resource: randomBetween(150, 620),
      empty: false,
      color: '#76f0b2'
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
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: 0
  });

  world.buildings.push({
    type: 'relay',
    x: 430,
    y: 290,
    radius: 13,
    health: 100,
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: 0
  });
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateResourceHud() {
  mineralsText.textContent = Math.floor(world.minerals);
  mpmText.textContent = world.mineralsPerMinute;
  const energyPercent = Math.max(0, Math.min(100, (world.energy / world.maxEnergy) * 100));
  energyText.textContent = `${Math.floor(world.energy)} / ${energyPercent.toFixed(0)}%`;

  const quotaRatio = Math.min(100, (world.minerals / world.quota) * 100);
  quotaBar.style.width = `${quotaRatio}%`;
  quotaText.textContent = `${Math.floor(world.minerals)} / ${world.quota}`;
  timeText.textContent = formatTime(world.time);
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

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomBetween(-20, canvas.width + 20);
    y = -30;
  } else if (side === 1) {
    x = canvas.width + 30;
    y = randomBetween(-20, canvas.height + 20);
  } else if (side === 2) {
    x = randomBetween(-20, canvas.width + 20);
    y = canvas.height + 30;
  } else {
    x = -30;
    y = randomBetween(-20, canvas.height + 20);
  }

  world.enemies.push({
    x,
    y,
    radius: 10,
    speed: randomBetween(0.8, 1.4),
    hp: 30,
    color: '#ff6e6e'
  });
}

function placeBuilding(x, y, type) {
  const price = buildingPrice[type];
  if (world.minerals < price) return;

  world.minerals -= price;

  const building = {
    type,
    x,
    y,
    radius: 14,
    health: 100,
    connected: true,
    level: 1,
    cooldown: 0,
    targetAsteroid: null,
    energy: type === 'solar' ? 0 : (type === 'laser' ? 1 : (type === 'missile' ? 2 : 0)),
    range: type === 'laser' ? 120 : (type === 'missile' ? 260 : 0),
    damage: type === 'laser' ? 30 : (type === 'missile' ? 90 : 0)
  };

  world.buildings.push(building);
  updateResourceHud();
}

function maybeFindTargetForMiner(building) {
  if (building.type !== 'miner') return;
  if (!building.targetAsteroid) {
    building.targetAsteroid = nearestAsteroid(building.x, building.y);
  }
  if (!building.targetAsteroid || building.targetAsteroid.empty) {
    building.targetAsteroid = nearestAsteroid(building.x, building.y);
  }
}

function updateMineralsProduction(dt) {
  let total = 0;

  for (const building of world.buildings) {
    if (building.type === 'miner') {
      maybeFindTargetForMiner(building);
      if (building.targetAsteroid && !building.targetAsteroid.empty) {
        const d = Math.hypot(building.x - building.targetAsteroid.x, building.y - building.targetAsteroid.y);
        if (d < 52) {
          building.cooldown -= dt;
          if (building.cooldown <= 0) {
            const gain = 80;
            world.minerals += gain;
            building.targetAsteroid.resource -= gain;
            if (building.targetAsteroid.resource <= 0) {
              building.targetAsteroid.empty = true;
              building.targetAsteroid.color = '#8b939c';
            }
            total += gain;
            building.cooldown = 1;
          }
        }
      }
    }
  }

  world.mineralsPerMinute = total;
}

function updateSolarProduction() {
  let production = 0;
  for (const building of world.buildings) {
    if (building.type === 'solar' && building.connected) {
      production += 7;
    }
  }
  world.energy += production * 0.016;
  world.energy = Math.min(world.energy, world.maxEnergy);
}

function updateDefenses(dt) {
  for (const building of world.buildings) {
    if (building.type === 'laser') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        let target = null;
        let bestDist = Infinity;
        for (const enemy of world.enemies) {
          const d = Math.hypot(building.x - enemy.x, building.y - enemy.y);
          if (d <= building.range && d < bestDist) {
            bestDist = d;
            target = enemy;
          }
        }

        if (target) {
          target.hp -= building.damage;
          world.lasers.push({
            fromX: building.x,
            fromY: building.y,
            toX: target.x,
            toY: target.y,
            life: 0.12,
            color: '#ffe07a'
          });
          building.cooldown = 0.55;
        }
      }
    }

    if (building.type === 'missile') {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        let target = null;
        let bestDist = Infinity;
        for (const enemy of world.enemies) {
          const d = Math.hypot(building.x - enemy.x, building.y - enemy.y);
          if (d <= building.range && d < bestDist) {
            bestDist = d;
            target = enemy;
          }
        }

        if (target) {
          world.projectiles.push({
            x: building.x,
            y: building.y,
            tx: target.x,
            ty: target.y,
            speed: 220,
            radius: 4,
            damage: 90,
            color: '#ff5d7d'
          });
          building.cooldown = 2.2;
        }
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const enemy = world.enemies[i];
    const target = world.buildings[0] || { x: canvas.width / 2, y: canvas.height / 2 };
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / len) * enemy.speed * 60 * dt;
    enemy.y += (dy / len) * enemy.speed * 60 * dt;

    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) < 12) {
      world.energy = Math.max(0, world.energy - 1);
      world.enemies.splice(i, 1);
      continue;
    }

    if (enemy.hp <= 0) {
      world.enemies.splice(i, 1);
      world.minerals += 15;
    }
  }
}

function updateProjectiles(dt) {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    p.x += (dx / len) * p.speed * dt;
    p.y += (dy / len) * p.speed * dt;

    for (const enemy of world.enemies) {
      if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.radius + p.radius) {
        enemy.hp -= p.damage;
        world.projectiles.splice(i, 1);
        break;
      }
    }

    if (world.projectiles[i] && Math.hypot(p.x - p.tx, p.y - p.ty) < 8) {
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

function renderBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 160; i++) {
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
  for (const b of world.buildings) {
    ctx.beginPath();
    ctx.fillStyle = '#101826';
    ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    const colors = {
      relay: '#66c4ff',
      miner: '#79f7b9',
      solar: '#ffd769',
      laser: '#ff9a67',
      missile: '#ff5d7d'
    };

    ctx.beginPath();
    ctx.fillStyle = colors[b.type] || '#8cc8ff';
    ctx.arc(b.x, b.y, b.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
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
    const b1 = world.buildings[i];
    for (let j = i + 1; j < world.buildings.length; j++) {
      const b2 = world.buildings[j];
      const d = Math.hypot(b1.x - b2.x, b1.y - b2.y);
      if (d < 180) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(96, 192, 255, 0.38)';
        ctx.lineWidth = 1.2;
        ctx.moveTo(b1.x, b1.y);
        ctx.lineTo(b2.x, b2.y);
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

function updateInfoPanel() {
  const selected = world.buildings[world.buildings.length - 1];
  if (!selected) {
    infoPanel.innerHTML = '<h3>Info</h3><p>Sélectionnez un bâtiment pour voir ses stats.</p>';
    return;
  }

  const texts = {
    relay: 'Relais — étend le réseau et relie les structures.',
    miner: 'Mineur — extrait des minéraux au contact d’un astéroïde.',
    solar: 'Solar Station — produit de l’énergie pour le réseau.',
    laser: 'Basic Laser — défense de courte portée.',
    missile: 'Missile Launcher — tir de longue portée, dégâts importants.'
  };

  infoPanel.innerHTML = `
    <h3>${selected.type}</h3>
    <p>Vie : ${selected.health}</p>
    <p>Type : ${selected.type}</p>
    <p>Niveau : ${selected.level}</p>
    <p>${texts[selected.type]}</p>
  `;
}

function tick(timestamp) {
  const dt = Math.min(0.033, (timestamp - world.lastTime) / 1000 || 0.016);
  world.lastTime = timestamp;

  if (!world.paused) {
    world.time += dt;
    updateSolarProduction();
    updateMineralsProduction(dt);
    updateDefenses(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateLasers(dt);
    updateResourceHud();
    updateInfoPanel();

    if (Math.random() < 0.012) {
      spawnEnemy();
    }
  }

  render();
  requestAnimationFrame(tick);
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (world.buildMode) {
    placeBuilding(x, y, world.selectedType);
    return;
  }

  for (const building of world.buildings) {
    const d = Math.hypot(building.x - x, building.y - y);
    if (d <= building.radius + 10) {
      world.buildings = world.buildings.filter(b => b !== building) || world.buildings;
      infoPanel.innerHTML = `<h3>${building.type}</h3><p>Construction sélectionnée.</p>`;
      return;
    }
  }
});

document.querySelectorAll('.build-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.build-item').forEach(el => el.classList.remove('active'));
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
updateResourceHud();
updateInfoPanel();
requestAnimationFrame(tick);
