import { NextResponse } from 'next/server';
import { VacationLimit } from '@/types/vacation';
import { getVacationLimitsForMonth, setVacationLimit } from '@/lib/vacationService';
import { format, parseISO } from 'date-fns';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  
  if (!start || !end) {
    return NextResponse.json(
      { error: '시작일과 종료일이 필요합니다.' },
      { status: 400, headers }
    );
  }
  
  try {
    // 시작일의 연도와 월을 추출
    const startDate = parseISO(start);
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    
    // Firebase에서 실제 데이터 가져오기
    const limitsData = await getVacationLimitsForMonth(year, month);
    
    return NextResponse.json({ limits: limitsData }, { headers });
  } catch (error) {
    console.error('휴가 제한 데이터 조회 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 데이터를 가져오는데 실패했습니다.' },
      { status: 500, headers }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { limits } = body;
    
    if (!limits || !Array.isArray(limits)) {
      return NextResponse.json(
        { error: '유효한 데이터가 전달되지 않았습니다.' },
        { status: 400, headers }
      );
    }
    
    // Firebase에 데이터 저장하기
    const savedLimits = await Promise.all(
      limits.map(async (limit: VacationLimit) => {
        if (!limit.date || typeof limit.maxPeople !== 'number') {
          throw new Error(`유효하지 않은 데이터: ${JSON.stringify(limit)}`);
        }
        
        const date = parseISO(limit.date);
        const result = await setVacationLimit(date, limit.maxPeople);
        return result;
      })
    );
    
    return NextResponse.json({ 
      success: true,
      savedLimits
    }, { headers });
  } catch (error) {
    console.error('휴가 제한 저장 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 저장에 실패했습니다.' },
      { status: 500, headers }
    );
  }
} 