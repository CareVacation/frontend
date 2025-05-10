'use client';
import { useState, useEffect } from 'react';
import { VacationLimit, DayInfo } from '@/types/vacation';
import { format, addDays, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
  vacationLimits?: Record<string, VacationLimit>;
  onLimitSet?: (date: Date, maxPeople: number, role: 'caregiver' | 'office') => Promise<void>;
  vacationDays?: Record<string, DayInfo>;
}

const AdminPanel = ({ currentDate, onClose, onUpdateSuccess, vacationLimits, onLimitSet }: AdminPanelProps) => {
  const [panelDate, setPanelDate] = useState(currentDate);
  const [limits, setLimits] = useState<VacationLimit[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    setPanelDate(currentDate); // 모달 열릴 때 부모 값으로 초기화
  }, [currentDate]);

  useEffect(() => {
    fetchMonthLimits();
  }, [panelDate]);

  const fetchMonthLimits = async () => {
    try {
      const monthStart = startOfMonth(panelDate);
      const monthEnd = endOfMonth(panelDate);
      const response = await fetch(`/api/vacation/limits?start=${format(monthStart, 'yyyy-MM-dd')}&end=${format(monthEnd, 'yyyy-MM-dd')}`);
      
      if (!response.ok) {
        throw new Error('휴무 제한 정보를 가져오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      // API 응답 확인 로그 추가
      console.log('[AdminPanel] API 응답 limits:', data.limits);
      // 날짜별로 데이터 정리
      const existingLimits = data.limits || [];
      const allLimits: VacationLimit[] = [];
      
      let currentDay = monthStart;
      while (currentDay <= monthEnd) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        // 요양보호사
        const caregiverLimit =
          existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr &&
              limit.role === 'caregiver' &&
              limit.id === `${dateStr}_caregiver`
          ) ||
          existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr &&
              limit.role === 'caregiver'
          );
        allLimits.push({
          id: caregiverLimit?.id,
          date: dateStr,
          maxPeople: caregiverLimit?.maxPeople !== undefined ? caregiverLimit.maxPeople : 3,
          createdAt: caregiverLimit?.createdAt,
          role: 'caregiver',
        });
        // 사무실
        const officeLimit =
          existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr &&
              limit.role === 'office' &&
              limit.id === `${dateStr}_office`
          ) ||
          existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr &&
              limit.role === 'office'
          );
        allLimits.push({
          id: officeLimit?.id,
          date: dateStr,
          maxPeople: officeLimit?.maxPeople !== undefined ? officeLimit.maxPeople : 3,
          createdAt: officeLimit?.createdAt,
          role: 'office',
        });
        currentDay = addDays(currentDay, 1);
      }
      setLimits(allLimits);
    } catch (err) {
      console.error('휴가 제한 조회 오류:', err);
      setError('휴가 제한 조회에 실패했습니다.');
    }
  };

  const handleUpdateLimit = (date: string, role: 'caregiver' | 'office', value: number) => {
    const idx = limits.findIndex(l => l.date === date && l.role === role);
    if (idx === -1) return;
    const newLimits = [...limits];
    newLimits[idx] = { ...newLimits[idx], maxPeople: value };
    setLimits(newLimits);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      setIsSubmitting(true);
      setError('');
      // 저장할 데이터에서 role이 'all'인 것은 제외
      const saveLimits = limits.filter(l => l.role === 'caregiver' || l.role === 'office');
      console.log('[AdminPanel] 저장할 제한 데이터:', saveLimits);
      const timestamp = Date.now();
      // 각 제한 항목별로 onLimitSet 호출 (role 포함)
      if (onLimitSet) {
        for (const limit of saveLimits) {
          await onLimitSet(new Date(limit.date), limit.maxPeople, limit.role);
        }
      }
      const response = await fetch(`/api/vacation/limits?_t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          limits: saveLimits,
          timestamp
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AdminPanel] 저장 실패:', errorData);
        throw new Error(errorData.error || '저장 중 오류가 발생했습니다');
      }
      
      const result = await response.json();
      console.log('[AdminPanel] 저장 성공:', result);
      
      // 성공 메시지 표시
      setMessage({ type: 'success', text: '휴가 제한이 성공적으로 저장되었습니다' });
      
      // 변경 사항이 저장된 후 성공 콜백 호출
      if (onUpdateSuccess) {
        console.log('[AdminPanel] 성공 콜백 호출');
        try {
          await onUpdateSuccess();
          console.log('[AdminPanel] 첫 번째 데이터 갱신 완료');
        } catch (err) {
          console.error('[AdminPanel] 첫 번째 데이터 갱신 실패:', err);
        }
        setTimeout(async () => {
          try {
            console.log('[AdminPanel] 지연 성공 콜백 호출');
            await onUpdateSuccess();
            console.log('[AdminPanel] 두 번째 데이터 갱신 완료');
          } catch (err) {
            console.error('[AdminPanel] 두 번째 데이터 갱신 실패:', err);
          }
        }, 1000);
      }
      
      // 저장 후 최신 데이터 즉시 반영
      await fetchMonthLimits();
      
      // 약간의 지연 후 패널 닫기
      setTimeout(() => {
        if (onClose) {
          console.log('[AdminPanel] 패널 닫기');
          onClose();
        }
      }, 1500);
      
    } catch (error) {
      console.error('[AdminPanel] 저장 중 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      // 로딩 상태 해제
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl border-2 border-blue-500">
      <div className="flex justify-between items-center mb-6 border-b pb-4 border-blue-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPanelDate(prev => subMonths(prev, 1))}
            className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
            disabled={isSaving || isSubmitting}
          >
            ◀
          </button>
          <h2 className="text-2xl font-bold text-blue-700">
            {format(panelDate, 'yyyy년 MM월', { locale: ko })} 휴가 제한 설정
          </h2>
          <button
            onClick={() => setPanelDate(prev => addMonths(prev, 1))}
            className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
            disabled={isSaving || isSubmitting}
          >
            ▶
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-red-600 transition-colors"
          disabled={isSaving || isSubmitting}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-red-300">{error}</div>}
      {message && message.type === 'success' && 
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md border border-green-300">{message.text}</div>
      }
      
      {/* 로딩 인디케이터 */}
      {(isSaving || isSubmitting) && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-600 rounded-md border border-blue-200 flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          저장 중... 기다려주세요.
        </div>
      )}
      
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-gray-100 p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1
              ${activeFilter === 'all' 
                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300' 
                : 'text-black hover:bg-gray-200'}`}
          >
            전체
          </button>
          <button
            onClick={() => setActiveFilter('caregiver')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1
              ${activeFilter === 'caregiver' 
                ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-300' 
                : 'text-black hover:bg-gray-200'}`}
          >
            요양보호사
          </button>
          <button
            onClick={() => setActiveFilter('office')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1
              ${activeFilter === 'office' 
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' 
                : 'text-black hover:bg-gray-200'}`}
          >
            사무실
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto max-h-[60vh] mb-6">
        {activeFilter === 'all' ? (
          <div className="text-center text-gray-500 py-8">카테고리를 선택하면 해당 카테고리별 휴가 제한을 설정할 수 있습니다.<br/>각 날짜별로 요양보호사/사무실 인원을 따로 입력할 수 있습니다.</div>
        ) : (
        <table className="w-full border-collapse border border-gray-300 shadow-sm">
          <thead className="bg-blue-600 text-white sticky top-0">
            <tr>
              <th className="p-3 border border-blue-700 text-left">날짜</th>
              <th className="p-3 border border-blue-700 text-left">{activeFilter === 'caregiver' ? '요양보호사 최대 인원' : '사무실 최대 인원'}</th>
            </tr>
          </thead>
          <tbody>
            {limits.filter(l => l.role === activeFilter).map((limit, index) => (
              <tr key={limit.date + limit.role} className={index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-blue-50 hover:bg-blue-100'}>
                <td className="p-3 border border-gray-300">
                  <span className="text-black font-medium">{format(new Date(limit.date), 'yyyy-MM-dd (EEE)', { locale: ko })}</span>
                </td>
                <td className="p-3 border border-gray-300">
                  <input
                    type="number"
                    min="0"
                    value={limit.maxPeople}
                    placeholder={activeFilter === 'caregiver' ? '요양보호사 인원' : '사무실 인원'}
                    onChange={(e) => handleUpdateLimit(limit.date, limit.role, parseInt(e.target.value) || 0)}
                    className="w-full p-2 border rounded text-black font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    disabled={isSaving || isSubmitting}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      
      <div className="mt-6 flex justify-end space-x-4">
        <button 
          onClick={onClose}
          className="px-5 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving || isSubmitting}
        >
          취소
        </button>
        <button 
          onClick={saveChanges}
          className="px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 transition-colors disabled:cursor-not-allowed flex items-center"
          disabled={isSaving || isSubmitting}
        >
          {(isSaving || isSubmitting) ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              저장 중...
            </>
          ) : '저장'}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel; 