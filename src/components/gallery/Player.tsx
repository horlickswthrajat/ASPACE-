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
    onUnlock,
    mobileMovement
}: {
    exploreMode: boolean;
    introDone: boolean;
    setIntroDone: (val: boolean) => void;
    onUnlock: () => void;
    mobileMovement?: { forward: boolean; backward: boolean; left: boolean; right: boolean; };
}) {
    const { camera, size } = useThree();
    const keyboardMovement = usePlayerControls();

    // Merge keyboard movement with virtual mobile controls movement
    const movement = {
        forward: keyboardMovement.forward || (mobileMovement?.forward ?? false),
        backward: keyboardMovement.backward || (mobileMovement?.backward ?? false),
        left: keyboardMovement.left || (mobileMovement?.left ?? false),
        right: keyboardMovement.right || (mobileMovement?.right ?? false),
    };

    // We use a direction vector and Euler to calculate local movement relative to the camera's rotation.
    const direction = useRef(new THREE.Vector3());
    const frontVector = useRef(new THREE.Vector3());
    const sideVector = useRef(new THREE.Vector3());

    const isPortrait = size.height > size.width;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth < 1024);

    const targetPosition = useRef(new THREE.Vector3(0, 1.7, isPortrait ? 8.5 : 5.0));
    const startPosition = useRef(new THREE.Vector3(0, 5, isPortrait ? 20.0 : 15.0));
    const controlsRef = useRef<any>(null);

    // Custom drag controls for mobile/tablet looking around
    const isPointerDown = useRef(false);
    const prevPointerPos = useRef({ x: 0, y: 0 });
    const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

    // Adjust camera FOV based on orientation (portrait needs wider lens)
    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = isPortrait ? 75 : 60;
            camera.updateProjectionMatrix();
        }
    }, [camera, size, isPortrait]);

    // Adjust start and target positions reactively based on orientation
    useEffect(() => {
        const targetZ = isPortrait ? 8.5 : 5.0;
        const startZ = isPortrait ? 20.0 : 15.0;
        targetPosition.current.set(0, 1.7, targetZ);
        startPosition.current.set(0, 5, startZ);

        if (introDone) {
            camera.position.copy(targetPosition.current);
        }
    }, [isPortrait, camera, introDone]);

    // Pointer-drag listeners for look-around on mobile/tablet devices
    useEffect(() => {
        if (!exploreMode || !isMobile) return;

        const handlePointerDown = (e: PointerEvent) => {
            isPointerDown.current = true;
            prevPointerPos.current = { x: e.clientX, y: e.clientY };
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isPointerDown.current) return;

            const deltaX = e.clientX - prevPointerPos.current.x;
            const deltaY = e.clientY - prevPointerPos.current.y;
            prevPointerPos.current = { x: e.clientX, y: e.clientY };

            const sensitivity = 0.005;

            euler.current.setFromQuaternion(camera.quaternion);
            euler.current.y -= deltaX * sensitivity;
            euler.current.x -= deltaY * sensitivity;

            // Clamp pitch to prevent camera from flipping upside down
            euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x));

            camera.quaternion.setFromEuler(euler.current);
        };

        const handlePointerUp = () => {
            isPointerDown.current = false;
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [exploreMode, camera, isMobile]);

    useEffect(() => {
        if (exploreMode && controlsRef.current && introDone && !isMobile) {
            controlsRef.current.lock();
        }
    }, [exploreMode, introDone, isMobile]);

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

    return !isMobile ? (
        <PointerLockControls
            ref={controlsRef}
            selector="#explore-button"
            onUnlock={onUnlock}
        />
    ) : null;
}
