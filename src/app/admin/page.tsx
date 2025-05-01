'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationLimitsForMonth, setVacationLimit } from '@/lib/vacationService';
import { motion, AnimatePresence } from 'framer-motion';
import VacationCalendar from '@/components/VacationCalendar';
import AdminPanel from '@/components/AdminPanel';

export default function AdminPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showLimitPanel, setShowLimitPanel] = useState(false);
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});
  const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
  
  // 관리자 인증 관련 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 휴무 필터링 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);

  // 초기 로딩 시 인증 확인
  useEffect(() => {
    // 세션 스토리지에서 인증 상태 확인
    const authState = sessionStorage.getItem('adminAuthenticated');
    if (authState === 'true') {
      setIsAuthenticated(true);
      fetchInitialData();
    }
  }, []);

  // 데이터 로드 및 월 변경시 데이터 갱신
  useEffect(() => {
    if (isAuthenticated) {
      fetchMonthData();
      fetchAllRequests();
    }
  }, [currentDate, isAuthenticated]);

  // 필터링된 요청 목록 계산
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return allRequests;
    }
    return allRequests.filter(request => request.status === statusFilter);
  }, [allRequests, statusFilter]);

  const fetchInitialData = () => {
    fetchMonthData();
    fetchAllRequests();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 비밀번호 검증
    if (password === '123214') {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      setLoginError('');
      
      // 로그인 성공 후 데이터 가져오기
      fetchInitialData();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
  };

  const fetchMonthData = async () => {
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // 휴무 데이터와 제한 데이터를 동시에 가져오기
      const [vacations, limits] = await Promise.all([
        getVacationsForMonth(year, month),
        getVacationLimitsForMonth(year, month)
      ]);

      // 휴무 제한 데이터 처리
      const limitsMap: Record<string, VacationLimit> = {};
      limits.forEach(limit => {
        limitsMap[limit.date] = limit;
      });
      setVacationLimits(limitsMap);
      
      // 날짜별 휴무 정보 생성
      const days: Record<string, DayInfo> = {};
      
      vacations.forEach(vacation => {
        const date = vacation.date;
        
        if (!days[date]) {
          days[date] = {
            date,
            count: 0,
            people: []
          };
        }
        
        // 거부된 휴무는 people과 count 모두에 포함하지 않음
        if (vacation.status !== 'rejected') {
          days[date].people.push(vacation);
          days[date].count += 1;
        }
      });
      
      // 휴무 제한 상태 업데이트
      Object.keys(days).forEach(date => {
        const limit = limitsMap[date] || { maxPeople: 3 }; // 기본값: 3명
        const currentCount = days[date].count;
        
        days[date].limit = limit.maxPeople;
        
        if (currentCount < limit.maxPeople) {
          days[date].status = 'available'; // 여유 있음
        } else if (currentCount === limit.maxPeople) {
          days[date].status = 'full'; // 꽉 참
        } else {
          days[date].status = 'over'; // 초과됨
        }
      });
      
      setVacationDays(days);
    } catch (error) {
      console.error('데이터 로드 중 오류 발생:', error);
      showNotification('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllRequests = async () => {
    try {
      // axios 대신 fetch 사용하여 캐시 방지
      const response = await fetch('/api/vacation/pending', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setAllRequests(data.requests || []);
      const pendingOnly = data.requests.filter((req: VacationRequest) => req.status === 'pending') || [];
      setPendingRequests(pendingOnly);
    } catch (error) {
      console.error('휴무 요청을 불러오는 중 오류 발생:', error);
      showNotification('휴무 요청을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  const fetchDateDetails = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // fetch API로 변경
      const response = await fetch(`/api/vacation/date/${formattedDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      let vacations = [];
      if (data && Array.isArray(data.vacations)) {
        vacations = data.vacations;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          vacations = data;
        } else {
          vacations = data.vacations || [];
        }
      }
      
      console.log(`${formattedDate} 날짜의 휴무 데이터:`, vacations);
      setDateVacations(vacations);
    } catch (error) {
      console.error('상세 정보 가져오기 오류:', error);
      setDateVacations([]);
      showNotification('날짜 상세 정보를 가져오는데 실패했습니다.', 'error');
    }
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleDateSelect = async (date: Date | null) => {
    // date가 null이면 선택 해제로 간주하고 전체 데이터 표시
    if (date === null) {
      console.log('날짜 선택 해제: 전체 데이터로 복원');
      setSelectedDate(null);
      setShowDetails(false);
      setStatusFilter('all');
      
      // 즉시 전체 데이터 조회 및 화면 갱신
      setIsLoading(true);
      try {
        await fetchAllRequests();
        console.log('전체 데이터 조회 완료');
      } catch (error) {
        console.error('전체 데이터 조회 실패:', error);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // 이미 선택된 날짜를 다시 클릭하면 선택 해제하고 전체 데이터 표시
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
      setShowDetails(false);
      setStatusFilter('all');
      // 즉시 전체 데이터 조회 실행 - 비동기 함수 처리를 즉시 수행하도록 변경
      fetchAllRequests().then(() => {
        console.log('전체 데이터 조회 완료');
      }).catch(error => {
        console.error('전체 데이터 조회 실패:', error);
      });
      return;
    }
    
    setSelectedDate(date);
    setShowDetails(true);
    setIsLoading(true);
    
    try {
      await fetchDateDetails(date);
      
      // 특정 날짜 선택 시 필터를 해당 날짜의 데이터로 변경
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // 서버에서 해당 날짜의 요청을 가져오기
      const response = await fetch(`/api/vacation/date/${formattedDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const dateRequests = data.vacations || [];
      
      // 현재 필터 상태를 고려하여 요청 목록 갱신
      if (statusFilter === 'all') {
        setAllRequests(dateRequests);
      } else {
        // 상태별로 필터링
        const filteredByStatus = dateRequests.filter((req: VacationRequest) => req.status === statusFilter);
        setAllRequests(filteredByStatus);
      }
      
      console.log(`${formattedDate} 날짜 필터 적용됨:`, dateRequests.length);
    } catch (error) {
      console.error('날짜 상세 정보를 불러오는 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowLimitPanel = () => {
    setShowLimitPanel(true);
  };

  const handleCloseLimitPanel = () => {
    setShowLimitPanel(false);
  };

  const handleLimitSet = async (date: Date, maxPeople: number) => {
    try {
      await setVacationLimit(date, maxPeople);
      // 제한 설정 후 데이터 즉시 갱신
      await fetchMonthData();
      // 선택된 날짜가 있다면 해당 날짜 데이터도 갱신
      if (selectedDate) {
        await fetchDateDetails(selectedDate);
        
        // 전체 휴무 요청 목록도 갱신
        await fetchAllRequests();
        
        // 현재 선택된 날짜에 대한 필터 다시 적용
        if (selectedDate) {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          const dateFilteredRequests = allRequests.filter(req => req.date === formattedDate);
          setAllRequests(dateFilteredRequests);
        }
      }
      showNotification('휴무 제한 인원이 설정되었습니다.', 'success');
    } catch (error) {
      console.error('휴무 제한 설정 중 오류 발생:', error);
      showNotification('휴무 제한 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleApproveVacation = async (vacationId: string) => {
    try {
      setIsLoading(true);
      
      // axios 대신 fetch 사용
      const response = await fetch(`/api/vacation/approve/${vacationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      // 데이터 갱신
      await Promise.all([
        fetchAllRequests(),
        fetchMonthData(),
        selectedDate ? fetchDateDetails(selectedDate) : Promise.resolve()
      ]);
      
      showNotification('휴무 신청이 승인되었습니다.', 'success');
    } catch (error) {
      console.error('휴무 승인 중 오류 발생:', error);
      showNotification('휴무 승인 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectVacation = async (vacationId: string) => {
    try {
      setIsLoading(true);
      
      // axios 대신 fetch 사용
      const response = await fetch(`/api/vacation/reject/${vacationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0, must-revalidate'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      // 데이터 갱신
      await Promise.all([
        fetchAllRequests(),
        fetchMonthData(),
        selectedDate ? fetchDateDetails(selectedDate) : Promise.resolve()
      ]);
      
      showNotification('휴무 신청이 거부되었습니다.', 'success');
    } catch (error) {
      console.error('휴무 거부 중 오류 발생:', error);
      showNotification('휴무 거부 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteVacation = async (vacationId: string) => {
    try {
      if (confirm('정말로 이 휴무 신청을 삭제하시겠습니까?')) {
        setIsLoading(true);
        
        // axios 대신 fetch 사용
        const response = await fetch(`/api/vacation/delete/${vacationId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0, must-revalidate'
          }
        });
        
        if (!response.ok) {
          throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
        }
        
        // 데이터 갱신
        await Promise.all([
          fetchAllRequests(),
          fetchMonthData(),
          selectedDate ? fetchDateDetails(selectedDate) : Promise.resolve()
        ]);
        
        showNotification('휴무 신청이 삭제되었습니다.', 'success');
      }
    } catch (error) {
      console.error('휴무 삭제 중 오류 발생:', error);
      showNotification('휴무 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const showNotification = (message: string, type: string) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // 로그인 화면 렌더링
  const renderLoginForm = () => {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 bg-gradient-to-r from-purple-600 to-indigo-800 text-transparent bg-clip-text">
              관리자 로그인
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              관리자 페이지에 접근하려면 비밀번호를 입력하세요
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="password" className="sr-only">비밀번호</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="관리자 비밀번호"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                />
              </div>
            </div>

            {loginError && (
              <div className="text-red-500 text-sm text-center">
                {loginError}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                로그인
              </button>
            </div>
            
            <div className="text-center">
              <a 
                href="/"
                className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                메인 페이지로 돌아가기
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 필터 상태 토글 기능으로 수정
  const toggleStatusFilter = (status: 'all' | 'pending' | 'approved' | 'rejected') => {
    // 현재 선택된 필터와 동일하면 필터 초기화 (전체 데이터 표시)
    if (statusFilter === status && status !== 'all') {
      setStatusFilter('all');
      
      // 선택된 날짜가 있으면 해당 날짜의 모든 데이터를 표시
      if (selectedDate) {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        fetchDateDetails(selectedDate).then(() => {
          const dateFilteredRequests = allRequests.filter((req: VacationRequest) => req.date === formattedDate);
          setAllRequests(dateFilteredRequests);
        });
      } else {
        // 날짜가 선택되지 않았으면 모든 데이터 표시
        fetchAllRequests();
      }
    } else {
      setStatusFilter(status);
      
      // 선택된 날짜가 있으면 해당 날짜의 필터된 데이터만 표시
      if (selectedDate && status !== 'all') {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        // 전체 요청에서 날짜와 상태로 필터링
        const filteredByDateAndStatus = allRequests.filter(
          (req: VacationRequest) => req.date === formattedDate && req.status === status
        );
        console.log(`${formattedDate}의 ${status} 상태 필터 적용: ${filteredByDateAndStatus.length}건`);
      }
    }
  };

  // 필터 초기화 함수 개선
  const resetFilter = async () => {
    // 모든 요청을 다시 불러오기
    await fetchAllRequests();
    setStatusFilter('all');
    setSelectedDate(null);
    setShowDetails(false);
  };

  // 관리자 페이지 내용 렌더링
  return (
    <>
      {!isAuthenticated ? (
        renderLoginForm()
      ) : (
        <main className="flex flex-col min-h-screen p-6 bg-gray-50">
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-800 text-transparent bg-clip-text">관리자 페이지</h1>
              <div className="flex items-center gap-4">
                <a 
                  href="/"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  메인으로 돌아가기
                </a>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm5 4a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1zm0 4a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1z" clipRule="evenodd" />
                  </svg>
                  로그아웃
                </button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">휴무 캘린더</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleShowLimitPanel}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                      </svg>
                      휴무 제한 설정
                    </button>
                  </div>
                </div>
                <VacationCalendar
                  onDateSelect={handleDateSelect}
                  isAdmin={true}
                  maxPeopleAllowed={5}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedDate 
                      ? `${format(selectedDate, 'yyyy년 MM월 dd일', { locale: ko })} 휴무` 
                      : '휴무 신청 목록'}
                  </h2>
                  <div className="inline-flex shadow-sm rounded-md">
                    <button
                      onClick={() => toggleStatusFilter('all')}
                      className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                        statusFilter === 'all' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border border-gray-300`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('pending')}
                      className={`px-4 py-2 text-sm font-medium ${
                        statusFilter === 'pending' 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border-t border-b border-gray-300`}
                    >
                      대기중
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('approved')}
                      className={`px-4 py-2 text-sm font-medium ${
                        statusFilter === 'approved' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border-t border-b border-gray-300`}
                    >
                      승인됨
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('rejected')}
                      className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                        statusFilter === 'rejected' 
                          ? 'bg-red-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border border-gray-300`}
                    >
                      거부됨
                    </button>
                  </div>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin h-10 w-10 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>
                      {selectedDate 
                        ? `${format(selectedDate, 'yyyy년 MM월 dd일', { locale: ko })}에 ${
                            statusFilter === 'all' ? '휴무 신청이 없습니다' : 
                            statusFilter === 'pending' ? '대기 중인 휴무 신청이 없습니다' :
                            statusFilter === 'approved' ? '승인된 휴무 신청이 없습니다' : 
                            '거부된 휴무 신청이 없습니다'
                          }`
                        : `${
                            statusFilter === 'all' ? '휴무 신청이 없습니다' : 
                            statusFilter === 'pending' ? '대기 중인 휴무 신청이 없습니다' :
                            statusFilter === 'approved' ? '승인된 휴무 신청이 없습니다' : 
                            '거부된 휴무 신청이 없습니다'
                          }`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {filteredRequests.map((request) => (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg">{request.userName}</h3>
                            <p className="text-gray-600 text-sm">{format(new Date(request.date), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}</p>
                            <p className="mt-2 text-sm bg-gray-50 p-2 rounded">{request.reason}</p>
                            <p className="text-xs text-gray-500 mt-1">{request.type === 'regular' ? '일반 휴무' : request.type === 'mandatory' ? '필수 휴무' : request.type}</p>
                            <p className="text-xs text-gray-500 mt-2">신청일: {format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm')}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : request.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status === 'pending' ? '대기중' : 
                             request.status === 'approved' ? '승인됨' : '거부됨'}
                          </span>
                        </div>
                        <div className="mt-4 flex space-x-2 justify-end">
                          {request.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleRejectVacation(request.id)}
                                className="px-3 py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-sm"
                              >
                                거부
                              </button>
                              <button
                                onClick={() => handleApproveVacation(request.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                              >
                                승인
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteVacation(request.id)}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors text-sm flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1zm0 4a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1z" clipRule="evenodd" />
                            </svg>
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 알림 메시지 */}
          <AnimatePresence>
            {notification.show && (
              <motion.div 
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
                  notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                } text-white`}
              >
                {notification.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 휴무 제한 설정 모달 */}
          <AnimatePresence>
            {showLimitPanel && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
                onClick={handleCloseLimitPanel}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <AdminPanel
                    currentDate={currentDate}
                    vacationLimits={vacationLimits}
                    onClose={handleCloseLimitPanel}
                    onLimitSet={handleLimitSet}
                    onUpdateSuccess={() => {
                      fetchMonthData();
                      setCurrentDate(prev => new Date(prev));
                    }}
                    vacationDays={vacationDays}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}
    </>
  );
} 