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
import AdminPanel from '@/components/AdminPanel';

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
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');

  // 초기 데이터 로드 및 월 변경시 데이터 갱신
  useEffect(() => {
    fetchMonthData();
  }, [currentDate]);

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
        
        days[date].people.push(vacation);
        
        // 거부된 휴무는 카운트에 포함시키지 않음
        if (vacation.status !== 'rejected') {
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

  const fetchDateDetails = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
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
      // 역할별로 필터링
      const filtered = roleFilter === 'all' ? vacations : vacations.filter((v: VacationRequest) => v.role === roleFilter);
      setDateVacations(filtered);
    } catch (error) {
      setDateVacations([]);
      showNotification('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleDateSelect = async (date: Date | null) => {
    if (!date) return;
    
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

  const handleLimitSet = async (date: Date, maxPeople: number, role: 'caregiver' | 'office') => {
    try {
      await setVacationLimit(date, maxPeople, role);
      await fetchMonthData();
      showNotification('휴무 제한 인원이 설정되었습니다.', 'success');
    } catch (error) {
      console.error('휴무 제한 설정 중 오류 발생:', error);
      showNotification('휴무 제한 설정 중 오류가 발생했습니다.', 'error');
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
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-4 sm:py-8 px-2 sm:px-6 overflow-hidden">
        <header className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-blue-700 mb-1 sm:mb-2">휴무 관리 시스템</h1>
          <p className="text-xs sm:text-base text-gray-600">팀원들의 휴무 일정을 한눈에 확인하고 관리하세요.</p>
        </header>
        {/* 역할 필터 탭 UI */}
        <div className="flex justify-center gap-2 mb-4">
          <button onClick={() => setRoleFilter('all')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>전체</button>
          <button onClick={() => setRoleFilter('caregiver')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'caregiver' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>요양보호사</button>
          <button onClick={() => setRoleFilter('office')} className={`px-4 py-2 rounded-full text-sm font-semibold border ${roleFilter === 'office' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300'}`}>사무실</button>
        </div>
        <div className="max-w-5xl mx-auto">
          <VacationCalendar
            onDateSelect={handleDateSelect}
            onRequestSelect={handleDateSelect}
            key={`calendar-${isUpdated}`}
            maxPeopleAllowed={5}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            roleFilter={roleFilter}
          />
        </div>
      </div>

      {/* 휴무 상세 정보 모달 */}
      <AnimatePresence>
        {showDetails && selectedDate && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 bg-opacity-50">
            <VacationDetails
              date={selectedDate}
              vacations={dateVacations}
              onClose={handleCloseDetails}
              onApplyVacation={handleShowVacationForm}
              isLoading={isLoading}
              maxPeople={
                (() => {
                  // roleFilter와 날짜를 기준으로 정확한 휴가 제한을 가져옴
                  const dateStr = format(selectedDate, 'yyyy-MM-dd');
                  // roleFilter가 'all'일 때는 caregiver 값 사용 (API와 일치)
                  const lookupRole = roleFilter === 'all' ? 'caregiver' : roleFilter;
                  const limitKey = `${dateStr}_${lookupRole}`;
                  
                  console.log(`상세 정보 휴가 제한 조회: 키=${limitKey}, 역할=${lookupRole}`);
                  
                  // 1. vacationLimits에서 정확한 역할+날짜 키로 찾기
                  const limit = vacationLimits[limitKey]?.maxPeople;
                  
                  // 2. 찾지 못하면 해당 날짜의 dayInfo 확인
                  if (limit !== undefined) {
                    console.log(`VacationDetails maxPeople: ${limit} (vacationLimits에서 가져옴)`);
                    return limit;
                  }
                  
                  // 3. vacationDays에서 최종 확인
                  const dayLimit = vacationDays[dateStr]?.limit;
                  const result = typeof dayLimit === 'number' ? dayLimit : 3;
                  console.log(`VacationDetails maxPeople: ${result} (vacationDays에서 가져옴)`);
                  return result;
                })()
              }
              onVacationUpdated={handleVacationUpdated}
              roleFilter={roleFilter}
              isAdmin={false}
            />
          </div>
        )}
      </AnimatePresence>

      {/* 휴무 신청 폼 모달 */}
      <AnimatePresence>
        {showForm && selectedDate && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl p-4 sm:p-6 max-w-md w-full"
            >
              <VacationForm
                initialDate={selectedDate}
                onSubmitSuccess={() => {
                  handleCloseVacationForm();
                  handleVacationUpdated();
                  showNotification('휴무 신청이 완료되었습니다.', 'success');
                }}
                onCancel={handleCloseVacationForm}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                roleFilter={roleFilter}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 알림 메시지 */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white shadow-lg text-xs sm:text-sm`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AdminPanel */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 bg-opacity-50">
            <AdminPanel
              currentDate={currentDate}
              onClose={handleCloseAdminPanel}
              onUpdateSuccess={fetchMonthData}
              vacationLimits={vacationLimits}
              onLimitSet={handleLimitSet}
              vacationDays={vacationDays}
            />
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
