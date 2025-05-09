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
    // 캐시 방지를 위해 Firebase 쿼리 실행 시간 기록
    const queryStartTime = Date.now();
    
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    // 명시적으로 서버에서 최신 데이터 가져오기
    const querySnapshot = await getDocs(q);
    
    // 날짜를 키로 하는 맵 생성 (동일한 날짜에 여러 문서가 있을 경우 날짜 ID 문서 우선)
    const dateMap = new Map<string, VacationLimit>();
    
    console.log(`[VacationService] 휴가 제한 데이터 조회 완료: ${querySnapshot.size}건 (소요시간: ${Date.now() - queryStartTime}ms)`);
    
    // 첫 번째 패스: 모든 문서 처리 (날짜 ID가 아닌 것도 포함)
    querySnapshot.forEach((document) => {
      const data = document.data();
      const dateStr = data.date;
      
      if (!dateStr) {
        console.warn(`[VacationService] 날짜 필드가 없는 문서 발견: ID=${document.id}`);
        return; // 날짜가 없는 문서는 건너뜀
      }
      
      // 기본값: 모든 문서를 맵에 추가
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          id: document.id,
          date: dateStr,
          maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3,
          createdAt: data.createdAt
        });
      }
    });
    
    // 두 번째 패스: 날짜 ID를 가진 문서로 맵 업데이트 (우선순위 부여)
    querySnapshot.forEach((document) => {
      const data = document.data();
      const docId = document.id;
      const dateStr = data.date;
      
      // docId가 날짜 형식(YYYY-MM-DD)인 경우 무조건 이 값을 사용
      if (docId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`[VacationService] 날짜 ID 문서 발견: ${docId} (${data.maxPeople}명)`);
        
        dateMap.set(dateStr, {
          id: docId,
          date: dateStr,
          maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3,
          createdAt: data.createdAt
        });
      }
    });
    
    // 결과 변환
    const limits = Array.from(dateMap.values());
    
    // 특정 날짜에 대한 로그 출력 (디버깅용)
    limits.forEach(limit => {
      console.log(`[VacationService] 최종 제한: 날짜=${limit.date}, ID=${limit.id}, 인원=${limit.maxPeople}`);
    });
    
    return limits;
  } catch (error) {
    console.error('월별 휴가 제한 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜의 휴가 제한 가져오기
export async function getVacationLimitForDate(date: Date): Promise<VacationLimit | null> {
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    console.log(`[VacationService] 날짜 ${formattedDate}에 대한 휴가 제한 조회 시작`);
    
    // 1. 먼저 날짜 형식 ID를 직접 사용하여 문서 조회
    console.log(`[VacationService] 날짜 ID로 직접 조회 시도: ${formattedDate}`);
    const directDocRef = doc(db, VACATION_LIMITS_COLLECTION, formattedDate);
    const directDoc = await getDoc(directDocRef);
    
    // 날짜 ID 문서가 존재하면 이를 우선적으로 사용
    if (directDoc.exists()) {
      const data = directDoc.data();
      console.log(`[VacationService] 날짜 ID 문서 발견! ID=${directDoc.id}, 인원=${data.maxPeople}`);
      
      return {
        id: directDoc.id,
        date: data.date || formattedDate,
        maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3
      };
    }
    
    // 2. 날짜 ID 문서가 없으면 날짜 필드로 쿼리
    console.log(`[VacationService] 쿼리 조건: date == "${formattedDate}"`);
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const exactQuery = query(
      limitsRef,
      where('date', '==', formattedDate),
      limit(1)
    );
    
    // 쿼리 실행
    const snapshot = await getDocs(exactQuery);
    console.log(`[VacationService] 쿼리 결과: ${snapshot.size}개 문서 발견`);
    
    // 쿼리 결과가 있는 경우
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      console.log(`[VacationService] 쿼리에서 문서 발견! ID=${doc.id}, 날짜=${data.date}, 인원=${data.maxPeople}`);
      
      return {
        id: doc.id,
        date: data.date,
        maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3
      };
    }
    
    // 결과가 없는 경우 기본값 반환
    console.log(`[VacationService] 날짜 ${formattedDate}에 대한 휴가 제한을 찾을 수 없음, 기본값(3) 반환`);
    return {
      id: '',
      date: formattedDate,
      maxPeople: 3
    };
  } catch (error) {
    console.error(`[VacationService] 휴가 제한 조회 오류 (날짜: ${format(date, 'yyyy-MM-dd')}):`, error);
    // 에러가 발생해도 기본값 반환
    return {
      id: '',
      date: format(date, 'yyyy-MM-dd'),
      maxPeople: 3
    };
  }
}

/**
 * 휴가 제한을 설정하는 함수
 * @param date 날짜 (문자열 'YYYY-MM-DD' 또는 Date 객체)
 * @param maxPeople 최대 인원
 * @returns 설정된 휴가 제한 정보
 */
export async function setVacationLimit(
  date: string | Date,
  maxPeople: number
): Promise<VacationLimit> {
  try {
    // 날짜 처리 개선: 문자열 또는 Date 객체 모두 지원
    let dateObj: Date;
    let dateStr: string;

    if (date instanceof Date) {
      dateObj = date;
      dateStr = format(date, 'yyyy-MM-dd');
    } else {
      // 문자열인 경우 (YYYY-MM-DD 형식 검증)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error(`[VacationService] 유효하지 않은 날짜 형식: ${date}`);
        throw new Error('유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식이 필요합니다.');
      }
      
      dateObj = parseISO(date);
      dateStr = date;
      
      // 유효한 날짜인지 확인
      if (!isValid(dateObj)) {
        console.error(`[VacationService] 유효하지 않은 날짜: ${date}`);
        throw new Error('유효하지 않은 날짜입니다.');
      }
    }

    // 중요: 날짜 문자열을 문서 ID로 사용
    const docId = dateStr;
    console.log(`[VacationService] 휴가 제한 설정: ${docId} (최대 ${maxPeople}명)`);

    // 이미 존재하는 문서 확인
    const docRef = doc(db, VACATION_LIMITS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    
    const now = serverTimestamp();
    
    if (docSnap.exists()) {
      // 기존 문서 업데이트
      const currentData = docSnap.data();
      console.log(`[VacationService] 기존 제한 발견: ${docId}, 현재=${currentData.maxPeople}, 새값=${maxPeople}`);
      
      await updateDoc(docRef, {
        maxPeople: Number(maxPeople),
        updatedAt: now
      });
      
      console.log(`[VacationService] 문서 업데이트 완료: ${docId}`);
    } else {
      // 새 문서 생성 - 문서 ID로 날짜 사용
      console.log(`[VacationService] 새 문서 생성: ${docId}, 값=${maxPeople}`);
      
      await setDoc(docRef, {
        date: dateStr,
        maxPeople: Number(maxPeople),
        createdAt: now,
        updatedAt: now
      });
      
      console.log(`[VacationService] 새 문서 생성 완료: ${docId}`);
    }
    
    // 저장 확인
    setTimeout(async () => {
      try {
        const verifySnap = await getDoc(docRef);
        if (verifySnap.exists()) {
          const verifyData = verifySnap.data();
          console.log(`[VacationService] 저장 확인: ID=${docId}, 값=${verifyData.maxPeople}`);
        } else {
          console.error(`[VacationService] 문서 저장 확인 실패: ${docId}`);
        }
      } catch (err) {
        console.error(`[VacationService] 저장 확인 중 오류:`, err);
      }
    }, 500);
    
    // 결과 반환
    return {
      id: docId,
      date: dateStr,
      maxPeople: Number(maxPeople)
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
        maxPeople: data.maxPeople
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
    // 캐시 방지를 위해 Firebase 쿼리 실행 시간 기록
    const queryStartTime = Date.now();
    
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    // 명시적으로 서버에서 최신 데이터 가져오기
    const querySnapshot = await getDocs(q);
    
    // 날짜를 키로 하는 맵 생성 (동일한 날짜에 여러 문서가 있을 경우 날짜 ID 문서 우선)
    const dateMap = new Map<string, VacationLimit>();
    
    console.log(`[VacationService] 휴가 제한 데이터 조회 완료: ${querySnapshot.size}건 (소요시간: ${Date.now() - queryStartTime}ms)`);
    
    // 응답 데이터의 날짜 범위 검증
    const dateSet = new Set<string>();
    
    // 첫 번째 패스: 모든 문서 처리 (날짜 ID가 아닌 것도 포함)
    querySnapshot.forEach((document) => {
      const data = document.data();
      const dateStr = data.date;
      
      if (!dateStr) {
        console.warn(`[VacationService] 날짜 필드가 없는 문서 발견: ID=${document.id}`);
        return; // 날짜가 없는 문서는 건너뜀
      }
      
      dateSet.add(dateStr.substring(0, 7)); // YYYY-MM 추출
      
      // 기본값: 모든 문서를 맵에 추가
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          id: document.id,
          date: dateStr,
          maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3
        });
      }
    });
    
    // 날짜 범위 검증 로그
    const startMonth = startDateStr.substring(0, 7);
    const endMonth = endDateStr.substring(0, 7);
    const months = Array.from(dateSet);
    
    console.log(`[VacationService] 휴가 제한 데이터 월: [${months.join(', ')}], 요청 월: ${startMonth}~${endMonth}`);
    
    if (months.length > 0 && !months.some(m => m === startMonth)) {
      console.warn(`[VacationService] 휴가 제한 데이터 월 불일치 감지! 요청: ${startMonth}, 데이터: ${months[0]}`);
    }
    
    // 두 번째 패스: 날짜 ID를 가진 문서로 맵 업데이트 (우선순위 부여)
    querySnapshot.forEach((document) => {
      const data = document.data();
      const docId = document.id;
      const dateStr = data.date;
      
      // docId가 날짜 형식(YYYY-MM-DD)인 경우 무조건 이 값을 사용
      if (docId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`[VacationService] 날짜 ID 문서 발견: ${docId} (${data.maxPeople}명)`);
        
        dateMap.set(dateStr, {
          id: docId,
          date: dateStr,
          maxPeople: typeof data.maxPeople === 'number' ? data.maxPeople : parseInt(data.maxPeople, 10) || 3
        });
      }
    });
    
    // 결과 변환
    const limits = Array.from(dateMap.values());
    
    // 특정 날짜에 대한 로그 출력 (디버깅용)
    limits.forEach(limit => {
      console.log(`[VacationService] 최종 제한: 날짜=${limit.date}, ID=${limit.id}, 인원=${limit.maxPeople}`);
    });
    
    console.log(`[VacationService] 날짜 범위의 휴가 제한 ${limits.length}개 조회 완료`);
    return limits;
  } catch (error) {
    console.error('[VacationService] 날짜 범위 휴가 제한 조회 중 오류:', error);
    throw error;
  }
} 