'use client';
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationDetailsProps, VacationRequest } from '@/types/vacation';
import VacationForm from './VacationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCalendar, FiUsers, FiClock, FiCheck, FiAlertCircle, FiSend } from 'react-icons/fi';

const VacationDetails: React.FC<VacationDetailsProps> = ({
  date,
  vacations = [],
  onClose,
  onApplyVacation,
  isLoading = false,
  maxPeople = 5,
  onVacationUpdated,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [sortedVacations, setSortedVacations] = useState<VacationRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 휴무 요청을 상태별로 정렬 (승인됨 -> 대기중 -> 거부됨)
    const sorted = [...vacations].sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (a.status !== 'approved' && b.status === 'approved') return 1;
      if (a.status === 'pending' && b.status === 'rejected') return -1;
      if (a.status === 'rejected' && b.status === 'pending') return 1;
      return 0;
    });
    setSortedVacations(sorted);
  }, [vacations]);

  const handleApplyClick = () => {
    setShowForm(true);
    // VacationCalendar에서 휴무 신청 버튼을 클릭했을 때 호출되는 콜백은 여기서는 호출하지 않음
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    if (onVacationUpdated) {
      await onVacationUpdated();
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
  };

  // 유효한(승인됨 또는 대기중) 휴무 수 계산
  const validVacationCount = vacations.filter(v => v.status !== 'rejected').length;
  const remainingSlots = maxPeople - validVacationCount;
  const isFull = remainingSlots <= 0;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md"
      >
        {isLoading ? (
          <div className="p-4 sm:p-8 flex flex-col items-center justify-center h-48 sm:h-64">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3 sm:mb-4"></div>
            <p className="text-gray-600 font-medium text-sm sm:text-base">로딩 중...</p>
          </div>
        ) : showForm ? (
          <VacationForm
            initialDate={date}
            onSubmitSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />
        ) : (
          <>
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-1 sm:p-1.5 rounded-md mr-1.5 sm:mr-2">
                    <FiCalendar size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </span>
                  휴무 상세 정보
                </h2>
                <button 
                  onClick={onClose}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="닫기"
                >
                  <FiX size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
              
              <div className="mt-3 sm:mt-4 flex items-center justify-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                <h3 className="text-blue-800 font-medium text-sm sm:text-base">
                  {date && format(date, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                </h3>
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center text-gray-700">
                  <FiUsers className="mr-1.5 sm:mr-2" size={16} />
                  <span className="font-medium text-sm sm:text-base">휴무 신청 현황</span>
                </div>
                <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center ${
                  isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {isFull ? (
                    <FiAlertCircle className="mr-0.5 sm:mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ) : (
                    <FiCheck className="mr-0.5 sm:mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                  {validVacationCount}/{maxPeople}명
                </div>
              </div>
              
              {sortedVacations.length > 0 ? (
                <div className="max-h-48 sm:max-h-64 overflow-y-auto mb-3 sm:mb-4 pr-1 sm:pr-2">
                  <ul className="space-y-2 sm:space-y-3">
                    {sortedVacations.map((vacation) => (
                      <motion.li 
                        key={vacation.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex justify-between items-center mb-1 sm:mb-2">
                          <div className="font-medium text-gray-800 text-sm sm:text-base">{vacation.userName}</div>
                          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                            vacation.status === 'approved' 
                              ? 'bg-green-100 text-green-600' 
                              : vacation.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-600'
                          }`}>
                            {vacation.status === 'approved' ? '승인됨' : vacation.status === 'pending' ? '대기중' : '거부됨'}
                          </span>
                        </div>
                        <div className="flex items-center text-xs sm:text-sm text-gray-500">
                          <FiClock className="mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>{vacation.type === 'regular' ? '일반 휴무' : vacation.type === 'mandatory' ? '필수 휴무' : vacation.type}</span>
                        </div>
                        {vacation.reason && (
                          <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600 bg-white p-1.5 sm:p-2 rounded border border-gray-100">
                            {vacation.reason}
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 mb-3 sm:mb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <FiUsers className="text-gray-400 w-4.5 h-4.5 sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-gray-500 mb-1 text-sm sm:text-base">이 날짜에는 휴무 신청자가 없습니다</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">첫 번째로 휴무를 신청해보세요!</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={handleApplyClick}
                  className="flex items-center px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg shadow-sm transition-colors bg-blue-600 text-white hover:bg-blue-700"
                >
                  <FiSend className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  휴무 신청하기
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
};

export default VacationDetails; 