import { supabase } from './supabase';
import type { AuditLogInsert } from '../types/database';

// Utility: write an audit log entry.
// Automatically attaches the current user's id.
// Call this at every mutation point (pipeline create/update/delete, user create, node create, etc.)
export async function logAction(
    entry: Omit<AuditLogInsert, 'user_id'>
): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('audit_logs').insert({
            ...entry,
            user_id: user.id,
        } as any);
    } catch {
        // Audit logging failures must never break the main flow
    }
}
