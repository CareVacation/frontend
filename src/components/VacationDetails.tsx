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
    // 휴가 요청을 상태별로 정렬 (승인됨 -> 대기중)
    const sorted = [...vacations].sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (a.status !== 'approved' && b.status === 'approved') return 1;
      return 0;
    });
    setSortedVacations(sorted);
  }, [vacations]);

  const handleApplyClick = () => {
    setShowForm(true);
    // VacationCalendar에서 휴가 신청 버튼을 클릭했을 때 호출되는 콜백은 여기서는 호출하지 않음
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

  const remainingSlots = maxPeople - vacations.length;
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
          <div className="p-8 flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">로딩 중...</p>
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
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-1.5 rounded-md mr-2">
                    <FiCalendar size={18} />
                  </span>
                  휴가 상세 정보
                </h2>
                <button 
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="닫기"
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="mt-4 flex items-center justify-center p-3 bg-blue-50 rounded-lg">
                <h3 className="text-blue-800 font-medium">
                  {date && format(date, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                </h3>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-gray-700">
                  <FiUsers className="mr-2" size={18} />
                  <span className="font-medium">휴가 신청 현황</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                  isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {isFull ? (
                    <FiAlertCircle className="mr-1" size={14} />
                  ) : (
                    <FiCheck className="mr-1" size={14} />
                  )}
                  {vacations.length}/{maxPeople}명
                </div>
              </div>
              
              {sortedVacations.length > 0 ? (
                <div className="max-h-64 overflow-y-auto mb-4 pr-2">
                  <ul className="space-y-3">
                    {sortedVacations.map((vacation) => (
                      <motion.li 
                        key={vacation.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-medium text-gray-800">{vacation.userName}</div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            vacation.status === 'approved' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            {vacation.status === 'approved' ? '승인됨' : '대기중'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <FiClock size={14} className="mr-1" />
                          <span>{vacation.type}</span>
                        </div>
                        {vacation.reason && (
                          <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded border border-gray-100">
                            {vacation.reason}
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8 mb-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiUsers className="text-gray-400" size={24} />
                  </div>
                  <p className="text-gray-500 mb-1">이 날짜에는 휴가 신청자가 없습니다</p>
                  <p className="text-xs text-gray-400">첫 번째로 휴가를 신청해보세요!</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={handleApplyClick}
                  disabled={isFull}
                  className={`flex items-center px-4 py-2 rounded-lg shadow-sm transition-colors ${
                    isFull 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <FiSend className="mr-2" size={16} />
                  휴가 신청하기
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