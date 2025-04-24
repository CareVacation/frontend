'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, VacationLimit, VacationData, CalendarProps } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import { FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiUsers, FiRefreshCw, FiAlertCircle, FiCheck } from 'react-icons/fi';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const VacationCalendar: React.FC<CalendarProps> = ({ onDateSelect, onRequestSelect, isAdmin = false, maxPeopleAllowed = 5 }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<VacationData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

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
    try {
      console.log(`API 호출: startDate=${format(monthStart, 'yyyy-MM-dd')}, endDate=${format(monthEnd, 'yyyy-MM-dd')}`);
      
      // 현재 호스트 기반 절대 URL 사용
      const apiUrl = `/api/vacation/calendar`;
      
      // 검색 파라미터 추가
      const params = new URLSearchParams({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd')
      });
      
      console.log('캘린더 API 요청 URL:', `${apiUrl}?${params}`);
      
      // fetch API 사용
      const response = await fetch(`${apiUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      // 응답 데이터 파싱
      const apiData = await response.json();
      console.log('API 응답 데이터:', apiData);
      
      // API 응답을 VacationData 형식으로 변환
      const formattedData: VacationData = {};
      
      // API 응답 구조에 따라 데이터 처리
      if (Array.isArray(apiData)) {
        // 배열 형태의 응답인 경우
        apiData.forEach(item => {
          if (item.date) {
            // 거부된 휴가는 총 인원 수에서 제외
            const validVacations = Array.isArray(item.vacations) 
              ? item.vacations.filter((v: VacationRequest) => v.status !== 'rejected') 
              : [];
              
            formattedData[item.date] = {
              date: item.date,
              totalVacationers: validVacations.length,
              vacations: Array.isArray(item.vacations) ? item.vacations : [],
              maxPeople: item.maxPeople || 3
            };
          }
        });
      } else if (typeof apiData === 'object' && apiData !== null) {
        // 객체 형태의 응답인 경우
        Object.keys(apiData).forEach(dateKey => {
          const item = apiData[dateKey];
          if (item) {
            // 거부된 휴가는 총 인원 수에서 제외
            const validVacations = Array.isArray(item.vacations) 
              ? item.vacations.filter((v: VacationRequest) => v.status !== 'rejected') 
              : [];
              
            formattedData[dateKey] = {
              date: dateKey,
              totalVacationers: validVacations.length,
              vacations: Array.isArray(item.vacations) ? item.vacations : [],
              maxPeople: item.maxPeople || 3
            };
          }
        });
      }
      
      console.log('변환된 캘린더 데이터:', formattedData);
      setCalendarData(formattedData);
      
      // 선택된 날짜가 있다면 해당 날짜의 데이터를 다시 가져옴
      if (selectedDate) {
        fetchSelectedDateData(selectedDate);
      }
    } catch (error) {
      console.error('캘린더 데이터 로딩 오류:', error);
      
      // 자세한 에러 정보 로깅
      if (error instanceof Error) {
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 선택된 날짜의 데이터를 가져오는 함수
  const fetchSelectedDateData = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log(`선택된 날짜 데이터 가져오기: ${formattedDate}`);
      
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
      console.log('날짜 상세 데이터:', data);
      
      // 데이터 업데이트
      if (data && data.vacations) {
        const newCalendarData = { ...calendarData };
        const validVacations = data.vacations.filter((v: VacationRequest) => v.status !== 'rejected');
        
        newCalendarData[formattedDate] = {
          date: formattedDate,
          totalVacationers: validVacations.length,
          vacations: data.vacations,
          maxPeople: data.maxPeople || 3
        };
        
        setCalendarData(newCalendarData);
      }
    } catch (error) {
      console.error('선택된 날짜 데이터 로딩 오류:', error);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentDate)) return;
    
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
      return;
    }
    
    setSelectedDate(date);
    
    // 선택된 날짜 데이터 가져오기
    fetchSelectedDateData(date);
    
    // page.tsx의 onDateSelect 함수를 호출하여 거기서 VacationDetails 모달을 표시
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
    const vacationersCount = dayData?.totalVacationers || 0;
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
    
    // 주말 여부에 관계없이 휴가자 수에 따라 배경색 적용
    if (vacationersCount === 0) {
      return {
        bg: 'bg-green-100 hover:bg-green-200',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-green-800',
        border: 'border-transparent',
        status: '가능'
      };
    } else if (vacationersCount < maxPeople) {
      const ratio = vacationersCount / maxPeople;
      if (ratio < 0.5) {
        return {
          bg: 'bg-green-50 hover:bg-green-100',
          text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-green-700',
          border: 'border-transparent',
          status: '여유'
        };
      } else {
        return {
          bg: 'bg-yellow-50 hover:bg-yellow-100',
          text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-yellow-700',
          border: 'border-transparent',
          status: '제한'
        };
      }
    } else if (vacationersCount === maxPeople) {
      return {
        bg: 'bg-orange-50 hover:bg-orange-100',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-orange-700',
        border: 'border-transparent',
        status: '마감'
      };
    } else {
      return {
        bg: 'bg-red-50 hover:bg-red-100',
        text: isWeekend ? (date.getDay() === 0 ? 'text-red-600' : 'text-indigo-600') : 'text-red-700',
        border: 'border-transparent',
        status: '초과'
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
    
    // 데이터 구조 로깅
    if (dayData?.vacations?.length > 0) {
      console.log(`${dateKey}의 휴가 신청자:`, dayData.vacations);
    } else if (dayData?.people && dayData.people.length > 0) {
      // people 배열도 확인 (이전 API 구조와의 호환성)
      console.log(`${dateKey}의 휴가 신청자(people):`, dayData.people);
      return dayData.people;
    }
    
    return dayData?.vacations || (dayData?.people || []);
  };

  // 데이터 디버깅을 위한 함수
  const logAllVacations = () => {
    console.log("전체 캘린더 데이터:", calendarData);
    Object.keys(calendarData).forEach(dateKey => {
      const data = calendarData[dateKey];
      if (data.vacations && data.vacations.length > 0) {
        console.log(`${dateKey}의 휴가 신청자 ${data.vacations.length}명:`, 
          data.vacations.map(v => v.userName).join(', '));
      }
    });
  };

  const handleShowAdminPanel = () => {
    setShowAdminPanel(true);
  };

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false);
    // 패널이 닫힐 때 데이터 즉시 갱신
    fetchCalendarData();
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 sm:p-6 flex flex-col">
        {/* 캘린더 헤더 */}
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
                휴가 일정 캘린더
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
              onClick={() => {
                fetchCalendarData();
                logAllVacations();
              }}
              className="p-1 sm:p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600"
              aria-label="데이터 새로고침"
            >
              <FiRefreshCw size={12} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            {isAdmin && (
              <button
                onClick={handleShowAdminPanel}
                className="p-1 sm:p-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-purple-600"
                aria-label="휴가 제한 설정"
              >
                <FiUsers size={12} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            )}
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1 sm:mb-2 text-center">
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

        {/* 캘린더 그리드 */}
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
            const vacationersCount = dayData?.totalVacationers || 0;
            const vacations = getDayVacations(day);
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
                    isSaturday ? 'text-indigo-500' : 
                    dayColor.text}`}
                  >
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
                          : vacationersCount >= maxPeople * 0.7
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-green-100 text-green-600'
                      }
                    `}>
                      {vacationersCount}/{maxPeople}
                    </span>
                  )}
                </div>
                
                {/* 신청자 이름 표시 */}
                {isCurrentMonth && vacations && vacations.length > 0 && (
                  <div className="mt-0.5 sm:mt-1.5 max-h-8 sm:max-h-12 overflow-hidden">
                    {vacations.slice(0, 2).map((vacation, idx) => (
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
                        <span className={`truncate max-w-[65%] ${
                          vacation.status === 'rejected'
                            ? 'text-red-600 line-through'
                            : 'text-gray-700'
                        }`}>
                          {vacation.userName || `이름 없음`}
                        </span>
                      </div>
                    ))}
                    {vacations.length > 2 && (
                      <div className="text-[6px] sm:text-xs text-gray-500 mt-0.5">+{vacations.length - 2}명</div>
                    )}
                  </div>
                )}
                
                {/* 인원 제한 상태 표시 */}
                {isCurrentMonth && (
                  <div className="absolute bottom-0 sm:bottom-1 right-0 sm:right-1.5">
                    {vacationersCount >= maxPeople ? (
                      <div className="text-[6px] sm:text-xs bg-red-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiAlertCircle size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    ) : vacationersCount >= maxPeople * 0.7 ? (
                      <div className="text-[6px] sm:text-xs bg-orange-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiAlertCircle size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    ) : (
                      <div className="text-[6px] sm:text-xs bg-green-500 text-white rounded-full w-2 h-2 sm:w-4 sm:h-4 flex items-center justify-center">
                        <FiCheck size={6} className="sm:w-[10px] sm:h-[10px]" />
                      </div>
                    )}
                  </div>
                )}
                
                {/* 선택 인디케이터 */}
                {isSelected && (
                  <div className="absolute inset-0 border-1 sm:border-2 border-blue-500 rounded-lg sm:rounded-xl pointer-events-none"></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* 캘린더 하단 범례 */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-100">
        <p className="text-[9px] sm:text-xs text-gray-500 mb-1 sm:mb-2 font-medium">상태 표시</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-3">
          <div className="flex items-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-[9px] sm:text-xs text-gray-600">여유</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-orange-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-[9px] sm:text-xs text-gray-600">제한적</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full mr-1 sm:mr-1.5"></div>
            <span className="text-[9px] sm:text-xs text-gray-600">마감/초과</span>
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