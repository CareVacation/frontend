import { NextResponse } from 'next/server';
import { createVacationRequest } from '@/lib/vacationService';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.userName || !data.date) {
      return NextResponse.json(
        { error: '이름과 날짜는 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }
    
    // userId 생성 (실제 앱에서는 인증 시스템에서 가져옴)
    const userId = `user_${Date.now()}`;
    
    // 휴가 신청 생성
    const vacationRequest = await createVacationRequest({
      userId,
      userName: data.userName,
      date: data.date,
      reason: data.reason || '',
      status: 'pending', // 기본값은 대기 상태
      type: data.type || 'regular',
      updatedAt: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: true,
      data: vacationRequest
    });
  } catch (error) {
    console.error('휴가 신청 처리 중 오류:', error);
    return NextResponse.json(
      { error: '휴가 신청을 처리하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 