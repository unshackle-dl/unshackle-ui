/**
 * React hooks for managing Unshackle API configuration and profiles.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  unshackleApi, 
  UnshackleApiError,
  ConfigResponse,
  ConfigUpdateRequest,
  ConfigUpdateResponse,
  ProfileListResponse,
  ProfileInfo,
  CredentialUpdateRequest,
  CredentialUpdateResponse
} from '@/lib/services/unshackle-api';

export interface UseConfigOptions {
  onError?: (error: UnshackleApiError) => void;
  onSuccess?: (message: string) => void;
}

/**
 * Hook for managing configuration settings.
 */
export function useConfig(options?: UseConfigOptions) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const configData = await unshackleApi.getConfig();
      setConfig(configData);
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to load configuration';
      setError(errorMessage);
      options?.onError?.(err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const updateConfig = useCallback(async (updates: ConfigUpdateRequest): Promise<ConfigUpdateResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await unshackleApi.updateConfig(updates);
      
      // Reload configuration to get updated values
      await loadConfig();
      
      options?.onSuccess?.(response.message);
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to update configuration';
      setError(errorMessage);
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadConfig, options]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    isLoading,
    error,
    loadConfig,
    updateConfig,
  };
}

/**
 * Hook for managing profiles and credentials.
 */
export function useProfiles(options?: UseConfigOptions) {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const profileData = await unshackleApi.getProfiles();
      setProfiles(profileData.profiles);
      
      // Find the active profile
      const active = profileData.profiles.find(p => p.is_active);
      setActiveProfile(active || null);
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to load profiles';
      setError(errorMessage);
      options?.onError?.(err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const activateProfile = useCallback(async (profileName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await unshackleApi.activateProfile(profileName);
      
      // Reload profiles to update active status
      await loadProfiles();
      
      options?.onSuccess?.(response.message);
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to activate profile';
      setError(errorMessage);
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles, options]);

  const updateCredentials = useCallback(async (
    profileName: string, 
    credentials: CredentialUpdateRequest
  ): Promise<CredentialUpdateResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await unshackleApi.updateCredentials(profileName, credentials);
      
      // Reload profiles to get updated credential status
      await loadProfiles();
      
      options?.onSuccess?.(response.message);
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to update credentials';
      setError(errorMessage);
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles, options]);

  const removeCredentials = useCallback(async (profileName: string, service: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await unshackleApi.removeServiceCredentials(profileName, service);
      
      // Reload profiles to get updated credential status
      await loadProfiles();
      
      options?.onSuccess?.(response.message);
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to remove credentials';
      setError(errorMessage);
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles, options]);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    profiles,
    activeProfile,
    isLoading,
    error,
    loadProfiles,
    activateProfile,
    updateCredentials,
    removeCredentials,
  };
}

/**
 * Hook for getting service credentials (read-only).
 */
export function useServiceCredentials(profileName: string, service: string) {
  const [credentials, setCredentials] = useState<{
    service: string;
    profile: string;
    has_username: boolean;
    has_password: boolean;
    has_cookies: boolean;
    username?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    if (!profileName || !service) return;

    setIsLoading(true);
    setError(null);

    try {
      const credentialData = await unshackleApi.getServiceCredentials(profileName, service);
      setCredentials(credentialData);
    } catch (err) {
      if (err instanceof UnshackleApiError && err.status === 404) {
        // No credentials found - this is normal
        setCredentials(null);
      } else {
        const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to load credentials';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [profileName, service]);

  // Load credentials when profile or service changes
  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  return {
    credentials,
    isLoading,
    error,
    loadCredentials,
  };
}