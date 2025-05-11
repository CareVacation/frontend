'use client';
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationDetailsProps, VacationRequest } from '@/types/vacation';
import VacationForm from './VacationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCalendar, FiUsers, FiClock, FiCheck, FiAlertCircle, FiSend, FiUser, FiBriefcase, FiUserPlus, FiTrash2, FiLock } from 'react-icons/fi';

const VacationDetails: React.FC<VacationDetailsProps> = ({
  date,
  vacations = [],
  onClose,
  onApplyVacation,
  isLoading = false,
  maxPeople = 5,
  onVacationUpdated,
  roleFilter,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [sortedVacations, setSortedVacations] = useState<VacationRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState<VacationRequest | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (vacation: VacationRequest) => {
    setSelectedVacation(vacation);
    setShowDeleteModal(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteModalClose = () => {
    setShowDeleteModal(false);
    setSelectedVacation(null);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteVacation = async () => {
    if (!selectedVacation) return;

    if (!deletePassword.trim()) {
      setDeleteError('비밀번호를 입력해주세요');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/vacation/delete/${selectedVacation.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '삭제 중 오류가 발생했습니다');
      }

      // 성공적으로 삭제됨
      setShowDeleteModal(false);
      setSelectedVacation(null);
      setDeletePassword('');
      
      // 데이터 새로고침
      if (onVacationUpdated) {
        await onVacationUpdated();
      }
    } catch (error) {
      console.error('휴가 삭제 중 오류:', error);
      if (error instanceof Error) {
        if (error.message.includes('비밀번호가 일치하지 않습니다')) {
          setDeleteError('비밀번호가 일치하지 않습니다');
        } else {
          setDeleteError(error.message || '삭제 중 오류가 발생했습니다');
        }
      } else {
        setDeleteError('삭제 중 오류가 발생했습니다');
      }
    } finally {
      setIsDeleting(false);
    }
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
            roleFilter={roleFilter}
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
                        className="p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-100 relative"
                      >
                        <div className="flex justify-between items-center mb-1 sm:mb-2">
                          <div className="font-medium text-gray-800 text-sm sm:text-base">{vacation.userName}</div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                              vacation.status === 'approved' 
                                ? 'bg-green-100 text-green-600' 
                                : vacation.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-600'
                                  : 'bg-red-100 text-red-600'
                            }`}>
                              {vacation.status === 'approved' ? '승인됨' : vacation.status === 'pending' ? '대기중' : '거부됨'}
                            </span>
                            <button 
                              onClick={() => handleDeleteClick(vacation)} 
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              aria-label="휴가 삭제"
                            >
                              <FiTrash2 size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {/* 휴무 유형 뱃지 */}
                          <div className="inline-flex items-center text-xs sm:text-sm px-2 py-0.5 rounded-md border bg-gray-50">
                            <FiClock className="mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
                            <span className="text-gray-700">{vacation.type === 'regular' ? '일반 휴무' : vacation.type === 'mandatory' ? '필수 휴무' : vacation.type}</span>
                          </div>
                          
                          {/* 직원 유형 뱃지 */}
                          <div className={`inline-flex items-center text-xs sm:text-sm px-2 py-0.5 rounded-md border ${
                            vacation.role === 'caregiver' 
                              ? 'bg-blue-50 text-blue-700 border-blue-100' 
                              : vacation.role === 'office' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                            {vacation.role === 'caregiver' && (
                              <FiUser className="mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            )}
                            {vacation.role === 'office' && (
                              <FiBriefcase className="mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            )}
                            {(!vacation.role || vacation.role === 'all') && (
                              <FiUsers className="mr-1 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            )}
                            <span>
                              {vacation.role === 'caregiver' 
                                ? '요양보호사' 
                                : vacation.role === 'office' 
                                  ? '사무실' 
                                  : '전체'}
                            </span>
                          </div>
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

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteModal && selectedVacation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-sm w-full"
            >
              <div className="text-center mb-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-3">
                  <FiTrash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">휴무 삭제 확인</h3>
                <p className="text-sm text-gray-500">
                  <strong>{selectedVacation.userName}</strong>님의 <strong>{format(new Date(selectedVacation.date), 'yyyy년 MM월 dd일')}</strong> 휴무를 삭제하시겠습니까?
                </p>
              </div>
              
              <div className="mb-4">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center">
                    <FiLock className="mr-1.5" size={14} />
                    <span>비밀번호 확인</span>
                  </div>
                </label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="등록 시 입력한 비밀번호를 입력하세요"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm ${
                    deleteError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {deleteError && (
                  <p className="mt-1 text-xs text-red-500">{deleteError}</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleDeleteModalClose}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDeleteVacation}
                  className={`px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm ${
                    isDeleting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-3 w-3 mr-1.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      삭제 중...
                    </span>
                  ) : (
                    '삭제하기'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VacationDetails; 