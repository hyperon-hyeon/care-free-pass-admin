import axios from 'axios';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL; // Vite 환경에서 올바른 접근
const BASE_URL = `${ADMIN_URL}/auth/hospital`;

// 토큰 관리 헬퍼 함수들
export const tokenManager = {
  // 토큰 저장
  setTokens: (accessToken, refreshToken = null) => {
    localStorage.setItem('token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    // 토큰 저장 시간도 기록 (만료 시간 추정용)
    localStorage.setItem('tokenSetTime', Date.now().toString());
  },

  // 토큰 가져오기
  getToken: () => localStorage.getItem('token'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),

  // 토큰 삭제
  clearTokens: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenSetTime');
  },

  // 토큰 만료 여부 확인 (JWT 디코딩)
  isTokenExpired: (token) => {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      if (payload.exp) {
        return payload.exp < currentTime;
      } else {
        const tokenSetTime = localStorage.getItem('tokenSetTime');
        if (tokenSetTime) {
          const oneHour = 60 * 60 * 1000; 
          return Date.now() - parseInt(tokenSetTime) > oneHour;
        }
        return true;
      }
    } catch (error) {
      console.error('토큰 디코딩 실패:', error);
      return true;
    }
  },

  // 토큰이 곧 만료될 예정인지 확인 (5분 전)
  isTokenExpiringSoon: (token) => {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const fiveMinutes = 5 * 60;
      if (payload.exp) {
        return payload.exp - currentTime < fiveMinutes;
      }
      return false;
    } catch (error) {
      return true;
    }
  }
};

// 토큰 갱신 API
export const refreshAccessToken = async () => {
  try {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const response = await axios.post(
      `${BASE_URL}/refresh`,
      { refreshToken },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data?.data || response.data;
    if (data.accessToken) {
      tokenManager.setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
    
    throw new Error('No access token in refresh response');
  } catch (error) {
    console.error('토큰 갱신 실패:', error);
    tokenManager.clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw error;
  }
};

// 자동 토큰 갱신 포함 API 요청
export const makeAuthenticatedRequest = async (requestConfig) => {
  let token = tokenManager.getToken();
  if (!token) {
    throw new Error('No token available');
  }
  if (tokenManager.isTokenExpired(token) || tokenManager.isTokenExpiringSoon(token)) {
    try {
      token = await refreshAccessToken();
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  }
  const config = {
    ...requestConfig,
    headers: {
      ...requestConfig.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  try {
    const response = await axios(config);
    return response;
  } catch (error) {
    if (error.response?.status === 401) {
      try {
        token = await refreshAccessToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        const retryResponse = await axios(config);
        return retryResponse;
      } catch (refreshError) {
        console.error('토큰 갱신 후 재요청 실패:', refreshError);
        throw refreshError;
      }
    }
    throw error;
  }
};

//회원가입 API (주석 처리됨)
export const signUp = async (adminName, adminEmail, adminPassword, hospitalName, hospitalAddress) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/sign-up`,
      {
        adminName,
        adminEmail,
        adminPassword,
        hospitalName,
        hospitalAddress
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    const data = response.data?.data || response.data;
    if (data.accessToken) {
      tokenManager.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  } catch (error) {
    console.error('회원가입 오류:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// 로그인 API
export const signIn = async (email, password) => {
  const requestData = {
    adminEmail: email,
    adminPassword: password
  };

  console.log('=== 로그인 요청 디버깅 ===');
  console.log('ADMIN_URL:', ADMIN_URL);
  console.log('BASE_URL:', BASE_URL);
  console.log('전송 데이터:', requestData);
  console.log('요청 URL:', `${BASE_URL}/sign-in`);

  try {
    const response = await axios.post(
      `${BASE_URL}/sign-in`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('로그인 응답:', response.data);
    const data = response.data?.data || response.data;
    if (data.accessToken) {
      tokenManager.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  } catch (error) {
    console.log('=== 에러 상세 정보 ===');
    console.log('상태코드:', error.response?.status);
    console.log('에러 메시지:', error.response?.data);
    console.log('응답 헤더:', error.response?.headers);
    console.log('========================');
    console.error('로그인 오류:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// 로그아웃 API
export const signOut = async () => {
  try {
    const token = tokenManager.getToken();
    if (token) {
      await makeAuthenticatedRequest({
        method: 'POST',
        url: `${BASE_URL}/sign-out`
      });
    }
  } catch (error) {
    console.error('로그아웃 오류:', error);
  } finally {
    tokenManager.clearTokens();
  }
};

// 토큰 상태 확인 함수
export const checkTokenStatus = () => {
  const token = tokenManager.getToken();
  if (!token) {
    return { valid: false, expired: true, message: 'No token found' };
  }
  if (tokenManager.isTokenExpired(token)) {
    return { valid: false, expired: true, message: 'Token expired' };
  }
  if (tokenManager.isTokenExpiringSoon(token)) {
    return { valid: true, expired: false, expiringSoon: true, message: 'Token expiring soon' };
  }
  return { valid: true, expired: false, expiringSoon: false, message: 'Token valid' };
};
