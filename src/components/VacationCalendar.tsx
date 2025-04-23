'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addDays, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { DayInfo, VacationRequest, CalendarProps, VacationLimit, VacationData } from '@/types/vacation';
import AdminPanel from './AdminPanel';
import axios from 'axios';
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
      const response = await axios.get('/api/vacation/calendar', {
        params: {
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd')
        }
      });
      
      // API 응답 데이터 구조 확인
      console.log('API 응답 데이터:', response.data);
      
      // API 응답을 VacationData 형식으로 변환
      const apiData = response.data;
      const formattedData: VacationData = {};
      
      // API 응답 구조에 따라 데이터 처리
      if (Array.isArray(apiData)) {
        // 배열 형태의 응답인 경우
        apiData.forEach(item => {
          if (item.date) {
            formattedData[item.date] = {
              date: item.date,
              totalVacationers: Array.isArray(item.vacations) ? item.vacations.length : 0,
              vacations: Array.isArray(item.vacations) ? item.vacations : []
            };
          }
        });
      } else if (typeof apiData === 'object' && apiData !== null) {
        // 객체 형태의 응답인 경우
        Object.keys(apiData).forEach(dateKey => {
          const item = apiData[dateKey];
          if (item) {
            formattedData[dateKey] = {
              date: dateKey,
              totalVacationers: Array.isArray(item.vacations) ? item.vacations.length : 0,
              vacations: Array.isArray(item.vacations) ? item.vacations : []
            };
          }
        });
      }
      
      console.log('변환된 캘린더 데이터:', formattedData);
      setCalendarData(formattedData);
    } catch (error) {
      console.error('캘린더 데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
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
    
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    if (isToday(date)) {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-400',
        today: true
      };
    }
    
    if (isWeekend) {
      return {
        bg: 'bg-gray-100',
        text: date.getDay() === 0 ? 'text-red-500' : 'text-indigo-500',
        border: 'border-transparent'
      };
    }
    
    if (vacationersCount === 0) {
      return {
        bg: 'hover:bg-green-50',
        text: 'text-gray-700',
        border: 'border-transparent',
        status: '가능'
      };
    } else if (vacationersCount < maxPeopleAllowed) {
      const ratio = vacationersCount / maxPeopleAllowed;
      if (ratio < 0.5) {
        return {
          bg: 'bg-green-50 hover:bg-green-100',
          text: 'text-green-700',
          border: 'border-transparent',
          status: '여유'
        };
      } else {
        return {
          bg: 'bg-yellow-50 hover:bg-yellow-100',
          text: 'text-yellow-700',
          border: 'border-transparent',
          status: '제한'
        };
      }
    } else if (vacationersCount === maxPeopleAllowed) {
      return {
        bg: 'bg-orange-50 hover:bg-orange-100',
        text: 'text-orange-700',
        border: 'border-transparent',
        status: '마감'
      };
    } else {
      return {
        bg: 'bg-red-50 hover:bg-red-100',
        text: 'text-red-700',
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

  return (
    <div className="max-w-full md:max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 flex flex-col">
        {/* 캘린더 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
              <FiCalendar size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {format(currentDate, 'yyyy년 MM월', { locale: ko })}
              </h2>
              <p className="text-sm text-gray-500">
                휴가 일정 캘린더
              </p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button 
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="이전 달"
            >
              <FiChevronLeft size={20} />
            </button>
            <button 
              onClick={currentMonth}
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-blue-600"
              aria-label="이번 달로 돌아가기"
            >
              <FiCalendar size={18} />
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              aria-label="다음 달"
            >
              <FiChevronRight size={20} />
            </button>
            <button
              onClick={() => {
                fetchCalendarData();
                logAllVacations();
              }}
              className="p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-600"
              aria-label="데이터 새로고침"
            >
              <FiRefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((day, index) => (
            <div 
              key={day} 
              className={`py-2 text-center font-medium text-sm ${
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
          className="grid grid-cols-7 gap-2"
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
            
            return (
              <motion.div
                key={index}
                variants={fadeInVariants}
                onClick={() => handleDateClick(day)}
                className={`p-2 h-24 rounded-xl relative cursor-pointer transition-all ${
                  !isCurrentMonth ? 'opacity-40' : ''
                } ${isSelected ? 'ring-2 ring-blue-500 scale-[1.02] shadow-md z-10' : ''}
                ${dayColor.bg}
                ${isPast ? 'cursor-not-allowed opacity-60' : ''}
                hover:shadow-sm overflow-hidden aspect-square`}
              >
                <div className={`flex justify-between items-start`}>
                  <div className={`text-sm font-semibold ${
                    isSunday ? 'text-red-500' : 
                    isSaturday ? 'text-indigo-500' : 
                    dayColor.text}`}
                  >
                    {format(day, 'd')}
                    {isCurrentDay && (
                      <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  
                  {isCurrentMonth && vacationersCount > 0 && (
                    <span className={`
                      text-xs font-medium px-1.5 py-0.5 rounded-full inline-flex items-center
                      ${
                        vacationersCount >= maxPeopleAllowed 
                          ? 'bg-red-100 text-red-600' 
                          : vacationersCount >= maxPeopleAllowed * 0.7
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-green-100 text-green-600'
                      }
                    `}>
                      {vacationersCount}/{maxPeopleAllowed}
                    </span>
                  )}
                </div>
                
                {/* 신청자 이름 표시 */}
                {isCurrentMonth && vacations && vacations.length > 0 && (
                  <div className="mt-1.5 max-h-12 overflow-hidden">
                    {vacations.slice(0, 2).map((vacation, idx) => (
                      <div key={idx} className="flex items-center text-xs mb-0.5">
                        <div className={`w-1 h-1 rounded-full mr-1 flex-shrink-0
                          ${vacation.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                        </div>
                        <span className="truncate text-gray-700">{vacation.userName || `이름 없음`}</span>
                      </div>
                    ))}
                    {vacations.length > 2 && (
                      <div className="text-xs text-gray-500 mt-0.5">+{vacations.length - 2}명</div>
                    )}
                  </div>
                )}
                
                {/* 인원 제한 상태 표시 */}
                {isCurrentMonth && vacationersCount > 0 && (
                  <div className="absolute bottom-1 right-1.5">
                    {vacationersCount >= maxPeopleAllowed ? (
                      <div className="text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                        <FiAlertCircle size={10} />
                      </div>
                    ) : vacationersCount >= maxPeopleAllowed * 0.7 ? (
                      <div className="text-xs bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                        <FiAlertCircle size={10} />
                      </div>
                    ) : (
                      <div className="text-xs bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                        <FiCheck size={10} />
                      </div>
                    )}
                  </div>
                )}
                
                {/* 선택 인디케이터 */}
                {isSelected && (
                  <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none"></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* 캘린더 하단 범례 */}
      <div className="px-6 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2 font-medium">상태 표시</p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-1.5"></div>
            <span className="text-xs text-gray-600">여유</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-1.5"></div>
            <span className="text-xs text-gray-600">제한적</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-1.5"></div>
            <span className="text-xs text-gray-600">마감/초과</span>
          </div>
          <div className="flex items-center ml-4">
            <div className="w-1 h-1 bg-green-500 rounded-full mr-1.5"></div>
            <span className="text-xs text-gray-600">승인됨</span>
          </div>
          <div className="flex items-center">
            <div className="w-1 h-1 bg-yellow-500 rounded-full mr-1.5"></div>
            <span className="text-xs text-gray-600">대기중</span>
          </div>
        </div>
      </div>

      {isAdmin && showAdminPanel && (
        <AdminPanel
          currentDate={selectedDate || currentDate}
          onClose={() => setShowAdminPanel(false)}
          onUpdateSuccess={fetchCalendarData}
        />
      )}
    </div>
  );
};

export default VacationCalendar; 