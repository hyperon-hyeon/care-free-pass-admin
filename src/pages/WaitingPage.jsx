import { useEffect, useState } from "react";
import axios from "axios";

export default function PatientListPage() {
  const [patients, setPatients] = useState({
    beforeVisit: [],
    waiting: [],
    called: [],
  });

  const [token, setToken] = useState(localStorage.getItem("token"));

  // 상태별 환자 가져오기
  const fetchPatients = async () => {
    try {
      const statuses = ["beforeVisit", "waiting", "called"];
      const results = {};
      
      for (const status of statuses) {
        const res = await axios.get(
          `http://백엔드주소/api/patients?status=${status}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        results[status] = res.data; // 환자 배열
      }

      setPatients(results);
    } catch (err) {
      console.error("환자 목록 가져오기 실패", err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // 환자 호출
  const callPatient = async (patientId) => {
    try {
      await axios.post(
        `http://백엔드주소/api/patients/${patientId}/call`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPatients(); // 호출 후 목록 갱신
    } catch (err) {
      console.error("호출 실패", err);
    }
  };

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* 내원 전 */}
      <div>
        <h3>내원 전</h3>
        {patients.beforeVisit.map(p => (
          <div key={p.id}>
            {p.name} {p.age}세<br />
            {p.date}
          </div>
        ))}
      </div>

      {/* 대기 중 */}
      <div>
        <h3>대기 중</h3>
        {patients.waiting.map(p => (
          <div key={p.id}>
            {p.name} {p.age}세<br />
            {p.date}{" "}
            <button onClick={() => callPatient(p.id)}>호출</button>
          </div>
        ))}
      </div>

      {/* 호출됨 */}
      <div>
        <h3>호출됨</h3>
        {patients.called.map(p => (
          <div key={p.id}>
            {p.name} {p.age}세<br />
            {p.date}
          </div>
        ))}
      </div>
    </div>
  );
}
