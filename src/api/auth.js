import { api } from './client';

export const authApi = {
    login: (email, password) => 
        api.post('/api/auth/login', { email, password }),
    
    signup: (email, password, nickname) => 
        api.post('/api/auth/signup', { email, password, nickname }),
    
    me: () => api.get('/api/auth/me'),
};