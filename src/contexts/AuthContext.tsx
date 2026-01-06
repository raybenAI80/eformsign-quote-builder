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
        // 현재 세션 가져오기
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) console.error('❌ getSession error:', error);
            console.log('🔍 Initial getSession result:', session);
            handleSession(session);
            setLoading(false);
        });

        // 인증 상태 변경 구독
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 onAuthStateChange:', event, session);
            handleSession(session);
            setLoading(false);
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
