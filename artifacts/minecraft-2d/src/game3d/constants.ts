export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WORLD_CHUNKS = 8; // 8x8 chunks = 128x128 blocks
export const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS;
export const SURFACE_Y = 32;
export const RENDER_DISTANCE = 6; // chunks

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const REACH = 5.5;

export const GRAVITY = 28;
export const JUMP_VELOCITY = 9;
export const WALK_SPEED = 4.8;
export const CREATIVE_SPEED = 10;
export const MAX_FALL = 50;

export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COAL: 4,
  IRON: 5,
  GOLD: 6,
  DIAMOND: 7,
  LOG: 8,
  LEAVES: 9,
  SAND: 10,
  GRAVEL: 11,
  GLASS: 12,
  BRICK: 13,
  PLANKS: 14,
  OBSIDIAN: 15,
  SNOW: 16,
  BEDROCK: 17,
  WATER: 18,
  EMERALD: 19,
  REDSTONE: 20,
  CRAFTING: 21,
  CHEST: 22,
  TORCH: 23,
  FLOWER: 24,
  CACTUS: 25,
} as const;

export type BlockId = (typeof BLOCKS)[keyof typeof BLOCKS];

export const TRANSPARENT_BLOCKS: Set<number> = new Set([
  BLOCKS.AIR, BLOCKS.GLASS, BLOCKS.LEAVES, BLOCKS.WATER, BLOCKS.FLOWER, BLOCKS.TORCH,
]);

export const NON_SOLID: Set<number> = new Set([
  BLOCKS.AIR, BLOCKS.WATER, BLOCKS.FLOWER, BLOCKS.TORCH,
]);

export const BLOCK_NAMES: Record<number, string> = {
  0:"Air",1:"Grass",2:"Dirt",3:"Stone",4:"Coal Ore",5:"Iron Ore",
  6:"Gold Ore",7:"Diamond Ore",8:"Wood Log",9:"Leaves",10:"Sand",
  11:"Gravel",12:"Glass",13:"Brick",14:"Planks",15:"Obsidian",
  16:"Snow",17:"Bedrock",18:"Water",19:"Emerald Ore",20:"Redstone Ore",
  21:"Crafting Table",22:"Chest",23:"Torch",24:"Flower",25:"Cactus",
};

// Atlas texture index per face type
export const TEX = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  COAL: 4, IRON: 5, GOLD: 6, DIAMOND: 7,
  LOG_SIDE: 8, LOG_TOP: 9, LEAVES: 10, SAND: 11,
  GRAVEL: 12, GLASS: 13, BRICK: 14, PLANKS: 15,
  OBSIDIAN: 16, SNOW: 17, BEDROCK: 18, WATER: 19,
  EMERALD: 20, REDSTONE: 21, CRAFTING_TOP: 22, CRAFTING_SIDE: 23,
  CHEST_TOP: 24, CHEST_FRONT: 25, CHEST_SIDE: 26,
};

// [top, side, bottom] atlas texture indices for each block type
export const BLOCK_FACES: Record<number, [number, number, number]> = {
  [BLOCKS.GRASS]:    [TEX.GRASS_TOP, TEX.GRASS_SIDE, TEX.DIRT],
  [BLOCKS.DIRT]:     [TEX.DIRT, TEX.DIRT, TEX.DIRT],
  [BLOCKS.STONE]:    [TEX.STONE, TEX.STONE, TEX.STONE],
  [BLOCKS.COAL]:     [TEX.COAL, TEX.COAL, TEX.COAL],
  [BLOCKS.IRON]:     [TEX.IRON, TEX.IRON, TEX.IRON],
  [BLOCKS.GOLD]:     [TEX.GOLD, TEX.GOLD, TEX.GOLD],
  [BLOCKS.DIAMOND]:  [TEX.DIAMOND, TEX.DIAMOND, TEX.DIAMOND],
  [BLOCKS.LOG]:      [TEX.LOG_TOP, TEX.LOG_SIDE, TEX.LOG_TOP],
  [BLOCKS.LEAVES]:   [TEX.LEAVES, TEX.LEAVES, TEX.LEAVES],
  [BLOCKS.SAND]:     [TEX.SAND, TEX.SAND, TEX.SAND],
  [BLOCKS.GRAVEL]:   [TEX.GRAVEL, TEX.GRAVEL, TEX.GRAVEL],
  [BLOCKS.GLASS]:    [TEX.GLASS, TEX.GLASS, TEX.GLASS],
  [BLOCKS.BRICK]:    [TEX.BRICK, TEX.BRICK, TEX.BRICK],
  [BLOCKS.PLANKS]:   [TEX.PLANKS, TEX.PLANKS, TEX.PLANKS],
  [BLOCKS.OBSIDIAN]: [TEX.OBSIDIAN, TEX.OBSIDIAN, TEX.OBSIDIAN],
  [BLOCKS.SNOW]:     [TEX.SNOW, TEX.GRASS_SIDE, TEX.DIRT],
  [BLOCKS.BEDROCK]:  [TEX.BEDROCK, TEX.BEDROCK, TEX.BEDROCK],
  [BLOCKS.WATER]:    [TEX.WATER, TEX.WATER, TEX.WATER],
  [BLOCKS.EMERALD]:  [TEX.EMERALD, TEX.EMERALD, TEX.EMERALD],
  [BLOCKS.REDSTONE]: [TEX.REDSTONE, TEX.REDSTONE, TEX.REDSTONE],
  [BLOCKS.CRAFTING]: [TEX.CRAFTING_TOP, TEX.CRAFTING_SIDE, TEX.PLANKS],
  [BLOCKS.CHEST]:    [TEX.CHEST_TOP, TEX.CHEST_SIDE, TEX.CHEST_TOP],
};

export const ATLAS_SIZE = 256;  // total atlas canvas size
export const TEX_SIZE = 16;     // size of each texture tile
export const ATLAS_COLS = ATLAS_SIZE / TEX_SIZE; // 16

export const DAY_LENGTH = 1200; // seconds for full day cycle
export const SAVE_KEY_3D = "mc3d_save_v1";

export enum GameMode { SURVIVAL = "survival", CREATIVE = "creative" }

export const HOTBAR: BlockId[] = [
  BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.LOG, BLOCKS.PLANKS,
  BLOCKS.GLASS, BLOCKS.BRICK, BLOCKS.SAND, BLOCKS.TORCH, BLOCKS.DIAMOND,
];
