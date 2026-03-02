/**
 * AddRegionForm — Admin version.
 * Refactored to use Zod + React Hook Form + Framer Motion.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { MapPin, Globe, Hash, FileText, Loader2, CheckCircle } from 'lucide-react';

import { adminService } from '../../../services/admin';
import { useToast } from '../../ToastProvider';
import { regionSchema, type RegionInput } from '../../../schemas';
import { FormField } from '../../forms/FormField';

interface Props {
    onSubmit: (data: any) => void;
    onCancel: () => void;
}

const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Chandigarh', 'Puducherry'
];

export const AddZoneForm = ({ onSubmit, onCancel }: Props) => {
    const { showToast } = useToast();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegionInput>({
        resolver: zodResolver(regionSchema) as any,
        defaultValues: {
            country: 'India',
        }
    });

    const onFormSubmit = async (data: RegionInput) => {
        try {
            const result = await adminService.createRegion(data);
            showToast('Zone Created Successfully', 'success');
            onSubmit(result);
        } catch (err: any) {
            showToast(err.message || 'Failed to create zone', 'error');
        }
    };

    const inputClass = (error?: any) => `
        w-full px-4 py-3 rounded-2xl border transition-all duration-300 outline-none text-sm
        ${error
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-slate-200 apple-glass-inner focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:apple-glass-card'}
    `;

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8 p-1">
            <div className="space-y-6">
                {/* Zone Identity */}
                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-indigo-800 uppercase tracking-tight">
                        <MapPin size={18} /> Zone Identity
                    </div>
                    <div className="space-y-4">
                        <FormField label="Zone / Zone Name" required icon={MapPin} error={errors.name?.message}>
                            <input {...register('name')} placeholder="e.g. Hyderabad Central" className={inputClass(errors.name)} />
                        </FormField>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="State" required icon={Globe} error={errors.state?.message}>
                                <select {...register('state')} className={inputClass(errors.state)}>
                                    <option value="">Select State</option>
                                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Country" required icon={Globe} error={errors.country?.message}>
                                <input {...register('country')} placeholder="India" className={inputClass(errors.country)} />
                            </FormField>
                        </div>
                    </div>
                </div>

                {/* Technical Details */}
                <div className="apple-glass-inner p-6 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-800 uppercase tracking-tight">
                        <Hash size={18} /> Infrastructure Details
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Zone Code" icon={Hash} error={errors.zone_code?.message}>
                            <input {...register('zone_code')} placeholder="e.g. HYD-C" className={inputClass(errors.zone_code)} onChange={e => {
                                e.target.value = e.target.value.toUpperCase();
                                register('zone_code').onChange(e);
                            }} />
                        </FormField>
                        <FormField label="Description" icon={FileText} error={errors.description?.message}>
                            <input {...register('description')} placeholder="Coverage area details" className={inputClass(errors.description)} />
                        </FormField>
                    </div>
                </div>
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
                    className="flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white text-sm font-black rounded-2xl hover:shadow-xl hover:shadow-indigo-500/30 transition-all shadow-lg shadow-indigo-200"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    {isSubmitting ? 'Creating...' : 'Create Zone'}
                </motion.button>
            </div>
        </form>
    );
};
