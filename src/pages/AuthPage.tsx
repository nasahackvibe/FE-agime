import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';

type AuthMode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const { login, register, isAuthenticated, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    phone: '',
    language: 'en',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error and success when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = (): boolean => {
    if (!formData.username || !formData.password) {
      setError('Username and password are required');
      return false;
    }

    if (mode === 'register') {
      if (!formData.email) {
        setError('Email is required for registration');
        return false;
      }
      if (formData.password !== formData.password_confirm) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        await login({
          username: formData.username,
          password: formData.password,
        });
      } else {
        await register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          password_confirm: formData.password_confirm,
          phone: formData.phone,
          language: formData.language,
        });
        
        // Registration successful - switch to login mode and show success message
        setSuccess('Registration successful! Please sign in with your credentials.');
        setMode('login');
        setFormData({
          username: formData.username, // Keep username for convenience
          email: '',
          password: '',
          password_confirm: '',
          phone: '',
          language: 'en',
        });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      phone: '',
      language: 'en',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>
        </div>
        
        <Card className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800 text-sm">{success}</p>
              </div>
            )}

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    name="language"
                    type="text"
                    value={formData.language}
                    onChange={handleInputChange}
                    placeholder="Language (e.g., en)"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
              />
            </div>

            {mode === 'register' && (
              <div>
                <Label htmlFor="password_confirm">Confirm Password</Label>
                <Input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  required
                  value={formData.password_confirm}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                {mode === 'login' 
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'
                }
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
