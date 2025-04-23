import React, { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { VacationFormProps } from '@/types/vacation';
import axios from 'axios';

const VacationForm: React.FC<VacationFormProps> = ({ 
  initialDate, 
  onSubmitSuccess,
  onCancel,
  isSubmitting,
  setIsSubmitting
}) => {
  const [userName, setUserName] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'regular' | 'mandatory'>('regular');
  const [errors, setErrors] = useState({
    userName: '',
    reason: ''
  });

  const validate = (): boolean => {
    const newErrors = {
      userName: '',
      reason: ''
    };
    let isValid = true;

    if (!userName.trim()) {
      newErrors.userName = '이름을 입력해주세요';
      isValid = false;
    }

    if (!reason.trim()) {
      newErrors.reason = '휴가 사유를 입력해주세요';
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
        
        // 휴가 신청 API 호출
        await axios.post('/api/vacation/request', {
          userName: userName.trim(),
          reason: reason.trim(),
          type,
          date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
        });
        
        // 성공 콜백 호출
        onSubmitSuccess();
      } catch (error) {
        console.error('휴가 신청 오류:', error);
        alert('휴가 신청 중 오류가 발생했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
      {/* 헤더 */}
      <div className="border-b pb-4 mb-5">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          휴가 신청
        </h2>
        <p className="text-gray-600">
          {initialDate && (
            <span className="text-indigo-600 font-medium">
              {format(initialDate, 'yyyy년 MM월 dd일', { locale: ko })}
            </span>
          )} 휴가를 신청합니다
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1">
            이름 *
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.userName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="이름을 입력하세요"
            autoFocus
            disabled={isSubmitting}
          />
          {errors.userName && (
            <p className="mt-1 text-sm text-red-500">{errors.userName}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
            휴가 사유 *
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              errors.reason ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="휴가 사유를 입력하세요"
            disabled={isSubmitting}
          />
          {errors.reason && (
            <p className="mt-1 text-sm text-red-500">{errors.reason}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            휴가 유형 *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={`flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="regular"
                checked={type === 'regular'}
                onChange={() => setType('regular')}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center border ${type === 'regular' ? 'border-0 bg-indigo-600' : 'border-gray-400'}`}>
                {type === 'regular' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <span className="text-gray-700 font-medium">일반 휴가</span>
            </label>
            <label className={`flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="mandatory"
                checked={type === 'mandatory'}
                onChange={() => setType('mandatory')}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 rounded-full mr-3 flex items-center justify-center border ${type === 'mandatory' ? 'border-0 bg-green-600' : 'border-gray-400'}`}>
                {type === 'mandatory' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <span className="text-gray-700 font-medium">필수 휴가</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-5 border-t mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className={`px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-md hover:from-indigo-700 hover:to-blue-700 transition-colors shadow-md ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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