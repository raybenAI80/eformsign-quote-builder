import React, { useState, useCallback, useRef, useEffect } from 'react';

interface MainLayoutProps {
    header: React.ReactNode;
    sidebar?: React.ReactNode;
    workspace: React.ReactNode;
    preview: React.ReactNode;
    showPreview: boolean;
    onTogglePreview: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    header,
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
    const [scaledSize, setScaledSize] = useState<{ w: number, h: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Calculate preview scale based on actual available width
    useEffect(() => {
        const calculateScale = () => {
            const targetWidth = 1122; // 297mm (A4 width)
            let containerWidth: number;

            // On mobile, force checking window width or parent
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
    }, [splitPosition, showPreview]);

    // Calculate scaled dimensions for the wrapper
    useEffect(() => {
        const updateScaledSize = () => {
            if (contentRef.current) {
                const originalHeight = contentRef.current.offsetHeight;
                const originalWidth = contentRef.current.offsetWidth; // checking 297mm
                setScaledSize({
                    w: originalWidth * previewScale,
                    h: originalHeight * previewScale
                });
            }
        };

        updateScaledSize();

        // Use ResizeObserver to detect content height changes
        const observer = new ResizeObserver(updateScaledSize);
        if (contentRef.current) {
            observer.observe(contentRef.current);
        }

        return () => observer.disconnect();
    }, [previewScale]);

    // ... (Handlers remain same) ...
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
                {/* Header Area - Always Visible */}
                <div className="w-full z-20 bg-white border-b border-[var(--forcs-border)]">
                    {header}
                </div>

                <div
                    ref={containerRef}
                    className="flex flex-1 relative overflow-hidden justify-center bg-[var(--forcs-background)]"
                >
                    {/* Workspace + Preview Container */}
                    <div className="flex w-full max-w-[1920px] h-full bg-white shadow-2xl overflow-hidden">
                        {/* Workspace Area */}
                        <main
                            className={`
                                    overflow-y-auto border-r border-[var(--forcs-border)]
                                    ${showPreview ? 'hidden lg:block' : 'block w-full'}
                                `}
                            style={{
                                width: (window.innerWidth >= 1024 && showPreview) ? `${splitPosition}%` : (showPreview ? '0' : '100%'),
                                transition: isDragging ? 'none' : 'width 0.2s ease',
                                display: (window.innerWidth < 1024 && showPreview) ? 'none' : 'block'
                            }}
                        >
                            <div className="mx-auto w-full max-w-[1100px] p-4 pb-24 lg:p-8">
                                {workspace}
                            </div>
                        </main>

                        {/* Resizable Divider */}
                        {showPreview && (
                            <div
                                onMouseDown={handleMouseDown}
                                className={`hidden lg:flex flex-col w-2 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-[var(--forcs-teal)] transition-colors group h-full z-10 items-center justify-center ${isDragging ? 'bg-[var(--forcs-teal)]' : ''}`}
                                title="드래그하여 영역 크기 조절"
                            >
                                <div className={`w-1 h-12 rounded-full ${isDragging ? 'bg-white' : 'bg-gray-400 group-hover:bg-white'} transition-colors`} />
                            </div>
                        )}

                        {/* Preview Area */}
                        <aside
                            className={`flex flex-col overflow-hidden bg-[#f1f5f9] shadow-inner w-full lg:w-auto
                                    ${!showPreview ? 'hidden' : 'flex'}
                                `}
                            style={{
                                width: window.innerWidth >= 1024 ? `${100 - splitPosition}%` : '100%',
                                transition: isDragging ? 'none' : 'width 0.2s ease',
                                display: !showPreview ? 'none' : 'flex'
                            }}
                        >
                            <div
                                ref={previewRef}
                                className="p-2 sm:p-4 flex justify-start lg:justify-center items-start overflow-x-hidden flex-1"
                                style={{
                                    overflowY: 'auto'
                                }}
                            >
                                {/* Centered Wrapper */}
                                <div className="flex flex-col items-center justify-start min-h-full pb-8">
                                    <div
                                        style={{
                                            width: scaledSize?.w ?? 'auto',
                                            height: scaledSize?.h ?? 'auto',
                                            visibility: scaledSize ? 'visible' : 'hidden', // Avoid flash
                                        }}
                                    >
                                        <div
                                            ref={contentRef}
                                            className="w-[297mm] shadow-lg bg-white origin-top-left"
                                            style={{
                                                transform: `scale(${previewScale})`,
                                            }}
                                        >
                                            {preview}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
};
