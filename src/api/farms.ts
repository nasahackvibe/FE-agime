import { apiClient } from './client';

export interface Farm {
  id: number;
  name: string;
  coordinates: number[][];
  created_at: string;
  updated_at: string;
  owner: number;
}

export interface CreateFarmRequest {
  name: string;
  coordinates: number[][];
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

  async getFarm(id: number): Promise<Farm> {
    return apiClient.request<Farm>('GET', `/farms/${id}/`);
  },

  async updateFarm(id: number, farmData: Partial<CreateFarmRequest>): Promise<Farm> {
    return apiClient.request<Farm>('PUT', `/farms/${id}/`, farmData);
  },

  async deleteFarm(id: number): Promise<void> {
    return apiClient.request<void>('DELETE', `/farms/${id}/`);
  },

  async analyzeFarm(id: number): Promise<Analysis> {
    return apiClient.request<Analysis>('POST', `/farms/${id}/analyze/`);
  },

  async getLatestAnalysis(id: number): Promise<Analysis> {
    return apiClient.request<Analysis>('GET', `/farms/${id}/latest-analysis/`);
  },

  async getAnalyses(id: number): Promise<Analysis[]> {
    return apiClient.request<Analysis[]>('GET', `/farms/${id}/analyses/`);
  },
};
