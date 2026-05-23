import * as THREE from "three";
import { BLOCKS, BLOCK_FACES, CHUNK_HEIGHT, CHUNK_SIZE, TRANSPARENT_BLOCKS } from "./constants";
import { WorldChunks, getBlock } from "./worldGen";
import { getAtlasTexture, getUV } from "./textureAtlas";

// Face definitions: 4 vertex offsets, normal, faceType (0=top,1=side,2=bottom)
type FaceDef = { verts: number[][]; normal: number[]; faceType: 0 | 1 | 2 };

const FACE_DEFS: FaceDef[] = [
  // Top (y+1)   — brightest
  { verts: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], normal:[0,1,0],  faceType:0 },
  // Bottom (y)  — darkest
  { verts: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], normal:[0,-1,0], faceType:2 },
  // North (z+1) — medium-light
  { verts: [[1,0,1],[0,0,1],[0,1,1],[1,1,1]], normal:[0,0,1],  faceType:1 },
  // South (z)   — medium-light
  { verts: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], normal:[0,0,-1], faceType:1 },
  // East  (x+1) — medium-dark
  { verts: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], normal:[1,0,0],  faceType:1 },
  // West  (x)   — medium-dark
  { verts: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]], normal:[-1,0,0], faceType:1 },
];

// Minecraft-style directional shading: top bright, sides medium, bottom dark
// East/West slightly darker than North/South for extra depth
const FACE_SHADE = [1.0, 0.45, 0.84, 0.84, 0.68, 0.68];

const NEIGHBOR_OFFSETS = [
  [0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,0,0],[-1,0,0]
];

export interface ChunkMeshes {
  opaque: THREE.Mesh;
  transparent: THREE.Mesh;
}

function buildGeometry(
  world: WorldChunks,
  cx: number,
  cz: number,
  isTransparent: boolean
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals:   number[] = [];
  const uvs:       number[] = [];
  const colors:    number[] = [];   // vertex colors for face shading
  const indices:   number[] = [];

  const wx0 = cx * CHUNK_SIZE, wz0 = cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = wx0 + lx, wz = wz0 + lz, wy = ly;
        const block = getBlock(world, wx, wy, wz);
        if (block === BLOCKS.AIR) continue;
        const isT = TRANSPARENT_BLOCKS.has(block);
        if (isT !== isTransparent) continue;

        const faces = BLOCK_FACES[block];
        if (!faces) continue;

        for (let fi = 0; fi < 6; fi++) {
          const [no, ne, nf] = NEIGHBOR_OFFSETS[fi];
          const nb = getBlock(world, wx + no, wy + ne, wz + nf);
          const nbTransparent = TRANSPARENT_BLOCKS.has(nb);
          if (!nbTransparent) continue;
          if (block === BLOCKS.WATER  && nb === BLOCKS.WATER)  continue;
          if (block === BLOCKS.LEAVES && nb === BLOCKS.LEAVES) continue;

          const face = FACE_DEFS[fi];
          const [u0, v0, u1, v1] = getUV(faces[face.faceType]);
          const shade = FACE_SHADE[fi];

          const baseIdx = positions.length / 3;
          for (const [dx, dy, dz] of face.verts) {
            positions.push(wx + dx, wy + dy, wz + dz);
            normals.push(...face.normal);
            colors.push(shade, shade, shade);   // R G B per vertex
          }
          uvs.push(u0, v1,  u1, v1,  u1, v0,  u0, v0);
          indices.push(
            baseIdx, baseIdx + 1, baseIdx + 2,
            baseIdx, baseIdx + 2, baseIdx + 3,
          );
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal",   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv",       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

let opaqueMat: THREE.MeshLambertMaterial | null = null;
let transparentMat: THREE.MeshLambertMaterial | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => { opaqueMat = null; transparentMat = null; });
}

function getOpaqueMat(): THREE.MeshLambertMaterial {
  if (!opaqueMat) {
    opaqueMat = new THREE.MeshLambertMaterial({
      map: getAtlasTexture(),
      vertexColors: true,   // multiply texture by per-face shade
    });
  }
  return opaqueMat;
}

function getTransparentMat(): THREE.MeshLambertMaterial {
  if (!transparentMat) {
    transparentMat = new THREE.MeshLambertMaterial({
      map: getAtlasTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      alphaTest: 0.1,
    });
  }
  return transparentMat;
}

export function buildChunkMeshes(
  world: WorldChunks,
  cx: number,
  cz: number,
): ChunkMeshes {
  return {
    opaque:      new THREE.Mesh(buildGeometry(world, cx, cz, false), getOpaqueMat()),
    transparent: new THREE.Mesh(buildGeometry(world, cx, cz, true),  getTransparentMat()),
  };
}

export function disposeChunkMeshes(meshes: ChunkMeshes) {
  meshes.opaque.geometry.dispose();
  meshes.transparent.geometry.dispose();
}
