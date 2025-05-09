'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, VacationLimit, VacationData, CalendarProps } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiRefreshCw, FiAlertCircle, FiCheck, FiUser, FiBriefcase, FiUsers } from 'react-icons/fi';
import { MdStar } from 'react-icons/md';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const VacationCalendar: React.FC<CalendarProps & { currentDate: Date; setCurrentDate: (date: Date) => void }> = ({ onDateSelect, onRequestSelect, isAdmin = false, maxPeopleAllowed = 5, currentDate, setCurrentDate }) => {
  const [calendarData, setCalendarData] = useState<VacationData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [isMonthChanging, setIsMonthChanging] = useState(false);

  const today = new Date();

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart]);
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd]);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const currentMonth = () => setCurrentDate(new Date());

  const fetchCalendarData = async () => {
    setIsLoading(true);
    setIsMonthChanging(true);
    
    try {
      console.log(`캘린더 데이터 가져오기 시작: ${new Date().toISOString()}`);
      
      const requestedMonth = format(currentDate, 'yyyy-MM');
      console.log(`요청 월: ${requestedMonth}`);
      
      const apiUrl = `/api/vacation/calendar`;
      
      const params = new URLSearchParams({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        roleFilter: activeFilter,
        _t: Date.now().toString(),
        _r: Math.random().toString().substring(2, 8)
      });
      
      console.log('캘린더 API 요청 URL:', `${apiUrl}?${params}`);
      console.log('요청 날짜 범위:', format(monthStart, 'yyyy-MM-dd'), '~', format(monthEnd, 'yyyy-MM-dd'));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${apiUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Request-Time': new Date().toISOString()
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const apiData = await response.json();
      
      const currentMonth = format(currentDate, 'yyyy-MM');
      if (currentMonth !== requestedMonth) {
        console.log(`응답 무시: 요청 월(${requestedMonth})과 현재 월(${currentMonth})이 다름`);
        return;
      }
      
      if (apiData && apiData.dates) {
        const responseDateKeys = Object.keys(apiData.dates);
        if (responseDateKeys.length > 0) {
          const firstDateMonth = responseDateKeys[0].substring(5, 7);
          const requestedMonthString = format(monthStart, 'MM');
          
          if (firstDateMonth !== requestedMonthString) {
            console.error(`응답 데이터 월 불일치! 요청: ${requestedMonthString}월, 응답: ${firstDateMonth}월`);
            console.log('잘못된 월 데이터 응답. 무시하고 재시도합니다.');
            
            setTimeout(() => {
              setIsMonthChanging(false);
              fetchCalendarData();
            }, 500);
            return;
          }
        }
      }
      
      console.log('API 응답 데이터 수신:', apiData);
      
      const formattedData: VacationData = {};
      
      if (apiData && apiData.dates && typeof apiData.dates === 'object') {
        console.log('날짜 데이터 발견:', Object.keys(apiData.dates).length, '개 날짜');
        
        Object.keys(apiData.dates).forEach(dateKey => {
          const dateData = apiData.dates[dateKey];
          
          if (dateData) {
            console.log(`날짜 ${dateKey} 데이터:`, dateData);
            
            const vacations = Array.isArray(dateData.vacations) ? dateData.vacations : [];
            const people = Array.isArray(dateData.people) ? dateData.people : [];
            const maxPeople = dateData.maxPeople !== undefined ? dateData.maxPeople : 3;
            
            const totalVacationers = dateData.totalVacationers !== undefined 
              ? dateData.totalVacationers 
              : vacations.filter((v: VacationRequest) => v.status !== 'rejected').length;
            
            formattedData[dateKey] = {
              date: dateKey,
              totalVacationers: totalVacationers,
              vacations: vacations,
              people: people,
              maxPeople: maxPeople
            };
            
            console.log(`날짜 ${dateKey} 처리 완료: 휴무자 ${totalVacationers}명, 최대 ${maxPeople}명`);
          }
        });
      } else {
        console.log('이전 형식의 API 응답 감지');
        Object.keys(apiData).forEach(dateKey => {
          const item = apiData[dateKey];
          if (item) {
            console.log(`날짜 ${dateKey} 데이터 처리:`, item);
            
            const validVacations = Array.isArray(item.vacations) 
              ? item.vacations.filter((v: VacationRequest) => v.status !== 'rejected') 
              : [];
            
            const totalVacationers = item.totalVacationers !== undefined 
              ? item.totalVacationers 
              : validVacations.length;
            
            formattedData[dateKey] = {
              date: dateKey,
              totalVacationers: totalVacationers,
              vacations: Array.isArray(item.vacations) ? item.vacations : [],
              maxPeople: item.maxPeople !== undefined ? item.maxPeople : 3
            };
            
            console.log(`날짜 ${dateKey} 변환 완료: ${formattedData[dateKey].totalVacationers}/${formattedData[dateKey].maxPeople}`);
          }
        });
      }
      
      console.log('변환된 캘린더 데이터:', formattedData);
      console.log('데이터 엔트리 수:', Object.keys(formattedData).length);
      
      setTimeout(() => {
        if (requestedMonth === format(currentDate, 'yyyy-MM')) {
          setCalendarData(formattedData);
          
          if (selectedDate && isSameMonth(selectedDate, currentDate)) {
            fetchSelectedDateData(selectedDate);
          }
          
          logAllVacations();
        } else {
          console.log('상태 업데이트 무시: 요청 월과 현재 월이 다름');
        }
      }, 100);
    } catch (error) {
      console.error('캘린더 데이터 로딩 오류:', error);
      
      if (error instanceof Error) {
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
      }
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setIsMonthChanging(false);
      }, 100);
    }
  };

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

  const handleRefresh = () => {
    console.log('수동 새로고침 요청');
    setIsLoading(true);
    fetchCalendarData();
    logAllVacations();
  };

  useEffect(() => {
    console.log('캘린더 마운트됨 - 초기 데이터 로드 시작');
    fetchCalendarData();
  }, []);

  useEffect(() => {
    console.log('월 변경됨 - 데이터 로드');
    if (!isMonthChanging) {
      fetchCalendarData();
    } else {
      console.log('월 변경 중 - 중복 요청 방지');
    }
  }, [currentDate, monthStart, monthEnd]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('페이지 포커스 복귀 - 데이터 새로고침');
        fetchCalendarData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    console.log(`필터 변경됨: ${activeFilter} - 데이터 로드`);
    fetchCalendarData();
  }, [activeFilter]);

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
    
    const maxPeople = dayData?.maxPeople || 3;
    
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

  const logAllVacations = () => {
    console.log("전체 캘린더 데이터:", calendarData);
    Object.keys(calendarData).forEach(dateKey => {
      const data = calendarData[dateKey];
      if (data.vacations && data.vacations.length > 0) {
        const validVacations = data.vacations.filter(v => v.status !== 'rejected');
        console.log(`${dateKey}의 휴무 신청자 ${validVacations.length}명 (전체 ${data.vacations.length}명):`, 
          validVacations.map(v => v.userName).join(', '));
      }
    });
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
        await fetchCalendarData();
        
        setTimeout(async () => {
          console.log('지연 데이터 갱신 실행...');
          await fetchCalendarData();
          
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
              className="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="이전 달"
            >
              <FiChevronLeft size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={currentMonth}
              className="p-1 sm:p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-blue-600"
              aria-label="이번 달로 돌아가기"
            >
              <FiCalendar size={12} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button 
              onClick={nextMonth}
              className="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="다음 달"
            >
              <FiChevronRight size={14} className="sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-1 sm:p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600"
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
          {calendarDays.map((day, index) => {
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
            const maxPeople = dayData?.maxPeople || 3;
            
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
          onUpdateSuccess={fetchCalendarData}
        />
      )}
    </div>
  );
};

export default VacationCalendar; 