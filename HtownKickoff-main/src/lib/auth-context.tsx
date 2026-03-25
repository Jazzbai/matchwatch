"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, setAccessToken, getAccessToken, type AuthUser, ApiClientError } from './api';

// ─── Auth Context ───────────────────────────────

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    registerVenue: (input: {
        email: string;
        password: string;
        name: string;
        venue?: {
            name: string;
            address: string;
            city: string;
            country: string;
            lat: number;
            lng: number;
            timezone: string;
            phone?: string;
            description?: string;
            shortDescription?: string;
            amenities?: string[];
            vibes?: string[];
            cuisineTags?: string[];
            priceRange?: 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY';
            capacity?: number;
            googlePlaceId?: string;
        };
        claimVenueId?: string;
        claimNotes?: string;
        claimVerificationDocuments?: string[];
    }) => Promise<{
        message: string;
        businessApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
        venueApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
        claimStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
        venue?: { id: string; name: string; slug: string };
    }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    error: string | null;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Auth Provider ──────────────────────────────

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Try to restore session on mount
    useEffect(() => {
        const token = getAccessToken();
        if (token) {
            // Attempt to get user profile
            import('./api').then(({ api }) => {
                api.get<{
                    id: string;
                    email: string;
                    name: string;
                    role: string;
                    avatarUrl?: string;
                    timezone?: string;
                    businessApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
                    businessApprovalNotes?: string | null;
                }>('/user/me')
                    .then((res) => {
                        setUser(res.data);
                    })
                    .catch(() => {
                        // Token expired or invalid, try refresh
                        authApi.refresh()
                            .then((res) => {
                                setAccessToken(res.data.accessToken);
                                return import('./api').then(({ api }) => api.get<AuthUser>('/user/me'));
                            })
                            .then((res) => setUser(res.data))
                            .catch(() => {
                                setAccessToken(null);
                                setUser(null);
                            });
                    })
                    .finally(() => setIsLoading(false));
            });
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setError(null);
        setIsLoading(true);
        try {
            const res = await authApi.login({ email: email.trim().toLowerCase(), password });
            setAccessToken(res.data.accessToken);
            setUser(res.data.user);
        } catch (err) {
            const message = err instanceof ApiClientError ? err.message : 'Login failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (email: string, password: string, name: string) => {
        setError(null);
        setIsLoading(true);
        try {
            await authApi.register({ email: email.trim().toLowerCase(), password, name: name.trim() });
        } catch (err) {
            const message = err instanceof ApiClientError ? err.message : 'Registration failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const registerVenue = useCallback(async (input: {
        email: string;
        password: string;
        name: string;
        venue?: {
            name: string;
            address: string;
            city: string;
            country: string;
            lat: number;
            lng: number;
            timezone: string;
            phone?: string;
            description?: string;
            shortDescription?: string;
            amenities?: string[];
            vibes?: string[];
            cuisineTags?: string[];
            priceRange?: 'BUDGET' | 'MID' | 'UPSCALE' | 'LUXURY';
            capacity?: number;
            googlePlaceId?: string;
        };
        claimVenueId?: string;
        claimNotes?: string;
        claimVerificationDocuments?: string[];
    }) => {
        setError(null);
        setIsLoading(true);
        try {
            const res = await authApi.registerVenue({
                ...input,
                email: input.email.trim().toLowerCase(),
                name: input.name.trim(),
            });
            return res.data;
        } catch (err) {
            const message = err instanceof ApiClientError ? err.message : 'Venue registration failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore errors on logout
        } finally {
            setAccessToken(null);
            setUser(null);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        const token = getAccessToken();
        if (!token) {
            setUser(null);
            return;
        }
        const { api } = await import('./api');
        const res = await api.get<AuthUser>('/user/me');
        setUser(res.data);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            registerVenue,
            logout,
            refreshUser,
            error,
            clearError,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
