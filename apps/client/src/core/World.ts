import * as THREE from 'three';
import { BlockType, CHUNK_SIZE, getBlockIndex } from '@voxel/shared';

const UV_MAP: Record<number, [number, number]> = {
  [BlockType.GRASS]: [0, 0], [BlockType.DIRT]: [1, 0], [BlockType.STONE]: [2, 0], [BlockType.WOOD]: [3, 0],
  [BlockType.WATER]: [0, 1], [BlockType.SAND]: [1, 1], [BlockType.LOG]: [2, 1], [BlockType.LEAVES]: [3, 1],
};

const meshWorker = new Worker(new URL('./MeshWorker.ts', import.meta.url), { type: 'module' });

class Chunk {
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  blocks: Uint8Array;
  x: number; y: number; z: number;
  scene: THREE.Scene;
  material: THREE.Material;
  waterMaterial: THREE.Material;

  constructor(x: number, y: number, z: number, blocks: Uint8Array, scene: THREE.Scene, material: THREE.Material, waterMaterial: THREE.Material) {
    this.x = x; this.y = y; this.z = z;
    this.blocks = blocks;
    this.scene = scene;
    this.material = material;
    this.waterMaterial = waterMaterial;
    this.generateMesh();
  }

  getBlock(lx: number, ly: number, lz: number): number {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return BlockType.AIR;
    return this.blocks[getBlockIndex(lx, ly, lz)];
  }

  generateMesh() {
    meshWorker.postMessage({ blocks: this.blocks, x: this.x, y: this.y, z: this.z, isWater: false, UV_MAP });
    meshWorker.postMessage({ blocks: this.blocks, x: this.x, y: this.y, z: this.z, isWater: true, UV_MAP });
  }

  applyMeshData(data: any) {
    const { positions, normals, uvs, colors, indices, isWater } = data;
    if (positions.length === 0) {
        if (isWater && this.waterMesh) { this.scene.remove(this.waterMesh); this.waterMesh = null; }
        if (!isWater && this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
        return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1));

    if (isWater) {
      if (this.waterMesh) { this.scene.remove(this.waterMesh); this.waterMesh.geometry.dispose(); }
      this.waterMesh = new THREE.Mesh(geometry, this.waterMaterial);
      this.waterMesh.position.set(this.x * CHUNK_SIZE, this.y * CHUNK_SIZE, this.z * CHUNK_SIZE);
      this.waterMesh.receiveShadow = true;
      this.scene.add(this.waterMesh);
    } else {
      if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.position.set(this.x * CHUNK_SIZE, this.y * CHUNK_SIZE, this.z * CHUNK_SIZE);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    }
  }
}

export class World {
  chunks = new Map<string, Chunk>();
  scene: THREE.Scene;
  material: THREE.Material;
  waterMaterial: THREE.Material;
  clouds: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const { terrain, water } = this.createMaterials();
    this.material = terrain;
    this.waterMaterial = water;
    this.createClouds();

    meshWorker.onmessage = (e) => {
      const { chunkX, chunkY, chunkZ } = e.data;
      const chunk = this.chunks.get(`${chunkX},${chunkY},${chunkZ}`);
      if (chunk) chunk.applyMeshData(e.data);
    };
  }

  createMaterials() {
    const size = 64, atlasSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = atlasSize;
    const ctx = canvas.getContext('2d')!;
    const drawTexture = (x: number, y: number, color: string) => {
      ctx.fillStyle = color; ctx.fillRect(x * size, y * size, size, size);
      for (let i = 0; i < 256; i++) {
        const val = Math.floor(Math.random() * 50);
        ctx.fillStyle = `rgba(0,0,0,${val / 255})`;
        ctx.fillRect(x * size + Math.random() * size, y * size + Math.random() * size, 2, 2);
      }
    };
    drawTexture(0, 0, '#44aa44'); drawTexture(1, 0, '#8b4513'); drawTexture(2, 0, '#808080'); drawTexture(3, 0, '#5d4037');
    drawTexture(0, 1, '#1e90ff'); drawTexture(1, 1, '#f4a460'); drawTexture(2, 1, '#6b4226'); drawTexture(3, 1, '#228b22');
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    return {
        terrain: new THREE.MeshLambertMaterial({ map: texture, vertexColors: true }),
        water: new THREE.MeshLambertMaterial({ map: texture, vertexColors: true, transparent: true, opacity: 0.6 })
    };
  }

  createClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random() * 20, 2, 10 + Math.random() * 20), cloudMat);
      mesh.position.set(Math.random() * 400 - 200, 60, Math.random() * 400 - 200);
      this.scene.add(mesh); this.clouds.push(mesh);
    }
  }

  updateClouds(delta: number) {
    this.clouds.forEach(cloud => {
      cloud.position.x += delta * 1.0;
      if (cloud.position.x > 200) cloud.position.x = -200;
    });
  }

  addChunk(x: number, y: number, z: number, blocks: Uint8Array) {
    const key = `${x},${y},${z}`;
    if (this.chunks.has(key)) return;
    this.chunks.set(key, new Chunk(x, y, z, blocks, this.scene, this.material, this.waterMaterial));
  }

  updateBlock(x: number, y: number, z: number, type: number) {
    const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cy},${cz}`);
    if (chunk) {
      chunk.blocks[getBlockIndex(((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE)] = type;
      chunk.generateMesh();
      [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]].forEach(([dx,dy,dz]) => this.chunks.get(`${cx+dx},${cy+dy},${cz+dz}`)?.generateMesh());
    }
  }

  getBlockAt(x: number, y: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cy},${cz}`);
    if (!chunk) return BlockType.AIR;
    return chunk.blocks[getBlockIndex(((Math.floor(x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((Math.floor(y) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((Math.floor(z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE)];
  }

  getMeshObjects() {
    const meshes: THREE.Mesh[] = [];
    this.chunks.forEach(c => {
        if (c.mesh) meshes.push(c.mesh);
        if (c.waterMesh) meshes.push(c.waterMesh);
    });
    return meshes;
  }
}
