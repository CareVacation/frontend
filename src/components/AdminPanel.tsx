'use client';
import { useState, useEffect } from 'react';
import { VacationLimit, DayInfo } from '@/types/vacation';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
  vacationLimits?: Record<string, VacationLimit>;
  onLimitSet?: (date: Date, maxPeople: number) => Promise<void>;
  vacationDays?: Record<string, DayInfo>;
}

const AdminPanel = ({ currentDate, onClose, onUpdateSuccess, vacationLimits, onLimitSet }: AdminPanelProps) => {
  const [limits, setLimits] = useState<VacationLimit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchMonthLimits();
  }, [currentDate]);

  const fetchMonthLimits = async () => {
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const response = await fetch(`/api/vacation/limits?start=${format(monthStart, 'yyyy-MM-dd')}&end=${format(monthEnd, 'yyyy-MM-dd')}`);
      
      if (!response.ok) {
        throw new Error('휴가 제한 정보를 가져오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      // 날짜별로 데이터 정리
      const existingLimits = data.limits || [];
      const allLimits: VacationLimit[] = [];
      
      let currentDay = monthStart;
      while (currentDay <= monthEnd) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const existingLimit = existingLimits.find((limit: VacationLimit) => limit.date === dateStr);
        
        allLimits.push({
          id: existingLimit?.id,
          date: dateStr,
          maxPeople: existingLimit?.maxPeople || 3,
          createdAt: existingLimit?.createdAt
        });
        
        currentDay = addDays(currentDay, 1);
      }
      
      setLimits(allLimits);
    } catch (err) {
      console.error('휴가 제한 조회 오류:', err);
      setError('휴가 제한 조회에 실패했습니다.');
    }
  };

  const handleUpdateLimit = (index: number, value: number) => {
    const newLimits = [...limits];
    newLimits[index] = { ...newLimits[index], maxPeople: value };
    setLimits(newLimits);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      setError('');
      
      console.log('[AdminPanel] 휴가 제한 저장 시작');
      
      // 현재 설정된 제한 정보 사용
      console.log('[AdminPanel] 저장할 제한 데이터:', limits);
      
      // API 호출 시 타임스탬프 추가하여 캐시 방지
      const timestamp = Date.now();
      const response = await fetch(`/api/vacation/limits?_t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          limits,
          timestamp // 요청 본문에도 타임스탬프 추가 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AdminPanel] 저장 실패:', errorData);
        throw new Error(errorData.error || '저장 중 오류가 발생했습니다');
      }
      
      const result = await response.json();
      console.log('[AdminPanel] 저장 성공:', result);
      
      // 변경 사항이 저장된 후 성공 콜백 호출
      if (onUpdateSuccess) {
        console.log('[AdminPanel] 성공 콜백 호출');
        // 첫 번째 즉시 호출 
        onUpdateSuccess();
        
        // 짧은 지연 후 두 번째 호출 (Firebase 갱신 지연 고려)
        setTimeout(() => {
          console.log('[AdminPanel] 지연 성공 콜백 호출');
          onUpdateSuccess();
        }, 1000);
      }
      
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl border-2 border-blue-500">
      <div className="flex justify-between items-center mb-6 border-b pb-4 border-blue-200">
        <h2 className="text-2xl font-bold text-blue-700">
          {format(currentDate, 'yyyy년 MM월', { locale: ko })} 휴가 제한 설정
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-red-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-red-300">{error}</div>}
      
      <div className="overflow-y-auto max-h-[60vh] mb-6">
        <table className="w-full border-collapse border border-gray-300 shadow-sm">
          <thead className="bg-blue-600 text-white sticky top-0">
            <tr>
              <th className="p-3 border border-blue-700 text-left">날짜</th>
              <th className="p-3 border border-blue-700 text-left">최대 인원</th>
            </tr>
          </thead>
          <tbody>
            {limits.map((limit, index) => (
              <tr key={limit.date} className={index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-blue-50 hover:bg-blue-100'}>
                <td className="p-3 border border-gray-300">
                  <span className="text-black font-medium">{format(new Date(limit.date), 'yyyy-MM-dd (EEE)', { locale: ko })}</span>
                </td>
                <td className="p-3 border border-gray-300">
                  <input
                    type="number"
                    min="0"
                    value={limit.maxPeople}
                    onChange={(e) => handleUpdateLimit(index, parseInt(e.target.value) || 0)}
                    className="w-full p-2 border rounded text-black font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 flex justify-end space-x-4">
        <button 
          onClick={onClose}
          className="px-5 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          disabled={isSubmitting}
        >
          취소
        </button>
        <button 
          onClick={saveChanges}
          className="px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel; 