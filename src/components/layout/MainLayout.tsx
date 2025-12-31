import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface MainLayoutProps {
    sidebar?: React.ReactNode;
    workspace: React.ReactNode;
    preview: React.ReactNode;
    showPreview: boolean;
    onTogglePreview: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    sidebar,
    workspace,
    preview,
    showPreview,
    onTogglePreview
}) => {
    const hasSidebar = Boolean(sidebar);

    // Resizable split pane state - percentage for workspace width (30-80%)
    const [splitPosition, setSplitPosition] = useState(50); // 50% workspace, 50% preview
    const [isDragging, setIsDragging] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.55); // Default scale
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Calculate preview scale based on actual available width
    useEffect(() => {
        const calculateScale = () => {
            const targetWidth = 1122; // 297mm (A4 width)
            let containerWidth: number;

            // On small screens (< 1024px), use window width
            if (window.innerWidth < 1024) {
                containerWidth = window.innerWidth;
            } else if (previewRef.current?.parentElement) {
                containerWidth = previewRef.current.parentElement.clientWidth;
            } else {
                containerWidth = 800;
            }

            const scale = Math.min((containerWidth - 32) / targetWidth, 1);
            setPreviewScale(Math.max(0.3, Math.min(1, scale)));
        };

        calculateScale();
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [splitPosition]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;

        // Clamp between 30% and 60%
        const clampedPercentage = Math.max(30, Math.min(60, percentage));
        setSplitPosition(clampedPercentage);
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div className="flex min-h-screen w-full bg-[var(--forcs-background)]">
            {/* Sidebar - Sticky on Desktop (optional) */}
            {hasSidebar && (
                <div className="hidden lg:block sticky top-0 h-screen flex-shrink-0 z-30">
                    {sidebar}
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-1 flex-col min-w-0">
                <div className="flex flex-1 relative">
                    {/* Workspace + Preview Container */}
                    <div
                        ref={containerRef}
                        className="flex flex-1 overflow-hidden justify-center bg-[var(--forcs-background)]"
                    >
                        <div className="flex w-full max-w-[1920px] bg-white shadow-2xl overflow-hidden">
                            {/* Workspace Area - Hidden on small screens */}
                            <main
                                className="hidden lg:block overflow-y-auto border-r border-[var(--forcs-border)]"
                                style={{
                                    width: showPreview ? `${splitPosition}%` : '100%',
                                    transition: isDragging ? 'none' : 'width 0.2s ease'
                                }}
                            >
                                <div className="mx-auto w-full max-w-[1100px] p-4 pb-24 lg:p-8">
                                    {workspace}
                                </div>
                            </main>

                            {/* Resizable Divider - Only show on desktop when preview is visible */}
                            {showPreview && (
                                <div
                                    onMouseDown={handleMouseDown}
                                    className={`hidden lg:flex w-2 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-[var(--forcs-teal)] transition-colors group h-full z-10 ${isDragging ? 'bg-[var(--forcs-teal)]' : ''}`}
                                    title="드래그하여 영역 크기 조절"
                                    style={{ alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <div className={`w-1 h-12 rounded-full ${isDragging ? 'bg-white' : 'bg-gray-400 group-hover:bg-white'} transition-colors`} />
                                </div>
                            )}

                            {/* Preview Area - Full width on small screens */}
                            <aside
                                className={`flex flex-col overflow-hidden bg-[#f1f5f9] shadow-inner w-full lg:w-auto ${!showPreview ? 'lg:hidden' : ''}`}
                                style={{
                                    width: window.innerWidth >= 1024 ? (showPreview ? `${100 - splitPosition}%` : '0') : '100%',
                                    position: showPreview || window.innerWidth < 1024 ? 'relative' : 'absolute',
                                    left: showPreview || window.innerWidth < 1024 ? 'auto' : '-9999px',
                                    visibility: showPreview || window.innerWidth < 1024 ? 'visible' : 'hidden',
                                    transition: isDragging ? 'none' : 'width 0.2s ease'
                                }}
                            >
                                <div ref={previewRef} className="p-2 sm:p-4 flex justify-start lg:justify-center items-start overflow-y-auto overflow-x-hidden h-full">
                                    <div
                                        className="w-[297mm] origin-top-left lg:origin-top transition-transform"
                                        style={{
                                            transform: `scale(${previewScale}) translateZ(0)`,
                                            backfaceVisibility: 'hidden'
                                        }}
                                    >
                                        {preview}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            </div>
            {/* Mobile components removed - preview is always shown on small screens */}
        </div>
    );
};
