import UnifiedInbox from '@/components/admin/UnifiedInbox';

export default function InboxPage() {
    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Unified Inbox</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage messages from Facebook, Instagram, WhatsApp, and Google Reviews.</p>
            </div>
            <UnifiedInbox />
        </div>
    );
}

