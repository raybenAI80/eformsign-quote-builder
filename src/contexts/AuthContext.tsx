import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('🔄 AuthProvider mounted');
        console.log('📍 Current URL:', window.location.href);

        // 해시에서 토큰 수동 파싱
        const parseHashParams = () => {
            const hash = window.location.hash.substring(1); // # 제거
            const params = new URLSearchParams(hash);
            return {
                access_token: params.get('access_token'),
                refresh_token: params.get('refresh_token'),
            };
        };

        const initAuth = async () => {
            const hashParams = parseHashParams();

            // 해시에 토큰이 있다면 수동으로 세션 설정
            if (hashParams.access_token && hashParams.refresh_token) {
                console.log('🔑 Found tokens in hash, manually setting session...');
                try {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: hashParams.access_token,
                        refresh_token: hashParams.refresh_token,
                    });

                    if (error) {
                        console.error('❌ setSession error:', error);
                        setLoading(false);
                        return;
                    }

                    console.log('✅ Session set successfully:', data.session);
                    // 해시 제거 (깔끔한 URL 유지)
                    window.history.replaceState(null, '', window.location.pathname);
                    handleSession(data.session);
                    setLoading(false);
                    return;
                } catch (err) {
                    console.error('❌ Failed to set session from hash:', err);
                }
            }

            // 기존 세션 확인
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) console.error('❌ getSession error:', error);
            console.log('🔍 Initial getSession result:', session);
            handleSession(session);
            setLoading(false);
        };

        initAuth();

        // 인증 상태 변경 구독
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 onAuthStateChange:', event, session);
            // SIGNED_IN 이벤트일 때만 처리 (초기화는 initAuth에서 처리)
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                handleSession(session);
            } else if (event === 'SIGNED_OUT') {
                handleSession(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSession = async (session: Session | null) => {
        console.log('🔐 AuthContext: handleSession called', { session });
        if (session?.user) {
            console.log('👤 User detected:', session.user.email);
            // 도메인 체크
            if (!session.user.email?.endsWith('@forcs.com')) {
                console.warn('🚫 Domain mismatch:', session.user.email);
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
                toast.error('포시에스 계정(@forcs.com)으로만 로그인할 수 있습니다.');
                return;
            }
            console.log('✅ Session valid, setting user');
            setSession(session);
            setUser(session.user);
        } else {
            console.log('⚪ No session found in handleSession');
            setSession(null);
            setUser(null);
        }
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            },
        });

        if (error) {
            toast.error('로그인에 실패했습니다: ' + error.message);
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error('로그아웃에 실패했습니다: ' + error.message);
        } else {
            toast.success('로그아웃되었습니다.');
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
