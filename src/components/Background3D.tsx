import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function Background3D({ mousePosition }: { mousePosition: { x: number, y: number } }) {
    const { viewport, size } = useThree();
    const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useEffect(() => {
        const video = document.createElement('video');
        video.src = '/minecraft-fireflies-forest-moewalls-com.mp4';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        videoRef.current = video;

        video.play()
            .then(() => {
                const texture = new THREE.VideoTexture(video);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.format = THREE.RGBAFormat;
                setVideoTexture(texture);
            })
            .catch((err) => {
                console.error("Video play failed:", err);
            });

        return () => {
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current = null;
            }
        };
    }, []);

    // Update uniform values on every frame
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uMouse.value.set(mousePosition.x, mousePosition.y);
        }
    });

    if (!videoTexture) return null;

    // Shader definition
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform sampler2D uTexture;
        uniform vec2 uMouse;
        uniform float uTime;
        uniform float uAspect;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            
            // Invert Y to match screen space with texture space
            vec2 mouse = vec2(uMouse.x, 1.0 - uMouse.y);
            
            // Correct for aspect ratio to make distortion circular
            vec2 distVec = uv - mouse;
            distVec.x *= uAspect;
            float dist = length(distVec);
            
            // 1. Mouse Displacement (push away)
            float pushRadius = 0.28;
            if (dist < pushRadius) {
                float strength = smoothstep(pushRadius, 0.0, dist);
                // Push texture coordinates away from mouse cursor
                uv -= normalize(vUv - mouse) * strength * 0.05;
            }
            
            // 2. Wave Ripple Effect
            float rippleRadius = 0.35;
            if (dist < rippleRadius) {
                float wave = sin(dist * 45.0 - uTime * 6.0);
                float strength = smoothstep(rippleRadius, 0.0, dist) * 0.015;
                uv += normalize(vUv - mouse) * wave * strength;
            }
            
            vec4 color = texture2D(uTexture, uv);
            
            // 3. Brand pink hover glow
            if (dist < 0.15) {
                float glow = smoothstep(0.15, 0.0, dist) * 0.18;
                color.rgb += vec3(0.99, 0.67, 0.72) * glow;
            }
            
            gl_FragColor = color;
        }
    `;

    const aspect = size.width / size.height;

    return (
        <mesh position={[0, 0, 0]}>
            <planeGeometry args={[viewport.width, viewport.height]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={{
                    uTexture: { value: videoTexture },
                    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                    uTime: { value: 0 },
                    uAspect: { value: aspect }
                }}
                depthWrite={false}
                depthTest={false}
            />
        </mesh>
    );
}
