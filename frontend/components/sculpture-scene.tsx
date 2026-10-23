"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  Sparkles,
  PerformanceMonitor,
} from "@react-three/drei";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
} from "@react-three/postprocessing";
import { MathUtils, type Group } from "three";
import { MaskFunction } from "postprocessing";

function Ribbon({ spin }: { spin: number }) {
  const group = useRef<Group>(null);
  useFrame(({ clock, pointer, camera }, delta) => {
    if (!group.current) return;
    group.current.rotation.y = MathUtils.damp(
      group.current.rotation.y,
      spin * Math.PI + pointer.x * 0.4,
      3,
      delta,
    );
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.12 - 0.25;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.65) * 0.1;
    camera.position.x = MathUtils.damp(
      camera.position.x,
      pointer.x * 0.4,
      2,
      delta,
    );
    camera.lookAt(0, 0, 0);
  });
  return (
    <group ref={group}>
      <group rotation={[0.12, 0.15, 0]}>
        {Array.from({ length: 8 }, (_, index) => (
          <group key={index} rotation={[0, 0, (index * Math.PI) / 4]}>
            <mesh castShadow position={[0, 0.62, 0]} scale={[0.23, 0.47, 0.15]}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshPhysicalMaterial
                color="#c56b3f"
                metalness={0.9}
                roughness={0.24}
                clearcoat={1}
                clearcoatRoughness={0.12}
              />
            </mesh>
          </group>
        ))}
      </group>
      <Sparkles count={12} size={2} scale={3.8} speed={0.15} color="#e4c08c" />
    </group>
  );
}

export default function SculptureScene({ spin }: { spin: number }) {
  const [dpr, setDpr] = useState(1.25);
  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: [0, 0.2, 5.8], fov: 37 }}
      gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(1.5)}
        flipflops={2}
        onFallback={() => setDpr(1)}
      />
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight
          castShadow
          position={[3, 5, 4]}
          intensity={3}
          shadow-mapSize={[512, 512]}
        />
        <Ribbon spin={spin} />
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={4} position={[-3, 3, 3]} scale={[5, 5, 1]} />
          <Lightformer
            intensity={3}
            position={[3, 0, 1]}
            scale={[2, 5, 1]}
            color="#f4d2b3"
          />
          <Lightformer intensity={2} position={[0, -3, 2]} scale={4} />
        </Environment>
        <ContactShadows
          position={[0, -1.6, 0]}
          opacity={0.12}
          blur={3.5}
          scale={4}
          far={2.5}
          color="#7b674d"
          resolution={128}
        />
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1.5} intensity={0.15} mipmapBlur />
          <DepthOfField
            ref={(effect) => {
              if (effect) effect.maskFunction = MaskFunction.MULTIPLY_RGB;
            }}
            focusDistance={0.025}
            focalLength={0.1}
            bokehScale={0.5}
            height={240}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
