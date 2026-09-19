export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type FlyKeys = {
  forward: number;
  right: number;
  up: number;
};

export type Framing = {
  speed: number;
  near: number;
  far: number;
};

const pitchLimit = Math.PI / 2 - 0.01;

export const lookYaw = -0.55;

export function facingDegrees(yaw: number): number {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  return (Math.atan2(forwardX, forwardZ) * 180) / Math.PI;
}

export function headingLabel(yaw: number): string {
  const degrees = facingDegrees(yaw);
  const turned = ((degrees % 360) + 360) % 360;
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const letter = names[Math.round(turned / 45) % 8] ?? "N";
  return `${letter} ${Math.round(turned)}°`;
}

export function clampPitch(pitch: number): number {
  return Math.min(pitchLimit, Math.max(-pitchLimit, pitch));
}

export function frameModel(size: Vec3): Framing {
  const span = Math.hypot(size.x, size.y, size.z);
  const safe = Math.max(span, 0.5);
  return {
    speed: safe * 0.35,
    near: Math.max(safe * 0.001, 0.01),
    far: Math.max(safe * 100, 100),
  };
}

export function stepFly(args: {
  position: Vec3;
  yaw: number;
  keys: FlyKeys;
  speed: number;
  sprint: boolean;
  delta: number;
}): Vec3 {
  const scale = args.speed * (args.sprint ? 4 : 1) * args.delta;
  const forwardX = -Math.sin(args.yaw);
  const forwardZ = -Math.cos(args.yaw);
  const rightX = Math.cos(args.yaw);
  const rightZ = -Math.sin(args.yaw);
  return {
    x:
      args.position.x +
      (forwardX * args.keys.forward + rightX * args.keys.right) * scale,
    y: args.position.y + args.keys.up * scale,
    z:
      args.position.z +
      (forwardZ * args.keys.forward + rightZ * args.keys.right) * scale,
  };
}
