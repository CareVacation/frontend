import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationRequest, DayInfo } from '@/types/vacation';

interface CalendarProps {
  vacations?: VacationRequest[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

const Calendar: React.FC<CalendarProps> = ({ vacations = [], onSelectDate, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState(0); // 애니메이션 방향

  // 월 변경 함수 최적화
  const changeMonth = (delta: number) => {
    setDirection(delta);
    setCurrentMonth(prev => addMonths(prev, delta));
  };

  // 이전 달로 이동
  const prevMonth = () => changeMonth(-1);

  // 다음 달로 이동
  const nextMonth = () => changeMonth(1);

  // 달력 데이터 계산 - useMemo로 최적화
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    
    // 각 날짜에 휴가 신청 정보 추가
    const daysWithInfo = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayVacations = vacations.filter(v => v.date === dateStr);
      
      return {
        date: day,
        vacationCount: dayVacations.length,
        vacations: dayVacations
      };
    });
    
    // 첫 주의 비어있는 셀 채우기
    const blanks = Array(startDay).fill(null);
    
    // 6주(행) 채우기 위해 필요한 만큼 다음 달의 빈 셀 추가
    const totalCells = 6 * 7; // 6행 x 7열
    const daysWithBlanks = [...blanks, ...daysWithInfo];
    
    while (daysWithBlanks.length < totalCells) {
      daysWithBlanks.push(null);
    }
    
    // 6행 7열의 2차원 배열로 변환
    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(daysWithBlanks.slice(i * 7, (i + 1) * 7));
    }
    
    return rows;
  }, [currentMonth, vacations]);

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="calendar-container bg-white rounded-xl shadow-lg overflow-hidden">
      {/* 캘린더 헤더 */}
      <div className="calendar-header bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
        <button 
          onClick={prevMonth}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-all text-white"
          aria-label="이전 달"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold">
          {format(currentMonth, 'yyyy년 MM월', { locale: ko })}
        </h2>
        <button 
          onClick={nextMonth}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-all text-white"
          aria-label="다음 달"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 bg-gray-50">
        {weekDays.map((day, index) => (
          <div 
            key={index} 
            className={`p-3 text-center font-medium ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'}`}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* 달력 그리드 */}
      <div className="relative overflow-hidden">
        {/* 달력 내용 */}
        <div className="w-full">
          <div className="grid grid-cols-7 grid-rows-6 border-t border-l border-gray-200">
            {calendarData.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {row.map((dayInfo, colIndex) => {
                  if (!dayInfo) {
                    return (
                      <div 
                        key={`blank-${rowIndex}-${colIndex}`} 
                        className="p-1 border-b border-r border-gray-200 bg-gray-50 min-h-[90px] md:min-h-[100px]"
                      ></div>
                    );
                  }

                  const isToday = isSameDay(dayInfo.date, new Date());
                  const isSelected = selectedDate && isSameDay(dayInfo.date, selectedDate);
                  const isCurrentMonth = isSameMonth(dayInfo.date, currentMonth);
                  const isWeekend = getDay(dayInfo.date) === 0 || getDay(dayInfo.date) === 6;
                  
                  return (
                    <div 
                      key={`day-${rowIndex}-${colIndex}`}
                      onClick={() => onSelectDate(dayInfo.date)}
                      className={`
                        relative p-1 border-b border-r border-gray-200 cursor-pointer 
                        transition-all duration-200 group
                        ${isSelected ? 'bg-blue-50' : ''}
                        ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : ''}
                        ${isToday ? 'bg-yellow-50' : ''}
                        ${isWeekend && isCurrentMonth ? 'bg-gray-50' : ''}
                        hover:bg-blue-50
                      `}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start p-1">
                          <span 
                            className={`
                              flex items-center justify-center text-sm
                              ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full' : ''}
                              ${getDay(dayInfo.date) === 0 && isCurrentMonth ? 'text-red-500' : ''}
                              ${getDay(dayInfo.date) === 6 && isCurrentMonth ? 'text-blue-500' : ''}
                            `}
                          >
                            {format(dayInfo.date, 'd')}
                          </span>
                          {dayInfo.vacationCount > 0 && (
                            <div 
                              className={`
                                bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5
                                shadow-sm
                              `}
                            >
                              {dayInfo.vacationCount}
                            </div>
                          )}
                        </div>
                        
                        {/* 휴가 표시 */}
                        {dayInfo.vacationCount > 0 && isCurrentMonth && (
                          <div className="mt-1 px-1">
                            {dayInfo.vacations.slice(0, 2).map((vacation: VacationRequest, idx: number) => (
                              <div key={idx} className="text-xs my-0.5 bg-red-100 text-red-800 p-1 rounded truncate">
                                {vacation.userName}
                              </div>
                            ))}
                            {dayInfo.vacationCount > 2 && (
                              <div className="text-xs text-gray-500 mt-1">
                                +{dayInfo.vacationCount - 2}명
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* 선택 효과 */}
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none"></div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* 하단 정보 */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500">
        <div>
          <span className="inline-block w-3 h-3 rounded-full bg-blue-600 mr-1"></span> 오늘
        </div>
        <div>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span> 휴가신청
        </div>
      </div>
    </div>
  );
};

export default React.memo(Calendar); 