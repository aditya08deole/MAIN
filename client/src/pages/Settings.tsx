import { useState, useEffect } from 'react';
import { Bell, Moon, Smartphone, Mail, Save } from 'lucide-react';
import { getUserPreferences, updateUserPreferences, type UserPreferences } from '../services/settings';

export default function SettingsPage() {
    const [prefs, setPrefs] = useState<UserPreferences>({
        email_notifications: true,
        sms_notifications: false,
        theme: 'light'
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadPrefs();
    }, []);

    const loadPrefs = async () => {
        const data = await getUserPreferences();
        setPrefs(data);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateUserPreferences(prefs);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-100 rounded-2xl">
                    <Bell className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
                    <p className="text-slate-500">Manage your notifications and preferences.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">

                {/* Notifications Section */}
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-500" /> Notifications
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-700">Email Alerts</div>
                                    <div className="text-sm text-slate-500">Receive critical alerts via email.</div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={prefs.email_notifications}
                                    onChange={e => setPrefs({ ...prefs, email_notifications: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <Smartphone className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-700">SMS Alerts</div>
                                    <div className="text-sm text-slate-500">Receive critical alerts via SMS.</div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={prefs.sms_notifications}
                                    onChange={e => setPrefs({ ...prefs, sms_notifications: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Appearance Section */}
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Moon className="w-5 h-5 text-indigo-500" /> Appearance
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-semibold text-slate-700">Dark Mode</div>
                            <div className="text-sm text-slate-500">Switch between light and dark themes.</div>
                        </div>
                        <select
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                            value={prefs.theme}
                            onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as any })}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">System</option>
                        </select>
                    </div>
                </div>

                {/* Save Bar */}
                <div className="p-6 bg-slate-50 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                        {saved ? 'Saved!' : (loading ? 'Saving...' : 'Save Changes')}
                        {!loading && !saved && <Save className="w-4 h-4" />}
                    </button>
                </div>

            </div>
        </div>
    );
}
