import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  phone: string;
  language: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  farm_id?: string;
  created_at: string;
}

export interface ChatResponse {
  conversation_id: string;
  assistant: string;
  message_id: number;
}

export interface ConversationHistory {
  conversation_id: string;
  messages: ChatMessage[];
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshToken = this.getRefreshToken();
          if (refreshToken) {
            try {
              const response = await this.refreshAccessToken(refreshToken);
              this.setTokens(response.access, refreshToken);
              originalRequest.headers.Authorization = `Bearer ${response.access}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              this.clearTokens();
              window.location.href = '/auth';
              return Promise.reject(refreshError);
            }
          } else {
            this.clearTokens();
            window.location.href = '/auth';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Auth API calls
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.client.post('/auth/login/', credentials);
    this.setTokens(response.data.access, response.data.refresh);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.client.post('/auth/register/', userData);
    // Don't automatically set tokens - let the caller decide
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<User> = await this.client.get('/auth/profile/');
    return response.data;
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    const response: AxiosResponse<User> = await this.client.put('/auth/profile/', userData);
    return response.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access: string }> {
    const response: AxiosResponse<{ access: string }> = await this.client.post('/auth/token/refresh/', {
      refresh: refreshToken,
    });
    return response.data;
  }

  logout(): void {
    this.clearTokens();
  }

  // Generic API method
  async request<T = any>(method: string, url: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.request({
      method,
      url,
      data,
    });
    return response.data;
  }

  // Chatbot API methods
  async sendChatMessage(message: string, farmId?: string, conversationId?: string): Promise<ChatResponse> {
    const response: AxiosResponse<ChatResponse> = await this.client.post('/chat/', {
      message,
      farm_id: farmId,
      conversation_id: conversationId,
    });
    return response.data;
  }

  async getConversationHistory(conversationId: string): Promise<ConversationHistory> {
    const response: AxiosResponse<ConversationHistory> = await this.client.get(`/chat/conversations/${conversationId}/messages/`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
