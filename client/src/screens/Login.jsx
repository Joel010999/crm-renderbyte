import React, { useState } from 'react';
import { useAuth } from '../App';
import { Shield, Lock, Cpu } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Access Denied: Invalid Security Key');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

            {/* Login Card */}
            <div className="security-panel w-full max-w-[420px] p-10 relative z-10">
                {/* Logo and Name */}
                <div className="flex flex-col items-center mb-10">
                    <img src="/assets/logo.png" alt="Logo" className="w-24 h-24 object-contain mb-6 drop-shadow-glow" />
                    <img src="/assets/name.png" alt="RenderByte" className="h-8 object-contain mb-4" />
                    <p className="text-[11px] mono text-accent tracking-[0.25em] uppercase font-semibold">
                        ACCESS CONTROL
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Access ID */}
                    <div className="space-y-2">
                        <label className="text-[10px] mono uppercase text-gray-400 font-bold tracking-wider block">
                            ACCESS ID
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Username"
                                className="input-field px-5 py-4"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Security Key */}
                    <div className="space-y-2">
                        <label className="text-[10px] mono uppercase text-gray-400 font-bold tracking-wider block">
                            SECURITY KEY
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="input-field px-5 py-4"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="text-[10px] mono text-red-400 bg-red-500/10 border border-red-500/20 p-3 text-center uppercase rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full mt-6 flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <span className="animate-pulse">Decrypting...</span>
                        ) : (
                            <>
                                ESTABLISH CONNECTION
                                <Cpu size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer text */}
                <p className="mt-8 text-[9px] mono text-gray-600 uppercase tracking-[0.15em] text-center">
                    ENCRYPTING LINK... SECURE TRANSMISSION
                </p>
            </div>
        </div>
    );
};

export default Login;
