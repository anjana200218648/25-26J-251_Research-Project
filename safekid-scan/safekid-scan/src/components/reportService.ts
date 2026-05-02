// src/utils/reportService.ts

const API_URLS = {
  main: 'http://localhost:5000/api/save-report',  // app.py (port 5000)
  fallback: 'http://localhost:8000/api/save-report' // main.py (port 8000)
};

export interface SaveReportResponse {
  success: boolean;
  id?: number;
  filename?: string;
  message?: string;
  error?: string;
}

/**
 * Save report to backend API
 * Tries main backend first, then fallback
 */
export const saveReportToAPI = async (reportData: any): Promise<SaveReportResponse> => {
  console.log('📤 Sending report to backend...');
  
  // Try main backend first (port 5000)
  try {
    console.log(`🔄 Trying main backend: ${API_URLS.main}`);
    const response = await fetch(API_URLS.main, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Report saved to main backend:', data);
      return data;
    } else {
      console.log(`⚠️ Main backend failed with status: ${response.status}`);
    }
  } catch (error) {
    console.log('⚠️ Main backend error:', error);
  }
  
  // Try fallback backend (port 8000)
  try {
    console.log(`🔄 Trying fallback backend: ${API_URLS.fallback}`);
    const response = await fetch(API_URLS.fallback, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Report saved to fallback backend:', data);
      return data;
    } else {
      console.log(`⚠️ Fallback backend failed with status: ${response.status}`);
      return {
        success: false,
        error: `Backend error: ${response.status}`
      };
    }
  } catch (error) {
    console.error('❌ Both backends failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not connect to any backend'
    };
  }
};

/**
 * Get all saved reports
 */
export const getReports = async (): Promise<any> => {
  try {
    // Try main backend first
    const response = await fetch('http://localhost:5000/api/reports');
    if (response.ok) {
      return await response.json();
    }
    
    // Try fallback
    const fallbackResponse = await fetch('http://localhost:8000/api/reports');
    if (fallbackResponse.ok) {
      return await fallbackResponse.json();
    }
    
    throw new Error('Could not fetch reports from any backend');
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
};

/**
 * Get report by ID
 */
export const getReportById = async (id: number): Promise<any> => {
  try {
    // Try main backend first
    const response = await fetch(`http://localhost:5000/api/reports/${id}`);
    if (response.ok) {
      return await response.json();
    }
    
    // Try fallback
    const fallbackResponse = await fetch(`http://localhost:8000/api/reports/${id}`);
    if (fallbackResponse.ok) {
      return await fallbackResponse.json();
    }
    
    throw new Error(`Could not fetch report ${id} from any backend`);
  } catch (error) {
    console.error(`Error fetching report ${id}:`, error);
    throw error;
  }
};

/**
 * Check if backend is available
 */
export const checkBackendHealth = async (): Promise<{ main: boolean; fallback: boolean }> => {
  const health = { main: false, fallback: false };
  
  try {
    const mainResponse = await fetch('http://localhost:5000/api/health');
    health.main = mainResponse.ok;
  } catch {
    health.main = false;
  }
  
  try {
    const fallbackResponse = await fetch('http://localhost:8000/api/health');
    health.fallback = fallbackResponse.ok;
  } catch {
    health.fallback = false;
  }
  
  return health;
};

export default {
  saveReportToAPI,
  getReports,
  getReportById,
  checkBackendHealth
};