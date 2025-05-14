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
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    // URL에서 날짜 파라미터 추출
    const { date: dateParam } = await params;
    // role 파라미터 추출 (없으면 caregiver)
    const roleParam = request.nextUrl.searchParams.get('role');
    const role = (roleParam === 'all' || roleParam === 'caregiver' || roleParam === 'office') 
      ? roleParam : 'caregiver';
    
    // nameFilter 파라미터 추출
    const nameFilter = request.nextUrl.searchParams.get('nameFilter');

    console.log(`[Date API] 날짜 ${dateParam}에 대한 휴가 요청 조회 시작 (role=${role}, nameFilter=${nameFilter || 'none'})`);

    // 유효한 날짜 형식인지 확인
    if (!dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error(`[Date API] 잘못된 날짜 형식: ${dateParam}`);
      return new Response(JSON.stringify({ error: '잘못된 날짜 형식입니다.' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const date = new Date(dateParam);
    
    // 동시에 휴가 요청과, 휴가 제한 정보를 모두 조회
    const [vacations, limitInfo] = await Promise.all([
      getVacationsForDate(date),
      // 'all'이 아닌 경우에만 제한 정보 조회
      role !== 'all' 
        ? getVacationLimitForDate(date, role as 'caregiver' | 'office').catch(error => {
            console.error(`[Date API] 날짜 ${dateParam}의 휴가 제한 정보 조회 실패:`, error);
            return { id: '', date: dateParam, maxPeople: 3, role: role as 'caregiver' | 'office' }; // 기본값 반환
          })
        : Promise.resolve(null)
    ]);
    
    // role 파라미터에 따라 휴가 신청자 필터링
    let filteredVacations = role === 'all' 
      ? vacations 
      : vacations.filter(v => v.role === role);
    
    // nameFilter가 있을 경우 이름으로 추가 필터링
    if (nameFilter) {
      filteredVacations = filteredVacations.filter(v => v.userName === nameFilter);
      console.log(`[Date API] 이름 필터 적용: ${nameFilter}, 필터링 후 ${filteredVacations.length}명`);
    }
    
    // 해당 날짜의 총 휴가자 수 계산 (거부된 휴가는 제외)
    const totalVacationers = filteredVacations.filter(v => v.status !== 'rejected').length;
    
    console.log(`[Date API] 필터링 후 반환: ${filteredVacations.length}명의 휴가 신청자, 제한=${limitInfo?.maxPeople ?? 'N/A'}, role=${role}, nameFilter=${nameFilter || 'none'}`);
    
    // 응답 데이터 포맷
    const responseData: {
      date: string;
      vacations: VacationRequest[];
      totalVacationers: number;
      maxPeople?: number;
    } = {
      date: dateParam,
      vacations: filteredVacations,
      totalVacationers
    };
    
    // role이 'all'이 아닌 경우에만 maxPeople 추가
    if (role !== 'all' && limitInfo) {
      responseData.maxPeople = limitInfo.maxPeople !== undefined ? limitInfo.maxPeople : 3;
    }
    
    return new Response(JSON.stringify(responseData), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('[Date API] 오류 발생:', error);
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
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