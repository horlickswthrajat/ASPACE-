import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePlayerControls } from '../../hooks/usePlayerControls';

const MOVEMENT_SPEED = 5;

export default function Player({
    exploreMode,
    introDone,
    setIntroDone,
    onUnlock
}: {
    exploreMode: boolean;
    introDone: boolean;
    setIntroDone: (val: boolean) => void;
    onUnlock: () => void;
}) {
    const { camera } = useThree();
    const movement = usePlayerControls();

    // We use a direction vector and Euler to calculate local movement relative to the camera's rotation.
    const direction = useRef(new THREE.Vector3());
    const frontVector = useRef(new THREE.Vector3());
    const sideVector = useRef(new THREE.Vector3());

    const targetPosition = useRef(new THREE.Vector3(0, 1.7, 5));
    const startPosition = useRef(new THREE.Vector3(0, 5, 15));
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        if (exploreMode && controlsRef.current && introDone) {
            controlsRef.current.lock();
        }
    }, [exploreMode, introDone]);

    useEffect(() => {
        if (!introDone) {
            camera.position.copy(startPosition.current);
            // Look slightly down at the gallery during intro
            camera.rotation.set(-0.2, 0, 0);
        } else {
            camera.position.copy(targetPosition.current);
        }
    }, [camera, introDone]);

    useFrame((_, delta) => {
        // --- 1. Intro Animation ---
        if (!introDone) {
            camera.position.lerp(targetPosition.current, delta * 2);
            // Smoothly ease rotation back to straight ahead
            const currentRotation = new THREE.Euler().copy(camera.rotation);
            currentRotation.x = THREE.MathUtils.lerp(currentRotation.x, 0, delta * 2);
            camera.rotation.copy(currentRotation);

            if (camera.position.distanceTo(targetPosition.current) < 0.1) {
                setIntroDone(true);
            }
            return; // Don't allow movement during intro
        }

        // --- 2. Movement Logic (Only if exploring) ---
        if (!exploreMode) return;
        // Calculate forward/backward movement
        frontVector.current.set(0, 0, Number(movement.backward) - Number(movement.forward));
        // Calculate left/right movement
        sideVector.current.set(Number(movement.left) - Number(movement.right), 0, 0);

        // Calculate absolute movement direction relative to camera rotation
        direction.current
            .subVectors(frontVector.current, sideVector.current)
            .normalize()
            .multiplyScalar(MOVEMENT_SPEED * delta) // Scale by speed and delta time
            .applyEuler(camera.rotation); // Apply camera rotation so 'forward' is where we look

        // Apply movement to camera, zeroing out Y movement so we don't fly
        camera.position.add(direction.current.setY(0));

        // Basic clamp to keep player inside the room bounds (-10 to 10 width, -15 to 15 length)
        const margin = 1;
        const roomHalfWidth = 10;
        const roomHalfLength = 15;
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -roomHalfWidth + margin, roomHalfWidth - margin);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -roomHalfLength + margin, roomHalfLength - margin);
    });

    return (
        <PointerLockControls
            ref={controlsRef}
            selector="#explore-button"
            onUnlock={onUnlock}
        />
    );
}
