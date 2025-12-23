import React from 'react';
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
                    {/* Workspace Area */}
                    <div className="flex flex-1 overflow-hidden justify-center bg-[var(--forcs-background)]">
                        <div className="flex w-full max-w-[1920px] bg-white shadow-2xl overflow-hidden">
                            <main className={`flex-1 overflow-y-auto border-r border-[var(--forcs-border)] ${showPreview ? 'lg:mr-0' : ''}`}>
                                <div className="mx-auto w-full max-w-[1100px] p-4 pb-24 lg:p-8">
                                    {workspace}
                                </div>
                            </main>

                            {/* Preview Area - Desktop (Fixed width) - Always render but hide when showPreview is false */}
                            <aside
                                className={`hidden lg:flex w-[290mm] flex-col overflow-y-auto bg-[#f1f5f9] border-l border-[var(--forcs-border)] shadow-inner ${!showPreview ? 'lg:hidden' : ''}`}
                                style={{
                                    position: showPreview ? 'relative' : 'absolute',
                                    left: showPreview ? 'auto' : '-9999px',
                                    visibility: showPreview ? 'visible' : 'hidden'
                                }}
                            >
                                <div className="p-6 flex justify-center">
                                    <div className="w-[280mm] origin-top scale-[0.92] xl:scale-100 transition-transform">
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
