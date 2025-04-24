import { NextRequest, NextResponse } from 'next/server';
import { VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationLimitsForMonth, getVacationRequestsForDateRange, getVacationLimitsForMonthRange, getVacationLimitForDate } from '@/lib/vacationService';
import { format, parse, isValid, parseISO, eachDayOfInterval } from 'date-fns';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log(`[Calendar API] 호출: 기간 ${startDate} ~ ${endDate} 휴가 정보 요청`);
    
    // 날짜 형식 검증
    if (!startDate || !endDate || !validateDateFormat(startDate) || !validateDateFormat(endDate)) {
      console.error('[Calendar API] 오류: 잘못된 날짜 형식', { startDate, endDate });
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { 
        status: 400,
        headers: headers
      });
    }
    
    // 시작일, 종료일 파싱
    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);
    
    // 휴가 요청 데이터 조회
    console.log('[Calendar API] 휴가 요청 데이터 조회 시작');
    const vacationData = await getVacationRequestsForDateRange(startDate, endDate);
    console.log(`[Calendar API] 휴가 요청 데이터 ${vacationData.length}개 조회 완료`);
    
    // 날짜별 데이터 그룹화
    const groupedData: { [date: string]: any } = {};
    
    // 1. 먼저 범위 내 모든 날짜를 생성
    const allDates = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate });
    
    // 2. 각 날짜별로 휴가 제한 정보를 개별적으로 조회 (캘린더 API와 날짜 API의 일관성을 위해)
    console.log('[Calendar API] 각 날짜별 휴가 제한 데이터 조회 시작');
    
    // 모든 날짜의 휴가 제한 한번에 조회 (성능을 위해)
    const limitsData = await getVacationLimitsForMonthRange(startDate, endDate);
    
    // 날짜별 limit 맵으로 변환
    const limitsMap: Record<string, VacationLimit> = {};
    limitsData.forEach((limit: VacationLimit) => {
      limitsMap[limit.date] = limit;
    });
    
    console.log(`[Calendar API] 휴가 제한 데이터 맵 생성 완료: ${Object.keys(limitsMap).length}개`);
    
    // 모든 날짜에 대한 기본 데이터 구조 생성
    allDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const limitInfo = limitsMap[dateStr];
      
      groupedData[dateStr] = {
        date: dateStr,
        vacations: [],
        totalVacationers: 0,
        maxPeople: limitInfo?.maxPeople !== undefined ? limitInfo.maxPeople : 3 // 기본값 3
      };
      
      if (limitInfo) {
        console.log(`[Calendar API] 날짜 ${dateStr}의 휴가 제한: ${limitInfo.maxPeople}명`);
      }
    });
    
    // 3. 휴가 요청 데이터 그룹화
    vacationData.forEach((vacation: VacationRequest) => {
      const date = vacation.date;
      
      // 이미 초기화된 날짜 데이터에 휴가 정보 추가
      if (groupedData[date]) {
        // 휴가 요청 데이터 추가
        groupedData[date].vacations.push(vacation);
        
        // 거부된 휴가는 총 인원 수에서 제외
        if (vacation.status !== 'rejected') {
          groupedData[date].totalVacationers++;
        }
      }
    });
    
    console.log(`[Calendar API] 최종 응답 데이터: ${Object.keys(groupedData).length}개 날짜`);
    
    // 몇 개 날짜의 데이터 샘플 로깅
    const sampleDates = Object.keys(groupedData).slice(0, 3);
    sampleDates.forEach(date => {
      console.log(`[Calendar API] 샘플 - ${date}: 휴가자 ${groupedData[date].totalVacationers}명, 최대 ${groupedData[date].maxPeople}명`);
    });
    
    return NextResponse.json(groupedData, { 
      headers: {
        ...headers,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    });
  } catch (error) {
    console.error('[Calendar API] 오류:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { 
      status: 500,
      headers: headers
    });
  }
}

// 날짜 형식 유효성 검사 함수
function validateDateFormat(dateString: string): boolean {
  if (!dateString) return false;
  
  // YYYY-MM-DD 형식 체크
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  
  // 유효한 날짜인지 확인
  return isValid(parseISO(dateString));
} 