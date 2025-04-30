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
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(request: NextRequest) {
  // URL에서 쿼리 파라미터 추출
  const searchParams = request.nextUrl.searchParams;
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  console.log(`Calendar API called with startDate: ${startDateParam}, endDate: ${endDateParam}`);

  // 파라미터 검증
  if (!startDateParam || !endDateParam) {
    return NextResponse.json(
      { error: 'startDate and endDate parameters are required' },
      { status: 400, headers }
    );
  }

  // 날짜 형식 검증
  if (!isValidDateFormat(startDateParam) || !isValidDateFormat(endDateParam)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400, headers }
    );
  }

  try {
    // 해당 기간의 휴가 데이터 가져오기
    console.log(`Fetching vacations for date range: ${startDateParam} to ${endDateParam}`);
    const vacations = await getVacationRequestsForDateRange(startDateParam, endDateParam);
    console.log(`Found ${vacations.length} vacation requests in the date range`);

    // 날짜별로 그룹화
    const groupedData: VacationData = {};

    // 모든 휴가 요청을 날짜별로 그룹화
    for (const vacation of vacations) {
      const date = vacation.date;
      
      if (!groupedData[date]) {
        groupedData[date] = {
          date,
          totalVacationers: 0,
          vacations: [],
          people: []
        };
      }
      
      groupedData[date].vacations.push(vacation);
      groupedData[date].people!.push(vacation);
      groupedData[date].totalVacationers += 1;
    }

    // 각 날짜에 대한 제한 정보 한 번에 가져오기
    const limits = await getVacationLimitsForMonthRange(startDateParam, endDateParam);
    const limitsMap: Record<string, number> = {};
    limits.forEach(limit => {
      limitsMap[limit.date] = limit.maxPeople;
    });

    // groupedData에 maxPeople 할당
    Object.keys(groupedData).forEach(date => {
      groupedData[date].maxPeople = limitsMap[date] ?? 3;
    });

    // startDate ~ endDate 사이의 모든 날짜에 대해 데이터 채우기
    const start = parseISO(startDateParam);
    const end = parseISO(endDateParam);
    let current = new Date(start);

    while (current <= end) {
      const dateStr = format(current, 'yyyy-MM-dd');
      if (!groupedData[dateStr]) {
        groupedData[dateStr] = {
          date: dateStr,
          totalVacationers: 0,
          vacations: [],
          people: [],
          maxPeople: limitsMap[dateStr] ?? 3
        };
      }
      current.setDate(current.getDate() + 1);
    }

    console.log(`Returning data for ${Object.keys(groupedData).length} days`);
    return NextResponse.json({ dates: groupedData }, { headers });
  } catch (error) {
    console.error('Error in calendar API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vacation data' },
      { status: 500, headers }
    );
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