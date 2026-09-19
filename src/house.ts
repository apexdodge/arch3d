export type Side = "north" | "south" | "east" | "west";

export type FloorColor = "oak" | "white" | "sage" | "terracotta" | "cream" | "ink" | "sand";

export type ColorTarget = "floor" | "walls" | Side;

export type Yaw = 0 | 90 | 180 | 270;

export type FurnitureKind =
  | "bed"
  | "sofa"
  | "table"
  | "toilet"
  | "sink"
  | "floorLamp"
  | "ceilingLight"
  | "cabinet"
  | "dresser"
  | "sideTable"
  | "fridge"
  | "stove";

export type Room = {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color?: FloorColor;
  walls?: Partial<Record<Side, FloorColor>>;
};

export type Opening = {
  id: string;
  kind: "door" | "window";
  roomId: string;
  side: Side;
  offset: number;
  width: number;
  height: number;
  sill: number;
};

export type Furniture = {
  id: string;
  kind: FurnitureKind;
  roomId: string;
  x: number;
  z: number;
  yaw: Yaw;
};

export type House = {
  ceiling: number;
  rooms: Room[];
  openings: Opening[];
  furniture: Furniture[];
};

export type WallRef = {
  roomId: string;
  side: Side;
};

export type Edit =
  | {
      kind: "addRoom";
      roomId: string;
      side: Side;
      name: string;
      width?: number;
      depth?: number;
    }
  | {
      kind: "addOpening";
      roomId: string;
      side: Side;
      opening: "door" | "window";
      offset?: number;
      width?: number;
      height?: number;
      sill?: number;
    }
  | { kind: "removeOpening"; roomId: string; side: Side; opening?: "door" | "window" }
  | { kind: "removeRoom"; roomId: string }
  | { kind: "openWall"; roomId: string; side: Side }
  | { kind: "setColor"; roomId: string; color: FloorColor; target: ColorTarget }
  | {
      kind: "placeFurniture";
      roomId: string;
      furniture: FurnitureKind;
      x?: number;
      z?: number;
      yaw?: Yaw;
      against?: Side;
    }
  | {
      kind: "moveFurniture";
      roomId: string;
      furniture: FurnitureKind;
      direction?: Side;
      distance?: number;
      against?: Side;
    }
  | { kind: "removeFurniture"; roomId: string; furniture: FurnitureKind };

export type ApplyResult =
  | { ok: true; house: House; summary: string }
  | { ok: false; message: string };

export type WallBox = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
};

const wallThickness = 0.12;
const defaultDepth = 3;
const doorWidth = 0.9;
const doorHeight = 2.1;
const windowWidth = 1.2;
const windowHeight = 1.1;
const windowSill = 0.9;
const maxRooms = 30;
const maxOpenings = 80;
const maxFurniture = 40;
const roomInset = 0.15;
const epsilon = 1e-4;

type Line = {
  axis: "x" | "z";
  fixed: number;
  start: number;
  length: number;
};

type Interval = {
  start: number;
  end: number;
};

export function starterHouse(): House {
  return {
    ceiling: 2.7,
    rooms: [
      { id: "living", name: "Living", x: 0, z: 0, width: 5, depth: 4, color: "oak" },
      { id: "kitchen", name: "Kitchen", x: 5, z: 0, width: 3, depth: 4, color: "white" },
      { id: "bedroom", name: "Bedroom", x: 0, z: 4, width: 5, depth: 3.5, color: "sage" },
      { id: "bath", name: "Bath", x: 5, z: 4, width: 3, depth: 3.5, color: "terracotta" },
    ],
    openings: [
      door("entry", "living", "south", 5),
      door("door-kitchen", "living", "east", 4),
      door("door-bedroom", "living", "north", 5),
      door("door-bath", "bedroom", "east", 3.5),
      window("win-living", "living", "west", 4),
      window("win-kitchen", "kitchen", "east", 4),
      window("win-bedroom", "bedroom", "north", 5),
      window("win-bath", "bath", "east", 3.5),
    ],
    furniture: [],
  };
}

export function applyEdit(house: House, edit: Edit): ApplyResult {
  if (edit.kind === "addRoom") {
    return addRoom(house, edit);
  }
  if (edit.kind === "addOpening") {
    return addOpening(house, edit);
  }
  if (edit.kind === "removeOpening") {
    return removeOpening(house, edit);
  }
  if (edit.kind === "removeRoom") {
    return removeRoom(house, edit);
  }
  if (edit.kind === "openWall") {
    return openWall(house, edit);
  }
  if (edit.kind === "setColor") {
    return setColor(house, edit);
  }
  if (edit.kind === "placeFurniture") {
    return placeFurniture(house, edit);
  }
  if (edit.kind === "removeFurniture") {
    return removeFurniture(house, edit);
  }
  return moveFurniture(house, edit);
}

export function applyEdits(house: House, edits: Edit[]): ApplyResult {
  let current = house;
  const summaries: string[] = [];
  for (const edit of edits) {
    const result = applyEdit(current, edit);
    if (!result.ok) {
      return result;
    }
    current = result.house;
    summaries.push(result.summary);
  }
  if (summaries.length === 0) {
    return { ok: false, message: "No edits" };
  }
  return { ok: true, house: current, summary: summaries.join(" ") };
}

export const floorPalette: Record<FloorColor, string> = {
  oak: "#b08968",
  white: "#e7e2d8",
  sage: "#9caf98",
  terracotta: "#c4785a",
  cream: "#f3ead7",
  ink: "#2c3338",
  sand: "#d8c3a5",
};

const colorOrder: FloorColor[] = ["oak", "white", "sage", "terracotta", "cream", "ink", "sand"];
const colorList = "oak, white, sage, terracotta, cream, ink, or sand";

export function nextFloorColor(current: FloorColor | undefined): FloorColor {
  const index = current ? colorOrder.indexOf(current) : -1;
  return colorOrder[(index + 1) % colorOrder.length] ?? "oak";
}

export function floorPaint(room: Room): string {
  return room.color ? floorPalette[room.color] : "#6e6a64";
}

export function wallColorName(house: House, room: Room, side: Side): FloorColor | undefined {
  const own = room.walls?.[side];
  if (own) {
    return own;
  }
  const neighbor = adjacentRoom(house, room, side);
  return neighbor?.walls?.[opposite(side)];
}

export function wallPaint(house: House, room: Room, side: Side): string {
  const name = wallColorName(house, room, side);
  return name ? floorPalette[name] : "#d2cdc4";
}

export function roomAt(house: House, x: number, z: number): Room | null {
  for (const room of house.rooms) {
    if (
      x > room.x + roomInset &&
      x < room.x + room.width - roomInset &&
      z > room.z + roomInset &&
      z < room.z + room.depth - roomInset
    ) {
      return room;
    }
  }
  return null;
}

export function resolveRoom(house: House, token: string): Room | undefined {
  const byId = roomById(house, token);
  if (byId) {
    return byId;
  }
  const lower = token.toLowerCase();
  const named = house.rooms.filter((room) => room.name.toLowerCase() === lower);
  return named.length === 1 ? named[0] : undefined;
}

export function openingsOnWall(house: House, wall: WallRef): Opening[] {
  const room = roomById(house, wall.roomId);
  if (!room) {
    return [];
  }
  return openingsOnLine(house, wallLine(room, wall.side));
}

export function sharedNeighbor(house: House, wall: WallRef): Room | null {
  const room = roomById(house, wall.roomId);
  if (!room) {
    return null;
  }
  return adjacentRoom(house, room, wall.side) ?? null;
}

export function longestExteriorSide(house: House, roomId: string, minLength: number): Side | null {
  const room = roomById(house, roomId);
  if (!room) {
    return null;
  }
  const sides: Side[] = ["north", "south", "east", "west"];
  let best: { side: Side; length: number } | null = null;
  for (const side of sides) {
    if (adjacentRoom(house, room, side)) {
      continue;
    }
    const length = wallLine(room, side).length;
    if (length + epsilon < minLength) {
      continue;
    }
    if (!best || length > best.length) {
      best = { side, length };
    }
  }
  return best ? best.side : null;
}

export function wallLength(house: House, wall: WallRef): number | null {
  const room = roomById(house, wall.roomId);
  if (!room) {
    return null;
  }
  return wallLine(room, wall.side).length;
}

export function houseView(house: House): {
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
} {
  let minX = 0;
  let minZ = 0;
  let maxX = 1;
  let maxZ = 1;
  const first = house.rooms[0];
  if (first) {
    minX = first.x;
    minZ = first.z;
    maxX = first.x + first.width;
    maxZ = first.z + first.depth;
  }
  for (const room of house.rooms) {
    minX = Math.min(minX, room.x);
    minZ = Math.min(minZ, room.z);
    maxX = Math.max(maxX, room.x + room.width);
    maxZ = Math.max(maxZ, room.z + room.depth);
  }
  return {
    center: { x: (minX + maxX) / 2, y: 1.6, z: (minZ + maxZ) / 2 },
    size: {
      x: Math.max(maxX - minX, 0.5),
      y: house.ceiling,
      z: Math.max(maxZ - minZ, 0.5),
    },
  };
}

export function floorBox(room: Room): WallBox {
  return {
    key: `floor-${room.id}`,
    position: [room.x + room.width / 2, 0.02, room.z + room.depth / 2],
    size: [room.width, 0.04, room.depth],
  };
}

export function wallBoxes(house: House, room: Room, side: Side): WallBox[] {
  const line = wallLine(room, side);
  const cuts =
    side === "south" || side === "west" ? coveredByOwner(house, room, side) : [];
  const spans = subtract({ start: 0, end: line.length }, cuts);
  const openings = openingsOnLine(house, line);
  const boxes: WallBox[] = [];
  for (const span of spans) {
    boxes.push(...boxesForSpan(room.id, side, line, span, openings, house.ceiling));
  }
  return boxes;
}

export type FeatureBox = WallBox & {
  role: "glass" | "door" | "furniture" | "ceiling" | "grass";
  color: string;
};

export function featureBoxes(house: House, room: Room, side: Side): FeatureBox[] {
  const line = wallLine(room, side);
  const cuts = side === "south" || side === "west" ? coveredByOwner(house, room, side) : [];
  const spans = subtract({ start: 0, end: line.length }, cuts);
  if (spans.length === 0) {
    return [];
  }
  const boxes: FeatureBox[] = [];
  for (const opening of openingsOnLine(house, line)) {
    const visible = spans.some(
      (span) => opening.offset < span.end - 0.01 && opening.offset + opening.width > span.start + 0.01,
    );
    if (!visible) {
      continue;
    }
    if (opening.kind !== "window") {
      continue;
    }
    const pane = box(
      room.id,
      side,
      line,
      opening.offset,
      opening.offset + opening.width,
      opening.sill + 0.04,
      opening.sill + opening.height - 0.04,
    );
    boxes.push({
      ...pane,
      key: `glass-${pane.key}`,
      size: line.axis === "x"
        ? [pane.size[0], pane.size[1], 0.02]
        : [0.02, pane.size[1], pane.size[2]],
      role: "glass",
      color: "#9ec9e8",
    });
  }
  return boxes;
}

export function furnitureBoxes(house: House): FeatureBox[] {
  const boxes: FeatureBox[] = [];
  for (const piece of house.furniture) {
    const room = roomById(house, piece.roomId);
    if (!room) {
      continue;
    }
    const spec = furnitureSpec(piece.kind);
    const y = piece.kind === "ceilingLight" ? house.ceiling - spec.height / 2 - 0.04 : spec.height / 2;
    boxes.push({
      key: piece.id,
      position: [piece.x, y, piece.z],
      size: [spec.along, spec.height, spec.deep],
      role: "furniture",
      color: spec.color,
    });
  }
  return boxes;
}

export function ceilingBox(room: Room, ceiling: number): FeatureBox {
  return {
    key: `ceiling-${room.id}`,
    position: [room.x + room.width / 2, ceiling - 0.03, room.z + room.depth / 2],
    size: [Math.max(room.width - 0.08, 0.2), 0.04, Math.max(room.depth - 0.08, 0.2)],
    role: "ceiling",
    color: "#d8d4cc",
  };
}

export function grassBox(house: House): FeatureBox {
  const view = houseView(house);
  return {
    key: "grass",
    position: [view.center.x, -0.04, view.center.z],
    size: [view.size.x + 8, 0.04, view.size.z + 8],
    role: "grass",
    color: "#3f6b45",
  };
}

function wallList(room: Room): string {
  const walls = room.walls;
  if (!walls) {
    return "";
  }
  const sides: Side[] = ["north", "south", "east", "west"];
  const parts: string[] = [];
  for (const side of sides) {
    const paint = walls[side];
    if (paint) {
      parts.push(`${side}:${paint}`);
    }
  }
  return parts.length > 0 ? ` walls=${parts.join(",")}` : "";
}

export function describeHouse(house: House, selection: WallRef | null): string {
  const rooms = house.rooms.map((room) => {
    const color = room.color ? ` floor=${room.color}` : "";
    const walls = wallList(room);
    return `${room.id} "${room.name}" x=${room.x} z=${room.z} width=${room.width} depth=${room.depth}${color}${walls}`;
  });
  const openings = house.openings.map((opening) => {
    const room = roomById(house, opening.roomId);
    const name = room ? room.name : opening.roomId;
    return `${opening.kind} on ${name} ${opening.side}`;
  });
  const furniture = house.furniture.map((piece) => {
    const room = roomById(house, piece.roomId);
    return `${piece.kind} in ${room ? room.name : piece.roomId} at ${piece.x.toFixed(1)}, ${piece.z.toFixed(1)} yaw=${piece.yaw}`;
  });
  const selected = selection
    ? `Selected wall: ${selection.roomId} ${selection.side}. Use that only when the user says "this wall".`
    : "No wall is selected. Name the room. Do not ask the user to click.";
  return [
    "Rooms:",
    ...rooms,
    "Openings:",
    ...openings,
    "Furniture:",
    ...(furniture.length > 0 ? furniture : ["none"]),
    selected,
    `Colors: ${colorList}.`,
    `Footprints: ${furnitureCatalog()}. Leave a walking gap. Do not cover a door.`,
  ].join("\n");
}

export function parseHouse(value: unknown): House | null {
  if (!isRecord(value)) {
    return null;
  }
  const ceiling = readNumber(value.ceiling);
  if (ceiling === undefined || ceiling < 2 || ceiling > 6) {
    return null;
  }
  if (!Array.isArray(value.rooms) || !Array.isArray(value.openings)) {
    return null;
  }
  const rooms: Room[] = [];
  for (const item of value.rooms) {
    const room = parseRoom(item);
    if (!room) {
      return null;
    }
    rooms.push(room);
  }
  if (rooms.length === 0 || rooms.length > maxRooms) {
    return null;
  }
  const openings: Opening[] = [];
  for (const item of value.openings) {
    const opening = parseOpening(item);
    if (!opening) {
      return null;
    }
    openings.push(opening);
  }
  if (openings.length > maxOpenings) {
    return null;
  }
  const furniture: Furniture[] = [];
  if (Array.isArray(value.furniture)) {
    for (const item of value.furniture) {
      const piece = parseFurniture(item, rooms);
      if (piece) {
        furniture.push(piece);
      }
    }
  }
  if (furniture.length > maxFurniture) {
    return null;
  }
  return { ceiling, rooms, openings, furniture };
}

export function editFromTool(
  house: House,
  name: string,
  args: unknown,
  selection: WallRef | null,
): { ok: true; edit: Edit } | { ok: false; message: string } {
  const record = argsRecord(args);
  if (!record) {
    return { ok: false, message: "The edit was not a valid object" };
  }
  const token = readString(record.roomId) ?? readString(record.room) ?? readString(record.roomName);
  const named = token ? resolveRoom(house, token) : undefined;
  if (token && !named) {
    return { ok: false, message: "That room is not in the house" };
  }
  const room = named ?? (selection ? roomById(house, selection.roomId) : undefined);
  if (!room && name !== "removeRoom") {
    return { ok: false, message: "Name the room" };
  }
  const side = readSide(record.side) ?? selection?.side;
  if (name === "addRoom") {
    const targetSide = side ?? (room ? longestExteriorSide(house, room.id, 1) : null);
    if (!room || !targetSide) {
      return { ok: false, message: "Name the room and which side" };
    }
    const edit: Edit = {
      kind: "addRoom",
      roomId: room.id,
      side: targetSide,
      name: readString(record.name) ?? "Room",
    };
    const width = readNumber(record.width);
    const depth = readNumber(record.depth);
    if (width !== undefined) edit.width = width;
    if (depth !== undefined) edit.depth = depth;
    return { ok: true, edit };
  }
  if (name === "addOpening") {
    const opening = record.opening === "door" || record.opening === "window"
      ? record.opening
      : record.kind === "door" || record.kind === "window"
        ? record.kind
        : undefined;
    if (!opening) {
      return { ok: false, message: "Say whether it is a door or a window" };
    }
    const minLength = opening === "door" ? doorWidth : windowWidth;
    const targetSide = side ?? (room ? longestExteriorSide(house, room.id, minLength) : null);
    if (!room || !targetSide) {
      return { ok: false, message: "Name the room and which wall" };
    }
    const edit: Edit = { kind: "addOpening", roomId: room.id, side: targetSide, opening };
    const offset = readNumber(record.offset);
    const width = readNumber(record.width);
    const height = readNumber(record.height);
    const sill = readNumber(record.sill);
    if (offset !== undefined) edit.offset = offset;
    if (width !== undefined) edit.width = width;
    if (height !== undefined) edit.height = height;
    if (sill !== undefined) edit.sill = sill;
    return { ok: true, edit };
  }
  if (name === "removeOpening") {
    const opening = record.opening === "door" || record.opening === "window" ? record.opening : undefined;
    const targetSide = side ?? (room ? onlyOpeningSide(house, room.id, opening) : null);
    if (!room || !targetSide) {
      return { ok: false, message: "Name the room and which wall" };
    }
    const edit: Edit = { kind: "removeOpening", roomId: room.id, side: targetSide };
    if (opening) {
      edit.opening = opening;
    }
    return { ok: true, edit };
  }
  if (name === "removeRoom") {
    const target = room ?? (readString(record.name) ? resolveRoom(house, readString(record.name) ?? "") : undefined);
    if (!target) {
      return { ok: false, message: "Name the room to remove" };
    }
    return { ok: true, edit: { kind: "removeRoom", roomId: target.id } };
  }
  if (name === "openWall") {
    if (!room || !side) {
      return { ok: false, message: "Name the room and the shared wall" };
    }
    return { ok: true, edit: { kind: "openWall", roomId: room.id, side } };
  }
  if (name === "setColor") {
    const color = readColor(record.color);
    const target = readColorTarget(record.target) ?? readSide(record.side) ?? "floor";
    if (!room || !color) {
      return { ok: false, message: `Name the room and a color: ${colorList}` };
    }
    return { ok: true, edit: { kind: "setColor", roomId: room.id, color, target } };
  }
  if (name === "placeFurniture") {
    const furniture = readFurnitureKind(record.furniture ?? record.kind);
    if (!room || !furniture) {
      return { ok: false, message: "Name the room and the furniture" };
    }
    const edit: Edit = { kind: "placeFurniture", roomId: room.id, furniture };
    const against = readSide(record.against) ?? side;
    const x = readNumber(record.x);
    const z = readNumber(record.z);
    const yaw = readYaw(record.yaw);
    if (against) {
      edit.against = against;
    } else if (x !== undefined && z !== undefined) {
      edit.x = x;
      edit.z = z;
    }
    if (yaw !== undefined) {
      edit.yaw = yaw;
    }
    return { ok: true, edit };
  }
  if (name === "removeFurniture") {
    const furniture = readFurnitureKind(record.furniture ?? record.kind);
    if (!room || !furniture) {
      return { ok: false, message: "Name the room and the furniture" };
    }
    return { ok: true, edit: { kind: "removeFurniture", roomId: room.id, furniture } };
  }
  if (name === "moveFurniture") {
    const furniture = readFurnitureKind(record.furniture ?? record.kind);
    const against = readSide(record.against);
    const direction = against ? readSide(record.direction) : readSide(record.direction) ?? side;
    if (!room || !furniture || (!against && !direction)) {
      return { ok: false, message: "Name the room, the furniture, and a direction or a wall" };
    }
    const edit: Edit = { kind: "moveFurniture", roomId: room.id, furniture };
    if (against) {
      edit.against = against;
    }
    if (direction) {
      edit.direction = direction;
    }
    const distance = readNumber(record.distance) ?? readNumber(record.meters);
    if (distance !== undefined) {
      edit.distance = distance;
    }
    return { ok: true, edit };
  }
  if (name === "dressRoom") {
    return {
      ok: false,
      message: "Place each piece with placeFurniture. Use the room size and footprints. Skip anything that does not fit.",
    };
  }
  return { ok: false, message: "Unknown edit" };
}

export function parseWallRef(value: unknown): WallRef | null {
  if (!isRecord(value)) {
    return null;
  }
  const roomId = readString(value.roomId);
  const side = readSide(value.side);
  if (!roomId || !side) {
    return null;
  }
  return { roomId, side };
}

function addRoom(
  house: House,
  edit: Extract<Edit, { kind: "addRoom" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  if (house.rooms.length >= maxRooms) {
    return { ok: false, message: "The house already has too many rooms" };
  }
  const line = wallLine(room, edit.side);
  const width = edit.width ?? line.length;
  const depth = edit.depth ?? defaultDepth;
  if (!Number.isFinite(width) || width < 1 || width > 20) {
    return { ok: false, message: "Room width must be between 1 and 20 meters" };
  }
  if (!Number.isFinite(depth) || depth < 1 || depth > 20) {
    return { ok: false, message: "Room depth must be between 1 and 20 meters" };
  }
  const name = cleanName(edit.name);
  const placed = placeRoom(room, edit.side, width, depth);
  const next: Room = {
    id: `room-${crypto.randomUUID()}`,
    name,
    x: placed.x,
    z: placed.z,
    width: placed.width,
    depth: placed.depth,
  };
  if (house.rooms.some((existing) => overlaps(existing, next))) {
    return { ok: false, message: "That room would overlap an existing room" };
  }
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      rooms: [...house.rooms, next],
    },
    summary: `Added ${name} on the ${edit.side} wall of ${room.name}, ${round(width)} by ${round(depth)} m.`,
  };
}

function addOpening(
  house: House,
  edit: Extract<Edit, { kind: "addOpening" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  if (house.openings.length >= maxOpenings) {
    return { ok: false, message: "That wall already has too many openings" };
  }
  const line = wallLine(room, edit.side);
  const defaults = edit.opening === "door"
    ? { width: doorWidth, height: doorHeight, sill: 0 }
    : { width: windowWidth, height: windowHeight, sill: windowSill };
  const width = edit.width ?? defaults.width;
  const height = edit.height ?? defaults.height;
  const sill = edit.sill ?? defaults.sill;
  if (!Number.isFinite(width) || width < 0.4 || width > line.length + epsilon) {
    return { ok: false, message: "That opening is wider than the wall" };
  }
  if (!Number.isFinite(height) || height < 0.4 || sill < 0) {
    return { ok: false, message: "That opening size does not work" };
  }
  if (sill + height > house.ceiling - 0.05) {
    return { ok: false, message: "That opening does not fit under the ceiling" };
  }
  const offset = edit.offset ?? (line.length - width) / 2;
  if (!Number.isFinite(offset) || offset < -epsilon || offset + width > line.length + epsilon) {
    return { ok: false, message: "That opening does not fit on the wall" };
  }
  const candidate: Opening = {
    id: `opening-${crypto.randomUUID()}`,
    kind: edit.opening,
    roomId: room.id,
    side: edit.side,
    offset,
    width,
    height,
    sill,
  };
  if (overlapsOpening(house, room, candidate)) {
    return { ok: false, message: "That opening overlaps another opening" };
  }
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      openings: [...house.openings, candidate],
    },
    summary: `Added a ${round(width)} by ${round(height)} m ${edit.opening} on the ${edit.side} wall of ${room.name}.`,
  };
}

function removeOpening(
  house: House,
  edit: Extract<Edit, { kind: "removeOpening" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  const matches = openingsOnLine(house, wallLine(room, edit.side)).filter(
    (opening) => edit.opening === undefined || opening.kind === edit.opening,
  );
  const target = matches[0];
  if (!target || matches.length !== 1) {
    return {
      ok: false,
      message: matches.length === 0
        ? "There is no opening on that wall"
        : "That wall has more than one opening. Name the door or the window.",
    };
  }
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      openings: house.openings.filter((opening) => opening.id !== target.id),
    },
    summary: `Removed the ${target.kind} on the ${edit.side} wall of ${room.name}.`,
  };
}

function removeRoom(
  house: House,
  edit: Extract<Edit, { kind: "removeRoom" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  if (house.rooms.length < 2) {
    return { ok: false, message: "The house needs at least one room" };
  }
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      rooms: house.rooms.filter((item) => item.id !== room.id),
      openings: house.openings.filter((opening) => opening.roomId !== room.id),
      furniture: house.furniture.filter((piece) => piece.roomId !== room.id),
    },
    summary: `Removed ${room.name}.`,
  };
}

function openWall(
  house: House,
  edit: Extract<Edit, { kind: "openWall" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  const other = adjacentRoom(house, room, edit.side);
  if (!other) {
    return { ok: false, message: "That wall is already on the outside" };
  }
  const minX = Math.min(room.x, other.x);
  const minZ = Math.min(room.z, other.z);
  const maxX = Math.max(room.x + room.width, other.x + other.width);
  const maxZ = Math.max(room.z + room.depth, other.z + other.depth);
  const area = (maxX - minX) * (maxZ - minZ);
  const sum = room.width * room.depth + other.width * other.depth;
  if (Math.abs(area - sum) > 0.05) {
    return { ok: false, message: "Those rooms would not make one rectangle" };
  }
  const merged: Room = {
    id: room.id,
    name: room.name,
    x: minX,
    z: minZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
  if (room.color) {
    merged.color = room.color;
  }
  if (room.walls) {
    merged.walls = { ...room.walls };
  }
  const shared = wallLine(room, edit.side);
  const openings: Opening[] = [];
  for (const opening of house.openings) {
    const owner = ownerRoom(opening.roomId, room, other);
    if (!owner) {
      openings.push(opening);
      continue;
    }
    const line = wallLine(owner, opening.side);
    if (sameLine(line, shared)) {
      continue;
    }
    const side = sideOnRoom(merged, line);
    if (!side) {
      continue;
    }
    openings.push({
      ...opening,
      roomId: merged.id,
      side,
      offset: line.start + opening.offset - wallLine(merged, side).start,
    });
  }
  const furniture: Furniture[] = [];
  for (const piece of house.furniture) {
    if (piece.roomId !== room.id && piece.roomId !== other.id) {
      furniture.push(piece);
      continue;
    }
    if (
      piece.x < minX - epsilon ||
      piece.x > maxX + epsilon ||
      piece.z < minZ - epsilon ||
      piece.z > maxZ + epsilon
    ) {
      continue;
    }
    furniture.push({ ...piece, roomId: merged.id });
  }
  return {
    ok: true,
    house: {
      ceiling: house.ceiling,
      rooms: house.rooms.filter((item) => item.id !== room.id && item.id !== other.id).concat(merged),
      openings,
      furniture,
    },
    summary: `Opened the ${edit.side} wall and joined ${room.name} with ${other.name}.`,
  };
}

function setColor(
  house: House,
  edit: Extract<Edit, { kind: "setColor" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  const label = edit.target === "floor"
    ? "floor"
    : edit.target === "walls"
      ? "walls"
      : `${edit.target} wall`;
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      rooms: house.rooms.map((item) => (item.id === room.id ? paintRoom(item, edit) : item)),
    },
    summary: `Set the ${label} in ${room.name} to ${edit.color}.`,
  };
}

function paintRoom(room: Room, edit: Extract<Edit, { kind: "setColor" }>): Room {
  if (edit.target === "floor") {
    return { ...room, color: edit.color };
  }
  if (edit.target === "walls") {
    return {
      ...room,
      walls: { north: edit.color, south: edit.color, east: edit.color, west: edit.color },
    };
  }
  return { ...room, walls: { ...room.walls, [edit.target]: edit.color } };
}

function placeFurniture(
  house: House,
  edit: Extract<Edit, { kind: "placeFurniture" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  if (house.furniture.length >= maxFurniture) {
    return { ok: false, message: "The house already has too much furniture" };
  }
  const spec = furnitureSpec(edit.furniture);
  const posed = poseFurniture(room, edit, spec);
  const refusal = refusePose(house, room, posed, spec, null);
  if (refusal) {
    return { ok: false, message: refusal };
  }
  const where = edit.against ? ` against the ${edit.against} wall` : "";
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      furniture: [
        ...house.furniture,
        {
          id: `furn-${crypto.randomUUID()}`,
          kind: edit.furniture,
          roomId: room.id,
          x: posed.x,
          z: posed.z,
          yaw: posed.yaw,
        },
      ],
    },
    summary: `Placed a ${edit.furniture} in ${room.name}${where}.`,
  };
}

function moveFurniture(
  house: House,
  edit: Extract<Edit, { kind: "moveFurniture" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  const matches = house.furniture.filter(
    (piece) => piece.roomId === room.id && piece.kind === edit.furniture,
  );
  const piece = matches[0];
  if (!piece || matches.length !== 1) {
    return {
      ok: false,
      message: matches.length === 0
        ? `There is no ${edit.furniture} in ${room.name}`
        : `Name which ${edit.furniture} to move`,
    };
  }
  const spec = furnitureSpec(piece.kind);
  let posed = { x: piece.x, z: piece.z, yaw: piece.yaw };
  if (edit.against) {
    posed = againstPose(room, edit.against, spec);
  } else if (edit.direction) {
    const distance = edit.distance ?? 0.5;
    if (!Number.isFinite(distance) || distance <= 0 || distance > 8) {
      return { ok: false, message: "Move it between 0 and 8 meters" };
    }
    posed = {
      x: piece.x + (edit.direction === "east" ? distance : edit.direction === "west" ? -distance : 0),
      z: piece.z + (edit.direction === "north" ? distance : edit.direction === "south" ? -distance : 0),
      yaw: piece.yaw,
    };
  } else {
    return { ok: false, message: "Name a direction or a wall" };
  }
  const refusal = refusePose(house, room, posed, spec, piece.id);
  if (refusal) {
    return { ok: false, message: refusal };
  }
  const where = edit.against ? ` against the ${edit.against} wall` : edit.direction ? ` ${edit.direction}` : "";
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      furniture: house.furniture.map((item) =>
        item.id === piece.id ? { ...item, x: posed.x, z: posed.z, yaw: posed.yaw } : item,
      ),
    },
    summary: `Moved the ${piece.kind}${where} in ${room.name}.`,
  };
}

function removeFurniture(
  house: House,
  edit: Extract<Edit, { kind: "removeFurniture" }>,
): ApplyResult {
  const room = roomById(house, edit.roomId);
  if (!room) {
    return { ok: false, message: "That room is not in the house" };
  }
  const piece = house.furniture.find(
    (item) => item.roomId === room.id && item.kind === edit.furniture,
  );
  if (!piece) {
    return { ok: false, message: `There is no ${edit.furniture} in ${room.name}` };
  }
  return {
    ok: true,
    house: {
      ...cloneHouse(house),
      furniture: house.furniture.filter((item) => item.id !== piece.id),
    },
    summary: `Removed the ${piece.kind} from ${room.name}.`,
  };
}

function placeRoom(
  room: Room,
  side: Side,
  width: number,
  depth: number,
): { x: number; z: number; width: number; depth: number } {
  if (side === "north") {
    return {
      x: room.x + (room.width - width) / 2,
      z: room.z + room.depth,
      width,
      depth,
    };
  }
  if (side === "south") {
    return {
      x: room.x + (room.width - width) / 2,
      z: room.z - depth,
      width,
      depth,
    };
  }
  if (side === "east") {
    return {
      x: room.x + room.width,
      z: room.z + (room.depth - width) / 2,
      width: depth,
      depth: width,
    };
  }
  return {
    x: room.x - depth,
    z: room.z + (room.depth - width) / 2,
    width: depth,
    depth: width,
  };
}

function overlaps(a: Room, b: Room): boolean {
  return (
    a.x + epsilon < b.x + b.width &&
    b.x + epsilon < a.x + a.width &&
    a.z + epsilon < b.z + b.depth &&
    b.z + epsilon < a.z + a.depth
  );
}

function overlapsOpening(house: House, room: Room, candidate: Opening): boolean {
  const line = wallLine(room, candidate.side);
  const start = line.start + candidate.offset;
  const end = start + candidate.width;
  for (const opening of house.openings) {
    const owner = roomById(house, opening.roomId);
    if (!owner) {
      continue;
    }
    const other = wallLine(owner, opening.side);
    if (other.axis !== line.axis || !nearly(other.fixed, line.fixed)) {
      continue;
    }
    const otherStart = other.start + opening.offset;
    const otherEnd = otherStart + opening.width;
    if (start + epsilon < otherEnd && otherStart + epsilon < end) {
      return true;
    }
  }
  return false;
}

function wallLine(room: Room, side: Side): Line {
  if (side === "north") {
    return { axis: "x", fixed: room.z + room.depth, start: room.x, length: room.width };
  }
  if (side === "south") {
    return { axis: "x", fixed: room.z, start: room.x, length: room.width };
  }
  if (side === "east") {
    return { axis: "z", fixed: room.x + room.width, start: room.z, length: room.depth };
  }
  return { axis: "z", fixed: room.x, start: room.z, length: room.depth };
}

function coveredByOwner(house: House, room: Room, side: "south" | "west"): Interval[] {
  const line = wallLine(room, side);
  const ownerSide: Side = side === "south" ? "north" : "east";
  const cuts: Interval[] = [];
  for (const other of house.rooms) {
    if (other.id === room.id) {
      continue;
    }
    const owned = wallLine(other, ownerSide);
    if (owned.axis !== line.axis || !nearly(owned.fixed, line.fixed)) {
      continue;
    }
    const overlapStart = Math.max(line.start, owned.start);
    const overlapEnd = Math.min(line.start + line.length, owned.start + owned.length);
    if (overlapEnd - overlapStart > 0.01) {
      cuts.push({
        start: overlapStart - line.start,
        end: overlapEnd - line.start,
      });
    }
  }
  return cuts;
}

function openingsOnLine(
  house: House,
  line: Line,
): Array<Opening & { offset: number }> {
  const found: Array<Opening & { offset: number }> = [];
  for (const opening of house.openings) {
    const owner = roomById(house, opening.roomId);
    if (!owner) {
      continue;
    }
    const other = wallLine(owner, opening.side);
    if (other.axis !== line.axis || !nearly(other.fixed, line.fixed)) {
      continue;
    }
    const openingStart = other.start + opening.offset;
    const openingEnd = openingStart + opening.width;
    if (openingEnd < line.start + epsilon || openingStart > line.start + line.length - epsilon) {
      continue;
    }
    found.push({ ...opening, offset: openingStart - line.start });
  }
  return found;
}

function boxesForSpan(
  roomId: string,
  side: Side,
  line: Line,
  span: Interval,
  openings: Array<Opening & { offset: number }>,
  ceiling: number,
): WallBox[] {
  const relevant = openings
    .map((opening) => ({
      opening,
      start: Math.max(opening.offset, span.start),
      end: Math.min(opening.offset + opening.width, span.end),
    }))
    .filter((item) => item.end - item.start > 0.01)
    .sort((a, b) => a.start - b.start);
  const boxes: WallBox[] = [];
  let cursor = span.start;
  for (const item of relevant) {
    if (item.start > cursor + 0.01) {
      boxes.push(box(roomId, side, line, cursor, item.start, 0, ceiling));
    }
    const head = item.opening.sill + item.opening.height;
    if (item.opening.sill > 0.02) {
      boxes.push(box(roomId, side, line, item.start, item.end, 0, item.opening.sill));
    }
    if (ceiling - head > 0.02) {
      boxes.push(box(roomId, side, line, item.start, item.end, head, ceiling));
    }
    cursor = Math.max(cursor, item.end);
  }
  if (span.end > cursor + 0.01) {
    boxes.push(box(roomId, side, line, cursor, span.end, 0, ceiling));
  }
  return boxes;
}

function box(
  roomId: string,
  side: Side,
  line: Line,
  start: number,
  end: number,
  y0: number,
  y1: number,
): WallBox {
  const along = line.start + (start + end) / 2;
  const height = y1 - y0;
  const y = (y0 + y1) / 2;
  const span = end - start;
  if (line.axis === "x") {
    return {
      key: `${roomId}-${side}-${start.toFixed(3)}-${end.toFixed(3)}-${y0.toFixed(3)}`,
      position: [along, y, line.fixed],
      size: [span, height, wallThickness],
    };
  }
  return {
    key: `${roomId}-${side}-${start.toFixed(3)}-${end.toFixed(3)}-${y0.toFixed(3)}`,
    position: [line.fixed, y, along],
    size: [wallThickness, height, span],
  };
}

function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let parts = [base];
  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const part of parts) {
      if (cut.end <= part.start + epsilon || cut.start >= part.end - epsilon) {
        next.push(part);
        continue;
      }
      if (cut.start > part.start + epsilon) {
        next.push({ start: part.start, end: cut.start });
      }
      if (cut.end < part.end - epsilon) {
        next.push({ start: cut.end, end: part.end });
      }
    }
    parts = next;
  }
  return parts.filter((part) => part.end - part.start > 0.01);
}

function door(id: string, roomId: string, side: Side, wall: number): Opening {
  return {
    id,
    kind: "door",
    roomId,
    side,
    offset: (wall - doorWidth) / 2,
    width: doorWidth,
    height: doorHeight,
    sill: 0,
  };
}

function window(id: string, roomId: string, side: Side, wall: number): Opening {
  return {
    id,
    kind: "window",
    roomId,
    side,
    offset: (wall - windowWidth) / 2,
    width: windowWidth,
    height: windowHeight,
    sill: windowSill,
  };
}

function roomById(house: House, id: string): Room | undefined {
  return house.rooms.find((room) => room.id === id);
}

function cloneHouse(house: House): House {
  return structuredClone(house);
}

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, 40);
  return trimmed.length > 0 ? trimmed : "Room";
}

function nearly(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function round(value: number): string {
  return value.toFixed(1);
}

function parseRoom(value: unknown): Room | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readString(value.id);
  const name = readString(value.name);
  const x = readNumber(value.x);
  const z = readNumber(value.z);
  const width = readNumber(value.width);
  const depth = readNumber(value.depth);
  if (!id || !name || x === undefined || z === undefined || width === undefined || depth === undefined) {
    return null;
  }
  if (width <= 0 || depth <= 0 || width > 40 || depth > 40) {
    return null;
  }
  const room: Room = { id, name: name.slice(0, 40), x, z, width, depth };
  const color = readColor(value.color);
  if (color) {
    room.color = color;
  }
  const walls = parseWalls(value.walls);
  if (walls) {
    room.walls = walls;
  }
  return room;
}

function parseOpening(value: unknown): Opening | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readString(value.id);
  const roomId = readString(value.roomId);
  const side = readSide(value.side);
  const kind = value.kind === "door" || value.kind === "window" ? value.kind : undefined;
  const offset = readNumber(value.offset);
  const width = readNumber(value.width);
  const height = readNumber(value.height);
  const sill = readNumber(value.sill);
  if (!id || !roomId || !side || !kind || offset === undefined || width === undefined || height === undefined || sill === undefined) {
    return null;
  }
  if (width <= 0 || height <= 0 || sill < 0) {
    return null;
  }
  return { id, kind, roomId, side, offset, width, height, sill };
}

function argsRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return argsRecord(parsed);
    } catch {
      return null;
    }
  }
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function readSide(value: unknown): Side | undefined {
  if (value === "north" || value === "south" || value === "east" || value === "west") {
    return value;
  }
  return undefined;
}

function readColor(value: unknown): FloorColor | undefined {
  if (
    value === "oak" ||
    value === "white" ||
    value === "sage" ||
    value === "terracotta" ||
    value === "cream" ||
    value === "ink" ||
    value === "sand"
  ) {
    return value;
  }
  return undefined;
}

function readColorTarget(value: unknown): ColorTarget | undefined {
  if (value === "all" || value === "wall" || value === "walls") {
    return "walls";
  }
  if (value === "floor" || value === "north" || value === "south" || value === "east" || value === "west") {
    return value;
  }
  return undefined;
}

function readYaw(value: unknown): Yaw | undefined {
  if (value === 0 || value === 90 || value === 180 || value === 270) {
    return value;
  }
  return undefined;
}

function readFurnitureKind(value: unknown): FurnitureKind | undefined {
  if (
    value === "bed" ||
    value === "sofa" ||
    value === "table" ||
    value === "toilet" ||
    value === "sink" ||
    value === "floorLamp" ||
    value === "ceilingLight" ||
    value === "cabinet" ||
    value === "dresser" ||
    value === "sideTable" ||
    value === "fridge" ||
    value === "stove"
  ) {
    return value;
  }
  if (value === "floor lamp" || value === "lamp" || value === "floor_lamp") return "floorLamp";
  if (value === "ceiling light" || value === "light") return "ceilingLight";
  if (value === "side table" || value === "nightstand") return "sideTable";
  if (value === "refrigerator") return "fridge";
  return undefined;
}

function parseWalls(value: unknown): Partial<Record<Side, FloorColor>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const walls: Partial<Record<Side, FloorColor>> = {};
  const sides: Side[] = ["north", "south", "east", "west"];
  for (const side of sides) {
    const color = readColor(value[side]);
    if (color) {
      walls[side] = color;
    }
  }
  return Object.keys(walls).length > 0 ? walls : undefined;
}

function parseFurniture(value: unknown, rooms: Room[]): Furniture | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readString(value.id);
  const roomId = readString(value.roomId);
  const kind = readFurnitureKind(value.kind);
  if (!id || !roomId || !kind) {
    return null;
  }
  const x = readNumber(value.x);
  const z = readNumber(value.z);
  if (x !== undefined && z !== undefined) {
    return { id, kind, roomId, x, z, yaw: readYaw(value.yaw) ?? 0 };
  }
  const side = readSide(value.side);
  const offset = readNumber(value.offset);
  const room = rooms.find((item) => item.id === roomId);
  if (!side || offset === undefined || !room) {
    return null;
  }
  const spot = pieceFromWall(room, kind, side, offset);
  const yaw = yawAgainst(side);
  return { id, kind, roomId, x: spot.x, z: spot.z, yaw };
}

function onlyOpeningSide(
  house: House,
  roomId: string,
  kind: "door" | "window" | undefined,
): Side | null {
  const sides = new Set<Side>();
  for (const opening of house.openings) {
    if (opening.roomId !== roomId) {
      continue;
    }
    if (kind && opening.kind !== kind) {
      continue;
    }
    sides.add(opening.side);
  }
  if (sides.size !== 1) {
    return null;
  }
  return [...sides][0];
}

function ownerRoom(id: string, room: Room, other: Room): Room | null {
  if (id === room.id) {
    return room;
  }
  if (id === other.id) {
    return other;
  }
  return null;
}

function adjacentRoom(house: House, room: Room, side: Side): Room | undefined {
  const line = wallLine(room, side);
  const otherSide = opposite(side);
  for (const other of house.rooms) {
    if (other.id === room.id) {
      continue;
    }
    const owned = wallLine(other, otherSide);
    if (!sameLine(line, owned)) {
      continue;
    }
    const overlapStart = Math.max(line.start, owned.start);
    const overlapEnd = Math.min(line.start + line.length, owned.start + owned.length);
    if (overlapEnd - overlapStart > 0.05) {
      return other;
    }
  }
  return undefined;
}

function opposite(side: Side): Side {
  if (side === "north") return "south";
  if (side === "south") return "north";
  if (side === "east") return "west";
  return "east";
}

function sameLine(a: Line, b: Line): boolean {
  return a.axis === b.axis && nearly(a.fixed, b.fixed);
}

function sideOnRoom(room: Room, line: Line): Side | null {
  if (line.axis === "x" && nearly(line.fixed, room.z)) return "south";
  if (line.axis === "x" && nearly(line.fixed, room.z + room.depth)) return "north";
  if (line.axis === "z" && nearly(line.fixed, room.x)) return "west";
  if (line.axis === "z" && nearly(line.fixed, room.x + room.width)) return "east";
  return null;
}

function inward(side: Side): { x: number; z: number } {
  if (side === "north") return { x: 0, z: -1 };
  if (side === "south") return { x: 0, z: 1 };
  if (side === "east") return { x: -1, z: 0 };
  return { x: 1, z: 0 };
}

function furnitureSpec(kind: FurnitureKind): {
  along: number;
  deep: number;
  height: number;
  color: string;
} {
  if (kind === "bed") return { along: 2, deep: 1.5, height: 0.55, color: "#6b4f3a" };
  if (kind === "sofa") return { along: 2.1, deep: 0.9, height: 0.8, color: "#3d4a63" };
  if (kind === "table") return { along: 1.6, deep: 0.9, height: 0.75, color: "#8a6a45" };
  if (kind === "toilet") return { along: 0.5, deep: 0.85, height: 0.8, color: "#f2f4f8" };
  if (kind === "sink") return { along: 0.7, deep: 0.55, height: 1.05, color: "#d5dae3" };
  if (kind === "floorLamp") return { along: 0.46, deep: 0.46, height: 1.7, color: "#c9b79a" };
  if (kind === "cabinet") return { along: 0.9, deep: 0.6, height: 0.9, color: "#cbbba4" };
  if (kind === "dresser") return { along: 1.2, deep: 0.5, height: 0.8, color: "#6d5340" };
  if (kind === "sideTable") return { along: 0.5, deep: 0.45, height: 0.55, color: "#8a6a45" };
  if (kind === "fridge") return { along: 0.7, deep: 0.7, height: 1.8, color: "#e6e8ee" };
  if (kind === "stove") return { along: 0.6, deep: 0.6, height: 0.9, color: "#3a4046" };
  return { along: 0.42, deep: 0.42, height: 0.06, color: "#f7f1e4" };
}

function furnitureCatalog(): string {
  const kinds: FurnitureKind[] = [
    "bed",
    "sofa",
    "table",
    "toilet",
    "sink",
    "floorLamp",
    "ceilingLight",
    "cabinet",
    "dresser",
    "sideTable",
    "fridge",
    "stove",
  ];
  return kinds
    .map((kind) => {
      const spec = furnitureSpec(kind);
      return `${kind} ${spec.along} by ${spec.deep} m`;
    })
    .join(", ");
}

function yawAgainst(side: Side): Yaw {
  if (side === "north") return 0;
  if (side === "south") return 180;
  if (side === "west") return 90;
  return 270;
}

function halves(spec: { along: number; deep: number }, yaw: Yaw): { halfX: number; halfZ: number } {
  if (yaw === 90 || yaw === 270) {
    return { halfX: spec.deep / 2, halfZ: spec.along / 2 };
  }
  return { halfX: spec.along / 2, halfZ: spec.deep / 2 };
}

function againstPose(
  room: Room,
  side: Side,
  spec: { along: number; deep: number },
): { x: number; z: number; yaw: Yaw } {
  const yaw = yawAgainst(side);
  const margin = 0.2;
  const halfDeep = spec.deep / 2;
  const x = room.x + room.width / 2;
  const z = room.z + room.depth / 2;
  if (side === "north") return { x, z: room.z + room.depth - halfDeep - margin, yaw };
  if (side === "south") return { x, z: room.z + halfDeep + margin, yaw };
  if (side === "west") return { x: room.x + halfDeep + margin, z, yaw };
  return { x: room.x + room.width - halfDeep - margin, z, yaw };
}

function suggestSpot(room: Room, kind: FurnitureKind): { x: number; z: number; yaw: Yaw } {
  const spec = furnitureSpec(kind);
  if (kind === "table" || kind === "ceilingLight") {
    return { x: room.x + room.width / 2, z: room.z + room.depth / 2, yaw: 0 };
  }
  if (kind === "floorLamp" || kind === "sideTable") {
    return { x: room.x + 0.55, z: room.z + 0.55, yaw: 0 };
  }
  if (kind === "bed") return againstPose(room, "north", spec);
  if (kind === "sofa") return againstPose(room, room.width >= room.depth ? "north" : "east", spec);
  if (kind === "toilet") return againstPose(room, "south", spec);
  if (kind === "fridge" || kind === "stove" || kind === "cabinet") return againstPose(room, "east", spec);
  if (kind === "dresser") return againstPose(room, "west", spec);
  return againstPose(room, "east", spec);
}

function poseFurniture(
  room: Room,
  edit: Extract<Edit, { kind: "placeFurniture" }>,
  spec: { along: number; deep: number },
): { x: number; z: number; yaw: Yaw } {
  if (edit.against) {
    const posed = againstPose(room, edit.against, spec);
    return edit.yaw !== undefined ? { ...posed, yaw: edit.yaw } : posed;
  }
  if (edit.x !== undefined && edit.z !== undefined) {
    const point = inRoomOrLocal(room, edit.x, edit.z);
    return { x: point.x, z: point.z, yaw: edit.yaw ?? 0 };
  }
  const suggested = suggestSpot(room, edit.furniture);
  return edit.yaw !== undefined ? { ...suggested, yaw: edit.yaw } : suggested;
}

function openMeters(house: House, room: Room): string {
  let used = 0;
  for (const piece of house.furniture) {
    if (piece.roomId !== room.id) {
      continue;
    }
    const box = halves(furnitureSpec(piece.kind), piece.yaw);
    used += box.halfX * 2 * box.halfZ * 2;
  }
  return Math.max(0, room.width * room.depth - used).toFixed(1);
}

function refusePose(
  house: House,
  room: Room,
  posed: { x: number; z: number; yaw: Yaw },
  spec: { along: number; deep: number },
  ignoreId: string | null,
): string | null {
  const box = halves(spec, posed.yaw);
  const inside =
    posed.x - box.halfX >= room.x + 0.02 &&
    posed.x + box.halfX <= room.x + room.width - 0.02 &&
    posed.z - box.halfZ >= room.z + 0.02 &&
    posed.z + box.halfZ <= room.z + room.depth - 0.02;
  if (!inside) {
    return `That does not fit in the room. About ${openMeters(house, room)} m² is still open.`;
  }
  for (const piece of house.furniture) {
    if (piece.roomId !== room.id || piece.id === ignoreId) {
      continue;
    }
    const other = halves(furnitureSpec(piece.kind), piece.yaw);
    const gap = 0.05;
    if (
      Math.abs(posed.x - piece.x) < box.halfX + other.halfX + gap &&
      Math.abs(posed.z - piece.z) < box.halfZ + other.halfZ + gap
    ) {
      return `That overlaps another piece. About ${openMeters(house, room)} m² is still open.`;
    }
  }
  return null;
}
function pieceFromWall(
  room: Room,
  kind: FurnitureKind,
  side: Side,
  offset: number,
): { x: number; z: number } {
  const spec = furnitureSpec(kind);
  const line = wallLine(room, side);
  const along = line.start + offset + spec.along / 2;
  const inset = spec.deep / 2 + 0.2;
  const into = inward(side);
  return {
    x: line.axis === "z" ? line.fixed + into.x * inset : along,
    z: line.axis === "x" ? line.fixed + into.z * inset : along,
  };
}

function inRoomOrLocal(room: Room, x: number, z: number): { x: number; z: number } {
  if (containsPoint(room, x, z)) {
    return { x, z };
  }
  const local = { x: room.x + x, z: room.z + z };
  if (containsPoint(room, local.x, local.z)) {
    return local;
  }
  return { x, z };
}

function containsPoint(room: Room, x: number, z: number): boolean {
  return (
    x >= room.x - epsilon &&
    x <= room.x + room.width + epsilon &&
    z >= room.z - epsilon &&
    z <= room.z + room.depth + epsilon
  );
}
