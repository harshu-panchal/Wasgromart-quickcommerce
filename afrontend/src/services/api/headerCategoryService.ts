import api from './config';

export interface HeaderCategory {
    _id: string; // MongoDB ID
    id?: string; // For backward compatibility if needed
    name: string;
    iconLibrary: string; // 'IonIcons' | 'MaterialIcons' | 'FontAwesome' | 'Feather'
    iconName: string;
    slug: string; // Maps to theme key
    relatedCategory?: string;
    status: 'Published' | 'Unpublished';
    order?: number;
    commissionRate?: number;
}

const normalizeHeaderCategories = (payload: unknown): HeaderCategory[] => {
    if (Array.isArray(payload)) {
        return payload.filter(Boolean) as HeaderCategory[];
    }
    if (
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { data?: unknown }).data)
    ) {
        return ((payload as { data: HeaderCategory[] }).data).filter(Boolean);
    }
    return [];
};

export const getHeaderCategoriesPublic = async (skipLoader = false): Promise<HeaderCategory[]> => {
    const response = await api.get<HeaderCategory[] | { data: HeaderCategory[] }>('/header-categories', {
        skipLoader
    } as any);
    return normalizeHeaderCategories(response.data);
};

export const getHeaderCategoriesAdmin = async (): Promise<HeaderCategory[]> => {
    const response = await api.get<HeaderCategory[] | { data: HeaderCategory[] }>('/header-categories/admin');
    return normalizeHeaderCategories(response.data);
};

export const createHeaderCategory = async (data: Partial<HeaderCategory>): Promise<HeaderCategory> => {
    const response = await api.post<HeaderCategory>('/header-categories', data);
    return response.data;
};

export const updateHeaderCategory = async (id: string, data: Partial<HeaderCategory>): Promise<HeaderCategory> => {
    const response = await api.put<HeaderCategory>(`/header-categories/${id}`, data);
    return response.data;
};

export const deleteHeaderCategory = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/header-categories/${id}`);
    return response.data;
};
