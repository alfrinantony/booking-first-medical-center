import { SettingsStore } from './lib/settings-store';

async function update() {
    try {
        await SettingsStore.updateSettings({
            messengerAccessToken: "EAAbzrZCxRCvABRgKD4QBCe0CTPZA4lUuANQDqYfD9YOMz2jxXPrVJjZCdDwGWPouEtQU69Pm51X69rH1kBT7c6c3aKNs0c2qVX1mxV346aKKy884GAbZBlbdmHZALo3fOfBSH9XGxPwIgrW07BgZARERwYQqwB0nv6qztlZBM9K7IAJlJCZCZCVLZAVWenYdASwZBSY7wZDZD",
            whatsappAccessToken: "EAAbzrZCxRCvABRkjFsvTM5ZAuqtFcfpGskzt4GIlmwZCX62gfhHKBnY2NSYSzgFxnQbQuXQZC9HaWRle7Qw8COLOZAGZA9ZCaDUEZBuQZAuy2jHLhwcApP59N1aGi1WUyMzLlCoRxtz8ZBcKJnYZAe1R78fSun5dkL1hy22qUbbFPiwLZCZA4LNL3njFyUd7ZBESZBZBsz2TRQZDZD",
            metaAppId: "1956787038259952"
        });
        console.log("Settings updated successfully in Azure Blob.");
    } catch(e) {
        console.error("Failed to update settings:", e);
    }
}

update();
