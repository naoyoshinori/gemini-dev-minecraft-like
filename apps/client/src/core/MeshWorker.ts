// This script runs in a separate thread.
// We use a simplified version of the logic without THREE.js dependencies if possible, 
// or import only what's needed. For now, we'll send back raw arrays.

const CHUNK_SIZE = 16;

const FACE_CONFIGS = [
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] },
  { dir: [0, 0, 1], corners: [[0, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 1]] },
  { dir: [0, 0, -1], corners: [[1, 1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]] },
];

const BlockType = { AIR: 0, WATER: 5 };

function getBlockIndex(x: number, y: number, z: number) {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

self.onmessage = (e) => {
  const { blocks, x, y, z, isWater, UV_MAP } = e.data;
  
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  const getBlock = (lx: number, ly: number, lz: number) => {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return 0;
    return blocks[getBlockIndex(lx, ly, lz)];
  };

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const type = getBlock(lx, ly, lz);
        if (type === BlockType.AIR) continue;
        const currentIsWater = (type === BlockType.WATER);
        if (isWater !== currentIsWater) continue;

        const uvInfo = UV_MAP[type] || [0, 0];
        const tx = uvInfo[0], ty = uvInfo[1];

        for (const { dir, corners } of FACE_CONFIGS) {
          const nx = lx + dir[0], ny = ly + dir[1], nz = lz + dir[2];
          const neighbor = getBlock(nx, ny, nz);
          
          let shouldRender = false;
          if (neighbor === BlockType.AIR) shouldRender = true;
          else if (!isWater && neighbor === BlockType.WATER) shouldRender = true;

          if (shouldRender) {
            for (let i = 0; i < 4; i++) {
              const corner = corners[i];
              positions.push(lx + corner[0], ly + corner[1], lz + corner[2]);
              normals.push(...dir);
              uvs.push((tx + (i === 0 || i === 1 ? 0 : 1)) * 0.25, 1 - (ty + (i === 1 || i === 3 ? 1 : 0)) * 0.25);
              
              let occ = 0;
              const cx = corner[0] === 0 ? -1 : 1, cy = corner[1] === 0 ? -1 : 1, cz = corner[2] === 0 ? -1 : 1;
              if (dir[0] === 0 && getBlock(lx + cx, ly, lz) !== 0) occ++;
              if (dir[1] === 0 && getBlock(lx, ly + cy, lz) !== 0) occ++;
              if (dir[2] === 0 && getBlock(lx, ly, lz + cz) !== 0) occ++;
              const shade = 1.0 - (occ * 0.15);
              colors.push(shade, shade, shade);
            }
            indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount + 2, vertexCount + 1, vertexCount + 3);
            vertexCount += 4;
          }
        }
      }
    }
  }

  const result = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    isWater,
    chunkX: x, chunkY: y, chunkZ: z
  };

  (self as any).postMessage(result, [
    result.positions.buffer,
    result.normals.buffer,
    result.uvs.buffer,
    result.colors.buffer,
    result.indices.buffer
  ]);
};
