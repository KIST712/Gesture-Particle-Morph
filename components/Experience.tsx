import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GestureType, HandState } from '../types';
import { generateTextParticles, generateCloudParticles } from '../utils/particleUtils';

// Bypass TS errors for R3F elements by using any-typed constants
const InstancedMesh: any = 'instancedMesh';
const SphereGeometry: any = 'sphereGeometry';
const MeshStandardMaterial: any = 'meshStandardMaterial';
const Points: any = 'points';
const BufferGeometry: any = 'bufferGeometry';
const BufferAttribute: any = 'bufferAttribute';
const ShaderMaterial: any = 'shaderMaterial';
const Group: any = 'group';
const AmbientLight: any = 'ambientLight';
const PointLight: any = 'pointLight';

const PARTICLE_COUNT = 3000;
const MORPH_SPEED = 0.1;

// --- Shaders ---
const vertexShader = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 2.0);
    gl_FragColor = vec4(vColor, glow);
  }
`;

// --- Celebration Assets ---

const BalloonInstances: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 150;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Create randomized balloon data
  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      // Start spread out horizontally, but all below screen
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 40,
        -20 - Math.random() * 30, 
        (Math.random() - 0.5) * 20
      ),
      // Speed is fast for "instant" feel
      speed: 0.2 + Math.random() * 0.3, 
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random(),
      // Vibrant colors (Red, Pink, Purple, Gold)
      color: new THREE.Color().setHSL(Math.random() * 0.1 + (Math.random() > 0.5 ? 0 : 0.9), 0.9, 0.6)
    }));
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    
    data.forEach((d, i) => {
      d.position.y += d.speed;
      
      // Reset logic to keep the celebration going
      if (d.position.y > 25) {
         d.position.y = -20 - Math.random() * 10;
         d.position.x = (Math.random() - 0.5) * 40;
      }

      const x = d.position.x + Math.sin(time * d.wobbleSpeed + d.wobbleOffset) * 0.5;
      
      dummy.position.set(x, d.position.y, d.position.z);
      // Scale balloons for 3D effect
      dummy.scale.setScalar(0.7);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, d.color);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <InstancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <SphereGeometry args={[1, 16, 16]} />
      <MeshStandardMaterial roughness={0.2} metalness={0.5} />
    </InstancedMesh>
  );
};

// --- Particles Component ---

const Particles: React.FC<{ handState: HandState }> = ({ handState }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Pre-calculate targets for instant switching
  const targets = useMemo(() => {
    return {
      [GestureType.RESET]: generateCloudParticles(PARTICLE_COUNT),
      [GestureType.ONE]: generateTextParticles("1", PARTICLE_COUNT),
      [GestureType.TWO]: generateTextParticles("2", PARTICLE_COUNT),
      [GestureType.THREE]: generateTextParticles("3", PARTICLE_COUNT),
      [GestureType.LOVE]: generateTextParticles("I ❤️ U", PARTICLE_COUNT),
    };
  }, []);

  const { initialPositions, initialColors } = useMemo(() => ({
    initialPositions: targets[GestureType.RESET].positions,
    initialColors: targets[GestureType.RESET].colors
  }), [targets]);

  const currentPositions = useRef(initialPositions.slice());
  const currentColors = useRef(initialColors.slice());

  useFrame((state) => {
    if (!geometryRef.current) return;

    const { gesture } = handState;
    const targetData = targets[gesture] || targets[GestureType.RESET];
    const posAttr = geometryRef.current.attributes.position;
    const colAttr = geometryRef.current.attributes.color;

    // Faster morphing for Love gesture to be "instant"
    const speed = gesture === GestureType.LOVE ? 0.2 : MORPH_SPEED;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      
      let tx = targetData.positions[ix];
      let ty = targetData.positions[ix + 1];
      let tz = targetData.positions[ix + 2];

      // Idle motion for cloud
      if (gesture === GestureType.RESET) {
        const t = state.clock.elapsedTime;
        tx += Math.sin(t * 0.5 + i) * 0.5;
        ty += Math.cos(t * 0.3 + i * 0.5) * 0.5;
      }

      currentPositions.current[ix] += (tx - currentPositions.current[ix]) * speed;
      currentPositions.current[ix + 1] += (ty - currentPositions.current[ix + 1]) * speed;
      currentPositions.current[ix + 2] += (tz - currentPositions.current[ix + 2]) * speed;

      posAttr.setXYZ(i, currentPositions.current[ix], currentPositions.current[ix+1], currentPositions.current[ix+2]);

      const tCr = targetData.colors[ix];
      const tCg = targetData.colors[ix + 1];
      const tCb = targetData.colors[ix + 2];

      currentColors.current[ix] += (tCr - currentColors.current[ix]) * speed;
      currentColors.current[ix + 1] += (tCg - currentColors.current[ix + 1]) * speed;
      currentColors.current[ix + 2] += (tCb - currentColors.current[ix + 2]) * speed;

      colAttr.setXYZ(i, currentColors.current[ix], currentColors.current[ix+1], currentColors.current[ix+2]);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <Points ref={pointsRef}>
      <BufferGeometry ref={geometryRef}>
        <BufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={initialPositions} itemSize={3} />
        <BufferAttribute attach="attributes-color" count={PARTICLE_COUNT} array={initialColors} itemSize={3} />
        <BufferAttribute attach="attributes-size" count={PARTICLE_COUNT} array={new Float32Array(PARTICLE_COUNT).fill(0.25)} itemSize={1} />
      </BufferGeometry>
      <ShaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
};

const Experience: React.FC<{ handState: HandState }> = ({ handState }) => {
  return (
    <div className="w-full h-screen bg-black relative">
      <Canvas camera={{ position: [0, 0, 24], fov: 45 }}>
        <Particles handState={handState} />
        
        {/* Celebration Lights & Objects */}
        {handState.gesture === GestureType.LOVE && (
            <Group>
                <AmbientLight intensity={0.5} />
                <PointLight position={[10, 10, 10]} intensity={2} color="#ff0080" />
                <PointLight position={[-10, -10, 10]} intensity={2} color="#8000ff" />
                <BalloonInstances />
            </Group>
        )}

        <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            // autoRotate removed
            autoRotate={false}
            autoRotateSpeed={0.0} 
        />
      </Canvas>
    </div>
  );
};

export default Experience;