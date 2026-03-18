import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';

interface UseFormDraftOptions<T> {
    debounceMs?: number;
    enabled?: boolean;
    onRestore?: (data: T) => void;
}

export function useFormDraft<T>(formId: string, currentData: T, options?: UseFormDraftOptions<T>) {
    const { user } = useAuthStore();
    const userId = user?.email || user?.phone || 'anonymous';
    
    const [isRestored, setIsRestored] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const debounceMs = options?.debounceMs || 1000;
    const isEnabled = options?.enabled !== false;
    
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const initialFetchDone = useRef(false);
    const lastSavedData = useRef<string | null>(null);

    // 1. Fetch Draft on mount
    useEffect(() => {
        if (!isEnabled || initialFetchDone.current) return;
        
        async function fetchDraft() {
            try {
                const url = new URL('/api/admin/drafts', window.location.origin);
                url.searchParams.append('userId', userId);
                url.searchParams.append('formId', formId);
                
                const res = await fetch(url.toString());
                if (res.ok) {
                    const json = await res.json();
                    if (json.draft && Object.keys(json.draft).length > 0) {
                        const { _updatedAt, ...restoredData } = json.draft;
                        console.log(`[useFormDraft] Restored draft for ${formId}`);
                        lastSavedData.current = JSON.stringify(restoredData);
                        if (options?.onRestore) {
                            options.onRestore(restoredData as T);
                        }
                    }
                }
            } catch (err) {
                console.error(`[useFormDraft] Failed to fetch draft for ${formId}:`, err);
            } finally {
                setIsRestored(true);
                initialFetchDone.current = true;
            }
        }
        
        fetchDraft();
    }, [formId, userId, isEnabled]); // options callback removed from deps to prevent loop

    // 2. Clear Draft explicitly (e.g. on successful submission)
    const clearDraft = useCallback(async () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        lastSavedData.current = null;
        try {
            const url = new URL('/api/admin/drafts', window.location.origin);
            url.searchParams.append('userId', userId);
            url.searchParams.append('formId', formId);
            url.searchParams.append('action', 'clear');
            
            await fetch(url.toString(), { method: 'POST' });
            console.log(`[useFormDraft] Cleared draft for ${formId}`);
        } catch (err) {
            console.error(`[useFormDraft] Failed to clear draft for ${formId}:`, err);
        }
    }, [formId, userId]);

    // 3. Auto-Save draft when data changes (debounced)
    useEffect(() => {
        if (!isEnabled || !isRestored) return;

        const currentString = JSON.stringify(currentData);
        if (currentString === lastSavedData.current) return; // No changes to save

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                const url = new URL('/api/admin/drafts', window.location.origin);
                url.searchParams.append('userId', userId);
                url.searchParams.append('formId', formId);
                
                await fetch(url.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: currentString
                });
                lastSavedData.current = currentString;
            } catch (err) {
                console.error(`[useFormDraft] Failed to auto-save draft for ${formId}:`, err);
            } finally {
                setIsSaving(false);
            }
        }, debounceMs);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentData, formId, userId, debounceMs, isEnabled, isRestored]);

    return {
        isRestored,
        isSaving,
        clearDraft
    };
}
