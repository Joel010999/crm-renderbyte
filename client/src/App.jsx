import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Screens
import Login from './screens/Login';
import AdminDashboard from './screens/AdminDashboard';
import SetterDashboard from './screens/SetterDashboard';
import SetterDetail from './screens/SetterDetail';
import ParticleBackground from './components/ParticleBackground';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`;

// Axios Interceptor for tokens
axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));

const AppContent = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/me`);
            setUser(data);
        } catch (err) {
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const { data } = await axios.post(`${API_URL}/auth/login`, { username, password });
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="mono text-accent animate-pulse">ESTABLISHING CONNECTION...</div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            <ParticleBackground />
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'admin' ? '/admin' : '/setter'} />} />

                    <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
                    <Route path="/admin/setter/:id" element={user?.role === 'admin' ? <SetterDetail /> : <Navigate to="/login" />} />

                    <Route path="/setter" element={user?.role === 'setter' ? <SetterDashboard /> : <Navigate to="/login" />} />

                    <Route path="/" element={<Navigate to="/login" />} />
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    );
};

export default function App() {
    return <AppContent />;
}
