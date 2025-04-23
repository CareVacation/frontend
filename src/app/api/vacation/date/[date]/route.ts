import { NextResponse } from 'next/server';
import { VacationRequest } from '@/types/vacation';
import { getVacationsForDate } from '@/lib/vacationService';

export async function GET(
  request: Request,
  { params }: { params: { date: string } }
) {
  const date = params.date;
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: '올바른 날짜 형식(YYYY-MM-DD)이 필요합니다.' },
      { status: 400 }
    );
  }
  
  try {
    // 문자열 날짜를 Date 객체로 변환
    const dateObj = new Date(date);
    
    // Firebase에서 해당 날짜의 휴가 정보 가져오기
    const vacations = await getVacationsForDate(dateObj);
    
    return NextResponse.json({ 
      date,
      vacations,
      totalCount: vacations.length
    });
  } catch (error) {
    console.error('날짜별 휴가 정보 조회 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
} 