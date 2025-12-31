import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMousePosition } from '../../hooks/useMousePosition';

/**
 * Profile image with subtle 3D tilt effect on hover
 */
function ProfileImage({ mousePosition, isHovering }) {
  const meshRef = useRef();
  const texture = useTexture('/frederick.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  const targetRotation = useRef({ x: 0, y: 0 });

  useFrame(() => {
    if (!meshRef.current) return;

    // Calculate target rotation (subtle tilt)
    if (isHovering) {
      targetRotation.current.x = -mousePosition.y * 0.15;  // Tilt up/down
      targetRotation.current.y = mousePosition.x * 0.15;  // Tilt left/right
    } else {
      targetRotation.current.x = 0;
      targetRotation.current.y = 0;
    }

    // Smooth interpolation
    meshRef.current.rotation.x += (targetRotation.current.x - meshRef.current.rotation.x) * 0.1;
    meshRef.current.rotation.y += (targetRotation.current.y - meshRef.current.rotation.y) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[1.8, 64]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Interactive 3D profile picture with tilt effect on hover
 */
export default function Interactive3DProfile({ className = '' }) {
  const containerRef = useRef();
  const { position, isHovering } = useMousePosition(containerRef);

  return (
    <div
      ref={containerRef}
      className={`w-64 h-64 rounded-full overflow-hidden ${className}`}
      role="img"
      aria-label="Frederick Wang"
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }}
        flat
      >
        <Suspense fallback={null}>
          <ProfileImage mousePosition={position} isHovering={isHovering} />
        </Suspense>
      </Canvas>
    </div>
  );
}
