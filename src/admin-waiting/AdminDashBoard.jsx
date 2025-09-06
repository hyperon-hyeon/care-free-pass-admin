import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import StatusColumn from './StatusColumn.jsx';
import AdminHeader from '../component/AdminHeader.jsx';
import UserModal from '../component/UserModal.jsx';
import './AdminDashBoard.css';

const statusMap = {
  WAITING: '내원전',
  SCHEDULED:'내원전',
  BOOKED: '예약됨',
  ARRIVED: '대기중',
  CALLED: '호출됨',
  COMPLETED: '완료됨',
  CANCELLED: '취소됨',
};

const Sidebar = ({ onClose }) => (
  <div>
    <button onClick={onClose}>닫기</button>
    <p>사이드바</p>
  </div>
);

function AdminDashboard() {
  const API = 'http://13.209.99.158:8080';
  const token = localStorage.getItem("token");

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState({ adminName: '', hospitalName: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [hospitalId, setHospitalId] = useState(1); // 동적으로 설정할 수 있도록

  // 🔹 토큰 유효성 검사
  const validateToken = () => {
    if (!token) {
      console.error('토큰이 없습니다. 로그인이 필요합니다.');
      return false;
    }
    return true;
  };

  // 🔹 API 에러 핸들링
  const handleApiError = (error, operation) => {
    console.error(`${operation} 실패:`, error);

    if (error.response) {
      const { status, data } = error.response;
      console.error(`HTTP ${status}:`, data);
      if (status === 401) {
        console.error('인증 실패. 토큰이 만료되었거나 유효하지 않습니다.');
      } else if (status === 403) {
        console.error('권한이 없습니다.');
      } else if (status === 404) {
        console.error('요청한 리소스를 찾을 수 없습니다.');
      }
    } else if (error.request) {
      console.error('네트워크 오류:', error.request);
    } else {
      console.error('요청 설정 오류:', error.message);
    }
  };

  // 🔹 진료과 목록 API
  const fetchDepartments = useCallback(async () => {
    if (!validateToken()) {
      setDepartments(['사과']);
      return;
    }

    try {
      console.log('진료과 정보를 가져오는 중...', {
        url: `${API}/api/v1/admin/hospitals/${hospitalId}/departments`,
        token: token ? 'exists' : 'missing',
        hospitalId
      });

      const response = await axios.get(
        `${API}/api/v1/admin/hospitals/${hospitalId}/departments`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('진료과 API 응답:', response.data);

      if (response.data.code === 'HOSPITAL_3002' && response.data.data) {
        const departmentNames = response.data.data.map((dept) => dept.name);
        setDepartments(departmentNames);
        console.log('진료과 목록 설정 완료:', departmentNames);
      } else {
        console.warn('진료과 데이터 형식이 예상과 다릅니다:', response.data);
        throw new Error('Invalid response format');
      }
    } catch (error) {
      handleApiError(error, '진료과 정보 불러오기');
      const defaultDepartments = ['정형외과', '내과', '치과', '산부인과', '이비인후과', '안과'];
      setDepartments(defaultDepartments);
      console.log('기본 진료과 목록으로 설정:', defaultDepartments);
    }
  }, [API, token, hospitalId]);

  // 🔹 예약 정보 API
  const fetchAppointments = useCallback(async () => {
    if (!validateToken()) {
      setAppointments([]);
      return;
    }

    try {
      console.log('예약 정보를 가져오는 중...');
      const response = await axios.get(`${API}/api/v1/appointments/today`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('예약 API 응답:', response.data);

      const allData = response.data.data || [];
      const formattedData = allData.map((appointment) => ({
        ...appointment,
        name: appointment.memberName,
        status: statusMap[appointment.status] || appointment.statusDescription,
      }));

      setAppointments(formattedData);
      console.log('예약 정보 설정 완료:', formattedData.length, '건');
    } catch (error) {
      handleApiError(error, '예약 정보 불러오기');
      setAppointments([]);
    }
  }, [API, token]);

  // 초기 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      const adminData = { adminName: '김관리', hospitalName: '구름대병원' };
      setAdminInfo(adminData);

      await fetchDepartments();
      await fetchAppointments();

      setLoading(false);
    };
    
    initializeData();
  }, [fetchDepartments, fetchAppointments]);

  // 예약 정보 5분마다 자동 새로고침
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAppointments();
    }, 300000);
    return () => clearInterval(intervalId);
  }, [fetchAppointments]);

  // 호출
  const handleCall = async (appointmentId) => {
    if (!validateToken()) return;
    try {
      await axios.put(
        `${API}/api/v1/appointments/${appointmentId}/status/CALLED`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAppointments();
      alert('환자 호출에 성공했습니다!');
    } catch (error) {
      handleApiError(error, '환자 호출');
      alert('환자 호출에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 삭제
  const handleDelete = async (appointmentId) => {
    if (!validateToken()) return;
    try {
      await axios.delete(`${API}/api/v1/appointments/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchAppointments();
      alert('환자 삭제에 성공했습니다!');
    } catch (error) {
      handleApiError(error, '환자 삭제');
      alert('환자 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleCardClick = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const today = new Date();
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
  };

  const filteredAppointments = selectedDepartment
    ? appointments.filter((app) => app.department === selectedDepartment)
    : appointments;

  const pendingUsers = filteredAppointments.filter((app) => app.status === '내원전');
  const waitingUsers = filteredAppointments.filter((app) => app.status === '대기중');
  const calledUsers = filteredAppointments.filter((app) => app.status === '호출됨');

  if (loading) {
    return <div style={{ textAlign: 'center', fontSize: '150px' }}>로딩 중...</div>;
  }

  return (
    <div>
      <AdminHeader
        adminName={adminInfo.adminName}
        hospitalName={adminInfo.hospitalName}
        onToggleSidebar={handleToggleSidebar}
      />
      {isSidebarOpen && <Sidebar onClose={handleToggleSidebar} />}

      <div className="dashboard">
        <div className="board-waiting-box">
          <div className="board-left-area">
            <div className="board-waiting-info">
              <h2 className="board-waiting-title">대기 목록</h2>
            </div>
          </div>
          <div className="board-right-area">
            <select
              id="departmentSelect"
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              className="chip-style"
            >
              <option value="">과를 선택하세요</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <p className="board-waiting-date">{formattedDate}</p>
          </div>
        </div>

        <div className="board-status-list">
          <StatusColumn title="내원전" users={pendingUsers} onCall={handleCall} onCardClick={handleCardClick} />
          <StatusColumn title="대기중" users={waitingUsers} onCall={handleCall} onCardClick={handleCardClick} />
          <StatusColumn title="호출됨" users={calledUsers} onCall={handleCall} onCardClick={handleCardClick} />
        </div>
      </div>

      {isModalOpen && selectedUser && <UserModal user={selectedUser} onClose={handleCloseModal} />}
    </div>
  );
}

export default AdminDashboard;
