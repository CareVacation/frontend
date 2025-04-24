export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  date: string; // yyyy-MM-dd 형식
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  type: 'regular' | 'mandatory' | 'sick' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface VacationLimit {
  id?: string;
  date: string; // yyyy-MM-dd 형식
  maxPeople: number;
  createdAt?: string;
}

export interface DayInfo {
  date: string;
  count: number;
  people: VacationRequest[];
  vacations?: VacationRequest[]; // 캘린더 셀에 표시할 휴가 정보
  limit?: VacationLimit | number;
  status?: 'available' | 'full' | 'over';
}

export interface CalendarProps {
  onDateSelect?: (date: Date | null) => void;
  onRequestSelect?: (date: Date) => Promise<void>;
  isAdmin?: boolean;
  maxPeopleAllowed?: number;
}

export interface VacationDetailsProps {
  date: Date | null;
  vacations: VacationRequest[];
  isLoading: boolean;
  onApplyVacation: () => void;
  onClose: () => void;
  onVacationUpdated: () => Promise<void>;
  maxPeople?: number;
}

export interface VacationFormProps {
  initialDate: Date | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
}

// 휴가 데이터 인터페이스
export interface VacationData {
  [date: string]: {
    date: string;
    totalVacationers: number;
    vacations: VacationRequest[];
    people?: VacationRequest[]; // API 응답 구조와의 호환성
    maxPeople?: number; // 각 날짜별 최대 인원 제한
  };
} 