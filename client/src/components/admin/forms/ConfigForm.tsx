/**
 * ConfigForm — Global system configuration.
 * Refactored to use Zod + React Hook Form + Framer Motion.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Save, AlertTriangle, Loader2, Smartphone } from 'lucide-react';
import { z } from 'zod';

import { adminService } from '../../../services/admin';
import { useToast } from '../../ToastProvider';
import { FormField } from '../../forms/FormField';

const configSchema = z.object({
    rate: z.coerce.number().min(1, 'Sampling rate must be at least 1 second').max(3600, 'Sampling rate cannot exceed 1 hour'),
    firmware: z.string().min(2, 'Firmware version is required'),
});

type ConfigInput = z.infer<typeof configSchema>;

interface Props {
    onSubmit: (data: any) => void;
    onCancel: () => void;
}

export const ConfigForm = ({ onSubmit, onCancel }: Props) => {
    const { showToast } = useToast();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ConfigInput>({
        resolver: zodResolver(configSchema) as any,
        defaultValues: {
            rate: 60,
            firmware: 'v2.1.0',
        }
    });

    const onFormSubmit = async (data: ConfigInput) => {
        try {
            const result = await adminService.updateSystemConfig(data);
            showToast('System Configuration Updated', 'success');
            onSubmit(result);
        } catch (err: any) {
            showToast(err.message || 'Failed to update config', 'error');
        }
    };

    const inputClass = (error?: any) => `
        w-full px-4 py-3 rounded-2xl border transition-all duration-300 outline-none text-sm
        ${error
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-slate-200 apple-glass-inner focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:apple-glass-card'}
    `;

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 p-1">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                <div className="text-xs text-amber-800 leading-relaxed">
                    <strong>Critical System Setting:</strong> Changes applied here will update the polling interval and target firmware for <strong>all provisioned nodes</strong> in the next sync cycle.
                </div>
            </div>

            <div className="space-y-4">
                <FormField label="Sampling Rate (Seconds)" required icon={Smartphone as any} error={errors.rate?.message}>
                    <input
                        {...register('rate')}
                        type="number"
                        placeholder="e.g. 60"
                        className={inputClass(errors.rate)}
                    />
                </FormField>

                <FormField label="Target Firmware Version" required icon={Save} error={errors.firmware?.message}>
                    <select {...register('firmware')} className={inputClass(errors.firmware)}>
                        <option value="v1.9.8-LTS">v1.9.8-LTS (Legacy)</option>
                        <option value="v2.1.0">v2.1.0 (Current Stable)</option>
                        <option value="v2.2.0-beta">v2.2.0-beta (Internal Only)</option>
                    </select>
                </FormField>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all"
                >
                    Cancel
                </button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-black rounded-2xl hover:shadow-xl hover:shadow-amber-500/30 transition-all shadow-lg shadow-amber-200"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {isSubmitting ? 'Syncing...' : 'Broadcast Config'}
                </motion.button>
            </div>
        </form>
    );
};
