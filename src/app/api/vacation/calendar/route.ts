import { NextResponse } from 'next/server';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationLimitsForMonth } from '@/lib/vacationService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: '시작일과 종료일이 필요합니다.' },
      { status: 400 }
    );
  }
  
  try {
    // 날짜 문자열에서 년도와 월 추출
    const year = parseInt(startDate.substring(0, 4));
    const month = parseInt(startDate.substring(5, 7)) - 1; // JavaScript의 월은 0부터 시작
    
    // Firebase에서 실제 데이터 가져오기
    const [vacations, limits] = await Promise.all([
      getVacationsForMonth(year, month),
      getVacationLimitsForMonth(year, month)
    ]);
    
    // 휴가 제한 데이터를 날짜별로 맵핑
    const limitsMap: Record<string, VacationLimit> = {};
    limits.forEach(limit => {
      limitsMap[limit.date] = limit;
    });
    
    // 휴가 데이터를 날짜별로 정리
    const calendarData: Record<string, DayInfo> = {};
    
    // 먼저 모든 휴가 정보를 날짜별로 그룹화
    vacations.forEach(vacation => {
      const date = vacation.date;
      
      if (!calendarData[date]) {
        calendarData[date] = {
          date,
          count: 0,
          people: [],
          vacations: []
        };
      }
      
      calendarData[date].count += 1;
      calendarData[date].people.push(vacation);
      // 캘린더 셀에 표시하기 위한 휴가 정보 리스트
      if (!calendarData[date].vacations) {
        calendarData[date].vacations = [];
      }
      calendarData[date].vacations.push(vacation);
    });
    
    // 휴가 제한 상태 업데이트
    Object.keys(calendarData).forEach(date => {
      const limit = limitsMap[date] || { maxPeople: 3 }; // 기본값: 3명
      const currentCount = calendarData[date].count;
      
      calendarData[date].limit = limit;
      
      if (currentCount < limit.maxPeople) {
        calendarData[date].status = 'available'; // 여유 있음
      } else if (currentCount === limit.maxPeople) {
        calendarData[date].status = 'full'; // 꽉 참
      } else {
        calendarData[date].status = 'over'; // 초과됨
      }
    });
    
    console.log('Firebase에서 가져온 휴가 데이터:', calendarData);
    return NextResponse.json(calendarData);
  } catch (error) {
    console.error('휴가 데이터 조회 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 데이터를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
} 