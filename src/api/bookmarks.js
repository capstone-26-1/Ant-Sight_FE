import { api } from './client';

export const bookmarkApi = {
    list:   ()       => api.get('/api/bookmarks'),
    add:    (ticker) => api.post('/api/bookmarks', { ticker }),
    remove: (ticker) => api.delete(`/api/bookmarks/${ticker}`),
};