import { NextRequest, NextResponse } from 'next/server';
import { format, isValid, parse, parseISO } from 'date-fns';
import { getVacationLimitForDate, getVacationRequestsForDateRange, getVacationLimitsForMonthRange } from '@/lib/vacationService';
import { VacationData, VacationRequest, VacationLimit } from '@/types/vacation';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(request: NextRequest) {
  try {
    // URL에서 검색 파라미터 추출
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const roleFilter = url.searchParams.get('roleFilter') || 'all';
    // 캐시 무효화를 위한 타임스탬프 파라미터 (무시됨)
    const timestamp = url.searchParams.get('_t');
    const requestId = url.searchParams.get('_r');
    const retryCount = parseInt(url.searchParams.get('_retry') || '0');

    console.log(`[API] 휴가 캘린더 요청 시작 - ID: ${requestId || 'unknown'}, 시도: ${retryCount}`);
    console.log(`[API] 요청 날짜 범위: ${startDate} ~ ${endDate}, 필터: ${roleFilter}`);

    // 파라미터 유효성 검사
    if (!startDate || !endDate) {
      return NextResponse.json({
        error: 'startDate와 endDate 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // 날짜 형식 유효성 검사
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({
        error: '날짜 형식은 YYYY-MM-DD여야 합니다.'
      }, { status: 400, headers });
    }

    // 시작일과 종료일의 월 확인
    const startMonth = startDate.substring(0, 7); // YYYY-MM
    const endMonth = endDate.substring(0, 7); // YYYY-MM
    console.log(`[API] 요청 월: ${startMonth}`);
    
    // 휴가 신청 데이터 가져오기
    try {
      console.log(`[API] 휴가 데이터 조회 시작: ${startDate} ~ ${endDate}`);
      
      // 휴가 신청 및 제한 데이터 가져오기
      const vacations = await getVacationRequestsForDateRange(startDate, endDate);
      const limits = await getVacationLimitsForMonthRange(startDate, endDate);
      
      console.log(`[API] 데이터 조회 완료: 휴가=${vacations.length}건, 제한=${limits.length}건`);

      // 직원 유형별 필터링
      let filteredVacations = vacations;
      if (roleFilter !== 'all') {
        filteredVacations = vacations.filter(vacation => 
          vacation.role === roleFilter || vacation.role === 'all'
        );
        console.log(`[API] 직원 유형 필터링 적용 (${roleFilter}): ${filteredVacations.length}건`);
      }

      // 날짜별로 휴가 데이터 정리
      const dateMap = new Map();
      
      // 먼저 전체 날짜에 대한 기본 구조 생성
      const startDateObj = parseISO(startDate);
      const endDateObj = parseISO(endDate);
      
      // 각 휴가별 카운팅 (상태가 'rejected'가 아닌 경우만)
      filteredVacations.forEach(vacation => {
        const dateKey = vacation.date;
        
        if (!dateKey) {
          console.warn(`[API] 날짜 필드가 없는 휴가 발견: ID=${vacation.id}`);
          return; // 날짜가 없는 휴가는 건너뜀
        }
        
        // 요청된 날짜 범위 내에 있는지 검증
        if (dateKey < startDate || dateKey > endDate) {
          console.warn(`[API] 범위 밖의 휴가 무시: ${dateKey}, ID=${vacation.id}`);
          return; // 범위 밖의 데이터 제외
        }
        
        if (!dateMap.has(dateKey)) {
          // 해당 날짜에 대한 기본 구조 생성
          dateMap.set(dateKey, {
            date: dateKey,
            vacations: [],
            totalVacationers: 0,
            maxPeople: 3 // 기본값
          });
        }
        
        const dateData = dateMap.get(dateKey);
        dateData.vacations.push(vacation);
        
        // '거부' 상태가 아닌 휴가만 카운트
        if (vacation.status !== 'rejected') {
          dateData.totalVacationers++;
        }
      });
      
      // 휴가 제한 정보 적용
      limits.forEach(limit => {
        if (roleFilter !== 'all' && limit.role !== roleFilter) return; // role별로 분리 적용
        const dateKey = limit.date;
        if (!dateKey) {
          console.warn(`[API] 날짜 필드가 없는 제한 발견: ID=${limit.id}`);
          return; // 날짜가 없는 제한은 건너뜀
        }
        if (dateKey < startDate || dateKey > endDate) {
          console.warn(`[API] 범위 밖의 제한 무시: ${dateKey}, ID=${limit.id}`);
          return; // 범위 밖의 데이터 제외
        }
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            date: dateKey,
            vacations: [],
            totalVacationers: 0,
            maxPeople: limit.maxPeople
          });
        } else {
          dateMap.get(dateKey).maxPeople = limit.maxPeople;
        }
      });
      
      // 데이터를 객체로 변환 (Map -> Object)
      const resultObject = {
        dates: Object.fromEntries(dateMap)
      };
      
      // 응답 데이터 검증: 날짜 범위 확인
      const allDates = Object.keys(resultObject.dates);
      if (allDates.length > 0) {
        const responseMonth = allDates[0].substring(0, 7);
        // 데이터의 첫 번째 날짜가 요청 월과 일치하는지 확인
        const isResponseValid = allDates.some(date => date.startsWith(startMonth));
        
        if (!isResponseValid) {
          console.error(`[API] 응답 데이터 월 불일치! 요청: ${startMonth}, 응답: ${responseMonth}`);
          return NextResponse.json({
            error: `응답 데이터 월 불일치 (요청: ${startMonth}, 응답: ${responseMonth})`,
            requestId,
            retryCount
          }, { status: 500, headers });
        }
        
        // 모든 날짜가 요청 범위 내에 있는지 확인
        const outsideRangeDates = allDates.filter(date => date < startDate || date > endDate);
        if (outsideRangeDates.length > 0) {
          console.warn(`[API] 응답에 범위 밖 날짜 발견: ${outsideRangeDates.join(', ')}`);
          // 범위 밖 날짜 데이터 제거
          outsideRangeDates.forEach(date => {
            delete resultObject.dates[date];
          });
        }
      }
      
      console.log(`[API] 응답 완료 - ID: ${requestId || 'unknown'}, 시도: ${retryCount}, 날짜 수: ${Object.keys(resultObject.dates).length}`);
      return NextResponse.json(resultObject, { headers });
      
    } catch (error) {
      console.error('[API] 휴가 데이터 조회 중 오류:', error);
      throw error;
    }
  } catch (error) {
    console.error('[API] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// 날짜 형식 검증 함수 (YYYY-MM-DD)
function isValidDateFormat(dateString: string): boolean {
  if (!dateString) return false;
  
  // 정규식으로 기본 형식 검증
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  // date-fns를 사용하여 실제 유효한 날짜인지 검증
  const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(parsedDate);
} 