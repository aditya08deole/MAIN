/**
 * AddCustomerForm — creates a customer (client) record in the clients table.
 * No auth user creation — customers are not system users.
 */
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Building2, MapPin, FileText, Loader2, CheckCircle } from 'lucide-react';

import { adminService } from '../../../services/admin';
import { useZones } from '../../../hooks/useZones';
import { useCommunities } from '../../../hooks/useCommunities';
import { useToast } from '../../ToastProvider';
import { FormField } from '../../forms/FormField';

const clientSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    community_id: z.string().uuid('Please select a community'),
    notes: z.string().optional(),
    regionFilter: z.string().optional(),
});

type ClientInput = z.infer<typeof clientSchema>;

interface Props {
    onSubmit: (data: any) => void;
    onCancel: () => void;
}

export const AddCustomerForm = ({ onSubmit, onCancel }: Props) => {
    const { showToast } = useToast();
    const { zones, isLoading: loadingRegions } = useZones();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<ClientInput>({
        resolver: zodResolver(clientSchema),
    });

    const watchRegionFilter = watch('regionFilter');
    const { communities, isLoading: loadingCommunities } = useCommunities(watchRegionFilter || undefined);

    const sortedRegions = useMemo(() =>
        zones ? [...zones].sort((a, b) => a.name.localeCompare(b.name)) : [],
        [zones]);

    const handleFormSubmit = async (data: ClientInput) => {
        try {
            const { regionFilter: _r, ...payload } = data;
            const result = await adminService.createClient(payload);
            showToast('Customer added successfully', 'success');
            onSubmit(result);
        } catch (err: any) {
            showToast(err.message || 'Failed to add customer', 'error');
        }
    };

    const inputClass = (error?: any) => `
        w-full px-4 py-3 rounded-xl border transition-all duration-200 outline-none
        ${error
            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-slate-200 bg-white/30 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'}
    `;

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 p-1">
            {/* Identity */}
            <div className="apple-glass-inner p-6 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-tight">
                    <User size={16} className="text-blue-600" /> Customer Identity
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name" required icon={User} error={errors.name?.message} className="md:col-span-2">
                        <input {...register('name')} placeholder="e.g. Ramesh Sharma" className={inputClass(errors.name)} />
                    </FormField>
                    <FormField label="Email" icon={Mail} error={errors.email?.message}>
                        <input {...register('email')} type="email" placeholder="customer@example.com" className={inputClass(errors.email)} />
                    </FormField>
                    <FormField label="Phone" icon={Phone} error={errors.phone?.message}>
                        <input {...register('phone')} placeholder="+91 98765 43210" className={inputClass(errors.phone)} />
                    </FormField>
                    <FormField label="Address" icon={MapPin} error={errors.address?.message} className="md:col-span-2">
                        <input {...register('address')} placeholder="House no, Street, City" className={inputClass(errors.address)} />
                    </FormField>
                </div>
            </div>

            {/* Assignment */}
            <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-tight">
                    <Building2 size={16} className="text-blue-600" /> Community Assignment
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Filter by Zone" icon={MapPin}>
                        <select {...register('regionFilter')} className={inputClass()} disabled={loadingRegions}>
                            <option value="">All Zones</option>
                            {sortedRegions.map(r => <option key={r.id} value={r.id}>{r.name}{r.state ? ` (${r.state})` : ''}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Community" required icon={Building2} error={errors.community_id?.message}>
                        <select {...register('community_id')} className={inputClass(errors.community_id)} disabled={loadingCommunities}>
                            <option value="">Select community...</option>
                            {communities?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Notes" icon={FileText} error={errors.notes?.message} className="md:col-span-2">
                        <textarea {...register('notes')} rows={2} placeholder="Optional notes about this customer..." className={inputClass(errors.notes)} />
                    </FormField>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} disabled={isSubmitting}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all">
                    Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="submit" disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-3 bg-[#1F2937] text-white text-sm font-bold rounded-xl hover:bg-[#111827] transition-all disabled:opacity-50 shadow-md">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {isSubmitting ? 'Saving...' : 'Add Customer'}
                </motion.button>
            </div>
        </form>
    );
};
