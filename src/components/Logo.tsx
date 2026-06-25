export type LogoId = 'prism' | 'canvas' | 'spark' | 'frame' | 'portal';

interface LogoProps {
    id?: LogoId;
    className?: string;
    size?: number;
    color?: string;
    animated?: boolean;
}

export default function Logo({ id = 'prism', className = '', size = 48, animated = true }: LogoProps) {

    switch (id) {
        case 'prism':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`${className} transition-transform duration-500 hover:rotate-12`}
                >
                    <defs>
                        <linearGradient id="prism-grad1" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#fcaab8" />
                            <stop offset="50%" stopColor="#f7f1e3" />
                            <stop offset="100%" stopColor="#00ffff" />
                        </linearGradient>
                        <linearGradient id="prism-grad2" x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#ff00ff" />
                            <stop offset="100%" stopColor="#ffd1a3" />
                        </linearGradient>
                        <filter id="prism-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    {/* Isometric Cube / Prism representing 3D Art Space */}
                    <g filter="url(#prism-glow)">
                        {/* Top Face */}
                        <path
                            d="M50 15 L80 32.5 L50 50 L20 32.5 Z"
                            fill="url(#prism-grad1)"
                            opacity="0.85"
                            className={animated ? "animate-[bounce_3s_infinite_ease-in-out]" : ""}
                            style={{ transformOrigin: '50px 50px' }}
                        />
                        {/* Left Face */}
                        <path
                            d="M20 32.5 L50 50 L50 85 L20 67.5 Z"
                            fill="url(#prism-grad2)"
                            opacity="0.75"
                            className={animated ? "animate-[pulse_2.5s_infinite_ease-in-out]" : ""}
                        />
                        {/* Right Face */}
                        <path
                            d="M50 50 L80 32.5 L80 67.5 L50 85 Z"
                            fill="url(#prism-grad1)"
                            opacity="0.9"
                            className={animated ? "animate-[pulse_3.5s_infinite_ease-in-out]" : ""}
                        />
                        {/* Core Glowing Orb */}
                        <circle
                            cx="50"
                            cy="50"
                            r="8"
                            fill="#ffffff"
                            filter="url(#prism-glow)"
                            className={animated ? "animate-[ping_2s_infinite]" : ""}
                            style={{ transformOrigin: '50px 50px' }}
                        />
                    </g>
                </svg>
            );

        case 'canvas':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`${className} transition-all duration-500 hover:scale-110`}
                >
                    <defs>
                        <linearGradient id="canvas-grad1" x1="0" y1="0" x2="100" y2="100">
                            <stop offset="0%" stopColor="#00ffff" />
                            <stop offset="100%" stopColor="#ff00ff" />
                        </linearGradient>
                        <linearGradient id="canvas-grad2" x1="100" y1="0" x2="0" y2="100">
                            <stop offset="0%" stopColor="#ffd1a3" />
                            <stop offset="100%" stopColor="#fcaab8" />
                        </linearGradient>
                    </defs>
                    {/* Overlapping perspective frames representing Canvas and Space */}
                    <g className={animated ? "animate-[spin_20s_linear_infinite]" : ""} style={{ transformOrigin: '50px 50px' }}>
                        {/* Back Frame */}
                        <rect
                            x="25"
                            y="25"
                            width="50"
                            height="50"
                            rx="8"
                            stroke="url(#canvas-grad2)"
                            strokeWidth="4"
                            opacity="0.6"
                            transform="rotate(15 50 50)"
                        />
                        {/* Middle Frame */}
                        <rect
                            x="25"
                            y="25"
                            width="50"
                            height="50"
                            rx="12"
                            stroke="url(#canvas-grad1)"
                            strokeWidth="5"
                            opacity="0.8"
                            transform="rotate(-15 50 50)"
                        />
                        {/* Front Frame */}
                        <rect
                            x="25"
                            y="25"
                            width="50"
                            height="50"
                            rx="16"
                            stroke="#ffffff"
                            strokeWidth="3"
                            transform="rotate(45 50 50)"
                        />
                    </g>
                    {/* Inner glowing portal dot */}
                    <circle cx="50" cy="50" r="4" fill="#ffffff" className={animated ? "animate-ping" : ""} />
                </svg>
            );

        case 'spark':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`${className} transition-all duration-500 hover:rotate-180`}
                >
                    <defs>
                        <linearGradient id="spark-grad" x1="10" y1="10" x2="90" y2="90">
                            <stop offset="0%" stopColor="#ff00ff" />
                            <stop offset="50%" stopColor="#fcaab8" />
                            <stop offset="100%" stopColor="#ffd1a3" />
                        </linearGradient>
                    </defs>
                    {/* Infinite spark of creativity */}
                    <path
                        d="M50 10 C65 35 90 50 90 50 C90 50 65 65 50 90 C35 65 10 50 10 50 C10 50 35 35 50 10 Z"
                        fill="url(#spark-grad)"
                        className={animated ? "animate-[pulse_2s_infinite_ease-in-out]" : ""}
                    />
                    <path
                        d="M50 25 C58 40 75 50 75 50 C75 50 58 60 50 75 C42 60 25 50 25 50 C25 50 42 40 50 25 Z"
                        fill="#ffffff"
                        opacity="0.8"
                        className={animated ? "animate-[spin_10s_linear_infinite]" : ""}
                        style={{ transformOrigin: '50px 50px' }}
                    />
                    <circle cx="50" cy="50" r="5" fill="#ff00ff" />
                </svg>
            );

        case 'frame':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`${className} transition-transform duration-500 hover:-translate-y-1`}
                >
                    <defs>
                        <linearGradient id="frame-grad" x1="0" y1="0" x2="100" y2="100">
                            <stop offset="0%" stopColor="#ffd1a3" />
                            <stop offset="100%" stopColor="#00ffff" />
                        </linearGradient>
                    </defs>
                    {/* Golden ratio inspired art frame composition */}
                    <rect
                        x="15"
                        y="15"
                        width="70"
                        height="70"
                        rx="6"
                        stroke="url(#frame-grad)"
                        strokeWidth="6"
                        className={animated ? "animate-[pulse_3s_infinite]" : ""}
                    />
                    {/* Inner offset circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r="25"
                        stroke="#ffffff"
                        strokeWidth="4"
                        strokeDasharray="8 4"
                        className={animated ? "animate-[spin_30s_linear_infinite]" : ""}
                        style={{ transformOrigin: '50px 50px' }}
                    />
                    {/* Inner solid frame */}
                    <rect
                        x="35"
                        y="35"
                        width="30"
                        height="30"
                        rx="3"
                        fill="url(#frame-grad)"
                        opacity="0.7"
                        className={animated ? "animate-[bounce_4s_infinite_ease-in-out]" : ""}
                        style={{ transformOrigin: '50px 50px' }}
                    />
                </svg>
            );

        case 'portal':
            return (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`${className} transition-all duration-500 hover:scale-105`}
                >
                    <defs>
                        <radialGradient id="portal-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="70%" stopColor="#fcaab8" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    {/* 3D Wireframe portal representing virtual galleries */}
                    <circle cx="50" cy="50" r="45" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
                    <circle cx="50" cy="50" r="35" stroke="#fcaab8" strokeWidth="2" opacity="0.5" />
                    <circle cx="50" cy="50" r="25" stroke="#00ffff" strokeWidth="2" opacity="0.7" />
                    <circle cx="50" cy="50" r="15" stroke="#ff00ff" strokeWidth="2" opacity="0.9" />

                    {/* Glowing Center */}
                    <circle cx="50" cy="50" r="10" fill="url(#portal-grad)" className={animated ? "animate-pulse" : ""} />

                    {/* Structural Crosshairs */}
                    <line x1="50" y1="5" x2="50" y2="95" stroke="#ffffff" strokeWidth="1" opacity="0.4" strokeDasharray="4 4" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="#ffffff" strokeWidth="1" opacity="0.4" strokeDasharray="4 4" />
                </svg>
            );

        default:
            return null;
    }
}
