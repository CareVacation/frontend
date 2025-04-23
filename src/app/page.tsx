'use client';

import { useState, useEffect } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import Calendar from '@/components/Calendar';
import VacationDetails from '@/components/VacationDetails';
import VacationForm from '@/components/VacationForm';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationsForDate, getVacationLimitsForMonth, getVacationLimitForDate, setVacationLimit } from '@/lib/vacationService';
import { AnimatePresence, motion } from 'framer-motion';
import VacationCalendar from '@/components/VacationCalendar';
import axios from 'axios';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});
  const [isUpdated, setIsUpdated] = useState(false);

  // 초기 데이터 로드 및 월 변경시 데이터 갱신
  useEffect(() => {
    fetchMonthData();
  }, [currentDate]);

  const fetchMonthData = async () => {
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // 휴가 데이터와 제한 데이터를 동시에 가져오기
      const [vacations, limits] = await Promise.all([
        getVacationsForMonth(year, month),
        getVacationLimitsForMonth(year, month)
      ]);

      // 휴가 제한 데이터 처리
      const limitsMap: Record<string, VacationLimit> = {};
      limits.forEach(limit => {
        limitsMap[limit.date] = limit;
      });
      setVacationLimits(limitsMap);
      
      // 날짜별 휴가 정보 생성
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
        
        days[date].count += 1;
        days[date].people.push(vacation);
      });
      
      // 휴가 제한 상태 업데이트
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

  const fetchDateDetails = async (date: Date) => {
    try {
      // 선택한 날짜에 대한 상세 정보를 가져오는 API 호출
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log('날짜 상세 정보 조회:', formattedDate);
      
      const response = await axios.get(`/api/vacation/date/${formattedDate}`);
      console.log('날짜 상세 데이터:', response.data);
      
      // 응답 데이터 확인 및 처리
      let vacations = [];
      if (response.data && Array.isArray(response.data.vacations)) {
        vacations = response.data.vacations;
      } else if (response.data && typeof response.data === 'object') {
        // 다른 형태의 응답 처리
        if (Array.isArray(response.data)) {
          vacations = response.data;
        } else {
          vacations = response.data.vacations || [];
        }
      }
      
      console.log('가져온 휴가 목록:', vacations);
      setDateVacations(vacations);
    } catch (error) {
      console.error('상세 정보 가져오기 오류:', error);
      setDateVacations([]);
      // 에러 발생 시 알림 표시
      showNotification('날짜 상세 정보를 가져오는데 실패했습니다.', 'error');
    }
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setShowDetails(true);
    setIsLoading(true);
    
    try {
      await fetchDateDetails(date);
    } catch (error) {
      console.error('날짜 상세 정보를 불러오는 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    document.body.style.overflow = ''; // 배경 스크롤 복원
  };

  const handleVacationUpdated = async () => {
    try {
      setIsLoading(true);
      if (selectedDate) {
        // 선택된 날짜의 데이터를 다시 불러옴
        await fetchDateDetails(selectedDate);
      }
      // 전체 캘린더 데이터 갱신 (VacationCalendar 내부에서 처리)
      setIsUpdated(prev => !prev);
    } catch (error) {
      console.error('데이터 업데이트 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowVacationForm = () => {
    setShowForm(true);
    setShowDetails(false);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseVacationForm = () => {
    setShowForm(false);
    document.body.style.overflow = '';
    if (selectedDate) {
      setShowDetails(true);
    }
  };

  const handleShowAdminPanel = () => {
    setShowAdminPanel(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false);
    document.body.style.overflow = '';
  };

  const handleLimitSet = async (date: Date, maxPeople: number) => {
    try {
      await setVacationLimit(date, maxPeople);
      await fetchMonthData();
      showNotification('휴가 제한 인원이 설정되었습니다.', 'success');
    } catch (error) {
      console.error('휴가 제한 설정 중 오류 발생:', error);
      showNotification('휴가 제한 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  const showNotification = (message: string, type: string) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // VacationCalendar에 전달할 onRequestSelect 함수 수정
  const handleRequestSelect = (date: Date): Promise<void> => {
    setSelectedDate(date);
    handleShowVacationForm();
    return Promise.resolve();
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
      <h1 className="text-4xl font-extrabold mb-8 text-center bg-gradient-to-r from-blue-600 to-indigo-800 text-transparent bg-clip-text drop-shadow-md">휴가 관리 시스템</h1>
      
      <div className="max-w-6xl mx-auto">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <VacationCalendar
              onDateSelect={handleDateSelect}
              onRequestSelect={handleRequestSelect}
              isAdmin={false}
              maxPeopleAllowed={5}
            />
          </motion.div>
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

      {/* 휴가 상세 정보 모달 */}
      <AnimatePresence>
        {showDetails && selectedDate && !showForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
            onClick={handleCloseDetails}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <VacationDetails
                date={selectedDate}
                vacations={dateVacations}
                isLoading={isLoading}
                onApplyVacation={handleShowVacationForm}
                onClose={handleCloseDetails}
                onVacationUpdated={handleVacationUpdated}
                maxPeople={5}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 휴가 신청 폼 모달 */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
            onClick={handleCloseVacationForm}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <VacationForm
                initialDate={selectedDate}
                onSubmitSuccess={() => {
                  handleCloseVacationForm();
                  handleVacationUpdated();
                  showNotification('휴가가 성공적으로 신청되었습니다.', 'success');
                }}
                onCancel={handleCloseVacationForm}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
