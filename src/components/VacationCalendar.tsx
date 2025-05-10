'use client';
import React, { useState, useEffect, useMemo, useCallback, SetStateAction } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, VacationLimit, VacationData, CalendarProps } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiRefreshCw, FiAlertCircle, FiCheck, FiUser, FiBriefcase, FiUsers } from 'react-icons/fi';
import { MdStar } from 'react-icons/md';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const VacationCalendar: React.FC<CalendarProps & { currentDate: Date; setCurrentDate: (date: Date | SetStateAction<Date>) => void }> = ({ onDateSelect, onRequestSelect, isAdmin = false, maxPeopleAllowed = 5, currentDate, setCurrentDate }) => {
  const [calendarData, setCalendarData] = useState<VacationData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [isMonthChanging, setIsMonthChanging] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showMonthError, setShowMonthError] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [error, setError] = useState('');
  
  const BUTTON_DELAY = 750;

  const MAX_RETRY_COUNT = 3;
  const MAX_RETRY_DELAY = 1000;

  const today = new Date();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  // 달력에 표시될 날짜 범위 계산
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  
  // 로그에 모든 휴가 데이터 출력
  const logAllVacations = useCallback(() => {
    if (Object.keys(calendarData).length === 0) {
      console.log('로그 출력 건너뜀: 휴가 데이터가 없습니다.');
      return;
    }
    
    Object.keys(calendarData).forEach(dateKey => {
      const dateData = calendarData[dateKey];
      if (dateData && dateData.vacations && dateData.vacations.length > 0) {
        // 필터에 맞는 휴가만 로깅
        const filteredVacations = dateData.vacations.filter(v => {
          return activeFilter === 'all' || v.role === activeFilter || v.role === 'all';
        });
        
        if (filteredVacations.length > 0) {
          const vacationersInfo = filteredVacations.map(v => 
            `${v.userName}(${v.role}, ${v.status})`
          ).join(', ');
          console.log(`${dateKey}의 휴무 신청자 필터링 후 (${filteredVacations.length}명): ${vacationersInfo}`);
        }
      }
    });
  }, [calendarData, activeFilter]);
  
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const currentRequestIdRef = React.useRef<string | null>(null);

  const fetchCalendarData = useCallback(async (date: Date, retry = 0) => {
    if (retry >= MAX_RETRY_COUNT) {
      setError(`${retry}회 재시도 후에도 데이터를 가져오지 못했습니다. 페이지를 새로고침해 주세요.`);
      setIsLoading(false);
      setIsMonthChanging(false);
      return;
    }

    if (abortControllerRef.current) {
      console.log('이전 요청 취소됨');
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError('');

    try {
      const requestId = Math.random().toString(36).substring(2, 15);
      currentRequestIdRef.current = requestId;
      
      console.log(`캘린더 데이터 가져오기 시작: ${date.toISOString()}`);
      
      const year = date.getFullYear();
      const month = date.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      const requestMonth = format(startDate, 'yyyy-MM');
      
      console.log(`요청 월: ${requestMonth}`);
      console.log(`요청 날짜 범위: ${startDateStr} ~ ${endDateStr}`);

      const url = `/api/vacation/calendar?startDate=${startDateStr}&endDate=${endDateStr}&roleFilter=${activeFilter}&_t=${Date.now()}&_r=${requestId}&_retry=${retry}`;
      console.log(`캘린더 API 요청 URL: ${url}`);
      
      const response = await fetch(url, {
        signal: signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (signal.aborted) {
        console.log('요청이 취소되었습니다.');
        return;
      }

      if (currentRequestIdRef.current !== requestId) {
        console.log(`요청 ID 불일치로 응답 무시 (현재: ${currentRequestIdRef.current}, 응답: ${requestId})`);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 오류:', errorData);
        
        if (errorData.error && errorData.error.includes('월 불일치')) {
          console.error(`응답 데이터 월 불일치! 요청: ${requestMonth.substring(5)}, 응답: ${errorData.error.match(/응답: (\d{2})월/)?.[1] || '알 수 없음'} (시도: ${retry + 1}/${MAX_RETRY_COUNT})`);
          
          const delay = Math.min(1000 * Math.pow(2, retry), MAX_RETRY_DELAY);
          console.log(`잘못된 월 데이터 응답. 무시하고 ${delay}ms 후 재시도합니다.`);
          
          setTimeout(() => {
            // 재시도할 때 현재 활성화된 요청이 있는지 확인
            const currentId = currentRequestIdRef.current;
            if (currentId) {
              fetchCalendarData(date, retry + 1);
            }
          }, delay);
          return;
        }
        
        throw new Error(errorData.error || '알 수 없는 오류가 발생했습니다.');
      }

      const data = await response.json();
      
      const dates = Object.keys(data.dates || {});
      if (dates.length > 0) {
        const firstDateMonth = dates[0].substring(0, 7);
        
        if (firstDateMonth !== requestMonth) {
          console.error(`응답 데이터 월 불일치! 요청: ${requestMonth.substring(5)}, 응답: ${firstDateMonth.substring(5)} (시도: ${retry + 1}/${MAX_RETRY_COUNT})`);
          
          const hasRequestMonthData = dates.some(date => date.startsWith(requestMonth));
          
          if (!hasRequestMonthData) {
            const delay = Math.min(1000 * Math.pow(2, retry), MAX_RETRY_DELAY);
            console.log(`잘못된 월 데이터 응답. 무시하고 ${delay}ms 후 재시도합니다.`);
            
            setTimeout(() => {
              // 재시도할 때 현재 활성화된 요청이 있는지 확인
              const currentId = currentRequestIdRef.current;
              if (currentId) {
                fetchCalendarData(date, retry + 1);
              }
            }, delay);
            return;
          } else {
            console.warn(`응답에 일부 ${requestMonth} 데이터가 있습니다. 필터링하여 사용합니다.`);
            
            // 요청 월에 해당하는 데이터만 필터링
            const filteredDates: { [key: string]: VacationData[string] } = {};
            Object.entries(data.dates || {}).forEach(([dateKey, dateData]) => {
              if (dateKey.startsWith(requestMonth)) {
                // 타입 안전하게 처리
                if (dateData && typeof dateData === 'object' && 'date' in dateData && 'totalVacationers' in dateData && 'vacations' in dateData) {
                  filteredDates[dateKey] = dateData as VacationData[string];
                } else {
                  console.warn(`데이터 형식 불일치 - 날짜 ${dateKey} 무시됨`, dateData);
                }
              }
            });
            
            data.dates = filteredDates;
          }
        }
      }
      
      if (currentRequestIdRef.current === requestId) {
        console.log('캘린더 데이터 가져오기 완료');
        
        const dateKeys = Object.keys(data.dates || {});
        console.log(`응답 데이터 날짜 키 (${dateKeys.length}개): ${dateKeys.slice(0, 3).join(', ')}${dateKeys.length > 3 ? '...' : ''}`);
        
        setCalendarData(data.dates || {});
        setRetryCount(0);
        setIsLoading(false);
        setIsMonthChanging(false);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('요청이 취소되었습니다.');
        return;
      }
      
      console.error('캘린더 데이터 가져오기 오류:', error);
      
      if (retry < MAX_RETRY_COUNT - 1) {
        const delay = Math.min(1000 * Math.pow(2, retry), MAX_RETRY_DELAY);
        console.log(`${delay}ms 후 재시도합니다 (${retry + 1}/${MAX_RETRY_COUNT})`);
        
        setTimeout(() => {
          // 재시도할 때 현재 활성화된 요청이 있는지 확인
          const currentId = currentRequestIdRef.current;
          if (currentId) {
            fetchCalendarData(date, retry + 1);
          }
        }, delay);
      } else {
        setError('데이터를 가져오지 못했습니다. 페이지를 새로고침해 주세요.');
        setIsLoading(false);
        setIsMonthChanging(false);
      }
    }
  }, [activeFilter, MAX_RETRY_COUNT, MAX_RETRY_DELAY]);

  const fetchSelectedDateData = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log(`선택된 날짜 데이터 가져오기: ${formattedDate}`);
      
      const cacheParam = `?_t=${Date.now()}&_r=${Math.random().toString().substring(2, 8)}`;
      
      const response = await fetch(`/api/vacation/date/${formattedDate}${cacheParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache',
          'X-Request-Time': new Date().toISOString()
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('날짜 상세 데이터:', data);
      
      if (data) {
        console.log(`CalendarData 현재 키:`, Object.keys(calendarData));
        
        const newCalendarData = { ...calendarData };
        
        const dateKey = data.date || formattedDate;
        console.log(`API 응답의 날짜 키: ${dateKey}, 요청한 날짜: ${formattedDate}`);
        
        newCalendarData[formattedDate] = {
          date: formattedDate,
          vacations: data.vacations || [],
          maxPeople: data.maxPeople !== undefined ? data.maxPeople : 3,
          totalVacationers: data.totalVacationers !== undefined 
                          ? data.totalVacationers 
                          : (data.vacations || []).filter((v: VacationRequest) => v.status !== 'rejected').length
        };
        
        console.log(`${formattedDate} 날짜 데이터 업데이트 완료:`, newCalendarData[formattedDate]);
        setCalendarData(newCalendarData);
      }
    } catch (error) {
      console.error('선택된 날짜 데이터 로딩 오류:', error);
    }
  };

  const handleRefresh = useCallback(() => {
    const refreshData = async () => {
      try {
        await fetchCalendarData(currentDate);
        
        setTimeout(async () => {
          console.log('지연 데이터 갱신 실행...');
          await fetchCalendarData(currentDate);
          
          if (selectedDate) {
            fetchSelectedDateData(selectedDate);
          }
        }, 1000);
      } catch (err) {
        console.error('새로고침 중 오류:', err);
      }
    };

    console.log('수동 새로고침 요청');
    setIsLoading(true);
    refreshData();
    logAllVacations();
  }, [fetchCalendarData, currentDate, selectedDate, fetchSelectedDateData, logAllVacations]);

  const prevMonth = useCallback(() => {
    if (isButtonDisabled) return;
    
    setIsButtonDisabled(true);
    setIsMonthChanging(true);
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate((prev: Date) => {
      const newDate = subMonths(prev, 1);
      console.log(`월 변경: ${format(prev, 'yyyy-MM')} → ${format(newDate, 'yyyy-MM')}`);
      return newDate;
    });
    
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, BUTTON_DELAY);
  }, [isButtonDisabled, BUTTON_DELAY, setCurrentDate, setIsMonthChanging]);

  const nextMonth = useCallback(() => {
    if (isButtonDisabled) return;
    
    setIsButtonDisabled(true);
    setIsMonthChanging(true);
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate((prev: Date) => {
      const newDate = addMonths(prev, 1);
      console.log(`월 변경: ${format(prev, 'yyyy-MM')} → ${format(newDate, 'yyyy-MM')}`);
      return newDate;
    });
    
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, BUTTON_DELAY);
  }, [isButtonDisabled, BUTTON_DELAY, setCurrentDate, setIsMonthChanging]);

  const resetToCurrentMonth = useCallback(() => {
    if (isButtonDisabled) return;
    
    setIsButtonDisabled(true);
    setIsMonthChanging(true);
    
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setCurrentDate(startOfMonth(new Date()));
    
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, BUTTON_DELAY);
  }, [isButtonDisabled, BUTTON_DELAY, setCurrentDate, setIsMonthChanging]);

  // 캘린더 초기 로드
  useEffect(() => {
    console.log('캘린더 마운트됨 - 초기 데이터 로드 시작');
    fetchCalendarData(currentDate);
  }, [fetchCalendarData, currentDate]);

  // 월 변경시 데이터 로드
  useEffect(() => {
    console.log('월 변경됨 - 데이터 로드');
    if (!isMonthChanging) {
      fetchCalendarData(currentDate);
    } else {
      console.log('월 변경 중 - 중복 요청 방지');
    }
  }, [currentDate, isMonthChanging, fetchCalendarData]);

  // 탭이 포커스를 받았을 때 데이터 새로고침
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('페이지 포커스 복귀 - 데이터 새로고침');
        fetchCalendarData(currentDate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCalendarData, currentDate]);

  // 필터 변경시 데이터 로드
  useEffect(() => {
    console.log(`필터 변경됨: ${activeFilter} - 데이터 로드`);
    fetchCalendarData(currentDate);
  }, [activeFilter, fetchCalendarData, currentDate]);

  useEffect(() => {
    setRetryCount(0);
    setShowMonthError(false);
  }, [currentDate]);

  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentDate)) return;
    
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
      
      if (onDateSelect) {
        console.log('날짜 선택 해제, onDateSelect(null) 호출');
        onDateSelect(null);
      }
      return;
    }
    
    setSelectedDate(date);
    
    fetchSelectedDateData(date);
    
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const getDayColor = (date: Date) => {
    if (!isSameMonth(date, currentDate)) {
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-300',
        border: 'border-transparent'
      };
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    
    const filteredVacations = getDayVacations(date);
    const vacationersCount = filteredVacations.length;
    
    const maxPeople = dayData?.maxPeople ?? 3;
    
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    if (isToday(date)) {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-400',
        today: true
      };
    }
    
    if (vacationersCount < maxPeople) {
      return {
        bg: 'bg-green-100 hover:bg-green-200',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-green-800',
        border: 'border-transparent',
        status: '여유'
      };
    } else {
      return {
        bg: 'bg-red-100 hover:bg-red-200',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-red-700',
        border: 'border-transparent',
        status: '마감'
      };
    }
  };

  const selectedDateInfo = selectedDate
    ? calendarData[format(selectedDate, 'yyyy-MM-dd')]
    : null;

  const selectedVacations = selectedDateInfo?.vacations || [];

  const fadeInVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const getDayVacations = (date: Date): VacationRequest[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    
    if (!dayData) {
      return [];
    }
    
    let vacations = Array.isArray(dayData.vacations) && dayData.vacations.length > 0
      ? dayData.vacations
      : Array.isArray(dayData.people) && dayData.people.length > 0
      ? dayData.people
      : [];
    
    vacations = vacations.filter(vacation => vacation.status !== 'rejected');
    
    if (activeFilter !== 'all') {
      vacations = vacations.filter(vacation => vacation.role === activeFilter);
    }
    
    if (vacations.length > 0) {
      console.log(`${dateKey}의 휴무 신청자 필터링 후 (${vacations.length}명):`, 
        vacations.map(v => `${v.userName}(${v.role}, ${v.status})`).join(', '));
    }
    
    return vacations;
  };

  const handleShowAdminPanel = () => {
    setShowAdminPanel(true);
  };

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false);
    console.log('관리자 패널 닫힘, 데이터 즉시 새로고침...');
    
    setIsLoading(true);
    
    const refreshData = async () => {
      try {
        await fetchCalendarData(currentDate);
        
        setTimeout(async () => {
          console.log('지연 데이터 갱신 실행...');
          await fetchCalendarData(currentDate);
          
          if (selectedDate) {
            console.log('선택된 날짜 데이터 갱신...');
            await fetchSelectedDateData(selectedDate);
          }
        }, 1000);
      } catch (error) {
        console.error('데이터 새로고침 중 오류:', error);
      }
    };
    
    refreshData();
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
      {showMonthError && (
        <div className="p-3 m-3 bg-red-100 text-red-700 rounded-lg text-sm">
          <p className="font-medium">데이터 로드 오류</p>
          <p>요청한 월({format(currentDate, 'yyyy년 MM월')})의 데이터를 가져오지 못했습니다. 새로고침 버튼을 눌러 다시 시도해주세요.</p>
        </div>
      )}
      <div className="p-2 sm:p-6 flex flex-col">
        <div className="flex justify-between items-center mb-2 sm:mb-6">
          <div className="flex items-center space-x-1 sm:space-x-4">
            <div className="bg-blue-100 p-1 sm:p-2 rounded-full text-blue-600">
              <FiCalendar size={14} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-2xl font-bold text-gray-800">
                {format(currentDate, 'yyyy년 MM월', { locale: ko })}
              </h2>
              <p className="text-[10px] sm:text-sm text-gray-500">
                휴무 일정 캘린더
              </p>
            </div>
          </div>

          <div className="flex space-x-0.5 sm:space-x-2">
            <button 
              onClick={prevMonth}
              disabled={isButtonDisabled || isLoading}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                isButtonDisabled || isLoading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="이전 달"
            >
              <FiChevronLeft size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={resetToCurrentMonth}
              disabled={isButtonDisabled || isLoading}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                isButtonDisabled || isLoading
                  ? 'bg-blue-50 text-blue-300 cursor-not-allowed opacity-50'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
              }`}
              aria-label="이번 달로 돌아가기"
            >
              <FiCalendar size={12} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button 
              onClick={nextMonth}
              disabled={isButtonDisabled || isLoading}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                isButtonDisabled || isLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="다음 달"
            >
              <FiChevronRight size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`p-1 sm:p-2 rounded-lg transition-all duration-300 ${
                isLoading
                  ? 'bg-green-50 text-green-300 cursor-not-allowed'
                  : 'bg-green-50 hover:bg-green-100 text-green-600'
              }`}
              aria-label="데이터 새로고침"
            >
              <FiRefreshCw size={12} className={`${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-center mb-3 sm:mb-5">
          <div className="inline-flex bg-gray-100 p-1 rounded-lg shadow-sm">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1
                ${activeFilter === 'all' 
                  ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300' 
                  : 'text-black hover:bg-gray-200'}`}
            >
              <FiUsers className="w-3 h-3 sm:w-4 sm:h-4" />
              전체
            </button>
            <button
              onClick={() => setActiveFilter('caregiver')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1
                ${activeFilter === 'caregiver' 
                  ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-300' 
                  : 'text-black hover:bg-gray-200'}`}
            >
              <FiUser className="w-3 h-3 sm:w-4 sm:h-4" />
              요양보호사
            </button>
            <button
              onClick={() => setActiveFilter('office')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1
                ${activeFilter === 'office' 
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' 
                  : 'text-black hover:bg-gray-200'}`}
            >
              <FiBriefcase className="w-3 h-3 sm:w-4 sm:h-4" />
              사무실
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((day, index) => (
            <div 
              key={day} 
              className={`py-0.5 sm:py-2 text-center font-medium text-[8px] sm:text-sm ${
                index === 0 ? 'text-red-500' : 
                index === 6 ? 'text-indigo-500' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <motion.div 
          className="grid grid-cols-7 gap-x-1 gap-y-2 sm:gap-x-3 sm:gap-y-4"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.01
              }
            }
          }}
        >
          {dateRange.map((day, index) => {
            const isCurrentDay = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSunday = getDay(day) === 0;
            const isSaturday = getDay(day) === 6;
            const isPast = isBefore(day, startOfDay(new Date()));
            
            let dayColor = getDayColor(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData[dateKey];
            const vacations = getDayVacations(day);
            const vacationersCount = vacations.length;
            const maxPeople = dayData?.maxPeople ?? 3;
            
            return (
              <motion.div
                key={index}
                variants={fadeInVariants}
                onClick={() => handleDateClick(day)}
                className={`p-1 sm:p-2 min-h-[44px] sm:min-h-[96px] rounded-lg sm:rounded-xl relative cursor-pointer transition-all ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isSelected ? 'ring-2 ring-blue-500 scale-[1.02] shadow-md z-10' : ''}
                ${dayColor.bg}
                ${isPast ? 'cursor-not-allowed opacity-60' : ''}
                hover:shadow-sm overflow-hidden`}
              >
                <div className={`flex justify-between items-start`}>
                  <div className={`text-[10px] sm:text-sm font-semibold ${
                    isSunday ? 'text-red-500' : 
                    isSaturday ? 'text-blue-500' : 
                    'text-black'}
                  `}>
                    {format(day, 'd')}
                    {isCurrentDay && (
                      <span className="ml-0.5 sm:ml-1 inline-flex h-1 w-1 sm:h-2 sm:w-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  
                  {isCurrentMonth && (
                    <span className={`
                      text-[6px] sm:text-xs font-medium px-0.5 sm:px-1.5 py-0 sm:py-0.5 rounded-full inline-flex items-center
                      ${
                        vacationersCount >= maxPeople
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-green-100 text-green-600'
                      }
                    `}>
                      {vacationersCount}/{maxPeople}
                    </span>
                  )}
                </div>
                
                {isCurrentMonth && vacations && vacations.length > 0 && (
                  <div className="mt-0.5 sm:mt-1.5 max-h-16 sm:max-h-12 md:max-h-16 overflow-hidden">
                    {vacations
                      .slice(0, 3)
                      .map((vacation, idx) => (
                        <div key={idx} className="flex items-center text-[6px] sm:text-xs mb-0.5">
                          <span className={`flex-shrink-0 whitespace-nowrap text-[6px] sm:text-xs mr-0.5 sm:mr-1 px-0.5 sm:px-1 py-0 sm:py-0.5 rounded-full
                            ${vacation.status === 'approved' 
                              ? 'bg-green-100 text-green-600' 
                              : vacation.status === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-600'}`}>
                            {vacation.status === 'approved' 
                              ? '승인' 
                              : vacation.status === 'rejected'
                              ? '거절'
                              : '대기'}
                          </span>
                          <span className={`max-w-full sm:truncate sm:max-w-[60%] break-all ${
                            vacation.status === 'rejected'
                              ? 'text-red-600 line-through'
                              : 'text-black'
                          }`}>
                            {vacation.userName || `이름 없음`}
                          </span>
                          {vacation.type === 'mandatory' && (
                            <MdStar className="hidden sm:inline ml-0.5 text-amber-500 flex-shrink-0" size={10} />
                          )}
                        </div>
                      ))}
                    {vacations.length > 3 && (
                      <div className="text-[6px] sm:text-xs text-gray-500 mt-0.5">+{vacations.length - 3}명</div>
                    )}
                  </div>
                )}
                
                {isCurrentMonth && (
                  <div className="absolute bottom-0 sm:bottom-1 right-0 sm:right-1.5">
                    {vacationersCount >= maxPeople ? (
                      <div className="text-[6px] sm:text-xs bg-red-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiAlertCircle size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    ) : (
                      <div className="text-[6px] sm:text-xs bg-green-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiCheck size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    )}
                  </div>
                )}
                
                {isSelected && (
                  <div className="absolute inset-0 border-1 sm:border-2 border-blue-500 rounded-lg sm:rounded-xl pointer-events-none"></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-100">
        <p className="text-[9px] sm:text-xs text-gray-500 mb-1 sm:mb-2 font-medium">상태 표시</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-3">
          <div className="flex items-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-[9px] sm:text-xs text-gray-600">여유</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-[9px] sm:text-xs text-gray-600">마감</span>
          </div>
          <div className="flex items-center ml-2 sm:ml-4">
            <span className="text-[8px] sm:text-xs px-0.5 sm:px-1 py-0 sm:py-0.5 bg-green-100 text-green-600 rounded-full mr-1 sm:mr-1.5">승인</span>
            <span className="text-[9px] sm:text-xs text-gray-600">승인됨</span>
          </div>
          <div className="flex items-center">
            <span className="text-[8px] sm:text-xs px-0.5 sm:px-1 py-0 sm:py-0.5 bg-yellow-100 text-yellow-600 rounded-full mr-1 sm:mr-1.5">대기</span>
            <span className="text-[9px] sm:text-xs text-gray-600">대기중</span>
          </div>
          <div className="flex items-center">
            <span className="text-[8px] sm:text-xs px-0.5 sm:px-1 py-0 sm:py-0.5 bg-red-100 text-red-600 rounded-full mr-1 sm:mr-1.5">거절</span>
            <span className="text-[9px] sm:text-xs text-gray-600">거부됨</span>
          </div>
        </div>
      </div>

      {isAdmin && showAdminPanel && (
        <AdminPanel
          currentDate={selectedDate || currentDate}
          onClose={handleCloseAdminPanel}
          onUpdateSuccess={() => fetchCalendarData(currentDate)}
        />
      )}
    </div>
  );
};

export default VacationCalendar; 