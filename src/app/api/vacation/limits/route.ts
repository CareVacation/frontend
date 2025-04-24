import { NextResponse, NextRequest } from 'next/server';
import { VacationLimit } from '@/types/vacation';
import { getVacationLimitsForMonth, setVacationLimit, getVacationLimits } from '@/lib/vacationService';
import { format, parseISO } from 'date-fns';
import { parse } from 'date-fns';

// 응답 헤더를 추가하여 캐시 방지
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

function isValidDateFormat(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// GET: 기간 내 휴가 제한 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // 날짜 유효성 검사
    if (!start || !end || !isValidDateFormat(start) || !isValidDateFormat(end)) {
      console.warn(`[API] 휴가 제한 조회 요청 실패: 잘못된 날짜 형식 (start: ${start}, end: ${end})`);
      return NextResponse.json(
        { error: '유효한 start 및 end 날짜가 필요합니다 (YYYY-MM-DD 형식)' },
        { status: 400 }
      );
    }

    console.log(`[API] 휴가 제한 조회 요청: ${start} ~ ${end}`);
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const limits = await getVacationLimits(startDate, endDate);
    console.log(`[API] 휴가 제한 조회 결과: ${limits.length}건 반환`);
    
    return NextResponse.json({ limits });
  } catch (error) {
    console.error('[API] 휴가 제한 조회 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: 휴가 제한 설정
export async function POST(request: NextRequest) {
  try {
    // 요청 본문에서 데이터 추출
    const body = await request.json();
    const { limits } = body;
    
    console.log(`[Limits API] POST 요청 받음, ${limits.length}개 항목, 현재 시간: ${new Date().toISOString()}`);
    
    if (!limits || !Array.isArray(limits)) {
      console.error('[Limits API] 잘못된 요청 형식:', body);
      return NextResponse.json(
        { error: '올바른 형식의 휴가 제한 데이터가 필요합니다' },
        { status: 400 }
      );
    }
    
    console.log('[Limits API] 휴가 제한 저장 시작...');
    const savedLimits = [];
    
    // 각 제한 항목을 저장
    for (const limit of limits) {
      const { date, maxPeople } = limit;
      
      if (!date || maxPeople === undefined) {
        console.warn(`[Limits API] 잘못된 데이터 항목 건너뜀:`, limit);
        continue;
      }
      
      try {
        console.log(`[Limits API] 휴가 제한 저장: ${date}, 최대 ${maxPeople}명`);
        const result = await setVacationLimit(date, maxPeople);
        savedLimits.push(result);
        console.log(`[Limits API] 제한 저장 성공: ${date}`);
      } catch (err) {
        console.error(`[Limits API] 제한 항목 저장 중 오류(계속 진행): ${date}`, err);
      }
    }
    
    console.log(`[Limits API] 저장 완료, ${savedLimits.length}개 항목, 타임스탬프: ${Date.now()}`);
    
    // 캐시 방지 헤더를 포함한 성공 응답
    const responseHeaders = {
      ...headers,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'x-timestamp': Date.now().toString()
    };
    
    return NextResponse.json(
      {
        success: true,
        message: `${savedLimits.length}개의 휴가 제한이 저장되었습니다.`,
        limits: savedLimits,
        timestamp: Date.now()
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error('[Limits API] 휴가 제한 저장 중 오류:', error);
    
    return NextResponse.json(
      {
        error: '휴가 제한 저장 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: Date.now()
      },
      { status: 500, headers }
    );
  }
} 