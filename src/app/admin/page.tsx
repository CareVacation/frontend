'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationLimitsForMonth, setVacationLimit } from '@/lib/vacationService';
import { motion, AnimatePresence } from 'framer-motion';
import VacationCalendar from '@/components/VacationCalendar';
import AdminPanel from '@/components/AdminPanel';
import VacationDetails from '@/components/VacationDetails';

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
  
  // 직원 유형 필터링 상태 추가
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  
  // 이름 필터링 상태 추가
  const [nameFilter, setNameFilter] = useState<string | null>(null);

  // 정렬 방식 상태 추가
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name'>('latest');

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
    let filtered = allRequests;
    
    // 상태별 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }
    
    // 직원 유형별 필터링
    if (roleFilter !== 'all') {
      filtered = filtered.filter(request => request.role === roleFilter);
    }
    
    // 이름별 필터링
    if (nameFilter) {
      filtered = filtered.filter(request => request.userName === nameFilter);
    }
    
    // 정렬 적용
    let sorted = [...filtered];
    switch(sortOrder) {
      case 'latest':
        // 신청일 최신순 (createdAt 기준 내림차순)
        sorted.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        break;
      case 'oldest':
        // 신청일 오래된순 (createdAt 기준 오름차순)
        sorted.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        break;
      case 'vacation-date-asc':
        // 휴무일 오래된순 (date 기준 오름차순)
        sorted.sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          return dateA.localeCompare(dateB);
        });
        break;
      case 'vacation-date-desc':
        // 휴무일 최신순 (date 기준 내림차순)
        sorted.sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          return dateB.localeCompare(dateA);
        });
        break;
      case 'name':
        // 이름순 (userName 기준 오름차순)
        sorted.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
        break;
    }
    
    return sorted;
  }, [allRequests, statusFilter, roleFilter, nameFilter, sortOrder]);

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
        limitsMap[`${limit.date}_${limit.role}`] = limit;
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
        // roleFilter에 맞는 제한값만 적용
        const key = `${date}_${roleFilter}`;
        const limit = roleFilter !== 'all' ? (limitsMap[key] || { maxPeople: 3 }) : { maxPeople: 3 };
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

  // 날짜별 상세 데이터 조회 (role별로 필터)
  const fetchDateDetails = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      // roleFilter와 nameFilter를 쿼리스트링에 포함
      const apiUrl = `/api/vacation/date/${formattedDate}?role=${roleFilter}`;
      const response = await fetch(apiUrl, {
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
      
      // API 응답의 maxPeople 값 로깅
      console.log(`날짜 ${formattedDate} API 응답 maxPeople(${roleFilter}): ${data.maxPeople}`);
      
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
      // roleFilter에 따라 한 번 더 필터링
      let filtered = roleFilter === 'all' ? vacations : vacations.filter((v: VacationRequest) => v.role === roleFilter);
      
      // nameFilter가 있으면 이름으로 한 번 더 필터링
      if (nameFilter) {
        filtered = filtered.filter((v: VacationRequest) => v.userName === nameFilter);
      }
      
      setDateVacations(filtered);
      
      let dateRequests = data.vacations || [];
      
      // roleFilter에 따라 한 번 더 필터링
      if (roleFilter !== 'all') {
        dateRequests = dateRequests.filter((req: VacationRequest) => req.role === roleFilter);
      }
      
      // nameFilter가 있으면 이름으로 한 번 더 필터링
      if (nameFilter) {
        dateRequests = dateRequests.filter((req: VacationRequest) => req.userName === nameFilter);
      }
      
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
      const response = await fetch(`/api/vacation/date/${formattedDate}?role=${roleFilter}`, {
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
      let dateRequests = data.vacations || [];
      
      // roleFilter에 따라 한 번 더 필터링
      if (roleFilter !== 'all') {
        dateRequests = dateRequests.filter((req: VacationRequest) => req.role === roleFilter);
      }
      
      // nameFilter가 있으면 이름으로 한 번 더 필터링
      if (nameFilter) {
        dateRequests = dateRequests.filter((req: VacationRequest) => req.userName === nameFilter);
      }
      
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

  const handleLimitSet = async (date: Date, maxPeople: number, role: 'caregiver' | 'office') => {
    try {
      await setVacationLimit(date, maxPeople, role);
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
          },
          body: JSON.stringify({ isAdmin: true }),
          cache: 'no-store'
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
        
        // 캘린더 컴포넌트를 강제로 새로고침하기 위해 현재 날짜를 업데이트
        setCurrentDate(new Date(currentDate));
        
        // 1초 후에 한 번 더 데이터를 새로고침하여 캘린더가 확실히 업데이트되도록 함
        setTimeout(async () => {
          await fetchMonthData();
          if (selectedDate) {
            await fetchDateDetails(selectedDate);
          }
        }, 1000);
        
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

  // 직원 유형 필터 토글
  const toggleRoleFilter = (role: 'all' | 'caregiver' | 'office') => {
    // 현재 선택된 필터와 동일하면 필터 초기화 (전체 데이터 표시)
    if (roleFilter === role && role !== 'all') {
      setRoleFilter('all');
    } else {
      setRoleFilter(role);
    }
  };

  // 이름 필터 토글 함수
  const toggleNameFilter = (name: string) => {
    if (nameFilter === name) {
      // 이미 선택된 이름을 다시 클릭하면 필터 해제
      setNameFilter(null);
    } else {
      // 새로운 이름 선택
      setNameFilter(name);
    }
    
    // 달력 데이터 새로고침을 위해 현재 날짜를 업데이트
    // 이렇게 하면 useEffect에 의해 fetchMonthData가 다시 호출됨
    setCurrentDate(new Date(currentDate));
    
    // 현재 선택된 날짜가 있다면 해당 날짜의 상세 정보도 새로고침
    if (selectedDate) {
      fetchDateDetails(selectedDate);
    }
  };

  // 필터 초기화 함수 개선
  const resetFilter = async () => {
    // 모든 요청을 다시 불러오기
    await fetchAllRequests();
    setStatusFilter('all');
    setRoleFilter('all');
    setNameFilter(null);
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
                {/* 역할 필터 탭 UI */}
                <div className="flex justify-center gap-2 mb-4">
                  <button onClick={() => setRoleFilter('all')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>전체</button>
                  <button onClick={() => setRoleFilter('caregiver')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'caregiver' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>요양보호사</button>
                  <button onClick={() => setRoleFilter('office')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'office' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300'}`}>사무실</button>
                </div>
                
                {/* 이름 필터가 있을 경우 표시 */}
                {nameFilter && (
                  <div className="flex justify-center mb-4">
                    <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2">
                      <span>
                        <strong>{nameFilter}</strong>님의 휴가만 표시 중
                      </span>
                      <button 
                        onClick={() => setNameFilter(null)} 
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                <VacationCalendar
                  onDateSelect={handleDateSelect}
                  isAdmin={true}
                  maxPeopleAllowed={5}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  roleFilter={roleFilter}
                  nameFilter={nameFilter}
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedDate 
                      ? `${format(selectedDate, 'yyyy년 MM월 dd일', { locale: ko })} 휴무` 
                      : `${format(currentDate, 'yyyy년 M월')} 휴무 신청 목록`}
                  </h2>

                  {/* 필터 리셋 버튼 */}
                  {(statusFilter !== 'all' || roleFilter !== 'all' || selectedDate) && (
                    <button 
                      onClick={resetFilter}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      필터 초기화
                    </button>
                  )}
                </div>
                
                {/* 필터링 컨트롤 영역 */}
                <div className="mb-6 space-y-3">
                  {/* 상태 필터 */}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 mb-2">휴무 상태</span>
                    <div className="inline-flex shadow-sm rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleStatusFilter('all')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                        statusFilter === 'all' 
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-1 z-10 relative' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-l border-gray-300`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      전체
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('pending')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                        statusFilter === 'pending' 
                            ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-1 z-10 relative' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-gray-300 -ml-px`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      대기중
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('approved')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                        statusFilter === 'approved' 
                            ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-1 z-10 relative' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-gray-300 -ml-px`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      승인됨
                    </button>
                    <button
                      onClick={() => toggleStatusFilter('rejected')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                        statusFilter === 'rejected' 
                            ? 'bg-red-600 text-white ring-2 ring-red-600 ring-offset-1 z-10 relative' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-r border-gray-300 -ml-px`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      거부됨
                    </button>
                    </div>
                  </div>

                  {/* 직원 유형 필터 */}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 mb-2">직원 유형</span>
                    <div className="inline-flex shadow-sm rounded-md overflow-hidden">
                      <button
                        onClick={() => toggleRoleFilter('all')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                          roleFilter === 'all' 
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-1 z-10 relative' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-l border-gray-300`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        전체
                      </button>
                      <button
                        onClick={() => toggleRoleFilter('caregiver')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                          roleFilter === 'caregiver' 
                            ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-1 z-10 relative' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-gray-300 -ml-px`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        요양보호사
                      </button>
                      <button
                        onClick={() => toggleRoleFilter('office')}
                        className={`px-4 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                          roleFilter === 'office' 
                            ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-1 z-10 relative' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        } border-y border-r border-gray-300 -ml-px`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        사무실
                      </button>
                    </div>
                  </div>
                  
                  {/* 정렬 옵션 UI - 직원 유형 필터 아래로 이동 */}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700 mb-2">정렬 방식</span>
                    <div className="relative inline-block w-full">
                      <select
                        className="w-full appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as 'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name')}
                      >
                        <option value="latest">신청일 최신순</option>
                        <option value="oldest">신청일 오래된순</option>
                        <option value="vacation-date-desc">휴무일 최신순</option>
                        <option value="vacation-date-asc">휴무일 오래된순</option>
                        <option value="name">이름순</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>
                    </div>
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
                      {nameFilter && ` (${nameFilter})`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {filteredRequests.map((request) => (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 
                                className="font-semibold text-lg text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline"
                                onClick={() => toggleNameFilter(request.userName)}
                              >
                                {request.userName}
                                {nameFilter === request.userName && (
                                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                                    필터링됨
                                  </span>
                                )}
                              </h3>
                              
                              {/* 직원 유형 뱃지 */}
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                request.role === 'caregiver' 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                  : request.role === 'office' 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}>
                                {request.role === 'caregiver' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                )}
                                {request.role === 'office' && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                )}
                                {(!request.role || request.role === 'all') && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                )}
                                {request.role === 'caregiver' 
                                  ? '요양보호사' 
                                  : request.role === 'office' 
                                    ? '사무실' 
                                    : '전체'}
                              </span>
                            </div>
                            
                            <p className="text-gray-600 text-sm">{format(new Date(request.date), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}</p>
                            
                            {/* 휴가 타입 뱃지 */}
                            <div className="mt-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                request.type === 'regular' 
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {request.type === 'regular' ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  )}
                                </svg>
                                {request.type === 'regular' ? '일반 휴무' : '필수 휴무'}
                              </span>
                            </div>
                            
                            <p className="mt-2 text-sm bg-gray-100 p-2 rounded border border-gray-200 text-gray-800 font-medium">
                              {request.reason ? request.reason : <span className="text-gray-500">사유 없음</span>}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">신청일: {format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm')}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            request.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : request.status === 'approved'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
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
                                className="px-3 py-1.5 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors text-sm flex items-center gap-1 shadow-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                거부
                              </button>
                              <button
                                onClick={() => handleApproveVacation(request.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm flex items-center gap-1 shadow-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                승인
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteVacation(request.id)}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors text-sm flex items-center gap-1 shadow-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v12a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1zm0 4a1 1 0 00-1-1h-2a1 1 0 000 2h2a1 1 0 001-1z" clipRule="evenodd" />
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