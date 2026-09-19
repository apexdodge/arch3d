import { DoubleSide } from "three";
import {
  ceilingBox,
  featureBoxes,
  floorBox,
  floorPaint,
  grassBox,
  wallBoxes,
  wallPaint,
  type FurnitureKind,
  type House,
  type Side,
} from "./house.ts";

const sides: Side[] = ["north", "south", "east", "west"];

type Part = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

export function HouseView({ house }: { house: House }) {
  const grass = grassBox(house);
  return (
    <>
      <mesh position={grass.position} receiveShadow>
        <boxGeometry args={grass.size} />
        <meshStandardMaterial color={grass.color} />
      </mesh>
      {house.rooms.map((room) => (
        <group key={room.id}>
          <mesh position={floorBox(room).position} receiveShadow>
            <boxGeometry args={floorBox(room).size} />
            <meshStandardMaterial color={floorPaint(room)} roughness={0.86} />
          </mesh>
          <mesh position={ceilingBox(room, house.ceiling).position} receiveShadow>
            <boxGeometry args={ceilingBox(room, house.ceiling).size} />
            <meshStandardMaterial color="#d8d4cc" side={DoubleSide} roughness={0.9} />
          </mesh>
          {sides.map((side) =>
            wallBoxes(house, room, side).map((piece) => (
              <mesh key={piece.key} position={piece.position} castShadow receiveShadow>
                <boxGeometry args={piece.size} />
                <meshStandardMaterial
                  color={wallPaint(house, room, side)}
                  side={DoubleSide}
                  roughness={0.9}
                />
              </mesh>
            )),
          )}
          {sides.map((side) =>
            featureBoxes(house, room, side).map((piece) => (
              <mesh key={piece.key} position={piece.position}>
                <boxGeometry args={piece.size} />
                {piece.role === "glass" ? (
                  <meshStandardMaterial
                    color={piece.color}
                    transparent
                    opacity={0.35}
                    roughness={0.05}
                    side={DoubleSide}
                  />
                ) : (
                  <meshStandardMaterial color={piece.color} roughness={0.7} />
                )}
              </mesh>
            )),
          )}
        </group>
      ))}
      {house.furniture.map((piece) => {
        const y = piece.kind === "ceilingLight" ? house.ceiling - 0.12 : 0;
        return (
          <group
            key={piece.id}
            position={[piece.x, y, piece.z]}
            rotation={[0, (-piece.yaw * Math.PI) / 180, 0]}
          >
            {partsFor(piece.kind).map((part) => (
              <mesh key={part.key} position={part.position} castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial color={part.color} roughness={0.72} />
              </mesh>
            ))}
          </group>
        );
      })}
      {house.furniture.map((piece) => {
        if (piece.kind !== "floorLamp" && piece.kind !== "ceilingLight") {
          return null;
        }
        const y = piece.kind === "ceilingLight" ? house.ceiling - 0.22 : 1.35;
        return (
          <pointLight
            key={`light-${piece.id}`}
            position={[piece.x, y, piece.z]}
            color={piece.kind === "ceilingLight" ? "#fff1d6" : "#ffc98a"}
            intensity={piece.kind === "ceilingLight" ? 18 : 8}
            distance={7}
            decay={2}
          />
        );
      })}
    </>
  );
}

function partsFor(kind: FurnitureKind): Part[] {
  if (kind === "bed") {
    return [
      { key: "frame", position: [0, 0.14, 0], size: [1.96, 0.18, 1.46], color: "#5c4332" },
      { key: "mattress", position: [0, 0.32, -0.02], size: [1.84, 0.2, 1.28], color: "#f3efe6" },
      { key: "head", position: [0, 0.52, 0.68], size: [1.96, 0.72, 0.08], color: "#6b4f3a" },
      { key: "pillow-a", position: [-0.42, 0.48, 0.4], size: [0.55, 0.12, 0.32], color: "#fffaf4" },
      { key: "pillow-b", position: [0.42, 0.48, 0.4], size: [0.55, 0.12, 0.32], color: "#fffaf4" },
    ];
  }
  if (kind === "sofa") {
    return [
      { key: "seat", position: [0, 0.28, -0.06], size: [1.9, 0.28, 0.7], color: "#4a5870" },
      { key: "back", position: [0, 0.52, 0.34], size: [1.9, 0.42, 0.16], color: "#3d4a63" },
      { key: "arm-l", position: [-0.98, 0.4, -0.02], size: [0.14, 0.36, 0.78], color: "#3d4a63" },
      { key: "arm-r", position: [0.98, 0.4, -0.02], size: [0.14, 0.36, 0.78], color: "#3d4a63" },
      { key: "cushion-a", position: [-0.48, 0.46, -0.08], size: [0.84, 0.1, 0.58], color: "#5c6b84" },
      { key: "cushion-b", position: [0.48, 0.46, -0.08], size: [0.84, 0.1, 0.58], color: "#5c6b84" },
    ];
  }
  if (kind === "table") {
    return [
      { key: "top", position: [0, 0.72, 0], size: [1.55, 0.06, 0.86], color: "#a07b52" },
      { key: "leg-a", position: [-0.68, 0.34, -0.32], size: [0.06, 0.68, 0.06], color: "#6b4f3a" },
      { key: "leg-b", position: [0.68, 0.34, -0.32], size: [0.06, 0.68, 0.06], color: "#6b4f3a" },
      { key: "leg-c", position: [-0.68, 0.34, 0.32], size: [0.06, 0.68, 0.06], color: "#6b4f3a" },
      { key: "leg-d", position: [0.68, 0.34, 0.32], size: [0.06, 0.68, 0.06], color: "#6b4f3a" },
    ];
  }
  if (kind === "toilet") {
    return [
      { key: "bowl", position: [0, 0.28, -0.04], size: [0.46, 0.34, 0.56], color: "#f7f8fb" },
      { key: "seat", position: [0, 0.48, -0.06], size: [0.42, 0.06, 0.46], color: "#c5ced8" },
      { key: "tank", position: [0, 0.52, 0.28], size: [0.44, 0.46, 0.2], color: "#e7edf4" },
    ];
  }
  if (kind === "sink") {
    return [
      { key: "stand", position: [0, 0.42, 0.04], size: [0.46, 0.78, 0.38], color: "#b7c0cc" },
      { key: "basin", position: [0, 0.86, -0.04], size: [0.64, 0.12, 0.48], color: "#f7f8fb" },
      { key: "tap", position: [0, 1.08, 0.1], size: [0.08, 0.28, 0.08], color: "#6e7884" },
    ];
  }
  if (kind === "floorLamp") {
    return [
      { key: "base", position: [0, 0.04, 0], size: [0.36, 0.06, 0.36], color: "#2c2824" },
      { key: "pole", position: [0, 0.78, 0], size: [0.08, 1.42, 0.08], color: "#3a342c" },
      { key: "shade", position: [0, 1.56, 0], size: [0.42, 0.28, 0.42], color: "#f6e2b8" },
    ];
  }
  if (kind === "cabinet") {
    return [
      { key: "body", position: [0, 0.42, 0], size: [0.86, 0.78, 0.56], color: "#cbbba4" },
      { key: "top", position: [0, 0.84, 0], size: [0.9, 0.04, 0.6], color: "#e7e2d8" },
      { key: "door", position: [0, 0.4, -0.29], size: [0.7, 0.62, 0.03], color: "#b7a48c" },
    ];
  }
  if (kind === "dresser") {
    return [
      { key: "body", position: [0, 0.36, 0], size: [1.16, 0.68, 0.46], color: "#6d5340" },
      { key: "top", position: [0, 0.74, 0], size: [1.2, 0.05, 0.5], color: "#8a6a45" },
      { key: "drawer", position: [0, 0.5, -0.24], size: [1.02, 0.16, 0.03], color: "#5c4636" },
    ];
  }
  if (kind === "sideTable") {
    return [
      { key: "top", position: [0, 0.5, 0], size: [0.48, 0.04, 0.42], color: "#a07b52" },
      { key: "leg", position: [0, 0.24, 0], size: [0.28, 0.46, 0.28], color: "#6b4f3a" },
    ];
  }
  if (kind === "fridge") {
    return [
      { key: "body", position: [0, 0.88, 0], size: [0.66, 1.7, 0.66], color: "#e6e8ee" },
      { key: "door", position: [0, 0.7, -0.34], size: [0.58, 1.15, 0.03], color: "#f4f6fb" },
      { key: "freezer", position: [0, 1.5, -0.34], size: [0.58, 0.32, 0.03], color: "#dde1ea" },
    ];
  }
  if (kind === "stove") {
    return [
      { key: "body", position: [0, 0.4, 0], size: [0.58, 0.74, 0.56], color: "#3a4046" },
      { key: "top", position: [0, 0.8, 0], size: [0.6, 0.04, 0.6], color: "#2c3338" },
      { key: "door", position: [0, 0.36, -0.29], size: [0.46, 0.5, 0.03], color: "#4a525a" },
    ];
  }
  return [
    { key: "disc", position: [0, 0, 0], size: [0.4, 0.05, 0.4], color: "#f7f1e4" },
    { key: "glow", position: [0, -0.04, 0], size: [0.22, 0.02, 0.22], color: "#fff1d6" },
  ];
}
