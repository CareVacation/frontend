import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { VacationFormProps } from '@/types/vacation';
import { FiUser, FiBriefcase, FiUsers, FiCalendar, FiClock, FiLock } from 'react-icons/fi';

const VacationForm: React.FC<VacationFormProps> = ({ 
  initialDate, 
  onSubmitSuccess,
  onCancel,
  isSubmitting,
  setIsSubmitting,
  roleFilter
}) => {
  const [userName, setUserName] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState<'regular' | 'mandatory'>('regular');
  const [role, setRole] = useState<'caregiver' | 'office' | 'all'>(roleFilter && roleFilter !== 'all' ? roleFilter : 'caregiver');
  const [errors, setErrors] = useState({
    userName: '',
    reason: '',
    password: ''
  });

  useEffect(() => {
    if (roleFilter && roleFilter !== 'all') {
      setRole(roleFilter);
    }
  }, [roleFilter]);

  const validate = (): boolean => {
    const newErrors = {
      userName: '',
      reason: '',
      password: ''
    };
    let isValid = true;

    if (!userName.trim()) {
      newErrors.userName = '이름을 입력해주세요';
      isValid = false;
    }

    if (type === 'mandatory' && !reason.trim()) {
      newErrors.reason = '휴무 사유를 입력해주세요';
      isValid = false;
    }
    
    if (!password.trim()) {
      newErrors.password = '비밀번호를 입력해주세요';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      try {
        setIsSubmitting(true);
        
        // 현재 호스트 기반 절대 URL 사용
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/api/vacation/request`;
        
        // fetch API를 사용하여 휴무 신청
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userName: userName.trim(),
            reason: reason.trim(),
            password: password.trim(),
            type,
            role,
            date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API 응답 오류: ${response.status}`);
        }
        
        // 성공 콜백 호출
        onSubmitSuccess();
      } catch (error) {
        console.error('휴무 신청 오류:', error);
        
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message);
          console.error('에러 스택:', error.stack);
        }
        
        alert('휴무 신청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
      {/* 헤더 */}
      <div className="border-b pb-3 sm:pb-4 mb-4 sm:mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
          휴무 신청
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          {initialDate && (
            <span className="text-indigo-600 font-medium">
              {format(initialDate, 'yyyy년 MM월 dd일', { locale: ko })}
            </span>
          )} 휴무를 신청합니다
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div>
          <label htmlFor="userName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            이름 *
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base text-gray-800 font-medium ${
              errors.userName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="이름을 입력하세요"
            autoFocus
            disabled={isSubmitting}
          />
          {errors.userName && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.userName}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            비밀번호 * <span className="text-xs text-gray-500">(휴가 삭제시 필요)</span>
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base text-gray-800 font-medium ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="비밀번호를 입력하세요"
            disabled={isSubmitting}
          />
          {errors.password && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.password}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            휴무 사유{type === 'mandatory' && <span className="text-red-500 ml-0.5">*</span>}
            {type === 'regular' && <span className="text-gray-400 ml-1 text-xs">(선택 사항)</span>}
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base text-gray-800 font-medium ${
              errors.reason ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder={type === 'mandatory' ? '휴무 사유를 입력하세요' : '휴무 사유를 입력하세요 (선택 사항)'}
            disabled={isSubmitting}
          />
          {errors.reason && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.reason}</p>
          )}
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
            휴무 유형 *
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <label className={`flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${type === 'regular' ? 'bg-indigo-50 border-indigo-200' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="regular"
                checked={type === 'regular'}
                onChange={() => setType('regular')}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full mr-2 sm:mr-3 flex items-center justify-center ${type === 'regular' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <FiCalendar size={16} />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">일반 휴무</span>
            </label>
            <label className={`flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${type === 'mandatory' ? 'bg-green-50 border-green-200' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="mandatory"
                checked={type === 'mandatory'}
                onChange={() => setType('mandatory')}
                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full mr-2 sm:mr-3 flex items-center justify-center ${type === 'mandatory' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <FiClock size={16} />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">필수 휴무</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
            직원 유형 *
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <label className={`flex flex-col items-center p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${role === 'caregiver' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="roleType"
                value="caregiver"
                checked={role === 'caregiver'}
                onChange={() => setRole('caregiver')}
                className="hidden"
                disabled={isSubmitting || (roleFilter && roleFilter !== 'all' && roleFilter !== 'caregiver')}
              />
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 sm:mb-2 ${role === 'caregiver' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                <FiUser size={20} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm text-center">요양보호사</span>
            </label>
            
            <label className={`flex flex-col items-center p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${role === 'office' ? 'bg-green-50 border-green-200 ring-1 ring-green-300' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="roleType"
                value="office"
                checked={role === 'office'}
                onChange={() => setRole('office')}
                className="hidden"
                disabled={isSubmitting || (roleFilter && roleFilter !== 'all' && roleFilter !== 'office')}
              />
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 sm:mb-2 ${role === 'office' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                <FiBriefcase size={20} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm text-center">사무실</span>
            </label>
            
            <label className={`flex flex-col items-center p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${role === 'all' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="roleType"
                value="all"
                checked={role === 'all'}
                onChange={() => setRole('all')}
                className="hidden"
                disabled={isSubmitting || (roleFilter && roleFilter !== 'all')}
              />
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 sm:mb-2 ${role === 'all' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                <FiUsers size={20} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm text-center">전체</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 sm:space-x-3 pt-4 sm:pt-5 border-t mt-4 sm:mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-md hover:from-indigo-700 hover:to-blue-700 transition-colors shadow-md ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                처리 중...
              </span>
            ) : (
              '신청하기'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VacationForm; 