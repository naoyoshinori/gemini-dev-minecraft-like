import * as THREE from 'three';
import { Engine } from './core/Engine';
import { World } from './core/World';
import { Player } from './core/Player';
import { Network } from './core/Network';
import { UI } from './core/UI';
import { Inventory } from './core/Inventory';
import { AudioManager } from './core/AudioManager';
import { WeatherManager } from './core/WeatherManager';
import { BlockType, CHUNK_SIZE, BLOCK_PROPS } from '@voxel/shared';

const engine = new Engine();
const world = new World(engine.scene);
const inventory = new Inventory();
const audio = new AudioManager();
const weatherManager = new WeatherManager(engine.scene);
let currentWeather = 'CLEAR';

const network = new Network((msg) => handleMessage(msg));
const ui = new UI(inventory, () => { }, (text) => network.send('chat_message', { text }));
const player = new Player(engine.camera, engine.renderer.domElement, world);

const selectionBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
);
engine.scene.add(selectionBox);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

const mobMeshes = new Map<string, THREE.Mesh>();
const mobMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const mobGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);

const otherPlayers = new Map<string, THREE.Mesh>();
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0000ff });

let miningTarget: { x: number, y: number, z: number, progress: number } | null = null;
const isMouseDown = { left: false };

function handleMessage(message: any) {
  if (message.type === 'chunk_data') {
    const { x, y, z, blocks } = message.data;
    world.addChunk(x, y, z, new Uint8Array(blocks));
  } else if (message.type === 'block_update') {
    const { pos, type } = message.data;
    world.updateBlock(pos.x, pos.y, pos.z, type);
  } else if (message.type === 'mob_update') {
    const { mobs } = message.data;
    mobs.forEach((mob: any) => {
      let mesh = mobMeshes.get(mob.id);
      if (!mesh) {
        mesh = new THREE.Mesh(mobGeometry, mobMaterial);
        mesh.castShadow = true; mesh.receiveShadow = true;
        engine.scene.add(mesh); mobMeshes.set(mob.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(mob.pos.x, mob.pos.y + 0.9, mob.pos.z), 0.5);
      mesh.rotation.y = mob.rot;
    });
  } else if (message.type === 'player_update') {
    const { players } = message.data;
    players.forEach((p: any) => {
      if (p.id === 'me') return;
      let mesh = otherPlayers.get(p.id);
      if (!mesh) {
        mesh = new THREE.Mesh(mobGeometry, playerMaterial);
        mesh.castShadow = true; mesh.receiveShadow = true;
        engine.scene.add(mesh); otherPlayers.set(p.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(p.pos.x, p.pos.y + 0.9, p.pos.z), 0.5);
      mesh.rotation.y = p.rot;
    });
  } else if (message.type === 'player_leave') {
    const mesh = otherPlayers.get(message.data.id);
    if (mesh) { engine.scene.remove(mesh); otherPlayers.delete(message.data.id); }
  } else if (message.type === 'chat_message') {
    ui.addChat(message.data.sender, message.data.text);
  } else if (message.type === 'weather_update') {
    currentWeather = message.data.weather;
  }
}

document.addEventListener('mousedown', (e) => {
  audio.init();
  if (!player.controls.isLocked || ui.isInventoryOpen || ui.isChatOpen) return;
  if (e.button === 0) isMouseDown.left = true;
  else if (e.button === 2) {
    raycaster.setFromCamera(mouse, engine.camera);
    const intersects = raycaster.intersectObjects(world.getMeshObjects());
    if (intersects.length > 0) {
      if (inventory.isTool(ui.selectedBlock)) return;
      const i = intersects[0];
      const p = i.point.clone().add(i.face!.normal!.clone().multiplyScalar(0.5));
      if (inventory.remove(ui.selectedBlock)) {
        audio.playPlace();
        network.sendBlockUpdate(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), ui.selectedBlock);
      }
    }
  }
});

document.addEventListener('mouseup', (e) => { if (e.button === 0) { isMouseDown.left = false; miningTarget = null; } });

document.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') ui.toggleInventory(player.controls);
});

const renderDistance = 3;
let gameTime = 0;
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min(0.1, (time - prevTime) / 1000);
  prevTime = time;
  gameTime += delta * 0.05;

  const sunAngle = gameTime;
  engine.directionalLight.position.set(Math.cos(sunAngle) * 50 + player.camera.position.x, Math.sin(sunAngle) * 50 + player.camera.position.y, player.camera.position.z);
  engine.directionalLight.target.position.copy(player.camera.position);
  engine.directionalLight.target.updateMatrixWorld();

  const intensity = Math.max(0, Math.sin(sunAngle));
  let skyColor = new THREE.Color().setHSL(0.6, 0.5, Math.max(0.05, intensity * 0.5));
  
  // Weather adjustments
  if (currentWeather === 'RAIN') { skyColor.multiplyScalar(0.5); }
  else if (currentWeather === 'SNOW') { skyColor.lerp(new THREE.Color(0xffffff), 0.3); }

  engine.scene.background = skyColor;
  if (engine.scene.fog) engine.scene.fog.color = skyColor;
  engine.directionalLight.intensity = intensity * 0.8;
  engine.ambientLight.intensity = Math.max(0.1, intensity * 0.6);

  if (!ui.isChatOpen) player.update(delta, audio);
  world.updateClouds(delta);
  weatherManager.update(currentWeather, player.camera.position, delta);

  if (isMouseDown.left && player.controls.isLocked && !ui.isInventoryOpen && !ui.isChatOpen) {
    raycaster.setFromCamera(mouse, engine.camera);
    const intersects = raycaster.intersectObjects(world.getMeshObjects());
    if (intersects.length > 0) {
      const i = intersects[0];
      const p = i.point.clone().add(i.face!.normal!.clone().multiplyScalar(-0.5));
      const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      const type = world.getBlockAt(bx, by, bz);
      if (type !== BlockType.AIR) {
        if (!miningTarget || miningTarget.x !== bx || miningTarget.y !== by || miningTarget.z !== bz) miningTarget = { x: bx, y: by, z: bz, progress: 0 };
        const props = BLOCK_PROPS[type] || { hardness: 0.5 };
        let speed = 1.0 / props.hardness;
        if (props.tool === ui.selectedBlock) speed *= 5.0;
        miningTarget.progress += delta * speed;
        // @ts-ignore
        selectionBox.material.color.setHSL(0.1, 1, 0.5 + (miningTarget.progress * 0.5));
        if (miningTarget.progress >= 1.0) {
          audio.playBreak(); inventory.add(type);
          if (inventory.isTool(ui.selectedBlock)) { if (inventory.useTool(ui.selectedBlock)) ui.setupHotbar(); }
          network.sendBlockUpdate(bx, by, bz, BlockType.AIR);
          miningTarget = null;
        }
      }
    } else miningTarget = null;
  } else {
    // @ts-ignore
    selectionBox.material.color.set(0xffff00);
  }

  if (player.controls.isLocked) {
    const pCX = Math.floor(player.camera.position.x / CHUNK_SIZE);
    const pCY = Math.floor(player.camera.position.y / CHUNK_SIZE);
    const pCZ = Math.floor(player.camera.position.z / CHUNK_SIZE);
    ui.updateCoords(player.camera.position, { x: pCX, y: pCY, z: pCZ });
    network.send('player_move', { pos: player.camera.position, rot: player.camera.rotation.y });
    for (let x = -renderDistance; x <= renderDistance; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -renderDistance; z <= renderDistance; z++)
          if (!world.chunks.has(`${pCX+x},${pCY+y},${pCZ+z}`))
            network.requestChunk(pCX+x, pCY+y, pCZ+z);
  }

  if (!ui.isInventoryOpen && !ui.isChatOpen) {
    raycaster.setFromCamera(mouse, engine.camera);
    const intersects = raycaster.intersectObjects(world.getMeshObjects());
    if (intersects.length > 0) {
      const i = intersects[0];
      selectionBox.visible = true;
      const p = i.point.clone().add(i.face!.normal!.clone().multiplyScalar(-0.5));
      selectionBox.position.set(Math.floor(p.x) + 0.5, Math.floor(p.y) + 0.5, Math.floor(p.z) + 0.5);
    } else { selectionBox.visible = false; }
  } else { selectionBox.visible = false; }

  engine.render();
}
animate();
