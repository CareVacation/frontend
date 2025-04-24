import { NextRequest, NextResponse } from 'next/server';
import { VacationRequest, VacationLimit } from '@/types/vacation';
import { getVacationsForDate, getVacationLimitForDate } from '@/lib/vacationService';
import { format, isValid, parseISO } from 'date-fns';

// CORS 헤더 설정
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
  request: NextRequest
) {
  try {
    // URL에서 경로 매개변수 추출
    const dateParam = request.nextUrl.pathname.split('/').pop() || '';
    console.log(`[Date API] 호출: 날짜 ${dateParam} 휴가 정보 요청, 시간=${new Date().toISOString()}`);
    
    // 날짜 형식 검증
    if (!validateDateFormat(dateParam)) {
      console.error(`[Date API] 잘못된 날짜 형식: ${dateParam}`);
      return NextResponse.json(
        { error: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 사용하세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 날짜 파싱
    const date = parseISO(dateParam);
    
    // 동시에 휴가 요청과, 휴가 제한 정보를 모두 조회
    const [vacations, limitInfo] = await Promise.all([
      getVacationsForDate(date),
      getVacationLimitForDate(date).catch(error => {
        console.error(`[Date API] 날짜 ${dateParam}의 휴가 제한 정보 조회 실패:`, error);
        return { id: '', date: dateParam, maxPeople: 3 }; // 기본값 반환
      })
    ]);
    
    // 휴가 제한 정보 상세 로깅 (디버깅용)
    console.log(`[Date API] 날짜 ${dateParam}의 휴가 제한 상세 정보:`);
    console.log(`- ID: ${limitInfo?.id || 'N/A'}`);
    console.log(`- 최대인원: ${limitInfo?.maxPeople || 3}`);
    console.log(`- 원본 제한 데이터: ${JSON.stringify(limitInfo)}`);
    
    // 유효한 휴가 수 계산 (거부된 휴가 제외)
    const approvedVacations = vacations.filter(v => v.status !== 'rejected');
    const totalVacationers = approvedVacations.length;
    
    // 응답 데이터 구성
    const response = {
      date: dateParam,
      vacations,
      totalVacationers,
      maxPeople: limitInfo?.maxPeople !== undefined ? limitInfo.maxPeople : 3, // maxPeople이 0이면 0을 반환, undefined면 3 반환
    };
    
    console.log(`[Date API] 날짜 ${dateParam}의 휴가 정보 최종 응답:`, { 
      '휴가수': totalVacationers, 
      '최대인원': response.maxPeople,
      '휴가승인': approvedVacations.length,
      '총요청': vacations.length
    });
    
    return NextResponse.json(response, { 
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache', 
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error(`[Date API] 오류 발생:`, error);
    return NextResponse.json(
      { error: '휴가 정보를 가져오는데 실패했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 날짜 형식 유효성 검사 함수
function validateDateFormat(dateString: string): boolean {
  if (!dateString) return false;
  
  // YYYY-MM-DD 형식 체크
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  
  // 유효한 날짜인지 확인
  return isValid(parseISO(dateString));
} 