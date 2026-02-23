import { Resource } from './data';

// Initial in-memory store
let resources: Resource[] = [];

export const ResourcesStore = {
    getResources: (clinicId?: string) => {
        if (clinicId) {
            return resources.filter(r => r.clinicId === clinicId);
        }
        return resources;
    },

    getResourceById: (id: string) => {
        return resources.find(r => r.id === id);
    },

    addResource: (resource: Omit<Resource, 'id'>) => {
        const newResource: Resource = {
            ...resource,
            id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        resources.push(newResource);
        return newResource;
    },

    updateResource: (id: string, updates: Partial<Omit<Resource, 'id'>>) => {
        const index = resources.findIndex(r => r.id === id);
        if (index === -1) return null;

        const updated = { ...resources[index], ...updates };
        resources[index] = updated;
        return updated;
    },

    deleteResource: (id: string) => {
        const initialLen = resources.length;
        resources = resources.filter(r => r.id !== id);
        return resources.length < initialLen;
    }
};
