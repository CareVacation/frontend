import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, deleteDoc, getDoc, setDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { VacationRequest, VacationLimit } from '@/types/vacation';
import { format, parse, isValid, parseISO } from 'date-fns';

const VACATIONS_COLLECTION = 'vacations';
const VACATION_LIMITS_COLLECTION = 'vacation_limits';

// 특정 월의 휴가 신청 데이터 가져오기
export async function getVacationsForMonth(year: number, month: number) {
  // 월의 시작일과 마지막 일을 계산
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // 다음 달의 0일 = 이번 달의 마지막 날

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  try {
    // 캐시 방지를 위해 타임스탬프 추가
    const timestamp = Date.now();
    console.log(`getVacationsForMonth 호출: ${year}년 ${month+1}월 (${timestamp})`);
    
    const vacationsRef = collection(db, VACATIONS_COLLECTION);
    const q = query(
      vacationsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const querySnapshot = await getDocs(q);
    const vacations: VacationRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // 기존 데이터에 reason과 type이 없는 경우 기본값 설정
      vacations.push({
        id: doc.id,
        ...data,
        reason: data.reason || '(사유 미입력)',
        type: data.type || 'regular'
      } as VacationRequest);
    });
    
    console.log(`${year}년 ${month+1}월 휴가 데이터 ${vacations.length}건 로드 완료`);
    return vacations;
  } catch (error) {
    console.error('월별 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜의 휴가 신청 데이터 가져오기
export async function getVacationsForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  try {
    const vacationsRef = collection(db, VACATIONS_COLLECTION);
    const q = query(
      vacationsRef,
      where('date', '==', dateStr)
    );

    const querySnapshot = await getDocs(q);
    const vacations: VacationRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // 기존 데이터에 reason과 type이 없는 경우 기본값 설정
      vacations.push({
        id: doc.id,
        ...data,
        reason: data.reason || '(사유 미입력)',
        type: data.type || 'regular'
      } as VacationRequest);
    });
    
    return vacations;
  } catch (error) {
    console.error('일자별 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 휴가 신청하기
export async function createVacationRequest(vacationData: Omit<VacationRequest, 'id' | 'createdAt'>) {
  try {
    const vacationRequest = {
      ...vacationData,
      createdAt: Date.now()
    };
    
    const docRef = await addDoc(collection(db, VACATIONS_COLLECTION), vacationRequest);
    return {
      id: docRef.id,
      ...vacationRequest
    };
  } catch (error) {
    console.error('휴가 신청 중 오류:', error);
    throw error;
  }
}

// 휴가 신청 취소하기
export async function cancelVacationRequest(vacationId: string) {
  try {
    const vacationRef = doc(db, VACATIONS_COLLECTION, vacationId);
    await deleteDoc(vacationRef);
    return true;
  } catch (error) {
    console.error('휴가 취소 중 오류:', error);
    throw error;
  }
}

// 특정 월의 휴가 제한 데이터 가져오기
export async function getVacationLimitsForMonth(year: number, month: number) {
  // 월의 시작일과 마지막 일을 계산
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // 다음 달의 0일 = 이번 달의 마지막 날

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  try {
    console.log(`[VacationService] 휴가 제한 데이터 조회: ${year}년 ${month+1}월 (${startDateStr} ~ ${endDateStr})`);
    
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const queryStartTime = Date.now();
    
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const querySnapshot = await getDocs(q);
    console.log(`[VacationService] 휴가 제한 데이터 조회 완료: ${querySnapshot.size}건 (소요시간: ${Date.now() - queryStartTime}ms)`);
    
    // 모든 문서를 배열로 반환 (role별 분리)
    const limits: VacationLimit[] = [];
    querySnapshot.forEach((document) => {
      const data = document.data();
      const dateStr = data.date;
      if (!dateStr) {
        console.warn(`[VacationService] 날짜 필드가 없는 문서 발견: ID=${document.id}`);
        return;
      }
      limits.push({
        id: document.id,
        date: dateStr,
        maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : (data.maxPeople !== undefined ? parseInt(data.maxPeople, 10) : 3),
        createdAt: data.createdAt,
        role: data.role ?? 'caregiver'
      });
    });
    return limits;
  } catch (error) {
    console.error('월별 휴가 제한 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜+role의 휴가 제한 가져오기
export async function getVacationLimitForDate(date: Date, role: 'caregiver' | 'office'): Promise<VacationLimit | null> {
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    console.log(`[VacationService] 날짜+role로 휴가 제한 조회: ${formattedDate}_${role}`);
    // 날짜+role 조합으로 문서 조회
    const docId = `${formattedDate}_${role}`;
    const docRef = doc(db, VACATION_LIMITS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        date: data.date || formattedDate,
        maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : (data.maxPeople !== undefined ? parseInt(data.maxPeople, 10) : 3),
        role: data.role ?? role
      };
    }
    // 결과가 없는 경우 기본값 반환
    console.log(`[VacationService] 날짜+role ${docId}에 대한 휴가 제한을 찾을 수 없음, 기본값(3) 반환`);
    return {
      id: docId,
      date: formattedDate,
      maxPeople: 3,
      role
    };
  } catch (error) {
    console.error(`[VacationService] 휴가 제한 조회 오류 (날짜: ${format(date, 'yyyy-MM-dd')}):`, error);
    // 에러가 발생해도 기본값 반환
    return {
      id: `${format(date, 'yyyy-MM-dd')}_${role}`,
      date: format(date, 'yyyy-MM-dd'),
      maxPeople: 3,
      role
    };
  }
}

/**
 * 휴가 제한을 설정하는 함수
 * @param date 날짜 (문자열 'YYYY-MM-DD' 또는 Date 객체)
 * @param maxPeople 최대 인원
 * @param role 역할 ('caregiver' | 'office')
 * @returns 설정된 휴가 제한 정보
 */
export async function setVacationLimit(
  date: string | Date,
  maxPeople: number,
  role: 'caregiver' | 'office'
): Promise<VacationLimit> {
  try {
    let dateObj: Date;
    let dateStr: string;

    if (date instanceof Date) {
      dateObj = date;
      dateStr = format(date, 'yyyy-MM-dd');
    } else {
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        console.error(`[VacationService] 유효하지 않은 날짜 형식: ${date}`);
        throw new Error('유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식이 필요합니다.');
      }
      dateObj = parseISO(date);
      dateStr = date;
      if (!isValid(dateObj)) {
        console.error(`[VacationService] 유효하지 않은 날짜: ${date}`);
        throw new Error('유효하지 않은 날짜입니다.');
      }
    }

    // 날짜+role 조합을 문서 ID로 사용
    const docId = `${dateStr}_${role}`;
    console.log(`[VacationService] 휴가 제한 설정: ${docId} (최대 ${maxPeople}명, role=${role})`);

    const docRef = doc(db, VACATION_LIMITS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    const now = serverTimestamp();

    if (docSnap.exists()) {
      const currentData = docSnap.data();
      console.log(`[VacationService] 기존 제한 발견: ${docId}, 현재=${currentData.maxPeople}, 새값=${maxPeople}`);
      await updateDoc(docRef, {
        maxPeople: Number(maxPeople),
        updatedAt: now,
        role
      });
      console.log(`[VacationService] 문서 업데이트 완료: ${docId}`);
    } else {
      console.log(`[VacationService] 새 문서 생성: ${docId}, 값=${maxPeople}, role=${role}`);
      await setDoc(docRef, {
        date: dateStr,
        maxPeople: Number(maxPeople),
        role,
        createdAt: now,
        updatedAt: now
      });
      console.log(`[VacationService] 새 문서 생성 완료: ${docId}`);
    }

    setTimeout(async () => {
      try {
        const verifySnap = await getDoc(docRef);
        if (verifySnap.exists()) {
          const verifyData = verifySnap.data();
          console.log(`[VacationService] 저장 확인: ID=${docId}, 값=${verifyData.maxPeople}, role=${verifyData.role}`);
        } else {
          console.error(`[VacationService] 문서 저장 확인 실패: ${docId}`);
        }
      } catch (err) {
        console.error(`[VacationService] 저장 확인 중 오류:`, err);
      }
    }, 500);

    return {
      id: docId,
      date: dateStr,
      maxPeople: Number(maxPeople),
      role
    };
  } catch (error) {
    console.error(`[VacationService] 휴가 제한 설정 오류 (날짜: ${date instanceof Date ? format(date, 'yyyy-MM-dd') : date}):`, error);
    throw error;
  }
}

// 특정 기간의 모든 휴가 제한 데이터 가져오기
export async function getVacationLimits(startDate: Date, endDate: Date): Promise<VacationLimit[]> {
  try {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    console.log(`[VacationService] 휴가 제한 조회: ${startDateStr} ~ ${endDateStr}`);
    
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const querySnapshot = await getDocs(q);
    const limits: VacationLimit[] = [];
    
    console.log(`[VacationService] 휴가 제한 조회 결과: ${querySnapshot.size}건 발견`);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      limits.push({
        id: doc.id,
        date: data.date,
        maxPeople: data.maxPeople,
        role: data.role ?? 'caregiver'
      } as VacationLimit);
    });
    
    return limits;
  } catch (error) {
    console.error(`[VacationService] 휴가 제한 범위 조회 오류 (${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}):`, error);
    throw error;
  }
}

// 날짜 범위에 대한 휴가 신청 데이터 가져오기
export async function getVacationRequestsForDateRange(startDateStr: string, endDateStr: string): Promise<VacationRequest[]> {
  try {
    console.log(`[VacationService] 휴가 신청 조회: ${startDateStr} ~ ${endDateStr}`);
    const queryStartTime = Date.now();
    
    const vacationsRef = collection(db, VACATIONS_COLLECTION);
    const q = query(
      vacationsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    // 캐시 문제를 방지하기 위해 항상 최신 데이터 가져오기 옵션 사용
    const querySnapshot = await getDocs(q);
    const vacations: VacationRequest[] = [];
    
    console.log(`[VacationService] 휴가 신청 조회 완료: ${querySnapshot.size}건 (소요시간: ${Date.now() - queryStartTime}ms)`);
    
    // 응답 데이터의 날짜 범위 검증
    const dateSet = new Set<string>();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // 날짜 검증
      if (!data.date) {
        console.warn(`[VacationService] 날짜 필드가 없는 휴가 발견: ID=${doc.id}`);
        return; // 날짜 필드가 없는 문서 제외
      }
      
      dateSet.add(data.date.substring(0, 7)); // YYYY-MM 추출
      
      // 기존 데이터에 필수 필드가 없는 경우 기본값 설정
      vacations.push({
        id: doc.id,
        ...data,
        reason: data.reason || '(사유 미입력)',
        type: data.type || 'regular',
        role: data.role || 'all', // 역할 필드가 없는 기존 데이터에는 'all' 기본값 지정
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString()
      } as VacationRequest);
    });
    
    // 날짜 범위 검증 로그
    const startMonth = startDateStr.substring(0, 7);
    const endMonth = endDateStr.substring(0, 7);
    const months = Array.from(dateSet);
    
    console.log(`[VacationService] 휴가 데이터 월: [${months.join(', ')}], 요청 월: ${startMonth}~${endMonth}`);
    
    if (months.length > 0 && !months.some(m => m === startMonth)) {
      console.warn(`[VacationService] 휴가 데이터 월 불일치 감지! 요청: ${startMonth}, 데이터: ${months[0]}`);
    }
    
    return vacations;
  } catch (error) {
    console.error('날짜 범위별 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 날짜 범위에 대한 휴가 제한 가져오기
export async function getVacationLimitsForMonthRange(startDateStr: string, endDateStr: string): Promise<VacationLimit[]> {
  console.log(`[VacationService] 날짜 범위 ${startDateStr} ~ ${endDateStr}의 휴가 제한 조회 시작`);
  try {
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const queryStartTime = Date.now();
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[VacationService] 휴가 제한 데이터 조회 완료: ${querySnapshot.size}건 (소요시간: ${Date.now() - queryStartTime}ms)`);
    const limits: VacationLimit[] = [];
    querySnapshot.forEach((document) => {
      const data = document.data();
      const dateStr = data.date;
      if (!dateStr) {
        console.warn(`[VacationService] 날짜 필드가 없는 문서 발견: ID=${document.id}`);
        return;
      }
      limits.push({
        id: document.id,
        date: dateStr,
        maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : (data.maxPeople !== undefined ? parseInt(data.maxPeople, 10) : 3),
        createdAt: data.createdAt,
        role: data.role ?? 'caregiver'
      });
    });
    console.log(`[VacationService] 날짜 범위의 휴가 제한 ${limits.length}개 조회 완료`);
    return limits;
  } catch (error) {
    console.error('[VacationService] 날짜 범위 휴가 제한 조회 중 오류:', error);
    throw error;
  }
}

