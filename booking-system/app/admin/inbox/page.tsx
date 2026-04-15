import UnifiedInbox from '@/components/admin/UnifiedInbox';

export default function InboxPage() {
    return (
        <div className="flex flex-col h-screen p-6">
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Unified Inbox</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage messages from Facebook, Instagram, WhatsApp, and Google Reviews.</p>
            </div>
            <div className="flex-1 min-h-0 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <UnifiedInbox />
            </div>
        </div>
    );
}

