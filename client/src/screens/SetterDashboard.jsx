import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import axios from 'axios';
import { DateTime } from 'luxon';
import {
    Send, History, Trophy, Clock, Search,
    Instagram, MessageSquare, LogOut, Activity, Crown, Medal, Cpu, Edit, Star, ChevronDown,
    FileText, X, User
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://crm.renderbyte.net/api';

const SetterDashboard = () => {
    const { user, logout } = useAuth();
    const [currentTime, setCurrentTime] = useState(DateTime.now().setZone('America/Argentina/Cordoba'));
    const [messages, setMessages] = useState([]);
    const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0 }); // Start with 0s
    const [drillDownMessages, setDrillDownMessages] = useState([]); // Store fetched drill-down messages
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [leaderboards, setLeaderboards] = useState({ today: [], week: [], month: [] });
    // Navigation State
    const [activeTab, setActiveTab] = useState('home'); // 'home', 'new', 'history', 'prospects'

    // Form State
    const [formData, setFormData] = useState({
        message_type: 'nuevo',
        contact_type: 'instagram',
        contact_value: '',
        prospect_user: ''
    });
    const [filters, setFilters] = useState({ type: '', search: '' });
    const [drillDown, setDrillDown] = useState(null); // null, 'today', 'week', 'month', 'total'
    const [editingMessage, setEditingMessage] = useState(null);

    // Prospect Search State
    const [prospectQuery, setProspectQuery] = useState('');
    const [prospectResults, setProspectResults] = useState([]);

    // History Modal State
    const [selectedProspect, setSelectedProspect] = useState(null);
    const [historyLog, setHistoryLog] = useState([]);
    const [updateNote, setUpdateNote] = useState('');
    const [updateStatus, setUpdateStatus] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(DateTime.now().setZone('America/Argentina/Cordoba'));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchData();
        fetchLeaderboards();
    }, [filters.type]);

    const fetchData = async () => {
        try {
            // Fetch Messages (Recent 100 for feed)
            const res = await axios.get(`${API_URL}/setter/messages`, {
                params: {
                    type: filters.type,
                    search: filters.search,
                    limit: 100 // Explicit limit for feed
                },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setMessages(res.data);

            // Fetch Accurate Metrics
            const metricsRes = await axios.get(`${API_URL}/setter/metrics`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setStats(metricsRes.data);

        } catch (err) {
            console.error(err);
        }
    };

    const fetchLeaderboards = async () => {
        try {
            const [t, w, m] = await Promise.all([
                axios.get(`${API_URL}/leaderboard?period=today`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${API_URL}/leaderboard?period=week`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                axios.get(`${API_URL}/leaderboard?period=month`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            ]);
            setLeaderboards({ today: t.data, week: w.data, month: m.data });
        } catch (err) {
            console.error(err);
        }
    };



    const searchProspects = async () => {
        if (!prospectQuery.trim()) {
            setProspectResults([]);
            return;
        }
        try {
            const res = await axios.get(`${API_URL}/setter/messages`, {
                params: { search: prospectQuery },
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setProspectResults(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    // Live Search Effect
    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (prospectQuery.trim()) {
                searchProspects();
            } else {
                setProspectResults([]);
            }
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [prospectQuery]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.contact_value) return alert('Contacto requerido');
        try {
            await axios.post(`${API_URL}/setter/messages`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setFormData({ ...formData, contact_value: '', prospect_user: '', message_type: 'nuevo' });
            fetchData();
            fetchLeaderboards();
        } catch (err) {
            alert('Error al registrar mensaje');
        }
    };

    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    const getInstagramUrl = (contactValue) => {
        if (!contactValue) return '#';
        if (contactValue.startsWith('http')) return contactValue;
        const handle = contactValue.replace('@', '').trim();
        return `https://www.instagram.com/${handle}`;
    };

    const handleDrillDown = async (period) => {
        setDrillDown(period);
        setDrillDownLoading(true);
        setDrillDownMessages([]);

        const now = DateTime.now().setZone('America/Argentina/Cordoba');
        let startDate = null;
        let endDate = now.endOf('day').toISO(); // Always up to now/end of today

        if (period === 'today') {
            startDate = now.startOf('day').toISO();
        } else if (period === 'week') {
            startDate = now.startOf('week').toISO();
        } else if (period === 'month') {
            startDate = now.startOf('month').toISO();
        }
        // If 'total', startDate remains null

        try {
            const res = await axios.get(`${API_URL}/setter/messages`, {
                params: { startDate, endDate }, // No limit for drill-down
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDrillDownMessages(res.data);
        } catch (err) {
            console.error(err);
            alert('Error cargando detalles');
        } finally {
            setDrillDownLoading(false);
        }
    };

    const getDrillDownBreakdown = () => {
        const counts = { nuevo: 0, seguimiento: 0, perdido: 0, cliente_potencial: 0 };
        drillDownMessages.forEach(m => {
            if (counts[m.message_type] !== undefined) counts[m.message_type]++;
        });
        return counts;
    };

    const fetchHistory = async (messageId) => {
        try {
            const res = await axios.get(`${API_URL}/setter/messages/${messageId}/history`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setHistoryLog(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const openProspectModal = (prospect) => {
        setSelectedProspect(prospect);
        setUpdateStatus(prospect.message_type);
        setUpdateNote('');
        fetchHistory(prospect.id);
    };

    const handleUpdateStatus = async () => {
        if (!updateNote.trim()) return alert('La nota es obligatoria para registrar un cambio.');
        try {
            await axios.post(`${API_URL}/setter/messages/${selectedProspect.id}/update`, {
                new_status: updateStatus,
                note: updateNote
            }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

            alert('Estado actualizado correctamente');

            // Refresh Data
            fetchData();
            fetchHistory(selectedProspect.id);
            setUpdateNote(''); // Clear note after success

            // Update selected prospect local state to reflect change immediately
            setSelectedProspect(prev => ({ ...prev, message_type: updateStatus }));

            // Also refresh search results if search is active
            if (prospectQuery) searchProspects();

        } catch (err) {
            alert('Error al actualizar estado');
        }
    };

    const renderLeaderboard = (title, data, type) => (
        <section className="space-y-3">
            <h3 className="text-[9px] mono uppercase text-gray-500 font-bold tracking-[0.15em] px-2">{title}</h3>
            <div className="security-panel p-2 space-y-1">
                {data.map((item, i) => (
                    <div key={i} className={`leaderboard-row ${i === 0 ? 'leaderboard-row-gold' : i === 1 ? 'leaderboard-row-silver' : i === 2 ? 'leaderboard-row-bronze' : ''}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] mono text-gray-500 w-4">{i + 1}</span>
                            <div className="avatar w-8 h-8 text-[10px] bg-white/10 flex items-center justify-center rounded-full">
                                <User size={14} className="text-gray-300" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-white uppercase">{item.real_name}</span>
                                <span className="text-[8px] mono text-gray-500 uppercase">@{item.username}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold mono text-accent-cyan">{item.count}</span>
                        </div>
                    </div>
                ))}
                {data.length === 0 && (
                    <div className="p-4 text-center text-[9px] mono text-gray-600 uppercase">Sin datos</div>
                )}
            </div>
        </section>
    );

    return (
        <div className="min-h-screen text-gray-300 relative">

            {/* Nav Header */}
            <header className="header-gradient p-4 sticky top-0 z-50 backdrop-blur-md hidden md:block">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <button onClick={() => setActiveTab('home')} className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
                        <img src="/assets/logo.png" alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
                        <div className="flex flex-col">
                            <img src="/assets/name.png" alt="RenderByte" className="h-4 md:h-5 object-contain" />
                            <div className="text-[8px] mono text-accent-blue font-bold tracking-[0.2em] mt-1">SETTER OPERATIONS</div>
                        </div>
                    </button>

                    <div className="flex items-center gap-4">
                        <nav className="hidden md:flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setActiveTab('new')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                👥 Perfiles Nuevos
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                💬 Historial
                            </button>
                            <button
                                onClick={() => setActiveTab('prospects')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'prospects' ? 'bg-accent-cyan text-white shadow-lg shadow-accent-cyan/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                🏷️ Prospectos
                            </button>
                        </nav>

                        <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>

                        <button onClick={logout} className="action-btn action-btn-red text-red-500">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-[1400px] mx-auto w-full p-4 lg:p-8 pb-24 md:pb-8 flex flex-col lg:flex-row gap-8 relative z-10">

                {/* Main Workspace */}
                <div className="flex-1 space-y-8">
                    {/* VIEW: HOME (STATS) */}
                    {activeTab === 'home' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Welcome Bar */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Panel de <span className="text-accent-blue">Operaciones</span></h2>
                                    <p className="text-gray-500 text-xs mt-1 mono uppercase tracking-wide">Bienvenido, Agente {user.real_name}.</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                                    <div className="flex flex-col text-right pr-4 border-r border-white/10">
                                        <span className="text-[9px] mono text-gray-500 uppercase">Local Time</span>
                                        <span className="text-sm font-bold text-white mono">{currentTime.toFormat('HH:mm')}</span>
                                    </div>
                                    <div className="w-10 h-10 bg-accent-cyan/10 rounded-full flex items-center justify-center">
                                        <Activity size={20} className="text-accent-cyan" />
                                    </div>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-[1fr_1fr] md:grid-cols-4 gap-4">
                                <div className="card-metric hover:border-accent-pink/50 transition-all duration-300 cursor-pointer group" onClick={() => handleDrillDown('today')}>
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES HOY</span>
                                        <ChevronDown size={14} className="text-gray-600 group-hover:text-accent-pink transition-colors" />
                                    </div>
                                    <div className="card-value card-value-pink">{stats.today}</div>
                                    <div className="text-[8px] mono text-gray-600 mt-2 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</div>
                                </div>
                                <div className="card-metric hover:border-accent-purple/50 transition-all duration-300 cursor-pointer group" onClick={() => handleDrillDown('week')}>
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES SEMANA</span>
                                        <ChevronDown size={14} className="text-gray-600 group-hover:text-accent-purple transition-colors" />
                                    </div>
                                    <div className="card-value card-value-purple">{stats.week}</div>
                                    <div className="text-[8px] mono text-gray-600 mt-2 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</div>
                                </div>
                                <div className="card-metric hover:border-accent-cyan/50 transition-all duration-300 cursor-pointer group" onClick={() => handleDrillDown('month')}>
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES DEL MES</span>
                                        <ChevronDown size={14} className="text-gray-600 group-hover:text-accent-cyan transition-colors" />
                                    </div>
                                    <div className="card-value card-value-cyan">{stats.month}</div>
                                    <div className="text-[8px] mono text-gray-600 mt-2 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</div>
                                </div>
                                <div className="card-metric hover:border-accent-violet/50 transition-all duration-300 cursor-pointer group" onClick={() => handleDrillDown('total')}>
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">TOTAL MENSAJES</span>
                                        <ChevronDown size={14} className="text-gray-600 group-hover:text-accent-violet transition-colors" />
                                    </div>
                                    <div className="card-value card-value-violet">{stats.total}</div>
                                    <div className="text-[8px] mono text-gray-600 mt-2 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</div>
                                </div>
                            </div>

                            {/* Leaderboard Global (Horizontal) */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 px-2">
                                    <Trophy size={16} className="text-gold" />
                                    <h2 className="text-[10px] mono uppercase text-white font-bold tracking-[0.2em]">Leaderboard Global</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {renderLeaderboard("TOP 3 DÍA (MSG)", leaderboards.today, 'today')}
                                    {renderLeaderboard("TOP 3 SEMANA (MSG)", leaderboards.week, 'week')}
                                    {renderLeaderboard("TOP 3 MES (MSG)", leaderboards.month, 'month')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content Area based on Active Tab */}
                    <div className="mt-6">
                        {/* VIEW: NEW PROFILE (FORM) */}
                        {activeTab === 'new' && (
                            <section className="space-y-4 max-w-2xl mx-auto" id="form-section">
                                <h2 className="text-[11px] mono uppercase text-white font-bold tracking-[0.2em] flex items-center gap-2">
                                    <Send size={14} className="text-accent-blue" /> Registrar Mensaje Enviado
                                </h2>
                                <div className="security-panel p-6 space-y-5">
                                    {/* Current time display */}
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-background/40 border border-white/5">
                                        <Clock size={20} className="text-accent-blue" />
                                        <div>
                                            <div className="text-[11px] font-bold text-white uppercase tracking-wider">{currentTime.toFormat('cccc, dd/MM')}</div>
                                            <div className="text-[9px] mono text-gray-500 uppercase">Horario Argentina (Central)</div>
                                        </div>
                                        <div className="ml-auto text-xl font-bold mono text-accent-blue">{currentTime.toFormat('HH:mm')}</div>
                                    </div>

                                    <form onSubmit={handleSave} className="space-y-4">
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] mono uppercase text-gray-400 tracking-wider">TIPO DE MENSAJE</label>
                                                <select
                                                    className="input-field appearance-none cursor-pointer"
                                                    value={formData.message_type}
                                                    onChange={e => setFormData({ ...formData, message_type: e.target.value })}
                                                >
                                                    {['nuevo', 'seguimiento', 'cliente_potencial', 'perdido'].map(t => (
                                                        <option key={t} value={t} className="bg-panel">{t.toUpperCase()}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Prospect User / Name field */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] mono uppercase text-gray-400 tracking-wider">
                                                USUARIO IG O NOMBRE
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="input-field px-5 py-4 text-base md:text-sm"
                                                    placeholder="@usuario o Nombre"
                                                    value={formData.prospect_user}
                                                    onChange={e => setFormData({ ...formData, prospect_user: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Instagram field */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] mono uppercase text-gray-400 tracking-wider">
                                                INSTAGRAM (DESTINATARIO)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className={`input-field px-5 py-4 ${formData.contact_type !== 'instagram' ? 'opacity-50' : ''}`}
                                                    placeholder="handle o URL"
                                                    value={formData.contact_type === 'instagram' ? formData.contact_value : ''}
                                                    onChange={e => setFormData({ ...formData, contact_type: 'instagram', contact_value: e.target.value })}
                                                    disabled={formData.contact_type !== 'instagram' && formData.contact_value !== ''}
                                                />
                                            </div>
                                        </div>

                                        {/* WhatsApp field */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] mono uppercase text-gray-400 tracking-wider">
                                                NÚMERO / WHATSAPP (DESTINATARIO)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className={`input-field px-5 py-4 ${formData.contact_type !== 'whatsapp' ? 'opacity-50' : ''}`}
                                                    placeholder="Ej: +54 9 351..."
                                                    value={formData.contact_type === 'whatsapp' ? formData.contact_value : ''}
                                                    onChange={e => setFormData({ ...formData, contact_type: 'whatsapp', contact_value: e.target.value })}
                                                    disabled={formData.contact_type !== 'whatsapp' && formData.contact_value !== ''}
                                                />
                                            </div>
                                        </div>

                                        <button type="submit" className="btn-blue w-full flex items-center justify-center gap-2 py-3 mt-2">
                                            <Send size={16} /> REGISTRAR MENSAJE
                                        </button>
                                    </form>
                                </div>
                            </section>
                        )}

                        {/* VIEW: HISTORY */}
                        {activeTab === 'history' && (
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[11px] mono uppercase text-accent-purple font-bold tracking-[0.2em] flex items-center gap-2">
                                        <History size={14} /> HISTORIAL DE MENSAJES
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] mono uppercase text-gray-500">FILTRAR POR:</span>
                                        <select
                                            className="input-field w-28 text-sm py-2 px-3 appearance-none"
                                            value={filters.type}
                                            onChange={e => setFilters({ ...filters, type: e.target.value })}
                                            onBlur={fetchData}
                                        >
                                            <option value="" className="bg-panel">TODOS</option>
                                            {['nuevo', 'seguimiento', 'cliente_potencial', 'perdido'].map(t => (
                                                <option key={t} value={t} className="bg-panel">{t.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="security-panel flex flex-col h-[600px]">
                                    <div className="p-4 border-b border-border hidden md:block">
                                        <div className="grid grid-cols-4 gap-4 text-[9px] mono uppercase text-gray-500 font-bold tracking-wider">
                                            <span>FECHA / HORA</span>
                                            <span className="col-span-1">USUARIO IG / NOMBRE</span>
                                            <span>CONTACTO</span>
                                            <span className="text-right">TIPO</span>
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                        {messages.map((m, i) => (
                                            <div key={i} className="bg-white/5 md:bg-transparent border border-white/5 md:border-none p-3 rounded-lg hover:bg-white/5 transition-colors flex flex-col md:grid md:grid-cols-4 gap-2 md:gap-4 md:items-center">

                                                {/* Mobile Header: Date & Type */}
                                                <div className="flex items-center justify-between md:hidden">
                                                    <div className="text-[10px] mono text-gray-400">
                                                        {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                    </div>
                                                    <span className={`chip-${m.message_type === 'nuevo' ? 'teal' : m.message_type === 'seguimiento' ? 'violet' : m.message_type === 'cliente_potencial' ? 'orange' : 'red'} scale-90`}>
                                                        {m.message_type.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </div>

                                                {/* Desktop: Date */}
                                                <div className="text-[11px] mono text-gray-400 hidden md:block">
                                                    {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                </div>

                                                {/* Prospect User / Name Column */}
                                                <div className="text-[13px] md:text-[11px] font-bold text-white truncate flex items-center justify-between md:block">
                                                    {m.prospect_user || '-'}

                                                    {/* Mobile Edit Button */}
                                                    <button
                                                        onClick={() => setEditingMessage(m)}
                                                        className="md:hidden p-2 rounded-lg bg-white/5 text-gray-400"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {m.contact_type === 'instagram' ? (
                                                        <Instagram size={14} className="text-purple-400 shrink-0" />
                                                    ) : (
                                                        <MessageSquare size={14} className="text-green-400 shrink-0" />
                                                    )}
                                                    <div className="flex flex-col overflow-hidden">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs font-medium text-gray-300 truncate">
                                                                {m.contact_type === 'instagram' ? (
                                                                    <a href={getInstagramUrl(m.contact_value)} target="_blank" className="hover:underline hover:text-white transition-colors">
                                                                        {m.contact_value}
                                                                    </a>
                                                                ) : (
                                                                    <a href={`https://wa.me/${m.contact_value.replace(/\D/g, '')}`} target="_blank" className="hover:underline hover:text-white transition-colors">
                                                                        {m.contact_value}
                                                                    </a>
                                                                )}
                                                            </span>
                                                        </div>
                                                        {m.updated_at && (
                                                            <span className="text-[7px] text-gray-500 mono uppercase tracking-widest">
                                                                {DateTime.fromISO(m.updated_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="hidden md:flex items-center justify-end gap-3">
                                                    <span className={`chip-${m.message_type === 'nuevo' ? 'teal' : m.message_type === 'seguimiento' ? 'violet' : m.message_type === 'cliente_potencial' ? 'orange' : 'red'}`}>
                                                        {m.message_type.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingMessage(m)}
                                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                                        title="Editar estado"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {messages.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                                                <Activity size={32} />
                                                <span className="text-[10px] mono uppercase tracking-widest">Sin actividad registrada</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* VIEW: PROSPECTS */}
                        {activeTab === 'prospects' && (
                            <section className="space-y-3 max-w-3xl mx-auto">
                                <div className="flex items-center gap-2 px-2">
                                    <Search size={14} className="text-gray-500" />
                                    <h3 className="text-[9px] mono uppercase text-gray-500 font-bold tracking-[0.15em]">BUSCADOR DE PROSPECTOS</h3>
                                </div>
                                <div className="security-panel p-6 space-y-6">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            className="input-field px-4 py-4 text-base md:text-sm w-full transition-all group-hover:border-white/20 focus:border-accent-cyan"
                                            placeholder=""
                                            value={prospectQuery}
                                            onChange={e => {
                                                setProspectQuery(e.target.value);
                                                if (!e.target.value) setProspectResults([]);
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && searchProspects()}
                                            autoFocus
                                        />
                                        <button
                                            onClick={searchProspects}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/5 hover:bg-accent-cyan/20 text-gray-400 hover:text-accent-cyan rounded-lg transition-all"
                                        >
                                            <span className="text-[10px] font-bold uppercase">Buscar</span>
                                        </button>
                                    </div>

                                    {prospectResults.length > 0 ? (
                                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                                            <h4 className="text-[10px] mono uppercase text-gray-500 mb-2">Resultados ({prospectResults.length})</h4>
                                            {prospectResults.map((p, i) => (
                                                <div key={i} onClick={() => openProspectModal(p)} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-accent-cyan/30 cursor-pointer transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.contact_type === 'instagram' ? 'bg-purple-500/10 text-purple-500' : 'bg-green-500/10 text-green-500'}`}>
                                                            {p.contact_type === 'instagram' ? <Instagram size={20} /> : <MessageSquare size={20} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-white transition-colors group-hover:text-accent-cyan">{p.prospect_user || 'Sin nombre'}</span>
                                                            </div>
                                                            <div className="text-xs mono text-gray-400">{p.contact_value}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right hidden sm:block">
                                                            <div className="text-[10px] mono text-gray-500">{DateTime.fromISO(p.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM/yyyy')}</div>
                                                            <div className="text-[10px] mono text-gray-600">{DateTime.fromISO(p.created_at).setZone('America/Argentina/Cordoba').toFormat('HH:mm')} hs</div>
                                                        </div>
                                                        <span className={`chip-${p.message_type === 'nuevo' ? 'teal' : p.message_type === 'seguimiento' ? 'violet' : p.message_type === 'cliente_potencial' ? 'orange' : 'red'}`}>
                                                            {p.message_type.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : prospectQuery && (
                                        <div className="text-center py-12 border-t border-white/5 mt-4">
                                            <Search size={48} className="mx-auto text-gray-700 mb-4" />
                                            <p className="text-gray-500 text-sm">No se encontraron resultados</p>
                                            <p className="text-gray-600 text-xs mt-1">Intenta con otro término de búsqueda</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

            </main >

            {/* Drill-down Modal */}
            {
                drillDown && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDrillDown(null)}>
                        <div className="security-panel w-full max-w-4xl max-h-[85vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div>
                                    <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                        Detalle: {drillDown === 'today' ? 'Hoy' : drillDown === 'week' ? 'Semana' : drillDown === 'month' ? 'Mes' : 'Total'}
                                    </h2>
                                    <p className="text-[10px] mono text-gray-500">
                                        {drillDownMessages.length} mensajes encontrados
                                    </p>
                                </div>
                                <button onClick={() => setDrillDown(null)} className="action-btn">
                                    <LogOut size={18} className="text-gray-400 rotate-180" />
                                </button>
                            </div>

                            {/* Breakdown Counters */}
                            {!drillDownLoading && (
                                <div className="px-6 py-4 bg-background/50 border-b border-border flex flex-wrap justify-center gap-4">
                                    {Object.entries(getDrillDownBreakdown()).map(([key, count]) => (
                                        <div key={key} className="flex flex-col items-center bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                                            <span className="text-[9px] mono uppercase text-gray-500 tracking-wider mb-1">{key.replace('_', ' ')}</span>
                                            <span className={`text-lg font-bold mono ${key === 'nuevo' ? 'text-teal-400' : key === 'seguimiento' ? 'text-indigo-400' : key === 'cliente_potencial' ? 'text-orange-400' : 'text-red-400'}`}>
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4">
                                {drillDownLoading ? (
                                    <div className="flex items-center justify-center py-12 text-gray-500 mono text-xs uppercase animate-pulse">
                                        Cargando datos históricos...
                                    </div>
                                ) : (
                                    <>
                                        <div className="hidden md:grid grid-cols-3 gap-4 text-[9px] mono uppercase text-gray-500 font-bold tracking-wider p-3 border-b border-white/5">
                                            <span>Fecha / Hora</span>
                                            <span>Contacto</span>
                                            <span className="text-right">Tipo</span>
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {drillDownMessages.map((m, i) => (
                                                <div key={i} className="flex flex-col md:grid md:grid-cols-3 gap-2 md:gap-4 md:items-center p-3 rounded-lg hover:bg-white/5 transition-colors bg-white/5 md:bg-transparent border border-white/5 md:border-none">
                                                    {/* Mobile Header: Date & Type */}
                                                    <div className="flex items-center justify-between md:hidden pb-2 border-b border-white/5 mb-2">
                                                        <div className="text-[10px] mono text-gray-400">
                                                            {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                        </div>
                                                        <span className={`chip-${m.message_type === 'nuevo' ? 'teal' : m.message_type === 'seguimiento' ? 'violet' : m.message_type === 'cliente_potencial' ? 'orange' : 'red'} scale-90`}>
                                                            {m.message_type.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] mono text-gray-400 hidden md:block">
                                                        {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                    </div>
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            {m.contact_type === 'instagram' ? (
                                                                <Instagram size={14} className="text-purple-400 shrink-0" />
                                                            ) : (
                                                                <MessageSquare size={14} className="text-green-400 shrink-0" />
                                                            )}
                                                            <span className="text-xs font-medium text-white truncate">{m.contact_value}</span>
                                                        </div>
                                                    </div>
                                                    <div className="hidden md:flex items-center justify-end gap-2">
                                                        <span className={`chip-${m.message_type === 'nuevo' ? 'teal' : m.message_type === 'seguimiento' ? 'violet' : m.message_type === 'cliente_potencial' ? 'orange' : 'red'}`}>
                                                            {m.message_type.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                        <button
                                                            onClick={() => setEditingMessage(m)}
                                                            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                                            title="Editar estado"
                                                        >
                                                            <Edit size={12} />
                                                        </button>
                                                    </div>

                                                    {/* Mobile Edit Button (Footer) */}
                                                    <div className="md:hidden flex items-center justify-end pt-2">
                                                        <button
                                                            onClick={() => setEditingMessage(m)}
                                                            className="text-xs text-gray-400 flex items-center gap-1 hover:text-white"
                                                        >
                                                            <Edit size={12} /> Editar Estado
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Edit Message Type Modal */}
            {
                editingMessage && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setEditingMessage(null)}>
                        <div className="security-panel w-full max-w-sm p-6 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cambiar Estado</h3>
                                <button onClick={() => setEditingMessage(null)} className="text-gray-500 hover:text-white">
                                    <LogOut size={16} className="rotate-180" />
                                </button>
                            </div>

                            <div className="text-[10px] mono text-gray-500 uppercase">
                                Contacto: {editingMessage.contact_value}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {['nuevo', 'seguimiento', 'cliente_potencial', 'perdido'].map(type => (
                                    <button
                                        key={type}
                                        onClick={async () => {
                                            try {
                                                await axios.patch(`${API_URL}/setter/messages/${editingMessage.id}`, { message_type: type }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                                                setEditingMessage(null);
                                                fetchData();
                                            } catch (err) {
                                                alert('Error al actualizar: ' + (err.response?.data?.error || err.message));
                                            }
                                        }}
                                        className={`p-3 rounded-lg border text-[11px] font-bold uppercase transition-all flex items-center justify-between group ${editingMessage.message_type === type
                                            ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        {type.replace('_', ' ')}
                                        {editingMessage.message_type === type && <Activity size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* History & Status Update Modal */}
            {
                selectedProspect && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setSelectedProspect(null)}>
                        <div className="security-panel w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div>
                                    <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                        {selectedProspect.prospect_user || 'Sin Nombre'}
                                    </h2>
                                    <a href={selectedProspect.contact_value} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-cyan hover:underline flex items-center gap-1 mt-1">
                                        {selectedProspect.contact_value}
                                        <Edit size={12} />
                                    </a>
                                </div>
                                <button onClick={() => setSelectedProspect(null)} className="action-btn">
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                                {/* Update Status Section */}
                                <section className="space-y-4">
                                    <h3 className="text-[10px] mono uppercase text-gray-500 font-bold tracking-wider flex items-center gap-2">
                                        <Edit size={12} /> Actualizar Estado
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] mono text-gray-400 uppercase">Estado Actual</label>
                                                <div className="p-2 bg-black/20 rounded border border-white/10 text-xs text-gray-300">
                                                    {selectedProspect.message_type.replace('_', ' ').toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] mono text-gray-400 uppercase">Nuevo Estado</label>
                                                <select
                                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white focus:border-accent-cyan outline-none"
                                                    value={updateStatus}
                                                    onChange={e => setUpdateStatus(e.target.value)}
                                                >
                                                    <option value="nuevo">NUEVO</option>
                                                    <option value="seguimiento">SEGUIMIENTO</option>
                                                    <option value="cliente_potencial">CLIENTE POTENCIAL</option>
                                                    <option value="perdido">PERDIDO</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] mono text-gray-400 uppercase">Nota de Actualización (Obligatoria)</label>
                                            <textarea
                                                className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm text-white focus:border-accent-cyan outline-none min-h-[80px]"
                                                placeholder="Escribe el motivo del cambio..."
                                                value={updateNote}
                                                onChange={e => setUpdateNote(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            onClick={handleUpdateStatus}
                                            className="w-full py-3 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            Guardar Cambio
                                        </button>
                                    </div>
                                </section>

                                {/* History Section */}
                                <section className="space-y-4">
                                    <h3 className="text-[10px] mono uppercase text-gray-500 font-bold tracking-wider flex items-center gap-2">
                                        <History size={12} /> Historial de Cambios
                                    </h3>
                                    <div className="space-y-2">
                                        {historyLog.length > 0 ? (
                                            historyLog.map((log, i) => (
                                                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex gap-2 items-center">
                                                            <div className="text-[10px] mono text-accent-cyan font-bold">{log.user_name}</div>
                                                            <div className="text-[10px] text-gray-500">• {DateTime.fromISO(log.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] font-bold">
                                                            <span className={`text-${log.old_status === 'nuevo' ? 'teal' : log.old_status === 'seguimiento' ? 'indigo' : log.old_status === 'cliente_potencial' ? 'orange' : 'red'}-400`}>{log.old_status.replace('_', ' ').toUpperCase()}</span>
                                                            <span className="text-gray-500">→</span>
                                                            <span className={`text-${log.new_status === 'nuevo' ? 'teal' : log.new_status === 'seguimiento' ? 'indigo' : log.new_status === 'cliente_potencial' ? 'orange' : 'red'}-400`}>{log.new_status.replace('_', ' ').toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-300 italic border-l-2 border-white/10 pl-2">
                                                        "{log.note}"
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 text-xs italic">
                                                Sin historial de cambios registrado.
                                            </div>
                                        )}
                                    </div>
                                </section>

                            </div>
                        </div>
                    </div>
                )
            }
            {/* Mobile Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 md:hidden z-50 flex items-center justify-between safe-area-bottom">

                {/* 1. Perfiles Nuevos */}
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'new' ? 'text-accent-blue scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeTab === 'new' ? 'bg-accent-blue/10 shadow-glow-sm' : ''}`}>
                        <Send size={24} />
                    </div>
                </button>

                {/* 2. Historial */}
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-accent-purple scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeTab === 'history' ? 'bg-accent-purple/10 shadow-glow-sm' : ''}`}>
                        <History size={24} />
                    </div>
                </button>

                {/* 3. INICIO (Logo Central) */}
                <button
                    onClick={() => setActiveTab('home')}
                    className="relative -top-6 transform transition-transform active:scale-95"
                >
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-tr from-accent-blue to-accent-purple p-[2px] shadow-lg shadow-accent-purple/30 ${activeTab === 'home' ? 'ring-2 ring-white/20' : ''}`}>
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center backdrop-blur-sm">
                            <img src="/assets/logo.png" alt="Home" className="w-8 h-8 object-contain" />
                        </div>
                    </div>
                </button>

                {/* 4. Prospectos (Tag/Ticket) */}
                <button
                    onClick={() => setActiveTab('prospects')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'prospects' ? 'text-accent-cyan scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeTab === 'prospects' ? 'bg-accent-cyan/10 shadow-glow-sm' : ''}`}>
                        <FileText size={24} />
                    </div>
                </button>

                {/* 5. Logout */}
                <button
                    onClick={logout}
                    className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-500 transition-colors"
                >
                    <div className="p-2">
                        <LogOut size={24} />
                    </div>
                </button>
            </nav>
        </div >
    );
};

export default SetterDashboard;
