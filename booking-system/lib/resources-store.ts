import { Resource } from './data';
import { loadFromBlob, saveToBlob } from './blob-persistence';

let resources: Resource[] = [];
async function ensureResLoaded() {
    
        resources = await loadFromBlob<Resource[]>('resources', []);
        
}

export const ResourcesStore = {
    getResources: async (clinicId?: string) => {
        await ensureResLoaded();
        if (clinicId) {
            return resources.filter(r => r.clinicId === clinicId);
        }
        return resources;
    },

    getResourceById: async (id: string) => {
        await ensureResLoaded();
        return resources.find(r => r.id === id);
    },

    addResource: async (resource: Omit<Resource, 'id'>) => {
        await ensureResLoaded();
        const newResource: Resource = {
            ...resource,
            id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        resources.push(newResource);
        await saveToBlob('resources', resources);
        return newResource;
    },

    updateResource: async (id: string, updates: Partial<Omit<Resource, 'id'>>) => {
        await ensureResLoaded();
        const index = resources.findIndex(r => r.id === id);
        if (index === -1) return null;

        const updated = { ...resources[index], ...updates };
        resources[index] = updated;
        await saveToBlob('resources', resources);
        return updated;
    },

    deleteResource: async (id: string) => {
        await ensureResLoaded();
        const initialLen = resources.length;
        resources = resources.filter(r => r.id !== id);
        if (resources.length < initialLen) {
            await saveToBlob('resources', resources);
            return true;
        }
        return false;
    }
};
