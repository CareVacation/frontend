import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, deleteDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { VacationRequest, VacationLimit } from '@/types/vacation';
import { format } from 'date-fns';

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
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const q = query(
      limitsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const querySnapshot = await getDocs(q);
    const limits: VacationLimit[] = [];
    
    querySnapshot.forEach((doc) => {
      limits.push({
        id: doc.id,
        ...doc.data()
      } as VacationLimit);
    });
    
    return limits;
  } catch (error) {
    console.error('월별 휴가 제한 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜의 휴가 제한 가져오기
export async function getVacationLimitForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  try {
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const q = query(
      limitsRef,
      where('date', '==', dateStr)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // 해당 날짜에 제한이 없으면 기본값 반환
      return {
        date: dateStr,
        maxPeople: 3, // 기본 최대 인원
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    
    // 첫 번째 문서 반환
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as VacationLimit;
  } catch (error) {
    console.error('일자별 휴가 제한 조회 중 오류:', error);
    throw error;
  }
}

// 휴가 제한 설정하기
export async function setVacationLimit(date: Date, maxPeople: number) {
  const dateStr = format(date, 'yyyy-MM-dd');

  try {
    // 기존 제한 확인
    const limitsRef = collection(db, VACATION_LIMITS_COLLECTION);
    const q = query(
      limitsRef,
      where('date', '==', dateStr)
    );

    const querySnapshot = await getDocs(q);
    const now = Date.now();
    
    if (querySnapshot.empty) {
      // 새로운 제한 생성
      const limitData = {
        date: dateStr,
        maxPeople,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, VACATION_LIMITS_COLLECTION), limitData);
      return {
        id: docRef.id,
        ...limitData
      };
    } else {
      // 기존 제한 업데이트
      const docRef = doc(db, VACATION_LIMITS_COLLECTION, querySnapshot.docs[0].id);
      await updateDoc(docRef, {
        maxPeople,
        updatedAt: now
      });
      
      return {
        id: docRef.id,
        date: dateStr,
        maxPeople,
        createdAt: querySnapshot.docs[0].data().createdAt,
        updatedAt: now
      };
    }
  } catch (error) {
    console.error('휴가 제한 설정 중 오류:', error);
    throw error;
  }
} 