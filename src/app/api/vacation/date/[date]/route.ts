import { NextResponse } from 'next/server';
import { VacationRequest } from '@/types/vacation';
import { getVacationsForDate, getVacationLimitForDate } from '@/lib/vacationService';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    
    console.log(`API 호출: 날짜 ${date} 휴가 정보 요청`);
    
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error(`잘못된 날짜 형식: ${date}`);
      return NextResponse.json(
        { error: '올바른 날짜 형식(YYYY-MM-DD)이 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // 문자열 날짜를 Date 객체로 변환
    const dateObj = new Date(date);
    
    // Firebase에서 해당 날짜의 휴가 정보 및 제한 가져오기
    const [vacations, limitData] = await Promise.all([
      getVacationsForDate(dateObj),
      getVacationLimitForDate(dateObj)
    ]);
    
    const maxPeople = limitData?.maxPeople ?? 3;
    
    console.log(`날짜 ${date}의 휴가 정보 조회 성공:`, 
      JSON.stringify({ count: vacations.length })
    );
    
    // 성공 응답
    return NextResponse.json({ 
      date,
      vacations,
      totalCount: vacations.length,
      maxPeople
    }, { headers: corsHeaders });
  } catch (error) {
    // 자세한 에러 로깅
    console.error('날짜별 휴가 정보 조회 중 오류:', error);
    
    // 에러 타입에 따른 응답
    if (error instanceof Error) {
      console.error(`에러 메시지: ${error.message}`);
      console.error(`에러 스택: ${error.stack}`);
    }
    
    // 클라이언트에 에러 응답
    return NextResponse.json(
      { 
        error: '휴가 정보를 가져오는데 실패했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500, headers: corsHeaders }
    );
  }
} 