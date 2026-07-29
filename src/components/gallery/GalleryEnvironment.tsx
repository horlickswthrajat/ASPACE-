import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Artwork } from '../../context/AppContext';
import ArtworkFrame from './ArtworkFrame';
import Player from './Player';
import OrnateFrame from './OrnateFrame';

// Optimized, beautiful, and theme-adaptive Centerpiece that runs smoothly on all devices
function Centerpiece({ roomType }: { roomType: string }) {
    const groupRef = useRef<THREE.Group>(null);
    const ring1Ref = useRef<THREE.Mesh>(null);
    const ring2Ref = useRef<THREE.Mesh>(null);

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth < 1024);

    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.15;
        }
        if (ring1Ref.current) {
            ring1Ref.current.rotation.x += delta * 0.3;
            ring1Ref.current.rotation.y += delta * 0.1;
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.y -= delta * 0.4;
            ring2Ref.current.rotation.z += delta * 0.2;
        }
    });

    return (
        <group position={[0, 0, 0]}>
            {/* Pedestal Base */}
            <mesh position={[0, 0.4, 0]} castShadow={!isMobileDevice} receiveShadow={!isMobileDevice}>
                <cylinderGeometry args={[0.6, 0.7, 0.8, 16]} />
                <meshStandardMaterial 
                    color={
                        roomType === 'classical_salon' ? '#d7ccc8' :
                        roomType === 'industrial_warehouse' ? '#3e2723' :
                        roomType === 'neon_void' ? '#0d0d1a' : '#eceff1'
                    }
                    roughness={roomType === 'neon_void' ? 0.1 : 0.4}
                    metalness={roomType === 'neon_void' ? 0.9 : 0.2}
                />
            </mesh>

            {/* Glowing Sculpture on top */}
            <group ref={groupRef} position={[0, 1.6, 0]}>
                {roomType === 'neon_void' ? (
                    <>
                        {/* Glowing core sphere */}
                        <mesh castShadow={!isMobileDevice}>
                            <sphereGeometry args={[0.25, 16, 16]} />
                            <meshBasicMaterial color="#00ffff" />
                        </mesh>
                        {/* Outer Neon Rings */}
                        <mesh ref={ring1Ref}>
                            <torusGeometry args={[0.5, 0.03, 8, 32]} />
                            <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                        <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
                            <torusGeometry args={[0.7, 0.02, 8, 32]} />
                            <meshBasicMaterial color="#00ff00" />
                        </mesh>
                        <pointLight distance={10} intensity={1.5} color="#00ffff" />
                    </>
                ) : roomType === 'classical_salon' ? (
                    <>
                        {/* Classic Marble sphere */}
                        <mesh castShadow={!isMobileDevice}>
                            <sphereGeometry args={[0.3, 16, 16]} />
                            <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} />
                        </mesh>
                        {/* Golden rings */}
                        <mesh ref={ring1Ref}>
                            <torusGeometry args={[0.6, 0.04, 8, 32]} />
                            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
                        </mesh>
                        <mesh ref={ring2Ref} rotation={[Math.PI / 4, Math.PI / 6, 0]}>
                            <torusGeometry args={[0.8, 0.03, 8, 32]} />
                            <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
                        </mesh>
                        <pointLight distance={8} intensity={0.8} color="#ffd1a3" />
                    </>
                ) : roomType === 'industrial_warehouse' ? (
                    <>
                        {/* Industrial Copper/Rust core */}
                        <mesh castShadow={!isMobileDevice}>
                            <octahedronGeometry args={[0.35]} />
                            <meshStandardMaterial color="#8d6e63" metalness={0.8} roughness={0.4} />
                        </mesh>
                        {/* Dark iron rings */}
                        <mesh ref={ring1Ref}>
                            <torusGeometry args={[0.65, 0.05, 8, 24]} />
                            <meshStandardMaterial color="#37474f" metalness={0.7} roughness={0.6} />
                        </mesh>
                        <mesh ref={ring2Ref} rotation={[Math.PI / 2, Math.PI / 3, 0]}>
                            <torusGeometry args={[0.9, 0.03, 8, 24]} />
                            <meshStandardMaterial color="#bf360c" metalness={0.9} roughness={0.2} />
                        </mesh>
                        <pointLight distance={8} intensity={1.0} color="#ffab40" />
                    </>
                ) : (
                    // Atrium (Glass & light modern design)
                    <>
                        {/* Translucent white sphere */}
                        <mesh castShadow={!isMobileDevice}>
                            <sphereGeometry args={[0.35, 16, 16]} />
                            <meshStandardMaterial color="#ffffff" transparent opacity={0.6} roughness={0.05} metalness={0.9} />
                        </mesh>
                        {/* Silver/Chrome rings */}
                        <mesh ref={ring1Ref}>
                            <torusGeometry args={[0.65, 0.03, 12, 48]} />
                            <meshStandardMaterial color="#cfd8dc" metalness={1.0} roughness={0.05} />
                        </mesh>
                        <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 5, 0]}>
                            <torusGeometry args={[0.85, 0.02, 12, 48]} />
                            <meshStandardMaterial color="#cfd8dc" metalness={1.0} roughness={0.05} />
                        </mesh>
                        <pointLight distance={10} intensity={1.0} color="#ffffff" />
                    </>
                )}
            </group>
        </group>
    );
}

// Procedural chandelier structure (0 KB to download, lightweight on CPU/GPU)
function ProceduralCeilingLight({ roomType }: { roomType: string }) {
    const lightRef = useRef<THREE.Group>(null);
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth < 1024);

    useFrame((_, delta) => {
        if (lightRef.current) {
            lightRef.current.rotation.y += delta * 0.15;
        }
    });

    if (roomType === 'neon_void') {
        return (
            <group ref={lightRef} position={[0, -0.2, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.5, 0.06, 8, 48]} />
                    <meshBasicMaterial color="#ff00ff" />
                </mesh>
                <pointLight distance={15} intensity={2.0} color="#ff00ff" />
            </group>
        );
    } else if (roomType === 'industrial_warehouse') {
        return (
            <group position={[0, -0.2, 0]}>
                <mesh castShadow={!isMobileDevice}>
                    <cylinderGeometry args={[0.8, 1.2, 0.4, 16]} />
                    <meshStandardMaterial color="#212121" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.2, 0]}>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffaa44" emissiveIntensity={3} />
                </mesh>
                <pointLight distance={12} intensity={1.5} color="#ffaa44" castShadow={!isMobileDevice} />
            </group>
        );
    } else if (roomType === 'classical_salon') {
        return (
            <group ref={lightRef} position={[0, -0.5, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={!isMobileDevice}>
                    <torusGeometry args={[1.8, 0.08, 12, 48]} />
                    <meshStandardMaterial color="#d4af37" metalness={1.0} roughness={0.1} />
                </mesh>
                {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = Math.cos(angle) * 1.8;
                    const z = Math.sin(angle) * 1.8;
                    return (
                        <group key={i} position={[x, 0.1, z]}>
                            <mesh castShadow={!isMobileDevice}>
                                <cylinderGeometry args={[0.04, 0.04, 0.2]} />
                                <meshStandardMaterial color="#ffffff" />
                            </mesh>
                            <mesh position={[0, 0.15, 0]}>
                                <sphereGeometry args={[0.06, 8, 8]} />
                                <meshStandardMaterial color="#ffffff" emissive="#ffd1a3" emissiveIntensity={3} />
                            </mesh>
                        </group>
                    );
                })}
                <pointLight distance={20} intensity={1.2} color="#ffd1a3" castShadow={!isMobileDevice} />
            </group>
        );
    } else {
        return (
            <group ref={lightRef} position={[0, -0.2, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={!isMobileDevice}>
                    <torusGeometry args={[2.0, 0.05, 12, 48]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} roughness={0.1} />
                </mesh>
                {Array.from({ length: 4 }).map((_, i) => {
                    const angle = (i / 4) * Math.PI * 2;
                    const x = Math.cos(angle) * 2.0;
                    const z = Math.sin(angle) * 2.0;
                    return (
                        <mesh key={i} position={[x / 2, 0.5, z / 2]} rotation={[0, 0, angle + Math.PI / 4]}>
                            <cylinderGeometry args={[0.01, 0.01, 1.2]} />
                            <meshStandardMaterial color="#888888" metalness={0.9} />
                        </mesh>
                    );
                })}
                <pointLight distance={22} intensity={1.5} color="#e3f2fd" castShadow={!isMobileDevice} />
            </group>
        );
    }
}

export default function GalleryEnvironment({
    artworks,
    onArtworkClick,
    exploreMode,
    introDone,
    setIntroDone,
    onUnlock,
    roomType = 'atrium',
    enableGuestbook = false,
    onGuestbookClick,
    mobileMovement,
    atmosphere = 'default'
}: {
    artworks: Artwork[],
    onArtworkClick: (art: Artwork) => void;
    exploreMode: boolean;
    introDone: boolean;
    setIntroDone: (val: boolean) => void;
    onUnlock: () => void;
    roomType?: string;
    enableGuestbook?: boolean;
    onGuestbookClick?: () => void;
    mobileMovement?: { forward: boolean; backward: boolean; left: boolean; right: boolean; };
    atmosphere?: 'default' | 'golden_hour' | 'sunset' | 'midnight' | 'foggy';
}) {
    const roomLength = 30; // Longer room for depth
    const roomWidth = 20;

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth < 1024);

    // Load the custom wall texture
    const wallTexture = useTexture('/wall-pattern.jpg');

    // Load the custom floor texture
    const floorTexture = useTexture('/floor-pattern.jpg');

    // Configure textures for tiling
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    // Set to 1, 1 (or something small) to avoid the segmented panel stacking if the image isn't perfectly seamless
    wallTexture.repeat.set(1, 1);

    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5); // Tiling config for the floor

    // Room Style Configurations
    const styles = {
        atrium: {
            ambientIntensity: 0.7,
            ambientColor: "#ffffff",
            directionalIntensity: 1.5,
            directionalColor: "#ffffff",
            floorColor: "#b0b5b9",
            floorRoughness: 0.15,
            floorMetalness: 0.2,
            ceilingColor: "#f0f0f0",
            wallColor: "#ffffff",
            wallRoughness: 0.8,
            useWallTexture: true,
            windowSkyColor: "#aaccff"
        },
        classical_salon: {
            ambientIntensity: 0.5,
            ambientColor: "#ffe6cc",
            directionalIntensity: 1.2,
            directionalColor: "#ffd1a3",
            floorColor: "#3e2723", // Dark wood/brown
            floorRoughness: 0.4,
            floorMetalness: 0.1,
            ceilingColor: "#fff3e0",
            wallColor: "#fff8e7", // Ivory
            wallRoughness: 0.9,
            useWallTexture: false,
            windowSkyColor: "#ffd1a3" // Sunset/warm light coming in
        },
        industrial_warehouse: {
            ambientIntensity: 0.3,
            ambientColor: "#bbaabb",
            directionalIntensity: 0.8,
            directionalColor: "#dcdcaa",
            floorColor: "#2c2c2c",
            floorRoughness: 0.8,
            floorMetalness: 0.0,
            ceilingColor: "#1a1a1a",
            wallColor: "#4a4036", // Brownish/brick-like dark
            wallRoughness: 1.0,
            useWallTexture: false, // Could load a brick texture later
            windowSkyColor: "#556677" // Overcast
        },
        neon_void: {
            ambientIntensity: 0.1,
            ambientColor: "#220044",
            directionalIntensity: 0.2,
            directionalColor: "#aa00ff",
            floorColor: "#050510",
            floorRoughness: 0.0, // Highly reflective
            floorMetalness: 0.8,
            ceilingColor: "#020205",
            wallColor: "#050510",
            wallRoughness: 0.1, // Glossy black walls
            useWallTexture: false,
            windowSkyColor: "#000000" // Pitch black outside
        }
    };

    const currentStyle = styles[roomType as keyof typeof styles] || styles.atrium;

    const atmosphereConfigs = {
        default: { fogColor: null, fogNear: 15, fogFar: 45, lightColor: currentStyle.directionalColor, intensityMult: 1 },
        golden_hour: { fogColor: '#3a200a', fogNear: 8, fogFar: 35, lightColor: '#ffa726', intensityMult: 1.4 },
        sunset: { fogColor: '#2b0a2c', fogNear: 6, fogFar: 30, lightColor: '#ff4081', intensityMult: 1.3 },
        midnight: { fogColor: '#020617', fogNear: 5, fogFar: 28, lightColor: '#00ffff', intensityMult: 0.8 },
        foggy: { fogColor: '#b0bec5', fogNear: 3, fogFar: 22, lightColor: '#e0e0e0', intensityMult: 0.7 }
    };
    const atmo = atmosphereConfigs[atmosphere] || atmosphereConfigs.default;

    const wallMaterialProps = currentStyle.useWallTexture
        ? { map: wallTexture, color: currentStyle.wallColor, roughness: currentStyle.wallRoughness }
        : { color: currentStyle.wallColor, roughness: currentStyle.wallRoughness };

    return (
        <group>
            {atmo.fogColor && <fog attach="fog" args={[atmo.fogColor, atmo.fogNear, atmo.fogFar]} />}

            {/* Ambient Lighting */}
            <ambientLight intensity={currentStyle.ambientIntensity * 0.5 * atmo.intensityMult} color={atmo.lightColor || currentStyle.ambientColor} />

            {/* Main directional light coming from the window */}
            <directionalLight
                position={[0, 10, -roomLength / 2 - 10]}
                intensity={currentStyle.directionalIntensity * 0.4 * atmo.intensityMult}
                color={atmo.lightColor || currentStyle.directionalColor}
                castShadow={!isMobileDevice}
                shadow-mapSize={isMobileDevice ? [512, 512] : [1024, 1024]}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-near={0.1}
                shadow-camera-far={100}
                shadow-bias={-0.002}
            />

            {/* Subtle fill lights for the artworks */}
            {roomType === 'neon_void' ? (
                <>
                    <pointLight position={[roomWidth / 4, 3, 0]} intensity={1.5} color="#00ffff" distance={15} />
                    <pointLight position={[-roomWidth / 4, 3, 0]} intensity={1.5} color="#ff00ff" distance={15} />
                    <pointLight position={[0, 8, 5]} intensity={1.0} color="#aa00ff" distance={20} />
                </>
            ) : roomType === 'industrial_warehouse' ? (
                <>
                    <spotLight position={[roomWidth / 4, 8, 0]} angle={0.5} penumbra={0.5} intensity={1} color="#ffeedd" castShadow />
                    <spotLight position={[-roomWidth / 4, 8, 0]} angle={0.5} penumbra={0.5} intensity={1} color="#ffeedd" castShadow />
                </>
            ) : (
                <>
                    <pointLight position={[roomWidth / 4, 3, 0]} intensity={0.2} color="#e6f2ff" />
                    <pointLight position={[-roomWidth / 4, 3, 0]} intensity={0.2} color="#e6f2ff" />
                </>
            )}

            {/* --- Architecture --- */}

            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={!isMobileDevice}>
                <planeGeometry args={[roomWidth, roomLength]} />
                <meshStandardMaterial
                    map={floorTexture}
                    color={currentStyle.floorColor}
                    roughness={currentStyle.floorRoughness}
                    metalness={currentStyle.floorMetalness}
                />
            </mesh>

            {/* Ceiling */}
            {roomType === 'industrial_warehouse' ? (
                /* Sawtooth Ceiling Roof */
                <group position={[0, 10, 0]}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <group key={`sawtooth-${i}`} position={[0, 0, 15 - i * 4]}>
                            {/* Slanted main roof */}
                            <mesh position={[0, 1, -1]} rotation={[Math.PI / 6, 0, 0]} receiveShadow>
                                <planeGeometry args={[roomWidth, 4.2]} />
                                <meshStandardMaterial color="#111" roughness={0.9} />
                            </mesh>
                            {/* Flat skylight portion */}
                            <mesh position={[0, 0, -3.5]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[roomWidth, 2]} />
                                <meshStandardMaterial color="#556677" roughness={0} metalness={0.8} /> {/* Faking light block */}
                            </mesh>
                        </group>
                    ))}
                </group>
            ) : (
                <group position={[0, 10, 0]}>
                    {/* The very top recessed ceiling / backing */}
                    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
                        <planeGeometry args={[roomWidth, roomLength]} />
                        <meshStandardMaterial color="#d4d4d4" roughness={0.8} />
                    </mesh>

                    {/* Outer Drop Ceiling Border Layer */}
                    {/* Left Border */}
                    <mesh position={[-roomWidth / 2 + 2.5, 0, 0]} receiveShadow>
                        <boxGeometry args={[5, 0.2, roomLength]} />
                        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
                    </mesh>
                    {/* Right Border */}
                    <mesh position={[roomWidth / 2 - 2.5, 0, 0]} receiveShadow>
                        <boxGeometry args={[5, 0.2, roomLength]} />
                        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
                    </mesh>
                    {/* Front Border */}
                    <mesh position={[0, 0, roomLength / 2 - 2.5]} receiveShadow>
                        <boxGeometry args={[roomWidth - 10, 0.2, 5]} />
                        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
                    </mesh>
                    {/* Back Border */}
                    <mesh position={[0, 0, -roomLength / 2 + 2.5]} receiveShadow>
                        <boxGeometry args={[roomWidth - 10, 0.2, 5]} />
                        <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
                    </mesh>

                    {/* Middle Recessed "Ring" Border (creating the inner rectangle) */}
                    {/* Left/Right Inner Drop */}
                    <mesh position={[-roomWidth / 4 + 0.5, 0.1, 0]} receiveShadow>
                        <boxGeometry args={[2, 0.1, roomLength - 12]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                    </mesh>
                    <mesh position={[roomWidth / 4 - 0.5, 0.1, 0]} receiveShadow>
                        <boxGeometry args={[2, 0.1, roomLength - 12]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                    </mesh>
                    {/* Front/Back Inner Drop */}
                    <mesh position={[0, 0.1, roomLength / 2 - 6]} receiveShadow>
                        <boxGeometry args={[roomWidth / 2 - 3, 0.1, 2]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0.1, -roomLength / 2 + 6]} receiveShadow>
                        <boxGeometry args={[roomWidth / 2 - 3, 0.1, 2]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                    </mesh>

                    {/* Small dot lights array in the outer border area */}
                    {[-roomWidth / 2 + 2.5, roomWidth / 2 - 2.5].map((xVar, cIdx) => (
                        [10, 5, 0, -5, -10].map((zVar, rIdx) => (
                            <group key={`dl-${cIdx}-${rIdx}`} position={[xVar, -0.1, zVar]}>
                                <mesh rotation={[Math.PI / 2, 0, 0]}>
                                    <circleGeometry args={[0.1, 16]} />
                                    <meshBasicMaterial color="#ffffff" />
                                </mesh>
                                {/* very dim point light for each dot */}
                                <pointLight distance={3} intensity={0.2} color="#ffffff" />
                            </group>
                        ))
                    ))}

                    {/* The glowing warm indirect lighting trim (Emissive flat planes facing down slightly under edges) */}
                    <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[roomWidth - 8, roomLength - 8]} />
                        <meshBasicMaterial color="#ffeacc" />
                    </mesh>

                    {/* Center Diamond Grid (The focal piece of the reference ceiling) */}
                    <group position={[0, 0.4, 0]}>
                        <mesh rotation={[Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[roomWidth / 2 - 3, roomLength - 14]} />
                            <meshStandardMaterial color="#fafafa" />
                        </mesh>
                        {/* Lattice strings */}
                        {Array.from({ length: 8 }).map((_, i) => (
                            <mesh key={`grid1-${i}`} position={[(i - 4) * 0.8, -0.05, 0]} rotation={[0, Math.PI / 4, 0]}>
                                <boxGeometry args={[0.05, 0.05, 12]} />
                                <meshStandardMaterial color="#e0e0e0" />
                            </mesh>
                        ))}
                        {Array.from({ length: 8 }).map((_, i) => (
                            <mesh key={`grid2-${i}`} position={[(i - 4) * 0.8, -0.05, 0]} rotation={[0, -Math.PI / 4, 0]}>
                                <boxGeometry args={[0.05, 0.05, 12]} />
                                <meshStandardMaterial color="#e0e0e0" />
                            </mesh>
                        ))}
                    </group>

                    {/* The procedurally generated modern Chandelier */}
                    <ProceduralCeilingLight roomType={roomType} />
                </group>
            )}

            {/* Industrial Warehouse Ceiling Beams & Pendants */}
            {roomType === 'industrial_warehouse' && (
                <group position={[0, 9.5, 0]}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <group key={`beam-${i}`} position={[0, 0, -12 + i * 4]}>
                            <mesh receiveShadow castShadow>
                                <boxGeometry args={[roomWidth, 0.5, 0.5]} />
                                <meshStandardMaterial color="#222" roughness={0.9} metalness={0.5} />
                            </mesh>
                            {/* Dangling pendant lights in front of art spots */}
                            {i < 6 && (
                                <>
                                    <mesh position={[-roomWidth / 2 + 2, -2, 2]}>
                                        <cylinderGeometry args={[0.02, 0.02, 4]} />
                                        <meshStandardMaterial color="#111" />
                                    </mesh>
                                    <mesh position={[-roomWidth / 2 + 2, -4, 2]}>
                                        <sphereGeometry args={[0.2]} />
                                        <meshStandardMaterial color="#ffeedd" emissive="#ffaa55" emissiveIntensity={2} />
                                    </mesh>
                                    <mesh position={[roomWidth / 2 - 2, -2, 2]}>
                                        <cylinderGeometry args={[0.02, 0.02, 4]} />
                                        <meshStandardMaterial color="#111" />
                                    </mesh>
                                    <mesh position={[roomWidth / 2 - 2, -4, 2]}>
                                        <sphereGeometry args={[0.2]} />
                                        <meshStandardMaterial color="#ffeedd" emissive="#ffaa55" emissiveIntensity={2} />
                                    </mesh>
                                </>
                            )}
                        </group>
                    ))}
                </group>
            )}

            {/* Classical Salon Crown Molding & Chandelier */}
            {roomType === 'classical_salon' && (
                <group>
                    {/* Left molding */}
                    <mesh position={[-roomWidth / 2 + 0.2, 9.8, 0]}>
                        <boxGeometry args={[0.4, 0.4, roomLength]} />
                        <meshStandardMaterial color="#e5ddc1" />
                    </mesh>
                    {/* Right molding */}
                    <mesh position={[roomWidth / 2 - 0.2, 9.8, 0]}>
                        <boxGeometry args={[0.4, 0.4, roomLength]} />
                        <meshStandardMaterial color="#e5ddc1" />
                    </mesh>
                    {/* Chandelier Main */}
                    <group position={[0, 8.5, 0]}>
                        <mesh position={[0, 0.5, 0]}>
                            <cylinderGeometry args={[0.05, 0.05, 1]} />
                            <meshStandardMaterial color="#d4af37" metalness={1} roughness={0} />
                        </mesh>
                        <mesh>
                            <sphereGeometry args={[0.8, 16, 16]} />
                            <meshStandardMaterial color="#ffffff" emissive="#ffd1a3" emissiveIntensity={0.8} transparent opacity={0.6} />
                        </mesh>
                        {/* Additional hanging crystals */}
                        {[...Array(6)].map((_, i) => (
                            <mesh key={`chandelier-drop-${i}`} position={[Math.cos((i / 6) * Math.PI * 2) * 0.6, -0.5, Math.sin((i / 6) * Math.PI * 2) * 0.6]}>
                                <coneGeometry args={[0.1, 0.4]} />
                                <meshStandardMaterial color="#ffffff" emissive="#ffd1a3" emissiveIntensity={0.8} />
                            </mesh>
                        ))}
                    </group>
                </group>
            )}

            {/* Neon Void Floating Elements */}
            {roomType === 'neon_void' && (
                <group position={[0, 0, 0]}>
                    {[...Array(8)].map((_, i) => (
                        <mesh key={`float-${i}`} position={[Math.random() * 16 - 8, Math.random() * 6 + 2, Math.random() * 26 - 13]} rotation={[Math.random() * Math.PI, Math.random(), 0]}>
                            <octahedronGeometry args={[0.4]} />
                            <meshStandardMaterial color="#111" emissive={i % 2 === 0 ? "#00ffff" : "#ff00ff"} emissiveIntensity={1} wireframe={i % 3 === 0} />
                        </mesh>
                    ))}
                </group>
            )}

            {/* Left Wall */}
            <group position={[-roomWidth / 2, 5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <mesh receiveShadow>
                    <boxGeometry args={[roomLength, 10, 0.4]} />
                    <meshStandardMaterial {...wallMaterialProps} />
                </mesh>
                {/* Classical Salon Columns (Positioned strictly between artworks) */}
                {roomType === 'classical_salon' && [13.25, 8.75, 4.25, -0.25, -4.75, -9.25, -13.75].map((z, i) => (
                    <mesh key={`col-l-${i}`} position={[0, 0, -z]} receiveShadow castShadow>
                        <cylinderGeometry args={[0.4, 0.4, 10, 16]} />
                        <meshStandardMaterial color="#eee8d5" roughness={0.7} />
                    </mesh>
                ))}
                {/* Neon Void Light Strips */}
                {roomType === 'neon_void' && (
                    <mesh position={[0, 4.5, 0.21]}>
                        <planeGeometry args={[roomLength, 0.1]} />
                        <meshBasicMaterial color="#00ffff" />
                    </mesh>
                )}
            </group>

            {/* Right Wall */}
            <group position={[roomWidth / 2, 5, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <mesh receiveShadow>
                    <boxGeometry args={[roomLength, 10, 0.4]} />
                    <meshStandardMaterial {...wallMaterialProps} />
                </mesh>
                {/* Classical Salon Columns (Positioned strictly between artworks) */}
                {roomType === 'classical_salon' && [13.25, 8.75, 4.25, -0.25, -4.75, -9.25, -13.75].map((z, i) => (
                    <mesh key={`col-r-${i}`} position={[0, 0, z]} receiveShadow castShadow>
                        <cylinderGeometry args={[0.4, 0.4, 10, 16]} />
                        <meshStandardMaterial color="#eee8d5" roughness={0.7} />
                    </mesh>
                ))}
                {/* Neon Void Light Strips */}
                {roomType === 'neon_void' && (
                    <mesh position={[0, -4.5, 0.21]}>
                        <planeGeometry args={[roomLength, 0.1]} />
                        <meshBasicMaterial color="#ff00ff" />
                    </mesh>
                )}
            </group>

            {/* Front Wall (behind player start) */}
            <mesh position={[0, 5, roomLength / 2]} receiveShadow>
                <boxGeometry args={[roomWidth, 10, 0.4]} />
                <meshStandardMaterial {...wallMaterialProps} />
            </mesh>

            {/* Back Wall (with Window cutout) */}
            <group position={[0, 5, -roomLength / 2]}>
                {/* For Atrium, we remove the top and bottom wall strips to create a floor-to-ceiling glass wall. */}
                {roomType !== 'atrium' && (
                    <>
                        <mesh position={[0, -3.5, 0]}>
                            <boxGeometry args={[roomWidth, 3, 0.4]} />
                            <meshStandardMaterial {...wallMaterialProps} />
                        </mesh>
                        <mesh position={[0, 3.5, 0]}>
                            <boxGeometry args={[roomWidth, 3, 0.4]} />
                            <meshStandardMaterial {...wallMaterialProps} />
                        </mesh>
                    </>
                )}
                {/* Window Frame / Mullions */}
                <mesh position={[-roomWidth / 4, 0, 0]}>
                    <boxGeometry args={[0.2, roomType === 'atrium' ? 10 : 4, 0.4]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[roomWidth / 4, 0, 0]}>
                    <boxGeometry args={[0.2, roomType === 'atrium' ? 10 : 4, 0.4]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                {/* Background Landscape (Image Plan floating outside) */}
                <mesh position={[0, 0, -5]}>
                    <planeGeometry args={[roomWidth * 1.5, 15]} />
                    <meshBasicMaterial color={currentStyle.windowSkyColor} />
                </mesh>
            </group>

            {/* --- Center Pedestal & Sculpture --- */}
            <group position={[0, 0, -2]}>
                <Centerpiece roomType={roomType} />
            </group>

            {/* --- Guestbook Table --- */}
            {enableGuestbook && (
                <group position={[4, 0, 6]} rotation={[0, -0.4, 0]}>
                    {/* Desk Tabletop */}
                    <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                        <boxGeometry args={[1.6, 0.08, 1.0]} />
                        <meshStandardMaterial color="#4e3629" roughness={0.6} />
                    </mesh>
                    {/* Drawer detail */}
                    <mesh position={[0, 0.8, 0.45]} castShadow>
                        <boxGeometry args={[0.6, 0.1, 0.08]} />
                        <meshStandardMaterial color="#362217" roughness={0.8} />
                    </mesh>
                    {/* Legs */}
                    <mesh position={[-0.7, 0.45, -0.4]} castShadow>
                        <cylinderGeometry args={[0.04, 0.04, 0.9]} />
                        <meshStandardMaterial color="#2d1d14" roughness={0.7} />
                    </mesh>
                    <mesh position={[0.7, 0.45, -0.4]} castShadow>
                        <cylinderGeometry args={[0.04, 0.04, 0.9]} />
                        <meshStandardMaterial color="#2d1d14" roughness={0.7} />
                    </mesh>
                    <mesh position={[-0.7, 0.45, 0.4]} castShadow>
                        <cylinderGeometry args={[0.04, 0.04, 0.9]} />
                        <meshStandardMaterial color="#2d1d14" roughness={0.7} />
                    </mesh>
                    <mesh position={[0.7, 0.45, 0.4]} castShadow>
                        <cylinderGeometry args={[0.04, 0.04, 0.9]} />
                        <meshStandardMaterial color="#2d1d14" roughness={0.7} />
                    </mesh>

                    {/* Guestbook Book Object */}
                    <group 
                        position={[0, 0.95, 0]} 
                        rotation={[0, 0.2, 0]} 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onGuestbookClick) onGuestbookClick();
                        }}
                        onPointerOver={(e) => {
                            e.stopPropagation();
                            document.body.style.cursor = 'pointer';
                        }}
                        onPointerOut={(e) => {
                            e.stopPropagation();
                            document.body.style.cursor = 'default';
                        }}
                    >
                        {/* Book Cover */}
                        <mesh position={[0, 0.01, 0]} castShadow>
                            <boxGeometry args={[0.52, 0.03, 0.38]} />
                            <meshStandardMaterial color="#8b0000" roughness={0.4} />
                        </mesh>
                        {/* Pages */}
                        <mesh position={[0, 0.025, 0]} castShadow>
                            <boxGeometry args={[0.5, 0.02, 0.36]} />
                            <meshStandardMaterial color="#fffdd0" roughness={0.6} />
                        </mesh>
                        {/* Spine Line */}
                        <mesh position={[0, 0.036, 0]}>
                            <boxGeometry args={[0.02, 0.005, 0.36]} />
                            <meshBasicMaterial color="#333" />
                        </mesh>

                        {/* Floating Label */}
                        <Html position={[0, 0.4, 0]} center distanceFactor={8}>
                            <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 select-none pointer-events-none whitespace-nowrap">
                                <span className="text-white font-black text-xs uppercase tracking-widest">Sign Guestbook</span>
                            </div>
                        </Html>
                    </group>
                </group>
            )}

            {/* --- Artworks (12 Fixed Slots) --- */}
            {Array.from({ length: 12 }).map((_, i) => {
                // Determine if we have an artwork for this specific slot index
                const art = artworks.find(a => (a as any).frameIndex === i);

                // 6 slots on the Left Wall (0-5), 6 slots on the Right Wall (6-11)
                const isLeft = i < 6;
                const slotIndex = isLeft ? i : i - 6;

                // Spacing logic: start near the front wall and move backward towards the window
                const spacing = 4.5;
                const startZ = 11;
                const zPos = startZ - (slotIndex * spacing);

                return (
                    <React.Suspense key={`slot-${i}`} fallback={null}>
                        {isLeft ? (
                            <group position={[-roomWidth / 2 + 0.2, 4, zPos]} rotation={[0, Math.PI / 2, 0]}>
                                {/* Glowing Backing Panel */}
                                <mesh position={[0, 0, -0.1]}>
                                    <planeGeometry args={[3.2, 3.2]} />
                                    <meshBasicMaterial color={roomType === 'neon_void' ? "#aa00ff" : "#e0f7fa"} />
                                </mesh>
                                {art ? (
                                    <ArtworkFrame artwork={art} position={[0, 0, 0]} onFrameClick={onArtworkClick} />
                                ) : (
                                    <group position={[0, 0, 0]}>
                                        <OrnateFrame />
                                    </group>
                                )}
                            </group>
                        ) : (
                            <group position={[roomWidth / 2 - 0.2, 4, zPos]} rotation={[0, -Math.PI / 2, 0]}>
                                <mesh position={[0, 0, -0.1]}>
                                    <planeGeometry args={[3.2, 3.2]} />
                                    <meshBasicMaterial color={roomType === 'neon_void' ? "#00ffff" : "#e0f7fa"} />
                                </mesh>
                                {art ? (
                                    <ArtworkFrame artwork={art} position={[0, 0, 0]} onFrameClick={onArtworkClick} />
                                ) : (
                                    <group position={[0, 0, 0]}>
                                        <OrnateFrame />
                                    </group>
                                )}
                            </group>
                        )}
                    </React.Suspense>
                );
            })}

            {/* Player Controller for WASD & Mobile Touch */}
            <Player
                exploreMode={exploreMode}
                introDone={introDone}
                setIntroDone={setIntroDone}
                onUnlock={onUnlock}
                mobileMovement={mobileMovement}
            />
        </group>
    )
}
