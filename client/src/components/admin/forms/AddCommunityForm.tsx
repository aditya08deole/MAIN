/**
 * AddCommunityForm — Admin version.
 * Refactored to use Zod + React Hook Form + Framer Motion.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
    Loader2, Users, Building2, MapPin, Phone, Mail, FileText
} from 'lucide-react';

import { adminService } from '../../../services/admin';
import { useZones } from '../../../hooks/useZones';
import { useToast } from '../../ToastProvider';
import { communitySchema, type CommunityInput } from '../../../schemas';
import { FormField } from '../../forms/FormField';

interface Props {
    onSubmit: (data: any) => void;
    onCancel: () => void;
}

export const AddCommunityForm = ({ onSubmit, onCancel }: Props) => {
    const { showToast } = useToast();
    const { zones, isLoading: loadingRegions } = useZones();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<CommunityInput>({
        resolver: zodResolver(communitySchema) as any,
        defaultValues: {
            operational_status: 'active',
        }
    });

    const onFormSubmit = async (data: CommunityInput) => {
        try {
            const result = await adminService.createCommunity(data);
            showToast('Community Created Successfully', 'success');
            onSubmit(result);
        } catch (err: any) {
            showToast(err.message || 'Failed to create community', 'error');
        }
    };

    const inputClass = (error?: any) => `
        w-full px-4 py-3 rounded-2xl border transition-all duration-300 outline-none text-sm
        ${error
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-slate-200 apple-glass-inner focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:apple-glass-card'}
    `;

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8 p-1">
            <div className="space-y-6">
                {/* Basic Details */}
                <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100 space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-blue-800 uppercase tracking-tight">
                        <Building2 size={18} /> Basic Information
                    </div>
                    <div className="space-y-4">
                        <FormField label="Community Name" required icon={Building2} error={errors.name?.message}>
                            <input {...register('name')} placeholder="e.g. Greenwood Heights" className={inputClass(errors.name)} />
                        </FormField>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Infrastructure Zone" required icon={MapPin} error={errors.zone_id?.message}>
                                <select {...register('zone_id')} className={inputClass(errors.zone_id)} disabled={loadingRegions}>
                                    <option value="">Select Zone</option>
                                    {zones?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Pincode" icon={FileText as any} error={errors.pincode?.message}>
                                <input {...register('pincode')} placeholder="6 digits" maxLength={6} className={inputClass(errors.pincode)} />
                            </FormField>
                        </div>
                    </div>
                </div>

                {/* Location & Contact */}
                <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-emerald-800 uppercase tracking-tight">
                        <MapPin size={18} /> Location & Contact
                    </div>
                    <div className="space-y-4">
                        <FormField label="Full Address" icon={MapPin} error={errors.address?.message}>
                            <input {...register('address')} placeholder="Physical address of specific site" className={inputClass(errors.address)} />
                        </FormField>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Contact Person" icon={Users} error={errors.contact_person?.message}>
                                <input {...register('contact_person')} placeholder="Manager name" className={inputClass(errors.contact_person)} />
                            </FormField>
                            <FormField label="Contact Email" icon={Mail} error={errors.contact_email?.message}>
                                <input {...register('contact_email')} type="email" placeholder="site@example.com" className={inputClass(errors.contact_email)} />
                            </FormField>
                            <FormField label="Phone Number" icon={Phone} error={errors.contact_phone?.message} className="md:col-span-2">
                                <input {...register('contact_phone')} placeholder="Contact phone" className={inputClass(errors.contact_phone)} />
                            </FormField>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-white/30 rounded-2xl transition-all"
                >
                    Cancel
                </button>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black rounded-2xl hover:shadow-xl hover:shadow-blue-500/30 transition-all shadow-lg shadow-blue-200"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Building2 size={18} />}
                    {isSubmitting ? 'Creating...' : 'Create Community'}
                </motion.button>
            </div>
        </form>
    );
};

