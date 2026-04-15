import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { DateTime } from 'luxon';
import {
    Users, UserPlus, BarChart3, PieChart, Activity,
    Trash2, Key, Edit, Monitor, FileSpreadsheet, LogOut, ChevronDown, ChevronUp, Download,
    X, Instagram, MessageSquare, Clock, Cpu, Calendar, Star, User
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`;

const AdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'backups'
    const [setters, setSetters] = useState([]);
    const [metrics, setMetrics] = useState({ today: null, week: null, month: null });
    const [lifetimeBreakdown, setLifetimeBreakdown] = useState([]);
    const [expandedMetric, setExpandedMetric] = useState(null);

    // Backup State
    const [backupRange, setBackupRange] = useState({
        start: DateTime.now().setZone('America/Argentina/Cordoba').startOf('week').toISODate(),
        end: DateTime.now().setZone('America/Argentina/Cordoba').toISODate()
    });
    const [backupLoading, setBackupLoading] = useState(false);

    // Modal for detailed messages
    const [modalOpen, setModalOpen] = useState(false);
    const [modalPeriod, setModalPeriod] = useState(null);
    const [modalData, setModalData] = useState({ messages: [], breakdown: [], total: 0 });
    const [modalLoading, setModalLoading] = useState(false);

    // Automatic Backups state
    const [autoBackups, setAutoBackups] = useState([]);
    const [autoBackupsLoading, setAutoBackupsLoading] = useState(false);

    // Form state
    const [formError, setFormError] = useState('');
    const [newSetter, setNewSetter] = useState({ username: '', password: '', real_name: '' });

    const getInstagramUrl = (contactValue) => {
        if (!contactValue) return '#';
        if (contactValue.startsWith('http')) return contactValue;
        const handle = contactValue.replace('@', '').trim();
        return `https://www.instagram.com/${handle}`;
    };

    useEffect(() => {
        fetchData();
        fetchAutoBackups();
    }, []);

    const fetchAutoBackups = async () => {
        try {
            setAutoBackupsLoading(true);
            const { data } = await axios.get(`${API_URL}/admin/backups`);
            setAutoBackups(data);
        } catch (err) {
            console.error('Error fetching auto backups:', err);
        } finally {
            setAutoBackupsLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            const [settersRes, lBreakdown] = await Promise.all([
                axios.get(`${API_URL}/admin/setters`),
                axios.get(`${API_URL}/admin/breakdown/lifetime`)
            ]);
            setSetters(settersRes.data);
            setLifetimeBreakdown(lBreakdown.data);

            const [todayM, weekM, monthM] = await Promise.all([
                axios.get(`${API_URL}/admin/metrics?period=today`),
                axios.get(`${API_URL}/admin/metrics?period=week`),
                axios.get(`${API_URL}/admin/metrics?period=month`)
            ]);
            setMetrics({ today: todayM.data, week: weekM.data, month: monthM.data });
        } catch (err) {
            console.error(err);
        }
    };

    const handleGenerateBackup = async () => {
        try {
            const query = new URLSearchParams({
                startDate: backupRange.start,
                endDate: backupRange.end
            }).toString();

            setBackupLoading(true);
            const response = await axios.get(`${API_URL}/admin/export?${query}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `RenderByte_Backup_${backupRange.start}_${backupRange.end}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Error al descargar el backup');
        } finally {
            setBackupLoading(false);
        }
    };

    const handleDownloadAutoBackup = async (filename) => {
        try {
            const response = await axios.get(`${API_URL}/admin/backups/download/${filename}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Error al descargar el backup guardado');
        }
    };

    const setPreset = (preset) => {
        const now = DateTime.now().setZone('America/Argentina/Cordoba');
        if (preset === 'thisWeek') {
            setBackupRange({ start: now.startOf('week').toISODate(), end: now.toISODate() });
        } else if (preset === 'lastWeek') {
            const lastWeek = now.minus({ weeks: 1 });
            setBackupRange({
                start: lastWeek.startOf('week').toISODate(),
                end: lastWeek.endOf('week').toISODate()
            });
        } else if (preset === 'thisMonth') {
            setBackupRange({ start: now.startOf('month').toISODate(), end: now.toISODate() });
        }
    };

    const openModal = async (period) => {
        setModalPeriod(period);
        setModalOpen(true);
        setModalLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/admin/messages?period=${period}`);
            setModalData(data);
        } catch (err) {
            console.error(err);
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalPeriod(null);
        setModalData({ messages: [], breakdown: [], total: 0 });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            await axios.post(`${API_URL}/admin/setters`, newSetter);
            setNewSetter({ username: '', password: '', real_name: '' });
            fetchData();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Error creating setter');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Desactivar este setter? No podrá iniciar sesión.')) {
            await axios.delete(`${API_URL}/admin/setters/${id}`);
            fetchData();
        }
    };

    const getPeriodLabel = (p) => {
        if (p === 'today') return 'HOY';
        if (p === 'week') return 'SEMANA (Lun-Dom)';
        if (p === 'month') return 'MES ACTUAL';
        return '';
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.split(' ');
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="min-h-screen text-gray-300 relative">

            {/* Header */}
            <nav className="header-gradient p-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 relative gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <img src="/assets/logo.png" alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
                        <div className="flex flex-col">
                            <img src="/assets/name.png" alt="RenderByte" className="h-4 md:h-5 object-contain" />
                            <div className="text-[8px] mono text-accent-pink font-bold tracking-[0.2em] mt-1 uppercase">Central Intelligence</div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
                    {/* Navigation Tabs */}
                    <div className="flex items-center bg-background/40 p-1 rounded-lg border border-white/5 w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-[9px] md:text-[10px] mono uppercase tracking-wider transition-all ${activeTab === 'dashboard' ? 'bg-accent-pink text-white shadow-glow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('backups')}
                            className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-[9px] md:text-[10px] mono uppercase tracking-wider transition-all ${activeTab === 'backups' ? 'bg-accent-pink text-white shadow-glow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Backups
                        </button>
                    </div>

                    <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 border-t border-white/5 md:border-none pt-4 md:pt-0">
                        <div className="text-left md:text-right">
                            <div className="text-xs md:text-sm font-bold text-white">Admin</div>
                            <div className="text-[8px] md:text-[9px] mono text-accent-pink font-bold tracking-[0.2em] mt-1">SYSTEM ADMINISTRATION</div>
                        </div>
                        <button onClick={logout} className="btn-outline-red flex items-center gap-2 text-[9px] px-3 py-1.5">
                            <LogOut size={12} /> Salir
                        </button>
                    </div>
                </div>
            </nav>

            <main className="p-6 max-w-7xl mx-auto space-y-8 relative z-10">

                {activeTab === 'dashboard' ? (
                    <>
                        {/* 1) GLOBAL METRICS */}
                        <section className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Today */}
                                <div className="card-metric">
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES GLOBAL HOY</span>
                                    </div>
                                    <div className="card-value card-value-pink">{metrics.today?.total || 0}</div>
                                    <button
                                        onClick={() => openModal('today')}
                                        className="mt-3 text-[10px] mono text-accent-pink hover:text-white transition-colors uppercase flex items-center gap-1"
                                    >
                                        VER MÁS <ChevronDown size={12} />
                                    </button>
                                </div>

                                {/* Week */}
                                <div className="card-metric">
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES GLOBAL SEMANA</span>
                                    </div>
                                    <div className="card-value card-value-purple">{metrics.week?.total || 0}</div>
                                    <button
                                        onClick={() => openModal('week')}
                                        className="mt-3 text-[10px] mono text-accent-purple hover:text-white transition-colors uppercase flex items-center gap-1"
                                    >
                                        VER MÁS <ChevronDown size={12} />
                                    </button>
                                </div>

                                {/* Month */}
                                <div className="card-metric">
                                    <div className="flex justify-between items-start">
                                        <span className="card-title">MENSAJES GLOBAL MES</span>
                                    </div>
                                    <div className="card-value card-value-cyan">{metrics.month?.total || 0}</div>
                                    <button
                                        onClick={() => openModal('month')}
                                        className="mt-3 text-[10px] mono text-accent-cyan hover:text-white transition-colors uppercase flex items-center gap-1"
                                    >
                                        VER MÁS <ChevronDown size={12} />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* 2) DATA MATRIX BREAKDOWN */}
                        <section className="space-y-4 flex flex-col items-center">
                            <h2 className="text-[11px] mono uppercase text-white font-bold tracking-[0.2em] flex items-center gap-2 self-start lg:self-center">
                                <PieChart size={14} className="text-accent-cyan" /> DATA MATRIX BREAKDOWN
                            </h2>
                            <div className="security-panel p-6 flex flex-wrap justify-center gap-4 md:gap-6 w-full lg:w-fit">
                                {[
                                    { key: 'nuevo', label: 'NUEVOS' },
                                    { key: 'seguimiento', label: 'SEGUIMIENTO' },
                                    { key: 'cliente_potencial', label: 'POTENCIALES' },
                                    { key: 'perdido', label: 'PERDIDOS' }
                                ].map(({ key, label }) => {
                                    const item = lifetimeBreakdown.find(b => b.type === key);
                                    return (
                                        <div key={key} className="matrix-pill">
                                            <span className="text-[9px] text-gray-500 uppercase tracking-wider block mb-2">{label}</span>
                                            <span className="text-2xl font-bold mono text-accent-cyan">{item?.count || 0}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* 3) REGISTRAR NUEVOS SETTERS */}
                            <section className="lg:col-span-1 space-y-4">
                                <h2 className="text-[11px] mono uppercase text-accent-red font-bold tracking-[0.2em] flex items-center gap-2">
                                    <UserPlus size={14} /> Registrar Nuevo Setter
                                </h2>
                                <div className="security-panel p-6">
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] mono uppercase text-gray-500 tracking-wider">Username</label>
                                                <input
                                                    type="text"
                                                    className="input-field-light"
                                                    placeholder="setter_username"
                                                    value={newSetter.username}
                                                    onChange={e => setNewSetter({ ...newSetter, username: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] mono uppercase text-gray-500 tracking-wider">Password</label>
                                                <input
                                                    type="password"
                                                    className="input-field-light"
                                                    placeholder="••••••••"
                                                    value={newSetter.password}
                                                    onChange={e => setNewSetter({ ...newSetter, password: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] mono uppercase text-gray-500 tracking-wider">Nombre Real</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Nombre Apellido"
                                                    value={newSetter.real_name}
                                                    onChange={e => setNewSetter({ ...newSetter, real_name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        {formError && <p className="text-[10px] mono text-red-400 uppercase">{formError}</p>}
                                        <button type="submit" className="btn-red w-full mt-2">CREAR USUARIO</button>
                                    </form>
                                </div>
                            </section>

                            {/* 4) RENDIMIENTO DE OPERADORES */}
                            <section className="lg:col-span-2 space-y-4">
                                <h2 className="text-[11px] mono uppercase text-accent-cyan font-bold tracking-[0.2em] flex items-center gap-2">
                                    <Users size={14} /> RENDIMIENTO DE OPERADORES
                                </h2>
                                <div className="security-panel table-container">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-background/50 border-b border-border">
                                            <tr>
                                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider">OPERADOR</th>
                                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider text-center">MSG HOY</th>
                                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider text-center">MSG SEM</th>
                                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider text-center">MSG MES</th>
                                                <th className="p-4 font-bold uppercase text-gray-400 tracking-wider text-right">ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {setters.map(s => (
                                                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="avatar bg-white/10 flex items-center justify-center rounded-full w-8 h-8">
                                                                <User size={14} className="text-gray-300" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white text-sm">{s.real_name}</div>
                                                                <div className="text-[10px] mono text-gray-500">@{s.username}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 mono text-center text-accent-pink font-bold">{s.today}</td>
                                                    <td className="p-4 mono text-center text-accent-purple font-bold">{s.week}</td>
                                                    <td className="p-4 mono text-center text-accent-cyan font-bold">{s.month}</td>
                                                    <td className="p-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => navigate(`/admin/setter/${s.id}`)}
                                                                className="btn-primary text-[9px] px-3 py-2"
                                                                title="Monitorear"
                                                            >
                                                                MONITOREAR
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const newPass = prompt('Nueva contraseña:');
                                                                    if (newPass) axios.post(`${API_URL}/admin/setters/${s.id}/password`, { password: newPass }).then(() => alert('Actualizado'));
                                                                }}
                                                                className="action-btn action-btn-violet"
                                                                title="Cambiar contraseña"
                                                            >
                                                                <Key size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(s.id)}
                                                                className="action-btn action-btn-red"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {setters.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="p-8 text-center text-gray-500 mono uppercase">No hay operadores registrados</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </>
                ) : (
                    /* BACKUP VIEW */
                    <section className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Generación de Backups</h2>
                            <p className="text-[11px] mono text-gray-500 uppercase tracking-widest">Extraer registros y métricas de la base de datos central</p>
                        </div>

                        <div className="security-panel p-8 space-y-8">
                            {/* Preset Selectors */}
                            <div className="space-y-3">
                                <label className="text-[10px] mono uppercase text-gray-500 tracking-wider">Atajos rápidos</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button onClick={() => setPreset('thisWeek')} className="btn-outline-cyan py-3 text-[10px] mono">ESTA SEMANA</button>
                                    <button onClick={() => setPreset('lastWeek')} className="btn-outline-purple py-3 text-[10px] mono">SEMANA PASADA</button>
                                    <button onClick={() => setPreset('thisMonth')} className="btn-outline-pink py-3 text-[10px] mono">MES ACTUAL</button>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Manual Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] mono uppercase text-gray-500 tracking-wider block">Fecha Inicial</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            className="input-field h-12"
                                            value={backupRange.start}
                                            onChange={e => setBackupRange({ ...backupRange, start: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] mono uppercase text-gray-500 tracking-wider block">Fecha Final</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            className="input-field h-12"
                                            value={backupRange.end}
                                            onChange={e => setBackupRange({ ...backupRange, end: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleGenerateBackup}
                                    className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-[11px] mono uppercase tracking-[0.2em]"
                                >
                                    <FileSpreadsheet size={18} />
                                    Generar Reporte Excel (.xlsx)
                                </button>
                                <p className="text-center mt-4 text-[9px] mono text-gray-600 uppercase tracking-widest">
                                    El archivo incluirá hojas de resumen, rendimiento por operador y logs detallados
                                </p>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Automatic Backups List */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] mono uppercase text-accent-cyan font-bold tracking-[0.2em] flex items-center gap-2">
                                    <Clock size={14} /> Historial de Backups Automáticos (Semanales)
                                </h3>
                                <div className="space-y-2">
                                    {autoBackupsLoading ? (
                                        <div className="text-center py-4 mono text-[10px] animate-pulse">Cargando historial...</div>
                                    ) : autoBackups.length === 0 ? (
                                        <div className="text-center py-8 text-gray-600 mono text-[10px] border border-dashed border-white/10 rounded-xl">
                                            No hay backups automáticos generados aún
                                        </div>
                                    ) : (
                                        autoBackups.map((b, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-background/40 border border-white/5 rounded-xl hover:border-white/20 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <FileSpreadsheet size={18} className="text-accent-green" />
                                                    <div>
                                                        <div className="text-[11px] font-bold text-white">{b.filename}</div>
                                                        <div className="text-[9px] mono text-gray-500 uppercase">
                                                            Generado: {DateTime.fromISO(b.createdAt).setZone('America/Argentina/Cordoba').toFormat('dd/MM/yyyy HH:mm')} • {(b.size / 1024).toFixed(1)} KB
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownloadAutoBackup(b.filename)}
                                                    className="action-btn action-btn-violet"
                                                    title="Descargar"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <p className="text-[9px] mono text-gray-600 uppercase tracking-widest text-center">
                                    Estos backups se generan automáticamente todos los domingos a las 23:59hs
                                </p>
                            </div>
                        </div>
                    </section>
                )}

            </main>

            {/* MODAL - VER MÁS */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={closeModal}>
                    <div
                        className="security-panel w-full max-w-4xl max-h-[85vh] flex flex-col animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div>
                                <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                    Mensajes: {getPeriodLabel(modalPeriod)}
                                </h2>
                                <p className="text-[10px] mono text-gray-500">
                                    Total: {modalData.total} mensajes de todos los setters
                                </p>
                            </div>
                            <button onClick={closeModal} className="action-btn">
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Breakdown Summary */}
                        <div className="p-6 border-b border-border bg-background/50 flex flex-col items-center">
                            <p className="text-[9px] mono uppercase text-gray-500 mb-3 tracking-wider self-start">Breakdown por tipo</p>
                            <div className="flex flex-wrap justify-center gap-4 w-full">
                                {[
                                    { key: 'nuevo', label: 'NUEVOS' },
                                    { key: 'seguimiento', label: 'SEGUIMIENTO' },
                                    { key: 'cliente_potencial', label: 'POTENCIALES' },
                                    { key: 'perdido', label: 'PERDIDOS' }
                                ].map(({ key, label }) => {
                                    const item = modalData.breakdown.find(b => b.type === key);
                                    return (
                                        <div key={key} className="matrix-pill">
                                            <span className="text-[9px] text-gray-500 uppercase block mb-1">{label}</span>
                                            <span className="text-lg font-bold mono text-accent-cyan">{item?.count || 0}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {modalLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-accent mono animate-pulse uppercase tracking-wider">Cargando datos...</div>
                                </div>
                            ) : modalData.messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                                    <Activity size={48} className="mb-4" />
                                    <p className="mono uppercase tracking-wider">No hay mensajes en este período</p>
                                </div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-panel border-b border-border">
                                        <tr>
                                            <th className="p-3 text-left font-bold uppercase text-gray-400 tracking-wider">Fecha/Hora</th>
                                            <th className="p-3 text-left font-bold uppercase text-gray-400 tracking-wider">Setter</th>
                                            <th className="p-3 text-left font-bold uppercase text-gray-400 tracking-wider">Tipo</th>
                                            <th className="p-3 text-left font-bold uppercase text-gray-400 tracking-wider">Plataforma</th>
                                            <th className="p-3 text-left font-bold uppercase text-gray-400 tracking-wider">Contacto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {modalData.messages.map((m, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 mono text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} />
                                                        {DateTime.fromISO(m.created_at).setZone('America/Argentina/Cordoba').toFormat('dd/MM HH:mm')}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-white">{m.setter_name}</div>
                                                    <div className="text-[9px] text-gray-500">@{m.setter_username}</div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`chip-${m.message_type === 'nuevo' ? 'teal' : m.message_type === 'seguimiento' ? 'violet' : m.message_type === 'cliente_potencial' ? 'orange' : 'red'}`}>
                                                        {m.message_type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {m.contact_type === 'instagram' ? (
                                                            <Instagram size={14} className="text-purple-400" />
                                                        ) : (
                                                            <MessageSquare size={14} className="text-green-400" />
                                                        )}
                                                        <span className="uppercase text-gray-400">{m.contact_type}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 font-bold text-white">
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
