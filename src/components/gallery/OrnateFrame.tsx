import React from 'react';

export default function OrnateFrame({ width = 2.8, height = 2.8, depth = 0.1, color = "#1a1a1a" }) {
    return (
        <group>
            {/* Outer thick frame */}
            <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[width, height, depth]} />
                <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
            </mesh>
            {/* Inner stepped detail 1 */}
            <mesh position={[0, 0, depth / 2 + 0.02]}>
                <boxGeometry args={[width - 0.2, height - 0.2, 0.04]} />
                <meshStandardMaterial color={color} roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Inner stepped detail 2 */}
            <mesh position={[0, 0, depth / 2 + 0.04]}>
                <boxGeometry args={[width - 0.3, height - 0.3, 0.04]} />
                <meshStandardMaterial color={color} roughness={0.2} metalness={0.9} />
            </mesh>
            {/* The dark hollow center/backing */}
            <mesh position={[0, 0, depth / 2 + 0.05]}>
                <planeGeometry args={[width - 0.4, height - 0.4]} />
                <meshStandardMaterial color="#050505" />
            </mesh>
            {/* Ornate corners */}
            {[
                [-width / 2 + 0.1, -height / 2 + 0.1],
                [width / 2 - 0.1, -height / 2 + 0.1],
                [-width / 2 + 0.1, height / 2 - 0.1],
                [width / 2 - 0.1, height / 2 - 0.1],
            ].map((p, i) => (
                <group key={i} position={[p[0], p[1], depth / 2 + 0.04]}>
                    <mesh>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color={color} roughness={0.1} metalness={1.0} />
                    </mesh>
                    {/* little decorative center leaf */}
                    <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.03, 0.05, 0.08, 4]} />
                        <meshStandardMaterial color={color} roughness={0.3} metalness={0.9} />
                    </mesh>
                </group>
            ))}
            {/* Center edge adornments */}
            {[[0, height / 2 - 0.1], [0, -height / 2 + 0.1], [-width / 2 + 0.1, 0], [width / 2 - 0.1, 0]].map((p, i) => (
                <mesh key={`edge-${i}`} position={[p[0], p[1], depth / 2 + 0.04]} rotation={[0, 0, i < 2 ? 0 : Math.PI / 2]}>
                    <coneGeometry args={[0.08, 0.15, 4]} />
                    <meshStandardMaterial color={color} roughness={0.1} metalness={1.0} />
                </mesh>
            ))}
        </group>
    );
}
