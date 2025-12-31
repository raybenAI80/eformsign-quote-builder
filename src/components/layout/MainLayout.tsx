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
    const [splitPosition, setSplitPosition] = useState(40); // 40% workspace, 60% preview
    const [isDragging, setIsDragging] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.55); // Default scale
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Calculate preview scale based on actual available width
    useEffect(() => {
        const calculateScale = () => {
            if (!previewRef.current) return;
            const containerWidth = previewRef.current.parentElement?.clientWidth || 800;
            // 280mm ≈ 1058px (at 96dpi), need padding too
            const targetWidth = 1122; // 297mm (A4 width)
            const scale = Math.min((containerWidth - 40) / targetWidth, 1);
            setPreviewScale(Math.max(0.4, Math.min(1, scale)));
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
                            {/* Workspace Area */}
                            <main
                                className="overflow-y-auto border-r border-[var(--forcs-border)]"
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
                                    className={`hidden lg:flex w-2 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-[var(--forcs-teal)] transition-colors group sticky top-0 h-screen ${isDragging ? 'bg-[var(--forcs-teal)]' : ''}`}
                                    title="드래그하여 영역 크기 조절"
                                    style={{ alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <div className={`w-1 h-12 rounded-full ${isDragging ? 'bg-white' : 'bg-gray-400 group-hover:bg-white'} transition-colors`} />
                                </div>
                            )}

                            {/* Preview Area */}
                            <aside
                                className={`hidden lg:flex flex-col overflow-hidden bg-[#f1f5f9] shadow-inner ${!showPreview ? 'lg:hidden' : ''}`}
                                style={{
                                    width: showPreview ? `${100 - splitPosition}%` : '0',
                                    position: showPreview ? 'relative' : 'absolute',
                                    left: showPreview ? 'auto' : '-9999px',
                                    visibility: showPreview ? 'visible' : 'hidden',
                                    transition: isDragging ? 'none' : 'width 0.2s ease'
                                }}
                            >
                                <div ref={previewRef} className="p-4 flex justify-center items-start overflow-y-auto overflow-x-auto h-full">
                                    <div
                                        className="w-[297mm] origin-top transition-transform"
                                        style={{ transform: `scale(${previewScale})` }}
                                    >
                                        {preview}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Preview Toggle FAB (Floating Action Button) */}
            <div className="fixed bottom-6 right-6 z-50 lg:hidden">
                <button
                    onClick={onTogglePreview}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--forcs-blue)] text-white shadow-lg transition-transform active:scale-90"
                >
                    {showPreview ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        className="fixed inset-0 z-40 flex flex-col bg-gray-100 lg:hidden overflow-y-auto"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-3 shadow-sm">
                            <h3 className="font-bold text-lg">미리보기</h3>
                            <button onClick={onTogglePreview} className="p-2">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 flex justify-center min-h-0 flex-1 overflow-y-auto">
                            <div className="w-full max-w-[280mm] scale-[0.45] origin-top-left sm:scale-[0.6] md:scale-[0.8]">
                                {preview}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
