import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

const GlowingFrame = ({ position, rotation, color, scale }: { position: [number, number, number], rotation: [number, number, number], color: string, scale: number }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Slowly rotate the floating frames
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += delta * 0.2;
            meshRef.current.rotation.y += delta * 0.15;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={meshRef} position={position} rotation={rotation} scale={scale}>
                <boxGeometry args={[3, 4, 0.2]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={2}
                    toneMapped={false}
                    wireframe
                />
            </mesh>
        </Float>
    );
};

export default function Background3D({ mousePosition }: { mousePosition: { x: number, y: number } }) {
    const groupRef = useRef<THREE.Group>(null);

    // Parallax effect based on mouse movement + continuous drift
    useFrame((state) => {
        if (groupRef.current) {
            const time = state.clock.getElapsedTime();

            // Mouse target
            const targetX = (mousePosition.x - 0.5) * 2; // -1 to 1
            const targetY = (mousePosition.y - 0.5) * 2;

            // Base drift animation
            const driftX = Math.sin(time * 0.2) * 0.1;
            const driftY = Math.cos(time * 0.15) * 0.1;

            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, (targetX * 0.1) + driftX, 0.05);
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, (targetY * 0.1) + driftY, 0.05);
        }
    });

    return (
        <>
            <color attach="background" args={['#000000']} />
            <fog attach="fog" args={['#000000', 10, 30]} />
            <ambientLight intensity={1.5} color="#ffffff" />

            <group ref={groupRef}>
                {/* Background gradient-like effect using points/lights */}
                <pointLight position={[5, 5, -5]} color="#ffffff" intensity={300} distance={50} />
                <pointLight position={[-5, -5, -5]} color="#ffffff" intensity={200} distance={50} />

                {/* Simulated Room Box */}
                <mesh position={[0, 0, -10]}>
                    <boxGeometry args={[40, 40, 40]} />
                    <meshStandardMaterial color="#111111" side={THREE.BackSide} roughness={0.6} metalness={0.1} />
                </mesh>

                <GlowingFrame position={[-5, 2, -5]} rotation={[0.2, 0.5, 0]} color="#ffffff" scale={1} />
                <GlowingFrame position={[6, -1, -8]} rotation={[-0.2, -0.4, 0.1]} color="#ffffff" scale={1.2} />
                <GlowingFrame position={[-2, -3, -4]} rotation={[0.1, 0.2, -0.1]} color="#ffffff" scale={0.8} />
                <GlowingFrame position={[4, 4, -6]} rotation={[-0.1, 0.3, 0.2]} color="#ffffff" scale={0.9} />
            </group>
            <Environment preset="city" />
        </>
    );
}
