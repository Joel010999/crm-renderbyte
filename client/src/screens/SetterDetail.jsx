import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import {
    ArrowLeft, FileSpreadsheet, Monitor, Calendar,
    Search, Instagram, MessageSquare, Clock, Star, X, History
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`;

const SetterDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [setter, setSetter] = useState(null);
    const [messages, setMessages] = useState([]);
    const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0 });

    const [filters, setFilters] = useState({ type: '', startDate: '', endDate: '' });

    // History Modal State
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [historyLog, setHistoryLog] = useState([]);

    const getInstagramUrl = (contactValue) => {
        if (!contactValue) return '#';
        if (contactValue.startsWith('http')) return contactValue;
        const handle = contactValue.replace('@', '').trim();
        return `https://www.instagram.com/${handle}`;
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

    const openHistoryModal = (msg) => {
        setSelectedMessage(msg);
        fetchHistory(msg.id);
    };

    useEffect(() => {
        fetchSetterData();
        fetchMessages();
    }, [id]);

    const fetchSetterData = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/admin/setters`);
            const s = data.find(item => item.id === parseInt(id));
            if (s) {
                setSetter(s);
                setStats({ today: s.today, week: s.week, month: s.month, total: 0 }); // Total will be set by messages length
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/setters/${id}/messages`, { params: filters });
            setMessages(res.data);
            setStats(prev => ({ ...prev, total: res.data.length }));
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = () => {
        const query = new URLSearchParams({ setterId: id, ...filters }).toString();
        window.open(`${API_URL}/admin/export?${query}`, '_blank');
    };

    if (!setter) return <div className="p-8 text-center text-accent mono animate-pulse">Retreiving Operator Data...</div>;

    return (
        <div className="min-h-screen bg-background text-gray-300 p-6">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Navigation */}
                <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 text-[10px] mono text-gray-500 hover:text-accent transition-colors uppercase"
                >
                    <ArrowLeft size={14} /> Back to Command Center
                </button>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-accent/20 border border-accent/40 rounded flex items-center justify-center text-accent">
                            <Monitor size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white uppercase tracking-tight">{setter.real_name}</h1>
                            <p className="text-sm mono text-gray-500 uppercase">Operator ID: @{setter.username} // Registered: {DateTime.fromISO(setter.created_at).toFormat('dd LLL yyyy')}</p>
                        </div>
                    </div>
                    {/* Redacted Export Button */}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="card-metric">
                        <span className="card-title">Hoy</span>
                        <div className="card-value">{stats.today}</div>
                    </div>
                    <div className="card-metric">
                        <span className="card-title">Semana</span>
                        <div className="card-value">{stats.week}</div>
                    </div>
                    <div className="card-metric">
                        <span className="card-title">Mes</span>
                        <div className="card-value">{stats.month}</div>
                    </div>
                    <div className="card-metric">
                        <span className="card-title">Total Histórico</span>
                        <div className="card-value">{stats.total}</div>
                    </div>
                </div>

                {/* History & Filters */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] mono uppercase text-accent font-bold tracking-[0.2em] flex items-center gap-2">
                            <Clock size={14} /> Transmission History
                        </h2>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 bg-panel border border-border px-3 rounded">
                                <Calendar size={14} className="text-gray-500" />
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-[10px] mono text-white p-2 focus:outline-none"
                                    value={filters.startDate}
                                    onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                />
                                <span className="text-gray-600">to</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-[10px] mono text-white p-2 focus:outline-none"
                                    value={filters.endDate}
                                    onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                />
                            </div>
                            <select
                                className="input-field w-40 text-xs py-2 h-auto"
                                value={filters.type}
                                onChange={e => setFilters({ ...filters, type: e.target.value })}
                            >
                                <option value="">TODOS LOS TIPOS</option>
                                {['nuevo', 'seguimiento', 'cliente_potencial', 'perdido'].map(t => (
                                    <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                                ))}
                            </select>
                            <button
                                onClick={fetchMessages}
                                className="bg-accent/20 border border-accent/40 text-accent px-4 text-[10px] mono rounded hover:bg-accent/30 transition-all"
                            >
                                REFRESH_LOGS
                            </button>
                        </div>
                    </div>

                    <div className="security-panel overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-border/30 border-b border-border">
                                <tr>
                                    <th className="p-4 font-bold uppercase text-gray-400">Time (Argentina)</th>
                                    <th className="p-4 font-bold uppercase text-gray-400">User / Name</th>
                                    <th className="p-4 font-bold uppercase text-gray-400">Platform</th>
                                    <th className="p-4 font-bold uppercase text-gray-400">Contact</th>
                                    <th className="p-4 font-bold uppercase text-gray-400">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {messages.map((m, i) => (
                                    <tr key={i} onClick={() => openHistoryModal(m)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                        <td className="p-4 mono text-gray-400">
                                            {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('yyyy-MM-dd HH:mm:ss')}
                                        </td>
                                        <td className="p-4 font-bold text-white uppercase tracking-wider">
                                            {m.prospect_user || '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {m.contact_type === 'instagram' ? <Instagram size={14} className="text-purple-400" /> : <MessageSquare size={14} className="text-green-400" />}
                                                <span className="uppercase font-bold">{m.contact_type}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-white">
                                            <div className="flex items-center gap-2">
                                                {m.contact_type === 'instagram' ? (
                                                    <a href={getInstagramUrl(m.contact_value)} target="_blank" className="text-purple-400 hover:underline">
                                                        {m.contact_value}
                                                    </a>
                                                ) : (
                                                    <a href={`https://wa.me/${m.contact_value.replace(/\D/g, '')}`} target="_blank" className="text-green-400 hover:underline">
                                                        {m.contact_value}
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[10px] mono uppercase text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                                {m.message_type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {messages.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-12 text-center text-gray-600 mono uppercase">No transmission logs found for selected criteria</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* History Modal */}
            {selectedMessage && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <History size={18} className="text-accent-purple" /> Historial de Cambios
                                </h3>
                                <p className="text-xs mono text-gray-500 mt-1 uppercase">
                                    Prospecto: <span className="text-white">{selectedMessage.prospect_user || 'Sin nombre'}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {historyLog.length > 0 ? (
                                <div className="space-y-4">
                                    {historyLog.map((log, i) => (
                                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                                <div className="text-[10px] mono text-gray-500">
                                                    {DateTime.fromISO(log.created_at).setZone('America/Argentina/Cordoba').toFormat('HH:mm')}
                                                </div>
                                                <div className="text-[8px] mono text-gray-600">
                                                    {DateTime.fromISO(log.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM')}
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                                                    <span className={`chip-${log.old_status === 'nuevo' ? 'teal' : log.old_status === 'seguimiento' ? 'violet' : log.old_status === 'cliente_potencial' ? 'orange' : 'red'} scale-90 origin-left`}>
                                                        {log.old_status.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-gray-600">➔</span>
                                                    <span className={`chip-${log.new_status === 'nuevo' ? 'teal' : log.new_status === 'seguimiento' ? 'violet' : log.new_status === 'cliente_potencial' ? 'orange' : 'red'} scale-90 origin-left`}>
                                                        {log.new_status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                {log.note && (
                                                    <div className="p-3 bg-black/40 rounded-lg text-xs text-gray-300 italic border border-white/5">
                                                        "{log.note}"
                                                    </div>
                                                )}
                                                <div className="text-[9px] mono text-gray-600 uppercase pt-1">
                                                    Modificado por: {log.user_name || 'Desconocido'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 mono text-xs uppercase">
                                    Sin historial de cambios registrado
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SetterDetail;
