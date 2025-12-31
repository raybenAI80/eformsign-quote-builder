import React from 'react';

interface AiIconProps {
    className?: string;
}

export const AiIcon: React.FC<AiIconProps> = ({ className = "w-8 h-8" }) => {
    return (
        <svg
            viewBox="0 0 100 68" /* Adjusted viewport to fit the layout tightly */
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
        >
            <defs>
                <linearGradient id="ai-main-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00A99D" />   {/* Teal */}
                    <stop offset="45%" stopColor="#0ea5e9" />  {/* Sky Blue */}
                    <stop offset="100%" stopColor="#554abf" /> {/* Deep Purple */}
                </linearGradient>

                <linearGradient id="star-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2DD4BF" />
                    <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="star-gradient-2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#6D28D9" />
                </linearGradient>
            </defs>

            {/* Sparkles Group */}
            <g transform="translate(2, 5)">
                {/* Large Top Left Star */}
                <path
                    d="M18 0 C20 10 23 15 33 18 C23 21 20 26 18 36 C16 26 13 21 3 18 C13 15 16 10 18 0 Z"
                    fill="url(#star-gradient-1)"
                />

                {/* Medium Bottom Star */}
                <path
                    d="M30 28 C31 32 32 35 37 37 C32 38 31 41 30 46 C29 41 28 38 23 37 C28 35 29 32 30 28 Z"
                    fill="url(#star-gradient-2)"
                />

                {/* Small Top Right Star */}
                <path
                    d="M38 12 C38.5 13.5 39 14.5 41 15 C39 15.5 38.5 16.5 38 18 C37.5 16.5 37 15.5 35 15 C37 14.5 37.5 13.5 38 12 Z"
                    fill="#A78BFA"
                />
            </g>

            {/* Text "AI" - Using SVG Paths for consistent bold font rendering irrespective of system fonts */}
            <g transform="translate(48, 15)">
                {/* A */}
                <path
                    d="M17 0 L34 45 L25 45 L21 33 L9 33 L5 45 L-4 45 L13 0 Z M15 10 L11 25 L19 25 Z"
                    fill="url(#ai-main-gradient)"
                />
                {/* I */}
                <path
                    d="M38 0 L47 0 L47 45 L38 45 Z"
                    fill="url(#ai-main-gradient)"
                />
            </g>
        </svg>
    );
};
