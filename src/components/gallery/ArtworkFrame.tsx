import { useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { TextureLoader, DoubleSide } from 'three';
import { useAppContext } from '../../context/AppContext';
import type { Artwork } from '../../context/AppContext';
import OrnateFrame from './OrnateFrame';

export default function ArtworkFrame({ artwork, position, onFrameClick }: { artwork: Artwork, position: [number, number, number], onFrameClick: (artwork: Artwork) => void }) {
    const { theme } = useAppContext();
    const [texture, tagTexture] = useLoader(TextureLoader, [artwork.url, '/name_tag_bg.png']);
    const [hovered, setHovered] = useState(false);

    return (
        <group position={position}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'default'; }}
            onClick={(e) => {
                e.stopPropagation();
                onFrameClick(artwork);
            }}
        >
            {/* Ornate Frame instead of plain glowing box */}
            <OrnateFrame width={2.8} height={2.8} depth={0.1} color={hovered ? theme.light2 : "#1a1a1a"} />

            {/* The Image */}
            <mesh position={[0, 0, 0.12]}>
                <planeGeometry args={[2.4, 2.4]} />
                <meshBasicMaterial map={texture} side={DoubleSide} />
            </mesh>


            {/* Artwork Name Tag Background */}
            <mesh position={[0, -1.6, 0.04]}>
                <planeGeometry args={[1.8, 0.45]} />
                <meshBasicMaterial map={tagTexture} transparent={true} depthWrite={false} />
            </mesh>

            {/* Artwork Title Label */}
            <Text
                position={[0, -1.6, 0.05]}
                fontSize={0.16}
                color="#3d262a"
                anchorX="center"
                anchorY="middle"
                maxWidth={1.6}
                textAlign="center"
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.ttf"
            >
                {artwork.title}
            </Text>
        </group>
    );
}
