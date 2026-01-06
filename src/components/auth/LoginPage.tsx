import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { EformsignLogo } from '../EformsignLogo';

export const LoginPage: React.FC = () => {
    const { signInWithGoogle, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--forcs-blue)] border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
                <div className="p-12 text-center">
                    <div className="mb-10 flex justify-center">
                        <EformsignLogo className="h-12 w-auto" />
                    </div>

                    <h2 className="mb-4 text-2xl font-bold text-gray-900">
                        견적서 빌더에 오신 것을 환영합니다
                    </h2>

                    <p className="mb-10 text-gray-600 leading-relaxed">
                        eformsign 견적서 빌더를 통해<br />
                        쉽고 빠르게 전문적인 견적서를 작성하세요.
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={signInWithGoogle}
                            className="group relative flex w-full items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4 text-lg font-semibold text-gray-700 shadow-md transition-all hover:border-[var(--forcs-blue)] hover:shadow-lg active:scale-[0.99]"
                        >
                            <svg className="h-6 w-6" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span className="group-hover:text-[var(--forcs-blue)] transition-colors">
                                Google 계정으로 계속하기
                            </span>
                        </button>

                        <div className="flex items-center justify-center gap-2 pt-4">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            <p className="text-sm font-medium text-gray-500">
                                @forcs.com 도메인 전용
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 px-8 py-6 text-center">
                    <p className="text-xs text-gray-400">
                        © FORCS. All rights reserved.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
