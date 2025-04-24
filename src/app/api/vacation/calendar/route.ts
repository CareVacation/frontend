import { NextResponse } from 'next/server';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForMonth, getVacationLimitsForMonth } from '@/lib/vacationService';
import { format, parse } from 'date-fns';

// 기본 CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    // URL에서 검색 파라미터 추출
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log(`캘린더 API 호출: startDate=${startDate}, endDate=${endDate}`);
    
    if (!startDate || !endDate) {
      console.error('시작일 또는 종료일이 누락됨');
      return NextResponse.json(
        { error: '시작일과 종료일 파라미터가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      console.error('날짜 형식 오류');
      return NextResponse.json(
        { error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // 문자열 날짜 파싱
    const startDateObj = parse(startDate, 'yyyy-MM-dd', new Date());
    const endDateObj = parse(endDate, 'yyyy-MM-dd', new Date());
    
    // 월별 데이터 가져오기
    // 이 구현은 한 달 전체를 가져오는 것이 목표이므로, 
    // 시작 날짜의 연도와 월만 사용하여 해당 월의 데이터 조회
    const year = startDateObj.getFullYear();
    const month = startDateObj.getMonth();
    
    const vacations = await getVacationsForMonth(year, month);
    
    // 연/월/일 별로 그룹화된 결과 생성
    const result: Record<string, any> = {};
    
    vacations.forEach(vacation => {
      const date = vacation.date;
      
      if (!result[date]) {
        result[date] = {
          date,
          vacations: [],
          totalVacationers: 0
        };
      }
      
      result[date].vacations.push(vacation);
      
      // 거부된 휴가는 카운트에서 제외
      if (vacation.status !== 'rejected') {
        result[date].totalVacationers += 1;
      }
    });
    
    console.log(`캘린더 데이터 조회 성공: ${Object.keys(result).length}일의 데이터 반환`);
    
    return NextResponse.json(result, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('캘린더 데이터 조회 중 오류:', error);
    
    // 에러 타입에 따른 응답
    if (error instanceof Error) {
      console.error(`에러 메시지: ${error.message}`);
      console.error(`에러 스택: ${error.stack}`);
    }
    
    return NextResponse.json(
      { 
        error: '캘린더 데이터를 가져오는데 실패했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500, headers: corsHeaders }
    );
  }
} 