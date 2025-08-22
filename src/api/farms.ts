import { apiClient } from './client';

export interface Farm {
  id: string;
  name: string;
  centroid: {
    lat: number;
    lon: number;
  };
  area_m2: number;
  created_at: string;
}

export interface CreateFarmRequest {
  name: string;
  coords: number[][];
}

export interface Analysis {
  id: number;
  farm: number;
  results: any;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
}

// Farm operations
export const farmApi = {
  async getFarms(): Promise<Farm[]> {
    return apiClient.request<Farm[]>('GET', '/farms/');
  },

  async createFarm(farmData: CreateFarmRequest): Promise<Farm> {
    return apiClient.request<Farm>('POST', '/farms/', farmData);
  },

  async getFarm(id: string): Promise<Farm> {
    return apiClient.request<Farm>('GET', `/farms/${id}/`);
  },

  async updateFarm(id: string, farmData: Partial<CreateFarmRequest>): Promise<Farm> {
    return apiClient.request<Farm>('PUT', `/farms/${id}/`, farmData);
  },

  async deleteFarm(id: string): Promise<void> {
    return apiClient.request<void>('DELETE', `/farms/${id}/`);
  },

  async analyzeFarm(id: string): Promise<Analysis> {
    return apiClient.request<Analysis>('POST', `/farms/${id}/analyze/`);
  },

  async getLatestAnalysis(id: string): Promise<Analysis> {
    return apiClient.request<Analysis>('GET', `/farms/${id}/latest-analysis/`);
  },

  async getAnalyses(id: string): Promise<Analysis[]> {
    return apiClient.request<Analysis[]>('GET', `/farms/${id}/analyses/`);
  },
};
