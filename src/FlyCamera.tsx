import { useLayoutEffect, useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { clampPitch, facingDegrees, headingLabel, lookYaw, stepFly, type Framing, type Vec3 } from "./fly.ts";

const lookSpeed = 0.002;
const startPitch = -0.18;

export function FlyCamera({
  center,
  framing,
  frameNonce,
  needle,
  facing,
  onMove,
  onFlying,
}: {
  center: Vec3;
  framing: Framing;
  frameNonce: number;
  needle: RefObject<HTMLElement | null>;
  facing: RefObject<HTMLElement | null>;
  onMove: (x: number, z: number) => void;
  onFlying: (looking: boolean) => void;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(lookYaw);
  const pitch = useRef(startPitch);
  const keys = useRef(new Set<string>());
  const reported = useRef({ x: Number.NaN, z: Number.NaN });

  useLayoutEffect(() => {
    camera.position.set(center.x, center.y, center.z);
    camera.near = framing.near;
    camera.far = framing.far;
    camera.rotation.order = "YXZ";
    camera.rotation.set(startPitch, lookYaw, 0);
    camera.updateProjectionMatrix();
    yaw.current = lookYaw;
    pitch.current = startPitch;
  }, [camera, frameNonce]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLock = () => {
      onFlying(document.pointerLockElement === canvas);
    };
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      document.removeEventListener("pointerlockchange", onLock);
    };
  }, [gl, onFlying]);

  useLayoutEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) {
        return;
      }
      yaw.current -= event.movementX * lookSpeed;
      pitch.current = clampPitch(pitch.current - event.movementY * lookSpeed);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing) {
        return;
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        } else {
          void canvas.requestPointerLock();
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
      }
      keys.current.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    const releaseKeys = () => {
      keys.current.clear();
    };

    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl]);

  useFrame((_, delta) => {
    camera.rotation.order = "YXZ";
    camera.rotation.x = pitch.current;
    camera.rotation.y = yaw.current;
    camera.rotation.z = 0;

    const pressed = keys.current;
    const next = stepFly({
      position: camera.position,
      yaw: yaw.current,
      keys: {
        forward: (pressed.has("KeyW") ? 1 : 0) - (pressed.has("KeyS") ? 1 : 0),
        right: (pressed.has("KeyD") ? 1 : 0) - (pressed.has("KeyA") ? 1 : 0),
        up:
          (pressed.has("Space") ? 1 : 0) -
          (pressed.has("ControlLeft") || pressed.has("ControlRight") ? 1 : 0),
      },
      speed: framing.speed,
      sprint: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
      delta,
    });
    camera.position.set(next.x, next.y, next.z);
  });

  useFrame(() => {
    const degrees = facingDegrees(yaw.current);
    if (needle.current) {
      needle.current.style.transform = `rotate(${degrees}deg)`;
    }
    const label = headingLabel(yaw.current);
    if (facing.current && facing.current.textContent !== label) {
      facing.current.textContent = label;
    }
    const x = camera.position.x;
    const z = camera.position.z;
    if (Math.abs(x - reported.current.x) < 0.05 && Math.abs(z - reported.current.z) < 0.05) {
      return;
    }
    reported.current = { x, z };
    onMove(x, z);
  });

  return null;
}
