import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(undefined);

const LOCAL_AUTH_KEY = 'book_local_auth';

const getLocalAuth = () => {
	try {
		const raw = localStorage.getItem(LOCAL_AUTH_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
};

const setLocalAuth = (payload) => {
	if (!payload) {
		localStorage.removeItem(LOCAL_AUTH_KEY);
		return;
	}
	localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(payload));
};

export const AuthProvider = ({ children }) => {
	const { toast } = useToast();

	const [user, setUser] = useState(null);
	const [session, setSession] = useState(null);
	const [loading, setLoading] = useState(true);

	const handleSession = useCallback((nextSession) => {
		setSession(nextSession);
		setUser(nextSession?.user ?? null);
		setLoading(false);
	}, []);

	useEffect(() => {
		const loadSession = async () => {
			const localAuth = getLocalAuth();
			if (localAuth?.email) {
				const localUser = {
					email: localAuth.email,
					app_metadata: { role: localAuth.role || 'admin', provider: 'local' },
					user_metadata: {},
				};
				setSession({ user: localUser });
				setUser(localUser);
				setLoading(false);
				return;
			}

			const {
				data: { session: currentSession },
			} = await supabase.auth.getSession();
			handleSession(currentSession);
		};

		loadSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, newSession) => {
			const localAuth = getLocalAuth();
			if (localAuth?.email) {
				return;
			}
			handleSession(newSession);
		});

		return () => subscription.unsubscribe();
	}, [handleSession]);

	const signUp = useCallback(async (email, password, options) => {
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options,
		});

		if (error) {
			toast({
				variant: 'destructive',
				title: 'Sign up Failed',
				description: error.message || 'Something went wrong',
			});
		}

		return { error };
	}, [toast]);

	const signIn = useCallback(async (email, password) => {
		setLocalAuth(null);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			toast({
				variant: 'destructive',
				title: 'Sign in Failed',
				description: error.message || 'Something went wrong',
			});
		}

		return { error };
	}, [toast]);

	const signInLocal = useCallback((email, role = 'admin') => {
		const localUser = {
			email,
			app_metadata: { role, provider: 'local' },
			user_metadata: {},
		};
		setLocalAuth({ email, role });
		setSession({ user: localUser });
		setUser(localUser);
		setLoading(false);
		return { error: null };
	}, []);

	const signOut = useCallback(async () => {
		const localAuth = getLocalAuth();
		if (localAuth?.email) {
			setLocalAuth(null);
			setSession(null);
			setUser(null);
			setLoading(false);
			return { error: null };
		}

		const { error } = await supabase.auth.signOut();

		if (error) {
			toast({
				variant: 'destructive',
				title: 'Sign out Failed',
				description: error.message || 'Something went wrong',
			});
		}

		return { error };
	}, [toast]);

	const value = useMemo(
		() => ({
			user,
			session,
			loading,
			signUp,
			signIn,
			signInLocal,
			signOut,
		}),
		[user, session, loading, signUp, signIn, signInLocal, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
