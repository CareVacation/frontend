import { NextResponse } from 'next/server';
import { VacationLimit } from '@/types/vacation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  
  if (!start || !end) {
    return NextResponse.json(
      { error: '시작일과 종료일이 필요합니다.' },
      { status: 400 }
    );
  }
  
  try {
    // 여기서는 테스트 데이터를 반환합니다
    // 실제로는 DB에서 데이터를 가져와야 합니다
    const limits: VacationLimit[] = [];
    
    // 테스트 데이터 생성 (모든 날짜에 대해)
    const startYear = start.substring(0, 4);
    const startMonth = start.substring(5, 7);
    
    // 해당 월의 모든 날짜에 대해 데이터 생성
    // 5일, 15일, 25일은 인원 제한 다르게 설정
    const daysInMonth = new Date(parseInt(startYear), parseInt(startMonth), 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const date = `${startYear}-${startMonth}-${dayStr}`;
      
      // 특정 날짜는 더 적은/많은 인원으로 설정
      let maxPeople = 3; // 기본값
      
      if (day === 5 || day === 6 || day === 7) {
        maxPeople = 1; // 5~7일은 1명만 가능
      } else if (day === 15 || day === 16) {
        maxPeople = 5; // 15~16일은 5명 가능
      } else if (day === 25) {
        maxPeople = 0; // 25일은 휴가 불가
      }
      
      limits.push({
        id: `limit-${date}`,
        date,
        maxPeople,
        createdAt: new Date().toISOString()
      });
    }
    
    return NextResponse.json({ limits });
  } catch (error) {
    console.error('휴가 제한 데이터 조회 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 데이터를 가져오는데 실패했습니다.' },
      { status: 500 }
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
        { status: 400 }
      );
    }
    
    // 여기서는 성공 응답만 반환합니다
    // 실제로는 DB에 데이터를 저장해야 합니다
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('휴가 제한 저장 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
} 