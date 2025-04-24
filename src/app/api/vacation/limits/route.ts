import { NextResponse, NextRequest } from 'next/server';
import { VacationLimit } from '@/types/vacation';
import { getVacationLimitsForMonth, setVacationLimit, getVacationLimits } from '@/lib/vacationService';
import { format, parseISO } from 'date-fns';
import { parse } from 'date-fns';

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
    const body = await request.json();
    const { limits } = body;

    // 유효성 검사
    if (!limits || !Array.isArray(limits)) {
      console.warn('[API] 휴가 제한 설정 요청 실패: 유효한 limits 배열이 없음');
      return NextResponse.json(
        { error: '유효한 limits 배열이 필요합니다' },
        { status: 400 }
      );
    }

    console.log(`[API] 휴가 제한 설정 요청: ${limits.length}건 처리 시작`);
    let successCount = 0;
    let errorCount = 0;

    for (const item of limits) {
      try {
        // 각 항목 유효성 검사
        if (!item.date || !isValidDateFormat(item.date) || typeof item.maxPeople !== 'number') {
          console.warn(`[API] 휴가 제한 항목 유효성 검사 실패: ${JSON.stringify(item)}`);
          errorCount++;
          continue;
        }

        console.log(`[API] 휴가 제한 설정 처리중: ${item.date} (최대 ${item.maxPeople}명)`);
        await setVacationLimit(item.date, item.maxPeople);
        successCount++;
      } catch (itemError) {
        console.error(`[API] 휴가 제한 설정 항목 오류 (${item?.date || 'unknown'}):`, itemError);
        errorCount++;
      }
    }

    console.log(`[API] 휴가 제한 설정 완료: 성공 ${successCount}건, 실패 ${errorCount}건`);
    return NextResponse.json({
      message: `${successCount}개의 휴가 제한이 성공적으로 저장되었습니다.${errorCount > 0 ? ` (${errorCount}개 실패)` : ''}`
    });
  } catch (error) {
    console.error('[API] 휴가 제한 설정 요청 처리 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 